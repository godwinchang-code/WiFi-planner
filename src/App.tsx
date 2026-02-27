import { useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PlannerCanvas } from './components/Canvas/PlannerCanvas';
import type { CoverageStats } from './utils/signalSimulation';

export default function App() {
  const [coverageStats, setCoverageStats] = useState<CoverageStats | null>(null);

  const handleStatsUpdate = useCallback((stats: CoverageStats) => {
    setCoverageStats(stats);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar stats={coverageStats} />
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }} className="canvas-container">
        <PlannerCanvas onStatsUpdate={handleStatsUpdate} />
      </main>
    </div>
  );
}
