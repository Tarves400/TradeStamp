import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTradeStore } from '@/lib/tradeStore';

export default function AuthLayout() {
  const { colors, theme } = useTradeStore();
  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} backgroundColor={colors.bg} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="verify-email" />
      </Stack>
    </>
  );
}
