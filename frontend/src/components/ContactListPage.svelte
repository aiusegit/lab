<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { makeAuthenticatedApiCall, isLoggedIn, logout } from '../lib/auth.store'; // Adjust path
  import type { Contact } from '../../../src/contacts/dto/contacts.dto'; // Assuming backend DTO path

  let contacts: Contact[] = [];
  let isLoading = true;
  let error: string | null = null;

  // For WhatsApp Modal
  let showWhatsAppModal = false;
  let whatsAppMessage = '';
  let selectedContactForWhatsApp: Contact | null = null;
  let isSendingWhatsApp = false;
  let whatsAppError: string | null = null;
  let whatsAppSuccess: string | null = null;

  onMount(async () => {
    if (!$isLoggedIn && typeof window !== 'undefined') {
      window.location.href = '/login';
      return;
    }
    await fetchContacts();
  });

  async function fetchContacts() {
    isLoading = true;
    error = null;
    try {
      const response = await makeAuthenticatedApiCall('/contacts');
      if (!response.ok) {
        if (response.status === 401) { // Handled by makeAuthenticatedApiCall, but good to be aware
          error = 'Authentication failed. Please login again.';
          // logout(); // makeAuthenticatedApiCall should handle this
          return;
        }
        const errData = await response.json().catch(() => ({ message: 'Failed to load contacts. Server returned an error.' }));
        throw new Error(errData.message || `HTTP error ${response.status}`);
      }
      contacts = await response.json();
    } catch (e: any) {
      console.error('Fetch contacts error:', e);
      error = e.message || 'Failed to load contacts.';
      if (e.message.includes('Unauthorized')) { // In case makeAuthenticatedApiCall re-throws without immediate logout
        logout();
      }
    } finally {
      isLoading = false;
    }
  }

  function openWhatsAppModal(contact: Contact) {
    selectedContactForWhatsApp = contact;
    whatsAppMessage = '';
    whatsAppError = null;
    whatsAppSuccess = null;
    showWhatsAppModal = true;
  }

  async function handleSendWhatsApp() {
    if (!selectedContactForWhatsApp || !whatsAppMessage.trim()) {
      whatsAppError = 'Message cannot be empty.';
      return;
    }
    isSendingWhatsApp = true;
    whatsAppError = null;
    whatsAppSuccess = null;
    try {
      const response = await makeAuthenticatedApiCall(
        `/whatsapp/contacts/${selectedContactForWhatsApp.id.split(':')[1]}/send-message`, // Assuming ID is like 'contacts:uuid'
        {
          method: 'POST',
          body: JSON.stringify({ messageText: whatsAppMessage }),
        }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to send message. Server returned an error.' }));
        throw new Error(errData.message || `HTTP error ${response.status}`);
      }
      const result = await response.json();
      whatsAppSuccess = `Message sent successfully to ${selectedContactForWhatsApp.first_name}! (Msg ID: ${result.message_id})`;
      whatsAppMessage = ''; // Clear message
      await tick(); // Wait for UI to update
      setTimeout(() => { // Close modal after a delay
        showWhatsAppModal = false;
        selectedContactForWhatsApp = null;
      }, 2000);
    } catch (e: any) {
      console.error('Send WhatsApp error:', e);
      whatsAppError = e.message || 'Failed to send WhatsApp message.';
    } finally {
      isSendingWhatsApp = false;
    }
  }
</script>

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-bold text-gray-800">Contacts</h1>
    <a href="/contacts/new" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm">
      Add Contact
    </a>
  </div>

  {#if isLoading}
    <p class="text-gray-600">Loading contacts...</p>
  {:else if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <strong class="font-bold">Error:</strong>
      <span class="block sm:inline">{error}</span>
      <button on:click={fetchContacts} class="ml-4 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded">
        Retry
      </button>
    </div>
  {:else if contacts.length === 0}
    <p class="text-gray-600">No contacts found. <a href="/contacts/new" class="text-indigo-600 hover:underline">Add your first contact!</a></p>
  {:else}
    <div class="bg-white shadow-md rounded-lg overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th scope="col" class="relative px-6 py-3">
              <span class="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each contacts as contact (contact.id)}
            <tr>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">{contact.first_name || ''} {contact.last_name || ''}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-500">{contact.email || '-'}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-500">{contact.phone_number || '-'}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-500">{contact.company_name || '-'}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <a href={`/contacts/edit/${contact.id.split(':')[1]}`} class="text-indigo-600 hover:text-indigo-900">Edit</a>
                <button on:click={() => openWhatsAppModal(contact)} class="text-green-600 hover:text-green-900">
                  WhatsApp
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- WhatsApp Modal -->
{#if showWhatsAppModal && selectedContactForWhatsApp}
  <div class="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
              <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                Send WhatsApp to {selectedContactForWhatsApp.first_name}
              </h3>
              <div class="mt-2">
                {#if whatsAppError}
                  <p class="text-sm text-red-500 bg-red-100 p-2 rounded">{whatsAppError}</p>
                {/if}
                {#if whatsAppSuccess}
                  <p class="text-sm text-green-500 bg-green-100 p-2 rounded">{whatsAppSuccess}</p>
                {/if}
                <textarea 
                  bind:value={whatsAppMessage}
                  rows="4" 
                  class="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Type your message..."
                  disabled={isSendingWhatsApp || !!whatsAppSuccess}
                ></textarea>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <button 
            type="button" 
            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            on:click={handleSendWhatsApp}
            disabled={isSendingWhatsApp || !!whatsAppSuccess}
          >
            {isSendingWhatsApp ? 'Sending...' : 'Send'}
          </button>
          <button 
            type="button" 
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            on:click={() => { showWhatsAppModal = false; selectedContactForWhatsApp = null; }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Tailwind is used via global.css */
</style>
