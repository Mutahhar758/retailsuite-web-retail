import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Table, Space, message, Divider
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, AccountBookOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type BalanceDetailLine } from '../../services/reportService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;

export const AccountBalanceReport: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [data, setData] = useState<BalanceDetailLine[]>([]);
  const [parentTitle, setParentTitle] = useState('');

  useEffect(() => {
    chartOfAccountService.getActiveAccounts().then(res => {
        // Show only Level 4 accounts (Control accounts)
        const controlAccounts = res.filter(a => a.accLevel === 4);
        setAccounts(controlAccounts.map(a => ({ account: a.account, title: a.title })));
    });
  }, []);

  const handleSearch = async (values: any) => {
    setLoading(true);
    try {
      const filter = {
        toDate: values.toDate.format('YYYY-MM-DD'),
        account: values.account
      };
      const res = await reportService.getBalanceDetail(filter);
      setData(res);
      const selectedAcc = accounts.find(a => a.account === values.account);
      setParentTitle(selectedAcc?.title || '');
    } catch (error) {
      message.error('Failed to load account balances');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Account Title',
      dataIndex: 'account',
      key: 'account',
    },
    {
      title: 'Current Balance',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      width: 200,
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
          <AccountBookOutlined style={{ fontSize: 24, color: '#16a34a' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Account Balance Report</Title>
            <Text type="secondary">View current balances for specific account groups</Text>
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
          toDate: dayjs()
        }}
      >
        <Form.Item name="toDate" label="As Of Date" rules={[{ required: true }]}>
          <DatePicker format="DD-MMM-YYYY" />
        </Form.Item>
        <Form.Item name="account" label="Account Group" rules={[{ required: true }]} style={{ minWidth: 300 }}>
          <Select 
            showSearch 
            placeholder="Select a group (e.g. Assets, Cash...)" 
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
          <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading} style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}>
            Show Report
          </Button>
        </Form.Item>
      </Form>

      {data.length > 0 && (
        <div id="printable-report">
          <div className="text-center mb-6">
            <Title level={3}>{parentTitle} - Balances</Title>
            <Space split={<Divider type="vertical" />}>
              <span><CalendarOutlined /> As of {form.getFieldValue('toDate').format('DD-MMM-YYYY')}</span>
            </Space>
          </div>

          <Table
            dataSource={data}
            columns={columns}
            pagination={false}
            loading={loading}
            rowKey="account"
            bordered
            size="middle"
            summary={pageData => {
                let total = 0;
                pageData.forEach(({ balance }) => {
                  total += balance;
                });
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row className="bg-gray-50 font-bold">
                      <Table.Summary.Cell index={0} align="right">Group Total</Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <Text type={total >= 0 ? 'success' : 'danger'}>
                           {Math.abs(total).toLocaleString(undefined, { minimumFractionDigits: 2 })} {total >= 0 ? 'Dr' : 'Cr'}
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
