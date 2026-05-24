import type { SelectMdxCompiledAudio } from '@gbfm/vps/schemas'

export type Creator = NonNullable<SelectMdxCompiledAudio['creators']>[number]
