import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, Button, Space, Typography, Form, Input, Row, Col, 
  Select, DatePicker, InputNumber, message, Divider, Avatar, Tag, Upload
} from 'antd';
import { 
  SaveOutlined, ArrowLeftOutlined, CameraOutlined,
  UserOutlined, DollarOutlined, 
  SolutionOutlined, IdcardOutlined, AccountBookOutlined,
  AuditOutlined, LoadingOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import axios from 'axios';
import { hrInfoService, type HRInfoUpsertRequest } from '../../services/hrInfoService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;

export const HRInfoForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [employeeName, setEmployeeName] = useState<string>('');
  const [accounts, setAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch Lookups and Employee Data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch Chart of Account Level 5 detail accounts for payroll mapping
      const accountsRes = await chartOfAccountService.getDetailAccounts();
      setAccounts(accountsRes || []);

      if (isEdit) {
        const emp = await hrInfoService.getById(id!);
        if (emp) {
          setEmployeeName(emp.name);
          form.setFieldsValue({
            name: emp.name,
            fatherName: emp.fatherName,
            gender: emp.gender,
            dob: emp.dob ? dayjs(emp.dob) : null,
            maritialStatus: emp.maritialStatus, // Backend: maritialStatus
            cnic: emp.cnic,
            appointmentDate: emp.appointmentDate ? dayjs(emp.appointmentDate) : null,
            joiningDate: emp.joiningDate ? dayjs(emp.joiningDate) : null,
            designation: emp.designation,
            salaryType: emp.salaryType,
            salary: emp.salary,
            leaveCharges: emp.leaveCharges,
            overtime: emp.overtime,
            expenseAccount: emp.expenseAccount || null,
            payableAccount: emp.payableAccount || null,
            mediaId: emp.mediaId || null,
          });
          if (emp.mediaUrl) {
            setImageUrl(emp.mediaUrl);
          }
        } else {
          message.error('Employee record not found');
          navigate('/setup/hr-info');
        }
      }
    } catch (error) {
      message.error('Failed to load form lookups or employee data');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, navigate, form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const requestPayload: HRInfoUpsertRequest = {
        name: values.name,
        fatherName: values.fatherName || null,
        gender: values.gender,
        dob: values.dob ? values.dob.format('YYYY-MM-DD') : null,
        maritialStatus: values.maritialStatus || null, // Backend: maritialStatus
        cnic: values.cnic || null,
        appointmentDate: values.appointmentDate ? values.appointmentDate.format('YYYY-MM-DD') : null,
        joiningDate: values.joiningDate ? values.joiningDate.format('YYYY-MM-DD') : null,
        designation: values.designation || null,
        salaryType: values.salaryType,
        salary: values.salary || 0,
        leaveCharges: values.leaveCharges || 0,
        overtime: values.overtime || 0,
        expenseAccount: values.expenseAccount || null,
        payableAccount: values.payableAccount || null,
        mediaId: values.mediaId || null,
      };

      if (isEdit) {
        await hrInfoService.update(id!, requestPayload);
        message.success('Employee HR information updated successfully');
      } else {
        await hrInfoService.create(requestPayload);
        message.success('Employee HR information created successfully');
      }

      navigate('/setup/hr-info');
    } catch (error: any) {
      console.error('Validation or API failed:', error);
      if (error.errorFields) {
        message.error('Please resolve validation errors before saving.');
      } else {
        message.error(error.response?.data?.message || 'Failed to save employee HR information');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCustomUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      setUploading(true);
      const { fileId, uploadUrl } = await hrInfoService.getPresignedUploadUrl(file.name);
      
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
      
      message.success('Employee photograph uploaded successfully');
      onSuccess?.("ok");
    } catch (err) {
      console.error(err);
      message.error('Failed to upload employee photograph');
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
            onClick={() => navigate('/setup/hr-info')} 
          />
          <SolutionOutlined style={{ fontSize: 24, color: '#13c2c2' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit HR Info: ${employeeName}` : 'Create Employee HR Info'}
            </Title>
            <Text type="secondary">
              {isEdit 
                ? `Update complete record for employee ${id}` 
                : 'Configure a new employee file with demographic details and payroll account integration'}
            </Text>
          </div>
        </Space>
        <Space>
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave} 
            loading={loading}
            style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
          >
            {isEdit ? 'Update HR Record' : 'Save HR Record'}
          </Button>
        </Space>
      </div>

      <Divider style={{ margin: '16px 0 24px 0' }} />

      <Form
        form={form}
        layout="vertical"
        initialValues={{ 
          gender: 'Male', 
          maritialStatus: 'Single', 
          salaryType: 'Monthly',
          salary: 0,
          leaveCharges: 0,
          overtime: 0
        }}
      >
        {/* Hidden field to bind mediaId to form submit values */}
        <Form.Item name="mediaId" noStyle><Input type="hidden" /></Form.Item>

        <Row gutter={24}>
          {/* Left Column: Avatar & Summary */}
          <Col xs={24} md={6} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <div className="text-center">
              <Text strong className="block mb-3">Employee Photograph</Text>
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
                    border: '3px solid #13c2c220',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f5f5f5'
                  }}
                  className="group transition-all hover:border-teal-400"
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
                <Tag color="cyan" className="rounded-full">{uploading ? 'Uploading...' : 'Click to Upload'}</Tag>
              </div>
              
              {isEdit && (
                <div style={{ marginTop: '24px' }} className="flex flex-col items-center">
                  <Text type="secondary" style={{ fontSize: '12px' }}>Employee System ID</Text>
                  <Text strong style={{ fontFamily: 'monospace', fontSize: '18px', color: '#13c2c2' }} className="block mt-1">
                    {id}
                  </Text>
                </div>
              )}
            </div>
          </Col>

          {/* Right Column: Form Inputs grouped by sections */}
          <Col xs={24} md={18}>
            
            {/* Section 1: Personal Details */}
            <Card 
              size="small" 
              title={
                <Space>
                  <UserOutlined style={{ color: '#13c2c2' }} />
                  <Text strong>1. Personal Information</Text>
                </Space>
              }
              className="bg-gray-50 border-gray-200 mb-6 rounded-lg shadow-xs"
              style={{ background: '#fafafa', marginBottom: '24px' }}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="name"
                    label="Full Name"
                    rules={[{ required: true, message: 'Employee name is required' }]}
                  >
                    <Input placeholder="Enter employee first & last name" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="fatherName"
                    label="Father's / Guardian Name"
                  >
                    <Input placeholder="Enter father's or husband's name" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="gender"
                    label="Gender"
                    rules={[{ required: true, message: 'Gender is required' }]}
                  >
                    <Select placeholder="Select gender">
                      <Select.Option value="Male">Male</Select.Option>
                      <Select.Option value="Female">Female</Select.Option>
                      <Select.Option value="Other">Other</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="dob"
                    label="Date of Birth"
                    rules={[{ required: true, message: 'Date of birth is required' }]}
                  >
                    <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="maritialStatus"
                    label="Marital Status"
                  >
                    <Select placeholder="Select status">
                      <Select.Option value="Single">Single</Select.Option>
                      <Select.Option value="Married">Married</Select.Option>
                      <Select.Option value="Divorced">Divorced</Select.Option>
                      <Select.Option value="Widowed">Widowed</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={24}>
                  <Form.Item
                    name="cnic"
                    label="National Identity Number (CNIC)"
                  >
                    <Input prefix={<IdcardOutlined className="text-gray-400" />} placeholder="e.g. 42101-1234567-1" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Section 2: Employment Setup */}
            <Card 
              size="small" 
              title={
                <Space>
                  <AuditOutlined style={{ color: '#13c2c2' }} />
                  <Text strong>2. Professional & Placement Details</Text>
                </Space>
              }
              className="bg-gray-50 border-gray-200 mb-6 rounded-lg shadow-xs"
              style={{ background: '#fafafa', marginBottom: '24px' }}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="designation"
                    label="Designation / Role"
                  >
                    <Input placeholder="e.g. Head Accountant, Store Manager" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="appointmentDate"
                    label="Appointment Date"
                    rules={[{ required: true, message: 'Appointment date is required' }]}
                  >
                    <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="joiningDate"
                    label="Official Joining Date"
                    rules={[{ required: true, message: 'Joining date is required' }]}
                  >
                    <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Section 3: Compensation */}
            <Card 
              size="small" 
              title={
                <Space>
                  <DollarOutlined style={{ color: '#13c2c2' }} />
                  <Text strong>3. Compensation Structure</Text>
                </Space>
              }
              className="bg-gray-50 border-gray-200 mb-6 rounded-lg shadow-xs"
              style={{ background: '#fafafa', marginBottom: '24px' }}
            >
              <Row gutter={16}>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="salaryType"
                    label="Payment Frequency"
                    rules={[{ required: true, message: 'Payment frequency is required' }]}
                  >
                    <Select placeholder="Select type">
                      <Select.Option value="Monthly">Monthly</Select.Option>
                      <Select.Option value="Weekly">Weekly</Select.Option>
                      <Select.Option value="Daily">Daily</Select.Option>
                      <Select.Option value="Hourly">Hourly</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="salary"
                    label="Salary Rate (PKR)"
                    rules={[{ required: true, message: 'Salary is required' }]}
                  >
                    <InputNumber 
                      style={{ width: '100%' }} 
                      min={0} 
                      placeholder="e.g. 50,000"
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="leaveCharges"
                    label="Deduction per Leave (PKR)"
                  >
                    <InputNumber 
                      style={{ width: '100%' }} 
                      min={0} 
                      placeholder="e.g. 1,000"
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="overtime"
                    label="Overtime Rate / Hour (PKR)"
                  >
                    <InputNumber 
                      style={{ width: '100%' }} 
                      min={0} 
                      placeholder="e.g. 500"
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Section 4: Chart of Accounts Links */}
            <Card 
              size="small" 
              title={
                <Space>
                  <AccountBookOutlined style={{ color: '#13c2c2' }} />
                  <Text strong>4. General Ledger Alignment</Text>
                </Space>
              }
              className="bg-gray-50 border-gray-200 mb-6 rounded-lg shadow-xs"
              style={{ background: '#fafafa' }}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="expenseAccount"
                    label="Expense Ledger Account"
                    help="Select the Level 5 expense account where salary disbursements will be debited."
                  >
                    <Select 
                      showSearch 
                      placeholder="Search and select detail expense account..." 
                      allowClear
                      optionFilterProp="children"
                    >
                      {accounts.map(acc => (
                        <Select.Option key={acc.account} value={acc.account}>
                          {acc.account} - {acc.title}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="payableAccount"
                    label="Payable / Liability Ledger Account"
                    help="Select the Level 5 payable account where outstanding salary liabilities are recorded."
                  >
                    <Select 
                      showSearch 
                      placeholder="Search and select detail payable account..." 
                      allowClear
                      optionFilterProp="children"
                    >
                      {accounts.map(acc => (
                        <Select.Option key={acc.account} value={acc.account}>
                          {acc.account} - {acc.title}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

          </Col>
        </Row>
      </Form>
    </Card>
  );
};
