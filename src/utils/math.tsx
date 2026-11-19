import katex from 'katex';
import type { ReactNode } from 'react';

const INLINE_MATH_RE = /\$([^$\n]+?)\$/g;

/**
 * Render a string containing inline `$...$` LaTeX expressions into React nodes.
 */
export function renderTextWithMath(text: string): ReactNode {
  if (!text.includes('$')) return text;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_MATH_RE.lastIndex = 0;

  while ((match = INLINE_MATH_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const html = katex.renderToString(match[1].trim(), {
      displayMode: false,
      throwOnError: false,
    });
    parts.push(
      <span
        key={match.index}
        className="wx-inline-formula"
        dangerouslySetInnerHTML={{ __html: html }}
      />,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
