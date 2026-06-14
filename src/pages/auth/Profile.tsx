import React, { useState, useEffect } from 'react';
import { 
  Card, Typography, Row, Col, Avatar, Descriptions, Button, 
  Divider, Space, message, Spin, Modal, Form, Input, Checkbox
} from 'antd';
import { 
  UserOutlined, MailOutlined, PhoneOutlined, EditOutlined, 
  SafetyCertificateOutlined, LockOutlined
} from '@ant-design/icons';
import { profileService, type UserProfileDto } from '../../services/profileService';

const { Title, Text } = Typography;

export const Profile: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [passwordForm] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await profileService.getProfile();
      setProfile(data);
    } catch (error) {
      message.error('Failed to load profile details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChangePassword = async (values: any) => {
    try {
      setPasswordLoading(true);
      await profileService.changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
        logOutOfAllAccounts: values.logOutOfAllAccounts || false
      });
      message.success('Password changed successfully');
      setIsPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-sm border-gray-100 rounded-2xl overflow-hidden mb-6">
        <div className="h-32 bg-gradient-to-r from-blue-500 to-blue-600 -mx-6 -mt-6 mb-12"></div>
        <Row gutter={24} align="bottom" className="px-4">
          <Col>
            <Avatar 
              size={120} 
              src={profile?.imageUrl} 
              icon={<UserOutlined />} 
              className="border-4 border-white shadow-md bg-blue-500 -mt-16"
            />
          </Col>
          <Col flex="auto">
            <div className="pb-2">
              <Title level={2} style={{ margin: 0 }}>{profile?.firstName} {profile?.lastName}</Title>
              <Text type="secondary">@{profile?.userName}</Text>
            </div>
          </Col>
          <Col>
            <Button type="primary" icon={<EditOutlined />} className="mb-4">Edit Profile</Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={24}>
        <Col xs={24} md={16}>
          <Card title="Personal Information" className="shadow-sm border-gray-100 rounded-2xl mb-6">
            <Descriptions column={1} bordered>
              <Descriptions.Item label={<Space><UserOutlined /> Full Name</Space>}>
                {profile?.firstName} {profile?.lastName}
              </Descriptions.Item>
              <Descriptions.Item label={<Space><MailOutlined /> Email Address</Space>}>
                {profile?.email}
              </Descriptions.Item>
              <Descriptions.Item label={<Space><PhoneOutlined /> Phone Number</Space>}>
                {profile?.phoneNumber || 'Not provided'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card title="Account Security" className="shadow-sm border-gray-100 rounded-2xl mb-6">
            <div className="flex items-center justify-between mb-4">
              <Text>Account Status</Text>
              <Button size="small" type="primary" ghost className="bg-green-50 text-green-600 border-green-200">Active</Button>
            </div>
            <Divider />
            <Button 
              block 
              icon={<SafetyCertificateOutlined />}
              onClick={() => setIsPasswordModalVisible(true)}
            >
              Change Password
            </Button>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Change Password"
        open={isPasswordModalVisible}
        onCancel={() => setIsPasswordModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
        >
          <Form.Item
            name="oldPassword"
            label="Current Password"
            rules={[{ required: true, message: 'Please enter your current password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Current Password" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter a new password' },
              { min: 6, message: 'Password must be at least 6 characters' }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="New Password" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm your new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('The two passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm New Password" />
          </Form.Item>

          <Form.Item name="logOutOfAllAccounts" valuePropName="checked">
            <Checkbox>Log out of all other devices</Checkbox>
          </Form.Item>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setIsPasswordModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={passwordLoading}>
                Update Password
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
