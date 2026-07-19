import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, InputNumber, Popconfirm, Tooltip, Select, Switch
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, TableOutlined
} from '@ant-design/icons';
import { kotService, type DiningTableDto } from '../../services/kotService';

const { Title, Text } = Typography;
const { Option } = Select;

export const DiningTableList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DiningTableDto[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DiningTableDto | null>(null);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await kotService.getDiningTables();
      setData(result);
    } catch (error) {
      message.error('Failed to fetch dining tables');
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
    form.setFieldsValue({ active: true, capacity: 4, status: 'Available' });
    setIsModalVisible(true);
  };

  const handleEdit = (record: DiningTableDto) => {
    setEditingRecord(record);
    form.setFieldsValue({ 
      name: record.name,
      capacity: record.capacity,
      status: record.status,
      active: record.active
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await kotService.deleteDiningTable(id);
      message.success('Dining table deleted successfully');
      fetchData();
    } catch (error) {
      message.error('Failed to delete dining table');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await kotService.updateDiningTable(editingRecord.id, {
          name: values.name,
          capacity: values.capacity,
          status: values.status,
          active: values.active
        });
        message.success('Dining table updated successfully');
      } else {
        await kotService.createDiningTable({
          name: values.name,
          capacity: values.capacity,
          active: values.active
        });
        message.success('Dining table created successfully');
      }
      setIsModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'Available':
        return <Tag color="success">Available</Tag>;
      case 'Occupied':
        return <Tag color="error">Occupied</Tag>;
      case 'Reserved':
        return <Tag color="warning">Reserved</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Table Name / Number',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Capacity (Seats)',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (num: number) => `${num} Persons`,
    },
    {
      title: 'Current Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: 'Active',
      dataIndex: 'active',
      key: 'active',
      render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'action',
      width: '150px',
      render: (_: any, record: DiningTableDto) => (
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
            title="Delete Table"
            description="Are you sure you want to delete this dining table?"
            onConfirm={() => handleDelete(record.id)}
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
          <TableOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Dining Tables</Title>
            <Text type="secondary">Manage shop/restaurant dining tables</Text>
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
            New Dining Table
          </Button>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />

      <Modal
        title={editingRecord ? "Edit Dining Table" : "New Dining Table"}
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
          <Form.Item
            name="name"
            label="Table Name / Number"
            rules={[{ required: true, message: 'Please enter table name' }]}
          >
            <Input 
              placeholder="e.g. Table 1, Room VIP-A" 
              autoFocus
            />
          </Form.Item>

          <Form.Item
            name="capacity"
            label="Capacity (Persons)"
            rules={[{ required: true, message: 'Please enter capacity' }]}
          >
            <InputNumber 
              min={1} 
              max={100} 
              style={{ width: '100%' }}
              placeholder="e.g. 4"
            />
          </Form.Item>

          {editingRecord && (
            <Form.Item
              name="status"
              label="Current Status"
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="Available">Available</Option>
                <Option value="Occupied">Occupied</Option>
                <Option value="Reserved">Reserved</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="active"
            label="Active Status"
            valuePropName="checked"
          >
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
