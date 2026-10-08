// --- SHARED UTILITIES ---

/**
 * Normalizes a string for comparison by removing accents, 
 * parenthetical asides, and special characters.
 */
export function normalizeString(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/\(.*?\)/g, '')
        .replace(/[*_`$#]/g, '')
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
    const str1 = String(s1 ?? '');
    const str2 = String(s2 ?? '');
    let longer = str1, shorter = str2;
    if (str1.length < str2.length) { longer = str2; shorter = str1; }
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
    if (!Array.isArray(array)) return [];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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
const isSubpage = typeof window !== 'undefined' && window.location ? window.location.pathname.includes('/pages/') : false;
const prefix = isSubpage ? '../' : '';

export const ROUTES = {
    HOME: prefix + 'index.html',
    GAME: prefix + 'pages/game.html',
    GENERATE: prefix + 'pages/generate.html',
    STATS: prefix + 'pages/stats.html'
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

// --- FETCH INTERCEPTOR FOR GEMINI API ROLE FIX ---
// Fixes GoogleGenerativeAI SDK sending deprecated role 'function' instead of 'user' for function responses
if (typeof window !== 'undefined' && window.fetch) {
    const originalFetch = window.fetch;
    window.fetch = async function (resource, options) {
        if (options && options.body && typeof options.body === 'string') {
            const url = typeof resource === 'string' ? resource : (resource && resource.url) ? resource.url : '';
            if (url.includes('generativelanguage.googleapis.com')) {
                try {
                    const body = JSON.parse(options.body);
                    if (body.contents && Array.isArray(body.contents)) {
                        let modified = false;
                        for (const content of body.contents) {
                            if (content.role === 'function') {
                                content.role = 'user';
                                modified = true;
                            }
                        }
                        if (modified) {
                            options = { ...options, body: JSON.stringify(body) };
                        }
                    }
                } catch (e) {
                    // Ignore JSON parsing errors
                }
            }
        }
        return originalFetch.call(this, resource, options);
    };
}

/**
 * Ensures all history items in a Gemini ChatSession use valid roles ('user' instead of 'function').
 */
export function sanitizeChatHistory(chatSession) {
    if (chatSession && Array.isArray(chatSession._history)) {
        chatSession._history.forEach(item => {
            if (item.role === 'function') {
                item.role = 'user';
            }
        });
    }
}

/**
 * Compresses an image file or Data URL to a maximum dimension and returns a JPEG Data URL.
 * @param {File|Blob|string} imageInput - File, Blob, or URL string
 * @param {number} maxDimension - Max width or height in pixels (default 800)
 * @param {number} quality - Compression quality 0.0 to 1.0 (default 0.85)
 * @returns {Promise<string>} Base64 Data URL
 */
export function compressImageFile(imageInput, maxDimension = 800, quality = 0.85) {
    return new Promise((resolve, reject) => {
        if (!imageInput) {
            resolve('');
            return;
        }

        const processLoadedImage = (img) => {
            let width = img.width;
            let height = img.height;

            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrl);
        };

        if (typeof imageInput === 'string') {
            if (imageInput.startsWith('data:') && imageInput.length < 50000) {
                // Short enough data URL, no re-compression needed
                resolve(imageInput);
                return;
            }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => processLoadedImage(img);
            img.onerror = () => resolve(imageInput); // fallback to original string if error
            img.src = imageInput;
        } else if (imageInput instanceof File || imageInput instanceof Blob) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => processLoadedImage(img);
                img.onerror = (err) => reject(err);
                img.src = e.target.result;
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(imageInput);
        } else {
            resolve('');
        }
    });
}

/**
 * Parses Markdown and renders LaTeX math formulas (KaTeX).
 * Supports inline ($...$, \(...\)) and block ($$...$$, \[...\]) math.
 * Preserves HTML tags (including highlighter <mark> elements) and code blocks.
 */
export function renderMathAndMarkdown(text) {
    if (!text) return '';

    if (typeof marked !== 'undefined' && typeof marked.setOptions === 'function') {
        marked.setOptions({ gfm: true, breaks: true });
    }

    const mathBlocks = [];

    // 1. Temporarily extract block math (\[...\] and $$...$$)
    let placeholderText = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
        const placeholder = `%%BLOCK_MATH_${mathBlocks.length}%%`;
        mathBlocks.push({ type: 'BLOCK', text: math });
        return placeholder;
    });
    placeholderText = placeholderText.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
        const placeholder = `%%BLOCK_MATH_${mathBlocks.length}%%`;
        mathBlocks.push({ type: 'BLOCK', text: math });
        return placeholder;
    });

    // 2. Temporarily extract inline math (\(...\) and $...$)
    placeholderText = placeholderText.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
        const placeholder = `%%INLINE_MATH_${mathBlocks.length}%%`;
        mathBlocks.push({ type: 'INLINE', text: math });
        return placeholder;
    });
    placeholderText = placeholderText.replace(/\$(?!\s)((?:\\\$|[^\$])+?)(?<!\s)\$/g, (match, math) => {
        const placeholder = `%%INLINE_MATH_${mathBlocks.length}%%`;
        mathBlocks.push({ type: 'INLINE', text: math });
        return placeholder;
    });

    // 3. Parse Markdown
    let html = typeof marked !== 'undefined' ? marked.parse(placeholderText) : placeholderText;

    // 4. Extract code blocks from HTML to prevent rendering math inside them
    const codeBlocks = [];
    html = html.replace(/<pre><code[\s\S]*?<\/code><\/pre>/gi, (match) => {
        const placeholder = `%%CODE_BLOCK_${codeBlocks.length}%%`;
        codeBlocks.push(match);
        return placeholder;
    });
    html = html.replace(/<code[\s\S]*?<\/code>/gi, (match) => {
        const placeholder = `%%CODE_BLOCK_${codeBlocks.length}%%`;
        codeBlocks.push(match);
        return placeholder;
    });

    // 5. Restore math blocks and render them with KaTeX
    if (typeof katex !== 'undefined') {
        html = html.replace(/%%(BLOCK|INLINE)_MATH_(\d+)%%/g, (match, type, index) => {
            const mathItem = mathBlocks[parseInt(index, 10)];
            if (!mathItem) return match;
            try {
                return katex.renderToString(mathItem.text, {
                    displayMode: type === 'BLOCK',
                    throwOnError: false
                });
            } catch (err) {
                console.error("KaTeX error:", err);
                return match;
            }
        });
    } else {
        html = html.replace(/%%(BLOCK|INLINE)_MATH_(\d+)%%/g, (match, type, index) => {
            const mathItem = mathBlocks[parseInt(index, 10)];
            if (!mathItem) return match;
            return type === 'BLOCK' ? `$$${mathItem.text}$$` : `$${mathItem.text}$`;
        });
    }

    // 6. Restore code blocks
    html = html.replace(/%%CODE_BLOCK_(\d+)%%/g, (match, index) => {
        return codeBlocks[parseInt(index, 10)] || '';
    });

    // 7. Restore any remaining math placeholders
    html = html.replace(/%%(BLOCK|INLINE)_MATH_(\d+)%%/g, (match, type, index) => {
        const mathItem = mathBlocks[parseInt(index, 10)];
        if (!mathItem) return match;
        return type === 'BLOCK' ? `$$${mathItem.text}$$` : `$${mathItem.text}$`;
    });

    return html;
}



