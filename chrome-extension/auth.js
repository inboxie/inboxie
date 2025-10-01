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
      return false;
    }
  }

  async authenticate() {
    try {
      const result = await this.sendMessageToBackground('authenticate', {
        apiBaseUrl: this.apiBaseUrl
      });
      
      if (result.success) {
        this.userInfo = result.userInfo;
        return true;
      } else {
        throw new Error(result.error || 'Authentication failed');
      }

    } catch (error) {
      alert(`Authentication failed: ${error.message}`);
      return false;
    }
  }

  async sendMessageToBackground(action, data) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (!response) {
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
          this.userInfo = null;
          resolve();
        }
      });
    });
  }

  async signOut() {
    await this.sendMessageToBackground('clearAuthCache', {});
    await this.clearAuth();
    alert('Signed out successfully. Refresh Gmail to see changes.');
  }
}

window.ExtensionAuth = ExtensionAuth;