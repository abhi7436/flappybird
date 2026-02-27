const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// Workspace root — one level up from mobile/
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// ── Monorepo: watch the shared game-engine source ─────────────
config.watchFolders = [workspaceRoot];

// Tell Metro where to look for node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Allow @engine/* alias to resolve to ../src/game-engine/*
config.resolver.extraNodeModules = {
  '@engine': path.resolve(workspaceRoot, 'src/game-engine'),
};

module.exports = config;
