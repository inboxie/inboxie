console.log('Inboxie content script loaded!');

// Configuration
const API_BASE_URL = 'https://inboxie.ai';;
const auth = new ExtensionAuth(API_BASE_URL);

// State management
let dashboardData = {
  emailsOrganized: 0,
  emailsLimit: 500,
  importRemaining: 0,
  planType: 'free',
  isProcessing: false,
  isAuthenticated: false,
  replyStats: { totalReplies: 0, highUrgency: 0, mediumUrgency: 0, lowUrgency: 0 }
};

// Wait for Gmail to load
setTimeout(() => {
  console.log('Injecting Inboxie dashboard...');
  injectDashboard();
  fetchDashboardData();
  setInterval(fetchDashboardData, 30000);
}, 2000);

// Fetch data from backend
async function fetchDashboardData() {
  try {
    const response = await auth.apiCall('/api/get-user-stats');
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        const stats = result.data;
        dashboardData = {
          emailsOrganized: stats.user?.emailsProcessed || 0,
          emailsLimit: stats.user?.limit || 500,
          importRemaining: stats.user?.remaining || 0,
          planType: stats.user?.planType || 'free',
          isProcessing: false,
          isAuthenticated: true,
          replyStats: stats.replyStats || { totalReplies: 0, highUrgency: 0, mediumUrgency: 0, lowUrgency: 0 }
        };
        updateDashboardUI();
        console.log('Data loaded successfully!');
        return;
      }
    }
  } catch (error) {
    console.log('Not authenticated:', error.message);
    dashboardData.isAuthenticated = false;
    updateDashboardUI();
  }
}

// Update UI with data
function updateDashboardUI() {
  const authCard = document.querySelector('.auth-card');
  const dataCards = document.querySelectorAll('.inboxie-card:not(.auth-card)');
  
  console.log('Auth status:', dashboardData.isAuthenticated);
  
  if (!dashboardData.isAuthenticated) {
    // NOT AUTHENTICATED: Show only login card
    if (authCard) {
      authCard.style.display = 'flex';
      authCard.querySelector('.card-value').textContent = 'Click to Login';
      console.log('Showing login card');
    }
    dataCards.forEach(card => {
      card.style.display = 'none';
      console.log('Hiding data card');
    });
    return; // IMPORTANT: Exit early
  }
  
  // AUTHENTICATED: Show data cards, hide login (convert to logout)
  if (authCard) {
    authCard.style.display = 'flex';
    authCard.querySelector('h4').textContent = 'Sign Out';
    authCard.querySelector('.card-value').textContent = 'Click to Logout';
    authCard.querySelector('.card-subtitle').textContent = 'Clear authentication';
    authCard.querySelector('.card-icon').textContent = '🚪';
    authCard.setAttribute('data-action', 'logout');
    console.log('Converted to logout card');
  }
  
  dataCards.forEach(card => {
    card.style.display = 'flex';
    console.log('Showing data card');
  });

  // Update emails organized
  const emailsValue = document.querySelector('.emails-organized .card-value');
  const emailsSubtitle = document.querySelector('.emails-organized .card-subtitle');
  if (emailsValue) emailsValue.textContent = `${dashboardData.emailsOrganized}/${dashboardData.emailsLimit}`;
  if (emailsSubtitle) emailsSubtitle.textContent = `${dashboardData.planType === 'free' ? 'Free' : 'Pro'} plan usage`;

  // Update import status
  const importValue = document.querySelector('.import-status .card-value');
  const importSubtitle = document.querySelector('.import-status .card-subtitle');
  const importCard = document.querySelector('.import-status');
  
  if (importValue) {
    if (dashboardData.isProcessing) {
      importValue.textContent = 'Processing...';
      importCard?.classList.add('processing');
    } else if (dashboardData.importRemaining > 0) {
      importValue.textContent = `${dashboardData.importRemaining} left`;
      importCard?.classList.remove('processing');
    } else {
      importValue.textContent = 'Complete';
      importCard?.classList.remove('processing');
    }
  }
  if (importSubtitle) {
    if (dashboardData.isProcessing) {
      importSubtitle.textContent = 'Processing emails with AI...';
    } else if (dashboardData.importRemaining > 0) {
      importSubtitle.textContent = 'Ready to organize more emails';
    } else {
      importSubtitle.textContent = 'All available emails organized';
    }
  }

  updateReplyAnalysis();
}

// Update reply analysis
function updateReplyAnalysis() {
  const replyValue = document.querySelector('.reply-analysis .card-value');
  const replyBreakdown = document.querySelector('.reply-breakdown');
  
  if (replyValue) {
    const total = dashboardData.replyStats.totalReplies;
    replyValue.textContent = total > 0 ? `${total} need replies` : 'All caught up';
  }
  
  if (replyBreakdown && dashboardData.replyStats.totalReplies > 0) {
    const { highUrgency, mediumUrgency, lowUrgency } = dashboardData.replyStats;
    replyBreakdown.innerHTML = `
      ${highUrgency > 0 ? `<span class="urgency-badge urgency-high">${highUrgency} high</span>` : ''}
      ${mediumUrgency > 0 ? `<span class="urgency-badge urgency-medium">${mediumUrgency} medium</span>` : ''}
      ${lowUrgency > 0 ? `<span class="urgency-badge urgency-low">${lowUrgency} low</span>` : ''}
    `;
  } else if (replyBreakdown) {
    replyBreakdown.innerHTML = '';
  }
}

// Create simplified dashboard with only 4 components
function injectDashboard() {
  if (document.getElementById('inboxie-dashboard')) return;

  const dashboard = document.createElement('div');
  dashboard.id = 'inboxie-dashboard';
  dashboard.innerHTML = `
    <div class="inboxie-header">
      <h3>📧 inboxie</h3>
      <div class="header-controls">
        <button id="toggle-btn" title="Minimize">−</button>
      </div>
    </div>
    </div>
    <div class="inboxie-cards">
      <!-- 1. Emails Organized -->
      <div class="inboxie-card emails-organized">
        <div class="card-icon">📊</div>
        <div class="card-content">
          <h4>Emails Organized</h4>
          <div class="card-value">0/500</div>
          <div class="card-subtitle">Free plan usage</div>
        </div>
      </div>
      
      <!-- 2. AI Organize -->
      <div class="inboxie-card import-status" data-action="import">
        <div class="card-icon">🤖</div>
        <div class="card-content">
          <h4>AI Organize</h4>
          <div class="card-value">Click to Start</div>
          <div class="card-subtitle">Organize your inbox with AI</div>
        </div>
      </div>

      <!-- 3. Pending Replies -->
      <div class="inboxie-card reply-analysis" data-action="smart-inbox">
        <div class="card-icon">💬</div>
        <div class="card-content">
          <h4>Pending Replies</h4>
          <div class="card-value">All caught up</div>
          <div class="card-subtitle">AI-detected action items</div>
          <div class="reply-breakdown"></div>
        </div>
      </div>

      <!-- 4. Sign In/Sign Out (Dynamic) -->
      <div class="inboxie-card auth-card" data-action="authenticate" style="display: none;">
        <div class="card-icon">🔐</div>
        <div class="card-content">
          <h4>Sign In to Inboxie</h4>
          <div class="card-value">Click to Login</div>
          <div class="card-subtitle">Connect to organize your emails</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dashboard);
  loadDashboardState();
  setupControls();
  
  // Card clicks
  setTimeout(() => {
    document.querySelectorAll('.inboxie-card[data-action]').forEach(card => {
      card.addEventListener('click', function() {
        handleCardClick(this.getAttribute('data-action'));
      });
    });
  }, 100);
}

// Setup control buttons
function setupControls() {
  // Minimize toggle only
  document.getElementById('toggle-btn')?.addEventListener('click', (e) => {
    const dashboard = document.getElementById('inboxie-dashboard');
    const btn = e.target;
    if (dashboard.classList.contains('minimized')) {
      dashboard.classList.remove('minimized');
      btn.textContent = '−';
    } else {
      dashboard.classList.add('minimized');
      btn.textContent = '+';
    }
    saveDashboardState();
  });

  // Click header to expand when minimized
  document.querySelector('.inboxie-header')?.addEventListener('click', (e) => {
    const dashboard = document.getElementById('inboxie-dashboard');
    const btn = document.getElementById('toggle-btn');
    
    if (dashboard.classList.contains('minimized') && !e.target.closest('button')) {
      dashboard.classList.remove('minimized');
      btn.textContent = '−';
      saveDashboardState();
    }
  });
}

function resetToCorner() {
  // Not needed anymore - dashboard stays fixed
}

// Make draggable
function makeDraggable() {
  const dashboard = document.getElementById('inboxie-dashboard');
  const header = document.querySelector('.inboxie-header');
  if (!dashboard || !header) return;

  let isDragging = false;
  let startX, startY, offsetX, offsetY;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    
    isDragging = true;
    dashboard.classList.add('dragging');
    
    const rect = dashboard.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    offsetX = rect.left;
    offsetY = rect.top;
    
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newX = Math.max(0, Math.min(offsetX + deltaX, window.innerWidth - dashboard.offsetWidth));
    const newY = Math.max(0, Math.min(offsetY + deltaY, window.innerHeight - dashboard.offsetHeight));
    
    dashboard.style.left = newX + 'px';
    dashboard.style.top = newY + 'px';
    dashboard.style.removeProperty('right');
    dashboard.style.removeProperty('bottom');
    dashboard.style.removeProperty('transform');
    dashboard.classList.remove('side-left', 'side-right');
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      dashboard.classList.remove('dragging');
      saveDashboardState();
    }
  });
}

// Make resizable
function makeResizable() {
  const dashboard = document.getElementById('inboxie-dashboard');
  const resizeHandle = document.querySelector('.resize-handle');
  if (!dashboard || !resizeHandle) return;

  let isResizing = false;
  let startX, startY, startWidth, startHeight;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    
    const rect = dashboard.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startWidth = rect.width;
    startHeight = rect.height;
    
    dashboard.style.userSelect = 'none';
    document.body.style.cursor = 'nw-resize';
    
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newWidth = Math.max(280, Math.min(600, startWidth + deltaX));
    const newHeight = Math.max(200, Math.min(800, startHeight + deltaY));
    
    dashboard.style.width = newWidth + 'px';
    dashboard.style.height = newHeight + 'px';
    dashboard.style.maxHeight = newHeight + 'px';
    
    // Remove preset classes when manually resizing
    dashboard.classList.remove('compact', 'side-left', 'side-right');
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      dashboard.style.userSelect = '';
      document.body.style.cursor = '';
      saveDashboardState();
    }
  });
}

// Save/load state
function saveDashboardState() {
  const dashboard = document.getElementById('inboxie-dashboard');
  if (!dashboard) return;

  const state = {
    minimized: dashboard.classList.contains('minimized')
  };

  localStorage.setItem('inboxie-dashboard-state', JSON.stringify(state));
}

function loadDashboardState() {
  try {
    const saved = localStorage.getItem('inboxie-dashboard-state');
    if (!saved) return;

    const state = JSON.parse(saved);
    const dashboard = document.getElementById('inboxie-dashboard');

    if (state.minimized) {
      dashboard.classList.add('minimized');
      document.getElementById('toggle-btn').textContent = '+';
    }
  } catch (error) {
    console.log('Failed to load state:', error);
  }
}

// Handle card clicks
async function handleCardClick(action) {
  switch (action) {
    case 'authenticate':
      const success = await auth.authenticate();
      if (success) await fetchDashboardData();
      break;
      
    case 'logout':
      await auth.clearAuth();
      dashboardData.isAuthenticated = false;
      updateDashboardUI();
      break;
      
    case 'import':
      if (dashboardData.importRemaining > 0 || !dashboardData.isAuthenticated) {
        startImport();
      }
      break;
      
    case 'smart-inbox':
      // Navigate to Smart Inbox label in Gmail
      if (dashboardData.replyStats.totalReplies > 0) {
        const smartInboxUrl = `${window.location.origin}${window.location.pathname}#label/%E2%98%98%EF%B8%8F%20Smart%20Inbox`;
        window.location.href = smartInboxUrl;
      }
      break;
  }
}

// Start import
async function startImport() {
  try {
    dashboardData.isProcessing = true;
    updateDashboardUI();
    
    const response = await auth.apiCall('/api/process-emails-fast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailLimit: 50 })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        if (result.data.replies) {
          dashboardData.replyStats = result.data.replies;
        }
        console.log(`✅ Processed ${result.data.processed} emails`);
        setTimeout(fetchDashboardData, 1000);
      } else {
        alert(`Processing failed: ${result.error}`);
      }
    } else {
      const errorResult = await response.json();
      alert(`Processing failed: ${errorResult.error || 'Unknown error'}`);
    }
  } catch (error) {
    alert(`Processing failed: ${error.message}`);
  } finally {
    dashboardData.isProcessing = false;
    updateDashboardUI();
  }
}

// Handle Gmail navigation
let currentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    const existing = document.getElementById('inboxie-dashboard');
    if (existing) existing.remove();
    
    setTimeout(() => {
      if (!document.getElementById('inboxie-dashboard')) {
        injectDashboard();
        updateDashboardUI();
      }
    }, 1000);
  }
}, 1000);