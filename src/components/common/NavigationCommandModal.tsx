import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal, Input, Tag, Typography, Empty, theme, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import {
  SearchOutlined,
  EnterOutlined,
  PushpinOutlined,
  PushpinFilled,
  ThunderboltOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export interface SearchableNavItem {
  key: string;
  label: string;
  moduleLabel: string;
  groupLabel?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  isQuickAction?: boolean;
}

interface NavigationCommandModalProps {
  open: boolean;
  onClose: () => void;
  items: SearchableNavItem[];
  quickActions: SearchableNavItem[];
  pinnedKeys: string[];
  onTogglePin: (key: string, label: string) => void;
  onNavigate: (path: string) => void;
}

export const NavigationCommandModal: React.FC<NavigationCommandModalProps> = ({
  open,
  onClose,
  items,
  quickActions,
  pinnedKeys,
  onTogglePin,
  onNavigate,
}) => {
  const { token } = theme.useToken();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<InputRef>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const filteredList = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      const pinnedItems = items
        .filter((item) => pinnedKeys.includes(item.key))
        .map((item) => ({ ...item, section: 'Pinned Shortcuts' }));

      const actions = quickActions.map((act) => ({
        ...act,
        section: 'Quick Entry (+ New)',
      }));

      const regularItems = items.map((item) => ({
        ...item,
        section: item.moduleLabel,
      }));

      return [...pinnedItems, ...actions, ...regularItems];
    }

    const terms = trimmed.split(/\s+/);
    const allCandidates = [
      ...quickActions.map((act) => ({ ...act, section: 'Quick Entry (+ New)' })),
      ...items.map((item) => ({ ...item, section: item.moduleLabel })),
    ];

    const scored = allCandidates
      .map((item) => {
        const labelLower = item.label.toLowerCase();
        const moduleLower = item.moduleLabel.toLowerCase();
        const groupLower = (item.groupLabel || '').toLowerCase();
        const keyLower = item.key.toLowerCase();
        const keywordsLower = (item.keywords || []).join(' ').toLowerCase();
        const haystack = `${labelLower} ${moduleLower} ${groupLower} ${keyLower} ${keywordsLower}`;

        const matchesAllTerms = terms.every((t) => haystack.includes(t));
        if (!matchesAllTerms) return null;

        let score = 0;
        if (labelLower === trimmed) score += 100;
        else if (labelLower.startsWith(trimmed)) score += 60;
        else if (labelLower.includes(trimmed)) score += 40;
        if (item.isQuickAction) score += 10;
        if (pinnedKeys.includes(item.key)) score += 5;

        return { item, score };
      })
      .filter((entry): entry is { item: typeof allCandidates[number]; score: number } => entry !== null)
      .sort((a, b) => b.score - a.score);

    return scored.map((s) => s.item);
  }, [query, items, quickActions, pinnedKeys]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!listContainerRef.current) return;
    const activeEl = listContainerRef.current.querySelector(
      `[data-nav-index="${selectedIndex}"]`
    ) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = (path: string) => {
    onClose();
    onNavigate(path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredList.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredList.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredList.length) % filteredList.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredList[selectedIndex];
      if (target) {
        handleSelect(target.key);
      }
    }
  };

  // Group consecutive or sectioned items for display when not searching, or flat list with badges when searching
  const renderedContent = () => {
    if (filteredList.length === 0) {
      return (
        <div style={{ padding: '36px 16px', textAlign: 'center' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary">No matching menus or actions found for "{query}"</Text>}
          />
        </div>
      );
    }

    let lastSection = '';

    return filteredList.map((item, idx) => {
      const isSelected = idx === selectedIndex;
      const isPinned = pinnedKeys.includes(item.key);
      const showSectionHeader = !query.trim() && item.section !== lastSection;
      if (showSectionHeader) {
        lastSection = item.section;
      }

      return (
        <React.Fragment key={`${item.section}-${item.key}-${idx}`}>
          {showSectionHeader && (
            <div
              style={{
                padding: '10px 14px 4px',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: token.colorTextTertiary,
                userSelect: 'none',
              }}
            >
              {item.section}
            </div>
          )}
          <div
            data-nav-index={idx}
            onMouseEnter={() => setSelectedIndex(idx)}
            onClick={() => handleSelect(item.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 14px',
              margin: '2px 6px',
              borderRadius: token.borderRadiusSM,
              cursor: 'pointer',
              backgroundColor: isSelected ? token.colorPrimaryBg : 'transparent',
              borderLeft: isSelected ? `3px solid ${token.colorPrimary}` : '3px solid transparent',
              transition: 'background-color 0.12s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <span
                style={{
                  fontSize: 16,
                  color: item.isQuickAction ? token.colorSuccess : token.colorPrimary,
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon || <ThunderboltOutlined />}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontWeight: isSelected ? 600 : 500,
                    color: token.colorText,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.label}
                </span>
                {item.groupLabel && (
                  <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
                    {item.moduleLabel} &rsaquo; {item.groupLabel}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Tag
                bordered={false}
                color={item.isQuickAction ? 'green' : 'default'}
                style={{ margin: 0, fontSize: 11 }}
              >
                {item.moduleLabel}
              </Tag>

              {!item.isQuickAction && item.key !== '/' && (
                <Tooltip title={isPinned ? 'Remove from Shortcuts' : 'Pin to Shortcuts'}>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(item.key, item.label);
                    }}
                    style={{
                      padding: '4px 6px',
                      borderRadius: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      color: isPinned ? token.colorPrimary : token.colorTextQuaternary,
                    }}
                  >
                    {isPinned ? <PushpinFilled /> : <PushpinOutlined />}
                  </span>
                </Tooltip>
              )}

              {isSelected && (
                <EnterOutlined style={{ fontSize: 12, color: token.colorPrimary }} />
              )}
            </div>
          </div>
        </React.Fragment>
      );
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={620}
      styles={{
        body: { padding: 0 },
      }}
      style={{ top: 72 }}
      destroyOnClose
    >
      <div onKeyDown={handleKeyDown}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Input
            ref={inputRef}
            size="large"
            variant="borderless"
            prefix={<SearchOutlined style={{ color: token.colorPrimary, fontSize: 18, marginRight: 6 }} />}
            placeholder="Search any menu, voucher, report, or setting... (e.g. POS, Trial Balance, BOM)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            allowClear
            style={{ padding: '4px 0', fontSize: 15 }}
          />
          <Tag
            style={{
              margin: 0,
              cursor: 'pointer',
              fontSize: 11,
              color: token.colorTextSecondary,
              userSelect: 'none',
            }}
            onClick={onClose}
          >
            ESC
          </Tag>
        </div>

        <div
          ref={listContainerRef}
          style={{
            maxHeight: '62vh',
            overflowY: 'auto',
            padding: '6px 0',
          }}
        >
          {renderedContent()}
        </div>

        <div
          style={{
            padding: '8px 16px',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            backgroundColor: token.colorFillAlter,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: token.colorTextSecondary,
          }}
        >
          <div style={{ display: 'flex', gap: 16 }}>
            <span>
              <Tag style={{ marginRight: 4, fontSize: 10 }}>↑</Tag>
              <Tag style={{ marginRight: 4, fontSize: 10 }}>↓</Tag>
              Navigate
            </span>
            <span>
              <Tag style={{ marginRight: 4, fontSize: 10 }}>↵</Tag>
              Open
            </span>
            <span>
              <PushpinOutlined style={{ marginRight: 4 }} />
              Pin to Sidebar
            </span>
          </div>
          <span>{filteredList.length} results</span>
        </div>
      </div>
    </Modal>
  );
};
