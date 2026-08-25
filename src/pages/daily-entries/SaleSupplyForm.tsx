import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm, Tooltip
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  TruckOutlined, AppstoreOutlined, FileTextOutlined, CopyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';
import { round } from '../../utils/numberUtils';
import { saleSupplyService } from '../../services/saleSupplyService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { supplyOrderService, type SupplyOrder } from '../../services/supplyOrderService';
import { customerService } from '../../services/customerService';
import { useGridKeyboard } from '../../hooks/useGridKeyboard';

const { Title, Text } = Typography;

export const SaleSupplyForm: React.FC = () => {
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const hasSecondaryQty = currentOrg?.hasSecondaryQty ?? false;
  const hasVariablePackFeature = currentOrg?.hasVariablePackFeature ?? false;

  const { voucherNo } = useParams<{ voucherNo: string }>();
  const isEdit = !!voucherNo && voucherNo !== 'new';
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<{ code: string; title: string }[]>([]);
  const [supplyLines, setSupplyLines] = useState<any[]>([]);
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>([]);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  // pendingFocusRef: set BEFORE calling onAddRow so the useEffect in the hook
  // can auto-focus the new row's Customer cell once rowCount increments.
  const pendingFocusRef = useRef<{ rowIdx: number; colKey: 'customerId' } | null>(null);

  const handleAddRow = useCallback(() => {
    setSupplyLines(prev => {
      const newSeq = prev.length > 0 ? Math.max(...prev.map(l => l.seq)) + 1 : 1;
      return [
        ...prev,
        { key: Date.now(), seq: newSeq, qty: 1, rate: 0, discount: 0, addLess: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }
      ];
    });
  }, []);

  const { getCellRef, handleCellKeyDown, focusCell } = useGridKeyboard({
    rowCount: supplyLines.length,
    hasSecondaryQty,
    hasVariablePackFeature,
    onAddRow: handleAddRow,
    pendingFocusRef,
  });

  // Header field refs
  const datePickerRef = useRef<any>(null);
  const itemSelectRef = useRef<any>(null);
  const supplyOrderSelectRef = useRef<any>(null);

  // Form wrapper ref — receives global key events
  const formWrapperRef = useRef<HTMLDivElement>(null);

  // ── Global shortcut keys ───────────────────────────────────────────────────
  const handleFormKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'F1':
        e.preventDefault();
        handleNew();
        break;
      case 'F2':
        e.preventDefault();
        itemSelectRef.current?.focus();
        break;
      case 'F5':
        e.preventDefault();
        handleSave();
        break;
      case 'Insert':
        e.preventDefault();
        // Schedule focus on new row Customer before state update
        pendingFocusRef.current = { rowIdx: supplyLines.length, colKey: 'customerId' };
        handleAddRow();
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplyLines.length, handleAddRow]);

  const handleNew = useCallback(() => {
    form.resetFields();
    form.setFieldsValue({ date: dayjs() });
    setSupplyLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, addLess: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]);
    setTimeout(() => datePickerRef.current?.focus(), 50);
  }, [form]);

  // ── Data loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    chartOfAccountService.getCustomerAccounts().then(setCustomers);
    narrationService.getActiveNarrationsLookup().then(setNarrations);
    inventoryService.getItemsLookup().then(setItems);
    inventoryService.getUnitsLookup().then(setUnits);
    supplyOrderService.getList().then(setSupplyOrders);

    if (isEdit) {
      fetchDetail();
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
        setSupplyLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, addLess: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]);
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
        form.setFieldsValue({
          date: dayjs(first.date),
          itemId: first.itemId,
          narration: first.narrationId,
          description: first.description,
          supplyOrderMasterId: first.supplyOrderMasterId ?? undefined
        });

        setSupplyLines(details.map(d => {
          return {
            ...d,
            key: d.seq,
            customerId: d.customerId,
            addLess: d.addLess,
            secQty: d.secQty,
            secRate: d.secRate,
            secUnit: d.secUnit,
            packQty: (d as any).qtyInPack || ((d.qty > 0 && d.secQty && d.secQty > 0) ? round(d.qty / d.secQty, 2) : 0),
            packing: (d as any).packing || 0
          };
        }));
      }
    } catch (error) {
      message.error('Failed to fetch supply details');
    } finally {
      setLoading(false);
    }
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

      const customerQtyMap = new Map<string, { qty: number; secQty?: number; rate?: number; addLess?: number; discount?: number }>();
      if (customSupplyItems && Array.isArray(customSupplyItems)) {
        customSupplyItems.forEach(ci => {
          if (ci.customerAccountId) {
            customerQtyMap.set(ci.customerAccountId, {
              qty: ci.qty,
              secQty: ci.secQty,
              rate: ci.rate,
              addLess: ci.addLess,
              discount: ci.discount
            });
          }
        });
      }

      if (order && order.details) {
        const isSec = item?.defaultUnit === item?.secondaryUnit;
        const rate = isSec ? (item?.secRate || 0) : (item?.priRate || 0);
        const secRate = item?.secRate || 0;

        const newLines = order.details.map((d, index) => {
          const setting = customerQtyMap.get(d.customerId);
          const qty = setting ? setting.qty : 1;
          const secQty = setting ? (setting.secQty || 0) : 0;
          const lineRate = setting?.rate != null ? setting.rate : rate;
          const lineDiscount = setting?.discount != null ? setting.discount : 0;
          const lineAddLess = setting?.addLess != null ? setting.addLess : 0;

          const amount = hasVariablePackFeature
            ? round(qty * (lineRate - lineDiscount) + lineAddLess, 2)
            : round((qty * (lineRate - lineDiscount)) + lineAddLess + (secQty * secRate), 2);

          return {
            key: Date.now() + index,
            seq: index + 1,
            customerId: d.customerId,
            unit: item?.defaultUnit || '',
            qty: qty,
            rate: lineRate,
            discount: lineDiscount,
            addLess: lineAddLess,
            amount: amount,
            secQty: secQty,
            secRate: secRate,
            secUnit: item?.secondaryUnit || '',
            packQty: 0,
            packing: 0
          };
        });
        setSupplyLines(newLines);
        message.success(`Loaded ${newLines.length} customers from ${order.title}`);
      }
    } catch (error) {
      message.error('Failed to load supply order');
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = async (newItemId: string) => {
    const item = items.find(i => i.id === newItemId);
    if (!item) return;

    try {
      const customSupplyItems = await customerService.getSupplyItems({ itemId: newItemId });
      const customerQtyMap = new Map<string, { qty: number; secQty?: number; rate?: number; addLess?: number; discount?: number }>();
      if (customSupplyItems && Array.isArray(customSupplyItems)) {
        customSupplyItems.forEach(ci => {
          if (ci.customerAccountId) {
            customerQtyMap.set(ci.customerAccountId, {
              qty: ci.qty,
              secQty: ci.secQty,
              rate: ci.rate,
              addLess: ci.addLess,
              discount: ci.discount
            });
          }
        });
      }

      const isSec = item?.defaultUnit === item?.secondaryUnit;
      const rate = isSec ? (item?.secRate || 0) : (item?.priRate || 0);
      const secRate = item?.secRate || 0;

      setSupplyLines(prev => prev.map(line => {
        if (!line.customerId) return line;
        const setting = customerQtyMap.get(line.customerId);
        const qty = setting ? setting.qty : (line.qty || 1);
        const secQty = setting ? (setting.secQty || 0) : (line.secQty || 0);
        const lineRate = setting?.rate != null ? setting.rate : rate;
        const lineDiscount = setting?.discount != null ? setting.discount : (line.discount || 0);
        const lineAddLess = setting?.addLess != null ? setting.addLess : (line.addLess || 0);

        const amount = hasVariablePackFeature
          ? round(qty * (lineRate - lineDiscount) + lineAddLess, 2)
          : round(qty * (lineRate - lineDiscount) + lineAddLess + (secQty * secRate), 2);

        return {
          ...line,
          unit: item?.defaultUnit || line.unit,
          qty,
          secQty,
          rate: lineRate,
          discount: lineDiscount,
          addLess: lineAddLess,
          secRate,
          secUnit: item?.secondaryUnit || line.secUnit,
          amount
        };
      }));
    } catch (err) {
      console.error('Failed to load item default customer quantities', err);
    }
  };

  // ── Header Enter Navigation: Date → Item → Supply Order Profile → Grid Row 0 Customer ──
  const handleDatePickerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => itemSelectRef.current?.focus(), 50);
    }
  }, []);

  const handleItemSelectKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Small delay to let Ant Design's own Enter handler close the dropdown first
      setTimeout(() => supplyOrderSelectRef.current?.focus(), 50);
    }
  }, []);

  const handleSupplyOrderKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Small delay to let Ant Design's own Enter handler close the dropdown first
      setTimeout(() => focusCell(0, 'customerId'), 50);
    }
  }, [focusCell]);

  const handleRemoveRow = async (key: number, seq: number) => {
    if (isEdit && typeof key === 'number' && key < 1000000000) {
      try {
        await saleSupplyService.deleteLine(voucherNo!, seq);
      } catch (error) {
        message.error('Failed to delete line from server');
        return;
      }
    }
    setSupplyLines(supplyLines.filter(l => l.key !== key));
  };

  const updateLine = (key: number, field: string, value: any) => {
    const newLines = supplyLines.map(l => {
      if (l.key === key) {
        const updated = { ...l, [field]: value };

        const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
        const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

        if (hasVariablePackFeature) {
          let kgQty = updated.qty || 0;
          let bagQty = updated.secQty || 0;
          let packQty = updated.packQty || 0;
          let packing = updated.packing || 0;
          let kgRate = updated.rate || 0;
          let bagRate = updated.secRate || 0;

          if (field === 'qty') {
            kgQty = numVal;
            if (bagQty > 0) {
              packQty = round(kgQty / bagQty, 2);
            } else if (packQty > 0) {
              bagQty = round(kgQty / packQty, 2);
            }
          } else if (field === 'secQty') {
            bagQty = numVal;
            if (packQty > 0) {
              kgQty = round(bagQty * packQty, 2);
            } else if (kgQty > 0) {
              packQty = round(kgQty / bagQty, 2);
            }
          } else if (field === 'packQty') {
            packQty = numVal;
            if (bagQty > 0) {
              kgQty = round(bagQty * packQty, 2);
            } else if (kgQty > 0) {
              bagQty = round(kgQty / packQty, 2);
            }
          } else if (field === 'packing') {
            packing = numVal;
            if (packing > 0) {
              if (bagRate > 0) {
                kgRate = round(bagRate / packing, 4);
              } else if (kgRate > 0) {
                bagRate = round(kgRate * packing, 4);
              }
            }
          } else if (field === 'rate') {
            kgRate = numVal;
            if (packing > 0) {
              bagRate = round(kgRate * packing, 4);
            }
          } else if (field === 'secRate') {
            bagRate = numVal;
            if (packing > 0) {
              kgRate = round(bagRate / packing, 4);
            }
          }

          updated.qty = round(kgQty, 2);
          updated.secQty = round(bagQty, 2);
          updated.packQty = round(packQty, 2);
          updated.packing = round(packing, 2);
          updated.rate = round(kgRate, 4);
          updated.secRate = round(bagRate, 4);
        }

        const qty = updated.qty || 0;
        const rate = updated.rate || 0;
        const disc = updated.discount || 0;
        const addLess = updated.addLess || 0;
        const secQty = updated.secQty || 0;
        const secRate = updated.secRate || 0;
        updated.amount = hasVariablePackFeature
          ? round(((qty * (rate - disc)) + addLess), 2)
          : round(((qty * (rate - disc)) + addLess + (secQty * secRate)), 2);
        return updated;
      }
      return l;
    });
    setSupplyLines(newLines);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = supplyLines.filter(l => l.customerId && l.qty > 0);

      if (validLines.length === 0) {
        message.error('Please add at least one customer');
        return;
      }

      setLoading(true);
      const request = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        supplyOrderMasterId: values.supplyOrderMasterId,
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
            secUnit: l.secUnit || null,
            secQty: l.secQty || 0,
            secRate: l.secRate || 0,
            qtyInPack: l.packQty || l.qtyInPack || null,
            packing: l.packing || null
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
    } catch (error) {
      message.error('Failed to save sale supply');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await saleSupplyService.delete(voucherNo!);
      message.success('Sale supply deleted successfully');
      navigate('/daily-entries/sale-supply');
    } catch (error) {
      message.error('Failed to delete sale supply');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = async (key: number, customerId: string) => {
    const masterItemId = form.getFieldValue('itemId');
    const item = items.find(i => i.id === masterItemId);
    const isSec = item?.defaultUnit === item?.secondaryUnit;
    const rate = isSec ? (item?.secRate || 0) : (item?.priRate || 0);
    const secRate = item?.secRate || 0;

    let defQty = 1;
    let defSecQty = 0;

    if (masterItemId && customerId) {
      try {
        const customItems = await customerService.getSupplyItems({ customerId, itemId: masterItemId });
        if (customItems && customItems.length > 0) {
          defQty = customItems[0].qty > 0 ? customItems[0].qty : 1;
          defSecQty = customItems[0].secQty || 0;
        }
      } catch (err) {
        console.error('Failed to get customer supply item default', err);
      }
    }

    setSupplyLines(prev => prev.map(l => {
      if (l.key === key) {
        const amount = hasVariablePackFeature
          ? round(defQty * (rate - (l.discount || 0)) + (l.addLess || 0), 2)
          : round(defQty * (rate - (l.discount || 0)) + (l.addLess || 0) + (defSecQty * secRate), 2);

        return {
          ...l,
          customerId,
          qty: defQty,
          secQty: defSecQty,
          rate,
          secRate,
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
    ...(!hasSecondaryQty ? [
      {
        title: 'Unit',
        dataIndex: 'unit',
        key: 'unit',
        width: 120,
        render: (text: string, record: any, rowIdx: number) => {
          const masterItemId = form.getFieldValue('itemId');
          const item = items.find(i => i.id === masterItemId);
          const filteredUnits = item
            ? units.filter(u => u.code === item.primaryUnit || u.code === item.secondaryUnit)
            : units;

          return (
            <Select
              ref={getCellRef(rowIdx, 'unit')}
              style={{ width: '100%' }}
              value={text}
              tabIndex={-1}
              onChange={(val) => updateLine(record.key, 'unit', val)}
              onKeyDown={(e) => handleCellKeyDown(rowIdx, 'unit', e)}
            >
              {filteredUnits.map(u => (
                <Select.Option key={u.code} value={u.code}>{u.title}</Select.Option>
              ))}
            </Select>
          );
        }
      }
    ] : []),
    {
      title: hasVariablePackFeature ? 'Qty (Kg)' : (hasSecondaryQty ? 'Single Qty' : 'Qty'),
      dataIndex: 'qty',
      key: 'qty',
      width: 100,
      render: (val: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'qty')}
          style={{ width: '100%' }}
          value={val}
          min={0}
          precision={2}
          keyboard={false}
          controls={false}
          onChange={(v) => updateLine(record.key, 'qty', v)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'qty', e)}
        />
      )
    },
    ...(hasVariablePackFeature ? [
      {
        title: 'Bag Qty',
        dataIndex: 'secQty',
        key: 'secQty',
        width: 100,
        render: (val: number, record: any, rowIdx: number) => (
          <InputNumber
            ref={getCellRef(rowIdx, 'secQty')}
            style={{ width: '100%' }}
            value={val}
            min={0}
            precision={2}
            keyboard={false}
            controls={false}
            onChange={(v) => updateLine(record.key, 'secQty', v)}
            onKeyDown={(e) => handleCellKeyDown(rowIdx, 'secQty', e)}
          />
        )
      },
      {
        title: 'Pack Qty',
        dataIndex: 'packQty',
        key: 'packQty',
        width: 100,
        render: (val: number, record: any, rowIdx: number) => (
          <InputNumber
            ref={getCellRef(rowIdx, 'packQty')}
            style={{ width: '100%' }}
            value={val}
            min={0}
            precision={2}
            keyboard={false}
            controls={false}
            onChange={(v) => updateLine(record.key, 'packQty', v)}
            onKeyDown={(e) => handleCellKeyDown(rowIdx, 'packQty', e)}
          />
        )
      },
      {
        title: 'Packing',
        dataIndex: 'packing',
        key: 'packing',
        width: 100,
        render: (val: number, record: any, rowIdx: number) => (
          <InputNumber
            ref={getCellRef(rowIdx, 'packing')}
            style={{ width: '100%' }}
            value={val}
            min={0}
            precision={2}
            keyboard={false}
            controls={false}
            onChange={(v) => updateLine(record.key, 'packing', v)}
            onKeyDown={(e) => handleCellKeyDown(rowIdx, 'packing', e)}
          />
        )
      }
    ] : []),
    {
      title: hasVariablePackFeature ? 'Rate (/Kg)' : (hasSecondaryQty ? 'Single Rate' : 'Rate'),
      dataIndex: 'rate',
      key: 'rate',
      width: 120,
      render: (val: number, record: any, rowIdx: number) => (
        // Rate is auto-filled — reachable by arrows but NOT by Enter flow
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
    ...((hasSecondaryQty || hasVariablePackFeature) ? [
      {
        title: hasVariablePackFeature ? 'Bag Rate' : 'Pack Rate',
        dataIndex: 'secRate',
        key: 'secRate',
        width: 120,
        render: (val: number, record: any, rowIdx: number) => (
          <InputNumber
            ref={getCellRef(rowIdx, 'secRate')}
            style={{ width: '100%' }}
            value={val}
            min={0}
            precision={4}
            step={0.01}
            keyboard={false}
            controls={false}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            onChange={(v) => updateLine(record.key, 'secRate', v)}
            onKeyDown={(e) => handleCellKeyDown(rowIdx, 'secRate', e)}
          />
        )
      }
    ] : []),
    ...(hasSecondaryQty && !hasVariablePackFeature ? [
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
      }
    ] : []),
    {
      title: 'Disc',
      dataIndex: 'discount',
      key: 'discount',
      width: 100,
      render: (val: number, record: any) => (
        // Discount is always visible but excluded from Enter flow (tabIndex={-1})
        // Users can still click it or reach it via arrow keys.
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
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right' as const,
      // Amount is read-only display — no ref, no keyboard handler, no tabIndex
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    // Keyboard shortcuts wrapper — must be focusable (tabIndex={-1}) to receive keydown
    <div
      ref={formWrapperRef}
      onKeyDown={handleFormKeyDown}
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      <Card className="shadow-sm border-gray-100 rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <Space align="center">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/sale-supply')} type="text" />
            <TruckOutlined style={{ fontSize: 24, color: '#f59e0b' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {isEdit ? `Edit Sale Supply: SP-${voucherNo}` : 'New Sale Supply'}
              </Title>
              <Text type="secondary">{isEdit ? 'Modify existing supply voucher' : 'Supply items to multiple customers'}</Text>
            </div>
          </Space>
          <Space>
            {isEdit && (
              <Popconfirm title="Delete this supply voucher?" onConfirm={handleDelete}>
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
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
              style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
            >
              Save Supply
            </Button>
          </Space>
        </div>

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={8} lg={4}>
              <Form.Item label="Voucher #">
                <Input value={isEdit ? `SP-${voucherNo}` : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} tabIndex={-1} />
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
            <Col xs={24} sm={16} lg={8}>
              <Form.Item label="Item to Supply" name="itemId" rules={[{ required: true }]}>
                <Select
                  id="item-select"
                  ref={itemSelectRef}
                  showSearch
                  placeholder="Select Item"
                  prefix={<AppstoreOutlined />}
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

            <Col xs={24} sm={24} lg={8}>
              <Form.Item label="Supply Order Profile" name="supplyOrderMasterId">
                <Select
                  ref={supplyOrderSelectRef}
                  showSearch
                  placeholder="Select Supply Order Profile"
                  optionFilterProp="children"
                  onChange={handleLoadFromSupplyOrder}
                  onKeyDown={handleSupplyOrderKeyDown}
                  allowClear
                >
                  {supplyOrders.map(o => (
                    <Select.Option key={o.id} value={o.id}>{o.title}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} lg={12}>
              {/* Narration — mouse-only, removed from Tab flow */}
              <Form.Item label="Narration" name="narration">
                <Select showSearch placeholder="Select narration" prefix={<FileTextOutlined />} allowClear tabIndex={-1}>
                  {narrations.map(n => (
                    <Select.Option key={n.code} value={n.code}>{n.title}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              {/* Description — mouse-only, removed from Tab flow */}
              <Form.Item label="Description" name="description">
                <Input placeholder="Additional supply details..." tabIndex={-1} />
              </Form.Item>
            </Col>
          </Row>

          <div className="flex justify-between items-center mb-4 mt-2">
            <Title level={5} style={{ margin: 0 }}>Customer List</Title>
            <Space>
              <Tooltip title="Ins — Add new row">
                <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />}>Add Row</Button>
              </Tooltip>
            </Space>
          </div>

          <Table
            dataSource={supplyLines}
            columns={columns}
            pagination={false}
            rowKey="key"
            size="small"
            bordered
            className="mb-4"
            summary={pageData => {
              let total = 0;
              pageData.forEach(({ amount }) => {
                total += amount || 0;
              });
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={6} align="right"><b>Net Total</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ color: '#f59e0b' }}>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}></Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        </Form>

        {/* ── Keyboard shortcut hint bar ─────────────────────────────────── */}
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
      </Card>
    </div>
  );
};
