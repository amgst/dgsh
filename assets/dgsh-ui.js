/**
 * dgsh-ui.js - SINGLE QR Code Scanning Entry Point
 * File path: assets/dgsh-ui.js
 */

const DGSHUI = (function() {
  let _initialized = false;
  let _elements = {};
  let _userData = null;
  let _scanning = false; // Prevent multiple scans
  
  const init = async function() {
    try {
      // Get DOM elements
      _elements = {
        progressFill: document.querySelector('.dgsh-progress-fill'),
        progressText: document.querySelector('.dgsh-progress-text'),
        progressCount: document.querySelector('.dgsh-progress-count'),
        rewardsList: document.querySelector('.dgsh-rewards-list'),
        userInfo: document.querySelector('.dgsh-user-info'),
        modalContainer: document.querySelector('.dgsh-modal-container'),
        modalContent: document.querySelector('.dgsh-modal-content'),
        modalClose: document.querySelector('.dgsh-modal-close'),
        unlockedRewards: document.querySelector('.dgsh-unlocked-rewards'),
        noRewards: document.querySelector('.dgsh-no-rewards'),
        leaderboardList: document.querySelector('.dgsh-leaderboard-list')
      };
      
      // Setup modal close
      if (_elements.modalClose) {
        _elements.modalClose.addEventListener('click', closeModal);
      }
      
      // Load user data
      await loadUserData();
      
      _initialized = true;
      return true;
    } catch (e) {
      console.error("DGSHUI init error:", e);
      return false;
    }
  };

  // Load user data - SIMPLIFIED
  const loadUserData = async function() {
    try {
      // Try Firebase first
      if (window.DGSHFirebase && DGSHFirebase.isInitialized()) {
        _userData = await DGSHFirebase.getUserProgress();
        if (_userData) {
          updateUI();
          return;
        }
      }
      
      // Create default user data if nothing exists
      _userData = {
        scannedCodes: [],
        redemptionStatus: {},
        drawingEntries: 0,
        drawingBonusEntries: 0,
        isAnonymous: true,
        displayName: 'Anonymous Hunter'
      };
      
      updateUI();
    } catch (error) {
      console.error("Error loading user data:", error);
      // Always have some data
      _userData = {
        scannedCodes: [],
        redemptionStatus: {},
        drawingEntries: 0,
        drawingBonusEntries: 0,
        isAnonymous: true,
        displayName: 'Anonymous Hunter'
      };
      updateUI();
    }
  };

  // Close modal
  const closeModal = function() {
    if (_elements.modalContainer) {
      _elements.modalContainer.classList.remove('dgsh-modal-active');
      document.body.classList.remove('dgsh-modal-open');
    }
  };

  // Show simple message
  const showMessage = function(message, type = 'info', duration = 5000) {
    let container = document.querySelector('.dgsh-messages-container');
    
    if (!container) {
      container = document.createElement('div');
      container.className = 'dgsh-messages-container';
      container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; max-width: 400px;';
      document.body.appendChild(container);
    }

    const messageEl = document.createElement('div');
    messageEl.className = `dgsh-message dgsh-message-${type}`;
    messageEl.style.cssText = `
      padding: 12px 15px; margin: 10px 0; border-radius: 4px; font-size: 14px;
      border-left: 4px solid; position: relative; animation: slideIn 0.3s ease;
    `;
    
    // Set colors based on type
    switch (type) {
      case 'success':
        messageEl.style.backgroundColor = '#d4edda';
        messageEl.style.color = '#155724';
        messageEl.style.borderLeftColor = '#28a745';
        break;
      case 'error':
        messageEl.style.backgroundColor = '#f8d7da';
        messageEl.style.color = '#721c24';
        messageEl.style.borderLeftColor = '#dc3545';
        break;
      case 'warning':
        messageEl.style.backgroundColor = '#fff3cd';
        messageEl.style.color = '#856404';
        messageEl.style.borderLeftColor = '#ffc107';
        break;
      default: // info
        messageEl.style.backgroundColor = '#d1ecf1';
        messageEl.style.color = '#0c5460';
        messageEl.style.borderLeftColor = '#17a2b8';
    }
    
    messageEl.innerHTML = `
      ${message}
      <button onclick="this.parentNode.remove()" style="
        position: absolute; top: 5px; right: 10px; background: none; border: none;
        font-size: 16px; cursor: pointer; color: inherit; opacity: 0.7;
      ">×</button>
    `;

    container.appendChild(messageEl);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.remove();
        }
      }, duration);
    }

    return messageEl;
  };

  // Update all UI elements
  const updateUI = function() {
    updateProgress();
    renderRewards();
    updateUserInfoDisplay();
  };

  // Update user info display
  const updateUserInfoDisplay = function() {
    if (!_userData || !_elements.userInfo) return;
    
    const isAuthenticated = window.DGSHAuth && DGSHAuth.isAuthenticated();
    
    if (!isAuthenticated && _userData.isAnonymous) {
      // Show anonymous user info
      const welcomeElement = _elements.userInfo.querySelector('.dgsh-username');
      if (welcomeElement) {
        welcomeElement.textContent = `Hunting as ${_userData.displayName}`;
      }
      
      // Simple account linking prompt for users with progress
      if (_userData.scannedCodes.length >= 3) {
        showAccountLinkingPrompt();
      }
    }
  };

  // Show simple account linking prompt
  const showAccountLinkingPrompt = function() {
    // Don't show if already shown recently
    const lastShown = localStorage.getItem('dgsh_link_prompt_shown');
    if (lastShown && (Date.now() - parseInt(lastShown)) < 24 * 60 * 60 * 1000) {
      return;
    }
    
    const scanCount = _userData.scannedCodes.length;
    let message = '';
    
    if (scanCount >= 6) {
      message = `🏆 ${scanCount} codes scanned! <a href="/account/login" style="color: #007bff;">Link account</a> to redeem rewards.`;
    } else if (scanCount >= 3) {
      message = `🎯 ${scanCount} codes scanned! <a href="/account/login" style="color: #007bff;">Link account</a> to save progress.`;
    }
    
    if (message) {
      showMessage(message, 'info', 10000);
      localStorage.setItem('dgsh_link_prompt_shown', Date.now().toString());
    }
  };

  // Update progress display
  const updateProgress = function() {
    if (!_userData || !_elements.progressFill) return;
    
    const totalCodes = window.DGSHConfig && DGSHConfig.getTotalCodesRequired ? 
      DGSHConfig.getTotalCodesRequired() : 12;
    
    const scannedCount = _userData.scannedCodes.length;
    const percentage = Math.min(100, Math.floor((scannedCount / totalCodes) * 100));
    
    const drawingEntries = _userData.drawingEntries + (_userData.drawingBonusEntries || 0);
    
    _elements.progressFill.style.width = `${percentage}%`;
    
    if (_elements.progressText) {
      _elements.progressText.textContent = `${percentage}% Complete`;
    }
    
    if (_elements.progressCount) {
      _elements.progressCount.innerHTML = `
        <div>${scannedCount} of ${totalCodes} codes</div>
        <div style="font-size: 12px; color: #28a745; font-weight: 600;">${drawingEntries} drawing entries</div>
      `;
    }
    
    updateCharacterSpots(scannedCount, totalCodes);
  };

  // Update character spots display
  const updateCharacterSpots = function(scannedCount, totalCodes) {
    let characterContainer = document.querySelector('.dgsh-character-spots');
    
    if (!characterContainer) {
      characterContainer = document.createElement('div');
      characterContainer.className = 'dgsh-character-spots';
      
      const progressContainer = document.querySelector('.dgsh-progress-container');
      if (progressContainer) {
        progressContainer.appendChild(characterContainer);
      }
    }
    
    let spotsHtml = '<div class="dgsh-character-grid">';
    
    for (let i = 1; i <= totalCodes; i++) {
      const isUnlocked = i <= scannedCount;
      const characterEmoji = getCharacterEmoji(i);
      
      spotsHtml += `
        <div class="dgsh-character-spot ${isUnlocked ? 'dgsh-spot-unlocked' : 'dgsh-spot-locked'}">
          <div class="dgsh-character-icon">${characterEmoji}</div>
          <div class="dgsh-character-number">${i}</div>
        </div>
      `;
    }
    
    spotsHtml += '</div>';
    characterContainer.innerHTML = spotsHtml;
  };

  // Get character emoji for spot
  const getCharacterEmoji = function(spotNumber) {
    const characters = [
      '🦹', '🧙', '👑', '⚔️', '🛡️', '🏹', 
      '🗡️', '💎', '🔮', '🎭', '🎪', '🏆'
    ];
    
    return characters[spotNumber - 1] || '🎯';
  };
  
  // Render rewards display
  const renderRewards = function() {
    if (!_userData || !_elements.rewardsList) return;
    
    const scannedCount = _userData.scannedCodes.length;
    const redemptionStatus = _userData.redemptionStatus || {};
    
    const allTiers = window.DGSHConfig ? DGSHConfig.getAllRewardTiers() : getDefaultTiers();
    _elements.rewardsList.innerHTML = '';
    
    allTiers.forEach(tier => {
      const tierUnlocked = scannedCount >= tier.codesRequired;
      const isRedeemed = redemptionStatus[tier.id]?.redeemed;
      const statusText = isRedeemed ? 'Redeemed!' : (tierUnlocked ? 'Unlocked!' : `Scan ${tier.codesRequired} Codes`);
      
      const rewardItem = document.createElement('div');
      rewardItem.className = `dgsh-reward-item ${tierUnlocked ? 'dgsh-unlocked' : 'dgsh-locked'} ${isRedeemed ? 'dgsh-redeemed' : ''}`;
      
      rewardItem.innerHTML = `
        <div class="dgsh-reward-image">
          <img src="${tier.image}" alt="${tier.name}" class="dgsh-reward-img">
          <div class="dgsh-reward-status">${statusText}</div>
        </div>
        <div class="dgsh-reward-details">
          <h3 class="dgsh-reward-name">${tier.name}</h3>
          <p class="dgsh-reward-description">${tier.description}</p>
          ${tierUnlocked && !isRedeemed && window.DGSHAuth && DGSHAuth.isAuthenticated() ? 
            `<button class="dgsh-verify-reward" data-tier="${tier.id}">REDEEM AT BOOTH</button>` : ''}
        </div>
      `;
      
      _elements.rewardsList.appendChild(rewardItem);
      
      if (tierUnlocked && !isRedeemed) {
        const button = rewardItem.querySelector('.dgsh-verify-reward');
        if (button) {
          button.addEventListener('click', () => showRedemptionModal(tier.id));
        }
      }
    });
    
    updateUnlockedRewards();
  };

  // Get default reward tiers if config not available
  const getDefaultTiers = function() {
    return [
      {
        id: "tier1",
        codesRequired: 1,
        name: "Card Pack",
        description: "A free Doomlings card pack",
        image: "https://cdn.shopify.com/s/files/1/0554/6190/4593/files/card-pack_png.jpg?v=1742921629"
      },
      {
        id: "tier3",
        codesRequired: 3,
        name: "Promo Cards",
        description: "Exclusive GenCon promo cards",
        image: "https://cdn.shopify.com/s/files/1/0554/6190/4593/files/card-pack_png.jpg?v=1742921629"
      },
      {
        id: "tier6",
        codesRequired: 6,
        name: "Mini Expansion",
        description: "Doomlings mini expansion",
        image: "https://cdn.shopify.com/s/files/1/0554/6190/4593/files/card-pack_png.jpg?v=1742921629"
      },
      {
        id: "tier12",
        codesRequired: 12,
        name: "Collector's Box",
        description: "Limited edition collector's box",
        image: "https://cdn.shopify.com/s/files/1/0554/6190/4593/files/card-pack_png.jpg?v=1742921629"
      }
    ];
  };
  
  // Update unlocked rewards display
  const updateUnlockedRewards = function() {
    if (!_userData || !_elements.unlockedRewards || !_elements.noRewards) return;
    
    const scannedCount = _userData.scannedCodes.length;
    const redemptionStatus = _userData.redemptionStatus || {};
    const allTiers = window.DGSHConfig ? DGSHConfig.getAllRewardTiers() : getDefaultTiers();
    const unlockedRewards = allTiers.filter(tier => scannedCount >= tier.codesRequired);
    
    if (unlockedRewards.length === 0) {
      _elements.noRewards.style.display = 'block';
      _elements.unlockedRewards.style.display = 'none';
      return;
    }
      
    const hasUnredeemedRewards = unlockedRewards.some(tier => !(redemptionStatus[tier.id]?.redeemed));
    
    _elements.noRewards.style.display = 'none';
    _elements.unlockedRewards.style.display = 'block';
    _elements.unlockedRewards.innerHTML = '';
    
    // Only show redeem button for authenticated users
    if (hasUnredeemedRewards && window.DGSHAuth && DGSHAuth.isAuthenticated()) {
      const redeemAllBtn = document.createElement('button');
      redeemAllBtn.className = 'dgsh-redeem-all-btn';
      redeemAllBtn.textContent = 'REDEEM ALL UNLOCKED REWARDS';
      redeemAllBtn.addEventListener('click', () => showRedemptionModal());
      
      const container = document.createElement('div');
      container.className = 'dgsh-redeem-all-container';
      container.appendChild(redeemAllBtn);
      _elements.unlockedRewards.appendChild(container);
    }
    
    unlockedRewards.forEach(tier => {
      const isRedeemed = redemptionStatus[tier.id]?.redeemed;
      const item = document.createElement('div');
      item.className = 'dgsh-unlocked-reward';
      
      const canRedeem = window.DGSHAuth && DGSHAuth.isAuthenticated();
      
      item.innerHTML = `
        <div class="dgsh-unlocked-reward-info">
          <span class="dgsh-unlocked-reward-name">${tier.name}</span>
          <span class="dgsh-reward-status ${isRedeemed ? 'dgsh-status-redeemed' : 'dgsh-status-unlocked'}">
            ${isRedeemed ? 'Redeemed' : 'Unlocked'}
          </span>
        </div>
        ${!isRedeemed && canRedeem ? `<button class="dgsh-redeem-single-btn" data-tier="${tier.id}">REDEEM</button>` : ''}
      `;
      
      _elements.unlockedRewards.appendChild(item);
      
      if (!isRedeemed && canRedeem) {
        const button = item.querySelector('.dgsh-redeem-single-btn');
        if (button) {
          button.addEventListener('click', () => showRedemptionModal(tier.id));
        }
      }
    });
  };
  
  // Show redemption modal (only for authenticated users)
  const showRedemptionModal = function(specificTierId = null) {
    if (!window.DGSHAuth || !DGSHAuth.isAuthenticated()) {
      showMessage('Please <a href="/account/login" style="color: #007bff;">login</a> to redeem rewards.', 'warning');
      return;
    }
    
    if (!_userData || !_elements.modalContainer || !_elements.modalContent) return;
    
    const allTiers = window.DGSHConfig ? DGSHConfig.getAllRewardTiers() : getDefaultTiers();
    const scannedCount = _userData.scannedCodes.length;
    const redemptionStatus = _userData.redemptionStatus || {};
    
    const unredeemedRewards = allTiers.filter(tier => {
      const unlocked = scannedCount >= tier.codesRequired;
      const notRedeemed = !(redemptionStatus[tier.id]?.redeemed);
      const matchesFilter = !specificTierId || specificTierId === tier.id;
      return unlocked && notRedeemed && matchesFilter;
    });
    
    const title = specificTierId && unredeemedRewards.length === 1 ? 
      `Redeem ${unredeemedRewards[0].name}` : "Redeem Unlocked Rewards";
    
    _elements.modalContent.innerHTML = `
      <div class="dgsh-redemption-modal">
        <h3 class="dgsh-modal-title">${title}</h3>
        <div class="dgsh-redemption-content">
          <p>Show this screen to a Doomlings staff member to redeem your rewards:</p>
          
          <div class="dgsh-unredeemed-rewards-list">
            ${unredeemedRewards.length > 0 ? 
              `<h4>Rewards to Redeem:</h4>
              <ul>${unredeemedRewards.map(tier => `<li>${tier.name}</li>`).join('')}</ul>` : 
              `<p class="dgsh-no-unredeemed">No unredeemed rewards available.</p>`
            }
          </div>
          
          ${unredeemedRewards.length > 0 ? `
            <div class="dgsh-staff-section">
              <h4>Staff Verification</h4>
              <div class="dgsh-staff-code-container">
                <input type="password" class="dgsh-staff-code-input" placeholder="Staff verification code">
                <button class="dgsh-verify-button" data-tier="${specificTierId || 'all'}">Verify & Redeem</button>
              </div>
              <div class="dgsh-verification-result"></div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    _elements.modalContainer.classList.add('dgsh-modal-active');
    document.body.classList.add('dgsh-modal-open');
    
    if (unredeemedRewards.length > 0) {
      const verifyBtn = _elements.modalContent.querySelector('.dgsh-verify-button');
      if (verifyBtn) {
        verifyBtn.addEventListener('click', function() {
          const codeInput = _elements.modalContent.querySelector('.dgsh-staff-code-input');
          const resultDiv = _elements.modalContent.querySelector('.dgsh-verification-result');
          
          if (!codeInput || !codeInput.value) {
            resultDiv.innerHTML = '<div class="dgsh-result-error">Please enter the staff verification code</div>';
            return;
          }
          
          verifyRewards(this.getAttribute('data-tier'), codeInput.value, resultDiv);
        });
      }
    }
  };
  
  // Verify and process rewards
  const verifyRewards = async function(tierId, staffCode, resultElement) {
    const verifyButton = _elements.modalContent.querySelector('.dgsh-verify-button');
    if (verifyButton) {
      verifyButton.disabled = true;
      verifyButton.textContent = 'Verifying...';
    }
    
    try {
      let result = { success: false };
      
      // Try Firebase verification
      if (window.DGSHFirebase && DGSHFirebase.verifyAndProcessRedemptions) {
        result = await DGSHFirebase.verifyAndProcessRedemptions(staffCode, tierId);
      }
      
      if (result.success) {
        resultElement.innerHTML = `
          <div class="dgsh-result-success">
            Verification successful! ${result.count || 1} reward${(result.count !== 1) ? 's' : ''} redeemed.
          </div>
        `;
        
        setTimeout(() => {
          closeModal();
          refreshUI();
          showMessage('Rewards redeemed successfully!', 'success');
        }, 1500);
      } else {
        let errorMessage = 'Verification failed.';
        if (result.reason === 'invalid_code') errorMessage = 'Invalid staff verification code.';
        else if (result.reason === 'no_unredeemed_rewards') errorMessage = 'No unredeemed rewards found.';
        else if (result.message) errorMessage = `Error: ${result.message}`;
        
        resultElement.innerHTML = `<div class="dgsh-result-error">${errorMessage}</div>`;
      }
    } catch (error) {
      console.error("Error verifying rewards:", error);
      resultElement.innerHTML = `<div class="dgsh-result-error">Error: ${error.message || 'Unknown error'}</div>`;
    } finally {
      if (verifyButton) {
        verifyButton.disabled = false;
        verifyButton.textContent = 'Verify & Redeem';
      }
    }
  };
  
  // ============================================
  // MAIN QR CODE SCANNING FUNCTION - FIXED
  // ============================================
  const handleCodeScan = async function(code, metadata = {}) {
    // Prevent multiple simultaneous scans
    if (_scanning) {
      console.log('Scan already in progress, ignoring');
      return { success: false, reason: 'scanning_in_progress' };
    }
    
    if (!code) {
      showMessage('Invalid QR code', 'error');
      return { success: false, reason: 'invalid_code' };
    }

    // Validate format
    const qrPattern = /^GC25-[A-Z0-9]+-[0-9]{2}-[A-Z0-9]+$/;
    if (!qrPattern.test(code)) {
      showMessage('Invalid QR code format', 'error');
      return { success: false, reason: 'invalid_format' };
    }

    _scanning = true;

    try {
      showMessage('Processing QR code...', 'info', 2000);
      
      // STEP 1: Ensure Firebase user exists first
      if (window.DGSHFirebase && DGSHFirebase.ensureFirebaseUser) {
        console.log('Ensuring Firebase user exists...');
        await DGSHFirebase.ensureFirebaseUser();
      }
      
      // STEP 2: Try Firebase scan with proper duplicate checking
      let result = { success: false };
      
      if (window.DGSHFirebase && DGSHFirebase.addScannedCode) {
        result = await DGSHFirebase.addScannedCode(code, metadata);
      }

      // STEP 3: Handle result
      if (result.success) {
        // Update local count - don't reload everything
        if (_userData) {
          _userData.scannedCodes.push({ code, timestamp: Date.now(), ...metadata });
        }
        
        showMessage(`QR code scanned! Total: ${result.newCount}`, 'success');
        updateUI();
        return result;
      } else {
        const errorMessage = result.reason === 'already_scanned' ? 
          'Already scanned!' : (result.message || 'Scan failed');
        showMessage(errorMessage, 'error');
        return result;
      }
      
    } catch (error) {
      console.error("Error processing QR code:", error);
      showMessage('Error processing QR code', 'error');
      return { success: false, reason: 'error', message: error.message };
    } finally {
      // Always reset scanning flag
      _scanning = false;
    }
  };

  // Refresh UI data
  const refreshUI = async function() {
    if (!_initialized) return;
    
    try {
      await loadUserData();
    } catch (error) {
      console.error('Error refreshing UI:', error);
    }
  };

  // Public API
  return {
    init: async function() {
      if (_initialized) return this;
      await init();
      return this;
    },
    
    refreshUI: refreshUI,
    
    // MAIN QR CODE SCANNING ENTRY POINT
    handleCodeScan: handleCodeScan,
    
    // Show redemption modal
    showRedemptionModal: showRedemptionModal,
    
    // Show toast message
    showToast: showMessage,
    
    // Utility functions
    isInitialized: function() { return _initialized; },
    getUserData: function() { return _userData; },
    isAnonymousUser: function() { return _userData && _userData.isAnonymous; }
  };
})();

window.DGSHUI = DGSHUI;