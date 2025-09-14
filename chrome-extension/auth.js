// auth.js - Content Script with Background Communication
class ExtensionAuth {
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl;
    this.extensionId = chrome.runtime.id;
  }

  /**
   * Check if user is authenticated by validating stored token
   */
  async isAuthenticated() {
    try {
      const token = await this.getStoredToken();
      if (!token) return false;

      // Use background script to validate token
      return await this.sendMessageToBackground('validateToken', {
        token: token,
        apiBaseUrl: this.apiBaseUrl
      });
    } catch (error) {
      console.error('Authentication check failed:', error);
      return false;
    }
  }

  /**
   * Authenticate user using background script
   */
  async authenticate() {
    try {
      console.log('Content: Starting authentication...');
      
      // Send authentication request to background script
      const result = await this.sendMessageToBackground('authenticate', {
        apiBaseUrl: this.apiBaseUrl
      });
      
      if (result.success) {
        console.log('Content: Authentication successful!');
        return true;
      } else {
        throw new Error(result.error || 'Authentication failed');
      }

    } catch (error) {
      console.error('Content: Authentication failed:', error);
      console.error('Content: Error details:', error.message);
      console.error('Content: Full error object:', error);
      alert(`Authentication failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Send message to background script
   */
  async sendMessageToBackground(action, data) {
    return new Promise((resolve, reject) => {
      console.log(`Content: Sending message to background - Action: ${action}`, data);
      
      chrome.runtime.sendMessage({ action, ...data }, (response) => {
        console.log('Content: Received response from background:', response);
        
        if (chrome.runtime.lastError) {
          console.error('Content: Runtime error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else if (!response) {
          console.error('Content: No response from background script');
          reject(new Error('No response from background script'));
        } else if (response.success) {
          resolve(response);
        } else {
          console.error('Content: Background script returned error:', response.error);
          reject(new Error(response.error || 'Unknown error'));
        }
      });
    });
  }

  /**
   * Make authenticated API calls with both tokens
   */
  async apiCall(endpoint, options = {}) {
    const jwtToken = await this.getStoredToken();
    const googleToken = await this.getStoredGoogleToken();
    
    if (!jwtToken) {
      throw new Error('Not authenticated - please log in');
    }

    const headers = {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add Google token for Gmail API calls
    if (googleToken) {
      headers['X-Google-Token'] = googleToken;
    }

    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      // Token expired or invalid - clear it and require re-auth
      await this.clearAuth();
      throw new Error('Session expired - please log in again');
    }

    return response;
  }

  /**
   * Get stored JWT token
   */
  async getStoredToken() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['inboxie_jwt_token', 'inboxie_auth_timestamp'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          // Check if token exists and isn't too old (30 days as per backend)
          const token = result.inboxie_jwt_token;
          const timestamp = result.inboxie_auth_timestamp;
          
          if (!token || !timestamp) {
            resolve(null);
            return;
          }

          // Check if token is older than 29 days (give 1 day buffer)
          const daysDiff = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
          if (daysDiff > 29) {
            // Token too old, clear it
            this.clearAuth();
            resolve(null);
          } else {
            resolve(token);
          }
        }
      });
    });
  }

  /**
   * Get stored Google OAuth token
   */
  async getStoredGoogleToken() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['inboxie_google_token'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.inboxie_google_token || null);
        }
      });
    });
  }

  /**
   * Clear stored authentication
   */
  async clearAuth() {
    return new Promise((resolve, reject) => {
      // Clear both tokens from Chrome storage
      chrome.storage.local.remove([
        'inboxie_jwt_token', 
        'inboxie_google_token',
        'inboxie_auth_timestamp'
      ], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log('Authentication cleared');
          resolve();
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

  /**
   * Get user info (placeholder for future use)
   */
  getUserInfo() {
    return null;
  }

  /**
   * Load stored auth (placeholder for compatibility)
   */
  async loadStoredAuth() {
    return await this.getStoredToken();
  }
}

window.ExtensionAuth = ExtensionAuth;