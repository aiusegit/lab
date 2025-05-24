<script lang="ts">
  import { onMount } from 'svelte';
  import { login, authError, isLoggedIn } from '../lib/auth.store'; // Adjust path as necessary
  // Optional: For dev convenience, pre-fill from config if needed
  // import { defaultTenantIdForLogin, defaultEmailForLogin, defaultPasswordForLogin } from '../config';

  let email = ''; // defaultEmailForLogin || '';
  let password = ''; // defaultPasswordForLogin || '';
  let tenant_id = ''; // defaultTenantIdForLogin || '';
  let isLoading = false;

  onMount(() => {
    // If already logged in, redirect to dashboard
    if ($isLoggedIn && typeof window !== 'undefined') {
      window.location.href = '/dashboard'; // Or your main app page
    }
  });

  async function handleSubmit() {
    if (!email || !password || !tenant_id) {
      authError.set('All fields are required.');
      return;
    }
    isLoading = true;
    await login(email, password, tenant_id);
    isLoading = false;
    // The login function in auth.store.ts handles redirection on success
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-100">
  <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
    <h1 class="text-2xl font-bold mb-6 text-center text-gray-700">Login</h1>
    
    {#if $authError}
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
        <span class="block sm:inline">{$authError}</span>
      </div>
    {/if}

    <form on:submit|preventDefault={handleSubmit}>
      <div class="mb-4">
        <label for="tenant_id" class="block text-sm font-medium text-gray-700">Tenant ID</label>
        <input 
          type="text" 
          id="tenant_id" 
          bind:value={tenant_id} 
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          required
          placeholder="Your organization's tenant ID"
        />
      </div>
      <div class="mb-4">
        <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
        <input 
          type="email" 
          id="email" 
          bind:value={email} 
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          required
          placeholder="you@example.com"
        />
      </div>
      <div class="mb-6">
        <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
        <input 
          type="password" 
          id="password" 
          bind:value={password} 
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          required
          placeholder="••••••••"
        />
      </div>
      <div>
        <button 
          type="submit" 
          class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  /* Additional global styles or component-specific styles can go here or in a separate CSS file if needed */
</style>
