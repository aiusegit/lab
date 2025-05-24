<script lang="ts">
  import { onMount } from 'svelte';
  import { isLoggedIn, userEmail, tenantId } from '../lib/auth.store'; // Adjust path

  onMount(() => {
    if (!$isLoggedIn && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  });
</script>

<div class="container mx-auto p-6">
  <h1 class="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>
  {#if $isLoggedIn}
    <div class="bg-white shadow-md rounded-lg p-6">
      <p class="text-lg text-gray-700">Welcome, <span class="font-semibold">{$userEmail}</span>!</p>
      <p class="text-md text-gray-600">You are logged in to tenant: <span class="font-semibold">{$tenantId}</span>.</p>
      <p class="mt-4 text-gray-500">This is your main dashboard. More widgets and information will be added here soon.</p>
    </div>
  {:else}
    <p class="text-red-500">You are not logged in. Redirecting...</p>
    <!-- onMount handles redirection -->
  {/if}
</div>
