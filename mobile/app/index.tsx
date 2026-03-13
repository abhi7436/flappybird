import { Redirect } from 'expo-router';
import { useGameStore } from '../src/store/gameStore';
import { getLaunchRoute } from '../src/config/appMode';

/** Entry — redirect to tabs if authenticated, otherwise to auth flow. */
export default function Root() {
  const token = useGameStore((s) => s.token);
  return <Redirect href={getLaunchRoute(token)} />;
}
