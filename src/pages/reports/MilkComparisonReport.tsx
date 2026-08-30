import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Table, Space, message, Divider, Row, Col, Statistic, Tag
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, SwapOutlined,
  CalendarOutlined, ArrowUpOutlined, ArrowDownOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  reportService,
  type PurchaseSupplyComparisonResponse,
  type PurchaseSupplyComparisonLine
} from '../../services/reportService';
import { inventoryService, type Item } from '../../services/inventoryService';
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

export const MilkComparisonReport: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [reportData, setReportData] = useState<PurchaseSupplyComparisonResponse | null>(null);
  const [thermalPrinting, setThermalPrinting] = useState(false);

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

  // Load items lookup
  useEffect(() => {
    inventoryService.getItemsLookup().then(res => {
      setItems(res || []);
      // Auto-select item containing "Milk" / "Dodh" / "دودھ" if found
      const milkItem = res?.find(i => 
        i.title.toLowerCase().includes('milk') || 
        i.title.toLowerCase().includes('dodh') || 
        i.title.includes('دودھ') ||
        i.title.toLowerCase().includes('doodh')
      );
      if (milkItem) {
        form.setFieldValue('itemId', milkItem.id);
      } else if (res && res.length > 0) {
        form.setFieldValue('itemId', res[0].id);
      }
    }).catch(console.error);
  }, [form]);

  // Set default date range (1st of current month to current date, or 1st to 10th)
  useEffect(() => {
    const startOfMonth = dayjs().startOf('month');
    const today = dayjs();
    form.setFieldsValue({
      dateRange: [startOfMonth, today]
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
      itemId: form.getFieldValue('itemId')
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
      const itemId = fValues.itemId;

      const res = await reportService.getPurchaseSupplyComparison({
        fromDate,
        toDate,
        itemId
      });
      setReportData(res);
    } catch (error) {
      console.error(error);
      message.error('Failed to load purchase vs supply comparison data');
    } finally {
      setLoading(false);
    }
  };

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
      const width = 42;

      const lines: string[] = [];
      lines.push(ESC_ALIGN_CENTER + ESC_DOUBLE_ON + currentOrgName.toUpperCase());
      lines.push(ESC_DOUBLE_OFF + 'MILK PURCHASE VS SUPPLY REPORT');
      lines.push(`Item: ${reportData.itemTitle}`);
      lines.push(`Period: ${fromStr} to ${toStr}`);
      lines.push(`Printed: ${dayjs().format('DD-MMM-YYYY HH:mm')}`);
      lines.push(ESC_ALIGN_LEFT + divider('-', width));

      // Table Header
      const uLabel = unitSuffix ? `(${unitSuffix})` : '';
      lines.push(`Date     Purch${uLabel}   Sale${uLabel}   Diff${uLabel}`);
      lines.push(divider('-', width));

      reportData.lines.forEach(line => {
        const dStr = dayjs(line.date).format('DD/MM');
        const pStr = (line.purchaseQty > 0 ? line.purchaseQty.toLocaleString() : '-').padStart(10, ' ');
        const sStr = (line.totalDispatchedQty > 0 ? line.totalDispatchedQty.toLocaleString() : '-').padStart(11, ' ');
        const diffSign = line.netDiffQty > 0 ? `+${line.netDiffQty.toLocaleString()}` : `${line.netDiffQty.toLocaleString()}`;
        const diffStr = (line.purchaseQty === 0 && line.totalDispatchedQty === 0 ? '-' : diffSign).padStart(11, ' ');
        lines.push(`${dStr} ${pStr} ${sStr} ${diffStr}`);
      });

      lines.push(divider('=', width));
      lines.push(ESC_BOLD_ON);
      lines.push(padLine('Total Purchase Qty:', `${reportData.summary.totalPurchaseQty.toLocaleString()}${unitSuffix ? ` ${unitSuffix}` : ''}`, width));
      lines.push(padLine('Total Sale Qty:', `${reportData.summary.totalDispatchedQty.toLocaleString()}${unitSuffix ? ` ${unitSuffix}` : ''}`, width));
      lines.push(padLine('Net Difference:', `${reportData.summary.totalNetDiffQty > 0 ? '+' : ''}${reportData.summary.totalNetDiffQty.toLocaleString()}${unitSuffix ? ` ${unitSuffix}` : ''}`, width));
      lines.push(padLine('Total Purchase Cost:', `Rs. ${reportData.summary.totalPurchaseAmount.toLocaleString()}`, width));
      lines.push(padLine('Total Sale Revenue:', `Rs. ${(reportData.summary.totalSupplyAmount + reportData.summary.totalRegularSaleAmount).toLocaleString()}`, width));
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

  const selectedItem = items.find(i => i.id === form.getFieldValue('itemId'));
  const unitSuffix = reportData?.unitTitle || selectedItem?.primaryUnit || selectedItem?.defaultUnit || '';

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 150,
      render: (date: string, record: PurchaseSupplyComparisonLine) => (
        <div>
          <div className="font-semibold text-gray-800 dark:text-gray-100">
            {dayjs(date).format('DD-MMM-YYYY')}
          </div>
          <div className="text-xs text-gray-400">
            {record.dayName}
          </div>
        </div>
      )
    },
    {
      title: 'Purchase',
      dataIndex: 'purchaseQty',
      key: 'purchase',
      align: 'right' as const,
      width: 200,
      render: (val: number, record: PurchaseSupplyComparisonLine) => (
        <div className="text-right">
          <div className="font-bold text-base text-blue-600 dark:text-blue-400">
            {val > 0 ? `${val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}${unitSuffix ? ` ${unitSuffix}` : ''}` : '-'}
          </div>
          {val > 0 && (
            <div className="text-xs text-gray-500">
              Rs. {record.purchaseAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              {record.purchaseAvgRate > 0 ? ` (@ ${record.purchaseAvgRate.toFixed(1)})` : ''}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Sale',
      dataIndex: 'totalDispatchedQty',
      key: 'sale',
      align: 'right' as const,
      width: 220,
      render: (val: number, record: PurchaseSupplyComparisonLine) => {
        const totalSaleAmount = record.supplyAmount + record.regularSaleAmount;
        return (
          <div className="text-right">
            <div className="font-bold text-base text-emerald-600 dark:text-emerald-400">
              {val > 0 ? `${val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}${unitSuffix ? ` ${unitSuffix}` : ''}` : '-'}
            </div>
            {val > 0 && (
              <div className="text-xs text-gray-500">
                <span>Rs. {totalSaleAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                {record.supplyQty > 0 && record.regularSaleQty > 0 && (
                  <span className="text-gray-400 ml-1">
                    (Supply: {record.supplyQty} | Counter: {record.regularSaleQty})
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Difference',
      dataIndex: 'netDiffQty',
      key: 'difference',
      align: 'right' as const,
      width: 200,
      render: (diff: number, record: PurchaseSupplyComparisonLine) => {
        if (record.purchaseQty === 0 && record.totalDispatchedQty === 0) {
          return <span className="text-gray-300">-</span>;
        }

        const marginDiff = (record.supplyAmount + record.regularSaleAmount) - record.purchaseAmount;

        if (diff === 0) {
          return (
            <div className="text-right">
              <Tag color="success" icon={<CheckCircleOutlined />} className="text-sm px-2 py-0.5">
                0 (Balanced)
              </Tag>
              {marginDiff !== 0 && (
                <div className="text-xs text-gray-500 mt-0.5">
                  Margin: Rs. {marginDiff > 0 ? `+${marginDiff.toLocaleString()}` : marginDiff.toLocaleString()}
                </div>
              )}
            </div>
          );
        }

        if (diff > 0) {
          return (
            <div className="text-right">
              <Tag color="blue" icon={<ArrowUpOutlined />} className="text-sm px-2 py-0.5">
                +{diff.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}{unitSuffix ? ` ${unitSuffix}` : ''} (Surplus)
              </Tag>
              <div className="text-xs text-gray-500 mt-0.5">
                Margin: Rs. {marginDiff > 0 ? `+${marginDiff.toLocaleString()}` : marginDiff.toLocaleString()}
              </div>
            </div>
          );
        }

        return (
          <div className="text-right">
            <Tag color="error" icon={<ArrowDownOutlined />} className="text-sm px-2 py-0.5">
              {diff.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}{unitSuffix ? ` ${unitSuffix}` : ''} (Shortage)
            </Tag>
            <div className="text-xs text-gray-500 mt-0.5">
              Margin: Rs. {marginDiff > 0 ? `+${marginDiff.toLocaleString()}` : marginDiff.toLocaleString()}
            </div>
          </div>
        );
      }
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
            font-size: 10pt !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 no-print gap-4">
        <Space align="center">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
            <SwapOutlined style={{ fontSize: 24 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Milk Purchase vs Sale Comparison
            </Title>
            <Text type="secondary">
              Date-wise comparative analysis between milk purchasing and sales/distribution
            </Text>
          </div>
        </Space>

        <Space>
          <Button
            icon={<PrinterOutlined />}
            disabled={!reportData || reportData.lines.length === 0}
            onClick={() => window.print()}
          >
            Print A4 Report
          </Button>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            loading={thermalPrinting}
            disabled={!reportData || reportData.lines.length === 0}
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
            <Col xs={24} md={10} lg={8}>
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

            <Col xs={24} md={8} lg={8}>
              <Form.Item
                name="itemId"
                label="Item"
                style={{ marginBottom: 0 }}
              >
                <Select
                  showSearch
                  placeholder="Select Item (e.g. Milk / Dodh)"
                  optionFilterProp="children"
                  allowClear
                >
                  {items.map(item => (
                    <Select.Option key={item.id} value={item.id}>
                      {item.title}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={6} lg={8}>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                htmlType="submit"
                loading={loading}
                style={{ backgroundColor: '#2563eb', borderColor: '#2563eb' }}
              >
                Show Comparison
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
            <Col xs={24} sm={12} lg={6}>
              <Card size="small" className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 rounded-lg">
                <Statistic
                  title={<span className="text-blue-700 dark:text-blue-300 font-medium">Total Milk Purchased</span>}
                  value={reportData.summary.totalPurchaseQty}
                  precision={1}
                  suffix={unitSuffix ? ` ${unitSuffix}` : ''}
                  valueStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                />
                <div className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span>Cost: Rs. {reportData.summary.totalPurchaseAmount.toLocaleString()}</span>
                  <span>Avg: Rs. {reportData.summary.avgPurchaseRate.toFixed(1)}</span>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card size="small" className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 rounded-lg">
                <Statistic
                  title={<span className="text-emerald-700 dark:text-emerald-300 font-medium">Total Milk Sold</span>}
                  value={reportData.summary.totalDispatchedQty}
                  precision={1}
                  suffix={unitSuffix ? ` ${unitSuffix}` : ''}
                  valueStyle={{ color: '#059669', fontWeight: 'bold' }}
                />
                <div className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span>Revenue: Rs. {(reportData.summary.totalSupplyAmount + reportData.summary.totalRegularSaleAmount).toLocaleString()}</span>
                  <span>Avg: Rs. {reportData.summary.avgSupplyRate.toFixed(1)}</span>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card 
                size="small" 
                className={`border rounded-lg ${
                  reportData.summary.totalNetDiffQty === 0 
                    ? 'bg-gray-50/50 border-gray-200' 
                    : reportData.summary.totalNetDiffQty > 0 
                      ? 'bg-blue-50/50 border-blue-200' 
                      : 'bg-red-50/50 border-red-200'
                }`}
              >
                <Statistic
                  title={<span className="font-medium">Net Difference</span>}
                  value={Math.abs(reportData.summary.totalNetDiffQty)}
                  precision={1}
                  prefix={reportData.summary.totalNetDiffQty > 0 ? '+' : reportData.summary.totalNetDiffQty < 0 ? '-' : ''}
                  suffix={unitSuffix ? ` ${unitSuffix}` : ''}
                  valueStyle={{ 
                    color: reportData.summary.totalNetDiffQty === 0 ? '#10b981' : reportData.summary.totalNetDiffQty > 0 ? '#2563eb' : '#ef4444', 
                    fontWeight: 'bold' 
                  }}
                />
                <div className="text-xs font-semibold mt-1">
                  {reportData.summary.totalNetDiffQty === 0 && <span className="text-emerald-600">Purchase = Sale (Balanced)</span>}
                  {reportData.summary.totalNetDiffQty > 0 && <span className="text-blue-600">Surplus ({reportData.summary.totalNetDiffQty.toFixed(1)}{unitSuffix ? ` ${unitSuffix}` : ''})</span>}
                  {reportData.summary.totalNetDiffQty < 0 && <span className="text-red-600">Shortage ({Math.abs(reportData.summary.totalNetDiffQty).toFixed(1)}{unitSuffix ? ` ${unitSuffix}` : ''})</span>}
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card size="small" className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 rounded-lg">
                <Statistic
                  title={<span className="text-purple-700 dark:text-purple-300 font-medium">Margin Difference</span>}
                  value={reportData.summary.totalDiffAmount}
                  precision={0}
                  prefix="Rs. "
                  valueStyle={{ color: '#7c3aed', fontWeight: 'bold' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Sale Revenue - Purchase Cost
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {/* Main Table / Printable Report */}
      {reportData && (
        <div id="printable-report">
          {/* Printable Report Header */}
          <div className="text-center mb-6">
            <Title level={3} style={{ margin: 0 }}>
              {currentOrgName.toUpperCase()}
            </Title>
            <Title level={4} style={{ margin: '4px 0 0', color: '#2563eb' }}>
              MILK PURCHASE VS SALE COMPARISON REPORT
            </Title>
            <div className="text-sm font-semibold text-gray-700 mt-1">
              Item: {reportData.itemTitle} {unitSuffix ? `(Unit: ${unitSuffix})` : ''}
            </div>
            <Space split={<Divider type="vertical" />} className="text-xs text-gray-500 mt-1">
              <span>
                <CalendarOutlined /> Period: {form.getFieldValue('dateRange')?.[0]?.format('DD-MMM-YYYY')} to {form.getFieldValue('dateRange')?.[1]?.format('DD-MMM-YYYY')}
              </span>
              <span>
                Print Date: {dayjs().format('DD-MMM-YYYY HH:mm')}
              </span>
            </Space>
          </div>

          <Table
            dataSource={reportData.lines}
            columns={columns}
            pagination={false}
            loading={loading}
            rowKey="date"
            bordered
            size="middle"
            summary={() => {
              const summary = reportData.summary;
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row className="bg-gray-100 dark:bg-gray-800 font-bold">
                    <Table.Summary.Cell index={0} align="left">
                      Total
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <div className="font-bold text-base text-blue-600 dark:text-blue-400">
                        {summary.totalPurchaseQty.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}{unitSuffix ? ` ${unitSuffix}` : ''}
                      </div>
                      <div className="text-xs text-gray-500 font-normal">
                        Rs. {summary.totalPurchaseAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        {summary.avgPurchaseRate > 0 ? ` (@ ${summary.avgPurchaseRate.toFixed(1)})` : ''}
                      </div>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <div className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                        {summary.totalDispatchedQty.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}{unitSuffix ? ` ${unitSuffix}` : ''}
                      </div>
                      <div className="text-xs text-gray-500 font-normal">
                        Rs. {(summary.totalSupplyAmount + summary.totalRegularSaleAmount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <div className={`font-bold text-base ${summary.totalNetDiffQty >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {summary.totalNetDiffQty > 0 ? `+${summary.totalNetDiffQty.toFixed(1)}` : summary.totalNetDiffQty.toFixed(1)}{unitSuffix ? ` ${unitSuffix}` : ''}
                      </div>
                      <div className="text-xs text-gray-500 font-normal">
                        Margin: Rs. {((summary.totalSupplyAmount + summary.totalRegularSaleAmount) - summary.totalPurchaseAmount) > 0 ? '+' : ''}{((summary.totalSupplyAmount + summary.totalRegularSaleAmount) - summary.totalPurchaseAmount).toLocaleString()}
                      </div>
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
