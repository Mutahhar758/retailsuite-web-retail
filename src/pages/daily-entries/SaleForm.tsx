import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm, Tag, Alert
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  RocketOutlined, UserOutlined, FileTextOutlined, WifiOutlined, DisconnectOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { saleService } from '../../services/saleService';
import { offlineCacheService, OfflineCacheMissError } from '../../services/offlineCacheService';
import type { ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import type { NarrationDto } from '../../services/narrationService';
import type { Item } from '../../services/inventoryService';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

const { Title, Text } = Typography;

export const SaleForm: React.FC = () => {
  const { voucherNo } = useParams<{ voucherNo: string }>();
  const isEdit = !!voucherNo && voucherNo !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { isOnline } = useNetworkStatus();

  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<{ code: string; title: string }[]>([]);
  const [saleLines, setSaleLines] = useState<any[]>([]);
  const [cacheMissError, setCacheMissError] = useState<string | null>(null);

  useEffect(() => {
    loadReferenceData();

    if (isEdit) {
      fetchDetail();
    } else {
      setSaleLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0 }]);
      form.setFieldsValue({ date: dayjs() });
    }
  }, [isEdit, voucherNo]);

  const loadReferenceData = async () => {
    try {
      const [customers, narrations, items, units] = await Promise.all([
        offlineCacheService.getCustomers(),
        offlineCacheService.getNarrations(),
        offlineCacheService.getItems(),
        offlineCacheService.getUnits(),
      ]);
      setCustomers(customers);
      setNarrations(narrations);
      setItems(items);
      setUnits(units);
      setCacheMissError(null);
    } catch (err) {
      if (err instanceof OfflineCacheMissError) {
        setCacheMissError(err.message);
      } else {
        message.error('Failed to load reference data');
      }
    }
  };

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const details = await saleService.getDetail(voucherNo!);
      if (details.length > 0) {
        const first = details[0];
        form.setFieldsValue({
          date: dayjs(first.date),
          account: first.accountId,
          narration: first.narrationId,
          description: first.description,
          cashReceipt: first.cashReceipt,
          cashBack: first.cashBack
        });

        setSaleLines(details.map(d => ({
          ...d,
          key: d.seq,
          rate: d.rate,
          discount: d.discount,
          amount: d.amount
        })));
      }
    } catch {
      message.error('Failed to fetch sale details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = () => {
    setSaleLines(prev => {
      const newSeq = prev.length > 0 ? Math.max(...prev.map(l => l.seq)) + 1 : 1;
      return [...prev, { key: Date.now(), seq: newSeq, qty: 1, rate: 0, discount: 0, amount: 0 }];
    });
  };

  const handleRemoveRow = async (key: number, seq: number) => {
    if (isEdit && typeof key === 'number' && key < 1000000000) {
      try {
        await saleService.deleteLine(voucherNo!, seq);
      } catch {
        message.error('Failed to delete line from server');
        return;
      }
    }
    setSaleLines(prev => prev.filter(l => l.key !== key));
  };

  const updateLine = (key: number, field: string, value: any) => {
    setSaleLines(prev => {
      const newLines = prev.map(l => {
        if (l.key === key) {
          const updated = { ...l, [field]: value };

          if (field === 'itemId') {
            const item = items.find(i => i.id === value);
            if (item) {
              updated.unit = item.defaultUnit;
              updated.rate = item.priRate;
            }
          }

          const qty = updated.qty || 0;
          const rate = updated.rate || 0;
          const disc = updated.discount || 0;
          updated.amount = qty * (rate - disc);
          return updated;
        }
        return l;
      });

      const lastRow = newLines[newLines.length - 1];
      if (lastRow.key === key && lastRow.itemId) {
        const newSeq = newLines.length > 0 ? Math.max(...newLines.map(l => l.seq)) + 1 : 1;
        return [...newLines, { key: Date.now() + 1, seq: newSeq, qty: 1, rate: 0, discount: 0, amount: 0 }];
      }

      return newLines;
    });
  };

  const totalAmount = saleLines.reduce((sum, l) => sum + (l.amount || 0), 0);
  const cashReceipt = Form.useWatch('cashReceipt', form) || 0;
  const cashBack = Form.useWatch('cashBack', form) || 0;
  const balance = totalAmount - cashReceipt + cashBack;

  useEffect(() => {
    if (!isEdit || (isEdit && loading === false)) {
      const suggestedCashBack = Math.max(0, cashReceipt - totalAmount);
      if (suggestedCashBack !== cashBack && !form.isFieldTouched('cashBack')) {
        form.setFieldValue('cashBack', suggestedCashBack);
      }
    }
  }, [totalAmount, cashReceipt]);

  const handleSave = async () => {
    // Guard: cannot edit existing vouchers offline
    if (isEdit && !isOnline) {
      message.error('Editing existing vouchers requires an internet connection.');
      return;
    }

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
        cashReceipt: values.cashReceipt || 0,
        cashBack: values.cashBack || 0,
        lines: validLines.map(l => {
          const item = items.find(i => i.id === l.itemId);
          return {
            seq: l.seq,
            itemId: l.itemId,
            unit: item?.itemType === 'Service' ? null : (l.unit || null),
            qty: l.qty,
            rate: l.rate,
            discount: l.discount
          };
        })
      };

      if (isEdit) {
        await saleService.update(voucherNo!, request);
        message.success('Sale updated successfully');
      } else {
        const newVno = await saleService.create(request, { offlineFallback: true });

        if (newVno.includes('-') && newVno.length <= 10) {
          // Offline temp voucher number (e.g. A3F1-0007)
          message.warning({
            content: `Sale saved offline as ${newVno}. It will sync automatically when you reconnect.`,
            duration: 8,
          });
          navigate('/daily-entries/sale');
        } else {
          message.success('Sale created successfully');
          navigate(`/daily-entries/sale/${newVno}`);
        }
      }
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message.includes('internet')) {
        message.error(error.message);
      } else {
        message.error('Failed to save sale');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await saleService.delete(voucherNo!);
      message.success('Sale deleted successfully');
      navigate('/daily-entries/sale');
    } catch {
      message.error('Failed to delete sale');
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
        const filteredUnits = item
          ? units.filter(u => u.code === item.primaryUnit || u.code === item.secondaryUnit)
          : units;

        return (
          <Select
            style={{ width: '100%' }}
            value={text}
            disabled={!record.itemId}
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
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0.01}
          onChange={(v) => updateLine(record.key, 'qty', v)}
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
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0}
          onChange={(v) => updateLine(record.key, 'discount', v)}
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

  // Cannot edit existing vouchers while offline
  const editOfflineBlocked = isEdit && !isOnline;

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      {/* ── Offline / Online status banner ── */}
      {!isOnline && (
        <Alert
          className="mb-4"
          type={editOfflineBlocked ? 'error' : 'warning'}
          showIcon
          icon={<DisconnectOutlined />}
          message={
            editOfflineBlocked
              ? 'You are offline — editing existing vouchers requires an internet connection.'
              : 'You are offline — new sales will be queued and synced automatically when you reconnect.'
          }
        />
      )}
      {isOnline && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 mb-3">
          <WifiOutlined />
          <span>Online</span>
        </div>
      )}

      {/* ── Cache miss error ── */}
      {cacheMissError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Reference Data Not Available Offline"
          description={cacheMissError}
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/sale')} type="text" />
          <RocketOutlined style={{ fontSize: 24, color: '#0ea5e9' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit Sale: SL-${voucherNo}` : 'New Sale'}
            </Title>
            <Text type="secondary">{isEdit ? 'Modify existing sale voucher' : 'Record a new customer sale'}</Text>
          </div>
        </Space>
        <Space>
          {isEdit && (
            <Popconfirm
              title="Delete Sale"
              description="Are you sure you want to delete this entire sale voucher?"
              onConfirm={handleDelete}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true, loading }}
              disabled={!isOnline}
            >
              <Button danger icon={<DeleteOutlined />} disabled={!isOnline}>Delete</Button>
            </Popconfirm>
          )}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={loading}
            disabled={editOfflineBlocked || !!cacheMissError}
            style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}
          >
            {!isOnline && !isEdit ? 'Save Offline' : 'Save Sale'}
          </Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Voucher #">
              <Input value={isEdit ? `SL-${voucherNo}` : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Date" name="date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={8}>
            <Form.Item label="Customer" name="account" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="Select Customer"
                prefix={<UserOutlined />}
                optionFilterProp="children"
              >
                {customers.map(c => (
                  <Select.Option key={c.account} value={c.account}>{c.title}</Select.Option>
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
              <Input placeholder="Additional sale details..." />
            </Form.Item>
          </Col>
        </Row>

        <div className="flex justify-between items-center mb-4 mt-2">
          <Title level={5} style={{ margin: 0 }}>Item Details</Title>
          <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />}>Add Row</Button>
        </div>

        <Table
          dataSource={saleLines}
          columns={columns}
          pagination={false}
          rowKey="key"
          size="small"
          bordered
          className="mb-6"
          summary={pageData => {
            let total = 0;
            pageData.forEach(({ amount }) => { total += amount || 0; });
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5} align="right"><b>Gross Total</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong style={{ color: '#0ea5e9' }}>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />

        <div className="mt-8 pt-6 border-t border-gray-100">
          <Row gutter={24} align="bottom">
            <Col xs={24} sm={8} lg={6}>
              <Form.Item label="Cash Receipt" name="cashReceipt">
                <InputNumber
                  style={{ width: '100%' }}
                  size="large"
                  min={0}
                  placeholder="0.00"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} lg={6}>
              <Form.Item label="Cash Back" name="cashBack">
                <InputNumber
                  style={{ width: '100%' }}
                  size="large"
                  min={0}
                  placeholder="0.00"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} lg={12}>
              <div className="text-right pb-6">
                <Text type="secondary" className="uppercase text-xs tracking-widest block mb-1">Net Balance</Text>
                <div className="flex items-center justify-end gap-3">
                  <Tag color={balance > 0 ? 'red' : balance < 0 ? 'green' : 'blue'} className="px-3 py-0.5 rounded-full border-none font-bold uppercase text-[10px]">
                    {balance > 0 ? 'Receivable' : balance < 0 ? 'Change' : 'Settled'}
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
  );
};
