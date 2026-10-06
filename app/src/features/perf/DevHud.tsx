/**
 * ARKH TextureLab - Performance Developer HUD (?perf=1)
 */

import React, { useEffect, useState } from 'react';
import type { TexturePoolStats } from '../../gpu/texturePool';
import type { GpuCapabilities } from '../../gpu/context';

export interface DevHudProps {
  poolStats?: TexturePoolStats | null;
  gpuCaps?: GpuCapabilities | null;
  workingRes?: number;
  passesPerFrame?: number;
}

export const DevHud: React.FC<DevHudProps> = ({
  poolStats,
  gpuCaps,
  workingRes = 1024,
  passesPerFrame = 0,
}) => {
  const [visible] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        window.location.search.includes('perf=1') ||
        sessionStorage.getItem('dev_hud') === '1'
      );
    }
    return false;
  });
  const [fps, setFps] = useState(60);
  const [longTaskCount, setLongTaskCount] = useState(0);

  // FPS meter
  useEffect(() => {
    if (!visible) return;
    let frames = 0;
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      frames++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frames * 1000) / (now - lastTime)));
        frames = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [visible]);

  // Long task observer
  useEffect(() => {
    if (!visible || typeof PerformanceObserver === 'undefined') return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        setLongTaskCount((prev) => prev + entries.length);
      });
      observer.observe({ entryTypes: ['longtask'] });
      return () => observer.disconnect();
    } catch {
      // Longtask observer might not be supported in all environments
    }
  }, [visible]);

  if (!visible) return null;

  const toMB = (bytes = 0) => (bytes / (1024 * 1024)).toFixed(1);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        zIndex: 99999,
        background: 'rgba(15, 17, 21, 0.92)',
        border: '1px solid rgba(255, 170, 0, 0.4)',
        borderRadius: 4,
        padding: '8px 12px',
        color: '#e6edf3',
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 1.5,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div style={{ color: '#ffaa00', fontWeight: 'bold', marginBottom: 4 }}>
        TEXTURELAB GPU HUD
      </div>
      <div>FPS: <span style={{ color: fps < 30 ? '#ff5555' : '#55ff55' }}>{fps}</span></div>
      <div>Long tasks (&gt;50ms): {longTaskCount}</div>
      <div>Working Res: {workingRes}px</div>
      <div>Passes / Frame: {passesPerFrame}</div>
      {poolStats && (
        <>
          <div>
            VRAM Pool: {toMB(poolStats.leasedBytes)} MB leased / {toMB(poolStats.pooledBytes)} MB cached
          </div>
          <div>Total Allocated: {toMB(poolStats.totalAllocatedBytes)} MB ({poolStats.totalCount} tex)</div>
        </>
      )}
      {gpuCaps && (
        <div style={{ marginTop: 4, borderTop: '1px solid #333', paddingTop: 4 }}>
          <div style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Renderer: {gpuCaps.renderer}
          </div>
          {gpuCaps.isSoftware && (
            <div style={{ color: '#ff5555', fontWeight: 'bold' }}>
              SOFTWARE FALLBACK (Slow)
            </div>
          )}
        </div>
      )}
    </div>
  );
};
