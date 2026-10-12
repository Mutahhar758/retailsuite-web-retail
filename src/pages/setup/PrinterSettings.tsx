import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Select, Typography, Space, message, Badge, Alert, Row, Col } from 'antd';
import { 
  PrinterOutlined, 
  ReloadOutlined, 
  CheckCircleOutlined, 
  InfoCircleOutlined, 
  DownloadOutlined, 
  CloudSyncOutlined, 
  CopyOutlined 
} from '@ant-design/icons';
import { useThermalPrinter, type ConnectionMethod } from '../../hooks/useThermalPrinter';

const { Title, Text } = Typography;

export const PrinterSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [relayOnline, setRelayOnline] = useState<boolean | null>(null);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [latestVersionInfo, setLatestVersionInfo] = useState<{ version: string; releaseNotes?: string; downloadUrl?: string } | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);

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

  // Check Local Relay service health status and versions
  const checkRelayStatus = async () => {
    try {
      // 1. Fetch latest version metadata from web server
      try {
        const vRes = await fetch('/downloads/version.json');
        if (vRes.ok) {
          const vData = await vRes.json();
          setLatestVersionInfo(vData);
        }
      } catch {
        setLatestVersionInfo({ version: '1.1.0', downloadUrl: '/downloads/printer-bridge.exe' });
      }

      // 2. Ping local bridge for printers
      const response = await fetch('http://localhost:5000/printers');
      if (response.ok) {
        setRelayOnline(true);
        await fetchAvailablePrinters();

        // 3. Query local bridge for version
        try {
          const verRes = await fetch('http://localhost:5000/version');
          if (verRes.ok) {
            const verData = await verRes.json();
            setInstalledVersion(verData.version || '1.1.0');
          } else {
            // Older legacy bridge returns 404
            setInstalledVersion('1.0.0 (Legacy)');
          }
        } catch {
          setInstalledVersion('1.0.0 (Legacy)');
        }
      } else {
        setRelayOnline(false);
        setInstalledVersion(null);
      }
    } catch {
      setRelayOnline(false);
      setInstalledVersion(null);
    }
  };

  const handleAutoUpdate = async () => {
    setUpdating(true);
    try {
      const downloadUrl = window.location.origin + (latestVersionInfo?.downloadUrl || '/downloads/printer-bridge.exe');
      const res = await fetch('http://localhost:5000/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloadUrl })
      });

      if (!res.ok) {
        throw new Error('Update command failed on local printer bridge');
      }

      message.loading({ content: 'Downloading update and restarting Printer Bridge...', key: 'bridge-upd', duration: 0 });

      // Poll localhost:5000/version every 1.5s for up to 15 seconds
      let retries = 10;
      let updated = false;
      while (retries > 0) {
        await new Promise(r => setTimeout(r, 1500));
        try {
          const checkRes = await fetch('http://localhost:5000/version');
          if (checkRes.ok) {
            const data = await checkRes.json();
            if (data.version === latestVersionInfo?.version) {
              updated = true;
              setInstalledVersion(data.version);
              break;
            }
          }
        } catch {
          // Service is restarting
        }
        retries--;
      }

      if (updated) {
        message.success({ content: `Printer Bridge successfully updated to v${latestVersionInfo?.version}!`, key: 'bridge-upd' });
        await checkRelayStatus();
      } else {
        message.info({ content: 'Printer Bridge is restarting. Please click Refresh in a few seconds.', key: 'bridge-upd' });
      }
    } catch (err: any) {
      message.error({ content: err.message || 'Failed to trigger auto-update', key: 'bridge-upd' });
    } finally {
      setUpdating(false);
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
                      <Badge 
                        status={installedVersion?.includes('Legacy') || (latestVersionInfo?.version && installedVersion !== latestVersionInfo.version) ? 'warning' : 'success'} 
                        text={`Local Relay Online (v${installedVersion || '1.1.0'}${latestVersionInfo?.version && installedVersion !== latestVersionInfo.version ? ' - Update Available' : ''})`} 
                      />
                    ) : relayOnline === false ? (
                      <Badge status="error" text="Local Relay Offline" />
                    ) : (
                      <Badge status="default" text="Checking status..." />
                    )}
                  </div>
                </Col>

                {/* Case 1: Relay is Online & Running Legacy v1.0.0 (needs initial 1-time run of v1.1.0) */}
                {relayOnline === true && installedVersion?.includes('Legacy') && (
                  <Col span={24} style={{ marginBottom: 14 }}>
                    <Alert
                      type="warning"
                      showIcon
                      icon={<CloudSyncOutlined />}
                      message={`Printer Bridge Update Available (v${latestVersionInfo?.version || '1.1.0'})`}
                      description={
                        <div>
                          <div style={{ marginBottom: 8, fontSize: 13 }}>
                            Your PC is running the legacy Printer Bridge without auto-update capabilities. Download the updated version below — when opened, it will <strong>automatically close the old version and take over</strong> seamlessly, enabling 1-click automatic updates from the web for all future releases!
                          </div>
                          <Space wrap>
                            <Button
                              type="primary"
                              icon={<DownloadOutlined />}
                              href="/downloads/printer-bridge.exe"
                              download
                              size="middle"
                            >
                              Download &amp; Run Updated Bridge (v{latestVersionInfo?.version || '1.1.0'})
                            </Button>
                            <Button
                              size="middle"
                              icon={<CopyOutlined />}
                              onClick={() => {
                                const cmd = `powershell -Command "Stop-Process -Name 'printer-bridge' -Force -ErrorAction SilentlyContinue; Invoke-WebRequest -Uri '${window.location.origin}/downloads/printer-bridge.exe' -OutFile '$env:LOCALAPPDATA\\RetailSuite\\printer-bridge.exe'; Start-Process '$env:LOCALAPPDATA\\RetailSuite\\printer-bridge.exe'"`;
                                navigator.clipboard.writeText(cmd);
                                message.success('Copied 1-line update command to clipboard! Paste it into PowerShell.');
                              }}
                            >
                              Copy 1-Line Auto-Replacer Command
                            </Button>
                          </Space>
                        </div>
                      }
                    />
                  </Col>
                )}

                {/* Case 2: Relay is Online on v1.1.0+ and a Newer Version is Available (1-Click Seamless Auto Update) */}
                {relayOnline === true && !installedVersion?.includes('Legacy') && latestVersionInfo?.version && installedVersion !== latestVersionInfo.version && (
                  <Col span={24} style={{ marginBottom: 14 }}>
                    <Alert
                      type="info"
                      showIcon
                      icon={<CloudSyncOutlined />}
                      message={`Printer Bridge Update Available (v${installedVersion} ➔ v${latestVersionInfo.version})`}
                      description={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <span style={{ fontSize: 13 }}>
                            {latestVersionInfo.releaseNotes || 'A new version of Printer Bridge is ready to install.'}
                          </span>
                          <Button
                            type="primary"
                            size="small"
                            loading={updating}
                            onClick={handleAutoUpdate}
                            icon={<ReloadOutlined />}
                          >
                            Update Now (1-Click)
                          </Button>
                        </div>
                      }
                    />
                  </Col>
                )}

                {/* Case 3: Relay is completely Offline */}
                {relayOnline === false && (
                  <Col span={24} style={{ marginBottom: 12 }}>
                    <Alert
                      type="warning"
                      showIcon
                      icon={<InfoCircleOutlined />}
                      message="Printer Bridge Offline"
                      description={
                        <span>
                          Please make sure your PrinterBridge service is running at <code>http://localhost:5000</code> on this system.
                          <br />
                          If you haven't installed or started it yet, you can{' '}
                          <a 
                            href="/downloads/printer-bridge.exe" 
                            download 
                            style={{ 
                              color: '#1677ff', 
                              fontWeight: 600, 
                              textDecoration: 'underline',
                              display: 'inline-flex',
                              alignItems: 'center',
                              marginTop: 4
                            }}
                          >
                            <DownloadOutlined style={{ marginRight: 4 }} />
                            Download Printer Bridge Helper (Windows)
                          </a>
                        </span>
                      }
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
