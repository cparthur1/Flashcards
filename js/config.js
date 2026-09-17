// --- SHARED CONFIGURATION ---
// Suppress Tailwind Play CDN production warning
(function () {
    const origWarn = console.warn;
    console.warn = function (...args) {
        if (typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com should not be used in production')) {
            return;
        }
        origWarn.apply(console, args);
    };
})();

// Centralized tailwind config and global settings
window.tailwind = window.tailwind || {};
window.tailwind.config = {
    darkMode: 'media',
    theme: {
        extend: {
            colors: {
                gray: { 900: '#111827', 800: '#1f2937', 750: '#2d3748', 700: '#374151' }
            }
        }
    }
};

