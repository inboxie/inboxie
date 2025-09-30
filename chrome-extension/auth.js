// auth.js - Chrome Extension OAuth Authentication with Background Communication
class ExtensionAuth {
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl;
    this.userInfo = null;
  }

  async isAuthenticated() {
    try {
      const result = await this.sendMessageToBackground('validateToken', {
        apiBaseUrl: this.apiBaseUrl
      });
      
      if (result.success && result.valid) {
        this.userInfo = result.userInfo;
        return true;
      }
      
      return false;
    } catch (error) {
      console.log('Not authenticated:', error.message);
      return false;
    }
  }

  async authenticate() {
    try {
      console.log('Starting Chrome OAuth authentication...');
      
      const result = await this.sendMessageToBackground('authenticate', {
        apiBaseUrl: this.apiBaseUrl
      });
      
      if (result.success) {
        this.userInfo = result.userInfo;
        console.log('Authentication successful! User:', result.userInfo.email);
        console.log('Plan:', result.userInfo.planType, '| Emails processed:', result.userInfo.emailsProcessed);
        return true;
      } else {
        throw new Error(result.error || 'Authentication failed');
      }

    } catch (error) {
      console.error('Chrome OAuth failed:', error);
      alert(`Authentication failed: ${error.message}`);
      return false;
    }
  }

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
        } else {
          resolve(response);
        }
      });
    });
  }

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

  async apiCall(endpoint, options = {}) {
    try {
      const gmailToken = await this.getStoredGmailToken();
      
      if (!gmailToken) {
        throw new Error('Not authenticated - please log in');
      }

      const headers = {
        'Content-Type': 'application/json',
        'X-Gmail-Token': gmailToken,
        ...options.headers
      };

      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        await this.clearAuth();
        throw new Error('Session expired - please log in again');
      }

      return response;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }

  getUserInfo() {
    return this.userInfo;
  }

  async clearAuth() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(['gmail_token', 'auth_timestamp'], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log('Authentication cleared');
          this.userInfo = null;
          resolve();
        }
      });
    });
  }

  async signOut() {
    // Clear Chrome's OAuth cache
    await this.sendMessageToBackground('clearAuthCache', {});
    
    // Clear local storage
    await this.clearAuth();
    
    alert('Signed out successfully. Refresh Gmail to see changes.');
  }
}

window.ExtensionAuth = ExtensionAuth;