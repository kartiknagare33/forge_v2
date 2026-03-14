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
    new THREE.Vector3(center.x, center.y, center.z + distance), // Front
    new THREE.Vector3(center.x, center.y, center.z - distance), // Back
    new THREE.Vector3(center.x + distance, center.y, center.z), // Right
    new THREE.Vector3(center.x - distance, center.y, center.z), // Left
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

export function applySAMeshMasks(mesh, cameras, masks2D, stoneMat, metalMat) {
  const geometry = mesh.geometry;
  if (!geometry.attributes.position) return;

  const positions = geometry.attributes.position;
  const vertexCount = positions.count;
  const vertexVotes = new Float32Array(vertexCount).fill(0);
  const vec3 = new THREE.Vector3();

  // Create canvas contexts to read pixel data from the base64 masks
  const maskCanvases = masks2D.map((maskData) => {
    if (!maskData) return null;
    const img = new Image();
    img.src = maskData;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    // Draw synchronously assuming images are preloaded, or handle async loading in Viewer
    ctx.drawImage(img, 0, 0, 512, 512);
    return ctx.getImageData(0, 0, 512, 512);
  });

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

      // Check Red channel of mask pixel
      const pixelIndex = (y * 512 + x) * 4;
      const isStone = mask.data[pixelIndex] > 128;

      if (isStone) vertexVotes[i] += 1;
      else vertexVotes[i] -= 1;
    }
  }

  // Split geometry into material groups
  geometry.clearGroups();
  let currentStart = 0;
  let currentMat = vertexVotes[0] > 0 ? 1 : 0; // 1 = Stone, 0 = Metal

  for (let i = 0; i < vertexCount; i++) {
    const matIndex = vertexVotes[i] > 0 ? 1 : 0;
    if (matIndex !== currentMat || i === vertexCount - 1) {
      geometry.addGroup(currentStart, i - currentStart, currentMat);
      currentStart = i;
      currentMat = matIndex;
    }
  }

  // Apply array of materials
  mesh.material = [metalMat, stoneMat];
}
