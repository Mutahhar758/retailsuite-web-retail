import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, Popconfirm, Tooltip
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, FileTextOutlined
} from '@ant-design/icons';
import { narrationService, type NarrationDto } from '../../services/narrationService';

const { Title, Text } = Typography;

export const NarrationList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NarrationDto[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NarrationDto | null>(null);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await narrationService.getActiveNarrations();
      setData(result);
    } catch (error) {
      message.error('Failed to fetch narrations');
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
    setIsModalVisible(true);
  };

  const handleEdit = (record: NarrationDto) => {
    setEditingRecord(record);
    form.setFieldsValue({ title: record.title });
    setIsModalVisible(true);
  };

  const handleDelete = async (code: string) => {
    try {
      await narrationService.delete(code);
      message.success('Narration deleted successfully');
      fetchData();
    } catch (error) {
      message.error('Failed to delete narration');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await narrationService.update(editingRecord.code, values);
        message.success('Narration updated successfully');
      } else {
        await narrationService.create(values);
        message.success('Narration created successfully');
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
      title: 'Narration Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Actions',
      key: 'action',
      width: '150px',
      render: (_: any, record: NarrationDto) => (
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
            title="Delete Narration"
            description="Are you sure you want to delete this narration?"
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
          <FileTextOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Narrations</Title>
            <Text type="secondary">Manage predefined narration titles for transactions</Text>
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
            New Narration
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
        title={editingRecord ? "Edit Narration" : "New Narration"}
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
            name="title"
            label="Narration Title"
            rules={[{ required: true, message: 'Please enter narration title' }]}
          >
            <Input placeholder="Enter narration title" autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
