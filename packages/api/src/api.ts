import { HttpApi } from 'effect/unstable/httpapi'
import { HealthGroup } from './health'

export const Api = HttpApi.make('gbfm').add(HealthGroup)
