import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Spin,
  Switch,
  Form,
  Alert
} from 'antd';
import {
  SettingOutlined,
  FileTextOutlined,
  PrinterOutlined,
  SaveOutlined,
  UndoOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  SmileOutlined,
  QrcodeOutlined,
  BankOutlined
} from '@ant-design/icons';
import {
  useSettingsStore,
  BILL_THANK_YOU_KEY,
  BILL_THANK_YOU_DEFAULT,
  BILL_QR_ENABLED_KEY,
  BILL_QR_ACCOUNT_TITLE,
  BILL_QR_ACCOUNT_NUMBER,
  BILL_QR_BANK_NAME,
  BILL_QR_INCLUDE_AMOUNT
} from '../../stores/useSettingsStore';
import { useAppStore } from '../../stores/useAppStore';
import { PrinterSettings } from './PrinterSettings';
import { buildEmvCoPayload, normalizeToIban, isValidIban, formatIban } from '../../utils/emvcoQr';
import QRCode from 'qrcode';

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

  // Local state for QR Payment settings
  const [qrEnabled, setQrEnabled] = useState(false);
  const [qrAccountTitle, setQrAccountTitle] = useState('');
  const [qrAccountNumber, setQrAccountNumber] = useState('');
  const [qrBankName, setQrBankName] = useState('');
  const [qrIncludeAmount, setQrIncludeAmount] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const [qrLastSaved, setQrLastSaved] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize and load settings from API
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Sync Thank You state when store initialised
  useEffect(() => {
    const currentVal = getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT);
    setThankYouInput(currentVal);
  }, [initialized, getSetting]);

  // Sync QR payment state when store initialised
  useEffect(() => {
    if (!initialized) return;
    setQrEnabled(getSetting(BILL_QR_ENABLED_KEY, 'false') === 'true');
    setQrAccountTitle(getSetting(BILL_QR_ACCOUNT_TITLE, ''));
    setQrAccountNumber(getSetting(BILL_QR_ACCOUNT_NUMBER, ''));
    setQrBankName(getSetting(BILL_QR_BANK_NAME, ''));
    setQrIncludeAmount(getSetting(BILL_QR_INCLUDE_AMOUNT, 'false') === 'true');
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

  // Live QR canvas preview — debounced 300 ms
  const renderQrPreview = useCallback(
    (enabled: boolean, title: string, account: string, amount: number, bank: string) => {
      if (qrDebounceRef.current) clearTimeout(qrDebounceRef.current);
      qrDebounceRef.current = setTimeout(async () => {
        const canvas = qrCanvasRef.current;
        if (!canvas) return;
        if (!enabled || !account.trim()) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#bbb';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('QR disabled', canvas.width / 2, canvas.height / 2);
          }
          return;
        }
        try {
          const payload = buildEmvCoPayload(title, account, amount, bank);
          await QRCode.toCanvas(canvas, payload, {
            width: 180,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#ffffff' }
          });
        } catch (e) {
          console.warn('QR preview error', e);
        }
      }, 300);
    },
    []
  );

  // Re-render preview whenever fields change
  useEffect(() => {
    renderQrPreview(qrEnabled, qrAccountTitle, qrAccountNumber, qrIncludeAmount ? 1000 : 0, qrBankName);
  }, [qrEnabled, qrAccountTitle, qrAccountNumber, qrBankName, qrIncludeAmount, renderQrPreview]);

  const handleSaveQr = async () => {
    setSavingQr(true);
    try {
      await updateSetting(BILL_QR_ENABLED_KEY, qrEnabled ? 'true' : 'false', 'Enable QR Payment on bills', 'Bill.QrPayment');
      await updateSetting(BILL_QR_ACCOUNT_TITLE, qrAccountTitle.trim(), 'Merchant / account title for QR payment', 'Bill.QrPayment');
      await updateSetting(BILL_QR_ACCOUNT_NUMBER, qrAccountNumber.trim(), 'IBAN or RAAST Alias for QR payment', 'Bill.QrPayment');
      await updateSetting(BILL_QR_BANK_NAME, qrBankName.trim(), 'Bank or wallet name for QR payment label', 'Bill.QrPayment');
      await updateSetting(BILL_QR_INCLUDE_AMOUNT, qrIncludeAmount ? 'true' : 'false', 'Pre-fill invoice amount in QR', 'Bill.QrPayment');
      setQrLastSaved(new Date().toLocaleTimeString());
      message.success('QR payment settings saved!');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to save QR settings.');
    } finally {
      setSavingQr(false);
    }
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
          },
          {
            key: 'qr-payment',
            label: (
              <span>
                <QrcodeOutlined style={{ marginRight: 8 }} />
                QR Payment
              </span>
            ),
            children: (
              <Spin spinning={loading && !initialized}>
                <Row gutter={[24, 24]}>
                  {/* Left: Form */}
                  <Col xs={24} lg={14}>
                    <Card
                      className="shadow-sm border-gray-100 rounded-xl"
                      title={
                        <Space>
                          <BankOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                          <span style={{ fontWeight: 600 }}>QR Payment Settings</span>
                        </Space>
                      }
                      extra={
                        qrLastSaved && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                            Saved at {qrLastSaved}
                          </Text>
                        )
                      }
                    >
                      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
                        Configure your store's receiving bank account. A scannable QR code will appear on all
                        customer bills and receipts. Customers can scan it with any Pakistani bank app
                        (HBL, MCB, Meezan, Alfalah, Easypaisa, JazzCash) to pay instantly via RAAST / IBFT.
                      </Paragraph>

                      <Form layout="vertical">
                        <Form.Item label={<Text strong>Enable QR Payment on Bills</Text>}>
                          <Switch
                            checked={qrEnabled}
                            onChange={setQrEnabled}
                            checkedChildren="Enabled"
                            unCheckedChildren="Disabled"
                          />
                        </Form.Item>

                        <Form.Item
                          label={<Text strong>Pre-fill Bill Amount in QR</Text>}
                          help="If enabled, customer's net balance is pre-filled in their bank app. If disabled, customer types the amount manually (Static QR - works universally with all banks)."
                        >
                          <Switch
                            checked={qrIncludeAmount}
                            onChange={setQrIncludeAmount}
                            checkedChildren="Dynamic (Amount Pre-filled)"
                            unCheckedChildren="Static (Universal Scan)"
                            disabled={!qrEnabled}
                          />
                        </Form.Item>

                        <Form.Item
                          label={<Text strong>Bank / Wallet Name</Text>}
                          help="e.g. Meezan Bank, HBL, Bank Alfalah, JazzCash, Easypaisa"
                        >
                          <Input
                            value={qrBankName}
                            onChange={e => setQrBankName(e.target.value)}
                            placeholder="e.g. Meezan Bank"
                            maxLength={30}
                            disabled={!qrEnabled}
                            style={{ borderRadius: 8 }}
                          />
                        </Form.Item>

                        <Form.Item
                          label={<Text strong>Account / Merchant Name</Text>}
                          help="Store or business title (e.g. Retail Suite Enterprise)"
                        >
                          <Input
                            value={qrAccountTitle}
                            onChange={e => setQrAccountTitle(e.target.value)}
                            placeholder="e.g. Mutahhar Enterprises"
                            maxLength={25}
                            disabled={!qrEnabled}
                            style={{ borderRadius: 8 }}
                          />
                        </Form.Item>

                        <Form.Item
                          label={<Text strong>IBAN or Account Number</Text>}
                          help="24-character Pakistani IBAN (e.g. PK36MEZN0001020304050607) found in your bank app"
                        >
                          <Input
                            value={qrAccountNumber}
                            onChange={e => setQrAccountNumber(e.target.value)}
                            placeholder="e.g. PK36MEZN0001020304050607"
                            maxLength={34}
                            disabled={!qrEnabled}
                            style={{ borderRadius: 8, fontFamily: 'monospace' }}
                          />
                          {qrAccountNumber.trim() && (
                            <div style={{ marginTop: 6 }}>
                              {isValidIban(normalizeToIban(qrAccountNumber, qrBankName)) ? (
                                <Tag color="success">
                                  Valid 24-char Raast IBAN: {formatIban(normalizeToIban(qrAccountNumber, qrBankName))}
                                </Tag>
                              ) : normalizeToIban(qrAccountNumber, qrBankName).startsWith('PK') &&
                                normalizeToIban(qrAccountNumber, qrBankName).length === 24 ? (
                                <Tag color="processing">
                                  Synthesized IBAN: {formatIban(normalizeToIban(qrAccountNumber, qrBankName))}
                                </Tag>
                              ) : (
                                <Tag color="warning">
                                  {normalizeToIban(qrAccountNumber, qrBankName).length < 24
                                    ? `Account Number (${qrAccountNumber.trim().length} digits). Please enter full 24-char IBAN or set Bank Name above.`
                                    : `IBAN: ${normalizeToIban(qrAccountNumber, qrBankName)}`}
                                </Tag>
                              )}
                            </div>
                          )}
                        </Form.Item>
                      </Form>

                      <Divider style={{ margin: '16px 0' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Amount is always pre-filled from the customer's net balance.
                          </Text>
                        </Space>
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          size="large"
                          loading={savingQr}
                          onClick={handleSaveQr}
                          style={{ fontWeight: 600, borderRadius: 8, paddingLeft: 24, paddingRight: 24 }}
                        >
                          Save QR Settings
                        </Button>
                      </div>
                    </Card>
                  </Col>

                  {/* Right: Live QR Preview */}
                  <Col xs={24} lg={10}>
                    <Card
                      title={<span style={{ fontWeight: 600 }}>Live QR Preview</span>}
                      className="shadow-sm border-gray-100 rounded-xl"
                      style={{ backgroundColor: '#f8fafc' }}
                    >
                      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 16 }}>
                        Updates as you type. Scan this with any Pakistani bank app to verify.
                      </Paragraph>

                      <div style={{ textAlign: 'center' }}>
                        <canvas
                          ref={qrCanvasRef}
                          width={180}
                          height={180}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            backgroundColor: '#ffffff',
                            display: 'block',
                            margin: '0 auto 12px'
                          }}
                        />
                        {qrEnabled && qrBankName && (
                          <Text strong style={{ display: 'block', fontSize: 13 }}>{qrBankName}</Text>
                        )}
                        {qrEnabled && qrAccountNumber && (
                          <Text type="secondary" style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', marginTop: 4 }}>
                            {qrAccountNumber}
                          </Text>
                        )}
                      </div>

                      {qrEnabled && qrAccountNumber && (
                        <>
                          <Divider style={{ margin: '16px 0' }} />
                          <Alert
                            type="info"
                            showIcon
                            message="Scan to Pay (RAAST / IBFT)"
                            description="Works with HBL, MCB, UBL, Meezan, Alfalah, Easypaisa, JazzCash and all RAAST-enabled bank apps."
                            style={{ fontSize: 11, borderRadius: 8 }}
                          />
                        </>
                      )}

                      {!qrEnabled && (
                        <Alert
                          type="warning"
                          showIcon
                          message="QR Payment is disabled"
                          description="Enable the toggle on the left and enter your account details to activate."
                          style={{ fontSize: 11, borderRadius: 8, marginTop: 12 }}
                        />
                      )}
                    </Card>
                  </Col>
                </Row>
              </Spin>
            )
          }
        ]}
      />
    </div>
  );
};

export default SettingsPage;
