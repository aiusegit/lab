import { writable, get } from 'svelte/store';
import { backendUrl } from '../config'; // Ensure this path is correct

const IS_BROWSER = typeof window !== 'undefined';

// Helper to safely access localStorage
const safeLocalStorageGet = (key: string) => {
  if (!IS_BROWSER) return null;
  return localStorage.getItem(key);
};

const safeLocalStorageSet = (key: string, value: string) => {
  if (!IS_BROWSER) return;
  localStorage.setItem(key, value);
};

const safeLocalStorageRemove = (key: string) => {
  if (!IS_BROWSER) return;
  localStorage.removeItem(key);
};

// Initial state
const initialToken = safeLocalStorageGet('jwt_token');
const initialTenantId = safeLocalStorageGet('tenant_id');
const initialUserEmail = safeLocalStorageGet('user_email'); // Storing email for display convenience

export const jwtToken = writable<string | null>(initialToken);
export const tenantId = writable<string | null>(initialTenantId);
export const userEmail = writable<string | null>(initialUserEmail); // For display purposes
export const isLoggedIn = writable<boolean>(!!initialToken);
export const authError = writable<string | null>(null);

// Update localStorage when stores change
jwtToken.subscribe(value => safeLocalStorageSet('jwt_token', value || ''));
tenantId.subscribe(value => safeLocalStorageSet('tenant_id', value || ''));
userEmail.subscribe(value => safeLocalStorageSet('user_email', value || ''));
isLoggedIn.subscribe(value => {
  if (!value) { // When logging out, clear related localStorage
    safeLocalStorageRemove('jwt_token');
    safeLocalStorageRemove('tenant_id');
    safeLocalStorageRemove('user_email');
  }
});


export const login = async (emailInput: string, passwordInput: string, tenantIdInput: string) => {
  authError.set(null);
  try {
    const response = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantIdInput, // Send tenant_id as a header
      },
      body: JSON.stringify({ email: emailInput, password: passwordInput }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    if (data.accessToken) {
      jwtToken.set(data.accessToken);
      tenantId.set(tenantIdInput); // Store the tenantId used for login
      userEmail.set(emailInput); // Store email for display
      isLoggedIn.set(true);
      if (IS_BROWSER) {
        window.location.href = '/dashboard'; // Or any other protected page
      }
      return true;
    } else {
      throw new Error(data.message || 'Login failed: No access token received');
    }
  } catch (error: any) {
    authError.set(error.message || 'An unknown error occurred during login.');
    console.error('Login error:', error);
    isLoggedIn.set(false);
    return false;
  }
};

export const logout = () => {
  jwtToken.set(null);
  tenantId.set(null);
  userEmail.set(null);
  isLoggedIn.set(false);
  authError.set(null);
  if (IS_BROWSER) {
    window.location.href = '/login';
  }
};

export const makeAuthenticatedApiCall = async (urlPath: string, options: RequestInit = {}) => {
  const token = get(jwtToken);
  const currentTenantId = get(tenantId);

  if (!token || !currentTenantId) {
    // This could also redirect to login or throw a specific error
    // For now, let logout handle redirect if critical.
    logout(); // Ensure user is logged out if token/tenantId is missing
    throw new Error('Not authenticated or tenant ID missing. Please login again.');
  }

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-tenant-id': currentTenantId,
  };

  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${backendUrl}${urlPath}`, mergedOptions);
    if (response.status === 401) { // Unauthorized
      logout(); // Token might be expired or invalid
      throw new Error('Unauthorized. Please login again.');
    }
    // Do not assume all responses are JSON here. Let caller handle .json()
    return response;
  } catch (error) {
    console.error('API call error:', error);
    // If it's an auth error, logout might have already been called.
    // Re-throw to allow component-level error handling.
    throw error; 
  }
};

// Initialize isLoggedIn based on token presence during script load
if (IS_BROWSER) {
    isLoggedIn.set(!!get(jwtToken));
}
