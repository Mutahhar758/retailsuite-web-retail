import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Select, message, Space } from 'antd';
import { UserOutlined, LockOutlined, PlusOutlined, DisconnectOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAppStore } from '../../stores/useAppStore';
import { AddLicenseModal } from './AddLicenseModal';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { offlineCacheService } from '../../services/offlineCacheService';
import api from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  
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

  const handleOfflineLogin = () => {
    if (!currentTenantIdentifier) {
      message.warning('Please select an organization first.');
      return;
    }

    setTokens('offline-mode-token', 'offline-mode-refresh-token');
    setUser({ userName: 'Offline User' });
    message.success('Logged in to Offline Mode successfully!');
    navigate('/daily-entries/sale');
  };

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
        
        // Warm cache for the newly logged-in tenant!
        offlineCacheService.warmCache().catch(console.error);

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
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] dark:bg-[#141414] p-4" style={{ position: 'relative' }}>
      {!isOnline && (
        <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 1000 }}>
          <Button
            type="primary"
            danger
            icon={<DisconnectOutlined />}
            onClick={handleOfflineLogin}
            size="large"
            style={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            disabled={licenses.length === 0}
          >
            Login to Offline
          </Button>
        </div>
      )}

      <Card className="w-full max-w-md shadow-lg border-0 rounded-2xl overflow-hidden">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Logo" className="mx-auto mb-4" style={{ height: 64, objectFit: 'contain' }} />
          <Title level={2} className="mb-2">RetailSuite Portal</Title>
          <Text type="secondary">Sign in to access your dashboard</Text>
        </div>

        {!isOnline && (
          <div style={{ 
            background: '#fff2e8', 
            border: '1px solid #ffbb96', 
            borderRadius: '8px', 
            padding: '12px 16px', 
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d46b08', fontWeight: 600 }}>
              <DisconnectOutlined />
              <span>Internet Disconnected</span>
            </div>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              {licenses.length > 0 
                ? "You are currently offline. Select your organization below, then click 'Login to Offline Mode' to continue creating sales invoices."
                : "You are currently offline and no organizations are cached. You must login online at least once on this device."
              }
            </Text>
            {licenses.length > 0 && (
              <Button 
                type="primary" 
                danger 
                size="middle" 
                onClick={handleOfflineLogin}
                style={{ width: 'fit-content', marginTop: '4px' }}
              >
                Login to Offline Mode
              </Button>
            )}
          </div>
        )}

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
                disabled={!isOnline}
              />
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="username"
            rules={[{ required: !isOnline ? false : true, message: 'Please input your Username!' }]}
          >
            <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="Username" disabled={!isOnline} />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: !isOnline ? false : true, message: 'Please input your Password!' }]}
            style={{ marginBottom: 12 }}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="Password"
              disabled={!isOnline}
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <Link to="/forgot-password" style={{ fontSize: '14px', fontWeight: 500, pointerEvents: !isOnline ? 'none' : 'auto', color: !isOnline ? '#bfbfbf' : undefined }}>
              Forgot Password?
            </Link>
          </div>

          <Form.Item className="mb-0">
            <Button type="primary" htmlType="submit" className="w-full h-10" loading={loading} disabled={!isOnline}>
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
