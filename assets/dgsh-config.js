/**
 * Doomlings GenCon Scavenger Hunt - Simplified Configuration Module
 * File path: assets/dgsh-config.js
 */

const DGSHConfig = (function() {
  // Private configuration values - STATIC ONLY
  const _config = {
    // Hunt parameters
    huntName: "Doomlings GenCon 2025 Scavenger Hunt",
    
    // Storage keys with prefixes to avoid conflicts
    storageKeys: {
      userData: "dgsh_user_data",
      tempCode: "dgsh_temp_code",
      lastSync: "dgsh_last_sync",
      pendingOperations: "dgsh_pending_ops"
    },
    
    // Shopify metafields configuration
    metafields: {
      namespace: "scavenger_hunt",
      key: "user_progress"
    },
    
    // URLs and redirects
    urls: {
      huntPage: "/pages/scavenger-hunt",
      staffPage: "/pages/dgsh-staff-verification",
      adminPage: "/pages/hunt-admin",
      redirectParam: "redirect_to"
    },
    
    // Reward tier schema - STATIC CONFIGURATION
    tierSchema: {
      version: "1.0",
      lastUpdated: Date.now(),
      tiers: [
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
      ]
    },
    
    // Calculated property for backward compatibility
    get rewardTiers() {
      return this.tierSchema.tiers;
    },
    
    // Calculated property for total codes needed
    get totalCodes() {
      if (!this.tierSchema || !this.tierSchema.tiers || this.tierSchema.tiers.length === 0) {
        return 12; // Default fallback
      }
      return Math.max(...this.tierSchema.tiers.map(tier => tier.codesRequired));
    },
    
    // Redemption code format settings
    redemptionCode: {
      prefix: "DOOM",
      randomChars: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", // Omitting similar looking characters
      randomLength: 4,
      tierSeparator: "-",
      suffixLength: 4
    },
    
    // QR code format and validation - SIMPLIFIED
    qrCode: {
      pattern: /^GC25-[A-Z0-9]+-[0-9]{2}-[A-Z0-9]+$/,
      urlParam: "code"
    },
    
    // Staff verification settings
    staff: {
      passwordProtected: true,
      passwordKey: "dgsh_staff_pw",
      defaultPassword: "DoomlingsStaff2025", // Should be changed by admin
      useCamera: true
    },
    
    // Admin settings
    admin: {
      passwordProtected: true,
      passwordKey: "dgsh_admin_pw",
      defaultPassword: "DoomlingsAdmin2025", // Should be changed by admin
      refreshInterval: 60000 // 1 minute
    },
    
    // Sync settings
    sync: {
      autoSyncInterval: 300000, // 5 minutes
      minSyncInterval: 5000, // 5 seconds (to prevent excessive API calls)
      maxRetries: 3,
      retryDelay: 3000 // 3 seconds
    },
    
    // Leaderboard settings
    leaderboard: {
      displayCount: 10,
      refreshInterval: 300000, // 5 minutes
      namePrivacy: true, // If true, partially mask names
      storageKey: "dgsh_leaderboard_data",
      cacheExpiry: 300000 // 5 minutes
    }
  };
  
  // Public API - SIMPLIFIED TO GETTERS ONLY
  return {
    // Initialize the configuration module
    init: function() {
      return this;
    },
    
    // Get the entire configuration object (immutable copy)
    getConfig: function() {
      return JSON.parse(JSON.stringify(_config));
    },
    
    // Get a specific configuration section
    getSection: function(sectionName) {
      if (_config[sectionName]) {
        return JSON.parse(JSON.stringify(_config[sectionName]));
      }
      return null;
    },
    
    // Get a specific configuration value
    getValue: function(path) {
      const parts = path.split('.');
      let value = _config;
      
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          return null;
        }
      }
      
      // Return deep copy for objects, direct value for primitives
      return (typeof value === 'object' && value !== null) 
        ? JSON.parse(JSON.stringify(value)) 
        : value;
    },
    
    // Get reward tier info by scanned code count
    getRewardTierByCount: function(count) {
      // Find the highest tier that the count qualifies for
      const tiers = _config.tierSchema.tiers
        .filter(tier => count >= tier.codesRequired)
        .sort((a, b) => b.codesRequired - a.codesRequired);
      
      return tiers.length > 0 ? JSON.parse(JSON.stringify(tiers[0])) : null;
    },
    
    // Get all reward tiers that a count qualifies for
    getQualifyingRewardTiers: function(count) {
      return _config.tierSchema.tiers
        .filter(tier => count >= tier.codesRequired)
        .map(tier => JSON.parse(JSON.stringify(tier)));
    },
    
    // Get all reward tiers
    getAllRewardTiers: function() {
      return JSON.parse(JSON.stringify(_config.tierSchema.tiers));
    },
    
    // Get a specific reward tier by ID
    getRewardTierById: function(tierId) {
      const tier = _config.tierSchema.tiers.find(tier => tier.id === tierId);
      return tier ? JSON.parse(JSON.stringify(tier)) : null;
    },
    
    // Get the total number of codes required for the hunt
    getTotalCodesRequired: function() {
      return _config.totalCodes;
    },
    
    // Validate QR code format - SIMPLE VALIDATION ONLY
    isValidQRCode: function(code) {
      return _config.qrCode.pattern.test(code);
    },
    
    // Format the base URL for QR codes
    formatQRCodeUrl: function(code) {
      return `${window.location.origin}${_config.urls.huntPage}?${_config.qrCode.urlParam}=${code}`;
    }
  };
})();

// Make the config available globally
window.DGSHConfig = DGSHConfig;