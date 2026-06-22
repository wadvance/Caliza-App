const { getDefaultConfig } = require('@expo/metro-config')

const config = getDefaultConfig(__dirname)

const nativeOnlyModules = [
  'react-native-maps',
  'expo-camera',
  'expo-sqlite',
  'expo-file-system',
  'expo-location',
  'expo-sensors',
  'expo-haptics',
  'expo-sharing',
  'expo-print',
  'expo-status-bar',
  'react-native-screens',
  'react-native-gesture-handler',
  'react-native-reanimated',
]

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && nativeOnlyModules.includes(moduleName)) {
    return {
      type: 'empty',
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
