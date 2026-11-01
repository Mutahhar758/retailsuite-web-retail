import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Space,
  Row,
  Col,
  Tag,
  Divider,
  Upload,
  Spin,
  Alert,
  message,
  Tooltip
} from 'antd';
import {
  BankOutlined,
  SaveOutlined,
  LockOutlined,
  PhoneOutlined,
  MobileOutlined,
  MailOutlined,
  GlobalOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  DeleteOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  PictureOutlined,
  EyeOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { companyService, type CompanyDetailDto } from '../../services/companyService';
import { useAppStore } from '../../stores/useAppStore';
import { getPresentableUploadErrorMessage } from '../../utils/errorUtils';

const { Title, Text, Paragraph } = Typography;

export const CompanyInfoPage: React.FC = () => {
  const [form] = Form.useForm();
  const { licenses, currentTenantIdentifier, updateLicenseFeatures } = useAppStore();

  const currentOrg = licenses.find((l) => l.tenantIdentifier === currentTenantIdentifier);
  const fallbackOrgName = currentOrg?.name || 'Retail Store';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [companyName, setCompanyName] = useState<string>(fallbackOrgName);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Watch form values for live preview
  const watchedValues = Form.useWatch([], form);

  const loadCompanyInfo = useCallback(async () => {
    setLoading(true);
    try {
      const data: CompanyDetailDto = await companyService.getCurrent();
      const resolvedName = data.companyName?.trim() || fallbackOrgName;
      setCompanyName(resolvedName);

      if (currentTenantIdentifier && data.companyName?.trim() && data.companyName.trim() !== currentOrg?.name) {
        updateLicenseFeatures(currentTenantIdentifier, { name: data.companyName.trim() });
      }

      form.setFieldsValue({
        urCompanyName: data.urCompanyName || '',
        descr: data.descr || '',
        contactHeader: data.contactHeader || '',
        address: data.address || '',
        phone: data.phone || '',
        cell: data.cell || '',
        cell2: data.cell2 || '',
        email: data.email || '',
        website: data.website || '',
        ntn: data.ntn || '',
        strn: data.strn || '',
        logoMediaId: data.logoMediaId || ''
      });

      setLogoUrl(data.logoUrl || null);
    } catch (err: any) {
      console.error('Failed to load company info', err);
      message.error('Failed to load company information.');
    } finally {
      setLoading(false);
    }
  }, [fallbackOrgName, currentTenantIdentifier, currentOrg?.name, updateLicenseFeatures, form]);

  useEffect(() => {
    loadCompanyInfo();
  }, [loadCompanyInfo]);

  const handleLogoUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      setUploadingLogo(true);
      const { fileId, uploadUrl } = await companyService.getLogoUploadUrl(file.name);

      const formData = new FormData();
      formData.append('File', file);

      await axios.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      form.setFieldsValue({ logoMediaId: fileId });
      const localPreviewUrl = URL.createObjectURL(file);
      setLogoUrl(localPreviewUrl);

      message.success('Company logo uploaded! Click "Save Company Info" to apply.');
      onSuccess?.('ok');
    } catch (err: any) {
      console.error('Logo upload error:', err);
      message.error(getPresentableUploadErrorMessage(err, 'Unable to upload company logo. Please try again.'));
      onError?.(err as Error);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    form.setFieldsValue({ logoMediaId: '' });
    setLogoUrl(null);
    message.info('Logo removed. Click "Save Company Info" to save changes.');
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const updated = await companyService.updateCurrent({
        urCompanyName: values.urCompanyName?.trim() || '',
        descr: values.descr?.trim() || '',
        contactHeader: values.contactHeader?.trim() || '',
        address: values.address?.trim() || '',
        phone: values.phone?.trim() || '',
        cell: values.cell?.trim() || '',
        cell2: values.cell2?.trim() || '',
        email: values.email?.trim() || '',
        website: values.website?.trim() || '',
        ntn: values.ntn?.trim() || '',
        strn: values.strn?.trim() || '',
        logoMediaId: values.logoMediaId || ''
      });

      if (updated?.companyName) {
        setCompanyName(updated.companyName);
      }
      if (updated?.logoUrl) {
        setLogoUrl(updated.logoUrl);
      } else if (!values.logoMediaId) {
        setLogoUrl(null);
      }

      setLastSavedTime(new Date().toLocaleTimeString());
      message.success('Company information saved successfully!');
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.metadata?.message || err?.response?.data?.message || 'Failed to save company information.');
    } finally {
      setSaving(false);
    }
  };

  const previewUrName = watchedValues?.urCompanyName?.trim();
  const previewDescr = watchedValues?.descr?.trim();
  const previewContactHeader = watchedValues?.contactHeader?.trim();
  const previewAddress = watchedValues?.address?.trim();
  const previewPhone = watchedValues?.phone?.trim();
  const previewCell = watchedValues?.cell?.trim();
  const previewCell2 = watchedValues?.cell2?.trim();
  const previewEmail = watchedValues?.email?.trim();
  const previewWebsite = watchedValues?.website?.trim();
  const previewNtn = watchedValues?.ntn?.trim();
  const previewStrn = watchedValues?.strn?.trim();

  const phoneLineParts = [
    previewPhone ? `Tel: ${previewPhone}` : null,
    previewCell ? `Mob: ${previewCell}` : null,
    previewCell2 ? `Cell/WA: ${previewCell2}` : null
  ].filter(Boolean);

  const taxLineParts = [
    previewNtn ? `NTN: ${previewNtn}` : null,
    previewStrn ? `STRN: ${previewStrn}` : null
  ].filter(Boolean);

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', paddingBottom: 40 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24
        }}
      >
        <Space align="center" size={14}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: '#e6f4ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1677ff',
              fontSize: 24
            }}
          >
            <BankOutlined />
          </div>
          <div>
            <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
              Company Information
            </Title>
            <Text type="secondary">
              Configure your company logo, address, phone numbers, tax registration, and business details
            </Text>
          </div>
        </Space>

        <Space size={12}>
          {lastSavedTime && (
            <Tag icon={<CheckCircleOutlined />} color="success" style={{ padding: '4px 10px', fontSize: 13 }}>
              Saved at {lastSavedTime}
            </Tag>
          )}
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            style={{
              fontWeight: 600,
              borderRadius: 8,
              paddingLeft: 24,
              paddingRight: 24
            }}
          >
            Save Company Info
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="logoMediaId" noStyle>
            <Input type="hidden" />
          </Form.Item>

          <Row gutter={[24, 24]}>
            {/* Left Column: Form Sections */}
            <Col xs={24} lg={15}>
              {/* 1. Organization Identity */}
              <Card
                className="shadow-sm border-gray-100 rounded-xl"
                style={{ marginBottom: 24 }}
                title={
                  <Space>
                    <BankOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                    <span style={{ fontWeight: 600 }}>Organization Identity</span>
                  </Space>
                }
                extra={
                  <Tag icon={<LockOutlined />} color="blue">
                    Company Name Managed by BOP
                  </Tag>
                }
              >
                <Alert
                  type="info"
                  showIcon
                  icon={<LockOutlined />}
                  message="Organization Name is centrally managed by the Back Office Portal (BOP)"
                  description="To maintain license and multi-tenant consistency, the primary Company Name is managed in BOP. You can freely customize your logo, Urdu title, tagline, address, phones, and tax details below."
                  style={{ marginBottom: 20, borderRadius: 8 }}
                />

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label={
                        <Space size={6}>
                          <Text strong>Company Name</Text>
                          <Tooltip title="Managed by BOP administrator">
                            <Tag color="default" style={{ fontSize: 11, margin: 0 }}>
                              <LockOutlined /> Read-Only
                            </Tag>
                          </Tooltip>
                        </Space>
                      }
                    >
                      <Input
                        value={companyName}
                        disabled
                        prefix={<BankOutlined style={{ color: '#94a3b8' }} />}
                        suffix={<LockOutlined style={{ color: '#94a3b8' }} />}
                        style={{
                          borderRadius: 8,
                          fontWeight: 600,
                          backgroundColor: '#f8fafc',
                          color: '#334155'
                        }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="urCompanyName"
                      label={<Text strong>Urdu Company Name / Subtitle</Text>}
                      extra="Optional Urdu name or secondary title"
                    >
                      <Input
                        dir="rtl"
                        placeholder="مثلاً رحمان ٹریڈرز اینڈ جنرل سٹور"
                        maxLength={200}
                        style={{ borderRadius: 8, fontSize: 15 }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="descr"
                      label={<Text strong>Business Tagline / Description</Text>}
                      extra="e.g. Wholesale & Retail Dealers in General Merchandise"
                    >
                      <Input
                        prefix={<FileTextOutlined style={{ color: '#94a3b8' }} />}
                        placeholder="e.g. Wholesale & Retail Dealers"
                        maxLength={250}
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="contactHeader"
                      label={<Text strong>Contact Header / Proprietor Line</Text>}
                      extra="e.g. Prop: M. Ahmed | Main Market Branch"
                    >
                      <Input
                        placeholder="e.g. Main Branch / Proprietor Info"
                        maxLength={200}
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              {/* 2. Contact & Location Information */}
              <Card
                className="shadow-sm border-gray-100 rounded-xl"
                style={{ marginBottom: 24 }}
                title={
                  <Space>
                    <EnvironmentOutlined style={{ color: '#16a34a', fontSize: 18 }} />
                    <span style={{ fontWeight: 600 }}>Address & Contact Numbers</span>
                  </Space>
                }
              >
                <Row gutter={16}>
                  <Col xs={24}>
                    <Form.Item
                      name="address"
                      label={<Text strong>Company Address</Text>}
                    >
                      <Input.TextArea
                        rows={3}
                        autoComplete="street-address"
                        placeholder="Enter shop, office, or warehouse street address, city, and postal area..."
                        maxLength={500}
                        showCount
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      name="phone"
                      label={<Text strong>Company Phone (Landline)</Text>}
                    >
                      <Input
                        type="tel"
                        autoComplete="tel"
                        prefix={<PhoneOutlined style={{ color: '#1677ff' }} />}
                        placeholder="e.g. 042-35761234"
                        maxLength={50}
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      name="cell"
                      label={<Text strong>Mobile / Cell Number 1</Text>}
                    >
                      <Input
                        type="tel"
                        autoComplete="tel"
                        prefix={<MobileOutlined style={{ color: '#16a34a' }} />}
                        placeholder="e.g. 0300-1234567"
                        maxLength={50}
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      name="cell2"
                      label={<Text strong>Secondary Mobile / WhatsApp</Text>}
                    >
                      <Input
                        type="tel"
                        autoComplete="tel"
                        prefix={<MobileOutlined style={{ color: '#0ea5e9' }} />}
                        placeholder="e.g. 0321-7654321"
                        maxLength={50}
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="email"
                      label={<Text strong>Company Email Address</Text>}
                      rules={[{ type: 'email', message: 'Please enter a valid email address' }]}
                    >
                      <Input
                        type="email"
                        autoComplete="email"
                        prefix={<MailOutlined style={{ color: '#64748b' }} />}
                        placeholder="e.g. info@yourcompany.com"
                        maxLength={150}
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="website"
                      label={<Text strong>Website URL</Text>}
                    >
                      <Input
                        type="url"
                        autoComplete="url"
                        prefix={<GlobalOutlined style={{ color: '#64748b' }} />}
                        placeholder="e.g. https://www.yourcompany.com"
                        maxLength={200}
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              {/* 3. Tax & Legal Registration */}
              <Card
                className="shadow-sm border-gray-100 rounded-xl"
                title={
                  <Space>
                    <SafetyCertificateOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
                    <span style={{ fontWeight: 600 }}>Tax & Registration Info</span>
                  </Space>
                }
              >
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="ntn"
                      label={<Text strong>NTN (National Tax Number)</Text>}
                      extra="Optional tax registration number"
                    >
                      <Input
                        placeholder="e.g. 1234567-8"
                        maxLength={50}
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="strn"
                      label={<Text strong>STRN / GST Registration Number</Text>}
                      extra="Optional sales tax registration number"
                    >
                      <Input
                        placeholder="e.g. 32-77-8761-001-45"
                        maxLength={50}
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider style={{ margin: '12px 0 16px' }} />

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={handleSave}
                    style={{
                      fontWeight: 600,
                      borderRadius: 8,
                      paddingLeft: 28,
                      paddingRight: 28
                    }}
                  >
                    Save Company Info
                  </Button>
                </div>
              </Card>
            </Col>

            {/* Right Column: Company Logo & Live Preview */}
            <Col xs={24} lg={9}>
              {/* Logo Upload Card */}
              <Card
                className="shadow-sm border-gray-100 rounded-xl"
                style={{ marginBottom: 24 }}
                title={
                  <Space>
                    <PictureOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                    <span style={{ fontWeight: 600 }}>Company Logo</span>
                  </Space>
                }
              >
                <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
                  Upload your official company or store logo (PNG, JPG, or WEBP recommended).
                </Paragraph>

                <div
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: 12,
                    backgroundColor: '#f8fafc',
                    padding: 24,
                    textAlign: 'center',
                    marginBottom: 16,
                    minHeight: 180,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {uploadingLogo ? (
                    <Space direction="vertical" align="center">
                      <LoadingOutlined style={{ fontSize: 32, color: '#1677ff' }} />
                      <Text type="secondary">Uploading logo...</Text>
                    </Space>
                  ) : logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Company Logo"
                      style={{
                        maxWidth: '100%',
                        maxHeight: 140,
                        objectFit: 'contain',
                        borderRadius: 6
                      }}
                    />
                  ) : (
                    <Space direction="vertical" align="center" size={6}>
                      <PictureOutlined style={{ fontSize: 42, color: '#94a3b8' }} />
                      <Text strong style={{ color: '#475569' }}>
                        No Company Logo Uploaded
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Recommended size: 300x120 px or square emblem
                      </Text>
                    </Space>
                  )}
                </div>

                <Space style={{ width: '100%', justifyContent: 'center' }} size={12}>
                  <Upload
                    name="logo"
                    showUploadList={false}
                    customRequest={handleLogoUpload}
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  >
                    <Button
                      type="primary"
                      ghost
                      icon={<UploadOutlined />}
                      loading={uploadingLogo}
                      style={{ borderRadius: 8 }}
                    >
                      {logoUrl ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                  </Upload>

                  {logoUrl && (
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={handleRemoveLogo}
                      disabled={uploadingLogo}
                      style={{ borderRadius: 8 }}
                    >
                      Remove
                    </Button>
                  )}
                </Space>
              </Card>

              {/* Live Company Profile / Letterhead Preview */}
              <Card
                className="shadow-sm border-gray-100 rounded-xl"
                style={{ backgroundColor: '#f8fafc' }}
                title={
                  <Space>
                    <EyeOutlined style={{ color: '#0ea5e9', fontSize: 18 }} />
                    <span style={{ fontWeight: 600 }}>Company Header Preview</span>
                  </Space>
                }
              >
                <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 14 }}>
                  Live preview of your organization profile card:
                </Paragraph>

                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: 20,
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
                    textAlign: 'center'
                  }}
                >
                  {logoUrl && (
                    <div style={{ marginBottom: 12 }}>
                      <img
                        src={logoUrl}
                        alt="Logo Preview"
                        style={{
                          maxHeight: 68,
                          maxWidth: 180,
                          objectFit: 'contain',
                          margin: '0 auto'
                        }}
                      />
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#0f172a',
                      letterSpacing: '0.02em',
                      lineHeight: 1.3
                    }}
                  >
                    {companyName}
                  </div>

                  {previewUrName && (
                    <div
                      dir="rtl"
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#334155',
                        marginTop: 4
                      }}
                    >
                      {previewUrName}
                    </div>
                  )}

                  {previewDescr && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#475569',
                        fontWeight: 500,
                        marginTop: 4
                      }}
                    >
                      {previewDescr}
                    </div>
                  )}

                  {previewContactHeader && (
                    <div
                      style={{
                        fontSize: 11,
                        color: '#64748b',
                        marginTop: 2
                      }}
                    >
                      {previewContactHeader}
                    </div>
                  )}

                  <Divider style={{ margin: '12px 0' }} />

                  {previewAddress ? (
                    <div style={{ fontSize: 12, color: '#334155', marginBottom: 6 }}>
                      <EnvironmentOutlined style={{ marginRight: 5, color: '#16a34a' }} />
                      {previewAddress}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 6 }}>
                      Address not set
                    </div>
                  )}

                  {phoneLineParts.length > 0 && (
                    <div style={{ fontSize: 12, color: '#334155', fontWeight: 500, marginBottom: 4 }}>
                      {phoneLineParts.join('  •  ')}
                    </div>
                  )}

                  {(previewEmail || previewWebsite) && (
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                      {[previewEmail, previewWebsite].filter(Boolean).join('  |  ')}
                    </div>
                  )}

                  {taxLineParts.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {taxLineParts.map((part, idx) => (
                        <Tag key={idx} color="geekblue" style={{ fontSize: 11 }}>
                          {part}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          </Row>
        </Form>
      </Spin>
    </div>
  );
};
