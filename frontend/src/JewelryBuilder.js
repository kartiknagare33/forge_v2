import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export const METALS = {
  yellow_gold: { color: 0xffd700, roughness: 0.12 },
  white_gold: { color: 0xf0f0f0, roughness: 0.1 },
  rose_gold: { color: 0xe8a090, roughness: 0.12 },
  platinum: { color: 0xe5e4e2, roughness: 0.08 },
};

export const STONES = {
  diamond: { color: 0xffffff, transmission: 1.0, ior: 2.42 },
  ruby: { color: 0xff1020, transmission: 0.8, ior: 1.76 },
  sapphire: { color: 0x0030ff, transmission: 0.8, ior: 1.77 },
  emerald: { color: 0x10c050, transmission: 0.8, ior: 1.58 },
  amethyst: { color: 0x9b30ff, transmission: 0.9, ior: 1.54 },
};

export function makeMetalMat(metalType) {
  const m = METALS[metalType] || METALS.yellow_gold;
  return new THREE.MeshPhysicalMaterial({
    color: m.color,
    metalness: 1.0,
    roughness: m.roughness,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.5,
  });
}

export function makeStoneMat(stoneType) {
  const s = STONES[stoneType] || STONES.diamond;
  return new THREE.MeshPhysicalMaterial({
    color: s.color,
    metalness: 0,
    roughness: 0,
    transmission: s.transmission,
    ior: s.ior,
    thickness: 2.0,
    transparent: true,
    envMapIntensity: 3.0,
  });
}

// Loads the raw mesh. The segmentation and material assignment happens in Viewer.jsx now.
export function loadRawMesh(scene, callback) {
  const old = scene.getObjectByName("jewelry_group");
  if (old) scene.remove(old);

  const loader = new GLTFLoader();
  // Ensure you have a 'ring.glb' in your public/ folder!
  loader.load("/ring.glb", (gltf) => {
    const model = gltf.scene;
    model.name = "jewelry_group";

    // Find the primary mesh inside the GLTF
    let targetMesh = null;
    model.traverse((c) => {
      if (c.isMesh && !targetMesh) targetMesh = c;
    });

    // Default flat material until SAM2 segments it
    if (targetMesh)
      targetMesh.material = new THREE.MeshStandardMaterial({ color: 0x888888 });

    scene.add(model);
    if (callback && targetMesh) callback(targetMesh);
  });
}
