import * as THREE from "three";

export function applyYCoordinateBanding(mesh, metalMat, stoneMat) {
  const geometry = mesh.geometry;

  // Ensure we have position data
  if (!geometry.attributes.position) return;

  // Calculate the bounding box to find the top and bottom
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const height = box.max.y - box.min.y;

  // According to bstrack.txt: Stone is in top 35% of the mesh bounding box
  const stoneThresholdY = box.max.y - height * 0.35;

  const positions = geometry.attributes.position;
  const vertexCount = positions.count;

  // We will build two groups of indices: one for metal, one for stone
  const metalIndices = [];
  const stoneIndices = [];

  const vec3 = new THREE.Vector3();

  // If geometry is indexed, evaluate the vertices of each face
  if (geometry.index) {
    const indices = geometry.index.array;
    for (let i = 0; i < indices.length; i += 3) {
      // Get the Y position of the first vertex of the triangle
      vec3.fromBufferAttribute(positions, indices[i]);

      if (vec3.y >= stoneThresholdY) {
        stoneIndices.push(indices[i], indices[i + 1], indices[i + 2]);
      } else {
        metalIndices.push(indices[i], indices[i + 1], indices[i + 2]);
      }
    }
  } else {
    // Non-indexed geometry
    for (let i = 0; i < vertexCount; i += 3) {
      vec3.fromBufferAttribute(positions, i);
      if (vec3.y >= stoneThresholdY) {
        stoneIndices.push(i, i + 1, i + 2);
      } else {
        metalIndices.push(i, i + 1, i + 2);
      }
    }
  }

  // Rebuild the geometry with the new separated indices
  const newIndices = [...metalIndices, ...stoneIndices];
  geometry.setIndex(newIndices);

  // Clear old groups and add our two new material groups
  geometry.clearGroups();
  geometry.addGroup(0, metalIndices.length, 0); // Material 0: Metal
  geometry.addGroup(metalIndices.length, stoneIndices.length, 1); // Material 1: Stone

  // Apply the array of materials
  mesh.material = [metalMat, stoneMat];
}
