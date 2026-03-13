import { Redirect, Stack } from 'expo-router';
import { isSoloModeEnabled } from '../../src/config/appMode';

export default function AuthLayout() {
  if (isSoloModeEnabled()) {
    return <Redirect href="/solo" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#1a1a2e' },
      }}
    />
  );
}
