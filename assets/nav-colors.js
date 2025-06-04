const alternateNavColors = {
  init: function() {
    document.addEventListener('DOMContentLoaded', function() {
      // Function to check if we're on the home page
      const isHomePage = document.body.classList.contains('template-index');
      
      // Function to apply alternating colors to text
      function colorText() {
        // Select desktop and mobile links separately
        const desktopLinks = document.querySelectorAll('.holiday-gift-guide-nav .site-nav__link');
        const mobileLinks = document.querySelectorAll('.holiday-gift-guide-nav .mobile-site-nav__link');

        // Handle desktop links with scroll-based colors
        desktopLinks.forEach(element => {
          const hasDockingHeaderFixed = document.querySelector('.docking-header-fixed') !== null;
          let colors;
          
          if (isHomePage) {
            // On homepage - colors change based on scroll
            if (hasDockingHeaderFixed) {
              colors = ['#ffb0bc', '#ace596']; // Light colors when not scrolled
            } else {
              colors = ['#d81d38', '#3d901e']; // Dark colors when scrolled
            }
          } else {
            // On other pages - always dark colors
            colors = ['#d81d38', '#3d901e']; // Dark colors for all states
          }

          const text = element.textContent.trim();
          let coloredText = '';
          for (let i = 0; i < text.length; i++) {
            const color = colors[i % 2];
            coloredText += `<span style="color: ${color};">${text[i]}</span>`;
          }
          element.innerHTML = coloredText;
        });

        // Handle mobile links - always use dark colors
        mobileLinks.forEach(element => {
          const colors = ['#d81d38', '#3d901e']; // Dark colors for mobile menu
          const text = element.textContent.trim();
          let coloredText = '';
          for (let i = 0; i < text.length; i++) {
            const color = colors[i % 2];
            coloredText += `<span style="color: ${color};">${text[i]}</span>`;
          }
          element.innerHTML = coloredText;
        });
      }

      // Initial color application
      colorText();

      // Add scroll event listener with throttling (only affects desktop)
      let ticking = false;
      document.addEventListener('scroll', function() {
        if (!ticking) {
          window.requestAnimationFrame(function() {
            colorText();
            ticking = false;
          });
          ticking = true;
        }
      });
    });
  }
};

// Initialize when the file loads
alternateNavColors.init();

// Color Reference:
// Desktop Menu:
// Homepage only:
// #ffb0bc (pink) Light, #ace596 (green) Light - When not scrolled (header fixed)
// #d81d38 (red) Dark, #3d901e (green) Dark - When scrolled
//
// Other pages:
// #d81d38 (red) Dark, #3d901e (green) Dark - Always, regardless of scroll
//
// Mobile Menu:
// #d81d38 (red) Dark, #3d901e (green) Dark - Always, all pages