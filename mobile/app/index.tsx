import { Redirect } from 'expo-router';
import { useGameStore } from '../src/store/gameStore';

/** Entry — redirect to tabs if authenticated, otherwise to auth flow. */
export default function Root() {
  const token = useGameStore((s) => s.token);
  return <Redirect href={token ? '/(tabs)' : '/(auth)/login'} />;
}
