import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, ScrollView, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  User, Edit2, Settings, ChevronRight, LogOut,
  Star, HelpCircle, Info, UserMinus, Phone, X, Check,
  Moon, Sun, Globe, Bell, Monitor, Zap, AlertTriangle,
  Plus, Wallet, Building2, UserCircle, Trash2, ArrowRightLeft,
} from 'lucide-react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as KeepAwake from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTradeStore } from '@/lib/tradeStore';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/client/supabase';
import { useLang } from '@/lib/langContext';
import { LangCode, LANGUAGE_NAMES } from '@/lib/i18n';
import { getAccountTradeCount } from '@/lib/storage';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import CandlestickBackground from '@/components/CandlestickBackground';

// গোল্ডেন লাক্সারি ডিজাইনের জন্য কালার কনস্ট্যান্টস
const GOLD = '#D4A83C';
const GOLD_BORDER = 'rgba(212,168,60,0.45)';
const GOLD_DIM = 'rgba(212,168,60,0.12)';
const GOLD_GLOW_1 = 'rgba(212,168,60,0.08)';
const GOLD_GLOW_2 = 'rgba(212,168,60,0.20)';
const GOLD_GLOW_3 = 'rgba(212,168,60,0.38)';

const KEEP_SCREEN_KEY = 'pref_keep_screen_on';
const PUSH_NOTIF_KEY = 'pref_push_notifications';

// ── হাই-ইম্প্যাক্ট ইকোনমিক ইভেন্টস লজিক ──
type NewsEvent = { id: string; currency: string; name: string; targetTime: number };

function getInitialEvents(): NewsEvent[] {
  const now = Date.now();
  return [
    { id: 'n1', currency: 'USD', name: 'Core CPI MoM', targetTime: now + 85 * 60 * 1000 },
    { id: 'n2', currency: 'EUR', name: 'Main Refinancing Rate', targetTime: now + 3 * 3600 * 1000 },
    { id: 'n3', currency: 'USD', name: 'Non-Farm Payrolls (NFP)', targetTime: now + 18 * 3600 * 1000 },
    { id: 'n4', currency: 'GBP', name: 'BoE Interest Rate Decision', targetTime: now + 45 * 3600 * 1000 },
    { id: 'n5', currency: 'USD', name: 'FOMC Meeting Minutes', targetTime: now + 5 * 3600 * 1000 },
    { id: 'n6', currency: 'JPY', name: 'BoJ Policy Rate', targetTime: now + 28 * 3600 * 1000 },
  ];
}

function formatCountdown(diff: number): string {
  if (diff <= 0) return 'NOW';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CHF: '🇨🇭', AUD: '🇦🇺', NZD: '🇳🇿', CAD: '🇨🇦',
};


export default function MenuScreen() {
  const {
    colors, theme, toggleTheme,
    avatar, setAvatarUri,
    profileName, setProfileNameVal,
    accounts, activeAccount, activeAccountId,
    addAccount, switchAccount, deleteAccount,
  } = useTradeStore();
  const { session } = useAuth();
  const { lang, setLang, t } = useLang();
  const router = useRouter();

  // Edit profile modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState(profileName);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Settings modal state
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Account modal state
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'personal' | 'prop_firm' | 'demo'>('personal');
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [accountTradeCounts, setAccountTradeCounts] = useState<Record<string, number>>({});

  // ── ইভেন্ট কাউন্টডাউন টাইমার ──
  const [events] = useState<NewsEvent[]>(getInitialEvents);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const statsShotRef = useRef<ViewShot>(null);
  const email = session?.user?.email ?? '';

  // Tracks whether the OS WakeLock was *actually* acquired — guards deactivate calls.
  // activateKeepAwakeAsync() can fail silently on Web (permissions policy / iframe),
  // and calling deactivateKeepAwake() without a prior successful activation throws.
  const wakeLockActive = useRef(false);

  // Load persisted prefs on mount
  useEffect(() => {
    (async () => {
      const ks = await AsyncStorage.getItem(KEEP_SCREEN_KEY);
      const pn = await AsyncStorage.getItem(PUSH_NOTIF_KEY);
      if (ks === 'true') {
        setKeepScreenOn(true);
        try {
          await KeepAwake.activateKeepAwakeAsync();
          wakeLockActive.current = true;
        } catch { /* WakeLock unavailable (Web iframe / permissions policy) */ }
      }
      if (pn === 'true') setPushEnabled(true);
    })();
  }, []);

  const toggleKeepScreen = async (val: boolean) => {
    setKeepScreenOn(val);
    await AsyncStorage.setItem(KEEP_SCREEN_KEY, String(val));
    if (val) {
      try {
        await KeepAwake.activateKeepAwakeAsync();
        wakeLockActive.current = true;
      } catch { /* WakeLock unavailable on Web */ }
    } else {
      // Only deactivate if the lock was actually acquired — avoids the
      // "has not activated yet" throw on Web when activation was blocked.
      if (wakeLockActive.current) {
        try { KeepAwake.deactivateKeepAwake(); } catch { /* ignore */ }
        wakeLockActive.current = false;
      }
    }
  };

  const togglePushNotif = async (val: boolean) => {
    // Store preference locally — actual OS permission is requested when the app
    // sends a real notification (not needed at toggle time, and unavailable in preview).
    setPushEnabled(val);
    await AsyncStorage.setItem(PUSH_NOTIF_KEY, String(val));
  };

  // Load trade counts for account list
  useEffect(() => {
    (async () => {
      const counts: Record<string, number> = {};
      for (const acc of accounts) {
        counts[acc.id] = await getAccountTradeCount(acc.id);
      }
      setAccountTradeCounts(counts);
    })();
  }, [accounts, accountModalVisible]);

  const handlePickImage = async (fromCamera: boolean) => {
    setPickerLoading(true);
    setPermissionDenied(false);
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') { setPermissionDenied(true); return; }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.75 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.75, mediaTypes: ['images'] });
      if (!result.canceled && result.assets[0]) await setAvatarUri(result.assets[0].uri);
    } finally {
      setPickerLoading(false);
    }
  };

  const handleSaveName = async () => {
    await setProfileNameVal(nameInput.trim() || 'Trader');
    setEditModalVisible(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    // scope: 'global' invalidates the refresh token on the server AND removes
    // local session storage, preventing the auto-login bug on app restart.
    await supabase.auth.signOut({ scope: 'global' });
    // Also clear app-specific persisted preferences
    await AsyncStorage.multiRemove([
      KEEP_SCREEN_KEY,
      PUSH_NOTIF_KEY,
    ]);
    setLoggingOut(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const uid = session?.user?.id;
      if (uid) {
        // Mark profile for 3-day grace-period deletion
        await supabase
          .from('profiles')
          .update({ deletion_requested_at: new Date().toISOString() })
          .eq('id', uid);
      }
    } catch {
      // Even if the DB update fails, proceed with sign-out
    }
    // scope: 'global' invalidates the session server-side
    await supabase.auth.signOut({ scope: 'global' });
    setDeleting(false);
    setDeleteConfirmVisible(false);
  };

  // Initial letter for avatar fallback
  const initial = (profileName || 'T').charAt(0).toUpperCase();

  // Shared styles
  const divider = { height: 1, backgroundColor: colors.border, marginHorizontal: 0 };
  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ── Header ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10,
        }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 }}>
            {t('menuTitle')}
          </Text>
          <TouchableOpacity
            onPress={() => setSettingsVisible(true)}
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Settings size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Profile Card (লাক্সারি গোল্ড) ── */}
        <Animated.View entering={FadeInUp.delay(0).duration(400).springify()} style={{
          marginHorizontal: 16, marginBottom: 14,
          backgroundColor: colors.panel, borderWidth: 1.5, borderColor: GOLD_BORDER,
          borderRadius: 14, padding: 18, overflow: 'hidden',
        }}>
          {/* গোল্ডেন ক্যান্ডেলস্টিক ওয়াটারমার্ক */}
          <CandlestickBackground height={110} opacity={0.85} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, zIndex: 1 }}>
            {/* গোল্ডেন গ্লো সহ অ্যাভাটার */}
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              {/* Outer glow ring */}
              <View style={{
                position: 'absolute',
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: GOLD_GLOW_1,
                borderWidth: 1, borderColor: 'rgba(212,168,60,0.15)',
              }} />
              {/* Middle glow ring */}
              <View style={{
                position: 'absolute',
                width: 70, height: 70, borderRadius: 35,
                backgroundColor: GOLD_GLOW_2,
                borderWidth: 1, borderColor: 'rgba(212,168,60,0.28)',
              }} />
              {/* Inner glow ring */}
              <View style={{
                position: 'absolute',
                width: 62, height: 62, borderRadius: 31,
                backgroundColor: 'transparent',
                borderWidth: 2, borderColor: GOLD_GLOW_3,
              }} />
              {/* Sparkle corners (4 ছোট গোল্ড ডট) */}
              {[
                { top: 0, right: 6 },
                { bottom: 4, left: 2 },
                { top: 8, left: 0 },
                { bottom: 2, right: 2 },
              ].map((pos, i) => (
                <View key={i} style={{
                  position: 'absolute', ...pos,
                  width: 4, height: 4, borderRadius: 2,
                  backgroundColor: GOLD,
                  opacity: 0.7,
                }} />
              ))}
              {avatar ? (
                <Image
                  source={{ uri: avatar }}
                  style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: GOLD }}
                />
              ) : (
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: colors.accent,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: GOLD,
                }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>{initial}</Text>
                </View>
              )}
              {pickerLoading && (
                <View style={{
                  position: 'absolute', width: 56, height: 56, borderRadius: 28,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
            </View>

            {/* Name + email + active account */}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{profileName}</Text>
              {email ? (
                <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>{email}</Text>
              ) : (
                <Text style={{ fontSize: 12, color: colors.textMuted }}>{t('tradingMember')}</Text>
              )}
              {/* Active account badge */}
              <TouchableOpacity
                onPress={() => setAccountModalVisible(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
                  marginTop: 4, gap: 4, paddingHorizontal: 8, paddingVertical: 3,
                  backgroundColor: GOLD_DIM, borderWidth: 1, borderColor: GOLD_BORDER, borderRadius: 10,
                }}
              >
                <Wallet size={10} color={GOLD} />
                <Text style={{ fontSize: 10, color: GOLD, fontWeight: '700' }}>
                  {activeAccount ? activeAccount.name : t('account')}
                </Text>
                <ArrowRightLeft size={10} color={GOLD} />
              </TouchableOpacity>
            </View>

            {/* Edit button — গোল্ড বর্ডার */}
            <AnimatedPressable
              onPress={() => { setNameInput(profileName); setEditModalVisible(true); }}
              style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: GOLD_DIM, borderWidth: 1.5, borderColor: GOLD_BORDER,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Edit2 size={14} color={GOLD} />
            </AnimatedPressable>
          </View>
        </Animated.View>

        {/* ── হাই-ইম্প্যাক্ট ইকোনমিক ইভেন্টস (Feature Tiles-এর জায়গায়) ── */}
        <Animated.View entering={FadeInUp.delay(80).duration(400).springify()} style={{
          marginHorizontal: 16, marginBottom: 20,
          backgroundColor: colors.panel, borderWidth: 1.5, borderColor: GOLD_BORDER,
          borderRadius: 14, padding: 16, overflow: 'hidden',
        }}>
          <CandlestickBackground height={210} opacity={0.65} />
          {/* প্যানেল হেডার */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, zIndex: 1 }}>
            <Zap size={15} color={colors.danger} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 }}>
              {t('highImpactEvents')}
            </Text>
          </View>
          {/* ফিক্সড হাইট স্ক্রোলেবল ইভেন্ট লিস্ট — ~3টা ইভেন্ট দেখায়, বাকিগুলো স্ক্রোল করে দেখা যায় */}
          <ScrollView
            style={{ maxHeight: 210, zIndex: 1 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {events.map((event) => {
              const diff = event.targetTime - now;
              const isUrgent = diff < 3600000;
              const isVeryUrgent = diff < 300000;
              const timerBg = isVeryUrgent ? colors.dangerDim : isUrgent ? colors.warningDim : 'rgba(88,166,255,0.08)';
              const timerColor = isVeryUrgent ? colors.danger : isUrgent ? colors.warning : colors.label;
              const flag = CURRENCY_FLAGS[event.currency] || '🌐';
              return (
                <View
                  key={event.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 16 }}>{flag}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{event.currency}</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>—</Text>
                      <Text style={{ fontSize: 12, color: colors.text, flex: 1 }} numberOfLines={1}>{event.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={10} color={colors.danger} />
                      <Text style={{ fontSize: 10, color: colors.danger, fontWeight: '700' }}>HIGH IMPACT</Text>
                    </View>
                  </View>
                  <View style={{
                    backgroundColor: timerBg, borderRadius: 6,
                    paddingHorizontal: 10, paddingVertical: 5, minWidth: 90, alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 11, color: timerColor, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                      {formatCountdown(diff)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ── Menu List (গোল্ড বর্ডার + ক্যান্ডেলস্টিক) ── */}
        <Animated.View entering={FadeInUp.delay(200).duration(400).springify()} style={{
          marginHorizontal: 16,
          backgroundColor: colors.panel, borderWidth: 1.5, borderColor: GOLD_BORDER,
          borderRadius: 14, overflow: 'hidden',
        }}>
          {/* মেনু লিস্টের ক্যান্ডেলস্টিক ওয়াটারমার্ক */}
          <CandlestickBackground height={220} opacity={0.6} />

          {/* Rate us */}
          <AnimatedPressable style={rowStyle} onPress={() => {}}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: GOLD_DIM, borderWidth: 1, borderColor: GOLD_BORDER, alignItems: 'center', justifyContent: 'center' }}>
              <Star size={18} color={GOLD} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' }}>{t('rateUs')}</Text>
          </AnimatedPressable>

          <View style={divider} />

          {/* Help Center */}
          <AnimatedPressable style={rowStyle} onPress={() => {}}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: GOLD_DIM, borderWidth: 1, borderColor: GOLD_BORDER, alignItems: 'center', justifyContent: 'center' }}>
              <HelpCircle size={18} color={GOLD} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' }}>{t('helpCenter')}</Text>
          </AnimatedPressable>

          <View style={divider} />

          {/* About */}
          <AnimatedPressable style={rowStyle} onPress={() => router.push('/about')}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: GOLD_DIM, borderWidth: 1, borderColor: GOLD_BORDER, alignItems: 'center', justifyContent: 'center' }}>
              <Info size={18} color={GOLD} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' }}>{t('about')}</Text>
            <ChevronRight size={16} color={GOLD_BORDER} />
          </AnimatedPressable>

          <View style={divider} />

          {/* My Accounts */}
          <AnimatedPressable style={rowStyle} onPress={() => setAccountModalVisible(true)}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: GOLD_DIM, borderWidth: 1, borderColor: GOLD_BORDER, alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={18} color={GOLD} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' }}>{t('myAccounts')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>{accounts.length}</Text>
              <ChevronRight size={16} color={GOLD_BORDER} />
            </View>
          </AnimatedPressable>

          <View style={divider} />

          {/* Sign Out */}
          <AnimatedPressable
            style={rowStyle}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              {loggingOut
                ? <ActivityIndicator size="small" color={colors.danger} />
                : <LogOut size={18} color={colors.danger} />
              }
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.danger }}>
              {loggingOut ? t('signingOut') : t('signOut')}
            </Text>
          </AnimatedPressable>
        </Animated.View>

        {/* App badge */}
        <View style={{ alignItems: 'center', marginTop: 28, gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textMuted, letterSpacing: 2 }}>
            TRADESTAMP
          </Text>
          <Text style={{ fontSize: 10, color: colors.border }}>{t('appVersion')}</Text>
        </View>

      </ScrollView>

      {/* ═══════════════════════════════════════════
           Edit Profile Modal
      ═══════════════════════════════════════════ */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{
            backgroundColor: colors.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingTop: 20, paddingBottom: 44, paddingHorizontal: 20, gap: 16,
          }}>
            {/* Title row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{t('editProfile')}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Avatar pickers */}
            <View style={{ alignItems: 'center', gap: 14 }}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.accent }} />
              ) : (
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>{initial}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[{ label: t('camera'), cam: true }, { label: t('gallery'), cam: false }].map(({ label, cam }) => (
                  <TouchableOpacity
                    key={label}
                    onPress={() => handlePickImage(cam)}
                    disabled={pickerLoading}
                    style={{
                      paddingVertical: 8, paddingHorizontal: 18,
                      backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 20,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {permissionDenied && (
                <Text style={{ fontSize: 12, color: colors.danger, textAlign: 'center' }}>{t('permissionDenied')}</Text>
              )}
            </View>

            {/* Name input */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('profile')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TextInput
                  style={{
                    flex: 1, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
                    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
                    color: colors.text, fontSize: 15,
                  }}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  maxLength={30}
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity
                  onPress={handleSaveName}
                  style={{ backgroundColor: colors.accent, borderRadius: 8, padding: 10 }}
                >
                  <Check size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
           Settings Modal
      ═══════════════════════════════════════════ */}
      <Modal visible={settingsVisible} transparent animationType="slide" onRequestClose={() => setSettingsVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{
            backgroundColor: colors.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingTop: 20, paddingBottom: 44,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 6 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{t('settingsTitle')}</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* ── Theme ── */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme === 'dark' ? colors.accentDim : 'rgba(251,191,36,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  {theme === 'dark' ? <Moon size={18} color={colors.accent} /> : <Sun size={18} color="#f59e0b" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                    {theme === 'dark' ? t('darkMode') : t('lightMode')}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    {theme === 'dark' ? t('darkModeDesc') : t('lightModeDesc')}
                  </Text>
                </View>
                <Switch
                  value={theme === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>
              <View style={divider} />

              {/* ── Keep Screen On ── */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Monitor size={18} color={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('keepScreenOn')}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>{t('keepScreenOnDesc')}</Text>
                </View>
                <Switch
                  value={keepScreenOn}
                  onValueChange={toggleKeepScreen}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>
              <View style={divider} />

              {/* ── Push Notifications ── */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Bell size={18} color={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('pushNotifications')}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>{t('pushNotificationsDesc')}</Text>
                </View>
                <Switch
                  value={pushEnabled}
                  onValueChange={togglePushNotif}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>
              <View style={divider} />

              {/* ── Language ── */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 }}
                onPress={() => setLangPickerVisible(true)}
                activeOpacity={0.8}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Globe size={18} color={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('language')}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>{LANGUAGE_NAMES[lang]}</Text>
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={divider} />

              {/* ── Contact Information ── */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 }}
                activeOpacity={0.8}
                onPress={() => {}}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={18} color={colors.textMuted} />
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text }}>{t('contactInfo')}</Text>
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={divider} />

              {/* ── Delete Account ── */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 }}
                onPress={() => setDeleteConfirmVisible(true)}
                activeOpacity={0.8}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <UserMinus size={18} color={colors.danger} />
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.danger }}>{t('deleteAccount')}</Text>
                <ChevronRight size={16} color={colors.danger} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
           Language Picker Modal
      ═══════════════════════════════════════════ */}
      <Modal visible={langPickerVisible} transparent animationType="slide" onRequestClose={() => setLangPickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{
            backgroundColor: colors.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingTop: 20, paddingBottom: 44, paddingHorizontal: 20,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{t('selectLanguage')}</Text>
              <TouchableOpacity onPress={() => setLangPickerVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {(Object.keys(LANGUAGE_NAMES) as LangCode[]).map((code) => {
              const isSelected = lang === code;
              return (
                <TouchableOpacity
                  key={code}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  onPress={() => { setLang(code); setLangPickerVisible(false); }}
                >
                  <Text style={{ fontSize: 15, color: isSelected ? colors.accent : colors.text, fontWeight: isSelected ? '700' : '400' }}>
                    {LANGUAGE_NAMES[code]}
                  </Text>
                  {isSelected && <Check size={18} color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
           Delete Account Confirmation
      ═══════════════════════════════════════════ */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade" onRequestClose={() => setDeleteConfirmVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 24 }}>
          <View style={{
            backgroundColor: colors.panel, borderRadius: 16, padding: 24, width: '100%',
            borderWidth: 1, borderColor: colors.border, gap: 16,
          }}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <UserMinus size={24} color={colors.danger} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
                {t('deleteAccountConfirm')}
              </Text>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
                  {t('deleteGracePeriod')}
                </Text>
                <Text style={{ fontSize: 13, color: colors.danger, textAlign: 'center', lineHeight: 20, fontWeight: '600' }}>
                  {t('deleteGraceDate').replace('{date}', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString())}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
                  {t('deleteGracePeriodDesc')}
                </Text>
              </View>
            </View>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={handleDeleteAccount}
                disabled={deleting}
                style={{
                  backgroundColor: colors.danger, borderRadius: 10,
                  paddingVertical: 13, alignItems: 'center',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('deleteAccountConfirmBtn')}</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDeleteConfirmVisible(false)}
                style={{
                  backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
                  borderRadius: 10, paddingVertical: 13, alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
           Account List Modal
      ═══════════════════════════════════════════ */}
      <Modal visible={accountModalVisible} transparent animationType="slide" onRequestClose={() => setAccountModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{
            backgroundColor: colors.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingTop: 20, paddingBottom: 44, paddingHorizontal: 20,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{t('myAccounts')}</Text>
              <TouchableOpacity onPress={() => setAccountModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {accounts.length === 0 && (
                <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 }}>
                  {t('noAccounts')}
                </Text>
              )}
              {accounts.map((acc) => {
                const isActive = acc.id === activeAccountId;
                const typeLabel = acc.type === 'personal' ? t('personal') : acc.type === 'prop_firm' ? t('propFirm') : t('demo');
                const TypeIcon = acc.type === 'personal' ? UserCircle : acc.type === 'prop_firm' ? Building2 : Wallet;
                const tradeCount = accountTradeCounts[acc.id] ?? 0;
                return (
                  <View
                    key={acc.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{
                      width: 40, height: 40, borderRadius: 10,
                      backgroundColor: isActive ? GOLD_DIM : colors.inputBg,
                      borderWidth: 1, borderColor: isActive ? GOLD_BORDER : colors.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <TypeIcon size={18} color={isActive ? GOLD : colors.textMuted} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{acc.name}</Text>
                        {isActive && (
                          <View style={{
                            paddingHorizontal: 6, paddingVertical: 2,
                            backgroundColor: colors.accentDim, borderRadius: 4,
                          }}>
                            <Text style={{ fontSize: 9, color: colors.accent, fontWeight: '700' }}>{t('active')}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        {typeLabel} · {tradeCount} {t('tradeCount')}
                      </Text>
                    </View>
                    {!isActive && (
                      <TouchableOpacity
                        onPress={() => { switchAccount(acc.id); setAccountModalVisible(false); }}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 6,
                          backgroundColor: colors.accentDim, borderRadius: 8,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>{t('switchAccount')}</Text>
                      </TouchableOpacity>
                    )}
                    {accounts.length > 1 && (
                      <TouchableOpacity
                        onPress={() => setAccountToDelete(acc.id)}
                        style={{ marginLeft: 8, padding: 6 }}
                      >
                        <Trash2 size={16} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => { setNewAccountName(''); setNewAccountType('personal'); setAddAccountVisible(true); }}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                marginTop: 16, paddingVertical: 12, gap: 8,
                backgroundColor: colors.accentDim, borderRadius: 12,
                borderWidth: 1, borderColor: 'rgba(0,180,90,0.25)',
              }}
            >
              <Plus size={18} color={colors.accent} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent }}>{t('addAccount')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
           Add Account Modal
      ═══════════════════════════════════════════ */}
      <Modal visible={addAccountVisible} transparent animationType="slide" onRequestClose={() => setAddAccountVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{
            backgroundColor: colors.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingTop: 20, paddingBottom: 44, paddingHorizontal: 20, gap: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{t('addAccount')}</Text>
              <TouchableOpacity onPress={() => setAddAccountVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Account name */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('accountName')}
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
                  borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                  color: colors.text, fontSize: 15,
                }}
                value={newAccountName}
                onChangeText={setNewAccountName}
                placeholder={t('accountName')}
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
            </View>

            {/* Account type */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('accountType')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['personal', 'prop_firm', 'demo'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setNewAccountType(type)}
                    style={{
                      flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10,
                      backgroundColor: newAccountType === type ? colors.accentDim : colors.inputBg,
                      borderWidth: 1, borderColor: newAccountType === type ? colors.accent : colors.border,
                    }}
                  >
                    <Text style={{
                      fontSize: 13, fontWeight: newAccountType === type ? '700' : '500',
                      color: newAccountType === type ? colors.accent : colors.textMuted,
                    }}>
                      {type === 'personal' ? t('personal') : type === 'prop_firm' ? t('propFirm') : t('demo')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              onPress={async () => {
                if (newAccountName.trim()) {
                  await addAccount(newAccountName.trim(), newAccountType);
                  setAddAccountVisible(false);
                  setAccountModalVisible(false);
                }
              }}
              disabled={!newAccountName.trim()}
              style={{
                backgroundColor: newAccountName.trim() ? colors.accent : colors.border,
                borderRadius: 12, paddingVertical: 14, alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('createTradingAccount')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
           Delete Account Data Confirmation
      ═══════════════════════════════════════════ */}
      <Modal visible={!!accountToDelete} transparent animationType="fade" onRequestClose={() => setAccountToDelete(null)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 24 }}>
          <View style={{
            backgroundColor: colors.panel, borderRadius: 16, padding: 24, width: '100%',
            borderWidth: 1, borderColor: colors.border, gap: 16,
          }}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={24} color={colors.danger} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
                {t('deleteAccountData')}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
                {t('confirmDeleteAccountData')}
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={async () => {
                  if (accountToDelete) {
                    await deleteAccount(accountToDelete);
                    setAccountToDelete(null);
                  }
                }}
                style={{
                  backgroundColor: colors.danger, borderRadius: 10,
                  paddingVertical: 13, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('deleteAccountData')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAccountToDelete(null)}
                style={{
                  backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
                  borderRadius: 10, paddingVertical: 13, alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
