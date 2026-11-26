import React, { useEffect, useState } from 'react';
import { Modal, Button, Typography, Space } from 'antd';
import { DisconnectOutlined, WifiOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineStore } from '../stores/useOfflineStore';

const { Text, Paragraph } = Typography;

const OFFLINE_ALLOWED_PATHS = ['/daily-entries/sale', '/daily-entries/pos-sale'];

/**
 * Confirmation modal shown when internet connectivity is lost while in Online Mode.
 * Never auto-switches to Offline Mode so in-progress vouchers are never lost.
 */
export const OfflineModePromptModal: React.FC = () => {
  const { isConnected, isOfflineMode } = useNetworkStatus();
  const { offlinePromptDismissed, setOfflineMode, setOfflinePromptDismissed } = useOfflineStore();
  const location = useLocation();
  const [debouncedVisible, setDebouncedVisible] = useState(false);

  const shouldPrompt = !isConnected && !isOfflineMode && !offlinePromptDismissed;

  // Debounce by 1.5s so brief Wi-Fi flickers don't interrupt the user
  useEffect(() => {
    if (!shouldPrompt) return;

    const timer = window.setTimeout(() => {
      setDebouncedVisible(true);
    }, 1500);

    return () => {
      window.clearTimeout(timer);
      setDebouncedVisible(false);
    };
  }, [shouldPrompt]);

  const visible = shouldPrompt && debouncedVisible;

  const isOnOfflineAllowedRoute = OFFLINE_ALLOWED_PATHS.some((p) =>
    location.pathname.startsWith(p)
  );

  const handleStayOnline = () => {
    setOfflinePromptDismissed(true);
    setDebouncedVisible(false);
  };

  const handleSwitchToOffline = () => {
    setOfflinePromptDismissed(false);
    setDebouncedVisible(false);
    setOfflineMode(true);
  };

  return (
    <Modal
      open={visible}
      closable={false}
      keyboard={false}
      maskClosable={false}
      centered
      width={460}
      title={
        <Space>
          <DisconnectOutlined style={{ color: '#d46b08', fontSize: 18 }} />
          <span>Internet Connection Lost</span>
        </Space>
      }
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={handleSwitchToOffline} danger>
            Switch to Offline Mode
          </Button>
          <Button type="primary" icon={<WifiOutlined />} onClick={handleStayOnline}>
            Stay Here (Wait for Internet)
          </Button>
        </Space>
      }
    >
      <Paragraph style={{ marginBottom: 10 }}>
        Your connection to the server was interrupted. Would you like to switch to{' '}
        <Text strong>Offline Mode</Text> or stay on this page while waiting for internet to return?
      </Paragraph>
      {!isOnOfflineAllowedRoute && (
        <Text type="warning" style={{ fontSize: 13 }}>
          Note: Switching to Offline Mode will navigate to Sale Voucher and unsaved entries on this
          page will be lost. Choose &ldquo;Stay Here&rdquo; to keep your current voucher safe.
        </Text>
      )}
    </Modal>
  );
};
