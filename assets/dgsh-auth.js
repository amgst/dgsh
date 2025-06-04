/**
 * Doomlings GenCon Scavenger Hunt - Enhanced Authentication Module
 * File path: assets/dgsh-auth.js
 * Enhanced with anonymous user support and account linking
 */

const DGSHAuth = (function() {
  // Private variables
  let _currentCustomer = null;
  let _isAuthenticated = false;
  let _accessToken = null;
  
  // Private methods
  const extractCustomerDataFromPage = function() {
    // Try to extract customer information from Shopify's injected data
    try {
      // Check if we already have customer info in localStorage (for faster loading)
      const cachedCustomer = DGSHStorage.getItem('dgsh_customer_cache');
      
      if (cachedCustomer && cachedCustomer.timestamp && 
          (Date.now() - cachedCustomer.timestamp < 300000)) { // 5 minutes cache
        _currentCustomer = cachedCustomer.data;
        _isAuthenticated = true;
        return true;
      }
      
      // Look for customer in DOM
      if (window.meta && window.meta.page && window.meta.page.customerId) {
        _isAuthenticated = true;
        _currentCustomer = {
          id: window.meta.page.customerId,
          name: window.meta.page.customer ? window.meta.page.customer.name : '',
          email: window.meta.page.customer ? window.meta.page.customer.email : '',
          firstName: window.meta.page.customer ? window.meta.page.customer.firstName : '',
          lastName: window.meta.page.customer ? window.meta.page.customer.lastName : ''
        };
        
        // Cache customer data
        DGSHStorage.setItem('dgsh_customer_cache', {
          data: _currentCustomer,
          timestamp: Date.now()
        });
        
        return true;
      }
      
      // Look for customer object on the window
      if (window.customer && window.customer.id) {
        _isAuthenticated = true;
        _currentCustomer = {
          id: window.customer.id,
          name: window.customer.name || '',
          email: window.customer.email || '',
          firstName: window.customer.first_name || '',
          lastName: window.customer.last_name || ''
        };
        
        // Cache customer data
        DGSHStorage.setItem('dgsh_customer_cache', {
          data: _currentCustomer,
          timestamp: Date.now()
        });
        
        return true;
      }
    } catch (e) {
      _isAuthenticated = false;
      _currentCustomer = null;
    }
    
    return false;
  };
  
  const getStorefrontAccessToken = function() {
    // Try to get the Storefront API token from meta tag
    try {
      const tokenMeta = document.querySelector('meta[name="shopify-storefront-api-token"]');
      return tokenMeta ? tokenMeta.getAttribute('content') : null;
    } catch (e) {
      return null;
    }
  };
  
  const getCustomerAccessToken = function() {
    // Try to get the customer access token from meta tag
    try {
      const tokenMeta = document.querySelector('meta[name="customer-access-token"]');
      return tokenMeta ? tokenMeta.getAttribute('content') : null;
    } catch (e) {
      return null;
    }
  };
  
  // Initialize authentication
  const init = function() {
    extractCustomerDataFromPage();
    _accessToken = getStorefrontAccessToken() || getCustomerAccessToken();
  };
  
  // Public API
  return {
    // Initialize the auth module
    init: function() {
      init();
      return this;
    },
    
    // Check if user is authenticated
    isAuthenticated: function() {
      return _isAuthenticated;
    },
    
    // Get current customer
    getCurrentCustomer: function() {
      return _currentCustomer ? {..._currentCustomer} : null;
    },
    
    // Get the customer ID
    getCustomerId: function() {
      return _currentCustomer ? _currentCustomer.id : null;
    },
    
    // Get customer display name (first name or full name)
    getCustomerDisplayName: function() {
      if (!_currentCustomer) return null;
      
      return _currentCustomer.firstName || 
             _currentCustomer.name || 
             _currentCustomer.email || 
             'Customer';
    },
    
    // Get access token for API calls
    getAccessToken: function() {
      return _accessToken;
    },
    
    // Enhanced login URL generation for anonymous users
    getLoginUrl: function(redirectUrl = null) {
      const huntPage = DGSHConfig.getValue('urls.huntPage');
      const redirectParam = DGSHConfig.getValue('urls.redirectParam');
      
      // Use provided redirectUrl or current URL or hunt page
      const redirect = redirectUrl || window.location.pathname + window.location.search || huntPage;
      
      // Add a parameter to indicate this is an account linking flow
      const isAnonymous = this.isAnonymousUser();
      const linkingParam = isAnonymous ? '&linking=true' : '';
      
      return `/account/login?${redirectParam}=${encodeURIComponent(redirect)}${linkingParam}`;
    },
    
    // Enhanced registration URL for anonymous users  
    getRegisterUrl: function(redirectUrl = null) {
      const huntPage = DGSHConfig.getValue('urls.huntPage');
      const redirectParam = DGSHConfig.getValue('urls.redirectParam') || 'return_to';
      
      // Use provided redirectUrl or current URL or hunt page
      const redirect = redirectUrl || window.location.pathname || huntPage;
      
      // Make sure the redirect URL is absolute
      const absoluteRedirect = redirect.startsWith('/') ? 
        window.location.origin + redirect : redirect;
      
      // Add a parameter to indicate this is an account linking flow
      const isAnonymous = this.isAnonymousUser();
      const linkingParam = isAnonymous ? '&linking=true' : '';
      
      return `/account/register?${redirectParam}=${encodeURIComponent(absoluteRedirect)}${linkingParam}`;
    },
    
    // Check staff password
    checkStaffPassword: function(password) {
      if (!password) return false;
      
      const storedPassword = DGSHStorage.getItem(DGSHConfig.getValue('staff.passwordKey')) ||
                            DGSHConfig.getValue('staff.defaultPassword');
      
      return password === storedPassword;
    },
    
    // Set staff password
    setStaffPassword: function(password) {
      if (!password) return false;
      return DGSHStorage.setItem(DGSHConfig.getValue('staff.passwordKey'), password);
    },
    
    // Check admin password
    checkAdminPassword: function(password) {
      if (!password) return false;
      
      const storedPassword = DGSHStorage.getItem(DGSHConfig.getValue('admin.passwordKey')) ||
                            DGSHConfig.getValue('admin.defaultPassword');
      
      return password === storedPassword;
    },
    
    // Set admin password
    setAdminPassword: function(password) {
      if (!password) return false;
      return DGSHStorage.setItem(DGSHConfig.getValue('admin.passwordKey'), password);
    },
    
    // Enhanced process URL params for account linking
    processUrlParams: function() {
      // Check if there are any URL parameters to process
      const urlParams = new URLSearchParams(window.location.search);
      
      // Process login redirects
      if (urlParams.has('customer_posted') || urlParams.has('linking')) {
        // Force refresh customer data
        _isAuthenticated = false;
        _currentCustomer = null;
        extractCustomerDataFromPage();
        
        // If we just linked an account, handle the transition
        if (urlParams.has('linking') && this.isAuthenticated()) {
          const customer = this.getCurrentCustomer();
          if (customer) {
            this.handleAccountLinking(customer).then(success => {
              if (success) {
                // Clear anonymous-specific data
                this.clearAnonymousSession();
                
                // Show success message
                if (window.DGSHUI && DGSHUI.showToast) {
                  DGSHUI.showToast('Account linked successfully! Your progress is now secure.', 'success');
                }
                
                // Refresh the page to show authenticated state
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              }
            });
          }
        }
        
        // Process any stored temp code
        const tempCode = DGSHStorage.getTempCode();
        if (tempCode && tempCode.code) {
          return {
            action: 'process_temp_code',
            code: tempCode.code
          };
        }
      }
      
      return null;
    },
    
    // Get a masked version of the customer name for privacy
    getMaskedCustomerName: function() {
      if (!_currentCustomer) return null;
      
      const firstName = _currentCustomer.firstName || '';
      const lastName = _currentCustomer.lastName || '';
      
      if (firstName && lastName) {
        return `${firstName[0]}***${firstName.slice(-1)} ${lastName[0]}.`;
      } else if (firstName) {
        return `${firstName[0]}***${firstName.slice(-1)}`;
      } else if (_currentCustomer.email) {
        const emailParts = _currentCustomer.email.split('@');
        if (emailParts.length === 2) {
          const username = emailParts[0];
          return `${username[0]}***${username.slice(-1)}`;
        }
      }
      
      return 'Anonymous';
    },
    
    // NEW: Check if current user is anonymous
    isAnonymousUser: function() {
      try {
        if (!firebase || !firebase.auth) return false;
        const user = firebase.auth().currentUser;
        return user && user.isAnonymous;
      } catch (error) {
        return false;
      }
    },
    
    // NEW: Get anonymous user display name
    getAnonymousDisplayName: function() {
      try {
        if (!this.isAnonymousUser()) return null;
        
        // Try to get from Firebase user document
        const user = firebase.auth().currentUser;
        if (user && user.displayName) {
          return user.displayName;
        }
        
        // Fallback to stored name or generate new one
        const storedName = localStorage.getItem('dgsh_anonymous_name');
        if (storedName) {
          return storedName;
        }
        
        return 'Anonymous Hunter';
      } catch (error) {
        return 'Anonymous Hunter';
      }
    },
    
    // NEW: Check if should prompt for account linking
    shouldPromptForLinking: function(scanCount) {
      // Don't prompt if already authenticated with Shopify
      if (this.isAuthenticated()) return false;
      
      // Don't prompt if not anonymous user
      if (!this.isAnonymousUser()) return false;
      
      // Check if recently dismissed
      const lastDismissed = localStorage.getItem('dgsh_link_prompt_dismissed');
      if (lastDismissed && (Date.now() - parseInt(lastDismissed)) < 24 * 60 * 60 * 1000) {
        return false;
      }
      
      // Prompt at milestones
      return scanCount >= 3;
    },
    
    // NEW: Get user status for UI
    getUserStatus: function() {
      if (this.isAuthenticated()) {
        const customer = this.getCurrentCustomer();
        return {
          type: 'authenticated',
          displayName: this.getCustomerDisplayName(),
          email: customer?.email || '',
          isSecure: true,
          canRedeem: true
        };
      } else if (this.isAnonymousUser()) {
        return {
          type: 'anonymous',
          displayName: this.getAnonymousDisplayName(),
          email: '',
          isSecure: false,
          canRedeem: false
        };
      } else {
        return {
          type: 'guest',
          displayName: 'Guest',
          email: '',
          isSecure: false,
          canRedeem: false
        };
      }
    },
    
    // NEW: Check if user can redeem rewards
    canRedeemRewards: function() {
      // Only authenticated Shopify users can redeem physical rewards
      return this.isAuthenticated();
    },
    
    // NEW: Get account linking URL with current progress preserved
    getAccountLinkingUrl: function(mode = 'login') {
      const currentUrl = window.location.pathname + window.location.search;
      const redirectParam = DGSHConfig.getValue('urls.redirectParam') || 'return_to';
      
      if (mode === 'register') {
        return `/account/register?${redirectParam}=${encodeURIComponent(currentUrl)}`;
      } else {
        return `/account/login?${redirectParam}=${encodeURIComponent(currentUrl)}`;
      }
    },
    
    // NEW: Handle anonymous to authenticated transition
    handleAccountLinking: async function(customer) {
      if (!customer || !this.isAnonymousUser()) return false;
      
      try {
        // Link anonymous Firebase user to Shopify account
        if (window.DGSHFirebase && typeof DGSHFirebase.linkAnonymousToShopifyAccount === 'function') {
          const success = await DGSHFirebase.linkAnonymousToShopifyAccount(customer);
          
          if (success) {
            // Update authentication state
            _currentCustomer = {
              id: customer.id,
              name: customer.name || `${customer.firstName} ${customer.lastName}`.trim(),
              email: customer.email || '',
              firstName: customer.firstName || '',
              lastName: customer.lastName || ''
            };
            _isAuthenticated = true;
            
            // Cache customer data
            DGSHStorage.setItem('dgsh_customer_cache', {
              data: _currentCustomer,
              timestamp: Date.now()
            });
            
            return true;
          }
        }
        
        return false;
      } catch (error) {
        console.error('Error handling account linking:', error);
        return false;
      }
    },
    
    // NEW: Clear anonymous session data
    clearAnonymousSession: function() {
      try {
        localStorage.removeItem('dgsh_anonymous_name');
        localStorage.removeItem('dgsh_benefits_dismissed');
        localStorage.removeItem('dgsh_link_prompt_dismissed');
        return true;
      } catch (error) {
        return false;
      }
    }
  };
})();

// Make the auth module available globally
window.DGSHAuth = DGSHAuth;