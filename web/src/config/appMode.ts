import type { Screen } from '../types';

export function isSoloModeEnabled() {
  return true;
  // return false;
}

export function getSoloInitialScreen(): Screen {
  return 'solo';
}

export function getMultiplayerInitialScreen(hasUser: boolean): Screen {
  return hasUser ? 'menu' : 'auth';
}

export function getInitialScreen(hasUser: boolean): Screen {
  return getSoloInitialScreen();
  // return getMultiplayerInitialScreen(hasUser);
}

export function getSoloHomeScreen(): Screen {
  return 'solo';
}

export function getMultiplayerHomeScreen(hasUser: boolean): Screen {
  return hasUser ? 'menu' : 'auth';
}

export function getHomeScreen(hasUser: boolean): Screen {
  return getSoloHomeScreen();
  // return getMultiplayerHomeScreen(hasUser);
}

export function getSoloLogoutScreen(): Screen {
  return 'solo';
}

export function getMultiplayerLogoutScreen(): Screen {
  return 'auth';
}

export function getLogoutScreen(): Screen {
  return getSoloLogoutScreen();
  // return getMultiplayerLogoutScreen();
}

export function getAuthFailureScreen(): Screen {
  return getSoloHomeScreen();
  // return 'auth';
}