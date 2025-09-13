console.log('Inboxie content script loaded!');

// Configuration - Update these URLs to match your backend
const API_BASE_URL = 'http://localhost:3000'; // Change to your actual domain in production

// Initialize authentication
const auth = new ExtensionAuth(API_BASE_URL);

// State management
let dashboardData = {
  emailsOrganized: 0,
  emailsLimit: 500,
  importRemaining: 0,
  planType: 'free',
  isProcessing: false,
  isAuthenticated: false
};

// Wait for Gmail to fully load, then inject dashboard
setTimeout(() => {
  console.log('Injecting Inboxie dashboard...');
  injectDashboard();
  
  // Start fetching real data
  fetchDashboardData();
  
  // Refresh data every 30 seconds
  setInterval(fetchDashboardData, 30000);
}, 2000);

// Fetch real data from your backend
async function fetchDashboardData() {
  try {
    console.log('Fetching dashboard data...');
    
    // Make direct API call (no separate auth check)
    const response = await auth.apiCall('/api/get-user-stats');

    if (response.ok) {
      const result = await response.json();
      console.log('Backend response:', result);
      console.log('Backend data:', result.data);
      
      if (result.success && result.data) {
        const stats = result.data;
        
        dashboardData = {
          emailsOrganized: stats.user?.emailsProcessed || 0,
          emailsLimit: stats.user?.limit || 500,
          importRemaining: stats.user?.remaining || 0,
          planType: stats.user?.planType || 'free',
          isProcessing: stats.isProcessing || false,
          isAuthenticated: true
        };
        
        updateDashboardUI();
        console.log('Live data loaded successfully!');
        return;
      }
    }
  } catch (error) {
    console.log('Not authenticated or API failed:', error.message);
    dashboardData.isAuthenticated = false;
    updateDashboardUI();
  }
}

// Update dashboard UI with real data
function updateDashboardUI() {
  // Show/hide authentication card based on auth status
  const authCard = document.querySelector('.auth-card');
  const logoutCard = document.querySelector('.logout-card');
  const dataCards = document.querySelectorAll('.inboxie-card:not(.auth-card):not(.logout-card)');
  
  if (!dashboardData.isAuthenticated) {
    // Show login card, hide data cards and logout
    if (authCard) authCard.style.display = 'flex';
    if (logoutCard) logoutCard.style.display = 'none';
    dataCards.forEach(card => card.style.display = 'none');
    return;
  } else {
    // Hide login card, show data cards and logout
    if (authCard) authCard.style.display = 'none';
    if (logoutCard) logoutCard.style.display = 'flex';
    dataCards.forEach(card => card.style.display = 'flex');
  }

  // Update Emails Organized
  const emailsOrganizedValue = document.querySelector('.emails-organized .card-value');
  const emailsOrganizedSubtitle = document.querySelector('.emails-organized .card-subtitle');
  if (emailsOrganizedValue) {
    emailsOrganizedValue.textContent = `${dashboardData.emailsOrganized}/${dashboardData.emailsLimit}`;
  }
  if (emailsOrganizedSubtitle) {
    emailsOrganizedSubtitle.textContent = `${dashboardData.planType === 'free' ? 'Free' : 'Pro'} plan usage`;
  }

  // Update Import Status
  const importValue = document.querySelector('.import-status .card-value');
  const importSubtitle = document.querySelector('.import-status .card-subtitle');
  if (importValue) {
    if (dashboardData.isProcessing) {
      importValue.textContent = 'Processing...';
    } else if (dashboardData.importRemaining > 0) {
      importValue.textContent = `${dashboardData.importRemaining} left`;
    } else {
      importValue.textContent = 'Complete';
    }
  }
  if (importSubtitle) {
    if (dashboardData.isProcessing) {
      importSubtitle.textContent = `${dashboardData.emailsOrganized} of ${dashboardData.emailsLimit} emails processed`;
    } else if (dashboardData.importRemaining > 0) {
      importSubtitle.textContent = 'Ready to import more from Gmail';
    } else {
      importSubtitle.textContent = 'All available emails imported';
    }
  }
}

// Create and inject the dashboard
function injectDashboard() {
  // Check if dashboard already exists
  if (document.getElementById('inboxie-dashboard')) {
    return;
  }

  // Create dashboard container
  const dashboard = document.createElement('div');
  dashboard.id = 'inboxie-dashboard';
  dashboard.innerHTML = `
    <div class="inboxie-header">
      <h3>📧 Inboxie Dashboard</h3>
      <button id="inboxie-toggle">−</button>
    </div>
    <div class="inboxie-cards" id="inboxie-cards">
      <div class="inboxie-card emails-organized" data-action="view-organized">
        <div class="card-icon">📊</div>
        <div class="card-content">
          <h4>Emails Organized</h4>
          <div class="card-value">0/500</div>
          <div class="card-subtitle">Free plan usage</div>
        </div>
      </div>
      
      <div class="inboxie-card import-status" data-action="import">
        <div class="card-icon">📥</div>
        <div class="card-content">
          <h4>Import Emails</h4>
          <div class="card-value">Click to Start</div>
          <div class="card-subtitle">Organize your inbox</div>
        </div>
      </div>

      <div class="inboxie-card auth-card" data-action="authenticate" style="display: none;">
        <div class="card-icon">🔐</div>
        <div class="card-content">
          <h4>Sign In to Inboxie</h4>
          <div class="card-value">Click to Login</div>
          <div class="card-subtitle">Connect your account to see real data</div>
        </div>
      </div>

      <div class="inboxie-card logout-card" data-action="logout" style="display: none;">
        <div class="card-icon">🚪</div>
        <div class="card-content">
          <h4>Sign Out</h4>
          <div class="card-value">Click to Logout</div>
          <div class="card-subtitle">Clear authentication and sign out</div>
        </div>
      </div>
    </div>
  `;

  // Position it like Grammarly - bottom right initially
  dashboard.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    z-index: 999999 !important;
    pointer-events: auto !important;
  `;

  document.body.appendChild(dashboard);
  console.log('Dashboard injected!');

  // Add event listeners
  setTimeout(() => {
    // Toggle functionality with proper minimization
    const toggleButton = document.getElementById('inboxie-toggle');
    if (toggleButton) {
      toggleButton.addEventListener('click', function() {
        const dashboard = document.getElementById('inboxie-dashboard');
        
        if (dashboard.classList.contains('minimized')) {
          dashboard.classList.remove('minimized');
          this.textContent = '−';
        } else {
          dashboard.classList.add('minimized');
          this.textContent = '+';
        }
      });
    }

    // Make dashboard draggable
    makeDashboardDraggable();

    // Card click handlers
    const cards = document.querySelectorAll('.inboxie-card[data-action]');
    cards.forEach(card => {
      card.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        handleCardClick(action);
      });
      
      card.style.cursor = 'pointer';
    });
  }, 100);
}

// Handle card clicks
async function handleCardClick(action) {
  switch (action) {
    case 'authenticate':
      console.log('Starting authentication...');
      const success = await auth.authenticate();
      if (success) {
        console.log('Authentication successful, refreshing data...');
        await fetchDashboardData();
      }
      break;

    case 'logout':
      console.log('Logging out...');
      await auth.clearAuth();
      dashboardData.isAuthenticated = false;
      updateDashboardUI();
      console.log('Logged out successfully');
      break;
      
    case 'import':
      if (dashboardData.importRemaining > 0 || !dashboardData.isAuthenticated) {
        startImport();
      }
      break;
  }
}

// Start import process
async function startImport() {
  try {
    dashboardData.isProcessing = true;
    updateDashboardUI();
    
    const response = await auth.apiCall('/api/process-emails-fast', {
      method: 'POST'
    });

    if (response.ok) {
      console.log('Import started successfully');
      // Data will be updated via the regular polling
    } else {
      console.log('Import failed');
      dashboardData.isProcessing = false;
      updateDashboardUI();
    }
  } catch (error) {
    console.log('Import request failed:', error);
    dashboardData.isProcessing = false;
    updateDashboardUI();
  }
}

// Make dashboard draggable by header
function makeDashboardDraggable() {
  const dashboard = document.getElementById('inboxie-dashboard');
  const header = document.querySelector('.inboxie-header');
  
  if (!dashboard || !header) return;

  let isDragging = false;
  let startX, startY, offsetX, offsetY;

  header.addEventListener('mousedown', function(e) {
    // Don't drag if clicking the toggle button
    if (e.target.id === 'inboxie-toggle') return;
    
    isDragging = true;
    dashboard.classList.add('dragging');
    
    // Get current position
    const rect = dashboard.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    offsetX = rect.left;
    offsetY = rect.top;
    
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newX = offsetX + deltaX;
    const newY = offsetY + deltaY;
    
    // Keep within viewport bounds
    const maxX = window.innerWidth - dashboard.offsetWidth;
    const maxY = window.innerHeight - dashboard.offsetHeight;
    
    const clampedX = Math.max(0, Math.min(newX, maxX));
    const clampedY = Math.max(0, Math.min(newY, maxY));
    
    dashboard.style.left = clampedX + 'px';
    dashboard.style.top = clampedY + 'px';
  });

  document.addEventListener('mouseup', function() {
    if (isDragging) {
      isDragging = false;
      dashboard.classList.remove('dragging');
    }
  });
}

// Handle Gmail navigation changes
let currentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    // Remove existing dashboard
    const existing = document.getElementById('inboxie-dashboard');
    if (existing) existing.remove();
    
    // Re-inject after navigation
    setTimeout(() => {
      if (!document.getElementById('inboxie-dashboard')) {
        injectDashboard();
        updateDashboardUI();
      }
    }, 1000);
  }
}, 1000);