/**
 * Doomlings Scavenger Hunt - UI Module
 * Handles UI updates and interaction
 */

const DoomlingsHuntUI = {
  /**
   * Initialize UI elements and listeners
   */
  init: function() {
    // Cache DOM elements
    this.cacheElements();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize appropriate view
    this.showInitialView();
  },
  
  /**
   * Cache DOM elements for better performance
   */
  cacheElements: function() {
    DoomlingsHunt.elements = {
      loginSection: document.getElementById('dgsh-login-section'),
      dashboard: document.getElementById('dgsh-dashboard'),
      scanMessage: document.getElementById('dgsh-scan-message'),
      progressFill: document.getElementById('dgsh-progress-fill'),
      progressText: document.getElementById('dgsh-progress-text'),
      rewardsList: document.getElementById('dgsh-rewards-list'),
      codesList: document.getElementById('dgsh-codes-list'),
      leaderboardList: document.getElementById('dgsh-leaderboard-list'),
      leaderboardContainer: document.getElementById('dgsh-leaderboard-container'),
      syncStatus: document.getElementById('dgsh-sync-status'),
      manualSync: document.getElementById('dgsh-manual-sync'),
      redemptionModal: document.getElementById('dgsh-redemption-modal'),
      redemptionMessage: document.getElementById('dgsh-redemption-message'),
      redemptionQR: document.getElementById('dgsh-redemption-qr'),
      closeModal: document.getElementById('dgsh-close-modal'),
      refreshBtn: document.getElementById('dgsh-refresh-btn')
    };
  },
  
  /**
   * Set up all event listeners
   */
  setupEventListeners: function() {
    // Close modal button
    if (DoomlingsHunt.elements.closeModal) {
      DoomlingsHunt.elements.closeModal.addEventListener('click', () => {
        DoomlingsHunt.elements.redemptionModal.style.display = 'none';
      });
    }
    
    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && DoomlingsHunt.elements.redemptionModal.style.display === 'flex') {
        DoomlingsHunt.elements.redemptionModal.style.display = 'none';
      }
    });
    
    // Modal background click to close
    if (DoomlingsHunt.elements.redemptionModal) {
      DoomlingsHunt.elements.redemptionModal.addEventListener('click', (e) => {
        if (e.target === DoomlingsHunt.elements.redemptionModal) {
          DoomlingsHunt.elements.redemptionModal.style.display = 'none';
        }
      });
    }
  },
  
  /**
   * Show initial view based on login status
   */
  showInitialView: function() {
    if (DoomlingsHunt.state.isLoggedIn) {
      this.showDashboard();
    } else {
      this.showLoginSection();
    }
  },
  
  /**
   * Show login section for non-logged-in users
   */
  showLoginSection: function() {
    if (!DoomlingsHunt.elements.loginSection) return;
    
    DoomlingsHunt.elements.loginSection.style.display = 'block';
    
    if (DoomlingsHunt.elements.dashboard) {
      DoomlingsHunt.elements.dashboard.style.display = 'none';
    }
    
    // Store the code in local storage for after login if present
    if (DoomlingsHunt.state.scannedCode) {
      DoomlingsHuntStorage.savePendingCode(DoomlingsHunt.state.scannedCode);
    }
  },
  
  /**
   * Show dashboard for logged-in users
   */
  showDashboard: function() {
    if (!DoomlingsHunt.elements.dashboard) return;
    
    DoomlingsHunt.elements.dashboard.style.display = 'block';
    
    if (DoomlingsHunt.elements.loginSection) {
      DoomlingsHunt.elements.loginSection.style.display = 'none';
    }
    
    // Start loading data
    DoomlingsHunt.initHuntDashboard();
  },
  
  /**
   * Update progress bar and count
   * @param {Array} scannedCodes - Array of scanned codes
   */
  updateProgressBar: function(scannedCodes) {
    if (!DoomlingsHunt.elements.progressFill || !DoomlingsHunt.elements.progressText) return;
    
    const codeCount = scannedCodes.length;
    const progressPercent = Math.min(100, (codeCount / DoomlingsHuntConfig.TOTAL_CODES) * 100);
    
    DoomlingsHunt.elements.progressFill.style.width = `${progressPercent}%`;
    DoomlingsHunt.elements.progressText.textContent = 
      `${codeCount} of ${DoomlingsHuntConfig.TOTAL_CODES} codes found`;
  },
  
  /**
   * Show scan success message
   */
  showScanSuccess: function() {
    if (!DoomlingsHunt.elements.scanMessage) return;
    
    // Show success message
    DoomlingsHunt.elements.scanMessage.innerHTML = 
      '<div class="dgsh-success-message">QR code successfully scanned!</div>';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
      if (DoomlingsHunt.elements.scanMessage.querySelector('.dgsh-success-message')) {
        DoomlingsHunt.elements.scanMessage.innerHTML = '';
      }
    }, 5000);
  },
  
  /**
   * Update all UI elements
   * @param {Array} scannedCodes - Array of scanned codes
   */
  updateAllUI: function(scannedCodes) {
    // Update progress bar
    this.updateProgressBar(scannedCodes);
    
    // Update rewards list
    DoomlingsHuntRewards.updateRewardsUI(scannedCodes);
    
    // Update redemption codes section
    DoomlingsHuntRewards.updateRedemptionCodesUI();
  }
};