import useFormShortcuts from '../../hooks/useFormShortcuts';
import KeyboardShortcutsBar from '../../components/common/KeyboardShortcutsBar';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  UndoOutlined, UserOutlined, FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';
import { round } from '../../utils/numberUtils';
import { useSettingsStore, INVENTORY_ENABLE_SECONDARY_QTY_KEY, MOBILE_SHOP_ENABLE_KEY } from '../../stores/useSettingsStore';
import { BarcodeFastScanBar } from '../../components/common/BarcodeFastScanBar';
import { saleReturnService } from '../../services/saleReturnService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { useGridKeyboard } from '../../hooks/useGridKeyboard';

const { Title, Text } = Typography;

export const NormalSaleReturnForm: React.FC = () => {
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const { getSetting, fetchSettings } = useSettingsStore();
  const settingSecQty = getSetting(INVENTORY_ENABLE_SECONDARY_QTY_KEY, '');
  const hasSecondaryQty = settingSecQty !== '' ? settingSecQty === 'true' : (currentOrg?.hasSecondaryQty ?? false);
  const settingMobile = getSetting(MOBILE_SHOP_ENABLE_KEY, '');
  const hasMobileShopFeature = settingMobile !== '' ? settingMobile === 'true' : (currentOrg?.hasMobileShopFeature ?? false);

  const { voucherNo } = useParams<{ voucherNo: string }>();
  const isEdit = !!voucherNo && voucherNo !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [saleLines, setSaleLines] = useState<any[]>([]);

  // Keyboard navigation refs
  const pendingFocusRef = useRef<{ rowIdx: number; colKey: string } | null>(null);
  const datePickerRef = useRef<any>(null);
  const customerSelectRef = useRef<any>(null);
  const narrationSelectRef = useRef<any>(null);

  const handleAddRow = useCallback(() => {
    setSaleLines(prev => {
      const newSeq = prev.length > 0 ? Math.max(...prev.map(l => l.seq)) + 1 : 1;
      return [...prev, { key: Date.now(), seq: newSeq, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0 }];
    });
  }, []);

  const enterCols = [
    'itemId',
    'qty',
    ...(hasSecondaryQty ? ['secQty', 'secRate'] : [])
  ];

  const arrowCols = [
    'itemId',
    'qty',
    'rate',
    ...(hasSecondaryQty ? ['secQty', 'secRate'] : []),
    'discount'
  ];

  const { getCellRef, handleCellKeyDown, focusCell } = useGridKeyboard({
    rowCount: saleLines.length,
    enterCols,
    arrowCols,
    firstColKey: 'itemId',
    onAddRow: handleAddRow,
    pendingFocusRef,
    isRowValid: (idx) => !!saleLines[idx]?.itemId,
    onSave: () => handleSave(),
  });

  const handleNew = useCallback(() => {
    form.resetFields();
    form.setFieldsValue({ date: dayjs() });
    setSaleLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0 }]);
    setTimeout(() => datePickerRef.current?.focus(), 50);
  }, [form]);

  useEffect(() => {
    fetchSettings('Inventory');
    chartOfAccountService.getCustomerAccounts().then(setCustomers);
    narrationService.getActiveNarrationsLookup().then(setNarrations);
    inventoryService.getItemsLookup().then(setItems);

    if (isEdit) {
      fetchDetail();
    } else {
      setSaleLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0 }]);
      form.setFieldsValue({ date: dayjs() });
    }
  }, [isEdit, voucherNo]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const details = await saleReturnService.getDetail(voucherNo!);
      if (details.length > 0) {
        const first = details[0];
        form.setFieldsValue({
          date: dayjs(first.date),
          account: first.accountId,
          narration: first.narrationId,
          description: first.description
        });

        setSaleLines(details.map(d => ({
          ...d,
          key: d.seq,
          rate: d.rate,
          discount: d.discount,
          amount: d.amount,
          secQty: d.secQty,
          secRate: d.secRate,
          secUnit: d.secUnit
        })));
      }
    } catch {
      message.error('Failed to fetch sale return details');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRow = async (key: number, seq: number) => {
    if (isEdit && typeof key === 'number' && key < 1000000000) {
      try {
        await saleReturnService.deleteLine(voucherNo!, seq);
      } catch {
        message.error('Failed to delete line from server');
        return;
      }
    }
    setSaleLines(saleLines.filter(l => l.key !== key));
  };

  const updateLine = (key: number, field: string, value: any) => {
    const newLines = saleLines.map(l => {
      if (l.key === key) {
        const updated = { ...l, [field]: value };
        if (field === 'itemId') {
          const item = items.find(i => String(i.id) === String(value));
          if (item) {
            const hasSec = !!(item.secondaryUnit && item.secondaryUnit.trim());
            const isSec = hasSec && !!(item.defaultUnit && item.defaultUnit.trim().toLowerCase() === item.secondaryUnit?.trim().toLowerCase());
            const baseRate = (isSec && (item.secRate || 0) > 0) ? (item.secRate || 0) : (item.priRate || 0);
            const pSize = Number(item.qtyInPack || (item as any)?.QtyInPack || (item as any)?.qty_in_pack || 0);
            const baseSecRate = item.secRate || ((item.priRate || 0) * (pSize > 0 ? pSize : 1));

            updated.unit = item.defaultUnit || item.primaryUnit || '';
            updated.rate = baseRate;
            updated.secUnit = item.secondaryUnit || '';
            updated.secRate = baseSecRate;
          }
        }

        const qty = Number(updated.qty) || 0;
        const rate = Number(updated.rate) || 0;
        const secQty = Number(updated.secQty) || 0;
        const secRate = Number(updated.secRate) || 0;
        const discount = Number(updated.discount) || 0;

        updated.amount = round(((qty * rate) - discount) + (secQty * secRate), 2);
        return updated;
      }
      return l;
    });
    setSaleLines(newLines);
  };

  const handleBarcodeScanned = (
    scannedItem: Item,
    scanQty: number = 1,
    customAmount?: number,
    customRate?: number
  ) => {
    setSaleLines(prev => {
      const existingIndex = prev.findIndex(l => l.itemId === scannedItem.id);
      const effectiveRate = customRate !== undefined
        ? customRate
        : (scannedItem.priRate !== undefined && scannedItem.priRate !== null ? scannedItem.priRate : 0);

      if (existingIndex >= 0) {
        const updatedLines = [...prev];
        const existingLine = updatedLines[existingIndex];
        const newQty = (existingLine.qty || 0) + scanQty;
        const pSize = Number(scannedItem.qtyInPack || (scannedItem as any).QtyInPack || (scannedItem as any).qty_in_pack || 0);
        const rate = effectiveRate;
        const secRate = scannedItem.secRate || (rate * (pSize > 0 ? pSize : 1));
        const amount = customAmount !== undefined
          ? (existingLine.amount || 0) + customAmount
          : round(((newQty * rate) - (existingLine.discount || 0)) + ((existingLine.secQty || 0) * (existingLine.secRate || secRate)), 2);

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
          discount: 0,
          amount
        };

        if (emptyRowIndex === updatedLines.length - 1) {
          const nextSeq = Math.max(...updatedLines.map(l => l.seq || 0)) + 1;
          updatedLines.push({
            key: Date.now() + 1,
            seq: nextSeq,
            qty: 1,
            rate: 0,
            discount: 0,
            amount: 0,
            secQty: 0,
            secRate: 0
          });
        }
        return updatedLines;
      } else {
        const nextSeq = Math.max(...prev.map(l => l.seq || 0), 0) + 1;
        return [
          ...prev,
          {
            key: Date.now(),
            seq: nextSeq,
            itemId: scannedItem.id,
            unit: scannedItem.defaultUnit || scannedItem.primaryUnit,
            rate,
            secUnit: scannedItem.secondaryUnit,
            secRate,
            secQty: 0,
            qty: scanQty,
            discount: 0,
            amount
          },
          {
            key: Date.now() + 1,
            seq: nextSeq + 1,
            qty: 1,
            rate: 0,
            discount: 0,
            amount: 0,
            secQty: 0,
            secRate: 0
          }
        ];
      }
    });
  };

  const totalAmount = saleLines.reduce((sum, l) => sum + (l.amount || 0), 0);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = saleLines.filter(l => l.itemId && l.qty > 0);
      if (validLines.length === 0) {
        message.error('Please add at least one item');
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
        lines: validLines.map(l => {
          const item = items.find(i => i.id === l.itemId);
          return {
            seq: l.seq,
            itemId: l.itemId,
            unit: item?.itemType === 'Service' ? null : (l.unit || null),
            qty: l.qty,
            rate: l.rate,
            discount: l.discount || 0,
            imei: l.imei || null,
            imei2: l.imei2 || null,
            secUnit: l.secUnit || null,
            secQty: l.secQty || 0,
            secRate: l.secRate || 0
          };
        })
      };

      if (isEdit) {
        await saleReturnService.update(voucherNo!, request);
        message.success('Sale return updated successfully');
      } else {
        const newVNo = await saleReturnService.create(request);
        message.success('Sale return created successfully');
        navigate(`/daily-entries/sale-return/${newVNo}`);
      }
    } catch {
      message.error('Failed to save sale return');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await saleReturnService.delete(voucherNo!);
      message.success('Sale return deleted successfully');
      navigate('/daily-entries/sale-return');
    } catch {
      message.error('Failed to delete sale return');
    } finally {
      setLoading(false);
    }
  };

  // Form shortcut keys
  useFormShortcuts({
    onNew: handleNew,
    onFocusSearch: () => customerSelectRef.current?.focus(),
    onSave: handleSave,
    onAddRow: () => {
      pendingFocusRef.current = { rowIdx: saleLines.length, colKey: 'itemId' };
      handleAddRow();
    },
  });

  const handleDatePickerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => customerSelectRef.current?.focus(), 50);
    }
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
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
      title: 'Item',
      dataIndex: 'itemId',
      key: 'itemId',
      render: (text: string, record: any, rowIdx: number) => (
        <Select
          ref={getCellRef(rowIdx, 'itemId')}
          showSearch
          style={{ width: '100%' }}
          placeholder="Select Item"
          optionFilterProp="children"
          value={text}
          onChange={(val) => updateLine(record.key, 'itemId', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'itemId', e)}
        >
          {items.map(i => (
            <Select.Option key={i.id} value={i.id}>{i.title}</Select.Option>
          ))}
        </Select>
      )
    },
    ...(hasMobileShopFeature ? [
      {
        title: 'IMEI / Serial',
        dataIndex: 'imei',
        key: 'imei',
        width: 170,
        render: (text: string, record: any) => (
          <Input
            value={text}
            placeholder="Scan/Type IMEI"
            onChange={(e) => updateLine(record.key, 'imei', e.target.value)}
          />
        )
      },
      {
        title: 'IMEI 2',
        dataIndex: 'imei2',
        key: 'imei2',
        width: 150,
        render: (text: string, record: any) => (
          <Input
            value={text}
            placeholder="IMEI 2 (Optional)"
            onChange={(e) => updateLine(record.key, 'imei2', e.target.value)}
          />
        )
      }
    ] : []),
    {
      title: hasSecondaryQty ? 'Single Qty' : 'Qty',
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
          controls={false}
          keyboard={false}
          onChange={(v) => updateLine(record.key, 'qty', v)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'qty', e)}
        />
      )
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
          controls={false}
          keyboard={false}
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
            controls={false}
            keyboard={false}
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
      render: (val: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'discount')}
          style={{ width: '100%' }}
          value={val}
          min={0}
          controls={false}
          keyboard={false}
          onChange={(v) => updateLine(record.key, 'discount', v)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'discount', e)}
        />
      )
    },
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
          disabled={saleLines.length === 1}
        />
      )
    }
  ];

  return (
    <div tabIndex={-1} style={{ outline: 'none' }}>
      <Card className="shadow-sm border-gray-100 rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <Space align="center">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/sale-return')} type="text" />
            <UndoOutlined style={{ fontSize: 24, color: '#e11d48' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {isEdit ? `Edit Sale Return: SR-${voucherNo}` : 'New Sale Return'}
              </Title>
              <Text type="secondary">{isEdit ? 'Modify existing sale return' : 'Process a customer return'}</Text>
            </div>
          </Space>
          <Space>
            {isEdit && (
              <Popconfirm title="Delete this return?" onConfirm={handleDelete}>
                <Button danger icon={<DeleteOutlined />}>Delete</Button>
              </Popconfirm>
            )}
            <Button type="primary" danger icon={<SaveOutlined />} data-action="save" className="form-save-btn" onClick={handleSave} loading={loading}>
              Save Return (F5)
            </Button>
          </Space>
        </div>

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={8} lg={4}>
              <Form.Item label="Voucher #">
                <Input value={isEdit ? `SR-${voucherNo}` : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} />
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
              <Form.Item label="Customer" name="account" rules={[{ required: true }]}>
                <Select
                  ref={customerSelectRef}
                  showSearch
                  placeholder="Select Customer"
                  prefix={<UserOutlined />}
                  optionFilterProp="children"
                  onKeyDown={handleCustomerKeyDown}
                >
                  {customers.map(c => (
                    <Select.Option key={c.account} value={c.account}>{c.title}</Select.Option>
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
            <Col xs={24} lg={24}>
              <Form.Item label="Description" name="description">
                <Input placeholder="Additional return details..." />
              </Form.Item>
            </Col>
          </Row>

          <div className="flex justify-between items-center mb-4 mt-2">
            <Title level={5} style={{ margin: 0 }}>Return Items</Title>
            <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />}>Add Row (Ins)</Button>
          </div>
          
          <BarcodeFastScanBar
            items={items}
            onScanItem={handleBarcodeScanned}
          />

          <Table
            dataSource={saleLines}
            columns={columns}
            pagination={false}
            rowKey="key"
            size="small"
            bordered
            className="mb-6"
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={hasSecondaryQty ? 6 : 4} align="right"><b>Total Refund Amount</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong style={{ color: '#e11d48' }}>Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        <KeyboardShortcutsBar shortcuts={[{ key: 'F1', label: 'New' }, { key: 'F2', label: 'Customer' }, { key: 'F3', label: 'Barcode' }, { key: 'F5', label: 'Save' }, { key: 'Ins', label: 'Add Row' }, { key: 'Enter', label: 'Next Field' }, { key: '↑↓←→', label: 'Navigate' }, { key: 'Esc', label: 'Cancel Edit' }]} />
        </Form>
      </Card>
    </div>
  );
};
