import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ExternalLink, Mail, Shield, FileText, AlertTriangle } from 'lucide-react-native';
import { useTradeStore } from '@/lib/tradeStore';
import { useLang } from '@/lib/langContext';

export default function AboutScreen() {
  const { colors } = useTradeStore();
  const { t } = useLang();
  const router = useRouter();

  const sectionTitle = {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  };

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    gap: 12,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        gap: 12,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 38, height: 38, borderRadius: 10,
            backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
          {t('about')}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 28 }}
      >
        {/* ── Description ── */}
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
            {t('aboutTitle')}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 22 }}>
            {t('aboutDescription')}
          </Text>
        </View>

        {/* ── Version ── */}
        <View style={{ gap: 10 }}>
          <Text style={sectionTitle}>{t('versionLabel')}</Text>
          <View style={{
            backgroundColor: colors.panel, borderRadius: 12,
            borderWidth: 1, borderColor: colors.border,
            padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
          }}>
            <View style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.accent }}>v</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>1.0.0</Text>
          </View>
        </View>

        {/* ── Legal Info ── */}
        <View style={{ gap: 10 }}>
          <Text style={sectionTitle}>{t('legalInfo')}</Text>
          <View style={{
            backgroundColor: colors.panel, borderRadius: 12,
            borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
          }}>
            <TouchableOpacity style={rowStyle} activeOpacity={0.7} onPress={() => {}}>
              <Shield size={18} color={colors.textMuted} style={{ marginLeft: 16 }} />
              <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{t('privacyPolicy')}</Text>
              <ExternalLink size={14} color={colors.textMuted} style={{ marginRight: 16 }} />
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 + 18 + 12 }} />
            <TouchableOpacity style={rowStyle} activeOpacity={0.7} onPress={() => {}}>
              <FileText size={18} color={colors.textMuted} style={{ marginLeft: 16 }} />
              <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{t('termsOfService')}</Text>
              <ExternalLink size={14} color={colors.textMuted} style={{ marginRight: 16 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Contact ── */}
        <View style={{ gap: 10 }}>
          <Text style={sectionTitle}>{t('contactLabel')}</Text>
          <View style={{
            backgroundColor: colors.panel, borderRadius: 12,
            borderWidth: 1, borderColor: colors.border,
            padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
          }}>
            <View style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center',
            }}>
              <Mail size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('emailLabel')}</Text>
              <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}> </Text>
            </View>
          </View>
        </View>

        {/* ── Important Note ── */}
        <View style={{
          backgroundColor: colors.warningDim,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.warning,
          padding: 16,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'flex-start',
        }}>
          <AlertTriangle size={20} color={colors.warning} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.warning }}>
              {t('importantNote')}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 20 }}>
              {t('noAINote')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
