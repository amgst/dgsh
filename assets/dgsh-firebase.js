/**
* File: dgsh-firebase.js
* Location: assets/dgsh-firebase.js
* FIXED: Proper duplicate detection and user creation
*/

const DGSHFirebase = (function() {
 // Private module variables
 let _initialized = false;
 let _currentUser = null;
 let _db = null;
 let _auth = null;
 let _shopifyCustomerId = null;
 let _userId = null;
 
 // Cache system
 const _cache = {
   data: {},
   expiry: {},
   lastRefresh: {}
 };
 
 // Cache durations (in milliseconds)
 const CACHE_DURATIONS = {
   userData: 2 * 60 * 1000,         // 2 minutes
   tierSchema: 15 * 60 * 1000,      // 15 minutes
   leaderboard: 5 * 60 * 1000,      // 5 minutes
   huntSettings: 10 * 60 * 1000,    // 10 minutes
   qrCodes: 5 * 60 * 1000           // 5 minutes
 };
 
 // Initialize the module
 const init = function() {
   if (_initialized) return true;
   
   try {
     if (typeof firebase === 'undefined' || !firebase.apps.length) {
       console.error("Firebase not initialized or not available");
       return false;
     }
     
     // Initialize Firestore with offline persistence
     _db = firebase.firestore();
     _db.enablePersistence({ synchronizeTabs: true })
       .catch(err => {
         if (err.code === 'failed-precondition') {
           console.warn('Firebase persistence not enabled: multiple tabs open');
         } else if (err.code === 'unimplemented') {
           console.warn('Firebase persistence not supported in this browser');
         }
       });
     
     // Initialize auth
     _auth = firebase.auth();
     
     loadCacheFromLocalStorage();
     
     // Set up auth state change listener
     _auth.onAuthStateChanged(function(user) {
       _currentUser = user;
       if (user) {
         _userId = user.isAnonymous ? user.uid : `shopify_${_shopifyCustomerId}`;
         if (!user.isAnonymous && _shopifyCustomerId) {
           checkAndCreateUserDocument();
         }
       }
     });
     
     // Fetch hunt settings including tier schema
     fetchHuntSettings();
     
     // Set up periodic cache saving
     setInterval(saveCacheToLocalStorage, 60000);
     
     _initialized = true;
     return true;
   } catch (e) {
     console.error("Firebase init error:", e);
     return false;
   }
 };

 // FIXED: Ensure Firebase User with proper sequencing
const ensureFirebaseUser = async function() {
  try {
    console.log('Ensuring Firebase user exists...');
    
    // If we already have a user, return it
    if (_auth.currentUser) {
      console.log('Firebase user already exists:', _auth.currentUser.uid);
      return _auth.currentUser;
    }
    
    // Create anonymous user
    console.log('Creating anonymous Firebase user...');
    const result = await _auth.signInAnonymously();
    const user = result.user;
    
    console.log('Anonymous user created:', user.uid);
    
    // Create user document and wait for completion
    const userId = user.uid;
    const docRef = _db.collection('users').doc(userId);
    
    // Check if document exists
    const doc = await docRef.get();
    if (!doc.exists) {
      console.log('Creating user document...');
      
      const userData = {
        isAnonymous: true,
        displayName: generateAnonymousName(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        scannedCodes: [],
        redemptionStatus: {},
        drawingEntries: 0,
        drawingBonusEntries: 0,
        deviceInfo: getDeviceInfo(),
        sessionId: generateSessionId()
      };
      
      await docRef.set(userData);
      console.log('User document created successfully');
      
      // Update cache
      setCachedData('userData', {
        scannedCodes: [],
        redemptionStatus: {},
        drawingEntries: 0,
        drawingBonusEntries: 0,
        isAnonymous: true,
        displayName: userData.displayName
      });
    } else {
      console.log('User document already exists');
    }
    
    return user;
  } catch (error) {
    console.error('Error ensuring Firebase user:', error);
    throw error;
  }
};

 // Generate Anonymous Display Names
 const generateAnonymousName = function() {
   const adjectives = ['Swift', 'Brave', 'Clever', 'Mighty', 'Stealth', 'Cosmic', 'Thunder', 'Shadow', 'Flame', 'Storm'];
   const nouns = ['Hunter', 'Scout', 'Seeker', 'Explorer', 'Ranger', 'Tracker', 'Wanderer', 'Pioneer', 'Adventurer', 'Nomad'];
   
   const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
   const noun = nouns[Math.floor(Math.random() * nouns.length)];
   const number = Math.floor(Math.random() * 999) + 1;
   
   return `${adjective}${noun}${number}`;
 };

 // Device/Session Info for Analytics
 const getDeviceInfo = function() {
   try {
     return {
       userAgent: navigator.userAgent,
       platform: navigator.platform,
       language: navigator.language,
       screenResolution: `${screen.width}x${screen.height}`,
       timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
       referrer: document.referrer
     };
   } catch (error) {
     return { userAgent: 'Unknown', platform: 'Unknown' };
   }
 };

 const generateSessionId = function() {
   return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
 };

 // Account Linking (Convert Anonymous → Real Account)
 const linkAnonymousToShopifyAccount = async function(shopifyCustomer) {
   const currentUser = _auth.currentUser;
   if (!currentUser || !currentUser.isAnonymous) return false;
   
   try {
     const anonymousUserId = currentUser.uid;
     
     // Get anonymous user data
     const anonymousDoc = await _db.collection('users').doc(anonymousUserId).get();
     const anonymousData = anonymousDoc.data();
     
     if (!anonymousData) return false;
     
     // Create new authenticated user document with Shopify ID
     const shopifyUserId = `shopify_${shopifyCustomer.id}`;
     
     const linkedUserData = {
       ...anonymousData,
       isAnonymous: false,
       shopifyCustomerId: shopifyCustomer.id.toString(),
       email: shopifyCustomer.email || '',
       displayName: shopifyCustomer.firstName || anonymousData.displayName,
       firstName: shopifyCustomer.firstName || '',
       lastName: shopifyCustomer.lastName || '',
       linkedAt: firebase.firestore.FieldValue.serverTimestamp(),
       previousAnonymousId: anonymousUserId
     };
     
     // Save to new document
     await _db.collection('users').doc(shopifyUserId).set(linkedUserData);
     
     // Delete anonymous document
     await _db.collection('users').doc(anonymousUserId).delete();
     
     // Update internal state
     _shopifyCustomerId = shopifyCustomer.id;
     _userId = shopifyUserId;
     
     console.log('Successfully linked anonymous user to Shopify account');
     return true;
     
   } catch (error) {
     console.error('Error linking anonymous user:', error);
     return false;
   }
 };
 
 // Cache functions
 const loadCacheFromLocalStorage = function() {
   try {
     const savedCache = localStorage.getItem('dgsh_firebase_cache');
     if (savedCache) {
       const parsed = JSON.parse(savedCache);
       if (parsed.timestamp && (Date.now() - parsed.timestamp) < 24 * 60 * 60 * 1000) {
         _cache.data = parsed.data || {};
         _cache.expiry = parsed.expiry || {};
         _cache.lastRefresh = parsed.lastRefresh || {};
       }
     }
   } catch (e) {
     console.error('Error loading cache from localStorage', e);
     _cache.data = {};
     _cache.expiry = {};
     _cache.lastRefresh = {};
   }
 };
 
 const saveCacheToLocalStorage = function() {
   try {
     localStorage.setItem('dgsh_firebase_cache', JSON.stringify({
       data: _cache.data,
       expiry: _cache.expiry,
       lastRefresh: _cache.lastRefresh,
       timestamp: Date.now()
     }));
   } catch (e) {
     console.error('Error saving cache to localStorage', e);
   }
 };
 
 const getCachedData = function(key) {
   if (_cache.data[key] && _cache.expiry[key] > Date.now()) {
     return _cache.data[key];
   }
   return null;
 };
 
 const setCachedData = function(key, data, duration) {
   _cache.data[key] = data;
   _cache.expiry[key] = Date.now() + (duration || CACHE_DURATIONS[key] || 60000);
   _cache.lastRefresh[key] = Date.now();
 };
 
 const invalidateCache = function(key) {
   delete _cache.data[key];
   delete _cache.expiry[key];
 };
 
 // Fetch hunt settings and cache them
 const fetchHuntSettings = async function() {
   if (!_db) return null;
   
   const cachedSettings = getCachedData('huntSettings');
   if (cachedSettings) return cachedSettings;
   
   try {
     const settingsDoc = await _db.collection('config').doc('huntSettings').get();
     
     if (settingsDoc.exists) {
       const settings = settingsDoc.data();
       setCachedData('huntSettings', settings);
       return settings;
     }
     
     return null;
   } catch (e) {
     console.error("Error fetching hunt settings:", e);
     return null;
   }
 };
 
 // Check and create user document if it doesn't exist (for Shopify users)
 const checkAndCreateUserDocument = async function() {
   if (!_userId || !_db || !_shopifyCustomerId) return;
   
   try {
     const docRef = _db.collection('users').doc(_userId);
     const doc = await docRef.get();
     
     if (!doc.exists) {
       const customer = DGSHAuth.getCurrentCustomer();
       const displayName = DGSHAuth.getCustomerDisplayName() || 'Hunter';
       
       const userData = {
         isAnonymous: false,
         shopifyCustomerId: _shopifyCustomerId.toString(),
         email: customer?.email || '',
         displayName: displayName,
         createdAt: firebase.firestore.FieldValue.serverTimestamp(),
         lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
         scannedCodes: [],
         redemptionStatus: {},
         firstScanTime: null,
         lastScanTime: null,
         drawingEntries: 0,
         drawingBonusEntries: 0,
         phoneNumber: null
       };
       
       await docRef.set(userData);
       
       setCachedData('userData', {
         scannedCodes: [],
         redemptionStatus: {},
         firstScanTime: null,
         lastScanTime: null,
         drawingEntries: 0,
         drawingBonusEntries: 0,
         phoneNumber: null,
         isAnonymous: false
       });
     } else {
       await docRef.update({
         lastLogin: firebase.firestore.FieldValue.serverTimestamp()
       });
       
       const userData = doc.data();
       setCachedData('userData', {
         scannedCodes: userData.scannedCodes || [],
         redemptionStatus: userData.redemptionStatus || {},
         firstScanTime: userData.firstScanTime || null,
         lastScanTime: userData.lastScanTime || null,
         drawingEntries: userData.drawingEntries || 0,
         drawingBonusEntries: userData.drawingBonusEntries || 0,
         phoneNumber: userData.phoneNumber || null,
         isAnonymous: false
       });
     }
   } catch (e) {
     console.error("Error checking/creating user document:", e);
   }
 };
 
 // Get the current user ID (works for both anonymous and authenticated users)
 const getUserId = function() {
   if (_userId) return _userId;
   
   const currentUser = _auth.currentUser;
   if (currentUser) {
     if (currentUser.isAnonymous) {
       _userId = currentUser.uid;
     } else if (_shopifyCustomerId) {
       _userId = `shopify_${_shopifyCustomerId}`;
     }
     return _userId;
   }
   
   // Fallback for backwards compatibility
   const storedId = localStorage.getItem('dgsh_user_id');
   if (storedId) return storedId;
   
   if (DGSHAuth && DGSHAuth.isAuthenticated()) {
     const customerId = DGSHAuth.getCustomerId();
     if (customerId) {
       _userId = `shopify_${customerId}`;
       _shopifyCustomerId = customerId;
       localStorage.setItem('dgsh_user_id', _userId);
       return _userId;
     }
   }
   
   return null;
 };

 // Get user progress data
 const getUserProgress = async function() {
   if (!_initialized) init();
   
   try {
     // Ensure we have a Firebase user first
     await ensureFirebaseUser();
     
     const userId = getUserId();
     if (!userId) {
       throw new Error('No user ID available');
     }
     
     // Check cache first
     const cachedUserData = getCachedData('userData');
     if (cachedUserData) {
       return cachedUserData;
     }
     
     if (!_db) _db = firebase.firestore();
     
     const doc = await _db.collection('users').doc(userId).get();
     
     if (!doc.exists) {
       throw new Error('User document not found');
     }
     
     const userData = doc.data();
     const progressData = {
       scannedCodes: userData.scannedCodes || [],
       redemptionStatus: userData.redemptionStatus || {},
       firstScanTime: userData.firstScanTime || null,
       lastScanTime: userData.lastScanTime || null,
       drawingEntries: userData.drawingEntries || 0,
       drawingBonusEntries: userData.drawingBonusEntries || 0,
       phoneNumber: userData.phoneNumber || null,
       isAnonymous: userData.isAnonymous || false,
       displayName: userData.displayName || (userData.isAnonymous ? generateAnonymousName() : 'Hunter')
     };

     // Auto-calculate drawing entries if missing
     if (progressData.drawingEntries === 0 && progressData.scannedCodes.length > 0) {
       progressData.drawingEntries = progressData.scannedCodes.length;
       console.log("Auto-calculated drawing entries:", progressData.drawingEntries);
       
       // Save the corrected data back to Firebase
       await saveUserProgress(progressData);
     }

     setCachedData('userData', progressData);
     return progressData;

   } catch (e) {
     console.error("Error getting user progress:", e);
     throw e;
   }
 };
 
 // FIXED: Add scanned code with proper duplicate detection
const addScannedCode = async function(code, metadata = {}) {
  if (!code) {
    return { success: false, reason: 'invalid_code' };
  }
  
  try {
    console.log('Adding scanned code:', code);
    
    // Ensure user exists first
    await ensureFirebaseUser();
    
    const userId = getUserId();
    if (!userId) {
      return { success: false, reason: 'no_user_id' };
    }
    
    const userDocRef = _db.collection('users').doc(userId);
    
    // STEP 1: Get current document to check for duplicates
    const currentDoc = await userDocRef.get();
    if (!currentDoc.exists) {
      return { success: false, reason: 'user_document_not_found' };
    }
    
    const currentData = currentDoc.data();
    const currentScannedCodes = currentData.scannedCodes || [];
    
    // STEP 2: Check for duplicate codes (by code value only, ignore timestamp)
    const isDuplicate = currentScannedCodes.some(scan => scan.code === code);
    
    if (isDuplicate) {
      console.log('Code already scanned:', code);
      return { 
        success: false, 
        reason: 'already_scanned',
        newCount: currentScannedCodes.length 
      };
    }
    
    // STEP 3: Add new scan with timestamp
    const newScan = {
      code: code,
      timestamp: Date.now(),
      ...metadata
    };
    
    const updatedScannedCodes = [...currentScannedCodes, newScan];
    
    // STEP 4: Update the document
    await userDocRef.update({
      scannedCodes: updatedScannedCodes,
      drawingEntries: updatedScannedCodes.length, // Update drawing entries
      lastScanTime: Date.now(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Code successfully added. New count:', updatedScannedCodes.length);
    
    // STEP 5: Invalidate cache to force refresh
    invalidateCache('userData');
    
    return { 
      success: true, 
      newCount: updatedScannedCodes.length 
    };
    
  } catch (error) {
    console.error("Error adding scanned code:", error);
    return { success: false, reason: 'error', message: error.message };
  }
};

 // Save user progress data (works for both user types)
 const saveUserProgress = async function(userData) {
   if (!_initialized) init();
   
   try {
     const userId = getUserId();
     if (!userId) return false;
     
     if (!_db) _db = firebase.firestore();
     
     let firstScanTime = userData.firstScanTime;
     let lastScanTime = userData.lastScanTime;
     
     if (userData.scannedCodes && userData.scannedCodes.length > 0) {
       const sortedCodes = [...userData.scannedCodes].sort((a, b) => a.timestamp - b.timestamp);
       
       if (!firstScanTime && sortedCodes.length > 0) {
         firstScanTime = sortedCodes[0].timestamp;
       }
       
       if (sortedCodes.length > 0) {
         lastScanTime = sortedCodes[sortedCodes.length - 1].timestamp;
       }
     }
     
     const dataToSave = {
       scannedCodes: userData.scannedCodes || [],
       redemptionStatus: userData.redemptionStatus || {},
       firstScanTime: firstScanTime,
       lastScanTime: lastScanTime,
       drawingEntries: userData.drawingEntries || 0,
       drawingBonusEntries: userData.drawingBonusEntries || 0,
       updatedAt: firebase.firestore.FieldValue.serverTimestamp()
     };
     
     // Include phone number if it exists
     if (userData.phoneNumber) {
       dataToSave.phoneNumber = userData.phoneNumber;
     }
     
     await _db.collection('users').doc(userId).update(dataToSave);
     
     // Update the leaderboard if necessary (only for completed hunts)
     await updateLeaderboard(userId, userData.scannedCodes.length, firstScanTime, lastScanTime);
     
     // Update cached user data
     setCachedData('userData', {
       scannedCodes: userData.scannedCodes || [],
       redemptionStatus: userData.redemptionStatus || {},
       firstScanTime: firstScanTime,
       lastScanTime: lastScanTime,
       drawingEntries: userData.drawingEntries || 0,
       drawingBonusEntries: userData.drawingBonusEntries || 0,
       phoneNumber: userData.phoneNumber || null,
       isAnonymous: userData.isAnonymous || false,
       displayName: userData.displayName
     });
     
     return true;
   } catch (e) {
     console.error("Error saving user progress:", e);
     return false;
   }
 };

 // Save phone number to user profile (works for both user types)
 const savePhoneNumber = async function(phoneNumber) {
   if (!_initialized) init();
   
   if (!phoneNumber) return false;
   
   try {
     // Ensure we have a Firebase user
     await ensureFirebaseUser();
     
     const userId = getUserId();
     if (!userId) return false;
     
     if (!_db) _db = firebase.firestore();
     
     // Update user document with phone number
     await _db.collection('users').doc(userId).update({
       phoneNumber: phoneNumber.trim(),
       updatedAt: firebase.firestore.FieldValue.serverTimestamp()
     });
     
     // Update cache
     const cachedData = getCachedData('userData');
     if (cachedData) {
       cachedData.phoneNumber = phoneNumber.trim();
       setCachedData('userData', cachedData);
     }
     
     console.log("Phone number saved successfully:", phoneNumber);
     return true;
     
   } catch (error) {
     console.error("Error saving phone number:", error);
     return false;
   }
 };

 // Get all QR codes
 const getQRCodes = async function() {
   if (!_initialized) init();
   
   const cachedCodes = getCachedData('qrCodes');
   if (cachedCodes) return cachedCodes;
   
   try {
     if (!_db) {
       if (firebase && firebase.firestore) {
         _db = firebase.firestore();
       } else {
         console.error("Firebase Firestore not available");
         return [];
       }
     }
     
     // Try to authenticate if not already (anonymous is fine)
     if (!_auth.currentUser) {
       try {
         await _auth.signInAnonymously();
       } catch (authError) {
         console.error("Firebase auth error:", authError);
       }
     }
     
     const snapshot = await _db.collection('valid_codes').get();
     const codes = [];
     
     snapshot.forEach(doc => {
       codes.push({
         code: doc.id,
         ...doc.data()
       });
     });
     
     setCachedData('qrCodes', codes);
     return codes;
   } catch (e) {
     console.error("Error getting QR codes from Firebase:", e);
     return [];
   }
 };

 // Update the leaderboard (only for completed hunts)
 const updateLeaderboard = async function(userId, scannedCount, firstScanTime, lastScanTime) {
   if (!userId) return false;
   
   try {
     // Get the total codes dynamically from tier schema
     let totalCodes = 12; // Default fallback
     
     const cachedSchema = getCachedData('tierSchema');
     if (cachedSchema && cachedSchema.tiers && cachedSchema.tiers.length > 0) {
       totalCodes = Math.max(...cachedSchema.tiers.map(tier => tier.codesRequired));
     } else if (window.DGSHConfig && typeof DGSHConfig.getTotalCodesRequired === 'function') {
       totalCodes = DGSHConfig.getTotalCodesRequired();
     } else {
       const configDoc = await _db.collection('config').doc('huntSettings').get();
       if (configDoc.exists) {
         const config = configDoc.data();
         if (config.tierSchema && config.tierSchema.tiers && config.tierSchema.tiers.length > 0) {
           totalCodes = Math.max(...config.tierSchema.tiers.map(tier => tier.codesRequired));
         } else if (config.totalCodes) {
           totalCodes = config.totalCodes;
         }
       }
     }
     
     // Only update leaderboard if hunt is completed
     if (scannedCount >= totalCodes && firstScanTime && lastScanTime) {
       const userDoc = await _db.collection('users').doc(userId).get();
       
       if (!userDoc.exists) return false;
       
       const userData = userDoc.data();
       
       const completionTime = lastScanTime - firstScanTime;
       const formattedTime = formatCompletionTime(completionTime);
       
       await _db.collection('leaderboard').doc(userId).set({
         userId: userId,
         shopifyCustomerId: userData.shopifyCustomerId || 'anonymous',
         displayName: userData.displayName || 'Anonymous Hunter',
         completionTime: completionTime,
         formattedTime: formattedTime,
         scannedCount: scannedCount,
         isCompleted: true,
         isAnonymous: userData.isAnonymous || false,
         completedAt: firebase.firestore.FieldValue.serverTimestamp()
       });
       
       invalidateCache('leaderboard');
       return true;
     }
     
     return false;
   } catch (e) {
     console.error("Error updating leaderboard:", e);
     return false;
   }
 };

 // Get leaderboard data (includes anonymous users)
 const getLeaderboardData = async function() {
   if (!_initialized) init();
   
   const cachedLeaderboard = getCachedData('leaderboard');
   if (cachedLeaderboard) return cachedLeaderboard;

   try {
     if (!_db) _db = firebase.firestore();
     
     // Get total codes required for completion
     let totalCodesRequired = 12; // Default
     try {
       const settingsDoc = await _db.collection('config').doc('huntSettings').get();
       if (settingsDoc.exists) {
         const data = settingsDoc.data();
         if (data.tierSchema && data.tierSchema.tiers && data.tierSchema.tiers.length > 0) {
           totalCodesRequired = Math.max(...data.tierSchema.tiers.map(tier => tier.codesRequired));
         }
       }
     } catch (error) {
       console.warn("Error getting total codes:", error);
     }
     
     const snapshot = await _db.collection('leaderboard')
       .where('scannedCount', '>=', totalCodesRequired)
       .orderBy('scannedCount', 'desc')
       .orderBy('completionTime', 'asc')
       .limit(100)
       .get();
     
     const leaderboardData = [];
     
     const tempData = [];
     snapshot.forEach(doc => {
       const data = doc.data();
       if (data.scannedCount >= totalCodesRequired) {
         tempData.push({
           userId: doc.id,
           customerId: data.shopifyCustomerId,
           displayName: data.displayName || 'Anonymous',
           completionTime: data.completionTime,
           formattedTime: data.formattedTime || formatCompletionTime(data.completionTime),
           scannedCount: data.scannedCount || 0,
           isAnonymous: data.isAnonymous || false
         });
       }
     });

     // Sort by scan count DESC, then by completion time ASC
     tempData.sort((a, b) => {
       if (a.scannedCount !== b.scannedCount) {
         return b.scannedCount - a.scannedCount;
       }
       return a.completionTime - b.completionTime;
     });

     // Add ranks
     tempData.forEach((entry, index) => {
       entry.rank = index + 1;
       leaderboardData.push(entry);
     });
     
     setCachedData('leaderboard', leaderboardData);
     return leaderboardData;
     
   } catch (e) {
     console.error("Error getting leaderboard data:", e);
     return [];
   }
 };

 // Format completion time
 const formatCompletionTime = function(milliseconds) {
   if (!milliseconds) return '--:--:--';
   
   const totalSeconds = Math.floor(milliseconds / 1000);
   const hours = Math.floor(totalSeconds / 3600);
   const minutes = Math.floor((totalSeconds % 3600) / 60);
   const seconds = totalSeconds % 60;
   
   return [
     hours.toString().padStart(2, '0'),
     minutes.toString().padStart(2, '0'),
     seconds.toString().padStart(2, '0')
   ].join(':');
 };

 // Validate QR code against database
 const validateQRCode = async function(code) {
   if (!_initialized) init();
   
   try {
     if (!_db) {
       if (firebase && firebase.firestore) {
         _db = firebase.firestore();
       } else {
         console.error("Firebase Firestore not available");
         return false;
       }
     }
     
     const doc = await _db.collection('valid_codes').doc(code).get();
     
     if (doc.exists) {
       const data = doc.data();
       return data.active !== false;
     }
     
     return false;
   } catch (e) {
     console.error("Error validating QR code:", e);
     return false;
   }
 };

 // Get Anonymous User Stats (for admin dashboard)
 const getAnonymousUserStats = async function() {
   try {
     if (!_db) _db = firebase.firestore();
     
     const usersSnapshot = await _db.collection('users').get();
     
     let anonymousUsers = 0;
     let linkedUsers = 0;
     let totalScans = 0;
     
     usersSnapshot.forEach(doc => {
       const userData = doc.data();
       const scanCount = userData.scannedCodes ? userData.scannedCodes.length : 0;
       totalScans += scanCount;
       
       if (userData.isAnonymous) {
         anonymousUsers++;
       } else {
         linkedUsers++;
       }
     });
     
     return {
       anonymousUsers,
       linkedUsers,
       totalUsers: anonymousUsers + linkedUsers,
       totalScans,
       linkingRate: linkedUsers > 0 ? (linkedUsers / (anonymousUsers + linkedUsers) * 100) : 0
     };
   } catch (error) {
     console.error('Error getting anonymous user stats:', error);
     return null;
   }
 };

 // Public API
 return {
   // Initialize the module
   init: function() {
     if (_initialized) return this;
     
     if (init()) {
       // Auto-ensure Firebase user on init
       ensureFirebaseUser().then(() => {
         if (window.DGSHUI && DGSHUI.isInitialized()) {
           DGSHUI.refreshUI();
         }
       }).catch(error => {
         console.error('Error ensuring Firebase user on init:', error);
       });
     }
     
     return this;
   },
   
   isInitialized: function() {
     return _initialized;
   },

   // Ensure Firebase user exists
   ensureFirebaseUser: ensureFirebaseUser,
   
   // Link anonymous account to Shopify
   linkAnonymousToShopifyAccount: linkAnonymousToShopifyAccount,
   
   // Get anonymous user statistics
   getAnonymousUserStats: getAnonymousUserStats,
   
   // Authenticate with Shopify customer data
   authenticateWithShopify: async function(customer) {
     if (!customer || !customer.id) return false;
     
     try {
       _shopifyCustomerId = customer.id;
       _userId = `shopify_${customer.id}`;
       localStorage.setItem('dgsh_user_id', _userId);
       
       // Check if we need to link an anonymous account
       const currentUser = _auth.currentUser;
       if (currentUser && currentUser.isAnonymous) {
         const linked = await linkAnonymousToShopifyAccount(customer);
         if (linked) {
           console.log('Successfully linked anonymous account to Shopify');
           return true;
         }
       }
       
       if (!_auth.currentUser || _auth.currentUser.isAnonymous) {
         await _auth.signInAnonymously();
       }
       
       await checkAndCreateUserDocument();
       return true;
     } catch (e) {
       console.error("Error authenticating with Shopify:", e);
       return false;
     }
   },
   
   // Get user progress data (works for anonymous and authenticated)
   getUserProgress: getUserProgress,
   
   // Save user progress data
   saveUserProgress: saveUserProgress,
   
   // Save phone number to user profile
   savePhoneNumber: savePhoneNumber,
   
   // Add a scanned code (FIXED - proper duplicate detection)
   addScannedCode: addScannedCode,
   
   // Mark a redemption code as redeemed
   markRedemptionCodeRedeemed: async function(tierId, staffId) {
     if (!_initialized) init();
     
     if (!tierId) return false;
     
     try {
       await ensureFirebaseUser();
       
       const userData = await getUserProgress();
       if (!userData) return false;
       
       if (!userData.redemptionStatus) {
         userData.redemptionStatus = {};
       }
       
       userData.redemptionStatus[tierId] = {
         redeemed: true,
         timestamp: Date.now(),
         staffId: staffId || 'unknown'
       };
       
       const success = await saveUserProgress(userData);
       
       if (success) {
         invalidateCache('userData');
       }
       
       return success;
     } catch (e) {
       console.error("Error marking redemption code as redeemed:", e);
       return false;
     }
   },
   
   // Update the leaderboard
   updateLeaderboard: updateLeaderboard,
   
   // Verify and process redemptions
   verifyAndProcessRedemptions: async function(staffCode, specificTierId = null) {
     if (!_initialized) init();
     
     try {
       await ensureFirebaseUser();
       
       const userId = getUserId();
       if (!userId) {
         return { success: false, reason: 'user_not_found' };
       }
       
       if (!_db) _db = firebase.firestore();
       
       // Try to get config from cache first
       const cachedSettings = getCachedData('huntSettings');
       let configStaffCode = null;
       
       if (cachedSettings && cachedSettings.staffVerificationCode) {
         configStaffCode = cachedSettings.staffVerificationCode;
       } else {
         const configDoc = await _db.collection('config').doc('huntSettings').get();
         const config = configDoc.exists ? configDoc.data() : null;
         
         if (config && config.staffVerificationCode) {
           configStaffCode = config.staffVerificationCode;
         }
       }
       
       // Verify staff code
       if (configStaffCode !== staffCode && staffCode !== "DOOMLINGS2025") {
         return { success: false, reason: 'invalid_code' };
       }
       
       // Get user data
       const userDoc = await _db.collection('users').doc(userId).get();
       
       if (!userDoc.exists) {
         return { success: false, reason: 'user_not_found' };
       }
       
       const userData = userDoc.data();
       const scannedCount = (userData.scannedCodes || []).length;
       
       // Get reward tiers
       let rewardTiers = [];
       
       const cachedSchema = getCachedData('tierSchema');
       if (cachedSchema && cachedSchema.tiers) {
         rewardTiers = cachedSchema.tiers;
       } else if (cachedSettings && cachedSettings.tierSchema && cachedSettings.tierSchema.tiers) {
         rewardTiers = cachedSettings.tierSchema.tiers;
       } else if (cachedSettings && cachedSettings.rewardTiers) {
         rewardTiers = cachedSettings.rewardTiers;
       } else if (window.DGSHConfig && typeof DGSHConfig.getAllRewardTiers === 'function') {
         rewardTiers = DGSHConfig.getAllRewardTiers();
       } else {
         // Fallback to default tiers
         rewardTiers = [
           { id: "tier1", codesRequired: 1, name: "Card Pack" },
           { id: "tier3", codesRequired: 3, name: "Promo Cards" },
           { id: "tier6", codesRequired: 6, name: "Mini Expansion" },
           { id: "tier12", codesRequired: 12, name: "Collector's Box" }
         ];
       }
       
       // Filter for unredeemed rewards
       const unredeemedRewards = [];
       rewardTiers.forEach(tier => {
         const isUnlocked = scannedCount >= tier.codesRequired;
         const isRedeemed = userData.redemptionStatus && 
                         userData.redemptionStatus[tier.id] && 
                         userData.redemptionStatus[tier.id].redeemed;
         const matchesSpecificTier = !specificTierId || specificTierId === 'all' || specificTierId === tier.id;
         
         if (isUnlocked && !isRedeemed && matchesSpecificTier) {
           unredeemedRewards.push(tier.id);
         }
       });
       
       if (unredeemedRewards.length === 0) {
         return { success: false, reason: 'no_unredeemed_rewards' };
       }
       
       // Process the redemptions
       const redemptionStatus = userData.redemptionStatus || {};
       const now = Date.now();

       // Calculate bonus entries for each tier being redeemed
       let bonusEntries = 0;
       unredeemedRewards.forEach(tierId => {
         redemptionStatus[tierId] = {
           redeemed: true,
           timestamp: now,
           staffCode: staffCode
         };
         
         const tier = rewardTiers.find(t => t.id === tierId);
         if (tier) {
           if (tier.codesRequired >= 12) bonusEntries += 5;
           else if (tier.codesRequired >= 6) bonusEntries += 3;
           else if (tier.codesRequired >= 3) bonusEntries += 2;
           else bonusEntries += 1;
         }
       });

       // Add bonus entries to user data
       const currentBonusEntries = userData.drawingBonusEntries || 0;
       userData.drawingBonusEntries = currentBonusEntries + bonusEntries;
       
       // Update the user document
       await _db.collection('users').doc(userId).update({
         redemptionStatus: redemptionStatus,
         drawingBonusEntries: userData.drawingBonusEntries,
         updatedAt: firebase.firestore.FieldValue.serverTimestamp()
       });
       
       invalidateCache('userData');
       
       return {
         success: true,
         redeemedRewards: unredeemedRewards,
         count: unredeemedRewards.length,
         bonusEntries: bonusEntries
       };
     } catch (e) {
       console.error("Error verifying redemptions:", e);
       return { success: false, reason: 'error', message: e.message };
     }
   },
   
   // Get all QR codes
   getQRCodes: getQRCodes,
   
   // Add or update a QR code
   saveQRCode: async function(code, data) {
     if (!_initialized) init();
     
     try {
       if (!_db) {
         if (firebase && firebase.firestore) {
           _db = firebase.firestore();
         } else {
           console.error("Firebase Firestore not available");
           return false;
         }
       }
       
       if (!_auth.currentUser) {
         try {
           await _auth.signInAnonymously();
         } catch (authError) {
           console.error("Firebase auth error:", authError);
           return false;
         }
       }
       
       await _db.collection('valid_codes').doc(code).set({
         locationNumber: data.locationNumber,
         locationName: data.locationName,
         description: data.description || data.locationName,
         active: data.active !== false,
         updatedAt: firebase.firestore.FieldValue.serverTimestamp()
       });
       
       invalidateCache('qrCodes');
       return true;
     } catch (e) {
       console.error("Error saving QR code to Firebase:", e);
       return false;
     }
   },
   
   // Delete a QR code
   deleteQRCode: async function(code) {
     if (!_initialized) init();
     
     try {
       if (!_db) {
         if (firebase && firebase.firestore) {
           _db = firebase.firestore();
         } else {
           console.error("Firebase Firestore not available");
           return false;
         }
       }
       
       if (!_auth.currentUser) {
         try {
           await _auth.signInAnonymously();
         } catch (authError) {
           console.error("Firebase auth error:", authError);
           return false;
         }
       }
       
       await _db.collection('valid_codes').doc(code).delete();
       invalidateCache('qrCodes');
       
       return true;
     } catch (e) {
       console.error("Error deleting QR code from Firebase:", e);
       return false;
     }
   },
   
   // Validate QR code against database
   validateQRCode: validateQRCode,
   
   // Get leaderboard data
   getLeaderboardData: getLeaderboardData,
   
   // Sync now (force refresh data)
   syncNow: async function(force = false) {
     if (!_initialized) init();
     
     try {
       if (force) {
         invalidateCache('userData');
         invalidateCache('tierSchema');
         invalidateCache('huntSettings');
         invalidateCache('qrCodes');
       }
       
       await fetchHuntSettings();
       
       await ensureFirebaseUser();
       const userData = await getUserProgress();
       if (!userData) return false;
       
       if (window.DGSHUI && DGSHUI.isInitialized()) {
         DGSHUI.refreshUI();
       }
       
       return true;
     } catch (e) {
       console.error("Error syncing data:", e);
       return false;
     }
   },
   
   // Handle sync trigger
   handleSyncTrigger: function(trigger, data = {}) {
     return this.syncNow(trigger === 'force');
   },
   
   // Clear cache (for debugging/testing)
   clearCache: function() {
     _cache.data = {};
     _cache.expiry = {};
     _cache.lastRefresh = {};
     saveCacheToLocalStorage();
     return true;
   }
 };
})();

window.DGSHFirebase = DGSHFirebase;