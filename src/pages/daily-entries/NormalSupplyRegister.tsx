import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Card, Button, Space, Typography, Tag, message,
  Form, DatePicker, Select, InputNumber, Row, Col,
  Popconfirm, Tooltip, Drawer, Divider, Badge
} from 'antd';
import {
  UserOutlined, CalendarOutlined, SaveOutlined, ReloadOutlined,
  PlusOutlined, DeleteOutlined, ShoppingCartOutlined,
  PrinterOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { saleSupplyService, type SaleSupplyLine, type SaleSupplyCustomerLineUpdateRequest } from '../../services/saleSupplyService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { round } from '../../utils/numberUtils';
import { rangePresets } from '../../utils/datePresets';
import { useSettingsStore, TRANSACTION_ENABLE_CARRIAGE_KEY } from '../../stores/useSettingsStore';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface EditableLine extends SaleSupplyLine {
  isDirty?: boolean;
}

export const NormalSupplyRegister: React.FC = () => {
  const { getSetting } = useSettingsStore();
  const enableCarriage = getSetting(TRANSACTION_ENABLE_CARRIAGE_KEY, 'false') === 'true';

  const navigate = useNavigate();
  const location = useLocation();

  const [form] = Form.useForm();
  const [addForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addingEntry, setAddingEntry] = useState(false);

  // Load lookups
  useEffect(() => {
    const loadLookups = async () => {
      chartOfAccountService.getCustomerAccounts().then(setCustomers).catch(console.error);
      inventoryService.getItemsLookup().then(setItems).catch(console.error);
    };
    loadLookups();

    const state = location.state as { customerId?: string; fromDate?: string; toDate?: string } | null;
    const fromD = state?.fromDate ? dayjs(state.fromDate) : dayjs().startOf('month');
    const toD = state?.toDate ? dayjs(state.toDate) : dayjs();

    form.setFieldsValue({
      customerId: state?.customerId,
      dateRange: [fromD, toD]
    });

    if (state?.customerId) {
      setSelectedCustomerId(state.customerId);
    }
  }, [form, location.state]);

  // Fetch data
  const fetchData = useCallback(async () => {
    const values = form.getFieldsValue();
    if (!values.customerId) {
      setLines([]);
      return;
    }

    try {
      setLoading(true);
      const params = {
        customerId: values.customerId,
        fromDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
        toDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
        itemId: values.itemId
      };
      const result = await saleSupplyService.getCustomerLines(params);
      // Sort ASC by date
      result.sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
      setLines(result.map(l => ({ ...l, isDirty: false })));
      setSelectedCustomerId(values.customerId);
    } catch (error) {
      console.error(error);
      message.error('Failed to fetch customer supply records');
    } finally {
      setLoading(false);
    }
  }, [form]);

  // Handle cell inline edits for normal unit/rate logic
  const handleCellChange = (recordKey: string, field: keyof EditableLine, value: any) => {
    setLines(prev => prev.map(line => {
      const lineKey = `${line.voucherNo}-${line.seq}`;
      if (lineKey === recordKey) {
        const updated = { ...line, [field]: value, isDirty: true };
        const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
        const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

        if (field === 'qty') {
          updated.qty = round(numVal, 2);
        } else if (field === 'rate') {
          updated.rate = round(numVal, 4);
        } else if (field === 'discount') {
          updated.discount = round(numVal, 2);
        } else if (field === 'addLess') {
          updated.addLess = round(numVal, 2);
        } else if (field === 'carriage') {
          updated.carriage = round(numVal, 2);
        }

        const qty = updated.qty || 0;
        const rate = updated.rate || 0;
        const disc = updated.discount || 0;
        const addLess = updated.addLess || 0;
        const carriage = updated.carriage || 0;

        updated.amount = round(((qty * (rate - disc)) + carriage + addLess), 2);
        return updated;
      }
      return line;
    }));
  };

  // Save single modified line
  const handleSaveLine = async (record: EditableLine) => {
    try {
      setSaving(true);
      await saleSupplyService.updateLine(record.voucherNo, record.seq, {
        seq: record.seq,
        customerId: record.customerId,
        unit: record.unit || null,
        qty: record.qty,
        rate: record.rate,
        discount: record.discount,
        addLess: record.addLess,
        carriage: record.carriage || 0,
        secQty: 0,
        secRate: 0,
        secUnit: null
      });

      message.success(`Updated line for voucher SP-${record.voucherNo}`);
      setLines(prev => prev.map(l => (
        l.voucherNo === record.voucherNo && l.seq === record.seq ? { ...l, isDirty: false } : l
      )));
    } catch (error) {
      console.error(error);
      message.error(`Failed to update line for voucher SP-${record.voucherNo}`);
    } finally {
      setSaving(false);
    }
  };

  // Save all modified lines
  const handleSaveAll = async () => {
    const dirtyLines = lines.filter(l => l.isDirty);
    if (dirtyLines.length === 0) {
      message.info('No modified records to save');
      return;
    }

    try {
      setSaving(true);
      const requests: SaleSupplyCustomerLineUpdateRequest[] = dirtyLines.map(l => ({
        voucherNo: l.voucherNo,
        seq: l.seq,
        line: {
          seq: l.seq,
          customerId: l.customerId,
          unit: l.unit || null,
          qty: l.qty,
          rate: l.rate,
          discount: l.discount,
          addLess: l.addLess,
          carriage: l.carriage || 0,
          secQty: 0,
          secRate: 0,
          secUnit: null
        }
      }));

      await saleSupplyService.updateCustomerLines(requests);
      message.success(`Successfully saved ${dirtyLines.length} record updates`);
      await fetchData();
    } catch (error) {
      console.error(error);
      message.error('Failed to save batch updates');
    } finally {
      setSaving(false);
    }
  };

  // Delete line
  const handleDeleteLine = async (record: EditableLine) => {
    try {
      setLoading(true);
      await saleSupplyService.deleteLine(record.voucherNo, record.seq);
      message.success(`Deleted supply record from voucher SP-${record.voucherNo}`);
      await fetchData();
    } catch (error) {
      console.error(error);
      message.error('Failed to delete record line');
    } finally {
      setLoading(false);
    }
  };

  // Add new supply entry for this customer
  const handleAddSubmit = async (values: any) => {
    if (!selectedCustomerId) {
      message.error('Please select a customer first');
      return;
    }

    try {
      setAddingEntry(true);
      const dateStr = values.date.format('YYYY-MM-DD');

      const existingVouchers = await saleSupplyService.getList({
        fromDate: dateStr,
        toDate: dateStr,
        itemId: values.itemId
      });

      if (existingVouchers && existingVouchers.length > 0) {
        const targetVoucher = existingVouchers[0];
        const details = await saleSupplyService.getDetail(targetVoucher.voucherNo);

        const nextSeq = details.length > 0 ? Math.max(...details.map(d => d.seq)) + 1 : 1;
        const updatedLines = details.map(d => ({
          seq: d.seq,
          customerId: d.customerId,
          unit: d.unit || null,
          qty: d.qty,
          rate: d.rate,
          discount: d.discount,
          addLess: d.addLess,
          carriage: d.carriage || 0,
          secQty: d.secQty,
          secRate: d.secRate,
          secUnit: d.secUnit || null
        }));

        updatedLines.push({
          seq: nextSeq,
          customerId: selectedCustomerId,
          unit: values.unit || null,
          qty: values.qty || 0,
          rate: values.rate || 0,
          discount: values.discount || 0,
          addLess: values.addLess || 0,
          carriage: values.carriage || 0,
          secQty: 0,
          secRate: 0,
          secUnit: null
        });

        await saleSupplyService.update(targetVoucher.voucherNo, {
          date: dateStr,
          itemId: values.itemId,
          lines: updatedLines
        });

        message.success(`Added supply line to existing voucher SP-${targetVoucher.voucherNo}`);
      } else {
        const newVoucherNo = await saleSupplyService.create({
          date: dateStr,
          itemId: values.itemId,
          lines: [{
            seq: 1,
            customerId: selectedCustomerId,
            unit: values.unit || null,
            qty: values.qty || 0,
            rate: values.rate || 0,
            discount: values.discount || 0,
            addLess: values.addLess || 0,
            carriage: values.carriage || 0,
            secQty: 0,
            secRate: 0,
            secUnit: null
          }]
        });

        message.success(`Created new sale supply voucher SP-${newVoucherNo}`);
      }

      setAddModalVisible(false);
      addForm.resetFields();
      await fetchData();
    } catch (error) {
      console.error(error);
      message.error('Failed to add supply entry');
    } finally {
      setAddingEntry(false);
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalRecords = lines.length;
    const totalQty = lines.reduce((acc, l) => acc + (Number(l.qty) || 0), 0);
    const totalAmount = lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
    const dirtyCount = lines.filter(l => l.isDirty).length;
    return { totalRecords, totalQty, totalAmount, dirtyCount };
  }, [lines]);

  const selectedCustomerName = useMemo(() => {
    return customers.find(c => c.account === selectedCustomerId)?.title || selectedCustomerId || 'Customer';
  }, [customers, selectedCustomerId]);

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 140,
      render: (text: string) => (
        <Text strong style={{ fontSize: '15px', color: '#1e293b' }}>
          {dayjs(text).format('DD-MMM-YYYY')}
        </Text>
      ),
    },
    {
      title: 'Voucher #',
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 130,
      render: (text: string) => (
        <Tooltip title="Click to open full Sale Supply voucher">
          <Tag
            color="orange"
            style={{
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              padding: '4px 10px',
              borderRadius: '6px'
            }}
            onClick={() => navigate(`/daily-entries/sale-supply/${text}`)}
          >
            SP-{text}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Item Supplied',
      dataIndex: 'itemTitle',
      key: 'itemTitle',
      minWidth: 220,
      render: (text: string, record: EditableLine) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: '#1d4ed8', fontSize: '15px' }}>
            {text || record.itemId}
          </Text>
          <Text style={{ fontSize: '13px', color: '#64748b' }}>
            Code: {record.itemId} {record.unit ? `• Unit: ${record.unit}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'qty',
      key: 'qty',
      width: 130,
      render: (val: number, record: EditableLine) => (
        <InputNumber
          size="middle"
          min={0}
          precision={2}
          value={val}
          style={{ width: '100%', fontWeight: 700, fontSize: '15px' }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'qty', newVal)}
        />
      ),
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      key: 'rate',
      width: 130,
      render: (val: number, record: EditableLine) => (
        <InputNumber
          size="middle"
          min={0}
          precision={2}
          step={0.5}
          value={val}
          style={{ width: '100%', fontSize: '14px', fontWeight: 600 }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'rate', newVal)}
        />
      ),
    },
    {
      title: 'Discount',
      dataIndex: 'discount',
      key: 'discount',
      width: 110,
      render: (val: number, record: EditableLine) => (
        <InputNumber
          size="middle"
          min={0}
          precision={2}
          value={val || 0}
          style={{ width: '100%', fontSize: '13px' }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'discount', newVal)}
        />
      ),
    },
    {
      title: 'Add / Less',
      dataIndex: 'addLess',
      key: 'addLess',
      width: 110,
      render: (val: number, record: EditableLine) => (
        <InputNumber
          size="middle"
          precision={2}
          value={val || 0}
          style={{ width: '100%', fontSize: '13px' }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'addLess', newVal)}
        />
      ),
    },
    ...(enableCarriage ? [{
      title: 'Carriage',
      dataIndex: 'carriage',
      key: 'carriage',
      width: 110,
      render: (val: number, record: EditableLine) => (
        <InputNumber
          size="middle"
          precision={2}
          value={val || 0}
          style={{ width: '100%', fontSize: '13px' }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'carriage', newVal)}
        />
      ),
    }] : []),
    {
      title: 'Amount (Rs.)',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      align: 'right' as const,
      render: (val: number, record: EditableLine) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'right', width: '100%' }}>
          <Text strong style={{ fontSize: '15px', color: '#0f172a' }}>
            Rs. {(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          {record.isDirty && (
            <Badge status="warning" text={<Text style={{ fontSize: '11px', color: '#d97706' }}>Unsaved</Text>} />
          )}
        </Space>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: EditableLine) => (
        <Space size={6}>
          <Tooltip title="Save modified row">
            <Button
              type={record.isDirty ? 'primary' : 'text'}
              size="small"
              icon={<SaveOutlined />}
              disabled={!record.isDirty || saving}
              onClick={() => handleSaveLine(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this line record?"
            description="Are you sure you want to delete this customer supply entry?"
            onConfirm={() => handleDeleteLine(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }
  ];

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1440, margin: '0 auto' }}>
      {/* Top Header Card */}
      <Card style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Space align="center" size={12}>
              <div style={{
                background: '#e0e7ff',
                padding: 10,
                borderRadius: 8,
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShoppingCartOutlined style={{ fontSize: 24 }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>
                  Daily Supply Register (Retail / Dairy)
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Direct delivery & distribution ledger for standard unit supplies
                </Text>
              </div>
            </Space>
          </Col>

          <Col xs={24} md={12} style={{ textAlign: 'right' }}>
            <Space size={10} wrap>
              {selectedCustomerId && (
                <Button
                  icon={<PrinterOutlined />}
                  onClick={() => {
                    const dates = form.getFieldValue('dateRange');
                    navigate('/reports/customer-bill', {
                      state: {
                        customerId: selectedCustomerId,
                        fromDate: dates?.[0]?.format('YYYY-MM-DD'),
                        toDate: dates?.[1]?.format('YYYY-MM-DD')
                      }
                    });
                  }}
                >
                  Customer Bill
                </Button>
              )}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                disabled={!selectedCustomerId}
                onClick={() => {
                  addForm.setFieldsValue({
                    date: dayjs(),
                    qty: 1,
                    rate: 0,
                    discount: 0,
                    addLess: 0
                  });
                  setAddModalVisible(true);
                }}
              >
                Add Supply Entry
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchData}
                disabled={!selectedCustomerId || loading}
              >
                Reload
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveAll}
                loading={saving}
                disabled={stats.dirtyCount === 0}
                style={{
                  background: stats.dirtyCount > 0 ? '#16a34a' : undefined,
                  borderColor: stats.dirtyCount > 0 ? '#16a34a' : undefined
                }}
              >
                Save All Changes {stats.dirtyCount > 0 && `(${stats.dirtyCount})`}
              </Button>
            </Space>
          </Col>
        </Row>

        <Divider style={{ margin: '16px 0' }} />

        {/* Filter Toolbar */}
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => {
            fetchData();
          }}
        >
          <Row gutter={[16, 12]} align="bottom">
            <Col xs={24} sm={12} md={7}>
              <Form.Item
                name="customerId"
                label={<span style={{ fontWeight: 600, fontSize: '13px' }}><UserOutlined /> Select Customer</span>}
                rules={[{ required: true, message: 'Customer is required' }]}
                style={{ marginBottom: 0 }}
              >
                <Select
                  showSearch
                  placeholder="Choose customer account..."
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                >
                  {customers.map(c => (
                    <Select.Option key={c.account} value={c.account}>
                      {c.title} ({c.account})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="dateRange"
                label={<span style={{ fontWeight: 600, fontSize: '13px' }}><CalendarOutlined /> Delivery Date Range</span>}
                style={{ marginBottom: 0 }}
              >
                <RangePicker
                  presets={rangePresets}
                  format="DD-MMM-YYYY"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="itemId"
                label={<span style={{ fontWeight: 600, fontSize: '13px' }}>Filter by Item (Optional)</span>}
                style={{ marginBottom: 0 }}
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="All items supplied"
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                >
                  {items.map(i => (
                    <Select.Option key={i.id} value={i.id}>
                      {i.title}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={3}>
              <Button
                type="primary"
                onClick={fetchData}
                loading={loading}
                style={{ width: '100%' }}
              >
                Search
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* KPI Stats Strip */}
      {selectedCustomerId && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card bodyStyle={{ padding: '12px 16px' }} style={{ borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Customer</Text>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedCustomerName}
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bodyStyle={{ padding: '12px 16px' }} style={{ borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Supply Entries</Text>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                {stats.totalRecords} Records
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bodyStyle={{ padding: '12px 16px' }} style={{ borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <Text style={{ fontSize: 12, color: '#166534' }}>Total Quantity</Text>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#15803d' }}>
                {stats.totalQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bodyStyle={{ padding: '12px 16px' }} style={{ borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <Text style={{ fontSize: 12, color: '#1e40af' }}>Total Amount</Text>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1d4ed8' }}>
                Rs. {stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Main Table Card */}
      <Card style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Table
          columns={columns}
          dataSource={lines}
          rowKey={(r) => `${r.voucherNo}-${r.seq}`}
          loading={loading}
          pagination={false}
          size="middle"
          locale={{
            emptyText: selectedCustomerId ? 'No supply records found for selected period' : 'Please select a customer above to view supply entries'
          }}
          rowClassName={(record) => record.isDirty ? 'editable-row-dirty' : ''}
          style={{ overflowX: 'auto' }}
        />
      </Card>

      {/* Quick Add Supply Entry Drawer */}
      <Drawer
        title={<Space><PlusOutlined /><span>Add Daily Supply Entry</span></Space>}
        width={420}
        open={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        extra={
          <Space>
            <Button onClick={() => setAddModalVisible(false)}>Cancel</Button>
            <Button type="primary" loading={addingEntry} onClick={() => addForm.submit()}>
              Add Record
            </Button>
          </Space>
        }
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddSubmit}
          initialValues={{
            date: dayjs(),
            qty: 1,
            rate: 0,
            discount: 0,
            addLess: 0
          }}
        >
          <Form.Item label="Customer">
            <Text strong style={{ fontSize: 15, color: '#1e293b' }}>
              {selectedCustomerName} ({selectedCustomerId})
            </Text>
          </Form.Item>

          <Form.Item
            name="date"
            label="Delivery Date"
            rules={[{ required: true, message: 'Please select delivery date' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>

          <Form.Item
            name="itemId"
            label="Item Supplied"
            rules={[{ required: true, message: 'Please select item' }]}
          >
            <Select
              showSearch
              placeholder="Select item..."
              optionFilterProp="children"
              filterOption={(input, option) =>
                String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onChange={(val) => {
                const itemObj = items.find(i => i.id === val);
                if (itemObj) {
                  addForm.setFieldsValue({
                    rate: itemObj.priRate || 0,
                    unit: itemObj.defaultUnit || itemObj.primaryUnit || null
                  });
                }
              }}
            >
              {items.map(i => (
                <Select.Option key={i.id} value={i.id}>
                  {i.title}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                name="qty"
                label="Quantity"
                rules={[{ required: true, message: 'Quantity is required' }]}
              >
                <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="unit" label="Unit">
                <Select placeholder="Unit..." allowClear>
                  <Select.Option value="Litre">Litre</Select.Option>
                  <Select.Option value="Kg">Kg</Select.Option>
                  <Select.Option value="Pcs">Pcs</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="rate"
            label="Rate (Rs.)"
            rules={[{ required: true, message: 'Rate is required' }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="discount" label="Discount">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="addLess" label="Add / Less">
                <InputNumber precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </div>
  );
};

export default NormalSupplyRegister;
