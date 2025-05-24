<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { makeAuthenticatedApiCall, isLoggedIn, logout, tenantId as currentTenantIdStore } from '../lib/auth.store'; // Adjust path
  import { copilotStore } from '../lib/copilot.store'; // Import CopilotKit store
  import type { CopilotKit } from '@copilotkit/client';
  import type { KanbanColumnWithDeals, KanbanColumn } from '../../../src/kanban/dto/kanban.dto'; // Assuming backend DTO path
  import type { Deal } from '../../../src/deals/dto/deals.dto';

  let boardData: KanbanColumnWithDeals[] = [];
  let allKanbanColumns: KanbanColumn[] = []; // For the dropdown
  let isLoading = true;
  let error: string | null = null;
  let movingDealId: string | null = null;
  let moveError: string | null = null;
  let copilot: CopilotKit | null = null;
  let eventCallback: ((event: any) => void) | null = null;
  let tenantIdUnsubscribe: (() => void) | null = null;
  let currentTenantId: string | null = null;


  onMount(async () => {
    if (!$isLoggedIn && typeof window !== 'undefined') {
      window.location.href = '/login';
      return;
    }

    tenantIdUnsubscribe = currentTenantIdStore.subscribe(value => {
      currentTenantId = value;
    });

    await fetchBoardData();
    await fetchAllKanbanColumns(); // For the dropdowns

    copilotStore.subscribe(copilotInstance => {
      if (copilotInstance) {
        copilot = copilotInstance;
        console.log('KanbanPage: CopilotKit instance received, subscribing to events.');

        eventCallback = (event: any) => {
          console.log('KanbanPage: Received AG-UI event "deal_stage_updated", data:', event);
          // Ensure currentTenantId is up-to-date from the store if it can change reactively,
          // or rely on the value captured when onMount ran if it's static per page load.
          // For this example, using the `currentTenantId` variable updated by its own subscription.
          if (event.tenant && currentTenantId && event.tenant === currentTenantId) {
            console.log(`KanbanPage: Event is for current tenant (${currentTenantId}). Refreshing board data.`);
            fetchBoardData(); // Re-fetch data
          } else {
            console.log(`KanbanPage: Event tenant (${event.tenant}) does not match current tenant (${currentTenantId}). Ignoring.`);
          }
        };
        
        // Type for event for AG-UI: { type: string, data: any, tenant: string, timestamp: string }
        // We are interested in event.data for { dealId, newKanbanColumnId, dealName }
        copilot.on('deal_stage_updated', eventCallback);
      }
    });
  });

  onDestroy(() => {
    if (copilot && eventCallback) {
      console.log('KanbanPage: Unsubscribing from "deal_stage_updated" AG-UI event.');
      copilot.off('deal_stage_updated', eventCallback);
    }
    if (tenantIdUnsubscribe) {
      tenantIdUnsubscribe();
    }
  });

  async function fetchBoardData() {
    isLoading = true;
    error = null;
    try {
      const response = await makeAuthenticatedApiCall('/kanban/board');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to load Kanban board.' }));
        throw new Error(errData.message || `HTTP error ${response.status}`);
      }
      boardData = await response.json();
    } catch (e: any) {
      console.error('Fetch Kanban board error:', e);
      error = e.message || 'Failed to load Kanban board.';
      if (e.message.includes('Unauthorized')) logout();
    } finally {
      isLoading = false;
    }
  }
  
  async function fetchAllKanbanColumns() {
    // This could also be part of fetchBoardData response if backend supports it
    // Or fetched from a separate endpoint if CRUD for columns is implemented
    try {
      const response = await makeAuthenticatedApiCall('/kanban/columns'); // Assuming this endpoint exists from Kanban CRUD
      if (!response.ok) {
          console.warn('Could not fetch all columns for dropdown, functionality might be limited.');
          allKanbanColumns = boardData.map(col => ({ id: col.id, name: col.name, order: col.order, created_at: col.created_at, board_type: col.board_type }));
          return;
      }
      allKanbanColumns = await response.json();
      if (allKanbanColumns.length === 0 && boardData.length > 0) { // Fallback if /kanban/columns is empty but board has columns
          allKanbanColumns = boardData.map(col => ({ id: col.id, name: col.name, order: col.order, created_at: col.created_at, board_type: col.board_type }));
      }
    } catch (e) {
      console.warn('Error fetching all Kanban columns for dropdown:', e);
      // Fallback to using columns from boardData if separate fetch fails
      if (boardData.length > 0) {
        allKanbanColumns = boardData.map(col => ({ id: col.id, name: col.name, order: col.order, created_at: col.created_at, board_type: col.board_type }));
      }
    }
  }

  async function handleMoveDeal(deal: Deal, newKanbanColumnId: string) {
    if (!newKanbanColumnId || deal.kanban_column_id === newKanbanColumnId) {
      return; // No change or no selection
    }
    movingDealId = deal.id;
    moveError = null;
    try {
      const dealIdOnly = deal.id.split(':')[1]; // Assuming ID is like 'deals:uuid'
      const response = await makeAuthenticatedApiCall(
        `/deals/${dealIdOnly}/column`, // Endpoint from KanbanController
        {
          method: 'PATCH',
          body: JSON.stringify({ kanban_column_id: newKanbanColumnId }),
        }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to move deal.' }));
        throw new Error(errData.message || `HTTP error ${response.status}`);
      }
      // Refresh board data to reflect the change
      await fetchBoardData();
      // Consider a more optimistic update for better UX later
    } catch (e: any) {
      console.error('Move deal error:', e);
      moveError = e.message || 'Failed to move deal.';
    } finally {
      movingDealId = null;
    }
  }
</script>

<div class="container mx-auto p-6">
  <h1 class="text-3xl font-bold text-gray-800 mb-6">Kanban Board</h1>

  {#if isLoading}
    <p class="text-gray-600">Loading Kanban board...</p>
  {:else if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <strong class="font-bold">Error:</strong>
      <span class="block sm:inline">{error}</span>
      <button on:click={fetchBoardData} class="ml-4 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded">
        Retry
      </button>
    </div>
  {:else if boardData.length === 0}
    <p class="text-gray-600">No Kanban columns found. You might need to create some first.</p>
    <!-- TODO: Link to create Kanban columns if that CRUD is fully implemented -->
  {:else}
    {#if moveError}
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
        <span class="block sm:inline">Move Error: {moveError}</span>
      </div>
    {/if}
    <div class="flex space-x-4 overflow-x-auto pb-4">
      {#each boardData as column (column.id)}
        <div class="bg-gray-100 rounded-lg p-4 w-80 flex-shrink-0 shadow">
          <h2 class="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">{column.name} ({column.deals.length})</h2>
          <div class="space-y-3 min-h-[200px]">
            {#each column.deals as deal (deal.id)}
              <div class={`bg-white p-3 rounded-md shadow-sm hover:shadow-md transition-shadow ${movingDealId === deal.id ? 'opacity-50' : ''}`}>
                <h3 class="font-medium text-gray-800">{deal.name}</h3>
                <p class="text-sm text-gray-600">Value: {deal.value ? `${deal.value} ${deal.currency || 'USD'}` : 'N/A'}</p>
                {#if deal.contact_id}
                  <!-- Ideally, fetch contact name here or include in deal data from backend -->
                  <p class="text-xs text-gray-500">Contact ID: {deal.contact_id.split(':')[1]}</p>
                {/if}
                <div class="mt-2">
                  <label for={`move-deal-${deal.id}`} class="text-xs text-gray-500">Move to:</label>
                  <select 
                    id={`move-deal-${deal.id}`}
                    class="mt-1 block w-full text-xs p-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    on:change={(e) => handleMoveDeal(deal, e.currentTarget.value)}
                    disabled={movingDealId === deal.id}
                  >
                    <option value="" disabled selected={deal.kanban_column_id === ''}>Select column...</option>
                    {#each allKanbanColumns as colOption (colOption.id)}
                      <option value={colOption.id} selected={deal.kanban_column_id === colOption.id}>
                        {colOption.name}
                      </option>
                    {/each}
                  </select>
                </div>
              </div>
            {:else}
              <p class="text-sm text-gray-500 italic">No deals in this column.</p>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Tailwind is used via global.css */
  .overflow-x-auto::-webkit-scrollbar {
    height: 8px;
  }
  .overflow-x-auto::-webkit-scrollbar-thumb {
    background-color: #cbd5e1; /* cool-gray-300 */
    border-radius: 4px;
  }
  .overflow-x-auto::-webkit-scrollbar-thumb:hover {
    background-color: #94a3b8; /* cool-gray-400 */
  }
</style>
