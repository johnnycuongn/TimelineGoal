// Extends Expo's default Metro config to bundle 3D model assets (.glb) —
// used by the experimental 3D pup in the Den (see src/features/bulldog/pup3d).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb');

// Force a SINGLE three.js instance. Without this, Metro's dual-package resolution
// can load both the ESM and CJS builds ("Multiple instances of Three.js" warning),
// which breaks instanceof checks and can corrupt rendering state.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return { type: 'sourceFile', filePath: require.resolve('three') };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
