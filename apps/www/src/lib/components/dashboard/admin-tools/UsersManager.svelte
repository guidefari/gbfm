<script lang="ts">
  import { Schema } from 'effect'
  import { onMount } from 'svelte'
  import { dashboardJson, jsonRequest } from '../api'

  const roles = ['admin','editor','creator','user'] as const

  const Role = Schema.Literals(roles)

  const User = Schema.Struct({ id: Schema.String, name: Schema.String, username: Schema.optional(Schema.NullOr(Schema.String)), email: Schema.String, image: Schema.optional(Schema.NullOr(Schema.String)), role: Schema.optional(Schema.NullOr(Schema.String)), banned: Schema.optional(Schema.NullOr(Schema.Boolean)), banReason: Schema.optional(Schema.NullOr(Schema.String)), emailVerified: Schema.optional(Schema.Boolean), createdAt: Schema.optional(Schema.Union([Schema.String, Schema.Date])) })

  const Result = Schema.Struct({ users: Schema.Array(User), total: Schema.Number, limit: Schema.Number })

  type UserValue = typeof User.Type

  type RoleValue = typeof Role.Type

  const limit=25

  let users=$state<ReadonlyArray<UserValue>>([]), total=$state(0), offset=$state(0), search=$state(''), loading=$state(true), message=$state(''), pending=$state('')

  let createOpen=$state(false), name=$state(''), username=$state(''), email=$state(''), password=$state(''), role=$state<RoleValue>('user')

  async function load(){loading=true;message='';

try{const query=new URLSearchParams({limit:String(limit),offset:String(offset)});

if(search.trim()){query.set('searchValue',search.trim());query.set('searchField','email')}

const result=await dashboardJson(Result,`/auth/admin/list-users?${query}`);users=result.users;total=result.total}catch(cause){message=cause instanceof Error?cause.message:'Could not load users.'}finally{loading=false}}

  async function command(path:string,body:Schema.Json,success='Account updated.'){pending=path;

try{await dashboardJson(Schema.Unknown,`/auth/admin/${path}`,jsonRequest('POST',body));message=success;await load()}catch(cause){message=cause instanceof Error?cause.message:'Account action failed.'}finally{pending=''}}

  async function create(){const generatedEmail=email.trim()||`${username||crypto.randomUUID()}@placeholder.local`;const base={name:name||username||'User',email:generatedEmail,password:password||crypto.randomUUID(),role};

if(username)await command('create-user',{...base,data:{username}},'User created.');else await command('create-user',base,'User created.');createOpen=false;name='';username='';email='';password=''}

  async function invite(userId:string){pending=`invite-${userId}`;

try{await dashboardJson(Schema.Unknown,'/api/invite/send',jsonRequest('POST',{userId}));message='Invite email sent.'}catch{message='Failed to send invite.'}finally{pending=''}}

  function ban(user:UserValue){const reason=prompt(`Reason for banning ${user.name} (optional)`);

if(reason!==null)void command('ban-user',reason?{userId:user.id,banReason:reason}:{userId:user.id})}

  function remove(user:UserValue){if(confirm(`Permanently delete ${user.name}? This cannot be undone.`))void command('remove-user',{userId:user.id})}

  onMount(load)
</script>

<div class="space-y-4">
  <div class="flex flex-wrap items-center gap-3"><form class="flex flex-1 gap-2" onsubmit={(event)=>{event.preventDefault();offset=0;void load()}}><input class="w-full max-w-sm rounded border bg-background px-3 py-2" type="search" placeholder="Search by email…" bind:value={search}/><button class="rounded border px-4 py-2">Search</button></form><button class="rounded bg-foreground px-4 py-2 text-background" onclick={()=>createOpen=!createOpen}>Create user</button><span class="text-sm text-muted-foreground">{total} users</span></div>
  {#if createOpen}<form class="grid gap-3 rounded border p-4 md:grid-cols-2 xl:grid-cols-5" onsubmit={(e)=>{e.preventDefault();void create()}}><label class="text-sm">Display name<input class="mt-1 w-full rounded border bg-background p-2" bind:value={name}/></label><label class="text-sm">Username<input class="mt-1 w-full rounded border bg-background p-2" bind:value={username}/></label><label class="text-sm">Email<input class="mt-1 w-full rounded border bg-background p-2" type="email" bind:value={email}/></label><label class="text-sm">Password<input class="mt-1 w-full rounded border bg-background p-2" type="password" bind:value={password}/></label><label class="text-sm">Role<select class="mt-1 w-full rounded border bg-background p-2" bind:value={role}>{#each roles as item}<option value={item}>{item}</option>{/each}</select></label><div class="md:col-span-2 xl:col-span-5"><button class="rounded bg-foreground px-4 py-2 text-background" disabled={pending==='create-user'||(!email&&!username)}>{pending==='create-user'?'Creating…':'Create user'}</button></div></form>{/if}
  {#if loading}<p class="py-8 text-center text-muted-foreground">Loading users…</p>{:else}<div class="overflow-x-auto rounded border"><table class="w-full text-left text-sm"><thead class="bg-muted/50"><tr><th class="p-3">Name</th><th class="p-3">Email</th><th class="p-3">Role / affiliation</th><th class="p-3">Status</th><th class="p-3">Actions</th></tr></thead><tbody>{#each users as user}<tr class="border-t"><td class="p-3"><div class="flex items-center gap-3">{#if user.image}<img class="h-8 w-8 rounded object-cover" src={user.image} alt=""/>{:else}<span class="flex h-8 w-8 items-center justify-center rounded bg-muted">{user.name.charAt(0)}</span>{/if}<div><div>{user.name}</div>{#if user.username}<a class="text-xs text-muted-foreground underline" href={`/${user.username}`}>@{user.username}</a>{/if}</div></div></td><td class="p-3 text-muted-foreground">{user.email}</td><td class="p-3"><select class="rounded border bg-background p-1" value={user.role??'user'} disabled={pending==='set-role'} onchange={(e)=>{const parsed=Schema.decodeUnknownOption(Role)(e.currentTarget.value);if(parsed._tag==='Some')void command('set-role',{userId:user.id,role:parsed.value})}}>{#each roles as item}<option value={item}>{item}</option>{/each}</select></td><td class="p-3"><span class={`rounded-full border px-2 py-1 text-xs ${user.banned?'border-destructive text-destructive':''}`} title={user.banReason??undefined}>{user.banned?'Banned':user.emailVerified===false?'Unverified':'Active'}</span></td><td class="whitespace-nowrap p-3"><button class="mr-3 underline" disabled={pending!==''} onclick={()=>void invite(user.id)}>Invite</button>{#if user.banned}<button class="mr-3 underline" disabled={pending!==''} onclick={()=>void command('unban-user',{userId:user.id})}>Unban</button>{:else}<button class="mr-3 underline" disabled={pending!==''} onclick={()=>ban(user)}>Ban</button>{/if}<button class="text-destructive underline" disabled={pending!==''} onclick={()=>remove(user)}>Delete</button></td></tr>{:else}<tr><td class="p-8 text-center text-muted-foreground" colspan="5">No users found</td></tr>{/each}</tbody></table></div>{/if}
  <div class="flex items-center justify-between"><button class="rounded border px-3 py-2 disabled:opacity-40" disabled={offset===0||loading} onclick={()=>{offset=Math.max(0,offset-limit);void load()}}>Previous</button><span class="text-sm text-muted-foreground">{total===0?0:offset+1}–{Math.min(total,offset+users.length)} of {total}</span><button class="rounded border px-3 py-2 disabled:opacity-40" disabled={offset+users.length>=total||loading} onclick={()=>{offset+=limit;void load()}}>Next</button></div>
  {#if message}<p class="rounded border p-3" aria-live="polite">{message}</p>{/if}
</div>
