import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button, Input,
  Table, Space, message, Divider, Row, Col, Statistic, Tag, Progress, Drawer
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, SwapOutlined,
  CalendarOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, CloseCircleOutlined,
  FileTextOutlined, ArrowUpOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  reportService,
  type CustomerBalanceRecoveryResponse,
  type CustomerBalanceRecoveryLine,
  type AccountStatementLine
} from '../../services/reportService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { useAppStore } from '../../stores/useAppStore';
import {
  printDirect,
  padLine,
  divider,
  type ConnectionMethod,
  ESC_ALIGN_LEFT,
  ESC_ALIGN_CENTER,
  ESC_BOLD_ON,
  ESC_BOLD_OFF,
  ESC_DOUBLE_ON,
  ESC_DOUBLE_OFF
} from '../../hooks/useThermalPrinter';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const CustomerBalanceRecoveryReport: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [reportData, setReportData] = useState<CustomerBalanceRecoveryResponse | null>(null);
  const [searchText, setSearchText] = useState('');
  const [thermalPrinting, setThermalPrinting] = useState(false);

  // Drawer for inspecting single customer ledger / statement
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerBalanceRecoveryLine | null>(null);
  const [customerStatement, setCustomerStatement] = useState<AccountStatementLine[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);

  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const currentOrgName = currentOrg?.name || 'Retail Suite';

  // Printer configuration
  const [connectionMethod] = useState<ConnectionMethod>(() => {
    const saved = localStorage.getItem('pos_printer_method');
    if (saved) return saved as ConnectionMethod;
    const userAgent = window.navigator.userAgent;
    if (userAgent.includes('CrOS')) {
      return 'WEB_USB';
    }
    return 'LOCAL_RELAY';
  });
  const [printerName] = useState<string>(() => {
    return localStorage.getItem('pos_printer_name') || 'XP-80';
  });

  // Load customer lookup
  useEffect(() => {
    chartOfAccountService.getCustomerAccounts().then(res => {
      setCustomers(res || []);
    }).catch(console.error);
  }, []);

  // Set default date range to current month
  useEffect(() => {
    const startOfMonth = dayjs().startOf('month');
    const today = dayjs();
    form.setFieldsValue({
      dateRange: [startOfMonth, today],
      dateBasis: 'ClearingDate',
      balanceFilter: 'All'
    });
  }, [form]);

  const handleQuickPreset = (preset: '1-10' | '1-15' | '1-20' | 'month' | 'last-month') => {
    let from = dayjs().startOf('month');
    let to = dayjs();

    if (preset === '1-10') {
      from = dayjs().startOf('month');
      to = dayjs().date(10);
    } else if (preset === '1-15') {
      from = dayjs().startOf('month');
      to = dayjs().date(15);
    } else if (preset === '1-20') {
      from = dayjs().startOf('month');
      to = dayjs().date(20);
    } else if (preset === 'month') {
      from = dayjs().startOf('month');
      to = dayjs().endOf('month');
    } else if (preset === 'last-month') {
      from = dayjs().subtract(1, 'month').startOf('month');
      to = dayjs().subtract(1, 'month').endOf('month');
    }

    form.setFieldsValue({ dateRange: [from, to] });
    handleSearch({
      dateRange: [from, to],
      customerAccountId: form.getFieldValue('customerAccountId'),
      dateBasis: form.getFieldValue('dateBasis'),
      balanceFilter: form.getFieldValue('balanceFilter')
    });
  };

  const handleSearch = async (values?: any) => {
    const fValues = values || form.getFieldsValue();
    if (!fValues.dateRange || fValues.dateRange.length < 2) {
      message.warning('Please select a valid date range');
      return;
    }

    setLoading(true);
    try {
      const fromDate = fValues.dateRange[0].format('YYYY-MM-DD');
      const toDate = fValues.dateRange[1].format('YYYY-MM-DD');
      const customerAccountId = fValues.customerAccountId;
      const dateBasis = fValues.dateBasis || 'ClearingDate';
      const balanceFilter = fValues.balanceFilter || 'All';

      const res = await reportService.getCustomerBalanceRecovery({
        fromDate,
        toDate,
        customerAccountId,
        dateBasis,
        balanceFilter
      });
      setReportData(res);
    } catch (error) {
      console.error(error);
      message.error('Failed to load customer balance and recovery data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrawer = async (record: CustomerBalanceRecoveryLine) => {
    setSelectedCustomer(record);
    setDrawerVisible(true);
    setStatementLoading(true);
    try {
      const dateRange = form.getFieldValue('dateRange');
      const fromDate = dateRange ? dateRange[0].format('YYYY-MM-DD') : dayjs().startOf('month').format('YYYY-MM-DD');
      const toDate = dateRange ? dateRange[1].format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      const dateBasis = form.getFieldValue('dateBasis') || 'ClearingDate';

      const res = await reportService.getAccountStatement({
        account: record.customerAccountId,
        fromDate,
        toDate,
        dateBasis
      });
      setCustomerStatement(res || []);
    } catch (err) {
      console.error(err);
      message.error('Failed to load customer transactions');
    } finally {
      setStatementLoading(false);
    }
  };

  const filteredLines = useMemo(() => {
    if (!reportData || !reportData.lines) return [];
    if (!searchText.trim()) return reportData.lines;

    const lower = searchText.toLowerCase().trim();
    return reportData.lines.filter(l =>
      l.customerTitle.toLowerCase().includes(lower) ||
      l.customerAccountId.toLowerCase().includes(lower) ||
      (l.phone && l.phone.toLowerCase().includes(lower)) ||
      (l.address && l.address.toLowerCase().includes(lower))
    );
  }, [reportData, searchText]);

  const handlePrintThermal = async () => {
    if (!reportData || reportData.lines.length === 0) {
      message.warning('No report data to print');
      return;
    }

    setThermalPrinting(true);
    try {
      const dateRange = form.getFieldValue('dateRange');
      const fromStr = dateRange ? dateRange[0].format('DD-MMM-YYYY') : '';
      const toStr = dateRange ? dateRange[1].format('DD-MMM-YYYY') : '';
      const dateBasis = form.getFieldValue('dateBasis') || 'ClearingDate';
      const width = 42;

      const lines: string[] = [];
      lines.push(ESC_ALIGN_CENTER + ESC_DOUBLE_ON + currentOrgName.toUpperCase());
      lines.push(ESC_DOUBLE_OFF + 'CUSTOMER BALANCE & RECOVERY REPORT');
      lines.push(`Period: ${fromStr} to ${toStr}`);
      lines.push(`Basis: ${dateBasis === 'ClearingDate' ? 'Clearing Date' : 'Voucher Date'}`);
      lines.push(`Printed: ${dayjs().format('DD-MMM-YYYY HH:mm')}`);
      lines.push(ESC_ALIGN_LEFT + divider('-', width));

      // Table Header
      lines.push('Customer          Due(Rs)  Recv(Rs)  Bal(Rs)');
      lines.push(divider('-', width));

      filteredLines.forEach(l => {
        const name = l.customerTitle.length > 15 ? l.customerTitle.substring(0, 15) : l.customerTitle.padEnd(15, ' ');
        const dueStr = Math.round(l.totalDue).toLocaleString().padStart(8, ' ');
        const recvStr = Math.round(l.recoveryAmount).toLocaleString().padStart(8, ' ');
        const balStr = Math.round(l.closingBalance).toLocaleString().padStart(8, ' ');
        lines.push(`${name} ${dueStr} ${recvStr} ${balStr}`);
      });

      lines.push(divider('=', width));
      lines.push(ESC_BOLD_ON);
      lines.push(padLine('Total Previous Bal:', `Rs. ${Math.round(reportData.summary.totalPreviousBalance).toLocaleString()}`, width));
      lines.push(padLine('Total Current Billing:', `Rs. ${Math.round(reportData.summary.totalCurrentBilling).toLocaleString()}`, width));
      lines.push(padLine('Total Due Amount:', `Rs. ${Math.round(reportData.summary.totalDue).toLocaleString()}`, width));
      lines.push(padLine('Total Recovered:', `Rs. ${Math.round(reportData.summary.totalRecovery).toLocaleString()}`, width));
      lines.push(padLine('Total Outstanding Bal:', `Rs. ${Math.round(reportData.summary.totalClosingBalance).toLocaleString()}`, width));
      lines.push(padLine('Recovery Rate:', `${reportData.summary.overallRecoveryRate.toFixed(1)}%`, width));
      lines.push(ESC_BOLD_OFF);
      lines.push(divider('-', width));
      lines.push(ESC_ALIGN_CENTER + 'End of Report');
      lines.push(ESC_ALIGN_LEFT);
      lines.push('');
      lines.push('');
      lines.push('');

      await printDirect(lines, connectionMethod, {
        printerName,
        openDrawer: false,
        cutPaper: true
      });
      message.success('Report printed to thermal printer');
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Thermal printing failed');
    } finally {
      setThermalPrinting(false);
    }
  };

  const columns = [
    {
      title: 'Customer',
      dataIndex: 'customerTitle',
      key: 'customer',
      width: 220,
      render: (_: string, record: CustomerBalanceRecoveryLine) => (
        <div>
          <div className="font-semibold text-gray-800 dark:text-gray-100">
            {record.customerTitle}
          </div>
          <div className="text-xs text-gray-400 font-mono">
            {record.customerAccountId}
          </div>
          {record.phone && (
            <div className="text-xs text-gray-500">
              📞 {record.phone}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Prev Balance',
      dataIndex: 'previousBalance',
      key: 'previousBalance',
      align: 'right' as const,
      width: 130,
      render: (val: number) => (
        <span className={val > 0 ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-gray-600'}>
          {val !== 0 ? `Rs. ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
        </span>
      )
    },
    {
      title: 'Current Billing',
      dataIndex: 'currentBilling',
      key: 'currentBilling',
      align: 'right' as const,
      width: 140,
      render: (val: number) => (
        <span className="font-medium text-blue-600 dark:text-blue-400">
          {val > 0 ? `Rs. ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
        </span>
      )
    },
    {
      title: 'Total Due',
      dataIndex: 'totalDue',
      key: 'totalDue',
      align: 'right' as const,
      width: 140,
      render: (val: number) => (
        <span className="font-bold text-gray-800 dark:text-gray-100">
          {val !== 0 ? `Rs. ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
        </span>
      )
    },
    {
      title: 'Recovery (Paid)',
      dataIndex: 'recoveryAmount',
      key: 'recoveryAmount',
      align: 'right' as const,
      width: 140,
      render: (val: number) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {val > 0 ? `Rs. ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
        </span>
      )
    },
    {
      title: 'Closing Balance',
      dataIndex: 'closingBalance',
      key: 'closingBalance',
      align: 'right' as const,
      width: 150,
      render: (val: number) => {
        if (val === 0) {
          return <span className="text-emerald-600 font-semibold">Rs. 0 (Nil)</span>;
        }
        if (val < 0) {
          return (
            <span className="text-purple-600 font-semibold">
              Advance Rs. {Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          );
        }
        return (
          <span className="text-rose-600 font-bold">
            Rs. {val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        );
      }
    },
    {
      title: 'Recovery %',
      dataIndex: 'recoveryPercentage',
      key: 'recoveryPercentage',
      align: 'center' as const,
      width: 130,
      render: (pct: number, record: CustomerBalanceRecoveryLine) => {
        const isComplete = record.closingBalance <= 0;
        return (
          <div style={{ width: 100, margin: '0 auto' }}>
            <Progress
              percent={isComplete ? 100 : pct}
              size="small"
              status={isComplete ? 'success' : pct > 0 ? 'active' : 'exception'}
              format={p => `${p}%`}
            />
          </div>
        );
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center' as const,
      width: 110,
      render: (status: string) => {
        if (status === 'Cleared') return <Tag color="success" icon={<CheckCircleOutlined />}>Cleared</Tag>;
        if (status === 'Advance') return <Tag color="purple" icon={<ArrowUpOutlined />}>Advance</Tag>;
        if (status === 'Partial') return <Tag color="warning" icon={<ExclamationCircleOutlined />}>Partial</Tag>;
        return <Tag color="error" icon={<CloseCircleOutlined />}>Unpaid</Tag>;
      }
    },
    {
      title: 'Action',
      key: 'action',
      align: 'center' as const,
      width: 90,
      render: (_: any, record: CustomerBalanceRecoveryLine) => (
        <Button
          type="link"
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => handleOpenDrawer(record)}
        >
          View
        </Button>
      )
    }
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
          }
          #printable-report {
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #printable-report table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          #printable-report th, #printable-report td {
            border: 1px solid #333333 !important;
            padding: 4px 6px !important;
            font-size: 9pt !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 no-print gap-4">
        <Space align="center">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            <SwapOutlined style={{ fontSize: 24 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Customer Balance & Recovery Report
            </Title>
            <Text type="secondary">
              Customer balances and recoveries reconciled by clearing date
            </Text>
          </div>
        </Space>

        <Space>
          <Button
            icon={<PrinterOutlined />}
            disabled={!reportData || filteredLines.length === 0}
            onClick={() => window.print()}
          >
            Print A4 Report
          </Button>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            loading={thermalPrinting}
            disabled={!reportData || filteredLines.length === 0}
            onClick={handlePrintThermal}
            style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
          >
            Print Slip
          </Button>
        </Space>
      </div>

      {/* Filter Form & Quick Presets */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl no-print">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSearch}
        >
          <Row gutter={[16, 12]} align="bottom">
            <Col xs={24} sm={12} md={7} lg={6}>
              <Form.Item
                name="dateRange"
                label="Date Range"
                rules={[{ required: true, message: 'Please select date range' }]}
                style={{ marginBottom: 0 }}
              >
                <RangePicker 
                  format="DD-MMM-YYYY" 
                  style={{ width: '100%' }}
                  allowClear={false}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={5} lg={5}>
              <Form.Item
                name="dateBasis"
                label="Reconciliation Basis"
                style={{ marginBottom: 0 }}
              >
                <Select>
                  <Select.Option value="ClearingDate">
                    Clearing Date (Recommended)
                  </Select.Option>
                  <Select.Option value="VoucherDate">
                    Voucher Date
                  </Select.Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={6} lg={5}>
              <Form.Item
                name="customerAccountId"
                label="Customer"
                style={{ marginBottom: 0 }}
              >
                <Select
                  showSearch
                  placeholder="All Customers"
                  optionFilterProp="children"
                  allowClear
                >
                  {customers.map(c => (
                    <Select.Option key={c.account} value={c.account}>
                      {c.title} ({c.account})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={6} lg={4}>
              <Form.Item
                name="balanceFilter"
                label="Balance Status"
                style={{ marginBottom: 0 }}
              >
                <Select>
                  <Select.Option value="All">All Statuses</Select.Option>
                  <Select.Option value="OutstandingOnly">Outstanding Balance Only</Select.Option>
                  <Select.Option value="ClearedOnly">Fully Cleared Only</Select.Option>
                  <Select.Option value="UnpaidOnly">Zero Recovery (Unpaid)</Select.Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={4} lg={4}>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                htmlType="submit"
                loading={loading}
                block
                style={{ backgroundColor: '#2563eb', borderColor: '#2563eb' }}
              >
                Show Report
              </Button>
            </Col>
          </Row>

          {/* Quick Date Presets */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-2">
            <Text type="secondary" className="text-xs mr-1">Quick Range:</Text>
            <Button size="small" onClick={() => handleQuickPreset('1-10')}>
              1st - 10th
            </Button>
            <Button size="small" onClick={() => handleQuickPreset('1-15')}>
              1st - 15th
            </Button>
            <Button size="small" onClick={() => handleQuickPreset('1-20')}>
              1st - 20th
            </Button>
            <Button size="small" onClick={() => handleQuickPreset('month')}>
              This Month
            </Button>
            <Button size="small" onClick={() => handleQuickPreset('last-month')}>
              Last Month
            </Button>
          </div>
        </Form>
      </div>

      {/* KPI Stats Cards */}
      {reportData && (
        <div className="mb-6 no-print">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={4}>
              <Card size="small" className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 rounded-lg">
                <Statistic
                  title={<span className="text-amber-700 dark:text-amber-300 font-medium">Prev Balance</span>}
                  value={reportData.summary.totalPreviousBalance}
                  precision={0}
                  prefix="Rs. "
                  valueStyle={{ color: '#d97706', fontWeight: 'bold' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Balance before period
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={4}>
              <Card size="small" className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 rounded-lg">
                <Statistic
                  title={<span className="text-blue-700 dark:text-blue-300 font-medium">Current Billing</span>}
                  value={reportData.summary.totalCurrentBilling}
                  precision={0}
                  prefix="Rs. "
                  valueStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Bills & sales created
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={4}>
              <Card size="small" className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 rounded-lg">
                <Statistic
                  title={<span className="text-purple-700 dark:text-purple-300 font-medium">Total Due</span>}
                  value={reportData.summary.totalDue}
                  precision={0}
                  prefix="Rs. "
                  valueStyle={{ color: '#7c3aed', fontWeight: 'bold' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Prev Bal + Current Billing
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={4}>
              <Card size="small" className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 rounded-lg">
                <Statistic
                  title={<span className="text-emerald-700 dark:text-emerald-300 font-medium">Recovered (Paid)</span>}
                  value={reportData.summary.totalRecovery}
                  precision={0}
                  prefix="Rs. "
                  valueStyle={{ color: '#059669', fontWeight: 'bold' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  By Clearing Date
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={4}>
              <Card size="small" className="bg-rose-50/50 dark:bg-rose-950/20 border-rose-100 rounded-lg">
                <Statistic
                  title={<span className="text-rose-700 dark:text-rose-300 font-medium">Closing Balance</span>}
                  value={reportData.summary.totalClosingBalance}
                  precision={0}
                  prefix="Rs. "
                  valueStyle={{ color: '#e11d48', fontWeight: 'bold' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Net Outstanding
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={4}>
              <Card size="small" className="bg-teal-50/50 dark:bg-teal-950/20 border-teal-100 rounded-lg">
                <Statistic
                  title={<span className="text-teal-700 dark:text-teal-300 font-medium">Recovery Rate</span>}
                  value={reportData.summary.overallRecoveryRate}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: '#0d9488', fontWeight: 'bold' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {reportData.summary.totalCustomers} Customers
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {/* Main Table / Printable Report */}
      {reportData && (
        <div id="printable-report">
          {/* Table Search & Controls Bar */}
          <div className="flex flex-wrap justify-between items-center mb-4 no-print gap-3">
            <Input
              placeholder="Search by customer name, phone, or account..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ maxWidth: 350 }}
              allowClear
            />
            <div className="text-xs text-gray-500">
              Showing {filteredLines.length} of {reportData.lines.length} customers
            </div>
          </div>

          {/* Printable Report Header */}
          <div className="text-center mb-6">
            <Title level={3} style={{ margin: 0 }}>
              {currentOrgName.toUpperCase()}
            </Title>
            <Title level={4} style={{ margin: '4px 0 0', color: '#059669' }}>
              CUSTOMER BALANCE & RECOVERY REPORT
            </Title>
            <Space split={<Divider type="vertical" />} className="text-xs text-gray-500 mt-1">
              <span>
                <CalendarOutlined /> Period: {form.getFieldValue('dateRange')?.[0]?.format('DD-MMM-YYYY')} to {form.getFieldValue('dateRange')?.[1]?.format('DD-MMM-YYYY')}
              </span>
              <span>
                Basis: {form.getFieldValue('dateBasis') === 'ClearingDate' ? 'Clearing Date' : 'Voucher Date'}
              </span>
              <span>
                Print Date: {dayjs().format('DD-MMM-YYYY HH:mm')}
              </span>
            </Space>
          </div>

          <Table
            dataSource={filteredLines}
            columns={columns}
            pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['25', '50', '100', '500'] }}
            loading={loading}
            rowKey="customerAccountId"
            bordered
            size="middle"
            summary={() => {
              const summary = reportData.summary;
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row className="bg-gray-100 dark:bg-gray-800 font-bold">
                    <Table.Summary.Cell index={0} align="left">
                      Total ({filteredLines.length} Customers)
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <span className="text-amber-700 dark:text-amber-400">
                        Rs. {summary.totalPreviousBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <span className="text-blue-600 dark:text-blue-400">
                        Rs. {summary.totalCurrentBilling.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <span>
                        Rs. {summary.totalDue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Rs. {summary.totalRecovery.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right">
                      <span className="text-rose-600 dark:text-rose-400">
                        Rs. {summary.totalClosingBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} align="center">
                      <span className="text-teal-600">
                        {summary.overallRecoveryRate.toFixed(1)}%
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="center">
                      -
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8} align="center">
                      -
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        </div>
      )}

      {/* Customer Statement Drawer */}
      <Drawer
        title={
          <div>
            <div className="text-base font-bold">
              {selectedCustomer?.customerTitle}
            </div>
            <div className="text-xs text-gray-400 font-mono">
              Account: {selectedCustomer?.customerAccountId} | Phone: {selectedCustomer?.phone || 'N/A'}
            </div>
          </div>
        }
        placement="right"
        width={750}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
      >
        {selectedCustomer && (
          <div>
            {/* Quick Summary in Drawer */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4 text-center">
              <div>
                <div className="text-xs text-gray-500">Total Due</div>
                <div className="text-sm font-bold text-gray-800 dark:text-gray-100">
                  Rs. {selectedCustomer.totalDue.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Recovered</div>
                <div className="text-sm font-bold text-emerald-600">
                  Rs. {selectedCustomer.recoveryAmount.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Closing Balance</div>
                <div className={`text-sm font-bold ${selectedCustomer.closingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  Rs. {selectedCustomer.closingBalance.toLocaleString()}
                </div>
              </div>
            </div>

            <Table
              dataSource={customerStatement}
              loading={statementLoading}
              rowKey={r => `${r.vDate}-${r.vNo}-${r.vSeq}`}
              size="small"
              pagination={false}
              bordered
              columns={[
                {
                  title: 'Date',
                  dataIndex: 'vDate',
                  key: 'vDate',
                  width: 105,
                  render: (d: string) => dayjs(d).format('DD-MMM-YYYY')
                },
                {
                  title: 'Voucher',
                  dataIndex: 'vNo',
                  key: 'vNo',
                  width: 110,
                  render: (v: string) => v || 'Opening'
                },
                {
                  title: 'Particulars',
                  dataIndex: 'particular',
                  key: 'particular',
                  render: (p: string) => <span className="text-xs">{p}</span>
                },
                {
                  title: 'Debit (Dr)',
                  dataIndex: 'dr',
                  key: 'dr',
                  align: 'right',
                  width: 95,
                  render: (val: number) => val > 0 ? val.toLocaleString() : '-'
                },
                {
                  title: 'Credit (Cr)',
                  dataIndex: 'cr',
                  key: 'cr',
                  align: 'right',
                  width: 95,
                  render: (val: number) => val > 0 ? (
                    <span className="text-emerald-600 font-semibold">{val.toLocaleString()}</span>
                  ) : '-'
                }
              ]}
            />
          </div>
        )}
      </Drawer>
    </Card>
  );
};
