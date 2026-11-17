import React, { useEffect, useState } from 'react';
import { Button, Input, Popover, Segmented, Space, Tag, Tooltip, Typography, message } from 'antd';
import { CloudOutlined, DesktopOutlined, SyncOutlined } from '@ant-design/icons';
import { useAppStore, type ConnectionMode } from '../../stores/useAppStore';
import { getActiveBaseUrl, probeLocalServer, resolveConnectionTarget } from '../../services/connectionManager';
import api from '../../services/api';

const { Text } = Typography;

interface ConnectionSwitcherProps {
  compact?: boolean;
}

export const ConnectionSwitcher: React.FC<ConnectionSwitcherProps> = ({ compact = false }) => {
  const {
    licenses,
    currentTenantIdentifier,
    connectionMode,
    localServerUrl,
    cloudServerUrl,
    activeTarget,
    setConnectionMode,
    setLocalServerUrl,
    setCloudServerUrl,
    updateLicenseFeatures,
  } = useAppStore();

  const currentLicense = licenses.find((l) => l.tenantIdentifier === currentTenantIdentifier);
  const isOnPremises = Boolean(currentLicense?.isOnPremises);

  const [checking, setChecking] = useState(false);
  const [localDraft, setLocalDraft] = useState(localServerUrl);
  const [cloudDraft, setCloudDraft] = useState(cloudServerUrl);

  useEffect(() => {
    setLocalDraft(localServerUrl);
  }, [localServerUrl]);

  useEffect(() => {
    setCloudDraft(cloudServerUrl);
  }, [cloudServerUrl]);

  // Backfill isOnPremises for licenses cached prior to this field
  useEffect(() => {
    if (!currentLicense || currentLicense.isOnPremises !== undefined || !currentLicense.licenseKey) {
      return;
    }
    let cancelled = false;
    api
      .get(`/api/license/verify/${encodeURIComponent(currentLicense.licenseKey)}`)
      .then((res) => {
        if (cancelled) return;
        const tenantData = res.data?.body || res.data;
        updateLicenseFeatures(currentLicense.tenantIdentifier, {
          isOnPremises: Boolean(tenantData?.isOnPremises),
        });
      })
      .catch(() => {
        // Ignore offline/transient lookup failures
      });
    return () => {
      cancelled = true;
    };
  }, [currentLicense?.tenantIdentifier, currentLicense?.isOnPremises, currentLicense?.licenseKey, updateLicenseFeatures]);

  useEffect(() => {
    if (isOnPremises && connectionMode === 'auto') {
      void resolveConnectionTarget();
    }
  }, [isOnPremises, connectionMode, currentTenantIdentifier]);

  if (!isOnPremises) {
    return null;
  }

  const handleModeChange = async (value: ConnectionMode) => {
    setConnectionMode(value);
    if (value === 'auto') {
      setChecking(true);
      const resolved = await resolveConnectionTarget();
      setChecking(false);
      message.info(`Auto mode connected to ${resolved === 'local' ? 'Local POS' : 'Cloud Relay'}`);
    }
  };

  const handleSaveAndTest = async () => {
    const trimmedLocal = localDraft.trim();
    const trimmedCloud = cloudDraft.trim();
    if (trimmedLocal) setLocalServerUrl(trimmedLocal);
    if (trimmedCloud) setCloudServerUrl(trimmedCloud);

    setChecking(true);
    try {
      const localOk = await probeLocalServer(trimmedLocal || localServerUrl);
      if (connectionMode === 'auto') {
        await resolveConnectionTarget();
      }
      if (localOk) {
        message.success('Local POS server is reachable');
      } else {
        message.warning('Local POS server is not reachable; using Cloud Relay');
      }
    } finally {
      setChecking(false);
    }
  };

  const isLocal = activeTarget === 'local';
  const activeLabel = isLocal ? 'Local POS' : 'Cloud Relay';
  const modeSuffix = connectionMode === 'auto' ? ' (Auto)' : '';

  const popoverContent = (
    <div style={{ width: 290 }}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <div>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Connection Mode
          </Text>
          <Segmented
            block
            size="small"
            value={connectionMode}
            onChange={(val) => void handleModeChange(val as ConnectionMode)}
            options={[
              { label: 'Auto', value: 'auto' },
              { label: 'Local POS', value: 'local' },
              { label: 'Cloud', value: 'cloud' },
            ]}
          />
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
            Local Server URL
          </Text>
          <Input
            size="small"
            value={localDraft}
            onChange={(e) => setLocalDraft(e.target.value)}
            placeholder="http://localhost:5050"
          />
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
            Cloud Server URL
          </Text>
          <Input
            size="small"
            value={cloudDraft}
            onChange={(e) => setCloudDraft(e.target.value)}
            placeholder="https://localhost:5001"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
            Active: {getActiveBaseUrl()}
          </Text>
          <Button
            size="small"
            type="primary"
            icon={<SyncOutlined spin={checking} />}
            loading={checking}
            onClick={() => void handleSaveAndTest()}
          >
            Test
          </Button>
        </div>
      </Space>
    </div>
  );

  return (
    <Popover content={popoverContent} title="Server Connection" trigger="click" placement="bottomRight">
      <Tooltip title={`Connected to ${activeLabel}${modeSuffix}: ${getActiveBaseUrl()}`}>
        <Tag
          color={isLocal ? 'green' : 'blue'}
          icon={isLocal ? <DesktopOutlined /> : <CloudOutlined />}
          style={{
            cursor: 'pointer',
            margin: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: compact ? '2px 8px' : '4px 10px',
            borderRadius: 999,
            userSelect: 'none',
          }}
        >
          {compact ? activeLabel : `${activeLabel}${modeSuffix}`}
        </Tag>
      </Tooltip>
    </Popover>
  );
};
