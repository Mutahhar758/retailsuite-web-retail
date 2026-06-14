import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Input, Tooltip, Avatar, Divider, Popconfirm
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, 
  SearchOutlined, CalendarOutlined, DollarOutlined, SolutionOutlined,
  UserOutlined, IdcardOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { hrInfoService, type HRInfoResponse } from '../../services/hrInfoService';

const { Title, Text } = Typography;

export const HRInfoList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HRInfoResponse[]>([]);
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await hrInfoService.getHRInfos();
      setData(result || []);
    } catch (error) {
      message.error('Failed to fetch HR information records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    navigate('/setup/hr-info/new');
  };

  const handleEdit = (record: HRInfoResponse) => {
    navigate(`/setup/hr-info/${record.id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      await hrInfoService.delete(id);
      message.success('Employee HR record deleted successfully');
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to delete HR record');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(emp => 
    emp.name.toLowerCase().includes(searchText.toLowerCase()) ||
    emp.id.toLowerCase().includes(searchText.toLowerCase()) ||
    (emp.designation && emp.designation.toLowerCase().includes(searchText.toLowerCase())) ||
    (emp.cnic && emp.cnic.toLowerCase().includes(searchText.toLowerCase())) ||
    (emp.fatherName && emp.fatherName.toLowerCase().includes(searchText.toLowerCase()))
  );

  const columns = [
    {
      title: 'Employee ID',
      dataIndex: 'id',
      key: 'id',
      width: '120px',
      sorter: (a: HRInfoResponse, b: HRInfoResponse) => a.id.localeCompare(b.id),
      render: (text: string) => (
        <Text strong style={{ fontFamily: 'monospace', color: '#13c2c2', fontSize: '14px' }}>
          {text}
        </Text>
      ),
    },
    {
      title: 'Employee Details',
      key: 'details',
      sorter: (a: HRInfoResponse, b: HRInfoResponse) => a.name.localeCompare(b.name),
      render: (_: any, record: HRInfoResponse) => (
        <Space size="middle">
          <Avatar 
            icon={<UserOutlined />} 
            style={{ backgroundColor: '#e6fffb', color: '#13c2c2', border: '1px solid #87e8de' }} 
          />
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: '15px' }}>{record.name}</Text>
            {record.fatherName && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                S/O, D/O: {record.fatherName}
              </Text>
            )}
            <Space size={4} style={{ marginTop: '2px' }}>
              <Tag color="cyan" style={{ fontSize: '10px', lineHeight: '14px' }}>
                {record.gender}
              </Tag>
              {record.maritialStatus && (
                <Tag color="purple" style={{ fontSize: '10px', lineHeight: '14px' }}>
                  {record.maritialStatus}
                </Tag>
              )}
            </Space>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Designation & Dates',
      key: 'designationAndDates',
      render: (_: any, record: HRInfoResponse) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: '14px', color: '#595959' }}>
            {record.designation || <span style={{ fontStyle: 'italic', color: '#bfbfbf' }}>No Designation</span>}
          </Text>
          <Space size={4} style={{ marginTop: '4px' }}>
            <Tooltip title="Date of Birth">
              <CalendarOutlined style={{ color: '#bfbfbf', fontSize: '12px' }} />
            </Tooltip>
            <Text type="secondary" style={{ fontSize: '12px' }}>DOB: {record.dob}</Text>
          </Space>
          <Space size={4}>
            <Tooltip title="Joining Date">
              <CalendarOutlined style={{ color: '#bfbfbf', fontSize: '12px' }} />
            </Tooltip>
            <Text type="secondary" style={{ fontSize: '12px' }}>Joined: {record.joiningDate}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Compensation',
      key: 'compensation',
      sorter: (a: HRInfoResponse, b: HRInfoResponse) => a.salary - b.salary,
      render: (_: any, record: HRInfoResponse) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <DollarOutlined style={{ color: '#52c41a' }} />
            <Text strong style={{ fontSize: '14px' }}>
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(record.salary)}
            </Text>
            <Tag color="blue" style={{ fontSize: '10px' }}>
              {record.salaryType}
            </Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: '12px', marginTop: '2px' }}>
            Overtime: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(record.overtime)}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Leave Charge: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(record.leaveCharges)}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Linked Accounts',
      key: 'accounts',
      render: (_: any, record: HRInfoResponse) => (
        <Space direction="vertical" size={2}>
          {record.expenseAccount ? (
            <Space size={4}>
              <Tag color="orange" style={{ fontFamily: 'monospace' }}>Exp</Tag>
              <Text style={{ fontSize: '13px', fontFamily: 'monospace' }}>{record.expenseAccount}</Text>
            </Space>
          ) : (
            <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>No Expense Acc</Text>
          )}
          {record.payableAccount ? (
            <Space size={4}>
              <Tag color="green" style={{ fontFamily: 'monospace' }}>Pay</Tag>
              <Text style={{ fontSize: '13px', fontFamily: 'monospace' }}>{record.payableAccount}</Text>
            </Space>
          ) : (
            <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>No Payable Acc</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'CNIC',
      dataIndex: 'cnic',
      key: 'cnic',
      render: (text?: string) => text ? (
        <Space size={4}>
          <IdcardOutlined style={{ color: '#8c8c8c' }} />
          <Text style={{ fontSize: '13px', fontFamily: 'monospace' }}>{text}</Text>
        </Space>
      ) : (
        <Text type="secondary" style={{ fontSize: '13px', fontStyle: 'italic' }}>-</Text>
      ),
    },
    {
      title: 'Actions',
      key: 'action',
      width: '120px',
      fixed: 'right' as const,
      render: (_: any, record: HRInfoResponse) => (
        <Space size="middle">
          <Tooltip title="Edit HR Details">
            <Button 
              type="primary" 
              ghost
              icon={<EditOutlined />} 
              size="small"
              style={{ color: '#13c2c2', borderColor: '#87e8de' }}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Delete HR Record">
            <Popconfirm
              title="Are you sure you want to delete this HR record?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true, loading: loading }}
            >
              <Button 
                danger
                ghost
                icon={<DeleteOutlined />} 
                size="small"
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <SolutionOutlined style={{ fontSize: 24, color: '#13c2c2' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Human Resource Directory</Title>
            <Text type="secondary">Manage employee bio-data, designations, salary configurations, and accounting links</Text>
          </div>
        </Space>
        <Space>
          <Input
            placeholder="Search employees..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
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
            style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
          >
            New Employee HR Info
          </Button>
        </Space>
      </div>

      <Divider />

      <Table 
        columns={columns} 
        dataSource={filteredData} 
        loading={loading}
        rowKey="id"
        pagination={{ 
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} employees`
        }}
        className="border border-gray-100 rounded-lg overflow-hidden"
        scroll={{ x: 1000 }}
      />
    </Card>
  );
};
