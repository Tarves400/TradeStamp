import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, ScrollView, Text,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { X, Download, CheckCircle } from 'lucide-react-native';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { useTradeStore, computeStatsForEntries } from '@/lib/tradeStore';
import { useLang } from '@/lib/langContext';
import { MONTHS, TradeEntry } from '@/lib/storage';
import { PdfPeriod, filterEntriesByPeriod } from '@/lib/pdfExport';

// ── Web-only helper: download HTML as a file via Blob + anchor tag ────────────
function downloadHtmlOnWeb(html: string, filename: string): void {
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

type Props = {
  visible: boolean;
  onClose: () => void;
};

const PERIODS: PdfPeriod[] = ['1d', '3d', '7d', '1m', 'all'];

const PERIOD_LABELS: Record<PdfPeriod, string> = {
  '1d': '1 Day', '3d': '3 Days', '7d': '7 Days', '1m': '1 Month', 'all': 'All Time',
};

type CardThemeColors = {
  bg: string;
  panel: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentDim: string;
  danger: string;
  warning: string;
  inputBg: string;
};

// Build an HTML card for web — used by Print.printAsync so users can Save as PDF/Image
function buildCardHtml(
  label: string,
  stats: ReturnType<typeof computeStatsForEntries>,
  count: number,
  themeColors: CardThemeColors,
): string {
  const now = new Date().toLocaleDateString('en-GB');
  const rrColor = stats.totalRR >= 0 ? themeColors.accent : themeColors.danger;
  const balColor = stats.runningBalance >= 0 ? themeColors.accent : themeColors.danger;
  const wrColor = stats.winRate >= 50 ? themeColors.accent : stats.winRate >= 40 ? themeColors.warning : themeColors.danger;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  body { margin:0; padding:0; background:${themeColors.bg}; display:flex; justify-content:center; align-items:center; min-height:100vh; }
  .card { background:${themeColors.panel}; border:1px solid ${themeColors.border}; border-radius:16px; padding:24px; width:340px; font-family:-apple-system,Arial,sans-serif; }
  .row { display:flex; gap:10px; margin-bottom:10px; }
  .cell { flex:1; background:${themeColors.inputBg}; border-radius:10px; padding:12px; }
  .cell-label { font-size:9px; color:${themeColors.textMuted}; text-transform:uppercase; font-weight:700; letter-spacing:0.5px; margin-bottom:4px; }
  .cell-value { font-size:20px; font-weight:700; }
  .badge { display:inline-block; background:${themeColors.accentDim}; border:1px solid ${themeColors.accent}; border-radius:6px; padding:3px 10px; font-size:11px; font-weight:800; color:${themeColors.accent}; margin-bottom:14px; }
  .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
  .brand { font-size:13px; font-weight:800; color:${themeColors.accent}; letter-spacing:1px; }
  .date { font-size:10px; color:${themeColors.textMuted}; }
  .footer { font-size:9px; color:${themeColors.textMuted}; text-align:center; margin-top:12px; letter-spacing:0.5px; }
  @media print { body { background:#fff; } .card { border-color:#ddd; background:#fff; } .cell { background:#f8f8f8; } }
</style>
</head><body>
<div class="card">
  <div class="header">
    <span class="brand">TradeStamp</span>
    <span class="date">${now}</span>
  </div>
  <div class="badge">${label.toUpperCase()} &middot; ${count} Record${count !== 1 ? 's' : ''}</div>
  <div class="row">
    <div class="cell"><div class="cell-label">Trades</div><div class="cell-value" style="color:${themeColors.text};">${stats.totalTrades}</div></div>
    <div class="cell"><div class="cell-label">Win Rate</div><div class="cell-value" style="color:${wrColor};">${stats.winRate}%</div></div>
  </div>
  <div class="row">
    <div class="cell"><div class="cell-label">Total RR</div><div class="cell-value" style="color:${rrColor};">${stats.totalRR >= 0 ? '+' : ''}${stats.totalRR.toFixed(1)}</div></div>
    <div class="cell"><div class="cell-label">Net Balance</div><div class="cell-value" style="color:${balColor};">$${stats.runningBalance.toFixed(2)}</div></div>
  </div>
  <div class="row">
    <div class="cell" style="flex:unset;width:100%;box-sizing:border-box;">
      <div class="cell-label">Avg Win / Avg Loss</div>
      <div class="cell-value" style="color:${themeColors.warning};">+${stats.avgWin.toFixed(1)}R &nbsp;/&nbsp; -${stats.avgLoss.toFixed(1)}R</div>
    </div>
  </div>
  <div class="footer">TradeStamp · Advanced Trading Journal</div>
</div>
</body></html>`;
}

export default function PeriodImageModal({ visible, onClose }: Props) {
  const { colors, theme, tradeData } = useTradeStore();
  const { t } = useLang();
  const { width: screenWidth } = useWindowDimensions();
  const [savingPeriod, setSavingPeriod] = useState<PdfPeriod | null>(null);
  const [savedPeriod, setSavedPeriod] = useState<PdfPeriod | null>(null);
  const [error, setError] = useState('');

  // Use RefObjects (createRef) so captureRef can unwrap .current on native
  const cardRefs = useRef<Record<PdfPeriod, React.RefObject<View | null>>>({
    '1d': React.createRef<View | null>(),
    '3d': React.createRef<View | null>(),
    '7d': React.createRef<View | null>(),
    '1m': React.createRef<View | null>(),
    'all': React.createRef<View | null>(),
  });

  const allEntries: TradeEntry[] = [];
  MONTHS.forEach((m) => (tradeData[m] || []).forEach((e) => allEntries.push(e)));

  const filtered = (p: PdfPeriod) => filterEntriesByPeriod(allEntries, p);
  const statsFor = (p: PdfPeriod) => computeStatsForEntries(filtered(p));
  const countFor = (p: PdfPeriod) => filtered(p).length;

  const handleSave = async (period: PdfPeriod) => {
    setError('');
    setSavedPeriod(null);

    // ── Web path: build period-filtered HTML card and download directly via Blob ──
    // Only data for the selected period is included — allEntries is filtered by
    // filterEntriesByPeriod(allEntries, period) inside statsFor() and countFor().
    if (process.env.EXPO_OS === 'web') {
      setSavingPeriod(period);
      try {
        const stats = statsFor(period);   // computed from filtered(period) only
        const count = countFor(period);   // count of filtered(period) only
        const label = PERIOD_LABELS[period];
        const themeColors: CardThemeColors = {
          bg: colors.bg,
          panel: colors.panel,
          border: colors.border,
          text: colors.text,
          textMuted: colors.textMuted,
          accent: colors.accent,
          accentDim: colors.accentDim,
          danger: colors.danger,
          warning: colors.warning,
          inputBg: colors.inputBg,
        };
        const html = buildCardHtml(label, stats, count, themeColors);
        const filename = `TradeStamp_${period}_${Date.now()}.html`;
        downloadHtmlOnWeb(html, filename);
        setSavedPeriod(period);
        setTimeout(() => setSavedPeriod(null), 3000);
      } catch {
        setError('Download failed. Please try again.');
      } finally {
        setSavingPeriod(null);
      }
      return;
    }

    // ── Native path: capture view → save to photo gallery ───────────────────
    // Ask for media library permission
    const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
    if (status !== 'granted') {
      setError('Photo library permission is required. Please enable it in Settings.');
      return;
    }

    const refObj = cardRefs.current[period];
    if (!refObj?.current) {
      setError('Capture view not ready. Please try again.');
      return;
    }

    setSavingPeriod(period);
    try {
      // Allow Android GPU compositor to finish rendering the off-screen view
      await new Promise((r) => setTimeout(r, 400));

      // Pass the RefObject directly — captureRef unwraps .current internally
      const uri = await captureRef(refObj as React.RefObject<View>, { format: 'png', quality: 1 });
      if (!uri) throw new Error('Capture returned empty URI');

      await MediaLibrary.createAssetAsync(uri);
      setSavedPeriod(period);
      setTimeout(() => setSavedPeriod(null), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Save failed: ${msg}`);
    } finally {
      setSavingPeriod(null);
    }
  };

  // Shared card content — rendered both in the off-screen capture view and the modal preview
  const renderCardContent = (period: PdfPeriod) => {
    const stats = statsFor(period);
    const winRateColor = stats.winRate >= 50 ? colors.accent : stats.winRate >= 40 ? colors.warning : colors.danger;
    const label = PERIOD_LABELS[period];
    const now = new Date().toLocaleDateString('en-GB');

    return (
      <>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accent, letterSpacing: 1 }}>
            TradeStamp
          </Text>
          <Text style={{ fontSize: 10, color: colors.textMuted }}>{now}</Text>
        </View>

        {/* Period badge */}
        <View style={{
          backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent,
          borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3,
          alignSelf: 'flex-start', marginBottom: 12,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.accent }}>{label.toUpperCase()}</Text>
        </View>

        {/* Stats row 1 */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1, backgroundColor: colors.inputBg, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '600', marginBottom: 3 }}>Trades</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{stats.totalTrades}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.inputBg, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '600', marginBottom: 3 }}>Win Rate</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: winRateColor }}>{stats.winRate}%</Text>
          </View>
        </View>

        {/* Stats row 2 */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1, backgroundColor: colors.inputBg, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '600', marginBottom: 3 }}>Total RR</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: stats.totalRR >= 0 ? colors.accent : colors.danger }}>
              {`${stats.totalRR >= 0 ? '+' : ''}${stats.totalRR.toFixed(1)}`}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.inputBg, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '600', marginBottom: 3 }}>Net Balance</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: stats.runningBalance >= 0 ? colors.accent : colors.danger }}>
              {`$${stats.runningBalance.toFixed(2)}`}
            </Text>
          </View>
        </View>

        {/* Avg Win / Loss */}
        <View style={{ backgroundColor: colors.inputBg, borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <Text style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '600', marginBottom: 3 }}>Avg Win / Avg Loss</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.warning }}>
            {`+${stats.avgWin.toFixed(1)}R / -${stats.avgLoss.toFixed(1)}R`}
          </Text>
        </View>

        {/* Footer */}
        <Text style={{ fontSize: 9, color: colors.textMuted, textAlign: 'center', letterSpacing: 0.5 }}>
          TradeStamp · Advanced Trading Journal
        </Text>
      </>
    );
  };

  const cardWidth = Math.min(screenWidth - 32, 400);

  return (
    <>
      {/* ── Off-screen capture views — rendered OUTSIDE the Modal so they sit
           in the main Android window hierarchy where captureRef works ─────── */}
      {PERIODS.map((period) => (
        <View
          key={`capture-${period}`}
          ref={cardRefs.current[period]}
          collapsable={false}
          renderToHardwareTextureAndroid
          style={{
            position: 'absolute',
            top: -9999,
            left: 0,
            width: cardWidth,
            backgroundColor: colors.panel,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 18,
          }}
        >
          {renderCardContent(period)}
        </View>
      ))}

      {/* ── Modal UI ────────────────────────────────────────────────────────── */}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={onClose}
        >
          <View
            style={{
              backgroundColor: colors.panel,
              borderTopLeftRadius: 18, borderTopRightRadius: 18,
              paddingTop: 16, paddingBottom: 32,
              maxHeight: '90%',
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Drag handle */}
            <View style={{ width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

            {/* Sheet header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                  📸 Save Summary Cards
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  {process.env.EXPO_OS === 'web'
                    ? 'Choose a period — downloads HTML card directly'
                    : 'Choose a period — image saved to your gallery'}
                </Text>
              </View>
              <TouchableOpacity
                style={{ padding: 6, borderRadius: 8, backgroundColor: colors.inputBg }}
                onPress={onClose}
              >
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Scrollable period list */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {PERIODS.map((period) => {
                const count = countFor(period);
                const isSaving = savingPeriod === period;
                const isSaved = savedPeriod === period;

                return (
                  <View key={period} style={{ marginBottom: 16 }}>
                    {/* Inline card preview */}
                    <View style={{
                      backgroundColor: colors.bg,
                      borderWidth: 1, borderColor: colors.border,
                      borderRadius: 12, padding: 16, marginBottom: 10,
                    }}>
                      {renderCardContent(period)}
                    </View>

                    {/* Count + Save button */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        {count} record{count !== 1 ? 's' : ''}
                      </Text>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 6,
                          backgroundColor: colors.accentDim,
                          borderWidth: 1, borderColor: colors.accent,
                          borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
                          opacity: isSaving ? 0.6 : 1,
                        }}
                        onPress={() => handleSave(period)}
                        disabled={isSaving}
                      >
                        {isSaving
                          ? <ActivityIndicator size="small" color={colors.accent} />
                          : isSaved
                            ? <CheckCircle size={14} color={colors.accent} />
                            : <Download size={14} color={colors.accent} />
                        }
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>
                          {isSaving
                            ? 'Saving...'
                            : isSaved
                              ? 'Saved ✓'
                              : process.env.EXPO_OS === 'web'
                                ? 'Download'
                                : 'Save to Gallery'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {/* Error message */}
              {!!error && (
                <Text style={{ fontSize: 12, color: colors.danger, textAlign: 'center', marginTop: 4, marginBottom: 8 }}>
                  {error}
                </Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
