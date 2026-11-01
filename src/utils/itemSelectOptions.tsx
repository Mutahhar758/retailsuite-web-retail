import type { SelectProps } from 'antd';

export interface SelectableItemLike {
  id: string | number;
  title: string;
  itemCategoryCode?: string | null;
  barcode?: string | null;
  itemKey?: string | null;
}

export interface ItemSelectOption {
  value: string;
  label: string;
  itemTitle: string;
  codeBadge: string;
  barcode?: string;
  searchText: string;
}

/**
 * Formats the combined Category ID + Item ID code (e.g. "01-000012"),
 * falling back to just the Item ID if category code is absent.
 */
export function formatItemCode(item: SelectableItemLike): string {
  const idStr = String(item.id ?? '').trim();
  const catStr = String(item.itemCategoryCode ?? '').trim();
  if (catStr && idStr) {
    return `${catStr}-${idStr}`;
  }
  return idStr;
}

/**
 * Formats the selected display text shown inside the Select input once an item is chosen.
 * Example: "Sugar 1Kg (01-000012)"
 */
export function formatItemSelectedLabel(item: SelectableItemLike, extraSuffix?: string): string {
  const code = formatItemCode(item);
  const base = code ? `${item.title} (${code})` : item.title;
  return extraSuffix ? `${base}${extraSuffix}` : base;
}

/**
 * Builds a lowercased search index containing title, barcode, category-item ID variants,
 * item ID (with and without leading zeros), and itemKey.
 */
export function buildItemSearchText(item: SelectableItemLike, extraText?: string): string {
  const idStr = String(item.id ?? '').trim();
  const numericId = idStr && /^\d+$/.test(idStr) ? String(parseInt(idStr, 10)) : '';
  const catStr = String(item.itemCategoryCode ?? '').trim();
  const numericCat = catStr && /^\d+$/.test(catStr) ? String(parseInt(catStr, 10)) : '';
  const barcodeStr = String(item.barcode ?? '').trim();
  const keyStr = String(item.itemKey ?? '').trim();
  const titleStr = String(item.title ?? '').trim();

  const parts = [
    titleStr,
    idStr,
    numericId,
    catStr,
    catStr && idStr ? `${catStr}-${idStr}` : '',
    catStr && idStr ? `${catStr}${idStr}` : '',
    numericCat && idStr ? `${numericCat}-${idStr}` : '',
    numericCat && idStr ? `${numericCat}${idStr}` : '',
    barcodeStr,
    keyStr,
    extraText || '',
  ];

  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Predicate for filtering item lists in non-Select search inputs (e.g. POS item grid search).
 */
export function matchesItemSearch(item: SelectableItemLike, rawQuery: string): boolean {
  const q = (rawQuery ?? '').trim().toLowerCase();
  if (!q) return true;
  const searchIndex = buildItemSearchText(item);
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every(token => searchIndex.includes(token));
}

/**
 * Builds Ant Design Select options array with hidden searchText and structured display fields.
 */
export function buildItemSelectOptions<T extends SelectableItemLike>(
  items: T[],
  formatExtraSuffix?: (item: T) => string
): ItemSelectOption[] {
  return items.map(item => {
    const codeBadge = formatItemCode(item);
    const extraSuffix = formatExtraSuffix ? formatExtraSuffix(item) : undefined;
    const itemTitle = extraSuffix ? `${item.title}${extraSuffix}` : item.title;
    const label = formatItemSelectedLabel(item, extraSuffix);
    return {
      value: String(item.id),
      label,
      itemTitle,
      codeBadge,
      barcode: item.barcode ? String(item.barcode).trim() : undefined,
      searchText: buildItemSearchText(item, extraSuffix),
    };
  });
}

/**
 * Filter function for Ant Design Select that searches across title, barcode,
 * Category-Item ID, Item ID, and search key without cluttering the visible label.
 */
export const filterItemOption: NonNullable<SelectProps< any, ItemSelectOption>['filterOption']> = (
  input,
  option
) => {
  const q = (input ?? '').trim().toLowerCase();
  if (!q) return true;
  const haystack = option?.searchText || String(option?.label ?? '').toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every(token => haystack.includes(token));
};

/**
 * Renders each dropdown option with the Item Title on the left and a subtle
 * Category-Item ID badge (e.g. "01-000012") on the right.
 */
export const renderItemOption: NonNullable<SelectProps<any, ItemSelectOption>['optionRender']> = (
  oriOption
) => {
  const data = oriOption.data as ItemSelectOption | undefined;
  if (!data?.codeBadge) {
    return oriOption.label;
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        width: '100%',
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}
      >
        {data.itemTitle}
      </span>
      <span
        style={{
          fontSize: 11,
          lineHeight: '16px',
          color: '#64748b',
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          padding: '1px 6px',
          borderRadius: 4,
          fontFamily: 'monospace',
          flexShrink: 0,
        }}
      >
        {data.codeBadge}
      </span>
    </div>
  );
};

/**
 * Convenience helper returning Select props (`options`, `filterOption`, `optionRender`, `optionFilterProp`)
 * for any item dropdown in RetailSuite.
 */
export function getItemSelectProps<T extends SelectableItemLike>(
  items: T[],
  formatExtraSuffix?: (item: T) => string
) {
  return {
    optionFilterProp: 'label' as const,
    options: buildItemSelectOptions(items, formatExtraSuffix),
    filterOption: filterItemOption,
    optionRender: renderItemOption,
  };
}
