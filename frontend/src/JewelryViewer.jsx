import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const JewelryMesh = ({ glbBase64, faceTags, materialsConfigs }) => {
  const [scene, setScene] = useState(null);

  useEffect(() => {
    if (!glbBase64) return;

    const binary = atob(glbBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);

    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      const loadedScene = gltf.scene;

      // --- PREMIUM SHADERS ---
      const metalMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(materialsConfigs.metal),
        metalness: 1.0,
        roughness: 0.1, // Highly polished
        envMapIntensity: 2.0,
        clearcoat: 0.5,
      });

      const stoneMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(materialsConfigs.stone),
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.95, // Makes it look like glass/crystal
        ior: 2.4, // Diamond Index of Refraction
        thickness: 0.5, // Refraction thickness
        envMapIntensity: 3.0,
        clearcoat: 1.0,
      });

      const prongMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(materialsConfigs.metal).multiplyScalar(0.9),
        metalness: 1.0,
        roughness: 0.2,
      });

      const materialArray = [metalMat, stoneMat, prongMat];

      loadedScene.traverse((child) => {
        if (child.isMesh) {
          const geometry = child.geometry;
          child.material = materialArray;
          geometry.clearGroups();

          const faceToMat = {};
          if (faceTags.metal_faces) faceTags.metal_faces.forEach(f => faceToMat[f] = 0);
          if (faceTags.stone_faces) faceTags.stone_faces.forEach(f => faceToMat[f] = 1);
          if (faceTags.prong_faces) faceTags.prong_faces.forEach(f => faceToMat[f] = 2);

          const numFaces = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
          
          for (let i = 0; i < numFaces; i++) {
            const matIndex = faceToMat[i] !== undefined ? faceToMat[i] : 0;
            geometry.addGroup(i * 3, 3, matIndex);
          }
          // Compute vertex normals to make the melted mesh look smoother
          geometry.computeVertexNormals(); 
        }
      });

      setScene(loadedScene);
      return () => URL.revokeObjectURL(url);
    });
  }, [glbBase64, faceTags, materialsConfigs]);

  if (!scene) return null;
  return <primitive object={scene} />;
};

export default function JewelryViewer({ glbBase64, faceTags, materials }) {
  return (
    <div className="w-full h-[500px] bg-[#0a0a0a] rounded-xl overflow-hidden shadow-2xl border border-zinc-800 relative">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        {/* Changed environment to 'sunset' for beautiful warm light reflections */}
        <Stage intensity={0.8} environment="sunset" adjustCamera={1.2}>
           <JewelryMesh glbBase64={glbBase64} faceTags={faceTags} materialsConfigs={materials} />
        </Stage>
        <OrbitControls makeDefault autoRotate autoRotateSpeed={2.0} />
      </Canvas>
    </div>
  );
}