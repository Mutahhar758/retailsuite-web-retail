import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, Button, Space, Typography, Form, Input, Row, Col, Checkbox, 
  message, Divider, Avatar, Upload, Table, InputNumber, Select
} from 'antd';
import { 
  SaveOutlined, ArrowLeftOutlined, UserOutlined, CameraOutlined,
  MailOutlined, PhoneOutlined, BankOutlined, LoadingOutlined,
  PlusOutlined, DeleteOutlined, ShoppingCartOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { customerService, type CustomerCreateRequest, type CustomerUpdateRequest, type CustomerSupplyItemDto } from '../../services/customerService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { useAppStore } from '../../stores/useAppStore';


const { Title, Text } = Typography;

interface SupplyLineRow {
  key: any;
  itemId: string;
  qty: number;
  secQty?: number;
}

export const CustomerForm: React.FC = () => {
  const { account } = useParams<{ account: string }>();
  const isEdit = !!account && account !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const hasSecondaryQty = currentOrg?.hasSecondaryQty ?? false;

  const [loading, setLoading] = useState(false);
  const [customerTitle, setCustomerTitle] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [supplyLines, setSupplyLines] = useState<SupplyLineRow[]>([]);

  useEffect(() => {
    inventoryService.getItemsLookup()
      .then(setItems)
      .catch(err => console.error('Failed to load items lookup:', err));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      if (isEdit) {
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

          if (customer.supplyItems && customer.supplyItems.length > 0) {
            setSupplyLines(customer.supplyItems.map((si, idx) => ({
              key: `${si.itemId}-${idx}`,
              itemId: si.itemId,
              qty: si.qty || 1,
              secQty: si.secQty || 0
            })));
          } else {
            setSupplyLines([]);
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

  const handleAddSupplyRow = () => {
    setSupplyLines([
      ...supplyLines,
      { key: Date.now(), itemId: '', qty: 1, secQty: 0 }
    ]);
  };

  const handleRemoveSupplyRow = (key: any) => {
    setSupplyLines(supplyLines.filter(l => l.key !== key));
  };

  const updateSupplyRow = (key: any, field: keyof SupplyLineRow, value: any) => {
    setSupplyLines(supplyLines.map(l => {
      if (l.key === key) {
        return { ...l, [field]: value };
      }
      return l;
    }));
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const validSupplyItems: CustomerSupplyItemDto[] = supplyLines
        .filter(l => !!l.itemId)
        .map(l => ({
          itemId: l.itemId,
          qty: l.qty || 1,
          secQty: l.secQty || 0
        }));

      if (isEdit) {
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
          supplyItems: validSupplyItems
        };

        await customerService.update(account, updateRequest);
        message.success('Customer details updated successfully');
      } else {
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
          supplyItems: validSupplyItems
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

  const supplyItemColumns = [
    {
      title: 'Supply Item',
      dataIndex: 'itemId',
      key: 'itemId',
      render: (val: string, record: SupplyLineRow) => (
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder="Select Item"
          optionFilterProp="children"
          value={val || undefined}
          onChange={(newVal) => updateSupplyRow(record.key, 'itemId', newVal)}
          filterOption={(input, option) =>
            (option?.children as any || '').toLowerCase().includes(input.toLowerCase())
          }
        >
          {items.map(i => (
            <Select.Option key={i.id} value={i.id}>{i.title}</Select.Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Default Qty',
      dataIndex: 'qty',
      key: 'qty',
      width: 140,
      render: (val: number, record: SupplyLineRow) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0.01}
          precision={2}
          onChange={(newVal) => updateSupplyRow(record.key, 'qty', newVal || 0)}
        />
      )
    },
    ...(hasSecondaryQty ? [{
      title: 'Pack Qty',
      dataIndex: 'secQty',
      key: 'secQty',
      width: 140,
      render: (val: number, record: SupplyLineRow) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0}
          precision={2}
          onChange={(newVal) => updateSupplyRow(record.key, 'secQty', newVal || 0)}
        />
      )
    }] : []),
    {
      title: 'Action',
      key: 'action',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: SupplyLineRow) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveSupplyRow(record.key)}
        />
      )
    }
  ];

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
          {/* Left Column: Avatar Display */}
          <Col xs={24} md={6} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <div className="text-center">
              <Text strong className="block mb-3">Customer Avatar</Text>
              <Upload
                accept="image/*"
                showUploadList={false}
                customRequest={handleCustomUpload}
                disabled={uploading}
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
                  className="group"
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
                      background: 'rgba(0, 0, 0, 0.45)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.2s',
                    }}
                    className="group-hover:opacity-100"
                  >
                    <CameraOutlined style={{ fontSize: 24, color: '#fff' }} />
                  </div>
                </div>
              </Upload>
              <Text type="secondary" className="block text-xs mt-2">
                Click photo to change avatar
              </Text>
            </div>
          </Col>

          {/* Right Column: Customer Details */}
          <Col xs={24} md={18}>
            <Title level={5} className="mb-4">Identity & Contact Info</Title>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="title"
                  label="Customer Name / Organization"
                  rules={[{ required: true, message: 'Customer name is required' }]}
                >
                  <Input placeholder="e.g. John Doe / Apex Enterprises" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="cnic"
                  label="National ID / Registration (CNIC / NTN)"
                >
                  <Input placeholder="e.g. 42101-1234567-1" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="email"
                  label="Email Address"
                  rules={[{ type: 'email', message: 'Please enter a valid email' }]}
                >
                  <Input prefix={<MailOutlined className="text-gray-400" />} placeholder="e.g. customer@domain.com" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="qualification"
                  label="Qualification"
                >
                  <Input placeholder="e.g. Graduate, Business Owner" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="fax"
                  label="Fax Number"
                >
                  <Input placeholder="e.g. +92 21 34567890" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="iban"
                  label="International Bank Account Number (IBAN)"
                >
                  <Input prefix={<BankOutlined className="text-gray-400" />} placeholder="e.g. PK00 UNIL 0123 4567 8901 2345" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="phone1"
                  label="Primary Phone"
                  rules={[{ required: true, message: 'Primary phone is required' }]}
                >
                  <Input prefix={<PhoneOutlined className="text-gray-400" />} placeholder="e.g. +92 300 1234567" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="phone2"
                  label="Alternate Phone"
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
                <Form.Item name="address" label="Postal / Delivery Address">
                  <Input.TextArea rows={2} placeholder="Enter full address" />
                </Form.Item>
              </Col>
            </Row>


            <Row gutter={16}>
              <Col xs={24} md={24}>
                <div style={{ padding: '16px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '8px' }}>
                  <Space size="large" className="w-full flex justify-between flex-wrap">
                    <Form.Item name="smsAlert" valuePropName="checked" noStyle>
                      <Checkbox>Enable SMS Alerts</Checkbox>
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

            <Divider style={{ margin: '24px 0 16px 0' }} />

            {/* Supply Items & Quantities Section */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <Title level={5} style={{ margin: 0 }}>
                  <ShoppingCartOutlined style={{ color: '#1677ff', marginRight: 8 }} />
                  Supply Items & Default Quantities
                </Title>
                <Text type="secondary" className="text-xs">
                  Configure default order quantities per item for this customer when populating supply orders.
                </Text>
              </div>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={handleAddSupplyRow}
              >
                Add Supply Item
              </Button>
            </div>

            <Table
              dataSource={supplyLines}
              columns={supplyItemColumns}
              pagination={false}
              size="small"
              bordered
              locale={{ emptyText: 'No specific item quantities configured. Default supply order quantity (1) will be used.' }}
              rowKey="key"
            />
          </Col>
        </Row>
      </Form>
    </Card>
  );
};
