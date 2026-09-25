const loadModule = module.require.bind(module)

const { getDefaultConfig } = loadModule('expo/metro-config')

const { withNativeWind } = loadModule('nativewind/metro')

const config = getDefaultConfig(__dirname)

const configModule = module

configModule.exports = withNativeWind(config)
