import { useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PlannerCanvas } from './components/Canvas/PlannerCanvas';
import { FloorTabs } from './components/Canvas/FloorTabs';
import type { CoverageStats } from './utils/signalSimulation';

export default function App() {
  const [coverageStats, setCoverageStats] = useState<CoverageStats | null>(null);

  const handleStatsUpdate = useCallback((stats: CoverageStats) => {
    setCoverageStats(stats);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar stats={coverageStats} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <FloorTabs />
        <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }} className="canvas-container">
          <PlannerCanvas onStatsUpdate={handleStatsUpdate} />
        </main>
      </div>
    </div>
  );
}
