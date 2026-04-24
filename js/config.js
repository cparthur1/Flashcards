// --- SHARED CONFIGURATION ---
// Centralized tailwind config and global settings

if (window.tailwind) {
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
}
