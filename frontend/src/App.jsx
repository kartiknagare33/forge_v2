import { useState, useRef, useEffect } from "react";
import Viewer from "./components/Viewer.jsx";
import ModelExporter from "./ModelExporter.jsx";

const API = "http://localhost:8000";

const DENSITY = {
  platinum: 21.45,
  yellow_gold: 19.32,
  white_gold: 19.32,
  rose_gold: 19.32,
  titanium: 4.5,
  black_rhodium: 12.41,
  sterling_silver: 10.49,
};

// NEW: MATERIAL STRENGTH MATRIX
const MATERIAL_SPECS = {
  titanium: { min_thickness: 0.8, strength: "Ultra-High" },
  platinum: { min_thickness: 1.2, strength: "High" },
  black_rhodium: { min_thickness: 1.3, strength: "High" },
  white_gold: { min_thickness: 1.4, strength: "Medium-High" },
  yellow_gold: { min_thickness: 1.5, strength: "Medium" },
  rose_gold: { min_thickness: 1.5, strength: "Medium" },
  sterling_silver: { min_thickness: 1.6, strength: "Low" },
};

const FALLBACK_PRICING = {
  metals: {
    platinum: { price_per_gram: 4000 },
    yellow_gold: { price_per_gram: 6500 },
    white_gold: { price_per_gram: 6600 },
    rose_gold: { price_per_gram: 6500 },
    titanium: { price_per_gram: 1200 },
    black_rhodium: { price_per_gram: 8500 },
    sterling_silver: { price_per_gram: 95 },
  },
  stones: {
    diamond: { price: 45000 },
    emerald: { price: 20000 },
    ruby: { price: 18000 },
    sapphire: { price: 15000 },
    lab_diamond: { price: 35000 },
    moissanite: { price: 4000 },
    alexandrite: { price: 55000 },
    morganite: { price: 8500 },
    aquamarine: { price: 9500 },
    black_diamond: { price: 12000 },
    amethyst: { price: 1200 },
  },
};

const BASE_LABOR = {
  solitaire: 8000,
  halo: 12000,
  three_stone: 10000,
  pendant: 6000,
  earrings: 14000,
  pave_band: 15000,
};

const DEFAULT_PARAMS = {
  jewelry_type: "solitaire",
  metal: "rose_gold",
  primary_stone: "diamond",
  has_secondary_stones: false,
  secondary_stone: "none",
  metal_volume_cm3: 1.2,
  surface_area_cm2: 12.5,
  estimated_band_thickness_mm: 1.8,
  finishRoughness: 0.12,
  gemBrilliance: 2.5,
};

export default function App() {
  const [glbB64, setGlbB64] = useState(null);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [basePhysics, setBasePhysics] = useState({
    vol: 1.2,
    area: 12.5,
    thick: 1.8,
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(
    "Upload a design to launch the compiler.",
  );
  const [userPrompt, setUserPrompt] = useState(
    "Generate this ring, my maximum budget is Rs 45000",
  );
  const [agentReport, setAgentReport] = useState("");

  const [livePricing, setLivePricing] = useState(null);
  const [marketTime, setMarketTime] = useState("");

  const [swarmLogs, setSwarmLogs] = useState(null);
  const [pendingProposal, setPendingProposal] = useState(null);

  const fileRef = useRef(null);
  const [details, setDetails] = useState({
    weightGrams: 0,
    carat: 1.2,
    metalRate: 0,
    stoneRate: 0,
    metalCost: 0,
    mainStoneCost: 0,
    labor: 0,
    total: 0,
  });

  useEffect(() => {
    fetch(`${API}/api/pricing/live`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setLivePricing(data.data);
          setMarketTime(data.timestamp);
        }
      })
      .catch((err) =>
        console.error("Failed to connect to live market API:", err),
      );
  }, []);

  useEffect(() => {
    const safeParams = params || DEFAULT_PARAMS;
    const density = DENSITY[safeParams.metal] || 19.32;
    const weightGrams = (safeParams.metal_volume_cm3 || 1.2) * density * 1.12;

    const currentPricing = livePricing || FALLBACK_PRICING;
    const metalRate =
      currentPricing.metals[safeParams.metal]?.price_per_gram || 6500;
    const metalCost = Math.round(weightGrams * metalRate);

    const estCarat = safeParams.jewelry_type === "solitaire" ? 1.5 : 1.0;
    const stoneRate =
      currentPricing.stones[safeParams.primary_stone]?.price || 45000;
    const mainStoneCost = Math.round(estCarat * stoneRate);

    const labor = BASE_LABOR[safeParams.jewelry_type] || 8000;

    setDetails({
      weightGrams: parseFloat(weightGrams.toFixed(2)),
      carat: estCarat,
      metalRate: metalRate,
      stoneRate: stoneRate,
      metalCost,
      mainStoneCost,
      labor,
      total: metalCost + mainStoneCost + labor,
    });
  }, [params, livePricing]);

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setGlbB64(null);
    setAgentReport("");
    setSwarmLogs(null);
    setPendingProposal(null);
    setStatus("Agent Orchestrating Pipeline & Extracting Physics...");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("prompt", userPrompt);
      const res = await fetch(`${API}/process`, { method: "POST", body: form });
      const data = await res.json();
      if (!data.success) throw new Error(data.detail || "Processing failed");

      setGlbB64(data.glb_b64);

      const extVol = data.params?.metal_volume_cm3 || 1.2;
      const extArea = data.params?.surface_area_cm2 || 12.5;
      const extThick = data.params?.estimated_band_thickness_mm || 1.8;

      setBasePhysics({ vol: extVol, area: extArea, thick: extThick });

      setParams((p) => ({
        ...p,
        ...data.params,
        metal: data.params?.final_metal || data.params?.metal || "rose_gold",
        primary_stone:
          data.params?.final_stone || data.params?.primary_stone || "diamond",
        metal_volume_cm3: extVol,
        surface_area_cm2: extArea,
        estimated_band_thickness_mm: extThick,
        finishRoughness: 0.12,
        gemBrilliance: 2.5,
      }));
      setAgentReport(
        data.params?.agent_report || "No agent interventions needed.",
      );
      setStatus(`Physics extraction complete.`);
    } catch (err) {
      setStatus("Error: " + err.message);
    }
    setLoading(false);
    e.target.value = "";
  }

  function set(key, val) {
    setParams((p) => ({ ...p, [key]: val }));
  }

  const applySwarmProposal = () => {
    if (!pendingProposal) return;
    const safeMetal = String(pendingProposal.new_metal)
      .toLowerCase()
      .replace(/[\s-]/g, "_");
    const safeStone = String(pendingProposal.new_stone)
      .toLowerCase()
      .replace(/[\s-]/g, "_");
    const safeRoughness = parseFloat(pendingProposal.new_roughness) || 0.12;

    set("metal", safeMetal);
    set("primary_stone", safeStone);
    set("finishRoughness", safeRoughness);

    setPendingProposal(null);
    setSwarmLogs(null);
  };

  // Determine Stability
  const currentMetalSpec =
    MATERIAL_SPECS[params.metal] || MATERIAL_SPECS.yellow_gold;
  const isStable =
    params.estimated_band_thickness_mm >= currentMetalSpec.min_thickness;

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
            {loading ? "Compiling Geometry..." : "Upload & Run Swarm"}
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

              <div
                style={{
                  ...S.diagnosticsCard,
                  borderColor: isStable ? "#1e3a8a" : "#ef4444",
                  boxShadow: isStable
                    ? "0 0 15px rgba(59, 130, 246, 0.1)"
                    : "0 0 15px rgba(239, 68, 68, 0.2)",
                }}
              >
                <div style={{ ...S.flexBetween, marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 10,
                      color: isStable ? "#3b82f6" : "#ef4444",
                      fontWeight: "bold",
                      letterSpacing: 1,
                    }}
                  >
                    ⚙️ STRUCTURAL DIAGNOSTICS
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      background: isStable ? "#10b98120" : "#ef444420",
                      color: isStable ? "#10b981" : "#ef4444",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {isStable ? "✅ STABLE" : "⚠️ UNSTABLE"}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#888",
                        textTransform: "uppercase",
                      }}
                    >
                      Mesh Volume
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#fff",
                        fontFamily: "monospace",
                      }}
                    >
                      {params.metal_volume_cm3} cm³
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#888",
                        textTransform: "uppercase",
                      }}
                    >
                      Surface Area
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#fff",
                        fontFamily: "monospace",
                      }}
                    >
                      {params.surface_area_cm2} cm²
                    </div>
                  </div>
                  <div
                    style={{
                      gridColumn: "span 2",
                      background: "#111118",
                      padding: 8,
                      borderRadius: 4,
                      border: "1px solid #222230",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: "#888",
                        textTransform: "uppercase",
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span>Est. Band Thickness</span>
                      <span>
                        Min Required: {currentMetalSpec.min_thickness}mm
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          color: isStable ? "#10b981" : "#ef4444",
                          fontFamily: "monospace",
                          fontWeight: "bold",
                        }}
                      >
                        {params.estimated_band_thickness_mm} mm
                      </div>
                      <div style={{ fontSize: 9, color: "#888" }}>
                        Strength:{" "}
                        <span style={{ color: "#fff" }}>
                          {currentMetalSpec.strength}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={S.flexBetween}>
                <h2 style={S.sec}>Materials</h2>
                <span style={S.typeBadge}>
                  {(params?.jewelry_type || "solitaire")
                    .replace("_", " ")
                    .toUpperCase()}
                </span>
              </div>

              <h3 style={S.lbl}>Metal Band</h3>
              <div style={S.grid2}>
                {[
                  "yellow_gold",
                  "white_gold",
                  "rose_gold",
                  "platinum",
                  "titanium",
                  "black_rhodium",
                  "sterling_silver",
                ].map((val) => (
                  <button
                    key={val}
                    onClick={() => set("metal", val)}
                    style={{
                      ...S.chip,
                      ...(params?.metal === val ? S.chipOn : {}),
                    }}
                  >
                    {val.replace(/_/g, " ")}
                  </button>
                ))}
              </div>

              <h3 style={S.lbl}>Gemstone</h3>
              <div style={S.grid3}>
                {[
                  "diamond",
                  "lab_diamond",
                  "moissanite",
                  "ruby",
                  "sapphire",
                  "emerald",
                  "amethyst",
                  "alexandrite",
                  "morganite",
                  "aquamarine",
                  "black_diamond",
                ].map((val) => (
                  <button
                    key={val}
                    onClick={() => set("primary_stone", val)}
                    style={{
                      ...S.chip,
                      ...(params?.primary_stone === val ? S.chipOn : {}),
                    }}
                  >
                    {val.replace(/_/g, " ")}
                  </button>
                ))}
              </div>

              <div
                style={{
                  ...S.flexBetween,
                  marginTop: 24,
                  borderBottom: "1px solid #333",
                  paddingBottom: 8,
                  marginBottom: 12,
                }}
              >
                <h2
                  style={{
                    fontSize: 10,
                    color: "#C9A84C",
                    letterSpacing: 2,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Manufacturing Breakdown
                </h2>
                {livePricing && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#10b981",
                      background: "#10b98115",
                      padding: "2px 6px",
                      borderRadius: 10,
                      border: "1px solid #10b98140",
                    }}
                  >
                    <span style={{ marginRight: 4 }}>🟢</span>LIVE RATES
                  </span>
                )}
              </div>

              <div style={S.breakdownCard}>
                <div style={S.bRow}>
                  <span>
                    Metal ({details.weightGrams}g @ Rs{" "}
                    {details.metalRate.toLocaleString()}/g)
                  </span>
                  <span>Rs {details.metalCost.toLocaleString()}</span>
                </div>
                <div style={S.bRow}>
                  <span>
                    Stone ({details.carat}ct @ Rs{" "}
                    {details.stoneRate.toLocaleString()})
                  </span>
                  <span>Rs {details.mainStoneCost.toLocaleString()}</span>
                </div>
                <div style={S.bRow}>
                  <span>Labor & Making</span>
                  <span>Rs {details.labor.toLocaleString()}</span>
                </div>
                <div style={{ ...S.bRow, ...S.bTotal }}>
                  <span>Total Est. Retail</span>
                  <span style={{ color: "#10b981" }}>
                    Rs {details.total.toLocaleString()}
                  </span>
                </div>
                {marketTime && (
                  <div
                    style={{
                      fontSize: 9,
                      color: "#666",
                      textAlign: "right",
                      marginTop: 8,
                      fontStyle: "italic",
                    }}
                  >
                    Prices auto-synced at {marketTime}
                  </div>
                )}
              </div>

              <h2 style={{ ...S.sec, marginTop: 24, color: "#10b981" }}>
                Multi-Agent Swarm Terminal
              </h2>
              <div
                style={{
                  background: "#050508",
                  border: "1px solid #10b981",
                  borderRadius: 6,
                  padding: 12,
                  position: "relative",
                }}
              >
                {swarmLogs && (
                  <div style={S.swarmHud}>
                    <div style={{ color: "#60a5fa" }}>
                      <strong>[GEMOLOGIST]:</strong>{" "}
                      {swarmLogs.gemologist_thought}
                    </div>
                    <div style={{ color: "#f59e0b" }}>
                      <strong>[METALLURGIST]:</strong>{" "}
                      {swarmLogs.metallurgist_thought}
                    </div>
                    <div style={{ color: "#10b981" }}>
                      <strong>[FINANCE DIR]:</strong>{" "}
                      {swarmLogs.financial_thought}
                    </div>
                  </div>
                )}

                {pendingProposal && (
                  <div style={S.proposalCard}>
                    <h4
                      style={{
                        margin: "0 0 8px 0",
                        color: "#fff",
                        fontSize: 11,
                        letterSpacing: 1,
                      }}
                    >
                      PROPOSED CONFIGURATION
                    </h4>
                    <div style={S.proposalRow}>
                      <span>Metal:</span>{" "}
                      <strong style={{ textTransform: "capitalize" }}>
                        {String(pendingProposal.new_metal).replace(/_/g, " ")}
                      </strong>
                    </div>
                    <div style={S.proposalRow}>
                      <span>Stone:</span>{" "}
                      <strong style={{ textTransform: "capitalize" }}>
                        {String(pendingProposal.new_stone).replace(/_/g, " ")}
                      </strong>
                    </div>
                    <div style={S.proposalRow}>
                      <span>Finish:</span>{" "}
                      <strong>
                        {pendingProposal.new_roughness < 0.2
                          ? "Polished"
                          : "Matte/Vintage"}
                      </strong>
                    </div>
                    <div
                      style={{
                        ...S.proposalRow,
                        border: 0,
                        marginTop: 4,
                        color: "#10b981",
                      }}
                    >
                      <span>Est. Total:</span>{" "}
                      <strong>
                        Rs {pendingProposal.estimated_price.toLocaleString()}
                      </strong>
                    </div>
                    <button onClick={applySwarmProposal} style={S.applyBtn}>
                      APPLY CONFIGURATION TO MODEL
                    </button>
                  </div>
                )}

                <div
                  style={{
                    fontSize: 11,
                    color: "#888",
                    marginBottom: 10,
                    fontFamily: "monospace",
                  }}
                >
                  {pendingProposal
                    ? "Review proposed specs above."
                    : "System ready. Enter constraints for the Swarm."}
                </div>

                <input
                  type="text"
                  placeholder="e.g., 'Make it gold under 40k'"
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      const prompt = e.target.value;
                      if (!prompt) return;
                      const originalValue = e.target.value;
                      e.target.disabled = true;
                      e.target.value = "Swarm consulting physics engine...";
                      setSwarmLogs(null);
                      setPendingProposal(null);
                      try {
                        const response = await fetch(
                          `${API}/api/agent/command`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              user_prompt: prompt,
                              current_volume_cm3:
                                params.metal_volume_cm3 || 1.2,
                              band_thickness_mm:
                                params.estimated_band_thickness_mm || 1.8,
                              current_metal: params.metal,
                              current_stone: params.primary_stone,
                            }),
                          },
                        );
                        const data = await response.json();
                        if (response.status === 429) {
                          alert("Rate limit hit.");
                          e.target.value = originalValue;
                          e.target.disabled = false;
                          return;
                        }
                        if (data.success && data.action) {
                          setSwarmLogs(data.action);
                          setPendingProposal(data.action);
                          e.target.value = "";
                        } else {
                          alert("Swarm consensus failed.");
                          e.target.value = originalValue;
                        }
                      } catch (err) {
                        alert("Swarm network failure.");
                        e.target.value = originalValue;
                      } finally {
                        e.target.disabled = false;
                      }
                    }
                  }}
                  style={S.terminalInput}
                />
              </div>

              <h2 style={{ ...S.sec, marginTop: 24 }}>Parametric Modifiers</h2>

              <p style={{ ...S.lbl, color: "#3b82f6" }}>
                Band Thickness (Structural Modifier)
              </p>
              <input
                type="range"
                min="0.8"
                max="3.5"
                step="0.1"
                value={params.estimated_band_thickness_mm}
                onChange={(e) => {
                  const newThick = parseFloat(e.target.value);
                  const scale = newThick / basePhysics.thick;
                  setParams((p) => ({
                    ...p,
                    estimated_band_thickness_mm: newThick,
                    metal_volume_cm3: parseFloat(
                      (basePhysics.vol * scale).toFixed(3),
                    ),
                    surface_area_cm2: parseFloat(
                      (basePhysics.area * scale).toFixed(2),
                    ),
                  }));
                }}
                style={{ ...S.slider, accentColor: "#3b82f6" }}
              />
              <div style={S.flexBetween}>
                <span style={S.smallText}>0.8mm (Fragile)</span>
                <span style={S.smallText}>3.5mm (Chunky)</span>
              </div>

              <p style={{ ...S.lbl, marginTop: 16 }}>
                Metal Finish (Roughness)
              </p>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={params.finishRoughness}
                onChange={(e) =>
                  set("finishRoughness", parseFloat(e.target.value))
                }
                style={S.slider}
              />
              <div style={S.flexBetween}>
                <span style={S.smallText}>Polished</span>
                <span style={S.smallText}>Matte</span>
              </div>

              <p style={{ ...S.lbl, marginTop: 16 }}>Gem Brilliance</p>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={params.gemBrilliance}
                onChange={(e) =>
                  set("gemBrilliance", parseFloat(e.target.value))
                }
                style={S.slider}
              />

              <ModelExporter filename="forge_custom_design" />
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
  diagnosticsCard: {
    background: "#0a0a0f",
    border: "1px solid #1e3a8a",
    borderRadius: 6,
    padding: 12,
    marginBottom: 24,
    boxShadow: "0 0 15px rgba(59, 130, 246, 0.1)",
    transition: "all 0.3s ease",
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
    marginBottom: 12,
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
  lbl: {
    fontSize: 11,
    color: "#888",
    marginBottom: 8,
    marginTop: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
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
    textTransform: "capitalize",
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
  slider: { width: "100%", cursor: "pointer", accentColor: "#C9A84C" },
  smallText: { fontSize: 9, color: "#666", textTransform: "uppercase" },
  swarmHud: {
    padding: 12,
    background: "#0a0a0f",
    border: "1px dashed #333",
    marginBottom: 12,
    borderRadius: 4,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  proposalCard: {
    background: "#10b98110",
    border: "1px solid #10b981",
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    boxShadow: "0 0 20px rgba(16, 185, 129, 0.1)",
  },
  proposalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#aaa",
    padding: "4px 0",
    borderBottom: "1px solid #10b98120",
  },
  applyBtn: {
    width: "100%",
    marginTop: 10,
    padding: "10px",
    background: "#10b981",
    border: "none",
    borderRadius: 4,
    color: "#000",
    fontWeight: "bold",
    fontSize: 10,
    cursor: "pointer",
    letterSpacing: 1,
    transition: "transform 0.1s active",
  },
  terminalInput: {
    width: "100%",
    padding: "10px",
    background: "#111118",
    border: "1px solid #333",
    color: "#10b981",
    borderRadius: 4,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    outline: "none",
    boxSizing: "border-box",
  },
};
