import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Card, Form, Input, InputNumber, Button, Space, Typography, 
  Select, Switch, Table, Row, Col, Divider, message, Popconfirm, Statistic, Tag 
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined, SaveOutlined, 
  ExperimentOutlined, CalculatorOutlined, DollarOutlined 
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { bomService, normalizeCalculationType, type BomCreateOrUpdateRequest } from '../../services/bomService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { getItemSelectProps } from '../../utils/itemSelectOptions';
import { unitService, type UnitDto } from '../../services/unitService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { COA_LEVELS, COA_ROOT_IDS } from '../../constants/chartOfAccountConstants';
import { 
  getSelectablePrimaryUnits, 
  toBasePrimaryQty, 
  resolveDisplayQtyAndUnit 
} from '../../utils/unitConversion';
import { useGridKeyboard, closeOpenSelectDropdowns } from '../../hooks/useGridKeyboard';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface IngredientRow {
  key: string;
  seq: number;
  rawItemId: string;
  primaryQty: number;
  displayPrimaryQty?: number;
  selectedUnitId?: string;
  selectedUnitFactor?: number;
  secQty: number;
  qty: number;
  unitId?: string;
  secUnit?: string;
  qtyInPack?: number;
  scrapPercentage: number;
  isOptional: boolean;
  rate: number;
  totalCost: number;
}

interface BomExpenseRow {
  key: string;
  seq: number;
  title: string;
  accountId?: string;
  calculationType: 'LumpSum' | 'PerUnit' | 'PercentOfMaterial';
  rate: number;
  remarks?: string;
}

const createEmptyExpenseRow = (seq: number): BomExpenseRow => ({
  key: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  seq,
  title: '',
  accountId: undefined,
  calculationType: 'PerUnit',
  rate: 0,
  remarks: ''
});

const calcBomExpenseAmount = (exp: BomExpenseRow, outputQty: number, totalMaterialCost: number): number => {
  const rate = Number(exp.rate || 0);
  if (exp.calculationType === 'LumpSum') return Math.round(rate * 100) / 100;
  if (exp.calculationType === 'PercentOfMaterial') return Math.round((totalMaterialCost * (rate / 100)) * 100) / 100;
  return Math.round((rate * (outputQty || 0)) * 100) / 100;
};

const createEmptyRow = (seq: number): IngredientRow => ({
  key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  seq,
  rawItemId: '',
  primaryQty: 1,
  displayPrimaryQty: 1,
  selectedUnitFactor: 1,
  secQty: 0,
  qty: 1,
  scrapPercentage: 0,
  isOptional: false,
  rate: 0,
  totalCost: 0
});

interface IngredientItemSelectCellProps {
  rowIdx: number;
  isLastRow: boolean;
  record: IngredientRow;
  items: Item[];
  getCellRef: (rowIdx: number, colKey: string) => React.RefObject<any>;
  onSelectItem: (rawItemId: string, key: string, rowIdx: number) => void;
  focusCell: (rowIdx: number, colKey: string) => void;
  onEmptyLastRowExit: () => void;
  onNavigateCellKeyDown: (rowIdx: number, colKey: string, e: React.KeyboardEvent) => void;
}

const IngredientItemSelectCell: React.FC<IngredientItemSelectCellProps> = ({
  rowIdx,
  isLastRow,
  record,
  items,
  getCellRef,
  onSelectItem,
  focusCell,
  onEmptyLastRowExit,
  onNavigateCellKeyDown,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Select
      ref={getCellRef(rowIdx, 'itemId')}
      className={`grid-select-row-${rowIdx}`}
      showSearch
      open={open}
      onDropdownVisibleChange={setOpen}
      placeholder="Select Ingredient"
      value={record.rawItemId || undefined}
      onSelect={(val) => {
        setOpen(false);
        onSelectItem(val, record.key, rowIdx);
      }}
      onChange={(val) => {
        setOpen(false);
        if (val) {
          onSelectItem(val, record.key, rowIdx);
        }
      }}
      onBlur={() => setOpen(false)}
      style={{ width: '100%' }}
      {...getItemSelectProps(items)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (open) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);

          if (record.rawItemId) {
            focusCell(rowIdx, 'primaryQty');
          } else if (isLastRow) {
            onEmptyLastRowExit();
          }
          return;
        }

        if (e.key === 'Tab') {
          setOpen(false);
          if (!record.rawItemId && isLastRow) {
            e.preventDefault();
            onEmptyLastRowExit();
          }
          return;
        }

        if (!open) {
          onNavigateCellKeyDown(rowIdx, 'itemId', e);
        }
      }}
    />
  );
};

export const BomForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id && id !== 'new');
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() => (isEdit ? [] : [createEmptyRow(1)]));
  const [expenses, setExpenses] = useState<BomExpenseRow[]>([]);
  const [finishedItemId, setFinishedItemId] = useState<string>('');

  // Refs for keyboard navigation and summary card focus
  const pendingFocusRef = useRef<{ rowIdx: number; colKey: string } | null>(null);
  const laborCostRef = useRef<any>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  // Overhead values from form state
  const [laborCost, setLaborCost] = useState<number>(0);
  const [overheadCost, setOverheadCost] = useState<number>(0);
  const [packagingCost, setPackagingCost] = useState<number>(0);
  const [outputQty, setOutputQty] = useState<number>(1);
  const watchedUnitId = Form.useWatch('unitId', form);

  const getUnitTitle = useCallback((code?: string, preferShort = true) => {
    if (!code) return '';
    const matched = units.find(u => 
      u.code?.toLowerCase() === code?.toLowerCase() || 
      u.title?.toLowerCase() === code?.toLowerCase()
    );
    if (matched) {
      if (preferShort && matched.shortTitle && matched.shortTitle.trim()) {
        return matched.shortTitle.trim();
      }
      return matched.title;
    }
    return isNaN(Number(code)) ? code : '';
  }, [units]);

  // Helper to extract allowed units for a given item (whitelisted strictly from item details)
  const getItemAllowedUnits = useCallback((item?: Item) => {
    if (!item) return [];
    const rawCodes = [item.defaultUnit, item.primaryUnit, item.secondaryUnit]
      .filter((u): u is string => Boolean(u && typeof u === 'string' && u.trim().length > 0));
    const uniqueCodes = Array.from(new Set(rawCodes));
    if (uniqueCodes.length === 0) {
      return units.map(u => ({ code: u.code, title: u.title || '' })).filter(u => Boolean(u.title));
    }
    return uniqueCodes.map(code => {
      const matched = units.find(u => 
        u.code?.toLowerCase() === code?.toLowerCase() || 
        u.title?.toLowerCase() === code?.toLowerCase()
      );
      return {
        code,
        title: matched?.title || (isNaN(Number(code)) ? code : '')
      };
    }).filter(u => Boolean(u.title));
  }, [units]);

  // Load existing BOM if in edit mode
  const fetchBom = useCallback(async (currentItems: Item[], currentUnits: UnitDto[]) => {
    if (!isEdit) {
      form.setFieldsValue({
        outputQty: 1,
        isActive: true,
        isDefault: true,
        laborCost: 0,
        overheadCost: 0,
        packagingCost: 0
      });
      return;
    }

    try {
      setLoading(true);
      const bom = await bomService.getById(Number(id));
      form.setFieldsValue({
        code: bom.code,
        title: bom.title,
        finishedItemId: bom.finishedItemId,
        outputQty: bom.outputQty,
        unitId: bom.unitId,
        isActive: bom.isActive,
        isDefault: bom.isDefault,
        laborCost: bom.laborCost,
        overheadCost: bom.overheadCost,
        packagingCost: bom.packagingCost,
        notes: bom.notes
      });

      setFinishedItemId(bom.finishedItemId);
      setOutputQty(bom.outputQty || 1);
      setLaborCost(bom.laborCost || 0);
      setOverheadCost(bom.overheadCost || 0);
      setPackagingCost(bom.packagingCost || 0);

      if (bom.expenses && bom.expenses.length > 0) {
        setExpenses(
          bom.expenses.map((e, idx) => ({
            key: `exp-${e.id || idx}`,
            seq: e.seq,
            title: e.title,
            accountId: e.accountId,
            calculationType: normalizeCalculationType(e.calculationType),
            rate: e.rate || 0,
            remarks: e.remarks || ''
          }))
        );
      } else {
        // Legacy fallback for old BOMs that only had labor/overhead/packaging numbers
        const legacyRows: BomExpenseRow[] = [];
        let s = 1;
        if (bom.laborCost > 0) legacyRows.push({ key: `exp-leg-1`, seq: s++, title: 'Direct Labor', calculationType: 'LumpSum', rate: bom.laborCost });
        if (bom.overheadCost > 0) legacyRows.push({ key: `exp-leg-2`, seq: s++, title: 'Utilities & Overhead', calculationType: 'LumpSum', rate: bom.overheadCost });
        if (bom.packagingCost > 0) legacyRows.push({ key: `exp-leg-3`, seq: s++, title: 'Packaging', calculationType: 'LumpSum', rate: bom.packagingCost });
        setExpenses(legacyRows);
      }

      const rows: IngredientRow[] = bom.lines.map((l, index) => {
        const item = currentItems.find(i => i.id === l.rawItemId);
        const pSize = Number(item?.qtyInPack || 0);
        const priUnit = item?.primaryUnit || item?.defaultUnit;
        const secUnit = item?.secondaryUnit;
        const hasSec = Boolean(secUnit && secUnit !== priUnit && pSize > 1);
        const secQty = hasSec && pSize > 0 ? Math.floor(l.qty / pSize) : 0;
        const rawBasePrimaryQty = hasSec && pSize > 0 ? Math.round((l.qty - (secQty * pSize)) * 10000) / 10000 : l.qty;

        const resolved = resolveDisplayQtyAndUnit(rawBasePrimaryQty, item, currentUnits as any);

        return {
          key: `row-${index}`,
          seq: l.seq,
          rawItemId: l.rawItemId,
          primaryQty: rawBasePrimaryQty,
          displayPrimaryQty: resolved.displayQty,
          selectedUnitId: resolved.selectedUnitId,
          selectedUnitFactor: resolved.factor,
          secQty,
          qty: l.qty,
          unitId: l.unitId || item?.defaultUnit || item?.primaryUnit,
          secUnit: item?.secondaryUnit,
          qtyInPack: pSize,
          scrapPercentage: l.scrapPercentage,
          isOptional: l.isOptional,
          rate: l.currentRate || 0,
          totalCost: l.totalEstimatedCost || (l.qty * (1 + l.scrapPercentage / 100) * (l.currentRate || 0))
        };
      });
      const nextSeq = rows.length > 0 ? Math.max(...rows.map(r => r.seq)) + 1 : 1;
      setIngredients([...rows, createEmptyRow(nextSeq)]);
    } catch (err) {
      message.error('Failed to load recipe details');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, form]);

  // Load items, units, and all expense accounts
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [itemList, unitList, expAccList] = await Promise.all([
          inventoryService.getItemsLookup(),
          unitService.getActiveUnits(),
          chartOfAccountService.getLookup(COA_ROOT_IDS.EXPENSES, COA_LEVELS.DETAIL).catch(() => [])
        ]);
        const validItems = itemList || [];
        const validUnits = unitList || [];
        setItems(validItems);
        setUnits(validUnits);
        setExpenseAccounts(expAccList || []);
        fetchBom(validItems, validUnits);
      } catch (err) {
        message.error('Failed to load item lookup');
      }
    };
    loadLookups();
  }, [fetchBom]);

  // Recalculate row total
  const updateRowCost = (row: IngredientRow): IngredientRow => {
    const effectiveQty = (row.qty || 0) * (1 + (row.scrapPercentage || 0) / 100);
    const cost = effectiveQty * (row.rate || 0);
    return { ...row, totalCost: Math.round(cost * 100) / 100 };
  };

  const focusSummaryCard = useCallback(() => {
    closeOpenSelectDropdowns();
    const doFocus = () => {
      if (laborCostRef.current?.focus) {
        laborCostRef.current.focus();
        laborCostRef.current.select?.();
      } else {
        const el = document.querySelector<HTMLInputElement>('.bom-summary-labor input');
        el?.focus();
        el?.select?.();
      }
    };
    doFocus();
    requestAnimationFrame(doFocus);
  }, []);

  const handleAddRow = useCallback(() => {
    setIngredients(prev => {
      const newSeq = prev.length > 0 ? Math.max(...prev.map(r => r.seq)) + 1 : 1;
      return [...prev, createEmptyRow(newSeq)];
    });
  }, []);

  const { getCellRef, handleCellKeyDown, focusCell } = useGridKeyboard({
    rowCount: ingredients.length,
    enterCols: ['itemId', 'primaryQty', 'secQty', 'qty', 'scrapPercentage', 'rate'],
    arrowCols: ['itemId', 'primaryQty', 'secQty', 'qty', 'scrapPercentage', 'rate'],
    firstColKey: 'itemId',
    onAddRow: handleAddRow,
    pendingFocusRef,
    isRowValid: (idx) => Boolean(ingredients[idx]?.rawItemId),
    onSave: focusSummaryCard,
  });

  const handleBomCellKeyDown = useCallback(
    (rowIdx: number, colKey: string, e: React.KeyboardEvent, hasSecUnit?: boolean) => {
      const isLastEmptyRow = rowIdx === ingredients.length - 1 && !ingredients[rowIdx]?.rawItemId;
      if (e.key === 'Enter' && isLastEmptyRow) {
        e.preventDefault();
        e.stopPropagation();
        focusSummaryCard();
        return;
      }

      if (colKey === 'primaryQty' && !hasSecUnit && (e.key === 'Enter' || e.key === 'ArrowRight')) {
        e.preventDefault();
        e.stopPropagation();
        focusCell(rowIdx, 'qty');
        return;
      }

      if (colKey === 'qty' && !hasSecUnit && e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        focusCell(rowIdx, 'primaryQty');
        return;
      }

      handleCellKeyDown(rowIdx, colKey, e);
    },
    [ingredients, focusSummaryCard, focusCell, handleCellKeyDown],
  );

  const handleItemSelect = (rawItemId: string, key: string, rowIdx: number) => {
    const found = items.find(i => i.id === rawItemId);
    const allowed = getItemAllowedUnits(found);
    const unitId = found ? (found.defaultUnit || found.primaryUnit || allowed[0]?.code) : undefined;
    const pSize = Number(found?.qtyInPack || 0);
    const rate = found ? (found.priRate || found.opnRate || 0) : 0;

    const selectable = getSelectablePrimaryUnits(found, units as any);
    const primaryOpt = selectable[0];
    const selectedUnitId = primaryOpt?.unitId || unitId;
    const selectedUnitFactor = primaryOpt?.factor || 1;

    setIngredients(prev => {
      const isLastRow = prev.length > 0 && prev[prev.length - 1].key === key;
      const updatedRows = prev.map(row => {
        if (row.key === key) {
          const updated: IngredientRow = {
            ...row,
            rawItemId,
            primaryQty: 1,
            displayPrimaryQty: 1,
            selectedUnitId,
            selectedUnitFactor,
            secQty: 0,
            qty: 1,
            rate,
            unitId,
            secUnit: found?.secondaryUnit,
            qtyInPack: pSize
          };
          return updateRowCost(updated);
        }
        return row;
      });

      if (isLastRow) {
        const nextSeq = updatedRows.length > 0 ? Math.max(...updatedRows.map(r => r.seq)) + 1 : 1;
        return [...updatedRows, createEmptyRow(nextSeq)];
      }
      return updatedRows;
    });

    setTimeout(() => {
      focusCell(rowIdx, 'primaryQty');
    }, 30);
  };

  const handleRowUnitChange = (key: string, newUnitId: string) => {
    setIngredients(prev => prev.map(row => {
      if (row.key === key) {
        const item = items.find(i => i.id === row.rawItemId);
        const selectable = getSelectablePrimaryUnits(item, units as any);
        const newOpt = selectable.find(u => u.unitId === newUnitId);
        const newFactor = newOpt?.factor || 1;

        const currentBasePrimaryQty = row.primaryQty ?? 0;
        const newDisplayQty = Number((currentBasePrimaryQty * newFactor).toFixed(4));

        const updated: IngredientRow = {
          ...row,
          selectedUnitId: newUnitId,
          selectedUnitFactor: newFactor,
          displayPrimaryQty: newDisplayQty
        };
        return updateRowCost(updated);
      }
      return row;
    }));
  };

  const handleRowQtyChange = (key: string, field: 'primaryQty' | 'secQty' | 'qty', val: number) => {
    setIngredients(prev => prev.map(row => {
      if (row.key === key) {
        const item = items.find(i => i.id === row.rawItemId);
        const pSize = Number(item?.qtyInPack || row.qtyInPack || 0);
        const priCode = item?.primaryUnit || item?.defaultUnit || row.unitId;
        const secCode = item?.secondaryUnit || row.secUnit;
        const hasSec = Boolean(secCode && secCode !== priCode && pSize > 1);

        const factor = row.selectedUnitFactor || 1;
        let primaryQty = row.primaryQty ?? 0;
        let displayPrimaryQty = row.displayPrimaryQty ?? (primaryQty * factor);
        let secQty = row.secQty ?? 0;
        let qty = row.qty ?? 0;

        if (field === 'primaryQty') {
          displayPrimaryQty = val;
          primaryQty = toBasePrimaryQty(val, factor);
          qty = hasSec && pSize > 0 ? (primaryQty + (secQty * pSize)) : primaryQty;
        } else if (field === 'secQty') {
          secQty = val;
          qty = hasSec && pSize > 0 ? (primaryQty + (val * pSize)) : (primaryQty || val);
        } else if (field === 'qty') {
          qty = val;
          if (hasSec && pSize > 0) {
            secQty = Math.floor(val / pSize);
            primaryQty = Math.round((val - (secQty * pSize)) * 10000) / 10000;
          } else {
            primaryQty = val;
            secQty = 0;
          }
          displayPrimaryQty = Number((primaryQty * factor).toFixed(4));
        }

        const updated = {
          ...row,
          primaryQty,
          displayPrimaryQty,
          secQty,
          qty
        };
        return updateRowCost(updated);
      }
      return row;
    }));
  };

  const handleRowChange = (key: string, field: keyof IngredientRow, val: any) => {
    setIngredients(prev => prev.map(row => {
      if (row.key === key) {
        const updated = { ...row, [field]: val };
        return updateRowCost(updated);
      }
      return row;
    }));
  };

  const handleRemoveRow = (key: string) => {
    setIngredients(prev => {
      const remaining = prev.filter(r => r.key !== key);
      return remaining.length > 0 ? remaining : [createEmptyRow(1)];
    });
  };

  const handleAddExpenseRow = () => {
    setExpenses(prev => {
      const nextSeq = prev.length > 0 ? Math.max(...prev.map(e => e.seq)) + 1 : 1;
      return [...prev, createEmptyExpenseRow(nextSeq)];
    });
  };

  const handleExpenseChange = (key: string, field: keyof BomExpenseRow, val: any) => {
    setExpenses(prev => prev.map(row => {
      if (row.key !== key) return row;
      const updated = { ...row, [field]: val };
      if (field === 'accountId' && val && !row.title?.trim()) {
        const acc = expenseAccounts.find(a => a.account === val);
        if (acc?.title) {
          updated.title = acc.title;
        }
      }
      return updated;
    }));
  };

  const handleRemoveExpenseRow = (key: string) => {
    setExpenses(prev => prev.filter(r => r.key !== key));
  };

  // Calculations
  const totalMaterialCost = ingredients.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const totalOverheadCost = expenses.length > 0
    ? expenses.reduce((sum, e) => sum + calcBomExpenseAmount(e, outputQty, totalMaterialCost), 0)
    : ((laborCost || 0) + (overheadCost || 0) + (packagingCost || 0));
  const grandTotalCost = totalMaterialCost + totalOverheadCost;
  const unitProductionCost = outputQty > 0 ? grandTotalCost / outputQty : 0;

  const onFinish = async (values: any) => {
    const filledIngredients = ingredients.filter(r => Boolean(r.rawItemId));
    if (filledIngredients.length === 0) {
      message.error('Please add at least one raw material / ingredient.');
      return;
    }

    const invalidRow = filledIngredients.find(r => r.qty <= 0);
    if (invalidRow) {
      message.error('Please enter a valid quantity for all ingredients.');
      return;
    }

    const filledExpenses = expenses.filter(e => Boolean(e.title?.trim()) || Boolean(e.accountId));

    const payload: BomCreateOrUpdateRequest = {
      code: values.code,
      title: values.title,
      finishedItemId: values.finishedItemId,
      outputQty: values.outputQty || 1,
      unitId: values.unitId,
      isActive: values.isActive ?? true,
      isDefault: values.isDefault ?? true,
      laborCost: 0,
      overheadCost: 0,
      packagingCost: 0,
      notes: values.notes,
      lines: filledIngredients.map((r, i) => ({
        seq: i + 1,
        rawItemId: r.rawItemId,
        qty: r.qty,
        unitId: r.unitId,
        scrapPercentage: r.scrapPercentage || 0,
        isOptional: r.isOptional || false
      })),
      expenses: filledExpenses.map((e, i) => ({
        seq: i + 1,
        title: e.title?.trim() || expenseAccounts.find(a => a.account === e.accountId)?.title || 'Expense',
        accountId: e.accountId,
        calculationType: e.calculationType,
        rate: Number(e.rate || 0),
        remarks: e.remarks
      }))
    };

    try {
      setSaving(true);
      if (isEdit) {
        await bomService.update(Number(id), payload);
        message.success('Recipe updated successfully');
      } else {
        await bomService.create(payload);
        message.success('Recipe created successfully');
      }
      navigate('/setup/bom');
    } catch (err: any) {
      message.error(err?.response?.data?.metadata?.message || 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '#',
      dataIndex: 'seq',
      key: 'seq',
      width: 45,
      render: (_: any, __: any, index: number) => index + 1
    },
    {
      title: 'Raw Material / Ingredient',
      key: 'rawItemId',
      width: 250,
      render: (_: any, record: IngredientRow, rowIdx: number) => (
        <IngredientItemSelectCell
          rowIdx={rowIdx}
          isLastRow={rowIdx === ingredients.length - 1}
          record={record}
          items={items}
          getCellRef={getCellRef}
          onSelectItem={handleItemSelect}
          focusCell={focusCell}
          onEmptyLastRowExit={focusSummaryCard}
          onNavigateCellKeyDown={handleBomCellKeyDown}
        />
      )
    },
    {
      title: 'Primary Qty',
      key: 'primaryQty',
      width: 175,
      render: (_: any, record: IngredientRow, rowIdx: number) => {
        const item = items.find(i => i.id === record.rawItemId);
        const selectableUnits = getSelectablePrimaryUnits(item, units as any);
        const priCode = item?.primaryUnit || item?.defaultUnit || record.unitId || '';
        const priUnit = getUnitTitle(priCode);
        const secCode = item?.secondaryUnit || record.secUnit || '';
        const pSize = Number(item?.qtyInPack || record.qtyInPack || 0);
        const hasSecUnit = Boolean(secCode && secCode !== priCode && pSize > 1);

        const currentUnitId = record.selectedUnitId || selectableUnits[0]?.unitId || priCode;
        const displayValue = record.displayPrimaryQty !== undefined 
          ? record.displayPrimaryQty 
          : (record.selectedUnitFactor && record.selectedUnitFactor > 1 
              ? Number((record.primaryQty * record.selectedUnitFactor).toFixed(4)) 
              : record.primaryQty);

        return (
          <InputNumber
            ref={getCellRef(rowIdx, 'primaryQty')}
            min={0}
            step={record.selectedUnitFactor && record.selectedUnitFactor > 1 ? 1 : 0.01}
            controls={false}
            keyboard={false}
            value={displayValue}
            placeholder="0"
            onFocus={(e) => {
              const input = e.target as HTMLInputElement;
              input?.select?.();
            }}
            onKeyDown={(e) => handleBomCellKeyDown(rowIdx, 'primaryQty', e, hasSecUnit)}
            onChange={(val) => handleRowQtyChange(record.key, 'primaryQty', val || 0)}
            style={{ width: '100%' }}
            addonAfter={
              selectableUnits.length > 1 ? (
                <Select
                  value={currentUnitId}
                  onChange={(uId) => handleRowUnitChange(record.key, uId)}
                  style={{ minWidth: 62 }}
                  popupMatchSelectWidth={false}
                  size="small"
                >
                  {selectableUnits.map(u => (
                    <Option key={u.unitId} value={u.unitId}>
                      {u.label}
                    </Option>
                  ))}
                </Select>
              ) : (
                priUnit ? <span style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{priUnit}</span> : undefined
              )
            }
          />
        );
      }
    },
    {
      title: 'Sec Qty',
      key: 'secQty',
      width: 130,
      render: (_: any, record: IngredientRow, rowIdx: number) => {
        const item = items.find(i => i.id === record.rawItemId);
        const priCode = item?.primaryUnit || item?.defaultUnit || record.unitId || '';
        const secCode = item?.secondaryUnit || record.secUnit || '';
        const pSize = Number(item?.qtyInPack || record.qtyInPack || 0);
        const hasSecUnit = Boolean(secCode && secCode !== priCode && pSize > 1);
        const secUnit = hasSecUnit ? getUnitTitle(secCode) : '';
        return (
          <InputNumber
            ref={getCellRef(rowIdx, 'secQty')}
            min={0}
            step={1}
            controls={false}
            keyboard={false}
            disabled={!hasSecUnit}
            value={hasSecUnit ? record.secQty : undefined}
            placeholder={hasSecUnit ? '0' : '—'}
            addonAfter={secUnit ? <span style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{secUnit}</span> : undefined}
            onFocus={(e) => {
              const input = e.target as HTMLInputElement;
              input?.select?.();
            }}
            onKeyDown={(e) => handleBomCellKeyDown(rowIdx, 'secQty', e, hasSecUnit)}
            onChange={(val) => handleRowQtyChange(record.key, 'secQty', val || 0)}
            style={{ width: '100%' }}
          />
        );
      }
    },
    {
      title: 'Total Qty',
      key: 'qty',
      width: 150,
      render: (_: any, record: IngredientRow, rowIdx: number) => {
        const item = items.find(i => i.id === record.rawItemId);
        const priCode = item?.primaryUnit || item?.defaultUnit || record.unitId || '';
        const secCode = item?.secondaryUnit || record.secUnit || '';
        const pSize = Number(item?.qtyInPack || record.qtyInPack || 0);
        const hasSecUnit = Boolean(secCode && secCode !== priCode && pSize > 1);
        const priUnit = getUnitTitle(priCode);
        return (
          <InputNumber
            ref={getCellRef(rowIdx, 'qty')}
            min={0.0001}
            step={0.1}
            controls={false}
            keyboard={false}
            value={record.qty}
            placeholder="0"
            addonAfter={priUnit ? <span style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{priUnit}</span> : undefined}
            onFocus={(e) => {
              const input = e.target as HTMLInputElement;
              input?.select?.();
            }}
            onKeyDown={(e) => handleBomCellKeyDown(rowIdx, 'qty', e, hasSecUnit)}
            onChange={(val) => handleRowQtyChange(record.key, 'qty', val || 0)}
            style={{ width: '100%' }}
          />
        );
      }
    },
    {
      title: 'Scrap / Wastage %',
      key: 'scrapPercentage',
      width: 110,
      render: (_: any, record: IngredientRow, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'scrapPercentage')}
          min={0}
          max={100}
          controls={false}
          keyboard={false}
          value={record.scrapPercentage}
          formatter={v => `${v}%`}
          parser={v => Number(v?.replace('%', '') || 0)}
          onFocus={(e) => {
            const input = e.target as HTMLInputElement;
            input?.select?.();
          }}
          onKeyDown={(e) => handleBomCellKeyDown(rowIdx, 'scrapPercentage', e)}
          onChange={(val) => handleRowChange(record.key, 'scrapPercentage', val || 0)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Est. Rate',
      key: 'rate',
      width: 110,
      align: 'right' as const,
      render: (_: any, record: IngredientRow, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'rate')}
          min={0}
          controls={false}
          keyboard={false}
          value={record.rate}
          onFocus={(e) => {
            const input = e.target as HTMLInputElement;
            input?.select?.();
          }}
          onKeyDown={(e) => handleBomCellKeyDown(rowIdx, 'rate', e)}
          onChange={(val) => handleRowChange(record.key, 'rate', val || 0)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Total Cost',
      key: 'totalCost',
      width: 120,
      align: 'right' as const,
      render: (_: any, record: IngredientRow) => (
        <Text strong>{record.totalCost.toFixed(2)}</Text>
      )
    },
    {
      title: '',
      key: 'action',
      width: 45,
      render: (_: any, record: IngredientRow) => (
        <Popconfirm
          title="Remove ingredient?"
          onConfirm={() => handleRemoveRow(record.key)}
          okText="Yes"
          cancelText="No"
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Space align="center">
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup/bom')} />
              <ExperimentOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {isEdit ? 'Edit Formula / Bill of Materials' : 'New Formula / Bill of Materials'}
                </Title>
                <Text type="secondary">Define recipe ingredients, yields, and overhead components</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button onClick={() => navigate('/setup/bom')}>Cancel</Button>
              <Button
                ref={saveBtnRef}
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
                className="form-save-btn"
              >
                Save Recipe
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={16}>
          {/* Main Info */}
          <Col xs={24} lg={17} xl={18}>
            <Card title="Product & Formula Specification" loading={loading} style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="Formula Code"
                    name="code"
                    rules={[{ required: true, message: 'Please enter formula code' }]}
                  >
                    <Input placeholder="e.g. BOM-001" />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item
                    label="Recipe / Formula Title"
                    name="title"
                    rules={[{ required: true, message: 'Please enter title' }]}
                  >
                    <Input placeholder="e.g. Standard 1kg Bread Formula" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={10}>
                  <Form.Item
                    label="Target Finished Product"
                    name="finishedItemId"
                    rules={[{ required: true, message: 'Please select finished item' }]}
                  >
                    <Select
                      showSearch
                      placeholder="Select Finished Product"
                      {...getItemSelectProps(items)}
                      onChange={(val) => {
                        const item = items.find(i => i.id === val);
                        setFinishedItemId(val);
                        if (item) {
                          const allowed = getItemAllowedUnits(item);
                          const defUnit = item.defaultUnit || item.primaryUnit || (allowed[0]?.code);
                          form.setFieldValue('unitId', defUnit);
                        }
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item
                    label="Output Yield (Primary)"
                    name="outputQty"
                    rules={[{ required: true, message: 'Enter yield' }]}
                  >
                    <InputNumber
                      min={0.0001}
                      step={0.01}
                      precision={2}
                      controls={false}
                      style={{ width: '100%' }}
                      onChange={(v) => setOutputQty(typeof v === 'number' ? v : 0)}
                    />
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item label="Yield Unit (Item Detail)" name="unitId">
                    {(() => {
                      const curItem = items.find(i => i.id === (finishedItemId || form.getFieldValue('finishedItemId')));
                      const allowed = getItemAllowedUnits(curItem);
                      return (
                        <Select placeholder="Unit" allowClear disabled={allowed.length === 0}>
                          {allowed.map(u => (
                            <Option key={u.code} value={u.code}>{u.title}</Option>
                          ))}
                        </Select>
                      );
                    })()}
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label="Sec Yield Info">
                    {(() => {
                      const curItem = items.find(i => i.id === (finishedItemId || form.getFieldValue('finishedItemId')));
                      const pSize = Number(curItem?.qtyInPack || 0);
                      const priCode = curItem?.primaryUnit || curItem?.defaultUnit;
                      const secCode = curItem?.secondaryUnit;
                      const hasSec = Boolean(secCode && secCode !== priCode && pSize > 1);
                      if (hasSec) {
                        const secVal = (outputQty / pSize).toFixed(2);
                        return <Tag color="blue" style={{ marginTop: 4 }}>≈ {secVal} {getUnitTitle(secCode)}</Tag>;
                      }
                      return <Text type="secondary" style={{ display: 'inline-block', marginTop: 4 }}>—</Text>;
                    })()}
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="Default Recipe" name="isDefault" valuePropName="checked">
                    <Switch checkedChildren="Yes" unCheckedChildren="No" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Active" name="isActive" valuePropName="checked">
                    <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Notes / Method Instructions" name="notes">
                    <TextArea rows={2} placeholder="Optional mixing instructions or notes" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Ingredients Table */}
            <Card
              title={
                <Space>
                  <ExperimentOutlined />
                  <span>Components & Raw Materials</span>
                </Space>
              }
              extra={
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddRow}>
                  Add Ingredient
                </Button>
              }
              loading={loading}
            >
              <Table
                dataSource={ingredients}
                columns={columns}
                rowKey="key"
                pagination={false}
                bordered
                size="small"
                scroll={{ x: 1040 }}
                locale={{ emptyText: 'No ingredients added yet. Click "Add Ingredient" above.' }}
              />
            </Card>

            {/* Manufacturing Expenses & Overheads Table */}
            <Card
              title={
                <Space>
                  <DollarOutlined />
                  <span>Manufacturing Expenses & Overheads (Per Account)</span>
                </Space>
              }
              extra={
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddExpenseRow}>
                  Add Expense
                </Button>
              }
              loading={loading}
              style={{ marginTop: 16 }}
            >
              <Table
                dataSource={expenses}
                rowKey="key"
                pagination={false}
                bordered
                size="small"
                scroll={{ x: 820 }}
                locale={{ emptyText: 'No manufacturing expenses added. Click "Add Expense" to add Packing, Labor, Utilities, etc.' }}
                columns={[
                  {
                    title: '#',
                    key: 'seq',
                    width: 45,
                    render: (_: any, __: any, index: number) => index + 1
                  },
                  {
                    title: 'Expense Account',
                    key: 'accountId',
                    width: 240,
                    render: (_: any, record: BomExpenseRow) => (
                      <Select
                        showSearch
                        allowClear
                        placeholder="Select Expense Account"
                        value={record.accountId || undefined}
                        onChange={(val) => handleExpenseChange(record.key, 'accountId', val)}
                        optionFilterProp="label"
                        options={expenseAccounts.map(a => ({
                          value: a.account,
                          label: `${a.account} - ${a.title}`
                        }))}
                        style={{ width: '100%' }}
                      />
                    )
                  },
                  {
                    title: 'Expense Description',
                    key: 'title',
                    width: 180,
                    render: (_: any, record: BomExpenseRow) => (
                      <Input
                        placeholder="e.g. Packing, Labor"
                        value={record.title}
                        onChange={(e) => handleExpenseChange(record.key, 'title', e.target.value)}
                      />
                    )
                  },
                  {
                    title: 'Calculation Basis',
                    key: 'calculationType',
                    width: 150,
                    render: (_: any, record: BomExpenseRow) => (
                      <Select
                        value={record.calculationType}
                        onChange={(val) => handleExpenseChange(record.key, 'calculationType', val)}
                        style={{ width: '100%' }}
                      >
                        <Option value="PerUnit">Per Unit (Qty)</Option>
                        <Option value="LumpSum">Lump Sum (Batch)</Option>
                        <Option value="PercentOfMaterial">% of Material</Option>
                      </Select>
                    )
                  },
                  {
                    title: 'Rate / Value',
                    key: 'rate',
                    width: 120,
                    render: (_: any, record: BomExpenseRow) => (
                      <InputNumber
                        min={0}
                        step={1}
                        controls={false}
                        value={record.rate}
                        onChange={(val) => handleExpenseChange(record.key, 'rate', val || 0)}
                        prefix={record.calculationType === 'PercentOfMaterial' ? undefined : 'Rs.'}
                        suffix={record.calculationType === 'PercentOfMaterial' ? '%' : undefined}
                        style={{ width: '100%' }}
                      />
                    )
                  },
                  {
                    title: 'Est. Amount',
                    key: 'estimatedAmount',
                    width: 115,
                    align: 'right' as const,
                    render: (_: any, record: BomExpenseRow) => (
                      <Text strong>{calcBomExpenseAmount(record, outputQty, totalMaterialCost).toFixed(2)}</Text>
                    )
                  },
                  {
                    title: '',
                    key: 'action',
                    width: 45,
                    render: (_: any, record: BomExpenseRow) => (
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveExpenseRow(record.key)} />
                    )
                  }
                ]}
              />
            </Card>
          </Col>

          {/* Costing & Overheads Side Card */}
          <Col xs={24} lg={7} xl={6}>
            <Card
              title={
                <Space>
                  <CalculatorOutlined />
                  <span style={{ fontSize: 15 }}>Cost Breakdown & Absorption</span>
                </Space>
              }
              loading={loading}
              style={{ position: 'sticky', top: 20 }}
            >
              {expenses.length > 0 ? (
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    Configured Expenses ({expenses.length})
                  </Text>
                  {expenses.map(exp => {
                    const amt = calcBomExpenseAmount(exp, outputQty, totalMaterialCost);
                    return (
                      <div key={exp.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 13 }}>
                        <Space size={4} style={{ maxWidth: '68%', overflow: 'hidden' }}>
                          <Text ellipsis>{exp.title || 'Unnamed'}</Text>
                          <Tag color={exp.calculationType === 'LumpSum' ? 'purple' : exp.calculationType === 'PercentOfMaterial' ? 'cyan' : 'blue'} style={{ fontSize: 10, margin: 0 }}>
                            {exp.calculationType === 'LumpSum' ? 'Lump' : exp.calculationType === 'PercentOfMaterial' ? `${exp.rate}%` : `${exp.rate}/u`}
                          </Tag>
                        </Space>
                        <Text strong>Rs. {amt.toFixed(2)}</Text>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                  Add Packing, Labor, or Utility expenses in the table below ingredients to allocate costs to separate GL accounts.
                </Text>
              )}

              <Divider style={{ margin: '14px 0' }} />

              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Statistic
                    title="Raw Materials"
                    value={totalMaterialCost}
                    precision={2}
                    valueStyle={{ fontSize: 15 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Total Overheads"
                    value={totalOverheadCost}
                    precision={2}
                    valueStyle={{ fontSize: 15 }}
                  />
                </Col>
                <Col span={24}>
                  <Card style={{ backgroundColor: '#fafafa', borderColor: '#d9d9d9' }} size="small">
                    <Statistic
                      title="Estimated Batch Cost"
                      value={grandTotalCost}
                      precision={2}
                      valueStyle={{ color: '#1677ff', fontSize: 18, fontWeight: 'bold' }}
                    />
                    <div style={{ marginTop: 6 }}>
                      <Text type="secondary">Yield: </Text>
                      <Text strong>{Number(outputQty || 0).toFixed(2)} {getUnitTitle(watchedUnitId, false) || 'units'}</Text>
                    </div>
                    <Divider style={{ margin: '8px 0' }} />
                    <Statistic
                      title={`Est. Cost per ${getUnitTitle(watchedUnitId, false) || 'Unit'}`}
                      value={unitProductionCost}
                      precision={2}
                      valueStyle={{ color: '#52c41a', fontSize: 20, fontWeight: 'bold' }}
                    />
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};
