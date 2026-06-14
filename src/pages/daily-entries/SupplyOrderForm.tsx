import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Form, Input, Button,
  Table, Space, message, InputNumber, Popconfirm, Select
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  ShoppingCartOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { supplyOrderService } from '../../services/supplyOrderService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;

export const SupplyOrderForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [orderLines, setOrderLines] = useState<any[]>([]);

  useEffect(() => {
    // Load customer accounts
    chartOfAccountService.getCustomerAccounts()
      .then(setCustomers)
      .catch(() => message.error('Failed to load customers list'));

    if (isEdit) {
      fetchDetail();
    } else {
      setOrderLines([{ key: Date.now(), sortOrder: 1, customerId: undefined }]);
      form.setFieldsValue({ title: '' });
    }
  }, [isEdit, id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const order = await supplyOrderService.getById(Number(id));
      if (order) {
        form.setFieldsValue({
          title: order.title
        });

        if (order.details && order.details.length > 0) {
          setOrderLines(order.details.map((d, index) => ({
            key: d.customerId + '-' + index,
            customerId: d.customerId,
            sortOrder: d.sortOrder || (index + 1)
          })));
        } else {
          setOrderLines([{ key: Date.now(), sortOrder: 1, customerId: undefined }]);
        }
      } else {
        message.error('Supply order not found');
        navigate('/setup/supply-order');
      }
    } catch (error) {
      message.error('Failed to fetch supply order details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = () => {
    const nextSortOrder = orderLines.length > 0 
      ? Math.max(...orderLines.map(l => l.sortOrder || 0)) + 1 
      : 1;
      
    setOrderLines([
      ...orderLines, 
      { key: Date.now(), sortOrder: nextSortOrder, customerId: undefined }
    ]);
  };

  const handleRemoveRow = (key: any) => {
    setOrderLines(orderLines.filter(l => l.key !== key));
  };

  const updateLine = (key: any, field: string, value: any) => {
    const updatedLines = orderLines.map(l => {
      if (l.key === key) {
        return { ...l, [field]: value };
      }
      return l;
    });
    setOrderLines(updatedLines);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = orderLines.filter(l => l.customerId);

      if (validLines.length === 0) {
        message.error('Please add at least one customer to the supply order template');
        return;
      }

      // Check for duplicate customers in the list
      const customerIds = validLines.map(l => l.customerId);
      const uniqueCustomerIds = new Set(customerIds);
      if (customerIds.length !== uniqueCustomerIds.size) {
        message.warning('The template contains duplicate customers. Please make sure customers are unique.');
      }

      setLoading(true);
      const request = {
        title: values.title.trim(),
        details: validLines.map(l => ({
          customerId: l.customerId,
          sortOrder: l.sortOrder || 0
        }))
      };

      if (isEdit) {
        await supplyOrderService.update(Number(id), request);
        message.success('Supply order template updated successfully');
        navigate('/setup/supply-order');
      } else {
        await supplyOrderService.create(request);
        message.success('Supply order template created successfully');
        navigate('/setup/supply-order');
      }
    } catch (error) {
      message.error('Failed to save supply order');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await supplyOrderService.delete(Number(id));
      message.success('Supply order deleted successfully');
      navigate('/setup/supply-order');
    } catch (error) {
      message.error('Failed to delete supply order');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Sort Order',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 120,
      render: (val: number, record: any) => (
        <InputNumber 
          style={{ width: '100%' }} 
          value={val} 
          min={1} 
          precision={0}
          onChange={(v) => updateLine(record.key, 'sortOrder', v)} 
        />
      )
    },
    {
      title: 'Customer',
      dataIndex: 'customerId',
      key: 'customerId',
      render: (text: string, record: any) => (
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder="Select Customer Account"
          optionFilterProp="children"
          value={text}
          onChange={(val) => updateLine(record.key, 'customerId', val)}
          filterOption={(input, option) =>
            (option?.children as any || '').toLowerCase().includes(input.toLowerCase())
          }
        >
          {customers.map(c => (
            <Select.Option key={c.account} value={c.account}>{c.title}</Select.Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => handleRemoveRow(record.key)}
          disabled={orderLines.length === 1}
        />
      )
    }
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup/supply-order')} type="text" />
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl">
            <ShoppingCartOutlined style={{ fontSize: 24, color: '#f59e0b' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit Supply Order: SO-${id}` : 'New Supply Order Template'}
            </Title>
            <Text type="secondary">{isEdit ? 'Modify customer sequence route template' : 'Create a new customer distribution list template'}</Text>
          </div>
        </Space>
        <Space>
          {isEdit && (
            <Popconfirm title="Delete this supply order?" onConfirm={handleDelete}>
              <Button danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          )}
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave} 
            loading={loading}
            style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
            className="hover:!bg-amber-600"
          >
            Save Template
          </Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} sm={6} lg={4}>
            <Form.Item label="Template ID">
              <Input value={isEdit ? `SO-${id}` : 'New Template'} readOnly style={{ backgroundColor: '#f5f5f5' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={18} lg={20}>
            <Form.Item 
              label="Template Title / Route Name" 
              name="title" 
              rules={[{ required: true, message: 'Please enter a title (e.g. Morning Route, Main Market Supply)' }]}
            >
              <Input placeholder="Enter Route or Group Title" className="rounded-lg" />
            </Form.Item>
          </Col>
        </Row>

        <div className="flex justify-between items-center mb-4 mt-6">
          <div>
            <Title level={5} style={{ margin: 0 }}>Customers & Order Sequence</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Customers in this template will be loaded into the Sale Supply form in this sequence.</Text>
          </div>
          <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />}>Add Customer Row</Button>
        </div>
        
        <Table
          dataSource={orderLines}
          columns={columns}
          pagination={false}
          rowKey="key"
          size="middle"
          bordered
          className="mb-4 shadow-sm border border-gray-100 rounded-lg overflow-hidden"
        />
      </Form>
    </Card>
  );
};
