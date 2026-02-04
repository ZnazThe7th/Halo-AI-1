/**
 * API Service for communicating with the backend
 * Handles authentication and data persistence
 */

const API_URL = import.meta.env.VITE_API_URL || process.env.VITE_API_URL || 'http://localhost:3001';

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
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || 'Authentication failed' };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('Google auth API error:', error);
    return { error: 'Failed to authenticate with server' };
  }
}

/**
 * Authenticate with email (for email/password sign-in)
 */
export async function authenticateWithEmail(email: string): Promise<ApiResponse<{ email: string; sessionId: string }>> {
  try {
    const response = await fetch(`${API_URL}/auth/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || 'Authentication failed' };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
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
}): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const response = await fetch(`${API_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { error: 'Not authenticated' };
      }
      const error = await response.json();
      return { error: error.error || 'Failed to save data' };
    }

    const result = await response.json();
    return { data: result };
  } catch (error) {
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
}>> {
  try {
    const response = await fetch(`${API_URL}/load`, {
      method: 'GET',
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { error: 'Not authenticated' };
      }
      const error = await response.json();
      return { error: error.error || 'Failed to load data' };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
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
