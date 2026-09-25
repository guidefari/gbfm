<script lang="ts">
  import ApiTable from './ApiTable.svelte'
  import Page from './Page.svelte'

  let { title, description, endpoint, createEndpoint, createFields = [], actionBase, idKey }: { title: string; description: string; endpoint: string; createEndpoint?: string; createFields?: Array<{ name: string; label: string }>; actionBase?: string; idKey?: string } = $props()

  let refresh = $state(0), message = $state('')

  let formElement = $state<HTMLFormElement>()

  async function create() {
    if (!createEndpoint || !formElement) return
    const form = new FormData(formElement)
    const response = await fetch(createEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) })
    message = response.ok ? 'Created.' : `Could not create (${response.status}).`

    if (response.ok) { formElement.reset(); refresh++ }
  }
</script>
<Page {title} {description}>
  {#if createEndpoint}<form bind:this={formElement} class="flex flex-wrap items-end gap-3 rounded border p-4" onsubmit={(event) => { event.preventDefault(); void create() }}>{#each createFields as field}<label><span class="mb-1 block text-xs font-bold">{field.label}</span><input required class="rounded border bg-background px-3 py-2" name={field.name} /></label>{/each}<button class="rounded bg-foreground px-4 py-2 text-background">Create</button>{#if message}<span>{message}</span>{/if}</form>{/if}
  <ApiTable {endpoint} {refresh} {actionBase} {idKey} />
</Page>
