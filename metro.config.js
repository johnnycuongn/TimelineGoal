// Extends Expo's default Metro config to bundle 3D model assets (.glb) —
// used by the experimental 3D pup in the Den (see src/features/bulldog/pug3d).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb');

module.exports = config;
