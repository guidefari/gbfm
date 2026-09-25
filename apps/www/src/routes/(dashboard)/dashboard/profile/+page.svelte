<script lang="ts">
  import { Schema } from 'effect'
  import { onMount } from 'svelte'
  import Page from '@/lib/components/dashboard/Page.svelte'
  import { dashboardJson, jsonRequest } from '@/lib/components/dashboard/api'

  const Platform = Schema.Literals(['bandcamp','substack','soundcloud','instagram','twitter','tiktok'])
  const Link = Schema.Struct({ platform: Platform, url: Schema.String, position: Schema.Number })
  const Profile = Schema.Struct({ id: Schema.String, name: Schema.String, email: Schema.String, emailVerified: Schema.Boolean, image: Schema.NullOr(Schema.String), username: Schema.NullOr(Schema.String), bio: Schema.NullOr(Schema.String), avatarUrl: Schema.NullOr(Schema.String), verified: Schema.Boolean, socialLinks: Schema.Array(Link) })
  type PlatformValue = typeof Platform.Type
  type SocialLink = typeof Link.Type
  let name = $state(''), username = $state(''), bio = $state(''), image = $state(''), email = $state('')
  let links = $state<ReadonlyArray<SocialLink>>([]), message = $state(''), pending = $state(false)
  const platforms: ReadonlyArray<PlatformValue> = ['bandcamp','substack','soundcloud','instagram','twitter','tiktok']
  onMount(async () => { try { const p = await dashboardJson(Profile, '/api/user/profile'); name=p.name; username=p.username??''; bio=p.bio??''; image=p.image??p.avatarUrl??''; email=p.email; links=p.socialLinks } catch { message='Could not load profile.' } })
  async function saveProfile() { pending=true; message=''; try { await dashboardJson(Schema.Unknown, '/auth/update-user', jsonRequest('POST',{ name, image })); await dashboardJson(Profile, '/api/user/profile', jsonRequest('PATCH',{ username, bio, image })); message='Profile saved.' } catch { message='Could not save profile.' } finally { pending=false } }
  async function saveLinks() { pending=true; try { links = await dashboardJson(Schema.Array(Link), '/api/user/profile/social-links', jsonRequest('PUT', links.map((link,index)=>({...link,position:index})))); message='Social links saved.' } catch { message='Could not save social links.' } finally { pending=false } }
  async function resetPassword() { pending=true; try { const response=await fetch('/auth/forget-password', jsonRequest('POST',{email,redirectTo:`${location.origin}/auth/reset-password`})); message=response.ok?'Reset link sent.':'Could not send reset link.' } catch { message='Could not send reset link.' } finally { pending=false } }
</script>
<Page title="Account Profile" description="Manage your public profile, links, and password.">
  <form class="grid max-w-2xl gap-4 rounded border p-5" onsubmit={(e)=>{e.preventDefault();void saveProfile()}}>
    <label>Display name<input class="mt-1 w-full rounded border bg-background p-2" bind:value={name} /></label>
    <label>Username<input class="mt-1 w-full rounded border bg-background p-2" bind:value={username} /></label>
    <label>Bio<textarea class="mt-1 min-h-28 w-full rounded border bg-background p-2" maxlength="500" bind:value={bio}></textarea></label>
    <label>Avatar URL<input class="mt-1 w-full rounded border bg-background p-2" type="url" bind:value={image} /></label>
    <button class="w-fit rounded bg-foreground px-4 py-2 text-background" disabled={pending}>Save profile</button>
  </form>
  <section class="max-w-2xl rounded border p-5"><div class="mb-4 flex justify-between"><h2 class="font-bold">Social links</h2><button class="underline" onclick={()=>links=[...links,{platform:'bandcamp',url:'',position:links.length}]}>Add link</button></div>
    <div class="space-y-3">{#each links as link,index}<div class="grid grid-cols-[10rem_1fr_auto] gap-2"><select class="rounded border bg-background p-2" value={link.platform} onchange={(e)=>{const next=Schema.decodeUnknownOption(Platform)(e.currentTarget.value);if(next._tag==='Some')links=links.map((item,i)=>i===index?{...item,platform:next.value}:item)}}>{#each platforms as platform}<option value={platform}>{platform}</option>{/each}</select><input class="rounded border bg-background p-2" type="url" value={link.url} oninput={(e)=>links=links.map((item,i)=>i===index?{...item,url:e.currentTarget.value}:item)} /><button class="text-destructive" onclick={()=>links=links.filter((_,i)=>i!==index)}>Remove</button></div>{/each}</div>
    <button class="mt-4 rounded bg-foreground px-4 py-2 text-background" disabled={pending} onclick={()=>void saveLinks()}>Save links</button>
  </section>
  <section class="max-w-2xl rounded border p-5"><h2 class="font-bold">Password</h2><p class="my-3 text-sm text-muted-foreground">Send a password reset link to {email}.</p><button class="rounded border px-4 py-2" disabled={pending} onclick={()=>void resetPassword()}>Send reset link</button></section>
  {#if message}<p aria-live="polite">{message}</p>{/if}
</Page>
