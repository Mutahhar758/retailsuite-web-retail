import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Card, Button, Space, Typography, Tag, message,
  Form, DatePicker, Select, InputNumber, Row, Col, Statistic,
  Popconfirm, Tooltip, Drawer, Divider, Badge
} from 'antd';
import {
  UserOutlined, CalendarOutlined, SaveOutlined, ReloadOutlined,
  PlusOutlined, DeleteOutlined, TruckOutlined, ShoppingCartOutlined,
  DollarOutlined, AppstoreOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { saleSupplyService, type SaleSupplyLine, type SaleSupplyCustomerLineUpdateRequest } from '../../services/saleSupplyService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { round } from '../../utils/numberUtils';
import { useAppStore } from '../../stores/useAppStore';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface EditableLine extends SaleSupplyLine {
  isDirty?: boolean;
}

export const CustomerSupplyRegister: React.FC = () => {
  const navigate = useNavigate();
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const hasSecondaryQty = currentOrg?.hasSecondaryQty ?? false;
  const hasVariablePackFeature = currentOrg?.hasVariablePackFeature ?? false;

  const [form] = Form.useForm();
  const [addForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<{ code: string; title: string }[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addingEntry, setAddingEntry] = useState(false);

  // Load lookups
  useEffect(() => {
    chartOfAccountService.getCustomerAccounts().then(setCustomers).catch(console.error);
    inventoryService.getItemsLookup().then(setItems).catch(console.error);
    inventoryService.getUnitsLookup().then(setUnits).catch(console.error);

    // Default dates to start of current month and today
    form.setFieldsValue({
      dateRange: [dayjs().startOf('month'), dayjs()]
    });
  }, [form]);

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
      setLines(result.map(l => ({ ...l, isDirty: false })));
      setSelectedCustomerId(values.customerId);
    } catch (error) {
      console.error(error);
      message.error('Failed to fetch customer supply records');
    } finally {
      setLoading(false);
    }
  }, [form]);

  // Handle cell inline edits following identical secondary qty / variable pack formula
  const handleCellChange = (recordKey: string, field: keyof EditableLine, value: any) => {
    setLines(prev => prev.map(line => {
      const lineKey = `${line.voucherNo}-${line.seq}`;
      if (lineKey === recordKey) {
        const updated = { ...line, [field]: value, isDirty: true };
        const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
        const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

        if (hasVariablePackFeature) {
          let kgQty = updated.qty || 0;
          let bagQty = updated.secQty || 0;
          let packQty = (updated as any).packQty || 0;
          let packing = (updated as any).packing || 0;
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
          } else if (field === 'rate') {
            kgRate = numVal;
            if (packing > 0) bagRate = round(kgRate * packing, 4);
          } else if (field === 'secRate') {
            bagRate = numVal;
            if (packing > 0) kgRate = round(bagRate / packing, 4);
          }

          updated.qty = round(kgQty, 2);
          updated.secQty = round(bagQty, 2);
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
        secQty: record.secQty,
        secRate: record.secRate,
        secUnit: record.secUnit || null
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
          secQty: l.secQty,
          secRate: l.secRate,
          secUnit: l.secUnit || null
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

      // Check if a Sale Supply voucher already exists for this date and item
      const existingVouchers = await saleSupplyService.getList({
        fromDate: dateStr,
        toDate: dateStr,
        itemId: values.itemId
      });

      if (existingVouchers.length > 0) {
        // Append line to existing voucher
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
          secQty: values.secQty || 0,
          secRate: values.secRate || 0,
          secUnit: values.secUnit || null
        });

        await saleSupplyService.update(targetVoucher.voucherNo, {
          date: dateStr,
          itemId: values.itemId,
          lines: updatedLines
        });

        message.success(`Added supply line to existing voucher SP-${targetVoucher.voucherNo}`);
      } else {
        // Create new voucher for this date and item
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
            secQty: values.secQty || 0,
            secRate: values.secRate || 0,
            secUnit: values.secUnit || null
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
      minWidth: 200,
      render: (text: string, record: EditableLine) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: '#1d4ed8', fontSize: '15px' }}>
            {text || record.itemId}
          </Text>
          <Text style={{ fontSize: '13px', color: '#64748b' }}>
            Code: {record.itemId}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: 125,
      render: (text: string, record: EditableLine) => (
        <Select
          size="middle"
          style={{ width: '100%', fontSize: '14px' }}
          value={text || undefined}
          placeholder="Unit"
          allowClear
          optionFilterProp="children"
          onChange={(val) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'unit', val)}
        >
          {units.map(u => (
            <Select.Option key={u.code} value={u.code}>{u.title}</Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      width: 125,
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
    ...((hasSecondaryQty || hasVariablePackFeature) ? [
      {
        title: hasVariablePackFeature ? 'Sec Qty (Bags)' : 'Sec Qty',
        dataIndex: 'secQty',
        key: 'secQty',
        width: 120,
        render: (val: number, record: EditableLine) => (
          <InputNumber
            size="middle"
            min={0}
            precision={2}
            value={val || 0}
            style={{ width: '100%', fontSize: '14px' }}
            onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'secQty', newVal)}
          />
        ),
      }
    ] : []),
    {
      title: hasVariablePackFeature ? 'Rate (/Kg)' : ((hasSecondaryQty || hasVariablePackFeature) ? 'Single Rate' : 'Rate'),
      dataIndex: 'rate',
      key: 'rate',
      width: 130,
      render: (val: number, record: EditableLine) => (
        <InputNumber
          size="middle"
          min={0}
          precision={4}
          step={0.01}
          value={val}
          style={{ width: '100%', fontSize: '14px', fontWeight: 600 }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'rate', newVal)}
        />
      ),
    },
    ...((hasSecondaryQty || hasVariablePackFeature) ? [
      {
        title: hasVariablePackFeature ? 'Bag Rate' : 'Sec Rate',
        dataIndex: 'secRate',
        key: 'secRate',
        width: 125,
        render: (val: number, record: EditableLine) => (
          <InputNumber
            size="middle"
            min={0}
            precision={4}
            step={0.01}
            value={val || 0}
            style={{ width: '100%', fontSize: '14px' }}
            onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'secRate', newVal)}
          />
        ),
      }
    ] : []),
    {
      title: 'Discount',
      dataIndex: 'discount',
      key: 'discount',
      width: 115,
      render: (val: number, record: EditableLine) => (
        <InputNumber
          size="middle"
          min={0}
          precision={2}
          value={val}
          style={{ width: '100%', fontSize: '14px' }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'discount', newVal)}
        />
      ),
    },
    {
      title: 'Add / Less',
      dataIndex: 'addLess',
      key: 'addLess',
      width: 115,
      render: (val: number, record: EditableLine) => (
        <InputNumber
          size="middle"
          precision={2}
          value={val}
          style={{ width: '100%', fontSize: '14px' }}
          onChange={(newVal) => handleCellChange(`${record.voucherNo}-${record.seq}`, 'addLess', newVal)}
        />
      ),
    },
    {
      title: 'Net Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 145,
      align: 'right' as const,
      render: (val: number) => (
        <Text strong style={{ color: '#15803d', fontSize: '16px', fontWeight: 700 }}>
          {(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'action',
      width: 130,
      fixed: 'right' as const,
      render: (_: any, record: EditableLine) => (
        <Space size="middle">
          {record.isDirty ? (
            <Tooltip title="Save Row Changes">
              <Button
                type="primary"
                size="middle"
                icon={<SaveOutlined style={{ fontSize: '16px' }} />}
                loading={saving}
                onClick={() => handleSaveLine(record)}
                style={{ borderRadius: '6px' }}
              />
            </Tooltip>
          ) : (
            <Tag color="green" style={{ fontSize: '12px', padding: '3px 8px', fontWeight: 600, margin: 0 }}>
              Saved
            </Tag>
          )}

          <Popconfirm
            title="Delete Supply Record?"
            description="This will remove this customer line from the daily supply voucher."
            onConfirm={() => handleDeleteLine(record)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              type="text"
              size="middle"
              icon={<DeleteOutlined style={{ fontSize: '16px' }} />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '4px' }}>
      {/* Header Banner */}
      <Card
        style={{
          marginBottom: 20,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
          color: '#fff',
          boxShadow: '0 6px 18px rgba(30, 64, 175, 0.25)'
        }}
        bodyStyle={{ padding: '24px 28px' }}
      >
        <Row align="middle" justify="space-between" gutter={[20, 20]}>
          <Col>
            <Space align="center" size="large">
              <TruckOutlined style={{ fontSize: 40, color: '#93c5fd' }} />
              <div>
                <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
                  Customer Supply Register
                </Title>
                <Text style={{ color: '#dbeafe', fontSize: '15px' }}>
                  View, audit, and update any customer's daily supply records across date ranges
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space size="middle">
              <Button
                type="default"
                size="large"
                icon={<PlusOutlined style={{ fontSize: '16px' }} />}
                disabled={!selectedCustomerId}
                style={{ borderRadius: 8, fontWeight: 600, height: '44px', fontSize: '15px' }}
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
                Quick Add Record
              </Button>
              <Badge count={stats.dirtyCount} overflowCount={99}>
                <Button
                  type="primary"
                  size="large"
                  icon={<SaveOutlined style={{ fontSize: '18px' }} />}
                  loading={saving}
                  disabled={stats.dirtyCount === 0}
                  style={{
                    backgroundColor: stats.dirtyCount > 0 ? '#16a34a' : undefined,
                    borderColor: stats.dirtyCount > 0 ? '#16a34a' : undefined,
                    borderRadius: 8,
                    fontWeight: 700,
                    height: '44px',
                    fontSize: '15px'
                  }}
                  onClick={handleSaveAll}
                >
                  Save All Changes ({stats.dirtyCount})
                </Button>
              </Badge>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Filter Section */}
      <Card style={{ marginBottom: 20, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={fetchData}
        >
          <Row gutter={[20, 0]} align="bottom">
            <Col xs={24} sm={12} md={8} lg={8}>
              <Form.Item
                name="customerId"
                label={<Text strong style={{ fontSize: '15px' }}><UserOutlined /> Select Customer</Text>}
                rules={[{ required: true, message: 'Please select a customer' }]}
              >
                <Select
                  size="large"
                  showSearch
                  placeholder="Type customer name or account code..."
                  optionFilterProp="children"
                  style={{ width: '100%', fontSize: '15px' }}
                  onChange={(val) => {
                    setSelectedCustomerId(val);
                    setTimeout(() => form.submit(), 50);
                  }}
                >
                  {customers.map(c => (
                    <Select.Option key={c.account} value={c.account}>
                      {c.title} ({c.account})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8} lg={8}>
              <Form.Item
                name="dateRange"
                label={<Text strong style={{ fontSize: '15px' }}><CalendarOutlined /> Supply Date Range</Text>}
              >
                <RangePicker size="large" style={{ width: '100%', fontSize: '15px' }} format="DD-MMM-YYYY" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={5} lg={5}>
              <Form.Item
                name="itemId"
                label={<Text strong style={{ fontSize: '15px' }}><ShoppingCartOutlined /> Filter Item (Optional)</Text>}
              >
                <Select
                  size="large"
                  showSearch
                  placeholder="All Items"
                  allowClear
                  optionFilterProp="children"
                  style={{ width: '100%', fontSize: '15px' }}
                >
                  {items.map(i => (
                    <Select.Option key={i.id} value={i.id}>
                      {i.title}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={3} lg={3}>
              <Form.Item>
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  icon={<ReloadOutlined />}
                  loading={loading}
                  block
                  style={{ borderRadius: 8, height: '40px', fontWeight: 600, fontSize: '15px' }}
                >
                  Fetch
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* KPI Cards (Shown when customer selected) */}
      {selectedCustomerId && (
        <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={8} md={8}>
            <Card bodyStyle={{ padding: '20px 24px' }} style={{ borderRadius: 10, borderLeft: '4px solid #2563eb' }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: '14px', fontWeight: 500 }}>Selected Customer</Text>}
                value={selectedCustomerName}
                valueStyle={{ fontSize: '22px', color: '#1e40af', fontWeight: 700 }}
                prefix={<UserOutlined style={{ marginRight: 8 }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={8}>
            <Card bodyStyle={{ padding: '20px 24px' }} style={{ borderRadius: 10, borderLeft: '4px solid #0284c7' }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: '14px', fontWeight: 500 }}>Total Supply Records / Qty</Text>}
                value={stats.totalQty}
                precision={2}
                valueStyle={{ fontSize: '24px', color: '#0369a1', fontWeight: 700 }}
                suffix={<Text type="secondary" style={{ fontSize: '13px', marginLeft: 8 }}>({stats.totalRecords} records)</Text>}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={8}>
            <Card bodyStyle={{ padding: '20px 24px' }} style={{ borderRadius: 10, borderLeft: '4px solid #16a34a' }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: '14px', fontWeight: 500 }}>Total Net Supply Amount</Text>}
                value={stats.totalAmount}
                precision={2}
                valueStyle={{ fontSize: '26px', color: '#15803d', fontWeight: 800 }}
                prefix={<DollarOutlined style={{ marginRight: 4 }} />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Main Data Table */}
      <Card style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Table
          rowKey={(r) => `${r.voucherNo}-${r.seq}`}
          loading={loading}
          dataSource={lines}
          columns={columns}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          bordered
          scroll={{ x: 1250 }}
          locale={{
            emptyText: selectedCustomerId
              ? 'No sale supply records found for this customer in the selected date range.'
              : 'Please select a customer above to view their supply entries.'
          }}
          rowClassName={(record) => record.isDirty ? 'dirty-row-highlight' : ''}
        />
      </Card>

      {/* Quick Add Supply Entry Drawer */}
      <Drawer
        title={<Text strong style={{ fontSize: '18px' }}>Add Supply Record for {selectedCustomerName}</Text>}
        width={460}
        onClose={() => setAddModalVisible(false)}
        open={addModalVisible}
        destroyOnClose
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddSubmit}
        >
          <Form.Item
            name="date"
            label={<Text strong style={{ fontSize: '15px' }}>Supply Date</Text>}
            rules={[{ required: true, message: 'Please select date' }]}
          >
            <DatePicker size="large" style={{ width: '100%', fontSize: '15px' }} format="DD-MMM-YYYY" />
          </Form.Item>

          <Form.Item
            name="itemId"
            label={<Text strong style={{ fontSize: '15px' }}>Item</Text>}
            rules={[{ required: true, message: 'Please select item' }]}
          >
            <Select
              size="large"
              showSearch
              placeholder="Select item..."
              prefix={<AppstoreOutlined />}
              optionFilterProp="children"
              style={{ width: '100%', fontSize: '15px' }}
              onChange={(val) => {
                const found = items.find(i => i.id === val);
                if (found) {
                  addForm.setFieldsValue({
                    rate: found.priRate || 0,
                    unit: found.primaryUnit || null
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

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="qty" label={<Text strong style={{ fontSize: '15px' }}>Quantity</Text>} rules={[{ required: true }]}>
                <InputNumber size="large" min={0.01} precision={2} style={{ width: '100%', fontSize: '15px', fontWeight: 700 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label={<Text strong style={{ fontSize: '15px' }}>Unit</Text>}>
                <Select size="large" allowClear placeholder="Unit" optionFilterProp="children" style={{ width: '100%', fontSize: '15px' }}>
                  {units.map(u => (
                    <Select.Option key={u.code} value={u.code}>{u.title}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rate" label={<Text strong style={{ fontSize: '15px' }}>Rate</Text>}>
                <InputNumber size="large" min={0} precision={2} style={{ width: '100%', fontSize: '15px' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="discount" label={<Text strong style={{ fontSize: '15px' }}>Discount / Unit</Text>}>
                <InputNumber size="large" min={0} precision={2} style={{ width: '100%', fontSize: '15px' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="addLess" label={<Text strong style={{ fontSize: '15px' }}>Add / Less Amount</Text>}>
            <InputNumber size="large" precision={2} style={{ width: '100%', fontSize: '15px' }} />
          </Form.Item>

          {(hasSecondaryQty || hasVariablePackFeature) && (
            <>
              <Divider children="Secondary Unit Details" style={{ fontSize: '15px', fontWeight: 600 }} />
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="secQty" label={<Text strong style={{ fontSize: '15px' }}>{hasVariablePackFeature ? 'Sec Qty (Bags)' : 'Sec Qty'}</Text>}>
                    <InputNumber size="large" min={0} precision={2} style={{ width: '100%', fontSize: '15px' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="secRate" label={<Text strong style={{ fontSize: '15px' }}>{hasVariablePackFeature ? 'Bag Rate' : 'Sec Rate'}</Text>}>
                    <InputNumber size="large" min={0} precision={2} style={{ width: '100%', fontSize: '15px' }} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Form.Item style={{ marginTop: 28 }}>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              block
              loading={addingEntry}
              icon={<SaveOutlined style={{ fontSize: '18px' }} />}
              style={{ borderRadius: 8, height: '46px', fontWeight: 700, fontSize: '16px' }}
            >
              Add Supply Record
            </Button>
          </Form.Item>
        </Form>
      </Drawer>

      <style>{`
        .ant-table-thead > tr > th {
          font-size: 15px !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          background: #f8fafc !important;
          padding: 14px 12px !important;
        }
        .ant-table-tbody > tr > td {
          padding: 12px 10px !important;
          font-size: 14px !important;
        }
        .dirty-row-highlight {
          background-color: #fefce8 !important;
        }
        .dirty-row-highlight:hover td {
          background-color: #fef9c3 !important;
        }
        .ant-input-number-input {
          font-size: 14px !important;
          font-weight: 600 !important;
        }
        .ant-select-selection-item {
          font-size: 14px !important;
          font-weight: 500 !important;
        }
        .ant-select-item-option-content {
          font-size: 14px !important;
        }
      `}</style>
    </div>
  );
};
