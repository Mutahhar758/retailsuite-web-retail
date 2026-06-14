import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, Popconfirm, Tooltip, Checkbox
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, AppstoreOutlined
} from '@ant-design/icons';
import { itemCategoryService, type ItemCategoryDto } from '../../services/itemCategoryService';

const { Title, Text } = Typography;

export const ItemCategoryList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ItemCategoryDto[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ItemCategoryDto | null>(null);
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
    form.resetFields();
    form.setFieldValue('active', true);
    setIsModalVisible(true);
  };

  const handleEdit = (record: ItemCategoryDto) => {
    setEditingRecord(record);
    form.setFieldsValue({ 
      title: record.title,
      active: record.active 
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

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await itemCategoryService.update(editingRecord.code, {
          title: values.title,
          active: values.active
        });
        message.success('Item category updated successfully');
      } else {
        await itemCategoryService.create({
          title: values.title,
          active: values.active
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
