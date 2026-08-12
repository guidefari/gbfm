import * as Sentry from '@sentry/react'
import { Exit, Layer, Option, Predicate, Tracer } from 'effect'

const NANOS_PER_MILLI = 1_000_000n

const toMillis = (nanos: bigint) => Number(nanos / NANOS_PER_MILLI)

const randomHex = (bytes: number) => {
  const value = new Uint8Array(bytes)
  crypto.getRandomValues(value)
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Sentry attributes accept primitives only, so anything richer is stringified. */
const toSentryAttribute = (
  value: Parameters<Tracer.Span['attribute']>[1]
): string | number | boolean => {
  if (Predicate.isString(value) || Predicate.isNumber(value) || Predicate.isBoolean(value)) {
    return value
  }
  return String(value)
}

const failureAttributes = (exit: Exit.Exit<unknown, unknown>) => {
  if (exit._tag === 'Success') return undefined
  const error = Exit.isFailure(exit) ? exit.cause : undefined
  return error === undefined ? undefined : { 'effect.cause': String(error) }
}

/**
 * Bridges Effect spans into the Sentry tracer that main.tsx already installs,
 * so `Effect.fn` spans land in the same traces as the rest of the frontend
 * instead of needing a second telemetry pipeline.
 *
 * Sentry owns sampling and export; this only mirrors span lifecycle onto it.
 */
const makeSentryTracer = () =>
  Tracer.make({
    span(options) {
      const parent = Option.getOrUndefined(options.parent)
      const sentrySpan = Sentry.startInactiveSpan({
        name: options.name,
        onlyIfParent: false,
        forceTransaction: options.root,
        startTime: toMillis(options.startTime),
        attributes: { 'effect.span.kind': options.kind }
      })

      const sentryContext = sentrySpan.spanContext()
      const attributes = new Map<string, unknown>()
      const links = [...options.links]

      let status: Tracer.SpanStatus = { _tag: 'Started', startTime: options.startTime }

      const span: Tracer.Span = {
        _tag: 'Span',
        name: options.name,
        spanId: sentryContext.spanId ?? randomHex(8),
        traceId: sentryContext.traceId ?? parent?.traceId ?? randomHex(16),
        parent: options.parent,
        annotations: options.annotations,
        get status() {
          return status
        },
        attributes,
        links,
        sampled: options.sampled,
        kind: options.kind,
        end(endTime, exit) {
          status = { _tag: 'Ended', startTime: options.startTime, endTime, exit }
          const failure = failureAttributes(exit)
          if (failure) sentrySpan.setAttributes(failure)
          sentrySpan.setStatus({ message: exit._tag, code: exit._tag === 'Success' ? 1 : 2 })
          sentrySpan.end(toMillis(endTime))
        },
        attribute(key, value) {
          attributes.set(key, value)
          sentrySpan.setAttribute(key, toSentryAttribute(value))
        },
        event(name, startTime, eventAttributes) {
          const breadcrumb: Sentry.Breadcrumb = {
            category: 'effect.span',
            message: `${options.name}: ${name}`,
            timestamp: toMillis(startTime) / 1000
          }
          if (eventAttributes) breadcrumb.data = eventAttributes
          Sentry.addBreadcrumb(breadcrumb)
        },
        addLinks(newLinks) {
          links.push(...newLinks)
        }
      }

      return span
    }
  })

export const SentryTracerLive = Layer.succeed(Tracer.Tracer, makeSentryTracer())
