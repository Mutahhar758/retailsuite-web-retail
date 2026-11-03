import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Card, Button, Space, Typography, Tag, message,
  Input, Modal, Form, Row, Col, Statistic, Select, InputNumber,
  DatePicker, Divider
} from 'antd';
import {
  DollarOutlined, PlusOutlined, ReloadOutlined,
  SearchOutlined, BankOutlined,
  FolderAddOutlined, FileTextOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { paymentService, type PaymentDto } from '../../services/paymentService';
import { expenseService } from '../../services/expenseService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const ExpenseManagement: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<PaymentDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Filters
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');

  // Lookups
  const [subcategories, setSubcategories] = useState<ChartOfAccountHeadDto[]>([]);
  const [expenseItems, setExpenseItems] = useState<ChartOfAccountHeadDto[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [recordForm] = Form.useForm();
  const [categoryForm] = Form.useForm();

  // Load Lookups
  const fetchLookups = useCallback(async () => {
    try {
      const [subs, items, cbAccs] = await Promise.all([
        expenseService.getSubcategories(),
        expenseService.getExpenseItems(),
        chartOfAccountService.getCashBankAccounts(),
      ]);
      setSubcategories(subs);
      setExpenseItems(items);
      setCashBankAccounts(cbAccs);

      // Fetch balances for cash/banks
      const balances: Record<string, number> = {};
      await Promise.all(
        cbAccs.map(async (acc) => {
          try {
            const bal = await paymentService.getAccountBalance(acc.account);
            balances[acc.account] = bal;
          } catch {
            balances[acc.account] = 0;
          }
        })
      );
      setAccountBalances(balances);
    } catch {
      message.error('Failed to load expense categories and accounts');
    }
  }, []);

  // Fetch Expenses List
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const fromDate = dateRange[0]?.format('YYYY-MM-DD');
      const toDate = dateRange[1]?.format('YYYY-MM-DD');

      const res = await paymentService.getList({
        fromDate,
        toDate,
        pageNumber: page,
        pageSize,
      });

      setExpenses(res.data);
      setTotalCount(res.totalCount);
    } catch {
      message.error('Failed to fetch expense records');
    } finally {
      setLoading(false);
    }
  }, [dateRange, page, pageSize]);

  useEffect(() => {
    fetchLookups();
  }, [fetchLookups]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Handle Record Expense Submit
  const handleRecordExpenseSubmit = async () => {
    try {
      const values = await recordForm.validateFields();
      setSubmitting(true);

      const voucherNo = await expenseService.recordExpense({
        date: values.date.format('YYYY-MM-DD'),
        expenseAccountId: values.expenseAccountId,
        cashBankAccountId: values.cashBankAccountId,
        amount: values.amount,
        payee: values.payee,
        remarks: values.remarks,
      });

      message.success(`Expense recorded successfully! (Voucher #${voucherNo})`);
      setIsRecordModalOpen(false);
      recordForm.resetFields();
      fetchExpenses();
      fetchLookups();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle New Expense Category Submit
  const handleCategorySubmit = async () => {
    try {
      const values = await categoryForm.validateFields();
      setSubmitting(true);

      await expenseService.createExpenseItem(values.title, values.subcategoryId);
      message.success(`Expense category "${values.title}" created successfully!`);
      setIsCategoryModalOpen(false);
      categoryForm.resetFields();

      // Refresh items and auto-select in record form if open
      const updatedItems = await expenseService.getExpenseItems();
      setExpenseItems(updatedItems);
      recordForm.setFieldsValue({ expenseAccountId: updatedItems.find(i => i.title.toLowerCase() === values.title.trim().toLowerCase())?.account });
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered expense items based on selected subcategory in modal
  const [selectedSubInModal, setSelectedSubInModal] = useState<string | undefined>(undefined);
  const modalExpenseItems = useMemo(() => {
    if (!selectedSubInModal) return expenseItems;
    return expenseItems.filter(i => i.account.startsWith(selectedSubInModal));
  }, [expenseItems, selectedSubInModal]);

  // Statistics
  const totalAmount = useMemo(() => {
    return expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [expenses]);

  const todayAmount = useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    return expenses
      .filter(i => i.date === todayStr)
      .reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [expenses]);

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (val: string) => dayjs(val).format('DD MMM YYYY'),
    },
    {
      title: 'Voucher #',
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 120,
      render: (val: string) => (
        <Tag color="blue" style={{ cursor: 'pointer', fontFamily: 'monospace' }} onClick={() => navigate(`/daily-entries/payment-voucher/${val}`)}>
          {val}
        </Tag>
      ),
    },
    {
      title: 'Remarks / Payee',
      dataIndex: 'narration',
      key: 'narration',
      ellipsis: true,
      render: (val: string) => val || <Text type="secondary">-</Text>,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      width: 140,
      render: (val: number) => (
        <Text strong style={{ color: '#cf1322', fontSize: 14 }}>
          Rs. {Number(val || 0).toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Created By',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 130,
      render: (val: string) => <Tag>{val || 'System'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      align: 'center' as const,
      render: (_: any, record: PaymentDto) => (
        <Button
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => navigate(`/daily-entries/payment-voucher/${record.voucherNo}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '4px' }}>
      {/* Top Banner / Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#fff1f0', borderRadius: 8 }}>
            <Statistic
              title={<Text strong style={{ color: '#cf1322' }}>Total Selected Period</Text>}
              value={totalAmount}
              precision={0}
              prefix="Rs."
              valueStyle={{ color: '#cf1322', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#f6ffed', borderRadius: 8 }}>
            <Statistic
              title={<Text strong style={{ color: '#389e0d' }}>Today's Expenses</Text>}
              value={todayAmount}
              precision={0}
              prefix="Rs."
              valueStyle={{ color: '#389e0d', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#e6f7ff', borderRadius: 8 }}>
            <Statistic
              title={<Text strong style={{ color: '#096dd9' }}>Total Vouchers</Text>}
              value={totalCount}
              valueStyle={{ color: '#096dd9', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table Card */}
      <Card
        title={
          <Space>
            <DollarOutlined style={{ color: '#cf1322', fontSize: 20 }} />
            <Title level={4} style={{ margin: 0 }}>Daily Expenses</Title>
          </Space>
        }
        extra={
          <Space wrap>
            <Button
              type="primary"
              danger
              icon={<PlusOutlined />}
              onClick={() => {
                recordForm.resetFields();
                recordForm.setFieldsValue({
                  date: dayjs(),
                  cashBankAccountId: cashBankAccounts[0]?.account,
                });
                setIsRecordModalOpen(true);
              }}
            >
              Record Expense
            </Button>
            <Button
              icon={<FolderAddOutlined />}
              onClick={() => {
                categoryForm.resetFields();
                setIsCategoryModalOpen(true);
              }}
            >
              + Expense Category
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchExpenses} />
          </Space>
        }
      >
        {/* Filter Bar */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={10}>
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]]);
                }
              }}
              style={{ width: '100%' }}
              allowClear={false}
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              allowClear
              placeholder="Filter by Group (e.g. Utility Bills, Rent)"
              style={{ width: '100%' }}
              value={selectedSubcategory}
              onChange={setSelectedSubcategory}
            >
              {subcategories.map(s => (
                <Select.Option key={s.account} value={s.account}>
                  {s.title}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search by remarks / payee..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
        </Row>

        <Table
          dataSource={expenses}
          columns={columns}
          rowKey="voucherNo"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total: totalCount,
            showSizeChanger: true,
            pageSizeOptions: ['15', '30', '50'],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      {/* Record Expense Modal */}
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: '#cf1322' }} />
            <span>Record New Expense</span>
          </Space>
        }
        open={isRecordModalOpen}
        onOk={handleRecordExpenseSubmit}
        onCancel={() => setIsRecordModalOpen(false)}
        confirmLoading={submitting}
        okText="Save Expense"
        okButtonProps={{ danger: true }}
        width={540}
        destroyOnClose
      >
        <Form form={recordForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="date"
                label="Expense Date"
                rules={[{ required: true, message: 'Please select date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="Amount (Rs.)"
                rules={[
                  { required: true, message: 'Please enter amount' },
                  { type: 'number', min: 1, message: 'Amount must be greater than 0' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="0.00"
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(val) => (val ? Number(val.replace(/\$\s?|(,*)/g, '')) : 0) as any}
                  min={1}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Expense Group (Filter)">
                <Select
                  placeholder="All Groups"
                  allowClear
                  value={selectedSubInModal}
                  onChange={(val) => {
                    setSelectedSubInModal(val);
                    recordForm.setFieldsValue({ expenseAccountId: undefined });
                  }}
                >
                  {subcategories.map(s => (
                    <Select.Option key={s.account} value={s.account}>
                      {s.title}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="expenseAccountId"
                label="Expense Category"
                rules={[{ required: true, message: 'Please select expense category' }]}
              >
                <Select
                  placeholder="Select expense item"
                  showSearch
                  optionFilterProp="children"
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <Divider style={{ margin: '8px 0' }} />
                      <Button
                        type="link"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          categoryForm.resetFields();
                          if (selectedSubInModal) {
                            categoryForm.setFieldsValue({ subcategoryId: selectedSubInModal });
                          }
                          setIsCategoryModalOpen(true);
                        }}
                      >
                        + Add New Category
                      </Button>
                    </>
                  )}
                >
                  {modalExpenseItems.map(item => (
                    <Select.Option key={item.account} value={item.account}>
                      {item.title}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="cashBankAccountId"
            label="Paid From (Cash / Bank)"
            rules={[{ required: true, message: 'Please select payment account' }]}
          >
            <Select placeholder="Select cash or bank account">
              {cashBankAccounts.map(cb => {
                const bal = accountBalances[cb.account] ?? 0;
                return (
                  <Select.Option key={cb.account} value={cb.account}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <span><BankOutlined style={{ marginRight: 6 }} />{cb.title}</span>
                      <Text type={bal >= 0 ? 'secondary' : 'danger'} style={{ fontSize: 12 }}>
                        (Bal: Rs. {bal.toLocaleString()})
                      </Text>
                    </Space>
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>

          <Form.Item name="payee" label="Paid To / Payee (Optional)">
            <Input placeholder="e.g. Electric Company, Landlord, Staff Name" />
          </Form.Item>

          <Form.Item name="remarks" label="Notes / Description">
            <Input.TextArea rows={2} placeholder="e.g. Electricity bill for October, Office snacks" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Expense Category Modal */}
      <Modal
        title={
          <Space>
            <FolderAddOutlined style={{ color: '#1677ff' }} />
            <span>Create Expense Category</span>
          </Space>
        }
        open={isCategoryModalOpen}
        onOk={handleCategorySubmit}
        onCancel={() => setIsCategoryModalOpen(false)}
        confirmLoading={submitting}
        okText="Create Category"
        destroyOnClose
      >
        <Form form={categoryForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="subcategoryId"
            label="Expense Group (e.g. Utility Bills, Rent)"
            rules={[{ required: true, message: 'Please select expense group' }]}
          >
            <Select placeholder="Select group (e.g. Utility Bills, Rent, Refreshments)">
              {subcategories.map(s => (
                <Select.Option key={s.account} value={s.account}>
                  {s.title}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="Expense Category Name"
            rules={[{ required: true, message: 'Please enter category name' }]}
          >
            <Input placeholder="e.g. Generator Fuel, Water Dispenser Bottles, Shop Cleaning" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExpenseManagement;
