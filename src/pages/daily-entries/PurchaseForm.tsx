import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  ShoppingCartOutlined, UserOutlined, FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { purchaseService } from '../../services/purchaseService';
import { inventoryService, type Item, type Unit } from '../../services/inventoryService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';

const { Title, Text } = Typography;

export const PurchaseForm: React.FC = () => {
  const { voucherNo } = useParams<{ voucherNo: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [vendors, setVendors] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [purchaseLines, setPurchaseLines] = useState<any[]>([]);

  const isEdit = !!voucherNo && voucherNo !== 'new';

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [itemsRes, unitsRes, vendorsRes, narrsRes] = await Promise.all([
          inventoryService.getItems(),
          inventoryService.getUnits(),
          chartOfAccountService.getDetailAccounts(),
          narrationService.getActiveNarrations()
        ]);
        setItems(itemsRes);
        setUnits(unitsRes);
        setVendors(vendorsRes);
        setNarrations(narrsRes);
      } catch (error) {
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
          const details = await purchaseService.getDetail(voucherNo!);
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
              amount: d.amount
            })));
          }
        } catch (error) {
          message.error('Failed to load purchase details');
          navigate('/daily-entries/purchase');
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
        amount: 0
      }]);
    }
  }, [isEdit, voucherNo, form, navigate]);

  const addRow = () => {
    const maxSeq = purchaseLines.reduce((max, row) => Math.max(max, row.seq || 0), 0);
    const newRow = {
      key: Date.now(),
      seq: maxSeq + 1,
      itemId: undefined,
      unit: undefined,
      qty: 1,
      rate: 0,
      addLess: 0,
      amount: 0
    };
    setPurchaseLines([...purchaseLines, newRow]);
  };

  const removeRow = async (record: any) => {
    if (isEdit && record.seq) {
      try {
        await purchaseService.deleteLine(voucherNo!, record.seq);
      } catch (error) {
        message.error('Failed to delete line');
        return;
      }
    }
    setPurchaseLines(purchaseLines.filter(row => row.key !== record.key));
  };

  const updateRow = (key: any, field: string, value: any) => {
    setPurchaseLines(prev => {
      const updatedLines = prev.map(row => {
        if (row.key === key) {
          const updatedRow = { ...row, [field]: value };
          if (field === 'itemId') {
            const item = items.find(i => i.id === value);
            if (item) {
              updatedRow.unit = item.defaultUnit || item.primaryUnit;
              updatedRow.rate = item.priRate;
            }
          }
          const qty = updatedRow.qty || 0;
          const rate = updatedRow.rate || 0;
          const addLess = updatedRow.addLess || 0;
          updatedRow.amount = (qty * rate) + addLess;
          return updatedRow;
        }
        return row;
      });

      const lastRow = updatedLines[updatedLines.length - 1];
      if (lastRow.key === key && lastRow.itemId && lastRow.qty > 0) {
        const maxSeq = updatedLines.reduce((max, row) => Math.max(max, row.seq || 0), 0);
        return [...updatedLines, {
          key: Date.now() + 1,
          seq: maxSeq + 1,
          itemId: undefined,
          unit: undefined,
          qty: 1,
          rate: 0,
          addLess: 0,
          amount: 0
        }];
      }
      return updatedLines;
    });
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await purchaseService.delete(voucherNo!);
      message.success('Purchase deleted successfully');
      navigate('/daily-entries/purchase');
    } catch (error) {
      message.error('Failed to delete purchase');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = purchaseLines.filter(l => l.itemId && l.qty > 0);
      if (validLines.length === 0) {
        message.warning('Please add at least one item');
        return;
      }

      setLoading(true);
      const request = {
        date: values.date.format('YYYY-MM-DD'),
        account: values.account,
        narration: values.narration,
        description: values.description,
        lines: validLines.map(l => ({
          seq: l.seq,
          itemId: l.itemId,
          unit: l.unit,
          qty: l.qty,
          rate: l.rate,
          addLess: l.addLess
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
    } catch (error: any) {
      message.error('Failed to save purchase');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Item',
      dataIndex: 'itemId',
      render: (text: string, record: any) => (
        <Select
          showSearch
          placeholder="Select Item"
          value={text}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.key, 'itemId', val)}
          optionFilterProp="children"
        >
          {items.map(item => (
            <Select.Option key={item.id} value={item.id}>{item.title}</Select.Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      width: 120,
      render: (text: string, record: any) => {
        const item = items.find(i => i.id === record.itemId);
        const filteredUnits = units.filter(u => u.code === item?.primaryUnit || u.code === item?.secondaryUnit);
        return (
          <Select
            value={text}
            style={{ width: '100%' }}
            onChange={(val) => updateRow(record.key, 'unit', val)}
            disabled={!record.itemId}
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
      width: 100,
      render: (text: number, record: any) => (
        <InputNumber value={text} style={{ width: '100%' }} onChange={(val) => updateRow(record.key, 'qty', val)} min={0} />
      )
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      width: 120,
      render: (text: number, record: any) => (
        <InputNumber
          value={text}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.key, 'rate', val)}
          min={0}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        />
      )
    },
    {
      title: 'Add/Less',
      dataIndex: 'addLess',
      width: 100,
      render: (text: number, record: any) => (
        <InputNumber value={text} style={{ width: '100%' }} onChange={(val) => updateRow(record.key, 'addLess', val)} />
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
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave} 
            loading={loading}
            style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
          >
            Save Purchase
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
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={8}>
            <Form.Item label="Vendor / Supplier" name="account" rules={[{ required: true }]}>
              <Select showSearch placeholder="Select Vendor" prefix={<UserOutlined />} optionFilterProp="children">
                {vendors.map(v => (
                  <Select.Option key={v.account} value={v.account}>{v.title}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={24} lg={8}>
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
              <Input placeholder="Additional purchase details..." />
            </Form.Item>
          </Col>
        </Row>

        <div className="flex justify-between items-center mb-4 mt-2">
          <Title level={5} style={{ margin: 0 }}>Purchase Items</Title>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addRow}>Add Row</Button>
        </div>

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
                  <Table.Summary.Cell index={2} colSpan={2} align="right"><b>Net Total</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <Text strong style={{ color: '#16a34a' }}>Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Form>
    </Card>
  );
};
