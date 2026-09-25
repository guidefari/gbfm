<script lang="ts">
  let { message, error = false }: { message: string; error?: boolean } = $props()
</script>

<div class="mx-auto max-w-2xl px-4 py-16 text-center" role={error ? 'alert' : 'status'}>
  <p class:error class="text-muted-foreground">{message}</p>
</div>

<style>
  .error {
    color: var(--destructive, #c33);
  }
</style>
