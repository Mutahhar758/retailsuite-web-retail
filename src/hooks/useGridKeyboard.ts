import { useRef, useCallback, useEffect } from 'react';

/**
 * Column keys that are candidates for keyboard focus in the Enter navigation flow.
 * - rate: auto-filled in sale supply, excluded from Enter by default
 * - unit: reachable by arrow keys only, excluded from Enter
 * - addLess: excluded from Enter/Tab, reachable by arrow keys/mouse
 * - discount: excluded from Enter/Tab, reachable by arrow keys/mouse
 * - amount: read-only display
 */
export type GridColKey =
  | 'customerId'
  | 'qty'
  | 'secQty'
  | 'packQty'
  | 'packing'
  | 'secRate';

export type ArrowColKey = GridColKey | 'unit' | 'rate' | 'discount' | 'addLess' | 'carriage';

export interface UseGridKeyboardOptions<TColKey extends string = string> {
  rowCount: number;
  /** Custom columns for Enter navigation. If omitted, uses default customerId/qty columns for backwards-compatibility. */
  enterCols?: TColKey[];
  /** Custom columns for Arrow Left/Right navigation. Defaults to enterCols or arrow cols. */
  arrowCols?: TColKey[];
  /** First column to focus when moving to next row or adding new row. Defaults to enterCols[0] or 'customerId'. */
  firstColKey?: TColKey;
  hasSecondaryQty?: boolean;
  hasVariablePackFeature?: boolean;
  /** Called when Enter is pressed on the last field of the last row. */
  onAddRow: () => void;
  /**
   * rowCount changes when a new row is added. Provide the index of the row
   * that should receive focus after the state update (used by addRow auto-focus).
   */
  pendingFocusRef?: React.MutableRefObject<{ rowIdx: number; colKey: TColKey | any } | null>;
  /** Check if a given row has an item or account selected. */
  isRowValid?: (rowIdx: number) => boolean;
  /** Callback to trigger or focus save. */
  onSave?: () => void;
}

export interface UseGridKeyboardReturn<TColKey extends string = string> {
  /** Get (or lazily create) the ref for a given cell. Pass this as `ref` prop. */
  getCellRef: (rowIdx: number, colKey: TColKey | string) => React.RefObject<any>;
  /** Attach this as `onKeyDown` to every focusable grid cell. */
  handleCellKeyDown: (rowIdx: number, colKey: TColKey | string, e: React.KeyboardEvent) => void;
  /**
   * Call this AFTER state has been updated with the new row.
   * Schedules focus on the specified cell of the given row index.
   */
  focusCell: (rowIdx: number, colKey: TColKey | string) => void;
}

/**
 * Builds default columns for Sale Supply backward compatibility.
 */
function buildEnterColumns(
  hasSecondaryQty?: boolean,
  hasVariablePackFeature?: boolean,
): string[] {
  const cols: string[] = ['customerId', 'qty'];

  if (hasSecondaryQty || hasVariablePackFeature) {
    cols.push('secQty');
  }
  if (hasVariablePackFeature) {
    cols.push('packQty', 'packing');
  }
  if (hasSecondaryQty || hasVariablePackFeature) {
    cols.push('secRate');
  }

  return cols;
}

function buildArrowColumns(
  hasSecondaryQty?: boolean,
  hasVariablePackFeature?: boolean,
): string[] {
  const cols: string[] = ['customerId'];

  if (!hasSecondaryQty) {
    cols.push('unit');
  }

  cols.push('qty');

  if (hasSecondaryQty || hasVariablePackFeature) {
    cols.push('secQty');
  }
  if (hasVariablePackFeature) {
    cols.push('packQty', 'packing');
  }

  cols.push('rate');

  if (hasSecondaryQty || hasVariablePackFeature) {
    cols.push('secRate');
  }

  cols.push('discount', 'addLess', 'carriage');
  return cols;
}

/**
 * Returns true when the keyboard event originated from inside an open
 * Ant Design Select or DatePicker popup.
 */
function isDropdownOpen(e: React.KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  const selectWrapper = target.closest('.ant-select');
  if (selectWrapper?.classList.contains('ant-select-open')) return true;

  const pickerWrapper = target.closest('.ant-picker');
  if (pickerWrapper?.classList.contains('ant-picker-focused')) {
    if (document.querySelector('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')) {
      return true;
    }
  }
  return false;
}

export function useGridKeyboard<TColKey extends string = string>({
  rowCount,
  enterCols: customEnterCols,
  arrowCols: customArrowCols,
  firstColKey,
  hasSecondaryQty,
  hasVariablePackFeature,
  onAddRow,
  pendingFocusRef,
  isRowValid,
  onSave,
}: UseGridKeyboardOptions<TColKey>): UseGridKeyboardReturn<TColKey> {
  // Ref map: "rowIdx:colKey" → RefObject
  const refsMap = useRef<Map<string, React.RefObject<any>>>(new Map());

  const enterColsRef = useRef<string[]>([]);
  const arrowColsRef = useRef<string[]>([]);

  const goToSave = useCallback(() => {
    // 1. Look for explicit button marked with data-action="save" or form-save-btn
    const saveBtn = document.querySelector<HTMLElement>('button[data-action="save"], .form-save-btn') ||
      Array.from(document.querySelectorAll<HTMLElement>('button')).find(b => {
        const t = b.textContent?.trim().toLowerCase() || '';
        return t.startsWith('save') || t === 'save';
      });

    if (saveBtn) {
      saveBtn.focus();
    } else if (onSave) {
      onSave();
    }
  }, [onSave]);

  // Recompute column lists when props change
  useEffect(() => {
    if (customEnterCols && customEnterCols.length > 0) {
      enterColsRef.current = customEnterCols;
      arrowColsRef.current = customArrowCols && customArrowCols.length > 0 ? customArrowCols : customEnterCols;
    } else {
      enterColsRef.current = buildEnterColumns(hasSecondaryQty, hasVariablePackFeature);
      arrowColsRef.current = customArrowCols || buildArrowColumns(hasSecondaryQty, hasVariablePackFeature);
    }
  }, [customEnterCols, customArrowCols, hasSecondaryQty, hasVariablePackFeature]);

  // Synchronous initial assignment
  if (customEnterCols && customEnterCols.length > 0) {
    enterColsRef.current = customEnterCols;
    arrowColsRef.current = customArrowCols && customArrowCols.length > 0 ? customArrowCols : customEnterCols;
  } else if (enterColsRef.current.length === 0) {
    enterColsRef.current = buildEnterColumns(hasSecondaryQty, hasVariablePackFeature);
    arrowColsRef.current = customArrowCols || buildArrowColumns(hasSecondaryQty, hasVariablePackFeature);
  }

  const getCellRef = useCallback((rowIdx: number, colKey: string): React.RefObject<any> => {
    const key = `${rowIdx}:${colKey}`;
    if (!refsMap.current.has(key)) {
      refsMap.current.set(key, { current: null });
    }
    return refsMap.current.get(key)!;
  }, []);

  const focusCell = useCallback((rowIdx: number, colKey: string) => {
    requestAnimationFrame(() => {
      const ref = refsMap.current.get(`${rowIdx}:${colKey}`);
      if (ref?.current) {
        if (typeof ref.current.focus === 'function') {
          ref.current.focus();
        } else if (ref.current.input && typeof ref.current.input.focus === 'function') {
          ref.current.input.focus();
        }
      }
    });
  }, []);

  // When pendingFocusRef is set (after addRow), fire the focus
  useEffect(() => {
    if (pendingFocusRef?.current) {
      const { rowIdx, colKey } = pendingFocusRef.current;
      pendingFocusRef.current = null;
      focusCell(rowIdx, colKey);
    }
  }, [rowCount, focusCell, pendingFocusRef]);

  const handleCellKeyDown = useCallback(
    (rowIdx: number, colKey: string, e: React.KeyboardEvent) => {
      const { key } = e;

      // Escape: let cell handle natively (closes dropdowns)
      if (key === 'Escape') return;

      // Enter: smart forward navigation
      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();

        const cols = enterColsRef.current;
        const colIdx = cols.indexOf(colKey);

        if (colIdx === -1) {
          // If column is not in Enter flow, do nothing
          return;
        }

        // If the user is on the last row and that row has no account or item selected:
        // do not add new row or advance through empty row, go straight to the save button!
        if (rowIdx === rowCount - 1 && isRowValid && !isRowValid(rowIdx)) {
          goToSave();
          return;
        }

        const nextColIdx = colIdx + 1;

        if (nextColIdx < cols.length) {
          // Move to next column in current row
          focusCell(rowIdx, cols[nextColIdx]);
        } else {
          // Reached end of row -> advance to next row or create one
          const targetCol = firstColKey || (cols.length > 0 ? cols[0] : 'customerId');
          const nextRow = rowIdx + 1;
          if (nextRow < rowCount) {
            focusCell(nextRow, targetCol);
          } else {
            // On the last row:
            if (isRowValid && !isRowValid(rowIdx)) {
              // Last row has no item or account selected: do not add row, go to save button!
              goToSave();
            } else {
              if (pendingFocusRef) {
                pendingFocusRef.current = { rowIdx: nextRow, colKey: targetCol };
              }
              onAddRow();
            }
          }
        }
        return;
      }

      // Arrow keys navigation
      const aCols = arrowColsRef.current;
      const aColIdx = aCols.indexOf(colKey);

      if (key === 'ArrowRight' || key === 'ArrowLeft') {
        if (isDropdownOpen(e)) return;

        e.preventDefault();
        const dir = key === 'ArrowRight' ? 1 : -1;
        const targetIdx = aColIdx + dir;
        if (targetIdx >= 0 && targetIdx < aCols.length) {
          focusCell(rowIdx, aCols[targetIdx]);
        }
        return;
      }

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        if (isDropdownOpen(e)) return;

        // Stop increment/decrement on number inputs and navigate rows instead
        e.preventDefault();
        e.stopPropagation();
        const dir = key === 'ArrowDown' ? 1 : -1;
        const targetRow = rowIdx + dir;
        if (targetRow >= 0 && targetRow < rowCount) {
          focusCell(targetRow, colKey);
        }
        return;
      }
    },
    [rowCount, focusCell, onAddRow, pendingFocusRef, firstColKey],
  );

  return {
    getCellRef,
    handleCellKeyDown,
    focusCell,
  };
}
