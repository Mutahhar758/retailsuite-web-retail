import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, Popconfirm, Tooltip
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, ColumnHeightOutlined
} from '@ant-design/icons';
import { unitService, type UnitDto } from '../../services/unitService';

const { Title, Text } = Typography;

export const UnitList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<UnitDto[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<UnitDto | null>(null);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await unitService.getActiveUnits();
      setData(result);
    } catch (error) {
      message.error('Failed to fetch units');
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

  const handleEdit = (record: UnitDto) => {
    setEditingRecord(record);
    form.setFieldsValue({ 
      code: record.code,
      title: record.title,
      active: true 
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (code: string) => {
    try {
      await unitService.delete(code);
      message.success('Unit deleted successfully');
      fetchData();
    } catch (error) {
      message.error('Failed to delete unit');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await unitService.update(editingRecord.code, {
          title: values.title,
          active: true
        });
        message.success('Unit updated successfully');
      } else {
        await unitService.create({
          title: values.title,
          active: true
        });
        message.success('Unit created successfully');
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
      title: 'Unit Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Actions',
      key: 'action',
      width: '150px',
      render: (_: any, record: UnitDto) => (
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
            title="Delete Unit"
            description="Are you sure you want to delete this unit?"
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
          <ColumnHeightOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Units</Title>
            <Text type="secondary">Manage measurement units for items</Text>
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
            New Unit
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
        title={editingRecord ? "Edit Unit" : "New Unit"}
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
            <Form.Item label="Unit Code">
              <Input value={editingRecord.code} disabled />
            </Form.Item>
          )}
          <Form.Item
            name="title"
            label="Unit Title"
            rules={[{ required: true, message: 'Please enter unit title' }]}
          >
            <Input 
              placeholder="Enter unit description" 
              autoFocus
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
