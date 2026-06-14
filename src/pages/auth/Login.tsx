import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Select, message, Space } from 'antd';
import { UserOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAppStore } from '../../stores/useAppStore';
import { AddLicenseModal } from './AddLicenseModal';
import api from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const navigate = useNavigate();
  
  const { licenses, currentTenantIdentifier, setCurrentTenant } = useAppStore();
  const { setTokens, setUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // If no licenses exist, prompt to add one
    if (licenses.length === 0) {
      setIsLicenseModalOpen(true);
    }
  }, [licenses]);

  if (isAuthenticated()) {
    return null;
  }

  const onFinish = async (values: any) => {
    if (!currentTenantIdentifier) {
      message.warning('Please select an organization first.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', {
        login: values.username,
        loginType: 'Username',
        password: values.password
      });

      const body = response.data?.body || response.data;
      if (body && (body.token || body.accessToken)) {
        setTokens(body.token || body.accessToken, body.refreshToken);
        setUser({ userName: values.username });
        message.success('Login successful!');
        navigate('/');
      } else {
        message.error('Invalid response from server.');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.metadata?.message || error.message || 'Login failed';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] dark:bg-[#141414] p-4">
      <Card className="w-full max-w-md shadow-lg border-0 rounded-2xl overflow-hidden">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Logo" className="mx-auto mb-4" style={{ height: 64, objectFit: 'contain' }} />
          <Title level={2} className="mb-2">RetailSuite Portal</Title>
          <Text type="secondary">Sign in to access your dashboard</Text>
        </div>

        <Form
          name="login_form"
          layout="vertical"
          onFinish={onFinish}
          size="large"
        >
          <Form.Item label="Organization">
            <Space.Compact style={{ width: '100%' }}>
              <Select
                value={currentTenantIdentifier}
                onChange={setCurrentTenant}
                placeholder="Select Organization"
                style={{ width: '100%' }}
                disabled={licenses.length === 0}
              >
                {licenses.map(lic => (
                  <Option key={lic.tenantIdentifier} value={lic.tenantIdentifier}>
                    {lic.name}
                  </Option>
                ))}
              </Select>
              <Button 
                icon={<PlusOutlined />} 
                onClick={() => setIsLicenseModalOpen(true)}
                title="Add new organization"
              />
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Please input your Username!' }]}
          >
            <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="Username" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your Password!' }]}
            style={{ marginBottom: 12 }}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="Password"
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <Link to="/forgot-password" style={{ fontSize: '14px', fontWeight: 500 }}>
              Forgot Password?
            </Link>
          </div>

          <Form.Item className="mb-0">
            <Button type="primary" htmlType="submit" className="w-full h-10" loading={loading}>
              Log in
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <AddLicenseModal 
        open={isLicenseModalOpen} 
        onCancel={() => {
          if (licenses.length > 0) {
            setIsLicenseModalOpen(false);
          } else {
            message.warning('You must add an organization to continue.');
          }
        }} 
        onSuccess={() => setIsLicenseModalOpen(false)}
      />
    </div>
  );
};
