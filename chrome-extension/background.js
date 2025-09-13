// background.js - Service Worker with OAuth handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'authenticate') {
      handleAuthentication(request.apiBaseUrl)
        .then(result => sendResponse({ success: true, token: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response
    }
    
    if (request.action === 'validateToken') {
      validateToken(request.token, request.apiBaseUrl)
        .then(valid => sendResponse({ success: true, valid: valid }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
  });
  
  /**
   * Handle OAuth authentication flow
   */
  async function handleAuthentication(apiBaseUrl) {
    try {
      console.log('Background: Starting OAuth authentication...');
      
      // Get OAuth token using Chrome identity API
      const googleToken = await getChromeIdentityToken();
      
      if (!googleToken) {
        throw new Error('Failed to get OAuth token from Chrome');
      }
      
      console.log('Background: Got Chrome token, exchanging with backend...');
      
      // Exchange Google token for backend JWT
      const backendToken = await exchangeTokenWithBackend(googleToken, apiBaseUrl);
      
      // Store the backend JWT token
      await storeToken(backendToken);
      
      console.log('Background: Authentication successful!');
      return backendToken;
      
    } catch (error) {
      console.error('Background: Authentication failed:', error);
      throw error;
    }
  }
  
  /**
   * Get OAuth token using Chrome identity API
   */
  async function getChromeIdentityToken() {
    return new Promise((resolve, reject) => {
      const redirectUrl = chrome.identity.getRedirectURL();
      const clientId = '133159620285-a1pmrljedhia4afuv0o639i1u22vobpp.apps.googleusercontent.com';
      
      const authUrl = `https://accounts.google.com/oauth/authorize?` +
        `client_id=${clientId}&` +
        `response_type=token&` +
        `scope=email%20profile%20openid&` +
        `redirect_uri=${encodeURIComponent(redirectUrl)}`;
  
      console.log('Background: Starting OAuth with URL:', authUrl);
      console.log('Background: Redirect URL:', redirectUrl);
  
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, (responseUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Background: Chrome identity error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else if (responseUrl) {
          console.log('Background: OAuth response URL received');
          // Extract access token from response URL
          const url = new URL(responseUrl);
          const fragment = url.hash.substring(1);
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          
          if (accessToken) {
            console.log('Background: Access token extracted successfully');
            resolve(accessToken);
          } else {
            reject(new Error('No access token found in response'));
          }
        } else {
          reject(new Error('No response URL received'));
        }
      });
    });
  }
  
  /**
   * Exchange Google OAuth token for backend JWT token
   */
  async function exchangeTokenWithBackend(googleToken, apiBaseUrl) {
    const response = await fetch(`${apiBaseUrl}/api/extension/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        googleToken: googleToken,
        extensionId: chrome.runtime.id
      })
    });
  
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Backend auth failed: ${error.error || response.statusText}`);
    }
  
    const data = await response.json();
    if (!data.success || !data.token) {
      throw new Error('Invalid response from backend');
    }
  
    return data.token;
  }
  
  /**
   * Validate token with backend
   */
  async function validateToken(token, apiBaseUrl) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/extension/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Background: Token validation failed:', error);
      return false;
    }
  }
  
  /**
   * Store JWT token in Chrome storage
   */
  async function storeToken(token) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({
        'inboxie_jwt_token': token,
        'inboxie_auth_timestamp': Date.now()
      }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }