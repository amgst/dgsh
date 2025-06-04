

  function applyQuantityRestrictions() {
    const targetProductHandle = "doomlings-overlush-mystery-expansion-4-pack";
    
    function showNotification(message) {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #f8f8f8;
        border: 1px solid #ddd;
        border-left: 4px solid #00a0dc;
        padding: 16px 24px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
        font-size: 14px;
        max-width: 300px;
        line-height: 1.4;
        color: #333;
      `;
      
      notification.innerHTML = message;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => notification.remove(), 300);
      }, 10000);
    }

    const cartItemContainers = document.querySelectorAll('.cart-item-container');
    
    cartItemContainers.forEach(container => {
      const productHandle = container.querySelector('[data-product-handle]')?.dataset.productHandle ||
                           container.querySelector('a[href*="/products/"]')?.href.split('/products/')[1]?.split('?')[0] ||
                           container.querySelector('a[href*="/products/"]')?.href.split('/products/')[1]?.split('#')[0];
      
      if (productHandle && productHandle.trim() === targetProductHandle) {
        const reducedPriceElement = container.querySelector('.product-price__reduced');
      const currentPrice = reducedPriceElement ? 
          parseFloat(reducedPriceElement.textContent.replace(/[^0-9.-]+/g, '')) : 
          null;


        if (currentPrice === 0) {
          const quantityInput = container.querySelector('.quantity__number');
          const plusButton = container.querySelector('.quantity__plus');
          
          if (quantityInput && plusButton) {
            // Disable plus button
            plusButton.style.pointerEvents = 'none';
            plusButton.style.opacity = '0.5';
            plusButton.href = 'javascript:void(0);';
            
            // Update quantity if greater than 1
            if (parseInt(quantityInput.value) > 1) {
              fetch('/cart/change.js', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  line: quantityInput.dataset.line,
                  quantity: 1
                })
              })
              .then(response => response.json())
              .then(() => {
                showNotification('⚠️ The quantity for the Overlush Mystery Expansion has been automatically set to 1 as per discount terms.');
                window.location.reload();
              });
            }

            // Prevent manual quantity changes
            quantityInput.addEventListener('change', function(e) {
              if (parseInt(this.value) > 1) {
                this.value = 1;
                showNotification('⚠️ The quantity for the Overlush Mystery Expansion has been reset to 1 as per discount terms.');
                window.location.reload();
              }
            });
          }
        }
      }
    });
  }

  // Initial application of restrictions
  document.addEventListener('DOMContentLoaded', applyQuantityRestrictions);

  // Watch for cart updates
  const cartObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' || mutation.type === 'subtree') {
        applyQuantityRestrictions();
      }
    });
  });

  // Start observing cart changes
  document.addEventListener('DOMContentLoaded', () => {
    const cartContainer = document.querySelector('.cart-items') || document.querySelector('[data-cart-container]');
    if (cartContainer) {
      cartObserver.observe(cartContainer, {
        childList: true,
        subtree: true
      });
    }
  });

  // Handle AJAX cart updates
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args).then(async (response) => {
      const url = args[0].toString();
      if (url.includes('/cart/change.js') || url.includes('/cart/update.js') || url.includes('/cart/add.js')) {
        setTimeout(applyQuantityRestrictions, 500); // Apply restrictions after cart updates
      }
      return response;
    });
  };
