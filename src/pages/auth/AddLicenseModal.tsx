import React, { useState } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useAppStore } from '../../stores/useAppStore';

interface AddLicenseModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

export const AddLicenseModal: React.FC<AddLicenseModalProps> = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { addLicense } = useAppStore();

  const handleVerify = async (values: { licenseKey: string }) => {
    setLoading(true);
    try {
      // According to Desktop app: GET /api/license/verify/{licenseKey}
      const response = await api.get(`/api/license/verify/${values.licenseKey}`);
      
      const tenantData = response.data?.body || response.data;
      const tenantIdentifier = tenantData?.identifier || tenantData?.id;
      const name = tenantData?.name || 'Unknown Organization';

      if (tenantIdentifier) {
        addLicense({
          licenseKey: values.licenseKey,
          tenantIdentifier,
          name
        });
        message.success(`Successfully added license for ${name}`);
        form.resetFields();
        if (onSuccess) {
          onSuccess();
        } else {
          onCancel();
        }
      } else {
        message.error('Invalid response from license server.');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.metadata?.message || error.message || 'Verification failed';
      message.error(`License verification failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Add Organization License"
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleVerify}
        className="mt-4"
      >
        <Form.Item
          name="licenseKey"
          label="License Key"
          rules={[{ required: true, message: 'Please input the license key!' }]}
        >
          <Input 
            prefix={<KeyOutlined />} 
            placeholder="Enter your organization license key" 
            size="large"
          />
        </Form.Item>
        <Form.Item className="mb-0 text-right">
          <Button onClick={onCancel} className="mr-2">Cancel</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Verify & Add
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};
