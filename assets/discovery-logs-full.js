 
function resizeMap() {
  document.querySelectorAll('.section-discovery').forEach(section => {
    var image = section.querySelector('img[usemap]');
    var map = image.getAttribute('usemap').replace('#', '');
    var areas = section.querySelectorAll('area');
    var originalWidth = image.naturalWidth;
    var originalHeight = image.naturalHeight;
    var currentWidth = image.offsetWidth;
    var currentHeight = image.offsetHeight;
    var widthRatio = currentWidth / originalWidth;
    var heightRatio = currentHeight / originalHeight;

    areas.forEach(function(area) {
      var originalCoords = area.dataset.originalCoords || area.getAttribute('coords');
      if (!area.dataset.originalCoords) {
        area.dataset.originalCoords = originalCoords;
      }
      var coords = originalCoords.split(',').map(function(coord, index) {
        return index % 2 === 0 ? parseInt(coord * widthRatio) : parseInt(coord * heightRatio);
      });
      area.setAttribute('coords', coords.join(','));
    });
  });
}

function setupPopups() {
  document.querySelectorAll('.section-discovery area').forEach(area => {
    area.addEventListener('click', handleAreaClick);
    area.addEventListener('touchend', handleAreaClick);
  });
}

function handleAreaClick(event) {
  event.preventDefault();
  var sectionId = this.closest('.section-discovery').id.replace('section-', '');
  var imageUrl = this.dataset.imageUrl;
  var popup = document.getElementById('imagePopup-' + sectionId);
  var overlay = document.getElementById('overlay-' + sectionId);

  if (popup && overlay) {
    document.getElementById('popupImg-' + sectionId).src = imageUrl;
    popup.style.display = 'block';
    overlay.style.display = 'block';
  } else {
    console.error('Popup or overlay elements not found:', popup, overlay);
  }
}

function closePopup(sectionId) {
  document.getElementById('imagePopup-' + sectionId).style.display = 'none';
  document.getElementById('overlay-' + sectionId).style.display = 'none';
}

window.addEventListener('resize', resizeMap);
window.addEventListener('load', function() {
  resizeMap();
  setupPopups();
});




document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.section-discovery .gif-wrap').forEach(function(gifImage) {
    gifImage.addEventListener('click', function() {
      var section = this.closest('.section-discovery');
      var sectionId = section.id.replace('section-', '');

      // Fetch the image URL for the popup from the data attribute of the GIF image
      var imageUrl = this.dataset.imageUrl;  // Ensure that 'this' is referring to the image clicked

      var popup = document.getElementById('imagePopup-' + sectionId);
      var overlay = document.getElementById('overlay-' + sectionId);

      if (popup && overlay) {
        var popupImg = document.getElementById('popupImg-' + sectionId);  // Ensure this ID is correct
        if (popupImg) {
          popupImg.src = imageUrl;
          popup.style.display = 'block';
          overlay.style.display = 'block';
        } else {
          console.error('Popup image element not found:', 'popupImg-' + sectionId);
        }
      } else {
        console.error('Popup or overlay elements not found:', popup, overlay);
      }
    });
  });
});




// Prefech popup image
let loadedImages = [];

document.addEventListener('DOMContentLoaded', function() {
  // Select all map elements that start with "Map-desktop-"
  const maps = document.querySelectorAll('map[name^="Map-desktop-"]');
  
  maps.forEach(map => {
    const areas = map.getElementsByTagName('area');
  
    Array.prototype.forEach.call(areas, (area) => {
      const imageUrl = area.getAttribute('data-image-url');
      if (imageUrl && !loadedImages.includes(imageUrl)) {
        const image = new Image();
        image.src = imageUrl;
        image.onload = function() {
          console.log(`Image loaded: ${imageUrl}`);
          loadedImages.push(imageUrl);
        };
        image.onerror = function() {
          console.log(`Failed to load image: ${imageUrl}`);
        };
      }
    });
  });
});


function resizeGIFs() {
  const gifs = document.querySelectorAll('.gif-wrap');
  gifs.forEach(gif => {
    const originalRight = parseFloat(gif.dataset.right);
    const originalTop = parseFloat(gif.dataset.top);
    const originalWidth = parseFloat(gif.dataset.width);

    // Assuming the container scales with the window resize
    const containerWidth = document.querySelector('.section-discovery').offsetWidth;

    // Calculate new dimensions based on the ratio of current container width to the original width
    const scaleRatio = containerWidth / 1200; // Replace 1200 with the original container width

    gif.style.right = `${originalRight * scaleRatio}px`;
    gif.style.top = `${originalTop * scaleRatio}px`;
    gif.style.width = `${originalWidth * scaleRatio}px`;
  });
}

window.addEventListener('resize', function() {
  resizeMap();  // Existing function to resize image maps
  resizeGIFs(); // Newly added function to resize GIFs
});

document.addEventListener('DOMContentLoaded', function() {
  resizeMap();  // Ensure this function is also called on page load
  resizeGIFs(); // Ensure GIFs are resized on page load
});
