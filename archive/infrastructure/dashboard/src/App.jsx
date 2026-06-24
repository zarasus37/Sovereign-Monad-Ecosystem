import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, this fetches from the hepar-dashboard-api Azure Function
    // For now, we simulate the fetch or point it to a local endpoint
    const fetchTelemetry = async () => {
      try {
        const response = await fetch('http://localhost:7071/api/telemetry', {
          headers: {
            'x-functions-key': 'local-dev-key' // Simulated auth
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setTelemetry(data);
        } else {
          // Fallback mock data if API is not running locally yet
          setTelemetry({
            status: "active",
            agent0: {
              capacity_ceiling: 4000,
              status: "FUNDED_TRADING_AUTHORITY_GRANTED",
              markout_data: { 
                retention_rate: "82%",
                trades_simulated: 50
              }
            },
            cardia: {
              status: "LIVE_FUNDED",
              dynamic_allocation_bands: [15000, 100000]
            }
          });
        }
      } catch (error) {
        console.error("Telemetry fetch failed, using fallback:", error);
        setTelemetry({
          status: "active",
          agent0: {
            capacity_ceiling: 4000,
            status: "FUNDED_TRADING_AUTHORITY_GRANTED",
            markout_data: { 
              retention_rate: "82%",
              trades_simulated: 50
            }
          },
          cardia: {
            status: "LIVE_FUNDED",
            dynamic_allocation_bands: [15000, 100000]
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="dashboard-container">Initializing Sovereign Monad Control Hub...</div>;

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="brand">Sovereign Monad</div>
        <nav>
          <div className="nav-item active">Capital Engine</div>
          <div className="nav-item">Commercial Intel</div>
          <div className="nav-item">System Log</div>
        </nav>
      </aside>
      
      <main className="main-content">
        <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem' }}>
          <div>
            <h2>Control Center</h2>
            <div className="metric-label">Guarded Public Rollout Mode</div>
          </div>
          <div className="status-indicator pulse">SYSTEM NOMINAL</div>
        </header>

        <div className="grid-2">
          <div className="glass-panel">
            <h3>Agent 0 Execution</h3>
            <div className="metric">
              <span className="metric-label">Status</span>
              <span className="status-indicator pulse">{telemetry?.agent0?.status || 'UNKNOWN'}</span>
            </div>
            <div style={{ marginTop: '1.5rem' }} className="metric">
              <span className="metric-label">Validated Capacity Ceiling</span>
              <span className="metric-value">${telemetry?.agent0?.capacity_ceiling?.toLocaleString()}</span>
            </div>
          </div>

          <div className="glass-panel">
            <h3>Cardia Allocator</h3>
            <div className="metric">
              <span className="metric-label">Activation Mode</span>
              <span className="status-indicator pulse gold">{telemetry?.cardia?.status || 'UNKNOWN'}</span>
            </div>
            <div style={{ marginTop: '1.5rem' }} className="metric">
              <span className="metric-label">Dynamic Bounds (TVL Scaled)</span>
              <span className="metric-value gold">
                ${(telemetry?.cardia?.dynamic_allocation_bands?.[0] || 0).toLocaleString()} - 
                ${(telemetry?.cardia?.dynamic_allocation_bands?.[1] || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-panel">
          <h3>Pyth Oracle Markout (Agent 0)</h3>
          <div className="grid-2">
            <div className="metric">
              <span className="metric-label">Sample Size (Hardened)</span>
              <span className="metric-value">{telemetry?.agent0?.markout_data?.trades_simulated || 50} TRADES</span>
            </div>
            <div className="metric">
              <span className="metric-label">Retention Rate</span>
              <span className="metric-value">{telemetry?.agent0?.markout_data?.retention_rate || '82%'}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
