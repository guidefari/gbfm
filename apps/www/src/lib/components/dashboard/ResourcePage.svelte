<script lang="ts">
  import { dashboardCommand, jsonRequest } from './api'
  import ApiTable from './ApiTable.svelte'
  import Page from './Page.svelte'

  let {
    title,
    description,
    endpoint,
    createEndpoint,
    createFields = [],
    actionBase,
    idKey,
  }: {
    title: string
    description: string
    endpoint: string
    createEndpoint?: string
    createFields?: Array<{ name: string; label: string }>
    actionBase?: string
    idKey?: string
  } = $props()

  let refresh = $state(0),
    message = $state('')

  let formElement = $state<HTMLFormElement>()

  async function create() {
    if (!createEndpoint || !formElement) return
    const form = new FormData(formElement)

    const body = Object.fromEntries(
      [...form.entries()].map(([name, value]) => [name, String(value)]),
    )

    try {
      await dashboardCommand(createEndpoint, jsonRequest('POST', body))
      message = 'Created.'
      formElement.reset()
      refresh++
    } catch (cause) {
      message = cause instanceof Error ? cause.message : 'Could not create.'
    }
  }
</script>

<Page {title} {description}>
  {#if createEndpoint}<form
      bind:this={formElement}
      class="flex flex-wrap items-end gap-3 rounded border p-4"
      onsubmit={(event) => {
        event.preventDefault()
        void create()
      }}
    >
      {#each createFields as field}<label
          ><span class="mb-1 block text-xs font-bold">{field.label}</span><input
            required
            class="rounded border bg-background px-3 py-2"
            name={field.name}
          /></label
        >{/each}<button class="rounded bg-foreground px-4 py-2 text-background">Create</button
      >{#if message}<span>{message}</span>{/if}
    </form>{/if}
  <ApiTable
    {endpoint}
    {refresh}
    {...actionBase === undefined ? {} : { actionBase }}
    {...idKey === undefined ? {} : { idKey }}
  />
</Page>
