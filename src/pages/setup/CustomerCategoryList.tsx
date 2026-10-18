import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, Popconfirm, Tooltip, Switch 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, TagsOutlined 
} from '@ant-design/icons';
import { 
  customerCategoryService, 
  type CustomerCategoryResponse 
} from '../../services/customerCategoryService';

const { Title, Text } = Typography;

export const CustomerCategoryList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CustomerCategoryResponse[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CustomerCategoryResponse | null>(null);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await customerCategoryService.getAll();
      setData(result);
    } catch (error) {
      message.error('Failed to fetch customer categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ active: true });
    setIsModalVisible(true);
  };

  const handleEdit = (record: CustomerCategoryResponse) => {
    setEditingRecord(record);
    form.setFieldsValue({ 
      title: record.title,
      description: record.description,
      active: record.active 
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (code: string) => {
    try {
      await customerCategoryService.delete(code);
      message.success('Customer category deleted successfully');
      fetchData();
    } catch (error) {
      message.error('Failed to delete customer category');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await customerCategoryService.update(editingRecord.code, {
          title: values.title,
          description: values.description,
          active: values.active !== false
        });
        message.success('Customer category updated successfully');
      } else {
        await customerCategoryService.create({
          title: values.title,
          description: values.description,
          active: values.active !== false
        });
        message.success('Customer category created successfully');
      }
      setIsModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const columns = [
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
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text?: string) => text ? <Text>{text}</Text> : <Text type="secondary" italic>-</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: '100px',
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'error'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '120px',
      render: (_: any, record: CustomerCategoryResponse) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button 
              type="text" 
              icon={<EditOutlined style={{ color: '#1677ff' }} />} 
              size="small"
              onClick={() => handleEdit(record)} 
            />
          </Tooltip>
          <Popconfirm
            title="Delete Customer Category"
            description="Are you sure you want to delete this customer category?"
            onConfirm={() => handleDelete(record.code)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button 
                type="text" 
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
          <TagsOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Customer Categories</Title>
            <Text type="secondary">Categorize customers and configure tier-based product rates</Text>
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
            style={{ backgroundColor: '#1677ff', borderColor: '#1677ff' }}
          >
            Add Category
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="code"
        loading={loading}
        pagination={{ pageSize: 15 }}
      />

      <Modal
        title={editingRecord ? 'Edit Customer Category' : 'Add Customer Category'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="title"
            label="Category Title"
            rules={[{ required: true, message: 'Please enter category title' }]}
          >
            <Input placeholder="e.g. Wholesale, VIP, Retail, Dealer" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Optional category description or notes" />
          </Form.Item>
          <Form.Item
            name="active"
            label="Active"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
