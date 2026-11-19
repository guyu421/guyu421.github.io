export interface WechatImportResult {
  title?: string;
  coverImage?: string;
  publishedAt?: string;
  bodyHtml: string;
}

function parseCnDateTimeToIso(raw: string): string | undefined {
  const m = raw.match(/(\d{4})[-年/.](\d{1,2})[-月/.](\d{1,2})日?\s+(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  const [, y, mo, d, h, mi] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi}:00+08:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Parse copied WeChat Official Account rich HTML or full page HTML source
 * into clean title, coverImage, and editor-ready HTML.
 */
export function parseWechatHtml(rawHtml: string): WechatImportResult {
  const trimmed = rawHtml.trim();
  if (!trimmed) {
    return { bodyHtml: '' };
  }

  // Extract cover image from WeChat page JS variable or og:image meta if full HTML source
  let coverImage: string | undefined;
  const cdnMatch = trimmed.match(/var\s+msg_cdn_url\s*=\s*["']([^"']+)["']/);
  const ogMatch = trimmed.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  );
  if (cdnMatch?.[1]) {
    coverImage = cdnMatch[1];
  } else if (ogMatch?.[1]) {
    coverImage = ogMatch[1];
  }

  const doc = new DOMParser().parseFromString(trimmed, 'text/html');

  // Extract publish time from WeChat JS variable `ct` or `#publish_time` / meta text
  let publishedAt: string | undefined;
  const ctMatch =
    trimmed.match(/\bvar\s+ct\s*=\s*["'](\d{10})["']/) ||
    trimmed.match(/create_time\s*[:=]\s*["'](\d{10})["']/);
  if (ctMatch?.[1]) {
    const d = new Date(Number(ctMatch[1]) * 1000);
    if (!Number.isNaN(d.getTime())) {
      publishedAt = d.toISOString();
    }
  }
  if (!publishedAt) {
    const pubText = doc.querySelector('#publish_time')?.textContent?.trim();
    if (pubText) {
      publishedAt = parseCnDateTimeToIso(pubText);
    }
  }
  if (!publishedAt) {
    const metaText = doc.querySelector('#meta_content')?.textContent ?? doc.body.textContent ?? '';
    publishedAt = parseCnDateTimeToIso(metaText.slice(0, 600));
  }

  const activityTitle =
    doc.querySelector('#activity-name')?.textContent?.trim() ||
    doc.querySelector('h1')?.textContent?.trim();

  const contentRoot =
    (doc.querySelector('#js_content') as HTMLElement | null) || doc.body;

  const parts: string[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent?.replace(/\u200b/g, '').trim();
      if (txt) {
        parts.push(`<p>${escapeHtml(txt)}</p>`);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (
      tag === 'script' ||
      tag === 'style' ||
      tag === 'noscript' ||
      el.id === 'activity-name' ||
      el.id === 'meta_content'
    ) {
      return;
    }

    if (tag === 'img') {
      const src = (
        el.getAttribute('data-src') ||
        el.getAttribute('src') ||
        ''
      ).trim();
      if (
        !src ||
        src.startsWith('data:image/svg') ||
        src.includes('res.wx.qq.com/mmbizwap')
      ) {
        return;
      }
      const wAttr = Number(el.getAttribute('width') || 0);
      if (wAttr > 0 && wAttr < 24) return;
      if (!coverImage) coverImage = src;
      const alt = el.getAttribute('alt')?.trim() || '';
      parts.push(
        `<p><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" referrerpolicy="no-referrer" /></p>`,
      );
      return;
    }

    if (tag === 'hr') {
      parts.push('<hr />');
      return;
    }

    if (tag === 'table') {
      const rowsHtml = Array.from(el.querySelectorAll('tr'))
        .map((tr) => {
          const cells = Array.from(tr.querySelectorAll('th, td')).map(
            (cell) => `<td>${escapeHtml(cell.textContent?.trim() ?? '')}</td>`,
          );
          return cells.length > 0 ? `<tr>${cells.join('')}</tr>` : '';
        })
        .filter(Boolean)
        .join('');
      if (rowsHtml) {
        parts.push(`<table><tbody>${rowsHtml}</tbody></table>`);
      }
      return;
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const txt = el.textContent?.replace(/\u200b/g, '').trim();
      if (txt && txt !== activityTitle) {
        parts.push(`<h2>${escapeHtml(txt)}</h2>`);
      }
      return;
    }

    if (tag === 'blockquote') {
      const txt = el.textContent?.replace(/\u200b/g, '').trim();
      if (txt) {
        parts.push(`<blockquote>${escapeHtml(txt)}</blockquote>`);
      }
      return;
    }

    const hasBlockChildren = Array.from(el.children).some((child) => {
      const ct = child.tagName.toLowerCase();
      return (
        ct === 'p' ||
        ct === 'section' ||
        ct === 'div' ||
        ct === 'h1' ||
        ct === 'h2' ||
        ct === 'h3' ||
        ct === 'blockquote' ||
        ct === 'table' ||
        ct === 'img' ||
        ct === 'ul' ||
        ct === 'ol'
      );
    });

    if (!hasBlockChildren && (tag === 'p' || tag === 'section' || tag === 'div' || tag === 'li')) {
      const txt = el.textContent?.replace(/\u200b/g, '').trim();
      if (txt) {
        parts.push(`<p>${escapeHtml(txt)}</p>`);
      }
      return;
    }

    Array.from(el.childNodes).forEach(walk);
  }

  Array.from(contentRoot.childNodes).forEach(walk);

  return {
    title: activityTitle || undefined,
    coverImage,
    publishedAt,
    bodyHtml: parts.join(''),
  };
}
