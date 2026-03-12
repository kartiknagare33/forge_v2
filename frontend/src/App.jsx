import { useState, useRef } from 'react'
import Viewer from './components/Viewer.jsx'

const API = 'http://localhost:8000'

const METAL_COLORS = {
  yellow_gold: '#FFD700',
  white_gold:  '#E8E8E8',
  rose_gold:   '#E8B4B8',
  platinum:    '#CCCCCC',
}

const STONE_COLORS = {
  ruby:     '#CC2200',
  sapphire: '#0033CC',
  emerald:  '#00AA44',
  diamond:  '#E8F4FF',
}

const PROCESS_STEPS = (p) => [
  { num: '①', label: 'FORM_SHANK',       detail: `Band ${p.band_width}mm wide · ${p.metal.replace('_',' ')}` },
  { num: '②', label: 'CREATE_PRONG_HEAD', detail: `${p.prong_count}-prong cathedral head` },
  { num: '③', label: 'SET_STONE',         detail: `${p.stone_diameter}mm ${p.stone_material} · round brilliant` },
  { num: '④', label: 'FINISH',            detail: 'Polished · studio ready' },
]

export default function App() {
  const [params, setParams] = useState({
    ring_diameter:  17.2,
    band_width:      2.2,
    band_thickness:  1.8,
    stone_diameter:  6.5,
    prong_count:       6,
    prong_diameter:  0.9,
    metal:      'yellow_gold',
    stone_material: 'ruby',
  })

  const [metalGlb,  setMetalGlb]  = useState(null)
  const [stoneGlb,  setStoneGlb]  = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [extracting,setExtracting]= useState(false)
  const [status,    setStatus]    = useState('Upload an image or set parameters and click Generate.')
  const [activeStep,setActiveStep]= useState(null)
  const fileRef = useRef()

  // ── Generate ring from current params ──────────────────────────────
  async function handleGenerate() {
    setLoading(true)
    setStatus('⚙️  Compiling FPL program → 3D geometry…')
    try {
      const res  = await fetch(`${API}/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(params),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.detail || 'Generation failed')

      setMetalGlb(data.metal_glb_b64)
      setStoneGlb(data.stone_glb_b64)
      setStatus('✅ Ring compiled successfully.')
    } catch (e) {
      setStatus('❌ Error: ' + e.message)
    }
    setLoading(false)
  }

  // ── Upload image → extract params → auto-generate ──────────────────
  async function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setExtracting(true)
    setStatus('🔍 Gemini Vision analyzing jewelry image…')
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch(`${API}/extract`, { method: 'POST', body: form })
      const data = await res.json()
      if (!data.success) throw new Error(data.detail || 'Extraction failed')

      setParams(data.params)
      setStatus('✅ Parameters extracted from image. Generating ring…')
      setExtracting(false)

      // Auto-generate with extracted params
      setLoading(true)
      const res2  = await fetch(`${API}/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data.params),
      })
      const data2 = await res2.json()
      if (!data2.success) throw new Error(data2.detail)
      setMetalGlb(data2.metal_glb_b64)
      setStoneGlb(data2.stone_glb_b64)
      setStatus('✅ Ring compiled from uploaded image.')
    } catch (e) {
      setStatus('❌ Error: ' + e.message)
    }
    setLoading(false)
    setExtracting(false)
  }

  function set(key, val) {
    setParams(p => ({ ...p, [key]: val }))
  }

  const steps = PROCESS_STEPS(params)

  return (
    <div style={styles.root}>

      {/* ── Header ── */}
      <header style={styles.header}>
        <span style={styles.logo}>⬡ FORGE</span>
        <span style={styles.tagline}>The Compiler for Jewelry</span>
      </header>

      <div style={styles.body}>

        {/* ═══════════════ LEFT PANEL ═══════════════ */}
        <div style={styles.left}>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Parameters</h2>

            <Label>Stone Diameter (mm)</Label>
            <Row>
              <input type="range" min={4} max={12} step={0.5}
                value={params.stone_diameter}
                onChange={e => set('stone_diameter', parseFloat(e.target.value))}
                style={styles.slider} />
              <span style={styles.val}>{params.stone_diameter}</span>
            </Row>

            <Label>Band Width (mm)</Label>
            <Row>
              <input type="range" min={1.5} max={5} step={0.1}
                value={params.band_width}
                onChange={e => set('band_width', parseFloat(e.target.value))}
                style={styles.slider} />
              <span style={styles.val}>{params.band_width.toFixed(1)}</span>
            </Row>

            <Label>Prong Count</Label>
            <div style={styles.prongs}>
              {[4, 6, 8].map(n => (
                <button key={n}
                  onClick={() => set('prong_count', n)}
                  style={{ ...styles.prongBtn, ...(params.prong_count === n ? styles.prongActive : {}) }}>
                  {n}
                </button>
              ))}
            </div>

            <Label>Metal</Label>
            <select value={params.metal}
              onChange={e => set('metal', e.target.value)}
              style={styles.select}>
              <option value="yellow_gold">Yellow Gold</option>
              <option value="white_gold">White Gold</option>
              <option value="rose_gold">Rose Gold</option>
              <option value="platinum">Platinum</option>
            </select>

            <Label>Stone</Label>
            <select value={params.stone_material}
              onChange={e => set('stone_material', e.target.value)}
              style={styles.select}>
              <option value="ruby">Ruby</option>
              <option value="sapphire">Sapphire</option>
              <option value="emerald">Emerald</option>
              <option value="diamond">Diamond</option>
            </select>
          </section>

          {/* ── Buttons ── */}
          <button onClick={handleGenerate} disabled={loading} style={styles.btnPrimary}>
            {loading ? '⚙️  Compiling…' : '▶  Generate Ring'}
          </button>

          <button onClick={() => fileRef.current.click()} disabled={extracting || loading} style={styles.btnSecondary}>
            {extracting ? '🔍 Analysing…' : '📷  Upload Jewelry Image'}
          </button>
          <input ref={fileRef} type="file" accept="image/*"
            onChange={handleImageUpload} style={{ display: 'none' }} />

          {/* ── Status ── */}
          <p style={styles.status}>{status}</p>

          {/* ═══ PROCESS STEPS ═══ */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>FPL Process</h2>
            {steps.map((s, i) => (
              <div key={i}
                onClick={() => setActiveStep(activeStep === i ? null : i)}
                style={{ ...styles.step, ...(activeStep === i ? styles.stepActive : {}) }}>
                <span style={styles.stepNum}>{s.num}</span>
                <div>
                  <div style={styles.stepLabel}>{s.label}</div>
                  <div style={styles.stepDetail}>{s.detail}</div>
                </div>
              </div>
            ))}
          </section>

          {/* ── Material preview swatches ── */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Materials</h2>
            <div style={styles.swatchRow}>
              <Swatch color={METAL_COLORS[params.metal]} label={params.metal.replace('_',' ')} />
              <Swatch color={STONE_COLORS[params.stone_material]} label={params.stone_material} />
            </div>
          </section>
        </div>

        {/* ═══════════════ RIGHT PANEL — 3D viewer ═══════════════ */}
        <div style={styles.right}>
          <Viewer
            metalGlb={metalGlb}
            stoneGlb={stoneGlb}
            metalColor={METAL_COLORS[params.metal]}
            stoneColor={STONE_COLORS[params.stone_material]}
          />
          {!metalGlb && (
            <div style={styles.placeholder}>
              <div style={styles.placeholderIcon}>⬡</div>
              <p>Set parameters and click<br/><strong>Generate Ring</strong></p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Small helper components ────────────────────────────────────────────────
function Label({ children }) {
  return <p style={{ fontSize: 11, color: '#888', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{children}</p>
}
function Row({ children }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{children}</div>
}
function Swatch({ color, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, margin: '0 auto 4px', border: '2px solid #333' }} />
      <span style={{ fontSize: 10, color: '#888' }}>{label}</span>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = {
  root: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#080810' },
  header: { display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', borderBottom: '1px solid #1e1e2e', flexShrink: 0 },
  logo: { fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#C9A84C', fontWeight: 600 },
  tagline: { fontSize: 12, color: '#555', letterSpacing: 2 },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },

  left: { width: 300, borderRight: '1px solid #1e1e2e', padding: '16px 20px', overflowY: 'auto', flexShrink: 0 },
  right: { flex: 1, position: 'relative', background: '#0A0A0F' },

  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: '#C9A84C', marginBottom: 10, letterSpacing: 1 },

  slider: { flex: 1, accentColor: '#C9A84C' },
  val: { width: 36, textAlign: 'right', fontSize: 13, color: '#C9A84C', fontFamily: "'JetBrains Mono', monospace" },

  prongs: { display: 'flex', gap: 8, marginBottom: 4 },
  prongBtn: { flex: 1, padding: '6px 0', background: '#111', border: '1px solid #333', borderRadius: 6, color: '#aaa', cursor: 'pointer', fontSize: 14 },
  prongActive: { background: '#1a1500', border: '1px solid #C9A84C', color: '#C9A84C' },

  select: { width: '100%', padding: '8px 10px', background: '#111', border: '1px solid #333', borderRadius: 6, color: '#FAFAFA', fontSize: 13, marginBottom: 4 },

  btnPrimary: { width: '100%', padding: '10px 0', background: '#C9A84C', border: 'none', borderRadius: 8, color: '#000', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 8 },
  btnSecondary: { width: '100%', padding: '9px 0', background: 'transparent', border: '1px solid #333', borderRadius: 8, color: '#aaa', fontSize: 13, cursor: 'pointer', marginBottom: 8 },

  status: { fontSize: 11, color: '#666', marginBottom: 16, lineHeight: 1.5 },

  step: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 6, border: '1px solid #1e1e2e', marginBottom: 6, cursor: 'pointer', transition: 'all .2s' },
  stepActive: { border: '1px solid #C9A84C', background: '#0f0c00' },
  stepNum: { color: '#C9A84C', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, marginTop: 2 },
  stepLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#FAFAFA', letterSpacing: 1 },
  stepDetail: { fontSize: 11, color: '#666', marginTop: 2 },

  swatchRow: { display: 'flex', gap: 16 },

  placeholder: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#333', textAlign: 'center', pointerEvents: 'none' },
  placeholderIcon: { fontSize: 64, marginBottom: 16, color: '#1e1e2e' },
}