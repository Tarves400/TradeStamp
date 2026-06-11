import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Linking,
  ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Trash2, ExternalLink, Plus, ChevronDown, ChevronUp, FileDown, Share2, Wallet } from 'lucide-react-native';
import { useTradeStore } from '@/lib/tradeStore';
import { MONTHS, MONTH_SHORT, TradeEntry } from '@/lib/storage';
import { PdfPeriod, filterEntriesByPeriod, generateAndSharePdf } from '@/lib/pdfExport';
import { useAuth } from '@/lib/authContext';
import { useLang } from '@/lib/langContext';
import TradeShareModal from '@/components/TradeShareModal';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import CandlestickBackground from '@/components/CandlestickBackground';

const GOLD_BORDER = 'rgba(212,168,60,0.45)';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 3 + i);
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const MONTH_NUMS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

type EntryType = 'Trade' | 'Deposit' | 'Withdraw';

function pad2(n: number) { return String(n).padStart(2, '0'); }

export default function JournalScreen() {
  const {
    tradeData, isLoaded, addEntry, deleteEntry,
    currentMonth, isAllTime, setCurrentMonth, setIsAllTime,
    colors, activeAccount,
  } = useTradeStore();
  const { session } = useAuth();
  const { t } = useLang();
  const router = useRouter();

  // Form state
  const [formVisible, setFormVisible] = useState(false);
  const [entryType, setEntryType] = useState<EntryType>('Trade');
  const [pair, setPair] = useState('');
  const [position, setPosition] = useState<'Long' | 'Short'>('Long');
  const [result, setResult] = useState<'Win' | 'Loss'>('Win');
  const [rrValue, setRrValue] = useState('');
  const [lotSize, setLotSize] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [chartLink, setChartLink] = useState('');
  const today = new Date();
  const [day, setDay] = useState(pad2(today.getDate()));
  const [monthNum, setMonthNum] = useState(pad2(today.getMonth() + 1));
  const [year, setYear] = useState(String(today.getFullYear()));
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  // Auth-gate modal
  const [showAuthGate, setShowAuthGate] = useState(false);

  // Ledger filters
  const [search, setSearch] = useState('');
  const [filterOutcome, setFilterOutcome] = useState<'ALL' | 'Win' | 'Loss' | 'Cash'>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; month: string } | null>(null);
  const [shareEntry, setShareEntry] = useState<TradeEntry | null>(null);

  // Auto-calculate RR from entry, exit, stopLoss
  // accepts optional overrides so callers can pass the just-typed value
  const autoCalcRR = (overrides?: { ep?: string; xp?: string; sl?: string }): string | null => {
    const ep = parseFloat(overrides?.ep ?? entryPrice);
    const xp = parseFloat(overrides?.xp ?? exitPrice);
    const sl = parseFloat(overrides?.sl ?? stopLoss);
    if (isNaN(ep) || isNaN(xp) || isNaN(sl)) return null;
    const risk = Math.abs(ep - sl);
    if (risk === 0) return null;
    const reward = Math.abs(xp - ep);
    return String(parseFloat((reward / risk).toFixed(2)));
  };

  // PDF export state
  const [pdfPeriod, setPdfPeriod] = useState<PdfPeriod>('7d');
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const handleAddTradePress = () => {
    if (!session) {
      setShowAuthGate(true);
      return;
    }
    setFormVisible((v) => !v);
  };

  const handleExportPdf = async () => {
    setPdfError('');
    const allEntries: TradeEntry[] = [];
    MONTHS.forEach((m) => (tradeData[m] || []).forEach((e) => allEntries.push(e)));
    const filtered = filterEntriesByPeriod(allEntries, pdfPeriod);
    if (filtered.length === 0) {
      setPdfError(t('noPdfRecords'));
      return;
    }
    setPdfExporting(true);
    try {
      await generateAndSharePdf(filtered, pdfPeriod);
    } catch {
      setPdfError(t('pdfError'));
    } finally {
      setPdfExporting(false);
    }
  };

  const masterList: (TradeEntry & { originMonth: string })[] = [];
  if (isAllTime) {
    MONTHS.forEach((m) => (tradeData[m] || []).forEach((e) => masterList.push({ ...e, originMonth: m })));
  } else {
    (tradeData[currentMonth] || []).forEach((e) => masterList.push({ ...e, originMonth: currentMonth }));
  }
  masterList.sort((a, b) => (b.sortTimestamp || 0) - (a.sortTimestamp || 0));

  let displayList = [...masterList];
  if (filterOutcome === 'Win') displayList = displayList.filter((e) => e.type === 'Trade' && e.result === 'Win');
  else if (filterOutcome === 'Loss') displayList = displayList.filter((e) => e.type === 'Trade' && e.result === 'Loss');
  else if (filterOutcome === 'Cash') displayList = displayList.filter((e) => e.type === 'Deposit' || e.type === 'Withdraw');
  if (search.trim()) displayList = displayList.filter((e) => e.pair?.toUpperCase().includes(search.trim().toUpperCase()));

  const handleSubmit = async () => {
    const errs: Record<string, boolean> = {};
    const rrNum2 = parseFloat(rrValue) || 0;
    if (entryType === 'Trade') {
      // For Trade: only require pair — R:R is auto-calculated from price fields
      if (!pair.trim()) errs.pair = true;
    } else {
      // For Deposit/Withdraw: require a valid positive amount
      const amt = parseFloat(rrValue);
      if (!rrValue || isNaN(amt) || amt <= 0) errs.rr = true;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    const mIdx = parseInt(monthNum, 10) - 1;
    const entryMonth = MONTHS[mIdx];
    const ts = new Date(`${year}-${monthNum}-${day}`).getTime();

    const entry: TradeEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: entryType,
      date: `${day}-${monthNum}-${year}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      day: parseInt(day),
      monthNum: parseInt(monthNum),
      year: parseInt(year),
      sortTimestamp: ts,
      chartLink: chartLink.trim() || undefined,
    };

    if (entryType === 'Trade') {
      let rr = Math.abs(rrNum2);
      if (result === 'Loss') rr = -rr;
      entry.pair = pair.toUpperCase().trim();
      entry.position = position;
      entry.result = result;
      entry.rr = rr;
      entry.displayValue = `${rr >= 0 ? '+' : ''}${rr} RR (${Math.abs(rr) * 10} Pips)`;
      const ls = parseFloat(lotSize);
      if (!isNaN(ls) && ls > 0) entry.lotSize = ls;
      const ep = parseFloat(entryPrice);
      if (!isNaN(ep) && ep > 0) entry.entryPrice = ep;
      const xp = parseFloat(exitPrice);
      if (!isNaN(xp) && xp > 0) entry.exitPrice = xp;
      const sl = parseFloat(stopLoss);
      if (!isNaN(sl) && sl > 0) entry.stopLoss = sl;
    } else {
      entry.amount = Math.abs(rrNum2);
    }

    await addEntry(entry);
    setPair(''); setPosition('Long'); setRrValue(''); setLotSize(''); setEntryPrice(''); setExitPrice(''); setStopLoss(''); setChartLink('');
    setDay(pad2(new Date().getDate()));
    setMonthNum(pad2(new Date().getMonth() + 1));
    setYear(String(new Date().getFullYear()));
    setErrors({});
    setFormVisible(false);
    setSubmitting(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteEntry(deleteTarget.id, deleteTarget.month);
    setDeleteTarget(null);
  };

  const pdfPeriodLabel = (p: PdfPeriod) => {
    if (p === '1d') return t('oneDay');
    if (p === '3d') return t('threeDays');
    if (p === '7d') return t('sevenDays');
    if (p === 'all') return t('allTime');
    return t('oneMonth');
  };

  const s = { panel: { backgroundColor: colors.panel, borderWidth: 1.5, borderColor: GOLD_BORDER, borderRadius: 10, padding: 14, overflow: 'hidden' as const } };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}>
        {!isLoaded ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={{ paddingTop: 16, paddingBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: 0.5 }}>
                  {t('tradeJournal')}
                </Text>
                {activeAccount && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 6, paddingVertical: 2,
                    backgroundColor: colors.accentDim, borderRadius: 6,
                  }}>
                    <Wallet size={9} color={colors.accent} />
                    <Text style={{ fontSize: 9, color: colors.accent, fontWeight: '700' }} numberOfLines={1}>
                      {activeAccount.name}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                {isAllTime ? t('allTimeRecords') : `${currentMonth} ${t('records')}`}
              </Text>
            </View>

            {/* Month Scope Selector */}
            <View style={{ ...s.panel, marginBottom: 14 }}>
              <CandlestickBackground height={120} opacity={0.6} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 10 }}>
                {t('scopeFramework')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {MONTHS.map((m, i) => {
                  const active = !isAllTime && m === currentMonth;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={{
                        paddingVertical: 7, paddingHorizontal: 10,
                        backgroundColor: active ? colors.accentDim : colors.inputBg,
                        borderWidth: 1, borderColor: active ? colors.accent : colors.border,
                        borderRadius: 6,
                      }}
                      onPress={() => { setIsAllTime(false); setCurrentMonth(m); }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? colors.accent : colors.text }}>
                        {MONTH_SHORT[i]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={{
                  paddingVertical: 9, alignItems: 'center',
                  backgroundColor: isAllTime ? 'rgba(88,166,255,0.1)' : colors.inputBg,
                  borderWidth: 1, borderColor: isAllTime ? colors.label : colors.border,
                  borderRadius: 6,
                }}
                onPress={() => setIsAllTime(true)}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: isAllTime ? colors.label : colors.text }}>
                  {t('viewAllTime')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Add Trade Toggle — auth-gated */}
            <AnimatedPressable
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                ...s.panel, marginBottom: 14,
              }}
              onPress={handleAddTradePress}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Plus size={16} color={colors.accent} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                  {t('addTradeRecord')}
                </Text>
              </View>
              {session
                ? (formVisible ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />)
                : <Text style={{ fontSize: 11, color: colors.textMuted }}>🔒 {t('signIn')}</Text>
              }
            </AnimatedPressable>

            {/* Form — only if logged in and form open */}
            {formVisible && session && (
              <View style={{ ...s.panel, marginBottom: 14, gap: 12 }}>
                <CandlestickBackground height={500} opacity={0.45} />
                {/* Entry Type */}
                <View>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 6 }}>
                    {t('transactionType').toUpperCase()}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['Trade', 'Deposit', 'Withdraw'] as EntryType[]).map((tp) => (
                      <TouchableOpacity
                        key={tp}
                        style={{
                          flex: 1, paddingVertical: 8, alignItems: 'center',
                          backgroundColor: entryType === tp ? colors.accentDim : colors.inputBg,
                          borderWidth: 1, borderColor: entryType === tp ? colors.accent : colors.border,
                          borderRadius: 6,
                        }}
                        onPress={() => { setEntryType(tp); setErrors({}); setRrValue(''); }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: entryType === tp ? colors.accent : colors.textMuted }}>
                          {tp === 'Trade' ? t('trade').toUpperCase() : tp === 'Deposit' ? t('deposit').toUpperCase() : t('withdraw').toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Pair + Result (Trade only) */}
                {entryType === 'Trade' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 6 }}>
                        {t('pair').toUpperCase()}
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: errors.pair ? colors.dangerDim : colors.inputBg,
                          borderWidth: 1, borderColor: errors.pair ? colors.danger : colors.border,
                          borderRadius: 6, padding: 10, color: colors.text, fontSize: 14,
                        }}
                        placeholder={t('pairPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        value={pair}
                        onChangeText={(v) => { setPair(v); setErrors((e) => ({ ...e, pair: false })); }}
                        autoCapitalize="characters"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 6 }}>
                        {t('outcome').toUpperCase()}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {(['Win', 'Loss'] as const).map((r) => (
                          <TouchableOpacity
                            key={r}
                            style={{
                              flex: 1, paddingVertical: 10, alignItems: 'center',
                              backgroundColor: result === r ? (r === 'Win' ? colors.accentDim : colors.dangerDim) : colors.inputBg,
                              borderWidth: 1, borderColor: result === r ? (r === 'Win' ? colors.accent : colors.danger) : colors.border,
                              borderRadius: 6,
                            }}
                            onPress={() => setResult(r)}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: result === r ? (r === 'Win' ? colors.accent : colors.danger) : colors.textMuted }}>
                              {r === 'Win' ? t('win') : t('loss')}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {/* Position selector — Trade only */}
                {entryType === 'Trade' && (
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 6 }}>
                      {t('position').toUpperCase()}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['Long', 'Short'] as const).map((p) => (
                        <TouchableOpacity
                          key={p}
                          style={{
                            flex: 1, paddingVertical: 10, alignItems: 'center',
                            backgroundColor: position === p ? (p === 'Long' ? colors.accentDim : colors.dangerDim) : colors.inputBg,
                            borderWidth: 1, borderColor: position === p ? (p === 'Long' ? colors.accent : colors.danger) : colors.border,
                            borderRadius: 6,
                          }}
                          onPress={() => setPosition(p)}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: position === p ? (p === 'Long' ? colors.accent : colors.danger) : colors.textMuted }}>
                            {p === 'Long' ? t('long') : t('short')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Amount input — only for Deposit / Withdraw; R:R for Trade is auto-calculated silently */}
                {entryType !== 'Trade' && (
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 6 }}>
                      {entryType === 'Deposit' ? t('depositAmount').toUpperCase() : t('withdrawAmount').toUpperCase()}
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: errors.rr ? colors.dangerDim : colors.inputBg,
                        borderWidth: 1, borderColor: errors.rr ? colors.danger : colors.border,
                        borderRadius: 6, padding: 10, color: colors.text, fontSize: 14,
                      }}
                      placeholder={t('amountPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={rrValue}
                      onChangeText={(v) => { setRrValue(v); setErrors((e) => ({ ...e, rr: false })); }}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )}

                {/* Lot Size + Entry + Exit + Stop Loss row (Trade only) */}
                {entryType === 'Trade' && (
                  <View style={{ gap: 8 }}>
                    {/* Row 1: Entry / Exit / Stop Loss */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 6 }}>
                          {t('entryPrice').toUpperCase()}
                        </Text>
                        <TextInput
                          style={{
                            backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
                            borderRadius: 6, padding: 10, color: colors.text, fontSize: 14,
                          }}
                          placeholder={t('entryPricePlaceholder')}
                          placeholderTextColor={colors.textMuted}
                          value={entryPrice}
                          onChangeText={(v) => {
                            setEntryPrice(v);
                            const calc = autoCalcRR({ ep: v });
                            if (calc) setRrValue(calc);
                          }}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 6 }}>
                          {t('exitPrice').toUpperCase()}
                        </Text>
                        <TextInput
                          style={{
                            backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
                            borderRadius: 6, padding: 10, color: colors.text, fontSize: 14,
                          }}
                          placeholder={t('exitPricePlaceholder')}
                          placeholderTextColor={colors.textMuted}
                          value={exitPrice}
                          onChangeText={(v) => {
                            setExitPrice(v);
                            const calc = autoCalcRR({ xp: v });
                            if (calc) setRrValue(calc);
                          }}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: colors.danger, fontWeight: '600', marginBottom: 6 }}>
                          {t('stopLoss').toUpperCase()}
                        </Text>
                        <TextInput
                          style={{
                            backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
                            borderRadius: 6, padding: 10, color: colors.text, fontSize: 14,
                          }}
                          placeholder={t('stopLossPlaceholder')}
                          placeholderTextColor={colors.textMuted}
                          value={stopLoss}
                          onChangeText={(v) => {
                            setStopLoss(v);
                            const calc = autoCalcRR({ sl: v });
                            if (calc) setRrValue(calc);
                          }}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                    {/* Row 2: Lot Size */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 6 }}>
                          {t('lotSize').toUpperCase()}
                        </Text>
                        <TextInput
                          style={{
                            backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
                            borderRadius: 6, padding: 10, color: colors.text, fontSize: 14,
                          }}
                          placeholder={t('lotSizePlaceholder')}
                          placeholderTextColor={colors.textMuted}
                          value={lotSize}
                          onChangeText={setLotSize}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      {/* auto-RR hint */}
                      <View style={{ flex: 2, justifyContent: 'flex-end', paddingBottom: 2 }}>
                        {autoCalcRR() && (
                          <View style={{
                            backgroundColor: colors.accentDim, borderRadius: 6,
                            padding: 10, borderWidth: 1, borderColor: colors.accent,
                          }}>
                            <Text style={{ fontSize: 10, color: colors.accent, fontWeight: '600', marginBottom: 2 }}>
                              ⚡ {t('autoRR')}
                            </Text>
                            <Text style={{ fontSize: 16, color: colors.accent, fontWeight: '800' }}>
                              {autoCalcRR()} RR
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                {/* Date */}
                <View>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 6 }}>
                    {t('date').toUpperCase()}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[
                      { label: t('day'), value: day, opts: DAYS, onSet: setDay },
                      { label: t('month'), value: monthNum, opts: MONTH_NUMS, onSet: setMonthNum },
                      { label: t('year'), value: year, opts: YEARS.map(String), onSet: setYear },
                    ].map(({ label, value, opts, onSet }) => (
                      <View key={label} style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>{label}</Text>
                        <View style={{
                          backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
                          borderRadius: 6, height: 36, justifyContent: 'center', paddingHorizontal: 10,
                        }}>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{value}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingVertical: 3, alignItems: 'center' }}
                            onPress={() => { const idx = opts.indexOf(value); if (idx > 0) onSet(opts[idx - 1]); }}
                          >
                            <Text style={{ color: colors.textMuted, fontSize: 12 }}>−</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingVertical: 3, alignItems: 'center' }}
                            onPress={() => { const idx = opts.indexOf(value); if (idx < opts.length - 1) onSet(opts[idx + 1]); }}
                          >
                            <Text style={{ color: colors.textMuted, fontSize: 12 }}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Chart Link */}
                <View>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 6 }}>
                    {t('chartLink').toUpperCase()}
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
                      borderRadius: 6, padding: 10, color: colors.text, fontSize: 13,
                    }}
                    placeholder={t('chartPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={chartLink}
                    onChangeText={setChartLink}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 13, alignItems: 'center',
                    opacity: submitting ? 0.7 : 1,
                  }}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                      {entryType === 'Trade' ? t('addTrade') : entryType === 'Deposit' ? t('confirmDeposit') : t('confirmWithdrawal')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* PDF Export Section */}
            <View style={{ ...s.panel, marginBottom: 14 }}>
              <CandlestickBackground height={200} opacity={0.55} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <FileDown size={14} color={colors.label} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                  {t('pdfExportTitle')}
                </Text>
              </View>
              <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 }}>
                {t('selectPeriod')}
              </Text>
              {/* Row 1: 1d, 3d, 7d, 1m */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                {(['1d', '3d', '7d', '1m'] as PdfPeriod[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={{
                      flex: 1, paddingVertical: 9, alignItems: 'center',
                      backgroundColor: pdfPeriod === p ? colors.accentDim : colors.inputBg,
                      borderWidth: 1, borderColor: pdfPeriod === p ? colors.accent : colors.border,
                      borderRadius: 8,
                    }}
                    onPress={() => { setPdfPeriod(p); setPdfError(''); }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: pdfPeriod === p ? colors.accent : colors.textMuted }}>
                      {pdfPeriodLabel(p)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Row 2: All Time */}
              <TouchableOpacity
                style={{
                  paddingVertical: 9, alignItems: 'center', marginBottom: 12,
                  backgroundColor: pdfPeriod === 'all' ? colors.accentDim : colors.inputBg,
                  borderWidth: 1, borderColor: pdfPeriod === 'all' ? colors.accent : colors.border,
                  borderRadius: 8,
                }}
                onPress={() => { setPdfPeriod('all'); setPdfError(''); }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: pdfPeriod === 'all' ? colors.accent : colors.textMuted }}>
                  {pdfPeriodLabel('all')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: pdfExporting ? colors.inputBg : colors.accent,
                  borderRadius: 9, paddingVertical: 13, alignItems: 'center',
                  flexDirection: 'row', justifyContent: 'center', gap: 8,
                  opacity: pdfExporting ? 0.7 : 1,
                }}
                onPress={handleExportPdf}
                disabled={pdfExporting}
              >
                {pdfExporting ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <>
                    <FileDown size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                      {t('pdfSaveShare')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {!!pdfError && (
                <Text style={{ fontSize: 12, color: colors.danger, marginTop: 8, textAlign: 'center' }}>
                  {pdfError}
                </Text>
              )}
            </View>

            {/* Ledger */}
            <View style={{ ...s.panel, marginBottom: 14 }}>
              <CandlestickBackground height={300} opacity={0.55} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 10 }}>
                {t('ledgerAuditLog')}
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
                borderRadius: 6, paddingHorizontal: 10, marginBottom: 8,
              }}>
                <Text style={{ color: colors.textMuted, marginRight: 6 }}>🔍</Text>
                <TextInput
                  style={{ flex: 1, color: colors.text, fontSize: 13, paddingVertical: 9 }}
                  placeholder={t('filterByPair')}
                  placeholderTextColor={colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {(['ALL', 'Win', 'Loss', 'Cash'] as const).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={{
                      flex: 1, paddingVertical: 6, alignItems: 'center',
                      backgroundColor: filterOutcome === f ? colors.accentDim : colors.inputBg,
                      borderWidth: 1, borderColor: filterOutcome === f ? colors.accent : colors.border,
                      borderRadius: 6,
                    }}
                    onPress={() => setFilterOutcome(f)}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: filterOutcome === f ? colors.accent : colors.textMuted }}>
                      {f === 'ALL' ? t('all').toUpperCase() : f === 'Win' ? t('win').toUpperCase() : f === 'Loss' ? t('loss').toUpperCase() : t('cash').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Table Header */}
              <View style={{
                flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4,
                backgroundColor: colors.inputBg, borderRadius: 6, marginBottom: 4,
              }}>
                {['#', t('date'), t('asset'), 'Lot', t('result'), t('value'), ''].map((h, i) => (
                  <Text
                    key={i}
                    style={{
                      flex: [0.4, 1.2, 1.0, 0.5, 0.6, 1.2, 0.6][i],
                      fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase',
                    }}
                  >
                    {h}
                  </Text>
                ))}
              </View>

              {displayList.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('noRecords')}</Text>
                </View>
              ) : (
                displayList.map((item, idx) => {
                  const isWin = item.type === 'Trade' && item.result === 'Win';
                  const isLoss = item.type === 'Trade' && item.result === 'Loss';
                  const isDep = item.type === 'Deposit';
                  const isWdr = item.type === 'Withdraw';
                  const badgeBg = isWin ? colors.accentDim : isLoss ? colors.dangerDim : isDep ? 'rgba(88,166,255,0.15)' : 'rgba(107,114,128,0.2)';
                  const badgeColor = isWin ? colors.accent : isLoss ? colors.danger : isDep ? colors.label : colors.textMuted;
                  const badgeLabel = isWin ? t('win').toUpperCase() : isLoss ? t('loss').toUpperCase() : isDep ? 'DEP' : 'WDR';
                  const valueStr = item.type === 'Trade'
                    ? (item.displayValue || `${(item.rr ?? 0) >= 0 ? '+' : ''}${item.rr}RR`)
                    : `${isDep ? '+' : '-'}$${(item.amount ?? 0).toFixed(2)}`;
                  const valueColor = isWin ? colors.accent : isLoss ? colors.danger : isDep ? colors.accent : colors.danger;

                  return (
                    <Animated.View
                      key={item.id}
                      entering={FadeInUp.delay(Math.min(idx * 30, 400)).duration(350).springify()}
                      style={{
                        flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4,
                        borderBottomWidth: 1, borderBottomColor: colors.border,
                      }}
                    >
                      <Text style={{ flex: 0.4, fontSize: 11, color: colors.textMuted }}>{idx + 1}</Text>
                      <Text style={{ flex: 1.2, fontSize: 11, color: colors.textMuted }}>{item.date}</Text>
                      <View style={{ flex: 1.0, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                          {item.type === 'Trade' ? item.pair : item.type}
                        </Text>
                        {item.type === 'Trade' && item.position && (
                          <View style={{
                            backgroundColor: item.position === 'Long' ? colors.accentDim : colors.dangerDim,
                            borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1,
                          }}>
                            <Text style={{
                              fontSize: 9, fontWeight: '800',
                              color: item.position === 'Long' ? colors.accent : colors.danger,
                            }}>
                              {item.position === 'Long' ? 'L' : 'S'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ flex: 0.5, fontSize: 11, color: colors.textMuted }} numberOfLines={1}>
                        {item.lotSize ?? '—'}
                      </Text>
                      <View style={{ flex: 0.6 }}>
                        <View style={{ backgroundColor: badgeBg, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 5, alignSelf: 'flex-start' }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: badgeColor }}>{badgeLabel}</Text>
                        </View>
                      </View>
                      <View style={{ flex: 1.2 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: valueColor }} numberOfLines={1}>
                          {valueStr}
                        </Text>
                        {item.stopLoss != null && (
                          <Text style={{ fontSize: 9, color: colors.danger, marginTop: 1 }} numberOfLines={1}>
                            SL {item.stopLoss}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 0.6, flexDirection: 'row', gap: 6, justifyContent: 'flex-end' }}>
                        {item.chartLink && (item.chartLink.startsWith('http://') || item.chartLink.startsWith('https://')) && (
                          <AnimatedPressable onPress={() => Linking.openURL(item.chartLink!)}>
                            <ExternalLink size={14} color={colors.label} />
                          </AnimatedPressable>
                        )}
                        {/* Per-trade share button */}
                        <AnimatedPressable onPress={() => setShareEntry(item)}>
                          <Share2 size={14} color={colors.accent} />
                        </AnimatedPressable>
                        <AnimatedPressable onPress={() => setDeleteTarget({ id: item.id, month: item.originMonth })}>
                          <Trash2 size={14} color={colors.textMuted} />
                        </AnimatedPressable>
                      </View>
                    </Animated.View>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border,
            borderRadius: 12, padding: 24, width: '85%', maxWidth: 360,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Trash2 size={18} color={colors.danger} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{t('deleteRecord')}</Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>
              {t('deleteConfirm')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={{
                  paddingVertical: 9, paddingHorizontal: 16,
                  backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 6,
                }}
                onPress={() => setDeleteTarget(null)}
              >
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingVertical: 9, paddingHorizontal: 16, backgroundColor: colors.danger, borderRadius: 6 }}
                onPress={confirmDelete}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Auth Gate Modal */}
      {showAuthGate && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border,
            borderRadius: 12, padding: 24, width: '85%', maxWidth: 360,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 }}>
              🔒 {t('signInRequired')}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>
              {t('signInRequiredDesc')}
            </Text>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={{ backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => { setShowAuthGate(false); router.push('/(auth)/sign-in'); }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('goToSignIn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                  paddingVertical: 12, alignItems: 'center',
                }}
                onPress={() => setShowAuthGate(false)}
              >
                <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 14 }}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Per-trade Share Modal */}
      <TradeShareModal entry={shareEntry} onClose={() => setShareEntry(null)} />
    </SafeAreaView>
  );
}
