// src/ui/UiKitShowcase.tsx
import React, { useState } from 'react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Slider } from './Slider';
import { NumberField } from './NumberField';
import { Select } from './Select';
import { Checkbox } from './Checkbox';
import { Segmented } from './Segmented';
import { Panel } from './Panel';
import { Dialog } from './Dialog';
import { Tooltip } from './Tooltip';
import { Kbd } from './Kbd';
import { useToast } from './toastContext';
import { Sparkles, Info, Settings, HelpCircle, Layers } from 'lucide-react';

export const UiKitShowcase: React.FC = () => {
  const [sliderVal, setSliderVal] = useState(0.42);
  const [numVal, setNumVal] = useState(1024);
  const [selectVal, setSelectVal] = useState('png');
  const [checked, setChecked] = useState(true);
  const [segVal, setSegVal] = useState('RGBA');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { addToast } = useToast();

  return (
    <div className="tl-ui-kit-showcase">
      <Panel
        title="Graphite Blueprint Component Showcase (/ui-kit)"
        icon={<Sparkles size={14} color="var(--accent)" />}
      >
        <div className="tl-ui-kit-grid">
          {/* Section: Buttons */}
          <div className="tl-ui-kit-card">
            <h3 className="tl-ui-kit-title">Buttons & Icon Buttons</h3>
            <div className="tl-ui-kit-row">
              <Button variant="primary" icon={<Sparkles size={12} />}>
                Primary Amber
              </Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="ghost">Ghost</Button>
              <Button size="sm">Small</Button>
            </div>
            <div className="tl-ui-kit-row">
              <IconButton icon={<Settings size={14} />} title="Settings (Ctrl+,)" />
              <IconButton icon={<HelpCircle size={14} />} title="Help" active />
              <IconButton icon={<Layers size={14} />} title="Layers" disabled />
            </div>
          </div>

          {/* Section: Sliders & Numbers */}
          <div className="tl-ui-kit-card">
            <h3 className="tl-ui-kit-title">DCC Scrub Slider & NumberField</h3>
            <Slider
              label="Roughness"
              value={sliderVal}
              min={0}
              max={1}
              step={0.01}
              onChange={setSliderVal}
            />
            <div className="tl-ui-kit-row">
              <span className="tl-slider__label">Target Dim:</span>
              <NumberField value={numVal} min={16} max={8192} step={16} onChange={setNumVal} />
            </div>
          </div>

          {/* Section: Select, Checkbox & Segmented */}
          <div className="tl-ui-kit-card">
            <h3 className="tl-ui-kit-title">Inputs & Controls</h3>
            <Select
              value={selectVal}
              options={[
                { value: 'png', label: 'PNG 8-bit / 16-bit' },
                { value: 'tga', label: 'TGA 24-bit / 32-bit' },
                { value: 'jpg', label: 'JPEG (Lossy)' },
              ]}
              onChange={(e) => setSelectVal(e.target.value)}
            />
            <Checkbox
              label="Preserve aspect ratio on non-square export"
              checked={checked}
              onCheckedChange={(c) => setChecked(c)}
            />
            <Segmented
              items={[
                { value: 'RGBA', label: 'RGBA' },
                { value: 'R', label: 'R' },
                { value: 'G', label: 'G' },
                { value: 'B', label: 'B' },
                { value: 'A', label: 'A' },
              ]}
              value={segVal}
              onChange={setSegVal}
            />
          </div>

          {/* Section: Dialogs, Tooltips, Kbd & Toasts */}
          <div className="tl-ui-kit-card">
            <h3 className="tl-ui-kit-title">Dialog, Tooltip, Kbd & Toasts</h3>
            <div className="tl-ui-kit-row">
              <Tooltip content="Spawn Channel Splitter node" badge="S">
                <Button onClick={() => setDialogOpen(true)}>Open Modal Dialog</Button>
              </Tooltip>

              <Button
                variant="secondary"
                icon={<Info size={12} />}
                onClick={() =>
                  addToast({
                    type: 'success',
                    message: 'Exported 4 textures to G:\\tex\\out',
                    action: { label: 'Show in folder', onClick: () => {} },
                  })
                }
              >
                Trigger Toast
              </Button>

              <div className="tl-ui-kit-row">
                <span>Shortcut:</span>
                <Kbd>Ctrl</Kbd> + <Kbd>Alt</Kbd> + <Kbd>B</Kbd>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Dialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Sample Accessible Dialog"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setDialogOpen(false)}>
              Done
            </Button>
          </>
        }
      >
        <p>This dialog features focus trapping, Escape key dismissal, and WCAG AA contrast.</p>
      </Dialog>
    </div>
  );
};
