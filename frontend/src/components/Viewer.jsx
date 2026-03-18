import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { setupMultiViewCameras, applySAMeshMasks } from "../SAMeshLifter";

const METALS = {
  yellow_gold: { color: 0xffd700, metalness: 1.0 },
  white_gold: { color: 0xf8f8f8, metalness: 1.0 },
  rose_gold: { color: 0xe8a090, metalness: 1.0 },
  platinum: { color: 0xe5e4e2, metalness: 1.0 },
  titanium: { color: 0x878681, metalness: 1.0 },
  black_rhodium: { color: 0x222224, metalness: 1.0 },
  sterling_silver: { color: 0xc0c0c0, metalness: 1.0 },
};

const STONES = {
  diamond: {
    color: 0xffffff,
    ior: 2.42,
    transmission: 1.0,
    roughness: 0.0,
    metalness: 0.0,
  },
  ruby: {
    color: 0xff1020,
    ior: 1.76,
    transmission: 1.0,
    roughness: 0.0,
    metalness: 0.0,
  },
  sapphire: {
    color: 0x0030ff,
    ior: 1.77,
    transmission: 1.0,
    roughness: 0.0,
    metalness: 0.0,
  },
  emerald: {
    color: 0x10c050,
    ior: 1.58,
    transmission: 1.0,
    roughness: 0.0,
    metalness: 0.0,
  },
  amethyst: {
    color: 0x9b30ff,
    ior: 1.54,
    transmission: 1.0,
    roughness: 0.0,
    metalness: 0.0,
  },
  moissanite: {
    color: 0xffffff,
    ior: 2.65,
    transmission: 1.0,
    roughness: 0.0,
    metalness: 0.0,
  },
  tsavorite: {
    color: 0x22aa55,
    ior: 1.61,
    transmission: 1.0,
    roughness: 0.0,
    metalness: 0.0,
  },
  lab_diamond: {
    color: 0xffffff,
    ior: 2.42,
    transmission: 1.0,
    roughness: 0.0,
    metalness: 0.0,
  },
  alexandrite: {
    color: 0x006b54,
    ior: 1.75,
    transmission: 1.0,
    roughness: 0.0,
    metalness: 0.0,
  },
  morganite: {
    color: 0xffc8cb,
    ior: 1.59,
    transmission: 1.0,
    roughness: 0.0,
    metalness: 0.0,
  },
  aquamarine: {
    color: 0x7fffd4,
    ior: 1.58,
    transmission: 1.0,
    roughness: 0.0,
    metalness: 0.0,
  },
  black_diamond: {
    color: 0x050505,
    ior: 2.42,
    transmission: 0.0,
    roughness: 0.05,
    metalness: 0.8,
  },
};

export default function Viewer({ glbB64, params, loading }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const [isSegmenting, setIsSegmenting] = useState(false);

  const updateMaterials = (currentParams, rootScene) => {
    if (!rootScene) return;
    const p = currentParams || {};

    const mProps = METALS[p.metal] || METALS.yellow_gold;
    const sProps = STONES[p.primary_stone] || STONES.diamond;

    rootScene.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          const metalMat = child.material[0];
          const stoneMat = child.material[1];

          if (metalMat) {
            metalMat.color.setHex(mProps.color);
            metalMat.metalness =
              mProps.metalness !== undefined ? mProps.metalness : 1.0;
            metalMat.roughness =
              p.finishRoughness !== undefined ? p.finishRoughness : 0.12;
            metalMat.needsUpdate = true;
          }

          if (stoneMat) {
            stoneMat.color.setHex(sProps.color);
            stoneMat.ior = sProps.ior || 2.42;
            stoneMat.transmission =
              sProps.transmission !== undefined ? sProps.transmission : 1.0;
            stoneMat.roughness =
              sProps.roughness !== undefined ? sProps.roughness : 0.0;
            stoneMat.metalness =
              sProps.metalness !== undefined ? sProps.metalness : 0.0;
            stoneMat.envMapIntensity =
              p.gemBrilliance !== undefined ? p.gemBrilliance : 2.5;
            stoneMat.needsUpdate = true;
          }
        }
      }
    });
  };

  useEffect(() => {
    if (stateRef.current.scene) {
      updateMaterials(params, stateRef.current.scene);
    }
  }, [params]);

  useEffect(() => {
    if (!mountRef.current) return;
    const W = mountRef.current.clientWidth;
    const H = mountRef.current.clientHeight;

    const scene = new THREE.Scene();

    window.forgeScene = scene;

    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    camera.position.set(0, 1.5, 4.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;

    const pointLight = new THREE.PointLight(0xffffff, 1.2, 10);
    scene.add(pointLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(W, H),
      0.35,
      0.1,
      0.85,
    );
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    stateRef.current = { scene, camera, renderer, composer, pointLight };

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      const time = Date.now() * 0.0015;
      pointLight.position.x = Math.sin(time) * 2;
      pointLight.position.z = Math.cos(time) * 2;
      pointLight.position.y = 1.5;
      composer.render();
    };
    animate();

    return () => {
      renderer.dispose();
      composer.dispose();
      pmremGenerator.dispose();
      if (mountRef.current && renderer.domElement)
        mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!glbB64 || !stateRef.current.scene) return;
    const { scene, renderer } = stateRef.current;

    const loader = new GLTFLoader();
    const dataUri = glbB64.startsWith("data:")
      ? glbB64
      : `data:application/octet-stream;base64,${glbB64}`;

    loader.load(dataUri, async (gltf) => {
      const model = gltf.scene;
      model.name = "jewelry_model";

      const existingModel = scene.getObjectByName("jewelry_model");
      if (existingModel) scene.remove(existingModel);

      let targetMesh = null;
      model.traverse((c) => {
        if (c.isMesh && !targetMesh) {
          targetMesh = c;
          if (c.geometry.attributes.color) c.geometry.deleteAttribute("color");
          if (c.geometry.attributes.uv) c.geometry.deleteAttribute("uv");
          c.geometry.computeVertexNormals();

          c.material = new THREE.MeshNormalMaterial();
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

      setIsSegmenting(true);
      try {
        const orthoCameras = setupMultiViewCameras(targetMesh, 1024, 1024);
        const screenshots = [];
        const originalClearAlpha = renderer.getClearAlpha();
        renderer.setClearAlpha(0);
        renderer.setSize(1024, 1024);

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
            prompt: "Identify the main center gemstone.",
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
                  canvas.width = 1024;
                  canvas.height = 1024;
                  const ctx = canvas.getContext("2d");
                  ctx.drawImage(img, 0, 0, 1024, 1024);
                  resolve(ctx.getImageData(0, 0, 1024, 1024));
                };
                img.src = m;
              });
            }),
          );

          const p = params || {};
          const mProps = METALS[p.metal] || METALS.yellow_gold;
          const sProps = STONES[p.primary_stone] || STONES.diamond;

          const metalMat = new THREE.MeshPhysicalMaterial({
            color: mProps.color,
            metalness: mProps.metalness !== undefined ? mProps.metalness : 1.0,
            roughness:
              p.finishRoughness !== undefined ? p.finishRoughness : 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            envMapIntensity: 1.5,
            vertexColors: false,
          });

          const stoneMat = new THREE.MeshPhysicalMaterial({
            color: sProps.color,
            metalness: sProps.metalness !== undefined ? sProps.metalness : 0.0,
            roughness: sProps.roughness !== undefined ? sProps.roughness : 0.0,
            transmission:
              sProps.transmission !== undefined ? sProps.transmission : 1.0,
            ior: sProps.ior || 2.42,
            thickness: 2.5,
            dispersion: 1.5,
            transparent: true,
            envMapIntensity:
              p.gemBrilliance !== undefined ? p.gemBrilliance : 2.5,
            vertexColors: false,
          });

          applySAMeshMasks(
            targetMesh,
            orthoCameras,
            maskCanvases,
            metalMat,
            stoneMat,
          );
          updateMaterials(params, scene);
        }
      } catch (err) {
        console.error("SAMesh Pipeline Error:", err);
      } finally {
        setIsSegmenting(false);
      }
    });
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
          [AI] Hybrid SAMesh Pipeline Active...
        </div>
      )}
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
