import React from 'react';

export interface ShortcutItem {
  key: string;
  label: string;
}

interface Props {
  shortcuts?: ShortcutItem[];
  style?: React.CSSProperties;
}

const defaultShortcuts: ShortcutItem[] = [
  { key: 'F1', label: 'New' },
  { key: 'F2', label: 'Search / Focus' },
  { key: 'F5', label: 'Save' },
  { key: 'Ins', label: 'Add Row' },
  { key: 'Enter', label: 'Next Field' },
  { key: '↑↓←→', label: 'Navigate' },
  { key: 'Esc', label: 'Cancel Edit' },
];

export const KeyboardShortcutsBar: React.FC<Props> = ({ shortcuts = defaultShortcuts, style }) => {
  return (
    <div
      style={{
        marginTop: '8px',
        padding: '4px 12px',
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 4,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        ...style,
      }}
    >
      <span style={{ color: '#aaa', fontSize: 14 }}>⌨️</span>
      {shortcuts.map(({ key, label }) => (
        <span key={key} style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
          <kbd
            style={{
              display: 'inline-block',
              padding: '1px 5px',
              fontSize: 11,
              fontFamily: 'monospace',
              background: '#fff',
              border: '1px solid #d9d9d9',
              borderRadius: 3,
              boxShadow: '0 1px 0 rgba(0,0,0,.1)',
              marginRight: 4,
            }}
          >
            {key}
          </kbd>
          {label}
        </span>
      ))}
    </div>
  );
};

export default KeyboardShortcutsBar;
