import { readable } from 'svelte/store';
import { CopilotKit } from '@copilotkit/client'; // Assuming this is the correct package
import { backendUrl } from '../config'; // VITE_BACKEND_URL used by CopilotKit for its backend communication if needed

// The AGUI_PROXY_URL is for the CopilotKit client to connect to the AG-UI Proxy for real-time events.
// This is different from the backendUrl which is for standard API calls.
const VITE_AGUI_PROXY_URL = import.meta.env.VITE_AGUI_PROXY_URL;

if (!VITE_AGUI_PROXY_URL) {
  console.warn('VITE_AGUI_PROXY_URL is not defined in environment variables. CopilotKit real-time features might be affected.');
}

// Initialize CopilotKit.
// The 'url' parameter for CopilotKit constructor is typically for its own backend communication,
// not necessarily the AG-UI proxy for *receiving* events unless the AG-UI proxy is also the CopilotKit backend.
// For AG-UI event subscription, the CopilotKit client might have a different setup or use a WebSocket connection
// to the AG-UI proxy directly.
// The documentation for AG-UI event subscription via CopilotKit client is assumed here.
// If CopilotKit's `url` is indeed for eventing:
const copilot = new CopilotKit({ 
  // This URL might be for the CopilotKit backend, not directly the event source from AG-UI proxy.
  // For AG-UI spec, the client typically connects to the AG-UI proxy's /ws endpoint for events.
  // Let's assume CopilotKit's client handles this abstraction or needs a specific AG-UI eventing URL.
  // If VITE_AGUI_PROXY_URL is "http://localhost:3001", then the WebSocket URL would likely be "ws://localhost:3001/ws".
  // For now, let's assume CopilotKit handles this. If it has a dedicated method for AG-UI event source, that should be used.
  // Given the prompt, it seems like `url` is intended for this.
  url: VITE_AGUI_PROXY_URL || backendUrl, // Fallback to backendUrl if AGUI_PROXY_URL is not set, though might not work for events.
  // Other CopilotKit options if needed
});

// Expose the CopilotKit instance through a readable store
export const copilotStore = readable<CopilotKit>(copilot);

// Example of how one might access the AG-UI event bus if CopilotKit provides it directly
// This is speculative based on common patterns, actual API might differ.
// export const agUiEventBus = copilot.agUiEventBus; // or copilot.events, copilot.getEventBus('ag-ui') etc.

// For the purpose of the task, we'll assume `copilot.on()` and `copilot.off()` work for AG-UI events
// as described in the prompt, implying CopilotKit itself connects to the AG-UI event source.

console.log("CopilotKit Store Initialized. AG-UI Proxy URL:", VITE_AGUI_PROXY_URL);

// A note on CopilotKit and AG-UI eventing:
// The AG-UI Protocol typically specifies a WebSocket endpoint (e.g., /ws) on the AG-UI Proxy for clients to subscribe to events.
// The CopilotKit client library would need to connect to this WebSocket.
// The `new CopilotKit({ url: VITE_AGUI_PROXY_URL })` initialization might be simplified.
// If `CopilotKit`'s `url` parameter is for its *own* backend services (e.g., for AI features, not generic eventing),
// then direct WebSocket connection to `VITE_AGUI_PROXY_URL/ws` might be needed, or CopilotKit might offer a
// specific method like `copilot.connectToAgUiProxy(VITE_AGUI_PROXY_URL_FOR_WEBSOCKETS)`.
// For this implementation, I am following the prompt's implication that `copilot.on()` will handle this.
// If `VITE_AGUI_PROXY_URL` is `http://localhost:3001`, the WebSocket might be `ws://localhost:3001` or `ws://localhost:3001/ws`.
// I'll assume `CopilotKit` handles this detail.

// If `@copilotkit/client` is purely for the chat UI and AI backend, and doesn't handle generic AG-UI eventing,
// then a separate WebSocket client (like `socket.io-client` or native WebSocket) would be needed to connect to the AG-UI Proxy.
// However, the prompt implies CopilotKit is used for this.
// The package `@copilotkit/client` is usually for frontend UI components and backend interaction.
// The package for AG-UI event subscription might be different or part of a broader CopilotKit ecosystem.
// Let's proceed with the assumption that `copilot.on` is the correct API from `@copilotkit/client`.
