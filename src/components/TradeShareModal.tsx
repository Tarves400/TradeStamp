import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { X } from 'lucide-react-native';
import { TradeEntry } from '@/lib/storage';
import { useTradeStore } from '@/lib/tradeStore';
import { useLang } from '@/lib/langContext';
import {
  buildTradeSvg, svgToPngBlob, shareOrDownloadPng,
} from '@/lib/webImageShare';

type Props = {
  entry: TradeEntry | null;
  onClose: () => void;
};

export default function TradeShareModal({ entry, onClose }: Props) {
  const { colors } = useTradeStore();
  const { t } = useLang();
  // ViewShot ref — more reliable than captureRef on Android
  const shotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  if (!entry) return null;

  const isWin = entry.type === 'Trade' && entry.result === 'Win';
  const isLoss = entry.type === 'Trade' && entry.result === 'Loss';
  const isDep = entry.type === 'Deposit';
  const badgeColor = isWin ? colors.accent : isLoss ? colors.danger : isDep ? colors.label : colors.textMuted;
  const badgeBg = isWin ? colors.accentDim : isLoss ? colors.dangerDim : isDep ? 'rgba(88,166,255,0.15)' : 'rgba(107,114,128,0.2)';
  const badgeLabel = isWin ? t('win').toUpperCase() : isLoss ? t('loss').toUpperCase() : isDep ? 'DEPOSIT' : 'WITHDRAW';
  const valueStr = entry.type === 'Trade'
    ? (entry.displayValue || `${(entry.rr ?? 0) >= 0 ? '+' : ''}${entry.rr} RR`)
    : `${isDep ? '+' : '-'}$${(entry.amount ?? 0).toFixed(2)}`;
  const valueColor = isWin ? colors.accent : isLoss ? colors.danger : isDep ? colors.accent : colors.danger;
  const lotStr = entry.lotSize ? `${entry.lotSize}` : undefined;
  const entryStr = entry.entryPrice ? `${entry.entryPrice}` : undefined;
  const exitStr = entry.exitPrice ? `${entry.exitPrice}` : undefined;
  const slStr = entry.stopLoss ? `${entry.stopLoss}` : undefined;

  const handleShare = async () => {
    setError('');

    // ── Web path: SVG → PNG Blob → Web Share API / anchor download ────────────
    if (process.env.EXPO_OS === 'web') {
      setSharing(true);
      try {
        const svgString = buildTradeSvg(entry, {
          panel:      colors.panel,
          accent:     colors.accent,
          text:       colors.text,
          textMuted:  colors.textMuted,
          border:     colors.border,
          danger:     colors.danger,
          accentDim:  colors.accentDim,
          dangerDim:  colors.dangerDim,
          label:      colors.label,
        });

        // Parse SVG viewBox to get actual dimensions
        const heightMatch = svgString.match(/height="(\d+)"/);
        const cardH = heightMatch ? parseInt(heightMatch[1], 10) : 245;
        const blob = await svgToPngBlob(svgString, 400, cardH);

        const filename = `TradeStamp_${entry.pair ?? entry.type}_${Date.now()}.png`;
        await shareOrDownloadPng(blob, filename);
        onClose();
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        // User cancelled share dialog — not a real error
        if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('abort')) {
          setError('Image generation failed. Please try again.');
        } else {
          onClose();
        }
      } finally {
        setSharing(false);
      }
      return;
    }

    // ── Native path: ViewShot → expo-sharing ──────────────────────────────────
    setSharing(true);
    try {
      // Small delay lets Android fully composite the GPU layer before capture
      await new Promise((r) => setTimeout(r, 200));
      const uri = await shotRef.current!.capture!();
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'TradeStamp — Trade',
          UTI: 'public.png',
        });
        onClose();
      } else {
        setError(t('shareNotAvailable'));
      }
    } catch {
      setError(t('captureFailed'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center', alignItems: 'center', padding: 24,
      }}>
        {/* Close button */}
        <TouchableOpacity
          style={{ position: 'absolute', top: 48, right: 24, zIndex: 10, padding: 6 }}
          onPress={onClose}
        >
          <X size={24} color="#fff" />
        </TouchableOpacity>

        {/* Wrapper forces Android GPU compositing so capture() always succeeds */}
        <View collapsable={false} renderToHardwareTextureAndroid style={{ width: '100%' }}>
          <ViewShot
            ref={shotRef}
            options={{ format: 'png', quality: 1 }}
            style={{
              backgroundColor: colors.panel,
              borderWidth: 1, borderColor: colors.border,
              borderRadius: 14, padding: 20, width: '100%',
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accent, letterSpacing: 1.2 }}>
                TradeStamp
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                {entry.date}{entry.time ? ` · ${entry.time}` : ''}
              </Text>
            </View>

            {/* Pair / Type */}
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 4 }}>
              {entry.type === 'Trade' ? (entry.pair || '—') : entry.type}
            </Text>

            {/* Badge + Value row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={{ backgroundColor: badgeBg, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: badgeColor }}>{badgeLabel}</Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '700', color: valueColor }}>{valueStr}</Text>
            </View>

            {/* Lot + Entry + Exit + Stop Loss */}
            {entry.type === 'Trade' && (lotStr || entryStr || exitStr || slStr) && (
              <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                {lotStr && (
                  <View>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>{t('lotSize').toUpperCase()}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{lotStr}</Text>
                  </View>
                )}
                {entryStr && (
                  <View>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>{t('entryPrice').toUpperCase()}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent }}>{entryStr}</Text>
                  </View>
                )}
                {exitStr && (
                  <View>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>{t('exitPrice').toUpperCase()}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isWin ? colors.accent : colors.danger }}>{exitStr}</Text>
                  </View>
                )}
                {slStr && (
                  <View>
                    <Text style={{ fontSize: 10, color: colors.danger, marginBottom: 2 }}>{t('stopLoss').toUpperCase()}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>{slStr}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 14 }} />

            {/* Footer brand */}
            <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center', letterSpacing: 0.5 }}>
              TradeStamp · Advanced Trading Journal
            </Text>
            <Text style={{ fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
              Shared at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </ViewShot>
        </View>

        {/* Error */}
        {!!error && (
          <Text style={{ color: colors.danger, fontSize: 12, marginTop: 10, textAlign: 'center' }}>{error}</Text>
        )}

        {/* Share button */}
        <TouchableOpacity
          style={{
            marginTop: 20, backgroundColor: colors.accent,
            borderRadius: 10, paddingVertical: 14, paddingHorizontal: 48,
            flexDirection: 'row', alignItems: 'center', gap: 8,
            opacity: sharing ? 0.7 : 1,
          }}
          onPress={handleShare}
          disabled={sharing}
        >
          {sharing && <ActivityIndicator size="small" color="#fff" />}
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
            {sharing ? '...' : t('share')}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
