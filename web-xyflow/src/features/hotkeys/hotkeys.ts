import { useEffect } from 'react';

export interface KeyboardLikeEvent {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  target?: {
    tagName?: string;
    isContentEditable?: boolean;
    closest?: (selector: string) => unknown;
  } | null;
  preventDefault?: () => void;
}

export interface KeyBinding {
  id: string;
  chord: string; // e.g. 's', 'ctrl+s', 'ctrl+shift+z', 'tab', 'delete', 'f', '?'
  scope?: 'global' | 'canvas';
  handler: (e: KeyboardLikeEvent) => void;
  description?: string;
}

export interface HotkeyContext {
  isModalOpen?: boolean;
}

// Chords strictly reserved for system, project, clipboard, and browser commands.
// These chords must never spawn nodes or trigger canvas actions inadvertently.
const RESERVED_LETTERS = new Set([
  's', 'o', 'n', 'w', 'p', 'q', 'r', 'f', 'k', 'c', 'v', 'x', 'z', 'y', 'a', 'd', 'e'
]);

/**
 * Normalizes keyboard event key/code into a canonical character.
 * Maps non-US layouts via event.code (e.g. 'KeyS' -> 's', 'Digit1' -> '1').
 */
export function getCanonicalKey(e: KeyboardLikeEvent): string {
  const key = (e.key || '').toLowerCase();

  // If code indicates a standard letter or digit and key is non-latin/special, prefer code
  if (e.code && e.code.startsWith('Key') && e.code.length === 4) {
    const letterFromCode = e.code.slice(3).toLowerCase();
    // If the key is not ASCII a-z, use letter from code
    if (!/^[a-z]$/.test(key)) {
      return letterFromCode;
    }
  }

  if (e.code && e.code.startsWith('Digit') && e.code.length === 6) {
    const digitFromCode = e.code.slice(5);
    if (!/^[0-9]$/.test(key)) {
      return digitFromCode;
    }
  }

  return key;
}

/**
 * Checks whether an event represents a reserved chord (e.g. Ctrl+S, Shift+P).
 */
export function isReservedChord(e: KeyboardLikeEvent): boolean {
  const hasModifier = !!(e.ctrlKey || e.metaKey || e.altKey);
  const canonical = getCanonicalKey(e);

  if ((e.ctrlKey || e.metaKey) && RESERVED_LETTERS.has(canonical)) {
    return true;
  }

  if (e.shiftKey && hasModifier && RESERVED_LETTERS.has(canonical)) {
    return true;
  }

  return false;
}

/**
 * Builds the canonical chord string from a keyboard event.
 * e.g. "ctrl+shift+z", "ctrl+s", "s", "tab", "delete"
 */
export function getChordString(e: KeyboardLikeEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey && e.key !== '?' && !parts.length) {
    // only include 'shift' if it's not a standalone shifted character like '?'
    parts.push('shift');
  } else if (e.shiftKey && parts.length > 0) {
    parts.push('shift');
  }

  const canonical = getCanonicalKey(e);
  parts.push(canonical);

  return parts.join('+');
}

/**
 * Checks if target element is an interactive input or inside an active modal dialog.
 */
export function shouldIgnoreEvent(e: KeyboardLikeEvent, context?: HotkeyContext): boolean {
  if (context?.isModalOpen) {
    return true;
  }

  const target = e.target;
  if (!target) return false;

  const tag = (target.tagName || '').toUpperCase();
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  if (typeof target.closest === 'function') {
    if (target.closest('[contenteditable="true"]')) return true;
    if (target.closest('[role="dialog"]') || target.closest('.modal') || target.closest('[data-modal]')) {
      return true;
    }
  }

  return false;
}

/**
 * Dispatches a keyboard event against a list of keybindings.
 * Returns true if a binding matched and was executed.
 */
export function dispatchHotkey(
  e: KeyboardLikeEvent,
  bindings: KeyBinding[],
  context?: HotkeyContext
): boolean {
  if (shouldIgnoreEvent(e, context)) {
    return false;
  }

  const hasModifier = !!(e.ctrlKey || e.metaKey || e.altKey);
  const canonicalKey = getCanonicalKey(e);
  const chord = getChordString(e);

  for (const binding of bindings) {
    const bindingChord = binding.chord.toLowerCase();

    // Spawn / single-character bindings must NEVER fire when modifiers are held
    const isSingleCharSpawn = /^[a-z0-9]$/.test(bindingChord);
    if (isSingleCharSpawn && hasModifier) {
      continue;
    }

    if (bindingChord === chord || (bindingChord === canonicalKey && !hasModifier)) {
      binding.handler(e);
      return true;
    }
  }

  return false;
}

/**
 * Hook to attach a declarative hotkey table to the window with cleanup.
 */
export function useHotkeys(bindings: KeyBinding[], context?: HotkeyContext): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      dispatchHotkey(e as unknown as KeyboardLikeEvent, bindings, context);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bindings, context]);
}
