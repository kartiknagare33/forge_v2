import React, { useState } from 'react';
import Viewer from './components/Viewer';

export default function App() {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ringParams, setRingParams] = useState(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setLoading(true);
    setRingParams(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Make sure this matches your FastAPI backend port
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      if (data.success) {
        setRingParams(data.params);
      } else {
        alert('Failed to analyze image.');
      }
    } catch (error) {
      console.error('API Error:', error);
      alert('Server error. Is the Python backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f11', color: '#ffffff', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      
      {/* HEADER */}
      <header style={{ borderBottom: '1px solid #333', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '-0.05em' }}>FORGE <span style={{ color: '#FFD700' }}>AI</span></h1>
        <p style={{ margin: '0.5rem 0 0 0', color: '#888' }}>Intelligent 2D-to-3D Jewelry Compilation</p>
      </header>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* LEFT COLUMN: Controls & AI Data */}
        <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Upload Section */}
          <div style={{ background: '#1a1a1e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #333' }}>
            <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}>1. Upload Blueprint</h2>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload} 
              style={{ display: 'block', width: '100%', marginBottom: '1rem', color: '#aaa' }}
            />
            {imagePreview && (
              <img 
                src={imagePreview} 
                alt="Blueprint" 
                style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '8px', background: '#000' }} 
              />
            )}
          </div>

          {/* AI Extraction Data */}
          <div style={{ background: '#1a1a1e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #333', flexGrow: 1 }}>
            <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}>2. AI Extracted Specs</h2>
            
            {loading && (
              <div style={{ color: '#FFD700', padding: '2rem 0', textAlign: 'center', fontWeight: 'bold' }}>
                Gemini Vision Analyzing Geometry...
              </div>
            )}

            {!loading && ringParams && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  {Object.entries(ringParams).map(([key, value]) => (
                    <div key={key} style={{ background: '#000', padding: '0.8rem', borderRadius: '6px', border: '1px solid #222' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>{key.replace('_', ' ')}</div>
                      <div style={{ fontSize: '1rem', fontWeight: '500', color: '#fff', textTransform: 'capitalize' }}>{value.toString().replace('_', ' ')}</div>
                    </div>
                  ))}
                </div>
                
                <h3 style={{ fontSize: '0.9rem', color: '#888' }}>Raw JSON Payload:</h3>
                <pre style={{ background: '#000', padding: '1rem', borderRadius: '6px', overflowX: 'auto', color: '#4CAF50', fontSize: '0.85rem', border: '1px solid #222' }}>
                  {JSON.stringify(ringParams, null, 2)}
                </pre>
              </div>
            )}

            {!loading && !ringParams && (
              <p style={{ color: '#666' }}>Upload an image to see the AI brain in action.</p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: 3D Render */}
        <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#1a1a1e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #333', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '1rem' }}>3. Live 3D Compilation</h2>
            
            {/* The Viewer Component we built earlier */}
            <div style={{ flexGrow: 1, borderRadius: '8px', overflow: 'hidden', minHeight: '500px', border: '1px solid #333' }}>
              <Viewer params={ringParams} />
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}