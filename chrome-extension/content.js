// Configuration
const API_BASE_URL = 'https://www.inboxie.ai';
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
        return;
      }
    }
  } catch (error) {
    dashboardData.isAuthenticated = false;
    updateDashboardUI();
  }
}

// Update UI with data
function updateDashboardUI() {
  const authCard = document.querySelector('.auth-card');
  const dataCards = document.querySelectorAll('.inboxie-card:not(.auth-card)');
  
  if (!dashboardData.isAuthenticated) {
    if (authCard) {
      authCard.style.display = 'flex';
      authCard.querySelector('.card-value').textContent = 'Click to Login';
    }
    dataCards.forEach(card => {
      card.style.display = 'none';
    });
    return;
  }
  
  if (authCard) {
    authCard.style.display = 'flex';
    authCard.querySelector('h4').textContent = 'Sign Out';
    authCard.querySelector('.card-value').textContent = 'Click to Logout';
    authCard.querySelector('.card-subtitle').textContent = 'Clear authentication';
    authCard.querySelector('.card-icon').textContent = '🚪';
    authCard.setAttribute('data-action', 'logout');
  }
  
  dataCards.forEach(card => {
    card.style.display = 'flex';
  });

  const emailsValue = document.querySelector('.emails-organized .card-value');
  const emailsSubtitle = document.querySelector('.emails-organized .card-subtitle');
  if (emailsValue) emailsValue.textContent = `${dashboardData.emailsOrganized}/${dashboardData.emailsLimit}`;
  if (emailsSubtitle) emailsSubtitle.textContent = `${dashboardData.planType === 'free' ? 'Free' : 'Pro'} plan usage`;

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
    <div class="inboxie-cards">
      <div class="inboxie-card emails-organized">
        <div class="card-icon">📊</div>
        <div class="card-content">
          <h4>Emails Organized</h4>
          <div class="card-value">0/500</div>
          <div class="card-subtitle">Free plan usage</div>
        </div>
      </div>
      
      <div class="inboxie-card import-status" data-action="import">
        <div class="card-icon">🤖</div>
        <div class="card-content">
          <h4>AI Organize</h4>
          <div class="card-value">Click to Start</div>
          <div class="card-subtitle">Organize your inbox with AI</div>
        </div>
      </div>

      <div class="inboxie-card reply-analysis" data-action="smart-inbox">
        <div class="card-icon">💬</div>
        <div class="card-content">
          <h4>Pending Replies</h4>
          <div class="card-value">All caught up</div>
          <div class="card-subtitle">AI-detected action items</div>
          <div class="reply-breakdown"></div>
        </div>
      </div>

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
  
  setTimeout(() => {
    document.querySelectorAll('.inboxie-card[data-action]').forEach(card => {
      card.addEventListener('click', function() {
        handleCardClick(this.getAttribute('data-action'));
      });
    });
  }, 100);
}

function setupControls() {
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
    // Silently fail - not critical
  }
}

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
      if (dashboardData.replyStats.totalReplies > 0) {
        const smartInboxUrl = `${window.location.origin}${window.location.pathname}#label/%E2%98%98%EF%B8%8F%20Smart%20Inbox`;
        window.location.href = smartInboxUrl;
      }
      break;
  }
}

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