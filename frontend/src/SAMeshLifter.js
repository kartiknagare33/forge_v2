import * as THREE from "three";

export function setupMultiViewCameras(mesh, width = 512, height = 512) {
  const box = new THREE.Box3().setFromObject(mesh);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = maxDim * 2.0;

  const positions = [
    new THREE.Vector3(center.x, center.y, center.z + distance),
    new THREE.Vector3(center.x, center.y, center.z - distance),
    new THREE.Vector3(center.x + distance, center.y, center.z),
    new THREE.Vector3(center.x - distance, center.y, center.z),
  ];

  return positions.map((pos) => {
    const cam = new THREE.OrthographicCamera(
      -maxDim,
      maxDim,
      maxDim,
      -maxDim,
      0.1,
      distance * 3,
    );
    cam.position.copy(pos);
    cam.lookAt(center);
    cam.updateMatrixWorld();
    return cam;
  });
}

export function applySAMeshMasks(
  mesh,
  cameras,
  maskCanvases,
  metalMat,
  stoneMat,
) {
  const geometry = mesh.geometry;
  if (!geometry.attributes.position) return;

  // Clean baked-in TRELLIS textures
  if (geometry.attributes.color) geometry.deleteAttribute("color");
  if (geometry.attributes.uv) geometry.deleteAttribute("uv");

  const positions = geometry.attributes.position;
  const vertexCount = positions.count;
  const vertexVotes = new Float32Array(vertexCount).fill(0);
  const vec3 = new THREE.Vector3();

  // Raycast logic
  for (let i = 0; i < vertexCount; i++) {
    vec3.fromBufferAttribute(positions, i);
    vec3.applyMatrix4(mesh.matrixWorld);

    for (let c = 0; c < cameras.length; c++) {
      const camera = cameras[c];
      const mask = maskCanvases[c];
      if (!mask) continue;

      const projected = vec3.clone().project(camera);
      const x = Math.round(((projected.x + 1) / 2) * 512);
      const y = Math.round(((-projected.y + 1) / 2) * 512);

      if (x < 0 || x >= 512 || y < 0 || y >= 512) continue;

      const pixelIndex = (y * 512 + x) * 4;
      const isStone = mask.data[pixelIndex] > 128;

      if (isStone) vertexVotes[i] += 1;
      else vertexVotes[i] -= 1;
    }
  }

  const metalIndices = [];
  const stoneIndices = [];

  if (geometry.index) {
    const indices = geometry.index.array;
    for (let i = 0; i < indices.length; i += 3) {
      if (vertexVotes[indices[i]] > 0) {
        stoneIndices.push(indices[i], indices[i + 1], indices[i + 2]);
      } else {
        metalIndices.push(indices[i], indices[i + 1], indices[i + 2]);
      }
    }
  } else {
    for (let i = 0; i < vertexCount; i += 3) {
      if (vertexVotes[i] > 0) {
        stoneIndices.push(i, i + 1, i + 2);
      } else {
        metalIndices.push(i, i + 1, i + 2);
      }
    }
  }

  // 🚨 CRITICAL FIX: Safe memory allocation.
  // Javascript array spreads WILL crash on massive AI generated meshes.
  const newIndicesArray = new Uint32Array(
    metalIndices.length + stoneIndices.length,
  );
  newIndicesArray.set(metalIndices, 0);
  newIndicesArray.set(stoneIndices, metalIndices.length);

  geometry.setIndex(new THREE.BufferAttribute(newIndicesArray, 1));
  geometry.computeVertexNormals();

  geometry.clearGroups();
  geometry.addGroup(0, metalIndices.length, 0);
  geometry.addGroup(metalIndices.length, stoneIndices.length, 1);

  mesh.material = [metalMat, stoneMat];
}
