import React, { useEffect } from 'react';
import { Button, Space, notification } from 'antd';
import { CloudDownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAppUpdateStore } from '../stores/useAppUpdateStore';
import { applyPendingUpdate, dismissPendingUpdate } from '../utils/autoVersionRefresh';

const NOTIFICATION_KEY = 'app-update-available';

/**
 * Non-blocking update confirmation prompt.
 * Never auto-refreshes: if the user clicks "Later", closes it, or ignores it,
 * the current session continues undisturbed.
 */
export const AppUpdateNotifier: React.FC = () => {
  const { updateAvailable, availableVersion, isDismissed } = useAppUpdateStore();

  useEffect(() => {
    if (!updateAvailable || isDismissed) {
      notification.destroy(NOTIFICATION_KEY);
      return;
    }

    notification.info({
      key: NOTIFICATION_KEY,
      placement: 'bottomRight',
      duration: 0,
      icon: <CloudDownloadOutlined style={{ color: '#1677ff' }} />,
      message: availableVersion
        ? `New Update Available (v${availableVersion})`
        : 'New Update Available',
      description:
        'A newer version of RetailSuite is ready. Save your current work before updating — or ignore to stay on this version.',
      btn: (
        <Space>
          <Button
            size="small"
            onClick={() => {
              notification.destroy(NOTIFICATION_KEY);
              dismissPendingUpdate();
            }}
          >
            Later
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              notification.destroy(NOTIFICATION_KEY);
              applyPendingUpdate();
            }}
          >
            Update Now
          </Button>
        </Space>
      ),
      onClose: () => {
        dismissPendingUpdate();
      },
    });
  }, [updateAvailable, availableVersion, isDismissed]);

  return null;
};
