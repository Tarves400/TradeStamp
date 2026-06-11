import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, RefreshCw } from 'lucide-react-native';
import { supabase } from '@/client/supabase';
import { useTradeStore } from '@/lib/tradeStore';
import { useLang } from '@/lib/langContext';

export default function VerifyEmailScreen() {
  const { colors } = useTradeStore();
  const { t } = useLang();
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');

  const handleResend = async () => {
    setError('');
    setResending(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      const { error: e } = await supabase.auth.resend({
        type: 'signup',
        email: session.user.email,
      });
      if (e) setError(e.message);
      else setResent(true);
    }
    setResending(false);
  };

  const handleRefreshSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email_confirmed_at) {
      router.replace('/(tabs)');
    } else {
      setError(t('emailNotVerifiedYet'));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <View style={{
          width: 88, height: 88, borderRadius: 28,
          backgroundColor: 'rgba(88,166,255,0.12)',
          borderWidth: 1.5, borderColor: colors.label,
          alignItems: 'center', justifyContent: 'center', marginBottom: 28,
        }}>
          <Mail size={44} color={colors.label} />
        </View>

        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 12, textAlign: 'center' }}>
          {t('verifyEmail')}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
          {t('verifySubtitle')}
        </Text>

        <TouchableOpacity
          style={{
            backgroundColor: colors.accent, borderRadius: 10,
            paddingVertical: 13, paddingHorizontal: 32,
            flexDirection: 'row', alignItems: 'center', gap: 8,
            width: '100%', justifyContent: 'center', marginBottom: 12,
          }}
          onPress={handleRefreshSession}
        >
          <RefreshCw size={16} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
            {t('verifiedEnter')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            borderWidth: 1, borderColor: colors.border, borderRadius: 10,
            paddingVertical: 12, width: '100%', alignItems: 'center',
            opacity: resending ? 0.6 : 1,
          }}
          onPress={handleResend}
          disabled={resending}
        >
          {resending ? <ActivityIndicator color={colors.textMuted} size="small" /> : (
            <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>
              {resent ? t('resentSuccess') : t('resendEmail')}
            </Text>
          )}
        </TouchableOpacity>

        {!!error && (
          <Text style={{ fontSize: 12, color: colors.danger, marginTop: 12, textAlign: 'center' }}>
            {error}
          </Text>
        )}

        <TouchableOpacity
          style={{ marginTop: 24 }}
          onPress={() => router.replace('/(auth)/sign-in')}
        >
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {t('backToSignIn')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
