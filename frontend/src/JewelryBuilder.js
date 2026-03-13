import * as THREE from "three";

const METALS = {
  yellow_gold: { color: 0xffd700, roughness: 0.15 },
  white_gold: { color: 0xe8e8e8, roughness: 0.1 },
  rose_gold: { color: 0xe8a090, roughness: 0.15 },
  platinum: { color: 0xd0d0d8, roughness: 0.08 },
};

const STONES = {
  diamond: { color: 0xffffff, transmission: 0.95, ior: 2.42 },
  ruby: { color: 0xff1020, transmission: 0.6, ior: 1.76 },
  sapphire: { color: 0x0030ff, transmission: 0.6, ior: 1.77 },
  emerald: { color: 0x10c050, transmission: 0.55, ior: 1.58 },
  amethyst: { color: 0x9b30ff, transmission: 0.65, ior: 1.54 },
};

export function makeMetalMat(metal) {
  const m = METALS[metal] || METALS.yellow_gold;
  return new THREE.MeshPhysicalMaterial({
    color: m.color,
    metalness: 1.0,
    roughness: m.roughness,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 1.0,
  });
}

export function makeStoneMat(stone) {
  const s = STONES[stone] || STONES.diamond;
  return new THREE.MeshPhysicalMaterial({
    color: s.color,
    metalness: 0,
    roughness: 0,
    transmission: s.transmission,
    ior: s.ior,
    thickness: 3.0,
    transparent: true,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
  });
}

// ── RING BAND ───────────────────────────────────────────────────────

function buildRingBand(p, metalMat) {
  const R = (p.band_diameter_mm / 2) * 0.1;
  const bw = p.band_width_mm * 0.1;
  const t = bw * 0.13;

  const pts = [];
  if (p.band_profile === "comfort") {
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI;
      pts.push(
        new THREE.Vector2(R - t + 2 * t * Math.sin(a), (bw / 2) * Math.cos(a)),
      );
    }
  } else {
    pts.push(
      new THREE.Vector2(R - t, -bw / 2),
      new THREE.Vector2(R + t, -bw / 2),
      new THREE.Vector2(R + t, bw / 2),
      new THREE.Vector2(R - t, bw / 2),
    );
  }

  const geo = new THREE.LatheGeometry(pts, 128);
  const mesh = new THREE.Mesh(geo, metalMat);
  mesh.name = "band";
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

// ── STONE & PRONGS (FIXED MATH) ─────────────────────────────────────

function buildStoneCutProfile(r, cut) {
  const ch = r * 0.33;
  const ph = r * 0.44;
  const tr = r * 0.52;

  if (cut === "brilliant" || cut === "cushion") {
    return [
      new THREE.Vector2(0, -ph),
      new THREE.Vector2(r * 0.25, -ph * 0.55),
      new THREE.Vector2(r * 0.65, -ph * 0.15),
      new THREE.Vector2(r, 0),
      new THREE.Vector2(r, ch * 0.08),
      new THREE.Vector2(r * 0.85, ch * 0.5),
      new THREE.Vector2(tr, ch),
      new THREE.Vector2(0, ch),
    ];
  }
  if (cut === "princess") {
    return [
      new THREE.Vector2(0, -ph),
      new THREE.Vector2(r, 0),
      new THREE.Vector2(r, ch * 0.1),
      new THREE.Vector2(tr, ch),
      new THREE.Vector2(0, ch),
    ];
  }
  if (cut === "emerald") {
    return [
      new THREE.Vector2(0, -ph * 0.8),
      new THREE.Vector2(r, 0),
      new THREE.Vector2(r, ch * 0.1),
      new THREE.Vector2(tr * 1.1, ch * 0.8),
      new THREE.Vector2(0, ch * 0.8),
    ];
  }
  if (cut === "pear") {
    return [
      new THREE.Vector2(0, -ph * 1.1),
      new THREE.Vector2(r, 0),
      new THREE.Vector2(tr, ch),
      new THREE.Vector2(0, ch),
    ];
  }
  return [
    new THREE.Vector2(0, -ph),
    new THREE.Vector2(r, 0),
    new THREE.Vector2(tr, ch),
    new THREE.Vector2(0, ch),
  ];
}

function buildStoneForRing(p, stoneMat) {
  const R = (p.band_diameter_mm / 2) * 0.1;
  const r = (p.stone_size_mm / 2) * 0.1;
  const bw = p.band_width_mm * 0.1;
  const segs = p.stone_cut === "princess" || p.stone_cut === "emerald" ? 4 : 64;
  const geo = new THREE.LatheGeometry(
    buildStoneCutProfile(r, p.stone_cut),
    segs,
  );
  const mesh = new THREE.Mesh(geo, stoneMat);
  mesh.name = "stone";

  // FIX: Anchor on top of the band
  mesh.position.y = R + bw * 0.4;
  if (segs === 4) mesh.rotation.y = Math.PI / 4;
  return mesh;
}

function buildRingProng(px, pz, stoneR, bandTop, metalMat) {
  // FIX: Prongs sweep upward and inward
  const p0 = new THREE.Vector3(px * 0.5, bandTop - 0.08, pz * 0.5);
  const p1 = new THREE.Vector3(px * 0.9, bandTop + stoneR * 0.2, pz * 0.9);
  const p2 = new THREE.Vector3(px, bandTop + stoneR * 0.5, pz);
  const p3 = new THREE.Vector3(px * 0.85, bandTop + stoneR * 0.8, pz * 0.85);

  const geo = new THREE.TubeGeometry(
    new THREE.CubicBezierCurve3(p0, p1, p2, p3),
    20,
    0.022,
    8,
    false,
  );
  const mesh = new THREE.Mesh(geo, metalMat);
  mesh.name = "prong";
  return mesh;
}

function buildRingProngs(p, metalMat) {
  const g = new THREE.Group();
  g.name = "prongs";
  const count = p.prong_count || 4;
  const R = (p.band_diameter_mm / 2) * 0.1;
  const stoneR = (p.stone_size_mm / 2) * 0.1;

  // FIX: Band top calculation
  const bandTop = R + p.band_width_mm * 0.1 * 0.4;

  for (let i = 0; i < count; i++) {
    const offset = count === 4 ? Math.PI / 4 : 0;
    const angle = (i / count) * Math.PI * 2 + offset;

    g.add(
      buildRingProng(
        Math.cos(angle) * stoneR * 0.9,
        Math.sin(angle) * stoneR * 0.9,
        stoneR,
        bandTop,
        metalMat,
      ),
    );
  }
  return g;
}

// ── SHOULDERS & HALO ────────────────────────────────────────────────

function buildCathedral(p, metalMat) {
  const g = new THREE.Group();
  g.name = "shoulders";
  if (p.shoulder !== "cathedral" && p.shoulder !== "tapered") return g;

  const R = (p.band_diameter_mm / 2) * 0.1;
  const bw = p.band_width_mm * 0.1;
  const stoneR = (p.stone_size_mm / 2) * 0.1;
  const rise = p.shoulder === "cathedral" ? bw * 1.1 : bw * 0.5;

  for (const side of [-1, 1]) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(side * R * 0.85, 0, 0),
      new THREE.Vector3(side * R * 0.55, rise * 0.5, 0),
      new THREE.Vector3(side * stoneR * 1.1, R + rise, 0), // Adjusted rise
    );
    const geo = new THREE.TubeGeometry(curve, 30, bw * 0.3, 16, false);
    const mesh = new THREE.Mesh(geo, metalMat);
    mesh.name = "shoulder";
    g.add(mesh);
  }
  return g;
}

function buildHaloRing(p, metalMat) {
  const g = new THREE.Group();
  g.name = "halo";
  if (!p.halo) return g;

  const R = (p.band_diameter_mm / 2) * 0.1;
  const bw = p.band_width_mm * 0.1;
  const stoneR = (p.stone_size_mm / 2) * 0.1;
  const haloR = stoneR + 0.09;
  const count = 20;

  const haloY = R + bw * 0.4 + 0.02; // Adjusted height

  const frameGeo = new THREE.TorusGeometry(haloR, 0.018, 8, 64);
  const frame = new THREE.Mesh(frameGeo, metalMat);
  frame.position.y = haloY;
  frame.rotation.x = Math.PI / 2;
  g.add(frame);

  const smallStoneMat = makeStoneMat(p.stone);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const sgeo = new THREE.SphereGeometry(0.03, 8, 8);
    const sm = new THREE.Mesh(sgeo, smallStoneMat);
    sm.position.set(Math.cos(a) * haloR, haloY, Math.sin(a) * haloR);
    sm.name = "halo_stone";
    g.add(sm);
  }
  return g;
}

// ── MASTER ASSEMBLY ─────────────────────────────────────────────────

export function buildJewelry(params, scene) {
  const old = scene.getObjectByName("jewelry_group");
  if (old) {
    old.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    scene.remove(old);
  }

  const g = new THREE.Group();
  g.name = "jewelry_group";
  const metalMat = makeMetalMat(params.metal);
  const stoneMat = makeStoneMat(params.stone);

  g.add(buildRingBand(params, metalMat));
  g.add(buildStoneForRing(params, stoneMat));
  g.add(buildRingProngs(params, metalMat));
  g.add(buildCathedral(params, metalMat));
  g.add(buildHaloRing(params, metalMat));

  scene.add(g);
  return g;
}

export function updateMaterials(metal, stone, scene) {
  const metalMat = makeMetalMat(metal);
  const stoneMat = makeStoneMat(stone);
  const METAL_NAMES = new Set(["band", "prong", "shoulder", "halo"]);
  const STONE_NAMES = new Set(["stone", "halo_stone"]);

  scene.traverse((child) => {
    if (!child.isMesh) return;
    if (STONE_NAMES.has(child.name)) child.material = stoneMat;
    else if (METAL_NAMES.has(child.name)) child.material = metalMat;
  });
}
