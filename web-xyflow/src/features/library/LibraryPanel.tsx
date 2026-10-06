// src/features/library/LibraryPanel.tsx
import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Layers, Sparkles } from 'lucide-react';
import { nodeRegistry, type NodeDef } from '../../nodes/registry';
import { useAppStore } from '../../store/useAppStore';
import { Kbd } from '../../ui/Kbd';

interface LibraryPanelProps {
  onSpawnNode: (typeKey: string) => void;
}

const RECENT_KEY = 'texturelab_recent_nodes';

export const LibraryPanel: React.FC<LibraryPanelProps> = ({ onSpawnNode }) => {
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [recentNodeKeys, setRecentNodeKeys] = useState<string[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(RECENT_KEY) : null;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const showLabsNodes = useAppStore((s) => s.showLabsNodes);

  const recordRecent = (key: string) => {
    try {
      const updated = [key, ...recentNodeKeys.filter((k) => k !== key)].slice(0, 5);
      setRecentNodeKeys(updated);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleSpawn = (typeKey: string) => {
    recordRecent(typeKey);
    onSpawnNode(typeKey);
  };

  const handleDragStart = (e: React.DragEvent, nodeKey: string) => {
    recordRecent(nodeKey);
    e.dataTransfer.setData('application/reactflow', nodeKey);
    e.dataTransfer.setData('text/plain', nodeKey);
    e.dataTransfer.effectAllowed = 'all';
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Group all registry nodes by category (Input, Channel, Math, Adjust, Blend, Output, Utility, Labs)
  const allDefs = useMemo(() => nodeRegistry.getAll(), []);

  const categories = useMemo(() => {
    type DefType = ReturnType<typeof nodeRegistry.getAll>[number];
    const map: Record<string, DefType[]> = {
      Input: [],
      Channel: [],
      Math: [],
      Adjust: [],
      Blend: [],
      Output: [],
      Utility: [],
    };
    if (showLabsNodes) {
      map.Labs = [];
    }

    const query = search.trim().toLowerCase();

    for (const def of allDefs) {
      if (def.category === 'Labs' && !showLabsNodes) continue;

      const matchesSearch =
        !query ||
        def.label.toLowerCase().includes(query) ||
        def.type.toLowerCase().includes(query) ||
        (def.description && def.description.toLowerCase().includes(query)) ||
        (def.hotkey && def.hotkey.toLowerCase() === query);

      if (matchesSearch) {
        if (!map[def.category]) {
          map[def.category] = [];
        }
        map[def.category].push(def);
      }
    }

    return map;
  }, [allDefs, search, showLabsNodes]);

  const recentDefs = useMemo(() => {
    return recentNodeKeys
      .map((k) => nodeRegistry.get(k))
      .filter((d): d is NodeDef => Boolean(d));
  }, [recentNodeKeys]);

  return (
    <div className="tl-library-panel" role="region" aria-label="Node Library">
      {/* Search Input */}
      <div className="tl-library-search">
        <Search size={13} className="tl-library-search__icon" />
        <input
          type="text"
          className="tl-library-search__input nodrag"
          placeholder="Search nodes (e.g. Splitter, Add, Levels)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search nodes"
        />
      </div>

      <div className="tl-library-content">
        {/* Recently Used Section */}
        {!search && recentDefs.length > 0 && (
          <div className="tl-library-section">
            <div className="tl-library-cat-header">
              <Sparkles size={11} color="var(--accent)" />
              <span>Recently Used</span>
            </div>
            <div className="tl-library-items">
              {recentDefs.map((def) => (
                <div
                  key={`recent-${def.type}`}
                  className="tl-library-item nodrag"
                  draggable
                  onDragStart={(e) => handleDragStart(e, def.type)}
                  onClick={() => handleSpawn(def.type)}
                  title={`${def.description || def.label} (Click or drag)`}
                >
                  <span className="tl-library-item__title">{def.label}</span>
                  {def.hotkey && <Kbd>{def.hotkey.toUpperCase()}</Kbd>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categorized Nodes */}
        {Object.entries(categories).map(([catName, defs]) => {
          if (defs.length === 0) return null;
          const isCollapsed = Boolean(collapsedCategories[catName]);

          return (
            <div key={catName} className="tl-library-section">
              <button
                type="button"
                className="tl-library-cat-btn"
                onClick={() => toggleCategory(catName)}
                aria-expanded={!isCollapsed}
              >
                <div className="tl-library-cat-title">
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <Layers size={11} color="var(--accent)" />
                  <span>{catName}</span>
                </div>
                <span className="tl-library-cat-count">{defs.length}</span>
              </button>

              {!isCollapsed && (
                <div className="tl-library-items">
                  {defs.map((def) => (
                    <div
                      key={def.type}
                      className="tl-library-item nodrag"
                      draggable
                      onDragStart={(e) => handleDragStart(e, def.type)}
                      onClick={() => handleSpawn(def.type)}
                      title={`${def.description || def.label} (Click to spawn, drag to canvas)`}
                    >
                      <div className="tl-library-item__info">
                        <span className="tl-library-item__title">{def.label}</span>
                        {def.description && (
                          <span className="tl-library-item__desc">{def.description}</span>
                        )}
                      </div>
                      {def.hotkey && <Kbd>{def.hotkey.toUpperCase()}</Kbd>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
