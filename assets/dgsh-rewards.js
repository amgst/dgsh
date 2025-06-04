/**
 * File: dgsh-rewards.js
 * Location: assets/dgsh-rewards.js
 */

const DGSHRewards = (function() {
  let _rewardTiers = [];
  let _rewardCallbacks = [];
  let _initialized = false;
  
  const init = function() {
    if (_initialized) return;
    
    // Load reward tiers from config using schema-based approach
    if (window.DGSHConfig && typeof DGSHConfig.getAllRewardTiers === 'function') {
      _rewardTiers = DGSHConfig.getAllRewardTiers() || [];
    } else {
      // Fallback to getting rewards from the old config method
      _rewardTiers = DGSHConfig.getSection('rewardTiers') || [];
    }
    
    _initialized = true;
  };
  
  const generateRandomString = function(length, chars) {
    let result = '';
    const charactersLength = chars.length;
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * charactersLength));
    }
    
    return result;
  };
  
  const generateRedemptionCode = function(tierId) {
    // Find the tier using the schema-based approach
    const tier = _rewardTiers.find(t => t.id === tierId);
    if (!tier) return null;
    
    const config = DGSHConfig.getSection('redemptionCode');
    if (!config) return null;
    
    try {
      const prefix = config.prefix || "DOOM";
      const randomPart = generateRandomString(config.randomLength || 4, config.randomChars || "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
      const tierIndicator = tier.codesRequired.toString();
      const suffixPart = generateRandomString(config.suffixLength || 4, config.randomChars || "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
      
      return `${prefix}-${randomPart}-${tierIndicator}-${suffixPart}`;
    } catch (e) {
      return `DOOM-ERR0-${tier.codesRequired}-0000`;
    }
  };
  
  const notifyRewardCallbacks = function(eventData) {
    _rewardCallbacks.forEach(callback => {
      try {
        if (typeof callback === 'function') {
          callback(eventData);
        }
      } catch (e) {}
    });
  };
  
  const checkForNewRewards = function(userData) {
    if (!userData) return [];
    
    const scannedCount = userData.scannedCodes ? userData.scannedCodes.length : 0;
    
    if (!userData.redemptionStatus) {
      userData.redemptionStatus = {};
    }
    
    const existingRewards = userData.redemptionStatus;
    const newRewards = [];
    
    // Check against schema-based tiers
    _rewardTiers.forEach(tier => {
      const tierHasReward = !!existingRewards[tier.id];
      
      if (scannedCount >= tier.codesRequired && !tierHasReward) {
        newRewards.push(tier);
      }
    });
    
    return newRewards;
  };
  
  const processRewards = async function(userData) {
    if (!userData) return { newRewards: [], updatedUserData: null };
    
    if (!_initialized) init();
    
    const newRewards = checkForNewRewards(userData);
    
    if (newRewards.length === 0) return { newRewards: [], updatedUserData: userData };
    
    const updatedUserData = JSON.parse(JSON.stringify(userData));
    
    if (!updatedUserData.redemptionStatus) {
      updatedUserData.redemptionStatus = {};
    }
    
    newRewards.forEach(tier => {
      try {
        // Mark tier as unlocked but not yet redeemed
        updatedUserData.redemptionStatus[tier.id] = {
          unlocked: true,
          generated: Date.now(),
          redeemed: false,
          redeemedTimestamp: null,
          redeemedBy: null
        };
        
        notifyRewardCallbacks({
          type: 'reward_unlocked',
          tierId: tier.id,
          tierName: tier.name,
          codesRequired: tier.codesRequired,
          timestamp: Date.now()
        });
      } catch (error) {}
    });
    
    // Ensure all qualified tiers have unlocked status
    const scannedCount = userData.scannedCodes.length;
    _rewardTiers.forEach(tier => {
      if (scannedCount >= tier.codesRequired && 
          (!updatedUserData.redemptionStatus[tier.id])) {
        updatedUserData.redemptionStatus[tier.id] = {
          unlocked: true,
          generated: Date.now(),
          redeemed: false,
          redeemedTimestamp: null,
          redeemedBy: null
        };
      }
    });
    
    if (DGSHFirebase && DGSHFirebase.saveUserProgress) {
      await DGSHFirebase.saveUserProgress(updatedUserData);
    }
    
    return { 
      newRewards: newRewards, 
      updatedUserData: updatedUserData 
    };
  };
  
  // Refresh reward tiers from current schema
  const refreshRewardTiers = function() {
    if (window.DGSHConfig && typeof DGSHConfig.getAllRewardTiers === 'function') {
      _rewardTiers = DGSHConfig.getAllRewardTiers() || [];
    } else {
      // Fallback to getting rewards from the old config method
      _rewardTiers = DGSHConfig.getSection('rewardTiers') || [];
    }
  };
  
  return {
    init: function() {
      init();
      return this;
    },
    
    getAllRewardTiers: function() {
      // Ensure we have the latest tiers
      refreshRewardTiers();
      return _rewardTiers.map(tier => ({...tier}));
    },
    
    getRewardTier: function(tierId) {
      // Ensure we have the latest tiers
      refreshRewardTiers();
      const tier = _rewardTiers.find(t => t.id === tierId);
      return tier ? {...tier} : null;
    },
    
    getRewardTierByCount: function(count) {
      // Ensure we have the latest tiers
      refreshRewardTiers();
      
      const matchingTiers = _rewardTiers.filter(tier => count >= tier.codesRequired)
                                       .sort((a, b) => b.codesRequired - a.codesRequired);
      
      return matchingTiers.length > 0 ? {...matchingTiers[0]} : null;
    },
    
    getQualifyingRewardTiers: function(count) {
      // Ensure we have the latest tiers
      refreshRewardTiers();
      
      return _rewardTiers.filter(tier => count >= tier.codesRequired)
                        .map(tier => ({...tier}));
    },
    
    generateRedemptionCode: function(tierId) {
      return generateRedemptionCode(tierId);
    },
    
    processRewards: function(userData) {
      return processRewards(userData);
    },
    
    getRedemptionCode: async function(tierId) {
      try {
        if (!tierId) return null;
        
        let userData = null;
        
        if (DGSHFirebase && DGSHFirebase.getUserProgress) {
          userData = await DGSHFirebase.getUserProgress();
        }
        
        if (!userData || !userData.redemptionStatus) return null;
        
        if (!userData.redemptionStatus[tierId]) {
          const scannedCount = userData.scannedCodes ? userData.scannedCodes.length : 0;
          // Ensure we have the latest tiers
          refreshRewardTiers();
          const tier = this.getRewardTier(tierId);
          
          if (tier && scannedCount >= tier.codesRequired) {
            processRewards(userData);
            
            if (DGSHFirebase && DGSHFirebase.getUserProgress) {
              userData = await DGSHFirebase.getUserProgress();
            }
            
            if (userData.redemptionStatus && userData.redemptionStatus[tierId]) {
              return userData.redemptionStatus[tierId].code;
            }
          }
          
          return null;
        }
        
        return userData.redemptionStatus[tierId].code;
      } catch (error) {
        return null;
      }
    },
    
    isTierRedeemed: async function(tierId) {
      try {
        if (DGSHFirebase && DGSHFirebase.getUserProgress) {
          const userData = await DGSHFirebase.getUserProgress();
          
          if (!userData || !userData.redemptionStatus || !userData.redemptionStatus[tierId]) {
            return false;
          }
          
          return userData.redemptionStatus[tierId].redeemed === true;
        }
        
        return false;
      } catch (error) {
        return false;
      }
    },
    
    getUserRedemptionStatus: async function() {
      try {
        if (DGSHFirebase && DGSHFirebase.getUserProgress) {
          const userData = await DGSHFirebase.getUserProgress();
          
          if (!userData || !userData.redemptionStatus) {
            return {};
          }
          
          return {...userData.redemptionStatus};
        }
        
        return {};
      } catch (error) {
        return {};
      }
    },
    
    validateRedemptionCodeFormat: function(code) {
      if (!code) return false;
      
      const parts = code.split('-');
      if (parts.length !== 4) return false;
      
      const config = DGSHConfig.getSection('redemptionCode');
      if (!config) return false;
      
      if (parts[0] !== config.prefix) return false;
      
      if (parts[1].length !== config.randomLength) return false;
      
      if (!/^[1-9]\d*$/.test(parts[2])) return false;
      
      if (parts[3].length !== config.suffixLength) return false;
      
      return true;
    },
    
    markRedemptionCodeRedeemed: async function(tierId, staffId) {
      if (!tierId) return false;
      
      try {
        if (DGSHFirebase && DGSHFirebase.markRedemptionCodeRedeemed) {
          return await DGSHFirebase.markRedemptionCodeRedeemed(tierId, staffId);
        }
        
        return false;
      } catch (error) {
        return false;
      }
    },
    
    addRewardCallback: function(callback) {
      if (typeof callback === 'function') {
        _rewardCallbacks.push(callback);
        return true;
      }
      return false;
    },
    
    removeRewardCallback: function(callback) {
      if (typeof callback !== 'function') return false;
      
      const initialLength = _rewardCallbacks.length;
      _rewardCallbacks = _rewardCallbacks.filter(cb => cb !== callback);
      
      return initialLength !== _rewardCallbacks.length;
    },
    
    getProgressToNextReward: function(userData) {
      // Ensure we have the latest tiers
      refreshRewardTiers();
      
      const scannedCount = userData ? (userData.scannedCodes ? userData.scannedCodes.length : 0) : 0;
      
      // Find the next tier that hasn't been reached yet
      const nextTier = _rewardTiers.find(tier => scannedCount < tier.codesRequired);
      
      if (!nextTier) {
        return {
          currentCount: scannedCount,
          nextTierRequirement: null,
          nextTierName: null,
          progress: 100,
          isComplete: true
        };
      }
      
      // Sort tiers by codesRequired to find previous tier
      const tiers = [..._rewardTiers].sort((a, b) => a.codesRequired - b.codesRequired);
      const currentTierIndex = tiers.findIndex(tier => tier.id === nextTier.id);
      const prevTier = currentTierIndex > 0 ? tiers[currentTierIndex - 1] : { codesRequired: 0 };
      
      const totalNeeded = nextTier.codesRequired - prevTier.codesRequired;
      const currentProgress = scannedCount - prevTier.codesRequired;
      const progressPercentage = Math.min(100, Math.floor((currentProgress / totalNeeded) * 100));
      
      return {
        currentCount: scannedCount,
        nextTierRequirement: nextTier.codesRequired,
        nextTierName: nextTier.name,
        progress: progressPercentage,
        isComplete: false
      };
    },
    
    forceGenerateAllEligibleCodes: async function() {
      try {
        if (DGSHFirebase && DGSHFirebase.getUserProgress) {
          const userData = await DGSHFirebase.getUserProgress();
          if (!userData || !userData.scannedCodes) return false;
          
          const scannedCount = userData.scannedCodes.length;
          if (!userData.redemptionStatus) {
            userData.redemptionStatus = {};
          }
          
          // Ensure we have the latest tiers
          refreshRewardTiers();
          
          let codesGenerated = 0;
          
          _rewardTiers.forEach(tier => {
            if (scannedCount >= tier.codesRequired && !userData.redemptionStatus[tier.id]) {
              const code = generateRedemptionCode(tier.id);
              if (code) {
                userData.redemptionStatus[tier.id] = {
                  code: code,
                  generated: Date.now(),
                  redeemed: false,
                  redeemedTimestamp: null,
                  redeemedBy: null
                };
                codesGenerated++;
              }
            }
          });
          
          if (codesGenerated > 0) {
            await DGSHFirebase.saveUserProgress(userData);
            return true;
          }
        }
        
        return false;
      } catch (error) {
        return false;
      }
    },
    
    refreshTiers: function() {
      refreshRewardTiers();
      return _rewardTiers.length > 0;
    },
    
    isInitialized: function() {
      return _initialized;
    }
  };
})();

window.DGSHRewards = DGSHRewards;