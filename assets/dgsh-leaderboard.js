/**
 * Doomlings GenCon Scavenger Hunt - Leaderboard Module
 * File path: assets/dgsh-leaderboard.js
 */

const DGSHLeaderboard = (function() {
  // Private variables
  let _initialized = false;
  let _leaderboardData = [];
  let _refreshTimer = null;
  let _lastRefreshTime = 0;
  
  // Initialize leaderboard module
  const init = function() {
    if (_initialized) return true;
    
    _initialized = true;
    
    // Set up auto-refresh timer
    const refreshInterval = DGSHConfig.getValue('leaderboard.refreshInterval') || 300000; // Default: 5 minutes
    
    _refreshTimer = setInterval(function() {
      if (document.visibilityState === 'visible') {
        refreshLeaderboard();
      }
    }, refreshInterval);
    
    // Initial data load
    setTimeout(function() {
      refreshLeaderboard();
    }, 1000);
    
    return true;
  };
  
  // Fetch leaderboard data
  const fetchLeaderboardData = async function() {
    try {
      // Check if we have cached data
      const cachedData = DGSHStorage.getLeaderboardData();
      if (cachedData) {
        return cachedData;
      }
      
      // Try to get data from Firebase first
if (window.DGSHFirebase && typeof window.DGSHFirebase.getLeaderboardData === 'function') {
  try {
    const firebaseData = await window.DGSHFirebase.getLeaderboardData();
    if (firebaseData && firebaseData.length > 0) {
      DGSHStorage.saveLeaderboardData(firebaseData);
      return firebaseData;
    }
  } catch (firebaseError) {
    console.warn("Leaderboard data unavailable:", firebaseError.message);
    // Return cached data if available instead of failing
    const cachedData = DGSHStorage.getLeaderboardData();
    if (cachedData) {
      return cachedData;
    }
  }
}
      
      // Fallback to empty array if no data source worked
      return [];
    } catch (e) {
      return [];
    }
  };
  
  // Refresh leaderboard data
const refreshLeaderboard = async function(force = false) {
  // Check if refresh is needed (throttle requests)
  const now = Date.now();
  const minRefreshInterval = 5000; // 5 seconds minimum between refreshes
  
  if (!force && (now - _lastRefreshTime) < minRefreshInterval) {
    return false;
  }
  
  // Show loading state
  updateLeaderboardUI('loading');
  
  _lastRefreshTime = now;
  
  try {
    const newData = await fetchLeaderboardData();
    
    if (newData && newData.length > 0) {
      _leaderboardData = newData;
      
      // Ensure all items have a rank property
      _leaderboardData.forEach((entry, index) => {
        if (!entry.rank) {
          entry.rank = index + 1;
        }
      });
      
      // Show loaded state
      updateLeaderboardUI('loaded');
      return true;
    } else {
      // Show empty state
      updateLeaderboardUI('loaded');
      return false;
    }
  } catch (e) {
    console.error("Leaderboard refresh error:", e);
    // Show error state
    updateLeaderboardUI('error');
    return false;
  }
};

const updateLeaderboardUI = function(state) {
  const leaderboardContainer = document.querySelector('.dgsh-leaderboard-list');
  if (!leaderboardContainer) return;
  
  // Get the module's HTML generation function
  const htmlContent = window.DGSHLeaderboard.generateLeaderboardHTML(state);
  leaderboardContainer.innerHTML = htmlContent;
};

  
  // Find the user's position in the leaderboard
  const findUserPosition = function(customerId) {
    if (!customerId || !_leaderboardData || _leaderboardData.length === 0) {
      return null;
    }
    
    // Look for the user in the leaderboard
    // Check multiple customerId formats as Firebase and Metafields might use different formats
    const userEntry = _leaderboardData.find(entry => 
      entry.customerId === customerId || 
      entry.shopifyCustomerId === customerId || 
      entry.userId === `shopify_${customerId}`
    );
    
    if (userEntry) {
      return {
        entry: userEntry,
        position: userEntry.rank
      };
    }
    
    // User not found in leaderboard - might be below the displayed ranks
    return {
      entry: null,
      position: null
    };
  };
  
  // Mask a user name for privacy
  const maskUserName = function(name) {
    if (!name) return 'Anonymous';
    
    if (name.includes(' ')) {
      // Full name with first and last
      const parts = name.split(' ');
      return `${parts[0][0]}***${parts[0].slice(-1)} ${parts[1][0]}.`;
    } else {
      // Just a single name
      if (name.length <= 2) return name;
      return `${name[0]}***${name.slice(-1)}`;
    }
  };
  
  // Public API
  return {
    // Initialize the leaderboard module
    init: function() {
      if (_initialized) {
        return this;
      }
      
      if (init()) {
        // Successfully initialized
      }
      
      return this;
    },
    
    // Check if leaderboard is initialized
    isInitialized: function() {
      return _initialized;
    },
    
    // Get leaderboard data
    getLeaderboardData: function() {
      return [..._leaderboardData];
    },
    
    // Refresh leaderboard data
    refreshLeaderboard: async function(force = false) {
      if (force) {
        _lastRefreshTime = 0; // Reset last refresh time to force refresh
      }
      
      return await refreshLeaderboard();
    },
    
    // Get user's position in leaderboard
    getUserPosition: function(customerId) {
      return findUserPosition(customerId);
    },
    
    // Get the current user's position in leaderboard
    getCurrentUserPosition: function() {
      if (!DGSHAuth) {
        return null;
      }
      
      const customerId = DGSHAuth.getCustomerId();
      return customerId ? findUserPosition(customerId) : null;
    },
    
    // Mask a user name for privacy
    maskUserName: function(name) {
      return maskUserName(name);
    },
    
    // Check if user is in the top N
    isUserInTopN: function(customerId, n = 10) {
      const position = findUserPosition(customerId);
      return position && position.position <= n;
    },
    
    // Generate HTML for leaderboard display
generateLeaderboardHTML: function(state = 'loaded') {
  // Handle different loading states
  if (state === 'loading') {
    return `
      <div class="dgsh-leaderboard-loading">
        <div class="dgsh-loading-dots">
          <span></span><span></span><span></span>
        </div>
        <p>Loading leaderboard...</p>
      </div>
    `;
  }
  
  if (state === 'error') {
    return `
      <div class="dgsh-leaderboard-error">
        <h4>Unable to Load Leaderboard</h4>
        <p>Please check your connection and try refreshing.</p>
        <button class="dgsh-leaderboard-retry" onclick="window.DGSHLeaderboard.refreshLeaderboard(true)">Try Again</button>
      </div>
    `;
  }
  
  if (!_leaderboardData || _leaderboardData.length === 0) {
    return `
      <div class="dgsh-no-leaderboard">
        <h4>🏆 Hall of Fame</h4>
        <p>Only hunters who complete <strong>all 12 codes</strong> will appear here.</p>
        <p>Finish the hunt to claim your spot on the leaderboard!</p>
        <div class="dgsh-leaderboard-tip">
          💡 <em>Tip: Complete hunters are ranked by fastest completion time</em>
        </div>
      </div>
    `;
  }
  
  // Create header row
  let html = `
    <div class="dgsh-leaderboard-header">
      <div class="dgsh-leaderboard-rank">Rank</div>
      <div class="dgsh-leaderboard-name">Hunter</div>
      <div class="dgsh-leaderboard-count">Time</div>
    </div>
  `;
      
      // Add user rows
      const currentUserId = DGSHAuth && DGSHAuth.getCustomerId ? DGSHAuth.getCustomerId() : null;
      const namePrivacy = DGSHConfig.getValue('leaderboard.namePrivacy') || false;
      
      html += _leaderboardData.map(entry => {
        // Check if current user with multiple possible ID formats
        const isCurrentUser = currentUserId && (
          entry.customerId === currentUserId || 
          entry.shopifyCustomerId === currentUserId || 
          entry.userId === `shopify_${currentUserId}`
        );
        
        // Get display name with optional privacy masking
        
        let displayName = entry.displayName || 'Anonymous Hunter';
        // if (namePrivacy && !isCurrentUser) {
        //   displayName = maskUserName(displayName);
        // }
        
        return `
          <div class="dgsh-leaderboard-row ${isCurrentUser ? 'dgsh-current-user' : ''}">
            <div class="dgsh-leaderboard-rank">${entry.rank || '?'}</div>
            <div class="dgsh-leaderboard-name">${displayName}</div>
            <div class="dgsh-leaderboard-count">${entry.formattedTime} </div>
          </div>
        `;
      }).join('');
      
      return html;
    },
    
    // Check if leaderboard data is available
    hasLeaderboardData: function() {
      return _leaderboardData && _leaderboardData.length > 0;
    },
    
    // Get last refresh time
    getLastRefreshTime: function() {
      return _lastRefreshTime;
    },
    
    // Clean up resources
    destroy: function() {
      if (_refreshTimer) {
        clearInterval(_refreshTimer);
        _refreshTimer = null;
      }
      
      _initialized = false;
      _leaderboardData = [];
    }
  };
})();

// Make the leaderboard module available globally
window.DGSHLeaderboard = DGSHLeaderboard;