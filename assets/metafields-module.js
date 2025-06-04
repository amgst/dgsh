/**
 * Doomlings Scavenger Hunt - Metafields Module
 * Handles Shopify metafields integration for persistent storage
 */

const DoomlingsHuntMetafields = {
  /**
   * Load user progress from metafields
   * @returns {Promise} Resolves with user progress data or null
   */
  loadProgressFromMetafield: async function() {
    if (!DoomlingsHunt.state.isLoggedIn) {
      return Promise.resolve(null);
    }
    
    try {
      // Create GraphQL query to fetch customer metafield
      const query = `
        {
          customer(customerAccessToken: "${this.getCustomerAccessToken()}") {
            metafield(namespace: "${DoomlingsHuntConfig.METAFIELD_NAMESPACE}", key: "${DoomlingsHuntConfig.PROGRESS_KEY}") {
              value
              updatedAt
            }
          }
        }
      `;
      
      // Make request to Shopify Storefront API
      const response = await fetch('/api/2024-01/graphql.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': this.getStorefrontToken(),
        },
        body: JSON.stringify({ query })
      });
      
      const responseData = await response.json();
      
      // Check if we have valid metafield data
      if (responseData.data && 
          responseData.data.customer && 
          responseData.data.customer.metafield && 
          responseData.data.customer.metafield.value) {
        
        // Parse the stored JSON value
        const metafieldValue = JSON.parse(responseData.data.customer.metafield.value);
        
        // Merge with local data if needed
        return this.mergeWithLocalData(metafieldValue);
      }
      
      return null;
    } catch (error) {
      console.error('Error loading data from metafield:', error);
      return null;
    }
  },
  
  /**
   * Save user progress to metafields
   * @param {Object} progressData - User progress data to save
   * @returns {Promise} Resolves when saved
   */
  saveProgressToMetafield: async function(progressData) {
    if (!DoomlingsHunt.state.isLoggedIn) {
      return Promise.resolve();
    }
    
    try {
      // Add timestamp
      progressData.lastUpdated = new Date().toISOString();
      
      // Convert to string (Shopify expects stringified JSON)
      const metafieldValue = JSON.stringify(progressData);
      
      // Prepare mutation
      const mutation = `
        mutation customerUpdateMetafield($metafield: CustomerMetafieldsSetInput!) {
          customerMetafieldsSet(
            customerAccessToken: "${this.getCustomerAccessToken()}"
            metafields: [$metafield]
          ) {
            metafields {
              key
              namespace
              value
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      const variables = {
        metafield: {
          namespace: DoomlingsHuntConfig.METAFIELD_NAMESPACE,
          key: DoomlingsHuntConfig.PROGRESS_KEY,
          value: metafieldValue,
          valueType: "JSON_STRING"
        }
      };
      
      // Make request to Shopify Storefront API
      const response = await fetch('/api/2024-01/graphql.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': this.getStorefrontToken(),
        },
        body: JSON.stringify({ 
          query: mutation,
          variables: variables
        })
      });
      
      const responseData = await response.json();
      
      // Check for errors
      if (responseData.data && 
          responseData.data.customerMetafieldsSet && 
          responseData.data.customerMetafieldsSet.userErrors && 
          responseData.data.customerMetafieldsSet.userErrors.length > 0) {
        
        throw new Error(responseData.data.customerMetafieldsSet.userErrors[0].message);
      }
      
      return responseData;
    } catch (error) {
      console.error('Error saving data to metafield:', error);
      throw error; // Re-throw to handle in the calling function
    }
  },
  
  /**
   * Helper function to merge server and local data
   * @param {Object} serverData - Data from server
   * @returns {Object} - Merged data
   */
  mergeWithLocalData: function(serverData) {
    // Get local data
    const localScannedCodes = DoomlingsHuntStorage.getScannedCodes();
    const localRedemptionCodes = DoomlingsHuntStorage.getRedemptionCodes();
    
    // Default to server data
    const mergedData = { ...serverData };
    
    // If no scanned codes array in server data, use local
    if (!mergedData.scannedCodes) {
      mergedData.scannedCodes = [];
    }
    
    // If no redemption codes array in server data, use local
    if (!mergedData.redemptionCodes) {
      mergedData.redemptionCodes = [];
    }
    
    // Merge scanned codes (remove duplicates)
    localScannedCodes.forEach(code => {
      if (!mergedData.scannedCodes.includes(code)) {
        mergedData.scannedCodes.push(code);
      }
    });
    
    // Merge redemption codes (more complex, using code as unique identifier)
    const mergedRedemptionCodes = [...mergedData.redemptionCodes];
    
    localRedemptionCodes.forEach(localCode => {
      const existingIndex = mergedRedemptionCodes.findIndex(
        serverCode => serverCode.code === localCode.code
      );
      
      // If not in server data, add it
      if (existingIndex === -1) {
        mergedRedemptionCodes.push(localCode);
      }
      // If in server data but local has newer data (like redeemed status)
      else if (localCode.redeemed && !mergedRedemptionCodes[existingIndex].redeemed) {
        mergedRedemptionCodes[existingIndex].redeemed = true;
        mergedRedemptionCodes[existingIndex].redeemedAt = localCode.redeemedAt || new Date().toISOString();
      }
    });
    
    mergedData.redemptionCodes = mergedRedemptionCodes;
    
    // Set lastUpdated to now
    mergedData.lastUpdated = new Date().toISOString();
    
    return mergedData;
  },
  
  /**
   * Get customer access token from cookies or localStorage
   * @returns {String} Customer access token
   */
  getCustomerAccessToken: function() {
    // Option 1: From customer_accessToken cookie
    const tokenCookie = document.cookie
      .split('; ')
      .find(cookie => cookie.startsWith('customer_accessToken='));
    
    if (tokenCookie) {
      return tokenCookie.split('=')[1];
    }
    
    // Option 2: From localStorage if you store it there
    const storedToken = localStorage.getItem('customerAccessToken');
    if (storedToken) {
      return storedToken;
    }
    
    // Option 3: From DoomlingsHunt customer object if available
    if (DoomlingsHunt.customer && DoomlingsHunt.customer.accessToken) {
      return DoomlingsHunt.customer.accessToken;
    }
    
    // If no token is found, look for it in metadata
    return this.getAccessTokenFromMetadata();
  },
  
  /**
   * Get access token from page metadata
   * @returns {String} Access token if found
   */
  getAccessTokenFromMetadata: function() {
    const tokenMeta = document.querySelector('meta[name="customer-access-token"]');
    if (tokenMeta) {
      return tokenMeta.getAttribute('content');
    }
    
    return '';
  },
  
  /**
   * Get Shopify Storefront token from metadata
   * @returns {String} Storefront API token
   */
  getStorefrontToken: function() {
    // Try to get from metadata
    const tokenMeta = document.querySelector('meta[name="shopify-storefront-api-token"]');
    if (tokenMeta) {
      return tokenMeta.getAttribute('content');
    }
    
    // Try to get from Shopify global theme object
    if (typeof theme !== 'undefined' && theme.storefront_token) {
      return theme.storefront_token;
    }
    
    // Try to get from DoomlingsHunt config
    if (DoomlingsHunt.config && DoomlingsHunt.config.STOREFRONT_TOKEN) {
      return DoomlingsHunt.config.STOREFRONT_TOKEN;
    }
    
    return '';
  }
};