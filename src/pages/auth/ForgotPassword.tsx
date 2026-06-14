import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Select, message, Space, Steps } from 'antd';
import { MailOutlined, SafetyCertificateOutlined, LockOutlined, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';
import api from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

export const ForgotPassword: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  
  const navigate = useNavigate();
  const { licenses, currentTenantIdentifier, setCurrentTenant } = useAppStore();

  const handleRequestOtp = async (values: { email: string }) => {
    if (!currentTenantIdentifier) {
      message.warning('Please select an organization first.');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Request Password Reset OTP
      await api.post('/api/users/forgot-password', {
        email: values.email,
      });

      setEmail(values.email);
      message.success('Password Reset OTP has been sent to your email.');
      setCurrentStep(1);
    } catch (error: any) {
      const errorMessage = error.response?.data?.metadata?.message || error.message || 'Failed to request OTP';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (values: any) => {
    if (values.password !== values.confirmPassword) {
      message.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Step 2: Verify Password OTP
      await api.post('/api/users/verify-password-otp', {
        email: email,
        otp: values.otp,
      });

      // Step 3: Reset Password using the OTP as the token
      await api.post('/api/users/reset-password', {
        email: email,
        password: values.password,
        token: values.otp,
      });

      message.success('Password reset successfully!');
      setCurrentStep(2);
    } catch (error: any) {
      const errorMessage = error.response?.data?.metadata?.message || error.message || 'Password reset failed';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] dark:bg-[#141414] p-4">
      <Card className="w-full max-w-md shadow-lg border-0 rounded-2xl overflow-hidden transition-all duration-300">
        <div className="mb-6">
          <Link to="/login" className="inline-flex items-center text-gray-500 hover:text-primary transition-colors">
            <ArrowLeftOutlined className="mr-2" />
            Back to Login
          </Link>
        </div>

        <div className="text-center mb-6">
          <img src="/logo.png" alt="Logo" className="mx-auto mb-4" style={{ height: 50, objectFit: 'contain' }} />
          <Title level={2} className="mb-2">Reset Password</Title>
          <Text type="secondary">Follow the steps to reset your password</Text>
        </div>

        <Steps 
          current={currentStep} 
          size="small" 
          className="mb-8 px-4"
          items={[
            { title: 'Request OTP' },
            { title: 'Reset Password' },
            { title: 'Success' }
          ]}
        />

        {currentStep === 0 && (
          <Form
            name="request_otp_form"
            layout="vertical"
            onFinish={handleRequestOtp}
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
              </Space.Compact>
            </Form.Item>

            <Form.Item
              name="email"
              label="Email Address"
              rules={[
                { required: true, message: 'Please input your Email!' },
                { type: 'email', message: 'Please enter a valid email address!' }
              ]}
            >
              <Input prefix={<MailOutlined className="text-gray-400" />} placeholder="Email Address" />
            </Form.Item>

            <Form.Item className="mt-6 mb-0">
              <Button type="primary" htmlType="submit" className="w-full h-10" loading={loading}>
                Send OTP
              </Button>
            </Form.Item>
          </Form>
        )}

        {currentStep === 1 && (
          <Form
            name="reset_password_form"
            layout="vertical"
            onFinish={handleResetPassword}
            size="large"
          >
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3 mb-6 text-center text-sm">
              <Text type="secondary">
                We sent a 6-digit OTP code to <strong className="text-primary">{email}</strong>.
              </Text>
            </div>

            <Form.Item
              name="otp"
              label="OTP Code"
              rules={[
                { required: true, message: 'Please input the OTP!' },
                { len: 6, message: 'OTP must be exactly 6 digits!' }
              ]}
            >
              <Input 
                prefix={<SafetyCertificateOutlined className="text-gray-400" />} 
                placeholder="6-Digit OTP Code" 
                maxLength={6}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="New Password"
              rules={[
                { required: true, message: 'Please input your new Password!' },
                { min: 6, message: 'Password must be at least 6 characters!' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="New Password"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="Confirm Password"
              rules={[
                { required: true, message: 'Please confirm your new Password!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('The two passwords do not match!'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="Confirm Password"
              />
            </Form.Item>

            <Form.Item className="mt-6 mb-0">
              <Button type="primary" htmlType="submit" className="w-full h-10" loading={loading}>
                Reset Password
              </Button>
            </Form.Item>
          </Form>
        )}

        {currentStep === 2 && (
          <div className="text-center py-6">
            <CheckCircleOutlined className="text-5xl text-green-500 mb-4 animate-bounce" />
            <Title level={3}>All Set!</Title>
            <div className="mb-8">
              <Text type="secondary">
                Your password has been successfully reset. You can now log in using your new credentials.
              </Text>
            </div>
            <Button 
              type="primary" 
              size="large" 
              className="w-full h-10" 
              onClick={() => navigate('/login')}
            >
              Go to Login
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
