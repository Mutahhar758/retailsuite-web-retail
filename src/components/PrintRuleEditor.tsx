import React from 'react';
import { Radio, Switch, Select, InputNumber, Space, Typography, Tag } from 'antd';
import { PrinterOutlined, SaveOutlined, ThunderboltOutlined, EyeOutlined } from '@ant-design/icons';
import {
  type PrintRuleConfig,
  type PrintAction,
  type AmountOperator,
  formatPrintRuleSummary,
} from '../utils/printRuleUtils';

const { Text } = Typography;

interface PrintRuleEditorProps {
  value: PrintRuleConfig;
  onChange: (next: PrintRuleConfig) => void;
  disabled?: boolean;
}

export const PrintRuleEditor: React.FC<PrintRuleEditorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const handleFieldChange = <K extends keyof PrintRuleConfig>(
    field: K,
    fieldValue: PrintRuleConfig[K]
  ) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Default Save Option:
        </Text>
        <Radio.Group
          value={value.defaultAction}
          onChange={(e) => handleFieldChange('defaultAction', e.target.value as PrintAction)}
          buttonStyle="solid"
          disabled={disabled}
        >
          <Radio.Button value="save_and_print">
            <PrinterOutlined style={{ marginRight: 6 }} />
            Save &amp; Print
          </Radio.Button>
          <Radio.Button value="save_and_preview">
            <EyeOutlined style={{ marginRight: 6 }} />
            Save &amp; Preview
          </Radio.Button>
          <Radio.Button value="save_only">
            <SaveOutlined style={{ marginRight: 6 }} />
            Save Only
          </Radio.Button>
        </Radio.Group>
      </div>

      <div
        style={{
          padding: 12,
          borderRadius: 8,
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <ThunderboltOutlined style={{ color: '#0284c7' }} />
            <Text strong>Amount-Based Condition</Text>
          </Space>
          <Switch
            checked={Boolean(value.amountConditionEnabled)}
            onChange={(checked) => handleFieldChange('amountConditionEnabled', checked)}
            disabled={disabled}
            checkedChildren="On"
            unCheckedChildren="Off"
          />
        </div>

        {value.amountConditionEnabled && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Text>If Net Amount is</Text>
            <Select<AmountOperator>
              value={value.amountOperator || '>'}
              onChange={(val) => handleFieldChange('amountOperator', val)}
              disabled={disabled}
              style={{ width: 155 }}
              options={[
                { value: '>', label: '> Greater than' },
                { value: '>=', label: '>= Greater or equal' },
                { value: '<', label: '< Less than' },
                { value: '<=', label: '<= Less or equal' },
              ]}
            />
            <InputNumber
              value={value.amountThreshold ?? 1000}
              onChange={(val) => handleFieldChange('amountThreshold', val ?? 0)}
              min={0}
              disabled={disabled}
              style={{ width: 130 }}
              formatter={(v) => (v !== undefined && v !== null ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '')}
              parser={(v) => Number(v?.replace(/,/g, '') || 0)}
              prefix="Rs."
            />
            <Text>then</Text>
            <Select<PrintAction>
              value={value.amountAction || 'save_and_print'}
              onChange={(val) => handleFieldChange('amountAction', val)}
              disabled={disabled}
              style={{ width: 145 }}
              options={[
                { value: 'save_and_print', label: 'Save & Print' },
                { value: 'save_and_preview', label: 'Save & Preview' },
                { value: 'save_only', label: 'Save Only' },
              ]}
            />
          </div>
        )}
      </div>

      <div>
        <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
          Active Rule Preview:
        </Text>
        <Tag
          color={
            value.defaultAction === 'save_and_print'
              ? 'blue'
              : value.defaultAction === 'save_and_preview'
              ? 'cyan'
              : 'green'
          }
        >
          {formatPrintRuleSummary(value)}
        </Tag>
      </div>
    </div>
  );
};
