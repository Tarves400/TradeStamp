import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/client/supabase';
import {
  MONTHS,
  TradeData,
  TradeEntry,
  getTodayString,
  loadTheme,
  saveTheme,
  loadAccounts,
  saveAccounts,
  loadActiveAccountId,
  saveActiveAccountId,
  loadTradeDataForAccount,
  saveTradeDataForAccount,
  loadProfileForAccount,
  saveProfileForAccount,
  loadDailyTargetForAccount,
  saveDailyTargetForAccount,
  migrateToAccounts,
  deleteAccountData,
  getAccountTradeCount,
  type Account,
  type AccountType,
} from './storage';
import { uploadAvatar } from './avatarUpload';

// ---- Cloud Sync Helpers ----
type CloudRow = {
  trade_data: TradeData;
  profile_name: string;
  daily_target_value: number;
  daily_target_last_date: string | null;
  theme: 'dark' | 'light';
  avatar_url: string | null;
  active_account_id?: string | null;
  accounts?: Account[];
};

async function fetchCloudData(userId: string): Promise<CloudRow | null> {
  const { data } = await supabase
    .from('user_trade_data')
    .select('trade_data,profile_name,daily_target_value,daily_target_last_date,theme,avatar_url,active_account_id,accounts')
    .eq('user_id', userId)
    .maybeSingle();
  return data as CloudRow | null;
}

async function pushCloudData(userId: string, row: Partial<CloudRow>): Promise<void> {
  await supabase
    .from('user_trade_data')
    .upsert({ user_id: userId, ...row, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
}

// ---- Theme Colors ----
export const THEME_COLORS = {
  dark: {
    bg: '#0b0f19',
    panel: '#0f1629',
    border: '#1f2a3c',
    text: '#e5e7eb',
    textMuted: '#6b7280',
    accent: '#00b45a',
    accentDim: 'rgba(0,180,90,0.12)',
    danger: '#da3637',
    dangerDim: 'rgba(218,54,55,0.12)',
    warning: '#d29922',
    warningDim: 'rgba(210,153,34,0.12)',
    label: '#58a6ff',
    inputBg: '#0b0f19',
    tabBar: '#0f1629',
    tabBarBorder: '#1f2a3c',
  },
  light: {
    bg: '#f4f6f9',
    panel: '#ffffff',
    border: '#e1e4e8',
    text: '#1a1f2e',
    textMuted: '#586069',
    accent: '#2ea44f',
    accentDim: 'rgba(46,164,79,0.1)',
    danger: '#cb2431',
    dangerDim: 'rgba(203,36,49,0.1)',
    warning: '#b08800',
    warningDim: 'rgba(176,136,0,0.1)',
    label: '#0366d6',
    inputBg: '#fafbfc',
    tabBar: '#ffffff',
    tabBarBorder: '#e1e4e8',
  },
} as const;

export type ThemeMode = 'dark' | 'light';
export type Colors = (typeof THEME_COLORS)[ThemeMode];

// ---- Stats Computation ----
export type Stats = {
  runningBalance: number;
  totalDeposits: number;
  totalRR: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  chartPoints: number[];
  isDrawdown: boolean;
  maxDrawdown: number;
  profitFactor: number;
  riskRatio: number;
};

// Compute stats from a flat list of entries (used by period-based image export)
export function computeStatsForEntries(entries: TradeEntry[]): Stats {
  const sorted = [...entries].sort((a, b) => (a.sortTimestamp || 0) - (b.sortTimestamp || 0));

  let runningBalance = 0;
  let totalDeposits = 0;
  const chartPoints: number[] = [0];

  sorted.forEach((item) => {
    if (item.type === 'Deposit') {
      runningBalance += item.amount || 0;
      totalDeposits += item.amount || 0;
    } else if (item.type === 'Withdraw') {
      runningBalance -= item.amount || 0;
    } else if (item.type === 'Trade') {
      runningBalance += (parseFloat(String(item.rr)) || 0) * 10;
    }
    chartPoints.push(runningBalance);
  });

  let totalRR = 0;
  let totalTrades = 0;
  let wins = 0;
  let losses = 0;
  let totalWinRR = 0;
  let totalLossRR = 0;

  sorted.forEach((item) => {
    if (item.type === 'Trade') {
      totalTrades++;
      const rr = parseFloat(String(item.rr)) || 0;
      totalRR += rr;
      if (item.result === 'Win') {
        wins++;
        totalWinRR += rr;
      } else {
        losses++;
        totalLossRR += Math.abs(rr);
      }
    }
  });

  // Max drawdown = largest decline from peak balance
  let peak = 0;
  let maxDrawdown = 0;
  chartPoints.forEach((pt) => {
    if (pt > peak) peak = pt;
    const dd = peak - pt;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const avgWin = wins > 0 ? totalWinRR / wins : 0;
  const avgLoss = losses > 0 ? totalLossRR / losses : 0;
  const riskRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 0 : 0);
  const profitFactor = totalLossRR > 0 ? totalWinRR / totalLossRR : (totalWinRR > 0 ? 999 : 0);
  const isDrawdown = totalDeposits > 0 && runningBalance < totalDeposits * 0.9;

  return {
    runningBalance, totalDeposits, totalRR, totalTrades, wins, losses, winRate,
    avgWin, avgLoss, chartPoints, isDrawdown, maxDrawdown, profitFactor, riskRatio,
  };
}

export function computeStats(tradeData: TradeData, scope: 'all' | string): Stats {
  // Full history for balance/chart
  const fullHistory: TradeEntry[] = [];
  MONTHS.forEach((m) => {
    (tradeData[m] || []).forEach((e) => fullHistory.push(e));
  });
  fullHistory.sort((a, b) => (a.sortTimestamp || 0) - (b.sortTimestamp || 0));

  let runningBalance = 0;
  let totalDeposits = 0;
  const chartPoints: number[] = [0];

  fullHistory.forEach((item) => {
    if (item.type === 'Deposit') {
      runningBalance += item.amount || 0;
      totalDeposits += item.amount || 0;
    } else if (item.type === 'Withdraw') {
      runningBalance -= item.amount || 0;
    } else if (item.type === 'Trade') {
      runningBalance += (parseFloat(String(item.rr)) || 0) * 10;
    }
    chartPoints.push(runningBalance);
  });

  // Scoped list for stats
  const scopedList: TradeEntry[] = [];
  if (scope === 'all') {
    MONTHS.forEach((m) => (tradeData[m] || []).forEach((e) => scopedList.push(e)));
  } else {
    (tradeData[scope] || []).forEach((e) => scopedList.push(e));
  }
  scopedList.sort((a, b) => (a.sortTimestamp || 0) - (b.sortTimestamp || 0));

  let totalRR = 0;
  let totalTrades = 0;
  let wins = 0;
  let losses = 0;
  let totalWinRR = 0;
  let totalLossRR = 0;

  scopedList.forEach((item) => {
    if (item.type === 'Trade') {
      totalTrades++;
      const rr = parseFloat(String(item.rr)) || 0;
      totalRR += rr;
      if (item.result === 'Win') {
        wins++;
        totalWinRR += rr;
      } else {
        losses++;
        totalLossRR += Math.abs(rr);
      }
    }
  });

  // Max drawdown = largest decline from peak balance
  let peak = 0;
  let maxDrawdown = 0;
  chartPoints.forEach((pt) => {
    if (pt > peak) peak = pt;
    const dd = peak - pt;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const avgWin = wins > 0 ? totalWinRR / wins : 0;
  const avgLoss = losses > 0 ? totalLossRR / losses : 0;
  const riskRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 0 : 0);
  const profitFactor = totalLossRR > 0 ? totalWinRR / totalLossRR : (totalWinRR > 0 ? 999 : 0);
  const isDrawdown = totalDeposits > 0 && runningBalance < totalDeposits * 0.9;

  return {
    runningBalance, totalDeposits, totalRR, totalTrades, wins, losses, winRate,
    avgWin, avgLoss, chartPoints, isDrawdown, maxDrawdown, profitFactor, riskRatio,
  };
}

// ---- Context ----
type TradeStoreContextType = {
  tradeData: TradeData;
  isLoaded: boolean;
  addEntry: (entry: TradeEntry) => Promise<void>;
  deleteEntry: (id: string, month: string) => Promise<void>;

  currentMonth: string;
  isAllTime: boolean;
  setCurrentMonth: (m: string) => void;
  setIsAllTime: (v: boolean) => void;

  theme: ThemeMode;
  colors: Colors;
  toggleTheme: () => Promise<void>;

  // Account management
  accounts: Account[];
  activeAccountId: string | null;
  activeAccount: Account | null;
  addAccount: (name: string, type: AccountType) => Promise<void>;
  switchAccount: (id: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  // Per-account profile
  avatar: string | null;
  setAvatarUri: (uri: string) => Promise<void>;
  profileName: string;
  setProfileNameVal: (name: string) => Promise<void>;
  dailyTargetValue: number;
  dailyTargetLastDate: string | null;
  saveDailyTargetVal: (value: number) => Promise<void>;
};

const TradeStoreContext = createContext<TradeStoreContextType | null>(null);

export function TradeStoreProvider({ children }: { children: React.ReactNode }) {
  const [tradeData, setTradeData] = useState<TradeData>({} as TradeData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return MONTHS[now.getMonth()];
  });
  const [isAllTime, setIsAllTime] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('Trader');
  const [dailyTargetValue, setDailyTargetValue] = useState(2);
  const [dailyTargetLastDate, setDailyTargetLastDate] = useState<string | null>(null);

  // Multi-account state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  // Track current user for cloud sync
  const [userId, setUserId] = useState<string | null>(null);
  // Ref to prevent duplicate cloud loads (auth listener fires on startup too)
  const cloudLoadedFor = useRef<string | null>(null);

  // Helper: load all data for an active account
  const loadAccountData = useCallback(async (accountId: string) => {
    const [td, prof, dt] = await Promise.all([
      loadTradeDataForAccount(accountId),
      loadProfileForAccount(accountId),
      loadDailyTargetForAccount(accountId),
    ]);
    setTradeData(td);
    setProfileName(prof.name);
    setAvatar(prof.avatar);
    setDailyTargetValue(dt.value);
    setDailyTargetLastDate(dt.lastDate);
  }, []);

  // Initial load: migrate if needed, then load accounts + active account data
  useEffect(() => {
    (async () => {
      const t = await loadTheme();
      setTheme(t);

      // Migrate legacy single-account data to multi-account
      const { accounts: migratedAccounts, activeId } = await migrateToAccounts();
      setAccounts(migratedAccounts);
      setActiveAccountId(activeId);

      if (activeId) {
        await loadAccountData(activeId);
      }

      // Try to get current session for cloud sync
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        cloudLoadedFor.current = session.user.id;
        await loadFromCloud(session.user.id, activeId);
      }
      setIsLoaded(true);
    })();
  }, [loadAccountData]);

  // Listen for auth state changes: login → load cloud, logout → clear local
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        if (cloudLoadedFor.current === session.user.id) return;
        setUserId(session.user.id);
        cloudLoadedFor.current = session.user.id;
        setIsLoaded(false);
        await loadFromCloud(session.user.id, activeAccountId);
        setIsLoaded(true);
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
        cloudLoadedFor.current = null;
        // Reset to default account data (don't clear accounts, just reload first)
        const accs = await loadAccounts();
        const actId = await loadActiveAccountId();
        setAccounts(accs);
        setActiveAccountId(actId);
        if (actId) await loadAccountData(actId);
      }
    });
    return () => subscription.unsubscribe();
  }, [activeAccountId, loadAccountData]);

  const loadFromCloud = async (uid: string, currentActiveId: string | null) => {
    const cloud = await fetchCloudData(uid);
    if (cloud) {
      const cloudAccs = cloud.accounts && cloud.accounts.length > 0 ? cloud.accounts : await loadAccounts();
      setAccounts(cloudAccs);
      await saveAccounts(cloudAccs);

      const cloudActive = cloud.active_account_id ?? currentActiveId ?? cloudAccs[0]?.id ?? null;
      if (cloudActive) {
        setActiveAccountId(cloudActive);
        await saveActiveAccountId(cloudActive);
      }

      const activeId = cloudActive || currentActiveId;
      if (activeId && cloud.trade_data) {
        const merged: TradeData = {} as TradeData;
        MONTHS.forEach((m) => {
          merged[m] = Array.isArray(cloud.trade_data?.[m]) ? cloud.trade_data[m] : [];
        });
        setTradeData(merged);
        await saveTradeDataForAccount(activeId, merged);

        setProfileName(cloud.profile_name || 'Trader');
        await saveProfileForAccount(activeId, cloud.profile_name || 'Trader', cloud.avatar_url || null);

        setDailyTargetValue(cloud.daily_target_value ?? 2);
        setDailyTargetLastDate(cloud.daily_target_last_date ?? null);
        await saveDailyTargetForAccount(activeId, cloud.daily_target_value ?? 2, cloud.daily_target_last_date ?? '');

        if (cloud.avatar_url) setAvatar(cloud.avatar_url);
      }

      const th = (cloud.theme === 'light' || cloud.theme === 'dark') ? cloud.theme : 'dark';
      setTheme(th);
      await saveTheme(th);
    }
  };

  const addEntry = useCallback(async (entry: TradeEntry) => {
    setTradeData((prev) => {
      const updated = { ...prev };
      const targetMonth = MONTHS[entry.monthNum - 1];
      const list = [...(updated[targetMonth] || []), entry];
      list.sort((a, b) => (a.sortTimestamp || 0) - (b.sortTimestamp || 0));
      updated[targetMonth] = list;
      if (activeAccountId) {
        saveTradeDataForAccount(activeAccountId, updated);
        // Sync to cloud (fire and forget)
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) pushCloudData(session.user.id, { trade_data: updated });
        });
      }
      return updated;
    });
  }, [activeAccountId]);

  const deleteEntry = useCallback(async (id: string, month: string) => {
    setTradeData((prev) => {
      const updated = { ...prev };
      updated[month] = (updated[month] || []).filter((e) => e.id !== id);
      if (activeAccountId) {
        saveTradeDataForAccount(activeAccountId, updated);
        // Sync to cloud (fire and forget)
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) pushCloudData(session.user.id, { trade_data: updated });
        });
      }
      return updated;
    });
  }, [activeAccountId]);

  const addAccount = useCallback(async (name: string, type: AccountType) => {
    const newAccount: Account = {
      id: 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      name: name.trim() || 'New Account',
      type,
      createdAt: new Date().toISOString(),
    };
    const updated = [...accounts, newAccount];
    setAccounts(updated);
    await saveAccounts(updated);

    // Switch to new account
    setActiveAccountId(newAccount.id);
    await saveActiveAccountId(newAccount.id);
    setTradeData({} as TradeData);
    const empty = {} as TradeData;
    MONTHS.forEach((m) => { (empty as Record<string, TradeEntry[]>)[m] = []; });
    setTradeData(empty);
    await saveTradeDataForAccount(newAccount.id, empty);
    setProfileName('Trader');
    await saveProfileForAccount(newAccount.id, 'Trader', null);
    setAvatar(null);
    setDailyTargetValue(2);
    setDailyTargetLastDate(null);
    await saveDailyTargetForAccount(newAccount.id, 2, '');

    // Sync to cloud
    if (userId) {
      pushCloudData(userId, { accounts: updated, active_account_id: newAccount.id });
    }
  }, [accounts, userId]);

  const switchAccount = useCallback(async (id: string) => {
    if (id === activeAccountId) return;
    setIsLoaded(false);
    setActiveAccountId(id);
    await saveActiveAccountId(id);
    await loadAccountData(id);
    setIsLoaded(true);
    if (userId) pushCloudData(userId, { active_account_id: id });
  }, [activeAccountId, loadAccountData, userId]);

  const deleteAccount = useCallback(async (id: string) => {
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);
    await saveAccounts(updated);
    await deleteAccountData(id);

    if (activeAccountId === id) {
      const fallbackId = updated[0]?.id ?? null;
      setActiveAccountId(fallbackId);
      await saveActiveAccountId(fallbackId);
      if (fallbackId) {
        setIsLoaded(false);
        await loadAccountData(fallbackId);
        setIsLoaded(true);
      } else {
        // No accounts left — create a default
        await addAccount('Default Account', 'personal');
      }
    }

    if (userId) pushCloudData(userId, { accounts: updated });
  }, [accounts, activeAccountId, loadAccountData, userId, addAccount]);

  const toggleTheme = useCallback(async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    await saveTheme(newTheme);
    if (userId) pushCloudData(userId, { theme: newTheme });
  }, [theme, userId]);

  const setAvatarUri = useCallback(async (uri: string) => {
    setAvatar(uri);
    if (activeAccountId) {
      await saveProfileForAccount(activeAccountId, profileName, uri);
    }
    if (userId) {
      try {
        const publicUrl = await uploadAvatar(uri, userId);
        setAvatar(publicUrl);
        if (activeAccountId) {
          await saveProfileForAccount(activeAccountId, profileName, publicUrl);
        }
        await pushCloudData(userId, { avatar_url: publicUrl });
      } catch {
        // Keep local uri if upload fails
      }
    }
  }, [activeAccountId, profileName, userId]);

  const setProfileNameVal = useCallback(async (name: string) => {
    setProfileName(name);
    if (activeAccountId) {
      await saveProfileForAccount(activeAccountId, name, avatar);
    }
    if (userId) pushCloudData(userId, { profile_name: name });
  }, [activeAccountId, avatar, userId]);

  const saveDailyTargetVal = useCallback(async (value: number) => {
    const today = getTodayString();
    setDailyTargetValue(value);
    setDailyTargetLastDate(today);
    if (activeAccountId) {
      await saveDailyTargetForAccount(activeAccountId, value, today);
    }
    if (userId) pushCloudData(userId, { daily_target_value: value, daily_target_last_date: today });
  }, [activeAccountId, userId]);

  const colors = THEME_COLORS[theme];
  const activeAccount = accounts.find((a) => a.id === activeAccountId) || null;

  return (
    <TradeStoreContext.Provider
      value={{
        tradeData,
        isLoaded,
        addEntry,
        deleteEntry,
        currentMonth,
        isAllTime,
        setCurrentMonth,
        setIsAllTime,
        theme,
        colors,
        toggleTheme,
        accounts,
        activeAccountId,
        activeAccount,
        addAccount,
        switchAccount,
        deleteAccount,
        avatar,
        setAvatarUri,
        profileName,
        setProfileNameVal,
        dailyTargetValue,
        dailyTargetLastDate,
        saveDailyTargetVal,
      }}
    >
      {children}
    </TradeStoreContext.Provider>
  );
}

export function useTradeStore() {
  const ctx = useContext(TradeStoreContext);
  if (!ctx) throw new Error('useTradeStore must be used within TradeStoreProvider');
  return ctx;
}
