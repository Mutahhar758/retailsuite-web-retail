import useFormShortcuts from '../../hooks/useFormShortcuts';
import KeyboardShortcutsBar from '../../components/common/KeyboardShortcutsBar';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm, Tag
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  ShoppingCartOutlined, UserOutlined, FileTextOutlined, CopyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { purchaseService } from '../../services/purchaseService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';
import { useAppStore } from '../../stores/useAppStore';
import { useSettingsStore, INVENTORY_ENABLE_SECONDARY_QTY_KEY, MOBILE_SHOP_ENABLE_KEY } from '../../stores/useSettingsStore';
import { round } from '../../utils/numberUtils';
import { getSelectablePrimaryUnits, toBasePrimaryQty, resolveDisplayQtyAndUnit } from '../../utils/unitConversion';
import { BarcodeFastScanBar } from '../../components/common/BarcodeFastScanBar';
import { useGridKeyboard } from '../../hooks/useGridKeyboard';

const { Title, Text } = Typography;

export const NormalPurchaseForm: React.FC = () => {
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const { getSetting, fetchSettings } = useSettingsStore();
  const settingSecQty = getSetting(INVENTORY_ENABLE_SECONDARY_QTY_KEY, '');
  const hasSecondaryQty = settingSecQty !== '' ? settingSecQty === 'true' : (currentOrg?.hasSecondaryQty ?? false);
  const settingMobile = getSetting(MOBILE_SHOP_ENABLE_KEY, '');
  const hasMobileShopFeature = settingMobile !== '' ? settingMobile === 'true' : (currentOrg?.hasMobileShopFeature ?? false);

  const { voucherNo } = useParams<{ voucherNo: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [vendors, setVendors] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [purchaseLines, setPurchaseLines] = useState<any[]>([]);

  const isEdit = !!voucherNo && voucherNo !== 'new';

  // Keyboard navigation refs
  const pendingFocusRef = useRef<{ rowIdx: number; colKey: string } | null>(null);
  const datePickerRef = useRef<any>(null);
  const vendorSelectRef = useRef<any>(null);
  const narrationSelectRef = useRef<any>(null);

  const handleAddRow = useCallback(() => {
    setPurchaseLines(prev => {
      const maxSeq = prev.reduce((max, row) => Math.max(max, row.seq || 0), 0);
      return [
        ...prev,
        {
          key: Date.now(),
          seq: maxSeq + 1,
          itemId: undefined,
          unit: undefined,
          qty: 1,
          rate: 0,
          addLess: 0,
          imei: '',
          imei2: '',
          ptaStatus: undefined,
          batteryHealth: undefined,
          conditionNote: '',
          amount: 0,
          secQty: 0,
          secRate: 0
        }
      ];
    });
  }, []);

  const enterCols = [
    'itemId',
    'qty',
    'rate',
    ...(hasSecondaryQty ? ['secQty', 'secRate'] : [])
  ];

  const arrowCols = [
    'itemId',
    'qty',
    'rate',
    ...(hasSecondaryQty ? ['secQty', 'secRate'] : []),
    'addLess'
  ];

  const { getCellRef, handleCellKeyDown, focusCell } = useGridKeyboard({
    rowCount: purchaseLines.length,
    enterCols,
    arrowCols,
    firstColKey: 'itemId',
    onAddRow: handleAddRow,
    pendingFocusRef,
    isRowValid: (idx) => !!purchaseLines[idx]?.itemId,
    onSave: () => handleSave(),
  });

  const handleNew = useCallback(() => {
    form.resetFields();
    form.setFieldsValue({ date: dayjs(), cashPaid: 0, cashBack: 0 });
    setPurchaseLines([{
      key: Date.now(),
      seq: 1,
      itemId: undefined,
      unit: undefined,
      qty: 1,
      rate: 0,
      addLess: 0,
      amount: 0,
      secQty: 0,
      secRate: 0
    }]);
    setTimeout(() => datePickerRef.current?.focus(), 50);
  }, [form]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        fetchSettings('Inventory');
        const [itemsRes, vendorsRes, narrsRes] = await Promise.all([
          inventoryService.getItemsLookup(undefined, true),
          chartOfAccountService.getDetailAccounts(),
          narrationService.getActiveNarrationsLookup()
        ]);
        setItems(itemsRes);
        setVendors(vendorsRes);
        setNarrations(narrsRes);
      } catch {
        message.error('Failed to load lookups');
      }
    };
    fetchLookups();
  }, [fetchSettings]);

  useEffect(() => {
    if (isEdit) {
      const loadPurchase = async () => {
        try {
          setLoading(true);
          const details = await purchaseService.getDetail(voucherNo!);
          if (details && details.length > 0) {
            const first = details[0];
            form.setFieldsValue({
              date: dayjs(first.date),
              account: first.accountId,
              narration: first.narrationId,
              description: first.description,
              cashPaid: (first as any).cashPaid ?? 0,
              cashBack: (first as any).cashBack ?? 0,
              sellerCnic: (first as any).sellerCnic || '',
              sellerContact: (first as any).sellerContact || ''
            });
            setPurchaseLines(details.map((d, i) => ({
              key: i,
              seq: d.seq,
              itemId: d.itemId,
              unit: d.unit,
              qty: d.qty,
              rate: d.rate,
              addLess: d.addLess,
              imei: (d as any).imei || '',
              imei2: (d as any).imei2 || '',
              ptaStatus: (d as any).ptaStatus || undefined,
              batteryHealth: (d as any).batteryHealth || undefined,
              conditionNote: (d as any).conditionNote || '',
              amount: d.amount,
              secQty: d.secQty,
              secRate: d.secRate,
              secUnit: d.secUnit
            })));
          }
        } catch {
          message.error('Failed to load purchase details');
          navigate('/daily-entries/purchase');
        } finally {
          setLoading(false);
        }
      };
      loadPurchase();
    } else {
      const copyFrom = (location.state as any)?.copyFrom;
      if (copyFrom) {
        form.setFieldsValue({
          date: dayjs(),
          account: copyFrom.account,
          narration: copyFrom.narration,
          description: copyFrom.description,
          cashPaid: copyFrom.cashPaid,
          cashBack: copyFrom.cashBack,
          sellerCnic: copyFrom.sellerCnic || '',
          sellerContact: copyFrom.sellerContact || ''
        });
        const initialLines = (copyFrom.lines || []).map((l: any, idx: number) => ({
          ...l,
          key: Date.now() + idx,
          seq: idx + 1,
          imei: l.imei || '',
          imei2: l.imei2 || '',
          ptaStatus: l.ptaStatus || undefined,
          batteryHealth: l.batteryHealth || undefined,
          conditionNote: l.conditionNote || '',
          secQty: l.secQty || 0,
          secRate: l.secRate || 0,
          secUnit: l.secUnit || null
        }));
        setPurchaseLines(initialLines.length > 0 ? initialLines : [{
          key: Date.now(),
          seq: 1,
          itemId: undefined,
          unit: undefined,
          qty: 1,
          rate: 0,
          addLess: 0,
          amount: 0,
          secQty: 0,
          secRate: 0
        }]);
      } else {
        form.setFieldsValue({ date: dayjs() });
        setPurchaseLines([{
          key: Date.now(),
          seq: 1,
          itemId: undefined,
          unit: undefined,
          qty: 1,
          rate: 0,
          addLess: 0,
          amount: 0,
          secQty: 0,
          secRate: 0
        }]);
      }
    }
  }, [isEdit, voucherNo, form, navigate, location.state]);

  const removeRow = async (record: any) => {
    if (isEdit && record.seq) {
      try {
        await purchaseService.deleteLine(voucherNo!, record.seq);
        message.success('Row deleted from database');
      } catch {
        message.error('Failed to delete row from database');
        return;
      }
    }
    setPurchaseLines(purchaseLines.filter(row => row.key !== record.key));
  };

  const updateRow = (key: any, field: string, value: any) => {
    setPurchaseLines(purchaseLines.map(row => {
      if (row.key === key) {
        const updated = { ...row, [field]: value };
        const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
        const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;
        const currentItem = items.find(i => String(i.id) === String(field === 'itemId' ? value : row.itemId));

        if (field === 'itemId') {
          if (currentItem) {
            const hasSec = !!(currentItem.secondaryUnit && currentItem.secondaryUnit.trim());
            const isSec = hasSec && !!(currentItem.defaultUnit && currentItem.defaultUnit.trim().toLowerCase() === currentItem.secondaryUnit?.trim().toLowerCase());
            const baseRate = currentItem.lastPurchaseRate ?? ((isSec && (currentItem.secCostRate || 0) > 0) ? (currentItem.secCostRate || 0) : (currentItem.costRate || 0));
            const pSize = Number(currentItem.qtyInPack || (currentItem as any)?.QtyInPack || (currentItem as any)?.qty_in_pack || 0);
            const baseSecRate = currentItem.lastPurchaseSecRate ?? (currentItem.secCostRate || ((currentItem.costRate || 0) * (pSize > 0 ? pSize : 1)));

            updated.unit = currentItem.defaultUnit || currentItem.primaryUnit || '';
            updated.rate = baseRate;
            updated.secUnit = currentItem.secondaryUnit || '';
            updated.secRate = baseSecRate;
            updated.selectedUnitId = undefined;
            updated.selectedUnitFactor = 1;
            updated.displayQty = row.qty || 1;
          }
        }

        if (field === 'selectedUnitId') {
          const selectable = getSelectablePrimaryUnits(currentItem);
          const selectedOpt = selectable.find(u => u.unitId === value);
          const factor = selectedOpt?.factor || 1;
          const currentDisplayQty = row.displayQty !== undefined
            ? row.displayQty
            : resolveDisplayQtyAndUnit(row.qty || 0, currentItem).displayQty;
          updated.selectedUnitId = value;
          updated.selectedUnitFactor = factor;
          updated.displayQty = currentDisplayQty;
          updated.qty = toBasePrimaryQty(currentDisplayQty, factor);
        }

        if (field === 'qty') {
          const resolved = row.selectedUnitId
            ? { factor: row.selectedUnitFactor || 1, selectedUnitId: row.selectedUnitId }
            : resolveDisplayQtyAndUnit(row.qty || 0, currentItem);
          updated.selectedUnitId = resolved.selectedUnitId;
          updated.selectedUnitFactor = resolved.factor;
          updated.displayQty = numVal;
          updated.qty = toBasePrimaryQty(numVal, resolved.factor);
        }

        const qty = Number(updated.qty) || 0;
        const rate = Number(updated.rate) || 0;
        const secQty = Number(updated.secQty) || 0;
        const secRate = Number(updated.secRate) || 0;
        const addLess = Number(updated.addLess) || 0;
        updated.amount = round((qty * rate) + addLess + (secQty * secRate), 2);

        return updated;
      }
      return row;
    }));
  };

  const handleBarcodeScanned = (
    scannedItem: Item,
    scanQty: number = 1,
    customAmount?: number,
    customRate?: number
  ) => {
    setPurchaseLines(prev => {
      const existingIndex = prev.findIndex(l => l.itemId === scannedItem.id);
      const effectiveRate = customRate !== undefined
        ? customRate
        : (scannedItem.lastPurchaseRate ?? (scannedItem.costRate !== undefined && scannedItem.costRate !== null ? scannedItem.costRate : 0));

      if (existingIndex >= 0) {
        const updatedLines = [...prev];
        const existingLine = updatedLines[existingIndex];
        const newQty = (existingLine.qty || 0) + scanQty;
        const pSize = Number(scannedItem.qtyInPack || (scannedItem as any).QtyInPack || (scannedItem as any).qty_in_pack || 0);
        const rate = effectiveRate;
        const secRate = scannedItem.secRate || (rate * (pSize > 0 ? pSize : 1));
        const amount = customAmount !== undefined
          ? (existingLine.amount || 0) + customAmount
          : round((newQty * rate) + ((existingLine.secQty || 0) * (existingLine.secRate || secRate)) + (existingLine.addLess || 0), 2);

        updatedLines[existingIndex] = {
          ...existingLine,
          qty: newQty,
          rate,
          secRate: existingLine.secRate || secRate,
          amount
        };
        return updatedLines;
      }

      const emptyRowIndex = prev.findIndex(l => !l.itemId);
      const pSize = Number(scannedItem.qtyInPack || (scannedItem as any).QtyInPack || (scannedItem as any).qty_in_pack || 0);
      const rate = effectiveRate;
      const secRate = scannedItem.secRate || (rate * (pSize > 0 ? pSize : 1));
      const amount = customAmount !== undefined ? customAmount : round(scanQty * rate, 2);

      if (emptyRowIndex >= 0) {
        const updatedLines = [...prev];
        updatedLines[emptyRowIndex] = {
          ...updatedLines[emptyRowIndex],
          itemId: scannedItem.id,
          unit: scannedItem.defaultUnit || scannedItem.primaryUnit,
          rate,
          secUnit: scannedItem.secondaryUnit,
          secRate,
          secQty: 0,
          qty: scanQty,
          addLess: 0,
          amount
        };

        if (emptyRowIndex === updatedLines.length - 1) {
          const maxSeq = updatedLines.reduce((max, row) => Math.max(max, row.seq || 0), 0);
          updatedLines.push({
            key: Date.now() + 1,
            seq: maxSeq + 1,
            itemId: undefined,
            unit: undefined,
            qty: 1,
            rate: 0,
            addLess: 0,
            amount: 0,
            secQty: 0,
            secRate: 0
          });
        }
        return updatedLines;
      } else {
        const maxSeq = prev.reduce((max, row) => Math.max(max, row.seq || 0), 0);
        return [
          ...prev,
          {
            key: Date.now(),
            seq: maxSeq + 1,
            itemId: scannedItem.id,
            unit: scannedItem.defaultUnit || scannedItem.primaryUnit,
            rate,
            secUnit: scannedItem.secondaryUnit,
            secRate,
            secQty: 0,
            qty: scanQty,
            addLess: 0,
            amount,
          },
          {
            key: Date.now() + 1,
            seq: maxSeq + 2,
            itemId: undefined,
            unit: undefined,
            qty: 1,
            rate: 0,
            addLess: 0,
            amount: 0,
            secQty: 0,
            secRate: 0
          }
        ];
      }
    });
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await purchaseService.delete(voucherNo!);
      message.success('Purchase deleted successfully');
      navigate('/daily-entries/purchase');
    } catch {
      message.error('Failed to delete purchase');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = purchaseLines.reduce((sum, l) => sum + (l.amount || 0), 0);
  const cashPaid = Form.useWatch('cashPaid', form) || 0;
  const cashBack = Form.useWatch('cashBack', form) || 0;
  const balance = totalAmount - cashPaid + cashBack;

  useEffect(() => {
    if (!isEdit) {
      form.setFieldsValue({ cashPaid: totalAmount, cashBack: 0 });
    }
  }, [totalAmount, isEdit, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = purchaseLines.filter(l => l.itemId && l.qty > 0);

      if (validLines.length === 0) {
        message.error('Please add at least one valid item');
        return;
      }

      for (const line of validLines) {
        const item = items.find(i => String(i.id) === String(line.itemId));
        if (item?.requireImei && (!line.imei || !line.imei.trim())) {
          message.error(`Item "${item.title}" requires an IMEI / Serial number.`);
          return;
        }
      }

      setLoading(true);
      const request = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        cashPaid: values.cashPaid || 0,
        cashBack: values.cashBack || 0,
        sellerCnic: values.sellerCnic || null,
        sellerContact: values.sellerContact || null,
        lines: validLines.map(l => ({
          seq: l.seq,
          itemId: l.itemId,
          unit: l.unit || null,
          qty: l.qty,
          rate: l.rate,
          addLess: l.addLess || 0,
          imei: l.imei || null,
          imei2: l.imei2 || null,
          ptaStatus: l.ptaStatus || null,
          batteryHealth: l.batteryHealth || null,
          conditionNote: l.conditionNote || null,
          secUnit: l.secUnit || null,
          secQty: l.secQty || 0,
          secRate: l.secRate || 0
        }))
      };

      if (isEdit) {
        await purchaseService.update(voucherNo!, request);
        message.success('Purchase updated successfully');
      } else {
        const newVNo = await purchaseService.create(request);
        message.success('Purchase created successfully');
        navigate(`/daily-entries/purchase/${newVNo}`);
      }
    } catch {
      message.error('Failed to save purchase');
    } finally {
      setLoading(false);
    }
  };

  // Form shortcut keys
  useFormShortcuts({
    onNew: handleNew,
    onFocusSearch: () => vendorSelectRef.current?.focus(),
    onSave: handleSave,
    onAddRow: () => {
      pendingFocusRef.current = { rowIdx: purchaseLines.length, colKey: 'itemId' };
      handleAddRow();
    },
  });

  const handleDatePickerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => vendorSelectRef.current?.focus(), 50);
    }
  };

  const handleVendorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => narrationSelectRef.current?.focus(), 50);
    }
  };

  const handleNarrationKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => focusCell(0, 'itemId'), 50);
    }
  };

  const columns = [
    {
      title: 'Seq',
      dataIndex: 'seq',
      width: 60,
    },
    {
      title: 'Item Description',
      dataIndex: 'itemId',
      render: (text: string, record: any, rowIdx: number) => (
        <Select
          ref={getCellRef(rowIdx, 'itemId')}
          showSearch
          style={{ width: '100%' }}
          placeholder="Select Item"
          optionFilterProp="children"
          value={text}
          onChange={(val) => updateRow(record.key, 'itemId', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'itemId', e)}
          filterOption={(input, option) =>
            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
          }
          options={items.map(i => ({ value: i.id, label: `${i.title} (${i.id})` }))}
        />
      )
    },
    ...(hasMobileShopFeature ? [
      {
        title: 'IMEI / Serial',
        dataIndex: 'imei',
        width: 160,
        render: (text: string, record: any) => (
          <Input
            value={text}
            placeholder="Scan/Type IMEI"
            onChange={(e) => updateRow(record.key, 'imei', e.target.value)}
          />
        )
      },
      {
        title: 'IMEI 2',
        dataIndex: 'imei2',
        width: 130,
        render: (text: string, record: any) => (
          <Input
            value={text}
            placeholder="IMEI 2"
            onChange={(e) => updateRow(record.key, 'imei2', e.target.value)}
          />
        )
      },
      {
        title: 'PTA Status',
        dataIndex: 'ptaStatus',
        width: 130,
        render: (text: string, record: any) => (
          <Select
            value={text}
            placeholder="PTA"
            style={{ width: '100%' }}
            allowClear
            onChange={(val) => updateRow(record.key, 'ptaStatus', val)}
            options={[
              { value: 'Official PTA', label: 'Official PTA' },
              { value: 'Non-PTA', label: 'Non-PTA' },
              { value: 'CPID', label: 'CPID' },
              { value: 'Patched', label: 'Patched' },
              { value: 'JV', label: 'JV' },
            ]}
          />
        )
      },
      {
        title: 'Bat %',
        dataIndex: 'batteryHealth',
        width: 80,
        render: (val: number, record: any) => (
          <InputNumber
            value={val}
            placeholder="%"
            min={0}
            max={100}
            controls={false}
            keyboard={false}
            style={{ width: '100%' }}
            onChange={(v) => updateRow(record.key, 'batteryHealth', v)}
          />
        )
      },
      {
        title: 'Condition / Note',
        dataIndex: 'conditionNote',
        width: 140,
        render: (text: string, record: any) => (
          <Input
            value={text}
            placeholder="Condition/Note"
            onChange={(e) => updateRow(record.key, 'conditionNote', e.target.value)}
          />
        )
      }
    ] : []),
    {
      title: hasSecondaryQty ? 'Single Qty' : 'Qty',
      dataIndex: 'qty',
      width: 145,
      render: (text: number, record: any, rowIdx: number) => {
        const item = items.find(i => String(i.id) === String(record.itemId));
        const selectableUnits = getSelectablePrimaryUnits(item);
        const resolved = record.selectedUnitId
          ? {
              displayQty: record.displayQty ?? text,
              selectedUnitId: record.selectedUnitId,
              factor: record.selectedUnitFactor || 1
            }
          : resolveDisplayQtyAndUnit(text || 0, item);

        return (
          <InputNumber
            ref={getCellRef(rowIdx, 'qty')}
            value={resolved.displayQty}
            style={{ width: '100%' }}
            onChange={(val) => updateRow(record.key, 'qty', val)}
            onKeyDown={(e) => handleCellKeyDown(rowIdx, 'qty', e)}
            min={0}
            controls={false}
            keyboard={false}
            precision={resolved.factor > 1 ? 0 : 2}
            addonAfter={
              selectableUnits.length > 1 ? (
                <Select
                  value={resolved.selectedUnitId}
                  onChange={(unitId) => updateRow(record.key, 'selectedUnitId', unitId)}
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
      width: 120,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'rate')}
          value={text}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.key, 'rate', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'rate', e)}
          min={0}
          controls={false}
          keyboard={false}
          precision={4}
          step={0.01}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => value?.replace(/\$\s?|(,*)/g, '') as any}
        />
      )
    },
    ...(hasSecondaryQty ? [
      {
        title: 'Pack Qty',
        dataIndex: 'secQty',
        width: 100,
        render: (text: number, record: any, rowIdx: number) => (
          <InputNumber
            ref={getCellRef(rowIdx, 'secQty')}
            value={text}
            style={{ width: '100%' }}
            onChange={(val) => updateRow(record.key, 'secQty', val)}
            onKeyDown={(e) => handleCellKeyDown(rowIdx, 'secQty', e)}
            controls={false}
            keyboard={false}
            min={0}
          />
        )
      },
      {
        title: 'Pack Rate',
        dataIndex: 'secRate',
        width: 120,
        render: (text: number, record: any, rowIdx: number) => (
          <InputNumber
            ref={getCellRef(rowIdx, 'secRate')}
            value={text}
            style={{ width: '100%' }}
            onChange={(val) => updateRow(record.key, 'secRate', val)}
            onKeyDown={(e) => handleCellKeyDown(rowIdx, 'secRate', e)}
            min={0}
            controls={false}
            keyboard={false}
            precision={4}
            step={0.01}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value?.replace(/\$\s?|(,*)/g, '') as any}
          />
        )
      }
    ] : []),
    {
      title: 'Add/Less',
      dataIndex: 'addLess',
      width: 100,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'addLess')}
          value={text}
          style={{ width: '100%' }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'addLess', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'addLess', e)}
        />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 150,
      align: 'right' as const,
      render: (text: number) => <Text strong>{text.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
    },
    {
      title: '',
      width: 60,
      render: (_: any, record: any) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => removeRow(record)} 
          disabled={purchaseLines.length === 1} 
        />
      )
    }
  ];

  return (
    <div tabIndex={-1} style={{ outline: 'none' }}>
      <Card className="shadow-sm border-gray-100 rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <Space align="center">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/purchase')} type="text" />
            <ShoppingCartOutlined style={{ fontSize: 24, color: '#16a34a' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {isEdit ? `Edit Purchase: PU-${voucherNo}` : 'New Purchase'}
              </Title>
              <Text type="secondary">{isEdit ? 'Modify existing purchase record' : 'Record a new inventory purchase'}</Text>
            </div>
          </Space>
          <Space>
            {isEdit && (
              <Popconfirm title="Delete this purchase?" onConfirm={handleDelete}>
                <Button danger icon={<DeleteOutlined />}>Delete</Button>
              </Popconfirm>
            )}
            {isEdit && (
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  const values = form.getFieldsValue();
                  navigate('/daily-entries/purchase/new', {
                    state: {
                      copyFrom: {
                        account: values.account,
                        narration: values.narration,
                        description: values.description,
                        cashPaid: values.cashPaid,
                        cashBack: values.cashBack,
                        sellerCnic: values.sellerCnic,
                        sellerContact: values.sellerContact,
                        lines: purchaseLines
                      }
                    }
                  });
                }}
              >
                Copy as New
              </Button>
            )}
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              data-action="save" className="purchase-save-btn form-save-btn" onClick={handleSave} 
              loading={loading}
              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
            >
              Save Purchase (F5)
            </Button>
          </Space>
        </div>

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={8} lg={4}>
              <Form.Item label="Voucher #">
                <Input value={isEdit ? `PU-${voucherNo}` : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} />
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
            <Col xs={24} sm={8} lg={8}>
              <Form.Item label="Vendor / Supplier" name="account" rules={[{ required: true }]}>
                <Select
                  ref={vendorSelectRef}
                  showSearch
                  placeholder="Select Vendor"
                  prefix={<UserOutlined />}
                  optionFilterProp="children"
                  onKeyDown={handleVendorKeyDown}
                >
                  {vendors.map(v => (
                    <Select.Option key={v.account} value={v.account}>{v.title}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} lg={8}>
              <Form.Item label="Narration" name="narration">
                <Select
                  ref={narrationSelectRef}
                  showSearch
                  placeholder="Select narration"
                  prefix={<FileTextOutlined />}
                  allowClear
                  onKeyDown={handleNarrationKeyDown}
                >
                  {narrations.map(n => (
                    <Select.Option key={n.code} value={n.code}>{n.title}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} lg={hasMobileShopFeature ? 12 : 24}>
              <Form.Item label="Description" name="description">
                <Input placeholder="Additional purchase details..." />
              </Form.Item>
            </Col>
            {hasMobileShopFeature && (
              <>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label="Seller CNIC" name="sellerCnic">
                    <Input placeholder="e.g. 35202-xxxxxxx-x" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label="Seller Contact / Phone" name="sellerContact">
                    <Input placeholder="e.g. 0300-1234567" />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>

          <div className="flex justify-between items-center mb-4 mt-2">
            <Title level={5} style={{ margin: 0 }}>Purchase Items</Title>
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddRow}>Add Row (Ins)</Button>
          </div>

          <BarcodeFastScanBar
            items={items}
            onScanItem={handleBarcodeScanned}
          />

          <Table
            dataSource={purchaseLines}
            columns={columns}
            pagination={false}
            size="small"
            bordered
            className="mb-4"
            summary={pageData => {
              let totalQty = 0;
              let totalAmount = 0;
              pageData.forEach(({ qty, amount }) => {
                totalQty += qty || 0;
                totalAmount += amount || 0;
              });
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2} align="right"><b>Totals</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={1}><b>{totalQty}</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} colSpan={hasSecondaryQty ? 4 : 2} align="right"><b>Net Total</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <Text strong style={{ color: '#16a34a' }}>Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4}></Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        <KeyboardShortcutsBar shortcuts={[{ key: 'F1', label: 'New' }, { key: 'F2', label: 'Vendor' }, { key: 'F3', label: 'Barcode' }, { key: 'F5', label: 'Save' }, { key: 'Ins', label: 'Add Row' }, { key: 'Enter', label: 'Next Field' }, { key: '↑↓←→', label: 'Navigate' }, { key: 'Esc', label: 'Cancel Edit' }]} />

          <div className="mt-8 pt-6 border-t border-gray-100">
            <Row gutter={24} align="bottom">
              <Col xs={24} sm={8} lg={6}>
                <Form.Item label="Cash Paid" name="cashPaid">
                  <InputNumber
                    className="purchase-cash-paid"
                    style={{ width: '100%' }}
                    size="large"
                    min={0}
                    controls={false}
                    keyboard={false}
                    placeholder="0.00"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8} lg={6}>
                <Form.Item label="Cash Back" name="cashBack">
                  <InputNumber
                    className="purchase-cash-back"
                    style={{ width: '100%' }}
                    size="large"
                    min={0}
                    controls={false}
                    keyboard={false}
                    placeholder="0.00"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && !e.shiftKey) {
                        e.preventDefault();
                        const saveBtn = document.querySelector('.purchase-save-btn') as HTMLButtonElement;
                        if (saveBtn) {
                          saveBtn.focus();
                        }
                      }
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8} lg={12}>
                <div className="text-right pb-6">
                  <Text type="secondary" className="uppercase text-xs tracking-widest block mb-1">Net Balance</Text>
                  <div className="flex items-center justify-end gap-3">
                    <Tag color={balance > 0 ? 'red' : balance < 0 ? 'green' : 'blue'} className="px-3 py-0.5 rounded-full border-none font-bold uppercase text-[10px]">
                      {balance > 0 ? 'Payable' : balance < 0 ? 'Change' : 'Settled'}
                    </Tag>
                    <div className={`text-4xl font-bold tracking-tight ${balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      <span className="text-xl mr-1 font-medium opacity-50">Rs.</span>
                      {Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </Form>
      </Card>
    </div>
  );
};
