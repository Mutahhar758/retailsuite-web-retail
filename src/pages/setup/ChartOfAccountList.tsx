import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, Popconfirm, Tree,
  Spin, Empty, Row, Col, Divider
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, ApartmentOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { chartOfAccountService, type ChartOfAccountDto } from '../../services/chartOfAccountService';
import type { DataNode } from 'antd/es/tree';

const { Title, Text } = Typography;
const { Search } = Input;

interface AccountNode extends DataNode {
  title: string;
  key: string;
  accType: string;
  accLevel: number;
  children?: AccountNode[];
}

const getLevelStyle = (level: number) => {
  switch (level) {
    case 1: return { fontWeight: 700, fontSize: '16px', color: '#1f1f1f' };
    case 2: return { fontWeight: 600, fontSize: '15px', color: '#262626' };
    case 3: return { fontWeight: 500, fontSize: '14px', color: '#434343' };
    default: return { fontWeight: 400, fontSize: '14px', color: '#595959' };
  }
};

export const ChartOfAccountList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChartOfAccountDto[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ChartOfAccountDto | null>(null);
  const [parentRecord, setParentRecord] = useState<ChartOfAccountDto | null>(null);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await chartOfAccountService.getActiveAccounts();
      setData(result);
      
      // Auto expand first level
      const rootKeys = result.filter(item => !item.parentId).map(item => item.account);
      setExpandedKeys(rootKeys);
    } catch (error) {
      message.error('Failed to fetch chart of accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const treeData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Group accounts by parentId for O(1) lookup
    const groupedByParent = data.reduce((acc, item) => {
      const pId = item.parentId || '';
      if (!acc[pId]) acc[pId] = [];
      acc[pId].push(item);
      return acc;
    }, {} as Record<string, ChartOfAccountDto[]>);

    const loop = (parentId: string = ''): AccountNode[] => {
      const children = groupedByParent[parentId] || [];
      return children.map(item => {
        const subChildren = loop(item.account);
        return {
          title: item.title,
          key: item.account,
          accType: item.accType,
          accLevel: item.accLevel,
          children: subChildren.length > 0 ? subChildren : undefined,
        };
      });
    };
    return loop('');
  }, [data]);

  const onExpand = (newExpandedKeys: React.Key[]) => {
    setExpandedKeys(newExpandedKeys);
    setAutoExpandParent(false);
  };

  // Pre-calculate flattened data for faster search
  const flatData = useMemo(() => {
    const flatten = (list: AccountNode[]): { key: string; title: string; parentKey: string | null }[] => {
      const result: { key: string; title: string; parentKey: string | null }[] = [];
      const stack: { nodes: AccountNode[]; parentKey: string | null }[] = [{ nodes: list, parentKey: null }];
      
      while (stack.length > 0) {
        const { nodes, parentKey } = stack.pop()!;
        nodes.forEach(node => {
          result.push({ key: node.key, title: node.title, parentKey });
          if (node.children) {
            stack.push({ nodes: node.children, parentKey: node.key });
          }
        });
      }
      return result;
    };
    return flatten(treeData);
  }, [treeData]);

  const onSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setSearchValue(value);
    
    if (!value) {
      setExpandedKeys(data.filter(item => !item.parentId).map(item => item.account));
      return;
    }

    const newExpandedKeys: string[] = [];
    flatData.forEach(item => {
      if (item.title.toLowerCase().indexOf(value.toLowerCase()) > -1) {
        let parentKey = item.parentKey;
        while (parentKey) {
          if (!newExpandedKeys.includes(parentKey)) {
            newExpandedKeys.push(parentKey);
          }
          const parent = flatData.find(f => f.key === parentKey);
          parentKey = parent?.parentKey || null;
        }
      }
    });
    
    setExpandedKeys(newExpandedKeys);
    setAutoExpandParent(true);
  };

  const selectedAccount = useMemo(() => {
    return data.find(item => item.account === selectedKey) || null;
  }, [data, selectedKey]);

  const handleAddChild = () => {
    if (!selectedAccount) {
      message.warning('Please select a parent account');
      return;
    }
    if (selectedAccount.accLevel >= 5) {
      message.error('Cannot create child for a detail account');
      return;
    }
    setEditingRecord(null);
    setParentRecord(selectedAccount);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = () => {
    if (!selectedAccount) {
      message.warning('Please select an account to edit');
      return;
    }
    setEditingRecord(selectedAccount);
    setParentRecord(data.find(item => item.account === selectedAccount.parentId) || null);
    form.setFieldsValue({ 
      title: selectedAccount.title,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async () => {
    if (!selectedAccount) return;
    try {
      await chartOfAccountService.delete(selectedAccount.account);
      message.success('Account deleted successfully');
      setSelectedKey(null);
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
      } else if (parentRecord) {
        await chartOfAccountService.create({
          title: values.title,
          parentId: parentRecord.account
        });
        message.success('Account created successfully');
      }
      setIsModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl min-h-[600px]">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <ApartmentOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Chart of Accounts</Title>
            <Text type="secondary">Manage your organization's financial account structure</Text>
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
        </Space>
      </div>

      <Divider />

      <Row gutter={24}>
        <Col span={10}>
          <div className="mb-4">
            <Search 
              placeholder="Search accounts..." 
              onChange={onSearch} 
              prefix={<SearchOutlined />}
              className="mb-4"
            />
            <div className="border border-gray-100 rounded-lg p-4 bg-gray-50 max-h-[500px] overflow-auto">
              {loading ? (
                <div className="flex justify-center p-8"><Spin /></div>
              ) : treeData.length > 0 ? (
                <Tree
                  blockNode
                  virtual
                  onExpand={onExpand}
                  expandedKeys={expandedKeys}
                  autoExpandParent={autoExpandParent}
                  onSelect={(keys) => setSelectedKey(keys[0] as string)}
                  selectedKeys={selectedKey ? [selectedKey] : []}
                  treeData={treeData}
                  titleRender={(node: any) => {
                    const index = node.title.toLowerCase().indexOf(searchValue.toLowerCase());
                    const beforeStr = node.title.substring(0, index);
                    const afterStr = node.title.substring(index + searchValue.length);
                    
                    const style = getLevelStyle(node.accLevel);

                    const title =
                      index > -1 ? (
                        <span style={style}>
                          {beforeStr}
                          <span style={{ color: '#f50' }}>{node.title.substring(index, index + searchValue.length)}</span>
                          {afterStr}
                        </span>
                      ) : (
                        <span style={style}>{node.title}</span>
                      );
                    
                    return (
                      <div className="flex justify-between items-center w-full pr-2 py-1">
                        <span>{title}</span>
                        {node.accType === 'Detail' && <Tag color="blue" style={{ fontSize: '10px' }}>Detail</Tag>}
                      </div>
                    );
                  }}
                />
              ) : (
                <Empty description="No accounts found" />
              )}
            </div>
          </div>
        </Col>
        
        <Col span={14}>
          <Card 
            title={<Title level={4} style={{ margin: 0 }}>Account Details</Title>}
            styles={{ body: { padding: '32px', minHeight: '500px' } }}
            className="h-full border-gray-100 bg-gray-50"
            extra={
              selectedAccount && (
                <Space>
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={handleAddChild}
                    disabled={selectedAccount.accLevel >= 5}
                  >
                    Add Child
                  </Button>
                  <Button 
                    icon={<EditOutlined />} 
                    onClick={handleEdit}
                  >
                    Edit
                  </Button>
                  <Popconfirm
                    title="Delete Account"
                    description="Are you sure you want to delete this account?"
                    onConfirm={handleDelete}
                    okText="Yes"
                    cancelText="No"
                    disabled={data.some(item => item.parentId === selectedAccount.account)}
                  >
                    <Button 
                      danger 
                      icon={<DeleteOutlined />}
                      disabled={data.some(item => item.parentId === selectedAccount.account)}
                    >
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
              )
            }
          >
            {selectedAccount ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                      Account Title
                    </Text>
                    <Title level={2} style={{ margin: 0, lineHeight: 1.2 }}>{selectedAccount.title}</Title>
                  </div>
                  <Tag color={selectedAccount.accType === 'Detail' ? 'blue' : 'gold'} style={{ padding: '4px 16px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    {selectedAccount.accType}
                  </Tag>
                </div>

                {/* Data Section */}
                <div style={{ backgroundColor: '#fafafa', padding: '24px', borderRadius: '12px', border: '1px solid #f0f0f0', marginBottom: 'auto' }}>
                  <Row gutter={[40, 40]}>
                    <Col span={12}>
                      <Space direction="vertical" size={4}>
                        <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Account Code</Text>
                        <Text strong style={{ fontSize: '20px', color: '#1677ff', fontFamily: 'monospace' }}>{selectedAccount.account}</Text>
                      </Space>
                    </Col>
                    <Col span={12}>
                      <Space direction="vertical" size={4}>
                        <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Parent Account</Text>
                        <Text strong style={{ fontSize: '16px' }}>{selectedAccount.parentId || 'ROOT'}</Text>
                      </Space>
                    </Col>
                    <Col span={12}>
                      <Space direction="vertical" size={4}>
                        <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Account Level</Text>
                        <Tag bordered={false} style={{ backgroundColor: '#fff', border: '1px solid #d9d9d9', fontWeight: 'bold', margin: 0, padding: '2px 12px' }}>
                          LEVEL {selectedAccount.accLevel}
                        </Tag>
                      </Space>
                    </Col>
                  </Row>
                </div>

                {/* Footer Section */}
                <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid #f0f0f0' }}>
                  <Row gutter={[48, 24]}>
                    <Col span={12}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Created Information</Text>
                        <Text strong style={{ fontSize: '14px' }}>{selectedAccount.createdBy}</Text>
                        <Text type="secondary" style={{ fontSize: '12px' }}>{new Date(selectedAccount.createdOn).toLocaleString()}</Text>
                      </div>
                    </Col>
                    {selectedAccount.lastModifiedBy && (
                      <Col span={12}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Last Modified Information</Text>
                          <Text strong style={{ fontSize: '14px' }}>{selectedAccount.lastModifiedBy}</Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>{new Date(selectedAccount.lastModifiedOn!).toLocaleString()}</Text>
                        </div>
                      </Col>
                    )}
                  </Row>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                <ApartmentOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>Select an account from the tree to view details or manage</p>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingRecord ? "Edit Account" : `New Child Account for ${parentRecord?.title}`}
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
          {editingRecord ? (
            <Form.Item label="Account Code">
              <Input value={editingRecord.account} disabled />
            </Form.Item>
          ) : (
            <Form.Item label="Parent Account">
              <Input value={`${parentRecord?.title} (${parentRecord?.account})`} disabled />
            </Form.Item>
          )}
          
          <Form.Item
            name="title"
            label="Account Title"
            rules={[{ required: true, message: 'Please enter account title' }]}
          >
            <Input 
              placeholder="Enter account name" 
              autoFocus
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
