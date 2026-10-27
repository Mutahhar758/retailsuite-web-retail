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
import { purchaseReturnService } from '../../services/purchaseReturnService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';
import { round } from '../../utils/numberUtils';
import { useGridKeyboard } from '../../hooks/useGridKeyboard';

const { Title, Text } = Typography;

export const WandaPurchaseReturnForm: React.FC = () => {
  const { voucherNo } = useParams<{ voucherNo: string }>();
  const navigate = useNavigate();
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

  const addRow = useCallback(() => {
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
          amount: 0,
          secQty: 0,
          secRate: 0,
          packQty: 0,
          packing: 0
        }
      ];
    });
  }, []);

  const enterCols = ['itemId', 'qty', 'secQty', 'packQty', 'packing', 'rate', 'secRate'];
  const arrowCols = ['itemId', 'qty', 'secQty', 'packQty', 'packing', 'rate', 'secRate', 'addLess'];

  const { getCellRef, handleCellKeyDown, focusCell } = useGridKeyboard({
    rowCount: purchaseLines.length,
    enterCols,
    arrowCols,
    firstColKey: 'itemId',
    onAddRow: addRow,
    pendingFocusRef,
    isRowValid: (idx) => !!purchaseLines[idx]?.itemId,
    onSave: () => handleSave(),
  });

  const handleNew = useCallback(() => {
    form.resetFields();
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
      secRate: 0,
      packQty: 0,
      packing: 0
    }]);
    setTimeout(() => datePickerRef.current?.focus(), 50);
  }, [form]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [itemsRes, vendorsRes, narrsRes] = await Promise.all([
          inventoryService.getItemsLookup(),
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
  }, []);

  useEffect(() => {
    if (isEdit) {
      const loadPurchase = async () => {
        try {
          setLoading(true);
          const details = await purchaseReturnService.getDetail(voucherNo!);
          if (details && details.length > 0) {
            const first = details[0];
            form.setFieldsValue({
              date: dayjs(first.date),
              account: first.accountId,
              narration: first.narrationId,
              description: first.description
            });
            setPurchaseLines(details.map((d, i) => ({
              key: i,
              seq: d.seq,
              itemId: d.itemId,
              unit: d.unit,
              qty: d.qty,
              rate: d.rate,
              addLess: d.addLess,
              amount: (d.qty * d.rate) + (d.addLess || 0),
              secQty: d.secQty,
              secRate: d.secRate,
              secUnit: d.secUnit,
              packQty: (d as any).qtyInPack || ((d.qty > 0 && d.secQty && d.secQty > 0) ? round(d.qty / d.secQty, 2) : 0),
              packing: (d as any).packing || 0
            })));
          }
        } catch {
          message.error('Failed to load return details');
          navigate('/daily-entries/purchase-return');
        } finally {
          setLoading(false);
        }
      };
      loadPurchase();
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
        secRate: 0,
        packQty: 0,
        packing: 0
      }]);
    }
  }, [isEdit, voucherNo, form, navigate]);

  const removeRow = async (record: any) => {
    if (isEdit && record.seq) {
      try {
        await purchaseReturnService.deleteLine(voucherNo!, record.seq);
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

        if (field === 'itemId') {
          const item = items.find(i => String(i.id) === String(value));
          if (item) {
            updated.unit = item.defaultUnit || item.primaryUnit || '';
            updated.rate = item.costRate || 0;
            updated.secUnit = item.secondaryUnit || '';
            const pSize = Number(item.qtyInPack || (item as any)?.QtyInPack || (item as any)?.qty_in_pack || 0);
            updated.secRate = item.secCostRate || ((item.costRate || 0) * (pSize > 0 ? pSize : 1));
            updated.packQty = pSize;
            updated.packing = (item as any)?.packing || 0;
          }
        }

        if (field === 'qty') {
          const kg = numVal;
          const pQty = Number(updated.packQty) || 0;
          const pck = Number(updated.packing) || 0;
          const effectivePack = pQty > 0 ? pQty : (pck > 0 ? pck : 0);
          updated.secQty = effectivePack > 0 ? round(kg / effectivePack, 2) : 0;
        }

        if (field === 'secQty') {
          const sQty = numVal;
          const pQty = Number(updated.packQty) || 0;
          const pck = Number(updated.packing) || 0;
          const effectivePack = pQty > 0 ? pQty : (pck > 0 ? pck : 0);
          updated.qty = round(sQty * effectivePack, 2);
        }

        if (field === 'packQty') {
          const pQty = numVal;
          const kg = Number(updated.qty) || 0;
          updated.secQty = pQty > 0 ? round(kg / pQty, 2) : 0;
        }

        if (field === 'rate') {
          const r = numVal;
          const pQty = Number(updated.packQty) || 0;
          const pck = Number(updated.packing) || 0;
          const totalPack = pQty + pck;
          if (totalPack > 0) {
            updated.secRate = round(r * totalPack, 2);
          }
        }

        if (field === 'secRate') {
          const sr = numVal;
          const pQty = Number(updated.packQty) || 0;
          const pck = Number(updated.packing) || 0;
          const totalPack = pQty + pck;
          if (totalPack > 0) {
            updated.rate = round(sr / totalPack, 4);
          }
        }

        const qty = Number(updated.qty) || 0;
        const rate = Number(updated.rate) || 0;
        const addLess = Number(updated.addLess) || 0;
        updated.amount = round((qty * rate) + addLess, 2);

        return updated;
      }
      return row;
    }));
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await purchaseReturnService.delete(voucherNo!);
      message.success('Return deleted successfully');
      navigate('/daily-entries/purchase-return');
    } catch {
      message.error('Failed to delete return');
    } finally {
      setLoading(false);
    }
  };


  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = purchaseLines.filter(l => l.itemId && l.qty > 0);

      if (validLines.length === 0) {
        message.error('Please add at least one valid item');
        return;
      }

      setLoading(true);
      const request = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        lines: validLines.map(l => ({
          seq: l.seq,
          itemId: l.itemId,
          unit: l.unit || null,
          qty: l.qty,
          rate: l.rate,
          addLess: l.addLess || 0,
          secUnit: l.secUnit || null,
          secQty: l.secQty || 0,
          secRate: l.secRate || 0,
          qtyInPack: l.packQty || l.qtyInPack || null,
          packing: l.packing || null
        }))
      };

      if (isEdit) {
        await purchaseReturnService.update(voucherNo!, request);
        message.success('Purchase return updated successfully');
      } else {
        const newVNo = await purchaseReturnService.create(request);
        message.success('Purchase return created successfully');
        navigate(`/daily-entries/purchase-return/${newVNo}`);
      }
    } catch {
      message.error('Failed to save purchase return');
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
      addRow();
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
    {
      title: 'Qty (Kg)',
      dataIndex: 'qty',
      width: 100,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'qty')}
          value={text}
          style={{ width: '100%' }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'qty', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'qty', e)}
          min={0}
          precision={2}
        />
      )
    },
    {
      title: 'Bag Qty',
      dataIndex: 'secQty',
      width: 100,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'secQty')}
          value={text}
          style={{ width: '100%' }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'secQty', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'secQty', e)}
          min={0}
          precision={2}
        />
      )
    },
    {
      title: 'Pack Qty',
      dataIndex: 'packQty',
      width: 100,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'packQty')}
          value={text}
          style={{ width: '100%' }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'packQty', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'packQty', e)}
          min={0}
          precision={2}
        />
      )
    },
    {
      title: 'Packing',
      dataIndex: 'packing',
      width: 100,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'packing')}
          value={text}
          style={{ width: '100%' }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'packing', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'packing', e)}
          min={0}
          precision={2}
        />
      )
    },
    {
      title: 'Rate (/Kg)',
      dataIndex: 'rate',
      width: 120,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'rate')}
          value={text}
          style={{ width: '100%' }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'rate', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'rate', e)}
          min={0}
          precision={4}
          step={0.01}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        />
      )
    },
    {
      title: 'Bag Rate',
      dataIndex: 'secRate',
      width: 120,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'secRate')}
          value={text}
          style={{ width: '100%' }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'secRate', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'secRate', e)}
          min={0}
          precision={4}
          step={0.01}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        />
      )
    },
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
      render: (val: number) => <Text strong>{val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
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
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/purchase-return')} type="text" />
            <UndoOutlined style={{ fontSize: 24, color: '#e11d48' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {isEdit ? `Edit Purchase Return: PR-${voucherNo}` : 'New Purchase Return'}
              </Title>
              <Text type="secondary">{isEdit ? 'Modify existing purchase return' : 'Record a return to vendor'}</Text>
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
                <Input value={isEdit ? `PR-${voucherNo}` : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} />
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
            <Col xs={24} lg={24}>
              <Form.Item label="Description" name="description">
                <Input placeholder="Additional return details..." />
              </Form.Item>
            </Col>
          </Row>

          <div className="flex justify-between items-center mb-4 mt-2">
            <Title level={5} style={{ margin: 0 }}>Return Items</Title>
            <Button type="dashed" icon={<PlusOutlined />} onClick={addRow}>Add Row (Ins)</Button>
          </div>

          <Table
            dataSource={purchaseLines}
            columns={columns}
            pagination={false}
            size="small"
            bordered
            className="mb-4"
            summary={pageData => {
              let totalAmount = 0;
              pageData.forEach(({ amount }) => {
                totalAmount += amount || 0;
              });
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={8} align="right"><b>Total Return Amount</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ color: '#e11d48' }}>Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}></Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        <KeyboardShortcutsBar shortcuts={[{ key: 'F1', label: 'New' }, { key: 'F2', label: 'Vendor' }, { key: 'F5', label: 'Save' }, { key: 'Ins', label: 'Add Row' }, { key: 'Enter', label: 'Next Field' }, { key: '↑↓←→', label: 'Navigate' }, { key: 'Esc', label: 'Cancel Edit' }]} />
        </Form>
      </Card>
    </div>
  );
};
