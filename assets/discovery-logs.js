function setupPopups() {
  // Set up click handlers for opening popups
  document.querySelectorAll('.section-discovery .gif-wrap').forEach(gifImage => {
    gifImage.addEventListener('click', function() {
      const section = this.closest('.section-discovery');
      const sectionId = section.id.replace('section-', '');
      const imageUrl = this.dataset.imageUrl;
      openPopup(sectionId, imageUrl);
    });
  });

  // Set up click handlers for overlay backgrounds (outside click)
  document.querySelectorAll('[id^="overlay-"]').forEach(overlay => {
    const sectionId = overlay.id.replace('overlay-', '');
    
    overlay.addEventListener('click', function(event) {
      // Only close if the click is directly on the overlay (not on any child elements)
      if (event.target === this) {
        closePopup(sectionId);
      }
    });
  });
}

function openPopup(sectionId, imageUrl) {
  const overlay = document.getElementById('overlay-' + sectionId);
  const popup = document.getElementById('imagePopup-' + sectionId);
  const popupImg = document.getElementById('popupImg-' + sectionId);
  
  if (popupImg) {
    popupImg.src = imageUrl;
    overlay.style.display = 'block';
    popup.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Disable scrolling
    
    // Ensure the popup itself doesn't trigger the outside click handler
    if (popup) {
      popup.addEventListener('click', function(event) {
        event.stopPropagation();
      });
    }
  }
}

function closePopup(sectionId) {
  const overlay = document.getElementById('overlay-' + sectionId);
  const popup = document.getElementById('imagePopup-' + sectionId);
  
  if (overlay && popup) {
    overlay.style.display = 'none';
    popup.style.display = 'none';
    document.body.style.overflow = 'auto'; // Enable scrolling
  }
}