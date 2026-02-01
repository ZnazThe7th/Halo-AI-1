/**
 * Google Authentication Service
 * Handles Google OAuth authentication flow
 */

export interface GoogleUserInfo {
  name: string;
  email: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

/**
 * Fetches user information from Google using the access token
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

    const data = await response.json();
    return {
      name: data.name || `${data.given_name || ''} ${data.family_name || ''}`.trim(),
      email: data.email,
      picture: data.picture,
      given_name: data.given_name,
      family_name: data.family_name,
    };
  } catch (error) {
    console.error('Error fetching Google user info:', error);
    throw error;
  }
}

/**
 * Extracts business name from user's email domain or uses a default
 */
export function extractBusinessName(email: string, fullName: string): string {
  // Try to extract domain name from email
  const domain = email.split('@')[1];
  if (domain && domain !== 'gmail.com' && domain !== 'yahoo.com' && domain !== 'outlook.com') {
    // Use domain as business name (capitalize first letter)
    return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
  }
  
  // Fallback to user's name + Business
  return `${fullName}'s Business`;
}
