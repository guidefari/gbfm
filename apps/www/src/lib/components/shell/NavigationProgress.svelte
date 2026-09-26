<script lang="ts">
  import { navigating } from '$app/state'
</script>

{#if navigating.to}
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-highlight/15"
    role="progressbar"
    aria-label="Loading page"
  >
    <div class="route-progress h-full bg-highlight shadow-[0_0_8px_var(--highlight)]"></div>
  </div>
{/if}
