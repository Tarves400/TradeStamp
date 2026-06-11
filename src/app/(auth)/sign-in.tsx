import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, ScrollView,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, TrendingUp } from 'lucide-react-native';
import { supabase } from '@/client/supabase';
import { useTradeStore } from '@/lib/tradeStore';
import { useLang } from '@/lib/langContext';

export default function SignInScreen() {
  const { colors } = useTradeStore();
  const { t } = useLang();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const GRACE_DAYS = 3;
  const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

  const handleSignIn = async () => {
    setError('');
    if (!email.trim()) { setError(t('emailFieldRequired')); return; }
    if (!password) { setError(t('passwordFieldRequired')); return; }

    setLoading(true);
    const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setLoading(false);
      if (authError.message.includes('Email not confirmed')) {
        setError(t('emailNotConfirmed'));
      } else if (authError.message.includes('Invalid login credentials')) {
        setError(t('emailOrPasswordWrong'));
      } else {
        setError(authError.message);
      }
      return;
    }

    const userId = signInData?.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('deletion_requested_at')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.deletion_requested_at) {
        const requested = new Date(profile.deletion_requested_at).getTime();
        const now = Date.now();

        if (now - requested >= GRACE_MS) {
          // Grace period expired — permanently delete account
          try {
            await supabase.functions.invoke('delete-user-permanent', {
              body: { user_id: userId },
            });
          } catch {
            // Even if Edge Function fails, proceed with sign-out
          }
          await supabase.auth.signOut({ scope: 'global' });
          setLoading(false);
          setError(t('accountDeleted'));
          return;
        }

        // Within grace period — cancel deletion and allow login
        await supabase
          .from('profiles')
          .update({ deletion_requested_at: null })
          .eq('id', userId);
        setLoading(false);
        setError(t('deletionCancelled'));
        // Give user a moment to read the message, then proceed
        setTimeout(() => setError(''), 3000);
        return;
      }
    }

    setLoading(false);
  };

  const inputStyle = {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 15, flex: 1,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: 44 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 20,
              backgroundColor: colors.accentDim,
              borderWidth: 1.5, borderColor: colors.accent,
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <TrendingUp size={32} color={colors.accent} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: 1.5 }}>
              {t('appName')}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
              {t('signInSubtitle')}
            </Text>
          </View>

          <View style={{ gap: 14 }}>
            {/* Email */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                {t('emailAddress')}
              </Text>
              <TextInput
                style={inputStyle}
                placeholder={t('emailPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            {/* Password */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                {t('password')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={inputStyle}
                  placeholder={t('passwordPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={{ padding: 10, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
                </TouchableOpacity>
              </View>
            </View>

            {!!error && (
              <Text style={{ fontSize: 13, color: colors.danger, fontWeight: '500', textAlign: 'center' }}>
                {error}
              </Text>
            )}

            <TouchableOpacity
              style={{
                backgroundColor: colors.accent, borderRadius: 10,
                paddingVertical: 14, alignItems: 'center',
                opacity: loading ? 0.7 : 1, marginTop: 4,
              }}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 }}>
                  {t('signInButton')}
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('noAccount')}</Text>
              <Link href="/(auth)/sign-up">
                <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '700' }}>{t('signUpLink')}</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
