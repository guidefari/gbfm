<script lang="ts">import ResourcePage from '@/lib/components/dashboard/ResourcePage.svelte'</script>
<ResourcePage title="Email Logs" description="Review delivery outcomes and failures." endpoint="/api/email/logs?limit=50&offset=0" />
