import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split into lines
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = (keyPrefix: string) => {
    if (currentList) {
      const items = currentList.items.map((item, i) => (
        <li key={`${keyPrefix}-li-${i}`} style={{ marginBottom: 4 }}>
          {renderInline(item)}
        </li>
      ));

      if (currentList.type === 'ul') {
        elements.push(
          <ul key={`${keyPrefix}-ul`} style={{ margin: '4px 0 8px 18px', padding: 0 }}>
            {items}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`${keyPrefix}-ol`} style={{ margin: '4px 0 8px 18px', padding: 0 }}>
            {items}
          </ol>
        );
      }
      currentList = null;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList(`flush-${idx}`);
      elements.push(<div key={`spacer-${idx}`} style={{ height: 6 }} />);
      return;
    }

    // Unordered bullet item (- item or * item)
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList(`switch-${idx}`);
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(bulletMatch[2]);
      return;
    }

    // Ordered list item (1. item)
    const orderMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (orderMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList(`switch-${idx}`);
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(orderMatch[2]);
      return;
    }

    // Flush any pending list
    flushList(`line-${idx}`);

    // Headers (### Header)
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={`h4-${idx}`} style={{ margin: '6px 0 4px', fontSize: 15, fontWeight: 600 }}>
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h3-${idx}`} style={{ margin: '8px 0 4px', fontSize: 16, fontWeight: 600 }}>
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={`h2-${idx}`} style={{ margin: '10px 0 6px', fontSize: 17, fontWeight: 700 }}>
          {renderInline(trimmed.slice(2))}
        </h2>
      );
      return;
    }

    // Standard paragraph line
    elements.push(
      <p key={`p-${idx}`} style={{ margin: '0 0 4px 0', lineHeight: 1.5 }}>
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList('final-flush');

  return <div style={{ wordBreak: 'break-word' }}>{elements}</div>;
};

// Inline parsing helper: **bold**, *italic*, `code`
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Tokenize regex for **bold**, *italic*, `code`
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`b-${match.index}`} style={{ fontWeight: 600 }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={`i-${match.index}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`c-${match.index}`}
          style={{
            background: 'rgba(0, 0, 0, 0.06)',
            padding: '2px 5px',
            borderRadius: 4,
            fontSize: '0.9em',
            fontFamily: 'monospace'
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}
