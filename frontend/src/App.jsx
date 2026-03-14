import { useState, useRef, useEffect } from "react";
import Viewer from "./components/Viewer";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap');

:root {
  --bg:      #060608;
  --surface: #0C0C10;
  --panel:   #11111A;
  --border:  rgba(255,255,255,0.07);
  --border2: rgba(255,255,255,0.13);
  --gold:    #D4AF72;
  --gold2:   #B8935A;
  --gold3:   #EED090;
  --text:    #F0EDE8;
  --muted:   #6B6875;
  --dim:     #2E2C38;
  --green:   #50C07A;
  --red:     #E05050;
  --r:       12px;
  --r2:      18px;
}

*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

html, body, #root {
  height: 100%;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

/* ── AMBIENT ORBS ── */
.orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(90px);
  pointer-events: none;
  z-index: 0;
  opacity: 0.16;
  animation: orbFloat 14s ease-in-out infinite alternate;
}
.o1 { width:560px; height:560px; background:#7A5010; top:-220px; left:-120px; animation-delay:0s; }
.o2 { width:420px; height:420px; background:#0A1A60; top:35%; right:-160px; animation-delay:-5s; }
.o3 { width:380px; height:380px; background:#3A0860; bottom:-80px; left:28%; animation-delay:-9s; }

@keyframes orbFloat {
  from { transform: translate(0,0) scale(1); }
  to   { transform: translate(28px,-38px) scale(1.08); }
}

/* ── APP SHELL ── */
.app {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: 64px 1fr;
  height: 100vh;
}

/* ── HEADER ── */
.hdr {
  display: flex;
  align-items: center;
  padding: 0 28px;
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(24px);
  background: rgba(6,6,8,0.75);
  gap: 20px;
  position: relative;
  z-index: 50;
}

.hdr-logo {
  font-family: 'Cormorant Garamond', serif;
  font-size: 26px;
  font-weight: 300;
  letter-spacing: 9px;
  color: var(--text);
  text-transform: uppercase;
}
.hdr-logo em { color: var(--gold); font-style: normal; }

.hdivider { width:1px; height:20px; background:var(--border2); }

.hdr-sub {
  font-size: 11px;
  letter-spacing: 2.5px;
  color: var(--muted);
  text-transform: uppercase;
  font-weight: 300;
}

.hdr-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.pill {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 100px;
  font-size: 11px;
  letter-spacing: 0.5px;
  color: var(--muted);
  font-family: 'DM Mono', monospace;
  font-weight: 300;
  transition: border-color 0.3s, color 0.3s;
}

.pill.active { border-color: rgba(212,175,114,0.25); color: var(--text); }

.sdot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--dim);
  transition: background 0.4s, box-shadow 0.4s;
  flex-shrink: 0;
}
.sdot.on     { background: var(--green);   box-shadow: 0 0 8px var(--green); animation: dpulse 2s infinite; }
.sdot.load   { background: var(--gold);    box-shadow: 0 0 8px var(--gold); }

@keyframes dpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }

/* ── MAIN 3-COL ── */
.main {
  display: grid;
  grid-template-columns: 355px 1fr 295px;
  overflow: hidden;
}

/* ── PANELS ── */
.panel {
  overflow-y: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  background: var(--surface);
}
.panel::-webkit-scrollbar { display:none; }
.panel-l { border-right: 1px solid var(--border); }
.panel-r { border-left:  1px solid var(--border); }

.sec {
  padding: 22px 22px;
  border-bottom: 1px solid var(--border);
}

.sec-title {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 16px;
}

/* ── UPLOAD ── */
.upload-zone {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--r2);
  border: 1.5px dashed rgba(255,255,255,0.1);
  cursor: pointer;
  overflow: hidden;
  background: var(--panel);
  transition: border-color 0.3s, background 0.3s;
}
.upload-zone:hover {
  border-color: rgba(212,175,114,0.35);
  background: rgba(212,175,114,0.03);
}
.upload-zone.filled {
  border-style: solid;
  border-color: rgba(212,175,114,0.25);
}
.upload-zone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
}
.upload-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--r2);
}
.upload-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(6,6,8,0.55), transparent 55%);
  border-radius: var(--r2);
}
.upload-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
.upload-icon {
  width: 52px; height: 52px;
  border-radius: 50%;
  background: rgba(212,175,114,0.06);
  border: 1px solid rgba(212,175,114,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  transition: all 0.3s;
}
.upload-zone:hover .upload-icon {
  background: rgba(212,175,114,0.12);
  border-color: rgba(212,175,114,0.4);
  transform: scale(1.07);
}
.upload-lbl {
  font-size: 12px;
  color: var(--muted);
  text-align: center;
  line-height: 1.8;
}
.upload-lbl strong { display:block; font-size:13px; color:var(--text); font-weight:400; }

/* ── COMPILE BTN ── */
.compile-btn {
  width: 100%;
  margin-top: 14px;
  padding: 15px;
  border-radius: var(--r);
  border: none;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  color: #1A1000;
  position: relative;
  overflow: hidden;
  transition: transform 0.15s, filter 0.2s;
  background: linear-gradient(135deg, var(--gold3) 0%, var(--gold) 50%, var(--gold2) 100%);
}
.compile-btn::before {
  content: '';
  position: absolute;
  top: 0; left: -160%;
  width: 80%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  transition: left 0.5s ease;
}
.compile-btn:hover:not(:disabled)::before { left: 200%; }
.compile-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.05); }
.compile-btn:active:not(:disabled) { transform: translateY(0); }
.compile-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.compile-btn.loading { animation: btnGlow 1.4s infinite; }
@keyframes btnGlow { 0%,100%{filter:brightness(0.9)} 50%{filter:brightness(1.1)} }

/* ── PARAMS GRID ── */
.param-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}
.param-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 13px;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.4s, transform 0.4s, border-color 0.2s;
}
.param-card.vis { opacity:1; transform:translateY(0); }
.param-card:hover { border-color: var(--border2); }
.pk {
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 5px;
  font-family: 'DM Mono', monospace;
}
.pv {
  font-family: 'Cormorant Garamond', serif;
  font-size: 16px;
  font-weight: 400;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pv.num {
  font-family: 'DM Mono', monospace;
  font-size: 14px;
  color: var(--gold);
  font-weight: 300;
}

/* ── SPEC ROWS ── */
.spec-rows { display:flex; flex-direction:column; gap:2px; }
.spec-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 13px;
  background: var(--panel);
  border-radius: 8px;
  opacity: 0;
  transform: translateX(-8px);
  transition: opacity 0.35s, transform 0.35s;
}
.spec-row.vis { opacity:1; transform:translateX(0); }
.sr-k {
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--muted);
  font-family: 'DM Mono', monospace;
  font-weight: 300;
}
.sr-v {
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  color: var(--gold);
  font-weight: 300;
}

/* ── VIEWER ── */
.viewer-wrap {
  position: relative;
  overflow: hidden;
  background: var(--bg);
}
.vc span {
  position: absolute;
  width: 22px; height: 22px;
  border-color: rgba(212,175,114,0.22);
  border-style: solid;
  pointer-events: none;
  z-index: 10;
}
.vc .tl { top:14px; left:14px; border-width:1.5px 0 0 1.5px; }
.vc .tr { top:14px; right:14px; border-width:1.5px 1.5px 0 0; }
.vc .bl { bottom:14px; left:14px; border-width:0 0 1.5px 1.5px; }
.vc .br { bottom:14px; right:14px; border-width:0 1.5px 1.5px 0; }

.view-lbl {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 3px;
  color: rgba(212,175,114,0.4);
  text-transform: uppercase;
  z-index: 10;
  pointer-events: none;
  white-space: nowrap;
}
.tw-cursor {
  display: inline-block;
  width: 6px; height: 11px;
  background: rgba(212,175,114,0.45);
  animation: twb 1s infinite;
  vertical-align: -1px;
  margin-left: 2px;
  border-radius: 1px;
}
@keyframes twb { 0%,49%{opacity:1} 50%,100%{opacity:0} }

/* ── EMPTY STATE ── */
.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  z-index: 5;
}
.empty-ring {
  width: 116px; height: 116px;
  border-radius: 50%;
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  animation: erPulse 4s ease-in-out infinite;
}
.empty-ring::before {
  content:'';
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  border: 1px solid rgba(212,175,114,0.1);
}
.empty-ring::after {
  content:'';
  position: absolute;
  inset: 24px;
  border-radius: 50%;
  border: 1px solid rgba(212,175,114,0.06);
}
@keyframes erPulse {
  0%,100% { border-color: var(--border); }
  50%      { border-color: rgba(212,175,114,0.18); }
}
.empty-gem { font-size: 30px; opacity: 0.3; z-index: 1; }
.empty-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px;
  font-weight: 300;
  color: rgba(240,237,232,0.2);
  letter-spacing: 5px;
  text-align: center;
}
.empty-sub {
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--dim);
  text-transform: uppercase;
  text-align: center;
}

/* ── LOADING ── */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(6,6,8,0.9);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  z-index: 20;
}
.lring-wrap { position:relative; width:88px; height:88px; }
.lring-wrap svg { transform: rotate(-90deg); }
.lring-track { stroke: rgba(255,255,255,0.05); }
.lring-fill {
  stroke: url(#gGrad);
  stroke-linecap: round;
  transition: stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1);
}
.lring-pct {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'DM Mono', monospace;
  font-size: 14px;
  font-weight: 300;
  color: var(--gold);
  letter-spacing: 1px;
}
.lsteps { display:flex; flex-direction:column; gap:10px; min-width:210px; }
.lstep {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--dim);
  font-family: 'DM Mono', monospace;
  font-weight: 300;
  transition: color 0.4s;
}
.lstep.done   { color: var(--muted); }
.lstep.active { color: var(--text); }
.lstep-ico {
  width: 16px; height: 16px;
  border-radius: 50%;
  border: 1px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  flex-shrink: 0;
  transition: all 0.4s;
}
.lstep.done .lstep-ico   { background:var(--muted); border-color:var(--muted); color:var(--bg); }
.lstep.active .lstep-ico { border-color:var(--gold); color:var(--gold); animation:ispin 1s linear infinite; }
@keyframes ispin { to { transform:rotate(360deg); } }

/* ── SUCCESS FLASH ── */
.sflash {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(212,175,114,0.09), transparent 65%);
  pointer-events: none;
  z-index: 15;
  opacity: 0;
  animation: sfIn 1.1s ease forwards;
}
@keyframes sfIn { 0%{opacity:0} 20%{opacity:1} 100%{opacity:0} }

/* ── FALLBACK BADGE ── */
.fallback-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(200,148,26,0.08);
  border: 1px solid rgba(200,148,26,0.2);
  border-radius: 8px;
  font-size: 10px;
  letter-spacing: 1.5px;
  color: #C8941A;
  text-transform: uppercase;
  margin-bottom: 12px;
  font-family: 'DM Mono', monospace;
}

/* ── RIGHT PANEL ── */
.metal-grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
.metal-btn {
  padding: 14px 10px;
  background: var(--panel);
  border: 1.5px solid var(--border);
  border-radius: var(--r);
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}
.metal-btn:disabled { opacity:0.3; cursor:not-allowed; }
.metal-btn:hover:not(:disabled) {
  border-color: var(--border2);
  background: rgba(255,255,255,0.03);
  transform: translateY(-2px);
}
.metal-btn.on {
  border-color: rgba(212,175,114,0.4);
  background: rgba(212,175,114,0.05);
}
.metal-btn.on::after {
  content:'';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 0%, rgba(212,175,114,0.1), transparent 70%);
}
.m-swatch {
  width: 28px; height: 28px;
  border-radius: 50%;
  margin: 0 auto 8px;
  position: relative;
  z-index: 1;
  box-shadow: 0 2px 12px rgba(0,0,0,0.4);
}
.m-name {
  font-size: 10px;
  letter-spacing: 1.5px;
  color: var(--muted);
  text-transform: uppercase;
  font-weight: 400;
  position: relative;
  z-index: 1;
  transition: color 0.2s;
  line-height: 1.35;
}
.metal-btn.on .m-name, .metal-btn:hover:not(:disabled) .m-name { color: var(--text); }

.stone-list { display:flex; flex-direction:column; gap:5px; }
.stone-btn {
  padding: 11px 15px;
  background: var(--panel);
  border: 1.5px solid var(--border);
  border-radius: var(--r);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}
.stone-btn:disabled { opacity:0.3; cursor:not-allowed; }
.stone-btn:hover:not(:disabled) { border-color:var(--border2); transform:translateX(3px); }
.stone-btn.on {
  border-color: rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.03);
}
.stone-btn.on::before {
  content:'';
  position:absolute;
  left:0; top:0; bottom:0;
  width:2.5px;
  background: var(--scol, var(--gold));
  border-radius: 0 2px 2px 0;
}
.s-gem {
  width: 24px; height: 24px;
  border-radius: 6px;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.4);
}
.s-gem::after {
  content:'';
  position:absolute; inset:0;
  background: radial-gradient(circle at 33% 33%, rgba(255,255,255,0.45), transparent 55%);
}
.s-info { flex:1; min-width:0; }
.s-name { font-size:13px; font-weight:400; color:var(--text); margin-bottom:2px; }
.s-ior {
  font-size: 10px;
  color: var(--muted);
  font-family: 'DM Mono', monospace;
  font-weight: 300;
}

/* ── BUDGET ── */
.price-card {
  padding: 16px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--r);
  margin-bottom: 14px;
}
.price-lbl {
  font-size: 9px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 6px;
  font-family: 'DM Mono', monospace;
}
.price-val {
  font-family: 'Cormorant Garamond', serif;
  font-size: 28px;
  font-weight: 300;
  color: var(--gold);
}
.price-diff {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 300;
  margin-left: 8px;
  vertical-align: middle;
}
.pdiff-p { color: var(--green); }
.pdiff-n { color: var(--red); }
.budget-wrap { position:relative; margin-bottom:14px; }
.budget-pre {
  position: absolute;
  left: 13px; top: 50%;
  transform: translateY(-50%);
  font-family: 'Cormorant Garamond', serif;
  font-size: 17px;
  color: var(--muted);
  pointer-events: none;
}
.budget-inp {
  width: 100%;
  padding: 13px 14px 13px 28px;
  background: var(--panel);
  border: 1.5px solid var(--border);
  border-radius: var(--r);
  color: var(--text);
  font-family: 'DM Mono', monospace;
  font-size: 15px;
  font-weight: 300;
  letter-spacing: 1px;
  outline: none;
  transition: border-color 0.2s;
}
.budget-inp:focus { border-color: rgba(212,175,114,0.35); }
.budget-inp::placeholder { color: var(--dim); }
.sug-list { display:flex; flex-direction:column; gap:5px; }
.sug {
  padding: 10px 14px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 11px;
  letter-spacing: 0.5px;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.5;
}
.sug::before { content:'→ '; color:var(--gold2); }
.sug:hover { border-color:var(--border2); color:var(--text); transform:translateX(3px); }

/* ── BRAND FOOTER ── */
.brand-footer {
  margin-top: auto;
  padding: 22px;
  border-top: 1px solid var(--border);
}
.brand-name {
  font-family: 'Cormorant Garamond', serif;
  font-size: 17px;
  font-weight: 300;
  letter-spacing: 7px;
  color: rgba(212,175,114,0.25);
  text-transform: uppercase;
  margin-bottom: 5px;
}
.brand-tag {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--dim);
  text-transform: uppercase;
  font-family: 'DM Mono', monospace;
}
`;

const METALS = [
  { id: "yellow_gold", name: "Yellow Gold", color: "#C8960C" },
  { id: "white_gold", name: "White Gold", color: "#CECECE" },
  { id: "rose_gold", name: "Rose Gold", color: "#C87060" },
  { id: "platinum", name: "Platinum", color: "#A8B4BC" },
];

const STONES = [
  {
    id: "diamond",
    name: "Diamond",
    color: "#BBEEFF",
    bg: "#0E1E2E",
    ior: "2.42",
    price: 3500,
  },
  {
    id: "ruby",
    name: "Ruby",
    color: "#FF1428",
    bg: "#280006",
    ior: "1.76",
    price: 1200,
  },
  {
    id: "sapphire",
    name: "Sapphire",
    color: "#2050FF",
    bg: "#000820",
    ior: "1.77",
    price: 1000,
  },
  {
    id: "emerald",
    name: "Emerald",
    color: "#18B050",
    bg: "#001C0A",
    ior: "1.58",
    price: 1100,
  },
  {
    id: "amethyst",
    name: "Amethyst",
    color: "#8030E8",
    bg: "#120018",
    ior: "1.54",
    price: 300,
  },
];

const M_PRICE = {
  yellow_gold: 900,
  white_gold: 950,
  rose_gold: 850,
  platinum: 1400,
};
const S_MAP = Object.fromEntries(STONES.map((s) => [s.id, s]));

const STEPS = [
  "Initialising vision model",
  "Extracting parameters",
  "Parsing geometry spec",
  "Compiling 3D model",
  "Applying materials",
];

const SUGS = {
  diamond: [
    "Moissanite: near-identical brilliance, saves ~$2,800",
    "White sapphire: 93% brilliance at 28% of cost",
  ],
  ruby: ["Garnet gives comparable warmth at a fraction of the price"],
  sapphire: ["Aquamarine: vivid blue clarity, saves ~$700"],
  emerald: ["Peridot: vivid green, significantly lower cost"],
  amethyst: [],
  platinum: ["White gold: similar look, saves ~$450"],
};

function useClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function useTypewriter(text, active, speed = 28) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!active || !text) {
      setOut("");
      return;
    }
    setOut("");
    let i = 0;
    const id = setInterval(() => {
      setOut(text.slice(0, ++i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active]);
  return out;
}

export default function App() {
  const [image, setImage] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [pct, setPct] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [revealed, setRevealed] = useState([]);
  const [flash, setFlash] = useState(false);
  const [budget, setBudget] = useState("");
  const stepRef = useRef(null);
  const clock = useClock();

  const price = params
    ? 500 + (S_MAP[params.stone]?.price || 500) + (M_PRICE[params.metal] || 900)
    : 0;

  const diff = budget ? parseInt(budget) - price : null;

  const rawStatus = params
    ? `${(params.style || "").replace(/_/g, " ")}  ·  ${(params.metal || "").replace(/_/g, " ")}  ·  ${params.stone || ""}`
    : "";

  const displayStatus = useTypewriter(rawStatus.toUpperCase(), !!params, 28);

  const sug = params
    ? [...(SUGS[params.stone] || []), ...(SUGS[params.metal] || [])]
    : [];

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImage(f);
    setImgUrl(URL.createObjectURL(f));
    setParams(null);
    setRevealed([]);
  }

  async function handleCompile() {
    if (!image || loading) return;
    setLoading(true);
    setStepIdx(0);
    setPct(0);
    setRevealed([]);
    setFlash(false);
    let s = 0;
    stepRef.current = setInterval(() => {
      s++;
      if (s < STEPS.length) {
        setStepIdx(s);
        setPct(Math.round((s / STEPS.length) * 92));
      }
    }, 700);
    try {
      const fd = new FormData();
      fd.append("file", image);
      const res = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      clearInterval(stepRef.current);
      setStepIdx(STEPS.length - 1);
      setPct(100);
      setTimeout(() => {
        setParams(data.params);
        setFallback(!!data.is_fallback);
        setLoading(false);
        setFlash(true);
        setTimeout(() => setFlash(false), 1100);
        Object.keys(data.params || {}).forEach((_, i) =>
          setTimeout(() => setRevealed((r) => [...r, i]), i * 55),
        );
      }, 400);
    } catch (e) {
      clearInterval(stepRef.current);
      setLoading(false);
    }
  }

  function upd(k, v) {
    setParams((p) => (p ? { ...p, [k]: v } : p));
  }

  const paramEntries = params
    ? Object.entries(params).filter(
        ([k]) => !["jewelry_type", "halo", "band_profile"].includes(k),
      )
    : [];

  const specRows = params
    ? [
        ["Stone cut", params.stone_cut?.replace(/_/g, " ")],
        ["Stone size", `${params.stone_size_mm} mm`],
        ["Ring diameter", `${params.band_diameter_mm} mm`],
        ["Band width", `${params.band_width_mm} mm`],
        ["Prong count", params.prong_count],
        ["Shoulder", params.shoulder],
      ]
    : [];

  const hp = (v) => String(v).padStart(2, "0");
  const timeStr = `${hp(clock.getHours())}:${hp(clock.getMinutes())}:${hp(clock.getSeconds())}`;

  return (
    <>
      <style>{CSS}</style>
      <div className="orb o1" />
      <div className="orb o2" />
      <div className="orb o3" />

      <div className="app">
        {/* HEADER */}
        <header className="hdr">
          <div className="hdr-logo">
            F<em>O</em>RGE
          </div>
          <div className="hdivider" />
          <div className="hdr-sub">AI Jewelry Compiler</div>
          <div className="hdr-right">
            <div className={`pill ${params && !loading ? "active" : ""}`}>
              <div
                className={`sdot ${loading ? "load" : params ? "on" : ""}`}
              />
              {loading
                ? "Compiling"
                : params
                  ? "Model ready"
                  : "Awaiting input"}
            </div>
            <div className="pill">{timeStr}</div>
          </div>
        </header>

        <div className="main">
          {/* LEFT */}
          <aside className="panel panel-l">
            <div className="sec">
              <div className="sec-title">Input Image</div>
              <div className={`upload-zone ${imgUrl ? "filled" : ""}`}>
                <input type="file" accept="image/*" onChange={handleFile} />
                {imgUrl ? (
                  <>
                    <img src={imgUrl} className="upload-preview" alt="" />
                    <div className="upload-overlay" />
                  </>
                ) : (
                  <div className="upload-empty">
                    <div className="upload-icon">◇</div>
                    <div className="upload-lbl">
                      <strong>Drop image here</strong>or click to browse
                    </div>
                  </div>
                )}
              </div>
              <button
                className={`compile-btn${loading ? " loading" : ""}`}
                onClick={handleCompile}
                disabled={!image || loading}
              >
                {loading ? "Compiling…" : "Compile Model"}
              </button>
            </div>

            {params && (
              <div className="sec">
                <div className="sec-title">Extracted Parameters</div>
                {fallback && (
                  <div className="fallback-badge">⚠ defaults applied</div>
                )}
                <div className="param-grid">
                  {paramEntries.map(([k, v], i) => (
                    <div
                      key={k}
                      className={`param-card${revealed.includes(i) ? " vis" : ""}`}
                      style={{ transitionDelay: `${i * 45}ms` }}
                    >
                      <div className="pk">{k.replace(/_/g, " ")}</div>
                      <div
                        className={`pv${typeof v === "number" ? " num" : ""}`}
                      >
                        {typeof v === "boolean"
                          ? v
                            ? "Yes"
                            : "No"
                          : typeof v === "number"
                            ? v.toFixed(v % 1 ? 1 : 0)
                            : String(v).replace(/_/g, " ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {params && (
              <div className="sec">
                <div className="sec-title">Specification</div>
                <div className="spec-rows">
                  {specRows.map(([k, v], i) => (
                    <div
                      key={k}
                      className={`spec-row${revealed.length > 4 ? " vis" : ""}`}
                      style={{ transitionDelay: `${i * 38 + 180}ms` }}
                    >
                      <span className="sr-k">{k}</span>
                      <span className="sr-v">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* CENTER */}
          <main className="viewer-wrap">
            <div className="vc">
              <span className="tl" />
              <span className="tr" />
              <span className="bl" />
              <span className="br" />
            </div>

            {!params && !loading && (
              <div className="empty-state">
                <div className="empty-ring">
                  <div className="empty-gem">◇</div>
                </div>
                <div>
                  <div className="empty-title">Awaiting Blueprint</div>
                  <div className="empty-sub" style={{ marginTop: 8 }}>
                    Upload a photograph to begin
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="loading-overlay">
                <div className="lring-wrap">
                  <svg width="88" height="88" viewBox="0 0 88 88">
                    <defs>
                      <linearGradient
                        id="gGrad"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#D4AF72" />
                        <stop offset="100%" stopColor="#EED090" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="44"
                      cy="44"
                      r="40"
                      fill="none"
                      className="lring-track"
                      strokeWidth="2"
                    />
                    <circle
                      cx="44"
                      cy="44"
                      r="40"
                      fill="none"
                      className="lring-fill"
                      strokeWidth="2.5"
                      strokeDasharray={`${pct * 2.513} 251.3`}
                    />
                  </svg>
                  <div className="lring-pct">{pct}%</div>
                </div>
                <div className="lsteps">
                  {STEPS.map((s, i) => (
                    <div
                      key={s}
                      className={`lstep${i < stepIdx ? " done" : i === stepIdx ? " active" : ""}`}
                    >
                      <div className="lstep-ico">
                        {i < stepIdx ? "✓" : i === stepIdx ? "◌" : ""}
                      </div>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {flash && <div className="sflash" />}
            {params && <Viewer params={params} />}

            <div className="view-lbl">
              {params ? (
                <>
                  {displayStatus}
                  <span className="tw-cursor" />
                </>
              ) : (
                "3D Compilation Viewport"
              )}
            </div>
          </main>

          {/* RIGHT */}
          <aside className="panel panel-r">
            <div className="sec">
              <div className="sec-title">Metal</div>
              <div className="metal-grid">
                {METALS.map((m) => (
                  <button
                    key={m.id}
                    className={`metal-btn${params?.metal === m.id ? " on" : ""}`}
                    onClick={() => upd("metal", m.id)}
                    disabled={!params}
                  >
                    <div
                      className="m-swatch"
                      style={{
                        background: `radial-gradient(circle at 35% 32%, ${m.color}EE, ${m.color}66 70%)`,
                      }}
                    />
                    <div className="m-name">{m.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="sec">
              <div className="sec-title">Gemstone</div>
              <div className="stone-list">
                {STONES.map((s) => (
                  <button
                    key={s.id}
                    className={`stone-btn${params?.stone === s.id ? " on" : ""}`}
                    style={{ "--scol": s.color }}
                    onClick={() => upd("stone", s.id)}
                    disabled={!params}
                  >
                    <div
                      className="s-gem"
                      style={{
                        background: `radial-gradient(circle at 35% 33%, ${s.color}BB, ${s.bg})`,
                      }}
                    />
                    <div className="s-info">
                      <div className="s-name">{s.name}</div>
                      <div className="s-ior">IOR {s.ior}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="sec">
              <div className="sec-title">Budget</div>
              {params && (
                <div className="price-card">
                  <div className="price-lbl">Estimated Retail</div>
                  <div className="price-val">
                    ${price.toLocaleString()}
                    {diff !== null && (
                      <span
                        className={`price-diff ${diff >= 0 ? "pdiff-p" : "pdiff-n"}`}
                      >
                        {diff >= 0 ? "+" : ""}
                        {diff.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="budget-wrap">
                <span className="budget-pre">$</span>
                <input
                  className="budget-inp"
                  type="number"
                  placeholder="0"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
              {sug.length > 0 && (
                <div className="sug-list">
                  {sug.map((s, i) => (
                    <div key={i} className="sug">
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="brand-footer">
              <div className="brand-name">Forge</div>
              <div className="brand-tag">Parametric Compiler · Syrus 2026</div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
