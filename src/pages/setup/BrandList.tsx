import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, Popconfirm, Tooltip, Switch 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, SearchOutlined, TagOutlined
} from '@ant-design/icons';
import { brandService, type BrandDto } from '../../services/brandService';

const { Title, Text } = Typography;

export const BrandList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BrandDto[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BrandDto | null>(null);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await brandService.getBrands();
      setData(result);
    } catch {
      message.error('Failed to fetch brands');
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

  const handleEdit = (record: BrandDto) => {
    setEditingRecord(record);
    form.setFieldsValue({ 
      title: record.title,
      active: record.active ?? true 
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await brandService.delete(id);
      message.success('Brand deleted successfully');
      fetchData();
    } catch {
      message.error('Failed to delete brand');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await brandService.update(editingRecord.id, {
          title: values.title,
          active: values.active ?? true
        });
        message.success('Brand updated successfully');
      } else {
        await brandService.create({
          title: values.title,
          active: values.active ?? true
        });
        message.success('Brand created successfully');
      }
      setIsModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const filteredData = data.filter(item => 
    item.title?.toLowerCase().includes(searchText.toLowerCase()) ||
    item.id?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: 'Brand ID',
      dataIndex: 'id',
      key: 'id',
      width: '140px',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Brand Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: '120px',
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>
          {active ? 'ACTIVE' : 'INACTIVE'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '120px',
      render: (_: any, record: BrandDto) => (
        <Space size="middle">
          <Tooltip title="Edit">
            <Button 
              type="text" 
              icon={<EditOutlined style={{ color: '#1890ff' }} />} 
              onClick={() => handleEdit(record)} 
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm
              title="Delete Brand"
              description="Are you sure you want to delete this brand?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        bordered={false} 
        style={{ 
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TagOutlined style={{ color: '#1677ff' }} />
              Brand Master
            </Title>
            <Text type="secondary">Manage manufacturer and device product brands</Text>
          </div>
          
          <Space wrap>
            <Input
              placeholder="Search brands..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 220 }}
            />
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
              style={{ background: '#1677ff', borderRadius: '6px' }}
            >
              Add Brand
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} brands`,
          }}
          size="middle"
        />
      </Card>

      <Modal
        title={editingRecord ? 'Edit Brand' : 'New Brand'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        destroyOnClose
        okText="Save"
      >
        <Form
          form={form}
          layout="vertical"
          name="brandForm"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="title"
            label="Brand Title"
            rules={[
              { required: true, message: 'Please enter brand title' },
              { max: 100, message: 'Title cannot exceed 100 characters' }
            ]}
          >
            <Input placeholder="e.g. Apple, Samsung, Xiaomi" />
          </Form.Item>

          <Form.Item
            name="active"
            label="Status"
            valuePropName="checked"
          >
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
