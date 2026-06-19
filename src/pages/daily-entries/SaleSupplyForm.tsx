import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  TruckOutlined, AppstoreOutlined, FileTextOutlined, CopyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { saleSupplyService } from '../../services/saleSupplyService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { supplyOrderService, type SupplyOrder } from '../../services/supplyOrderService';

const { Title, Text } = Typography;

export const SaleSupplyForm: React.FC = () => {
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

  useEffect(() => {
    chartOfAccountService.getCustomerAccounts().then(setCustomers);
    narrationService.getActiveNarrations().then(setNarrations);
    inventoryService.getItems().then(setItems);
    inventoryService.getUnits().then(setUnits);
    supplyOrderService.getList().then(setSupplyOrders);

    if (isEdit) {
      fetchDetail();
    } else {
      const copyFrom = (location.state as any)?.copyFrom;
      if (copyFrom) {
        // Pre-populate from Copy as New
        form.setFieldsValue({
          date: dayjs(),
          itemId: copyFrom.itemId,
          narration: copyFrom.narration,
          description: copyFrom.description,
          supplyOrderMasterId: copyFrom.supplyOrderMasterId
        });
        setSupplyLines((copyFrom.lines || []).map((l: any) => ({
          ...l,
          key: Date.now() + l.seq
        })));
      } else {
        setSupplyLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, addLess: 0, amount: 0 }]);
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

        setSupplyLines(details.map(d => ({
          ...d,
          key: d.seq,
          customerId: d.customerId,
          addLess: d.addLess
        })));
      }
    } catch (error) {
      message.error('Failed to fetch supply details');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFromSupplyOrder = async (orderId: number) => {
    if (!orderId) return;
    const masterItemId = form.getFieldValue('itemId');
    const item = items.find(i => i.id === masterItemId);
    
    setLoading(true);
    try {
      const order = await supplyOrderService.getById(orderId);
      if (order && order.details) {
        const newLines = order.details.map((d, index) => ({
          key: Date.now() + index,
          seq: index + 1,
          customerId: d.customerId,
          unit: item?.defaultUnit || '',
          qty: 1,
          rate: item?.defaultUnit === item?.secondaryUnit ? item?.secRate : item?.priRate || 0,
          discount: 0,
          addLess: 0,
          amount: ((item?.defaultUnit === item?.secondaryUnit ? item?.secRate : item?.priRate) || 0) * 1
        }));
        setSupplyLines(newLines);
        message.success(`Loaded ${newLines.length} customers from ${order.title}`);
      }
    } catch (error) {
      message.error('Failed to load supply order');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = () => {
    const newSeq = supplyLines.length > 0 ? Math.max(...supplyLines.map(l => l.seq)) + 1 : 1;
    setSupplyLines([...supplyLines, { key: Date.now(), seq: newSeq, qty: 1, rate: 0, discount: 0, addLess: 0, amount: 0 }]);
  };

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
        const qty = updated.qty || 0;
        const rate = updated.rate || 0;
        const disc = updated.discount || 0;
        const addLess = updated.addLess || 0;
        updated.amount = (qty * (rate - disc)) + addLess;
        return updated;
      }
      return l;
    });
    setSupplyLines(newLines);
  };

  // const calculateTotal = () => {
  //   return supplyLines.reduce((sum, l) => sum + (l.amount || 0), 0);
  // };

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
            addLess: l.addLess
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

  const columns = [
    {
      title: 'Customer',
      dataIndex: 'customerId',
      key: 'customerId',
      render: (text: string, record: any) => (
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder="Select Customer"
          optionFilterProp="children"
          value={text}
          onChange={(val) => updateLine(record.key, 'customerId', val)}
        >
          {customers.map(c => (
            <Select.Option key={c.account} value={c.account}>{c.title}</Select.Option>
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
        const masterItemId = form.getFieldValue('itemId');
        const item = items.find(i => i.id === masterItemId);
        const filteredUnits = item 
          ? units.filter(u => u.code === item.primaryUnit || u.code === item.secondaryUnit)
          : units;
          
        return (
          <Select
            style={{ width: '100%' }}
            value={text}
            onChange={(val) => updateLine(record.key, 'unit', val)}
          >
            {filteredUnits.map(u => (
              <Select.Option key={u.code} value={u.code}>{u.title}</Select.Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      width: 100,
      render: (val: number, record: any) => (
        <InputNumber style={{ width: '100%' }} value={val} min={0.01} onChange={(v) => updateLine(record.key, 'qty', v)} />
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
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateLine(record.key, 'rate', v)}
        />
      )
    },
    {
      title: 'Disc',
      dataIndex: 'discount',
      key: 'discount',
      width: 100,
      render: (val: number, record: any) => (
        <InputNumber style={{ width: '100%' }} value={val} min={0} onChange={(v) => updateLine(record.key, 'discount', v)} />
      )
    },
    {
      title: 'Add/Less',
      dataIndex: 'addLess',
      key: 'addLess',
      width: 100,
      render: (val: number, record: any) => (
        <InputNumber style={{ width: '100%' }} value={val} onChange={(v) => updateLine(record.key, 'addLess', v)} />
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
          disabled={supplyLines.length === 1}
        />
      )
    }
  ];

  return (
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
              <Input value={isEdit ? `SP-${voucherNo}` : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Date" name="date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={16} lg={8}>
            <Form.Item label="Item to Supply" name="itemId" rules={[{ required: true }]}>
              <Select 
                showSearch 
                placeholder="Select Item"
                prefix={<AppstoreOutlined />}
                optionFilterProp="children"
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
                placeholder="Select Supply Order Profile"
                onChange={handleLoadFromSupplyOrder}
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
            <Form.Item label="Narration" name="narration">
              <Select showSearch placeholder="Select narration" prefix={<FileTextOutlined />} allowClear>
                {narrations.map(n => (
                  <Select.Option key={n.code} value={n.code}>{n.title}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item label="Description" name="description">
              <Input placeholder="Additional supply details..." />
            </Form.Item>
          </Col>
        </Row>

        <div className="flex justify-between items-center mb-4 mt-2">
          <Title level={5} style={{ margin: 0 }}>Customer List</Title>
          <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />}>Add Row</Button>
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
    </Card>
  );
};
