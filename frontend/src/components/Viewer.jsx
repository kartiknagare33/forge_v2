import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export default function Viewer({ metalGlb, stoneGlb, metalColor, stoneColor }) {
  const mountRef = useRef(null)
  const stateRef = useRef({})   // holds scene, camera, renderer, controls, group

  // ── Init scene once ────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    const W = mount.clientWidth  || 800
    const H = mount.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.6
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a0f)

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 500)
    camera.position.set(0, 25, 60)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07

    // Lighting — jewelry studio rig
    scene.add(new THREE.AmbientLight(0xffffff, 1.2))

    const main = new THREE.DirectionalLight(0xfff5dd, 3.0)
    main.position.set(-15, 30, 25)
    scene.add(main)

    const fill = new THREE.DirectionalLight(0xddeeff, 1.5)
    fill.position.set(25, 15, 10)
    scene.add(fill)

    const rim = new THREE.DirectionalLight(0xffffff, 2.0)
    rim.position.set(0, -5, -30)
    scene.add(rim)

    const top = new THREE.DirectionalLight(0xffffff, 1.0)
    top.position.set(0, 50, 0)
    scene.add(top)

    stateRef.current = { renderer, scene, camera, controls, group: null, animId: null }

    function animate() {
      stateRef.current.animId = requestAnimationFrame(animate)
      controls.update()
      if (stateRef.current.group) {
        stateRef.current.group.rotation.y += 0.004
      }
      renderer.render(scene, camera)
    }
    animate()

    function onResize() {
      const W2 = mount.clientWidth
      const H2 = mount.clientHeight
      renderer.setSize(W2, H2)
      camera.aspect = W2 / H2
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(stateRef.current.animId)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  // ── Reload ring whenever GLB data or colors change ─────────────────
  useEffect(() => {
    if (!metalGlb || !stoneGlb) return
    const { scene, camera, controls } = stateRef.current
    if (!scene) return

    // Remove old group
    if (stateRef.current.group) {
      scene.remove(stateRef.current.group)
      stateRef.current.group.traverse(obj => {
        if (obj.isMesh) { obj.geometry.dispose(); obj.material.dispose() }
      })
    }

    const group = new THREE.Group()
    stateRef.current.group = group
    scene.add(group)

    // ── Metal material — bright PBR gold/silver ──
    const metalMat = new THREE.MeshStandardMaterial({
      color:     new THREE.Color(metalColor),
      metalness: 1.0,
      roughness: 0.15,
    })

    // ── Stone material — glass-like gem ──
    const isDiamond = stoneColor === '#E8F4FF'
    const stoneMat = new THREE.MeshPhongMaterial({
      color:     new THREE.Color(stoneColor),
      shininess: 150,
      specular:  new THREE.Color(0xffffff),
      transparent: true,
      opacity:   isDiamond ? 0.85 : 0.9,
    })

    const loader = new GLTFLoader()

    function loadB64(b64, mat, onDone) {
      const bytes  = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const blob   = new Blob([bytes], { type: 'model/gltf-binary' })
      const url    = URL.createObjectURL(blob)
      loader.load(url, gltf => {
        gltf.scene.traverse(child => {
          if (child.isMesh) {
            child.material = mat
            child.castShadow = true
          }
        })
        URL.revokeObjectURL(url)
        onDone(gltf.scene)
      })
    }

    loadB64(metalGlb, metalMat, metalScene => {
      group.add(metalScene)
      loadB64(stoneGlb, stoneMat, stoneScene => {
        group.add(stoneScene)

        // Fit camera
        const box    = new THREE.Box3().setFromObject(group)
        const center = box.getCenter(new THREE.Vector3())
        const size   = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)

        group.position.sub(center)
        camera.position.set(0, maxDim * 0.8, maxDim * 2.5)
        camera.lookAt(0, 0, 0)
        controls.target.set(0, 0, 0)
        controls.update()
      })
    })

  }, [metalGlb, stoneGlb, metalColor, stoneColor])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}