/**
 * Custom Authentication Module for Scavenger Hunt
 * Add this as assets/dgsh-custom-auth.js
 */

const DGSHCustomAuth = (function() {
  let _initialized = false;
  let _modal = null;
  let _currentMode = 'login';
  let _storedQRCode = null;

  // Initialize the custom auth system
  const init = function() {
    if (_initialized) return;

    _modal = document.getElementById('dgsh-auth-modal');
    if (!_modal) {
      console.error('Custom auth modal not found');
      return;
    }

    setupEventListeners();
    _initialized = true;
  };

  // Set up all event listeners
  const setupEventListeners = function() {
    // Tab switching
    const tabs = document.querySelectorAll('.dgsh-auth-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        switchTab(this.getAttribute('data-mode'));
      });
    });

    // Form submissions
    const loginForm = document.querySelector('#dgsh-login-form form');
    const registerForm = document.querySelector('#dgsh-register-form form');
    const recoverForm = document.querySelector('#dgsh-recover-form form');

    if (loginForm) {
      loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLogin(this);
      });
    }

    if (registerForm) {
      registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleRegister(this);
      });
    }

    if (recoverForm) {
      recoverForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handlePasswordReset(this);
      });
    }

    // Close modal
    const closeBtn = document.getElementById('dgsh-auth-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    // Close on overlay click
    _modal.addEventListener('click', function(e) {
      if (e.target === _modal) {
        closeModal();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isModalOpen()) {
        closeModal();
      }
    });
  };

  // Switch between tabs (login/register/recover)
  const switchTab = function(mode) {
    _currentMode = mode;

    // Update tab buttons
    document.querySelectorAll('.dgsh-auth-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

    // Update forms
    document.querySelectorAll('.dgsh-auth-form').forEach(form => {
      form.classList.remove('active');
    });
    document.getElementById(`dgsh-${mode}-form`).classList.add('active');

    // Update title
    const titles = {
      login: 'Login to Continue',
      register: 'Create Your Account',
      recover: 'Reset Your Password'
    };
    document.getElementById('dgsh-auth-title').textContent = titles[mode];

    // Clear any previous messages
    hideMessage();
  };

  // Show the authentication modal
  const showModal = function(qrCode = null, defaultMode = 'login') {
    if (!_modal) return;

    _storedQRCode = qrCode;
    switchTab(defaultMode);
    _modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scroll

    // Focus on first input
    setTimeout(() => {
      const firstInput = _modal.querySelector('.dgsh-auth-form.active input');
      if (firstInput) firstInput.focus();
    }, 100);
  };

  // Close the modal
  const closeModal = function() {
    if (!_modal) return;

    _modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scroll
    clearForms();
    hideMessage();
  };

  // Check if modal is open
  const isModalOpen = function() {
    return _modal && _modal.classList.contains('active');
  };

  // Handle login form submission
  const handleLogin = async function(form) {
    const formData = new FormData(form);
    const email = formData.get('email');
    const password = formData.get('password');

    if (!email || !password) {
      showMessage('Please fill in all fields', 'error');
      return;
    }

    showLoading(true);

    try {
      const response = await fetch('/account/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: `form_type=customer_login&utf8=✓&customer[email]=${encodeURIComponent(email)}&customer[password]=${encodeURIComponent(password)}`
      });

      if (response.ok) {
        // Check if login was successful by looking for redirect or success indicators
        const responseText = await response.text();
        
        if (responseText.includes('Invalid email or password') || responseText.includes('error')) {
          showMessage('Invalid email or password', 'error');
          showLoading(false);
          return;
        }

        // Login successful
        showMessage('Login successful! Processing your scan...', 'success');
        
        // Process any stored QR code
        setTimeout(() => {
          closeModal();
          handleSuccessfulAuth();
        }, 1000);

      } else {
        showMessage('Login failed. Please try again.', 'error');
        showLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      showMessage('Network error. Please try again.', 'error');
      showLoading(false);
    }
  };

  // Handle registration form submission
  const handleRegister = async function(form) {
    const formData = new FormData(form);
    const firstName = formData.get('first_name');
    const email = formData.get('email');
    const password = formData.get('password');

    if (!firstName || !email || !password) {
      showMessage('Please fill in all fields', 'error');
      return;
    }

    if (password.length < 6) {
      showMessage('Password must be at least 6 characters', 'error');
      return;
    }

    showLoading(true);

    try {
      const response = await fetch('/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: `form_type=create_customer&utf8=✓&customer[first_name]=${encodeURIComponent(firstName)}&customer[email]=${encodeURIComponent(email)}&customer[password]=${encodeURIComponent(password)}`
      });

      const responseText = await response.text();

      if (response.ok && !responseText.includes('error') && !responseText.includes('already exists')) {
        // Registration successful - now auto-login
        showMessage('Account created! Logging you in...', 'success');
        
        // Wait a moment, then try to login
        setTimeout(async () => {
          try {
            await handleLogin(createLoginForm(email, password));
          } catch (error) {
            showMessage('Account created! Please login with your new credentials.', 'info');
            switchTab('login');
            document.getElementById('login-email').value = email;
            showLoading(false);
          }
        }, 1000);

      } else if (responseText.includes('already exists')) {
        showMessage('This email is already registered. Please login instead.', 'error');
        switchTab('login');
        document.getElementById('login-email').value = email;
        showLoading(false);
      } else {
        showMessage('Registration failed. Please check your information.', 'error');
        showLoading(false);
      }
    } catch (error) {
      console.error('Registration error:', error);
      showMessage('Network error. Please try again.', 'error');
      showLoading(false);
    }
  };

  // Handle password reset form submission
  const handlePasswordReset = async function(form) {
    const formData = new FormData(form);
    const email = formData.get('email');

    if (!email) {
      showMessage('Please enter your email address', 'error');
      return;
    }

    showLoading(true);

    try {
      const response = await fetch('/account/recover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: `form_type=recover_customer_password&utf8=✓&email=${encodeURIComponent(email)}`
      });

      if (response.ok) {
        showMessage('Password reset instructions have been sent to your email.', 'success');
        showLoading(false);
        
        // Show helpful message about QR code
        setTimeout(() => {
          showMessage('After resetting your password, return to this page to continue with your scanned code.', 'info');
        }, 3000);
      } else {
        showMessage('Email address not found. Please check and try again.', 'error');
        showLoading(false);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      showMessage('Network error. Please try again.', 'error');
      showLoading(false);
    }
  };

  // Create a temporary form for auto-login after registration
  const createLoginForm = function(email, password) {
    const tempForm = document.createElement('form');
    const emailInput = document.createElement('input');
    const passwordInput = document.createElement('input');
    
    emailInput.name = 'email';
    emailInput.value = email;
    passwordInput.name = 'password';
    passwordInput.value = password;
    
    tempForm.appendChild(emailInput);
    tempForm.appendChild(passwordInput);
    
    return tempForm;
  };

  // Handle successful authentication
  const handleSuccessfulAuth = function() {
    // Reload the page to refresh authentication state
    if (_storedQRCode) {
      // If we have a stored QR code, add it to the URL
      window.location.href = `/pages/scavenger-hunt?code=${_storedQRCode}`;
    } else {
      // Just reload the page
      window.location.reload();
    }
  };

  // Show loading state
  const showLoading = function(show) {
    const loadingDiv = document.getElementById('dgsh-auth-loading');
    const forms = document.querySelectorAll('.dgsh-auth-form');
    
    if (show) {
      forms.forEach(form => form.style.display = 'none');
      loadingDiv.style.display = 'block';
    } else {
      loadingDiv.style.display = 'none';
      forms.forEach(form => form.style.display = 'none');
      document.querySelector('.dgsh-auth-form.active').style.display = 'block';
    }
  };

  // Show message
  const showMessage = function(message, type = 'info') {
    const messageDiv = document.getElementById('dgsh-auth-message');
    messageDiv.textContent = message;
    messageDiv.className = `dgsh-auth-message ${type}`;
    messageDiv.style.display = 'block';
  };

  // Hide message
  const hideMessage = function() {
    const messageDiv = document.getElementById('dgsh-auth-message');
    messageDiv.style.display = 'none';
  };

  // Clear all forms
  const clearForms = function() {
    const forms = document.querySelectorAll('.dgsh-auth-form form');
    forms.forEach(form => {
      if (form) form.reset();
    });
  };

  // Public API
  return {
    init: init,
    showModal: showModal,
    closeModal: closeModal,
    isModalOpen: isModalOpen,
    
    // Method to show auth modal for QR codes
    showAuthForQR: function(qrCode) {
      showModal(qrCode, 'login');
    }
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  DGSHCustomAuth.init();
});

// Make available globally
window.DGSHCustomAuth = DGSHCustomAuth;