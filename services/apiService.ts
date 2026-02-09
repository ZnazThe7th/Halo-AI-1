/**
 * API Service for communicating with the backend
 * Handles authentication and data persistence
 */

// @ts-ignore - Vite environment variables
// In production (Vercel), use same-origin /api routes. Locally, use the backend dev server.
const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '/api' : 'http://localhost:3001');

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Authenticate with Google OAuth token
 */
export async function authenticateWithGoogle(accessToken: string): Promise<ApiResponse<{ email: string; sessionId: string }>> {
  try {
    const response = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({ accessToken }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Server error' }));
      return { error: error.error || 'Authentication failed' };
    }

    const data = await response.json();
    return { data };
  } catch (error: any) {
    // If it's a network error (backend not available), return a special error
    if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
      console.warn('Backend API not available, will use localStorage-only mode');
      return { error: 'API_UNAVAILABLE' }; // Special error code
    }
    console.error('Google auth API error:', error);
    return { error: 'Failed to authenticate with server' };
  }
}

/**
 * Sign up with email and password
 */
export async function signupWithEmail(email: string, password: string): Promise<ApiResponse<{ email: string; sessionId: string }>> {
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Server error' }));
      return { error: error.error || 'Signup failed' };
    }

    const data = await response.json();
    return { data };
  } catch (error: any) {
    // If it's a network error (backend not available), return a special error
    if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
      console.warn('Backend API not available, will use localStorage-only mode');
      return { error: 'API_UNAVAILABLE' }; // Special error code
    }
    console.error('Signup API error:', error);
    return { error: 'Failed to create account' };
  }
}

/**
 * Authenticate with email and password (for email/password sign-in)
 */
export async function authenticateWithEmail(email: string, password: string): Promise<ApiResponse<{ email: string; sessionId: string }>> {
  try {
    const response = await fetch(`${API_URL}/auth/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Server error' }));
      return { error: error.error || 'Authentication failed' };
    }

    const data = await response.json();
    return { data };
  } catch (error: any) {
    // If it's a network error (backend not available), return a special error
    if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
      console.warn('Backend API not available, will use localStorage-only mode');
      return { error: 'API_UNAVAILABLE' }; // Special error code
    }
    console.error('Email auth API error:', error);
    return { error: 'Failed to authenticate with server' };
  }
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<ApiResponse<{ email: string }>> {
  try {
    const response = await fetch(`${API_URL}/me`, {
      method: 'GET',
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { error: 'Not authenticated' };
      }
      const error = await response.json();
      return { error: error.error || 'Failed to get user' };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('Get user API error:', error);
    return { error: 'Failed to get user from server' };
  }
}

/**
 * Save user data to database
 */
export async function saveUserData(data: {
  businessProfile: any;
  clients: any[];
  appointments: any[];
  expenses: any[];
  ratings: any[];
  bonusEntries?: any[];
}): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const response = await fetch(`${API_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { error: 'Not authenticated' };
      }
      const error = await response.json().catch(() => ({ error: 'Server error' }));
      return { error: error.error || 'Failed to save data' };
    }

    const result = await response.json();
    return { data: result };
  } catch (error: any) {
    // If it's a network error (backend not available), return special error
    if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
      console.warn('Backend API not available for saving data');
      return { error: 'API_UNAVAILABLE' };
    }
    console.error('Save data API error:', error);
    return { error: 'Failed to save data to server' };
  }
}

/**
 * Load user data from database
 */
export async function loadUserData(): Promise<ApiResponse<{
  businessProfile: any;
  clients: any[];
  appointments: any[];
  expenses: any[];
  ratings: any[];
  bonusEntries: any[];
}>> {
  try {
    const response = await fetch(`${API_URL}/load`, {
      method: 'GET',
      credentials: 'include', // Include cookies
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { error: 'Not authenticated' };
      }
      const error = await response.json().catch(() => ({ error: 'Server error' }));
      return { error: error.error || 'Failed to load data' };
    }

    const data = await response.json();
    
    // Ensure all arrays exist (backend might return null)
    return { 
      data: {
        businessProfile: data.businessProfile || null,
        clients: data.clients || [],
        appointments: data.appointments || [],
        expenses: data.expenses || [],
        ratings: data.ratings || [],
        bonusEntries: data.bonusEntries || []
      }
    };
  } catch (error: any) {
    // If it's a network error (backend not available), return special error
    if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
      console.warn('Backend API not available for loading data');
      return { error: 'API_UNAVAILABLE' };
    }
    console.error('Load data API error:', error);
    return { error: 'Failed to load data from server' };
  }
}

/**
 * Logout and clear session
 */
export async function logout(): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const response = await fetch(`${API_URL}/logout`, {
      method: 'POST',
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || 'Failed to logout' };
    }

    const result = await response.json();
    return { data: result };
  } catch (error) {
    console.error('Logout API error:', error);
    return { error: 'Failed to logout from server' };
  }
}

// ================================================================
// SAVEPOINT API
// ================================================================

import { getDeviceFingerprint } from './deviceFingerprint';

export interface SavePointMeta {
  id: string;
  label: string;
  snapshot_version: number;
  device_type: string;
  device_name: string;
  created_at: string;
}

export interface SavePointFull extends SavePointMeta {
  user_email: string;
  device_id: string | null;
  snapshot_json: any;
}

/**
 * Create a new save point
 */
export async function createSavePoint(label: string, snapshot: any, snapshotVersion: number): Promise<ApiResponse<SavePointMeta>> {
  try {
    const response = await fetch(`${API_URL}/savepoints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': getDeviceFingerprint(),
      },
      credentials: 'include',
      body: JSON.stringify({ label, snapshot, snapshotVersion }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      if (response.status === 401) return { error: 'Not authenticated' };
      const error = await response.json().catch(() => ({ error: 'Server error' }));
      return { error: error.error || 'Failed to create save point' };
    }

    const data = await response.json();
    return { data };
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
      return { error: 'API_UNAVAILABLE' };
    }
    console.error('Create savepoint API error:', error);
    return { error: 'Failed to create save point' };
  }
}

/**
 * List all save points (most recent first)
 */
export async function listSavePoints(): Promise<ApiResponse<SavePointMeta[]>> {
  try {
    const response = await fetch(`${API_URL}/savepoints`, {
      method: 'GET',
      credentials: 'include',
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      if (response.status === 401) return { error: 'Not authenticated' };
      const error = await response.json().catch(() => ({ error: 'Server error' }));
      return { error: error.error || 'Failed to list save points' };
    }

    const data = await response.json();
    return { data };
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
      return { error: 'API_UNAVAILABLE' };
    }
    console.error('List savepoints API error:', error);
    return { error: 'Failed to list save points' };
  }
}

/**
 * Fetch one save point (with full snapshot)
 */
export async function getSavePoint(id: string): Promise<ApiResponse<SavePointFull>> {
  try {
    const response = await fetch(`${API_URL}/savepoints/${id}`, {
      method: 'GET',
      credentials: 'include',
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      if (response.status === 401) return { error: 'Not authenticated' };
      if (response.status === 404) return { error: 'Save point not found' };
      const error = await response.json().catch(() => ({ error: 'Server error' }));
      return { error: error.error || 'Failed to get save point' };
    }

    const data = await response.json();
    return { data };
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
      return { error: 'API_UNAVAILABLE' };
    }
    console.error('Get savepoint API error:', error);
    return { error: 'Failed to get save point' };
  }
}

/**
 * Delete a save point
 */
export async function deleteSavePoint(id: string): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const response = await fetch(`${API_URL}/savepoints/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      if (response.status === 401) return { error: 'Not authenticated' };
      const error = await response.json().catch(() => ({ error: 'Server error' }));
      return { error: error.error || 'Failed to delete save point' };
    }

    const data = await response.json();
    return { data };
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
      return { error: 'API_UNAVAILABLE' };
    }
    console.error('Delete savepoint API error:', error);
    return { error: 'Failed to delete save point' };
  }
}

/**
 * Send test daily email (for testing purposes)
 */
export async function sendTestDailyEmail(): Promise<ApiResponse<{ message: string; sent: number }>> {
  try {
    const response = await fetch(`${API_URL}/send-daily-emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
      body: JSON.stringify({ test: true }), // Mark as test
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Server error' }));
      return { error: error.error || 'Failed to send test email' };
    }

    const data = await response.json();
    return { data };
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
      return { error: 'API_UNAVAILABLE' };
    }
    console.error('Send test email API error:', error);
    return { error: 'Failed to send test email' };
  }
}
