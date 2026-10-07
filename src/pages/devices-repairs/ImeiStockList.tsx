import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, InputNumber, Select, Row, Col, DatePicker, Tooltip, Segmented
} from 'antd';
import { 
  ReloadOutlined, SearchOutlined, 
  HistoryOutlined, MobileOutlined, PlusOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { 
  imeiService, 
  type ImeiStockResponse,
  type ImeiCostAdditionRequest
} from '../../services/imeiService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { inventoryService, type Item } from '../../services/inventoryService';

const { Title, Text } = Typography;

export const ImeiStockList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stockList, setStockList] = useState<ImeiStockResponse[]>([]);
  const [stockFilter, setStockFilter] = useState<string>('In Stock');
  const [searchText, setSearchText] = useState('');

  // Cost Modal
  const [costModalVisible, setCostModalVisible] = useState(false);
  const [costLoading, setCostLoading] = useState(false);
  const [selectedImei, setSelectedImei] = useState<ImeiStockResponse | null>(null);
  const [accounts, setAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
  const [costForm] = Form.useForm();

  const fetchStock = useCallback(async () => {
    try {
      setLoading(true);
      const data = await imeiService.getImeiStock();
      setStockList(data);
    } catch {
      message.error('Failed to load IMEI stock ledger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStock();
    chartOfAccountService.getDetailAccounts().then(setAccounts).catch(() => {});
    inventoryService.getItemsLookup().then(setInventoryItems).catch(() => {});
  }, [fetchStock]);

  const handleOpenCostModal = (record: ImeiStockResponse) => {
    setSelectedImei(record);
    costForm.resetFields();
    costForm.setFieldsValue({
      date: dayjs(),
      expenseType: 'PtaTax',
      newPtaStatus: record.ptaStatus,
      amount: 0
    });
    setCostModalVisible(true);
  };

  const handleCostSubmit = async () => {
    if (!selectedImei) return;
    try {
      const values = await costForm.validateFields();
      setCostLoading(true);

      const request: ImeiCostAdditionRequest = {
        imei: selectedImei.imei,
        date: values.date.format('YYYY-MM-DD'),
        expenseType: values.expenseType,
        description: values.description,
        amount: values.amount || 0,
        paidFromAccount: values.paidFromAccount,
        consumedItemId: values.consumedItemId,
        consumedQty: values.consumedQty,
        newPtaStatus: values.newPtaStatus,
        newCondition: values.newCondition
      };

      await imeiService.addImeiCost(request);
      message.success(`Expense capitalized to IMEI ${selectedImei.imei} landed cost`);
      setCostModalVisible(false);
      fetchStock();
    } catch {
      message.error('Failed to add capitalized cost');
    } finally {
      setCostLoading(false);
    }
  };

  const filteredData = stockList.filter(item => {
    if (stockFilter === 'In Stock' && !item.isInStock) return false;
    if (stockFilter === 'Sold' && item.isInStock) return false;

    if (!searchText) return true;
    const lower = searchText.toLowerCase();
    return (
      item.imei?.toLowerCase().includes(lower) ||
      item.imei2?.toLowerCase().includes(lower) ||
      item.itemTitle?.toLowerCase().includes(lower) ||
      item.brandTitle?.toLowerCase().includes(lower) ||
      item.modelName?.toLowerCase().includes(lower) ||
      item.ptaStatus?.toLowerCase().includes(lower)
    );
  });

  const columns = [
    {
      title: 'IMEI / Serial',
      dataIndex: 'imei',
      key: 'imei',
      width: '180px',
      render: (val: string, record: ImeiStockResponse) => (
        <div>
          <Text strong style={{ fontFamily: 'monospace', fontSize: 13 }}>{val}</Text>
          {record.imei2 && (
            <div><Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>IMEI 2: {record.imei2}</Text></div>
          )}
        </div>
      ),
    },
    {
      title: 'Item / Model',
      key: 'item',
      render: (_: any, record: ImeiStockResponse) => (
        <div>
          <Text strong>{record.itemTitle}</Text>
          {record.brandTitle && (
            <div>
              <Tag color="geekblue" style={{ fontSize: 10, marginTop: 2 }}>{record.brandTitle}</Tag>
              {record.color && <Tag style={{ fontSize: 10 }}>{record.color}</Tag>}
              {record.storage && <Tag style={{ fontSize: 10 }}>{record.storage}</Tag>}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'PTA Status',
      dataIndex: 'ptaStatus',
      key: 'ptaStatus',
      width: '130px',
      render: (val?: string) => {
        if (!val) return <Text type="secondary">-</Text>;
        let color = 'default';
        if (val.includes('Official')) color = 'success';
        else if (val.includes('Non-PTA')) color = 'error';
        else if (val.includes('CPID') || val.includes('Patched')) color = 'warning';
        return <Tag color={color}>{val}</Tag>;
      },
    },
    {
      title: 'Specs / Health',
      key: 'specs',
      width: '120px',
      render: (_: any, record: ImeiStockResponse) => (
        <div>
          {record.batteryHealth !== undefined && record.batteryHealth !== null ? (
            <div><Text style={{ fontSize: 12 }}>Battery: {record.batteryHealth}%</Text></div>
          ) : null}
          {record.conditionNote && (
            <div><Text type="secondary" style={{ fontSize: 11 }}>{record.conditionNote}</Text></div>
          )}
        </div>
      ),
    },
    {
      title: 'Purchase Cost',
      dataIndex: 'purchaseRate',
      key: 'purchaseRate',
      width: '120px',
      align: 'right' as const,
      render: (val: number, record: ImeiStockResponse) => (
        <div style={{ textAlign: 'right' }}>
          <div>Rs. {(val || 0).toLocaleString()}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(record.purchaseDate).format('DD-MMM-YY')}</Text>
        </div>
      ),
    },
    {
      title: 'Added Cost',
      dataIndex: 'addedCost',
      key: 'addedCost',
      width: '110px',
      align: 'right' as const,
      render: (val: number) => (
        <div style={{ textAlign: 'right' }}>
          {val > 0 ? (
            <Text type="warning" strong>+Rs. {val.toLocaleString()}</Text>
          ) : (
            <Text type="secondary">-</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Total Landed',
      dataIndex: 'totalLandedCost',
      key: 'totalLandedCost',
      width: '130px',
      align: 'right' as const,
      render: (val: number) => (
        <div style={{ textAlign: 'right' }}>
          <Text strong style={{ color: '#1677ff' }}>Rs. {(val || 0).toLocaleString()}</Text>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: '120px',
      render: (_: any, record: ImeiStockResponse) => (
        record.isInStock ? (
          <Tag color="green">IN STOCK</Tag>
        ) : (
          <div>
            <Tag color="default">SOLD</Tag>
            {record.saleVNo && (
              <div><Text type="secondary" style={{ fontSize: 11 }}>SL-{record.saleVNo}</Text></div>
            )}
          </div>
        )
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '140px',
      render: (_: any, record: ImeiStockResponse) => (
        <Space size="small">
          <Tooltip title="View 360° Lifecycle History">
            <Button 
              type="text" 
              icon={<HistoryOutlined style={{ color: '#1677ff' }} />} 
              onClick={() => navigate(`/devices-repairs/imei-history?imei=${encodeURIComponent(record.imei)}`)}
            />
          </Tooltip>

          {record.isInStock && (
            <Tooltip title="Capitalize Expense / Added Cost">
              <Button 
                type="text" 
                icon={<PlusOutlined style={{ color: '#fa8c16' }} />} 
                onClick={() => handleOpenCostModal(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        bordered={false} 
        style={{ 
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MobileOutlined style={{ color: '#1677ff' }} />
              IMEI Stock Ledger
            </Title>
            <Text type="secondary">Real-time handset inventory, landed cost tracking, and PTA status</Text>
          </div>
          
          <Space wrap>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchStock}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={10} md={8}>
            <Segmented
              options={['In Stock', 'Sold', 'All']}
              value={stockFilter}
              onChange={(val) => setStockFilter(val as string)}
              block
            />
          </Col>
          <Col xs={24} sm={14} md={16}>
            <Input
              placeholder="Search by IMEI, model, brand, or PTA status..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="imei"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} devices`,
          }}
          size="middle"
        />
      </Card>

      {/* Capitalize Cost Modal */}
      <Modal
        title={`Capitalize Added Expense: IMEI ${selectedImei?.imei}`}
        open={costModalVisible}
        onOk={handleCostSubmit}
        confirmLoading={costLoading}
        onCancel={() => setCostModalVisible(false)}
        okText="Add to Landed Cost"
      >
        <Form form={costForm} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <Text strong>{selectedImei?.itemTitle}</Text>
            <Row justify="space-between" style={{ marginTop: 6 }}>
              <Text type="secondary">Current Landed Cost:</Text>
              <Text strong>Rs. {(selectedImei?.totalLandedCost || 0).toLocaleString()}</Text>
            </Row>
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="date"
                label="Expense Date"
                rules={[{ required: true, message: 'Please select date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="expenseType"
                label="Expense Type"
                rules={[{ required: true, message: 'Please select expense type' }]}
              >
                <Select
                  options={[
                    { label: 'PTA Tax Official', value: 'PtaTax' },
                    { label: 'CPID Server Fee', value: 'CpidServer' },
                    { label: 'Spare Part / LCD', value: 'SparePart' },
                    { label: 'Refurbishment / Housing', value: 'Refurbishment' },
                    { label: 'Technician Labor', value: 'Labour' },
                    { label: 'Shipping / Custom', value: 'Shipping' }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="Expense Amount (Rs.)"
                rules={[{ required: true, message: 'Please enter amount' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="paidFromAccount"
                label="Paid From (Account)"
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="Select Bank / Cash account"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={accounts.map(a => ({ value: a.account, label: a.title }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="consumedItemId"
                label="Consumed Inventory Part (Optional)"
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="Spare part from stock"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={inventoryItems.map(i => ({ value: i.id, label: `${i.title} (${i.id})` }))}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="consumedQty" label="Consumed Qty">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="newPtaStatus" label="Update PTA Status (Optional)">
                <Select
                  allowClear
                  options={[
                    { label: 'Official PTA', value: 'Official PTA' },
                    { label: 'Non-PTA', value: 'Non-PTA' },
                    { label: 'CPID', value: 'CPID' },
                    { label: 'Patched', value: 'Patched' },
                    { label: 'JV', value: 'JV' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="newCondition" label="Update Condition (Optional)">
                <Input placeholder="e.g. 10/10 Like New, PTA Approved" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Expense Description / Remarks"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <Input.TextArea rows={2} placeholder="e.g. Paid official FBR PTA tax at custom window" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
