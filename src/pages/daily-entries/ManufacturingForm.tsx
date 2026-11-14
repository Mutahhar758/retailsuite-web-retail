import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Card, Form, Input, InputNumber, Button, Space, Typography, 
  Select, DatePicker, Table, Row, Col, Divider, message, Popconfirm, 
  Statistic, Tag, Alert 
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined, 
  SettingOutlined, CheckCircleOutlined, ClockCircleOutlined, 
  ThunderboltOutlined, SyncOutlined 
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { 
  manufacturingService, 
  type ProductionCreateOrUpdateRequest, 
  ProductionStatusEnum, 
  type ProductionStatus 
} from '../../services/manufacturingService';
import { bomService, type BomResponse } from '../../services/bomService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { getItemSelectProps } from '../../utils/itemSelectOptions';
import { unitService, type UnitDto } from '../../services/unitService';
import { narrationService, type NarrationDto } from '../../services/narrationService';
import { 
  getSelectablePrimaryUnits, 
  toBasePrimaryQty, 
  resolveDisplayQtyAndUnit 
} from '../../utils/unitConversion';
import { useGridKeyboard, closeOpenSelectDropdowns } from '../../hooks/useGridKeyboard';

const { Title, Text } = Typography;
const { Option } = Select;

interface ProductionLineRow {
  key: string;
  seq: number;
  rawItemId: string;
  rawItemTitle?: string;
  plannedQty: number;
  primaryQty: number;
  displayPrimaryQty?: number;
  selectedUnitId?: string;
  selectedUnitFactor?: number;
  secQty: number;
  actualQty: number;
  unitId?: string;
  secUnit?: string;
  qtyInPack?: number;
  unitCost: number;
  totalCost: number;
  availableStock: number;
  isIssued: boolean;
}

const createEmptyRow = (seq: number): ProductionLineRow => ({
  key: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  seq,
  rawItemId: '',
  plannedQty: 1,
  primaryQty: 1,
  displayPrimaryQty: 1,
  selectedUnitFactor: 1,
  secQty: 0,
  actualQty: 1,
  unitCost: 0,
  totalCost: 0,
  availableStock: 0,
  isIssued: true
});

interface MaterialItemSelectCellProps {
  rowIdx: number;
  isLastRow: boolean;
  record: ProductionLineRow;
  items: Item[];
  getCellRef: (rowIdx: number, colKey: string) => React.RefObject<any>;
  onSelectItem: (rawItemId: string, key: string, rowIdx: number) => void;
  focusCell: (rowIdx: number, colKey: string) => void;
  onEmptyLastRowExit: () => void;
  onNavigateCellKeyDown: (rowIdx: number, colKey: string, e: React.KeyboardEvent) => void;
}

const MaterialItemSelectCell: React.FC<MaterialItemSelectCellProps> = ({
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
      placeholder="Select Raw Material"
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

export const ManufacturingForm: React.FC = () => {
  const { voucherNo } = useParams<{ voucherNo: string }>();
  const isEdit = Boolean(voucherNo && voucherNo !== 'new');
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [availableBoms, setAvailableBoms] = useState<BomResponse[]>([]);
  const [lines, setLines] = useState<ProductionLineRow[]>(() => (isEdit ? [] : [createEmptyRow(1)]));
  const [finishedItemId, setFinishedItemId] = useState<string>('');

  const pendingFocusRef = useRef<{ rowIdx: number; colKey: string } | null>(null);
  const laborCostRef = useRef<any>(null);
  const overheadCostRef = useRef<any>(null);
  const packagingCostRef = useRef<any>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  // Overhead & Production values
  const [targetQty, setTargetQty] = useState<number>(1);
  const [producedQty, setProducedQty] = useState<number>(1);
  const [laborCost, setLaborCost] = useState<number>(0);
  const [overheadCost, setOverheadCost] = useState<number>(0);
  const [packagingCost, setPackagingCost] = useState<number>(0);
  const [currentStatus, setCurrentStatus] = useState<ProductionStatus>(ProductionStatusEnum.Completed);
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

  // Load existing voucher if edit mode
  const fetchVoucher = useCallback(async (currentItems: Item[], currentUnits: UnitDto[]) => {
    if (!isEdit || !voucherNo) {
      form.setFieldsValue({
        date: dayjs(),
        targetQty: 1,
        producedQty: 1,
        laborCost: 0,
        overheadCost: 0,
        packagingCost: 0,
        status: ProductionStatusEnum.Completed
      });
      return;
    }

    try {
      setLoading(true);
      const data = await manufacturingService.getDetail(voucherNo);
      form.setFieldsValue({
        date: dayjs(data.date),
        bomMasterId: data.bomMasterId,
        finishedItemId: data.finishedItemId,
        targetQty: data.targetQty,
        producedQty: data.producedQty,
        unitId: data.unitId,
        batchNo: data.batchNo,
        expiryDate: data.expiryDate ? dayjs(data.expiryDate) : undefined,
        laborCost: data.totalOverheadCost ? (data.totalOverheadCost / 3) : 0, // split placeholder
        overheadCost: 0,
        packagingCost: 0,
        narration: data.narrationId,
        remarks: data.remarks,
        status: data.status,
        currentStage: data.currentStage
      });

      setFinishedItemId(data.finishedItemId);
      setTargetQty(data.targetQty);
      setProducedQty(data.producedQty);
      setCurrentStatus(data.status);

      // Load BOMs for this item
      if (data.finishedItemId) {
        const boms = await bomService.getList({ finishedItemId: data.finishedItemId });
        setAvailableBoms(boms);
      }

      const rows: ProductionLineRow[] = data.lines.map((l, index) => {
        const item = currentItems.find(i => i.id === l.rawItemId);
        const pSize = Number(item?.qtyInPack || 0);
        const priUnit = item?.primaryUnit || item?.defaultUnit;
        const secUnit = item?.secondaryUnit;
        const hasSec = Boolean(secUnit && secUnit !== priUnit && pSize > 1);
        const secQty = hasSec && pSize > 0 ? Math.floor(l.actualQty / pSize) : 0;
        const rawBasePrimaryQty = hasSec && pSize > 0 ? Math.round((l.actualQty - (secQty * pSize)) * 10000) / 10000 : l.actualQty;

        const resolved = resolveDisplayQtyAndUnit(rawBasePrimaryQty, item, currentUnits as any);

        return {
          key: `row-${index}`,
          seq: l.seq,
          rawItemId: l.rawItemId,
          rawItemTitle: l.rawItemTitle,
          plannedQty: l.plannedQty,
          primaryQty: rawBasePrimaryQty,
          displayPrimaryQty: resolved.displayQty,
          selectedUnitId: resolved.selectedUnitId,
          selectedUnitFactor: resolved.factor,
          secQty,
          actualQty: l.actualQty,
          unitId: l.unitId || item?.defaultUnit || item?.primaryUnit,
          secUnit: item?.secondaryUnit,
          qtyInPack: pSize,
          unitCost: l.unitCost,
          totalCost: l.totalCost,
          availableStock: l.availableStock,
          isIssued: l.isIssued
        };
      });
      const nextSeq = rows.length > 0 ? Math.max(...rows.map(r => r.seq)) + 1 : 1;
      setLines([...rows, createEmptyRow(nextSeq)]);
    } catch (err) {
      message.error('Failed to load manufacturing voucher');
    } finally {
      setLoading(false);
    }
  }, [isEdit, voucherNo, form]);

  // Lookups
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [itemList, unitList, narrationList] = await Promise.all([
          inventoryService.getItemsLookup(),
          unitService.getActiveUnits(),
          narrationService.getActiveNarrations()
        ]);
        const validItems = itemList || [];
        const validUnits = unitList || [];
        setItems(validItems);
        setUnits(validUnits);
        setNarrations(narrationList || []);
        fetchVoucher(validItems, validUnits);
      } catch (err) {
        message.error('Failed to load item and unit lookups');
      }
    };
    loadLookups();
  }, [fetchVoucher]);

  // When Finished Item is selected, fetch associated BOMs and auto-apply default
  const handleFinishedItemChange = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    setFinishedItemId(itemId);
    if (item) {
      const allowed = getItemAllowedUnits(item);
      const defUnit = item.defaultUnit || item.primaryUnit || (allowed[0]?.code);
      form.setFieldValue('unitId', defUnit);
    }

    try {
      const boms = await bomService.getList({ finishedItemId: itemId, isActive: true });
      setAvailableBoms(boms);

      const defaultBom = boms.find(b => b.isDefault) || boms[0];
      if (defaultBom) {
        form.setFieldValue('bomMasterId', defaultBom.id);
        applyBomEstimate(defaultBom.id, itemId, form.getFieldValue('targetQty') || 1);
      } else {
        form.setFieldValue('bomMasterId', undefined);
      }
    } catch (err) {
      message.error('Failed to load recipes for selected product');
    }
  };

  // Apply recipe estimate
  const applyBomEstimate = async (bomId: number | undefined, itemId: string, qty: number) => {
    if (!itemId || qty <= 0) return;
    try {
      const estimate = await manufacturingService.calculateEstimate({
        bomMasterId: bomId,
        finishedItemId: itemId,
        targetQty: qty
      });

      setLaborCost(estimate.estimatedLaborCost || 0);
      setOverheadCost(estimate.estimatedOverheadCost || 0);
      setPackagingCost(estimate.estimatedPackagingCost || 0);
      form.setFieldsValue({
        laborCost: estimate.estimatedLaborCost || 0,
        overheadCost: estimate.estimatedOverheadCost || 0,
        packagingCost: estimate.estimatedPackagingCost || 0
      });

      const newRows: ProductionLineRow[] = estimate.lines.map((l, index) => {
        const item = items.find(i => i.id === l.rawItemId);
        const pSize = Number(item?.qtyInPack || 0);
        const priUnit = item?.primaryUnit || item?.defaultUnit;
        const secUnit = item?.secondaryUnit;
        const hasSec = Boolean(secUnit && secUnit !== priUnit && pSize > 1);
        const secQty = hasSec && pSize > 0 ? Math.floor(l.requiredQty / pSize) : 0;
        const rawBasePrimaryQty = hasSec && pSize > 0 ? Math.round((l.requiredQty - (secQty * pSize)) * 10000) / 10000 : l.requiredQty;

        const resolved = resolveDisplayQtyAndUnit(rawBasePrimaryQty, item, units as any);

        return {
          key: `est-${index}`,
          seq: l.seq,
          rawItemId: l.rawItemId,
          rawItemTitle: l.rawItemTitle,
          plannedQty: l.requiredQty,
          primaryQty: rawBasePrimaryQty,
          displayPrimaryQty: resolved.displayQty,
          selectedUnitId: resolved.selectedUnitId,
          selectedUnitFactor: resolved.factor,
          secQty,
          actualQty: l.requiredQty,
          unitId: l.unitId || item?.defaultUnit || item?.primaryUnit,
          secUnit: item?.secondaryUnit,
          qtyInPack: pSize,
          unitCost: l.estimatedUnitCost,
          totalCost: l.estimatedTotalCost,
          availableStock: l.availableStock,
          isIssued: true
        };
      });
      const nextSeq = newRows.length > 0 ? Math.max(...newRows.map(r => r.seq)) + 1 : 1;
      setLines([...newRows, createEmptyRow(nextSeq)]);
    } catch (err: any) {
      message.warning('Could not calculate estimate from recipe');
    }
  };

  const handleTargetQtyChange = (val: number | null) => {
    const newQty = typeof val === 'number' ? val : 0;
    setTargetQty(newQty);
    setProducedQty(newQty);
    form.setFieldValue('producedQty', newQty);

    const bomId = form.getFieldValue('bomMasterId');
    const itemId = form.getFieldValue('finishedItemId');
    if (bomId && itemId && newQty > 0) {
      applyBomEstimate(bomId, itemId, newQty);
    }
  };

  const handleRowUnitChange = (key: string, newUnitId: string) => {
    setLines(prev => prev.map(row => {
      if (row.key === key) {
        const item = items.find(i => i.id === row.rawItemId);
        const selectable = getSelectablePrimaryUnits(item, units as any);
        const newOpt = selectable.find(u => u.unitId === newUnitId);
        const newFactor = newOpt?.factor || 1;

        const currentBasePrimaryQty = row.primaryQty ?? 0;
        const newDisplayQty = Number((currentBasePrimaryQty * newFactor).toFixed(4));

        return {
          ...row,
          selectedUnitId: newUnitId,
          selectedUnitFactor: newFactor,
          displayPrimaryQty: newDisplayQty
        };
      }
      return row;
    }));
  };

  const handleRowQtyChange = (key: string, field: 'primaryQty' | 'secQty' | 'actualQty', val: number) => {
    setLines(prev => prev.map(row => {
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
        let actualQty = row.actualQty ?? 0;

        if (field === 'primaryQty') {
          displayPrimaryQty = val;
          primaryQty = toBasePrimaryQty(val, factor);
          actualQty = hasSec && pSize > 0 ? (primaryQty + (secQty * pSize)) : primaryQty;
        } else if (field === 'secQty') {
          secQty = val;
          actualQty = hasSec && pSize > 0 ? (primaryQty + (val * pSize)) : (primaryQty || val);
        } else if (field === 'actualQty') {
          actualQty = val;
          if (hasSec && pSize > 0) {
            secQty = Math.floor(val / pSize);
            primaryQty = Math.round((val - (secQty * pSize)) * 10000) / 10000;
          } else {
            primaryQty = val;
            secQty = 0;
          }
          displayPrimaryQty = Number((primaryQty * factor).toFixed(4));
        }

        const totalCost = Math.round(actualQty * (row.unitCost || 0) * 100) / 100;
        return {
          ...row,
          primaryQty,
          displayPrimaryQty,
          secQty,
          actualQty,
          totalCost
        };
      }
      return row;
    }));
  };

  const handleRowChange = (key: string, field: keyof ProductionLineRow, val: any) => {
    setLines(prev => prev.map(row => {
      if (row.key === key) {
        const updated = { ...row, [field]: val };
        if (field === 'actualQty' || field === 'unitCost') {
          updated.totalCost = Math.round((updated.actualQty || 0) * (updated.unitCost || 0) * 100) / 100;
        }
        return updated;
      }
      return row;
    }));
  };

  const focusSummaryCard = useCallback(() => {
    closeOpenSelectDropdowns();
    const doFocus = () => {
      if (laborCostRef.current?.focus) {
        laborCostRef.current.focus();
        laborCostRef.current.select?.();
      } else {
        const el = document.querySelector<HTMLInputElement>('.mfg-summary-labor input');
        el?.focus();
        el?.select?.();
      }
    };
    doFocus();
    requestAnimationFrame(doFocus);
  }, []);

  const handleAddRow = useCallback(() => {
    setLines(prev => {
      const newSeq = prev.length > 0 ? Math.max(...prev.map(r => r.seq)) + 1 : 1;
      return [...prev, createEmptyRow(newSeq)];
    });
  }, []);

  const { getCellRef, handleCellKeyDown, focusCell } = useGridKeyboard({
    rowCount: lines.length,
    enterCols: ['itemId', 'primaryQty', 'secQty', 'actualQty', 'unitCost'],
    arrowCols: ['itemId', 'primaryQty', 'secQty', 'actualQty', 'unitCost'],
    firstColKey: 'itemId',
    onAddRow: handleAddRow,
    pendingFocusRef,
    isRowValid: (idx) => Boolean(lines[idx]?.rawItemId),
    onSave: focusSummaryCard,
  });

  const handleMfgCellKeyDown = useCallback(
    (rowIdx: number, colKey: string, e: React.KeyboardEvent, hasSecUnit?: boolean) => {
      const isLastEmptyRow = rowIdx === lines.length - 1 && !lines[rowIdx]?.rawItemId;
      if (e.key === 'Enter' && isLastEmptyRow) {
        e.preventDefault();
        e.stopPropagation();
        focusSummaryCard();
        return;
      }

      if (colKey === 'primaryQty' && !hasSecUnit && (e.key === 'Enter' || e.key === 'ArrowRight')) {
        e.preventDefault();
        e.stopPropagation();
        focusCell(rowIdx, 'actualQty');
        return;
      }

      if (colKey === 'actualQty' && !hasSecUnit && e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        focusCell(rowIdx, 'primaryQty');
        return;
      }

      handleCellKeyDown(rowIdx, colKey, e);
    },
    [lines, focusSummaryCard, focusCell, handleCellKeyDown],
  );

  const handleMaterialSelect = (rawItemId: string, key: string, rowIdx: number) => {
    const item = items.find(i => i.id === rawItemId);
    const rate = item ? (item.priRate || item.opnRate || 0) : 0;
    const allowed = getItemAllowedUnits(item);
    const unit = item ? (item.defaultUnit || item.primaryUnit || allowed[0]?.code) : undefined;
    const pSize = Number(item?.qtyInPack || 0);
    const selectable = getSelectablePrimaryUnits(item, units as any);
    const primaryOpt = selectable[0];

    setLines(prev => {
      const isLastRow = prev.length > 0 && prev[prev.length - 1].key === key;
      const updatedRows = prev.map(row => {
        if (row.key === key) {
          return {
            ...row,
            rawItemId,
            unitCost: rate,
            unitId: unit,
            secUnit: item?.secondaryUnit,
            qtyInPack: pSize,
            primaryQty: 1,
            displayPrimaryQty: 1,
            selectedUnitId: primaryOpt?.unitId || unit,
            selectedUnitFactor: primaryOpt?.factor || 1,
            secQty: 0,
            actualQty: 1,
            totalCost: rate
          };
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

  const handleRemoveRow = (key: string) => {
    setLines(prev => {
      const remaining = prev.filter(r => r.key !== key);
      return remaining.length > 0 ? remaining : [createEmptyRow(1)];
    });
  };

  // Total Calculations
  const totalMaterialCost = lines.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const totalOverheadCost = (laborCost || 0) + (overheadCost || 0) + (packagingCost || 0);
  const grandTotalCost = totalMaterialCost + totalOverheadCost;
  const unitProductionCost = producedQty > 0 ? grandTotalCost / producedQty : 0;
  const hasShortage = lines.some(r => Boolean(r.rawItemId) && r.availableStock < r.actualQty);

  const submitWithStatus = async (status: ProductionStatus) => {
    try {
      const values = await form.validateFields();
      const filledLines = lines.filter(r => Boolean(r.rawItemId));
      if (filledLines.length === 0) {
        message.error('Please add at least one consumed material.');
        return;
      }

      const invalidLine = filledLines.find(r => r.actualQty <= 0);
      if (invalidLine) {
        message.error('Please ensure all consumed materials have valid item selection and quantity > 0.');
        return;
      }

      const payload: ProductionCreateOrUpdateRequest = {
        date: values.date.format('YYYY-MM-DD'),
        bomMasterId: values.bomMasterId,
        finishedItemId: values.finishedItemId,
        targetQty: values.targetQty || 1,
        producedQty: values.producedQty || 1,
        unitId: values.unitId,
        batchNo: values.batchNo,
        expiryDate: values.expiryDate ? values.expiryDate.format('YYYY-MM-DD') : undefined,
        laborCost: values.laborCost || 0,
        overheadCost: values.overheadCost || 0,
        packagingCost: values.packagingCost || 0,
        narration: values.narration,
        remarks: values.remarks,
        status: status,
        currentStage: status === ProductionStatusEnum.InProgress ? 'Material Issued' : status === ProductionStatusEnum.Completed ? 'Completed' : 'Planned',
        lines: filledLines.map((r, i) => ({
          seq: i + 1,
          rawItemId: r.rawItemId,
          plannedQty: r.plannedQty || r.actualQty,
          actualQty: r.actualQty,
          unitId: r.unitId,
          unitCost: r.unitCost,
          totalCost: r.totalCost,
          isIssued: status === ProductionStatusEnum.InProgress || status === ProductionStatusEnum.Completed
        }))
      };

      setSaving(true);
      if (isEdit && voucherNo) {
        await manufacturingService.update(voucherNo, payload);
        message.success(`Manufacturing voucher ${voucherNo} updated successfully`);
      } else {
        const newVoucherNo = await manufacturingService.create(payload);
        message.success(`Manufacturing voucher ${newVoucherNo} created successfully`);
      }
      navigate('/daily-entries/manufacturing');
    } catch (err: any) {
      if (err?.errorFields) return; // Form validation failed
      message.error(err?.response?.data?.metadata?.message || 'Failed to save manufacturing voucher');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '#',
      dataIndex: 'seq',
      key: 'seq',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1
    },
    {
      title: 'Raw Material / Ingredient',
      key: 'rawItemId',
      width: 250,
      render: (_: any, record: ProductionLineRow, rowIdx: number) => (
        <MaterialItemSelectCell
          rowIdx={rowIdx}
          isLastRow={rowIdx === lines.length - 1}
          record={record}
          items={items}
          getCellRef={getCellRef}
          onSelectItem={handleMaterialSelect}
          focusCell={focusCell}
          onEmptyLastRowExit={focusSummaryCard}
          onNavigateCellKeyDown={handleMfgCellKeyDown}
        />
      )
    },
    {
      title: 'Planned Qty',
      key: 'plannedQty',
      width: 130,
      align: 'right' as const,
      render: (_: any, record: ProductionLineRow) => {
        const uTitle = getUnitTitle(record.unitId);
        return (
          <Space size={4}>
            <Text type="secondary">{record.plannedQty?.toFixed(2) || '0.00'}</Text>
            {uTitle && <Text type="secondary" style={{ fontSize: '11px' }}>{uTitle}</Text>}
          </Space>
        );
      }
    },
    {
      title: 'Primary Qty',
      key: 'primaryQty',
      width: 175,
      render: (_: any, record: ProductionLineRow, rowIdx: number) => {
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
            onFocus={(e) => (e.target as HTMLInputElement)?.select?.()}
            onKeyDown={(e) => handleMfgCellKeyDown(rowIdx, 'primaryQty', e, hasSecUnit)}
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
      render: (_: any, record: ProductionLineRow, rowIdx: number) => {
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
            onFocus={(e) => (e.target as HTMLInputElement)?.select?.()}
            onKeyDown={(e) => handleMfgCellKeyDown(rowIdx, 'secQty', e, hasSecUnit)}
            onChange={(val) => handleRowQtyChange(record.key, 'secQty', val || 0)}
            style={{ width: '100%' }}
          />
        );
      }
    },
    {
      title: 'Actual Consumed',
      key: 'actualQty',
      width: 150,
      render: (_: any, record: ProductionLineRow, rowIdx: number) => {
        const item = items.find(i => i.id === record.rawItemId);
        const priCode = item?.primaryUnit || item?.defaultUnit || record.unitId || '';
        const secCode = item?.secondaryUnit || record.secUnit || '';
        const pSize = Number(item?.qtyInPack || record.qtyInPack || 0);
        const hasSecUnit = Boolean(secCode && secCode !== priCode && pSize > 1);
        const priUnit = getUnitTitle(priCode);
        return (
          <InputNumber
            ref={getCellRef(rowIdx, 'actualQty')}
            min={0.0001}
            step={0.1}
            controls={false}
            keyboard={false}
            value={record.actualQty}
            placeholder="0"
            addonAfter={priUnit ? <span style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{priUnit}</span> : undefined}
            onFocus={(e) => (e.target as HTMLInputElement)?.select?.()}
            onKeyDown={(e) => handleMfgCellKeyDown(rowIdx, 'actualQty', e, hasSecUnit)}
            onChange={(val) => handleRowQtyChange(record.key, 'actualQty', val || 0)}
            style={{ width: '100%' }}
          />
        );
      }
    },
    {
      title: 'Stock Available',
      key: 'availableStock',
      width: 135,
      align: 'right' as const,
      render: (_: any, record: ProductionLineRow) => {
        const isShort = record.availableStock < record.actualQty;
        const uTitle = getUnitTitle(record.unitId);
        return (
          <Tag color={isShort ? 'error' : 'default'}>
            {record.availableStock?.toFixed(2)} {uTitle}
          </Tag>
        );
      }
    },
    {
      title: 'Unit Cost',
      key: 'unitCost',
      width: 115,
      align: 'right' as const,
      render: (_: any, record: ProductionLineRow, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'unitCost')}
          min={0}
          controls={false}
          keyboard={false}
          value={record.unitCost}
          onFocus={(e) => (e.target as HTMLInputElement)?.select?.()}
          onKeyDown={(e) => handleMfgCellKeyDown(rowIdx, 'unitCost', e)}
          onChange={(val) => handleRowChange(record.key, 'unitCost', val || 0)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Total Cost',
      key: 'totalCost',
      width: 120,
      align: 'right' as const,
      render: (_: any, record: ProductionLineRow) => (
        <Text strong>{(record.totalCost || 0).toFixed(2)}</Text>
      )
    },
    {
      title: '',
      key: 'action',
      width: 45,
      render: (_: any, record: ProductionLineRow) => (
        <Popconfirm
          title="Remove component?"
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
      <Form form={form} layout="vertical">
        <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Space align="center">
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/manufacturing')} />
              <SettingOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {isEdit ? `Edit Manufacturing Voucher (${voucherNo})` : 'New Manufacturing / Assembly Run'}
                  <Tag color={currentStatus === ProductionStatusEnum.Completed ? 'green' : currentStatus === ProductionStatusEnum.InProgress ? 'orange' : 'blue'} style={{ marginLeft: 8 }}>
                    {currentStatus}
                  </Tag>
                </Title>
                <Text type="secondary">Issue materials to WIP or complete finished goods batch</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Button onClick={() => navigate('/daily-entries/manufacturing')}>Cancel</Button>
              
              <Button 
                onClick={() => submitWithStatus(ProductionStatusEnum.Planned)}
                loading={saving}
              >
                Save as Planned
              </Button>

              <Button 
                type="primary" 
                ghost
                icon={<ClockCircleOutlined />} 
                onClick={() => submitWithStatus(ProductionStatusEnum.InProgress)}
                loading={saving}
              >
                Issue to WIP
              </Button>

              <Button 
                ref={saveBtnRef}
                type="primary" 
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                icon={<CheckCircleOutlined />} 
                onClick={() => submitWithStatus(ProductionStatusEnum.Completed)}
                loading={saving}
                className="form-save-btn"
              >
                Complete Production
              </Button>
            </Space>
          </Col>
        </Row>

        {hasShortage && (
          <Alert
            message="Raw Material Shortage Warning"
            description="One or more ingredients have current stock balances lower than the required consumption amount. You can still proceed if your configuration allows negative stock."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Row gutter={16}>
          {/* Main Form Fields */}
          <Col xs={24} lg={17} xl={18}>
            <Card title="Production Specification" loading={loading} style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item
                    label="Voucher Date"
                    name="date"
                    rules={[{ required: true, message: 'Please select date' }]}
                  >
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item
                    label="Finished Good Product"
                    name="finishedItemId"
                    rules={[{ required: true, message: 'Select product to manufacture' }]}
                  >
                    <Select
                      showSearch
                      placeholder="Select Finished Product"
                      onChange={handleFinishedItemChange}
                      {...getItemSelectProps(items)}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Formula / Recipe (BOM)" name="bomMasterId">
                    <Select
                      placeholder="Select Recipe"
                      allowClear
                      onChange={(bomId) => {
                        const itemId = form.getFieldValue('finishedItemId');
                        applyBomEstimate(bomId, itemId, targetQty);
                      }}
                    >
                      {availableBoms.map(b => (
                        <Option key={b.id} value={b.id}>
                          {b.title} {b.isDefault ? '(Default)' : ''}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item
                    label="Target Batch Qty"
                    name="targetQty"
                    rules={[{ required: true, message: 'Enter target qty' }]}
                    extra={(() => {
                      const curItem = items.find(i => i.id === (finishedItemId || form.getFieldValue('finishedItemId')));
                      const pSize = Number(curItem?.qtyInPack || 0);
                      const priCode = curItem?.primaryUnit || curItem?.defaultUnit;
                      const secCode = curItem?.secondaryUnit;
                      const hasSec = Boolean(secCode && secCode !== priCode && pSize > 1);
                      if (hasSec) {
                        return <Text type="secondary" style={{ fontSize: '11px' }}>≈ {(targetQty / pSize).toFixed(2)} {getUnitTitle(secCode)}</Text>;
                      }
                      return null;
                    })()}
                  >
                    <InputNumber
                      min={0.0001}
                      step={0.01}
                      precision={2}
                      controls={false}
                      style={{ width: '100%' }}
                      onChange={handleTargetQtyChange}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="Actual Produced Qty"
                    name="producedQty"
                    rules={[{ required: true, message: 'Enter produced qty' }]}
                    extra={(() => {
                      const curItem = items.find(i => i.id === (finishedItemId || form.getFieldValue('finishedItemId')));
                      const pSize = Number(curItem?.qtyInPack || 0);
                      const priCode = curItem?.primaryUnit || curItem?.defaultUnit;
                      const secCode = curItem?.secondaryUnit;
                      const hasSec = Boolean(secCode && secCode !== priCode && pSize > 1);
                      if (hasSec) {
                        return <Text type="secondary" style={{ fontSize: '11px' }}>≈ {(producedQty / pSize).toFixed(2)} {getUnitTitle(secCode)}</Text>;
                      }
                      return null;
                    })()}
                  >
                    <InputNumber
                      min={0.0001}
                      step={0.01}
                      precision={2}
                      controls={false}
                      style={{ width: '100%' }}
                      onChange={(v) => setProducedQty(typeof v === 'number' ? v : 0)}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Output Unit (Item Detail)" name="unitId">
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
                <Col span={6}>
                  <Form.Item label="Batch / Lot #" name="batchNo">
                    <Input placeholder="e.g. BATCH-2026-10" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="Expiry Date" name="expiryDate">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Narration / Department" name="narration">
                    <Select placeholder="Select Narration" allowClear>
                      {narrations.map(n => (
                        <Option key={n.code} value={n.code}>{n.title}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item label="Remarks / Production Notes" name="remarks">
                    <Input placeholder="Additional batch notes" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Consumed Raw Materials Table */}
            <Card
              title={
                <Space>
                  <ThunderboltOutlined />
                  <span>Consumed Raw Materials & Components</span>
                </Space>
              }
              extra={
                <Space>
                  <Button
                    type="link"
                    icon={<SyncOutlined />}
                    onClick={() => {
                      const bomId = form.getFieldValue('bomMasterId');
                      const itemId = form.getFieldValue('finishedItemId');
                      applyBomEstimate(bomId, itemId, targetQty);
                    }}
                  >
                    Reset from Recipe
                  </Button>
                  <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddRow}>
                    Add Material
                  </Button>
                </Space>
              }
              loading={loading}
            >
              <Table
                dataSource={lines}
                columns={columns}
                rowKey="key"
                pagination={false}
                bordered
                size="small"
                scroll={{ x: 1060 }}
                locale={{ emptyText: 'No materials added. Select a finished product and recipe above.' }}
              />
            </Card>
          </Col>

          {/* Overheads & Unit Cost Side Panel */}
          <Col xs={24} lg={7} xl={6}>
            <Card
              title="Batch Costs & Valuation"
              loading={loading}
              style={{ position: 'sticky', top: 20 }}
            >
              <Form.Item label="Direct Labor Allocated" name="laborCost" className="mfg-summary-labor">
                <InputNumber
                  ref={laborCostRef}
                  min={0}
                  step={10}
                  controls={false}
                  style={{ width: '100%' }}
                  onFocus={(e) => (e.target as HTMLInputElement)?.select?.()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      overheadCostRef.current?.focus();
                      overheadCostRef.current?.select?.();
                    }
                  }}
                  onChange={(v) => setLaborCost(v || 0)}
                  prefix="Rs."
                />
              </Form.Item>

              <Form.Item label="Machine & Utility Overheads" name="overheadCost">
                <InputNumber
                  ref={overheadCostRef}
                  min={0}
                  step={10}
                  controls={false}
                  style={{ width: '100%' }}
                  onFocus={(e) => (e.target as HTMLInputElement)?.select?.()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      packagingCostRef.current?.focus();
                      packagingCostRef.current?.select?.();
                    }
                  }}
                  onChange={(v) => setOverheadCost(v || 0)}
                  prefix="Rs."
                />
              </Form.Item>

              <Form.Item label="Packaging & Consumables" name="packagingCost">
                <InputNumber
                  ref={packagingCostRef}
                  min={0}
                  step={10}
                  controls={false}
                  style={{ width: '100%' }}
                  onFocus={(e) => (e.target as HTMLInputElement)?.select?.()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveBtnRef.current?.focus();
                    }
                  }}
                  onChange={(v) => setPackagingCost(v || 0)}
                  prefix="Rs."
                />
              </Form.Item>

              <Divider style={{ margin: '16px 0' }} />

              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Materials Consumed"
                    value={totalMaterialCost}
                    precision={2}
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Overheads Total"
                    value={totalOverheadCost}
                    precision={2}
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
                <Col span={24}>
                  <Card style={{ backgroundColor: '#fafafa', borderColor: '#d9d9d9' }} size="small">
                    <Statistic
                      title="Total Production Batch Cost"
                      value={grandTotalCost}
                      precision={2}
                      valueStyle={{ color: '#1677ff', fontSize: 20, fontWeight: 'bold' }}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">Output: </Text>
                      <Text strong>{Number(producedQty || 0).toFixed(2)} {getUnitTitle(watchedUnitId) || 'units'}</Text>
                    </div>
                    <Divider style={{ margin: '8px 0' }} />
                    <Statistic
                      title={`Finished Good Valuation (per ${getUnitTitle(watchedUnitId) || 'unit'})`}
                      value={unitProductionCost}
                      precision={2}
                      valueStyle={{ color: '#52c41a', fontSize: 22, fontWeight: 'bold' }}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      *Finished goods will be added to stock and FIFO layers at this exact unit cost.
                    </Text>
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
