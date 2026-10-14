import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Input, Popconfirm, Tooltip, Row, Col 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, SearchOutlined, ExperimentOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { bomService, type BomResponse } from '../../services/bomService';

const { Title, Text } = Typography;

export const BomList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BomResponse[]>([]);
  const [keyword, setKeyword] = useState('');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await bomService.getList({ keyword });
      setData(result);
    } catch (error) {
      message.error('Failed to fetch bills of materials');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: number) => {
    try {
      await bomService.delete(id);
      message.success('Bill of Materials deleted successfully');
      fetchData();
    } catch (error) {
      message.error('Failed to delete Bill of Materials');
    }
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (code: string) => <Text strong style={{ color: '#1677ff' }}>{code}</Text>
    },
    {
      title: 'Formula / Recipe Name',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: BomResponse) => (
        <div>
          <Text strong>{title}</Text>
          {record.isDefault && <Tag color="gold" style={{ marginLeft: 8 }}>Default</Tag>}
          {record.isActive ? <Tag color="green" style={{ marginLeft: 4 }}>Active</Tag> : <Tag color="default" style={{ marginLeft: 4 }}>Inactive</Tag>}
        </div>
      )
    },
    {
      title: 'Finished Product',
      dataIndex: 'finishedItemTitle',
      key: 'finishedItemTitle',
      render: (item: string, record: BomResponse) => (
        <div>
          <Text>{item}</Text>
          {record.finishedItemBarcode && (
            <div><Text type="secondary" style={{ fontSize: 11 }}>Barcode: {record.finishedItemBarcode}</Text></div>
          )}
        </div>
      )
    },
    {
      title: 'Output Yield',
      key: 'outputYield',
      width: 130,
      render: (_: any, record: BomResponse) => (
        <Text>{record.outputQty} {record.unitTitle || ''}</Text>
      )
    },
    {
      title: 'Material Cost',
      dataIndex: 'totalEstimatedMaterialCost',
      key: 'totalEstimatedMaterialCost',
      align: 'right' as const,
      render: (val: number) => <Text>{val.toFixed(2)}</Text>
    },
    {
      title: 'Overheads',
      key: 'overheads',
      align: 'right' as const,
      render: (_: any, record: BomResponse) => {
        const oh = record.laborCost + record.overheadCost + record.packagingCost;
        return <Text type="secondary">{oh.toFixed(2)}</Text>;
      }
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unitEstimatedCost',
      key: 'unitEstimatedCost',
      align: 'right' as const,
      render: (val: number) => <Text strong style={{ color: '#52c41a' }}>{val.toFixed(2)}</Text>
    },
    {
      title: 'Ingredients',
      key: 'ingredientsCount',
      align: 'center' as const,
      width: 100,
      render: (_: any, record: BomResponse) => (
        <Tag color="cyan">{record.lines?.length || 0} items</Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: BomResponse) => (
        <Space size="small">
          <Tooltip title="Edit Formula">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#1677ff' }} />}
              onClick={() => navigate(`/setup/bom/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm
              title="Delete BOM"
              description="Are you sure you want to delete this Bill of Materials?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Space align="center">
              <ExperimentOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Bill of Materials / Recipe Setup</Title>
                <Text type="secondary">Define manufacturing formulas, ingredient ratios, and overhead absorption</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Input
                placeholder="Search BOM or Product..."
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onPressEnter={fetchData}
                style={{ width: 260 }}
                allowClear
              />
              <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/setup/bom/new')}>
                New Recipe
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showTotal: (total) => `Total ${total} recipes` }}
          bordered
          size="middle"
        />
      </Card>
    </div>
  );
};
