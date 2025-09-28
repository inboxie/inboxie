// auth.js - Chrome Extension OAuth Authentication
class ExtensionAuth {
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Check if user is authenticated by checking for valid Gmail token
   */
  async isAuthenticated() {
    try {
      const token = await this.getGmailToken(false); // Non-interactive check
      return !!token;
    } catch (error) {
      console.log('Not authenticated:', error.message);
      return false;
    }
  }

  /**
   * Authenticate user using Chrome's identity API
   */
  async authenticate() {
    try {
      console.log('Starting Chrome OAuth authentication...');
      
      // Request Gmail permissions directly through Chrome
      const token = await this.getGmailToken(true); // Interactive flow
      
      if (token) {
        console.log('Gmail OAuth successful!');
        
        // Store token locally
        await this.storeGmailToken(token);
        
        // Get user profile for identification
        const userInfo = await this.getUserProfile(token);
        console.log('Authenticated as:', userInfo.email);
        
        return true;
      } else {
        throw new Error('Failed to get Gmail token');
      }

    } catch (error) {
      console.error('Chrome OAuth failed:', error);
      alert(`Authentication failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get Gmail OAuth token using Chrome identity API
   */
  async getGmailToken(interactive = false) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({
        interactive: interactive,
        scopes: [
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/gmail.labels',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ]
      }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (token) {
          resolve(token);
        } else {
          reject(new Error('No token received'));
        }
      });
    });
  }

  /**
   * Get user profile from Google
   */
  async getUserProfile(token) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get user profile');
    }
    
    return await response.json();
  }

  /**
   * Store Gmail token
   */
  async storeGmailToken(token) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({
        'gmail_token': token,
        'auth_timestamp': Date.now()
      }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get stored Gmail token
   */
  async getStoredGmailToken() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['gmail_token'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.gmail_token || null);
        }
      });
    });
  }

  /**
   * Make API calls to your backend with Gmail token
   */
  async apiCall(endpoint, options = {}) {
    try {
      // Get fresh Gmail token (Chrome handles refresh automatically)
      const gmailToken = await this.getGmailToken(false);
      
      if (!gmailToken) {
        throw new Error('Not authenticated - please log in');
      }

      const headers = {
        'Content-Type': 'application/json',
        'X-Gmail-Token': gmailToken, // Send Gmail token to your backend
        ...options.headers
      };

      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        // Token expired - clear and require re-auth
        await this.clearAuth();
        throw new Error('Session expired - please log in again');
      }

      return response;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }

  /**
   * Clear stored authentication
   */
  async clearAuth() {
    return new Promise((resolve, reject) => {
      // Clear token from Chrome storage
      chrome.storage.local.remove(['gmail_token', 'auth_timestamp'], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          // Also revoke the token with Google
          chrome.identity.removeCachedAuthToken({
            token: this.lastToken
          }, () => {
            console.log('Authentication cleared');
            resolve();
          });
        }
      });
    });
  }

  /**
   * Sign out user
   */
  async signOut() {
    await this.clearAuth();
    alert('Signed out successfully. Refresh Gmail to see changes.');
  }
}

window.ExtensionAuth = ExtensionAuth;