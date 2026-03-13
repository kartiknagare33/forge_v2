import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Torus, Cylinder, Octahedron, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

const METAL_COLORS = {
  yellow_gold: '#FFD700',
  white_gold: '#F0F0F0',
  rose_gold: '#B76E79',
  platinum: '#E5E4E2'
};

const GEM_COLORS = {
  diamond: '#FFFFFF',
  ruby: '#E0115F',
  sapphire: '#0F52BA',
  emerald: '#50C878'
};

function ProceduralRing({ params }) {
  // 1. Map dynamic properties from AI
  const ringRadius = params.ring_radius ? params.ring_radius / 5 : 1.7; // Scaled for 3D viewport
  const thickness = params.band_thickness ? params.band_thickness / 5 : 0.3;
  const stoneSize = params.stone_size ? params.stone_size / 5 : 0.6;
  const prongCount = params.prong_count || 4;
  
  const metalColor = METAL_COLORS[params.metal] || METAL_COLORS.yellow_gold;
  const gemColor = GEM_COLORS[params.stone] || GEM_COLORS.diamond;

  // 2. Materials
  const metalMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: metalColor,
    metalness: 1.0,
    roughness: 0.15,
  }), [metalColor]);

  // 3. Mathematical Prongs
  const prongs = [];
  const prongRadius = stoneSize * 0.8; 
  const prongHeight = stoneSize * 1.5;

  for (let i = 0; i < prongCount; i++) {
    const angle = (i * (Math.PI * 2)) / prongCount + (prongCount === 4 ? Math.PI / 4 : 0);
    const x = Math.cos(angle) * prongRadius;
    const z = Math.sin(angle) * prongRadius;
    
    prongs.push(
      <Cylinder 
        key={`prong-${i}`} 
        args={[0.03, 0.06, prongHeight, 16]} 
        position={[x, ringRadius + (prongHeight/2) - 0.2, z]} 
        rotation={[0.1 * Math.cos(angle), 0, 0.1 * Math.sin(angle)]} // Inward tilt
        material={metalMaterial} 
      />
    );
  }

  return (
    <group position={[0, 0, 0]}>
      {/* BAND: Mathematical Torus */}
      <Torus args={[ringRadius, thickness, 32, 100]} rotation={[Math.PI / 2, 0, 0]} material={metalMaterial} />

      {/* PRONGS */}
      {prongs}

      {/* STONE: Mathematical Octahedron scaled to look like a gem */}
      <Octahedron 
        args={[stoneSize, 0]} 
        position={[0, ringRadius + stoneSize - 0.1, 0]} 
        scale={[1, 0.6, 1]} // Flattens it slightly to look like a cut stone
      >
        <MeshTransmissionMaterial 
          backside
          samples={16}
          thickness={0.5}
          chromaticAberration={0.05}
          anisotropy={0.2}
          distortion={0.1}
          color={gemColor}
          ior={2.4} // Diamond Index of Refraction
        />
      </Octahedron>
    </group>
  );
}

export default function Viewer({ params }) {
  if (!params) return <div style={{ width: '100%', height: '500px', background: '#111' }} />;

  return (
    <div style={{ width: '100%', height: '500px', background: '#0a0a0a', borderRadius: '8px' }}>
      <Canvas camera={{ position: [0, 3, 6], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[5, 10, 5]} intensity={2} angle={0.2} penumbra={1} />
        <Environment preset="studio" />
        
        <ProceduralRing params={params} />
        
        <OrbitControls autoRotate autoRotateSpeed={2} enablePan={false} />
      </Canvas>
    </div>
  );
}