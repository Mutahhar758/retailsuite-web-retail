import { useRef, useCallback, useEffect } from 'react';

/**
 * Column keys that are candidates for keyboard focus in the Enter navigation flow.
 * - rate: auto-filled, excluded from Enter
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

export type ArrowColKey = GridColKey | 'unit' | 'rate' | 'discount' | 'addLess';

interface UseGridKeyboardOptions {
  rowCount: number;
  hasSecondaryQty: boolean;
  hasVariablePackFeature: boolean;
  /** Called when Enter is pressed on the last field of the last row. */
  onAddRow: () => void;
  /**
   * rowCount changes when a new row is added. Provide the index of the row
   * that should receive focus after the state update (used by addRow auto-focus).
   */
  pendingFocusRef?: React.MutableRefObject<{ rowIdx: number; colKey: GridColKey } | null>;
}

interface UseGridKeyboardReturn {
  /** Get (or lazily create) the ref for a given cell. Pass this as `ref` prop. */
  getCellRef: (rowIdx: number, colKey: GridColKey | ArrowColKey) => React.RefObject<any>;
  /** Attach this as `onKeyDown` to every focusable grid cell. */
  handleCellKeyDown: (rowIdx: number, colKey: GridColKey | ArrowColKey, e: React.KeyboardEvent) => void;
  /**
   * Call this AFTER state has been updated with the new row.
   * Schedules focus on the Customer cell of the given row index.
   */
  focusCell: (rowIdx: number, colKey: GridColKey | ArrowColKey) => void;
}

/**
 * Builds the ordered list of columns that Enter navigation will step through.
 *
 * Enter flow:
 *   Customer → Qty
 *     → SecQty (if hasSecondaryQty OR hasVariablePackFeature)
 *     → PackQty (if hasVariablePackFeature)
 *     → Packing (if hasVariablePackFeature)
 *     → SecRate (if hasSecondaryQty OR hasVariablePackFeature)
 *   → next row Customer (auto-creates row if last)
 */
function buildEnterColumns(
  hasSecondaryQty: boolean,
  hasVariablePackFeature: boolean,
): GridColKey[] {
  const cols: GridColKey[] = ['customerId', 'qty'];

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

/**
 * Arrow-key navigable columns (includes Unit if visible, Rate, Discount, Add/Less).
 */
function buildArrowColumns(
  hasSecondaryQty: boolean,
  hasVariablePackFeature: boolean,
): ArrowColKey[] {
  const cols: ArrowColKey[] = ['customerId'];

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

  cols.push('discount', 'addLess');
  return cols;
}

/**
 * Returns true when the keyboard event originated from inside an Ant Design
 * Select whose dropdown is currently open (detected by the `ant-select-open`
 * class that Ant Design adds to the root `.ant-select` wrapper).
 */
function isAntSelectOpen(e: React.KeyboardEvent): boolean {
  const selectWrapper = (e.target as HTMLElement).closest('.ant-select');
  return selectWrapper?.classList.contains('ant-select-open') ?? false;
}

export function useGridKeyboard({
  rowCount,
  hasSecondaryQty,
  hasVariablePackFeature,
  onAddRow,
  pendingFocusRef,
}: UseGridKeyboardOptions): UseGridKeyboardReturn {
  // Ref map: "rowIdx:colKey" → RefObject
  const refsMap = useRef<Map<string, React.RefObject<any>>>(new Map());

  const enterCols = useRef<GridColKey[]>([]);
  const arrowCols = useRef<ArrowColKey[]>([]);

  // Recompute column lists when feature flags change
  useEffect(() => {
    enterCols.current = buildEnterColumns(hasSecondaryQty, hasVariablePackFeature);
    arrowCols.current = buildArrowColumns(hasSecondaryQty, hasVariablePackFeature);
  }, [hasSecondaryQty, hasVariablePackFeature]);

  // Also compute on mount synchronously so they're ready immediately
  enterCols.current = buildEnterColumns(hasSecondaryQty, hasVariablePackFeature);
  arrowCols.current = buildArrowColumns(hasSecondaryQty, hasVariablePackFeature);

  const getCellRef = useCallback((rowIdx: number, colKey: GridColKey | ArrowColKey): React.RefObject<any> => {
    const key = `${rowIdx}:${colKey}`;
    if (!refsMap.current.has(key)) {
      refsMap.current.set(key, { current: null });
    }
    return refsMap.current.get(key)!;
  }, []);

  const focusCell = useCallback((rowIdx: number, colKey: GridColKey | ArrowColKey) => {
    // Use rAF to allow React state updates to flush and DOM to update first
    requestAnimationFrame(() => {
      const ref = refsMap.current.get(`${rowIdx}:${colKey}`);
      if (ref?.current) {
        // Ant Design Select / InputNumber expose .focus()
        if (typeof ref.current.focus === 'function') {
          ref.current.focus();
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
    (rowIdx: number, colKey: GridColKey | ArrowColKey, e: React.KeyboardEvent) => {
      const { key } = e;

      // ── Escape: let the cell handle it natively (closes dropdowns) ──────────
      if (key === 'Escape') return;

      // ── Enter: smart forward navigation ──────────────────────────────────────
      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();

        const cols = enterCols.current;
        const colIdx = cols.indexOf(colKey as GridColKey);

        if (colIdx === -1) {
          // This column is not in Enter flow (e.g. rate, discount) — do nothing
          return;
        }

        const nextColIdx = colIdx + 1;

        if (nextColIdx < cols.length) {
          // Move to next column in the same row
          focusCell(rowIdx, cols[nextColIdx]);
        } else {
          // Last column in the row → move to next row's Customer
          const nextRow = rowIdx + 1;
          if (nextRow < rowCount) {
            focusCell(nextRow, 'customerId');
          } else {
            // We are on the last row — add a new row, then focus its Customer
            onAddRow();
            // The parent must set pendingFocusRef.current = { rowIdx: nextRow, colKey: 'customerId' }
            // before calling onAddRow, OR we handle it via the useEffect above.
            // We store the intent here so the useEffect picks it up after rowCount increments:
            if (pendingFocusRef) {
              pendingFocusRef.current = { rowIdx: nextRow, colKey: 'customerId' };
            }
          }
        }
        return;
      }

      // ── Arrow keys: navigate by column/row ──────────────────────────────────
      const aCols = arrowCols.current;
      const aColIdx = aCols.indexOf(colKey as ArrowColKey);

      if (key === 'ArrowRight' || key === 'ArrowLeft') {
        // For Select cells: if the dropdown is open, Ant Design uses Left/Right
        // internally — let the event pass through.
        const isSelectOpen = isAntSelectOpen(e);
        if (isSelectOpen) return;

        e.preventDefault();
        const dir = key === 'ArrowRight' ? 1 : -1;
        const targetIdx = aColIdx + dir;
        if (targetIdx >= 0 && targetIdx < aCols.length) {
          focusCell(rowIdx, aCols[targetIdx]);
        }
        return;
      }

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        // ── Select cells (customerId, unit) ──────────────────────────────────
        // If the dropdown is open, Up/Down should navigate dropdown options —
        // let those keys pass through to Ant Design's handler.
        if (colKey === 'customerId' || colKey === 'unit') {
          const isSelectOpen = isAntSelectOpen(e);
          if (isSelectOpen) return; // dropdown navigates itself
        }

        // Navigate rows (for closed Select or InputNumber cells)
        // Prevent default & stop propagation so InputNumber never increments/decrements
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
    [rowCount, focusCell, onAddRow, pendingFocusRef],
  );

  return {
    getCellRef: getCellRef as UseGridKeyboardReturn['getCellRef'],
    handleCellKeyDown: handleCellKeyDown as UseGridKeyboardReturn['handleCellKeyDown'],
    focusCell: focusCell as UseGridKeyboardReturn['focusCell'],
  };
}
