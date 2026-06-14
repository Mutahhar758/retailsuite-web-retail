import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, Button, Space, Typography, Form, Input, Select, InputNumber, Row, Col, Checkbox, message, Popconfirm, Upload
} from 'antd';
import { 
  SaveOutlined, ArrowLeftOutlined, ShoppingOutlined, DeleteOutlined, UploadOutlined, LoadingOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { inventoryService } from '../../services/inventoryService';
import { itemCategoryService, type ItemCategoryDto } from '../../services/itemCategoryService';
import { unitService, type UnitDto } from '../../services/unitService';

const { Title, Text } = Typography;
const { Option } = Select;

export const InventoryItemForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const itemType = Form.useWatch('itemType', form);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [categoriesResult, unitsResult] = await Promise.all([
        itemCategoryService.getActiveItemCategories(),
        unitService.getActiveUnits()
      ]);
      setCategories(categoriesResult);
      setUnits(unitsResult);

      if (isEdit) {
        const item = await inventoryService.getById(id!);
        if (item) {
          form.setFieldsValue(item);
          if (item.mediaUrl) {
            setImageUrl(item.mediaUrl);
          }
        } else {
          message.error('Item not found');
          navigate('/setup/item-details');
        }
      }
    } catch (error) {
      message.error('Failed to fetch data');
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
      if (isEdit) {
        await inventoryService.update(id!, values);
        message.success('Item updated successfully');
      } else {
        await inventoryService.create(values);
        message.success('Item created successfully');
      }
      navigate('/setup/item-details');
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await inventoryService.delete(id!);
      message.success('Item deleted successfully');
      navigate('/setup/item-details');
    } catch (error) {
      message.error('Failed to delete item');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      setUploading(true);
      // 1. Get pre-signed URL and fileId from BE
      const { fileId, uploadUrl } = await inventoryService.getPresignedUploadUrl(file.name);
      
      // 2. Perform direct upload to Media Service using the pre-signed URL
      const formData = new FormData();
      formData.append('File', file);
      
      await axios.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // 3. Set mediaId in the Form values
      form.setFieldsValue({ mediaId: fileId });
      
      // 4. Generate local preview URL
      const localUrl = URL.createObjectURL(file);
      setImageUrl(localUrl);
      
      message.success('Image uploaded successfully');
      onSuccess?.("ok");
    } catch (err) {
      console.error(err);
      message.error('Failed to upload image');
      onError?.(err as Error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/setup/item-details')} 
          />
          <ShoppingOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? 'Edit Product' : 'New Product'}
            </Title>
            <Text type="secondary">
              {isEdit ? 'Update product information and pricing' : 'Add a new product to your database'}
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
            {isEdit ? 'Update Product' : 'Save Product'}
          </Button>
          {isEdit && (
            <Popconfirm
              title="Delete Product"
              description="Are you sure you want to delete this product?"
              onConfirm={handleDelete}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true, loading }}
            >
              <Button type="primary" danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{ itemType: 'Product', alert: false, priRate: 0, secRate: 0, qtyInPack: 1 }}
      >
        {/* Hidden field to bind mediaId to form submit values */}
        <Form.Item name="mediaId" noStyle><Input type="hidden" /></Form.Item>

        <Row gutter={24}>
          <Col xs={24} md={18}>
            <Title level={5} className="mb-4">Basic Information</Title>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="itemType"
                  label="Type"
                  rules={[{ required: true, message: 'Type is required' }]}
                >
                  <Select placeholder="Select type" disabled={isEdit}>
                    <Option value="Product">Product</Option>
                    <Option value="Service">Service</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="barcode"
                  label="Barcode"
                >
                  <Input placeholder="Scan or enter barcode" disabled={itemType === 'Service'} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="itemCategoryCode"
                  label="Category"
                  rules={[{ required: true, message: 'Category is required' }]}
                >
                  <Select placeholder="Select category" showSearch optionFilterProp="children">
                    {categories.map(cat => (
                      <Option key={cat.code} value={cat.code}>{cat.title}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={18}>
                <Form.Item
                  name="title"
                  label="Product Title"
                  rules={[{ required: true, message: 'Product title is required' }]}
                >
                  <Input placeholder="Enter full product name" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item
                  name="itemKey"
                  label="Search Key"
                >
                  <Input placeholder="Quick search key" />
                </Form.Item>
              </Col>
            </Row>

            <div className="flex justify-between items-center mb-4 mt-6">
              <Title level={5} style={{ margin: 0 }}>Pricing & Units</Title>
            </div>
            {itemType !== 'Service' ? (
              <>
                <Row gutter={16}>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="primaryUnit"
                      label="Primary Unit"
                      rules={[{ required: true, message: 'Required' }]}
                    >
                      <Select placeholder="Select primary unit">
                        {units.map(u => (
                          <Option key={u.code} value={u.code}>{u.title}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="priRate"
                      label="Primary Rate"
                      rules={[{ required: true, message: 'Required' }]}
                    >
                      <InputNumber<any> 
                        style={{ width: '100%' }} 
                        min={0} 
                        formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={value => value ? value.replace(/Rs\.\s?|(,*)/g, '') : ''}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="secondaryUnit"
                      label="Secondary Unit"
                    >
                      <Select placeholder="Optional unit" allowClear>
                        {units.map(u => (
                          <Option key={u.code} value={u.code}>{u.title}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="secRate"
                      label="Secondary Rate"
                    >
                      <InputNumber<any> 
                        style={{ width: '100%' }} 
                        min={0} 
                        formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={value => value ? value.replace(/Rs\.\s?|(,*)/g, '') : ''}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="defaultUnit"
                      label="Default Unit"
                    >
                      <Select placeholder="Automatic">
                        {units.map(u => (
                          <Option key={u.code} value={u.code}>{u.title}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="qtyInPack"
                      label="Quantity in Pack"
                    >
                      <InputNumber style={{ width: '100%' }} min={1} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <div style={{ marginTop: '32px' }}>
                      <Space size="large">
                        <Form.Item name="alert" valuePropName="checked" noStyle>
                          <Checkbox>Enable Alerts</Checkbox>
                        </Form.Item>
                        <Form.Item name="lowStockAlert" valuePropName="checked" noStyle>
                          <Checkbox>Low Stock Alert</Checkbox>
                        </Form.Item>
                      </Space>
                    </div>
                  </Col>
                </Row>
              </>
            ) : (
              <>
                <Row gutter={16}>
                  <Col xs={24} md={24}>
                    <Form.Item
                      name="priRate"
                      label="Rate"
                      rules={[{ required: true, message: 'Required' }]}
                    >
                      <InputNumber<any> 
                        style={{ width: '100%' }} 
                        min={0} 
                        formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={value => value ? value.replace(/Rs\.\s?|(,*)/g, '') : ''}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={24}>
                    <div style={{ marginTop: '16px' }}>
                      <Form.Item name="alert" valuePropName="checked" noStyle>
                        <Checkbox>Enable Alerts</Checkbox>
                      </Form.Item>
                    </div>
                  </Col>
                </Row>
              </>
            )}

            {itemType !== 'Service' && (
              <>
                <div className="flex justify-between items-center mb-4 mt-6">
                  <Title level={5} style={{ margin: 0 }}>Opening Stock</Title>
                </div>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="opnStock"
                      label="Opening Quantity"
                    >
                      <InputNumber 
                        style={{ width: '100%' }} 
                        min={0} 
                        placeholder="0.00" 
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="opnRate"
                      label="Opening Rate"
                    >
                      <InputNumber<any> 
                        style={{ width: '100%' }} 
                        min={0} 
                        placeholder="0.00"
                        formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={value => value ? value.replace(/Rs\.\s?|(,*)/g, '') : ''}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            )}
          </Col>

          <Col xs={24} md={6}>
            {itemType !== 'Service' && (
              <Card 
                title="Product Media" 
                className="shadow-sm border-gray-100 rounded-xl"
                style={{ textAlign: 'center', marginBottom: '24px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  {imageUrl ? (
                    <div style={{ position: 'relative', width: '100%', paddingBottom: '100%', marginBottom: '16px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f0f0f0' }}>
                      <img 
                        src={imageUrl} 
                        alt="Product" 
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    </div>
                  ) : (
                    <div 
                      style={{ 
                        width: '100%', 
                        paddingBottom: '100%', 
                        position: 'relative',
                        marginBottom: '16px', 
                        borderRadius: '8px', 
                        backgroundColor: '#fafafa', 
                        border: '1px dashed #d9d9d9',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <ShoppingOutlined style={{ fontSize: 32, color: '#bfbfbf', marginBottom: 8 }} />
                        <Text type="secondary" style={{ fontSize: 12 }}>No Image</Text>
                      </div>
                    </div>
                  )}

                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    customRequest={handleCustomUpload}
                    disabled={uploading}
                  >
                    <Button 
                      icon={uploading ? <LoadingOutlined /> : <UploadOutlined />} 
                      loading={uploading}
                      type="dashed"
                      style={{ width: '100%' }}
                    >
                      {imageUrl ? 'Change Image' : 'Upload Image'}
                    </Button>
                  </Upload>
                  <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 11 }}>
                    JPG, PNG or JPEG. Max 5MB.
                  </Text>
                </div>
              </Card>
            )}
          </Col>
        </Row>
      </Form>
    </Card>
  );
};
