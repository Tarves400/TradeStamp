/**
 * webImageShare.ts
 *
 * Zero-dependency web image generation and sharing.
 * Pipeline: card data → SVG string → Canvas → PNG Blob → Web Share API / anchor download
 *
 * Works in any modern browser (Chrome, Safari, Firefox) and Expo Web preview.
 */

// ── XML escape helper ─────────────────────────────────────────────────────────
function esc(s: string | number | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FONT = 'system-ui,-apple-system,Arial,Helvetica,sans-serif';

// ── Trade card SVG ─────────────────────────────────────────────────────────────
export type TradeCardData = {
  date: string;
  time?: string;
  type: string;
  pair?: string;
  result?: string;
  rr?: number | string;
  displayValue?: string;
  amount?: number;
  lotSize?: string | number;
  entryPrice?: string | number;
  exitPrice?: string | number;
  stopLoss?: string | number;
};

export type CardColors = {
  panel: string;
  accent: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  accentDim: string;
  dangerDim: string;
  label?: string;
};

export function buildTradeSvg(entry: TradeCardData, colors: CardColors): string {
  const isWin  = entry.type === 'Trade' && entry.result === 'Win';
  const isLoss = entry.type === 'Trade' && entry.result === 'Loss';
  const isDep  = entry.type === 'Deposit';

  const badgeLabel = isWin ? 'WIN' : isLoss ? 'LOSS' : isDep ? 'DEPOSIT' : 'WITHDRAW';
  const badgeColor = isWin ? colors.accent : isLoss ? colors.danger : isDep ? (colors.label ?? '#58a6ff') : colors.textMuted;
  const badgeBg    = isWin ? colors.accentDim : isLoss ? colors.dangerDim : isDep ? 'rgba(88,166,255,0.15)' : 'rgba(107,114,128,0.2)';

  const valueStr  = entry.type === 'Trade'
    ? (entry.displayValue || `${(Number(entry.rr) ?? 0) >= 0 ? '+' : ''}${entry.rr} RR`)
    : `${isDep ? '+' : '-'}$${(entry.amount ?? 0).toFixed(2)}`;
  const valueColor = isWin ? colors.accent : isLoss ? colors.danger : isDep ? colors.accent : colors.danger;

  const pairText = entry.type === 'Trade' ? (entry.pair || '—') : entry.type;

  // Badge width based on label length
  const badgeW = Math.max(44, badgeLabel.length * 8 + 20);

  // Detail fields
  const details: Array<{ label: string; value: string; color: string }> = [];
  if (entry.type === 'Trade') {
    if (entry.lotSize)    details.push({ label: 'LOT SIZE',   value: String(entry.lotSize),    color: colors.text });
    if (entry.entryPrice) details.push({ label: 'ENTRY',      value: String(entry.entryPrice), color: colors.accent });
    if (entry.exitPrice)  details.push({ label: 'EXIT',       value: String(entry.exitPrice),  color: isWin ? colors.accent : colors.danger });
    if (entry.stopLoss)   details.push({ label: 'STOP LOSS',  value: String(entry.stopLoss),   color: colors.danger });
  }

  const hasDetails = details.length > 0;
  const H = hasDetails ? 265 : 220;
  const dividerY = hasDetails ? 218 : 176;
  const footerY  = dividerY + 28;

  // Build detail row SVG
  let detailsSvg = '';
  if (hasDetails) {
    details.forEach((d, i) => {
      const dx = 20 + i * 95;
      detailsSvg += `
        <text x="${dx}" y="152" font-family="${FONT}" font-size="9" font-weight="600" fill="${esc(colors.textMuted)}" text-transform="uppercase">${esc(d.label)}</text>
        <text x="${dx}" y="172" font-family="${FONT}" font-size="14" font-weight="700" fill="${esc(d.color)}">${esc(d.value)}</text>`;
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${H}" viewBox="0 0 400 ${H}">
  <rect x="0.5" y="0.5" width="399" height="${H - 1}" rx="14" fill="${esc(colors.panel)}" />
  <rect x="0.5" y="0.5" width="399" height="${H - 1}" rx="14" fill="none" stroke="${esc(colors.border)}" stroke-width="1" />

  <text x="20" y="44" font-family="${FONT}" font-size="13" font-weight="800" fill="${esc(colors.accent)}" letter-spacing="1.2">TradeStamp</text>
  <text x="380" y="44" font-family="${FONT}" font-size="11" fill="${esc(colors.textMuted)}" text-anchor="end">${esc(entry.date)}${entry.time ? ` · ${esc(entry.time)}` : ''}</text>

  <text x="20" y="86" font-family="${FONT}" font-size="28" font-weight="800" fill="${esc(colors.text)}">${esc(pairText)}</text>

  <rect x="20" y="97" width="${badgeW}" height="22" rx="5" fill="${esc(badgeBg)}" />
  <text x="${20 + badgeW / 2}" y="113" font-family="${FONT}" font-size="11" font-weight="800" fill="${esc(badgeColor)}" text-anchor="middle">${esc(badgeLabel)}</text>
  <text x="${20 + badgeW + 12}" y="113" font-family="${FONT}" font-size="22" font-weight="700" fill="${esc(valueColor)}">${esc(valueStr)}</text>

  ${detailsSvg}

  <line x1="20" y1="${dividerY}" x2="380" y2="${dividerY}" stroke="${esc(colors.border)}" stroke-width="1" />
  <text x="200" y="${footerY}" font-family="${FONT}" font-size="9" fill="${esc(colors.textMuted)}" text-anchor="middle">TradeStamp · Shared at ${esc(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</text>
</svg>`;
}

// ── All-Time Stats card SVG ───────────────────────────────────────────────────
export function buildAllTimeStatsSvg(
  stats: Array<{ label: string; value: string; color: string }>,
  colors: StatCardColors,
): string {
  const H = 70 + stats.length * 44 + 40;
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let rowsSvg = '';
  stats.forEach((s, i) => {
    const y = 58 + i * 44;
    rowsSvg += `
      <line x1="16" y1="${y + 26}" x2="284" y2="${y + 26}" stroke="${esc(colors.border)}" stroke-width="1" />
      <text x="16" y="${y + 14}" font-family="${FONT}" font-size="12" font-weight="500" fill="${esc(colors.textMuted)}">${esc(s.label)}</text>
      <text x="284" y="${y + 14}" font-family="${FONT}" font-size="13" font-weight="700" fill="${esc(s.color)}" text-anchor="end">${esc(s.value)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="${H}" viewBox="0 0 300 ${H}">
  <rect x="0.5" y="0.5" width="299" height="${H - 1}" rx="10" fill="${esc(colors.panel)}" />
  <rect x="0.5" y="0.5" width="299" height="${H - 1}" rx="10" fill="none" stroke="${esc(colors.border)}" stroke-width="1" />

  <text x="16" y="32" font-family="${FONT}" font-size="11" font-weight="700" fill="${esc(colors.textMuted)}" letter-spacing="0.5">ALL-TIME STATISTICS</text>

  ${rowsSvg}

  <text x="284" y="${H - 12}" font-family="${FONT}" font-size="8" fill="${esc(colors.textMuted)}" text-anchor="end">Shared at ${esc(now)} · TradeStamp</text>
</svg>`;
}

// ── Stat card SVG (ShareableCard) ─────────────────────────────────────────────
export type StatCardColors = {
  panel: string;
  accent: string;
  text: string;
  textMuted: string;
  border: string;
};

export function buildStatCardSvg(
  label: string,
  value: string,
  subValue: string | undefined,
  valueColor: string,
  subValueColor: string | undefined,
  colors: StatCardColors,
): string {
  const H = subValue ? 130 : 110;
  const now = new Date().toLocaleDateString('en-GB');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="${H}" viewBox="0 0 300 ${H}">
  <rect x="0.5" y="0.5" width="299" height="${H - 1}" rx="10" fill="${esc(colors.panel)}" />
  <rect x="0.5" y="0.5" width="299" height="${H - 1}" rx="10" fill="none" stroke="${esc(colors.border)}" stroke-width="1" />

  <text x="14" y="32" font-family="${FONT}" font-size="9" font-weight="700" fill="${esc(colors.textMuted)}" letter-spacing="0.5">${esc(label.toUpperCase())}</text>
  <text x="14" y="62" font-family="${FONT}" font-size="22" font-weight="700" fill="${esc(valueColor)}">${esc(value)}</text>
  ${subValue
    ? `<text x="14" y="84" font-family="${FONT}" font-size="12" font-weight="600" fill="${esc(subValueColor ?? colors.textMuted)}">${esc(subValue)}</text>`
    : ''}

  <text x="286" y="${H - 10}" font-family="${FONT}" font-size="8" fill="${esc(colors.textMuted)}" text-anchor="end">TradeStamp · ${esc(now)}</text>
</svg>`;
}

// ── SVG string → PNG Blob (2× retina) ────────────────────────────────────────
export function svgToPngBlob(svgString: string, width: number, height: number): Promise<Blob> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = (window as any).document as Document;
  const scale = 2;

  const canvas = doc.createElement('canvas') as HTMLCanvasElement;
  canvas.width  = width  * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(scale, scale);

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob returned null'));
        },
        'image/png',
        1.0,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG image failed to load'));
    };
    img.src = url;
  });
}

// ── Share PNG blob — Web Share API first, anchor download fallback ─────────────
export async function shareOrDownloadPng(blob: Blob, filename: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = (window as any).navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = (window as any).document as Document;

  // Try Web Share API with file support (Chrome Android, Safari iOS 15+)
  if (typeof nav.canShare === 'function' && typeof nav.share === 'function') {
    const file = new File([blob], filename, { type: 'image/png' });
    if (nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title: 'TradeStamp' });
      return;
    }
  }

  // Fallback: direct download via Blob URL + anchor tag
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a') as HTMLAnchorElement;
  a.href = url;
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
  URL.revokeObjectURL(url);
}
