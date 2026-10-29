const loadModule = module.require.bind(module)

const { getDefaultConfig } = loadModule('expo/metro-config')

const { withNativewind } = loadModule('nativewind/metro')

const config = getDefaultConfig(__dirname)

const configModule = module

configModule.exports = withNativewind(config, { globalClassNamePolyfill: false })
