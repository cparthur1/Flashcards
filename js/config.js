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

// Centralized tailwind config and global settings (Light Mode Only - Dark mode is disabled and prohibited)
window.tailwind = window.tailwind || {};
window.tailwind.config = {
    darkMode: 'class', // Enforce class mode so Tailwind never activates dark theme via prefers-color-scheme
    theme: {
        extend: {
            colors: {
                gray: { 900: '#111827', 800: '#1f2937', 750: '#2d3748', 700: '#374151' }
            }
        }
    }
};

// Stripe Client Configuration
window.STRIPE_PUBLISHABLE_KEY = window.STRIPE_PUBLISHABLE_KEY || 'pk_live_51UWEHsRynl9tIFFYm32d9vyXApB9FLeUcI5oNBuaCwkkxA0yc0pAVjKioRBO0Zy8j7CVQU6LSp09mM5Lss3EaDNg00qvRJ4VIT';
