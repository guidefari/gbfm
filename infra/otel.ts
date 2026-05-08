import * as hcloud from '@pulumi/hcloud'

const enabled = process.env.GBFM_ENABLE_OTEL_VPS === 'true'

function requiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required when GBFM_ENABLE_OTEL_VPS=true`)
  }

  return value
}

function envList(name: string, fallback: string[]) {
  const value = process.env[name]

  if (!value) {
    return fallback
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function createOtelVps() {
  const stage = process.env.GBFM_OTEL_STAGE ?? process.env.SST_STAGE ?? 'dev'
  const name = process.env.GBFM_OTEL_SERVER_NAME ?? `gbfm-${stage}-otel`
  const sshPublicKey = requiredEnv('GBFM_OTEL_SSH_PUBLIC_KEY')
  const sshSourceIps = envList('GBFM_OTEL_SSH_SOURCE_IPS', [
    '0.0.0.0/0',
    '::/0'
  ])
  const webSourceIps = ['0.0.0.0/0', '::/0']

  const sshKey = new hcloud.SshKey('OtelSshKey', {
    name: `${name}-ssh-key`,
    publicKey: sshPublicKey
  })

  const firewall = new hcloud.Firewall('OtelFirewall', {
    name: `${name}-firewall`,
    rules: [
      {
        direction: 'in',
        protocol: 'tcp',
        port: '22',
        sourceIps: sshSourceIps
      },
      {
        direction: 'in',
        protocol: 'tcp',
        port: '80',
        sourceIps: webSourceIps
      },
      {
        direction: 'in',
        protocol: 'tcp',
        port: '443',
        sourceIps: webSourceIps
      }
    ]
  })

  const server = new hcloud.Server('OtelServer', {
    name,
    image: process.env.GBFM_OTEL_SERVER_IMAGE ?? 'ubuntu-24.04',
    serverType: process.env.GBFM_OTEL_SERVER_TYPE ?? 'cx22',
    location: process.env.GBFM_OTEL_SERVER_LOCATION ?? 'ash',
    sshKeys: [sshKey.id],
    firewallIds: [firewall.id.apply((id) => Number(id))],
    userData: `#cloud-config
package_update: true
package_upgrade: true
packages:
  - docker.io
  - docker-compose-v2
runcmd:
  - systemctl enable --now docker
  - mkdir -p /opt/otel-stack
  - chmod 700 /opt/otel-stack
`
  })

  return {
    otel_vps_ipv4: server.ipv4Address,
    otel_vps_ipv6: server.ipv6Address,
    otel_vps_name: server.name
  }
}

export const outputs = enabled ? createOtelVps() : {}
