/**
 * Ajax-based QR Code Generation and Validation
 * File: assets/dgsh-qr-ajax.js
 */

const DGSHQRAjax = (function() {
  let _initialized = false;
  
  const init = function() {
    if (_initialized) return;
    
    const codeInput = document.getElementById('qr-code-id');
    const locationInput = document.getElementById('qr-location-number');
    const customCodeInput = document.getElementById('qr-custom-code'); // Check if it already exists
    
    if (!codeInput || !locationInput) return;
    
    // Only set up if custom code input already exists (from HTML)
    if (customCodeInput) {
      setupRealTimeGeneration();
      setupAjaxValidation();
    } else {
      // Fallback: create it if it doesn't exist (legacy support)
      setupCustomCodeInput();
      setupRealTimeGeneration();
      setupAjaxValidation();
    }
    
    _initialized = true;
  };
  
  const setupCustomCodeInput = function() {
    const codeInput = document.getElementById('qr-code-id');
    const formGroup = codeInput.closest('.dgsh-admin-form-group');
    
    // Replace the full code input with custom code input
    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.id = 'qr-custom-code';
    newInput.className = 'dgsh-admin-qr-custom-code';
    newInput.placeholder = 'Enter 4-8 characters (A-Z, 0-9)';
    newInput.maxLength = 8;
    newInput.style.textTransform = 'uppercase';
    
    // Add preview display
    const previewDiv = document.createElement('div');
    previewDiv.className = 'dgsh-qr-preview';
    previewDiv.innerHTML = `
      <small class="dgsh-admin-form-help">Preview: <span id="qr-preview">GC25-____-__-____</span></small>
      <div id="qr-validation-status" class="dgsh-qr-validation-status"></div>
    `;
    
    // Replace original input
    codeInput.style.display = 'none';
    formGroup.appendChild(newInput);
    formGroup.appendChild(previewDiv);
  };
  
  const setupRealTimeGeneration = function() {
    const customCodeInput = document.getElementById('qr-custom-code');
    const locationInput = document.getElementById('qr-location-number');
    const previewSpan = document.getElementById('qr-preview');
    const fullCodeInput = document.getElementById('qr-code-id');
    
    if (!customCodeInput || !locationInput || !previewSpan || !fullCodeInput) return;
    
    const updatePreview = function() {
      const customCode = (customCodeInput.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const location = (locationInput.value || '').padStart(2, '0');
      
      if (customCode.length >= 3 && location !== '00') {
        const validation = generateValidationCode(customCode, location);
        const fullCode = `GC25-${customCode}-${location}-${validation}`;
        
        previewSpan.textContent = fullCode;
        fullCodeInput.value = fullCode;
        
        // Trigger validation
        validateCodeAjax(fullCode);
      } else {
        previewSpan.textContent = `GC25-${customCode || '____'}-${location || '__'}-____`;
        fullCodeInput.value = '';
        clearValidationStatus();
      }
    };
    
    customCodeInput.addEventListener('input', function() {
      this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      updatePreview();
    });
    
    locationInput.addEventListener('input', updatePreview);
  };
  
  const setupAjaxValidation = function() {
    let validationTimeout;
    
    const customCodeInput = document.getElementById('qr-custom-code');
    const locationInput = document.getElementById('qr-location-number');
    
    if (!customCodeInput || !locationInput) return;
    
    const debouncedValidation = function() {
      clearTimeout(validationTimeout);
      validationTimeout = setTimeout(() => {
        const fullCode = document.getElementById('qr-code-id').value;
        if (fullCode && fullCode.includes('GC25-')) {
          validateCodeAjax(fullCode);
        }
      }, 300);
    };
    
    customCodeInput.addEventListener('input', debouncedValidation);
    locationInput.addEventListener('input', debouncedValidation);
  };
  
  const generateValidationCode = function(customCode, location) {
    // Simple checksum algorithm
    const input = customCode + location;
    let sum = 0;
    
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      sum += char * (i + 1);
    }
    
    // Convert to 4-character alphanumeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar chars
    let result = '';
    
    for (let i = 0; i < 4; i++) {
      result += chars[sum % chars.length];
      sum = Math.floor(sum / chars.length) + 17; // Add prime to mix
    }
    
    return result;
  };
  
  const validateCodeAjax = async function(fullCode) {
    const statusDiv = document.getElementById('qr-validation-status');
    if (!statusDiv) return;
    
    // Show loading
    statusDiv.innerHTML = '<span class="dgsh-validation-loading">🔄 Checking...</span>';
    
    try {
      // Check if code already exists
      const exists = await checkCodeExists(fullCode);
      const isValidFormat = /^GC25-[A-Z0-9]{3,8}-[0-9]{2}-[A-Z0-9]{4}$/.test(fullCode);
      
      if (!isValidFormat) {
        statusDiv.innerHTML = '<span class="dgsh-validation-error">❌ Invalid format</span>';
      } else if (exists) {
        statusDiv.innerHTML = '<span class="dgsh-validation-error">❌ Code already exists</span>';
      } else {
        statusDiv.innerHTML = '<span class="dgsh-validation-success">✅ Available</span>';
      }
    } catch (error) {
      statusDiv.innerHTML = '<span class="dgsh-validation-error">❌ Validation failed</span>';
    }
  };
  
  const checkCodeExists = async function(code) {
    try {
      if (window.DGSHFirebase && typeof DGSHFirebase.validateQRCode === 'function') {
        return await DGSHFirebase.validateQRCode(code);
      }
      
      // Fallback: direct Firebase check
      if (firebase && firebase.firestore) {
        const db = firebase.firestore();
        const doc = await db.collection('valid_codes').doc(code).get();
        return doc.exists;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking code existence:', error);
      return false;
    }
  };
  
  const clearValidationStatus = function() {
    const statusDiv = document.getElementById('qr-validation-status');
    if (statusDiv) {
      statusDiv.innerHTML = '';
    }
  };
  
  return {
    init: init,
    isInitialized: function() { return _initialized; }
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Wait for the form to be ready
  setTimeout(() => {
    if (document.getElementById('qr-code-id')) {
      DGSHQRAjax.init();
    }
  }, 500);
});

window.DGSHQRAjax = DGSHQRAjax;