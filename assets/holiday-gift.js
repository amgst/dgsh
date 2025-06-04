document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.gift-section').forEach(function($section) {
    var sectionId = $section.id;
    var autoplay = $section.getAttribute('data-autoplay') === 'true';
    var autoplaySpeed = parseInt($section.getAttribute('data-autoplay-speed')) || 3000;
    var $slider = $section.querySelector('.slick-slider');

    // Ensure jQuery is loaded
    if (typeof jQuery === 'undefined') {
      console.error('jQuery is not loaded. Please include jQuery before initializing Slick Slider.');
      return;
    }

// Define the SVGs for the arrows
  var leftArrowSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 122.85" class="arrow">
      <polygon points="47.2 0 60 10.08 21.28 62 60 112.8 47.44 122.85 0 62 47.2 0"/>
    </svg>`;

  var rightArrowSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 122.85" class="arrow">
      <polygon points="12.8 0 0 10.08 38.72 62 0 112.8 12.56 122.85 60 62 12.8 0"/>
    </svg>`;

    function initializeSlick() {
      if (!$($slider).hasClass('slick-initialized')) {
        $($slider).slick({
          slidesToShow: 1,
          slidesToScroll: 1,
          infinite: true,
          centerMode: true,
          centerPadding: '60px',
          dots: false,
          arrows: true,
          prevArrow: `<button type="button" class="slick-prev">${leftArrowSVG}</button>`,
          nextArrow: `<button type="button" class="slick-next">${rightArrowSVG}</button>`,
          autoplay: autoplay,
          autoplaySpeed: autoplaySpeed,
          speed: 500,
          responsive: [
            {
              breakpoint: 1000,
              settings: {
                slidesToShow: 2,
                centerMode: true,
              }
            },
            {
              breakpoint: 830,
              settings: {
                slidesToShow: 1,
                centerMode: true,
              }
            }
          ]
        });
      }
    }

    function destroySlick() {
      if ($($slider).hasClass('slick-initialized')) {
        $($slider).slick('unslick');
      }
    }

    function resetSlick() {
      destroySlick();
      initializeSlick();
    }

    initializeSlick();

    if (typeof Shopify !== 'undefined' && Shopify.designMode) {
      document.addEventListener('shopify:section:load', resetSlick);
      document.addEventListener('shopify:section:unload', destroySlick);
      document.addEventListener('shopify:block:select', resetSlick);
      document.addEventListener('shopify:block:deselect', resetSlick);
    }
  });
});


