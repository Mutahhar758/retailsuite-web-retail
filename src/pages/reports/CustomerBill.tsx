import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Space, message, Divider, Checkbox, Radio, Input, Row, Col
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type CustomerBillResponse } from '../../services/reportService';
import api from '../../services/api';
import { rangePresets } from '../../utils/datePresets';
import { printDirect, centerLine, padLine, divider, type ConnectionMethod } from '../../hooks/useThermalPrinter';
import { useAppStore } from '../../stores/useAppStore';
import { supplyOrderService, type SupplyOrder } from '../../services/supplyOrderService';

const { Title, Text } = Typography;

export const CustomerBill: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<{ account: string; title: string }[]>([]);
  const [billData, setBillData] = useState<CustomerBillResponse | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{ account: string; title: string } | null>(null);

  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrgName = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier)?.name || 'Retail Store';

  // Printer Configuration States
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
  const [openDrawer] = useState<boolean>(false);
  const [cutPaper] = useState<boolean>(() => {
    const saved = localStorage.getItem('pos_printer_cut_paper');
    return saved !== null ? saved === 'true' : true;
  });

  const [singlePrinting, setSinglePrinting] = useState(false);
  const [bulkPrinting, setBulkPrinting] = useState(false);
  const [printMode, setPrintMode] = useState<'single' | 'multi'>('single');
  const [selectedCustomerAccounts, setSelectedCustomerAccounts] = useState<string[]>([]);
  const [searchCustomerListQuery, setSearchCustomerListQuery] = useState('');
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>([]);
  const [selectedSupplyOrderId, setSelectedSupplyOrderId] = useState<number | null>(null);

  useEffect(() => {
    api.get('/api/customers').then(res => {
      setCustomers(res.data.body);
    });
    supplyOrderService.getList().then(setSupplyOrders).catch(console.error);
  }, []);

  const handleSupplyOrderSelect = async (orderId: number) => {
    setSelectedSupplyOrderId(orderId);
    setLoading(true);
    try {
      const order = await supplyOrderService.getById(orderId);
      if (order && order.details) {
        const customerIds = order.details.map(d => d.customerId);
        // Only keep those present in the current customer list
        // Note: customers state must be populated before we can correctly filter
        const validCustomerIds = customerIds.filter(id => customers.some(c => c.account === id));
        setSelectedCustomerAccounts(validCustomerIds);
      }
    } catch (err) {
      message.error('Failed to load supply order profile');
    } finally {
      setLoading(false);
    }
  };



  const generateBillReceiptLines = (customerTitle: string, customerAccount: string, data: CustomerBillResponse): string[] => {
    const width = 48;
    const lines: string[] = [];

    const format6Columns = (c1: string, c2: string, c3: string, c4: string, c5: string, c6: string): string => {
      const w1 = 5;
      const w2 = 10;
      const w3 = 9;
      const w4 = 3;
      const w5 = 7;
      const w6 = 9;

      let val1 = c1.trim().substring(0, w1).padEnd(w1, ' ');
      let val2 = c2.trim().substring(0, w2).padEnd(w2, ' ');
      let val3 = c3.trim().substring(0, w3).padEnd(w3, ' ');
      let val4 = c4.trim().substring(0, w4).padStart(w4, ' ');
      let val5 = c5.trim().substring(0, w5).padStart(w5, ' ');
      let val6 = c6.trim().substring(0, w6).padStart(w6, ' ');

      return `${val1} ${val2} ${val3} ${val4} ${val5} ${val6}`;
    };

    // Header
    const escBoldOn = '\x1b!\x08\x1bE\x01\x1bE1';
    const escBoldOff = '\x1b!\x00\x1bE\x00\x1bE0';
    lines.push(escBoldOn + centerLine(currentOrgName.toUpperCase(), width) + escBoldOff);
    lines.push(centerLine('CUSTOMER STATEMENT / BILL', width));
    
    const dateRange = form.getFieldValue('dateRange');
    const fromStr = dateRange ? dateRange[0].format('DD-MMM-YYYY') : '';
    const toStr = dateRange ? dateRange[1].format('DD-MMM-YYYY') : '';
    lines.push(centerLine(`Period: ${fromStr} to ${toStr}`, width));
    lines.push(centerLine(`Print Date: ${dayjs().format('DD-MMM-YYYY HH:mm')}`, width));
    lines.push(divider('-', width));

    // Customer
    lines.push(`Customer: ${customerTitle}`);
    lines.push(`Account Code: ${customerAccount}`);
    lines.push(divider('-', width));

    // Table Header
    lines.push(format6Columns('Date', 'Voucher', 'Item', 'Qty', 'Rate', 'Amount'));
    lines.push(divider('-', width));

    // Lines
    let currentBillTotal = 0;
    data.lines.forEach(line => {
      currentBillTotal += line.amount;
      const dateStr = dayjs(line.date).format('DD/MM');
      const qtyStr = line.qty.toString();
      const rateStr = Math.round(line.rate).toString();
      const amountStr = line.amount.toFixed(2);
      lines.push(format6Columns(dateStr, line.vNo, line.item, qtyStr, rateStr, amountStr));
    });
    lines.push(divider('-', width));

    // Totals
    lines.push(padLine('Current Bill Total:', `Rs. ${currentBillTotal.toFixed(2)}`, width));
    lines.push(padLine('Previous Balance:', `Rs. ${Math.abs(data.summary.previousBalance).toFixed(2)} ${data.summary.previousBalance >= 0 ? 'Dr' : 'Cr'}`, width));
    lines.push(padLine('Payments Received:', `Rs. ${data.summary.payment.toFixed(2)}`, width));
    lines.push(divider('=', width));
    lines.push(padLine('Net Balance Due:', `Rs. ${Math.abs(data.summary.balance).toFixed(2)} ${data.summary.balance >= 0 ? 'Dr' : 'Cr'}`, width));
    lines.push(divider('-', width));

    // Signatures
    lines.push('');
    lines.push(padLine('Customer Signature', 'Authorized Signature', width));
    lines.push('');

    // Footer
    lines.push(centerLine('Software Powered by Bizgrip Solutions', width));
    lines.push('');
    lines.push('');
    lines.push('');

    return lines;
  };

  const handleSearch = async (values: any) => {
    setLoading(true);
    try {
      const filter = {
        fromDate: values.dateRange[0].format('YYYY-MM-DD'),
        toDate: values.dateRange[1].format('YYYY-MM-DD'),
        account: values.account
      };
      const res = await reportService.getCustomerBill(filter);
      setBillData(res);
      
      const customer = customers.find(c => c.account === values.account);
      setSelectedCustomer(customer || null);
    } catch (error) {
      message.error('Failed to load customer bill');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSingleThermal = async () => {
    if (!billData || !selectedCustomer) {
      message.error('No bill data loaded to print');
      return;
    }
    setSinglePrinting(true);
    try {
      const lines = generateBillReceiptLines(selectedCustomer.title, selectedCustomer.account, billData);
      await printDirect(lines, connectionMethod, {
        printerName,
        openDrawer,
        cutPaper
      });
      message.success('Print job submitted successfully');
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Printing failed');
    } finally {
      setSinglePrinting(false);
    }
  };

  const handlePrintBulkThermal = async () => {
    const values = form.getFieldsValue();
    if (!values.dateRange) {
      message.error('Please select a date range first');
      return;
    }
    if (selectedCustomerAccounts.length === 0) {
      message.error('Please select at least one customer from the checklist');
      return;
    }

    setBulkPrinting(true);
    let printedCount = 0;
    try {
      const fromDate = values.dateRange[0].format('YYYY-MM-DD');
      const toDate = values.dateRange[1].format('YYYY-MM-DD');

      for (const account of selectedCustomerAccounts) {
        const customer = customers.find(c => c.account === account);
        if (!customer) continue;

        // Fetch statement for this customer
        const res = await reportService.getCustomerBill({
          fromDate,
          toDate,
          account
        });

        // Skip if no activity AND zero net balance AND zero previous balance
        if (res.lines.length === 0 && res.summary.balance === 0 && res.summary.previousBalance === 0) {
          continue;
        }

        // Generate lines
        const lines = generateBillReceiptLines(customer.title, customer.account, res);

        // Print directly
        await printDirect(lines, connectionMethod, {
          printerName,
          openDrawer,
          cutPaper
        });

        printedCount++;
        // 500ms delay to allow spooler to process
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (printedCount === 0) {
        message.info('No statements with activity or balance found for the selected customers.');
      } else {
        message.success(`Multi-printing completed! Printed ${printedCount} statement(s).`);
      }
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Multi-printing failed midway');
    } finally {
      setBulkPrinting(false);
    }
  };


  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6 no-print">
        <Space align="center">
          <FileTextOutlined style={{ fontSize: 24, color: '#16a34a' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Customer Bill Report</Title>
            <Text type="secondary">Generate consolidated billing for a customer</Text>
          </div>
        </Space>
        {printMode === 'single' && (
          <Space className="no-print" size="middle">
            <Button icon={<PrinterOutlined />} disabled={!billData} onClick={() => window.print()}>Print Bill (A4)</Button>
            <Button 
              type="primary"
              icon={<PrinterOutlined />} 
              disabled={!billData} 
              loading={singlePrinting}
              onClick={handlePrintSingleThermal}
              style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
            >
              Print Slip
            </Button>
          </Space>
        )}
      </div>

      <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg no-print">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSearch}
          initialValues={{
            dateRange: [dayjs().startOf('month'), dayjs()]
          }}
        >
          <Form.Item label="Print Mode">
            <Radio.Group value={printMode} onChange={e => setPrintMode(e.target.value)}>
              <Radio.Button value="single">Single Customer Print</Radio.Button>
              <Radio.Button value="multi">Multiple Customers Print</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Row gutter={16} align="bottom">
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="dateRange" label="Date Range" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                <DatePicker.RangePicker format="DD-MMM-YYYY" presets={rangePresets} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            {printMode === 'single' && (
              <>
                <Col xs={24} sm={12} md={10}>
                  <Form.Item name="account" label="Customer" rules={[{ required: printMode === 'single' }]} style={{ marginBottom: 0 }}>
                    <Select 
                      showSearch 
                      placeholder="Select customer..." 
                      optionFilterProp="children"
                      style={{ width: '100%' }}
                    >
                      {customers.map(c => (
                        <Select.Option key={c.account} value={c.account}>{c.title}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={24} md={6}>
                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading} style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', width: '100%' }}>
                      Generate Bill
                    </Button>
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>

          {printMode === 'multi' && (
            <div style={{ marginTop: 16 }}>
              <Form.Item label="Select Customers for Multi Print" required>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, backgroundColor: '#ffffff', width: '100%', maxWidth: 500 }}>
                  
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Select by Supply Order Profile:</Text>
                    <Select
                      allowClear
                      style={{ width: '100%' }}
                      placeholder="Select a supply order profile"
                      value={selectedSupplyOrderId}
                      onChange={val => {
                        if (!val) {
                          setSelectedSupplyOrderId(null);
                          setSelectedCustomerAccounts([]);
                        } else {
                          handleSupplyOrderSelect(val);
                        }
                      }}
                      loading={loading}
                    >
                      {supplyOrders.map(so => (
                        <Select.Option key={so.id} value={so.id}>{so.title}</Select.Option>
                      ))}
                    </Select>
                  </div>
                  <Divider style={{ margin: '12px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Input
                      size="small"
                      placeholder="Filter customers..."
                      value={searchCustomerListQuery}
                      onChange={e => setSearchCustomerListQuery(e.target.value)}
                      style={{ width: '60%' }}
                    />
                    <Checkbox
                      checked={selectedCustomerAccounts.length === customers.length && customers.length > 0}
                      indeterminate={selectedCustomerAccounts.length > 0 && selectedCustomerAccounts.length < customers.length}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedCustomerAccounts(customers.map(c => c.account));
                        } else {
                          setSelectedCustomerAccounts([]);
                        }
                      }}
                    >
                      Select All
                    </Checkbox>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                    {customers
                      .filter(c => 
                        c.title.toLowerCase().includes(searchCustomerListQuery.toLowerCase()) ||
                        c.account.includes(searchCustomerListQuery)
                      )
                      .map(c => (
                        <div key={c.account} style={{ padding: '4px 0' }}>
                          <Checkbox
                            checked={selectedCustomerAccounts.includes(c.account)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedCustomerAccounts(prev => [...prev, c.account]);
                              } else {
                                setSelectedCustomerAccounts(prev => prev.filter(acc => acc !== c.account));
                              }
                            }}
                          >
                            {c.title} <span style={{ fontSize: 10, color: '#8c8c8c' }}>({c.account})</span>
                          </Checkbox>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button 
                  type="primary" 
                  icon={<PrinterOutlined />} 
                  loading={bulkPrinting} 
                  onClick={handlePrintBulkThermal} 
                  style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                >
                  Print Selected Slips
                </Button>
              </Form.Item>
            </div>
          )}

          <Divider style={{ margin: '20px 0' }} />
        </Form>
      </div>

      {billData && printMode === 'single' && (
        <div 
          id="printable-report" 
          style={{ 
            border: '1px solid #e8e8e8', 
            borderRadius: 8, 
            padding: 24, 
            textAlign: 'left', 
            backgroundColor: '#ffffff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            fontFamily: 'monospace',
            fontSize: 11,
            lineHeight: 1.4,
            color: '#000000',
            maxWidth: 420,
            margin: '24px auto'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 16, color: '#000000' }}>{currentOrgName.toUpperCase()}</h2>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700 }}>CUSTOMER STATEMENT / BILL</p>
            <p style={{ margin: '4px 0 0', fontSize: 9 }}>
              Period: {form.getFieldValue('dateRange')[0].format('DD-MMM-YYYY')} to {form.getFieldValue('dateRange')[1].format('DD-MMM-YYYY')}
            </p>
            <p style={{ margin: 0, fontSize: 9 }}>
              Print Date: {dayjs().format('DD-MMM-YYYY HH:mm')}
            </p>
          </div>

          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '8px 0', margin: '12px 0' }}>
            <div><strong>Customer:</strong> {selectedCustomer?.title}</div>
            <div><strong>Account Code:</strong> {selectedCustomer?.account}</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Voucher</th>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
                <th style={{ textAlign: 'center', padding: '4px 0' }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>Rate</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {billData.lines.map((line, idx) => (
                <tr key={`${line.vNo}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ textAlign: 'left', padding: '4px 0' }}>{dayjs(line.date).format('DD-MMM')}</td>
                  <td style={{ textAlign: 'left', padding: '4px 0' }}>{line.vNo}</td>
                  <td style={{ textAlign: 'left', padding: '4px 0' }}>{line.item}</td>
                  <td style={{ textAlign: 'center', padding: '4px 0' }}>{line.qty}</td>
                  <td style={{ textAlign: 'right', padding: '4px 0' }}>{Math.round(line.rate)}</td>
                  <td style={{ textAlign: 'right', padding: '4px 0' }}>{line.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #000', paddingTop: 8, fontSize: 10 }}>
            {/* Current Bill Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>Current Bill Total:</span>
              <strong>
                Rs. {billData.lines.reduce((sum, row) => sum + row.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </strong>
            </div>

            {/* Previous Balance */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>Previous Balance:</span>
              <strong>
                Rs. {Math.abs(billData.summary.previousBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {billData.summary.previousBalance >= 0 ? 'Dr' : 'Cr'}
              </strong>
            </div>

            {/* Payments Received */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>Payments Received:</span>
              <strong>
                Rs. {billData.summary.payment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </strong>
            </div>

            {/* Net Balance Due */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px double #000', paddingTop: 6, marginTop: 4, fontSize: 12 }}>
              <strong>Net Balance Due:</strong>
              <strong>
                Rs. {Math.abs(billData.summary.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {billData.summary.balance >= 0 ? 'Dr' : 'Cr'}
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 16 }}>
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: 4, fontSize: 9 }}>Customer Sig</div>
            </div>
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: 4, fontSize: 9 }}>Authorized Sig</div>
            </div>
          </div>
          
          <div style={{ borderTop: '1px dashed #000', paddingTop: 8, marginTop: 16, textAlign: 'center', fontSize: 9, color: '#666666' }}>
            Software Powered by Bizgrip Solutions
          </div>
        </div>
      )}
    </Card>
  );
};
