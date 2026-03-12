import React, { useState } from 'react';
import axios from 'axios';
import JewelryViewer from './JewelryViewer';
import { Upload, Cpu, Settings2, Sparkles, DollarSign, AlertCircle } from 'lucide-react';

function App() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  
  // Default to Platinum & Diamond
  const [materials, setMaterials] = useState({ metal: '#E5E4E2', stone: '#FFFFFF' });
  const [targetBudget, setTargetBudget] = useState('');

  // --- HACKATHON MAGIC: The Pricing Algorithm ---
  const calculateCost = (mats) => {
    let cost = 500; // Base manufacturing cost
    
    // Stone costs
    if (mats.stone === '#FFFFFF') cost += 3500; // Diamond
    else if (mats.stone === '#E0115F') cost += 1200; // Ruby
    else if (mats.stone === '#0F52BA') cost += 1000; // Sapphire
    else if (mats.stone === '#F4F4F4') cost += 300;  // Moissanite (Budget option)

    // Metal costs
    if (mats.metal === '#E5E4E2') cost += 1200; // Platinum
    else if (mats.metal === '#FFD700') cost += 800; // Gold
    else if (mats.metal === '#B76E79') cost += 800; // Rose Gold
    else if (mats.metal === '#C0C0C0') cost += 150; // Silver (Budget option)

    return cost;
  };

  const currentCost = calculateCost(materials);
  const isOverBudget = targetBudget && parseInt(targetBudget) < currentCost;

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('http://localhost:8000/process', formData);
      setData(res.data);
      if(res.data.params.material.toLowerCase().includes('rose')) setMaterials(m => ({...m, metal: '#B76E79'}));
      if(res.data.params.material.toLowerCase().includes('gold')) setMaterials(m => ({...m, metal: '#FFD700'}));
    } catch (err) {
      console.error("Upload failed", err);
      alert("Backend error! Make sure main.py is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white p-8 font-sans">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tighter italic">FORGE<span className="text-blue-500">.V2</span></h1>
          <p className="text-zinc-500 text-sm mt-1">2D-to-3D Semantic Compiler</p>
        </div>
        <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-full flex items-center gap-2 transition-all font-semibold">
          <Upload size={20} />
          <span>{loading ? "Compiling..." : "Upload Blueprint"}</span>
          <input type="file" className="hidden" onChange={handleUpload} disabled={loading} />
        </label>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/50 p-2 rounded-3xl min-h-[500px] flex items-center justify-center relative">
          {loading && <div className="absolute inset-0 z-10 bg-black/80 flex items-center justify-center rounded-3xl backdrop-blur-sm animate-pulse"><p className="text-xl font-bold text-blue-400">Compiling via Trellis & SAM2...</p></div>}
          
          {data ? (
            <JewelryViewer glbBase64={data.glb_b64} faceTags={data.face_tags} materials={materials} />
          ) : (
            <div className="text-zinc-600 text-center">
              <Sparkles size={48} className="mx-auto mb-4 opacity-20" />
              <p>Upload a jewelry photo to generate the interactive model.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Smart Budget Panel */}
          <section className={`p-6 rounded-3xl border transition-colors ${isOverBudget ? 'bg-red-950/20 border-red-900/50' : 'bg-zinc-900/60 border-zinc-800'}`}>
            <h3 className="flex items-center gap-2 text-lg font-bold mb-4 text-white">
              <DollarSign size={18} className={isOverBudget ? 'text-red-400' : 'text-emerald-400'} /> 
              SMART CONSTRAINTS
            </h3>
            
            <div className="flex items-center justify-between mb-4 bg-black/50 p-3 rounded-xl border border-zinc-800">
              <span className="text-zinc-400 text-sm">Est. Cost</span>
              <span className={`text-xl font-black ${isOverBudget ? 'text-red-400' : 'text-white'}`}>${currentCost.toLocaleString()}</span>
            </div>

            <div className="mb-4">
              <input 
                type="number" 
                placeholder="Set target budget ($)" 
                className="w-full bg-black/50 border border-zinc-700 rounded-lg p-3 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                value={targetBudget}
                onChange={(e) => setTargetBudget(e.target.value)}
              />
            </div>

            {isOverBudget && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-red-400 text-sm flex items-center gap-1 mb-3"><AlertCircle size={14}/> Budget Exceeded. AI Suggestions:</p>
                <div className="space-y-2">
                  {materials.stone === '#FFFFFF' && (
                    <button onClick={() => setMaterials({...materials, stone: '#F4F4F4'})} className="w-full text-left p-3 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 rounded-lg text-sm text-red-200 transition-colors">
                      <span className="font-bold">Swap to Moissanite</span> (Saves $3,200)
                    </button>
                  )}
                  {materials.metal === '#E5E4E2' && (
                    <button onClick={() => setMaterials({...materials, metal: '#C0C0C0'})} className="w-full text-left p-3 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 rounded-lg text-sm text-red-200 transition-colors">
                      <span className="font-bold">Swap to Sterling Silver</span> (Saves $1,050)
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-3xl">
            <h3 className="flex items-center gap-2 text-lg font-bold mb-4 text-white">
              <Settings2 size={18} className="text-blue-400" /> REAL-TIME EDITOR
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Band Material</label>
                <div className="flex gap-2">
                  <button onClick={() => setMaterials({...materials, metal: '#FFD700'})} className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${materials.metal === '#FFD700' ? 'bg-[#FFD700]/20 border-[#FFD700] text-[#FFD700]' : 'bg-transparent border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>Gold</button>
                  <button onClick={() => setMaterials({...materials, metal: '#E5E4E2'})} className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${materials.metal === '#E5E4E2' ? 'bg-zinc-300/20 border-zinc-400 text-white' : 'bg-transparent border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>Plat</button>
                  <button onClick={() => setMaterials({...materials, metal: '#B76E79'})} className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${materials.metal === '#B76E79' ? 'bg-[#B76E79]/20 border-[#B76E79] text-[#B76E79]' : 'bg-transparent border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>Rose</button>
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-2 block mt-4">Center Stone</label>
                <div className="flex gap-2">
                  <button onClick={() => setMaterials({...materials, stone: '#FFFFFF'})} className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${materials.stone === '#FFFFFF' ? 'bg-white/20 border-white text-white' : 'bg-transparent border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>Diamond</button>
                  <button onClick={() => setMaterials({...materials, stone: '#0F52BA'})} className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${materials.stone === '#0F52BA' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-transparent border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>Sapphire</button>
                  <button onClick={() => setMaterials({...materials, stone: '#E0115F'})} className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${materials.stone === '#E0115F' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-transparent border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>Ruby</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;