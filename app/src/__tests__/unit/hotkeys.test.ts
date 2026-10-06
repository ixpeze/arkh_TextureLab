import { describe, it, expect, vi } from 'vitest';
import { dispatchHotkey, isReservedChord, type KeyBinding, type KeyboardLikeEvent } from '../../features/hotkeys/hotkeys';

describe('P1-A2: Hotkey System & Dispatcher (TC-110..115)', () => {
  const spawnSplitter = vi.fn();
  const spawnTextureInput = vi.fn();
  const autoWire = vi.fn();
  const saveProject = vi.fn();

  const bindings: KeyBinding[] = [
    { id: 'spawn-splitter', chord: 's', handler: spawnSplitter },
    { id: 'spawn-texture-input', chord: 't', handler: spawnTextureInput },
    { id: 'autowire', chord: 'w', handler: autoWire },
    { id: 'save', chord: 'ctrl+s', handler: saveProject },
  ];

  it('TC-110: "s" plain triggers spawn Splitter', () => {
    const event: KeyboardLikeEvent = {
      key: 's',
      code: 'KeyS',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
    };

    const handled = dispatchHotkey(event, bindings, { isModalOpen: false });
    expect(handled).toBe(true);
    expect(spawnSplitter).toHaveBeenCalledTimes(1);
  });

  it('TC-111: Ctrl+S does NOT spawn Splitter (reserved chord)', () => {
    spawnSplitter.mockClear();
    saveProject.mockClear();

    const event: KeyboardLikeEvent = {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
    };

    dispatchHotkey(event, bindings, { isModalOpen: false });
    expect(spawnSplitter).not.toHaveBeenCalled();
    // Also verify reserved check
    expect(isReservedChord(event)).toBe(true);
  });

  it('TC-112: typing "s" in a text input produces no action', () => {
    spawnSplitter.mockClear();

    const event: KeyboardLikeEvent = {
      key: 's',
      code: 'KeyS',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: { tagName: 'INPUT' },
      preventDefault: vi.fn(),
    };

    const handled = dispatchHotkey(event, bindings, { isModalOpen: false });
    expect(handled).toBe(false);
    expect(spawnSplitter).not.toHaveBeenCalled();
  });

  it('TC-113: typing in contentEditable produces no action', () => {
    spawnSplitter.mockClear();

    const event: KeyboardLikeEvent = {
      key: 's',
      code: 'KeyS',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: { tagName: 'DIV', isContentEditable: true },
      preventDefault: vi.fn(),
    };

    const handled = dispatchHotkey(event, bindings, { isModalOpen: false });
    expect(handled).toBe(false);
    expect(spawnSplitter).not.toHaveBeenCalled();
  });

  it('TC-114: modal open + "T" produces no action', () => {
    spawnTextureInput.mockClear();

    const event: KeyboardLikeEvent = {
      key: 't',
      code: 'KeyT',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
    };

    const handled = dispatchHotkey(event, bindings, { isModalOpen: true });
    expect(handled).toBe(false);
    expect(spawnTextureInput).not.toHaveBeenCalled();
  });

  it('TC-115: Ctrl+W does not trigger autowire', () => {
    autoWire.mockClear();

    const event: KeyboardLikeEvent = {
      key: 'w',
      code: 'KeyW',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
    };

    dispatchHotkey(event, bindings, { isModalOpen: false });
    expect(autoWire).not.toHaveBeenCalled();
    expect(isReservedChord(event)).toBe(true);
  });

  it('Edge case: non-US layout (code: KeyS, key: "ы") triggers "s" hotkey', () => {
    spawnSplitter.mockClear();

    const event: KeyboardLikeEvent = {
      key: 'ы',
      code: 'KeyS',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
    };

    const handled = dispatchHotkey(event, bindings, { isModalOpen: false });
    expect(handled).toBe(true);
    expect(spawnSplitter).toHaveBeenCalledTimes(1);
  });
});
