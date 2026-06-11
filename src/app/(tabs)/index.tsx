import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View, Modal } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { TrendingUp, AlertTriangle, Target, Eye, EyeOff, Edit2, ChevronDown, Share2, X, Check, Wallet } from 'lucide-react-native';
import { computeStats, useTradeStore } from '@/lib/tradeStore';
import { getTodayString, MONTHS } from '@/lib/storage';
import EquityChart from '@/components/EquityChart';
import PeriodImageModal from '@/components/PeriodImageModal';
import { useLang } from '@/lib/langContext';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import CandlestickBackground from '@/components/CandlestickBackground';

// গোল্ডেন লাক্সারি ডিজাইন কনস্ট্যান্টস
const GOLD_BORDER = 'rgba(212,168,60,0.45)';

function useCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

export default function DashboardScreen() {
  const { tradeData, isLoaded, colors, currentMonth, isAllTime, setIsAllTime, setCurrentMonth, dailyTargetValue, dailyTargetLastDate, saveDailyTargetVal, activeAccount } = useTradeStore();
  const { t } = useLang();
  const [chartVisible, setChartVisible] = useState(true);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(String(dailyTargetValue));
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  useCountdown();

  const scope = isAllTime ? 'all' : currentMonth;

  // Memoize expensive stats so they don't recompute on every second-tick re-render
  const stats = useMemo(
    () => (isLoaded ? computeStats(tradeData, scope) : null),
    [isLoaded, tradeData, scope],
  );

  const isTargetLocked = dailyTargetLastDate === getTodayString();
  const monthlyGoalRR = 20;
  const progressPct = useMemo(
    () => (stats ? Math.min(Math.max(Math.round((stats.totalRR / monthlyGoalRR) * 100), 0), 100) : 0),
    [stats],
  );

  const winRateColor = useMemo(() => {
    const wr = stats?.winRate || 0;
    return wr >= 50 ? colors.accent : wr >= 40 ? colors.warning : colors.danger;
  }, [stats?.winRate, colors.accent, colors.warning, colors.danger]);

  useFocusEffect(useCallback(() => {
    setTargetInput(String(dailyTargetValue));
  }, [dailyTargetValue]));

  const handleSaveTarget = async () => {
    const val = parseFloat(targetInput) || 0;
    await saveDailyTargetVal(val);
    setEditingTarget(false);
  };



  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 16, paddingBottom: 12 }}>
          <TrendingUp size={18} color={colors.accent} />
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: 1 }}>{t('appName')}</Text>
            {activeAccount && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Wallet size={10} color={colors.accent} />
                <Text style={{ fontSize: 10, color: colors.accent, fontWeight: '700' }} numberOfLines={1}>
                  {activeAccount.name}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }} />
          {/* Period picker button */}
          <AnimatedPressable
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              borderWidth: 1, borderColor: colors.border,
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
            }}
            onPress={() => setMonthPickerVisible(true)}
          >
            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
              {isAllTime ? t('allTime') : currentMonth.toUpperCase()}
            </Text>
            <ChevronDown size={11} color={colors.textMuted} />
          </AnimatedPressable>
          {/* Single share button */}
          <AnimatedPressable
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor: colors.accentDim,
              borderWidth: 1, borderColor: colors.accent,
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
            }}
            onPress={() => setShareModalVisible(true)}
          >
            <Share2 size={13} color={colors.accent} />
            <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '700' }}>
              {t('share')}
            </Text>
          </AnimatedPressable>
        </Animated.View>

        {/* Drawdown Banner */}
        {stats?.isDrawdown && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: colors.dangerDim, borderWidth: 1, borderColor: colors.danger,
            borderRadius: 8, padding: 12, marginBottom: 16,
          }}>
            <AlertTriangle size={16} color={colors.danger} />
            <Text style={{ flex: 1, fontSize: 12, color: colors.danger, fontWeight: '600' }}>
              {t('drawdownWarning')}
            </Text>
          </View>
        )}

        {/* Summary Matrix — 3×2 stat cards (Main Metric + Sub-text) */}
        {/* Row 1 */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          {/* Box 1: Live Net Balance */}
          <Animated.View entering={FadeInUp.delay(0).duration(400).springify()} style={{
            flex: 1, backgroundColor: colors.panel,
            borderWidth: 1.5, borderColor: GOLD_BORDER,
            borderRadius: 10, padding: 14, overflow: 'hidden',
          }}>
            <CandlestickBackground height={100} opacity={0.75} />
            <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, zIndex: 1 }}>
              {t('liveNetBalance')}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: (stats?.runningBalance ?? 0) >= 0 ? colors.accent : colors.danger, zIndex: 1 }}>
              {`$${stats?.runningBalance.toFixed(2) ?? '0.00'}`}
            </Text>
            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4, zIndex: 1 }}>
              {t('lifetimeDeposit')}: ${stats?.totalDeposits.toFixed(2) ?? '0.00'}
            </Text>
          </Animated.View>

          {/* Box 2: Trades / Win Rate */}
          <Animated.View entering={FadeInUp.delay(60).duration(400).springify()} style={{
            flex: 1, backgroundColor: colors.panel,
            borderWidth: 1.5, borderColor: GOLD_BORDER,
            borderRadius: 10, padding: 14, overflow: 'hidden',
          }}>
            <CandlestickBackground height={100} opacity={0.75} />
            <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, zIndex: 1 }}>
              {t('tradesWinRate')}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: winRateColor, zIndex: 1 }}>
              {`${stats?.totalTrades ?? 0} (${stats?.winRate ?? 0}%)`}
            </Text>
            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4, zIndex: 1 }}>
              {t('wins')}: {stats?.wins ?? 0} | {t('losses')}: {stats?.losses ?? 0}
            </Text>
          </Animated.View>
        </View>

        {/* Row 2 */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          {/* Box 3: Net R:R Gain */}
          <Animated.View entering={FadeInUp.delay(120).duration(400).springify()} style={{
            flex: 1, backgroundColor: colors.panel,
            borderWidth: 1.5, borderColor: GOLD_BORDER,
            borderRadius: 10, padding: 14, overflow: 'hidden',
          }}>
            <CandlestickBackground height={100} opacity={0.75} />
            <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, zIndex: 1 }}>
              {t('netRRGain')}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: (stats?.totalRR ?? 0) >= 0 ? colors.accent : colors.danger, zIndex: 1 }}>
              {`${(stats?.totalRR ?? 0) >= 0 ? '+' : ''}${(stats?.totalRR ?? 0).toFixed(1)} RR`}
            </Text>
            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4, zIndex: 1 }}>
              {t('targetRR')}: +{dailyTargetValue}
            </Text>
          </Animated.View>

          {/* Box 4: Avg Win / Avg Loss */}
          <Animated.View entering={FadeInUp.delay(180).duration(400).springify()} style={{
            flex: 1, backgroundColor: colors.panel,
            borderWidth: 1.5, borderColor: GOLD_BORDER,
            borderRadius: 10, padding: 14, overflow: 'hidden',
          }}>
            <CandlestickBackground height={100} opacity={0.75} />
            <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, zIndex: 1 }}>
              {t('avgWinLoss')}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.warning, zIndex: 1 }}>
              {`+${(stats?.avgWin ?? 0).toFixed(1)}R / -${(stats?.avgLoss ?? 0).toFixed(1)}R`}
            </Text>
            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4, zIndex: 1 }}>
              {t('riskRatio')}: {stats && stats.avgLoss > 0 ? stats.riskRatio.toFixed(2) : 'N/A'}
            </Text>
          </Animated.View>
        </View>

        {/* Row 3 */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {/* Box 5: Max Drawdown */}
          <Animated.View entering={FadeInUp.delay(240).duration(400).springify()} style={{
            flex: 1, backgroundColor: colors.panel,
            borderWidth: 1.5, borderColor: GOLD_BORDER,
            borderRadius: 10, padding: 14, overflow: 'hidden',
          }}>
            <CandlestickBackground height={100} opacity={0.75} />
            <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, zIndex: 1 }}>
              {t('maxDrawdown')}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.danger, zIndex: 1 }}>
              {`$${(stats?.maxDrawdown ?? 0).toFixed(2)}`}
            </Text>
            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4, zIndex: 1 }}>
              {t('peakLoss')}: ${(stats?.maxDrawdown ?? 0).toFixed(2)}
            </Text>
          </Animated.View>

          {/* Box 6: Profit Factor */}
          <Animated.View entering={FadeInUp.delay(300).duration(400).springify()} style={{
            flex: 1, backgroundColor: colors.panel,
            borderWidth: 1.5, borderColor: GOLD_BORDER,
            borderRadius: 10, padding: 14, overflow: 'hidden',
          }}>
            <CandlestickBackground height={100} opacity={0.75} />
            <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, zIndex: 1 }}>
              {t('profitFactor')}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '700', zIndex: 1, color: (stats?.profitFactor ?? 0) >= 1.5 ? colors.accent : (stats?.profitFactor ?? 0) >= 1.0 ? colors.warning : colors.danger }}>
              {(stats?.profitFactor ?? 0) === 0 || (stats?.profitFactor ?? 0) >= 900
                ? 'N/A'
                : (stats?.profitFactor ?? 0).toFixed(2)}
            </Text>
            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4, zIndex: 1 }}>
              {t('status')}: {' '}
              {(stats?.profitFactor ?? 0) === 0 || (stats?.profitFactor ?? 0) >= 900
                ? 'N/A'
                : (stats?.profitFactor ?? 0) >= 2.0
                  ? 'Excellent'
                  : (stats?.profitFactor ?? 0) >= 1.5
                    ? 'Good'
                    : (stats?.profitFactor ?? 0) >= 1.0
                      ? 'Break-even'
                      : 'Poor'}
            </Text>
          </Animated.View>
        </View>

        {/* Monthly Goal Progress */}
        <Animated.View entering={FadeInUp.delay(360).duration(400).springify()} style={{
          backgroundColor: colors.panel, borderWidth: 1.5, borderColor: GOLD_BORDER,
          borderRadius: 10, padding: 14, marginBottom: 14, overflow: 'hidden',
        }}>
          <CandlestickBackground height={120} opacity={0.6} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Target size={14} color={colors.warning} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{t('monthlyGoal')} +{monthlyGoalRR} RR</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>{progressPct}%</Text>
          </View>
          <View style={{ height: 10, backgroundColor: colors.inputBg, borderRadius: 50, overflow: 'hidden', marginBottom: 12 }}>
            <View style={{ height: 10, width: `${progressPct}%`, backgroundColor: colors.accent, borderRadius: 50 }} />
          </View>
          {/* Daily Target */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>{t('dailyTarget')}:</Text>
            {editingTarget ? (
              <TextInput
                style={{
                  backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.accent,
                  borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
                  color: colors.text, fontSize: 13, minWidth: 60,
                }}
                value={targetInput}
                onChangeText={setTargetInput}
                keyboardType="decimal-pad"
                autoFocus
              />
            ) : (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
                borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
              }}>
                <Text style={{ color: colors.warning, fontWeight: '700', fontSize: 13 }}>{dailyTargetValue}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>RR</Text>
              </View>
            )}
            {!isTargetLocked && !editingTarget && (
              <AnimatedPressable
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                onPress={() => { setTargetInput(String(dailyTargetValue)); setEditingTarget(true); }}
              >
                <Edit2 size={12} color={colors.label} />
                <Text style={{ fontSize: 12, color: colors.label, fontWeight: '600' }}>{t('editLabel')}</Text>
              </AnimatedPressable>
            )}
            {editingTarget && (
              <AnimatedPressable
                style={{ backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}
                onPress={handleSaveTarget}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{t('saveAndLock')}</Text>
              </AnimatedPressable>
            )}
            {isTargetLocked && (
              <View style={{ backgroundColor: colors.dangerDim, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, color: colors.danger, fontWeight: '600' }}>
                  🔒 {getTimeUntilMidnight()}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Equity Chart */}
        <Animated.View entering={FadeInUp.delay(420).duration(400).springify()} style={{
          backgroundColor: colors.panel, borderWidth: 1.5, borderColor: GOLD_BORDER,
          borderRadius: 10, padding: 14, marginBottom: 14, overflow: 'hidden',
        }}>
          <CandlestickBackground height={250} opacity={0.5} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('portfolioGrowth')}
            </Text>
            <AnimatedPressable
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                borderWidth: 1, borderColor: colors.border, borderRadius: 14,
                paddingHorizontal: 8, paddingVertical: 3,
              }}
              onPress={() => setChartVisible((v) => !v)}
            >
              {chartVisible ? <EyeOff size={11} color={colors.textMuted} /> : <Eye size={11} color={colors.textMuted} />}
              <Text style={{ fontSize: 10, color: colors.textMuted }}>{chartVisible ? t('hide') : t('show')}</Text>
            </AnimatedPressable>
          </View>
          {chartVisible && <EquityChart points={stats?.chartPoints ?? [0]} height={200} />}
        </Animated.View>
      </ScrollView>

      {/* ── Month Picker Modal ── */}
      <Modal visible={monthPickerVisible} transparent animationType="slide" onRequestClose={() => setMonthPickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }}>
          <View style={{
            backgroundColor: colors.panel,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 16,
            paddingBottom: 32,
            paddingHorizontal: 16,
            gap: 12,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{t('selectPeriod')}</Text>
              <TouchableOpacity onPress={() => setMonthPickerVisible(false)} style={{ padding: 4 }}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* All Time option */}
            <TouchableOpacity
              onPress={() => { setIsAllTime(true); setMonthPickerVisible(false); }}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: isAllTime ? colors.accentDim : colors.bg,
                borderWidth: 1, borderColor: isAllTime ? colors.accent : colors.border,
                borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: isAllTime ? colors.accent : colors.text }}>
                {t('allTime')}
              </Text>
              {isAllTime && <Check size={16} color={colors.accent} />}
            </TouchableOpacity>

            {/* Month grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MONTHS.map((m) => {
                const selected = !isAllTime && currentMonth === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => { setIsAllTime(false); setCurrentMonth(m); setMonthPickerVisible(false); }}
                    style={{
                      width: '30.8%',
                      backgroundColor: selected ? colors.accentDim : colors.bg,
                      borderWidth: 1, borderColor: selected ? colors.accent : colors.border,
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{
                      fontSize: 12, fontWeight: selected ? '700' : '600',
                      color: selected ? colors.accent : colors.text,
                    }}>
                      {m.slice(0, 3).toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Period Image Save Modal — must live OUTSIDE ScrollView so off-screen capture
          views are positioned relative to the root screen, not the scroll container */}
      <PeriodImageModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
      />
    </SafeAreaView>
  );
}
