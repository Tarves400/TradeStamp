import React, { useState } from 'react';
import {
  ActivityIndicator, Modal, Text, TouchableOpacity, View,
} from 'react-native';
import { X, Download } from 'lucide-react-native';
import { useTradeStore } from '@/lib/tradeStore';
import { useLang } from '@/lib/langContext';
import { MONTHS, TradeEntry } from '@/lib/storage';
import {
  PdfPeriod, filterEntriesByPeriod, generateAndSharePdf, getPeriodLabel,
} from '@/lib/pdfExport';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const PERIODS: PdfPeriod[] = ['1d', '3d', '7d', '1m', 'all'];

export default function PeriodShareModal({ visible, onClose }: Props) {
  const { colors, tradeData } = useTradeStore();
  const { t } = useLang();
  // Track which period is currently exporting (null = none)
  const [exportingPeriod, setExportingPeriod] = useState<PdfPeriod | null>(null);
  const [error, setError] = useState('');

  const allEntries: TradeEntry[] = [];
  MONTHS.forEach((m) => (tradeData[m] || []).forEach((e) => allEntries.push(e)));

  const handleShare = async (period: PdfPeriod) => {
    setError('');
    const filtered = filterEntriesByPeriod(allEntries, period);
    if (filtered.length === 0) {
      setError(`${getPeriodLabel(period)}: ${t('noPdfRecords')}`);
      return;
    }
    setExportingPeriod(period);
    try {
      await generateAndSharePdf(filtered, period);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('cancel') || msg.includes('Cancel')) {
        // User cancelled print dialog — not a real error
      } else {
        setError(`${t('pdfError')} ${msg ? `(${msg})` : ''}`);
      }
    } finally {
      setExportingPeriod(null);
    }
  };

  // Short label for each period button
  const shortLabel = (p: PdfPeriod): string => {
    const map: Record<PdfPeriod, string> = {
      '1d': '1 Day',
      '3d': '3 Days',
      '7d': '7 Days',
      '1m': '1 Month',
      'all': 'All Time',
    };
    return map[p];
  };

  const entryCount = (p: PdfPeriod): number =>
    filterEntriesByPeriod(allEntries, p).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.panel,
            borderTopLeftRadius: 18, borderTopRightRadius: 18,
            paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36,
          }}
        >
          {/* Handle bar */}
          <View style={{ width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                📥 Download PDF Report
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                Select a period — trades + chart included
              </Text>
            </View>
            <TouchableOpacity
              style={{ padding: 6, borderRadius: 8, backgroundColor: colors.inputBg }}
              onPress={onClose}
            >
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Period rows */}
          {PERIODS.map((period) => {
            const count = entryCount(period);
            const isExporting = exportingPeriod === period;

            return (
              <View
                key={period}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  borderWidth: 1, borderColor: colors.border,
                  borderRadius: 10, padding: 14, marginBottom: 10,
                  backgroundColor: colors.bg,
                }}
              >
                {/* Period info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                    {shortLabel(period)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    {count > 0 ? `${count} trade records` : 'No records'}
                  </Text>
                </View>

                {/* Share / Download button */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: count === 0 ? colors.inputBg : colors.accentDim,
                    borderWidth: 1,
                    borderColor: count === 0 ? colors.border : colors.accent,
                    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
                    opacity: (isExporting || count === 0) ? 0.6 : 1,
                  }}
                  onPress={() => handleShare(period)}
                  disabled={isExporting || count === 0}
                >
                  {isExporting
                    ? <ActivityIndicator size="small" color={colors.accent} />
                    : <Download size={14} color={count === 0 ? colors.textMuted : colors.accent} />
                  }
                  <Text style={{
                    fontSize: 12, fontWeight: '700',
                    color: count === 0 ? colors.textMuted : colors.accent,
                  }}>
                    {isExporting ? '...' : 'PDF'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Android tip: some devices show a print dialog — guide user to Save as PDF */}
          {process.env.EXPO_OS === 'android' && (
            <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
              Tip: If a print dialog appears, select &quot;Save as PDF&quot; and tap the checkmark.
            </Text>
          )}

          {/* Error */}
          {!!error && (
            <Text style={{ fontSize: 12, color: colors.danger, textAlign: 'center', marginTop: 8 }}>
              {error}
            </Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
