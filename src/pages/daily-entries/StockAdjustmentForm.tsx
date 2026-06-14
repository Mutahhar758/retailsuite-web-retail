import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  AppstoreAddOutlined, FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { stockAdjustmentService } from '../../services/stockAdjustmentService';
import { inventoryService, type Item, type Unit } from '../../services/inventoryService';
import { narrationService, type NarrationDto } from '../../services/narrationService';

const { Title, Text } = Typography;

export const StockAdjustmentForm: React.FC = () => {
  const { voucherNo } = useParams<{ voucherNo: string }>();
  const isEdit = !!voucherNo && voucherNo !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [adjustmentLines, setAdjustmentLines] = useState<any[]>([]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [itemsRes, unitsRes, narrsRes] = await Promise.all([
          inventoryService.getItems(),
          inventoryService.getUnits(),
          narrationService.getActiveNarrations()
        ]);
        setItems(itemsRes);
        setUnits(unitsRes);
        setNarrations(narrsRes);
      } catch (error) {
        message.error('Failed to load lookups');
      }
    };
    fetchLookups();

    if (isEdit) {
      fetchDetail();
    } else {
      setAdjustmentLines([{ key: Date.now(), seq: 1, qtyIn: 0, qtyOut: 0, rate: 0, amount: 0 }]);
      form.setFieldsValue({ date: dayjs() });
    }
  }, [isEdit, voucherNo]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const details = await stockAdjustmentService.getDetail(voucherNo!);
      if (details && details.length > 0) {
        const first = details[0];
        form.setFieldsValue({
          date: dayjs(first.date),
          narration: first.narrationId,
          description: first.description
        });

        setAdjustmentLines(details.map(d => ({
          ...d,
          key: d.seq || Date.now() + Math.random(),
          amount: d.amount || ((d.qtyIn - d.qtyOut) * d.rate)
        })));
      } else {
        setAdjustmentLines([{ key: Date.now(), seq: 1, qtyIn: 0, qtyOut: 0, rate: 0, amount: 0 }]);
      }
    } catch (error) {
      message.error('Failed to fetch stock adjustment details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = () => {
    setAdjustmentLines(prev => {
      const newSeq = prev.length > 0 ? Math.max(...prev.map(l => l.seq)) + 1 : 1;
      return [...prev, { key: Date.now(), seq: newSeq, qtyIn: 0, qtyOut: 0, rate: 0, amount: 0 }];
    });
  };

  const handleRemoveRow = async (key: number, seq: number) => {
    if (isEdit && typeof key === 'number' && key < 1000000000) {
      try {
        await stockAdjustmentService.deleteLine(voucherNo!, seq);
      } catch (error) {
        message.error('Failed to delete line');
        return;
      }
    }
    setAdjustmentLines(prev => prev.filter(l => l.key !== key));
  };

  const updateLine = (key: number, field: string, value: any) => {
    setAdjustmentLines(prev => {
      const newLines = prev.map(l => {
        if (l.key === key) {
          const updated = { ...l, [field]: value };
          if (field === 'itemId') {
            const item = items.find(i => i.id === value);
            if (item) {
              updated.unit = item.defaultUnit || item.primaryUnit;
              updated.rate = item.priRate;
              updated.itemCategoryCode = item.itemCategoryCode;
            }
          }
          const qtyIn = updated.qtyIn || 0;
          const qtyOut = updated.qtyOut || 0;
          const rate = updated.rate || 0;
          updated.amount = (qtyIn - qtyOut) * rate;
          return updated;
        }
        return l;
      });

      const lastRow = newLines[newLines.length - 1];
      if (lastRow.key === key && lastRow.itemId && (lastRow.qtyIn !== 0 || lastRow.qtyOut !== 0)) {
        const newSeq = newLines.length > 0 ? Math.max(...newLines.map(l => l.seq)) + 1 : 1;
        return [...newLines, { key: Date.now() + 1, seq: newSeq, qtyIn: 0, qtyOut: 0, rate: 0, amount: 0 }];
      }
      return newLines;
    });
  };

  // const totalAmount = adjustmentLines.reduce((sum, l) => sum + (l.amount || 0), 0);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = adjustmentLines.filter(l => l.itemId && ((l.qtyIn || 0) !== 0 || (l.qtyOut || 0) !== 0));
      if (validLines.length === 0) {
        message.error('Please add at least one item');
        return;
      }

      setLoading(true);
      const request = {
        date: values.date.format('YYYY-MM-DD'),
        narration: values.narration,
        description: values.description,
        lines: validLines.map(l => ({
          seq: l.seq,
          itemId: l.itemId,
          itemCategoryCode: l.itemCategoryCode,
          unit: l.unit,
          qtyIn: l.qtyIn,
          qtyOut: l.qtyOut,
          rate: l.rate
        }))
      };

      if (isEdit) {
        await stockAdjustmentService.update(voucherNo!, request);
        message.success('Stock adjustment updated successfully');
      } else {
        const newVno = await stockAdjustmentService.create(request);
        message.success('Stock adjustment created successfully');
        navigate(`/daily-entries/stock-adjustment/${newVno}`);
      }
    } catch (error) {
      message.error('Failed to save stock adjustment');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await stockAdjustmentService.delete(voucherNo!);
      message.success('Stock adjustment deleted successfully');
      navigate('/daily-entries/stock-adjustment');
    } catch (error) {
      message.error('Failed to delete stock adjustment');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Item',
      dataIndex: 'itemId',
      key: 'itemId',
      render: (text: string, record: any) => (
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder="Select Item"
          optionFilterProp="children"
          value={text}
          onChange={(val) => updateLine(record.key, 'itemId', val)}
        >
          {items.map(i => (
            <Select.Option key={i.id} value={i.id}>{i.title}</Select.Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: 120,
      render: (text: string, record: any) => {
        const item = items.find(i => i.id === record.itemId);
        const filteredUnits = item ? units.filter(u => u.code === item.primaryUnit || u.code === item.secondaryUnit) : units;
        return (
          <Select style={{ width: '100%' }} value={text} disabled={!record.itemId} onChange={(val) => updateLine(record.key, 'unit', val)}>
            {filteredUnits.map(u => (
              <Select.Option key={u.code} value={u.code}>{u.title}</Select.Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: 'Qty In',
      dataIndex: 'qtyIn',
      key: 'qtyIn',
      width: 100,
      render: (val: number, record: any) => (
        <InputNumber 
          style={{ width: '100%' }} 
          value={val} 
          step={0.001}
          precision={3}
          onChange={(v) => updateLine(record.key, 'qtyIn', v)} 
        />
      )
    },
    {
      title: 'Qty Out',
      dataIndex: 'qtyOut',
      key: 'qtyOut',
      width: 100,
      render: (val: number, record: any) => (
        <InputNumber 
          style={{ width: '100%' }} 
          value={val} 
          step={0.001}
          precision={3}
          onChange={(v) => updateLine(record.key, 'qtyOut', v)} 
        />
      )
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      key: 'rate',
      width: 120,
      render: (val: number, record: any) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0}
          precision={2}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateLine(record.key, 'rate', v)}
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
          disabled={adjustmentLines.length === 1}
        />
      )
    }
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/stock-adjustment')} type="text" />
          <AppstoreAddOutlined style={{ fontSize: 24, color: '#7c3aed' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit Stock Adjustment: ADJ-${voucherNo}` : 'New Stock Adjustment'}
            </Title>
            <Text type="secondary">{isEdit ? 'Modify existing adjustment' : 'Create a manual stock correction'}</Text>
          </div>
        </Space>
        <Space>
          {isEdit && (
            <Popconfirm title="Delete this adjustment?" onConfirm={handleDelete}>
              <Button danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          )}
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={loading} style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}>
            Save Adjustment
          </Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Voucher #">
              <Input value={isEdit && voucherNo !== 'undefined' ? `ADJ-${voucherNo}` : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Date" name="date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={16}>
            <Form.Item label="Narration" name="narration">
              <Select showSearch placeholder="Select narration" prefix={<FileTextOutlined />} allowClear>
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
              <Input placeholder="Additional adjustment details..." />
            </Form.Item>
          </Col>
        </Row>

        <div className="flex justify-between items-center mb-4 mt-2">
          <Title level={5} style={{ margin: 0 }}>Adjustment Items</Title>
          <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />}>Add Row</Button>
        </div>
        
        <Table
          dataSource={adjustmentLines}
          columns={columns}
          pagination={false}
          rowKey="key"
          size="small"
          bordered
          className="mb-6"
          summary={(pageData) => {
            let totalQtyIn = 0;
            let totalQtyOut = 0;
            let totalAmt = 0;
            pageData.forEach(({ qtyIn, qtyOut, amount }) => {
              totalQtyIn += qtyIn || 0;
              totalQtyOut += qtyOut || 0;
              totalAmt += amount || 0;
            });
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2} align="right"><b>Totals</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}><b>{totalQtyIn.toFixed(3)}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={2}><b>{totalQtyOut.toFixed(3)}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} colSpan={1} align="right"><b>Net Adjustment Value</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong style={{ color: '#7c3aed' }}>{totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Form>
    </Card>
  );
};
