import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Table, Space, Tag, message, Divider
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, FileTextOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type AccountStatementLine } from '../../services/reportService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;

export const AccountStatement: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [data, setData] = useState<(AccountStatementLine & { balance: number })[]>([]);
  const [accountTitle, setAccountTitle] = useState('');

  useEffect(() => {
    chartOfAccountService.getActiveAccounts().then(res => {
        // Only show Detail accounts
        const detailAccounts = res.filter(a => a.accType === 'Detail');
        setAccounts(detailAccounts.map(a => ({ account: a.account, title: a.title })));
    });
  }, []);

  const handleSearch = async (values: any) => {
    setLoading(true);
    try {
      const filter = {
        fromDate: values.dateRange[0].format('YYYY-MM-DD'),
        toDate: values.dateRange[1].format('YYYY-MM-DD'),
        account: values.account
      };
      const res = await reportService.getAccountStatement(filter);
      
      // Pre-calculate running balance
      let currentBalance = 0;
      const dataWithBalance = res.map(row => {
        currentBalance += (row.dr - row.cr);
        return { ...row, balance: currentBalance };
      });
      
      setData(dataWithBalance);
      const selectedAcc = accounts.find(a => a.account === values.account);
      setAccountTitle(selectedAcc?.title || '');
    } catch (error) {
      message.error('Failed to load account statement');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'vDate',
      key: 'vDate',
      width: 120,
      render: (date: string) => dayjs(date).format('DD-MMM-YYYY')
    },
    {
      title: 'Voucher #',
      dataIndex: 'vNo',
      key: 'vNo',
      width: 120,
      render: (vNo: string) => <Tag color="blue">{vNo}</Tag>
    },
    {
      title: 'Particulars',
      dataIndex: 'particular',
      key: 'particular',
    },
    {
      title: 'Debit (Dr)',
      dataIndex: 'dr',
      key: 'dr',
      align: 'right' as const,
      width: 130,
      render: (val: number) => val > 0 ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
    },
    {
      title: 'Credit (Cr)',
      dataIndex: 'cr',
      key: 'cr',
      align: 'right' as const,
      width: 130,
      render: (val: number) => val > 0 ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      width: 150,
      render: (balance: number) => (
        <Text strong type={balance >= 0 ? 'success' : 'danger'}>
          {Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {balance >= 0 ? 'Dr' : 'Cr'}
        </Text>
      )
    }
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6 no-print">
        <Space align="center">
          <FileTextOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Account Statement</Title>
            <Text type="secondary">View detailed ledger and transaction history</Text>
          </div>
        </Space>
        <Button icon={<PrinterOutlined />} disabled={data.length === 0} onClick={() => window.print()} className="no-print">Print Report</Button>
      </div>

      <Form
        form={form}
        layout="inline"
        className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg no-print"
        onFinish={handleSearch}
        initialValues={{
          dateRange: [dayjs().startOf('month'), dayjs()]
        }}
      >
        <Form.Item name="dateRange" label="Date Range" rules={[{ required: true }]}>
          <DatePicker.RangePicker format="DD-MMM-YYYY" presets={rangePresets} />
        </Form.Item>
        <Form.Item name="account" label="Select Account" rules={[{ required: true }]} style={{ minWidth: 300 }}>
          <Select 
            showSearch 
            placeholder="Search account..." 
            optionFilterProp="children"
          >
            {accounts.map(acc => (
              <Select.Option key={acc.account} value={acc.account}>
                {acc.title}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading}>
            Show Report
          </Button>
        </Form.Item>
      </Form>

      {data.length > 0 && (
        <div id="printable-report">
          <div className="text-center mb-6">
            <Title level={3}>{accountTitle}</Title>
            <Space split={<Divider type="vertical" />}>
              <span><CalendarOutlined /> {form.getFieldValue('dateRange')[0].format('DD-MMM-YYYY')} to {form.getFieldValue('dateRange')[1].format('DD-MMM-YYYY')}</span>
            </Space>
          </div>

          <Table
            dataSource={data}
            columns={columns}
            pagination={false}
            loading={loading}
            rowKey={(record, index) => `${record.vNo}-${index}`}
            bordered
            size="small"
            summary={pageData => {
                let totalDr = 0;
                let totalCr = 0;
                pageData.forEach(({ dr, cr }) => {
                  totalDr += dr;
                  totalCr += cr;
                });
                const finalBalance = totalDr - totalCr;
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row className="bg-gray-50 font-bold">
                      <Table.Summary.Cell index={0} colSpan={3} align="right">Totals</Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">{totalDr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">{totalCr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text type={finalBalance >= 0 ? 'success' : 'danger'}>
                           {Math.abs(finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {finalBalance >= 0 ? 'Dr' : 'Cr'}
                        </Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
          />
        </div>
      )}
    </Card>
  );
};
