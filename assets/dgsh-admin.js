/**
 * File: dgsh-admin.js
 * Location: assets/dgsh-admin.js
 * Doomlings GenCon Scavenger Hunt - Admin Module (Admin Dashboard Only)
 */

(function() {
  'use strict';
  
  // Private module variables
  let _db = null;
  let _initialized = false;
  
  // Development mode settings
  const DEV_MODE = true; // Set to false for production
  const TIER_CACHE_KEY = 'dgsh_tier_cache';
  
  // State object
  const state = {
    tiers: [],
    editingTierId: null,
    loading: false
  };
  
  // Utility functions
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);
  
  // Initialize Firebase connection
  function initFirebase() {
    try {
      if (typeof firebase === 'undefined' || !firebase.firestore) {
        console.error('Firebase not available');
        return false;
      }
      
      _db = firebase.firestore();
      
      // Authenticate anonymously if not already authenticated
      if (!firebase.auth().currentUser) {
        firebase.auth().signInAnonymously()
          .then(() => console.log('Firebase authenticated'))
          .catch(error => console.error('Firebase auth error:', error));
      }
      
      return true;
    } catch (error) {
      console.error('Firebase initialization error:', error);
      return false;
    }
  }
  
  // Schedule Management Functions
  function initScheduleManagement() {
    console.log("Initializing schedule management...");
    
    const scheduleEnabled = $('#schedule-enabled');
    const scheduleTimesContainer = $('#schedule-times-container');
    const saveScheduleBtn = $('#save-schedule-btn');
    const clearScheduleBtn = $('#clear-schedule-btn');
    const userTimezoneSpan = $('#user-timezone');
    const scheduleStatusDisplay = $('#schedule-status-display');
    
    if (!scheduleEnabled) {
      console.log("Schedule management elements not found");
      return;
    }
    
    // Display user's timezone
    if (userTimezoneSpan) {
      userTimezoneSpan.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    
    // Load current schedule settings
    loadCurrentScheduleSettings();
    
    // Toggle schedule times visibility
    scheduleEnabled.addEventListener('change', function() {
      if (scheduleTimesContainer) {
        scheduleTimesContainer.style.display = this.checked ? 'block' : 'none';
      }
    });
    
    // Save schedule button
    if (saveScheduleBtn) {
      saveScheduleBtn.addEventListener('click', saveScheduleSettings);
    }
    
    // Clear schedule button
    if (clearScheduleBtn) {
      clearScheduleBtn.addEventListener('click', clearScheduleSettings);
    }
    
    // Update status display periodically
    setInterval(updateScheduleStatusDisplay, 30000); // Every 30 seconds
    updateScheduleStatusDisplay(); // Initial load
  }
  
  function loadCurrentScheduleSettings() {
    try {
      if (!window.DGSHScheduler) {
        console.log("DGSHScheduler not available");
        return;
      }
      
      const settings = DGSHScheduler.getScheduleSettings();
      
      if (settings) {
        const scheduleEnabledEl = $('#schedule-enabled');
        const scheduleTimesContainer = $('#schedule-times-container');
        const startDateEl = $('#schedule-start-date');
        const endDateEl = $('#schedule-end-date');
        
        if (scheduleEnabledEl) {
          scheduleEnabledEl.checked = settings.enabled;
        }
        
        if (scheduleTimesContainer) {
          scheduleTimesContainer.style.display = settings.enabled ? 'block' : 'none';
        }
        
        if (settings.startDate && startDateEl) {
          startDateEl.value = new Date(settings.startDate).toISOString().slice(0, 16);
        }
        
        if (settings.endDate && endDateEl) {
          endDateEl.value = new Date(settings.endDate).toISOString().slice(0, 16);
        }
      }
    } catch (error) {
      console.error('Error loading schedule settings:', error);
    }
  }
  
  async function saveScheduleSettings() {
    try {
      if (!window.DGSHScheduler) {
        alert('Scheduler not available');
        return;
      }
      
      const enabled = $('#schedule-enabled').checked;
      const startDate = $('#schedule-start-date').value;
      const endDate = $('#schedule-end-date').value;
      
      if (enabled && (!startDate || !endDate)) {
        alert('Please set both start and end dates when scheduling is enabled.');
        return;
      }
      
      if (enabled && new Date(startDate) >= new Date(endDate)) {
        alert('End date must be after start date.');
        return;
      }
      
      const settings = {
        enabled: enabled,
        startDate: enabled ? startDate : null,
        endDate: enabled ? endDate : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      const success = await DGSHScheduler.updateScheduleSettings(settings);
      
      if (success) {
        alert('Schedule settings saved successfully!');
        updateScheduleStatusDisplay();
      } else {
        alert('Error saving schedule settings.');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Error saving schedule settings.');
    }
  }
  
  async function clearScheduleSettings() {
    if (!confirm('Are you sure you want to disable hunt scheduling? This will make the hunt always active.')) {
      return;
    }
    
    try {
      if (!window.DGSHScheduler) {
        alert('Scheduler not available');
        return;
      }
      
      const success = await DGSHScheduler.disableScheduling();
      
      if (success) {
        const scheduleEnabled = $('#schedule-enabled');
        const scheduleTimesContainer = $('#schedule-times-container');
        const startDateEl = $('#schedule-start-date');
        const endDateEl = $('#schedule-end-date');
        
        if (scheduleEnabled) scheduleEnabled.checked = false;
        if (scheduleTimesContainer) scheduleTimesContainer.style.display = 'none';
        if (startDateEl) startDateEl.value = '';
        if (endDateEl) endDateEl.value = '';
        
        alert('Schedule cleared. Hunt is now always active.');
        updateScheduleStatusDisplay();
      } else {
        alert('Error clearing schedule.');
      }
    } catch (error) {
      console.error('Error clearing schedule:', error);
      alert('Error clearing schedule.');
    }
  }
  
  function updateScheduleStatusDisplay() {
    const statusDisplay = $('#schedule-status-display');
    if (!statusDisplay || !window.DGSHScheduler) {
      if (statusDisplay) {
        statusDisplay.innerHTML = '<div class="dgsh-admin-loading">Loading schedule status...</div>';
      }
      return;
    }
    
    try {
      const status = DGSHScheduler.getScheduleStatus();
      
      let statusClass = 'dgsh-admin-status-';
      let statusIcon = '';
      
      switch (status.status) {
        case 'always_active':
          statusClass += 'active';
          statusIcon = '✅';
          break;
        case 'active':
          statusClass += 'active';
          statusIcon = '🟢';
          break;
        case 'not_started':
          statusClass += 'pending';
          statusIcon = '🟡';
          break;
        case 'ended':
          statusClass += 'ended';
          statusIcon = '🔴';
          break;
      }
      
      statusDisplay.innerHTML = `
        <div class="${statusClass}">
          <span class="dgsh-admin-status-icon">${statusIcon}</span>
          <span class="dgsh-admin-status-message">${status.message}</span>
        </div>
      `;
    } catch (error) {
      statusDisplay.innerHTML = '<div class="dgsh-admin-error">Error loading status</div>';
    }
  }
  
  // Drawing Statistics Functions
  function initDrawingStats() {
    console.log("Initializing drawing statistics...");
    
    // Load initial stats
    loadDrawingStats();
    
    // Set up refresh button
    const refreshDrawingBtn = $('.dgsh-admin-refresh-drawing-btn');
    if (refreshDrawingBtn) {
      refreshDrawingBtn.addEventListener('click', loadDrawingStats);
    }
    
    // Set up export button
    const exportDrawingBtn = $('.dgsh-admin-export-drawing-btn');
    if (exportDrawingBtn) {
      exportDrawingBtn.addEventListener('click', exportDrawingEntries);
    }
  }
  
  async function loadDrawingStats() {
    const totalEntriesEl = $('#total-drawing-entries');
    const totalParticipantsEl = $('#total-participants');
    const avgEntriesEl = $('#avg-entries-per-user');
    const drawingListEl = $('.dgsh-admin-drawing-list');
    
    if (!totalEntriesEl) {
      console.log("Drawing stats elements not found");
      return;
    }
    
    if (drawingListEl) {
      drawingListEl.innerHTML = '<div class="dgsh-admin-loading">Loading drawing entries...</div>';
    }
    
    try {
      if (!_db) {
        throw new Error('Firebase not initialized');
      }
      
      const usersSnapshot = await _db.collection('users').get();
      
      let totalEntries = 0;
      let totalParticipants = 0;
      const previewEntries = [];
      
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const scanEntries = userData.drawingEntries || 0;
        const bonusEntries = userData.drawingBonusEntries || 0;
        const userTotalEntries = scanEntries + bonusEntries;
        
        if (userTotalEntries > 0) {
          totalParticipants++;
          totalEntries += userTotalEntries;
          
          // Add to preview (first 10)
          if (previewEntries.length < 10) {
            for (let i = 0; i < userTotalEntries; i++) {
              previewEntries.push({
                name: userData.displayName || 'Anonymous',
                email: userData.email || 'No email',
                phone: userData.phoneNumber || 'No phone',
                entryNumber: previewEntries.length + 1
              });
            }
          }
        }
      });
      
      // Update stats
      totalEntriesEl.textContent = totalEntries;
      totalParticipantsEl.textContent = totalParticipants;
      avgEntriesEl.textContent = totalParticipants > 0 ? Math.round(totalEntries / totalParticipants) : 0;
      
      // Update preview
      if (drawingListEl) {
        if (previewEntries.length === 0) {
          drawingListEl.innerHTML = '<div class="dgsh-admin-warning">No drawing entries yet.</div>';
        } else {
          let html = `
            <table class="dgsh-admin-table">
              <thead>
                <tr><th>Entry #</th><th>Name</th><th>Email</th><th>Phone</th></tr>
              </thead>
              <tbody>
          `;
          
          previewEntries.forEach(entry => {
            html += `
              <tr>
                <td>${entry.entryNumber}</td>
                <td>${entry.name}</td>
                <td>${entry.email}</td>
                <td>${entry.phone}</td>
              </tr>
            `;
          });
          
          html += '</tbody></table>';
          drawingListEl.innerHTML = html;
        }
      }
      
    } catch (error) {
      console.error('Error loading drawing stats:', error);
      if (drawingListEl) {
        drawingListEl.innerHTML = '<div class="dgsh-admin-error">Error loading drawing entries.</div>';
      }
    }
  }
  
  async function exportDrawingEntries() {
    try {
      if (!_db) {
        throw new Error('Firebase not initialized');
      }
      
      const usersSnapshot = await _db.collection('users').get();
      
      const entries = [];
      let entryNumber = 1;
      
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const scanEntries = userData.drawingEntries || 0;
        const bonusEntries = userData.drawingBonusEntries || 0;
        const userTotalEntries = scanEntries + bonusEntries;
        
        // Create one row per entry
        for (let i = 0; i < userTotalEntries; i++) {
          entries.push({
            entryNumber: entryNumber++,
            name: userData.displayName || 'Anonymous',
            email: userData.email || '',
            phone: userData.phoneNumber || '',
            shopifyId: userData.shopifyCustomerId || '',
            scanEntries: scanEntries,
            bonusEntries: bonusEntries,
            totalEntries: userTotalEntries
          });
        }
      });
      
      // Create CSV
      const csvHeader = 'Entry Number,Name,Email,Phone,Shopify ID,Scan Entries,Bonus Entries,Total Entries\n';
      const csvContent = entries.map(entry => 
        `${entry.entryNumber},"${entry.name}","${entry.email}","${entry.phone}","${entry.shopifyId}",${entry.scanEntries},${entry.bonusEntries},${entry.totalEntries}`
      ).join('\n');
      
      // Download CSV
      const blob = new Blob([csvHeader + csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `drawing-entries-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      alert(`Exported ${entries.length} drawing entries to CSV file.`);
      
    } catch (error) {
      console.error('Error exporting drawing entries:', error);
      alert('Error exporting drawing entries: ' + error.message);
    }
  }
  
  // Tier Management Functions
  async function loadTiers(useCache = true) {
    const tierList = $('.dgsh-admin-tier-list');
    if (!tierList) return false;
    
    tierList.innerHTML = '<div class="dgsh-admin-loading">Loading tier configuration...</div>';
    
    try {
      // Try cache first in development mode
      if (DEV_MODE && useCache) {
        const cachedData = localStorage.getItem(TIER_CACHE_KEY);
        if (cachedData) {
          try {
            const cachedTiers = JSON.parse(cachedData);
            state.tiers = cachedTiers;
            renderTierTable();
            return true;
          } catch (e) {
            console.warn('Error parsing cached tier data:', e);
          }
        }
      }
      
      // Fetch from Firebase
      const doc = await _db.collection('config').doc('huntSettings').get();
      const data = doc.exists ? doc.data() : null;
      const schema = data?.tierSchema || null;
      
      if (!schema || !schema.tiers || !schema.tiers.length) {
        tierList.innerHTML = '<div class="dgsh-admin-empty">No reward tiers found. Add one to get started.</div>';
        state.tiers = [];
        return false;
      }
      
      // Sort tiers by codes required
      state.tiers = [...schema.tiers].sort((a, b) => a.codesRequired - b.codesRequired);
      
      // Cache the data in development mode
      if (DEV_MODE) {
        localStorage.setItem(TIER_CACHE_KEY, JSON.stringify(state.tiers));
      }
      
      renderTierTable();
      return true;
      
    } catch (error) {
      console.error("Error loading tiers:", error);
      tierList.innerHTML = `<div class="dgsh-admin-error">Error loading tiers: ${error.message}</div>`;
      return false;
    }
  }
  
  function renderTierTable() {
    const tierList = $('.dgsh-admin-tier-list');
    if (!tierList) return;
    
    if (!state.tiers.length) {
      tierList.innerHTML = '<div class="dgsh-admin-empty">No reward tiers found. Add one to get started.</div>';
      return;
    }
    
    const tierRows = state.tiers.map(tier => `
      <tr data-tier-id="${tier.id}">
        <td>${tier.id}</td>
        <td>${tier.codesRequired}</td>
        <td>${tier.name}</td>
        <td>${tier.description || '-'}</td>
        <td>
          <button class="dgsh-admin-edit-tier-btn" data-tier-id="${tier.id}">Edit</button>
          <button class="dgsh-admin-delete-tier-btn" data-tier-id="${tier.id}">Delete</button>
        </td>
      </tr>
    `).join('');
    
    tierList.innerHTML = `
      <div class="dgsh-admin-tier-info">
        <p>Total Tiers: ${state.tiers.length}</p>
        <p>Last Updated: ${new Date().toLocaleString()}</p>
      </div>
      <table class="dgsh-admin-table dgsh-admin-tier-table">
        <thead>
          <tr>
            <th>Tier ID</th>
            <th>Required Codes</th>
            <th>Name</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${tierRows}</tbody>
      </table>
    `;
    
    // Add event listeners to tier buttons
    setupTierTableEventListeners();
  }
  
  function setupTierTableEventListeners() {
    $$('.dgsh-admin-edit-tier-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const tierId = this.getAttribute('data-tier-id');
        const tierData = state.tiers.find(t => t.id === tierId);
        editTier(tierId, tierData);
      });
    });
    
    $$('.dgsh-admin-delete-tier-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const tierId = this.getAttribute('data-tier-id');
        deleteTier(tierId);
      });
    });
  }
  
  function showAddTierForm() {
    const tierEditContainer = $('.dgsh-admin-tier-edit-container');
    const tierEditTitle = $('.dgsh-admin-tier-edit-title');
    
    if (!tierEditContainer) return;
    
    // Clear form
    $('#tier-id').value = '';
    $('#tier-codes').value = '';
    $('#tier-name').value = '';
    $('#tier-description').value = '';
    $('#tier-image').value = 'https://cdn.shopify.com/s/files/1/0554/6190/4593/files/card-pack_png.jpg?v=1742921629';
    
    // Enable tier ID field for new tiers
    $('#tier-id').disabled = false;
    
    if (tierEditTitle) tierEditTitle.textContent = 'Add New Tier';
    state.editingTierId = null;
    tierEditContainer.style.display = 'block';
  }
  
  function editTier(tierId, tierData) {
    if (!tierId || !tierData) return;
    
    const tierEditContainer = $('.dgsh-admin-tier-edit-container');
    const tierEditTitle = $('.dgsh-admin-tier-edit-title');
    
    if (!tierEditContainer) return;
    
    // Fill form with existing data
    $('#tier-id').value = tierData.id;
    $('#tier-codes').value = tierData.codesRequired;
    $('#tier-name').value = tierData.name;
    $('#tier-description').value = tierData.description || '';
    $('#tier-image').value = tierData.image || '';
    
    // Disable tier ID field for editing
    $('#tier-id').disabled = true;
    
    if (tierEditTitle) tierEditTitle.textContent = `Edit Tier: ${tierData.name}`;
    state.editingTierId = tierId;
    tierEditContainer.style.display = 'block';
  }
  
  function hideTierForm() {
    const tierEditContainer = $('.dgsh-admin-tier-edit-container');
    if (tierEditContainer) {
      tierEditContainer.style.display = 'none';
    }
    state.editingTierId = null;
  }
  
  async function saveTier() {
    const tierId = $('#tier-id').value.trim();
    const codesRequired = parseInt($('#tier-codes').value);
    const name = $('#tier-name').value.trim();
    const description = $('#tier-description').value.trim();
    const image = $('#tier-image').value.trim();
    
    // Validation
    if (!tierId || isNaN(codesRequired) || codesRequired < 1 || !name) {
      alert("Please fill all required fields with valid values.");
      return false;
    }
    
    // Validate tier ID format
    if (!/^tier\d+$/.test(tierId)) {
      alert("Tier ID must follow the format: tier followed by a number (e.g., tier1, tier5)");
      return false;
    }
    
    const tierData = {
      id: tierId,
      codesRequired: codesRequired,
      name: name,
      description: description,
      image: image
    };
    
    try {
      // Show loading indicator
      const saveBtn = $('.dgsh-admin-save-tier-btn');
      const originalText = saveBtn ? saveBtn.textContent : '';
      if (saveBtn) {
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
      }
      
      // Get existing schema
      const doc = await _db.collection('config').doc('huntSettings').get();
      let data = doc.exists ? doc.data() : {};
      let schema = data.tierSchema || { version: "1.0", lastUpdated: Date.now(), tiers: [] };
      
      if (state.editingTierId) {
        // Update existing tier
        const tierIndex = schema.tiers.findIndex(t => t.id === state.editingTierId);
        if (tierIndex !== -1) {
          schema.tiers[tierIndex] = tierData;
        } else {
          schema.tiers.push(tierData);
        }
      } else {
        // Add new tier
        if (schema.tiers.some(t => t.id === tierId)) {
          if (saveBtn) {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
          }
          alert("A tier with this ID already exists");
          return false;
        }
        
        schema.tiers.push(tierData);
      }
      
      // Sort tiers by codes required
      schema.tiers.sort((a, b) => a.codesRequired - b.codesRequired);
      schema.lastUpdated = Date.now();
      
      // Save schema back to Firestore
      await _db.collection('config').doc('huntSettings').set({
        ...data,
        tierSchema: schema
      }, { merge: true });
      
      // Clear cache and reload
      if (DEV_MODE) {
        localStorage.removeItem(TIER_CACHE_KEY);
      }
      
      hideTierForm();
      await loadTiers(false); // Force refresh from Firebase
      
      alert(state.editingTierId ? "Tier updated successfully" : "New tier added successfully");
      return true;
      
    } catch (error) {
      console.error("Error saving tier:", error);
      alert(`Error saving tier: ${error.message}`);
      return false;
    } finally {
      // Reset button state
      const saveBtn = $('.dgsh-admin-save-tier-btn');
      if (saveBtn) {
        saveBtn.textContent = 'Save Tier';
        saveBtn.disabled = false;
      }
    }
  }
  
  async function deleteTier(tierId) {
    if (!tierId || !confirm(`Are you sure you want to delete the tier "${tierId}"? This cannot be undone.`)) {
      return false;
    }
    
    try {
      // Get existing schema
      const doc = await _db.collection('config').doc('huntSettings').get();
      let data = doc.exists ? doc.data() : {};
      let schema = data.tierSchema || { version: "1.0", lastUpdated: Date.now(), tiers: [] };
      
      // Remove tier
      const initialLength = schema.tiers.length;
      schema.tiers = schema.tiers.filter(t => t.id !== tierId);
      
      if (schema.tiers.length === initialLength) {
        alert("Tier not found");
        return false;
      }
      
      schema.lastUpdated = Date.now();
      
      // Save schema back to Firestore
      await _db.collection('config').doc('huntSettings').set({
        ...data,
        tierSchema: schema
      }, { merge: true });
      
      // Clear cache and reload
      if (DEV_MODE) {
        localStorage.removeItem(TIER_CACHE_KEY);
      }
      
      await loadTiers(false); // Force refresh from Firebase
      alert("Tier deleted successfully");
      return true;
      
    } catch (error) {
      console.error("Error deleting tier:", error);
      alert(`Error deleting tier: ${error.message}`);
      return false;
    }
  }
  
  // Customer Export Function
  async function exportCustomerData() {
    try {
      console.log("Starting customer export...");
      
      // Show loading state
      const button = $('.dgsh-admin-export-btn');
      if (button) {
        button.textContent = 'Exporting...';
        button.disabled = true;
      }
      
      // Check Firebase connection
      if (!_db) {
        throw new Error('Firebase not initialized');
      }
      
      // Get users first (this is the main data)
      console.log('Fetching users...');
      const usersSnapshot = await _db.collection('users').get();
      
      if (usersSnapshot.empty) {
        alert('No participants found to export.');
        return;
      }
      
      console.log(`Found ${usersSnapshot.size} users`);
      
      // Get QR codes (optional - don't fail if none found)
      let qrCodes = [];
      try {
        const qrSnapshot = await _db.collection('valid_codes').get();
        qrSnapshot.forEach(doc => {
          qrCodes.push({
            code: doc.id,
            locationNumber: doc.data().locationNumber || 0
          });
        });
        qrCodes.sort((a, b) => a.locationNumber - b.locationNumber);
        console.log(`Found ${qrCodes.length} QR codes`);
      } catch (qrError) {
        console.warn('Could not fetch QR codes:', qrError);
        // Continue without QR code details
      }
      
      // Get tiers (optional - use defaults if not found)
      let tiers = [];
      try {
        const settingsDoc = await _db.collection('config').doc('huntSettings').get();
        if (settingsDoc.exists) {
          const data = settingsDoc.data();
          if (data.tierSchema && data.tierSchema.tiers) {
            tiers = data.tierSchema.tiers.sort((a, b) => a.codesRequired - b.codesRequired);
          }
        }
      } catch (tierError) {
        console.warn('Could not fetch tiers:', tierError);
      }
      
      // Default tiers if none found
      if (tiers.length === 0) {
        tiers = [
          { id: "tier1", codesRequired: 1, name: "Card Pack" },
          { id: "tier3", codesRequired: 3, name: "Promo Cards" },
          { id: "tier6", codesRequired: 6, name: "Mini Expansion" },
          { id: "tier12", codesRequired: 12, name: "Collector's Box" }
        ];
      }
      
      console.log(`Using ${tiers.length} tiers`);
      
      // Process users
      const csvData = [];
      let processedCount = 0;
      
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const scannedCodes = userData.scannedCodes || [];
        const redemptionStatus = userData.redemptionStatus || {};
        
        // Parse name
        const displayName = userData.displayName || '';
        let firstName = '', lastName = '';
        if (displayName.includes(' ')) {
          const nameParts = displayName.split(' ');
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        } else {
          firstName = displayName;
        }
        
        // Find first scan info
        let firstCardScanned = '';
        let firstCardDate = '';
        if (scannedCodes.length > 0) {
          const sortedScans = [...scannedCodes].sort((a, b) => a.timestamp - b.timestamp);
          const firstScan = sortedScans[0];
          firstCardScanned = firstScan.code;
          firstCardDate = new Date(firstScan.timestamp).toLocaleString();
        }
        
        // Build row
        const row = {
          'FIRST NAME': firstName,
          'LAST NAME': lastName,
          'EMAIL': userData.email || '',
          'PHONE NUMBER': userData.phoneNumber || '',
          'SHOPIFY CUSTOMER ID': userData.shopifyCustomerId || '',
          'TOTAL CARDS SCANNED': scannedCodes.length,
          'FIRST CARD SCANNED': firstCardScanned,
          'FIRST CARD SCANNED DATE': firstCardDate,
          'ACCOUNT CREATED': userData.createdAt ? userData.createdAt.toDate().toLocaleString() : '',
          'DRAWING ENTRIES': (userData.drawingEntries || 0) + (userData.drawingBonusEntries || 0)
        };
        
        // Add QR code columns (if we have QR code data)
        if (qrCodes.length > 0) {
          for (let i = 1; i <= Math.max(12, qrCodes.length); i++) {
            const qrCode = qrCodes.find(qr => qr.locationNumber === i);
            if (qrCode) {
              const hasScanned = scannedCodes.some(scan => scan.code === qrCode.code);
              row[`CARD ${i} SCANNED?`] = hasScanned ? 'Y' : 'N';
            } else {
              row[`CARD ${i} SCANNED?`] = 'N';
            }
          }
        }
        
        // Add prize columns
        let totalRewards = 0;
        let totalRedemptions = 0;
        
        tiers.forEach((tier, index) => {
          const prizeNum = index + 1;
          const hasUnlocked = scannedCodes.length >= tier.codesRequired;
          const isRedeemed = redemptionStatus[tier.id] && redemptionStatus[tier.id].redeemed;
          
          if (hasUnlocked) totalRewards++;
          if (isRedeemed) totalRedemptions++;
          
          row[`PRIZE ${prizeNum} CODE?`] = hasUnlocked ? 'Y' : 'N';
          row[`PRIZE ${prizeNum} NAME`] = tier.name;
          row[`PRIZE ${prizeNum} REDEEMED?`] = isRedeemed ? 'Y' : 'N';
        });
        
        row['TOTAL REWARD CODES'] = totalRewards;
        row['TOTAL REDEMPTIONS'] = totalRedemptions;
        
        csvData.push(row);
        processedCount++;
      });
      
      console.log(`Processed ${processedCount} users`);
      
      // Create CSV
      if (csvData.length === 0) {
        alert('No data to export.');
        return;
      }
      
      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');
      
      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const fileName = `scavenger-hunt-participants-${new Date().toISOString().split('T')[0]}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert(`Successfully exported ${csvData.length} participant records!\n\nFile: ${fileName}`);
      console.log(`Export completed: ${fileName}`);
      
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      // Reset button
      const button = $('.dgsh-admin-export-btn');
      if (button) {
        button.textContent = 'Export CSV';
        button.disabled = false;
      }
    }
  }
  
  // Authentication function
  function handleAuthentication() {
    const authForm = $('.dgsh-admin-auth-form');
    if (!authForm) return;
    
    authForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const passwordInput = $('.dgsh-admin-password');
      const errorBox = $('.dgsh-admin-auth-error');
      const dashboard = $('.dgsh-admin-dashboard-container');
      
      if (!passwordInput) return;
      
      const password = passwordInput.value;
      const isValid = window.DGSHAuth && DGSHAuth.checkAdminPassword ? 
        DGSHAuth.checkAdminPassword(password) : 
        password === 'DoomlingsAdmin2025'; // Fallback
      
      if (isValid) {
        // Hide auth form and show dashboard
        authForm.classList.add('dgsh-hidden');
        if (dashboard) {
          dashboard.classList.remove('dgsh-hidden');
        }
        
        // Initialize Firebase and load data
        if (initFirebase()) {
          loadTiers();
          loadDrawingStats();
        }
        
        if (errorBox) {
          errorBox.classList.add('dgsh-hidden');
        }
      } else {
        if (errorBox) {
          errorBox.textContent = 'Invalid password';
          errorBox.classList.remove('dgsh-hidden');
        }
      }
    });
  }
  
  // Setup all event listeners
  function setupEventListeners() {
    // Authentication
    handleAuthentication();
    
    // Tier Management
    const addTierBtn = $('.dgsh-admin-add-tier-btn');
    const refreshTierBtn = $('.dgsh-admin-refresh-tiers-btn');
    const cancelTierBtn = $('.dgsh-admin-cancel-edit-btn');
    const tierForm = $('.dgsh-admin-tier-form');
    
    if (addTierBtn) {
      addTierBtn.addEventListener('click', showAddTierForm);
    }
    
    if (refreshTierBtn) {
      refreshTierBtn.addEventListener('click', () => loadTiers(false));
    }
    
    if (cancelTierBtn) {
      cancelTierBtn.addEventListener('click', hideTierForm);
    }
    
    if (tierForm) {
      tierForm.addEventListener('submit', function(e) {
        e.preventDefault();
        saveTier();
      });
    }
    
    // Modal close functionality
    const modalClose = $('#dgsh-modal-close');
    const modal = $('#dgsh-modal');
    
    if (modalClose && modal) {
      modalClose.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
    
    // Export button from header
    const exportBtn = $('.dgsh-admin-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportCustomerData);
    }
    
    // Refresh button from header
    const refreshBtn = $('.dgsh-admin-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadTiers(false);
        loadDrawingStats();
      });
    }
  }
  
  // Main initialization function
  function init() {
    if (_initialized) return true;
    
    console.log("Initializing DGSH Admin module...");
    
    try {
      // Initialize Firebase
      if (!initFirebase()) {
        console.error("Failed to initialize Firebase");
        return false;
      }
      
      // Initialize schedule management
      initScheduleManagement();
      
      // Initialize drawing stats
      initDrawingStats();
      
      // Setup all event listeners
      setupEventListeners();
      
      // Initialize JSON content management if available
      setTimeout(() => {
        if (typeof initJSONContentManagement === 'function') {
          initJSONContentManagement();
          console.log('JSON content management initialized');
        }
      }, 100);
      
      // If dashboard is already visible (no auth required), load data
      const visibleDashboard = $('.dgsh-admin-dashboard-container:not(.dgsh-hidden)');
      const authForm = $('.dgsh-admin-auth-form');
      
      if (visibleDashboard && !authForm) {
        loadTiers();
        loadDrawingStats();
      }
      
      _initialized = true;
      console.log("DGSH Admin module initialized successfully");
      return true;
      
    } catch (error) {
      console.error("Error initializing DGSH Admin module:", error);
      return false;
    }
  }
  
  // Public API
  const publicAPI = {
    init: init,
    loadTiers: loadTiers,
    loadDrawingStats: loadDrawingStats,
    exportCustomerData: exportCustomerData,
    exportDrawingEntries: exportDrawingEntries,
    isInitialized: () => _initialized,
    getState: () => ({ ...state }) // Return copy of state for debugging
  };
  
  // Auto-initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure all other modules are loaded
    setTimeout(init, 100);
  });
  
  // Export the module
  window.DGSHAdmin = publicAPI;
  
  return publicAPI;
  
})();