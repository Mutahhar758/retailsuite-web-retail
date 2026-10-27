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
import { round } from '../../utils/numberUtils';
import { saleReturnService } from '../../services/saleReturnService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { useGridKeyboard } from '../../hooks/useGridKeyboard';

const { Title, Text } = Typography;

export const WandaSaleReturnForm: React.FC = () => {
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
      return [...prev, { key: Date.now(), seq: newSeq, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }];
    });
  }, []);

  const enterCols = ['itemId', 'qty', 'secQty', 'packQty', 'packing'];
  const arrowCols = ['itemId', 'qty', 'secQty', 'packQty', 'packing', 'rate', 'secRate', 'discount'];

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
    setSaleLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]);
    setTimeout(() => datePickerRef.current?.focus(), 50);
  }, [form]);

  useEffect(() => {
    chartOfAccountService.getCustomerAccounts().then(setCustomers);
    narrationService.getActiveNarrationsLookup().then(setNarrations);
    inventoryService.getItemsLookup().then(setItems);

    if (isEdit) {
      fetchDetail();
    } else {
      setSaleLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]);
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

        setSaleLines(details.map(d => {
          const pQty = (d as any).qtyInPack || ((d.qty > 0 && d.secQty && d.secQty > 0) ? round(d.qty / d.secQty, 2) : 0);
          const pCking = (d as any).packing || 0;
          return {
            ...d,
            key: d.seq,
            rate: d.rate,
            discount: d.discount,
            amount: d.qty * (d.rate - (d.discount || 0)),
            secQty: d.secQty,
            secRate: d.secRate,
            secUnit: d.secUnit,
            packQty: pQty,
            packing: pCking
          };
        }));
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
        const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
        const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

        if (field === 'itemId') {
          const item = items.find(i => String(i.id) === String(value));
          if (item) {
            updated.unit = item.defaultUnit || item.primaryUnit || '';
            updated.rate = item.priRate || 0;
            updated.secUnit = item.secondaryUnit || '';
            const pSize = Number(item.qtyInPack || (item as any)?.QtyInPack || (item as any)?.qty_in_pack || 0);
            updated.secRate = item.secRate || ((item.priRate || 0) * (pSize > 0 ? pSize : 1));
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
        const discount = Number(updated.discount) || 0;
        updated.amount = round(qty * (rate - discount), 2);
        return updated;
      }
      return l;
    });
    setSaleLines(newLines);
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
            secUnit: l.secUnit || null,
            secQty: l.secQty || 0,
            secRate: l.secRate || 0,
            qtyInPack: l.packQty || 0,
            packing: l.packing || 0
          };
        })
      };

      if (isEdit) {
        await saleReturnService.update(voucherNo!, request);
        message.success('Sale return updated successfully');
      } else {
        const newVno = await saleReturnService.create(request);
        message.success('Sale return created successfully');
        navigate(`/daily-entries/sale-return/${newVno}`);
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
    {
      title: 'Qty (Kg)',
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
          controls={false}
          keyboard={false}
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
          controls={false}
          keyboard={false}
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
          controls={false}
          keyboard={false}
          onChange={(v) => updateLine(record.key, 'packing', v)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'packing', e)}
        />
      )
    },
    {
      title: 'Rate (/Kg)',
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
    {
      title: 'Bag Rate',
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
          controls={false}
          keyboard={false}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateLine(record.key, 'secRate', v)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'secRate', e)}
        />
      )
    },
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
                  <Table.Summary.Cell index={0} colSpan={8} align="right"><b>Total Refund Amount</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong style={{ color: '#e11d48' }}>Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        <KeyboardShortcutsBar shortcuts={[{ key: 'F1', label: 'New' }, { key: 'F2', label: 'Customer' }, { key: 'F5', label: 'Save' }, { key: 'Ins', label: 'Add Row' }, { key: 'Enter', label: 'Next Field' }, { key: '↑↓←→', label: 'Navigate' }, { key: 'Esc', label: 'Cancel Edit' }]} />
        </Form>
      </Card>
    </div>
  );
};
