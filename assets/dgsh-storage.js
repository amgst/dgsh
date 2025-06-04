/**
 * Doomlings GenCon Scavenger Hunt - Storage Module
 * File path: assets/dgsh-storage.js
 */

const DGSHStorage = (function() {
  // Check if localStorage is available
  const isLocalStorageAvailable = function() {
    try {
      const test = '__dgsh_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  };
  
  // Fallback storage (memory-based, will not persist page refreshes)
  const memoryStorage = {};
  
  // Get default user data structure
  const getDefaultUserData = function() {
    return {
      scannedCodes: [],
      redemptionCodes: {},
      sync: {
        lastSyncTimestamp: 0,
        pendingSync: false
      }
    };
  };
  
  // Private methods
  const storageAvailable = isLocalStorageAvailable();
  
  // Public API
  return {
    // Check if storage is available
    isAvailable: function() {
      return storageAvailable;
    },
    
    // Get an item from storage
    getItem: function(key) {
      if (!key) return null;
      
      try {
        if (storageAvailable) {
          const value = localStorage.getItem(key);
          return value ? JSON.parse(value) : null;
        } else {
          return memoryStorage[key] || null;
        }
      } catch (e) {
        return null;
      }
    },
    
    // Set an item in storage
    setItem: function(key, value) {
      if (!key) return false;
      
      try {
        const serializedValue = JSON.stringify(value);
        
        if (storageAvailable) {
          localStorage.setItem(key, serializedValue);
        } else {
          memoryStorage[key] = value;
        }
        
        return true;
      } catch (e) {
        return false;
      }
    },
    
    // Remove an item from storage
    removeItem: function(key) {
      if (!key) return false;
      
      try {
        if (storageAvailable) {
          localStorage.removeItem(key);
        } else {
          delete memoryStorage[key];
        }
        
        return true;
      } catch (e) {
        return false;
      }
    },
    
    // Clear all hunt-related items from storage
    clearHuntData: function() {
      try {
        const keysToClear = Object.values(DGSHConfig.getSection('storageKeys'));
        
        if (storageAvailable) {
          keysToClear.forEach(key => localStorage.removeItem(key));
        } else {
          keysToClear.forEach(key => delete memoryStorage[key]);
        }
        
        return true;
      } catch (e) {
        return false;
      }
    },
    
    // Get user data from storage
    getUserData: function() {
      const userDataKey = DGSHConfig.getValue('storageKeys.userData');
      const userData = this.getItem(userDataKey);
      
      return userData || getDefaultUserData();
    },
    
    // Save user data to storage
    saveUserData: function(userData) {
      if (!userData) return false;
      
      const userDataKey = DGSHConfig.getValue('storageKeys.userData');
      
      // Ensure the sync timestamp is updated
      if (!userData.sync) {
        userData.sync = { lastSyncTimestamp: Date.now(), pendingSync: true };
      } else {
        userData.sync.lastSyncTimestamp = Date.now();
        userData.sync.pendingSync = true;
      }
      
      return this.setItem(userDataKey, userData);
    },
    
    // Store a temporarily scanned code (for non-logged in users)
    storeTempCode: function(code) {
      if (!code) return false;
      
      const tempCodeKey = DGSHConfig.getValue('storageKeys.tempCode');
      return this.setItem(tempCodeKey, { 
        code: code, 
        timestamp: Date.now() 
      });
    },
    
    // Get temporarily stored code
    getTempCode: function() {
      const tempCodeKey = DGSHConfig.getValue('storageKeys.tempCode');
      return this.getItem(tempCodeKey);
    },
    
    // Clear temporarily stored code
    clearTempCode: function() {
      const tempCodeKey = DGSHConfig.getValue('storageKeys.tempCode');
      return this.removeItem(tempCodeKey);
    },
    
    // Add a scanned code to user data
    addScannedCode: function(code, metadata = {}) {
      if (!code) return false;
      
      const userData = this.getUserData();
      
      // Check if code was already scanned
      const alreadyScanned = userData.scannedCodes.some(item => item.code === code);
      if (alreadyScanned) return false;
      
      // Add new code
      userData.scannedCodes.push({
        code: code,
        timestamp: Date.now(),
        ...metadata
      });
      
      return this.saveUserData(userData);
    },
    
    // Store a redemption code
    storeRedemptionCode: function(tierId, code) {
      if (!tierId || !code) return false;
      
      const userData = this.getUserData();
      
      // Add/update redemption code
      userData.redemptionCodes[tierId] = {
        code: code,
        generated: Date.now(),
        redeemed: false,
        redeemedTimestamp: null,
        redeemedBy: null
      };
      
      return this.saveUserData(userData);
    },
    
    // Mark a redemption code as redeemed
    markRedemptionCodeRedeemed: function(tierId, staffId) {
      if (!tierId) return false;
      
      const userData = this.getUserData();
      
      if (userData.redemptionCodes[tierId]) {
        userData.redemptionCodes[tierId].redeemed = true;
        userData.redemptionCodes[tierId].redeemedTimestamp = Date.now();
        userData.redemptionCodes[tierId].redeemedBy = staffId || 'unknown';
        
        return this.saveUserData(userData);
      }
      
      return false;
    },
    
    // Update the last sync timestamp
    updateSyncTimestamp: function(timestamp = Date.now()) {
      const userData = this.getUserData();
      
      if (!userData.sync) {
        userData.sync = { lastSyncTimestamp: timestamp, pendingSync: false };
      } else {
        userData.sync.lastSyncTimestamp = timestamp;
        userData.sync.pendingSync = false;
      }
      
      return this.saveUserData(userData);
    },
    
    // Store leaderboard data (for caching)
    saveLeaderboardData: function(leaderboardData) {
      if (!leaderboardData) return false;
      
      const leaderboardKey = DGSHConfig.getValue('leaderboard.storageKey');
      return this.setItem(leaderboardKey, {
        data: leaderboardData,
        timestamp: Date.now()
      });
    },
    
    // Get cached leaderboard data
    getLeaderboardData: function() {
      const leaderboardKey = DGSHConfig.getValue('leaderboard.storageKey');
      const cacheExpiry = DGSHConfig.getValue('leaderboard.cacheExpiry');
      const cachedData = this.getItem(leaderboardKey);
      
      // Return null if data is expired or doesn't exist
      if (!cachedData || (Date.now() - cachedData.timestamp > cacheExpiry)) {
        return null;
      }
      
      return cachedData.data;
    }
  };
})();

// Make the storage available globally
window.DGSHStorage = DGSHStorage;