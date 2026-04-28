// --- SHARED UTILITIES ---

/**
 * Normalizes a string for comparison by removing accents, 
 * parenthetical asides, and special characters.
 */
export function normalizeString(str) {
    if (!str) return '';
    return str.replace(/\(.*?\)/g, '')
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/-/g, ' ');
}

/**
 * Calculates Levenshtein-based similarity between two strings.
 * Returns a value between 0 and 1.
 */
export function calculateSimilarity(s1, s2) {
    let longer = s1, shorter = s2;
    if (s1.length < s2.length) { longer = s2; shorter = s1; }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;

    const distance = (s1, s2) => {
        const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
        for (let i = 0; i <= s1.length; i++) track[0][i] = i;
        for (let j = 0; j <= s2.length; j++) track[j][0] = j;
        for (let j = 1; j <= s2.length; j++) {
            for (let i = 1; i <= s1.length; i++) {
                const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(track[j][i - 1] + 1, track[j - 1][i] + 1, track[j - 1][i - 1] + indicator);
            }
        }
        return track[s2.length][s1.length];
    };

    return (longerLength - distance(longer, shorter)) / longerLength;
}

/**
 * Shuffles an array in place.
 */
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
/**
 * Retries a function with exponential backoff.
 */
export async function callWithRetry(fn, retries = 3, delay = 1000) {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        // Solo reintentar si es error de red o 429/503
        console.warn(`Erro na API, tentando novamente em ${delay}ms... Restam ${retries} tentativas.`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callWithRetry(fn, retries - 1, delay * 2);
    }
}
/**
 * Centralized routing configuration.
 * Dynamically adjusts paths based on current location (root vs /pages/).
 */
const isSubpage = window.location.pathname.includes('/pages/');
const prefix = isSubpage ? '../' : '';

export const ROUTES = {
    HOME: prefix + 'index.html',
    GAME: prefix + 'pages/game.html',
    GENERATE: prefix + 'pages/generate.html'
};

/**
 * Checks if we should reset the AI model fallback (at 3 AM daily).
 */
export function checkAndResetModelFallback() {
    const now = new Date();
    const lastResetStr = localStorage.getItem('last_model_reset');
    const lastReset = lastResetStr ? new Date(lastResetStr) : null;

    // Proxima ou atual barreira de 3 AM
    const today3AM = new Date();
    today3AM.setHours(3, 0, 0, 0);

    // Se agora passou de 3 AM E (não houve reset ou o último reset foi antes das 3 AM de hoje)
    if (now >= today3AM && (!lastReset || lastReset < today3AM)) {
        localStorage.removeItem('model_fallback_active');
        localStorage.setItem('last_model_reset', now.toISOString());
        console.log("AI Model fallback reset for the new day.");
    }
}
