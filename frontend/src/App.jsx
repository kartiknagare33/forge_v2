import { useState, useRef, useEffect } from "react";
import Viewer from "./components/Viewer.jsx";

const API = "http://localhost:8000";

const DENSITY = {
  platinum: 21.45,
  yellow_gold: 19.32,
  white_gold: 19.32,
  rose_gold: 19.32,
};

const PRICING = {
  metal: {
    platinum: 4000,
    yellow_gold: 6500,
    white_gold: 6600,
    rose_gold: 6500,
  },
  primary_stone: {
    diamond: 45000,
    ruby: 18000,
    sapphire: 15000,
    emerald: 20000,
    amethyst: 800,
    moissanite: 4000,
    tsavorite: 12000,
    lab_diamond: 35000,
  },
  secondary_stone: {
    diamond: 15000,
    moissanite: 1500,
    sapphire: 5000,
    none: 0,
  },
  base_labor: {
    solitaire: 8000,
    halo: 12000,
    three_stone: 10000,
    pendant: 6000,
    earrings: 14000,
    pave_band: 15000,
  },
};

const DEFAULT_PARAMS = {
  jewelry_type: "solitaire",
  metal: "rose_gold",
  primary_stone: "diamond",
  has_secondary_stones: false,
  secondary_stone: "none",
  metal_volume_cm3: 1.2,
  finishRoughness: 0.12,
  gemBrilliance: 2.5,
};

export default function App() {
  const [glbB64, setGlbB64] = useState(null);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(
    "Upload a design to launch the compiler.",
  );

  const [userPrompt, setUserPrompt] = useState(
    "Generate this ring, my maximum budget is Rs 45000",
  );
  const [agentReport, setAgentReport] = useState("");

  const fileRef = useRef(null);

  const [details, setDetails] = useState({
    weightGrams: 0,
    carat: 1.2,
    metalCost: 0,
    mainStoneCost: 0,
    secStoneCost: 0,
    labor: 0,
    total: 0,
  });

  useEffect(() => {
    const safeParams = params || DEFAULT_PARAMS;
    const density = DENSITY[safeParams.metal] || 19.32;
    const weightGrams = (safeParams.metal_volume_cm3 || 1.2) * density * 1.12;

    const metalCost = Math.round(
      weightGrams * (PRICING.metal[safeParams.metal] || 6500),
    );
    const estCarat = safeParams.jewelry_type === "solitaire" ? 1.5 : 1.0;
    const mainStoneCost = Math.round(
      estCarat * (PRICING.primary_stone[safeParams.primary_stone] || 45000),
    );

    const secStoneCost = safeParams.has_secondary_stones
      ? PRICING.secondary_stone[safeParams.secondary_stone] || 0
      : 0;
    const labor = PRICING.base_labor[safeParams.jewelry_type] || 8000;

    setDetails({
      weightGrams: parseFloat(weightGrams.toFixed(2)),
      carat: estCarat,
      metalCost,
      mainStoneCost,
      secStoneCost,
      labor,
      total: metalCost + mainStoneCost + secStoneCost + labor,
    });
  }, [params]);

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setGlbB64(null);
    setAgentReport("");
    setStatus("Agent Orchestrating Pipeline & Calculating Mass...");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("prompt", userPrompt);

      const res = await fetch(`${API}/process`, { method: "POST", body: form });
      const data = await res.json();
      if (!data.success) throw new Error(data.detail || "Processing failed");

      setGlbB64(data.glb_b64);
      const safeVolume = data.params?.metal_volume_cm3 || 1.2;

      setParams((p) => ({
        ...p,
        ...data.params,
        metal: data.params?.final_metal || data.params?.metal || "rose_gold",
        primary_stone:
          data.params?.final_stone || data.params?.primary_stone || "diamond",
        metal_volume_cm3: safeVolume,
        finishRoughness: 0.12,
        gemBrilliance: 2.5,
      }));

      setAgentReport(
        data.params?.agent_report || "No agent interventions needed.",
      );
      setStatus(
        `Compiled ${(data.params?.jewelry_type || "solitaire").replace("_", " ")} (Volume: ${safeVolume} cm³)`,
      );
    } catch (err) {
      setStatus("Error: " + err.message);
    }
    setLoading(false);
    e.target.value = "";
  }

  function set(key, val) {
    setParams((p) => ({ ...p, [key]: val }));
  }

  function getSmartAdvice() {
    if (!params || !details) return [];
    const advice = [];
    const currentStonePrice =
      PRICING.primary_stone[params.primary_stone] || 45000;
    const currentMetalPrice = PRICING.metal[params.metal] || 6500;

    if (
      params.primary_stone === "diamond" ||
      params.primary_stone === "lab_diamond"
    ) {
      const diff = currentStonePrice - PRICING.primary_stone["moissanite"];
      advice.push({
        type: "save",
        title: "Swap to Moissanite",
        desc: "Identical optical fire under studio light.",
        diff: diff * (details.carat || 1),
        action: () => set("primary_stone", "moissanite"),
      });
    } else {
      const diff = PRICING.primary_stone["diamond"] - currentStonePrice;
      advice.push({
        type: "upgrade",
        title: "Upgrade to Natural Diamond",
        desc: "Maximum prestige and long-term value retention.",
        diff: diff * (details.carat || 1),
        action: () => set("primary_stone", "diamond"),
      });
    }

    if (params.metal === "platinum" || params.metal === "white_gold") {
      const diff = currentMetalPrice - PRICING.metal["yellow_gold"];
      const type = diff >= 0 ? "save" : "upgrade";
      advice.push({
        type: type,
        title: "Swap to Yellow Gold",
        desc: "Classic traditional aesthetic.",
        diff: Math.abs(diff) * (details.weightGrams || 10),
        action: () => set("metal", "yellow_gold"),
      });
    } else {
      const diff = currentMetalPrice - PRICING.metal["platinum"];
      const type = diff >= 0 ? "save" : "upgrade";
      advice.push({
        type: type,
        title: "Swap to Platinum",
        desc: "Ultra-durable premium metal.",
        diff: Math.abs(diff) * (details.weightGrams || 10),
        action: () => set("metal", "platinum"),
      });
    }

    return advice;
  }

  const smartAdvice = getSmartAdvice();

  return (
    <div style={S.root}>
      <header style={S.header}>
        <span style={S.logo}>FORGE</span>
        <span style={S.tagline}>Parametric Agentic Compiler</span>
        <span style={S.badge}>Live Volumetric Editor</span>
      </header>

      <div style={S.body}>
        <div style={S.left}>
          <h2 style={{ ...S.sec, marginTop: 0 }}>Agentic Constraints</h2>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            rows={2}
            style={S.promptArea}
          />

          <button
            onClick={() => fileRef.current.click()}
            disabled={loading}
            style={S.uploadBtn}
          >
            {loading ? "Compiling & Negotiating..." : "Upload & Run Swarm"}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: "none" }}
          />
          <p style={S.status}>{status}</p>

          {glbB64 && (
            <div style={{ marginTop: 20 }}>
              {agentReport && (
                <div style={S.agentCard}>
                  <h3 style={S.agentTitle}>Agentic Supervisor</h3>
                  <p style={S.agentText}>{agentReport}</p>
                </div>
              )}

              <div style={S.flexBetween}>
                <h2 style={S.sec}>Materials</h2>
                <span style={S.typeBadge}>
                  {(params?.jewelry_type || "solitaire")
                    .replace("_", " ")
                    .toUpperCase()}
                </span>
              </div>

              <h3
                style={{
                  fontSize: 11,
                  color: "#888",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Metal Band
              </h3>
              <div style={S.grid2}>
                {[
                  ["yellow_gold", "Yellow Gold"],
                  ["white_gold", "White Gold"],
                  ["rose_gold", "Rose Gold"],
                  ["platinum", "Platinum"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => set("metal", val)}
                    style={{
                      ...S.chip,
                      ...(params?.metal === val ? S.chipOn : {}),
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <h3
                style={{
                  fontSize: 11,
                  color: "#888",
                  marginBottom: 8,
                  marginTop: 16,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Gemstone
              </h3>
              <div style={S.grid3}>
                {[
                  ["diamond", "Diamond"],
                  ["moissanite", "Moissanite"],
                  ["ruby", "Ruby"],
                  ["sapphire", "Sapphire"],
                  ["emerald", "Emerald"],
                  ["amethyst", "Amethyst"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => set("primary_stone", val)}
                    style={{
                      ...S.chip,
                      ...(params?.primary_stone === val ? S.chipOn : {}),
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <h2 style={{ ...S.sec, marginTop: 24 }}>
                Manufacturing Breakdown
              </h2>
              <div style={S.breakdownCard}>
                <div style={S.bRow}>
                  <span>Metal ({details?.weightGrams || 0}g)</span>{" "}
                  <span>Rs {(details?.metalCost || 0).toLocaleString()}</span>
                </div>
                <div style={S.bRow}>
                  <span>Center Stone ({details?.carat || 0}ct)</span>{" "}
                  <span>
                    Rs {(details?.mainStoneCost || 0).toLocaleString()}
                  </span>
                </div>
                <div style={S.bRow}>
                  <span>Labor & Making</span>{" "}
                  <span>Rs {(details?.labor || 0).toLocaleString()}</span>
                </div>
                <div style={{ ...S.bRow, ...S.bTotal }}>
                  <span>Total Est. Retail</span>{" "}
                  <span style={{ color: "#10b981" }}>
                    Rs {(details?.total || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {smartAdvice.length > 0 && (
                <>
                  <h2 style={{ ...S.sec, marginTop: 24 }}>
                    Post-Generation Suggestions
                  </h2>
                  <div style={S.adviceContainer}>
                    {smartAdvice.map((adv, i) => (
                      <div
                        key={i}
                        style={
                          adv.type === "save"
                            ? S.adviceCardSave
                            : S.adviceCardUpgrade
                        }
                      >
                        <div style={S.flexBetween}>
                          <span style={S.adviceTitle}>{adv.title}</span>
                          <span
                            style={
                              adv.type === "save"
                                ? S.adviceDiffSave
                                : S.adviceDiffUpgrade
                            }
                          >
                            {adv.type === "save" ? "-" : "+"}Rs{" "}
                            {(Math.abs(adv.diff) || 0).toLocaleString()}
                          </span>
                        </div>
                        <p style={S.adviceDesc}>{adv.desc}</p>
                        <button
                          onClick={adv.action}
                          style={
                            adv.type === "save"
                              ? S.adviceBtnSave
                              : S.adviceBtnUpgrade
                          }
                        >
                          Apply Optimization
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <h2 style={{ ...S.sec, marginTop: 24 }}>Parametric Modifiers</h2>
              <p style={S.lbl}>Metal Finish (Roughness)</p>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={params?.finishRoughness || 0.12}
                onChange={(e) =>
                  set("finishRoughness", parseFloat(e.target.value))
                }
                style={S.slider}
              />
              <div style={S.flexBetween}>
                <span style={S.smallText}>Polished</span>
                <span style={S.smallText}>Matte</span>
              </div>

              <p style={S.lbl}>Gem Brilliance (HDRI Impact)</p>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={params?.gemBrilliance || 2.5}
                onChange={(e) =>
                  set("gemBrilliance", parseFloat(e.target.value))
                }
                style={S.slider}
              />
            </div>
          )}
        </div>

        <div style={S.right}>
          {glbB64 ? (
            <Viewer glbB64={glbB64} params={params} loading={loading} />
          ) : (
            <div style={S.placeholderBox}>
              <div style={S.placeholderText}>
                {loading
                  ? "Extracting Spatial Parameters..."
                  : "[ SYSTEM IDLE : AWAITING DESIGN UPLOAD ]"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const S = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
    background: "#050508",
    color: "#fff",
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "16px 32px",
    borderBottom: "1px solid #1a1a24",
    background: "#0a0a0f",
    flexShrink: 0,
  },
  logo: {
    fontFamily: "'Cormorant Garamond',serif",
    fontSize: 24,
    color: "#C9A84C",
    fontWeight: 700,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 11,
    color: "#666",
    letterSpacing: 3,
    flex: 1,
    textTransform: "uppercase",
  },
  badge: {
    fontSize: 10,
    color: "#10b981",
    background: "#10b98115",
    border: "1px solid #10b98140",
    padding: "4px 10px",
    borderRadius: 20,
    letterSpacing: 1,
  },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  left: {
    width: 360,
    borderRight: "1px solid #1a1a24",
    background: "#08080c",
    padding: "24px",
    overflowY: "auto",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
  },
  right: {
    flex: 1,
    background: "radial-gradient(circle at center, #111118 0%, #050508 100%)",
  },
  flexBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 12,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 6,
    marginBottom: 12,
  },

  promptArea: {
    width: "100%",
    padding: "12px",
    background: "#111118",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#C9A84C",
    fontSize: 12,
    marginBottom: 16,
    resize: "vertical",
    fontFamily: "'JetBrains Mono', monospace",
  },
  agentCard: {
    background: "#0a0a0f",
    border: "1px solid #10b981",
    borderRadius: 6,
    padding: 12,
    marginBottom: 24,
    boxShadow: "0 0 15px rgba(16, 185, 129, 0.1)",
  },
  agentTitle: {
    fontSize: 11,
    color: "#10b981",
    textTransform: "uppercase",
    letterSpacing: 1,
    margin: "0 0 8px 0",
  },
  agentText: {
    fontSize: 12,
    color: "#ddd",
    lineHeight: 1.5,
    fontFamily: "'JetBrains Mono', monospace",
  },

  uploadBtn: {
    width: "100%",
    padding: "14px 0",
    background: "linear-gradient(135deg, #E0C37A 0%, #C9A84C 100%)",
    border: "none",
    borderRadius: 6,
    color: "#000",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    cursor: "pointer",
    marginBottom: 12,
  },
  status: {
    fontSize: 12,
    color: "#888",
    lineHeight: 1.5,
    fontFamily: "'JetBrains Mono', monospace",
  },
  sec: {
    fontSize: 10,
    color: "#C9A84C",
    letterSpacing: 2,
    fontWeight: 600,
    borderBottom: "1px solid #333",
    paddingBottom: 8,
    flex: 1,
    margin: 0,
    marginBottom: 12,
  },
  typeBadge: {
    fontSize: 9,
    background: "#1a1a24",
    padding: "4px 8px",
    borderRadius: 4,
    color: "#aaa",
    letterSpacing: 1,
  },
  chip: {
    padding: "10px 4px",
    background: "#111118",
    border: "1px solid #222230",
    borderRadius: 6,
    color: "#aaa",
    cursor: "pointer",
    fontSize: 11,
    textAlign: "center",
    transition: "all 0.2s",
  },
  chipOn: {
    background: "#1a1500",
    border: "1px solid #C9A84C",
    color: "#E0C37A",
    boxShadow: "0 0 10px rgba(201, 168, 76, 0.1)",
  },
  breakdownCard: {
    background: "#111118",
    border: "1px solid #222230",
    borderRadius: 6,
    padding: 12,
    fontSize: 12,
    color: "#aaa",
  },
  bRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    borderBottom: "1px solid #1a1a24",
  },
  bTotal: {
    borderBottom: "none",
    paddingTop: 10,
    marginTop: 4,
    borderTop: "1px dashed #333",
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  adviceContainer: { display: "flex", flexDirection: "column", gap: 10 },
  adviceCardSave: {
    background: "#051f15",
    border: "1px solid #047857",
    borderRadius: 6,
    padding: 12,
  },
  adviceCardUpgrade: {
    background: "#1e1b4b",
    border: "1px solid #4338ca",
    borderRadius: 6,
    padding: 12,
  },
  adviceTitle: { fontSize: 12, fontWeight: "bold", color: "#fff" },
  adviceDiffSave: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#10b981",
    fontFamily: "monospace",
  },
  adviceDiffUpgrade: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#818cf8",
    fontFamily: "monospace",
  },
  adviceDesc: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 1.4,
  },
  adviceBtnSave: {
    width: "100%",
    padding: "8px",
    background: "#047857",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    cursor: "pointer",
  },
  adviceBtnUpgrade: {
    width: "100%",
    padding: "8px",
    background: "#4338ca",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    cursor: "pointer",
  },
  placeholderBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
  },
  placeholderText: {
    color: "#444",
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: 2,
    fontSize: 14,
  },
  lbl: {
    fontSize: 11,
    color: "#888",
    marginBottom: 8,
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  slider: { width: "100%", cursor: "pointer", accentColor: "#C9A84C" },
  smallText: { fontSize: 9, color: "#666", textTransform: "uppercase" },
};
