import { Layer } from 'effect'
import { Runtime } from 'foldkit'

import { applicationConfig } from './config'
import * as Creator from './page/creator'
import * as Dashboard from './page/dashboard'
import { startTweetShortcuts } from './page/tweet/navigation'
import * as Player from './player'
import { startSearchShortcuts } from './search'
import { SpotifyConnectionLive } from './spotify/connection'
import { subscriptions } from './subscription'
import { startBrowserTelemetry } from './telemetry/browser'
import { startTheme } from './theme'
import { displayedPath } from './update'
import { startArtworkFallback } from './view/artwork'

const clientResources = Layer.mergeAll(
  Player.playerClientLayer,
  Creator.CreatorServiceLive,
  Creator.CreatorUploadLive,
  Dashboard.DashboardServiceLive,
  Dashboard.SessionServiceLive,
  SpotifyConnectionLive,
)

const application = Runtime.makeApplication({
  ...applicationConfig,
  resources: clientResources,
  subscriptions,
  container: document.getElementById('root'),
  viewTransition: ({ previousModel, model }) =>
    displayedPath(previousModel) !== displayedPath(model),
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
