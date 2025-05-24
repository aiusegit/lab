const VITE_BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

if (!VITE_BACKEND_URL) {
  throw new Error('VITE_BACKEND_URL is not defined in environment variables');
}

export const backendUrl = VITE_BACKEND_URL;

// Optional: Default tenant ID for login form, for development convenience
// export const defaultTenantIdForLogin = import.meta.env.VITE_DEFAULT_TENANT_ID_FOR_LOGIN || '';
// export const defaultEmailForLogin = import.meta.env.VITE_DEFAULT_EMAIL_FOR_LOGIN || '';
// export const defaultPasswordForLogin = import.meta.env.VITE_DEFAULT_PASSWORD_FOR_LOGIN || '';
