import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Tag, Space, Tooltip, message, type InputRef } from 'antd';
import {
  BarcodeOutlined,
  CheckCircleFilled,
  WarningFilled,
  CloseCircleOutlined,
  ThunderboltFilled,
  InfoCircleOutlined
} from '@ant-design/icons';
import type { Item } from '../../services/inventoryService';
import {
  useSettingsStore,
  BARCODE_FAST_SCAN_ENABLED_KEY,
  BARCODE_FAST_SCAN_SOUND_KEY,
  BARCODE_FAST_SCAN_AUTOFOCUS_KEY
} from '../../stores/useSettingsStore';
import { playScanSuccessTone, playScanErrorTone } from '../../utils/scannerAudio';

export interface BarcodeFastScanBarProps {
  items: Item[];
  onScanItem: (item: Item, scanQty: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
  compact?: boolean;
  extraAction?: React.ReactNode;
}

export interface LastScannedState {
  item: Item;
  qty: number;
  timestamp: number;
}

export const BarcodeFastScanBar: React.FC<BarcodeFastScanBarProps> = ({
  items,
  onScanItem,
  placeholder,
  autoFocus = true,
  className,
  style,
  compact = false,
  extraAction
}) => {
  const { getSetting } = useSettingsStore();

  const isEnabled = getSetting(BARCODE_FAST_SCAN_ENABLED_KEY, 'false') === 'true';
  const soundEnabled = getSetting(BARCODE_FAST_SCAN_SOUND_KEY, 'true') !== 'false';
  const autoFocusSetting = getSetting(BARCODE_FAST_SCAN_AUTOFOCUS_KEY, 'true') !== 'false';

  const [inputValue, setInputValue] = useState('');
  const [lastScanned, setLastScanned] = useState<LastScannedState | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const inputRef = useRef<InputRef>(null);

  // Auto-focus on mount if enabled
  useEffect(() => {
    if (isEnabled && autoFocus && autoFocusSetting) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isEnabled, autoFocus, autoFocusSetting]);

  // Global hotkey F2 or Alt+B to jump focus to the scanner input
  useEffect(() => {
    if (!isEnabled) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || (e.altKey && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isEnabled]);

  // Clear transient error notice after 4 seconds
  useEffect(() => {
    if (!errorNotice) return;
    const timer = setTimeout(() => setErrorNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [errorNotice]);

  const handleScan = useCallback(
    (codeToProcess?: string) => {
      const raw = (codeToProcess !== undefined ? codeToProcess : inputValue).trim();
      if (!raw) return;

      // Reset transient status
      setErrorNotice(null);

      // Support multiplier syntax, e.g. "5*890123" or "890123*5"
      let scanQty = 1;
      let cleanCode = raw;

      if (raw.includes('*')) {
        const parts = raw.split('*');
        if (parts.length === 2) {
          const firstNum = parseFloat(parts[0]);
          const secondNum = parseFloat(parts[1]);
          if (!isNaN(firstNum) && firstNum > 0 && isNaN(secondNum)) {
            scanQty = firstNum;
            cleanCode = parts[1].trim();
          } else if (isNaN(firstNum) && !isNaN(secondNum) && secondNum > 0) {
            scanQty = secondNum;
            cleanCode = parts[0].trim();
          }
        }
      }

      if (!cleanCode) return;

      // 1. Exact barcode match (case-insensitive)
      let matchedItem = items.find(
        (i) => i.barcode && i.barcode.trim().toLowerCase() === cleanCode.toLowerCase()
      );

      // 2. Exact item ID / Code match
      if (!matchedItem) {
        matchedItem = items.find(
          (i) =>
            String(i.id).trim().toLowerCase() === cleanCode.toLowerCase() ||
            (i.itemKey && i.itemKey.trim().toLowerCase() === cleanCode.toLowerCase())
        );
      }

      // 3. Exact item title match
      if (!matchedItem) {
        matchedItem = items.find(
          (i) => i.title && i.title.trim().toLowerCase() === cleanCode.toLowerCase()
        );
      }

      // 4. Fallback: single partial match on barcode or title if length >= 3
      if (!matchedItem && cleanCode.length >= 3) {
        const partialMatches = items.filter(
          (i) =>
            (i.barcode && i.barcode.toLowerCase().includes(cleanCode.toLowerCase())) ||
            (i.title && i.title.toLowerCase().includes(cleanCode.toLowerCase()))
        );
        if (partialMatches.length === 1) {
          matchedItem = partialMatches[0];
        }
      }

      if (matchedItem) {
        if (soundEnabled) {
          playScanSuccessTone();
        }
        onScanItem(matchedItem, scanQty);
        setLastScanned({
          item: matchedItem,
          qty: scanQty,
          timestamp: Date.now()
        });
        setInputValue('');

        if (autoFocusSetting) {
          // Re-focus immediately for continuous hands-free scanning
          setTimeout(() => {
            inputRef.current?.focus();
          }, 20);
        }
      } else {
        if (soundEnabled) {
          playScanErrorTone();
        }
        setErrorNotice(`Barcode "${cleanCode}" not found`);
        message.warning(`Barcode "${cleanCode}" not found in inventory.`);
        inputRef.current?.select();
      }
    },
    [inputValue, items, onScanItem, soundEnabled, autoFocusSetting]
  );

  if (!isEnabled) {
    return null;
  }

  return (
    <div
      className={`barcode-fast-scan-bar ${className || ''}`}
      style={{
        backgroundColor: '#f0fdf4',
        border: '1.5px solid #86efac',
        borderRadius: 10,
        padding: compact ? '8px 12px' : '10px 16px',
        marginBottom: 14,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        boxShadow: '0 2px 6px rgba(16, 185, 129, 0.08)',
        ...style
      }}
    >
      {/* Left: Input with Barcode Icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: '#dcfce7',
            color: '#15803d',
            fontSize: 20,
            flexShrink: 0
          }}
        >
          <BarcodeOutlined />
        </div>

        <div style={{ position: 'relative', flex: 1 }}>
          <Input
            ref={inputRef}
            size="middle"
            allowClear
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={() => handleScan()}
            placeholder={
              placeholder || 'Scan barcode / item code and press Enter (or press F2 to focus)...'
            }
            prefix={
              <ThunderboltFilled style={{ color: '#16a34a', marginRight: 4, fontSize: 13 }} />
            }
            suffix={
              <Space size={4}>
                <Tooltip title="Press F2 from anywhere to immediately focus this scanner input.">
                  <Tag
                    color="green"
                    style={{
                      margin: 0,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 4,
                      padding: '0 5px'
                    }}
                    onClick={() => inputRef.current?.focus()}
                  >
                    F2
                  </Tag>
                </Tooltip>
              </Space>
            }
            style={{
              height: 40,
              borderRadius: 8,
              fontSize: 14,
              borderColor: '#86efac',
              boxShadow: 'none'
            }}
          />
        </div>
      </div>

      {/* Right / Status Feedback */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {errorNotice ? (
          <Tag
            icon={<WarningFilled style={{ color: '#ef4444' }} />}
            color="error"
            style={{
              fontSize: 13,
              padding: '4px 10px',
              borderRadius: 6,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            {errorNotice}
            <CloseCircleOutlined
              style={{ cursor: 'pointer', marginLeft: 4 }}
              onClick={() => setErrorNotice(null)}
            />
          </Tag>
        ) : lastScanned ? (
          <Tag
            icon={<CheckCircleFilled style={{ color: '#16a34a' }} />}
            color="success"
            style={{
              fontSize: 13,
              padding: '4px 10px',
              borderRadius: 6,
              fontWeight: 600,
              maxWidth: 340,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            Added: {lastScanned.item.title} {lastScanned.qty > 1 ? `(x${lastScanned.qty})` : ''} • Rs.{' '}
            {lastScanned.item.priRate || 0}
          </Tag>
        ) : (
          <Tag
            color="default"
            style={{
              fontSize: 12,
              padding: '3px 8px',
              borderRadius: 6,
              color: '#15803d',
              backgroundColor: '#ecfdf5',
              borderColor: '#bbf7d0'
            }}
          >
            ⚡ Fast Scan Active
          </Tag>
        )}

        <Tooltip title="Supports USB/Bluetooth Barcode Readers, numeric SKU entry, and quantity multiplier like '5*barcode'. Configurable in Settings.">
          <InfoCircleOutlined style={{ color: '#64748b', fontSize: 16, cursor: 'help' }} />
        </Tooltip>

        {extraAction}
      </div>
    </div>
  );
};

export default BarcodeFastScanBar;
