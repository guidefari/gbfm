<script lang="ts">
  import { Schema } from 'effect'
  const Reminder = Schema.Struct({ id: Schema.String, musicTitle: Schema.String, artistName: Schema.String, musicUrl: Schema.String, reminderDate: Schema.String, notes: Schema.NullOr(Schema.String) })
  const ReminderList = Schema.Struct({ reminders: Schema.Array(Reminder) })
  type Reminder = typeof Reminder.Type
  let reminders = $state<ReadonlyArray<Reminder>>([])
  let loading = $state(true)
  let error = $state('')
  async function load() { const r=await fetch('/api/music-reminders'); if(r.ok){const d=Schema.decodeUnknownSync(ReminderList)(await r.json()); reminders=d.reminders}else error='Could not load reminders.'; loading=false }
  async function create(formElement: HTMLFormElement) { error=''; const form=new FormData(formElement); const reminderDate=new Date(String(form.get('reminderDate'))).toISOString(); const payload={musicTitle:String(form.get('musicTitle')),artistName:String(form.get('artistName')),musicUrl:String(form.get('musicUrl')),reminderDate,notes:String(form.get('notes')||'')||undefined}; const r=await fetch('/api/music-reminders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}); if(!r.ok){error='Could not create reminder.';return}formElement.reset(); await load() }
  async function remove(id:string) { if(!confirm('Delete this reminder?'))return; const r=await fetch(`/api/music-reminders/${id}`,{method:'DELETE'}); if(!r.ok){error='Could not delete reminder.';return} reminders=reminders.filter((item)=>item.id!==id) }
  $effect(() => { void load() })
</script>
<section class="mx-auto max-w-4xl px-4 py-12"><h1 class="text-4xl font-black">Music reminders</h1><p class="mt-3 text-muted-foreground">We’ll email you when it is time to listen.</p>
  <form class="mt-8 grid gap-4 border p-5 md:grid-cols-2" onsubmit={(event)=>{event.preventDefault();void create(event.currentTarget)}}>
    <input class="border bg-background p-3 md:col-span-2" name="musicUrl" type="url" placeholder="Music URL" required />
    <input class="border bg-background p-3" name="musicTitle" placeholder="Music title" required /><input class="border bg-background p-3" name="artistName" placeholder="Artist" required />
    <input class="border bg-background p-3" name="reminderDate" type="datetime-local" required /><input class="border bg-background p-3" name="notes" placeholder="Notes (optional)" />
    <button class="bg-primary p-3 font-bold text-primary-foreground md:col-span-2">Create reminder</button>
  </form>{#if error}<p role="alert" class="mt-4 text-destructive">{error}</p>{/if}
  {#if loading}<p class="mt-8">Loading…</p>{:else}<ul class="mt-8 grid gap-3">{#each reminders as reminder}<li class="flex items-center gap-4 border p-4"><div class="flex-1"><a href={reminder.musicUrl} target="_blank" rel="noreferrer" class="font-bold">{reminder.musicTitle}</a><p>{reminder.artistName} · {new Date(reminder.reminderDate).toLocaleString()}</p>{#if reminder.notes}<p class="text-sm text-muted-foreground">{reminder.notes}</p>{/if}</div><button class="text-destructive" onclick={()=>void remove(reminder.id)}>Delete</button></li>{/each}</ul>{/if}
</section>
