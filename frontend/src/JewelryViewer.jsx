import React, { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  PerspectiveCamera,
  Center,
} from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const JewelryMesh = ({ glbBase64, materialsConfigs }) => {
  const [scene, setScene] = useState(null);

  useEffect(() => {
    if (!glbBase64) return;

    const binary = atob(glbBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "model/gltf-binary" });
    const url = URL.createObjectURL(blob);

    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      const loadedScene = gltf.scene;

      // 1. PBR Metal Material (High polish, lacquer shine)
      const metalMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(materialsConfigs.metal),
        metalness: 1.0,
        roughness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        envMapIntensity: 2.5,
      });

      // 2. Premium Diamond Transmission Material
      const stoneMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(materialsConfigs.stone),
        metalness: 0.0,
        roughness: 0.0,
        transmission: 0.95, // Glass/Diamond effect
        ior: 2.41, // Diamond index of refraction
        thickness: 2.0, // Volume for refraction
        dispersion: 0.02, // Rainbow sparkle (Requires newer Three.js versions, degrades gracefully)
        envMapIntensity: 3.0,
        clearcoat: 1.0,
      });

      // Apply materials based on CadQuery assembly names
      loadedScene.traverse((child) => {
        if (child.isMesh) {
          // CadQuery names the parts based on the assembly
          if (child.name.includes("metal_body")) {
            child.material = metalMat;
          } else if (child.name.includes("stone_body")) {
            child.material = stoneMat;
          }
          // Compute sharp normals for clean CAD look
          child.geometry.computeVertexNormals();
        }
      });

      setScene(loadedScene);
      return () => URL.revokeObjectURL(url);
    });
  }, [glbBase64, materialsConfigs]);

  if (!scene) return null;
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
};

export default function JewelryViewer({ glbBase64, materials }) {
  return (
    <div className="w-full h-[500px] bg-[#050508] rounded-xl overflow-hidden shadow-2xl border border-zinc-800 relative">
      <Canvas
        shadows
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5,
          antialias: true,
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 15, 25]} fov={35} />

        {/* Polyhaven Studio Small HDRI for photorealistic reflections */}
        <Environment
          files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr"
          background={false}
        />

        <JewelryMesh glbBase64={glbBase64} materialsConfigs={materials} />

        {/* Smooth, premium auto-rotation */}
        <OrbitControls
          makeDefault
          autoRotate
          autoRotateSpeed={1.0}
          enablePan={false}
        />
      </Canvas>
    </div>
  );
}
