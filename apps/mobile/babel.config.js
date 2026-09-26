const configModule = module

configModule.exports = function (api) {
  api.cache(true)

  return {
    presets: ['babel-preset-expo'],
  }
}
