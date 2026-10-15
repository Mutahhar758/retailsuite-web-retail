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
  Alert,
  Radio
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
  BankOutlined,
  AppstoreOutlined,
  CoffeeOutlined,
  BarcodeOutlined,
  ThunderboltOutlined,
  SoundOutlined
} from '@ant-design/icons';
import {
  useSettingsStore,
  BILL_THANK_YOU_KEY,
  BILL_THANK_YOU_DEFAULT,
  BILL_DEFAULT_FORMAT_KEY,
  BILL_QR_ENABLED_KEY,
  BILL_QR_ACCOUNT_TITLE,
  BILL_QR_ACCOUNT_NUMBER,
  BILL_QR_BANK_NAME,
  BILL_QR_INCLUDE_AMOUNT,
  INVENTORY_ENABLE_SECONDARY_QTY_KEY,
  RESTAURANT_ENABLE_KOT_KEY,
  SUPPLY_ENABLE_KEY,
  TRANSACTION_ENABLE_CARRIAGE_KEY,
  BARCODE_FAST_SCAN_ENABLED_KEY,
  BARCODE_FAST_SCAN_INCREMENT_KEY,
  BARCODE_FAST_SCAN_SOUND_KEY,
  BARCODE_FAST_SCAN_AUTOFOCUS_KEY
} from '../../stores/useSettingsStore';
import { useAppStore } from '../../stores/useAppStore';
import { PrinterSettings } from './PrinterSettings';
import { buildEmvCoPayload, normalizeToIban, isValidIban, formatIban } from '../../utils/emvcoQr';
import { playScanSuccessTone, playScanErrorTone } from '../../utils/scannerAudio';
import { inventoryService, type Item } from '../../services/inventoryService';
import QRCode from 'qrcode';

const { Title, Text, Paragraph } = Typography;

export const SettingsPage: React.FC = () => {
  const { fetchSettings, getSetting, updateSetting, loading, initialized, settings } = useSettingsStore();
  const { licenses, currentTenantIdentifier } = useAppStore();

  const currentOrgName =
    licenses.find((l) => l.tenantIdentifier === currentTenantIdentifier)?.name ||
    'RETAIL STORE';

  // Local state for Thank You message setting
  const [thankYouInput, setThankYouInput] = useState<string>('');
  const [defaultBillFormat, setDefaultBillFormat] = useState<string>('A4');
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

  // Local state for Inventory settings
  const [secondaryQtyEnabled, setSecondaryQtyEnabled] = useState(false);
  const [supplyEnabled, setSupplyEnabled] = useState(false);
  const [carriageEnabled, setCarriageEnabled] = useState(false);
  const [savingInventory, setSavingInventory] = useState(false);
  const [inventoryLastSaved, setInventoryLastSaved] = useState<string | null>(null);

  // Local state for Restaurant & KOT settings
  const [kotEnabled, setKotEnabled] = useState(false);
  const [savingKot, setSavingKot] = useState(false);
  const [kotLastSaved, setKotLastSaved] = useState<string | null>(null);

  // Local state for Barcode Fast Scan settings
  const [fastScanEnabled, setFastScanEnabled] = useState(false);
  const [fastScanIncrement, setFastScanIncrement] = useState(true);
  const [fastScanSound, setFastScanSound] = useState(true);
  const [fastScanAutoFocus, setFastScanAutoFocus] = useState(true);
  const [savingFastScan, setSavingFastScan] = useState(false);
  const [fastScanLastSaved, setFastScanLastSaved] = useState<string | null>(null);

  // Items for live test barcode scanner simulator
  const [testItems, setTestItems] = useState<Item[]>([]);
  const [testScanInput, setTestScanInput] = useState('');
  const [testScanResult, setTestScanResult] = useState<{ item: Item; timestamp: number } | null>(null);
  const [testScanError, setTestScanError] = useState<string | null>(null);

  // Initialize and load settings from API when page mounts or tenant changes
  useEffect(() => {
    fetchSettings();
    inventoryService.getItemsLookup().then(setTestItems).catch(() => {});
  }, [fetchSettings, currentTenantIdentifier]);

  // Sync Thank You and Default Bill Format state when store initialized or settings change
  useEffect(() => {
    if (!initialized) return;
    const currentVal = getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT);
    setThankYouInput(currentVal);
    const formatVal = getSetting(BILL_DEFAULT_FORMAT_KEY, 'A4');
    setDefaultBillFormat(formatVal.toLowerCase().includes('thermal') ? 'Thermal' : 'A4');
  }, [initialized, settings, getSetting]);

  // Sync QR payment state when store initialized or settings change
  useEffect(() => {
    if (!initialized) return;
    setQrEnabled(getSetting(BILL_QR_ENABLED_KEY, 'false') === 'true');
    setQrAccountTitle(getSetting(BILL_QR_ACCOUNT_TITLE, ''));
    setQrAccountNumber(getSetting(BILL_QR_ACCOUNT_NUMBER, ''));
    setQrBankName(getSetting(BILL_QR_BANK_NAME, ''));
    setQrIncludeAmount(getSetting(BILL_QR_INCLUDE_AMOUNT, 'false') === 'true');
    setSecondaryQtyEnabled(getSetting(INVENTORY_ENABLE_SECONDARY_QTY_KEY, 'false') === 'true');
    const supplySetting = getSetting(SUPPLY_ENABLE_KEY, '');
    const orgSupply = licenses.find((l) => l.tenantIdentifier === currentTenantIdentifier)?.hasSupplyFeature ?? false;
    setSupplyEnabled(supplySetting !== '' ? supplySetting === 'true' : orgSupply);
    setCarriageEnabled(getSetting(TRANSACTION_ENABLE_CARRIAGE_KEY, 'false') === 'true');
    setKotEnabled(getSetting(RESTAURANT_ENABLE_KOT_KEY, 'false') === 'true');
    setFastScanEnabled(getSetting(BARCODE_FAST_SCAN_ENABLED_KEY, 'false') === 'true');
    setFastScanIncrement(getSetting(BARCODE_FAST_SCAN_INCREMENT_KEY, 'true') !== 'false');
    setFastScanSound(getSetting(BARCODE_FAST_SCAN_SOUND_KEY, 'true') !== 'false');
    setFastScanAutoFocus(getSetting(BARCODE_FAST_SCAN_AUTOFOCUS_KEY, 'true') !== 'false');
  }, [initialized, settings, getSetting]);

  const handleSaveThankYou = async () => {
    setSavingThankYou(true);
    try {
      await updateSetting(
        BILL_THANK_YOU_KEY,
        thankYouInput.trim() || BILL_THANK_YOU_DEFAULT,
        'Customer bill and receipt thank you message',
        'Bill'
      );
      await updateSetting(
        BILL_DEFAULT_FORMAT_KEY,
        defaultBillFormat,
        'Default customer bill print layout (Thermal or A4)',
        'Bill'
      );
      setLastSavedTime(new Date().toLocaleTimeString());
      message.success('Bill settings saved successfully!');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to save setting.');
    } finally {
      setSavingThankYou(false);
    }
  };

  const handleResetDefault = () => {
    setThankYouInput(BILL_THANK_YOU_DEFAULT);
  };

  const handleSaveInventory = async () => {
    setSavingInventory(true);
    try {
      await updateSetting(
        INVENTORY_ENABLE_SECONDARY_QTY_KEY,
        secondaryQtyEnabled ? 'true' : 'false',
        'Enable Secondary Quantity (Single & Pack Qty / Rate) in transactions',
        'Inventory'
      );
      await updateSetting(
        SUPPLY_ENABLE_KEY,
        supplyEnabled ? 'true' : 'false',
        'Enable Supply Orders, Sale Supply, and Customer Supply Register',
        'Supply'
      );
      await updateSetting(
        TRANSACTION_ENABLE_CARRIAGE_KEY,
        carriageEnabled ? 'true' : 'false',
        'Enable Carriage / Rent column in Sale Supplies, Customer Presets, and Reports',
        'Transaction'
      );
      setInventoryLastSaved(new Date().toLocaleTimeString());
      message.success('Settings saved successfully!');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSavingInventory(false);
    }
  };

  const handleSaveRestaurant = async () => {
    setSavingKot(true);
    try {
      await updateSetting(
        RESTAURANT_ENABLE_KOT_KEY,
        kotEnabled ? 'true' : 'false',
        'Enable Kitchen Order Tickets (KOT), Dining Tables, and Kitchen Display System (KDS)',
        'Restaurant'
      );
      setKotLastSaved(new Date().toLocaleTimeString());
      message.success('Restaurant & KOT settings saved successfully!');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to save restaurant settings.');
    } finally {
      setSavingKot(false);
    }
  };

  const handleSaveBarcodeSettings = async () => {
    setSavingFastScan(true);
    try {
      await updateSetting(
        BARCODE_FAST_SCAN_ENABLED_KEY,
        fastScanEnabled ? 'true' : 'false',
        'Enable Barcode Fast Scan input box on top of transaction grids',
        'Barcode'
      );
      await updateSetting(
        BARCODE_FAST_SCAN_INCREMENT_KEY,
        fastScanIncrement ? 'true' : 'false',
        'Auto-increment item quantity on repeated barcode scan',
        'Barcode'
      );
      await updateSetting(
        BARCODE_FAST_SCAN_SOUND_KEY,
        fastScanSound ? 'true' : 'false',
        'Play audio beep tone on successful/failed barcode scans',
        'Barcode'
      );
      await updateSetting(
        BARCODE_FAST_SCAN_AUTOFOCUS_KEY,
        fastScanAutoFocus ? 'true' : 'false',
        'Keep barcode scan input focused for continuous hands-free scanning',
        'Barcode'
      );
      setFastScanLastSaved(new Date().toLocaleTimeString());
      message.success('Barcode fast scan settings saved successfully!');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to save barcode settings.');
    } finally {
      setSavingFastScan(false);
    }
  };

  const handleTestScan = (rawInput?: string) => {
    const code = (rawInput !== undefined ? rawInput : testScanInput).trim();
    if (!code) return;

    setTestScanError(null);
    let matchedItem = testItems.find(
      (i) => i.barcode && i.barcode.trim().toLowerCase() === code.toLowerCase()
    );
    if (!matchedItem) {
      matchedItem = testItems.find(
        (i) =>
          String(i.id).toLowerCase() === code.toLowerCase() ||
          (i.itemKey && i.itemKey.toLowerCase() === code.toLowerCase()) ||
          (i.title && i.title.toLowerCase() === code.toLowerCase())
      );
    }

    if (matchedItem) {
      if (fastScanSound) {
        playScanSuccessTone();
      }
      setTestScanResult({ item: matchedItem, timestamp: Date.now() });
      setTestScanInput('');
      message.success(`Matched Item: "${matchedItem.title}"`);
    } else {
      if (fastScanSound) {
        playScanErrorTone();
      }
      setTestScanResult(null);
      setTestScanError(`Barcode "${code}" was not found in current inventory.`);
      message.warning(`Barcode "${code}" was not found in current inventory.`);
    }
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
                        Customize the print layout and message printed on sales receipts and customer bills.
                      </Paragraph>

                      {/* Default Format Setting */}
                      <div style={{ marginBottom: 20 }}>
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>Default Bill Print Layout:</Text>
                        <Radio.Group
                          value={defaultBillFormat}
                          onChange={(e) => setDefaultBillFormat(e.target.value)}
                          buttonStyle="solid"
                          size="middle"
                        >
                          <Radio.Button value="Thermal">80mm Thermal Receipt (POS Roll)</Radio.Button>
                          <Radio.Button value="A4">A4 Sheet (Commercial Invoice)</Radio.Button>
                        </Radio.Group>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                          Customer bills will default to this layout automatically across all devices.
                        </Text>
                      </div>

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
          },
          {
            key: 'inventory-settings',
            label: (
              <span>
                <AppstoreOutlined style={{ marginRight: 8 }} />
                Inventory Settings
              </span>
            ),
            children: (
              <Spin spinning={loading && !initialized}>
                <Row gutter={[24, 24]}>
                  <Col xs={24} lg={16}>
                    <Card
                      className="shadow-sm border-gray-100 rounded-xl"
                      title={
                        <Space>
                          <AppstoreOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                          <span style={{ fontWeight: 600 }}>Inventory & Quantity Features</span>
                        </Space>
                      }
                      extra={
                        inventoryLastSaved && (
                          <Tag icon={<CheckCircleOutlined />} color="success">
                            Saved at {inventoryLastSaved}
                          </Tag>
                        )
                      }
                    >
                      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
                        Configure quantity columns for transaction entry across Sales, Purchases, Supplies, and Stock Adjustments.
                      </Paragraph>

                      <div style={{ padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <Row align="middle" justify="space-between">
                          <Col span={18}>
                            <Text strong style={{ fontSize: 15, display: 'block' }}>
                              Enable Secondary Quantity (Single & Pack Qty / Rate)
                            </Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              When enabled, transactions display both Single Qty/Rate and Pack Qty/Rate columns. When disabled, only standard Quantity and Rate are shown. Unit selection is removed in both modes.
                            </Text>
                          </Col>
                          <Col span={6} style={{ textAlign: 'right' }}>
                            <Switch
                              checked={secondaryQtyEnabled}
                              onChange={setSecondaryQtyEnabled}
                              checkedChildren="Enabled"
                              unCheckedChildren="Disabled"
                            />
                          </Col>
                        </Row>
                      </div>

                      <div style={{ padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <Row align="middle" justify="space-between">
                          <Col span={18}>
                            <Text strong style={{ fontSize: 15, display: 'block' }}>
                              Enable Supply Feature
                            </Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              When enabled, Supply Orders, Sale Supply and the Customer Supply Register become available in the menu.
                            </Text>
                          </Col>
                          <Col span={6} style={{ textAlign: 'right' }}>
                            <Switch
                              checked={supplyEnabled}
                              onChange={setSupplyEnabled}
                              checkedChildren="Enabled"
                              unCheckedChildren="Disabled"
                            />
                          </Col>
                        </Row>
                      </div>

                      <div style={{ padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <Row align="middle" justify="space-between">
                          <Col span={18}>
                            <Text strong style={{ fontSize: 15, display: 'block' }}>
                              Enable Carriage / Rent Field
                            </Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              When enabled, a Carriage / Rent column is displayed in Normal and Wanda Sale Supply transactions, Customer Supply preset configuration, and Customer Bills.
                            </Text>
                          </Col>
                          <Col span={6} style={{ textAlign: 'right' }}>
                            <Switch
                              checked={carriageEnabled}
                              onChange={setCarriageEnabled}
                              checkedChildren="Enabled"
                              unCheckedChildren="Disabled"
                            />
                          </Col>
                        </Row>
                      </div>

                      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          size="large"
                          loading={savingInventory}
                          onClick={handleSaveInventory}
                          style={{ fontWeight: 600, borderRadius: 8, paddingLeft: 24, paddingRight: 24 }}
                        >
                          Save Inventory Settings
                        </Button>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </Spin>
            )
          },
          {
            key: 'restaurant-settings',
            label: (
              <span>
                <CoffeeOutlined style={{ marginRight: 8 }} />
                Restaurant & KOT
              </span>
            ),
            children: (
              <Spin spinning={loading && !initialized}>
                <Row gutter={[24, 24]}>
                  <Col xs={24} lg={16}>
                    <Card
                      className="shadow-sm border-gray-100 rounded-xl"
                      title={
                        <Space>
                          <CoffeeOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
                          <span style={{ fontWeight: 600 }}>Restaurant & KOT Features</span>
                        </Space>
                      }
                      extra={
                        kotLastSaved && (
                          <Tag icon={<CheckCircleOutlined />} color="success">
                            Saved at {kotLastSaved}
                          </Tag>
                        )
                      }
                    >
                      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
                        Configure dining table management, Kitchen Order Tickets (KOT), and Kitchen Display System (KDS) for restaurant or cafe workflows.
                      </Paragraph>

                      <div style={{ padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <Row align="middle" justify="space-between">
                          <Col span={18}>
                            <Text strong style={{ fontSize: 15, display: 'block' }}>
                              Enable Kitchen Order Tickets (KOT) & Dining Tables
                            </Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              When enabled, the POS Touch interface displays Dining Table assignment and KOT printing. The Dining Tables setup menu and Kitchen Display (KDS) menu become available in navigation.
                            </Text>
                          </Col>
                          <Col span={6} style={{ textAlign: 'right' }}>
                            <Switch
                              checked={kotEnabled}
                              onChange={setKotEnabled}
                              checkedChildren="Enabled"
                              unCheckedChildren="Disabled"
                            />
                          </Col>
                        </Row>
                      </div>

                      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          size="large"
                          loading={savingKot}
                          onClick={handleSaveRestaurant}
                          style={{ fontWeight: 600, borderRadius: 8, paddingLeft: 24, paddingRight: 24 }}
                        >
                          Save Restaurant Settings
                        </Button>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </Spin>
            )
          },
          {
            key: 'barcode-settings',
            label: (
              <span>
                <BarcodeOutlined style={{ marginRight: 8 }} />
                Barcode Fast Scan
              </span>
            ),
            children: (
              <Spin spinning={loading && !initialized}>
                <Row gutter={[24, 24]}>
                  {/* Left Column: Fast Scan Configuration */}
                  <Col xs={24} lg={15}>
                    <Card
                      className="shadow-sm border-gray-100 rounded-xl"
                      title={
                        <Space>
                          <BarcodeOutlined style={{ color: '#16a34a', fontSize: 20 }} />
                          <span style={{ fontWeight: 600 }}>Barcode Fast Scan Configuration</span>
                        </Space>
                      }
                      extra={
                        fastScanLastSaved && (
                          <Tag icon={<CheckCircleOutlined />} color="success">
                            Saved at {fastScanLastSaved}
                          </Tag>
                        )
                      }
                    >
                      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
                        Configure high-speed barcode scanning for transaction grids (Sales, Purchases, Returns). When enabled, a dedicated quick scan bar appears directly on top of the items grid for seamless hands-free item addition.
                      </Paragraph>

                      {/* 1. Fast Scan on Grid Toggle */}
                      <div style={{ padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <Row align="middle" justify="space-between">
                          <Col span={18}>
                            <Space align="center" style={{ marginBottom: 4 }}>
                              <ThunderboltOutlined style={{ color: '#16a34a' }} />
                              <Text strong style={{ fontSize: 15 }}>
                                Enable Barcode Fast Scan Input on Top of Grid
                              </Text>
                            </Space>
                            <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                              Displays an optimized quick-scan input box above the table grid in Sales and Purchase vouchers. Cashiers can point-and-scan items rapidly or press <Tag color="green">F2</Tag> to focus without clicking &quot;Add Row&quot;.
                            </Text>
                          </Col>
                          <Col span={6} style={{ textAlign: 'right' }}>
                            <Switch
                              checked={fastScanEnabled}
                              onChange={setFastScanEnabled}
                              checkedChildren="Enabled"
                              unCheckedChildren="Disabled"
                            />
                          </Col>
                        </Row>
                      </div>

                      {/* 2. Auto-Increment Quantity on Repeated Scan */}
                      <div style={{ padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <Row align="middle" justify="space-between">
                          <Col span={18}>
                            <Text strong style={{ fontSize: 15, display: 'block' }}>
                              Auto-Increment Quantity on Duplicate Scan
                            </Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              When an item is scanned again, automatically increments its line quantity (+1) instead of adding a separate row. (Recommended for retail checkout).
                            </Text>
                          </Col>
                          <Col span={6} style={{ textAlign: 'right' }}>
                            <Switch
                              checked={fastScanIncrement}
                              onChange={setFastScanIncrement}
                              checkedChildren="+1 Qty"
                              unCheckedChildren="New Row"
                              disabled={!fastScanEnabled}
                            />
                          </Col>
                        </Row>
                      </div>

                      {/* 3. Audio Feedback Tone */}
                      <div style={{ padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <Row align="middle" justify="space-between">
                          <Col span={18}>
                            <Space align="center" style={{ marginBottom: 4 }}>
                              <SoundOutlined style={{ color: '#0ea5e9' }} />
                              <Text strong style={{ fontSize: 15 }}>
                                Audio Beep Tone Feedback
                              </Text>
                            </Space>
                            <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                              Plays an authentic high-pitched confirmation beep on successful scan, and a low warning tone if a barcode is not found in the inventory.
                            </Text>
                          </Col>
                          <Col span={6} style={{ textAlign: 'right' }}>
                            <Switch
                              checked={fastScanSound}
                              onChange={setFastScanSound}
                              checkedChildren="Sound On"
                              unCheckedChildren="Muted"
                            />
                          </Col>
                        </Row>
                      </div>

                      {/* 4. Continuous Auto-Focus */}
                      <div style={{ padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <Row align="middle" justify="space-between">
                          <Col span={18}>
                            <Text strong style={{ fontSize: 15, display: 'block' }}>
                              Continuous Hands-Free Auto-Focus
                            </Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              Automatically refocuses the scanner input immediately after each scan so cashiers never need to reach for the mouse.
                            </Text>
                          </Col>
                          <Col span={6} style={{ textAlign: 'right' }}>
                            <Switch
                              checked={fastScanAutoFocus}
                              onChange={setFastScanAutoFocus}
                              checkedChildren="Auto-Focus"
                              unCheckedChildren="Manual"
                              disabled={!fastScanEnabled}
                            />
                          </Col>
                        </Row>
                      </div>

                      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          size="large"
                          loading={savingFastScan}
                          onClick={handleSaveBarcodeSettings}
                          style={{
                            fontWeight: 600,
                            borderRadius: 8,
                            paddingLeft: 24,
                            paddingRight: 24,
                            backgroundColor: '#16a34a',
                            borderColor: '#16a34a'
                          }}
                        >
                          Save Barcode Settings
                        </Button>
                      </div>
                    </Card>
                  </Col>

                  {/* Right Column: Live Scanner Simulator & Test Box */}
                  <Col xs={24} lg={9}>
                    <Card
                      className="shadow-sm border-gray-100 rounded-xl"
                      title={
                        <Space>
                          <ThunderboltOutlined style={{ color: '#0ea5e9', fontSize: 18 }} />
                          <span style={{ fontWeight: 600 }}>Scanner Hardware Test Box</span>
                        </Space>
                      }
                      style={{ backgroundColor: '#f8fafc' }}
                    >
                      <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
                        Point your physical USB/Bluetooth handheld barcode scanner gun at any product barcode and test it here live:
                      </Paragraph>

                      <div style={{ marginBottom: 16 }}>
                        <Input
                          size="large"
                          prefix={<BarcodeOutlined style={{ color: '#16a34a', fontSize: 18 }} />}
                          placeholder="Scan or type barcode and press Enter..."
                          value={testScanInput}
                          onChange={(e) => setTestScanInput(e.target.value)}
                          onPressEnter={() => handleTestScan()}
                          style={{ borderRadius: 8, borderColor: '#86efac' }}
                          suffix={
                            <Button
                              type="primary"
                              size="small"
                              onClick={() => handleTestScan()}
                              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', borderRadius: 4 }}
                            >
                              Test Scan
                            </Button>
                          }
                        />
                      </div>

                      {/* Result Box */}
                      {testScanResult ? (
                        <div
                          style={{
                            backgroundColor: '#ecfdf5',
                            border: '1.5px solid #a7f3d0',
                            borderRadius: 8,
                            padding: 14,
                            marginBottom: 16
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <CheckCircleOutlined style={{ color: '#10b981', fontSize: 18 }} />
                            <Text strong style={{ color: '#065f46', fontSize: 14 }}>
                              Item Successfully Identified!
                            </Text>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                            {testScanResult.item.title}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            Barcode: <Text code>{testScanResult.item.barcode || 'N/A'}</Text> • Retail Rate: <Text strong style={{ color: '#16a34a' }}>Rs. {testScanResult.item.priRate || 0}</Text>
                          </div>
                        </div>
                      ) : testScanError ? (
                        <Alert
                          type="warning"
                          showIcon
                          message={testScanError}
                          style={{ marginBottom: 16, borderRadius: 8 }}
                        />
                      ) : (
                        <div
                          style={{
                            padding: 20,
                            textAlign: 'center',
                            backgroundColor: '#ffffff',
                            border: '1px dashed #cbd5e1',
                            borderRadius: 8,
                            marginBottom: 16
                          }}
                        >
                          <BarcodeOutlined style={{ fontSize: 32, color: '#94a3b8', marginBottom: 8 }} />
                          <div style={{ fontSize: 13, color: '#64748b' }}>
                            Ready for test scan. Scanner tone will sound when scanned.
                          </div>
                        </div>
                      )}

                      {/* Sample Products for Quick Testing */}
                      {testItems.filter(i => i.barcode).length > 0 && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                            Quick test with inventory items:
                          </Text>
                          <Space wrap size={[6, 6]}>
                            {testItems.filter(i => i.barcode).slice(0, 4).map(item => (
                              <Tag
                                key={item.id}
                                style={{
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  backgroundColor: '#ffffff',
                                  border: '1px solid #cbd5e1'
                                }}
                                onClick={() => handleTestScan(item.barcode)}
                              >
                                🔍 {item.title.slice(0, 15)}... ({item.barcode})
                              </Tag>
                            ))}
                          </Space>
                        </div>
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
