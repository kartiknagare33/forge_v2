import React, { useState } from "react";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

export default function ModelExporter({ filename = "forge_compiled_ring" }) {
  const [isExporting, setIsExporting] = useState(false);

  const exportGLB = () => {
    if (!window.forgeScene) {
      alert("Awaiting 3D model. Please upload a design first.");
      return;
    }
    setIsExporting(true);
    const exporter = new GLTFExporter();

    exporter.parse(
      window.forgeScene,
      (gltf) => {
        const blob = new Blob([gltf], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.style.display = "none";
        link.href = url;
        link.download = `${filename}.glb`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsExporting(false);
      },
      (error) => {
        console.error("GLB export error:", error);
        alert("Failed to export GLB.");
        setIsExporting(false);
      },
      { binary: true },
    );
  };

  const exportSTL = () => {
    if (!window.forgeScene) {
      alert("Awaiting 3D model. Please upload a design first.");
      return;
    }
    setIsExporting(true);
    const exporter = new STLExporter();
    const stlString = exporter.parse(window.forgeScene);

    const blob = new Blob([stlString], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.style.display = "none";
    link.href = url;
    link.download = `${filename}.stl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExporting(false);
  };

  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        background: "#111118",
        border: "1px solid #222230",
        borderRadius: 6,
      }}
    >
      <h2
        style={{
          fontSize: 10,
          color: "#C9A84C",
          letterSpacing: 2,
          fontWeight: 600,
          borderBottom: "1px solid #333",
          paddingBottom: 8,
          margin: "0 0 12px 0",
          textTransform: "uppercase",
        }}
      >
        CAD Export
      </h2>
      <p
        style={{
          fontSize: 11,
          color: "#888",
          marginBottom: 16,
          lineHeight: 1.4,
        }}
      >
        Download the mathematically severed mesh for 3D printing and CAD
        manufacturing.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={exportGLB}
          disabled={isExporting}
          style={{
            flex: 1,
            padding: "10px 0",
            background: "#1a1a24",
            border: "1px solid #333",
            borderRadius: 4,
            color: "#C9A84C",
            fontSize: 11,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {isExporting ? "..." : "EXPORT .GLB"}
        </button>
        <button
          onClick={exportSTL}
          disabled={isExporting}
          style={{
            flex: 1,
            padding: "10px 0",
            background: "#1a1a24",
            border: "1px solid #333",
            borderRadius: 4,
            color: "#C9A84C",
            fontSize: 11,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {isExporting ? "..." : "EXPORT .STL"}
        </button>
      </div>
    </div>
  );
}
