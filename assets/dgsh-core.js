const DGSHCore = (function() {
  let _initialized = false;
  let _pageType = null;
  let _dataRefreshInterval = null;
  let _qrCodeProcessed = false; // Prevent duplicate processing
  
  const detectPageType = function() {
    try {
      const path = window.location.pathname;
      
      if (path.includes('/pages/scavenger-hunt')) {
        return 'hunt';
      } else if (path.includes('/pages/dgsh-staff-verification')) {
        return 'staff';
      } else if (path.includes('/pages/hunt-admin')) {
        return 'admin';
      }
      
      return null;
    } catch (error) {
      console.error("Error detecting page type:", error);
      return null;
    }
  };
  
  const handlePostLogin = function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    const isPostLogin = urlParams.has('customer_posted') || 
                        urlParams.has('checkout_url') || 
                        urlParams.has('analytics_trace_id');
    
    const isAccountPage = window.location.pathname === '/account' || 
                          window.location.pathname === '/account/';
    
    if (isPostLogin || isAccountPage) {
      setTimeout(() => {
        try {
          let isAuthenticated = false;
          
          if (window.DGSHAuth && DGSHAuth.isAuthenticated) {
            isAuthenticated = DGSHAuth.isAuthenticated();
          }
          
          if (!isAuthenticated && window.Shopify && window.Shopify.customer) {
            isAuthenticated = true;
          }
          
          if (isAuthenticated) {
            if (window.DGSHUI && DGSHUI.refreshUI) {
              DGSHUI.refreshUI();
            }
            
            const currentPath = window.location.pathname;
            const huntPage = DGSHConfig.getValue('urls.huntPage') || '/pages/scavenger-hunt';
            
            if (currentPath !== huntPage && currentPath.indexOf('/account') === 0) {
              setTimeout(() => {
                window.location.href = huntPage;
              }, 1000);
            }
          }
        } catch (error) {
          console.error("Error in post-login handling:", error);
        }
      }, 1500);
    }
    
    if (window.history && window.history.replaceState && 
        (urlParams.has('customer_posted') || urlParams.has('checkout_url'))) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  };

  // FIXED: Single QR code processing with coordination
  const processQRCodeFromURL = function() {
    // Prevent duplicate processing
    if (_qrCodeProcessed) {
      console.log('QR code already processed, skipping');
      return;
    }
    
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const qrCode = urlParams.get('code');
      
      if (!qrCode) return;
      
      // Mark as processing to prevent duplicates
      _qrCodeProcessed = true;
      
      // Simple format validation
      const qrPattern = /^GC25-[A-Z0-9]+-[0-9]{2}-[A-Z0-9]+$/;
      if (!qrPattern.test(qrCode)) {
        if (window.DGSHUI && DGSHUI.showToast) {
          DGSHUI.showToast('Invalid QR code format', 'error');
        }
        cleanURLParameters();
        return;
      }
      
      console.log('Processing QR code from URL:', qrCode);
      
      // Wait for systems to be ready, then delegate to DGSHUI
      const processCode = async () => {
        try {
          // Wait for DGSHUI to be ready
          let attempts = 0;
          while ((!window.DGSHUI || !window.DGSHUI.isInitialized()) && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 250));
            attempts++;
          }
          
          if (window.DGSHUI && window.DGSHUI.handleCodeScan) {
            // Delegate to DGSHUI - single entry point
            await window.DGSHUI.handleCodeScan(qrCode, { source: 'url' });
          } else {
            console.error('DGSHUI not available for code processing');
          }
          
          // Clean URL after processing
          setTimeout(() => {
            cleanURLParameters();
          }, 1000);
          
        } catch (error) {
          console.error("Error processing QR code from URL:", error);
          cleanURLParameters();
        }
      };
      
      // Start processing
      processCode();
      
    } catch (error) {
      console.error("Error processing QR code from URL:", error);
      cleanURLParameters();
    }
  };

  const cleanURLParameters = function() {
    try {
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (error) {
      console.warn("Could not clean URL:", error);
    }
  };
  
  const setupDataRefresh = function() {
    if (_pageType !== 'hunt') return;
    
    if (_dataRefreshInterval) {
      clearInterval(_dataRefreshInterval);
    }
    
    const refreshInterval = 3 * 60 * 1000;
    
    _dataRefreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        if (window.DGSHFirebase && DGSHFirebase.syncNow) {
          DGSHFirebase.syncNow(false);
        }
      }
    }, refreshInterval);
    
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible' && _pageType === 'hunt') {
        setTimeout(() => {
          if (window.DGSHFirebase && DGSHFirebase.syncNow) {
            DGSHFirebase.syncNow(false);
          }
        }, 500);
      }
    });
  };
  
  const setupWindowEvents = function() {
    try {
      window.addEventListener('focus', function() {
        if (_pageType === 'hunt') {
          setTimeout(() => {
            if (window.DGSHUI && DGSHUI.refreshUI) {
              DGSHUI.refreshUI();
            } else if (window.DGSHFirebase && DGSHFirebase.syncNow) {
              DGSHFirebase.syncNow(false);
            }
          }, 500);
        }
      });
      
      setupDataRefresh();
    } catch (error) {
      console.error("Error setting up window events:", error);
    }
  };
  
  const setupErrorHandling = function() {
    window.addEventListener('error', function(event) {
      const errorMessage = event.error?.message || '';
      
      if (errorMessage.includes('requires an index') || 
          errorMessage.includes('Firebase') ||
          errorMessage.includes('Network request failed') ||
          errorMessage.includes('ResizeObserver loop limit exceeded') ||
          event.error === null ||
          !event.error) {
        return false;
      }
      
      console.error("Application error:", event.error);
      return false;
    });
    
    window.addEventListener('unhandledrejection', function(event) {
      const errorMessage = event.reason?.message || '';
      
      if (errorMessage.includes('requires an index') || 
          errorMessage.includes('Firebase') ||
          errorMessage.includes('Network request failed')) {
        return false;
      }
      
      console.error("Unhandled promise rejection:", event.reason);
      return false;
    });
  };

  // FIXED: Simplified Firebase user ensuring
  const ensureFirebaseUserForHunt = async function() {
    try {
      if (!firebase || !firebase.auth) return false;
      
      // Check if we already have a Firebase user
      if (firebase.auth().currentUser) {
        console.log('Firebase user already exists');
        return true;
      }
      
      // If Shopify customer is authenticated, link to Firebase
      if (DGSHAuth && DGSHAuth.isAuthenticated()) {
        const customer = DGSHAuth.getCurrentCustomer();
        if (customer && window.DGSHFirebase && DGSHFirebase.authenticateWithShopify) {
          console.log('Linking Shopify customer to Firebase');
          await DGSHFirebase.authenticateWithShopify(customer);
          return true;
        }
      }
      
      // Create anonymous Firebase user through DGSHFirebase
      if (window.DGSHFirebase && DGSHFirebase.ensureFirebaseUser) {
        console.log('Creating Firebase user through DGSHFirebase');
        await DGSHFirebase.ensureFirebaseUser();
        return true;
      }
      
      // Fallback: direct anonymous login
      console.log('Fallback: Creating anonymous Firebase user');
      await firebase.auth().signInAnonymously();
      return true;
      
    } catch (error) {
      console.error('Error ensuring Firebase user:', error);
      return false;
    }
  };

  // Handle Account Linking After Shopify Login
  const handleAccountLinking = async function() {
    try {
      // Check if we just logged in and have an anonymous user to link
      const urlParams = new URLSearchParams(window.location.search);
      const isPostLogin = urlParams.has('customer_posted') || urlParams.has('return_to');
      
      if (isPostLogin && DGSHAuth && DGSHAuth.isAuthenticated()) {
        const customer = DGSHAuth.getCurrentCustomer();
        
        // Check if there's an anonymous Firebase user to link
        const user = firebase.auth().currentUser;
        if (user && user.isAnonymous && customer) {
          console.log('Linking anonymous user to Shopify account...');
          
          if (window.DGSHFirebase && typeof DGSHFirebase.linkAnonymousToShopifyAccount === 'function') {
            const linked = await DGSHFirebase.linkAnonymousToShopifyAccount(customer);
            if (linked) {
              console.log('Successfully linked anonymous user to Shopify account');
              // Reload page to refresh with linked account
              setTimeout(() => window.location.reload(), 1000);
              return;
            }
          }
          
          // Fallback: authenticate with Shopify
          if (window.DGSHFirebase && DGSHFirebase.authenticateWithShopify) {
            await DGSHFirebase.authenticateWithShopify(customer);
          }
        }
      }
    } catch (error) {
      console.error('Error handling account linking:', error);
    }
  };
  
  const initModules = function() {
    try {
      const requiredModules = ['DGSHConfig', 'DGSHAuth'];
      
      for (const moduleName of requiredModules) {
        if (!window[moduleName]) {
          throw new Error(`Missing required module: ${moduleName}`);
        }
      }
      
      if (DGSHConfig.init) DGSHConfig.init();
      if (DGSHAuth.init) DGSHAuth.init();
      
      if (_pageType === 'hunt') {
        if (window.firebase) {
          if (window.DGSHFirebase && window.DGSHFirebase.init) {
            window.DGSHFirebase.init();
            
            // Ensure Firebase user exists
            ensureFirebaseUserForHunt();
          }
        } else {
          console.error("Firebase not available");
          return false;
        }
        
        if (window.DGSHRewards && DGSHRewards.init) {
          DGSHRewards.init();
        }
        
        if (window.DGSHQR && DGSHQR.init) {
          DGSHQR.init();
        }
        
        if (window.DGSHUI && DGSHUI.init) {
          DGSHUI.init().then(() => {
            // Process QR code from URL only after DGSHUI is ready
            setTimeout(() => {
              processQRCodeFromURL();
            }, 500);
          });
        }
        
        if (window.DGSHLeaderboard && DGSHLeaderboard.init) {
          DGSHLeaderboard.init();
        }
        
        handlePostLogin();
        
        // Handle account linking after initialization
        setTimeout(handleAccountLinking, 500);
        
      } else if (_pageType === 'staff') {
        if (window.DGSHStaff && DGSHStaff.init) {
          DGSHStaff.init();
        }
        
      } else if (_pageType === 'admin') {
        if (window.DGSHAdmin && DGSHAdmin.init) {
          DGSHAdmin.init();
        }
        
        if (window.DGSHQR && typeof DGSHQR.initAdmin === 'function') {
          setTimeout(() => {
            DGSHQR.initAdmin();
            DGSHQR.fetchAndDisplayQRCodes();
          }, 500);
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error initializing modules:", error);
      return false;
    }
  };
  
  return {
    init: function() {
      try {
        if (_initialized) return this;
        
        _pageType = detectPageType();
        
        if (_pageType) {
          initModules();
          setupWindowEvents();
          setupErrorHandling();
          
          _initialized = true;
        }
        
        return this;
      } catch (error) {
        console.error("Error initializing core:", error);
        return this;
      }
    },
    
    getPageType: function() {
      return _pageType;
    },
    
    isInitialized: function() {
      return _initialized;
    },
    
    handleQRCode: function(code) {
      if (!_initialized || _pageType !== 'hunt') return false;
      
      try {
        if (window.DGSHUI && DGSHUI.handleCodeScan) {
          DGSHUI.handleCodeScan(code, { source: 'external' });
          return true;
        }
        return false;
      } catch (error) {
        console.error("Error handling QR code:", error);
        return false;
      }
    },
    
    forceSyncData: function() {
      if (!_initialized || _pageType !== 'hunt') return false;
      
      try {
        if (window.DGSHUI && DGSHUI.refreshUI) {
          DGSHUI.refreshUI();
          return true;
        } else if (window.DGSHFirebase && DGSHFirebase.syncNow) {
          return DGSHFirebase.syncNow(true);
        }
        return false;
      } catch (error) {
        console.error("Error forcing sync:", error);
        return false;
      }
    },
    
    getUserProgress: function() {
      if (!_initialized || _pageType !== 'hunt') return null;
      
      try {
        return DGSHFirebase.getUserProgress();
      } catch (error) {
        console.error("Error getting user progress:", error);
        return null;
      }
    },
    
    clearCaches: function() {
      if (window.DGSHFirebase && typeof DGSHFirebase.clearCache === 'function') {
        DGSHFirebase.clearCache();
      }
      
      try {
        localStorage.removeItem('dgsh_firebase_cache');
        localStorage.removeItem('dgsh_leaderboard_cache');
        localStorage.removeItem('dgsh_user_progress_cache');
        localStorage.removeItem('dgsh_temp_code');
        localStorage.removeItem('dgsh_benefits_dismissed');
        localStorage.removeItem('dgsh_link_prompt_dismissed');
      } catch (error) {
        // Ignore localStorage errors
      }
      
      return true;
    },
    
    // Check if user is anonymous
    isAnonymousUser: function() {
      try {
        const user = firebase.auth().currentUser;
        return user && user.isAnonymous;
      } catch (error) {
        return false;
      }
    },
    
    // Force ensure Firebase user
    ensureFirebaseUser: function() {
      return ensureFirebaseUserForHunt();
    },
    
    destroy: function() {
      try {
        if (_dataRefreshInterval) {
          clearInterval(_dataRefreshInterval);
          _dataRefreshInterval = null;
        }
        
        _initialized = false;
        _pageType = null;
        _qrCodeProcessed = false;
        
        return true;
      } catch (error) {
        console.error("Error destroying core:", error);
        return false;
      }
    }
  };
})();

window.DGSHCore = DGSHCore;