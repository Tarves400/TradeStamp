import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, ScrollView,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, TrendingUp } from 'lucide-react-native';
import { supabase } from '@/client/supabase';
import { useTradeStore } from '@/lib/tradeStore';
import { useLang } from '@/lib/langContext';

export default function SignUpScreen() {
  const { colors } = useTradeStore();
  const { t } = useLang();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    setError('');
    if (!email.trim()) { setError(t('emailRequired')); return; }
    if (!password || password.length < 8) { setError(t('passwordTooShort')); return; }
    if (password !== confirmPassword) { setError(t('passwordMismatch')); return; }
    if (!agreed) { setError(t('agreeRequired')); return; }

    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (authError) {
      if (authError.message.includes('already registered')) {
        setError(t('emailAlreadyRegistered'));
      } else {
        setError(authError.message);
      }
      return;
    }
    router.replace('/(auth)/verify-email');
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
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
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
              {t('signUpTitle')}
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

            {/* Confirm Password */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                {t('confirmPassword')}
              </Text>
              <TextInput
                style={inputStyle}
                placeholder={t('confirmPasswordPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />
            </View>

            {/* Agreement */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
              onPress={() => setAgreed((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={{
                width: 20, height: 20, borderRadius: 4, marginTop: 1,
                borderWidth: 1.5, borderColor: agreed ? colors.accent : colors.border,
                backgroundColor: agreed ? colors.accent : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {agreed && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text>}
              </View>
              <Text style={{ flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
                {t('agreeText')}{' '}
                <Text style={{ color: colors.accent, fontWeight: '600' }}>{t('termsOfUse')}</Text>
                {' '}{t('and')}{' '}
                <Text style={{ color: colors.accent, fontWeight: '600' }}>{t('privacyPolicy')}</Text>
              </Text>
            </TouchableOpacity>

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
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 }}>
                  {t('createAccount')}
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('alreadyHaveAccount')}</Text>
              <Link href="/(auth)/sign-in">
                <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '700' }}>{t('signInLink')}</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
