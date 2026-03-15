import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment";

// Removed .js extensions to prevent bundler crashes
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";

import { setupMultiViewCameras, applySAMeshMasks } from "../SAMeshLifter";

const METALS = {
  yellow_gold: { color: 0xffd700 },
  white_gold: { color: 0xf0f0f0 },
  rose_gold: { color: 0xe8a090 },
  platinum: { color: 0xe5e4e2 },
};

const STONES = {
  diamond: { color: 0xffffff, ior: 2.42 },
  ruby: { color: 0xff1020, ior: 1.76 },
  sapphire: { color: 0x0030ff, ior: 1.77 },
  emerald: { color: 0x10c050, ior: 1.58 },
  amethyst: { color: 0x9b30ff, ior: 1.54 },
  moissanite: { color: 0xffffff, ior: 2.65 },
  tsavorite: { color: 0x22aa55, ior: 1.61 },
};

export default function Viewer({ glbB64, params, loading }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const meshRef = useRef(null);
  const procGroupRef = useRef(null);
  const segmentationDone = useRef(false);
  const paramsRef = useRef(params);
  const [isSegmenting, setIsSegmenting] = useState(false);

  useEffect(() => {
    paramsRef.current = params || {};
  }, [params]);

  useEffect(() => {
    if (!mountRef.current) return;
    const W = mountRef.current.clientWidth;
    const H = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 2, 5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;

    const pointLight = new THREE.PointLight(0xffffff, 2.5, 10);
    scene.add(pointLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(W, H),
      0.3,
      0.2,
      0.9,
    );
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    stateRef.current = { scene, camera, renderer, composer, pointLight };

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      const time = Date.now() * 0.002;
      pointLight.position.x = Math.sin(time) * 3;
      pointLight.position.z = Math.cos(time) * 3;
      pointLight.position.y = 2;

      composer.render();
    };
    animate();

    return () => {
      renderer.dispose();
      composer.dispose();
      pmremGenerator.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  const updateMaterials = () => {
    if (!meshRef.current || !segmentationDone.current) return;
    const p = paramsRef.current || {};

    if (
      Array.isArray(meshRef.current.material) &&
      meshRef.current.material.length === 2
    ) {
      const [metalMat, stoneMat] = meshRef.current.material;

      const mProps = METALS[p.metal] || METALS.yellow_gold;
      metalMat.color.setHex(mProps.color);
      metalMat.roughness = p.finishRoughness || 0.12;
      metalMat.needsUpdate = true;

      const sProps = STONES[p.primary_stone] || STONES.diamond;
      stoneMat.color.setHex(sProps.color);
      stoneMat.ior = sProps.ior;
      stoneMat.envMapIntensity = p.gemBrilliance || 2.0;
      stoneMat.needsUpdate = true;
    }

    const { scene } = stateRef.current;
    if (procGroupRef.current && scene) {
      scene.remove(procGroupRef.current);
      procGroupRef.current = null;
    }

    const procGroup = new THREE.Group();
    const box = new THREE.Box3().setFromObject(meshRef.current);
    const size = box.getSize(new THREE.Vector3());

    const mProps = METALS[p.metal] || METALS.yellow_gold;
    const procMetalMat = new THREE.MeshStandardMaterial({
      color: mProps.color,
      roughness: p.finishRoughness || 0.12,
      metalness: 0.95,
    });

    if (p.jewelry_type === "pendant") {
      const torusGeom = new THREE.TorusGeometry(
        size.x * 0.15,
        size.x * 0.03,
        16,
        32,
      );
      const bail = new THREE.Mesh(torusGeom, procMetalMat);
      bail.position.set(0, box.max.y + size.x * 0.1, 0);
      procGroup.add(bail);
    } else if (p.jewelry_type === "earrings") {
      const earring2 = meshRef.current.clone();
      earring2.position.set(size.x * 1.5, 0, 0);
      meshRef.current.position.set(-size.x * 0.75, 0, 0);

      const hookGeom = new THREE.CylinderGeometry(0.01, 0.01, size.y * 0.4, 8);
      const hook1 = new THREE.Mesh(hookGeom, procMetalMat);
      hook1.position.set(-size.x * 0.75, box.max.y + size.y * 0.2, 0);

      const hook2 = new THREE.Mesh(hookGeom, procMetalMat);
      hook2.position.set(size.x * 1.5, box.max.y + size.y * 0.2, 0);

      procGroup.add(earring2, hook1, hook2);
    } else {
      meshRef.current.position.set(0, 0, 0);
    }

    if (scene) {
      scene.add(procGroup);
      procGroupRef.current = procGroup;
    }
  };

  useEffect(() => {
    updateMaterials();
  }, [
    params?.metal,
    params?.primary_stone,
    params?.finishRoughness,
    params?.gemBrilliance,
    params?.jewelry_type,
  ]);

  useEffect(() => {
    if (!glbB64 || !stateRef.current.scene) return;

    segmentationDone.current = false;
    const { scene, renderer } = stateRef.current;

    const oldModel = scene.getObjectByName("jewelry_model");
    if (oldModel) scene.remove(oldModel);
    if (procGroupRef.current) scene.remove(procGroupRef.current);

    const loader = new GLTFLoader();
    const dataUri = glbB64.startsWith("data:")
      ? glbB64
      : `data:application/octet-stream;base64,${glbB64}`;

    loader.load(dataUri, async (gltf) => {
      const model = gltf.scene;
      model.name = "jewelry_model";

      let targetMesh = null;
      model.traverse((c) => {
        if (c.isMesh && !targetMesh) {
          targetMesh = c;
          if (c.geometry.attributes.color) c.geometry.deleteAttribute("color");
          if (c.geometry.attributes.uv) c.geometry.deleteAttribute("uv");
          c.geometry.computeVertexNormals();
          c.material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.3,
            metalness: 0.8,
            vertexColors: false,
          });
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      const size = box.getSize(new THREE.Vector3());
      const scale = 3 / Math.max(size.x, size.y, size.z);
      model.scale.set(scale, scale, scale);

      scene.add(model);
      if (!targetMesh) return;
      meshRef.current = targetMesh;

      setIsSegmenting(true);
      try {
        const orthoCameras = setupMultiViewCameras(targetMesh, 512, 512);
        const screenshots = [];
        const originalClearAlpha = renderer.getClearAlpha();
        renderer.setClearAlpha(0);
        renderer.setSize(512, 512);

        for (const cam of orthoCameras) {
          renderer.render(scene, cam);
          screenshots.push(renderer.domElement.toDataURL("image/png"));
        }

        renderer.setSize(
          mountRef.current.clientWidth,
          mountRef.current.clientHeight,
        );
        renderer.setClearAlpha(originalClearAlpha);

        const res = await fetch("http://localhost:8000/segment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images_b64: screenshots,
            prompt: "gemstone, diamond",
          }),
        });

        const data = await res.json();
        if (data.success && data.masks) {
          const maskCanvases = await Promise.all(
            data.masks.map((m) => {
              return new Promise((resolve) => {
                if (!m) return resolve(null);
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  canvas.width = 512;
                  canvas.height = 512;
                  const ctx = canvas.getContext("2d");
                  ctx.drawImage(img, 0, 0, 512, 512);
                  resolve(ctx.getImageData(0, 0, 512, 512));
                };
                img.src = m;
              });
            }),
          );

          const p = paramsRef.current || {};
          const mProps = METALS[p.metal] || METALS.yellow_gold;
          const sProps = STONES[p.primary_stone] || STONES.diamond;

          const metalMat = new THREE.MeshPhysicalMaterial({
            color: mProps.color,
            metalness: 0.95,
            roughness: p.finishRoughness || 0.12,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            envMapIntensity: 1.8,
            vertexColors: false,
          });

          const stoneMat = new THREE.MeshPhysicalMaterial({
            color: sProps.color,
            metalness: 0.1,
            roughness: 0.03,
            transmission: 0.98,
            ior: sProps.ior,
            thickness: 2.0,
            transparent: true,
            envMapIntensity: p.gemBrilliance || 2.0,
            vertexColors: false,
          });

          applySAMeshMasks(
            targetMesh,
            orthoCameras,
            maskCanvases,
            metalMat,
            stoneMat,
          );
          segmentationDone.current = true;
          updateMaterials();
        }
      } catch (err) {
        console.error("SAMesh Pipeline Error:", err);
      } finally {
        setIsSegmenting(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glbB64]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "500px",
      }}
    >
      {loading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#C9A84C",
            fontFamily: "monospace",
            zIndex: 10,
          }}
        >
          Compiling Manufacturing Geometry...
        </div>
      )}
      {isSegmenting && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            color: "#10b981",
            fontFamily: "monospace",
            zIndex: 10,
            background: "rgba(0,0,0,0.7)",
            padding: "8px 12px",
            borderRadius: 4,
          }}
        >
          [AI] Running SAMesh Semantic Geometry Lift...
        </div>
      )}
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
