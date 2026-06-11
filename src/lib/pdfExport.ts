import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { TradeEntry } from './storage';

// ── Web-only helper: download an HTML string as a file via Blob + anchor tag ──
// This triggers a direct browser download without any print dialog.
function downloadHtmlOnWeb(html: string, filename: string): void {
  // `document` is a global in Expo Web (React Native Web / browser environment)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = (window as any).document as Document;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type PdfPeriod = '1d' | '3d' | '7d' | '1m' | 'all';

export function filterEntriesByPeriod(entries: TradeEntry[], period: PdfPeriod): TradeEntry[] {
  if (period === 'all') return [...entries];
  const now = Date.now();
  const ms: Record<Exclude<PdfPeriod, 'all'>, number> = {
    '1d': 86_400_000,
    '3d': 3 * 86_400_000,
    '7d': 7 * 86_400_000,
    '1m': 30 * 86_400_000,
  };
  const cutoff = now - ms[period];
  return entries.filter((e) => (e.sortTimestamp || 0) >= cutoff);
}

export function getPeriodLabel(period: PdfPeriod): string {
  const map: Record<PdfPeriod, string> = {
    '1d': 'Last 1 Day',
    '3d': 'Last 3 Days',
    '7d': 'Last 7 Days',
    '1m': 'Last 1 Month',
    'all': 'All Time',
  };
  return map[period];
}

// Compute equity chart points from entries (same logic as computeStats)
function computeChartPoints(entries: TradeEntry[]): number[] {
  const sorted = [...entries].sort((a, b) => (a.sortTimestamp || 0) - (b.sortTimestamp || 0));
  let runningBalance = 0;
  const points: number[] = [0];
  sorted.forEach((item) => {
    if (item.type === 'Deposit') {
      runningBalance += item.amount || 0;
    } else if (item.type === 'Withdraw') {
      runningBalance -= item.amount || 0;
    } else if (item.type === 'Trade') {
      runningBalance += (parseFloat(String(item.rr)) || 0) * 10;
    }
    points.push(runningBalance);
  });
  return points;
}

// Simple ASCII-style bar chart using only tables (max WebView compatibility)
function buildChartHtml(points: number[]): string {
  if (points.length <= 1) {
    return `<p style="color:#6b7280; font-size:12px; text-align:center; margin:16px 0;">No chart data available</p>`;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  // Build bar rows — each point is a thin vertical bar
  let barsHtml = '';
  points.forEach((val) => {
    const pct = ((val - min) / range) * 100;
    const color = val >= 0 ? '#00b45a' : '#da3637';
    const h = Math.max(Math.round(pct), 3);
    barsHtml += `<td style="padding:0; vertical-align:bottom; text-align:center; width:4px;">
      <div style="width:3px; height:${h}px; background:${color}; margin:0 auto; opacity:0.85; border-radius:1px 1px 0 0;"></div>
    </td>`;
  });

  return `
    <table cellpadding="0" cellspacing="1" style="width:100%; background:#161b22; border:1px solid #1f2a3c; border-radius:10px; margin-bottom:20px;">
      <tr><td colspan="${points.length}" style="padding:10px 14px; font-size:11px; color:#6b7280; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Equity Curve</td></tr>
      <tr style="height:120px;">${barsHtml}</tr>
      <tr><td colspan="${points.length}" style="padding:6px 14px; font-size:10px; color:#6b7280;">
        <span style="float:left;">Min: $${min.toFixed(2)}</span>
        <span style="float:right;">Max: $${max.toFixed(2)}</span>
      </td></tr>
    </table>
  `;
}

function buildHtml(entries: TradeEntry[], period: PdfPeriod): string {
  const label = getPeriodLabel(period);
  const now = new Date().toLocaleDateString('en-GB');

  // Compute stats for header
  let totalRR = 0;
  let totalTrades = 0;
  let wins = 0;
  let losses = 0;
  let totalWinRR = 0;
  let totalLossRR = 0;
  let totalDeposits = 0;
  let totalWithdraws = 0;

  entries.forEach((item) => {
    if (item.type === 'Trade') {
      totalTrades++;
      const rr = parseFloat(String(item.rr)) || 0;
      totalRR += rr;
      if (item.result === 'Win') {
        wins++;
        totalWinRR += rr;
      } else {
        losses++;
        totalLossRR += Math.abs(rr);
      }
    } else if (item.type === 'Deposit') {
      totalDeposits += item.amount || 0;
    } else if (item.type === 'Withdraw') {
      totalWithdraws += item.amount || 0;
    }
  });

  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const avgWin = wins > 0 ? totalWinRR / wins : 0;
  const avgLoss = losses > 0 ? totalLossRR / losses : 0;

  // Build chart
  const chartPoints = computeChartPoints(entries);
  const chartHtml = buildChartHtml(chartPoints);

  const rows = entries.length === 0
    ? `<tr><td colspan="7" style="text-align:center; color:#999; padding:20px;">No records found</td></tr>`
    : entries.map((e, i) => {
        const isWin = e.type === 'Trade' && e.result === 'Win';
        const isLoss = e.type === 'Trade' && e.result === 'Loss';
        const isDep = e.type === 'Deposit';
        const badgeColor = isWin ? '#00b45a' : isLoss ? '#da3637' : isDep ? '#4a90d9' : '#888';
        const badgeLabel = isWin ? 'WIN' : isLoss ? 'LOSS' : isDep ? 'DEPOSIT' : 'WITHDRAW';
        const value = e.type === 'Trade'
          ? `${(e.rr ?? 0) >= 0 ? '+' : ''}${e.rr} RR`
          : `${isDep ? '+' : '-'}$${(e.amount ?? 0).toFixed(2)}`;

        return `
          <tr style="background:${i % 2 === 0 ? '#1a1f2e' : '#161b22'}">
            <td style="padding:10px 12px; border-bottom:1px solid #1f2a3c; font-size:13px;">${i + 1}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #1f2a3c; font-size:13px;">${e.date}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #1f2a3c; font-size:13px; font-weight:700;">${e.type === 'Trade' ? (e.pair || '-') : e.type}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #1f2a3c; font-size:13px;">
              <span style="background:${badgeColor}22; color:${badgeColor}; padding:3px 8px; border-radius:4px; font-weight:700; font-size:11px;">${badgeLabel}</span>
            </td>
            <td style="padding:10px 12px; border-bottom:1px solid #1f2a3c; font-size:13px; font-weight:700; color:${isWin || isDep ? '#00b45a' : '#da3637'};">${value}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #1f2a3c; font-size:13px;">${e.lotSize ? e.lotSize : '-'}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #1f2a3c; font-size:13px;">${e.chartLink ? `<a href="${e.chartLink}" style="color:#4a90d9">Chart</a>` : '-'}</td>
          </tr>`;
      }).join('');

  // Use ONLY inline styles — no <style> block for maximum Android WebView compatibility
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
</head>
<body style="background:#0b0f19; color:#e5e7eb; font-family:-apple-system, Arial, sans-serif; margin:0; padding:24px;">

  <!-- Header -->
  <table style="width:100%; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid #1f2a3c;">
    <tr>
      <td style="font-size:20px; color:#00b45a; font-weight:800; letter-spacing:1.5px;">TradeStamp</td>
      <td style="text-align:right; font-size:12px; color:#6b7280;">${now}</td>
    </tr>
  </table>

  <div style="background:rgba(0,180,90,0.12); border:1px solid #00b45a; border-radius:4px; color:#00b45a; padding:4px 10px; font-size:12px; font-weight:700; display:inline-block; margin-bottom:20px;">
    ${label} &middot; ${entries.length} Entries
  </div>

  <!-- Stats -->
  <table style="width:100%; margin-bottom:20px; border-collapse:collapse;">
    <tr>
      <td style="background:#161b22; border:1px solid #1f2a3c; border-radius:8px; padding:10px 14px; width:33%;">
        <div style="font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Trades</div>
        <div style="font-size:16px; font-weight:700; color:#e5e7eb;">${totalTrades}</div>
      </td>
      <td style="width:8px;"></td>
      <td style="background:#161b22; border:1px solid #1f2a3c; border-radius:8px; padding:10px 14px; width:33%;">
        <div style="font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Win Rate</div>
        <div style="font-size:16px; font-weight:700; color:#00b45a;">${winRate}%</div>
      </td>
      <td style="width:8px;"></td>
      <td style="background:#161b22; border:1px solid #1f2a3c; border-radius:8px; padding:10px 14px; width:33%;">
        <div style="font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Total RR</div>
        <div style="font-size:16px; font-weight:700; color:${totalRR >= 0 ? '#00b45a' : '#da3637'};">${totalRR >= 0 ? '+' : ''}${totalRR.toFixed(1)}</div>
      </td>
    </tr>
    <tr><td style="height:8px;"></td></tr>
    <tr>
      <td style="background:#161b22; border:1px solid #1f2a3c; border-radius:8px; padding:10px 14px;">
        <div style="font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Avg Win / Loss</div>
        <div style="font-size:16px; font-weight:700; color:#e5e7eb;">+${avgWin.toFixed(1)}R / -${avgLoss.toFixed(1)}R</div>
      </td>
      <td style="width:8px;"></td>
      <td style="background:#161b22; border:1px solid #1f2a3c; border-radius:8px; padding:10px 14px;">
        <div style="font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Deposits</div>
        <div style="font-size:16px; font-weight:700; color:#e5e7eb;">+$${totalDeposits.toFixed(2)}</div>
      </td>
      <td style="width:8px;"></td>
      <td style="background:#161b22; border:1px solid #1f2a3c; border-radius:8px; padding:10px 14px;">
        <div style="font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Withdraws</div>
        <div style="font-size:16px; font-weight:700; color:#e5e7eb;">-$${totalWithdraws.toFixed(2)}</div>
      </td>
    </tr>
  </table>

  <!-- Chart -->
  ${chartHtml}

  <!-- Table -->
  <table style="width:100%; border-collapse:collapse; font-size:13px;">
    <thead>
      <tr style="background:#161b22;">
        <th style="padding:10px 12px; font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; text-align:left; border-bottom:1px solid #1f2a3c;">#</th>
        <th style="padding:10px 12px; font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; text-align:left; border-bottom:1px solid #1f2a3c;">Date</th>
        <th style="padding:10px 12px; font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; text-align:left; border-bottom:1px solid #1f2a3c;">Pair / Type</th>
        <th style="padding:10px 12px; font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; text-align:left; border-bottom:1px solid #1f2a3c;">Result</th>
        <th style="padding:10px 12px; font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; text-align:left; border-bottom:1px solid #1f2a3c;">Value</th>
        <th style="padding:10px 12px; font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; text-align:left; border-bottom:1px solid #1f2a3c;">Lot</th>
        <th style="padding:10px 12px; font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; text-align:left; border-bottom:1px solid #1f2a3c;">Chart</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <p style="margin-top:24px; text-align:center; color:#374151; font-size:11px;">TradeStamp &middot; Advanced Trading Journal &middot; PDF Audit Log</p>

</body>
</html>`;
}

export async function generateAndSharePdf(entries: TradeEntry[], period: PdfPeriod): Promise<string> {
  const html = buildHtml(entries, period);

  // Guard: ensure HTML is not empty
  if (!html || html.length < 50) {
    throw new Error('Empty HTML content');
  }

  // ── Web ─────────────────────────────────────────────────────────────────────
  // printToFileAsync is native-only. On web, trigger a direct browser download
  // via Blob + anchor tag so the user gets the HTML file immediately — no dialog.
  // `entries` is already pre-filtered by the caller to the selected period.
  if (process.env.EXPO_OS === 'web') {
    const filename = `TradeStamp_${period}_${Date.now()}.html`;
    downloadHtmlOnWeb(html, filename);
    return '';
  }

  // ── Native (iOS / Android) ───────────────────────────────────────────────────
  // Generate PDF with explicit page size for Android compatibility
  const { uri } = await Print.printToFileAsync({
    html,
    width: 612,
    height: 792,
  });

  if (!uri) {
    throw new Error('PDF generation returned empty URI');
  }

  // Copy to a known accessible path so share sheet can find it
  const filename = `TradeStamp_${period}_${Date.now()}.pdf`;
  const destUri = (FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '') + filename;
  await FileSystem.copyAsync({ from: uri, to: destUri });

  // Open share sheet
  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(destUri, {
      mimeType: 'application/pdf',
      dialogTitle: `TradeStamp — ${getPeriodLabel(period)} Report`,
      UTI: 'com.adobe.pdf',
    });
  }

  return destUri;
}
