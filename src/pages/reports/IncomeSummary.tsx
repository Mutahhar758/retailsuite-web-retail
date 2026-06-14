import React, { useState } from 'react';
import {
  Card, Typography, Form, DatePicker, Button,
  Table, Space, message, Divider
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, RiseOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type IncomeSummaryLine } from '../../services/reportService';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;

export const IncomeSummary: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IncomeSummaryLine[]>([]);

  const handleSearch = async (values: any) => {
    setLoading(true);
    try {
      const filter = {
        fromDate: values.dateRange[0].format('YYYY-MM-DD'),
        toDate: values.dateRange[1].format('YYYY-MM-DD')
      };
      const res = await reportService.getIncomeSummary(filter);
      setData(res);
    } catch (error) {
      message.error('Failed to load income summary');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Type',
      dataIndex: 'vType',
      key: 'vType',
      onCell: (record: IncomeSummaryLine, index: number | undefined) => {
        if (index === undefined) return {};
        const prev = data[index - 1];
        if (prev && prev.vType === record.vType) {
          return { rowSpan: 0 };
        }
        let count = 1;
        for (let i = index + 1; i < data.length; i++) {
          if (data[i].vType === record.vType) count++;
          else break;
        }
        return { rowSpan: count };
      },
      render: (text: string) => <Text strong color="#16a34a">{text}</Text>
    },
    {
      title: 'Particulars',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Debit',
      dataIndex: 'dr',
      key: 'dr',
      align: 'right' as const,
      render: (val: number) => val !== 0 ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
    },
    {
      title: 'Credit',
      dataIndex: 'cr',
      key: 'cr',
      align: 'right' as const,
      render: (val: number) => val !== 0 ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
    },
    {
      title: 'Net Amount',
      dataIndex: 'bal',
      key: 'bal',
      align: 'right' as const,
      render: (val: number) => (
        <Text strong type={val <= 0 ? 'success' : 'danger'}>
          {Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2 })} {val <= 0 ? 'Cr' : 'Dr'}
        </Text>
      )
    }
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6 no-print">
        <Space align="center">
          <RiseOutlined style={{ fontSize: 24, color: '#16a34a' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Income Summary (P&L)</Title>
            <Text type="secondary">Profit and loss statement for the selected period</Text>
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
        <Form.Item>
          <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading} style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}>
            Show Report
          </Button>
        </Form.Item>
      </Form>

      {data.length > 0 && (
        <div id="printable-report">
          <div className="text-center mb-6">
            <Title level={3}>Income Summary</Title>
            <Space split={<Divider type="vertical" />}>
              <span><CalendarOutlined /> {form.getFieldValue('dateRange')[0].format('DD-MMM-YYYY')} to {form.getFieldValue('dateRange')[1].format('DD-MMM-YYYY')}</span>
            </Space>
          </div>

          <Table
            dataSource={data}
            columns={columns}
            pagination={false}
            loading={loading}
            rowKey={(record, index) => `${record.vType}-${record.title}-${index}`}
            bordered
            size="middle"
            summary={pageData => {
                const netProfit = pageData.reduce((acc, row) => acc + row.bal, 0);
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row className="bg-gray-100 font-bold">
                      <Table.Summary.Cell index={0} colSpan={4} align="right">Net Profit / (Loss)</Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <Text type={netProfit <= 0 ? 'success' : 'danger'} style={{ fontSize: '1.2em' }}>
                          Rs. {Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })} {netProfit <= 0 ? 'Credit' : 'Debit'}
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
