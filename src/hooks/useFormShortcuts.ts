import { useEffect } from 'react';

interface UseFormShortcutsOptions {
  onNew?: () => void;
  onFocusSearch?: () => void;
  onSave?: () => void;
  onAddRow?: () => void;
  extraKeys?: Record<string, () => void>;
  enabled?: boolean;
}

/**
 * Global keyboard shortcuts hook with capture-phase event interception.
 * Prevents native browser actions like F1 (Help/Support page) and F5 (Browser reload),
 * reliably routing them to form actions instead.
 */
export function useFormShortcuts({
  onNew,
  onFocusSearch,
  onSave,
  onAddRow,
  extraKeys,
  enabled = true,
}: UseFormShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    // Suppress Edge / Windows help event for F1
    const handleHelp = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if Ctrl or Meta (Cmd) is pressed, except specific shortcuts
      if (e.ctrlKey || e.metaKey) return;

      // Prevent holding Enter on a focused Save/Submit button from firing repeated clicks
      if (e.key === 'Enter' && e.repeat) {
        const active = document.activeElement as HTMLElement | null;
        if (active?.closest?.('button[data-action="save"], .form-save-btn, button[type="submit"]')) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // F1, Alt+N, or Insert (when onNew is provided without onAddRow, e.g. listing pages) -> New
      if (e.key === 'F1' || (e.altKey && e.key.toLowerCase() === 'n') || (e.key === 'Insert' && onNew && !onAddRow)) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) {
          onNew?.();
        }
        return;
      }

      // F2 -> Search / Party / Item focus
      if (e.key === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) {
          onFocusSearch?.();
        }
        return;
      }

      // F5, F8, or Alt+S -> Save
      if (e.key === 'F5' || e.key === 'F8' || (e.altKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) {
          onSave?.();
        }
        return;
      }

      // Insert or Alt+R -> Add Row
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) {
          onAddRow?.();
        }
        return;
      }

      // Extra custom keys
      if (extraKeys && extraKeys[e.key]) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) {
          extraKeys[e.key]();
        }
        return;
      }
    };

    // Use capture: true so we intercept F1 and F5 BEFORE browser default handlers run!
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('help', handleHelp, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('help', handleHelp, { capture: true });
    };
  }, [onNew, onFocusSearch, onSave, onAddRow, extraKeys, enabled]);
}

export default useFormShortcuts;
