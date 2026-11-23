import React from 'react';

/**
 * Tiny, safe markdown renderer for the agent's `content`: headings (## ###), paragraphs, **bold**, *italic*, `code`,
 * bullet lists (- or *), numbered lists (1.) and line breaks. Everything is built with React elements, never HTML strings.
 */

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith('**')) out.push(<strong key={key} className="font-bold text-ink-primary">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={key} className="px-1 py-0.5 rounded bg-canvas-subtle border border-line-subtle font-mono text-[0.85em] text-ink-primary">{tok.slice(1, -1)}</code>);
    else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

function parse(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let cur: Block | null = null;
  const flush = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flush();
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ kind: 'h', level: h[1].length, text: h[2] });
    } else if (ul) {
      if (!cur || cur.kind !== 'ul') {
        flush();
        cur = { kind: 'ul', items: [] };
      }
      cur.items.push(ul[1]);
    } else if (ol) {
      if (!cur || cur.kind !== 'ol') {
        flush();
        cur = { kind: 'ol', items: [] };
      }
      cur.items.push(ol[1]);
    } else {
      if (!cur || cur.kind !== 'p') {
        flush();
        cur = { kind: 'p', lines: [] };
      }
      cur.lines.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export const RichText: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => {
  const blocks = parse(content || '');
  return (
    <div className={`space-y-2 text-sm leading-relaxed text-ink-primary ${className}`}>
      {blocks.map((b, bi) => {
        const key = `b${bi}`;
        if (b.kind === 'h')
          return b.level <= 2 ? (
            <h3 key={key} className="text-base font-bold text-ink-primary pt-1">{renderInline(b.text, key)}</h3>
          ) : (
            <h4 key={key} className="text-sm font-bold text-ink-primary pt-0.5">{renderInline(b.text, key)}</h4>
          );
        if (b.kind === 'ul')
          return (
            <ul key={key} className="list-disc pl-5 space-y-0.5 marker:text-brand-orange">
              {b.items.map((it, i) => <li key={i}>{renderInline(it, `${key}-${i}`)}</li>)}
            </ul>
          );
        if (b.kind === 'ol')
          return (
            <ol key={key} className="list-decimal pl-5 space-y-0.5 marker:font-bold marker:text-brand-orange">
              {b.items.map((it, i) => <li key={i}>{renderInline(it, `${key}-${i}`)}</li>)}
            </ol>
          );
        return (
          <p key={key}>
            {b.lines.map((l, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {renderInline(l, `${key}-${i}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};
