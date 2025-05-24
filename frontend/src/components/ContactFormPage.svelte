<script lang="ts">
  import { onMount } from 'svelte';
  import { makeAuthenticatedApiCall, isLoggedIn, logout } from '../lib/auth.store'; // Adjust path
  import type { CreateContactDto, UpdateContactDto, Contact } from '../../../src/contacts/dto/contacts.dto'; // Assuming backend DTO path

  export let contactId: string | null = null; // If provided, we are in "edit" mode

  let contactData: Partial<CreateContactDto> = {
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    company_name: '',
    assigned_to_user_id: undefined, // Example: 'users:someUserId'
  };

  let isLoading = false;
  let isFetching = false;
  let error: string | null = null;
  let successMessage: string | null = null;

  onMount(async () => {
    if (!$isLoggedIn && typeof window !== 'undefined') {
      window.location.href = '/login';
      return;
    }
    if (contactId) {
      await fetchContactDetails(contactId);
    }
  });

  async function fetchContactDetails(id: string) {
    isFetching = true;
    error = null;
    try {
      const response = await makeAuthenticatedApiCall(`/contacts/${id}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to load contact details.' }));
        throw new Error(errData.message || `HTTP error ${response.status}`);
      }
      const fetchedContact: Contact = await response.json();
      contactData = { // Populate form with existing data
        first_name: fetchedContact.first_name,
        last_name: fetchedContact.last_name,
        email: fetchedContact.email,
        phone_number: fetchedContact.phone_number,
        company_name: fetchedContact.company_name,
        assigned_to_user_id: fetchedContact.assigned_to_user_id,
      };
    } catch (e: any) {
      console.error('Fetch contact details error:', e);
      error = e.message || 'Failed to load contact details.';
      if (e.message.includes('Unauthorized')) logout();
    } finally {
      isFetching = false;
    }
  }

  async function handleSubmit() {
    isLoading = true;
    error = null;
    successMessage = null;

    if (!contactData.first_name) {
        error = "First name is required.";
        isLoading = false;
        return;
    }
    
    // Basic validation for assigned_to_user_id format if provided
    if (contactData.assigned_to_user_id && !contactData.assigned_to_user_id.includes(':')) {
        error = "Assigned User ID must be a valid SurrealDB record ID (e.g., users:recordid).";
        isLoading = false;
        return;
    }


    try {
      let response;
      const payload = { ...contactData };

      if (contactId) { // Edit mode
        response = await makeAuthenticatedApiCall(`/contacts/${contactId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload as UpdateContactDto),
        });
      } else { // Create mode
        response = await makeAuthenticatedApiCall('/contacts', {
          method: 'POST',
          body: JSON.stringify(payload as CreateContactDto),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      successMessage = `Contact ${contactId ? 'updated' : 'created'} successfully!`;
      if (!contactId && result.id && typeof window !== 'undefined') { // If created, redirect to edit page or list
         setTimeout(() => window.location.href = `/contacts`, 1500); // Redirect to list after a delay
      } else if (contactId && typeof window !== 'undefined') {
        setTimeout(() => window.location.href = `/contacts`, 1500); // Redirect to list after a delay
      }

    } catch (e: any) {
      console.error('Submit contact error:', e);
      error = e.message || `Failed to ${contactId ? 'update' : 'create'} contact.`;
      if (e.message.includes('Unauthorized')) logout();
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="container mx-auto p-6">
  <h1 class="text-3xl font-bold text-gray-800 mb-6">
    {contactId ? 'Edit Contact' : 'Create New Contact'}
  </h1>

  {#if isFetching}
    <p class="text-gray-600">Loading contact details...</p>
  {:else}
    {#if successMessage}
      <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
        <span class="block sm:inline">{successMessage}</span>
      </div>
    {/if}
    {#if error}
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
        <span class="block sm:inline">{error}</span>
      </div>
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="bg-white shadow-md rounded-lg p-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label for="first_name" class="block text-sm font-medium text-gray-700">First Name <span class="text-red-500">*</span></label>
          <input type="text" id="first_name" bind:value={contactData.first_name} required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
        </div>
        <div>
          <label for="last_name" class="block text-sm font-medium text-gray-700">Last Name</label>
          <input type="text" id="last_name" bind:value={contactData.last_name} class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
        </div>
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" id="email" bind:value={contactData.email} class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
        </div>
        <div>
          <label for="phone_number" class="block text-sm font-medium text-gray-700">Phone Number</label>
          <input type="tel" id="phone_number" bind:value={contactData.phone_number} class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
        </div>
        <div>
          <label for="company_name" class="block text-sm font-medium text-gray-700">Company Name</label>
          <input type="text" id="company_name" bind:value={contactData.company_name} class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
        </div>
        <div>
          <label for="assigned_to_user_id" class="block text-sm font-medium text-gray-700">Assigned User ID (e.g., users:xxxx)</label>
          <input type="text" id="assigned_to_user_id" bind:value={contactData.assigned_to_user_id} placeholder="users:recordId" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
        </div>
      </div>
      <div class="mt-8 flex justify-end space-x-3">
        <a href="/contacts" class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
          Cancel
        </a>
        <button 
          type="submit" 
          class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? (contactId ? 'Updating...' : 'Creating...') : (contactId ? 'Update Contact' : 'Create Contact')}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  /* Tailwind is used via global.css */
</style>
