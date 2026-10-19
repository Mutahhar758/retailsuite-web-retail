import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, InputNumber, Select, Popconfirm, Tooltip
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
  const selectedParentUnitId = Form.useWatch('parentUnitId', form);
  const watchedShortTitle = Form.useWatch('shortTitle', form);
  const watchedTitle = Form.useWatch('title', form);
  const currentRatio = Form.useWatch('conversionRatio', form);

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
    form.setFieldsValue({
      active: true,
      shortTitle: undefined,
      parentUnitId: undefined,
      conversionRatio: undefined,
    });
    setIsModalVisible(true);
  };

  const handleEdit = (record: UnitDto) => {
    setEditingRecord(record);
    form.setFieldsValue({ 
      code: record.code,
      title: record.title,
      shortTitle: record.shortTitle ?? undefined,
      parentUnitId: record.parentUnitId ?? undefined,
      conversionRatio: record.conversionRatio ?? undefined,
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
      const payload = {
        title: values.title,
        shortTitle: values.shortTitle?.trim() || null,
        parentUnitId: values.parentUnitId || null,
        conversionRatio: values.parentUnitId ? Number(values.conversionRatio) : null,
        active: true,
      };
      if (editingRecord) {
        await unitService.update(editingRecord.code, payload);
        message.success('Unit updated successfully');
      } else {
        await unitService.create(payload);
        message.success('Unit created successfully');
      }
      setIsModalVisible(false);
      fetchData();
    } catch (error: any) {
      if (error?.response?.data?.message) {
        message.error(error.response.data.message);
      }
    }
  };

  const selectedParentUnit = data.find(u => u.code === selectedParentUnitId);
  const currentShortLabel = watchedShortTitle || watchedTitle || 'sub-unit';

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: '100px',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Unit Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: 'Short Title',
      dataIndex: 'shortTitle',
      key: 'shortTitle',
      width: '130px',
      render: (text?: string | null) => text ? <Tag color="cyan">{text}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Parent Unit (Default Conversion)',
      key: 'parentConversion',
      render: (_: any, record: UnitDto) => {
        if (!record.parentUnitId || !record.conversionRatio) {
          return <Text type="secondary">Base Unit</Text>;
        }
        const parentUnit = data.find(u => u.code === record.parentUnitId);
        const parentLabel = parentUnit?.shortTitle || parentUnit?.title || record.parentUnitTitle || record.parentUnitId;
        const selfLabel = record.shortTitle || record.title;
        return (
          <Tag color="purple">
            {record.conversionRatio} {selfLabel} = 1 {parentLabel}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'action',
      width: '130px',
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
            <Text type="secondary">Manage measurement units, short symbols (kg, g), and default parent unit conversion ratios</Text>
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
        destroyOnHidden
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
              placeholder="e.g. Kilogram, Gram, Litre" 
              autoFocus
            />
          </Form.Item>
          <Form.Item
            name="shortTitle"
            label="Short Title / Symbol"
            extra="Used on bills, receipts, and unit selectors (e.g. kg, g, Ltr, ml, Pcs)"
          >
            <Input placeholder="e.g. kg, g, Ltr, Pcs" maxLength={20} />
          </Form.Item>
          <Form.Item
            name="parentUnitId"
            label="Parent Unit (Optional - if this is a smaller sub-unit)"
            extra="Items using the Parent Unit as Primary Unit will automatically inherit this sub-unit by default."
          >
            <Select
              placeholder="None (Base Unit)"
              allowClear
              onChange={(val) => {
                if (!val) {
                  form.setFieldValue('conversionRatio', undefined);
                }
              }}
            >
              {data
                .filter(u => !editingRecord || u.code !== editingRecord.code)
                .map(u => (
                  <Select.Option key={u.code} value={u.code}>
                    {u.title}{u.shortTitle ? ` (${u.shortTitle})` : ''}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          {selectedParentUnitId && (
            <Form.Item
              name="conversionRatio"
              label={`Conversion Ratio (How many ${currentShortLabel} in 1 ${selectedParentUnit?.shortTitle || selectedParentUnit?.title || 'Parent Unit'}?)`}
              rules={[
                { required: true, message: 'Please enter conversion ratio' },
                {
                  validator: (_, value) =>
                    value && Number(value) > 1
                      ? Promise.resolve()
                      : Promise.reject(new Error('Ratio must be greater than 1 (smaller unit than parent unit)')),
                },
              ]}
              extra={
                currentRatio && Number(currentRatio) > 1
                  ? `1 ${selectedParentUnit?.shortTitle || selectedParentUnit?.title} = ${currentRatio} ${currentShortLabel}`
                  : 'Example: Enter 1000 if 1000 g = 1 kg'
              }
            >
              <InputNumber
                style={{ width: '100%' }}
                min={1.0001}
                step={1}
                placeholder="e.g. 1000"
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
};
