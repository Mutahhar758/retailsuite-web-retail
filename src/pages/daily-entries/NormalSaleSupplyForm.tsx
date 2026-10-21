import useFormShortcuts from '../../hooks/useFormShortcuts';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm, Tooltip
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  TruckOutlined, AppstoreOutlined, CopyOutlined, CameraOutlined, PaperClipOutlined
} from '@ant-design/icons';
import { ScanSupplySheetModal, type ScannedAttachmentMeta } from './components/ScanSupplySheetModal';
import { SaleSupplyAttachmentsDrawer } from './components/SaleSupplyAttachmentsDrawer';
import dayjs from 'dayjs';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';
import { useSettingsStore, INVENTORY_ENABLE_SECONDARY_QTY_KEY, TRANSACTION_ENABLE_CARRIAGE_KEY } from '../../stores/useSettingsStore';
import { round } from '../../utils/numberUtils';
import { getSelectablePrimaryUnits, toBasePrimaryQty, resolveDisplayQtyAndUnit } from '../../utils/unitConversion';
import { saleSupplyService } from '../../services/saleSupplyService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';
import { inventoryService, type Item, type ItemCustomerCategoryPriceDto } from '../../services/inventoryService';
import { supplyOrderService, type SupplyOrder } from '../../services/supplyOrderService';
import { customerService } from '../../services/customerService';
import { useGridKeyboard } from '../../hooks/useGridKeyboard';

const { Title, Text } = Typography;

export const NormalSaleSupplyForm: React.FC = () => {
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const { getSetting, fetchSettings } = useSettingsStore();
  const settingSecQty = getSetting(INVENTORY_ENABLE_SECONDARY_QTY_KEY, '');
  const hasSecondaryQty = settingSecQty !== '' ? settingSecQty === 'true' : (currentOrg?.hasSecondaryQty ?? false);
  const enableCarriage = getSetting(TRANSACTION_ENABLE_CARRIAGE_KEY, 'false') === 'true';

  const { voucherNo } = useParams<{ voucherNo: string }>();
  const isEdit = !!voucherNo && voucherNo !== 'new';
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categoryPrices, setCategoryPrices] = useState<ItemCustomerCategoryPriceDto[]>([]);
  const [supplyLines, setSupplyLines] = useState<any[]>([]);
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>([]);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [attachmentsDrawerVisible, setAttachmentsDrawerVisible] = useState(false);
  const [stagedMediaIds, setStagedMediaIds] = useState<string[]>([]);
  const [stagedAttachmentsMeta, setStagedAttachmentsMeta] = useState<Array<{ mediaId: string; fileName: string; fileUrl?: string }>>([]);
  const [savedAttachmentCount, setSavedAttachmentCount] = useState<number>(0);

  // ── Calculated Totals ──────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalSecQty = 0;
    let totalDiscount = 0;
    let totalAddLess = 0;
    let totalCarriage = 0;
    let totalAmount = 0;
    let validCustomers = 0;

    supplyLines.forEach(l => {
      const q = Number(l.qty) || 0;
      const sq = Number(l.secQty) || 0;
      const disc = Number(l.discount) || 0;
      const al = Number(l.addLess) || 0;
      const c = Number(l.carriage) || 0;
      const amt = Number(l.amount) || 0;

      totalQty += q;
      totalSecQty += sq;
      totalDiscount += disc;
      totalAddLess += al;
      totalCarriage += c;
      totalAmount += amt;

      if (l.customerId) {
        validCustomers += 1;
      }
    });

    return {
      totalQty: round(totalQty, 2),
      totalSecQty: round(totalSecQty, 2),
      totalDiscount: round(totalDiscount, 2),
      totalAddLess: round(totalAddLess, 2),
      totalCarriage: round(totalCarriage, 2),
      totalAmount: round(totalAmount, 2),
      customerCount: validCustomers,
      rowCount: supplyLines.length
    };
  }, [supplyLines]);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const pendingFocusRef = useRef<{ rowIdx: number; colKey: 'customerId' } | null>(null);
  const originalItemIdRef = useRef<string | null>(null);

  const handleAddRow = useCallback(() => {
    setSupplyLines(prev => {
      const newSeq = prev.length > 0 ? Math.max(...prev.map(l => l.seq)) + 1 : 1;
      return [
        ...prev,
        { key: Date.now(), seq: newSeq, qty: 1, rate: 0, discount: 0, addLess: 0, carriage: 0, amount: 0, secQty: 0, secRate: 0 }
      ];
    });
  }, []);

  const { getCellRef, handleCellKeyDown, focusCell } = useGridKeyboard({
    rowCount: supplyLines.length,
    hasSecondaryQty,
    hasVariablePackFeature: false,
    onAddRow: handleAddRow,
    pendingFocusRef,
    isRowValid: (idx) => !!supplyLines[idx]?.customerId,
    onSave: () => handleSave(),
  });

  // Header field refs
  const datePickerRef = useRef<any>(null);
  const itemSelectRef = useRef<any>(null);
  const supplyOrderSelectRef = useRef<any>(null);

  // Form wrapper ref — receives global key events
  const formWrapperRef = useRef<HTMLDivElement>(null);

  const handleNew = useCallback(() => {
    form.resetFields();
    form.setFieldsValue({ date: dayjs() });
    setSupplyLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, addLess: 0, amount: 0, secQty: 0, secRate: 0 }]);
    setTimeout(() => datePickerRef.current?.focus(), 50);
  }, [form]);

  useEffect(() => {
    fetchSettings('Inventory');
    chartOfAccountService.getCustomerAccounts().then(setCustomers);
    narrationService.getActiveNarrationsLookup().then(setNarrations);
    inventoryService.getItemsLookup().then(setItems);
    inventoryService.getCustomerCategoryPrices().then(setCategoryPrices).catch(() => []);
    supplyOrderService.getList().then(setSupplyOrders);

    if (isEdit) {
      fetchDetail();
      saleSupplyService.getAttachments(voucherNo!).then(atts => setSavedAttachmentCount(atts.length)).catch(() => {});
    } else {
      const copyFrom = (location.state as any)?.copyFrom;
      if (copyFrom) {
        form.setFieldsValue({
          date: dayjs(),
          itemId: copyFrom.itemId,
          narration: copyFrom.narration,
          description: copyFrom.description,
          supplyOrderMasterId: copyFrom.supplyOrderMasterId
        });
        setSupplyLines((copyFrom.lines || []).map((l: any) => ({
          ...l,
          key: Date.now() + l.seq,
          secQty: l.secQty || 0,
          secRate: l.secRate || 0,
          secUnit: l.secUnit || null
        })));
      } else {
        setSupplyLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, addLess: 0, amount: 0, secQty: 0, secRate: 0 }]);
        form.setFieldsValue({ date: dayjs() });
      }
    }
  }, [isEdit, voucherNo]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const details = await saleSupplyService.getDetail(voucherNo!);
      if (details.length > 0) {
        const first = details[0];
        originalItemIdRef.current = first.itemId;
        form.setFieldsValue({
          date: dayjs(first.date),
          itemId: first.itemId,
          narration: first.narrationId,
          description: first.description,
          supplyOrderMasterId: first.supplyOrderMasterId ?? undefined
        });

        setSupplyLines(details.map(d => ({
          ...d,
          key: d.seq,
          customerId: d.customerId,
          addLess: d.addLess,
          carriage: d.carriage || 0,
          secQty: d.secQty,
          secRate: d.secRate,
          secUnit: d.secUnit,
          isExisting: true,
          savedRate: d.rate,
          savedSecRate: d.secRate
        })));
      }
    } catch {
      message.error('Failed to fetch supply details');
    } finally {
      setLoading(false);
    }
  };

  const resolveSellingRate = (customerId?: string, itemId?: string, customRate?: number | null) => {
    if (customRate != null && customRate > 0) return customRate;

    const item = items.find(i => String(i.id) === String(itemId));
    if (!item) return 0;

    const hasSec = !!(item.secondaryUnit && item.secondaryUnit.trim());
    const isSec = hasSec && !!(item.defaultUnit && item.defaultUnit.trim().toLowerCase() === item.secondaryUnit?.trim().toLowerCase());
    let baseRate = (isSec && (item.secRate || 0) > 0) ? (item.secRate || 0) : (item.priRate || 0);

    if (customerId && itemId) {
      const cust = customers.find(c => c.account === customerId);
      if (cust?.customerCategoryId) {
        const catPrice = categoryPrices.find(p => String(p.itemId) === String(itemId) && p.customerCategoryId === cust.customerCategoryId);
        if (catPrice) {
          if (isSec && catPrice.secRate != null && catPrice.secRate > 0) {
            return catPrice.secRate;
          }
          if (catPrice.priRate > 0) {
            return catPrice.priRate;
          }
        }
      }
    }

    return baseRate;
  };

  const resolveSecondaryRate = (customerId?: string, itemId?: string) => {
    const item = items.find(i => String(i.id) === String(itemId));
    if (!item) return 0;

    const pSize = Number(item.qtyInPack || (item as any)?.QtyInPack || (item as any)?.qty_in_pack || 0);
    let baseSecRate = item.secRate || ((item.priRate || 0) * (pSize > 0 ? pSize : 1));

    if (customerId && itemId) {
      const cust = customers.find(c => c.account === customerId);
      if (cust?.customerCategoryId) {
        const catPrice = categoryPrices.find(p => String(p.itemId) === String(itemId) && p.customerCategoryId === cust.customerCategoryId);
        if (catPrice) {
          if (catPrice.secRate != null && catPrice.secRate > 0) {
            return catPrice.secRate;
          }
          if (catPrice.priRate > 0 && pSize > 0) {
            return catPrice.priRate * pSize;
          }
        }
      }
    }

    return baseSecRate;
  };

  const handleLoadFromSupplyOrder = async (orderId: number) => {
    if (!orderId || isEdit) return;
    const masterItemId = form.getFieldValue('itemId');
    const item = items.find(i => i.id === masterItemId);

    setLoading(true);
    try {
      const [order, customSupplyItems] = await Promise.all([
        supplyOrderService.getById(orderId),
        masterItemId ? customerService.getSupplyItems({ itemId: masterItemId }) : Promise.resolve([])
      ]);

      const customerQtyMap = new Map<string, { qty: number; secQty?: number; rate?: number; addLess?: number; carriage?: number; discount?: number }>();
      if (customSupplyItems && Array.isArray(customSupplyItems)) {
        customSupplyItems.forEach(ci => {
          if (ci.customerAccountId) {
            customerQtyMap.set(ci.customerAccountId, {
              qty: ci.qty,
              secQty: ci.secQty,
              rate: ci.rate,
              addLess: ci.addLess,
              carriage: ci.carriage,
              discount: ci.discount
            });
          }
        });
      }

      if (order && order.details) {
        const newLines = order.details.map((d, index) => {
          const setting = customerQtyMap.get(d.customerId);
          const qty = setting ? setting.qty : 1;
          const secQty = setting ? (setting.secQty || 0) : 0;
          const lineRate = resolveSellingRate(d.customerId, masterItemId, setting?.rate);
          const lineSecRate = resolveSecondaryRate(d.customerId, masterItemId);
          const lineDiscount = setting?.discount != null ? setting.discount : 0;
          const lineAddLess = setting?.addLess != null ? setting.addLess : 0;
          const lineCarriage = setting?.carriage != null ? setting.carriage : 0;
          const amount = round((qty * lineRate) - lineDiscount + lineCarriage + lineAddLess + (secQty * lineSecRate), 2);

          return {
            key: Date.now() + index,
            seq: index + 1,
            customerId: d.customerId,
            unit: item?.defaultUnit || '',
            qty: qty,
            rate: lineRate,
            discount: lineDiscount,
            addLess: lineAddLess,
            carriage: lineCarriage,
            amount: amount,
            secQty: secQty,
            secRate: lineSecRate,
            secUnit: item?.secondaryUnit || ''
          };
        });
        setSupplyLines(newLines);
        message.success(`Loaded ${newLines.length} customers from ${order.title}`);
      }
    } catch {
      message.error('Failed to load supply order');
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = async (newItemId: string) => {
    const item = items.find(i => String(i.id) === String(newItemId));
    if (!item) return;

    const isSameAsOriginal = isEdit && originalItemIdRef.current != null && String(newItemId) === String(originalItemIdRef.current);

    try {
      const customSupplyItems = await customerService.getSupplyItems({ itemId: newItemId });
      const customerQtyMap = new Map<string, { qty: number; secQty?: number; rate?: number; addLess?: number; carriage?: number; discount?: number }>();
      if (customSupplyItems && Array.isArray(customSupplyItems)) {
        customSupplyItems.forEach(ci => {
          if (ci.customerAccountId) {
            customerQtyMap.set(ci.customerAccountId, {
              qty: ci.qty,
              secQty: ci.secQty,
              rate: ci.rate,
              addLess: ci.addLess,
              carriage: ci.carriage,
              discount: ci.discount
            });
          }
        });
      }

      setSupplyLines(prev => prev.map(line => {
        const shouldPreserveRate = isSameAsOriginal && line.isExisting;

        if (!line.customerId) {
          const lineRate = shouldPreserveRate ? (line.savedRate ?? line.rate) : resolveSellingRate(undefined, newItemId, undefined);
          const lineSecRate = shouldPreserveRate ? (line.savedSecRate ?? line.secRate) : resolveSecondaryRate(undefined, newItemId);
          return {
            ...line,
            unit: item.defaultUnit || item.primaryUnit || line.unit,
            secUnit: item.secondaryUnit || line.secUnit,
            rate: lineRate,
            secRate: lineSecRate,
            amount: round(((line.qty || 1) * lineRate) + ((line.secQty || 0) * lineSecRate), 2)
          };
        }
        const setting = customerQtyMap.get(line.customerId);
        const qty = setting ? setting.qty : (line.qty || 1);
        const secQty = setting ? (setting.secQty || 0) : (line.secQty || 0);
        const lineRate = shouldPreserveRate ? (line.savedRate ?? line.rate) : resolveSellingRate(line.customerId, newItemId, setting?.rate);
        const lineSecRate = shouldPreserveRate ? (line.savedSecRate ?? line.secRate) : resolveSecondaryRate(line.customerId, newItemId);
        const lineDiscount = setting?.discount != null ? setting.discount : (line.discount || 0);
        const lineAddLess = setting?.addLess != null ? setting.addLess : (line.addLess || 0);
        const lineCarriage = setting?.carriage != null ? setting.carriage : (line.carriage || 0);
        const amount = round((qty * lineRate) - lineDiscount + lineCarriage + lineAddLess + (secQty * lineSecRate), 2);

        return {
          ...line,
          unit: item.defaultUnit || item.primaryUnit || line.unit,
          qty,
          secQty,
          rate: lineRate,
          discount: lineDiscount,
          addLess: lineAddLess,
          carriage: lineCarriage,
          secRate: lineSecRate,
          secUnit: item.secondaryUnit || line.secUnit,
          amount
        };
      }));
    } catch (err) {
      console.error('Failed to load item default customer quantities', err);
    }
  };

  const handleDatePickerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => itemSelectRef.current?.focus(), 50);
    }
  }, []);

  const handleItemSelectKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setTimeout(() => supplyOrderSelectRef.current?.focus(), 50);
    }
  }, []);

  const handleSupplyOrderKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setTimeout(() => focusCell(0, 'customerId'), 50);
    }
  }, [focusCell]);

  const handleRemoveRow = async (key: number, seq: number) => {
    if (isEdit && typeof key === 'number' && key < 1000000000) {
      try {
        await saleSupplyService.deleteLine(voucherNo!, seq);
      } catch {
        message.error('Failed to delete line from server');
        return;
      }
    }
    setSupplyLines(supplyLines.filter(l => l.key !== key));
  };

  const watchedItemId = Form.useWatch('itemId', form);

  const updateLine = (key: number, field: string, value: any) => {
    const masterItemId = watchedItemId || form.getFieldValue('itemId');
    const item = items.find(i => String(i.id) === String(masterItemId));

    const newLines = supplyLines.map(l => {
      if (l.key === key) {
        const updated = { ...l, [field]: value };
        const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
        const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

        if (field === 'selectedUnitId') {
          const selectable = getSelectablePrimaryUnits(item);
          const selectedOpt = selectable.find(u => u.unitId === value);
          const factor = selectedOpt?.factor || 1;
          const currentDisplayQty = l.displayQty !== undefined
            ? l.displayQty
            : resolveDisplayQtyAndUnit(l.qty || 0, item).displayQty;
          updated.selectedUnitId = value;
          updated.selectedUnitFactor = factor;
          updated.displayQty = currentDisplayQty;
          updated.qty = toBasePrimaryQty(currentDisplayQty, factor);
        }

        if (field === 'qty') {
          const resolved = l.selectedUnitId
            ? { factor: l.selectedUnitFactor || 1, selectedUnitId: l.selectedUnitId }
            : resolveDisplayQtyAndUnit(l.qty || 0, item);
          updated.selectedUnitId = resolved.selectedUnitId;
          updated.selectedUnitFactor = resolved.factor;
          updated.displayQty = numVal;
          updated.qty = toBasePrimaryQty(numVal, resolved.factor);
        }

        const lineGross = ((updated.qty || 0) * (updated.rate || 0)) + ((updated.secQty || 0) * (updated.secRate || 0));
        if (field === 'discPercent') {
          updated.discount = lineGross > 0 ? round(lineGross * (numVal / 100), 2) : 0;
          updated.discPercent = numVal;
        } else if (field === 'discount') {
          updated.discount = numVal;
          updated.discPercent = lineGross > 0 ? round((numVal / lineGross) * 100, 2) : 0;
        } else if (field === 'rate' || field === 'qty' || field === 'selectedUnitId' || field === 'secRate' || field === 'secQty') {
          const disc = updated.discount || 0;
          updated.discPercent = lineGross > 0 ? round((disc / lineGross) * 100, 2) : 0;
          if (field === 'rate' && isEdit && String(form.getFieldValue('itemId')) === String(originalItemIdRef.current)) {
            updated.savedRate = numVal;
          }
          if (field === 'secRate' && isEdit && String(form.getFieldValue('itemId')) === String(originalItemIdRef.current)) {
            updated.savedSecRate = numVal;
          }
        }

        const addLess = updated.addLess || 0;
        const carriage = updated.carriage || 0;
        const disc = updated.discount || 0;
        updated.amount = round((lineGross - disc) + carriage + addLess, 2);
        return updated;
      }
      return l;
    });
    setSupplyLines(newLines);
  };

  const handleImportScannedLines = (
    importedLines: any[],
    attachmentsOrMediaId?: ScannedAttachmentMeta[] | string,
    attachedFileName?: string,
    previewUrl?: string
  ) => {
    let attachments: ScannedAttachmentMeta[] = [];
    if (Array.isArray(attachmentsOrMediaId)) {
      attachments = attachmentsOrMediaId;
    } else if (typeof attachmentsOrMediaId === 'string' && attachmentsOrMediaId) {
      attachments = [{ mediaId: attachmentsOrMediaId, fileName: attachedFileName, previewUrl }];
    }

    if (attachments.length > 0) {
      const newMediaIds = attachments.map(a => a.mediaId);
      setStagedMediaIds(prev => Array.from(new Set([...prev, ...newMediaIds])));
      setStagedAttachmentsMeta(prev => [
        ...prev,
        ...attachments.map(a => ({
          mediaId: a.mediaId,
          fileName: a.fileName || `Scanned_Slip_${dayjs().format('HHmmss')}.jpg`,
          fileUrl: a.previewUrl
        }))
      ]);
      if (isEdit && voucherNo && voucherNo !== 'new') {
        attachments.forEach(att => {
          saleSupplyService.addAttachment(voucherNo, {
            mediaId: att.mediaId,
            fileName: att.fileName,
            description: 'Scanned paper slip'
          }).then(() => setSavedAttachmentCount(c => c + 1)).catch(() => {});
        });
      }
    }

    setSupplyLines(prev => {
      const isBlankOnly = prev.length === 1 && !prev[0].customerId && (Number(prev[0].qty) || 0) <= 1 && (Number(prev[0].rate) || 0) === 0;
      const baseSeq = isBlankOnly ? 0 : (prev.length > 0 ? Math.max(...prev.map(l => l.seq)) : 0);
      const mapped = importedLines.map((line, idx) => ({
        ...line,
        key: Date.now() + idx,
        seq: baseSeq + idx + 1
      }));
      return isBlankOnly ? mapped : [...prev, ...mapped];
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = supplyLines.filter(l =>
        l.customerId && (
          (Number(l.qty) || 0) > 0 ||
          (Number(l.secQty) || 0) > 0 ||
          (Number(l.addLess) || 0) !== 0 ||
          (Number(l.amount) || 0) !== 0
        )
      );

      if (validLines.length === 0) {
        message.error('Please add at least one customer');
        return;
      }

      setLoading(true);
      const request = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        supplyOrderMasterId: values.supplyOrderMasterId,
        attachmentMediaIds: stagedMediaIds,
        lines: validLines.map(l => {
          const masterItemId = form.getFieldValue('itemId') || values.itemId;
          const item = items.find(i => i.id === masterItemId);
          return {
            seq: l.seq,
            customerId: l.customerId,
            unit: item?.itemType === 'Service' ? null : (l.unit || null),
            qty: l.qty,
            rate: l.rate,
            discount: l.discount,
            addLess: l.addLess,
            carriage: l.carriage || 0,
            secUnit: l.secUnit || null,
            secQty: l.secQty || 0,
            secRate: l.secRate || 0
          };
        })
      };

      if (isEdit) {
        await saleSupplyService.update(voucherNo!, request);
        message.success('Sale supply updated successfully');
      } else {
        const newVno = await saleSupplyService.create(request);
        message.success('Sale supply created successfully');
        navigate(`/daily-entries/sale-supply/${newVno}`);
      }
    } catch {
      message.error('Failed to save sale supply');
    } finally {
      setLoading(false);
    }
  };

  // ── Global shortcut keys ───────────────────────────────────────────────────
  useFormShortcuts({
    onNew: handleNew,
    onFocusSearch: () => focusCell(0, 'customerId'),
    onSave: handleSave,
    onAddRow: () => {
      pendingFocusRef.current = { rowIdx: supplyLines.length, colKey: 'customerId' };
      handleAddRow();
    },
  });

  const handleDelete = async () => {
    setLoading(true);
    try {
      await saleSupplyService.delete(voucherNo!);
      message.success('Sale supply deleted successfully');
      navigate('/daily-entries/sale-supply');
    } catch {
      message.error('Failed to delete sale supply');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = async (key: number, customerId: string) => {
    const masterItemId = form.getFieldValue('itemId');

    let defQty = 1;
    let defSecQty = 0;
    let defCarriage = 0;
    let customRate: number | undefined;
    let customDiscount: number | undefined;
    let customAddLess: number | undefined;

    if (masterItemId && customerId) {
      try {
        const customItems = await customerService.getSupplyItems({ customerId, itemId: masterItemId });
        if (customItems && customItems.length > 0) {
          defQty = customItems[0].qty > 0 ? customItems[0].qty : 1;
          defSecQty = customItems[0].secQty || 0;
          if (customItems[0].carriage != null) defCarriage = customItems[0].carriage;
          if (customItems[0].rate != null) customRate = customItems[0].rate;
          if (customItems[0].discount != null) customDiscount = customItems[0].discount;
          if (customItems[0].addLess != null) customAddLess = customItems[0].addLess;
        }
      } catch (err) {
        console.error('Failed to get customer supply item default', err);
      }
    }

    const finalRate = resolveSellingRate(customerId, masterItemId, customRate);
    const finalSecRate = resolveSecondaryRate(customerId, masterItemId);

    setSupplyLines(prev => prev.map(l => {
      if (l.key === key) {
        const disc = customDiscount != null ? customDiscount : (l.discount || 0);
        const al = customAddLess != null ? customAddLess : (l.addLess || 0);
        const amount = round((defQty * finalRate) - disc + defCarriage + al + (defSecQty * finalSecRate), 2);
        return {
          ...l,
          customerId,
          qty: defQty,
          secQty: defSecQty,
          rate: finalRate,
          secRate: finalSecRate,
          discount: disc,
          addLess: al,
          carriage: defCarriage,
          amount
        };
      }
      return l;
    }));
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Customer',
      dataIndex: 'customerId',
      key: 'customerId',
      render: (text: string, record: any, rowIdx: number) => (
        <Select
          ref={getCellRef(rowIdx, 'customerId')}
          showSearch
          style={{ width: '100%' }}
          placeholder="Select Customer"
          optionFilterProp="children"
          value={text}
          onChange={(val) => handleCustomerChange(record.key, val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'customerId', e)}
        >
          {customers.map(c => (
            <Select.Option key={c.account} value={c.account}>{c.title}</Select.Option>
          ))}
        </Select>
      )
    },
    {
      title: hasSecondaryQty ? 'Single Qty' : 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      width: 145,
      render: (val: number, record: any, rowIdx: number) => {
        const masterItemId = watchedItemId || form.getFieldValue('itemId');
        const item = items.find(i => String(i.id) === String(masterItemId));
        const selectableUnits = getSelectablePrimaryUnits(item);
        const resolved = record.selectedUnitId
          ? {
              displayQty: record.displayQty ?? val,
              selectedUnitId: record.selectedUnitId,
              factor: record.selectedUnitFactor || 1
            }
          : resolveDisplayQtyAndUnit(val || 0, item);

        return (
          <InputNumber
            ref={getCellRef(rowIdx, 'qty')}
            style={{ width: '100%' }}
            value={resolved.displayQty}
            min={0}
            precision={resolved.factor > 1 ? 0 : 2}
            keyboard={false}
            controls={false}
            onChange={(v) => updateLine(record.key, 'qty', v)}
            onKeyDown={(e) => handleCellKeyDown(rowIdx, 'qty', e)}
            addonAfter={
              selectableUnits.length > 1 ? (
                <Select
                  value={resolved.selectedUnitId}
                  onChange={(unitId) => updateLine(record.key, 'selectedUnitId', unitId)}
                  style={{ width: 62 }}
                  popupMatchSelectWidth={false}
                >
                  {selectableUnits.map(u => (
                    <Select.Option key={u.unitId} value={u.unitId}>
                      {u.label}
                    </Select.Option>
                  ))}
                </Select>
              ) : undefined
            }
          />
        );
      }
    },
    {
      title: hasSecondaryQty ? 'Single Rate' : 'Rate',
      dataIndex: 'rate',
      key: 'rate',
      width: 120,
      render: (val: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'rate')}
          style={{ width: '100%' }}
          value={val}
          min={0}
          precision={4}
          step={0.01}
          tabIndex={-1}
          keyboard={false}
          controls={false}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateLine(record.key, 'rate', v)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'rate', e)}
        />
      )
    },
    ...(hasSecondaryQty ? [
      {
        title: 'Pack Qty',
        dataIndex: 'secQty',
        key: 'secQty',
        width: 100,
        render: (val: number, record: any, rowIdx: number) => (
          <InputNumber
            ref={getCellRef(rowIdx, 'secQty')}
            style={{ width: '100%' }}
            value={val}
            min={0}
            keyboard={false}
            controls={false}
            onChange={(v) => updateLine(record.key, 'secQty', v)}
            onKeyDown={(e) => handleCellKeyDown(rowIdx, 'secQty', e)}
          />
        )
      },
      {
        title: 'Pack Rate',
        dataIndex: 'secRate',
        key: 'secRate',
        width: 120,
        render: (val: number, record: any, rowIdx: number) => (
          <InputNumber
            ref={getCellRef(rowIdx, 'secRate')}
            style={{ width: '100%' }}
            value={val}
            min={0}
            controls={false}
            keyboard={false}
            precision={4}
            step={0.01}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            onChange={(v) => updateLine(record.key, 'secRate', v)}
            onKeyDown={(e) => handleCellKeyDown(rowIdx, 'secRate', e)}
          />
        )
      }
    ] : []),
    {
      title: 'Disc',
      dataIndex: 'discount',
      key: 'discount',
      width: 100,
      render: (val: number, record: any) => (
        <InputNumber
          ref={getCellRef(supplyLines.findIndex(l => l.key === record.key), 'discount')}
          style={{ width: '100%' }}
          value={val}
          min={0}
          tabIndex={-1}
          keyboard={false}
          controls={false}
          onChange={(v) => updateLine(record.key, 'discount', v)}
          onKeyDown={(e) => {
            const rowIdx = supplyLines.findIndex(l => l.key === record.key);
            handleCellKeyDown(rowIdx, 'discount', e);
          }}
        />
      )
    },
    {
      title: 'Disc (%)',
      dataIndex: 'discPercent',
      key: 'discPercent',
      width: 100,
      render: (val: number, record: any) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val != null ? val : (((record.qty * record.rate) > 0 && record.discount > 0) ? round((record.discount / (record.qty * record.rate)) * 100, 2) : 0)}
          min={0}
          max={100}
          tabIndex={-1}
          keyboard={false}
          controls={false}
          formatter={value => `${value}%`}
          parser={value => value ? Number(value.replace('%', '')) : 0}
          onChange={(v) => updateLine(record.key, 'discPercent', v)}
        />
      )
    },
    {
      title: 'Add/Less',
      dataIndex: 'addLess',
      key: 'addLess',
      width: 100,
      render: (val: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'addLess')}
          style={{ width: '100%' }}
          value={val}
          tabIndex={-1}
          keyboard={false}
          controls={false}
          onChange={(v) => updateLine(record.key, 'addLess', v)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'addLess', e)}
        />
      )
    },
    ...(enableCarriage ? [
      {
        title: 'Carriage',
        dataIndex: 'carriage',
        key: 'carriage',
        width: 100,
        render: (val: number, record: any, rowIdx: number) => (
          <InputNumber
            ref={getCellRef(rowIdx, 'carriage')}
            style={{ width: '100%' }}
            value={val}
            tabIndex={-1}
            keyboard={false}
            controls={false}
            onChange={(v) => updateLine(record.key, 'carriage', v)}
            onKeyDown={(e) => handleCellKeyDown(rowIdx, 'carriage', e)}
          />
        )
      }
    ] : []),
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right' as const,
      render: (val: number) => <Text strong>{(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveRow(record.key, record.seq)}
          disabled={supplyLines.length === 1}
          tabIndex={-1}
        />
      )
    }
  ];

  return (
    <div
      ref={formWrapperRef}
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      <Card className="shadow-sm border-gray-100 rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <Space align="center">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/sale-supply')} type="text" />
            <TruckOutlined style={{ fontSize: 24, color: '#0ea5e9' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {isEdit ? `Edit Sale Supply: ${voucherNo}` : 'New Sale Supply'}
              </Title>
              <Text type="secondary">
                {isEdit ? 'Modify multi-customer supply sheet' : 'Create a single-item, multi-customer supply sheet'}
              </Text>
            </div>
          </Space>
          <Space>
            {isEdit && (
              <Popconfirm title="Delete this sale supply?" onConfirm={handleDelete}>
                <Button danger icon={<DeleteOutlined />}>Delete</Button>
              </Popconfirm>
            )}
            {isEdit && (
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  const values = form.getFieldsValue();
                  navigate('/daily-entries/sale-supply/new', {
                    state: {
                      copyFrom: {
                        itemId: values.itemId,
                        narration: values.narration,
                        description: values.description,
                        supplyOrderMasterId: values.supplyOrderMasterId,
                        lines: supplyLines
                      }
                    }
                  });
                }}
              >
                Copy as New
              </Button>
            )}
            <Button
              icon={<CameraOutlined />}
              onClick={() => setScanModalVisible(true)}
              style={{ borderColor: '#1677ff', color: '#1677ff' }}
            >
              Scan Slip (AI)
            </Button>
            <Button
              icon={<PaperClipOutlined />}
              onClick={() => setAttachmentsDrawerVisible(true)}
            >
              Attachments {(isEdit ? savedAttachmentCount : stagedMediaIds.length) > 0 ? `(${isEdit ? savedAttachmentCount : stagedMediaIds.length})` : ''}
            </Button>
            <Button type="primary" icon={<SaveOutlined />} data-action="save" className="form-save-btn" onClick={handleSave} loading={loading}>
              Save Supply
            </Button>
          </Space>
        </div>

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={8} lg={4}>
              <Form.Item label="Voucher #" name="voucherNo">
                <Input value={isEdit ? voucherNo : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} lg={4}>
              <Form.Item label="Date" name="date" rules={[{ required: true }]}>
                <DatePicker
                  ref={datePickerRef}
                  style={{ width: '100%' }}
                  format="DD-MMM-YYYY"
                  onKeyDown={handleDatePickerKeyDown}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} lg={6}>
              <Form.Item label="Item (Master Item for all customers)" name="itemId" rules={[{ required: true }]}>
                <Select
                  ref={itemSelectRef}
                  showSearch
                  placeholder="Select Item"
                  optionFilterProp="children"
                  onChange={handleItemChange}
                  onKeyDown={handleItemSelectKeyDown}
                >
                  {items.map(i => (
                    <Select.Option key={i.id} value={i.id}>{i.title}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <Form.Item label="Supply Order (Pre-fill)" name="supplyOrderMasterId">
                <Select
                  ref={supplyOrderSelectRef}
                  showSearch
                  placeholder="Select Order"
                  optionFilterProp="children"
                  onChange={handleLoadFromSupplyOrder}
                  disabled={isEdit}
                  allowClear
                  onKeyDown={handleSupplyOrderKeyDown}
                >
                  {supplyOrders.map(o => (
                    <Select.Option key={o.id} value={o.id}>{o.title}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <Form.Item label="Narration" name="narration">
                <Select showSearch placeholder="Select Narration" optionFilterProp="children" allowClear>
                  {narrations.map(n => (
                    <Select.Option key={n.code} value={n.code}>{n.title}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="Description / Remarks" name="description">
                <Input.TextArea rows={1} placeholder="Optional delivery or vehicle remarks" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Space>
              <Text strong style={{ fontSize: 16 }}>Customer Delivery Lines</Text>
              <Tooltip title="Each line represents delivery of the master item to a customer">
                <AppstoreOutlined style={{ color: '#8c8c8c' }} />
              </Tooltip>
            </Space>
            <Button
              type="dashed"
              onClick={() => {
                pendingFocusRef.current = { rowIdx: supplyLines.length, colKey: 'customerId' };
                handleAddRow();
              }}
              icon={<PlusOutlined />}
            >
              Add Customer
            </Button>
          </div>

          <Table
            dataSource={supplyLines}
            columns={columns}
            pagination={false}
            rowKey="key"
            size="small"
            bordered
            summary={() => {
              let cellIndex = 0;
              return (
                <Table.Summary fixed="bottom">
                  <Table.Summary.Row style={{ backgroundColor: '#f8fafc', fontWeight: 600 }}>
                    <Table.Summary.Cell index={cellIndex++}>
                      <Space>
                        <Text strong>Total:</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          ({totals.customerCount} {totals.customerCount === 1 ? 'Customer' : 'Customers'})
                        </Text>
                      </Space>
                    </Table.Summary.Cell>

                    <Table.Summary.Cell index={cellIndex++} align="right">
                      <Text strong style={{ color: '#0369a1' }}>
                        {totals.totalQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </Table.Summary.Cell>

                    <Table.Summary.Cell index={cellIndex++} />

                    {hasSecondaryQty && (
                      <>
                        <Table.Summary.Cell index={cellIndex++} align="right">
                          <Text strong>
                            {totals.totalSecQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={cellIndex++} />
                      </>
                    )}

                    <Table.Summary.Cell index={cellIndex++} align="right">
                      <Text strong>
                        {totals.totalDiscount > 0
                          ? totals.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '-'}
                      </Text>
                    </Table.Summary.Cell>

                    <Table.Summary.Cell index={cellIndex++} />

                    <Table.Summary.Cell index={cellIndex++} align="right">
                      <Text
                        strong
                        style={{
                          color: totals.totalAddLess < 0 ? '#ef4444' : totals.totalAddLess > 0 ? '#10b981' : undefined
                        }}
                      >
                        {totals.totalAddLess > 0
                          ? `+${totals.totalAddLess.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : totals.totalAddLess.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </Table.Summary.Cell>

                    {enableCarriage && (
                      <Table.Summary.Cell index={cellIndex++} align="right">
                        <Text strong>
                          {totals.totalCarriage > 0
                            ? totals.totalCarriage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '-'}
                        </Text>
                      </Table.Summary.Cell>
                    )}

                    <Table.Summary.Cell index={cellIndex++} align="right">
                      <Text strong style={{ color: '#d97706', fontSize: 14 }}>
                        {totals.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </Table.Summary.Cell>

                    <Table.Summary.Cell index={cellIndex++} />
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        </Form>

        <div
          style={{
            marginTop: 8,
            padding: '6px 12px',
            background: '#fafafa',
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#aaa', fontSize: 14 }}>⌨️</span>
          {[
            ['F1', 'New'],
            ['F2', 'Item'],
            ['F5', 'Save'],
            ['Ins', 'Add Row'],
            ['Enter', 'Next Field'],
            ['↑↓←→', 'Navigate'],
            ['Esc', 'Cancel Edit'],
          ].map(([key, label]) => (
            <span key={key} style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
              <kbd
                style={{
                  display: 'inline-block',
                  padding: '1px 5px',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  background: '#fff',
                  border: '1px solid #d9d9d9',
                  borderRadius: 3,
                  boxShadow: '0 1px 0 rgba(0,0,0,.1)',
                  marginRight: 4,
                }}
              >
                {key}
              </kbd>
              {label}
            </span>
          ))}
        </div>

        <ScanSupplySheetModal
          visible={scanModalVisible}
          onClose={() => setScanModalVisible(false)}
          customers={customers}
          initialDate={form.getFieldValue('date')?.format?.('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD')}
          onImportLines={handleImportScannedLines}
        />
        <SaleSupplyAttachmentsDrawer
          visible={attachmentsDrawerVisible}
          onClose={() => setAttachmentsDrawerVisible(false)}
          voucherNo={voucherNo}
          isEdit={isEdit}
          stagedMediaIds={stagedMediaIds}
          stagedAttachmentsMeta={stagedAttachmentsMeta}
          onAddStagedMedia={(mediaId, meta) => {
            setStagedMediaIds(prev => [...prev, mediaId]);
            if (meta) setStagedAttachmentsMeta(prev => [...prev, { mediaId, ...meta }]);
          }}
          onRemoveStagedMedia={(mediaId) => {
            setStagedMediaIds(prev => prev.filter(x => x !== mediaId));
            setStagedAttachmentsMeta(prev => prev.filter(x => x.mediaId !== mediaId));
          }}
        />
      </Card>
    </div>
  );
};
