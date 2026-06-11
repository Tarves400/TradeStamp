import React, { useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Share2 } from 'lucide-react-native';
import { useTradeStore } from '@/lib/tradeStore';
import { useLang } from '@/lib/langContext';
import {
  buildStatCardSvg, svgToPngBlob, shareOrDownloadPng,
} from '@/lib/webImageShare';

type Props = {
  label: string;
  value: string;
  valueColor?: string;
  subValue?: string;
  subValueColor?: string;
  filename?: string;
  children?: React.ReactNode;
};

export default function ShareableCard({
  label,
  value,
  valueColor,
  subValue,
  subValueColor,
  children,
}: Props) {
  const { colors } = useTradeStore();
  const { t } = useLang();
  const shotRef = useRef<ViewShot>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');

  const handleShare = async () => {
    setError('');

    // ── Web path: SVG → PNG Blob → Web Share API / anchor download ────────────
    if (process.env.EXPO_OS === 'web') {
      setCapturing(true);
      try {
        const svgString = buildStatCardSvg(
          label,
          value,
          subValue,
          valueColor ?? colors.text,
          subValueColor,
          {
            panel:     colors.panel,
            accent:    colors.accent,
            text:      colors.text,
            textMuted: colors.textMuted,
            border:    colors.border,
          },
        );

        const cardH = subValue ? 130 : 110;
        const blob = await svgToPngBlob(svgString, 300, cardH);

        const safeLabel = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `TradeStamp_${safeLabel}_${Date.now()}.png`;
        await shareOrDownloadPng(blob, filename);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('abort')) {
          setError('Image generation failed.');
        }
      } finally {
        setCapturing(false);
      }
      return;
    }

    // ── Native path: ViewShot → expo-sharing ──────────────────────────────────
    setCapturing(true);
    try {
      // Small delay lets Android fully composite the GPU layer before capture
      await new Promise((r) => setTimeout(r, 200));
      const uri = await shotRef.current!.capture!();
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'TradeStamp',
          UTI: 'public.png',
        });
      } else {
        setError(t('shareNotAvailable'));
      }
    } catch {
      setError(t('captureFailed'));
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Wrapper forces Android GPU compositing so capture() always succeeds */}
      <View collapsable={false} renderToHardwareTextureAndroid style={{ flex: 1 }}>
        <ViewShot
          ref={shotRef}
          options={{ format: 'png', quality: 1 }}
          style={{
            backgroundColor: colors.panel,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 10, padding: 14,
            paddingTop: 30,          // leave room for the corner share button
          }}
        >
          <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 }}>
            {label}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: valueColor ?? colors.text }}>
            {value}
          </Text>
          {subValue && (
            <Text style={{ fontSize: 12, fontWeight: '600', color: subValueColor ?? colors.textMuted, marginTop: 2 }}>
              {subValue}
            </Text>
          )}
          {children}
        </ViewShot>
      </View>

      {/* Share icon button — top-right corner of card */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 7,
          right: 7,
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: colors.accentDim,
          borderWidth: 1,
          borderColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onPress={handleShare}
        disabled={capturing}
      >
        {capturing
          ? <ActivityIndicator size="small" color={colors.accent} />
          : <Share2 size={13} color={colors.accent} />
        }
      </TouchableOpacity>

      {!!error && (
        <Text style={{ fontSize: 10, color: colors.danger, textAlign: 'right', marginTop: 2, paddingHorizontal: 4 }}>
          {error}
        </Text>
      )}
    </View>
  );
}
