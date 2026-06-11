import AsyncStorage from '@react-native-async-storage/async-storage';

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TRADE_DATA_KEY = 'tradingJournalData_v9';
const THEME_KEY = 'journal_theme_mode_v9';
const AVATAR_KEY = 'saved_journal_avatar_v7';
const PROFILE_NAME_KEY = 'journal_profile_name';
const DAILY_TARGET_VAL_KEY = 'daily_rr_target_val';
const DAILY_TARGET_DATE_KEY = 'daily_rr_target_last_date';

// ── Multi-Account Storage Keys ──
const ACCOUNTS_KEY = 'journal_accounts_v1';
const ACTIVE_ACCOUNT_KEY = 'journal_active_account_v1';
const MIGRATED_KEY = 'journal_account_migrated_v1';

export type AccountType = 'personal' | 'prop_firm' | 'demo';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  createdAt: string;
};

export type TradeEntry = {
  id: string;
  type: 'Trade' | 'Deposit' | 'Withdraw';
  date: string;
  time?: string;
  day: number;
  monthNum: number;
  year: number;
  sortTimestamp: number;
  chartLink?: string;
  // Trade-specific
  pair?: string;
  position?: 'Long' | 'Short';
  result?: 'Win' | 'Loss';
  rr?: number;
  displayValue?: string;
  lotSize?: number;
  entryPrice?: number;
  exitPrice?: number;
  stopLoss?: number;
  // Deposit/Withdraw
  amount?: number;
};

export type TradeData = {
  [month: string]: TradeEntry[];
};

const emptyTradeData = (): TradeData => {
  const data: TradeData = {};
  MONTHS.forEach((m) => { data[m] = []; });
  return data;
};

export async function loadTradeData(): Promise<TradeData> {
  try {
    const raw = await AsyncStorage.getItem(TRADE_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // ensure all months exist
      const result = emptyTradeData();
      MONTHS.forEach((m) => {
        result[m] = Array.isArray(parsed[m]) ? parsed[m] : [];
      });
      return result;
    }
  } catch (_) {}
  return emptyTradeData();
}

export async function saveTradeData(data: TradeData): Promise<void> {
  try {
    await AsyncStorage.setItem(TRADE_DATA_KEY, JSON.stringify(data));
  } catch (_) {}
}

export async function loadTheme(): Promise<'dark' | 'light'> {
  try {
    const v = await AsyncStorage.getItem(THEME_KEY);
    return (v as 'dark' | 'light') || 'dark';
  } catch (_) { return 'dark'; }
}

export async function saveTheme(theme: 'dark' | 'light'): Promise<void> {
  try { await AsyncStorage.setItem(THEME_KEY, theme); } catch (_) {}
}

export async function loadAvatar(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AVATAR_KEY);
  } catch (_) { return null; }
}

export async function saveAvatar(uri: string): Promise<void> {
  try {
    await AsyncStorage.setItem(AVATAR_KEY, uri);
  } catch (_) {}
}

export async function loadProfileName(): Promise<string> {
  try { return (await AsyncStorage.getItem(PROFILE_NAME_KEY)) || 'Trader'; } catch (_) { return 'Trader'; }
}

export async function saveProfileName(name: string): Promise<void> {
  try { await AsyncStorage.setItem(PROFILE_NAME_KEY, name); } catch (_) {}
}

export async function loadDailyTarget(): Promise<{ value: number; lastDate: string | null }> {
  try {
    const val = await AsyncStorage.getItem(DAILY_TARGET_VAL_KEY);
    const date = await AsyncStorage.getItem(DAILY_TARGET_DATE_KEY);
    return { value: val ? parseFloat(val) : 2, lastDate: date };
  } catch (_) { return { value: 2, lastDate: null }; }
}

export async function saveDailyTarget(value: number, date: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DAILY_TARGET_VAL_KEY, String(value));
    await AsyncStorage.setItem(DAILY_TARGET_DATE_KEY, date);
  } catch (_) {}
}

export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Account Management ──

export async function loadAccounts(): Promise<Account[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

export async function saveAccounts(accounts: Account[]): Promise<void> {
  try { await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); } catch (_) {}
}

export async function loadActiveAccountId(): Promise<string | null> {
  try { return await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY); } catch (_) { return null; }
}

export async function saveActiveAccountId(id: string | null): Promise<void> {
  try {
    if (id) await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
    else await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  } catch (_) {}
}

function accountTradeKey(accountId: string) {
  return `journal_trades_${accountId}`;
}

function accountProfileKey(accountId: string) {
  return `journal_profile_${accountId}`;
}

function accountDailyTargetKey(accountId: string) {
  return `journal_target_${accountId}`;
}

export async function loadTradeDataForAccount(accountId: string): Promise<TradeData> {
  try {
    const raw = await AsyncStorage.getItem(accountTradeKey(accountId));
    if (raw) {
      const parsed = JSON.parse(raw);
      const result = emptyTradeData();
      MONTHS.forEach((m) => {
        result[m] = Array.isArray(parsed[m]) ? parsed[m] : [];
      });
      return result;
    }
  } catch (_) {}
  return emptyTradeData();
}

export async function saveTradeDataForAccount(accountId: string, data: TradeData): Promise<void> {
  try { await AsyncStorage.setItem(accountTradeKey(accountId), JSON.stringify(data)); } catch (_) {}
}

export async function loadProfileForAccount(accountId: string): Promise<{ name: string; avatar: string | null }> {
  try {
    const raw = await AsyncStorage.getItem(accountProfileKey(accountId));
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { name: 'Trader', avatar: null };
}

export async function saveProfileForAccount(accountId: string, name: string, avatar: string | null): Promise<void> {
  try { await AsyncStorage.setItem(accountProfileKey(accountId), JSON.stringify({ name, avatar })); } catch (_) {}
}

export async function loadDailyTargetForAccount(accountId: string): Promise<{ value: number; lastDate: string | null }> {
  try {
    const raw = await AsyncStorage.getItem(accountDailyTargetKey(accountId));
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { value: 2, lastDate: null };
}

export async function saveDailyTargetForAccount(accountId: string, value: number, lastDate: string): Promise<void> {
  try { await AsyncStorage.setItem(accountDailyTargetKey(accountId), JSON.stringify({ value, lastDate })); } catch (_) {}
}

// Migrate legacy single-account data to multi-account format
export async function migrateToAccounts(): Promise<{ accounts: Account[]; activeId: string }> {
  const migrated = await AsyncStorage.getItem(MIGRATED_KEY);
  if (migrated === 'true') {
    const accounts = await loadAccounts();
    const activeId = await loadActiveAccountId();
    return { accounts, activeId: activeId ?? accounts[0]?.id ?? '' };
  }

  // Load legacy data
  const legacyTrades = await loadTradeData();
  const legacyName = await loadProfileName();
  const legacyAvatar = await loadAvatar();
  const legacyTarget = await loadDailyTarget();

  const defaultAccount: Account = {
    id: 'default_' + Date.now().toString(36),
    name: 'Default Account',
    type: 'personal',
    createdAt: new Date().toISOString(),
  };

  await saveAccounts([defaultAccount]);
  await saveActiveAccountId(defaultAccount.id);
  await saveTradeDataForAccount(defaultAccount.id, legacyTrades);
  await saveProfileForAccount(defaultAccount.id, legacyName, legacyAvatar);
  await saveDailyTargetForAccount(defaultAccount.id, legacyTarget.value, legacyTarget.lastDate ?? '');
  await AsyncStorage.setItem(MIGRATED_KEY, 'true');

  return { accounts: [defaultAccount], activeId: defaultAccount.id };
}

export async function deleteAccountData(accountId: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      accountTradeKey(accountId),
      accountProfileKey(accountId),
      accountDailyTargetKey(accountId),
    ]);
  } catch (_) {}
}

export async function getAccountTradeCount(accountId: string): Promise<number> {
  const data = await loadTradeDataForAccount(accountId);
  let count = 0;
  MONTHS.forEach((m) => { count += (data[m] || []).length; });
  return count;
}
