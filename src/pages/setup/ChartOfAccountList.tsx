import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, Popconfirm, Tree,
  Spin, Empty, Row, Col, Divider, Segmented, Tabs
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, ApartmentOutlined,
  SearchOutlined, BankOutlined,
  ShopOutlined, TeamOutlined, DollarOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChartOfAccountDto[]>([]);
  const [viewMode, setViewMode] = useState<'friendly' | 'tree'>('friendly');
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
    } catch {
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

  const handleAddChild = (parent: ChartOfAccountDto) => {
    setEditingRecord(null);
    setParentRecord(parent);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: ChartOfAccountDto) => {
    setEditingRecord(record);
    setParentRecord(null);
    form.setFieldsValue({ title: record.title });
    setIsModalVisible(true);
  };

  const handleDelete = async (account: string) => {
    try {
      await chartOfAccountService.delete(account);
      message.success('Account deleted successfully');
      fetchData();
      if (selectedKey === account) {
        setSelectedKey(null);
      }
    } catch {
      // Error handled by interceptor
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
    } catch {
      // Error handled by interceptor
    }
  };

  const renderFriendlyCategory = (rootCode: string) => {
    const childrenL2 = data.filter(d => d.parentId === rootCode);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: 12 }}>
        {childrenL2.map(l2 => {
          const childrenL3 = data.filter(d => d.parentId === l2.account);

          let quickAction = null;
          if (l2.account === '001001') {
            quickAction = (
              <Button type="primary" size="small" icon={<ShopOutlined />} onClick={() => navigate('/setup/fixed-assets')}>
                Manage Fixed Assets
              </Button>
            );
          } else if (l2.account === '001002') {
            quickAction = (
              <Space>
                <Button size="small" icon={<BankOutlined />} onClick={() => navigate('/setup/bank-accounts')}>
                  Manage Banks
                </Button>
                <Button size="small" icon={<TeamOutlined />} onClick={() => navigate('/setup/customers')}>
                  Customers
                </Button>
              </Space>
            );
          } else if (l2.account === '002001') {
            quickAction = (
              <Button size="small" icon={<TeamOutlined />} onClick={() => navigate('/setup/vendors')}>
                Manage Vendors
              </Button>
            );
          } else if (l2.account === '004002') {
            quickAction = (
              <Button type="primary" danger size="small" icon={<DollarOutlined />} onClick={() => navigate('/daily-entries/expenses')}>
                Record Expense
              </Button>
            );
          }

          return (
            <Card
              key={l2.account}
              size="small"
              title={
                <Space>
                  <Text strong style={{ fontSize: 16 }}>{l2.title}</Text>
                  <Tag style={{ fontFamily: 'monospace' }}>{l2.account}</Tag>
                </Space>
              }
              extra={quickAction}
              style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}
            >
              {childrenL3.length === 0 ? (
                <Text type="secondary">No sub-groups defined.</Text>
              ) : (
                <Row gutter={[16, 16]}>
                  {childrenL3.map(l3 => {
                    const childrenL4 = data.filter(d => d.parentId === l3.account);
                    return (
                      <Col xs={24} md={12} key={l3.account}>
                        <div style={{ background: '#fafafa', padding: 12, borderRadius: 6, border: '1px solid #f0f0f0', height: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text strong style={{ color: '#262626' }}>{l3.title}</Text>
                          </div>
                          {childrenL4.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {childrenL4.map(l4 => {
                                const detailsCount = data.filter(d => d.parentId === l4.account).length;
                                return (
                                  <div
                                    key={l4.account}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      padding: '4px 8px',
                                      background: '#ffffff',
                                      borderRadius: 4,
                                      border: '1px solid #f5f5f5',
                                      fontSize: 13,
                                    }}
                                  >
                                    <span>{l4.title}</span>
                                    <Tag color={detailsCount > 0 ? 'green' : 'default'} style={{ fontSize: 10 }}>
                                      {detailsCount} detail {detailsCount === 1 ? 'account' : 'accounts'}
                                    </Tag>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 12 }}>No subcategories</Text>
                          )}
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <Space align="center">
          <ApartmentOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Chart of Accounts</Title>
            <Text type="secondary">Explore accounts, hierarchy, or manage standard financial categories</Text>
          </div>
        </Space>
        <Space wrap>
          <Segmented
            value={viewMode}
            onChange={(val) => setViewMode(val as 'friendly' | 'tree')}
            options={[
              { label: '🌟 Simplified View', value: 'friendly' },
              { label: '🌲 Accountant Tree View', value: 'tree' },
            ]}
          />
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchData}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      <Divider style={{ margin: '12px 0 20px 0' }} />

      {viewMode === 'friendly' ? (
        <Tabs
          defaultActiveKey="001"
          items={[
            {
              key: '001',
              label: '🏢 Assets',
              children: renderFriendlyCategory('001'),
            },
            {
              key: '004',
              label: '📉 Expenses',
              children: renderFriendlyCategory('004'),
            },
            {
              key: '002',
              label: '💳 Liabilities',
              children: renderFriendlyCategory('002'),
            },
            {
              key: '003',
              label: '💰 Income',
              children: renderFriendlyCategory('003'),
            },
            {
              key: '005',
              label: '🏛️ Capital / Equity',
              children: renderFriendlyCategory('005'),
            },
          ]}
        />
      ) : (
        /* Accountant Tree Mode */
        <div>
          <div className="mb-4">
            <Search 
              placeholder="Search accounts by name or code..." 
              onChange={onSearch}
              prefix={<SearchOutlined />}
              style={{ maxWidth: 400 }}
              allowClear
            />
          </div>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={14}>
              <Card 
                title="Account Hierarchy" 
                size="small"
                className="bg-gray-50 border-gray-200"
              >
                {loading ? (
                  <div className="flex justify-center p-8">
                    <Spin tip="Loading Chart of Accounts..." />
                  </div>
                ) : treeData.length > 0 ? (
                  <Tree
                    showLine={{ showLeafIcon: false }}
                    showIcon={false}
                    expandedKeys={expandedKeys}
                    autoExpandParent={autoExpandParent}
                    onExpand={onExpand}
                    selectedKeys={selectedKey ? [selectedKey] : []}
                    onSelect={(keys) => {
                      if (keys.length > 0) {
                        setSelectedKey(keys[0] as string);
                      } else {
                        setSelectedKey(null);
                      }
                    }}
                    titleRender={(node: any) => {
                      const isDetail = node.accType === 'Detail';
                      const levelStyle = getLevelStyle(node.accLevel);
                      return (
                        <div className="flex items-center justify-between py-1 px-2 hover:bg-blue-50 rounded group w-full">
                          <Space size={8}>
                            <Tag 
                              color={isDetail ? 'green' : 'blue'} 
                              bordered={false}
                              className="text-xs font-mono"
                              style={{ margin: 0 }}
                            >
                              {node.key}
                            </Tag>
                            <span style={levelStyle}>
                              {node.title}
                            </span>
                          </Space>
                          <Tag 
                            color={isDetail ? 'cyan' : 'default'}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-xs"
                          >
                            Level {node.accLevel}
                          </Tag>
                        </div>
                      );
                    }}
                    treeData={treeData}
                  />
                ) : (
                  <Empty description="No accounts found" />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={10}>
              <Card 
                title="Account Overview" 
                size="small"
                className="border-gray-200"
              >
                {selectedAccount ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                      <div>
                        <Title level={4} style={{ margin: 0 }}>{selectedAccount.title}</Title>
                        <Space style={{ marginTop: '8px' }}>
                          <Tag color={selectedAccount.accType === 'Detail' ? 'green' : 'blue'} style={{ padding: '2px 8px', fontSize: '12px' }}>
                            {selectedAccount.accType} Account
                          </Tag>
                          <Tag style={{ padding: '2px 8px', fontSize: '12px' }}>Level {selectedAccount.accLevel}</Tag>
                        </Space>
                      </div>
                      <Space>
                        <Button 
                          icon={<EditOutlined />} 
                          onClick={() => handleEdit(selectedAccount)}
                        >
                          Edit
                        </Button>
                        {selectedAccount.accType !== 'Detail' && selectedAccount.accLevel < 5 && (
                          <Button 
                            type="primary" 
                            icon={<PlusOutlined />} 
                            onClick={() => handleAddChild(selectedAccount)}
                          >
                            Add Child
                          </Button>
                        )}
                        <Popconfirm
                          title="Delete Account"
                          description="Are you sure you want to delete this account?"
                          onConfirm={() => handleDelete(selectedAccount.account)}
                          okText="Yes"
                          cancelText="No"
                        >
                          <Button danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    </div>

                    <Divider style={{ margin: '16px 0' }} />

                    <Row gutter={[24, 24]}>
                      <Col span={12}>
                        <Space direction="vertical" size={2}>
                          <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Account Code</Text>
                          <Text strong style={{ fontSize: '18px', color: '#1677ff', fontFamily: 'monospace' }}>{selectedAccount.account}</Text>
                        </Space>
                      </Col>
                      <Col span={12}>
                        <Space direction="vertical" size={2}>
                          <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Parent Account</Text>
                          <Text strong style={{ fontSize: '16px' }}>{selectedAccount.parentId || 'ROOT'}</Text>
                        </Space>
                      </Col>
                    </Row>
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
        </div>
      )}

      {/* Modal for editing or adding child account */}
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

export default ChartOfAccountList;
