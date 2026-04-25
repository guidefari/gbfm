/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'gbfm',
      removal: input?.stage === 'prod' ? 'retain' : 'remove',
      home: 'aws',
      providers: {
        cloudflare: '6.13.0',
        aws: {
          region: 'us-east-1'
        }
      }
    }
  },
  async run() {
    sst.Linkable.wrap(cloudflare.Record, (record) => ({
      properties: {
        url: $interpolate`https://${record.name}`
      }
    }))

    const outputs = {}
    const { readdirSync } = await import('node:fs')
    for (const value of readdirSync('./infra/')) {
      const result = await import(`./infra/${value}`)
      if (result.outputs) Object.assign(outputs, result.outputs)
    }
    return outputs
  }
})
