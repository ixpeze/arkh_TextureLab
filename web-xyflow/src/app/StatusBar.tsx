import React from 'react';
import { Maximize2 } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';

export interface StatusBarProps {
  statusMessage: string;
  isBusy?: boolean;
  workingRes?: string;
  gpuName?: string;
  vramText?: string;
  zoom: number;
  nodeCount: number;
  edgeCount: number;
  onFitView: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  statusMessage,
  isBusy = false,
  workingRes = '2048 × 2048',
  gpuName = 'WebGL2 GPU',
  vramText,
  zoom,
  nodeCount,
  edgeCount,
  onFitView,
}) => {
  const zoomPct = Math.round(zoom * 100);

  return (
    <footer className="tl-statusbar" role="status" aria-label="Status Bar">
      <div className="tl-statusbar__left">
        <div className="tl-statusbar__item">
          <div
            className={`tl-statusbar__dot ${isBusy ? 'tl-statusbar__dot--busy' : 'tl-statusbar__dot--ready'}`}
            aria-hidden="true"
          />
          <span className="tl-statusbar__msg" title={statusMessage}>
            {statusMessage || 'Ready'}
          </span>
        </div>

        <div className="tl-statusbar__divider" aria-hidden="true" />

        <Tooltip content="Current graph working resolution">
          <div className="tl-statusbar__item">
            <span className="tl-text-muted">RES:</span>
            <span>{workingRes}</span>
          </div>
        </Tooltip>

        <div className="tl-statusbar__divider" aria-hidden="true" />

        <Tooltip content={`Active Graphics Hardware: ${gpuName}`}>
          <div className="tl-statusbar__item">
            <span className="tl-text-muted">GPU:</span>
            <span className="tl-statusbar__msg">
              {gpuName}
            </span>
          </div>
        </Tooltip>

        {vramText && (
          <>
            <div className="tl-statusbar__divider" aria-hidden="true" />
            <Tooltip content="Texture Pool VRAM Usage / Budget">
              <div className="tl-statusbar__item">
                <span className="tl-text-muted">VRAM:</span>
                <span>{vramText}</span>
              </div>
            </Tooltip>
          </>
        )}
      </div>

      <div className="tl-statusbar__right">
        <div className="tl-statusbar__item">
          <span>{nodeCount} Nodes</span>
          <span className="tl-text-muted">·</span>
          <span>{edgeCount} Wires</span>
        </div>

        <div className="tl-statusbar__divider" aria-hidden="true" />

        <Tooltip content="Reset View to 100% (Fit Canvas, F)">
          <div className="tl-statusbar__item">
            <IconButton
              icon={<Maximize2 size={12} />}
              label={`Reset Zoom: ${zoomPct}%`}
              size="sm"
              variant="ghost"
              onClick={onFitView}
            />
            <button
              type="button"
              className="tl-btn tl-btn--ghost tl-btn--sm"
              onClick={onFitView}
            >
              {zoomPct}%
            </button>
          </div>
        </Tooltip>
      </div>
    </footer>
  );
};
