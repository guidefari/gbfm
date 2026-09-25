<script lang="ts">
  import Page from './Page.svelte'; import JsonForm from './JsonForm.svelte'
  let { title, description, endpoint, fields }: { title: string; description: string; endpoint: string; fields: { name: string; label: string; type?: string; value?: string }[] } = $props()
</script>
<Page {title} {description}><JsonForm {endpoint} {fields} /></Page>
