/**
 * Doomlings GenCon Scavenger Hunt - Scheduling Module
 * File path: assets/dgsh-scheduler.js
 */

const DGSHScheduler = (function() {
  let _initialized = false;
  let _scheduleSettings = null;
  
  // Default schedule settings
  const getDefaultSchedule = function() {
    return {
      enabled: false,
      startDate: null,
      endDate: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      lastUpdated: Date.now()
    };
  };
  
  // Initialize scheduler
  const init = function() {
    if (_initialized) return true;
    
    // Load schedule from Firebase or use defaults
    loadScheduleSettings();
    _initialized = true;
    return true;
  };
  
  // Load schedule settings from Firebase

  // Save schedule settings to Firebase
const loadScheduleSettings = function() {
    _scheduleSettings = getDefaultSchedule();
  };

  const saveScheduleSettings = function(settings) {
    _scheduleSettings = settings;
    return true;
  };
  
  // Check if hunt is currently active
  const isHuntActive = function() {
    if (!_scheduleSettings || !_scheduleSettings.enabled) {
      return true; // If scheduling is disabled, hunt is always active
    }
    
    const now = new Date();
    const startDate = _scheduleSettings.startDate ? new Date(_scheduleSettings.startDate) : null;
    const endDate = _scheduleSettings.endDate ? new Date(_scheduleSettings.endDate) : null;
    
    // Check if we're within the scheduled time window
    if (startDate && now < startDate) {
      return false; // Hunt hasn't started yet
    }
    
    if (endDate && now > endDate) {
      return false; // Hunt has ended
    }
    
    return true; // Hunt is active
  };
  
  // Get schedule status information
  const getScheduleStatus = function() {
    if (!_scheduleSettings || !_scheduleSettings.enabled) {
      return {
        active: true,
        status: 'always_active',
        message: 'Hunt is always active (no schedule set)'
      };
    }
    
    const now = new Date();
    const startDate = _scheduleSettings.startDate ? new Date(_scheduleSettings.startDate) : null;
    const endDate = _scheduleSettings.endDate ? new Date(_scheduleSettings.endDate) : null;
    
    if (startDate && now < startDate) {
      return {
        active: false,
        status: 'not_started',
        message: `Hunt starts on ${startDate.toLocaleString()}`,
        startsIn: startDate.getTime() - now.getTime()
      };
    }
    
    if (endDate && now > endDate) {
      return {
        active: false,
        status: 'ended',
        message: `Hunt ended on ${endDate.toLocaleString()}`,
        endedAgo: now.getTime() - endDate.getTime()
      };
    }
    
    return {
      active: true,
      status: 'active',
      message: endDate ? `Hunt ends on ${endDate.toLocaleString()}` : 'Hunt is currently active',
      endsIn: endDate ? endDate.getTime() - now.getTime() : null
    };
  };
  
  // Public API
  return {
    init: function() {
      if (!_initialized) init();
      return this;
    },
    
    isInitialized: function() {
      return _initialized;
    },
    
    isHuntActive: function() {
      return isHuntActive();
    },
    
    getScheduleStatus: function() {
      return getScheduleStatus();
    },
    
    getScheduleSettings: function() {
      return _scheduleSettings ? {..._scheduleSettings} : null;
    },
    
    updateScheduleSettings: async function(settings) {
      return await saveScheduleSettings(settings);
    },
    
    enableScheduling: async function(startDate, endDate) {
      const settings = {
        enabled: true,
        startDate: startDate,
        endDate: endDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      return await saveScheduleSettings(settings);
    }, 
    
    disableScheduling: async function() {
      const settings = getDefaultSchedule();
      return await saveScheduleSettings(settings);
    },
    
    // Validate if a QR code scan should be allowed
    validateScanTiming: function() {
      const status = getScheduleStatus();
      
      if (!status.active) {
        return {
          allowed: false,
          reason: status.status,
          message: status.message
        };
      }
      
      return {
        allowed: true,
        message: 'Scan allowed'
      };
    }
  };
})();

window.DGSHScheduler = DGSHScheduler;