import React, { useState } from 'react';
import {
  Card, Typography, Form, DatePicker, Button,
  Table, Space, message, Divider, Input
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, BarChartOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type TrialBalanceLine } from '../../services/reportService';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;

export const TrialBalanceReport: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrialBalanceLine[]>([]);
  const [searchText, setSearchText] = useState('');

  const handleSearch = async (values: any) => {
    setLoading(true);
    try {
      const filter = {
        fromDate: values.dateRange[0].format('YYYY-MM-DD'),
        toDate: values.dateRange[1].format('YYYY-MM-DD')
      };
      const res = await reportService.getTrialBalance(filter);
      
      // Transform flat list to tree
      const tree = buildAccountTree(res);
      setData(tree);
    } catch (error) {
      message.error('Failed to load trial balance report');
    } finally {
      setLoading(false);
    }
  };

  const buildAccountTree = (items: TrialBalanceLine[]): any[] => {
    const root: any = {};

    items.forEach(item => {
      const path = [item.lvl1, item.lvl2, item.lvl3, item.lvl4].filter(Boolean);
      let currentLevel = root;

      path.forEach((levelTitle, index) => {
        if (!currentLevel[levelTitle]) {
          currentLevel[levelTitle] = {
            title: levelTitle,
            priBal: 0,
            dr: 0,
            cr: 0,
            curBal: 0,
            children: {},
            key: path.slice(0, index + 1).join(' > '),
            isGroup: true
          };
        }
        
        // Add totals to parent groups
        currentLevel[levelTitle].priBal += item.priBal;
        currentLevel[levelTitle].dr += item.dr;
        currentLevel[levelTitle].cr += item.cr;
        currentLevel[levelTitle].curBal += item.curBal;
        
        currentLevel = currentLevel[levelTitle].children;
      });

      // Add the leaf (detail account)
      const leafKey = `${item.lvl4} > ${item.title}`;
      currentLevel[item.title] = {
        ...item,
        key: leafKey,
        isLeaf: true
      };
    });

    const convertToArray = (obj: any): any[] => {
      return Object.values(obj).map((node: any) => {
        if (node.children) {
          node.children = convertToArray(node.children);
          if (node.children.length === 0) delete node.children;
        }
        return node;
      });
    };

    return convertToArray(root);
  };

  const searchInTree = (nodes: any[], text: string): any[] => {
    return nodes.reduce((acc, node) => {
      const match = node.title.toLowerCase().includes(text.toLowerCase());
      if (node.children) {
        const filteredChildren = searchInTree(node.children, text);
        if (filteredChildren.length > 0 || match) {
          acc.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : undefined });
        }
      } else if (match) {
        acc.push(node);
      }
      return acc;
    }, [] as any[]);
  };

  const filteredData = searchText ? searchInTree(data, searchText) : data;

  const columns = [
    {
      title: 'Account Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <span style={{ fontWeight: record.isGroup ? 'bold' : 'normal', color: record.isGroup ? '#16a34a' : 'inherit' }}>
          {text}
        </span>
      )
    },
    {
      title: 'Opening Balance',
      dataIndex: 'priBal',
      key: 'priBal',
      align: 'right' as const,
      width: 150,
      render: (val: number) => (
        <Text type={val >= 0 ? undefined : 'danger'}>
          {Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2 })} {val >= 0 ? 'Dr' : 'Cr'}
        </Text>
      )
    },
    {
      title: 'Debit (Period)',
      dataIndex: 'dr',
      key: 'dr',
      align: 'right' as const,
      width: 130,
      render: (val: number) => val !== 0 ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
    },
    {
      title: 'Credit (Period)',
      dataIndex: 'cr',
      key: 'cr',
      align: 'right' as const,
      width: 130,
      render: (val: number) => val !== 0 ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
    },
    {
      title: 'Closing Balance',
      dataIndex: 'curBal',
      key: 'curBal',
      align: 'right' as const,
      width: 150,
      render: (val: number) => (
        <Text strong type={val >= 0 ? 'success' : 'danger'}>
          {Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2 })} {val >= 0 ? 'Dr' : 'Cr'}
        </Text>
      )
    }
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <style>{`
        .ant-table-row-level-0 { background-color: #f9fafb; }
        .ant-table-row-level-1 { background-color: #ffffff; }
        @media print {
          .no-print { display: none !important; }
          .ant-card { border: none !important; box-shadow: none !important; }
          .ant-table { font-size: 10pt !important; }
        }
      `}</style>
      <div className="flex justify-between items-center mb-6 no-print">
        <Space align="center">
          <BarChartOutlined style={{ fontSize: 24, color: '#16a34a' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Trial Balance Report</Title>
            <Text type="secondary">Hierarchical view of Chart of Accounts with balances and movements</Text>
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
          dateRange: [dayjs().startOf('year'), dayjs()]
        }}
      >
        <Form.Item name="dateRange" label="Date Range" rules={[{ required: true }]}>
          <DatePicker.RangePicker format="DD-MMM-YYYY" presets={rangePresets} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading} style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}>
            Show Report
          </Button>
        </Form.Item>
        {data.length > 0 && (
          <Form.Item style={{ marginLeft: 'auto', marginRight: 0 }}>
            <Input 
              placeholder="Search accounts..." 
              prefix={<SearchOutlined />} 
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
          </Form.Item>
        )}
      </Form>

      {data.length > 0 && (
        <div id="printable-report">
          <div className="text-center mb-6 print-only">
            <Title level={3}>Trial Balance Report (Hierarchical)</Title>
            <Space split={<Divider type="vertical" />}>
              <span><CalendarOutlined /> {form.getFieldValue('dateRange')[0].format('DD-MMM-YYYY')} to {form.getFieldValue('dateRange')[1].format('DD-MMM-YYYY')}</span>
            </Space>
          </div>

          <Table
            dataSource={filteredData}
            columns={columns}
            pagination={false}
            loading={loading}
            rowKey="key"
            bordered
            size="small"
            expandable={{
              defaultExpandAllRows: true,
              expandedRowKeys: undefined, // Let AntD handle it via defaultExpandAllRows
            }}
            summary={pageData => {
              // Calculate grand total from top level nodes only
              let totalOpening = 0;
              let totalDr = 0;
              let totalCr = 0;
              let totalClosing = 0;

              pageData.forEach(node => {
                totalOpening += node.priBal;
                totalDr += node.dr;
                totalCr += node.cr;
                totalClosing += node.curBal;
              });

              return (
                <Table.Summary fixed>
                  <Table.Summary.Row className="bg-gray-100 font-bold">
                    <Table.Summary.Cell index={0} align="right">Report Totals</Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text type={totalOpening >= 0 ? undefined : 'danger'}>
                        {Math.abs(totalOpening).toLocaleString(undefined, { minimumFractionDigits: 2 })} {totalOpening >= 0 ? 'Dr' : 'Cr'}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">{totalDr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">{totalCr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text type={totalClosing >= 0 ? 'success' : 'danger'}>
                        {Math.abs(totalClosing).toLocaleString(undefined, { minimumFractionDigits: 2 })} {totalClosing >= 0 ? 'Dr' : 'Cr'}
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
