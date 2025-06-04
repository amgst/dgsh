// Constants for interaction settings
const TOUCH_START = { capture: true, passive: true };
const PREFETCH_DELAY = 65; // Delay in milliseconds before prefetching on hover

// Check browser support for prefetching
function supportsPrefetch() {
    return document.createElement("link").relList.supports("prefetch");
}

// Initialize prefetching behavior based on conditions
function initializePrefetching() {
    if (!supportsPrefetch()) return;

    const userAgent = navigator.userAgent;
    const chromeVersion = userAgent.includes("Chrome/") ? parseInt(userAgent.split("Chrome/")[1]) : null;

    // Setup based on custom data attributes on the body
    const shouldPrefetchOnMousedown = document.body.dataset.instantIntensity.startsWith("mousedown");
    const shouldPrefetchOnHover = !shouldPrefetchOnMousedown;

    if (shouldPrefetchOnMousedown) {
        document.addEventListener("mousedown", handleMouseDownPrefetch, TOUCH_START);
    } else if (shouldPrefetchOnHover) {
        document.addEventListener("mouseover", handleMouseOverPrefetch, TOUCH_START);
    }
}

// Prefetch on mouse down
function handleMouseDownPrefetch(event) {
    const link = event.target.closest("a");
    if (shouldPrefetchLink(link)) {
        prefetchUrl(link.href);
    }
}

// Prefetch on mouse over after a delay
function handleMouseOverPrefetch(event) {
    const link = event.target.closest("a");
    setTimeout(() => {
        if (shouldPrefetchLink(link)) {
            prefetchUrl(link.href);
        }
    }, PREFETCH_DELAY);
}

// Check if a link should be prefetched
function shouldPrefetchLink(link) {
    return link && link.href && link.origin === location.origin;
}

// Execute prefetch for a URL
function prefetchUrl(url) {
    const linkElement = document.createElement("link");
    linkElement.rel = "prefetch";
    linkElement.href = url;
    document.head.appendChild(linkElement);
}

initializePrefetching();
