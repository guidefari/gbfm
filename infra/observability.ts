/**
 * OpenTelemetry Infrastructure
 *
 * This file sets up a vendor-neutral observability stack with:
 * - OpenTelemetry Collector running on ECS
 * - Service discovery for internal communication
 * - Support for multiple telemetry backends
 */

import { cluster, vpc } from './vps'
import { allSecrets } from './secret'

const isLocal = ['local', 'dev'].includes($app.stage)

/**
 * OpenTelemetry Collector Service
 *
 * Receives telemetry from all services and exports to configured backends.
 * Runs as a shared service that all other services can send data to.
 */
export const otelCollectorService = new sst.aws.Service('OTELCollector', {
  cluster,
  vpc,

  // Service discovery configuration
  serviceRegistry: {
    port: 4318, // HTTP OTLP endpoint
  },

  dev: {
    command: 'echo "OTEL Collector not running in dev mode"'
  },

  image: {
    // Use the contrib distribution which includes more exporters
    public: 'otel/opentelemetry-collector-contrib:0.96.0',
  },

  // Mount the configuration file
  volumes: [
    {
      host: {
        path: './otel-collector-config.yaml'
      },
      container: {
        path: '/etc/otel-collector-config.yaml'
      }
    }
  ],

  // Override the default command to use our config
  command: [
    '--config=/etc/otel-collector-config.yaml'
  ],

  // Environment variables for dynamic configuration
  environment: {
    DEPLOYMENT_ENVIRONMENT: $app.stage,
    AWS_REGION: aws.getRegionOutput().name,

    // Honeycomb configuration (optional)
    // HONEYCOMB_API_KEY: Will be set via secrets
    HONEYCOMB_DATASET: 'gbfm',

    // Add other backend configurations as needed
  },

  link: [
    ...allSecrets
  ],

  // Expose ports for different protocols
  ports: [
    {
      listen: '4317/tcp', // gRPC OTLP
      forward: '4317/tcp'
    },
    {
      listen: '4318/tcp', // HTTP OTLP
      forward: '4318/tcp'
    },
    {
      listen: '8889/tcp', // Prometheus metrics exporter
      forward: '8889/tcp'
    },
    {
      listen: '13133/tcp', // Health check
      forward: '13133/tcp'
    },
    {
      listen: '55679/tcp', // zpages (debugging)
      forward: '55679/tcp'
    }
  ],

  // Resource allocation
  cpu: '0.5 vCPU',
  memory: '1 GB',

  // Enable autoscaling based on CPU
  scaling: {
    min: isLocal ? 0 : 1,
    max: isLocal ? 0 : 3,
    cpuUtilization: 70
  },

  // Health check
  health: {
    timeout: '10 seconds',
    interval: '30 seconds',
    retries: 3,
    startPeriod: '60 seconds',
    command: [
      'CMD-SHELL',
      'wget --no-verbose --tries=1 --spider http://localhost:13133/ || exit 1'
    ]
  }
})

/**
 * Optional: Jaeger for local development and testing
 *
 * Provides a UI to visualize traces. You can access it at:
 * http://localhost:16686
 */
export const jaegerService = new sst.aws.Service('Jaeger', {
  cluster,
  vpc,

  dev: {
    command: 'echo "Jaeger not running in dev mode"'
  },

  image: {
    public: 'jaegertracing/all-in-one:1.54'
  },

  environment: {
    COLLECTOR_OTLP_ENABLED: 'true'
  },

  ports: [
    {
      listen: '16686/tcp', // Jaeger UI
      forward: '16686/tcp'
    },
    {
      listen: '4317/tcp', // OTLP gRPC receiver
      forward: '4317/tcp'
    },
    {
      listen: '4318/tcp', // OTLP HTTP receiver
      forward: '4318/tcp'
    }
  ],

  // Only run in dev/staging, not production
  scaling: {
    min: $app.stage === 'prod' ? 0 : 1,
    max: $app.stage === 'prod' ? 0 : 1
  }
})

/**
 * Optional: Prometheus for metrics collection
 *
 * Scrapes metrics from the OTEL Collector's Prometheus exporter.
 */
export const prometheusService = new sst.aws.Service('Prometheus', {
  cluster,
  vpc,

  dev: {
    command: 'echo "Prometheus not running in dev mode"'
  },

  image: {
    public: 'prom/prometheus:v2.49.1'
  },

  // Mount Prometheus configuration
  volumes: [
    {
      host: {
        path: './prometheus.yml'
      },
      container: {
        path: '/etc/prometheus/prometheus.yml'
      }
    }
  ],

  ports: [
    {
      listen: '9090/tcp',
      forward: '9090/tcp'
    }
  ],

  // Only run in dev/staging
  scaling: {
    min: $app.stage === 'prod' ? 0 : 1,
    max: $app.stage === 'prod' ? 0 : 1
  }
})

/**
 * Service Discovery Endpoint
 *
 * Other services can use this to send telemetry to the collector.
 * In your app, use: http://otel-collector.local:4318
 */
export const otelCollectorEndpoint = $interpolate`http://${otelCollectorService.service}:4318`

export const outputs = {
  otelCollectorEndpoint: otelCollectorEndpoint,
  jaegerUI: $app.stage !== 'prod' ? $interpolate`http://${jaegerService.service}:16686` : undefined,
  prometheusUI: $app.stage !== 'prod' ? $interpolate`http://${prometheusService.service}:9090` : undefined
}
