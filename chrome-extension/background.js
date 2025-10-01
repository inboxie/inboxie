// background.js - Service Worker with Direct Chrome OAuth
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticate') {
    handleAuthentication(request.apiBaseUrl)
      .then(result => sendResponse({ success: true, userInfo: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'validateToken') {
    validateTokenWithBackend(request.apiBaseUrl)
      .then(result => sendResponse({ success: true, valid: result.valid, userInfo: result.userInfo }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'clearAuthCache') {
    clearChromeAuthCache()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function handleAuthentication(apiBaseUrl) {
  try {
    const gmailToken = await getChromeGmailToken();
    
    if (!gmailToken) {
      throw new Error('Failed to get Gmail token from Chrome');
    }
    
    const userInfo = await authenticateWithBackend(gmailToken, apiBaseUrl);
    
    await storeGmailToken(gmailToken);
    
    return userInfo;
    
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

async function getChromeGmailToken() {
  return new Promise((resolve, reject) => {
    // First, clear any cached token
    chrome.identity.getAuthToken({ interactive: false }, (cachedToken) => {
      if (cachedToken) {
        chrome.identity.removeCachedAuthToken({ token: cachedToken }, () => {
          requestNewToken(resolve, reject);
        });
      } else {
        requestNewToken(resolve, reject);
      }
    });
  });
}

function requestNewToken(resolve, reject) {
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
      console.error('Chrome identity error:', chrome.runtime.lastError);
      reject(chrome.runtime.lastError);
    } else if (token) {
      resolve(token);
    } else {
      reject(new Error('No Gmail token received'));
    }
  });
}

async function clearChromeAuthCache() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token: token }, () => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

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

async function validateTokenWithBackend(apiBaseUrl) {
  try {
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
    console.error('Token validation failed:', error);
    return { valid: false, userInfo: null };
  }
}

async function storeGmailToken(gmailToken) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({
      'gmail_token': gmailToken,
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