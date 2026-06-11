import { useState } from 'react';
import {
  KeyboardAvoidingView, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calculator } from 'lucide-react-native';
import { useTradeStore } from '@/lib/tradeStore';
import { useLang } from '@/lib/langContext';
import CandlestickBackground from '@/components/CandlestickBackground';

const GOLD_BORDER = 'rgba(212,168,60,0.45)';

// কারেন্সি পেয়ার অনুযায়ী pip value (per standard lot, USD account)
const PAIR_PIP_VALUES: Record<string, number> = {
  'EUR/USD': 10, 'GBP/USD': 10, 'AUD/USD': 10, 'NZD/USD': 10,
  'USD/JPY': 9.1, 'USD/CHF': 10, 'USD/CAD': 7.5,
  'EUR/JPY': 9.1, 'GBP/JPY': 9.1, 'XAU/USD': 10,
};
const PAIRS = Object.keys(PAIR_PIP_VALUES);

export default function ToolsScreen() {
  const { colors } = useTradeStore();
  const { t } = useLang();
  const [balance, setBalance] = useState('');
  const [riskPct, setRiskPct] = useState('1');
  const [pipEntry, setPipEntry] = useState('');
  const [pipExit, setPipExit] = useState('');
  // লট সাইজ ক্যালকুলেটর স্টেট
  const [lotBalance, setLotBalance] = useState('');
  const [lotRiskPct, setLotRiskPct] = useState('1');
  const [slPips, setSlPips] = useState('');
  const [selectedPair, setSelectedPair] = useState('EUR/USD');

  const riskDollar = (parseFloat(balance) || 0) * (parseFloat(riskPct) || 0) / 100;
  const pipDistance = (() => {
    const e = parseFloat(pipEntry) || 0;
    const x = parseFloat(pipExit) || 0;
    if (!e || !x) return 0;
    let d = Math.abs(e - x);
    if (d > 0 && d < 2) d = d * 10000;
    return d;
  })();

  // লট সাইজ হিসাব: LotSize = (Balance × Risk%) / (SL_pips × PipValue)
  const lotSize = (() => {
    const bal = parseFloat(lotBalance) || 0;
    const risk = parseFloat(lotRiskPct) || 0;
    const sl = parseFloat(slPips) || 0;
    const pipVal = PAIR_PIP_VALUES[selectedPair] ?? 10;
    if (!bal || !risk || !sl) return 0;
    return (bal * risk / 100) / (sl * pipVal);
  })();

  const s = {
    panel: {
      backgroundColor: colors.panel, borderWidth: 1.5, borderColor: GOLD_BORDER,
      borderRadius: 10, padding: 14, marginBottom: 14, overflow: 'hidden' as const,
    },
    input: {
      backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
      borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10,
      color: colors.text, fontSize: 14, flex: 1,
    },
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ paddingTop: 16, paddingBottom: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{t('tradingTools')}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              {t('toolsSubtitle')}
            </Text>
          </View>

          {/* Risk Calculator */}
          <View style={s.panel}>
            <CandlestickBackground height={160} opacity={0.65} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, zIndex: 1 }}>
              <Calculator size={15} color={colors.warning} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{t('riskCalculator')}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 5 }}>
                  {t('balanceLabel')}
                </Text>
                <TextInput
                  style={s.input}
                  placeholder={t('balancePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={balance}
                  onChangeText={setBalance}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 5 }}>
                  {t('riskPctLabel')}
                </Text>
                <TextInput
                  style={s.input}
                  placeholder="1"
                  placeholderTextColor={colors.textMuted}
                  value={riskPct}
                  onChangeText={setRiskPct}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={{
              borderTopWidth: 1, borderTopColor: colors.border,
              paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600' }}>{t('dollarRisk')}:</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.accent }}>${riskDollar.toFixed(2)}</Text>
            </View>
          </View>

          {/* Pip Calculator */}
          <View style={s.panel}>
            <CandlestickBackground height={160} opacity={0.65} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, zIndex: 1 }}>
              <Text style={{ fontSize: 16 }}>📏</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{t('pipCalculator')}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 5 }}>
                  {t('entryPrice')}
                </Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. 1.08500"
                  placeholderTextColor={colors.textMuted}
                  value={pipEntry}
                  onChangeText={setPipEntry}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 5 }}>
                  {t('exitPrice')}
                </Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. 1.08750"
                  placeholderTextColor={colors.textMuted}
                  value={pipExit}
                  onChangeText={setPipExit}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={{
              borderTopWidth: 1, borderTopColor: colors.border,
              paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600' }}>{t('distance')}:</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.label }}>{pipDistance.toFixed(1)} Pips</Text>
            </View>
          </View>

          {/* Lot Size Calculator */}
          <View style={s.panel}>
            <CandlestickBackground height={220} opacity={0.65} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, zIndex: 1 }}>
              <Text style={{ fontSize: 16 }}>📐</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{t('lotSizeCalculator')}</Text>
            </View>

            {/* Row 1: Balance + Risk % */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, zIndex: 1 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 5 }}>
                  {t('balanceLabel')}
                </Text>
                <TextInput
                  style={s.input}
                  placeholder={t('balancePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={lotBalance}
                  onChangeText={setLotBalance}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 5 }}>
                  {t('riskPctLabel')}
                </Text>
                <TextInput
                  style={s.input}
                  placeholder="1"
                  placeholderTextColor={colors.textMuted}
                  value={lotRiskPct}
                  onChangeText={setLotRiskPct}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Row 2: Stop Loss pips + Currency Pair */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, zIndex: 1 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 5 }}>
                  {t('stopLossPipsLabel')}
                </Text>
                <TextInput
                  style={s.input}
                  placeholder={t('stopLossPipsPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={slPips}
                  onChangeText={setSlPips}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 5 }}>
                  {t('selectPairLabel')}
                </Text>
                {/* কারেন্সি পেয়ার স্ক্রোলেবল চিপ সিলেক্টর */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={{ gap: 6, alignItems: 'center' }}
                >
                  {PAIRS.map((pair) => {
                    const active = pair === selectedPair;
                    return (
                      <TouchableOpacity
                        key={pair}
                        onPress={() => setSelectedPair(pair)}
                        style={{
                          paddingVertical: 6, paddingHorizontal: 9,
                          borderRadius: 6, borderWidth: 1,
                          backgroundColor: active ? colors.accentDim : colors.inputBg,
                          borderColor: active ? colors.accent : colors.border,
                        }}
                      >
                        <Text style={{
                          fontSize: 11, fontWeight: '700',
                          color: active ? colors.accent : colors.textMuted,
                        }}>
                          {pair}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Result row */}
            <View style={{
              borderTopWidth: 1, borderTopColor: colors.border,
              paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              zIndex: 1,
            }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600' }}>
                {t('lotSizeResult')}:
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.warning }}>
                {lotSize.toFixed(2)} Lots
              </Text>
            </View>
          </View>

          {/* Trading Tips */}
          <View style={{
            backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent,
            borderRadius: 10, padding: 14,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent, marginBottom: 8 }}>
              💡 {t('quickTradingRules')}
            </Text>
            {[
              t('tip1'), t('tip2'), t('tip3'), t('tip4'),
            ].map((tip, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 5 }}>
                <Text style={{ color: colors.accent, fontSize: 12 }}>•</Text>
                <Text style={{ fontSize: 12, color: colors.text, flex: 1 }}>{tip}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
