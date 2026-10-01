# Forge
### Syrus 2026 - Team Blitzkrieg | Agentic AI Track 
### PS 1 :  AI-Driven 2D to 3D Jewelry Generation with Real-Time Customization


## 📚 Project Resources

- 📄 **Documentation:** [View Google Doc](https://docs.google.com/document/d/1oIzGi6DKZN9Mrrn8sRoCDPZhbIjF0gjxMhFVN2JsxiY/edit?usp=sharing)
- 📊 **Presentation:** [View on Canva](https://www.canva.com/design/DAHENbnx46w/_82SZR4cr98UTwXFctcdow/edit?utm_content=DAHENbnx46w&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton)
- 🎥 **Video Demo:** [Watch on YouTube](https://youtu.be/Sa5909W0fyQ?si=cpaMp8GeI6uF5l16)

**FORGE** is a Parametric Agentic Compiler for jewelry manufacturing. It bridges the gap between diffusion-based Generative AI, deterministic spatial mathematics, and autonomous agentic reasoning. 

Traditional 3D generative AI outputs topologically fused meshes—mathematically inseparable blobs of pixels that cannot be accurately priced, customized, or used in CAD manufacturing. Furthermore, zero-shot LLM vision pipelines suffer from the Small Object Detection (SOD) problem, entirely missing sub-pixel micro-geometry like pavé stones. FORGE solves this by transforming a 2D sketch and a natural language budget constraint into a mathematically verified, budget-compliant, and manufacturing-ready 3D asset.

---

## 🚀 Core Features & Novelty

* **Agentic Volumetric Solver:** Executes deterministic physics simulations on the raw AI output. Utilizes the `Trimesh` library to compute the watertight cubic volume (with Convex Hull fallback) and derives real-world physical mass using precise metallurgical densities (e.g., 19.32 g/cm³ for Gold).
* **Recursive Financial Constraint Satisfaction:** The Agentic Supervisor (Gemini 2.5 Flash) operates as a constraint-solving algorithm. It calculates baseline pricing and autonomously traverses a material hierarchy tree (e.g., downgrading Natural Diamond to Moissanite), recalculating physical mass and cost until `current_price <= user_budget`.
* **Spatially-Gated Hybrid Semantic-Projection Engine:** Decouples vision tasks to bypass LLM latency and SOD failures. 
  * *Macro-Vision:* Uses zero-shot AI strictly for semantic center-stone localization.
  * *Micro-Vision:* Runs offline classical computer vision on 3D Normal Maps. A Laplacian `FIND_EDGES` filter combined with `MaxFilter(9)` mathematically zeroes out smooth metal gradients while triggering massive gradient spikes on high-frequency pavé facets. Achieves 100% micro-stone isolation in ~50ms with zero extra API calls.
* **Alpha-Agnostic Spatial Gate:** Overrides unstable alpha-channel bounding boxes using absolute image tensors (W, H). Programmatically crops the bottom 30% of the coordinate space to eliminate false-positive edge detections on sharp metallic prongs.
* **Multi-Camera UV-Raycast Vertex Severance:** A custom WebGL `SAMesh` pipeline reverse-projects 2D composite matrices from 6 orthographic cameras directly onto the 3D topology. This permanently severs the fused mesh, allowing assignment of opaque metallic properties to the band and volumetric refractive transmission shaders (with accurate IOR) exclusively to the stones.

---

## 🧠 System Architecture

1. **Ingestion & Inference:** FastAPI routes a 2D sketch and a text-based budget to the Agentic Intent Extractor, which parses parameters into a strict JSON schema. TRELLIS ZeroGPU synthesizes the raw 3D geometry (`.glb`).
2. **Physics & Agentic Negotiation:** Trimesh calculates volume and mass. The Agentic Pricing Loop iterates through material downgrades to satisfy the financial constraint, generating a Bill of Materials (BOM).
3. **Hybrid Vision Loop:** The client renders 6 orthographic Normal Maps. Gemini extracts the macro center-stone mask, while the deterministic Python edge-detector extracts the micro pavé-stone mask. These undergo a pixel-wise MAX composite merge.
4. **Geometric Compilation:** The SAMesh WebGL pipeline raycasts the composite masks onto the vertices, physically severing the geometry into discrete material groups for dynamic PBR shading.

---

## 💻 Tech Stack

**Frontend (The Hands)**
* React.js
* Three.js & WebGL (Custom SAMeshLifter Pipeline)

**Backend & Physics (The Brain)**
* Python 3
* FastAPI
* Trimesh (Spatial Mathematics & Volumetric Physics)
* Pillow / PIL (High-Frequency Algorithmic Edge Detection)

**AI & Inference Layer**
* Gemini 2.5 Flash API (Agentic Supervisor & Semantic Vision)
* TRELLIS Generative AI (Latent-to-3D Diffusion)

---

## ⚙️ Installation & Setup

### Prerequisites
* Python 3.10+
* Node.js & npm
* A valid Gemini API Key (`GEMINI_API_KEY`)

### Backend Setup
```bash
# Clone the repository
git clone [https://github.com/CMPN-CODECELL/Syrus2026_Team_Blitzkrieg.git](https://github.com/CMPN-CODECELL/Syrus2026_Team_Blitzkrieg.git)
cd Syrus2026_Team_Blitzkrieg/backend

# Create virtual environment and install dependencies
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt

# Set your environment variables
echo "GEMINI_API_KEY=your_api_key_here" > .env

# Run the FastAPI server
python main.py
