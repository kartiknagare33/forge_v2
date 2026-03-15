import * as THREE from "three";

export function setupMultiViewCameras(mesh, width, height) {
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  const cams = [];
  const positions = [
    { pos: [0, 0, maxDim], up: [0, 1, 0] }, // 0: Front
    { pos: [0, 0, -maxDim], up: [0, 1, 0] }, // 1: Back
    { pos: [maxDim, 0, 0], up: [0, 1, 0] }, // 2: Right
    { pos: [-maxDim, 0, 0], up: [0, 1, 0] }, // 3: Left
    { pos: [0, maxDim, 0], up: [0, 0, -1] }, // 4: Top
    { pos: [0, -maxDim, 0], up: [0, 0, 1] }, // 5: Bottom
  ];

  positions.forEach((config) => {
    const cam = new THREE.OrthographicCamera(
      -maxDim / 2,
      maxDim / 2,
      maxDim / 2,
      -maxDim / 2,
      0.1,
      maxDim * 2,
    );
    cam.position.set(
      center.x + config.pos[0],
      center.y + config.pos[1],
      center.z + config.pos[2],
    );
    cam.up.set(...config.up);
    cam.lookAt(center);
    cam.updateProjectionMatrix();
    cams.push(cam);
  });
  return cams;
}

export function applySAMeshMasks(
  mesh,
  cameras,
  maskContexts,
  metalMat,
  stoneMat,
) {
  const geometry = mesh.geometry.toNonIndexed();
  const positions = geometry.attributes.position.array;
  const normals = geometry.attributes.normal
    ? geometry.attributes.normal.array
    : null;

  const metalPositions = [];
  const metalNormals = [];
  const stonePositions = [];
  const stoneNormals = [];

  mesh.updateMatrixWorld();
  const matrixWorld = mesh.matrixWorld;

  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const height = size.y;

  // 1. VERTICAL LIMIT: Stone must be in the top 20%
  const strictMetalLineY = box.max.y - height * 0.2;

  // 2. HORIZONTAL LIMIT (NEW): Stone must be in the exact center column.
  // The gemstone is never wider than ~25% of the total ring width.
  const maxStoneRadius = Math.max(size.x, size.z) * 0.25;

  for (let i = 0; i < positions.length; i += 9) {
    const cx = (positions[i] + positions[i + 3] + positions[i + 6]) / 3;
    const cy = (positions[i + 1] + positions[i + 4] + positions[i + 7]) / 3;
    const cz = (positions[i + 2] + positions[i + 5] + positions[i + 8]) / 3;
    const centroid = new THREE.Vector3(cx, cy, cz);

    centroid.applyMatrix4(matrixWorld);

    // Calculate how far this triangle is from the exact center X/Z column
    const distFromCenter = Math.sqrt(
      Math.pow(centroid.x - center.x, 2) + Math.pow(centroid.z - center.z, 2),
    );

    let sideVote = false;
    let topVote = false;

    cameras.forEach((cam, idx) => {
      const ctx = maskContexts[idx];
      if (!ctx) return;
      const projected = centroid.clone().project(cam);
      if (
        projected.x >= -1 &&
        projected.x <= 1 &&
        projected.y >= -1 &&
        projected.y <= 1
      ) {
        const px = Math.floor(((projected.x + 1) / 2) * 512);
        const py = Math.floor(((-projected.y + 1) / 2) * 512);
        const pixelIndex = (py * 512 + px) * 4;
        if (ctx.data[pixelIndex] > 128) {
          if (idx < 4) sideVote = true;
          if (idx === 4) topVote = true;
        }
      }
    });

    let isStone = false;

    // --- THE ULTIMATE FAIL-SAFE ---
    // If it is below the Y-line OR outside the Center Column, it is FORCED to be metal.
    // This physically prevents the shoulders of the ring from turning to glass.
    if (centroid.y < strictMetalLineY || distFromCenter > maxStoneRadius) {
      isStone = false;
    } else {
      // It is high up AND in the center. We let the AI mask confirm it.
      // Or if it's at the very, very top tip (top 8%), force it to stone.
      const isVeryTop = centroid.y > box.max.y - height * 0.08;
      isStone = (sideVote && topVote) || isVeryTop;
    }

    for (let j = 0; j < 9; j++) {
      if (isStone) {
        stonePositions.push(positions[i + j]);
        if (normals) stoneNormals.push(normals[i + j]);
      } else {
        metalPositions.push(positions[i + j]);
        if (normals) metalNormals.push(normals[i + j]);
      }
    }
  }

  const newPositions = new Float32Array(
    metalPositions.length + stonePositions.length,
  );
  newPositions.set(metalPositions, 0);
  newPositions.set(stonePositions, metalPositions.length);

  const newGeometry = new THREE.BufferGeometry();
  newGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(newPositions, 3),
  );

  if (normals) {
    const newNormals = new Float32Array(
      metalNormals.length + stoneNormals.length,
    );
    newNormals.set(metalNormals, 0);
    newNormals.set(stoneNormals, metalNormals.length);
    newGeometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(newNormals, 3),
    );
  }

  newGeometry.addGroup(0, metalPositions.length / 3, 0);
  newGeometry.addGroup(metalPositions.length / 3, stonePositions.length / 3, 1);

  mesh.geometry = newGeometry;
  mesh.material = [metalMat, stoneMat];
}
