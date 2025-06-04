/**
 * Enhanced QR Code Management JavaScript
 * Extends existing dgsh-qr.js with CRUD operations similar to tier management
 */

// Enhanced QR Code Management Module
const DGSHQRManager = (function() {
  let _initialized = false;
  let _editingQRCode = null;
  let _qrCodes = [];
  let _qrStats = {};

  // Initialize the enhanced QR manager
  const init = function() {
    if (_initialized) return true;

    try {
      console.log("Initializing enhanced QR code manager...");
      
      // Set up event listeners
      setupEventListeners();
      
      // Load initial data
      loadQRCodes();
      loadQRStatistics();
      
      _initialized = true;
      return true;
    } catch (error) {
      console.error("Error initializing QR manager:", error);
      return false;
    }
  };

  // Set up event listeners
  const setupEventListeners = function() {
    // Add QR Code button
    const addBtn = document.querySelector('.dgsh-admin-add-qr-btn');
    if (addBtn) {
      addBtn.addEventListener('click', showAddQRForm);
    }

    // Refresh button
    const refreshBtn = document.querySelector('.dgsh-admin-refresh-qr-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() {
        loadQRCodes();
        loadQRStatistics();
      });
    }

    // Export button
    const exportBtn = document.querySelector('.dgsh-admin-export-qr-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportQRCodes);
    }

    // Form submit
    const form = document.querySelector('.dgsh-admin-qr-form');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        saveQRCode();
      });
    }

    // Cancel button
    const cancelBtn = document.querySelector('.dgsh-admin-cancel-qr-edit-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', hideQRForm);
    }
  };

  // Load QR codes from Firebase
  const loadQRCodes = async function() {
    const qrList = document.querySelector('.dgsh-admin-qr-list');
    if (!qrList) return;

    qrList.innerHTML = '<div class="dgsh-admin-loading">Loading QR codes...</div>';

    try {
      // Get QR codes from Firebase
      if (window.DGSHFirebase && typeof DGSHFirebase.getQRCodes === 'function') {
        _qrCodes = await DGSHFirebase.getQRCodes();
        console.log(`Loaded ${_qrCodes.length} QR codes`);
      } else {
        // Fallback: try direct Firebase access
        if (firebase && firebase.firestore) {
          const db = firebase.firestore();
          const snapshot = await db.collection('valid_codes').get();
          _qrCodes = snapshot.docs.map(doc => ({
            id: doc.id,
            code: doc.id,
            ...doc.data()
          }));
        }
      }

      renderQRCodesTable();
    } catch (error) {
      console.error("Error loading QR codes:", error);
      qrList.innerHTML = `<div class="dgsh-admin-error">Error loading QR codes: ${error.message}</div>`;
    }
  };

  // Render QR codes table
  const renderQRCodesTable = function() {
    const qrList = document.querySelector('.dgsh-admin-qr-list');
    if (!qrList) return;

    if (_qrCodes.length === 0) {
      qrList.innerHTML = '<div class="dgsh-admin-empty">No QR codes found. Add one to get started.</div>';
      return;
    }

    // Sort QR codes by location number
    const sortedCodes = [..._qrCodes].sort((a, b) => {
      const aLoc = a.locationNumber || 0;
      const bLoc = b.locationNumber || 0;
      return aLoc - bLoc;
    });

    let html = `
      <table class="dgsh-admin-table">
        <thead>
          <tr>
            <th>QR Code ID</th>
            <th>Location #</th>
            <th>Location Name</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    sortedCodes.forEach(qr => {
      const createdDate = qr.updatedAt ? 
        (qr.updatedAt.toDate ? qr.updatedAt.toDate() : new Date(qr.updatedAt)) : 
        new Date();
      
      html += `
        <tr data-qr-id="${qr.code}">
          <td><code>${qr.code}</code></td>
          <td>${qr.locationNumber || '-'}</td>
          <td>${qr.locationName || qr.description || '-'}</td>
          <td><span class="${qr.active !== false ? 'qr-status-active' : 'qr-status-inactive'}">${qr.active !== false ? 'Active' : 'Inactive'}</span></td>
          <td>${createdDate.toLocaleDateString()}</td>
          <td>
            <button class="dgsh-admin-edit-qr-btn" data-qr-code="${qr.code}">Edit</button>
            <button class="dgsh-admin-view-qr-btn" data-qr-code="${qr.code}">View</button>
            <button class="dgsh-admin-delete-qr-btn" data-qr-code="${qr.code}">Delete</button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    qrList.innerHTML = html;

    // Add event listeners to action buttons
    addTableEventListeners();
  };

  // Add event listeners to table action buttons
  const addTableEventListeners = function() {
    // Edit buttons
    document.querySelectorAll('.dgsh-admin-edit-qr-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const qrCode = this.getAttribute('data-qr-code');
        const qrData = _qrCodes.find(qr => qr.code === qrCode);
        showEditQRForm(qrCode, qrData);
      });
    });

    // View buttons
    document.querySelectorAll('.dgsh-admin-view-qr-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const qrCode = this.getAttribute('data-qr-code');
        showQRModal(qrCode);
      });
    });

    // Delete buttons
    document.querySelectorAll('.dgsh-admin-delete-qr-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const qrCode = this.getAttribute('data-qr-code');
        deleteQRCode(qrCode);
      });
    });
  };

  // Show add QR form
  const showAddQRForm = function() {
    const form = document.querySelector('.dgsh-admin-qr-edit-container');
    const title = document.querySelector('.dgsh-admin-qr-edit-title');
    
    if (!form || !title) return;

    // Clear form
    document.getElementById('qr-code-id').value = '';
    document.getElementById('qr-location-number').value = '';
    document.getElementById('qr-location-name').value = '';
    document.getElementById('qr-active-status').value = 'true';

    // Enable code ID field for new QR codes
    document.getElementById('qr-code-id').readOnly = false;

    title.textContent = 'Add New QR Code';
    _editingQRCode = null;
    form.style.display = 'block';
  };

  // Show edit QR form
  const showEditQRForm = function(qrCode, qrData) {
    const form = document.querySelector('.dgsh-admin-qr-edit-container');
    const title = document.querySelector('.dgsh-admin-qr-edit-title');
    
    if (!form || !title || !qrData) return;

    // Fill form with existing data
    document.getElementById('qr-code-id').value = qrCode;
    document.getElementById('qr-location-number').value = qrData.locationNumber || '';
    document.getElementById('qr-location-name').value = qrData.locationName || qrData.description || '';
    document.getElementById('qr-active-status').value = qrData.active !== false ? 'true' : 'false';

    // Disable code ID field for editing
    document.getElementById('qr-code-id').readOnly = true;

    title.textContent = `Edit QR Code: ${qrCode}`;
    _editingQRCode = qrCode;
    form.style.display = 'block';
  };

  // Hide QR form
  const hideQRForm = function() {
    const form = document.querySelector('.dgsh-admin-qr-edit-container');
    if (form) {
      form.style.display = 'none';
      _editingQRCode = null;
    }
  };

  // Save QR code
  const saveQRCode = async function() {
    const codeId = document.getElementById('qr-code-id').value.trim();
    const locationNumber = parseInt(document.getElementById('qr-location-number').value);
    const locationName = document.getElementById('qr-location-name').value.trim();
    const active = document.getElementById('qr-active-status').value === 'true';

    // Validation
    if (!codeId || isNaN(locationNumber) || locationNumber < 1) {
      alert('Please fill all required fields with valid values.');
      return;
    }

    // Validate QR code format
    if (!validateQRCodeFormat(codeId)) {
      alert('QR Code ID must follow the format: GC25-[CODE]-[LOCATION]-[VALIDATION]');
      return;
    }

    try {
      const qrData = {
        locationNumber: locationNumber,
        locationName: locationName,
        description: locationName, // For backward compatibility
        active: active,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Save to Firebase
      if (window.DGSHFirebase && typeof DGSHFirebase.saveQRCode === 'function') {
        const success = await DGSHFirebase.saveQRCode(codeId, qrData);
        
        if (success) {
          hideQRForm();
          loadQRCodes();
          loadQRStatistics();
          alert(_editingQRCode ? 'QR code updated successfully!' : 'QR code created successfully!');
        } else {
          alert('Failed to save QR code. Please try again.');
        }
      } else {
        // Fallback: direct Firebase save
        const db = firebase.firestore();
        await db.collection('valid_codes').doc(codeId).set(qrData);
        
        hideQRForm();
        loadQRCodes();
        loadQRStatistics();
        alert(_editingQRCode ? 'QR code updated successfully!' : 'QR code created successfully!');
      }

    } catch (error) {
      console.error("Error saving QR code:", error);
      alert(`Error saving QR code: ${error.message}`);
    }
  };

  // Delete QR code
  const deleteQRCode = async function(qrCode) {
    if (!qrCode || !confirm(`Are you sure you want to delete QR code "${qrCode}"? This cannot be undone.`)) {
      return;
    }

    try {
      // Delete from Firebase
      if (window.DGSHFirebase && typeof DGSHFirebase.deleteQRCode === 'function') {
        const success = await DGSHFirebase.deleteQRCode(qrCode);
        
        if (success) {
          loadQRCodes();
          loadQRStatistics();
          alert('QR code deleted successfully!');
        } else {
          alert('Failed to delete QR code. Please try again.');
        }
      } else {
        // Fallback: direct Firebase delete
        const db = firebase.firestore();
        await db.collection('valid_codes').doc(qrCode).delete();
        
        loadQRCodes();
        loadQRStatistics();
        alert('QR code deleted successfully!');
      }

    } catch (error) {
      console.error("Error deleting QR code:", error);
      alert(`Error deleting QR code: ${error.message}`);
    }
  };

  // Load QR statistics
const loadQRStatistics = async function() {
  try {
    // Update summary stats
    const totalCodes = _qrCodes.length;
    const activeCodes = _qrCodes.filter(qr => qr.active !== false).length;

    const totalEl = document.getElementById('total-qr-codes');
    const activeEl = document.getElementById('active-qr-codes');

    if (totalEl) totalEl.textContent = totalCodes;
    if (activeEl) activeEl.textContent = activeCodes;

    // Get scan statistics from Firebase
    await loadScanStatistics();

  } catch (error) {
    console.error("Error loading QR statistics:", error);
  }
};


  // Load scan statistics from user data
  const loadScanStatistics = async function() {
    const statsBody = document.getElementById('qr-stats-body');
    if (!statsBody) return;

    statsBody.innerHTML = '<tr><td colspan="6" class="dgsh-admin-loading">Loading scan statistics...</td></tr>';

    try {
      // Get Firebase database
      const db = firebase.firestore();
      
      // Get all users
      const usersSnapshot = await db.collection('users').get();
      
      // Count scans for each QR code
      const scanCounts = {};
      const lastScanned = {};
      let totalScans = 0;

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.scannedCodes && Array.isArray(userData.scannedCodes)) {
          userData.scannedCodes.forEach(scan => {
            const code = scan.code;
            
            // Count scan
            scanCounts[code] = (scanCounts[code] || 0) + 1;
            totalScans++;

            // Track last scan time
            const scanTime = scan.timestamp;
            if (!lastScanned[code] || scanTime > lastScanned[code]) {
              lastScanned[code] = scanTime;
            }
          });
        }
      });

      // Update total scans
      document.getElementById('total-scans').textContent = totalScans;

      // Find most scanned location
      let mostScannedCode = null;
      let maxScans = 0;
      Object.entries(scanCounts).forEach(([code, count]) => {
        if (count > maxScans) {
          maxScans = count;
          mostScannedCode = code;
        }
      });

      if (mostScannedCode) {
        const mostScannedQR = _qrCodes.find(qr => qr.code === mostScannedCode);
        const locationText = mostScannedQR ? 
          `Location ${mostScannedQR.locationNumber}` : 
          mostScannedCode;
        document.getElementById('most-scanned-location').textContent = locationText;
      } else {
        document.getElementById('most-scanned-location').textContent = 'None';
      }

      // Generate statistics table
      let html = '';
      _qrCodes.forEach(qr => {
        const scans = scanCounts[qr.code] || 0;
        const lastScan = lastScanned[qr.code];
        const lastScanText = lastScan ? 
          new Date(lastScan).toLocaleString() : 
          'Never';

        html += `
          <tr>
            <td>Location ${qr.locationNumber || '?'} - ${qr.locationName || qr.description || 'Unnamed'}</td>
            <td><code>${qr.code}</code></td>
            <td>${scans}</td>
            <td>${lastScanText}</td>
            <td><span class="${qr.active !== false ? 'qr-status-active' : 'qr-status-inactive'}">${qr.active !== false ? 'Active' : 'Inactive'}</span></td>
            <td>
              <button class="dgsh-admin-view-qr-btn" data-qr-code="${qr.code}">View Details</button>
            </td>
          </tr>
        `;
      });

      if (html === '') {
        html = '<tr><td colspan="6" class="dgsh-admin-empty">No QR codes found.</td></tr>';
      }

      statsBody.innerHTML = html;

      // Add event listeners to view buttons
      document.querySelectorAll('#qr-stats-body .dgsh-admin-view-qr-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const qrCode = this.getAttribute('data-qr-code');
          showQRModal(qrCode);
        });
      });

    } catch (error) {
      console.error("Error loading scan statistics:", error);
      statsBody.innerHTML = '<tr><td colspan="6" class="dgsh-admin-error">Error loading statistics</td></tr>';
    }
  };

  // Show QR code modal
  const showQRModal = function(qrCode) {
    const qrData = _qrCodes.find(qr => qr.code === qrCode);
    if (!qrData) return;

    const modal = document.getElementById('dgsh-modal');
    const title = document.getElementById('dgsh-modal-title');
    const qrContainer = document.getElementById('dgsh-modal-qr');
    const codeDisplay = document.getElementById('dgsh-modal-code');
    const urlDisplay = document.getElementById('dgsh-modal-url');

    if (!modal) return;

    // Generate QR code URL
    const qrUrl = `${window.location.origin}/pages/scavenger-hunt?code=${qrCode}`;

    // Update modal content
    title.textContent = `QR Code: Location ${qrData.locationNumber}`;
    qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}" alt="QR Code" width="300" height="300">`;
    codeDisplay.textContent = qrCode;
    urlDisplay.textContent = qrUrl;

    // Show modal
    modal.style.display = 'flex';

    // Set up download and print buttons
    const downloadBtn = document.getElementById('dgsh-modal-download');
    const printBtn = document.getElementById('dgsh-modal-print');

    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.href = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;
        link.download = `qr-location-${qrData.locationNumber}.png`;
        link.click();
      };
    }

    if (printBtn) {
      printBtn.onclick = () => printSingleQR(qrCode, qrData);
    }
  };

  // Print single QR code
  const printSingleQR = function(qrCode, qrData) {
    const qrUrl = `${window.location.origin}/pages/scavenger-hunt?code=${qrCode}`;
    const printTemplate = document.getElementById('print-template');
    
    if (!printTemplate) return;

    printTemplate.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <h2>Doomlings Scavenger Hunt</h2>
        <h3>Location ${qrData.locationNumber}: ${qrData.locationName || qrData.description || 'Unnamed'}</h3>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}" width="300" height="300">
        <p><strong>QR Code:</strong> ${qrCode}</p>
        <p><strong>URL:</strong> ${qrUrl}</p>
      </div>
    `;

    window.print();
  };

  // Export QR codes to CSV
  const exportQRCodes = function() {
    if (_qrCodes.length === 0) {
      alert('No QR codes to export.');
      return;
    }

    const csvHeader = 'QR Code,Location Number,Location Name,Status,URL\n';
    const csvContent = _qrCodes.map(qr => {
      const url = `${window.location.origin}/pages/scavenger-hunt?code=${qr.code}`;
      return `"${qr.code}",${qr.locationNumber || ''},"${qr.locationName || qr.description || ''}","${qr.active !== false ? 'Active' : 'Inactive'}","${url}"`;
    }).join('\n');

    // Download CSV
    const blob = new Blob([csvHeader + csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-codes-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    alert(`Exported ${_qrCodes.length} QR codes to CSV file.`);
  };

  // Validate QR code format
  const validateQRCodeFormat = function(code) {
    // Basic format validation: GC25-[CODE]-[LOCATION]-[VALIDATION]
    const pattern = /^GC25-[A-Z0-9]+-[0-9]{2}-[A-Z0-9]+$/;
    return pattern.test(code);
  };

  // Public API
  return {
    init: init,
    isInitialized: function() { return _initialized; },
    loadQRCodes: loadQRCodes,
    loadQRStatistics: loadQRStatistics,
    showAddQRForm: showAddQRForm,
    hideQRForm: hideQRForm,
    exportQRCodes: exportQRCodes
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Wait for Firebase to be ready
  if (firebase && firebase.firestore) {
    DGSHQRManager.init();
  } else {
    // Retry after a short delay
    setTimeout(() => {
      if (firebase && firebase.firestore) {
        DGSHQRManager.init();
      }
    }, 1000);
  }

  // Set up modal close functionality
  const modalClose = document.getElementById('dgsh-modal-close');
  const modal = document.getElementById('dgsh-modal');
  
  if (modalClose && modal) {
    modalClose.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
});

// Make available globally
window.DGSHQRManager = DGSHQRManager;