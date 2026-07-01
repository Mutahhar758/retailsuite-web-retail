import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Space, Typography, Form, Input, Row, Col,
  message, Divider, Avatar,
} from 'antd';
import {
  SaveOutlined, ArrowLeftOutlined, UserOutlined, MailOutlined,
  PhoneOutlined, LockOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { userService } from '../../services/userService';

const { Title, Text } = Typography;

export const UserForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState<string>('');

  const fetchUser = useCallback(async () => {
    if (!isEdit) return;
    try {
      setLoading(true);
      const user = await userService.getUser(id!);
      if (user) {
        setUserName([user.firstName, user.lastName].filter(Boolean).join(' ') || user.userName || user.email || '');
        form.setFieldsValue({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          phoneNumber: user.phoneNumber || '',
          userName: user.userName || '',
        });
      } else {
        message.error('User not found');
        navigate('/setup/users');
      }
    } catch (error) {
      message.error('Failed to load user data');
      navigate('/setup/users');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, navigate, form]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleSubmit = async (values: any) => {
    try {
      setSubmitting(true);
      if (isEdit) {
        await userService.update(id!, {
          id: id!,
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phoneNumber: values.phoneNumber || undefined,
          userName: values.userName || undefined,
        });
        message.success('User updated successfully');
      } else {
        await userService.create({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          password: values.password,
          phoneNumber: values.phoneNumber || undefined,
          userName: values.userName || undefined,
        });
        message.success('User created successfully');
      }
      navigate('/setup/users');
    } catch (error: any) {
      message.error(error.response?.data?.metadata?.message || `Failed to ${isEdit ? 'update' : 'create'} user`);
    } finally {
      setSubmitting(false);
    }
  };

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl" loading={loading}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup/users')}>
          Back
        </Button>
        <Space align="center">
          {isEdit ? (
            <Avatar
              size={40}
              style={{ backgroundColor: '#e6f4ff', color: '#1677ff', border: '1px solid #bae0ff', fontWeight: 600, fontSize: 16 }}
            >
              {initials}
            </Avatar>
          ) : (
            <TeamOutlined style={{ fontSize: 28, color: '#1677ff' }} />
          )}
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit User: ${userName}` : 'Create New User'}
            </Title>
            <Text type="secondary">
              {isEdit ? 'Update user profile information' : 'Set up a new user account for this tenant'}
            </Text>
          </div>
        </Space>
      </div>

      <Divider />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark="optional"
        scrollToFirstError
      >
        {/* Personal Info */}
        <Title level={5} style={{ color: '#1677ff', marginBottom: 16 }}>
          <UserOutlined style={{ marginRight: 8 }} />
          Personal Information
        </Title>

        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Form.Item
              label="First Name"
              name="firstName"
              rules={[{ required: true, message: 'First name is required' }, { max: 100 }]}
            >
              <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="John" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              label="Last Name"
              name="lastName"
              rules={[{ required: true, message: 'Last name is required' }, { max: 100 }]}
            >
              <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="Doe" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Form.Item
              label="Email Address"
              name="email"
              rules={[
                { required: true, message: 'Email is required' },
                { type: 'email', message: 'Enter a valid email address' },
              ]}
            >
              <Input prefix={<MailOutlined className="text-gray-400" />} placeholder="john@example.com" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              label="Phone Number"
              name="phoneNumber"
              rules={[{ max: 20 }]}
            >
              <Input prefix={<PhoneOutlined className="text-gray-400" />} placeholder="+92 300 0000000" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Form.Item
              label="Username (User ID)"
              name="userName"
              rules={[{ required: true, message: 'Username (User ID) is required' }, { max: 100 }]}
            >
              <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="johndoe" />
            </Form.Item>
          </Col>
        </Row>

        {/* Password — only on create */}
        {!isEdit && (
          <>
            <Divider />
            <Title level={5} style={{ color: '#1677ff', marginBottom: 16 }}>
              <LockOutlined style={{ marginRight: 8 }} />
              Account Security
            </Title>
            <Row gutter={24}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Password"
                  name="password"
                  rules={[
                    { required: true, message: 'Password is required' },
                    { min: 6, message: 'Password must be at least 6 characters' },
                  ]}
                >
                  <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Min. 6 characters" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Confirm Password"
                  name="confirmPassword"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Please confirm the password' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Passwords do not match'));
                      },
                    }),
                  ]}
                >
                  <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Re-enter password" />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        <Divider />

        {/* Footer Actions */}
        <div className="flex justify-end gap-3">
          <Button onClick={() => navigate('/setup/users')} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={submitting}
          >
            {isEdit ? 'Update User' : 'Create User'}
          </Button>
        </div>
      </Form>
    </Card>
  );
};
