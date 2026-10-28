import { Predicate } from 'effect'
import { Command, Update } from 'foldkit'

import type { Services } from './init'
import { Message } from './message'
import type { Model } from './model'
import * as Player from './player'
import type * as PublicActions from './public-actions'

type Return = Update.Return<Model, Message, Services>

type Step = (model: Model) => Return

const toPlayer =
  (message: Player.Message): Step =>
  (model) => {
    const child = Player.update(model.player, message)

    return {
      model: child.model === model.player ? model : { ...model, player: child.model },
      commands: Command.mapMessages(child.commands ?? [], (message) =>
        Message.GotPlayerMessage({ message }),
      ),
    }
  }

const adoptInPage =
  (audioId: string, active: boolean): Step =>
  (model) => {
    const publicAction: PublicActions.Model = model.publicAction
    const document = publicAction.document

    return !document ||
      document.target.kind !== 'audio' ||
      document.target.id !== audioId ||
      publicAction.busy ||
      !['active', 'inactive'].includes(document.state)
      ? { model }
      : {
          model: {
            ...model,
            publicAction: {
              ...publicAction,
              document: { ...document, state: active ? 'active' : 'inactive' },
            },
          },
        }
  }

const acceptedPlayerSave = (previous: Model, message: Message, next: Model) =>
  Predicate.isTagged(message, 'GotPlayerMessage') &&
  Predicate.isTagged(message.message, 'GotFavoriteMessage') &&
  Predicate.isTagged(message.message.message, 'Saved') &&
  next.player.favorite !== previous.player.favorite
    ? message.message.message
    : null

const acceptedPageSave = (previous: Model, message: Message, next: Model) =>
  Predicate.isTagged(message, 'GotPublicActionMessage') &&
  Predicate.isTagged(message.message, 'Saved') &&
  message.message.target.kind === 'audio' &&
  next.publicAction !== previous.publicAction
    ? message.message
    : null

const pageFavorite = (model: Model) => {
  const document = model.publicAction.document

  return document?.target.kind === 'audio' &&
    document.target.id === model.player.favorite.track?.audioId &&
    (document.state === 'active' || document.state === 'inactive')
    ? { audioId: document.target.id, active: document.state === 'active' }
    : null
}

const playerFavorite = (model: Model) => {
  const { track, status, saving } = model.player.favorite

  return track && !saving && (status === 'active' || status === 'inactive')
    ? { audioId: track.audioId, active: status === 'active' }
    : null
}

const steps = (previous: Model, message: Message, next: Model): ReadonlyArray<Step> => {
  const principalId = next.flags.principal?.id ?? null
  const playerSave = acceptedPlayerSave(previous, message, next)
  const pageSave = acceptedPageSave(previous, message, next)
  const pageReplaced = next.publicAction !== previous.publicAction && !pageSave

  const fresh =
    pageReplaced && Predicate.isTagged(message, 'LoadedPage') ? pageFavorite(next) : null

  const cached =
    pageReplaced && Predicate.isTagged(message, 'ChangedUrl') ? playerFavorite(next) : null

  return [
    ...(principalId === next.player.favorite.principalId
      ? []
      : [toPlayer(Player.Message.PrincipalChanged({ principalId }))]),
    ...(playerSave ? [adoptInPage(playerSave.audioId, playerSave.active)] : []),
    ...(pageSave
      ? [
          toPlayer(
            Player.Message.FavoriteChangedElsewhere({
              audioId: pageSave.target.id,
              active: pageSave.active,
            }),
          ),
        ]
      : []),
    ...(fresh ? [toPlayer(Player.Message.FavoriteChangedElsewhere(fresh))] : []),
    ...(cached ? [adoptInPage(cached.audioId, cached.active)] : []),
  ]
}

/**
 * Keeps the player heart bound to the queued track and signed-in account. When the page favorite
 * control shows the same audio, server-acknowledged saves flow both ways; freshly loaded page data
 * updates the player, while cached page data defers to the player's newer knowledge.
 */
export const syncPlayerFavorite = (previous: Model, message: Message, result: Return): Return => {
  const pending = steps(previous, message, result.model)

  if (pending.length === 0) return result
  const synced = Update.combine(result.model, pending)

  return {
    model: synced.model,
    commands: [...(result.commands ?? []), ...(synced.commands ?? [])],
  }
}
