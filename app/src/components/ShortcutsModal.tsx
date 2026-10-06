import React, { useMemo } from 'react';
import { Sparkles, Sliders, Layout, MousePointer } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Kbd } from '../ui/Kbd';
import { getAllShortcuts } from './shortcutsData';

export interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const allShortcuts = useMemo(() => getAllShortcuts(), []);

  const spawnShortcuts = useMemo(
    () => allShortcuts.filter((s) => s.category === 'spawn'),
    [allShortcuts]
  );
  const graphShortcuts = useMemo(
    () => allShortcuts.filter((s) => s.category === 'graph'),
    [allShortcuts]
  );
  const sliderShortcuts = useMemo(
    () => allShortcuts.filter((s) => s.category === 'slider'),
    [allShortcuts]
  );
  const viewportShortcuts = useMemo(
    () => allShortcuts.filter((s) => s.category === 'viewport'),
    [allShortcuts]
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts & Gestures"
      width={720}
    >
      <div className="tl-shortcuts">
        {/* Registry Quick Keys */}
        <div className="tl-shortcuts__section">
          <div className="tl-shortcuts__header">
            <Sparkles size={12} />
            <span>Node Quick Keys (Auto-Generated from Registry)</span>
          </div>
          <div className="tl-shortcuts__grid">
            {spawnShortcuts.map((s, idx) => (
              <div key={idx} className="tl-shortcuts__row">
                <span className="tl-shortcuts__desc">{s.description}</span>
                <div className="tl-shortcuts__keys">
                  {s.tag && <span className="tl-badge">{s.tag}</span>}
                  {s.keys.map((k, kIdx) => (
                    <Kbd key={kIdx}>{k}</Kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Graph & Workflow */}
        <div className="tl-shortcuts__section">
          <div className="tl-shortcuts__header">
            <Layout size={12} />
            <span>Graph & Workflow Chords</span>
          </div>
          <div className="tl-shortcuts__grid">
            {graphShortcuts.map((s, idx) => (
              <div key={idx} className="tl-shortcuts__row">
                <span className="tl-shortcuts__desc">{s.description}</span>
                <div className="tl-shortcuts__keys">
                  {s.tag && <span className="tl-badge">{s.tag}</span>}
                  {s.keys.map((k, kIdx) => (
                    <Kbd key={kIdx}>{k}</Kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DCC Sliders */}
        <div className="tl-shortcuts__section">
          <div className="tl-shortcuts__header">
            <Sliders size={12} />
            <span>DCC Parameter & Slider Controls</span>
          </div>
          <div className="tl-shortcuts__grid">
            {sliderShortcuts.map((s, idx) => (
              <div key={idx} className="tl-shortcuts__row">
                <span className="tl-shortcuts__desc">{s.description}</span>
                <div className="tl-shortcuts__keys">
                  {s.tag && <span className="tl-badge">{s.tag}</span>}
                  {s.keys.map((k, kIdx) => (
                    <Kbd key={kIdx}>{k}</Kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Viewport */}
        <div className="tl-shortcuts__section">
          <div className="tl-shortcuts__header">
            <MousePointer size={12} />
            <span>Viewport Navigation & Canvas Gestures</span>
          </div>
          <div className="tl-shortcuts__grid">
            {viewportShortcuts.map((s, idx) => (
              <div key={idx} className="tl-shortcuts__row">
                <span className="tl-shortcuts__desc">{s.description}</span>
                <div className="tl-shortcuts__keys">
                  {s.tag && <span className="tl-badge">{s.tag}</span>}
                  {s.keys.map((k, kIdx) => (
                    <Kbd key={kIdx}>{k}</Kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
};
