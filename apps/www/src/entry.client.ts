import { Runtime } from 'foldkit'

import { applicationConfig, clientResources, subscriptions } from './application'
import { startArtworkFallback } from './artwork'
import { startSearchShortcuts } from './search'
import { startBrowserTelemetry } from './telemetry/browser'
import { startTheme } from './theme'
import { startTweetShortcuts } from './tweet-navigation'

const application = Runtime.makeApplication({
  ...applicationConfig,
  resources: clientResources,
  subscriptions,
  container: document.getElementById('root'),
  viewTransition: ({ previousModel, model }) => previousModel.flags.url !== model.flags.url,
})

const stopTheme = startTheme()

const stopArtwork = startArtworkFallback()

const stopSearchShortcuts = startSearchShortcuts()

const stopTweetShortcuts = startTweetShortcuts()

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

import.meta.hot?.dispose(stopTheme)

import.meta.hot?.dispose(stopSearchShortcuts)

import.meta.hot?.dispose(stopTweetShortcuts)

import.meta.hot?.dispose(stopArtwork)
