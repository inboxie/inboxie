// background.js - Service Worker with Direct Chrome OAuth
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticate') {
    handleAuthentication(request.apiBaseUrl)
      .then(result => sendResponse({ success: true, userInfo: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'validateToken') {
    validateTokenWithBackend(request.apiBaseUrl)
      .then(result => sendResponse({ success: true, valid: result.valid, userInfo: result.userInfo }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * Handle Chrome OAuth authentication flow with backend validation
 */
async function handleAuthentication(apiBaseUrl) {
  try {
    console.log('Background: Starting Chrome OAuth authentication...');
    
    // Get Gmail OAuth token using Chrome identity API
    const gmailToken = await getChromeGmailToken();
    
    if (!gmailToken) {
      throw new Error('Failed to get Gmail token from Chrome');
    }
    
    console.log('Background: Got Gmail token, validating with backend...');
    
    // Authenticate with backend using Gmail token
    const userInfo = await authenticateWithBackend(gmailToken, apiBaseUrl);
    
    // Store Gmail token for future API calls
    await storeGmailToken(gmailToken);
    
    console.log('Background: Authentication successful!', userInfo.email);
    return userInfo;
    
  } catch (error) {
    console.error('Background: Authentication failed:', error);
    throw error;
  }
}

/**
 * Get Gmail OAuth token using Chrome identity API
 */
async function getChromeGmailToken() {
  return new Promise((resolve, reject) => {
    console.log('Background: Requesting Gmail permissions...');
    
    chrome.identity.getAuthToken({
      interactive: true,
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.labels',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ]
    }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('Background: Chrome identity error:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else if (token) {
        console.log('Background: Gmail token received successfully');
        resolve(token);
      } else {
        reject(new Error('No Gmail token received'));
      }
    });
  });
}

/**
 * Authenticate with backend using Gmail token
 */
async function authenticateWithBackend(gmailToken, apiBaseUrl) {
  const response = await fetch(`${apiBaseUrl}/api/auth/extension`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      googleToken: gmailToken,
      extensionId: chrome.runtime.id
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Backend auth failed: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  if (!data.success || !data.user) {
    throw new Error('Invalid response from backend');
  }

  return data.user;
}

/**
 * Validate authentication status with backend
 */
async function validateTokenWithBackend(apiBaseUrl) {
  try {
    // Get stored Gmail token
    const gmailToken = await getStoredGmailToken();
    
    if (!gmailToken) {
      return { valid: false, userInfo: null };
    }

    const response = await fetch(`${apiBaseUrl}/api/auth/extension`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Gmail-Token': gmailToken
      }
    });

    if (response.ok) {
      const data = await response.json();
      return { 
        valid: data.success, 
        userInfo: data.success ? data.user : null 
      };
    } else {
      return { valid: false, userInfo: null };
    }
  } catch (error) {
    console.error('Background: Token validation failed:', error);
    return { valid: false, userInfo: null };
  }
}

/**
 * Store Gmail token in Chrome storage
 */
async function storeGmailToken(gmailToken) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({
      'gmail_token': gmailToken,
      'auth_timestamp': Date.now()
    }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        console.log('Background: Gmail token stored');
        resolve();
      }
    });
  });
}

/**
 * Get stored Gmail token
 */
async function getStoredGmailToken() {
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