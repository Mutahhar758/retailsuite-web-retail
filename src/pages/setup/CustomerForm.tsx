import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, Button, Space, Typography, Form, Input, Row, Col, Checkbox, 
  message, Divider, Avatar, Tag, Upload
} from 'antd';
import { 
  SaveOutlined, ArrowLeftOutlined, UserOutlined, CameraOutlined,
  MailOutlined, PhoneOutlined, AuditOutlined, BankOutlined, LoadingOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { customerService, type CustomerCreateRequest, type CustomerUpdateRequest } from '../../services/customerService';

const { Title, Text } = Typography;

export const CustomerForm: React.FC = () => {
  const { account } = useParams<{ account: string }>();
  const isEdit = !!account && account !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [customerTitle, setCustomerTitle] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      if (isEdit) {
        // Fetch current customer list to extract details for editing
        const customers = await customerService.getCustomers();
        const customer = customers.find(c => c.account === account);
        
        if (customer) {
          setCustomerTitle(customer.title);
          form.setFieldsValue({
            title: customer.title,
            email: customer.email,
            fax: customer.fax,
            cnic: customer.cnic,
            address: customer.address,
            qualification: customer.qualification,
            phone1: customer.phone1,
            phone2: customer.phone2,
            smsNumber: customer.smsNumber,
            iban: customer.iban,
            smsAlert: customer.smsAlert,
            emailAlert: customer.emailAlert,
            active: customer.active,
            mediaId: customer.mediaId,
          });
          if (customer.mediaUrl) {
            setImageUrl(customer.mediaUrl);
          }
        } else {
          message.error('Customer not found');
          navigate('/setup/customers');
        }
      }
    } catch (error) {
      message.error('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  }, [account, isEdit, navigate, form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (isEdit) {
        // Update Customer - name can be updated, code remains immutable
        const updateRequest: CustomerUpdateRequest = {
          title: values.title,
          email: values.email || null,
          fax: values.fax || null,
          cnic: values.cnic || null,
          address: values.address || null,
          qualification: values.qualification || null,
          phone1: values.phone1 || null,
          phone2: values.phone2 || null,
          smsNumber: values.smsNumber || null,
          iban: values.iban || null,
          smsAlert: !!values.smsAlert,
          emailAlert: !!values.emailAlert,
          active: values.active !== undefined ? values.active : true,
          mediaId: values.mediaId || null,
        };

        await customerService.update(account, updateRequest);
        message.success('Customer details updated successfully');
      } else {
        // Create Customer - unified backend creation (Chart of Account & Details)
        const createRequest: CustomerCreateRequest = {
          title: values.title,
          email: values.email || null,
          fax: values.fax || null,
          cnic: values.cnic || null,
          address: values.address || null,
          qualification: values.qualification || null,
          phone1: values.phone1 || null,
          phone2: values.phone2 || null,
          smsNumber: values.smsNumber || null,
          iban: values.iban || null,
          smsAlert: !!values.smsAlert,
          emailAlert: !!values.emailAlert,
          active: values.active !== undefined ? values.active : true,
          mediaId: values.mediaId || null,
        };

        const generatedAccountCode = await customerService.create(createRequest);
        message.success(`Customer created successfully with Account Code: ${generatedAccountCode}`);
      }

      navigate('/setup/customers');
    } catch (error: any) {
      console.error('Validation or API failed:', error);
      if (error.errorFields) {
        message.error('Please resolve validation errors before saving.');
      } else {
        message.error(error.response?.data?.message || 'Failed to save customer');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCustomUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      setUploading(true);
      const { fileId, uploadUrl } = await customerService.getPresignedUploadUrl(file.name);
      
      const formData = new FormData();
      formData.append('File', file);
      
      await axios.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      form.setFieldsValue({ mediaId: fileId });
      
      const localUrl = URL.createObjectURL(file);
      setImageUrl(localUrl);
      
      message.success('Avatar uploaded successfully');
      onSuccess?.("ok");
    } catch (err) {
      console.error(err);
      message.error('Failed to upload avatar');
      onError?.(err as Error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      {/* Form Header */}
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/setup/customers')} 
          />
          <UserOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit Customer: ${customerTitle}` : 'Create New Customer'}
            </Title>
            <Text type="secondary">
              {isEdit 
                ? `Update detailed configuration for customer account ${account}` 
                : 'Configure a new customer record and automatically create its ledger account'}
            </Text>
          </div>
        </Space>
        <Space>
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave} 
            loading={loading}
            style={{ backgroundColor: '#1677ff', borderColor: '#1677ff' }}
          >
            {isEdit ? 'Update Customer' : 'Save Customer'}
          </Button>
        </Space>
      </div>

      <Divider style={{ margin: '16px 0 24px 0' }} />

      <Form
        form={form}
        layout="vertical"
        initialValues={{ active: true, smsAlert: false, emailAlert: false }}
      >
        {/* Hidden field to bind mediaId to form submit values */}
        <Form.Item name="mediaId" noStyle><Input type="hidden" /></Form.Item>

        <Row gutter={24}>
          {/* Left Column: Avatar Display & Action Placeholder */}
          <Col xs={24} md={6} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <div className="text-center">
              <Text strong className="block mb-3">Customer Avatar</Text>
              <Upload
                accept="image/*"
                showUploadList={false}
                customRequest={handleCustomUpload}
                disabled={uploading}
                style={{ width: '130px', height: '130px', display: 'block' }}
              >
                <div 
                  style={{ 
                    position: 'relative', 
                    width: '130px', 
                    height: '130px', 
                    borderRadius: '50%', 
                    overflow: 'hidden',
                    border: '3px solid #1677ff20',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f5f5f5'
                  }}
                  className="group transition-all hover:border-blue-400"
                >
                  <Avatar 
                    size={120} 
                    src={imageUrl || undefined}
                    icon={!imageUrl && (uploading ? <LoadingOutlined style={{ fontSize: '40px' }} /> : <UserOutlined style={{ fontSize: '60px', color: '#bfbfbf' }} />)} 
                    style={{ backgroundColor: '#fafafa' }}
                  />
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      right: 0, 
                      bottom: 0, 
                      backgroundColor: 'rgba(0, 0, 0, 0.5)', 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.3s ease-in-out'
                    }}
                    className="hover-overlay"
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.opacity = '0';
                    }}
                  >
                    <CameraOutlined style={{ color: '#fff', fontSize: '24px', marginBottom: '4px' }} />
                    <Text style={{ color: '#fff', fontSize: '11px' }}>{imageUrl ? 'Change Photo' : 'Upload Photo'}</Text>
                  </div>
                </div>
              </Upload>
              <div style={{ marginTop: '12px' }}>
                <Tag color="blue" className="rounded-full">{uploading ? 'Uploading...' : 'Click to Upload'}</Tag>
              </div>
              
              {isEdit && (
                <div style={{ marginTop: '16px' }} className="flex flex-col items-center">
                  <Text type="secondary" style={{ fontSize: '12px' }}>Account Number</Text>
                  <Text strong style={{ fontFamily: 'monospace', fontSize: '15px', color: '#1677ff' }} className="block mt-1">
                    {account}
                  </Text>
                </div>
              )}
            </div>
          </Col>

          {/* Right Column: Form Inputs */}
          <Col xs={24} md={18}>
            {/* Section 1: Basic Identity */}
            <Card 
              size="small" 
              title={
                <Space>
                  <AuditOutlined style={{ color: '#1677ff' }} />
                  <Text strong>Identity & Ledger Info</Text>
                </Space>
              }
              className="bg-gray-50 border-gray-200 mb-6 rounded-lg shadow-sm"
              style={{ background: '#fafafa' }}
            >
              <Row gutter={16}>
                <Col xs={24} md={isEdit ? 12 : 24}>
                  <Form.Item
                    name="title"
                    label="Customer Full Name (Ledger Title)"
                    rules={[{ required: true, message: 'Customer name is required' }]}
                  >
                    <Input placeholder="e.g. Al-Syed Jewelers" />
                  </Form.Item>
                </Col>
                {isEdit && (
                  <Col xs={24} md={12}>
                    <Form.Item label="Account Ledger Code">
                      <Input value={account} disabled style={{ fontFamily: 'monospace', fontWeight: 'bold' }} />
                    </Form.Item>
                  </Col>
                )}
              </Row>
              {!isEdit && (
                <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                  💡 An appropriate Level 5 Detail Account will be automatically generated in your Chart of Accounts under the primary Customers head on save.
                </Text>
              )}
            </Card>

            {/* Section 2: Contact & Demographics */}
            <Title level={5} className="mb-4">Profile & Contact Information</Title>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="email"
                  label="Email Address"
                  rules={[{ type: 'email', message: 'Please enter a valid email' }]}
                >
                  <Input prefix={<MailOutlined className="text-gray-400" />} placeholder="customer@example.com" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="cnic"
                  label="National ID Card Number (CNIC)"
                >
                  <Input placeholder="e.g. 42101-1234567-1" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="qualification"
                  label="Qualification"
                >
                  <Input placeholder="e.g. Graduate, Business Owner" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="fax"
                  label="Fax Number"
                >
                  <Input placeholder="e.g. +92 21 34567890" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={24}>
                <Form.Item
                  name="address"
                  label="Postal / Delivery Address"
                >
                  <Input.TextArea rows={2} placeholder="Enter full street, city, and country address" />
                </Form.Item>
              </Col>
            </Row>

            <Title level={5} className="mb-4 mt-6">Communication Channels & Alerts</Title>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="phone1"
                  label="Primary Phone Number"
                  rules={[{ required: true, message: 'Primary phone is required' }]}
                >
                  <Input prefix={<PhoneOutlined className="text-gray-400" />} placeholder="e.g. +92 300 1234567" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="phone2"
                  label="Alternate Phone Number"
                >
                  <Input prefix={<PhoneOutlined className="text-gray-400" />} placeholder="e.g. +92 21 3123456" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="smsNumber"
                  label="SMS Broadcast Number"
                >
                  <Input prefix={<PhoneOutlined className="text-gray-400" />} placeholder="e.g. +92 321 9876543" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={24}>
                <div style={{ padding: '16px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '8px' }}>
                  <Space size="large" className="w-full flex justify-between flex-wrap">
                    <Form.Item name="smsAlert" valuePropName="checked" noStyle>
                      <Checkbox>Enable SMS Alerts & Reminders</Checkbox>
                    </Form.Item>
                    <Form.Item name="emailAlert" valuePropName="checked" noStyle>
                      <Checkbox>Enable Email Statements</Checkbox>
                    </Form.Item>
                    <Form.Item name="active" valuePropName="checked" noStyle>
                      <Checkbox>Account Active</Checkbox>
                    </Form.Item>
                  </Space>
                </div>
              </Col>
            </Row>

            <Title level={5} className="mb-4 mt-6">Financial Settlement</Title>
            <Row gutter={16}>
              <Col xs={24} md={24}>
                <Form.Item
                  name="iban"
                  label="International Bank Account Number (IBAN)"
                >
                  <Input prefix={<BankOutlined className="text-gray-400" />} placeholder="e.g. PK00 UNIL 0123 4567 8901 2345" />
                </Form.Item>
              </Col>
            </Row>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};
