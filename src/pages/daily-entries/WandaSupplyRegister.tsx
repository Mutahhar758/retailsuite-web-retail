import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Card, Button, Space, Typography, Tag, message,
  Form, DatePicker, Select, InputNumber, Row, Col,
  Popconfirm, Tooltip, Drawer, Divider, Badge
} from 'antd';
import {
  UserOutlined, CalendarOutlined, SaveOutlined, ReloadOutlined,
  PlusOutlined, DeleteOutlined, TruckOutlined,
  PrinterOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { saleSupplyService, type SaleSupplyLine, type SaleSupplyCustomerLineUpdateRequest } from '../../services/saleSupplyService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { round } from '../../utils/numberUtils';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface EditableWandaLine extends SaleSupplyLine {
  isDirty?: boolean;
  packQty?: number;
  packing?: number;
}

export const WandaSupplyRegister: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [form] = Form.useForm();
  const [addForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [lines, setLines] = useState<EditableWandaLine[]>([]);
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
      setLines(result.map(l => ({
        ...l,
        isDirty: false,
        packQty: l.qty && l.secQty && l.secQty > 0 ? round(l.qty / l.secQty, 2) : 50,
        packing: l.qty && l.secQty && l.secQty > 0 ? round(l.qty / l.secQty, 2) : 50
      })));
      setSelectedCustomerId(values.customerId);
    } catch (error) {
      console.error(error);
      message.error('Failed to fetch supply records');
    } finally {
      setLoading(false);
    }
  }, [form]);

  // Handle cell inline edits with Wanda Weight/Bag dual-unit & dual-rate formulas
  const handleCellChange = (recordKey: string, field: keyof EditableWandaLine, value: any) => {
    setLines(prev => prev.map(line => {
      const lineKey = `${line.voucherNo}-${line.seq}`;
      if (lineKey === recordKey) {
        const updated = { ...line, [field]: value, isDirty: true };
        const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
        const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

        let kgQty = updated.qty || 0;
        let bagQty = updated.secQty || 0;
        let packQty = updated.packQty || 50;
        let packing = updated.packing || packQty;
        let kgRate = updated.rate || 0;
        let bagRate = updated.secRate || 0;

        if (field === 'qty') {
          kgQty = numVal;
          if (bagQty > 0) packQty = round(kgQty / bagQty, 2);
          else if (packQty > 0) bagQty = round(kgQty / packQty, 2);
        } else if (field === 'secQty') {
          bagQty = numVal;
          if (packQty > 0) kgQty = round(bagQty * packQty, 2);
          else if (kgQty > 0) packQty = round(kgQty / bagQty, 2);
        } else if (field === 'packQty') {
          packQty = numVal;
          packing = numVal;
          if (bagQty > 0) kgQty = round(bagQty * packQty, 2);
        } else if (field === 'rate') {
          kgRate = numVal;
          if (packing > 0) bagRate = round(kgRate * packing, 4);
        } else if (field === 'secRate') {
          bagRate = numVal;
          if (packing > 0) kgRate = round(bagRate / packing, 4);
        } else if (field === 'discount') {
          updated.discount = round(numVal, 2);
        } else if (field === 'addLess') {
          updated.addLess = round(numVal, 2);
        }

        updated.qty = round(kgQty, 2);
        updated.secQty = round(bagQty, 2);
        updated.packQty = round(packQty, 2);
        updated.packing = round(packing, 2);
        updated.rate = round(kgRate, 4);
        updated.secRate = round(bagRate, 4);

        const disc = updated.discount || 0;
        const carriage = updated.addLess || 0;

        // Wanda line amount: Weight * (Rate - Disc) + Carriage
        updated.amount = round(((updated.qty * (updated.rate - disc)) + carriage), 2);
        return updated;
      }
      return line;
    }));
  };

  // Save single modified line
  const handleSaveLine = async (record: EditableWandaLine) => {
    try {
      setSaving(true);
      await saleSupplyService.updateLine(record.voucherNo, record.seq, {
        seq: record.seq,
        customerId: record.customerId,
        unit: record.unit || 'Kg',
        qty: record.qty,
        rate: record.rate,
        discount: record.discount,
        addLess: record.addLess,
        secQty: record.secQty,
        secRate: record.secRate,
        secUnit: record.secUnit || 'Bags'
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
          unit: l.unit || 'Kg',
          qty: l.qty,
          rate: l.rate,
          discount: l.discount,
          addLess: l.addLess,
          secQty: l.secQty,
          secRate: l.secRate,
          secUnit: l.secUnit || 'Bags'
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
  const handleDeleteLine = async (record: EditableWandaLine) => {
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

  // Add new supply entry for Wanda customer
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
          unit: 'Kg',
          qty: d.qty,
          rate: d.rate,
          discount: d.discount,
          addLess: d.addLess,
          secQty: d.secQty,
          secRate: d.secRate,
          secUnit: 'Bags'
        }));

        updatedLines.push({
          seq: nextSeq,
          customerId: selectedCustomerId,
          unit: 'Kg',
          qty: values.qty || 0,
          rate: values.rate || 0,
          discount: values.discount || 0,
          addLess: values.addLess || 0,
          secQty: values.secQty || 0,
          secRate: values.secRate || 0,
          secUnit: 'Bags'
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
            unit: 'Kg',
            qty: values.qty || 0,
            rate: values.rate || 0,
            discount: values.discount || 0,
            addLess: values.addLess || 0,
            secQty: values.secQty || 0,
            secRate: values.secRate || 0,
            secUnit: 'Bags'
          }]
        });

        message.success(`Created new supply voucher SP-${newVoucherNo}`);
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

  // Wanda KPIs
  const stats = useMemo(() => {
    const totalRecords = lines.length;
    const totalWeight = lines.reduce((acc, l) => acc + (Number(l.qty) || 0), 0);
    const totalBags = lines.reduce((acc, l) => acc + (Number(l.secQty) || 0), 0);
    const totalAmount = lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
    const dirtyCount = lines.filter(l => l.isDirty).length;
    return { totalRecords, totalWeight, totalBags, totalAmount, dirtyCount };
  }, [lines]);

  const selectedCustomerName = useMemo(() => {
    return customers.find(c => c.account === selectedCustomerId)?.title || selectedCustomerId || 'Customer';
  }, [customers, selectedCustomerId]);

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 130,
      render: (text: string) => (
        <Text strong style={{ fontSize: '14px', color: '#1e293b' }}>
          {dayjs(text).format('DD-MMM-YYYY')}
        </Text>
      ),
    },
    {
      title: 'Voucher #',
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 120,
      render: (text: string) => (
        <Tooltip title="Click to open full Sale Supply voucher">
          <Tag
            color="orange"
            style={{
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              padding: '3px 8px',
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
      title: 'Commodity / Feed Item',
      dataIndex: 'itemTitle',
      key: 'itemTitle',
      minWidth: 180,
      render: (text: string, record: EditableWandaLine) => (
        <Space direction="vertical" size={1}>
          <Text strong style={{ color: '#1d4ed8', fontSize: '14px' }}>
            {text || record.itemId}
          </Text>
          <Text style={{ fontSize: '12px', color: '#64748b' }}>
            Code: {record.itemId}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Weight (Kg)',
      dataIndex: 'qty',
      key: 'qty',
      width: 120,
      render: (val: number, record: EditableWandaLine) => (
        <InputNumber
          size="middle"
          min={0}
          precision={2}
          value={val}
          style={{ width: '100%', fontWeight: 700, fontSize: '14px' }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'qty', newVal)}
        />
      ),
    },
    {
      title: 'Bags',
      dataIndex: 'secQty',
      key: 'secQty',
      width: 110,
      render: (val: number, record: EditableWandaLine) => (
        <InputNumber
          size="middle"
          min={0}
          precision={2}
          value={val || 0}
          style={{ width: '100%', fontSize: '14px', fontWeight: 600, color: '#b45309' }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'secQty', newVal)}
        />
      ),
    },
    {
      title: 'Pack (Kg/b)',
      dataIndex: 'packQty',
      key: 'packQty',
      width: 105,
      render: (val: number, record: EditableWandaLine) => (
        <InputNumber
          size="middle"
          min={1}
          precision={2}
          value={val || 50}
          style={{ width: '100%', fontSize: '13px' }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'packQty', newVal)}
        />
      ),
    },
    {
      title: 'Rate (/Kg)',
      dataIndex: 'rate',
      key: 'rate',
      width: 115,
      render: (val: number, record: EditableWandaLine) => (
        <InputNumber
          size="middle"
          min={0}
          precision={4}
          step={0.01}
          value={val}
          style={{ width: '100%', fontSize: '13px' }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'rate', newVal)}
        />
      ),
    },
    {
      title: 'Bag Rate',
      dataIndex: 'secRate',
      key: 'secRate',
      width: 120,
      render: (val: number, record: EditableWandaLine) => (
        <InputNumber
          size="middle"
          min={0}
          precision={2}
          step={1}
          value={val || 0}
          style={{ width: '100%', fontSize: '13px', fontWeight: 600 }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'secRate', newVal)}
        />
      ),
    },
    {
      title: 'Carriage',
      dataIndex: 'addLess',
      key: 'addLess',
      width: 105,
      render: (val: number, record: EditableWandaLine) => (
        <InputNumber
          size="middle"
          precision={2}
          value={val || 0}
          style={{ width: '100%', fontSize: '13px' }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'addLess', newVal)}
        />
      ),
    },
    {
      title: 'Amount (Rs.)',
      dataIndex: 'amount',
      key: 'amount',
      width: 135,
      align: 'right' as const,
      render: (val: number, record: EditableWandaLine) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'right', width: '100%' }}>
          <Text strong style={{ fontSize: '14px', color: '#0f172a' }}>
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
      width: 90,
      align: 'center' as const,
      render: (_: any, record: EditableWandaLine) => (
        <Space size={4}>
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
            description="Are you sure you want to delete this supply entry?"
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
    <div style={{ padding: '20px 24px', maxWidth: 1560, margin: '0 auto' }}>
      {/* Top Header Card */}
      <Card style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Space align="center" size={12}>
              <div style={{
                background: '#fef3c7',
                padding: 10,
                borderRadius: 8,
                color: '#b45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TruckOutlined style={{ fontSize: 24 }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>
                  Customer Supply Register (Feed & Commodity)
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Dual-unit ledger for weight (Kg), bag packaging, and carriage freight tracking
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
                    qty: 50,
                    secQty: 1,
                    packQty: 50,
                    rate: 0,
                    secRate: 0,
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
                label={<span style={{ fontWeight: 600, fontSize: '13px' }}>Filter by Feed Item</span>}
                style={{ marginBottom: 0 }}
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="All feed items"
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

      {/* Wanda KPI Stats Strip */}
      {selectedCustomerId && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6} md={6}>
            <Card bodyStyle={{ padding: '12px 16px' }} style={{ borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Customer</Text>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedCustomerName}
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6} md={6}>
            <Card bodyStyle={{ padding: '12px 16px' }} style={{ borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}>
              <Text style={{ fontSize: 12, color: '#b45309' }}>Total Bags</Text>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#92400e' }}>
                {stats.totalBags.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bags
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6} md={6}>
            <Card bodyStyle={{ padding: '12px 16px' }} style={{ borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <Text style={{ fontSize: 12, color: '#166534' }}>Total Weight (Kg)</Text>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#15803d' }}>
                {stats.totalWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kg
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6} md={6}>
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

      {/* Wanda Quick Add Drawer */}
      <Drawer
        title={<Space><TruckOutlined /><span>Add Wanda Supply Entry</span></Space>}
        width={460}
        open={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        extra={
          <Space>
            <Button onClick={() => setAddModalVisible(false)}>Cancel</Button>
            <Button type="primary" loading={addingEntry} onClick={() => addForm.submit()}>
              Add Entry
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
            qty: 50,
            secQty: 1,
            packQty: 50,
            rate: 0,
            secRate: 0,
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
            label="Commodity / Feed Item"
            rules={[{ required: true, message: 'Please select item' }]}
          >
            <Select
              showSearch
              placeholder="Select feed item..."
              optionFilterProp="children"
              filterOption={(input, option) =>
                String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onChange={(val) => {
                const itemObj = items.find(i => i.id === val);
                if (itemObj) {
                  const defaultPack = itemObj.qtyInPack || 50;
                  const saleRate = itemObj.priRate || 0;
                  const bagRate = saleRate * defaultPack;
                  addForm.setFieldsValue({
                    rate: saleRate,
                    secRate: bagRate,
                    packQty: defaultPack,
                    qty: (addForm.getFieldValue('secQty') || 1) * defaultPack
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
            <Col span={8}>
              <Form.Item
                name="secQty"
                label="Bags"
                rules={[{ required: true, message: 'Bags required' }]}
              >
                <InputNumber
                  min={0.01}
                  precision={2}
                  style={{ width: '100%' }}
                  onChange={(val) => {
                    const pack = addForm.getFieldValue('packQty') || 50;
                    addForm.setFieldsValue({ qty: round((val || 0) * pack, 2) });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="packQty" label="Pack (Kg/b)">
                <InputNumber
                  min={1}
                  precision={2}
                  style={{ width: '100%' }}
                  onChange={(val) => {
                    const bags = addForm.getFieldValue('secQty') || 0;
                    addForm.setFieldsValue({ qty: round(bags * (val || 0), 2) });
                    const kgR = addForm.getFieldValue('rate') || 0;
                    if (val && val > 0) addForm.setFieldsValue({ secRate: round(kgR * val, 2) });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="qty"
                label="Weight (Kg)"
                rules={[{ required: true, message: 'Weight required' }]}
              >
                <InputNumber
                  min={0.01}
                  precision={2}
                  style={{ width: '100%' }}
                  onChange={(val) => {
                    const pack = addForm.getFieldValue('packQty') || 50;
                    if (pack > 0) addForm.setFieldsValue({ secQty: round((val || 0) / pack, 2) });
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="rate" label="Rate (/Kg)">
                <InputNumber
                  min={0}
                  precision={4}
                  step={0.01}
                  style={{ width: '100%' }}
                  onChange={(val) => {
                    const pack = addForm.getFieldValue('packQty') || 50;
                    addForm.setFieldsValue({ secRate: round((val || 0) * pack, 2) });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="secRate" label="Bag Rate">
                <InputNumber
                  min={0}
                  precision={2}
                  step={1}
                  style={{ width: '100%' }}
                  onChange={(val) => {
                    const pack = addForm.getFieldValue('packQty') || 50;
                    if (pack > 0) addForm.setFieldsValue({ rate: round((val || 0) / pack, 4) });
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="discount" label="Discount">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="addLess" label="Carriage / Freight">
                <InputNumber precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </div>
  );
};

export default WandaSupplyRegister;
