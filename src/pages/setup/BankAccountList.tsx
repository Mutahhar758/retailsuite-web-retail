import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Card, Button, Space, Typography, Tag, message,
  Input, Tooltip, Avatar, Modal, Form, Row, Col, Switch,
  Statistic, Select, Popconfirm, InputNumber, AutoComplete
} from 'antd';
import {
  BankOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, SearchOutlined, FileTextOutlined, CheckCircleOutlined,
  CopyOutlined, CheckSquareOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  bankAccountService,
  type BankAccountResponse,
  type BankAccountCreateRequest,
  type BankAccountUpdateRequest
} from '../../services/bankAccountService';

const { Title, Text, Paragraph } = Typography;

// Popular banks for quick autocomplete / selection
const POPULAR_BANKS = [
  'Meezan Bank',
  'Habib Bank Limited (HBL)',
  'United Bank Limited (UBL)',
  'MCB Bank',
  'Bank Alfalah',
  'Allied Bank Limited (ABL)',
  'Bank Al Habib',
  'Standard Chartered Bank',
  'Faysal Bank',
  'Askari Bank',
  'Bank of Punjab (BOP)',
  'Dubai Islamic Bank',
  'Soneri Bank',
  'JS Bank',
  'National Bank of Pakistan (NBP)',
  'Summit Bank',
  'Al Baraka Bank'
];

export const BankAccountList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BankAccountResponse[]>([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccountResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const accounts = await bankAccountService.getBankAccounts();
      setData(accounts);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenAddModal = () => {
    setEditingAccount(null);
    form.resetFields();
    form.setFieldsValue({
      currency: 'PKR',
      active: true,
      openingBalance: 0
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record: BankAccountResponse) => {
    setEditingAccount(record);
    form.resetFields();
    form.setFieldsValue({
      bankName: record.bankName || '',
      accountTitle: record.accountTitle || '',
      accountNumber: record.accountNumber || '',
      iban: record.iban || '',
      branchName: record.branchName || '',
      branchCode: record.branchCode || '',
      swiftCode: record.swiftCode || '',
      currency: record.currency || 'PKR',
      notes: record.notes || '',
      active: record.active,
      openingBalance: record.openingBalance || 0
    });
    setIsModalOpen(true);
  };

  const handleModalSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingAccount) {
        const updateReq: BankAccountUpdateRequest = {
          bankName: values.bankName,
          accountTitle: values.accountTitle,
          accountNumber: values.accountNumber || null,
          iban: values.iban || null,
          branchName: values.branchName || null,
          branchCode: values.branchCode || null,
          swiftCode: values.swiftCode || null,
          currency: values.currency || 'PKR',
          notes: values.notes || null,
          active: values.active,
          openingBalance: values.openingBalance != null ? Number(values.openingBalance) : 0
        };
        await bankAccountService.update(editingAccount.account, updateReq);
        message.success(`Bank account "${values.accountTitle}" updated successfully`);
      } else {
        const createReq: BankAccountCreateRequest = {
          bankName: values.bankName,
          accountTitle: values.accountTitle,
          accountNumber: values.accountNumber || null,
          iban: values.iban || null,
          branchName: values.branchName || null,
          branchCode: values.branchCode || null,
          swiftCode: values.swiftCode || null,
          currency: values.currency || 'PKR',
          notes: values.notes || null,
          active: values.active ?? true,
          openingBalance: values.openingBalance != null ? Number(values.openingBalance) : 0
        };
        await bankAccountService.create(createReq);
        message.success(`Bank account "${values.accountTitle}" created successfully`);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      if (error?.errorFields) return; // Form validation error
      message.error(error.response?.data?.message || 'Failed to save bank account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (accountCode: string) => {
    try {
      setLoading(true);
      await bankAccountService.delete(accountCode);
      message.success('Bank account deleted successfully');
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to delete bank account');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} copied to clipboard`);
  };

  // Filter accounts
  const filteredData = useMemo(() => {
    return data.filter(acc => {
      const matchesSearch =
        acc.accountTitle?.toLowerCase().includes(searchText.toLowerCase()) ||
        acc.bankName?.toLowerCase().includes(searchText.toLowerCase()) ||
        acc.account.toLowerCase().includes(searchText.toLowerCase()) ||
        (acc.accountNumber && acc.accountNumber.toLowerCase().includes(searchText.toLowerCase())) ||
        (acc.iban && acc.iban.toLowerCase().includes(searchText.toLowerCase())) ||
        (acc.branchName && acc.branchName.toLowerCase().includes(searchText.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && acc.active) ||
        (statusFilter === 'inactive' && !acc.active);

      return matchesSearch && matchesStatus;
    });
  }, [data, searchText, statusFilter]);

  // Statistics
  const activeCount = useMemo(() => {
    return data.filter(item => item.active).length;
  }, [data]);

  const columns = [
    {
      title: 'Bank & Account Title',
      key: 'bankInfo',
      sorter: (a: BankAccountResponse, b: BankAccountResponse) =>
        (a.bankName || a.accountTitle).localeCompare(b.bankName || b.accountTitle),
      render: (_: any, record: BankAccountResponse) => (
        <Space size="middle">
          <Avatar
            icon={<BankOutlined />}
            size="large"
            style={{
              backgroundColor: '#e6f4ff',
              color: '#1677ff',
              border: '1px solid #91caff'
            }}
          />
          <Space direction="vertical" size={1}>
            <Text strong style={{ fontSize: '15px' }}>
              {record.bankName || 'Bank'}
            </Text>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              {record.accountTitle}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Account Number & IBAN',
      key: 'accNumber',
      render: (_: any, record: BankAccountResponse) => (
        <Space direction="vertical" size={2}>
          {record.accountNumber ? (
            <Space size={6}>
              <Text strong style={{ fontFamily: 'monospace', fontSize: '14px', color: '#0958d9' }}>
                {record.accountNumber}
              </Text>
              <Tooltip title="Copy Account Number">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined style={{ fontSize: '12px' }} />}
                  onClick={() => copyToClipboard(record.accountNumber!, 'Account Number')}
                />
              </Tooltip>
            </Space>
          ) : (
            <Text type="secondary" italic>No Account Number</Text>
          )}
          {record.iban && (
            <Text type="secondary" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
              IBAN: {record.iban}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Branch Details',
      key: 'branch',
      render: (_: any, record: BankAccountResponse) => (
        <Space direction="vertical" size={1}>
          <Text style={{ fontSize: '13px' }}>
            {record.branchName || 'Main Branch'}
          </Text>
          {record.branchCode && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Branch Code: {record.branchCode}
            </Text>
          )}
          {record.swiftCode && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              SWIFT: {record.swiftCode}
            </Text>
          )}
        </Space>
      ),
    },

    {
      title: 'Opening Balance',
      dataIndex: 'openingBalance',
      key: 'openingBalance',
      align: 'right' as const,
      sorter: (a: BankAccountResponse, b: BankAccountResponse) => (a.openingBalance || 0) - (b.openingBalance || 0),
      render: (val?: number) => (
        <Text strong style={{ fontFamily: 'monospace', color: val ? '#0958d9' : '#8c8c8c' }}>
          {val ? `Rs. ${Number(val).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Rs. 0.00'}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: '100px',
      render: (active: boolean) => (
        active ? (
          <Tag color="success">Active</Tag>
        ) : (
          <Tag color="default">Inactive</Tag>
        )
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '210px',
      render: (_: any, record: BankAccountResponse) => (
        <Space size={4} wrap>
          <Tooltip title="Edit Bank Account Details">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#1677ff' }} />}
              onClick={() => handleOpenEditModal(record)}
            />
          </Tooltip>

          <Tooltip title="View Detailed Account Statement / Ledger">
            <Button
              type="text"
              icon={<FileTextOutlined style={{ color: '#52c41a' }} />}
              onClick={() => navigate(`/reports/account-statement?account=${encodeURIComponent(record.account)}`)}
            />
          </Tooltip>

          <Tooltip title="Reconcile Checks & Bank Statement">
            <Button
              type="text"
              icon={<CheckSquareOutlined style={{ color: '#722ed1' }} />}
              onClick={() => navigate(`/daily-entries/bank-reconciliation?account=${encodeURIComponent(record.account)}`)}
            />
          </Tooltip>

          <Popconfirm
            title="Delete Bank Account"
            description="Are you sure? You cannot delete bank accounts that already have transactions."
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.account)}
          >
            <Tooltip title="Delete Bank Account">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Page Title & Intro */}
      <div style={{ marginBottom: '20px' }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space align="center" size="middle">
              <Avatar
                size={48}
                icon={<BankOutlined />}
                style={{ backgroundColor: '#1677ff', color: '#fff' }}
              />
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  Bank Accounts
                </Title>
                <Text type="secondary">
                  Manage company bank accounts, branches, and details easily.
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchData}
                loading={loading}
              >
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenAddModal}
                size="large"
                style={{ fontWeight: 500 }}
              >
                Add Bank Account
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Summary KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12}>
          <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <Statistic
              title={<Text type="secondary"><BankOutlined /> Total Bank Accounts</Text>}
              value={data.length}
              suffix={<Text type="secondary" style={{ fontSize: '14px' }}>accounts</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <Statistic
              title={<Text type="secondary"><CheckCircleOutlined style={{ color: '#52c41a' }} /> Active Accounts</Text>}
              value={activeCount}
              valueStyle={{ color: '#3f8600' }}
              suffix={<Text type="secondary" style={{ fontSize: '14px' }}>/ {data.length}</Text>}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters and Table */}
      <Card
        bordered={false}
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
        title={
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Input
                placeholder="Search by bank name, account title, account number, IBAN or branch..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                allowClear
                style={{ width: '100%', maxWidth: '420px' }}
              />
            </Col>
            <Col xs={24} md={12} style={{ textAlign: 'right' }}>
              <Space>
                <Select
                  value={statusFilter}
                  onChange={val => setStatusFilter(val)}
                  style={{ width: 140 }}
                  options={[
                    { label: 'All Statuses', value: 'all' },
                    { label: 'Active Only', value: 'active' },
                    { label: 'Inactive Only', value: 'inactive' },
                  ]}
                />
              </Space>
            </Col>
          </Row>
        }
      >
        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="account"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      {/* Add / Edit Bank Account Modal */}
      <Modal
        title={
          <Space align="center" size="small">
            <Avatar
              icon={<BankOutlined />}
              style={{ backgroundColor: '#e6f4ff', color: '#1677ff' }}
            />
            <span>{editingAccount ? 'Edit Bank Account' : 'Add New Bank Account'}</span>
          </Space>
        }
        open={isModalOpen}
        onOk={handleModalSave}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={submitting}
        okText={editingAccount ? 'Update Bank Account' : 'Create Bank Account'}
        width={650}
        destroyOnClose
      >
        <Paragraph type="secondary" style={{ marginBottom: '20px', fontSize: '13px' }}>
          {editingAccount
            ? 'Update your bank and account details below.'
            : 'Enter your bank details below to add a new account.'}
        </Paragraph>

        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Bank Name"
                name="bankName"
                rules={[{ required: true, message: 'Please select or enter the bank name' }]}
                tooltip="Name of the financial institution"
              >
                <AutoComplete
                  placeholder="e.g. Meezan Bank, HBL, Allied Bank"
                  options={POPULAR_BANKS.map(b => ({ value: b }))}
                  filterOption={(input, option) =>
                    (option?.value?.toLowerCase() ?? '').includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label="Account Title"
                name="accountTitle"
                rules={[{ required: true, message: 'Please enter the account title' }]}
                tooltip="Title as registered in bank statement (e.g. ABC Retail Collection A/C)"
              >
                <Input placeholder="e.g. Main Operational Current A/C" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Account Number"
                name="accountNumber"
                tooltip="Bank account number printed on your checkbook or statement"
              >
                <Input placeholder="e.g. 01020304050607" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label="IBAN"
                name="iban"
                tooltip="International Bank Account Number (24 digits for Pakistan)"
              >
                <Input placeholder="e.g. PK36MEZN0001020304050607" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Branch Name"
                name="branchName"
                tooltip="Branch location name"
              >
                <Input placeholder="e.g. F-10 Markaz Branch" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item
                label="Branch Code"
                name="branchCode"
                tooltip="4-digit branch code"
              >
                <Input placeholder="e.g. 0142" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item
                label="SWIFT / BIC"
                name="swiftCode"
                tooltip="Bank SWIFT/BIC code for international wire transfers"
              >
                <Input placeholder="e.g. MEZNPKKA" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Opening Balance (Rs.)"
                name="openingBalance"
                tooltip="Initial starting balance for this bank account"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="0.00"
                  precision={2}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item
                label="Currency"
                name="currency"
                initialValue="PKR"
              >
                <Select
                  options={[
                    { label: 'PKR - Pakistani Rupee', value: 'PKR' },
                    { label: 'USD - US Dollar', value: 'USD' },
                    { label: 'EUR - Euro', value: 'EUR' },
                    { label: 'GBP - British Pound', value: 'GBP' },
                    { label: 'AED - UAE Dirham', value: 'AED' },
                    { label: 'SAR - Saudi Riyal', value: 'SAR' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item
                label="Account Status"
                name="active"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch
                  checkedChildren="Active"
                  unCheckedChildren="Inactive"
                  defaultChecked
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Notes / Description"
            name="notes"
          >
            <Input.TextArea
              rows={2}
              placeholder="Optional notes or instructions regarding this bank account..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
