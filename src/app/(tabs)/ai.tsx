import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import { useTradeStore } from '@/lib/tradeStore';
import { useLang } from '@/lib/langContext';

export default function AIScreen() {
  const { colors } = useTradeStore();
  const { t } = useLang();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 20 }}>
        <View style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: colors.panel,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={32} color={colors.textMuted} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '600', color: colors.text, letterSpacing: -0.3 }}>
          {t('aiComingSoon')}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 }}>
          {t('aiComingSoonDesc')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
