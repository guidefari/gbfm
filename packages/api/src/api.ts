import { HttpApi } from 'effect/unstable/httpapi'
import { HealthGroup } from './health'
import { InternalGroup } from './internal'

export const Api = HttpApi.make('gbfm').add(HealthGroup).add(InternalGroup)
