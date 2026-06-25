import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, Popconfirm, Tooltip, Checkbox, Upload
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, AppstoreOutlined, UploadOutlined, LoadingOutlined
} from '@ant-design/icons';
import { itemCategoryService, type ItemCategoryDto } from '../../services/itemCategoryService';
import axios from 'axios';

const { Title, Text } = Typography;

export const ItemCategoryList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ItemCategoryDto[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ItemCategoryDto | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await itemCategoryService.getActiveItemCategories();
      setData(result);
    } catch (error) {
      message.error('Failed to fetch item categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingRecord(null);
    setImageUrl(null);
    form.resetFields();
    form.setFieldValue('active', true);
    setIsModalVisible(true);
  };

  const handleEdit = (record: ItemCategoryDto) => {
    setEditingRecord(record);
    setImageUrl(record.mediaUrl || null);
    form.setFieldsValue({ 
      title: record.title,
      active: record.active,
      mediaId: record.mediaId
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (code: string) => {
    try {
      await itemCategoryService.delete(code);
      message.success('Item category deleted successfully');
      fetchData();
    } catch (error) {
      message.error('Failed to delete item category');
    }
  };

  const handleCustomUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      setUploading(true);
      const { fileId, uploadUrl } = await itemCategoryService.getPresignedUploadUrl(file.name);
      
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

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await itemCategoryService.update(editingRecord.code, {
          title: values.title,
          active: values.active,
          mediaId: values.mediaId || null
        });
        message.success('Item category updated successfully');
      } else {
        await itemCategoryService.create({
          title: values.title,
          active: values.active,
          mediaId: values.mediaId || null
        });
        message.success('Item category created successfully');
      }
      setIsModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const columns = [
    {
      title: 'Image',
      dataIndex: 'mediaUrl',
      key: 'mediaUrl',
      width: '80px',
      render: (url: string) => url ? (
        <img src={url} alt="Category" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', border: '1px solid #f0f0f0' }} />
      ) : (
        <div style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d9d9d9' }}>
          <AppstoreOutlined style={{ color: '#bfbfbf' }} />
        </div>
      )
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: '120px',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Category Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: '100px',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'action',
      width: '150px',
      render: (_: any, record: ItemCategoryDto) => (
        <Space size="middle">
          <Tooltip title="Edit">
            <Button 
              type="primary" 
              ghost
              icon={<EditOutlined />} 
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Item Category"
            description="Are you sure you want to delete this category?"
            onConfirm={() => handleDelete(record.code)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button 
                danger 
                icon={<DeleteOutlined />} 
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <AppstoreOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Item Categories</Title>
            <Text type="secondary">Manage categories for inventory items</Text>
          </div>
        </Space>
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchData}
            loading={loading}
          >
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleAdd}
          >
            New Category
          </Button>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        loading={loading}
        rowKey="code"
        pagination={{ pageSize: 10 }}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />

      <Modal
        title={editingRecord ? "Edit Item Category" : "New Item Category"}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        okText={editingRecord ? "Update" : "Create"}
        destroyOnClose
        centered
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          {editingRecord && (
            <Form.Item label="Category Code">
              <Input value={editingRecord.code} disabled />
            </Form.Item>
          )}

          <Form.Item name="mediaId" noStyle>
            <Input type="hidden" />
          </Form.Item>

          <Form.Item
            name="title"
            label="Category Title"
            rules={[{ required: true, message: 'Please enter category title' }]}
          >
            <Input 
              placeholder="Enter category name" 
              autoFocus
            />
          </Form.Item>

          <Form.Item label="Category Image">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {imageUrl ? (
                <div style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
                  <img 
                    src={imageUrl} 
                    alt="Category" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                </div>
              ) : (
                <div 
                  style={{ 
                    width: 80, 
                    height: 80, 
                    borderRadius: 8, 
                    backgroundColor: '#fafafa', 
                    border: '1px dashed #d9d9d9',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <AppstoreOutlined style={{ fontSize: 24, color: '#bfbfbf', marginBottom: 4 }} />
                  <Text type="secondary" style={{ fontSize: 10 }}>No Image</Text>
                </div>
              )}

              <div style={{ flex: 1 }}>
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
                  >
                    {imageUrl ? 'Change Image' : 'Upload Image'}
                  </Button>
                </Upload>
                {imageUrl && (
                  <Button 
                    type="link" 
                    danger 
                    size="small" 
                    style={{ padding: '4px 0', display: 'block', marginTop: 4 }}
                    onClick={() => {
                      setImageUrl(null);
                      form.setFieldsValue({ mediaId: undefined });
                    }}
                  >
                    Remove Image
                  </Button>
                )}
                <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11 }}>
                  JPG, PNG or JPEG. Max 5MB.
                </Text>
              </div>
            </div>
          </Form.Item>

          <Form.Item
            name="active"
            valuePropName="checked"
          >
            <Checkbox>Is Active</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
