import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Typography,
  Input,
  Button,
  Space,
  Tag,
  Divider,
  message,
  Row,
  Col,
  Spin
} from 'antd';
import {
  SettingOutlined,
  FileTextOutlined,
  PrinterOutlined,
  SaveOutlined,
  UndoOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  SmileOutlined
} from '@ant-design/icons';
import {
  useSettingsStore,
  BILL_THANK_YOU_KEY,
  BILL_THANK_YOU_DEFAULT
} from '../../stores/useSettingsStore';
import { useAppStore } from '../../stores/useAppStore';
import { PrinterSettings } from './PrinterSettings';

const { Title, Text, Paragraph } = Typography;

export const SettingsPage: React.FC = () => {
  const { fetchSettings, getSetting, updateSetting, loading, initialized } = useSettingsStore();
  const { licenses, currentTenantIdentifier } = useAppStore();

  const currentOrgName =
    licenses.find((l) => l.tenantIdentifier === currentTenantIdentifier)?.name ||
    'RETAIL STORE';

  // Local state for Thank You message setting
  const [thankYouInput, setThankYouInput] = useState<string>('');
  const [savingThankYou, setSavingThankYou] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Initialize and load settings from API
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Sync state when store initialized or updated
  useEffect(() => {
    const currentVal = getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT);
    setThankYouInput(currentVal);
  }, [initialized, getSetting]);

  const handleSaveThankYou = async () => {
    setSavingThankYou(true);
    try {
      await updateSetting(
        BILL_THANK_YOU_KEY,
        thankYouInput.trim() || BILL_THANK_YOU_DEFAULT,
        'Customer bill and receipt thank you message',
        'Bill'
      );
      setLastSavedTime(new Date().toLocaleTimeString());
      message.success('Bill message saved successfully!');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to save setting.');
    } finally {
      setSavingThankYou(false);
    }
  };

  const handleResetDefault = () => {
    setThankYouInput(BILL_THANK_YOU_DEFAULT);
  };

  const thankYouPresets = [
    'Thank you for shopping with us!',
    'Thank you for your visit! Please come again.',
    'Thank you for choosing us. Have a great day!',
    'شکریہ! دوبارہ تشریف لائیں'
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Space align="center" size={12}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: '#e6f4ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1677ff',
              fontSize: 22
            }}
          >
            <SettingOutlined />
          </div>
          <div>
            <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
              Settings
            </Title>
            <Text type="secondary">
              Manage customer bill message and printer preferences
            </Text>
          </div>
        </Space>
      </div>

      <Tabs
        defaultActiveKey="bill-settings"
        type="card"
        size="large"
        items={[
          {
            key: 'bill-settings',
            label: (
              <span>
                <FileTextOutlined style={{ marginRight: 8 }} />
                Bill & Receipt Message
              </span>
            ),
            children: (
              <Spin spinning={loading && !initialized}>
                <Row gutter={[24, 24]}>
                  {/* Left Column: Form & Setting Items */}
                  <Col xs={24} lg={14}>
                    <Card
                      className="shadow-sm border-gray-100 rounded-xl"
                      title={
                        <Space>
                          <SmileOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                          <span style={{ fontWeight: 600 }}>Customer Bill Message</span>
                        </Space>
                      }
                      extra={
                        lastSavedTime && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                            Saved at {lastSavedTime}
                          </Text>
                        )
                      }
                    >
                      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                        Customize the message printed at the bottom of sales receipts and customer bills.
                      </Paragraph>

                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text strong>Bill Message:</Text>
                          <Button
                            type="link"
                            size="small"
                            icon={<UndoOutlined />}
                            onClick={handleResetDefault}
                            style={{ padding: 0 }}
                          >
                            Reset to Default
                          </Button>
                        </div>
                        <Input.TextArea
                          rows={3}
                          value={thankYouInput}
                          onChange={(e) => setThankYouInput(e.target.value)}
                          placeholder="e.g. Thank you for shopping with us!"
                          maxLength={250}
                          showCount
                          style={{
                            borderRadius: 8,
                            fontSize: 14,
                            lineHeight: 1.5,
                            border: '1px solid #d9d9d9'
                          }}
                        />
                      </div>

                      {/* Presets */}
                      <div style={{ marginBottom: 20 }}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                          Choose a suggestion or type your own:
                        </Text>
                        <Space wrap size={[8, 8]}>
                          {thankYouPresets.map((preset, index) => (
                            <Tag
                              key={index}
                              style={{
                                cursor: 'pointer',
                                padding: '4px 10px',
                                borderRadius: 6,
                                border: '1px solid #d9d9d9',
                                backgroundColor: thankYouInput === preset ? '#e6f4ff' : '#fafafa',
                                color: thankYouInput === preset ? '#1677ff' : 'inherit'
                              }}
                              onClick={() => setThankYouInput(preset)}
                            >
                              {preset}
                            </Tag>
                          ))}
                        </Space>
                      </div>

                      <Divider style={{ margin: '16px 0' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Changes will appear on all newly printed receipts and bills.
                          </Text>
                        </Space>
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          size="large"
                          loading={savingThankYou}
                          onClick={handleSaveThankYou}
                          style={{
                            fontWeight: 600,
                            borderRadius: 8,
                            paddingLeft: 24,
                            paddingRight: 24
                          }}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </Card>
                  </Col>

                  {/* Right Column: Live Receipt Preview */}
                  <Col xs={24} lg={10}>
                    <Card
                      title={<span style={{ fontWeight: 600 }}>Receipt Preview</span>}
                      className="shadow-sm border-gray-100 rounded-xl"
                      style={{ backgroundColor: '#f8fafc' }}
                    >
                      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
                        How your message appears on printed customer receipts:
                      </Paragraph>

                      {/* Mockup Receipt Box */}
                      <div
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 20,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                          fontFamily: 'monospace',
                          fontSize: 11,
                          lineHeight: 1.4,
                          color: '#000000'
                        }}
                      >
                        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>
                          {currentOrgName.toUpperCase()}
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 10, color: '#666', marginBottom: 12 }}>
                          MAIN BRANCH - TEL: 0300-1234567
                        </div>
                        <div style={{ borderBottom: '1px dashed #999', marginBottom: 8 }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                          <span>Date: 07-Sep-2026</span>
                          <span>Voucher: SL-00108</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 8 }}>
                          <span>Cashier: Admin</span>
                          <span>Type: Cash</span>
                        </div>
                        <div style={{ borderBottom: '1px solid #000', marginBottom: 8 }} />

                        {/* Sample items */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>Sample Item A x 2</span>
                          <span>Rs. 500.00</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span>Sample Item B x 1</span>
                          <span>Rs. 350.00</span>
                        </div>
                        <div style={{ borderBottom: '1px dashed #999', marginBottom: 8 }} />

                        {/* Totals */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>
                          <span>Net Amount:</span>
                          <span>Rs. 850.00</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                          <span>Cash Received:</span>
                          <span>Rs. 1,000.00</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 8 }}>
                          <span>Change / Cash Back:</span>
                          <span>Rs. 150.00</span>
                        </div>

                        <div style={{ borderTop: '1px dashed #000', paddingTop: 10, marginTop: 8, textAlign: 'center' }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 'bold',
                              wordBreak: 'break-word',
                              color: '#0f172a'
                            }}
                          >
                            {thankYouInput.trim() || BILL_THANK_YOU_DEFAULT}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </Spin>
            )
          },
          {
            key: 'printer-settings',
            label: (
              <span>
                <PrinterOutlined style={{ marginRight: 8 }} />
                Printer Settings
              </span>
            ),
            children: <PrinterSettings />
          }
        ]}
      />
    </div>
  );
};

export default SettingsPage;
