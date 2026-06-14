import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Select, Typography, Space, message, Badge, Alert, Row, Col } from 'antd';
import { PrinterOutlined, ReloadOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useThermalPrinter, type ConnectionMethod } from '../../hooks/useThermalPrinter';

const { Title, Text } = Typography;

export const PrinterSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [relayOnline, setRelayOnline] = useState<boolean | null>(null);

  // Load configuration states
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>(() => {
    return (localStorage.getItem('pos_printer_method') as ConnectionMethod) || 'LOCAL_RELAY';
  });
  const [printerName, setPrinterName] = useState<string>(() => {
    return localStorage.getItem('pos_printer_name') || 'XP-80';
  });

  // Fetch printers from the hook
  const { fetchAvailablePrinters, availablePrinters, loading: loadingPrinters } = useThermalPrinter([], connectionMethod, {
    printerName
  });

  // Check Local Relay service health status
  const checkRelayStatus = async () => {
    try {
      const response = await fetch('http://localhost:5000/printers');
      if (response.ok) {
        setRelayOnline(true);
        await fetchAvailablePrinters();
      } else {
        setRelayOnline(false);
      }
    } catch (err) {
      setRelayOnline(false);
    }
  };

  useEffect(() => {
    if (connectionMethod === 'LOCAL_RELAY') {
      checkRelayStatus();
    } else {
      setRelayOnline(null); // Not applicable for WebUSB
    }
  }, [connectionMethod]);

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      localStorage.setItem('pos_printer_method', values.connectionMethod);
      localStorage.setItem('pos_printer_name', values.printerName || 'XP-80');
      
      setConnectionMethod(values.connectionMethod);
      if (values.printerName) {
        setPrinterName(values.printerName);
      }
      
      message.success('Printer configuration saved successfully');
    } catch (error) {
      message.error('Failed to save printer configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 650, margin: '0 auto' }}>
      <Card className="shadow-sm border-gray-100 rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <Space align="center">
            <PrinterOutlined style={{ fontSize: 24, color: '#1677ff' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>Printer Configuration</Title>
              <Text type="secondary">Manage global receipt and statement printing settings</Text>
            </div>
          </Space>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            connectionMethod,
            printerName
          }}
        >
          <Form.Item
            name="connectionMethod"
            label="Connection Method"
            rules={[{ required: true, message: 'Please select a connection method' }]}
            extra="WebUSB is recommended for ChromeOS, while Local Relay is used for Windows / macOS / Linux environments."
          >
            <Select 
              onChange={(value: ConnectionMethod) => {
                setConnectionMethod(value);
                if (value === 'WEB_USB') {
                  form.setFieldValue('printerName', '');
                } else {
                  form.setFieldValue('printerName', 'XP-80');
                }
              }}
            >
              <Select.Option value="LOCAL_RELAY">Local Relay (Windows Helper Service)</Select.Option>
              <Select.Option value="WEB_USB">WebUSB (Browser Direct USB)</Select.Option>
            </Select>
          </Form.Item>

          {connectionMethod === 'LOCAL_RELAY' && (
            <Card 
              size="small" 
              style={{ 
                backgroundColor: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: 8, 
                marginBottom: 24 
              }}
            >
              <Row gutter={16} align="middle">
                <Col span={24} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>Local Service Status</span>
                    {relayOnline === true ? (
                      <Badge status="success" text="Local Relay Online" />
                    ) : relayOnline === false ? (
                      <Badge status="error" text="Local Relay Offline" />
                    ) : (
                      <Badge status="default" text="Checking status..." />
                    )}
                  </div>
                </Col>

                {relayOnline === false && (
                  <Col span={24} style={{ marginBottom: 12 }}>
                    <Alert
                      type="warning"
                      showIcon
                      icon={<InfoCircleOutlined />}
                      message="Printer Bridge Offline"
                      description="Please make sure your PrinterBridge service is running at http://localhost:5000 on this system."
                      style={{ fontSize: 12 }}
                    />
                  </Col>
                )}

                <Col xs={24} sm={18}>
                  <Form.Item
                    name="printerName"
                    label="Printer Name"
                    rules={[{ required: true, message: 'Please select a printer name' }]}
                    extra="Select a printer from the auto-detected list."
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      allowClear
                      showSearch
                      placeholder="Select printer name..."
                      options={[
                        ...(printerName && !availablePrinters.includes(printerName) ? [{ label: printerName, value: printerName }] : []),
                        ...availablePrinters.map(p => ({ label: p, value: p }))
                      ]}
                      filterOption={(input, option) =>
                        (option?.label ?? '').toString().toUpperCase().includes(input.toUpperCase())
                      }
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={6} style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 30 }}>
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={checkRelayStatus}
                    loading={loadingPrinters}
                    block
                  >
                    Refresh
                  </Button>
                </Col>
              </Row>
            </Card>
          )}

          {connectionMethod === 'WEB_USB' && (
            <Alert
              type="info"
              showIcon
              message="WebUSB direct printing"
              description="WebUSB doesn't require a background service. When you print, the browser will prompt you to select the connected USB printer directly."
              style={{ marginBottom: 24 }}
            />
          )}

          <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              icon={<CheckCircleOutlined />}
              loading={saving}
              block
              style={{ height: 40, borderRadius: 8, fontWeight: 600 }}
            >
              Save Configuration
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
