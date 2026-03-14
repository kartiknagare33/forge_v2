import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { loadRawMesh, makeMetalMat, makeStoneMat } from "../JewelryBuilder";
import { setupMultiViewCameras, applySAMeshMasks } from "../SAMeshLifter";

export default function Viewer({ params }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const [isSegmenting, setIsSegmenting] = useState(false);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth,
      H = el.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 100);
    camera.position.set(0, 2.5, 4.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.autoRotate = true;
    controls.enableDamping = true;

    new RGBELoader().load(
      "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr",
      (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = tex;
      },
    );

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    stateRef.current = { scene, camera, renderer, controls };

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  // The SAMesh Pipeline Execution
  useEffect(() => {
    if (!params || !stateRef.current.scene) return;
    const { scene, renderer } = stateRef.current;

    loadRawMesh(scene, async (targetMesh) => {
      setIsSegmenting(true);
      try {
        // 1. Setup 4 Ortho Cameras
        const orthoCameras = setupMultiViewCameras(targetMesh, 512, 512);
        const screenshots = [];

        // 2. Take 4 silent screenshots
        const originalClearAlpha = renderer.getClearAlpha();
        renderer.setClearAlpha(0); // Transparent background for SAM2
        renderer.setSize(512, 512);

        for (const cam of orthoCameras) {
          renderer.render(scene, cam);
          screenshots.push(renderer.domElement.toDataURL("image/png"));
        }

        // Restore main view
        renderer.setSize(
          mountRef.current.clientWidth,
          mountRef.current.clientHeight,
        );
        renderer.setClearAlpha(originalClearAlpha);

        // 3. Send to Backend SAM2 Endpoint
        console.log("Sending to SAM2...");
        const res = await fetch("http://localhost:8000/segment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images_b64: screenshots,
            prompt: "gemstone, diamond",
          }),
        });

        const data = await res.json();

        // 4. Preload mask images to ensure canvas can read them
        if (data.success && data.masks) {
          const preloadedMasks = await Promise.all(
            data.masks.map((m) => {
              return new Promise((resolve) => {
                if (!m) return resolve(null);
                const img = new Image();
                img.onload = () => resolve(m);
                img.src = m;
              });
            }),
          );

          // 5. Apply Masks to 3D Geometry
          const metalMat = makeMetalMat(params.metal);
          const stoneMat = makeStoneMat(params.stone);
          applySAMeshMasks(
            targetMesh,
            orthoCameras,
            preloadedMasks,
            stoneMat,
            metalMat,
          );
          console.log("SAMesh Lifting Complete!");
        }
      } catch (err) {
        console.error("SAMesh Pipeline Failed:", err);
      } finally {
        setIsSegmenting(false);
      }
    });
  }, [params]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "500px",
      }}
    >
      {isSegmenting && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            color: "#FFD700",
            fontFamily: "monospace",
          }}
        >
          [AI] Running SAMesh Zero-Shot Segmentation...
        </div>
      )}
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
