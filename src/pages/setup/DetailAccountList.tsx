import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, Popconfirm, Tooltip, Select, Divider
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, AuditOutlined, SearchOutlined
} from '@ant-design/icons';
import { chartOfAccountService, type ChartOfAccountDto, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;
const { Search } = Input;

export const DetailAccountList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [fullData, setFullData] = useState<ChartOfAccountDto[]>([]);
  const [detailAccounts, setDetailAccounts] = useState<ChartOfAccountDto[]>([]);
  const [filteredData, setFilteredData] = useState<ChartOfAccountDto[]>([]);
  const [parents, setParents] = useState<ChartOfAccountHeadDto[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ChartOfAccountDto | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await chartOfAccountService.getActiveAccounts();
      setFullData(result);
      
      const details = result.filter(acc => acc.accType === 'Detail');
      setDetailAccounts(details);
      setFilteredData(details);
      
      // Fetch Level 4 accounts as potential parents for new detail accounts
      const level4Parents = await chartOfAccountService.getHeads(4);
      setParents(level4Parents);
    } catch (error) {
      message.error('Failed to fetch detail accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const filtered = detailAccounts.filter(item => 
      item.title.toLowerCase().includes(searchValue.toLowerCase()) ||
      item.account.toLowerCase().includes(searchValue.toLowerCase()) ||
      item.parentId.toLowerCase().includes(searchValue.toLowerCase())
    );
    setFilteredData(filtered);
  }, [searchValue, detailAccounts]);

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: ChartOfAccountDto) => {
    setEditingRecord(record);
    form.setFieldsValue({ 
      title: record.title,
      parentId: record.parentId
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (account: string) => {
    try {
      await chartOfAccountService.delete(account);
      message.success('Account deleted successfully');
      fetchData();
    } catch (error) {
      // Error message handled by interceptor
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await chartOfAccountService.update(editingRecord.account, {
          title: values.title
        });
        message.success('Account updated successfully');
      } else {
        await chartOfAccountService.create({
          title: values.title,
          parentId: values.parentId
        });
        message.success('Account created successfully');
      }
      setIsModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const columns = [
    {
      title: 'Account Code',
      dataIndex: 'account',
      key: 'account',
      width: '150px',
      render: (text: string) => <Text strong style={{ fontFamily: 'monospace', color: '#1677ff' }}>{text}</Text>,
      sorter: (a: ChartOfAccountDto, b: ChartOfAccountDto) => a.account.localeCompare(b.account),
    },
    {
      title: 'Account Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a: ChartOfAccountDto, b: ChartOfAccountDto) => a.title.localeCompare(b.title),
      render: (text: string) => <Text style={{ fontWeight: 500 }}>{text}</Text>
    },
    {
      title: 'Parent Account',
      dataIndex: 'parentId',
      key: 'parentId',
      width: '200px',
      render: (text: string) => {
        const parent = fullData.find(acc => acc.account === text);
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: '12px' }}>{parent?.title || 'Unknown'}</Text>
            <Tag style={{ margin: 0 }}>{text}</Tag>
          </Space>
        );
      },
      sorter: (a: ChartOfAccountDto, b: ChartOfAccountDto) => a.parentId.localeCompare(b.parentId),
    },
    {
      title: 'Created By',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: '150px',
      responsive: ['md'] as any[],
    },
    {
      title: 'Actions',
      key: 'action',
      width: '120px',
      fixed: 'right' as const,
      render: (_: any, record: ChartOfAccountDto) => (
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
            title="Delete Account"
            description="Are you sure you want to delete this detail account?"
            onConfirm={() => handleDelete(record.account)}
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
          <AuditOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Detail Accounts</Title>
            <Text type="secondary">Manage your organization's transactional (Level 5) accounts</Text>
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
            New Detail Account
          </Button>
        </Space>
      </div>

      <Divider />

      <div className="mb-4">
        <Search 
          placeholder="Search by code, title or parent..." 
          onChange={(e) => setSearchValue(e.target.value)}
          prefix={<SearchOutlined />}
          style={{ maxWidth: 400 }}
          allowClear
        />
      </div>

      <Table 
        columns={columns} 
        dataSource={filteredData} 
        loading={loading}
        rowKey="account"
        pagination={{ 
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} accounts`
        }}
        className="border border-gray-100 rounded-lg overflow-hidden"
        scroll={{ x: 800 }}
      />

      <Modal
        title={editingRecord ? "Edit Detail Account" : "New Detail Account"}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        okText={editingRecord ? "Update" : "Create"}
        destroyOnClose
        centered
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          {!editingRecord && (
            <Form.Item
              name="parentId"
              label="Parent Account (Level 4)"
              rules={[{ required: true, message: 'Please select a parent account' }]}
            >
              <Select
                showSearch
                placeholder="Select a level 4 parent account"
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={parents.map(p => ({
                  value: p.account,
                  label: `${p.title} (${p.account})`
                }))}
              />
            </Form.Item>
          )}

          {editingRecord && (
            <Form.Item label="Account Code">
              <Input value={editingRecord.account} disabled />
            </Form.Item>
          )}

          <Form.Item
            name="title"
            label="Account Title"
            rules={[{ required: true, message: 'Please enter account title' }]}
          >
            <Input placeholder="Enter account title" autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
