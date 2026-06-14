import React, { useState } from 'react';
import {
  Card, Typography, Form, DatePicker, Button,
  Table, Space, message, Divider
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, BankOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type BalanceSheetLine } from '../../services/reportService';

const { Title, Text } = Typography;

export const BalanceSheet: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BalanceSheetLine[]>([]);

  const handleSearch = async (values: any) => {
    setLoading(true);
    try {
      const filter = {
        toDate: values.toDate.format('YYYY-MM-DD')
      };
      const res = await reportService.getBalanceSheet(filter);
      
      // Transform flat list to tree
      const tree = buildTree(res);
      setData(tree);
    } catch (error) {
      message.error('Failed to load balance sheet');
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (items: BalanceSheetLine[]): any[] => {
    const root: any = {};
    items.forEach(item => {
      if (!root[item.lvl1]) {
        root[item.lvl1] = { title: item.lvl1, key: item.lvl1, curBal: 0, children: {} };
      }
      root[item.lvl1].curBal += item.curBal;
      
      const l2 = root[item.lvl1].children;
      if (!l2[item.lvl2]) {
        l2[item.lvl2] = { title: item.lvl2, key: `${item.lvl1}-${item.lvl2}`, curBal: 0, children: {} };
      }
      l2[item.lvl2].curBal += item.curBal;

      const l3 = l2[item.lvl2].children;
      if (!l3[item.lvl3]) {
        l3[item.lvl3] = { title: item.lvl3, key: `${item.lvl1}-${item.lvl2}-${item.lvl3}`, curBal: 0, children: {} };
      }
      l3[item.lvl3].curBal += item.curBal;

      const l4 = l3[item.lvl3].children;
      l4[item.title] = { title: item.title, key: item.title, curBal: item.curBal };
    });

    const toArr = (obj: any): any[] => Object.values(obj).map((n: any) => {
      if (n.children) n.children = toArr(n.children);
      return n;
    });
    return toArr(root);
  };

  const columns = [
    {
      title: 'Account Category',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <Text strong={!!record.children}>{text}</Text>
      )
    },
    {
      title: 'Balance',
      dataIndex: 'curBal',
      key: 'curBal',
      align: 'right' as const,
      width: 250,
      render: (val: number) => (
        <Text strong type={val >= 0 ? 'success' : 'danger'}>
          {Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2 })} {val >= 0 ? 'Dr' : 'Cr'}
        </Text>
      )
    }
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6 no-print">
        <Space align="center">
          <BankOutlined style={{ fontSize: 24, color: '#16a34a' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Balance Sheet</Title>
            <Text type="secondary">Financial position as of a specific date</Text>
          </div>
        </Space>
        <Button icon={<PrinterOutlined />} disabled={data.length === 0} onClick={() => window.print()} className="no-print">Print Report</Button>
      </div>

      <Form
        form={form}
        layout="inline"
        className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg no-print"
        onFinish={handleSearch}
        initialValues={{ toDate: dayjs() }}
      >
        <Form.Item name="toDate" label="As Of Date" rules={[{ required: true }]}>
          <DatePicker format="DD-MMM-YYYY" />
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
            <Title level={3}>Balance Sheet</Title>
            <Space split={<Divider type="vertical" />}>
              <span><CalendarOutlined /> As of {form.getFieldValue('toDate').format('DD-MMM-YYYY')}</span>
            </Space>
          </div>

          <Table
            dataSource={data}
            columns={columns}
            pagination={false}
            loading={loading}
            rowKey="key"
            bordered
            size="middle"
            expandable={{ defaultExpandAllRows: true }}
          />
        </div>
      )}
    </Card>
  );
};
