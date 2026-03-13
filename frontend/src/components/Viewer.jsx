import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { buildJewelry, updateMaterials } from "../JewelryBuilder";

export default function Viewer({ params }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth,
      H = el.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 100);
    // Pull camera slightly back and up
    camera.position.set(0, 2.5, 4.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.8;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
    controls.enableDamping = true;
    controls.target.set(0, 0.8, 0); // Look slightly up at the stone

    new RGBELoader().load(
      "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr",
      (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = tex;
        // Pure dark background so the diamond sparkles without a distracting photo
        scene.background = new THREE.Color("#0a0a0a");
      },
    );

    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(5, 10, 5);
    scene.add(key);

    stateRef.current = { scene, camera, renderer, controls };

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const W = el.clientWidth,
        H = el.clientHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!params || !stateRef.current.scene) return;
    buildJewelry(params, stateRef.current.scene);
  }, [params]);

  useEffect(() => {
    if (!params || !stateRef.current.scene) return;
    updateMaterials(params.metal, params.stone, stateRef.current.scene);
  }, [params?.metal, params?.stone]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "100%", minHeight: "500px" }}
    />
  );
}
