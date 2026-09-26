import { Runtime } from 'foldkit'

import { applicationConfig, clientResources, subscriptions } from './application'
import { startBrowserTelemetry } from './telemetry/browser'
// oxlint-disable-next-line import/no-unassigned-import -- Vite extracts the document stylesheet from this side-effect import.
import './styles/main.css'

const application = Runtime.makeApplication({
  ...applicationConfig,
  resources: clientResources,
  subscriptions,
  container: document.getElementById('root'),
})

Runtime.hydrate(application, { buildId: import.meta.env.FOLDKIT_BUILD_ID })

const stopTelemetry = startBrowserTelemetry({
  release: import.meta.env.PROD ? import.meta.env.FOLDKIT_BUILD_ID : 'local',
  navigation: {
    current: () => ({ pathname: location.pathname }),
    subscribe: ({ before, after }) => {
      const completed = () => after({ pathname: location.pathname })
      window.addEventListener('gbfm:navigation-start', before)
      window.addEventListener('gbfm:navigation-end', completed)

      return () => {
        window.removeEventListener('gbfm:navigation-start', before)
        window.removeEventListener('gbfm:navigation-end', completed)
      }
    },
  },
})

import.meta.hot?.dispose(stopTelemetry)
