import {
  makeStaticSiteMetadata,
  renderDocumentHead,
  SiteMetadata,
  SITE_URL,
} from '@gbfm/site-metadata'
import { Effect, Option, Schema } from 'effect'
import * as Server from 'foldkit/experimental/server'
import template from 'virtual:gbfm-document'

import { applicationConfig } from '../config'
import type { Flags } from '../model'
import { Route } from '../route'
import { apiRequest } from './api'
import type { loadPageData } from './page-data'

type PageData = Extract<Awaited<ReturnType<typeof loadPageData>>, { readonly redirect: null }>

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

export const createPageResponse = async (
  request: Request,
  ownedRequest: Request,
  dataRequest: boolean,
  startedAt: number,
  page: PageData,
): Promise<Server.Responded> => {
  const {
    flags,
    identity,
    response,
    neighbourResponse,
    tweetData,
    showDetailSlug,
    showMetadata,
    profile,
    route,
    url,
    requestId,
  } = page

  const { status, title } = flags

  const headers = new Headers({
    'cache-control': 'private, no-store',
    'x-request-id': requestId,
    'server-timing': `foldkit;dur=${(performance.now() - startedAt).toFixed(1)}`,
  })

  for (const cookie of [
    ...identity.cookies,
    ...(response?.headers.getSetCookie() ?? []),
    ...(neighbourResponse?.headers.getSetCookie() ?? []),
  ])
    headers.append('set-cookie', cookie)

  const metadataKind = new Map([
    ['mixes', 'mix'],
    ['tracks', 'track'],
    ['shows', 'show'],
    ['tweets', 'tweet'],
    ['editorial', 'editorial'],
    ['releases', 'release'],
    ['labels', 'label'],
    ['profile', 'profile'],
  ])

  const kind = profile
    ? 'profile'
    : Route.guards.Detail(route)
      ? metadataKind.get(route.kind)
      : undefined

  const publicMetadata =
    showDetailSlug && response?.ok
      ? showMetadata
      : tweetData && status === 200
        ? await (tweetData.metadata?.ok
            ? tweetData.metadata
                .json()
                .then((value) => Option.getOrNull(Schema.decodeUnknownOption(SiteMetadata)(value)))
                .catch(() => null)
            : null)
        : kind && Route.guards.Detail(route) && status === 200
          ? await apiRequest(
              ownedRequest,
              `/api/site-metadata/${kind}/${encodeURIComponent(route.slug)}`,
              { method: 'GET' },
            )
              .then(async (response) =>
                response.ok
                  ? Option.getOrNull(
                      Schema.decodeUnknownOption(SiteMetadata)(await response.json()),
                    )
                  : null,
              )
              .catch(() => null)
          : null

  const sourceMetadata =
    publicMetadata ?? makeStaticSiteMetadata(title, flags.description, url.pathname)

  // Preview and dev origins must not become competing public canonical URLs.
  const metadata = {
    ...sourceMetadata,
    canonicalUrl: new URL(new URL(sourceMetadata.canonicalUrl).pathname, SITE_URL).href,
  }

  const readyFlags: Flags = { ...flags, metadata }

  if (dataRequest) return Server.Responded(Response.json(readyFlags, { status, headers }))

  const rendered = await Effect.runPromise(
    Server.renderToString(applicationConfig, {
      flags: readyFlags,
      url: url.href,
      buildId: import.meta.env.FOLDKIT_BUILD_ID,
    }),
  )

  const head = renderDocumentHead(metadata)

  const extraHead =
    `<link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}"><meta property="og:url" content="${escapeHtml(metadata.canonicalUrl)}">` +
    head.meta
      .flatMap((entry) =>
        'title' in entry || ('property' in entry && entry.property === 'og:url')
          ? []
          : [
              `<meta data-gbfm-metadata ${'name' in entry ? `name="${escapeHtml(entry.name)}"` : `property="${escapeHtml(entry.property)}"`} content="${escapeHtml(entry.content)}">`,
            ],
      )
      .join('') +
    head.scripts
      .map(
        (script) =>
          `<script data-gbfm-metadata type="application/ld+json">${script.children.replaceAll('<', '\\u003c')}</script>`,
      )
      .join('')

  const privatePage =
    Route.guards.Dashboard(route) ||
    Route.guards.Composer(route) ||
    Route.guards.Auth(route) ||
    url.pathname === '/spotify/callback'

  const html = Server.injectIntoTemplate(template, rendered).replace(
    '</head>',
    `${extraHead}${privatePage || status !== 200 ? '<meta data-gbfm-metadata name="robots" content="noindex, nofollow">' : ''}</head>`,
  )

  headers.set('content-type', 'text/html; charset=utf-8')

  return Server.Responded(
    new Response(request.method === 'HEAD' ? null : html, { status, headers }),
  )
}
