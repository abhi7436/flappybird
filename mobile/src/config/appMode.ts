export function isSoloModeEnabled() {
  return true;
  // return false;
}

export function getSoloLaunchRoute() {
  return '/solo';
}

export function getMultiplayerLaunchRoute(token: string | null) {
  return token ? '/(tabs)' : '/(auth)/login';
}

export function getLaunchRoute(token: string | null) {
  return getSoloLaunchRoute();
  // return getMultiplayerLaunchRoute(token);
}

export function getSoloHomeRoute() {
  return '/';
}

export function getMultiplayerHomeRoute(token: string | null) {
  return token ? '/(tabs)' : '/(auth)/login';
}

export function getHomeRoute(token: string | null) {
  return getSoloHomeRoute();
  // return getMultiplayerHomeRoute(token);
}

export function getSoloLogoutRoute() {
  return '/solo';
}

export function getMultiplayerLogoutRoute() {
  return '/(auth)/login';
}

export function getLogoutRoute() {
  return getSoloLogoutRoute();
  // return getMultiplayerLogoutRoute();
}