import { GoogleGenerativeAI } from '@google/generative-ai';
import { callWithRetry, checkAndResetModelFallback, sanitizeChatHistory, compressImageFile } from './utils.js';

function compressPDFWithWorker(file) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('../js/pdf-worker.js');
        worker.onmessage = (e) => {
            if (e.data.success) resolve(e.data.blob);
            else reject(new Error(e.data.error));
            worker.terminate();
        };
        worker.onerror = (err) => {
            reject(err);
            worker.terminate();
        };
        worker.postMessage({ file, fileName: file.name });
    });
}

// --- DOM ELEMENTS ---
const dashboardView = document.getElementById('dashboard-view');
const editorView = document.getElementById('editor-view');
const globalError = document.getElementById('global-error');

// Mode Selection Cards (Netflix Style)
const cardMode11 = document.getElementById('card-mode-1-1');
const cardMode12 = document.getElementById('card-mode-1-2');
const cardMode21 = document.getElementById('card-mode-2-1');
const cardMode22 = document.getElementById('card-mode-2-2');

// Quick API Key Modal & Button
const openApiKeyModalBtn = document.getElementById('open-api-key-modal-btn');
const quickApiModal = document.getElementById('quick-api-modal');
const quickApiInput = document.getElementById('quick-api-input');
const saveQuickApiBtn = document.getElementById('save-quick-api-btn');
const closeQuickApiBtn = document.getElementById('close-quick-api-btn');
const clearQuickApiBtn = document.getElementById('clear-quick-api-btn');
const dashboardKeyStatus = document.getElementById('dashboard-key-status');

// Modal 1.2 Elements (Convert Doc)
const modal12 = document.getElementById('modal-1-2');
const closeModal12Btn = document.getElementById('close-modal-1-2-btn');
const cancelModal12Btn = document.getElementById('cancel-modal-1-2-btn');
const submitModal12Btn = document.getElementById('submit-modal-1-2-btn');
const modal12File = document.getElementById('modal-1-2-file');
const modal12FileName = document.getElementById('modal-1-2-file-name');
const modal12Error = document.getElementById('modal-1-2-error');

// Modal 2.1 Elements (AI Materials)
const modal21 = document.getElementById('modal-2-1');
const closeModal21Btn = document.getElementById('close-modal-2-1-btn');
const cancelModal21Btn = document.getElementById('cancel-modal-2-1-btn');
const submitModal21Btn = document.getElementById('submit-modal-2-1-btn');
const modal21ApiKey = document.getElementById('modal-2-1-api-key');
const modal21Files = document.getElementById('modal-2-1-files');
const modal21FilesText = document.getElementById('modal-2-1-files-text');
const modal21FilesCount = document.getElementById('modal-2-1-files-count');
const modal21IconsContainer = document.getElementById('modal-2-1-icons-container');
const modal21Prompt = document.getElementById('modal-2-1-prompt');
const modal21Error = document.getElementById('modal-2-1-error');
const modal21LoadingMsg = document.getElementById('modal-2-1-loading-msg');
const modal21Spinner = document.getElementById('modal-2-1-spinner');

// Modal 2.2 Elements (AI Enhance Doc)
const modal22 = document.getElementById('modal-2-2');
const closeModal22Btn = document.getElementById('close-modal-2-2-btn');
const cancelModal22Btn = document.getElementById('cancel-modal-2-2-btn');
const submitModal22Btn = document.getElementById('submit-modal-2-2-btn');
const modal22ApiKey = document.getElementById('modal-2-2-api-key');
const modal22File = document.getElementById('modal-2-2-file');
const modal22FileName = document.getElementById('modal-2-2-file-name');
const modal22Error = document.getElementById('modal-2-2-error');
const modal22LoadingMsg = document.getElementById('modal-2-2-loading-msg');
const modal22Spinner = document.getElementById('modal-2-2-spinner');

// Instructions Modal
const instructionsModal = document.getElementById('instructions-modal');
const closeInstructionsBtn = document.getElementById('close-instructions-btn');
const instructionsReadyBtn = document.getElementById('instructions-ready-btn');

// Gemini Down Modal
const geminiDownModal = document.getElementById('gemini-down-modal');
const useTraditionalTxtBtn = document.getElementById('use-traditional-txt-btn');
const retryGeminiBtn = document.getElementById('retry-gemini-btn');
const closeGeminiDownModalBtn = document.getElementById('close-gemini-down-modal-btn');

// Editor Sidebar Tabs & Panels
const tabCreatorBtn = document.getElementById('tab-creator-btn');
const tabAiChatBtn = document.getElementById('tab-ai-chat-btn');
const cardCreatorPanel = document.getElementById('card-creator-panel');
const aiEditorChatPanel = document.getElementById('ai-editor-chat-panel');

// Card Creator UI Elements
const creatorCardType = document.getElementById('creator-card-type');
const creatorTypeHint = document.getElementById('creator-type-hint');
const creatorQuestionLabel = document.getElementById('creator-question-label');
const creatorQuestion = document.getElementById('creator-question');
const creatorQImgFile = document.getElementById('creator-q-img-file');
const creatorQImgPreviewContainer = document.getElementById('creator-q-img-preview-container');
const creatorQImgPreview = document.getElementById('creator-q-img-preview');
const creatorRemoveQImg = document.getElementById('creator-remove-q-img');

const creatorGroupOpen = document.getElementById('creator-group-open');
const creatorAnsOpen = document.getElementById('creator-ans-open');

const creatorGroupOpenDouble = document.getElementById('creator-group-open-double');
const creatorAnsDouble1 = document.getElementById('creator-ans-double-1');
const creatorAnsDouble2 = document.getElementById('creator-ans-double-2');

const creatorGroupAnki = document.getElementById('creator-group-anki');
const creatorAnsAnki = document.getElementById('creator-ans-anki');
const creatorAnsImgFile = document.getElementById('creator-ans-img-file');
const creatorAnsImgPreviewContainer = document.getElementById('creator-ans-img-preview-container');
const creatorAnsImgPreview = document.getElementById('creator-ans-img-preview');
const creatorRemoveAnsImg = document.getElementById('creator-remove-ans-img');

const creatorGroupMc = document.getElementById('creator-group-mc');
const creatorMcOptionsList = document.getElementById('creator-mc-options-list');
const creatorAddMcOptBtn = document.getElementById('creator-add-mc-opt-btn');

const creatorFeedback = document.getElementById('creator-feedback');
const creatorSubmitCardBtn = document.getElementById('creator-submit-card-btn');

// AI Chat Elements
const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatSpinner = document.getElementById('chat-spinner');

// Deck Preview (Right Column)
const cardsList = document.getElementById('cards-list');
const deckSizeBadge = document.getElementById('deck-size-badge');
const deckTitleDisplay = document.getElementById('deck-title-display');
const downloadDeckBtn = document.getElementById('download-deck-btn');
const playDeckBtn = document.getElementById('play-deck-btn');
const addCardBtn = document.getElementById('add-card-btn');

// Inline Edit Modal
const inlineEditModal = document.getElementById('inline-edit-modal');
const closeInlineEditBtn = document.getElementById('close-inline-edit-btn');
const cancelInlineEditBtn = document.getElementById('cancel-inline-edit-btn');
const saveInlineEditBtn = document.getElementById('save-inline-edit-btn');
const editCardIndex = document.getElementById('edit-card-index');
const editCardType = document.getElementById('edit-card-type');
const editCardDesc = document.getElementById('edit-card-desc');
const editCardAns1 = document.getElementById('edit-card-ans1');
const editCardAns1Group = document.getElementById('edit-card-ans1-group');
const editCardAns1Label = document.getElementById('edit-card-ans1-label');
const editCardAns2Group = document.getElementById('edit-card-ans2-group');
const editCardAns2 = document.getElementById('edit-card-ans2');
const editCardAnkiGroup = document.getElementById('edit-card-anki-group');
const editCardAnkiAnswer = document.getElementById('edit-card-anki-answer');
const editCardMcGroup = document.getElementById('edit-card-mc-group');
const editCardMcList = document.getElementById('edit-card-mc-list');
const editCardAddMcOptBtn = document.getElementById('edit-card-add-mc-opt-btn');

const inlineEditImagePreviewContainer = document.getElementById('inline-edit-image-preview-container');
const inlineEditImagePreview = document.getElementById('inline-edit-image-preview');
const inlineEditRemoveImageBtn = document.getElementById('inline-edit-remove-image-btn');
const inlineEditImageFile = document.getElementById('inline-edit-image-file');

const inlineEditAnsImageGroup = document.getElementById('inline-edit-ans-image-group');
const inlineEditAnsImagePreviewContainer = document.getElementById('inline-edit-ans-image-preview-container');
const inlineEditAnsImagePreview = document.getElementById('inline-edit-ans-image-preview');
const inlineEditRemoveAnsImageBtn = document.getElementById('inline-edit-remove-ans-image-btn');
const inlineEditAnsImageFile = document.getElementById('inline-edit-ans-image-file');

// --- STATE ---
let deckCards = [];
let geminiChatSession = null;
let currentGenModel = null;
let currentEditorModel = localStorage.getItem('model_fallback_active') === 'true' ? "gemini-flash-lite-latest" : "gemini-flash-latest";

let pendingCreatorQImage = '';
let pendingCreatorAnsImage = '';
let pendingInlineEditQImage = '';
let pendingInlineEditAnsImage = '';

let lastFailedSourceType = null;
let lastFailedLocalCards = null;

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const FILES_DEFAULT_SVG = '<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>';

const systemInstruction = "Sua função é gerenciar um baralho de flashcards para um estudante universitário. Você pode adicionar, editar ou remover cards usando as ferramentas fornecidas. Tipos suportados: 'open' (conceito aberto), 'open_double' (dupla resposta), 'multiple_choice' (múltipla escolha com 2 a 6 opções), e 'anki' (conceito/pergunta e explicação detalhada para repetição espaçada). Mantenha o tom profissional, analítico e pragmático.";

// Gemini Tools Definitions for Agentic Editing
const deckTools = [
    {
        functionDeclarations: [
            {
                name: "adicionar_card",
                description: "Adiciona um novo flashcard ao baralho.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        type: { type: "STRING", enum: ["open", "open_double", "multiple_choice", "anki"], description: "Tipo do card" },
                        description: { type: "STRING", description: "Pergunta ou conceito" },
                        answer: { type: "STRING", description: "Resposta principal ou explicação detalhada" },
                        answer2: { type: "STRING", description: "Resposta secundária (apenas para open_double)" },
                        options: { type: "ARRAY", items: { type: "STRING" }, description: "Opções (apenas para multiple_choice)" },
                        image: { type: "STRING", description: "URL ou Base64 da imagem da pergunta (opcional)" },
                        answerImage: { type: "STRING", description: "URL ou Base64 da imagem da resposta (opcional)" }
                    },
                    required: ["type", "description", "answer"]
                }
            },
            {
                name: "editar_card",
                description: "Edita um flashcard existente pelo índice.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        index: { type: "NUMBER", description: "O índice (começando em 0) do card a ser editado." },
                        type: { type: "STRING", enum: ["open", "open_double", "multiple_choice", "anki"] },
                        description: { type: "STRING" },
                        answer: { type: "STRING" },
                        answer2: { type: "STRING" },
                        options: { type: "ARRAY", items: { type: "STRING" } },
                        image: { type: "STRING" },
                        answerImage: { type: "STRING" }
                    },
                    required: ["index"]
                }
            },
            {
                name: "remover_card",
                description: "Remove um único flashcard permanentemente do baralho.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        index: { type: "NUMBER", description: "Índice do card a ser removido." }
                    },
                    required: ["index"]
                }
            },
            {
                name: "remover_cards_por_indice",
                description: "Remove múltiplos flashcards de uma vez usando uma lista de índices.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        indices: {
                            type: "ARRAY",
                            items: { type: "NUMBER" },
                            description: "Lista de índices dos cards a serem removidos."
                        }
                    },
                    required: ["indices"]
                }
            },
            {
                name: "adicionar_varios_cards",
                description: "Adiciona múltiplos cards de uma vez.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        cards: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    type: { type: "STRING", enum: ["open", "open_double", "multiple_choice", "anki"] },
                                    description: { type: "STRING" },
                                    answer: { type: "STRING" },
                                    answer2: { type: "STRING" },
                                    options: { type: "ARRAY", items: { type: "STRING" } },
                                    image: { type: "STRING" },
                                    answerImage: { type: "STRING" }
                                },
                                required: ["type", "description", "answer"]
                            }
                        }
                    },
                    required: ["cards"]
                }
            }
        ]
    }
];

// Local implementations for Gemini to call
const toolFunctions = {
    adicionar_card: (args) => {
        deckCards.push(args);
        renderCardsList(true);
        return { success: true, message: "Card adicionado com sucesso." };
    },
    editar_card: (args) => {
        const { index, ...updates } = args;
        if (deckCards[index]) {
            deckCards[index] = { ...deckCards[index], ...updates };
            renderCardsList(true);
            return { success: true, message: `Card no índice ${index} foi editado.` };
        }
        return { success: false, message: `Erro: Card no índice ${index} não encontrado.` };
    },
    remover_card: (args) => {
        const { index } = args;
        if (deckCards[index]) {
            const removed = deckCards.splice(index, 1);
            renderCardsList(true);
            return { success: true, message: `Card "${removed[0].description.substring(0, 20)}..." removido.` };
        }
        return { success: false, message: `Erro: Card no índice ${index} não encontrado.` };
    },
    remover_cards_por_indice: (args) => {
        const { indices } = args;
        const sortedIndices = [...new Set(indices)].sort((a, b) => b - a);
        let count = 0;
        sortedIndices.forEach(idx => {
            if (deckCards[idx]) {
                deckCards.splice(idx, 1);
                count++;
            }
        });
        renderCardsList(true);
        return { success: true, message: `${count} cards foram removidos com sucesso.` };
    },
    adicionar_varios_cards: (args) => {
        deckCards.push(...args.cards);
        renderCardsList(true);
        return { success: true, message: `${args.cards.length} cards adicionados ao deck.` };
    }
};

// --- HELPER FUNCTIONS ---
function getApiKey() {
    return sessionStorage.getItem('gemini_api_key') || '';
}

function setApiKey(key) {
    if (key) {
        sessionStorage.setItem('gemini_api_key', key);
    } else {
        sessionStorage.removeItem('gemini_api_key');
    }
    updateApiKeyStatusUI();
}

function updateApiKeyStatusUI() {
    const key = getApiKey();
    if (dashboardKeyStatus) {
        dashboardKeyStatus.textContent = key ? "API Key Configurada ✓" : "Configurar API Key";
        if (key) {
            dashboardKeyStatus.classList.add("text-green-600", "dark:text-green-400");
        } else {
            dashboardKeyStatus.classList.remove("text-green-600", "dark:text-green-400");
        }
    }
    if (quickApiInput) quickApiInput.value = key;
    if (modal21ApiKey) modal21ApiKey.value = key;
    if (modal22ApiKey) modal22ApiKey.value = key;
}

function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
}

function renderFileIcons(files, container, defaultSvg) {
    container.innerHTML = '';
    if (files.length === 0) {
        container.innerHTML = defaultSvg;
        return;
    }

    Array.from(files).forEach(file => {
        const ext = getFileExtension(file.name) || '???';
        const icon = document.createElement('div');
        icon.className = 'squircle';
        icon.textContent = ext.substring(0, 4);
        icon.title = file.name;
        container.appendChild(icon);
    });
}

// Normalizes and validates card properties across all supported modes and aliases
function normalizeCard(raw) {
    if (!raw || typeof raw !== 'object') return null;

    let type = raw.type ? String(raw.type).toLowerCase().replace(/[-\s]/g, '_') : '';
    if (type === 'multiple_choice' || type === 'multipla_escolha' || type === 'mc') {
        type = 'multiple_choice';
    } else if (type === 'open_double' || type === 'duplo' || type === 'double') {
        type = 'open_double';
    } else if (type === 'anki' || type === 'anki_like') {
        type = 'anki';
    } else if (type === 'open' || type === 'open_ended' || type === 'traditional' || type === 'aberto') {
        type = 'open';
    } else {
        if (Array.isArray(raw.options) && raw.options.length >= 2) type = 'multiple_choice';
        else if (raw.answer2) type = 'open_double';
        else type = 'open';
    }

    const description = (raw.description || raw.question || raw.pergunta || raw.frente || '').trim();
    if (!description) return null;

    let answer = (raw.answer || raw.resposta || raw.verso || '').trim();
    let answer2 = (raw.answer2 || raw.resposta2 || '').trim();
    let options = Array.isArray(raw.options) ? raw.options.map(o => String(o).trim()).filter(Boolean) : (Array.isArray(raw.alternativas) ? raw.alternativas.map(o => String(o).trim()).filter(Boolean) : []);

    if (type === 'multiple_choice') {
        if (options.length < 2) return null;
        if (!answer) answer = options[0];
        else if (!options.includes(answer)) options.unshift(answer);
    } else if (type === 'open_double') {
        if (!answer && !answer2) return null;
    } else {
        if (!answer && !raw.image && !raw.answerImage) return null;
    }

    const card = {
        type,
        description,
        answer
    };
    if (type === 'open_double') {
        card.answer2 = answer2;
        card.placeholder1 = raw.placeholder1 || "Resposta 1";
        card.placeholder2 = raw.placeholder2 || "Resposta 2";
    }
    if (type === 'multiple_choice') {
        card.options = options;
    }
    if (raw.explanation) card.explanation = raw.explanation;
    if (raw.image) card.image = raw.image;
    if (raw.answerImage) card.answerImage = raw.answerImage;
    if (Array.isArray(raw.tags)) card.tags = raw.tags;

    return card;
}

// Scans text for complete balanced JSON objects, respecting string quoting and escapes
function extractBalancedJsonObjects(text) {
    const results = [];
    if (!text) return results;

    let scanText = text;
    const wrapperMatch = text.match(/["'](?:cards|flashcards|questoes|perguntas|deck|items)["']\s*:\s*\[/i);
    if (wrapperMatch) {
        const arrStart = wrapperMatch.index + wrapperMatch[0].length;
        scanText = text.substring(arrStart);
    }

    let depth = 0;
    let inString = false;
    let escape = false;
    let start = -1;

    for (let i = 0; i < scanText.length; i++) {
        const c = scanText[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (c === '\\' && inString) {
            escape = true;
            continue;
        }
        if (c === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (c === '{') {
                if (depth === 0) {
                    start = i;
                }
                depth++;
            } else if (c === '}') {
                depth--;
                if (depth === 0 && start !== -1) {
                    const block = scanText.substring(start, i + 1);
                    try {
                        const parsed = JSON.parse(block);
                        if (parsed && typeof parsed === 'object') {
                            const arr = parsed.cards || parsed.flashcards || parsed.questoes || parsed.perguntas;
                            if (Array.isArray(arr)) {
                                for (const item of arr) {
                                    const n = normalizeCard(item);
                                    if (n) results.push(n);
                                }
                            } else {
                                const n = normalizeCard(parsed);
                                if (n) results.push(n);
                            }
                        }
                    } catch (_) {}
                    start = -1;
                } else if (depth < 0) {
                    depth = 0;
                    start = -1;
                }
            }
        }
    }
    return results;
}

// Safe multi-stage JSON parser with truncation repair that never throws unhandled syntax errors
function parseJsonCardsSafely(fullText) {
    if (!fullText || !fullText.trim()) return [];

    let clean = fullText.trim();
    // Strip markdown code fences
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // Strategy 1: Direct JSON parse
    try {
        const direct = JSON.parse(clean);
        if (Array.isArray(direct)) {
            const cards = direct.map(normalizeCard).filter(Boolean);
            if (cards.length > 0) return cards;
        }
        if (direct && typeof direct === 'object') {
            const arr = direct.cards || direct.flashcards || direct.questoes || direct.perguntas || direct.items;
            if (Array.isArray(arr)) {
                const cards = arr.map(normalizeCard).filter(Boolean);
                if (cards.length > 0) return cards;
            }
            const single = normalizeCard(direct);
            if (single) return [single];
        }
    } catch (_) {}

    // Strategy 2: Array substring parse
    const firstBracket = clean.indexOf('[');
    if (firstBracket !== -1) {
        const sub = clean.substring(firstBracket);
        const lastBracket = sub.lastIndexOf(']');
        if (lastBracket !== -1) {
            try {
                const arr = JSON.parse(sub.substring(0, lastBracket + 1));
                if (Array.isArray(arr)) {
                    const cards = arr.map(normalizeCard).filter(Boolean);
                    if (cards.length > 0) return cards;
                }
            } catch (_) {}
        }
        // Strategy 3: Truncation recovery - find last complete '}' and close with ']'
        const lastBrace = sub.lastIndexOf('}');
        if (lastBrace !== -1) {
            try {
                const repaired = sub.substring(0, lastBrace + 1) + ']';
                const arr = JSON.parse(repaired);
                if (Array.isArray(arr)) {
                    const cards = arr.map(normalizeCard).filter(Boolean);
                    if (cards.length > 0) return cards;
                }
            } catch (_) {}
        }
    }

    // Strategy 4: Balanced objects extraction
    const extracted = extractBalancedJsonObjects(clean);
    if (extracted.length > 0) return extracted;

    return [];
}

function updateGeneratingStatus(message) {
    const statusText = document.getElementById('generation-status-text');
    if (statusText) statusText.textContent = message;
}

function addAiChatGeneratingBubble(text) {
    removeAiChatGeneratingBubble();
    const bubble = document.createElement('div');
    bubble.id = 'ai-chat-generating-bubble';
    bubble.className = "self-start bg-gradient-to-b from-purple-50/90 to-purple-100/60 dark:from-purple-950/50 dark:to-purple-900/40 border border-purple-200/80 dark:border-purple-800/60 p-3.5 rounded-2xl rounded-tl-sm text-xs text-purple-900 dark:text-purple-200 flex items-center gap-3 shadow-[0_2px_8px_rgba(109,40,217,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
    bubble.innerHTML = `
        <div class="relative flex-shrink-0 w-2.5 h-2.5 flex items-center justify-center">
            <span class="relative inline-flex rounded-full h-2 w-2 bg-purple-600 dark:bg-purple-400 animate-pulse shadow-[0_0_6px_rgba(147,51,234,0.5)]"></span>
        </div>
        <span class="font-medium">${text}</span>
    `;
    chatHistory.appendChild(bubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function removeAiChatGeneratingBubble() {
    const bubble = document.getElementById('ai-chat-generating-bubble');
    if (bubble) bubble.remove();
}

function showChatTypingIndicator() {
    hideChatTypingIndicator();
    const indicator = document.createElement('div');
    indicator.id = 'chat-typing-indicator';
    indicator.className = 'typing-indicator my-1';
    indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    chatHistory.appendChild(indicator);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function hideChatTypingIndicator() {
    const indicator = document.getElementById('chat-typing-indicator');
    if (indicator) indicator.remove();
}

async function fileToGenerativePart(file) {
    const base64EncodedDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });
    const ext = getFileExtension(file.name);
    let mime = file.type;
    if (!mime || mime === 'application/octet-stream') {
        const mimeMap = {
            'pdf': 'application/pdf',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'webp': 'image/webp',
            'gif': 'image/gif',
            'txt': 'text/plain'
        };
        mime = mimeMap[ext] || mime || 'application/octet-stream';
    }
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: mime },
    };
}

async function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

// Robust text extractor supporting .txt, .docx (with mammoth), and .doc
async function extractTextFromFile(file) {
    const ext = getFileExtension(file.name);
    if (ext === 'txt') {
        return await readTextFile(file);
    } else if (ext === 'docx') {
        if (typeof mammoth !== 'undefined') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value || '';
        } else {
            throw new Error("Biblioteca Mammoth não disponível para ler arquivo .docx.");
        }
    } else if (ext === 'doc') {
        try {
            if (typeof mammoth !== 'undefined') {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                if (result.value && result.value.trim().length > 0) return result.value;
            }
        } catch (e) {
            // Mammoth is for docx, doc may throw
        }
        // Binary .doc fallback: string extraction
        const arrayBuffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const raw = decoder.decode(arrayBuffer);
        const matches = raw.match(/[\x20-\x7E\xC0-\xFF\n\r]{4,}/g);
        return matches ? matches.join('\n') : raw;
    } else {
        return await readTextFile(file);
    }
}

// PPTX text extractor using JSZip
async function extractTextFromPPTX(file) {
    if (typeof JSZip !== 'undefined') {
        try {
            const zip = await JSZip.loadAsync(file);
            const slideTexts = [];
            const slidePaths = Object.keys(zip.files)
                .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
                .sort((a, b) => {
                    const numA = parseInt((a.match(/\d+/) || [0])[0]);
                    const numB = parseInt((b.match(/\d+/) || [0])[0]);
                    return numA - numB;
                });

            for (const path of slidePaths) {
                const xml = await zip.files[path].async('text');
                const matches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/g);
                if (matches) {
                    const slideStr = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
                    if (slideStr.trim()) slideTexts.push(slideStr.trim());
                }
            }
            if (slideTexts.length > 0) {
                return `Conteúdo do slide (${file.name}):\n` + slideTexts.join('\n---\n');
            }
        } catch (e) {
            console.warn("Erro ao extrair slides PPTX:", e);
        }
    }
    return null;
}

// --- DOCUMENT PARSING (TRADITIONAL & ANKI) ---
function convertDocumentToCards(text, mode = 'anki') {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const cards = [];

    for (let line of lines) {
        if (mode === 'anki') {
            // In Anki-like: line is Pergunta/Frente : Resposta/Verso
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                const question = line.substring(0, colonIndex).trim();
                const answer = line.substring(colonIndex + 1).trim();
                if (question && answer) {
                    cards.push({
                        type: 'anki',
                        description: question,
                        answer: answer
                    });
                }
            }
        } else {
            // Traditional mode: use old format & tags without AI
            if (line.startsWith('(open_double)')) {
                const content = line.replace('(open_double)', '').trim();
                const colonIndex = content.indexOf(':');
                if (colonIndex !== -1) {
                    const answersPart = content.substring(0, colonIndex).trim();
                    const description = content.substring(colonIndex + 1).trim();
                    const [ans1, ans2] = answersPart.split(';');
                    cards.push({
                        type: "open_double",
                        description: description,
                        answer: ans1 ? ans1.trim() : "",
                        answer2: ans2 ? ans2.trim() : "",
                        placeholder1: "Resposta 1",
                        placeholder2: "Resposta 2"
                    });
                }
            } else if (line.startsWith('(multiple_choice)')) {
                const content = line.replace('(multiple_choice)', '').trim();
                const colonIndex = content.indexOf(':');
                if (colonIndex !== -1) {
                    const answer = content.substring(0, colonIndex).trim();
                    const description = content.substring(colonIndex + 1).trim();
                    cards.push({
                        type: "multiple_choice",
                        description: description,
                        answer: answer,
                        options: ["Opção 1", "Opção 2", answer, "Opção 4"]
                    });
                }
            } else {
                // Front : Back (or Answer : Question)
                const colonIndex = line.indexOf(':');
                if (colonIndex !== -1) {
                    const question = line.substring(0, colonIndex).trim();
                    const answer = line.substring(colonIndex + 1).trim();
                    if (question && answer) {
                        cards.push({
                            type: "open",
                            description: question,
                            answer: answer
                        });
                    }
                }
            }
        }
    }
    return cards;
}

function parseTxtToJSONWithPlaceholders(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    const cards = [];

    for (let line of lines) {
        line = line.trim();
        let card = null;

        if (line.startsWith('(open_double)')) {
            const content = line.replace('(open_double)', '').trim();
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const answersPart = content.substring(0, colonIndex).trim();
                const description = content.substring(colonIndex + 1).trim();
                const [ans1, ans2] = answersPart.split(';');
                card = {
                    type: "open_double",
                    description: description,
                    answer: ans1 ? ans1.trim() : "",
                    answer2: ans2 ? ans2.trim() : "",
                    placeholder1: "[GEMINI]",
                    placeholder2: "[GEMINI]"
                };
            }
        } else if (line.startsWith('(multiple_choice)')) {
            const content = line.replace('(multiple_choice)', '').trim();
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const answer = content.substring(0, colonIndex).trim();
                const description = content.substring(colonIndex + 1).trim();
                card = {
                    type: "multiple_choice",
                    description: description,
                    answer: answer,
                    options: ["[GEMINI]", "[GEMINI]", answer, "[GEMINI]"]
                };
            }
        } else {
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                const answer = line.substring(0, colonIndex).trim();
                const description = line.substring(colonIndex + 1).trim();
                card = {
                    type: "open",
                    description: description,
                    answer: answer
                };
            }
        }

        if (card) cards.push(card);
    }
    return cards;
}

// Transition from Dashboard to Editor
function openEditorView(initialTab = 'creator') {
    dashboardView.classList.add('hidden');
    editorView.classList.remove('hidden');
    editorView.classList.add('flex');

    if (initialTab === 'creator') {
        switchSidebarTab('creator');
    } else {
        switchSidebarTab('ai');
    }

    renderCardsList(true);
}

function switchSidebarTab(tab) {
    if (tab === 'creator') {
        tabCreatorBtn.className = "flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition bg-blue-600 text-white shadow-sm";
        tabAiChatBtn.className = "flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700";
        cardCreatorPanel.classList.remove('hidden');
        aiEditorChatPanel.classList.add('hidden');
    } else {
        tabAiChatBtn.className = "flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition bg-purple-600 text-white shadow-sm";
        tabCreatorBtn.className = "flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700";
        cardCreatorPanel.classList.add('hidden');
        aiEditorChatPanel.classList.remove('hidden');
    }
}

tabCreatorBtn.addEventListener('click', () => switchSidebarTab('creator'));
tabAiChatBtn.addEventListener('click', () => switchSidebarTab('ai'));

// --- DASHBOARD CARD HANDLERS ---

// 1.1 Crie agora — Escreva cada cartão direto no aplicativo
cardMode11.addEventListener('click', () => {
    deckCards = [];
    deckTitleDisplay.value = "Novo Baralho";
    openEditorView('creator');
});

// 1.2 Converta um doc — Importe um txt ou word já feito
cardMode12.addEventListener('click', () => {
    modal12Error.textContent = '';
    modal12File.value = '';
    modal12FileName.textContent = 'Clique ou arraste o arquivo aqui';
    modal12.classList.remove('hidden');
});

closeModal12Btn.addEventListener('click', () => modal12.classList.add('hidden'));
cancelModal12Btn.addEventListener('click', () => modal12.classList.add('hidden'));

modal12File.addEventListener('change', () => {
    if (modal12File.files.length > 0) {
        modal12FileName.textContent = modal12File.files[0].name;
    }
});

submitModal12Btn.addEventListener('click', async () => {
    modal12Error.textContent = '';
    if (!modal12File.files || modal12File.files.length === 0) {
        modal12Error.textContent = 'Por favor, selecione um arquivo (.txt, .doc ou .docx).';
        return;
    }

    const file = modal12File.files[0];
    const selectedMode = document.querySelector('input[name="modal-1-2-type"]:checked')?.value || 'anki';

    try {
        const text = await extractTextFromFile(file);
        const cards = convertDocumentToCards(text, selectedMode);

        if (cards.length === 0) {
            modal12Error.textContent = 'Nenhum flashcard válido encontrado no arquivo. Certifique-se de usar ":" para separar pergunta e resposta.';
            return;
        }

        deckCards = cards;
        deckTitleDisplay.value = file.name.replace(/\.[^/.]+$/, "");
        modal12.classList.add('hidden');
        openEditorView('creator');
    } catch (err) {
        modal12Error.textContent = `Erro ao ler o documento: ${err.message}`;
    }
});

// 2.1 Crie de materiais — Transforme slides, pdf, fotos... em cards
cardMode21.addEventListener('click', () => {
    modal21Error.textContent = '';
    modal21ApiKey.value = getApiKey();
    modal21Files.value = '';
    modal21FilesCount.textContent = 'Nenhum arquivo selecionado';
    modal21FilesText.classList.remove('hidden');
    renderFileIcons([], modal21IconsContainer, FILES_DEFAULT_SVG);
    modal21.classList.remove('hidden');
});

closeModal21Btn.addEventListener('click', () => modal21.classList.add('hidden'));
cancelModal21Btn.addEventListener('click', () => modal21.classList.add('hidden'));

modal21Files.addEventListener('change', () => {
    modal21Error.textContent = '';
    const files = Array.from(modal21Files.files);

    if (files.length > 10) {
        modal21Error.textContent = 'Limite excedido: você pode enviar no máximo 10 arquivos.';
        modal21Files.value = '';
        modal21FilesCount.textContent = 'Nenhum arquivo selecionado';
        renderFileIcons([], modal21IconsContainer, FILES_DEFAULT_SVG);
        return;
    }

    for (let f of files) {
        if (f.size > MAX_FILE_SIZE) {
            modal21Error.textContent = `O arquivo "${f.name}" excede 100MB e foi rejeitado.`;
            modal21Files.value = '';
            modal21FilesCount.textContent = 'Nenhum arquivo selecionado';
            renderFileIcons([], modal21IconsContainer, FILES_DEFAULT_SVG);
            return;
        }
    }

    if (files.length > 0) {
        modal21FilesCount.textContent = `${files.length} de 10 arquivo(s) selecionado(s)`;
        modal21FilesText.classList.add('hidden');
    } else {
        modal21FilesCount.textContent = 'Nenhum arquivo selecionado';
        modal21FilesText.classList.remove('hidden');
    }
    renderFileIcons(files, modal21IconsContainer, FILES_DEFAULT_SVG);
});

submitModal21Btn.addEventListener('click', async () => {
    modal21Error.textContent = '';
    const apiKey = modal21ApiKey.value.trim();
    if (!apiKey) {
        modal21Error.textContent = 'Por favor, insira sua Gemini API Key.';
        return;
    }
    setApiKey(apiKey);

    const files = Array.from(modal21Files.files);
    if (files.length === 0) {
        modal21Error.textContent = 'Selecione pelo menos um arquivo.';
        return;
    }
    if (files.length > 10) {
        modal21Error.textContent = 'Você pode enviar no máximo 10 arquivos.';
        return;
    }

    // Immediately close modal and transition to editor view with live animations
    modal21.classList.add('hidden');
    openEditorView('ai');

    deckCards = [];
    deckTitleDisplay.value = files[0].name.replace(/\.[^/.]+$/, "");

    showGeneratingAnimation("Processando materiais enviados...");
    addAiChatGeneratingBubble("O Gemini está analisando seus materiais para gerar os flashcards com nível universitário. Acompanhe a formulação ao vivo!");

    submitModal21Btn.disabled = true;
    modal21Spinner.classList.remove('hidden');
    modal21LoadingMsg.classList.remove('hidden');

    try {
        const basePrompt = `Com base nos arquivos enviados, processe todo o conteúdo e gere flashcards técnicos para estudo aprofundado (conceitos, definições, fórmulas, mecanismos, etapas e estruturas). Nível de detalhe universitário.
PROIBIDO incluir texto explicativo fora do array JSON.
Retorne EXCLUSIVAMENTE um array JSON ([]) contendo os objetos de flashcards.
Formatos permitidos:
1. open: {"type": "open", "description": "Pergunta ou descrição de conceito/medicamento/teste/mecanismo...", "answer": "Resposta objetiva, nome do conceito/medicamento/teste/mecanismo. Deve conter o mínimo de palavras possível, idealmente 1 só"}
2. open_double: {"type": "open_double", "description": "Pergunta comparativa/dupla", "answer": "Primeira resposta", "answer2": "Segunda resposta", "placeholder1": "Rótulo 1", "placeholder2": "Rótulo 2"}
3. multiple_choice: {"type": "multiple_choice", "description": "Enunciado da questão", "answer": "Alternativa correta", "options": ["Alt 1", "Alt 2", "Alternativa correta", "Alt 4"]}
4. anki: {"type": "anki", "description": "Conceito a ser lembrado", "answer": "Explicação completa e detalhada para repetição espaçada"}

Gere aproximadamente 100 flashcards completos e aprofundados cobrindo todo o material enviado.`;

        let promptToSend = basePrompt;
        const customText = modal21Prompt.value.trim();
        if (customText) {
            promptToSend += `\n\nDemandas adicionais do usuário:\n${customText}`;
        }

        const parts = [promptToSend];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            updateGeneratingStatus(`Processando arquivo ${i + 1} de ${files.length}: ${file.name}...`);
            const ext = getFileExtension(file.name);
            if (ext === 'pptx') {
                const pptxText = await extractTextFromPPTX(file);
                if (pptxText) {
                    parts.push(pptxText);
                    continue;
                }
            } else if (ext === 'docx' || ext === 'doc' || ext === 'txt') {
                try {
                    const text = await extractTextFromFile(file);
                    if (text) {
                        parts.push(text);
                        continue;
                    }
                } catch (e) {
                    console.warn("Falha ao extrair texto de " + file.name + ":", e);
                }
            } else if (file.type === 'application/pdf' && file.size > 5 * 1024 * 1024) {
                try {
                    const compressed = await compressPDFWithWorker(file);
                    const compFile = new File([compressed], file.name, { type: 'application/pdf' });
                    const part = await fileToGenerativePart(compFile);
                    parts.push(part);
                    continue;
                } catch (e) {
                    console.warn("Falha ao comprimir PDF:", e);
                }
            }
            const part = await fileToGenerativePart(file);
            parts.push(part);
        }

        updateGeneratingStatus("Conectando ao Gemini e gerando os cartões...");

        const genAI = new GoogleGenerativeAI(apiKey);
        const genModel = genAI.getGenerativeModel({
            model: currentEditorModel || "gemini-flash-latest",
            generationConfig: {
                temperature: 0.7,
                responseMimeType: "application/json",
                maxOutputTokens: 8192
            }
        });

        const result = await callWithRetry(() => genModel.generateContentStream(parts));
        let fullText = "";
        const seenSignatures = new Set();

        for await (const chunk of result.stream) {
            let chunkText = "";
            try {
                chunkText = chunk.text();
            } catch (e) {
                if (chunk.candidates?.[0]?.content?.parts) {
                    for (const part of chunk.candidates[0].content.parts) {
                        if (part.text && !part.thought) chunkText += part.text;
                    }
                }
            }
            if (!chunkText && chunk.candidates?.[0]?.content?.parts) {
                for (const part of chunk.candidates[0].content.parts) {
                    if (part.text && !part.thought) chunkText += part.text;
                }
            }

            fullText += chunkText;

            // Extract balanced JSON objects in real-time as stream arrives
            const streamObjects = extractBalancedJsonObjects(fullText);
            for (const rawObj of streamObjects) {
                const card = normalizeCard(rawObj);
                if (card) {
                    const sig = `${card.type}::${card.description}::${card.answer}`;
                    if (!seenSignatures.has(sig)) {
                        seenSignatures.add(sig);
                        deckCards.push(card);
                        updateGeneratingProgress(deckCards.length);
                        renderCardsList();
                    }
                }
            }
        }

        // Stream completed. If no cards were extracted or some were missed, run safe fallback parser
        if (deckCards.length === 0 && fullText.trim()) {
            const fallbackCards = parseJsonCardsSafely(fullText);
            for (const card of fallbackCards) {
                const sig = `${card.type}::${card.description}::${card.answer}`;
                if (!seenSignatures.has(sig)) {
                    seenSignatures.add(sig);
                    deckCards.push(card);
                }
            }
            if (deckCards.length > 0) {
                renderCardsList(true);
            }
        }

        if (deckCards.length > 0) {
            finishGeneratingAnimation(true, deckCards.length);
            removeAiChatGeneratingBubble();
            addChatMessage('model', `✓ Baralho gerado com sucesso! Criei ${deckCards.length} flashcards técnicos com base no material enviado. Quer que eu ajuste algo, adicione mais perguntas ou altere alguma alternativa?`);
        } else {
            finishGeneratingAnimation(false, 0);
            removeAiChatGeneratingBubble();
            addChatMessage('model', 'Não foi possível extrair flashcards a partir dos materiais fornecidos. Tente enviar outros arquivos ou descrever o conteúdo.');
            renderCardsList(true);
        }

        // Initialize chat session for subsequent agentic edits in the sidebar
        const chatModel = genAI.getGenerativeModel({
            model: currentEditorModel || "gemini-flash-latest",
            systemInstruction,
            tools: deckTools
        });
        currentGenModel = chatModel;
        geminiChatSession = chatModel.startChat({ history: [] });

    } catch (err) {
        console.error("Erro na geração 2.1:", err);
        finishGeneratingAnimation(false, 0);
        removeAiChatGeneratingBubble();
        addChatMessage('model', `Erro durante a geração: ${err.message}`);
        showGeminiDownModal(err.message, 'files');
    } finally {
        submitModal21Btn.disabled = false;
        modal21Spinner.classList.add('hidden');
        modal21LoadingMsg.classList.add('hidden');
    }
});

// 2.2 Aprimore um doc — A partir de um txt ou word, aprimore cartões
cardMode22.addEventListener('click', () => {
    modal22Error.textContent = '';
    modal22ApiKey.value = getApiKey();
    modal22File.value = '';
    modal22FileName.textContent = 'Clique ou arraste o arquivo .txt ou Word';
    modal22.classList.remove('hidden');
});

closeModal22Btn.addEventListener('click', () => modal22.classList.add('hidden'));
cancelModal22Btn.addEventListener('click', () => modal22.classList.add('hidden'));

modal22File.addEventListener('change', () => {
    if (modal22File.files.length > 0) {
        modal22FileName.textContent = modal22File.files[0].name;
    }
});

submitModal22Btn.addEventListener('click', async () => {
    modal22Error.textContent = '';
    const apiKey = modal22ApiKey.value.trim();
    if (!apiKey) {
        modal22Error.textContent = 'Por favor, insira sua Gemini API Key.';
        return;
    }
    setApiKey(apiKey);

    if (!modal22File.files || modal22File.files.length === 0) {
        modal22Error.textContent = 'Selecione um arquivo .txt ou Word.';
        return;
    }

    submitModal22Btn.disabled = true;
    modal22Spinner.classList.remove('hidden');
    modal22LoadingMsg.classList.remove('hidden');

    const file = modal22File.files[0];
    try {
        const textContent = await extractTextFromFile(file);
        const localCards = parseTxtToJSONWithPlaceholders(textContent);

        modal22.classList.add('hidden');
        openEditorView('ai');

        deckTitleDisplay.value = file.name.replace(/\.[^/.]+$/, "");
        deckCards = localCards;
        renderCardsList(true);

        const hasPlaceholders = JSON.stringify(localCards).includes("[GEMINI]");
        const genAI = new GoogleGenerativeAI(apiKey);

        if (!hasPlaceholders) {
            const model = genAI.getGenerativeModel({ model: currentEditorModel, systemInstruction, tools: deckTools });
            currentGenModel = model;
            geminiChatSession = model.startChat({ history: [] });
            return;
        }

        // Fill placeholders with Gemini
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            generationConfig: { temperature: 0.7, responseMimeType: "text/plain" },
            tools: deckTools,
            systemInstruction: systemInstruction + "\nPreencha os placeholders '[GEMINI]' no JSON de flashcards e retorne-os usando a ferramenta 'adicionar_varios_cards'."
        });

        currentGenModel = model;

        const fillPrompt = `Aqui está uma lista de flashcards que precisam que você preencha os campos '[GEMINI]'.
Para 'open_double', preencha 'placeholder1' e 'placeholder2' com rótulos descritivos curtos para as respostas.
Para 'multiple_choice', complete o array 'options' com alternativas incorretas porém plausíveis (distratores), mantendo a resposta correta informada.
Ao terminar, chame 'adicionar_varios_cards' para enviar o baralho finalizado.

JSON:
${JSON.stringify(localCards, null, 2)}`;

        showGeneratingAnimation("Aprimorando flashcards e preenchendo detalhes com IA...");
        addAiChatGeneratingBubble("O Gemini está aprimorando seus flashcards e preenchendo as opções e rótulos...");
        const chat = model.startChat({ history: [] });
        deckCards = []; // Will be populated via function call
        renderCardsList(true);

        let result = await callWithRetry(() => chat.sendMessage(fillPrompt));
        let response = result.response;

        for (let i = 0; i < 4; i++) {
            const candidate = response.candidates[0];
            const calls = candidate.content.parts.filter(p => !!p.functionCall);
            if (calls.length === 0) break;

            const functionResponses = calls.map(call => {
                const { name, args } = call.functionCall;
                const output = toolFunctions[name] ? toolFunctions[name](args) : { error: "Função não encontrada" };
                return {
                    functionResponse: { name, response: output }
                };
            });

            result = await callWithRetry(() => chat.sendMessage(functionResponses));
            sanitizeChatHistory(chat);
            response = result.response;
        }

        finishGeneratingAnimation(true, deckCards.length);
        removeAiChatGeneratingBubble();
        addChatMessage('model', `✓ Flashcards aprimorados com sucesso! ${deckCards.length} cartões foram enriquecidos com alternativas e detalhes.`);
        geminiChatSession = model.startChat({ history: [] });

    } catch (err) {
        console.error("Erro na aprimoração 2.2:", err);
        finishGeneratingAnimation(false, 0);
        removeAiChatGeneratingBubble();
        addChatMessage('model', `Erro ao aprimorar os cartões: ${err.message}`);
        showGeminiDownModal(err.message, 'txt', localCards);
    } finally {
        submitModal22Btn.disabled = false;
        modal22Spinner.classList.add('hidden');
        modal22LoadingMsg.classList.add('hidden');
    }
});

// Quick API Key Modal Listeners
openApiKeyModalBtn.addEventListener('click', () => {
    quickApiInput.value = getApiKey();
    quickApiModal.classList.remove('hidden');
});
closeQuickApiBtn.addEventListener('click', () => quickApiModal.classList.add('hidden'));
saveQuickApiBtn.addEventListener('click', () => {
    setApiKey(quickApiInput.value.trim());
    quickApiModal.classList.add('hidden');
});
clearQuickApiBtn.addEventListener('click', () => {
    setApiKey('');
    quickApiInput.value = '';
    quickApiModal.classList.add('hidden');
});

// Instructions Modal Listeners
document.querySelectorAll('.open-instructions-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        instructionsModal.classList.remove('hidden');
    });
});
closeInstructionsBtn.addEventListener('click', () => instructionsModal.classList.add('hidden'));
instructionsReadyBtn.addEventListener('click', () => instructionsModal.classList.add('hidden'));

// Gemini Down Modal Listeners
function showGeminiDownModal(errorMsg, sourceType, localCards = null) {
    lastFailedSourceType = sourceType;
    lastFailedLocalCards = localCards;
    if (geminiDownModal) geminiDownModal.classList.remove('hidden');
}
function closeGeminiDownModal() {
    if (geminiDownModal) geminiDownModal.classList.add('hidden');
}
closeGeminiDownModalBtn.addEventListener('click', closeGeminiDownModal);
if (useTraditionalTxtBtn) {
    useTraditionalTxtBtn.addEventListener('click', () => {
        closeGeminiDownModal();
        if (lastFailedLocalCards) {
            deckCards = lastFailedLocalCards.map(c => {
                const copy = { ...c };
                if (copy.type === 'multiple_choice' && Array.isArray(copy.options)) {
                    copy.options = copy.options.map((o, i) => o === '[GEMINI]' ? `Opção ${i + 1}` : o);
                }
                return copy;
            });
            openEditorView('creator');
            renderCardsList(true);
        }
    });
}
if (retryGeminiBtn) {
    retryGeminiBtn.addEventListener('click', () => {
        closeGeminiDownModal();
        if (lastFailedSourceType === 'files') {
            modal21.classList.remove('hidden');
        } else if (lastFailedSourceType === 'txt') {
            modal22.classList.remove('hidden');
        }
    });
}

// Close modals on backdrop click
[modal12, modal21, modal22, quickApiModal, instructionsModal, geminiDownModal, inlineEditModal].forEach(modal => {
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }
});

// --- CARD CREATOR UI LOGIC (LEFT SIDEBAR) ---
const typeHints = {
    open: "Pergunta é uma descrição e você digita o nome do conceito.",
    open_double: "Uma pergunta, você digita duas respostas.",
    anki: "Pergunta é um conceito (curto), ou imagem, e resposta é uma descrição longa, ou imagem. Sem digitação.",
    multiple_choice: "Pergunta é um conceito, você escolhe entre alternativas (2 a 6 opções)."
};

creatorCardType.addEventListener('change', () => {
    const t = creatorCardType.value;
    creatorTypeHint.textContent = typeHints[t] || '';

    // Adjust visibility
    creatorGroupOpen.classList.toggle('hidden', t !== 'open');
    creatorGroupOpenDouble.classList.toggle('hidden', t !== 'open_double');
    creatorGroupAnki.classList.toggle('hidden', t !== 'anki');
    creatorGroupMc.classList.toggle('hidden', t !== 'multiple_choice');

    if (t === 'anki') {
        creatorQuestionLabel.textContent = "Pergunta / Conceito (Curto)";
    } else {
        creatorQuestionLabel.textContent = "Pergunta / Descrição";
    }

    if (t === 'multiple_choice' && creatorMcOptionsList.children.length === 0) {
        renderCreatorMcOptions(["", "", "", ""], 0);
    }
});

// Creator MCQ Options (between 2 and 6 options)
function renderCreatorMcOptions(options = ["", "", "", ""], selectedIdx = 0) {
    creatorMcOptionsList.innerHTML = '';
    options.forEach((optText, i) => {
        const row = document.createElement('div');
        row.className = "flex items-center gap-2";
        row.innerHTML = `
            <input type="radio" name="creator-mc-correct" value="${i}" ${i === selectedIdx ? 'checked' : ''} class="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer" title="Marcar como alternativa correta">
            <input type="text" class="creator-mc-opt-val flex-1 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" placeholder="Opção ${i + 1}" value="${optText}">
            <button type="button" class="creator-mc-remove-opt-btn p-1 text-gray-400 hover:text-red-500 transition" title="Remover alternativa">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;

        const removeBtn = row.querySelector('.creator-mc-remove-opt-btn');
        removeBtn.addEventListener('click', () => {
            const currentVals = Array.from(document.querySelectorAll('.creator-mc-opt-val')).map(inp => inp.value);
            if (currentVals.length <= 2) {
                alert("A questão de múltipla escolha deve ter pelo menos 2 alternativas.");
                return;
            }
            currentVals.splice(i, 1);
            let nextSelected = 0;
            const checkedRadio = document.querySelector('input[name="creator-mc-correct"]:checked');
            if (checkedRadio) {
                const oldCheckedIdx = parseInt(checkedRadio.value);
                if (oldCheckedIdx === i) nextSelected = 0;
                else if (oldCheckedIdx > i) nextSelected = oldCheckedIdx - 1;
                else nextSelected = oldCheckedIdx;
            }
            renderCreatorMcOptions(currentVals, nextSelected);
        });

        creatorMcOptionsList.appendChild(row);
    });

    creatorAddMcOptBtn.classList.toggle('hidden', options.length >= 6);
}

creatorAddMcOptBtn.addEventListener('click', () => {
    const currentVals = Array.from(document.querySelectorAll('.creator-mc-opt-val')).map(inp => inp.value);
    if (currentVals.length >= 6) return;
    const checkedRadio = document.querySelector('input[name="creator-mc-correct"]:checked');
    const checkedIdx = checkedRadio ? parseInt(checkedRadio.value) : 0;
    currentVals.push("");
    renderCreatorMcOptions(currentVals, checkedIdx);
});

// Creator Image Handling
creatorQImgFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        pendingCreatorQImage = await compressImageFile(file);
        creatorQImgPreview.src = pendingCreatorQImage;
        creatorQImgPreviewContainer.classList.remove('hidden');
        creatorRemoveQImg.classList.remove('hidden');
    }
});
creatorRemoveQImg.addEventListener('click', () => {
    pendingCreatorQImage = '';
    creatorQImgFile.value = '';
    creatorQImgPreviewContainer.classList.add('hidden');
    creatorRemoveQImg.classList.add('hidden');
});

creatorAnsImgFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        pendingCreatorAnsImage = await compressImageFile(file);
        creatorAnsImgPreview.src = pendingCreatorAnsImage;
        creatorAnsImgPreviewContainer.classList.remove('hidden');
        creatorRemoveAnsImg.classList.remove('hidden');
    }
});
creatorRemoveAnsImg.addEventListener('click', () => {
    pendingCreatorAnsImage = '';
    creatorAnsImgFile.value = '';
    creatorAnsImgPreviewContainer.classList.add('hidden');
    creatorRemoveAnsImg.classList.add('hidden');
});

// Submit New Card
creatorSubmitCardBtn.addEventListener('click', () => {
    creatorFeedback.classList.add('hidden');
    const type = creatorCardType.value;
    const desc = creatorQuestion.value.trim();

    if (!desc && !pendingCreatorQImage) {
        alert("Por favor, informe a pergunta ou selecione uma imagem.");
        creatorQuestion.focus();
        return;
    }

    const newCard = {
        type,
        description: desc
    };

    if (pendingCreatorQImage) newCard.image = pendingCreatorQImage;

    if (type === 'open') {
        const ans = creatorAnsOpen.value.trim();
        if (!ans) {
            alert("Por favor, digite a resposta principal.");
            creatorAnsOpen.focus();
            return;
        }
        newCard.answer = ans;
    } else if (type === 'open_double') {
        const a1 = creatorAnsDouble1.value.trim();
        const a2 = creatorAnsDouble2.value.trim();
        if (!a1 || !a2) {
            alert("Por favor, preencha as duas respostas.");
            return;
        }
        newCard.answer = a1;
        newCard.answer2 = a2;
        newCard.placeholder1 = "Resposta 1";
        newCard.placeholder2 = "Resposta 2";
    } else if (type === 'anki') {
        const ans = creatorAnsAnki.value.trim();
        if (!ans && !pendingCreatorAnsImage) {
            alert("Por favor, informe a resposta ou uma imagem de resposta para o cartão Anki.");
            creatorAnsAnki.focus();
            return;
        }
        newCard.answer = ans;
        if (pendingCreatorAnsImage) newCard.answerImage = pendingCreatorAnsImage;
    } else if (type === 'multiple_choice') {
        const optInputs = Array.from(document.querySelectorAll('.creator-mc-opt-val'));
        const options = optInputs.map(inp => inp.value.trim()).filter(Boolean);
        if (options.length < 2 || options.length > 6) {
            alert("A questão de múltipla escolha deve conter entre 2 e 6 alternativas válidas.");
            return;
        }
        const checkedRadio = document.querySelector('input[name="creator-mc-correct"]:checked');
        const correctIdx = checkedRadio ? parseInt(checkedRadio.value) : 0;
        const correctText = optInputs[correctIdx]?.value.trim();
        if (!correctText) {
            alert("A alternativa correta selecionada não pode estar vazia.");
            return;
        }
        newCard.answer = correctText;
        newCard.options = options;
    }

    deckCards.push(newCard);
    renderCardsList(true);

    // Reset Form Fields
    creatorQuestion.value = '';
    creatorAnsOpen.value = '';
    creatorAnsDouble1.value = '';
    creatorAnsDouble2.value = '';
    creatorAnsAnki.value = '';
    creatorRemoveQImg.click();
    creatorRemoveAnsImg.click();

    if (type === 'multiple_choice') {
        renderCreatorMcOptions(["", "", "", ""], 0);
    }

    creatorFeedback.textContent = "Card adicionado com sucesso!";
    creatorFeedback.classList.remove('hidden');
    setTimeout(() => creatorFeedback.classList.add('hidden'), 2000);

    // Scroll card list to bottom
    cardsList.scrollTop = cardsList.scrollHeight;
});

// Initialize default creator MCQ options
renderCreatorMcOptions(["", "", "", ""], 0);

// --- AI FLASHCARD GENERATION ANIMATION & PROGRESS ---
let isGeneratingCards = false;
let generationStatusPhrases = [
    "Processando conteúdo e identificando tópicos principais...",
    "Estruturando conceitos fundamentais e definições...",
    "Formulando perguntas abertas e respostas técnicas...",
    "Criando alternativas plausíveis e distratores...",
    "Organizando cartões e refinando o baralho..."
];
let generationStatusInterval = null;

function showGeneratingAnimation(initialMessage = "Processando arquivos e gerando flashcards...") {
    isGeneratingCards = true;
    const bannerContainer = document.getElementById('generation-banner-container');
    const statusText = document.getElementById('generation-status-text');
    const counterNum = document.getElementById('generation-counter-num');
    const badgeStatus = document.getElementById('generation-badge-status');
    const titleText = document.getElementById('generation-title-text');
    const progressBar = document.getElementById('generation-progress-bar-container');

    if (bannerContainer) {
        bannerContainer.classList.remove('hidden', 'opacity-0', 'scale-95');
    }
    if (statusText) statusText.textContent = initialMessage;
    if (counterNum) counterNum.textContent = '0';
    if (badgeStatus) {
        badgeStatus.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-b from-purple-50 to-purple-100 dark:from-purple-950/60 dark:to-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-none";
        badgeStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 animate-pulse"></span> AO VIVO';
    }
    if (titleText) titleText.textContent = "O Gemini está gerando seus flashcards";
    if (progressBar) progressBar.classList.remove('hidden');

    deckSizeBadge.classList.add('badge-generating-pulse');

    // Cycle status phrases periodically while waiting for cards
    let phraseIdx = 0;
    if (generationStatusInterval) clearInterval(generationStatusInterval);
    generationStatusInterval = setInterval(() => {
        if (!isGeneratingCards) {
            clearInterval(generationStatusInterval);
            return;
        }
        if (deckCards.length === 0 && statusText) {
            phraseIdx = (phraseIdx + 1) % generationStatusPhrases.length;
            statusText.textContent = generationStatusPhrases[phraseIdx];
        }
    }, 3200);

    renderCardsList(true);
}

function updateGeneratingProgress(count) {
    const counterNum = document.getElementById('generation-counter-num');
    const statusText = document.getElementById('generation-status-text');
    if (counterNum) counterNum.textContent = count;
    if (statusText) {
        if (count < 10) {
            statusText.textContent = `Identificando conceitos-chave... (${count} cards formulados)`;
        } else if (count < 25) {
            statusText.textContent = `Aprofundando em definições técnicas... (${count} cards formulados)`;
        } else if (count < 50) {
            statusText.textContent = `Construindo perguntas e alternativas... (${count} cards formulados)`;
        } else {
            statusText.textContent = `Finalizando os últimos cards do material... (${count} cards formulados)`;
        }
    }
}

function finishGeneratingAnimation(success = true, count = 0) {
    isGeneratingCards = false;
    if (generationStatusInterval) {
        clearInterval(generationStatusInterval);
        generationStatusInterval = null;
    }
    deckSizeBadge.classList.remove('badge-generating-pulse');

    const bannerContainer = document.getElementById('generation-banner-container');
    const titleText = document.getElementById('generation-title-text');
    const statusText = document.getElementById('generation-status-text');
    const badgeStatus = document.getElementById('generation-badge-status');
    const counterBadge = document.getElementById('generation-counter-badge');
    const progressBar = document.getElementById('generation-progress-bar-container');

    if (progressBar) progressBar.classList.add('hidden');

    if (success && count > 0) {
        if (titleText) titleText.textContent = "Flashcards gerados com sucesso!";
        if (statusText) statusText.textContent = `${count} cards prontos. Você já pode estudar ou pedir edições pelo Assistente de IA.`;
        if (badgeStatus) {
            badgeStatus.className = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-b from-green-50 to-green-100/90 dark:from-green-950/60 dark:to-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-none";
            badgeStatus.innerHTML = '✓ CONCLUÍDO';
        }
        if (counterBadge) {
            counterBadge.className = "text-xs font-semibold text-green-700 dark:text-green-300 bg-gradient-to-b from-green-50 to-green-100/80 dark:from-green-950/50 dark:to-green-900/40 px-3 py-1 rounded-full border border-green-200 dark:border-green-800/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-none";
            counterBadge.textContent = `${count} cards`;
        }

        setTimeout(() => {
            if (bannerContainer && !isGeneratingCards) {
                bannerContainer.classList.add('opacity-0', 'scale-95');
                setTimeout(() => {
                    bannerContainer.classList.add('hidden');
                    bannerContainer.classList.remove('opacity-0', 'scale-95');
                }, 400);
            }
        }, 4000);
    } else {
        if (titleText) titleText.textContent = "Geração não concluída";
        if (statusText) statusText.textContent = "Não foi possível extrair cards automaticamente. Verifique os arquivos enviados ou tente novamente.";
        if (badgeStatus) {
            badgeStatus.className = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-b from-red-50 to-red-100/90 dark:from-red-950/60 dark:to-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-none";
            badgeStatus.innerHTML = '⚠ ATENÇÃO';
        }
    }
}

// --- RENDER CARDS LIST IN EDITOR VIEW ---
function renderCardsList(fullReRender = false) {
    deckSizeBadge.textContent = deckCards.length;

    if (deckCards.length === 0) {
        if (isGeneratingCards) {
            cardsList.innerHTML = `
                <div id="cards-skeleton-loader" class="flex flex-col gap-3">
                    <div class="bg-white dark:bg-gray-750 border border-gray-200/80 dark:border-gray-700/80 p-4 rounded-xl shadow-sm relative overflow-hidden flex flex-col gap-3 animate-pulse">
                        <div class="flex justify-between items-center">
                            <div class="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                            <div class="h-4 w-16 bg-purple-100 dark:bg-purple-900/40 rounded"></div>
                        </div>
                        <div class="space-y-2">
                            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-5/6"></div>
                            <div class="h-4 bg-gray-100 dark:bg-gray-800 rounded-md w-3/5"></div>
                        </div>
                        <div class="h-4 bg-green-100 dark:bg-green-950/40 rounded-md w-2/5 mt-1"></div>
                    </div>
                    <div class="bg-white dark:bg-gray-750 border border-gray-200/80 dark:border-gray-700/80 p-4 rounded-xl shadow-sm relative overflow-hidden flex flex-col gap-3 animate-pulse opacity-75">
                        <div class="flex justify-between items-center">
                            <div class="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                            <div class="h-4 w-24 bg-blue-100 dark:bg-blue-900/40 rounded"></div>
                        </div>
                        <div class="space-y-2">
                            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-11/12"></div>
                            <div class="h-4 bg-gray-100 dark:bg-gray-800 rounded-md w-2/3"></div>
                        </div>
                        <div class="h-4 bg-green-100 dark:bg-green-950/40 rounded-md w-1/3 mt-1"></div>
                    </div>
                    <div class="bg-white dark:bg-gray-750 border border-gray-200/80 dark:border-gray-700/80 p-4 rounded-xl shadow-sm relative overflow-hidden flex flex-col gap-3 animate-pulse opacity-50">
                        <div class="flex justify-between items-center">
                            <div class="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                            <div class="h-4 w-20 bg-indigo-100 dark:bg-indigo-900/40 rounded"></div>
                        </div>
                        <div class="space-y-2">
                            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-4/5"></div>
                            <div class="h-4 bg-gray-100 dark:bg-gray-800 rounded-md w-1/2"></div>
                        </div>
                        <div class="h-4 bg-green-100 dark:bg-green-950/40 rounded-md w-1/4 mt-1"></div>
                    </div>
                </div>
            `;
            return;
        } else {
            cardsList.innerHTML = `
                <div class="text-center py-12 text-gray-400 dark:text-gray-500">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    <p class="font-medium text-sm">Nenhum cartão no baralho ainda.</p>
                    <p class="text-xs mt-1">Crie um novo cartão ao lado ou peça ao Assistente de IA.</p>
                </div>
            `;
            return;
        }
    }

    // Clean up skeleton or empty state if present
    const skeleton = document.getElementById('cards-skeleton-loader');
    if (skeleton) skeleton.remove();
    if (cardsList.querySelector('.text-center')) {
        cardsList.innerHTML = '';
    }

    if (fullReRender) {
        cardsList.innerHTML = '';
    }

    const currentCount = cardsList.querySelectorAll('.flashcard-item').length;
    for (let i = currentCount; i < deckCards.length; i++) {
        const cardEl = createCardElement(deckCards[i], i);
        cardsList.appendChild(cardEl);
    }
}

function createCardElement(card, index) {
    const cardEl = document.createElement('div');
    cardEl.className = "bg-white dark:bg-gray-750 border border-gray-200 dark:border-gray-700 p-4 rounded-xl relative group shadow-sm flex flex-col gap-2 transition flashcard-item card-enter-anim";
    cardEl.dataset.index = index;

    const typeBadge = document.createElement('span');
    typeBadge.className = "absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded";

    if (card.type === 'anki') {
        typeBadge.className += " bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300";
        typeBadge.textContent = "Anki-like";
    } else if (card.type === 'multiple_choice') {
        typeBadge.className += " bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300";
        typeBadge.textContent = `Múltipla Escolha (${card.options ? card.options.length : 4})`;
    } else if (card.type === 'open_double') {
        typeBadge.className += " bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300";
        typeBadge.textContent = "Duplo Aberto";
    } else {
        typeBadge.className += " bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
        typeBadge.textContent = "Aberto";
    }
    cardEl.appendChild(typeBadge);

    const descStr = `<strong>P:</strong> <span class="text-gray-800 dark:text-gray-200">${card.description || '(Sem texto)'}</span>`;
    let ansStr = `<strong>R:</strong> <span class="text-green-600 dark:text-green-400">${card.answer || ''}</span>`;

    if (card.type === 'open_double') {
        ansStr += `<br><strong>R2:</strong> <span class="text-green-600 dark:text-green-400">${card.answer2 || ''}</span>`;
    } else if (card.type === 'multiple_choice') {
        const optsList = (card.options || []).map(opt => {
            const isCorrect = opt === card.answer;
            return isCorrect ? `<strong class="text-green-600 dark:text-green-400">✓ ${opt}</strong>` : opt;
        }).join(' | ');
        ansStr = `<span class="text-xs text-gray-500">Opções: ${optsList}</span>`;
    } else if (card.type === 'anki') {
        ansStr = `<strong>Resposta:</strong> <span class="text-indigo-600 dark:text-indigo-400">${card.answer || ''}</span>`;
    }

    const textCont = document.createElement('div');
    textCont.innerHTML = `<p class="mb-1 text-sm mt-3 pr-20">${descStr}</p><p class="text-sm">${ansStr}</p>`;
    cardEl.appendChild(textCont);

    // Question Image
    if (card.image) {
        const imgDiv = document.createElement('div');
        imgDiv.className = "w-full max-h-32 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center p-1 mt-1";
        imgDiv.innerHTML = `<img src="${card.image}" alt="Imagem" class="max-h-28 w-auto object-contain rounded">`;
        cardEl.appendChild(imgDiv);
    }

    // Answer Image (Anki)
    if (card.answerImage) {
        const ansImgDiv = document.createElement('div');
        ansImgDiv.className = "w-full max-h-32 overflow-hidden rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center justify-center p-1 mt-1";
        ansImgDiv.innerHTML = `<img src="${card.answerImage}" alt="Imagem Resposta" class="max-h-28 w-auto object-contain rounded">`;
        cardEl.appendChild(ansImgDiv);
    }

    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = "absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity";

    const editBtn = document.createElement('button');
    editBtn.className = "p-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-lg";
    editBtn.innerHTML = '<img src="../assets/img/edit.svg" class="w-4 h-4" alt="Editar">';
    editBtn.onclick = () => openInlineEditModal(index);

    const delBtn = document.createElement('button');
    delBtn.className = "p-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-300 rounded-lg";
    delBtn.innerHTML = '<img src="../assets/img/delete.svg" class="w-4 h-4" alt="Excluir">';
    delBtn.onclick = () => {
        if (confirm('Excluir este flashcard permanentemente?')) {
            deckCards.splice(index, 1);
            renderCardsList(true);
        }
    };

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(delBtn);
    cardEl.appendChild(actionsDiv);

    return cardEl;
}

addCardBtn.addEventListener('click', () => {
    switchSidebarTab('creator');
    creatorQuestion.focus();
});

// --- INLINE EDIT MODAL (FOR ALL TYPES) ---
function openInlineEditModal(index) {
    const card = deckCards[index];
    if (!card) return;

    editCardIndex.value = index;
    editCardType.value = card.type || 'open';
    editCardDesc.value = card.description || '';

    // Show/hide groups based on type
    const t = card.type || 'open';
    editCardAns1Group.classList.toggle('hidden', t === 'anki' || t === 'multiple_choice');
    editCardAns2Group.classList.toggle('hidden', t !== 'open_double');
    editCardAnkiGroup.classList.toggle('hidden', t !== 'anki');
    editCardMcGroup.classList.toggle('hidden', t !== 'multiple_choice');
    inlineEditAnsImageGroup.classList.toggle('hidden', t !== 'anki');

    if (t === 'open') {
        editCardAns1Label.textContent = "Resposta Principal";
        editCardAns1.value = card.answer || '';
    } else if (t === 'open_double') {
        editCardAns1Label.textContent = "Resposta 1";
        editCardAns1.value = card.answer || '';
        editCardAns2.value = card.answer2 || '';
    } else if (t === 'anki') {
        editCardAnkiAnswer.value = card.answer || '';
    } else if (t === 'multiple_choice') {
        renderInlineEditMcOptions(card.options || ["", "", "", ""], card.answer);
    }

    pendingInlineEditQImage = card.image || '';
    if (pendingInlineEditQImage) {
        inlineEditImagePreview.src = pendingInlineEditQImage;
        inlineEditImagePreviewContainer.classList.remove('hidden');
    } else {
        inlineEditImagePreviewContainer.classList.add('hidden');
    }

    pendingInlineEditAnsImage = card.answerImage || '';
    if (pendingInlineEditAnsImage) {
        inlineEditAnsImagePreview.src = pendingInlineEditAnsImage;
        inlineEditAnsImagePreviewContainer.classList.remove('hidden');
    } else {
        inlineEditAnsImagePreviewContainer.classList.add('hidden');
    }

    inlineEditModal.classList.remove('hidden');
}

function renderInlineEditMcOptions(options, correctAnswer) {
    editCardMcList.innerHTML = '';
    options.forEach((optText, i) => {
        const isCorrect = optText === correctAnswer;
        const row = document.createElement('div');
        row.className = "flex items-center gap-2";
        row.innerHTML = `
            <input type="radio" name="inline-edit-mc-correct" value="${i}" ${isCorrect ? 'checked' : ''} class="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer">
            <input type="text" class="inline-edit-mc-opt-val flex-1 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" value="${optText}">
            <button type="button" class="inline-edit-remove-opt-btn p-1 text-gray-400 hover:text-red-500 transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        const removeBtn = row.querySelector('.inline-edit-remove-opt-btn');
        removeBtn.addEventListener('click', () => {
            const currentVals = Array.from(document.querySelectorAll('.inline-edit-mc-opt-val')).map(inp => inp.value);
            if (currentVals.length <= 2) {
                alert("Mínimo de 2 alternativas.");
                return;
            }
            currentVals.splice(i, 1);
            renderInlineEditMcOptions(currentVals, correctAnswer);
        });
        editCardMcList.appendChild(row);
    });

    editCardAddMcOptBtn.classList.toggle('hidden', options.length >= 6);
}

editCardAddMcOptBtn.addEventListener('click', () => {
    const currentVals = Array.from(document.querySelectorAll('.inline-edit-mc-opt-val')).map(inp => inp.value);
    if (currentVals.length >= 6) return;
    currentVals.push("");
    const checkedRadio = document.querySelector('input[name="inline-edit-mc-correct"]:checked');
    const correctIdx = checkedRadio ? parseInt(checkedRadio.value) : 0;
    const curCorrect = currentVals[correctIdx] || "";
    renderInlineEditMcOptions(currentVals, curCorrect);
});

// Inline Edit Image Listeners
inlineEditImageFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        pendingInlineEditQImage = await compressImageFile(file);
        inlineEditImagePreview.src = pendingInlineEditQImage;
        inlineEditImagePreviewContainer.classList.remove('hidden');
    }
});
inlineEditRemoveImageBtn.addEventListener('click', () => {
    pendingInlineEditQImage = '';
    inlineEditImageFile.value = '';
    inlineEditImagePreviewContainer.classList.add('hidden');
});

inlineEditAnsImageFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        pendingInlineEditAnsImage = await compressImageFile(file);
        inlineEditAnsImagePreview.src = pendingInlineEditAnsImage;
        inlineEditAnsImagePreviewContainer.classList.remove('hidden');
    }
});
inlineEditRemoveAnsImageBtn.addEventListener('click', () => {
    pendingInlineEditAnsImage = '';
    inlineEditAnsImageFile.value = '';
    inlineEditAnsImagePreviewContainer.classList.add('hidden');
});

closeInlineEditBtn.addEventListener('click', () => inlineEditModal.classList.add('hidden'));
cancelInlineEditBtn.addEventListener('click', () => inlineEditModal.classList.add('hidden'));

saveInlineEditBtn.addEventListener('click', () => {
    const idx = parseInt(editCardIndex.value);
    if (idx < 0 || !deckCards[idx]) return;

    const card = deckCards[idx];
    card.description = editCardDesc.value.trim();

    if (pendingInlineEditQImage) card.image = pendingInlineEditQImage;
    else delete card.image;

    if (card.type === 'open') {
        card.answer = editCardAns1.value.trim();
    } else if (card.type === 'open_double') {
        card.answer = editCardAns1.value.trim();
        card.answer2 = editCardAns2.value.trim();
    } else if (card.type === 'anki') {
        card.answer = editCardAnkiAnswer.value.trim();
        if (pendingInlineEditAnsImage) card.answerImage = pendingInlineEditAnsImage;
        else delete card.answerImage;
    } else if (card.type === 'multiple_choice') {
        const optInputs = Array.from(document.querySelectorAll('.inline-edit-mc-opt-val'));
        const options = optInputs.map(inp => inp.value.trim()).filter(Boolean);
        const checkedRadio = document.querySelector('input[name="inline-edit-mc-correct"]:checked');
        const correctIdx = checkedRadio ? parseInt(checkedRadio.value) : 0;
        card.options = options;
        card.answer = optInputs[correctIdx]?.value.trim() || options[0];
    }

    renderCardsList(true);
    inlineEditModal.classList.add('hidden');
});

// --- AI CHAT INTEGRATION ---
function addChatMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = `py-2 px-4 rounded-xl max-w-[85%] text-sm ${role === 'user' ? 'self-end bg-purple-600 text-white rounded-tr-sm' : 'self-start bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'}`;
    msg.textContent = text;
    chatHistory.appendChild(msg);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

chatSendBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    const apiKey = getApiKey();
    if (!apiKey) {
        addChatMessage('model', 'Por favor, insira sua API Key para usar o assistente.');
        openApiKeyModalBtn.click();
        return;
    }

    if (!geminiChatSession) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: currentEditorModel,
            systemInstruction,
            tools: deckTools
        });
        currentGenModel = model;
        geminiChatSession = model.startChat({ history: [] });
    }

    chatInput.value = '';
    addChatMessage('user', text);

    chatInput.disabled = true;
    chatSendBtn.disabled = true;
    chatSpinner.classList.remove('hidden');
    showChatTypingIndicator();

    try {
        const contextLines = deckCards.map((c, i) => `[${i}] (${c.type}) ${c.description.substring(0, 60)}... | R: ${c.answer}`).join('\n');
        const enrichedPrompt = `ATENÇÃO: O estado atual do baralho é:\n${contextLines}\n\nComando do Usuário: ${text}`;

        let result = await callWithRetry(() => geminiChatSession.sendMessage(enrichedPrompt));
        let response = result.response;

        for (let i = 0; i < 5; i++) {
            const candidate = response.candidates[0];
            const calls = candidate.content.parts.filter(p => !!p.functionCall);
            if (calls.length === 0) break;

            const functionResponses = calls.map(call => {
                const { name, args } = call.functionCall;
                const output = toolFunctions[name] ? toolFunctions[name](args) : { error: "Função não encontrada" };
                return {
                    functionResponse: { name, response: output }
                };
            });

            result = await callWithRetry(() => geminiChatSession.sendMessage(functionResponses));
            sanitizeChatHistory(geminiChatSession);
            response = result.response;
        }

        const modelText = response.text();
        hideChatTypingIndicator();
        addChatMessage('model', modelText || 'Ação realizada com sucesso.');

    } catch (e) {
        console.error(e);
        hideChatTypingIndicator();
        addChatMessage('model', `Erro ao processar: ${e.message}`);
    } finally {
        hideChatTypingIndicator();
        chatInput.disabled = false;
        chatSendBtn.disabled = false;
        chatSpinner.classList.add('hidden');
    }
});

chatInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') chatSendBtn.click();
});

// --- SAVE & PLAY DECK ---
downloadDeckBtn.addEventListener('click', () => {
    if (deckCards.length === 0) return;
    const jsonStr = JSON.stringify(deckCards, null, 4);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = deckTitleDisplay.value.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `${safeTitle || 'flashcards'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

playDeckBtn.addEventListener('click', () => {
    if (deckCards.length === 0) {
        alert("Adicione pelo menos um cartão antes de jogar.");
        return;
    }

    const title = deckTitleDisplay.value;
    const gameState = {
        questionsPool: [...deckCards],
        allQuestions: [...deckCards],
        score: 0,
        deckTitle: title
    };

    if (title === "Caderno") {
        localStorage.setItem('flashcardsNotebook', JSON.stringify(gameState));
        localStorage.setItem('flashcardsActiveMode', 'notebook');
    } else {
        localStorage.setItem('flashcardsSave', JSON.stringify(gameState));
        localStorage.setItem('flashcardsActiveMode', 'normal');
    }

    window.location.href = 'game.html';
});

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    checkAndResetModelFallback();
    updateApiKeyStatusUI();

    // Check if loading an existing deck for editing
    const savedDeck = localStorage.getItem('editing_deck');
    const savedTitle = localStorage.getItem('editing_deck_title');

    if (savedDeck) {
        try {
            deckCards = JSON.parse(savedDeck);
            const displayTitle = savedTitle || "Flashcards";
            deckTitleDisplay.value = displayTitle;
            document.title = `${displayTitle} | Editor`;

            openEditorView('creator');

            localStorage.removeItem('editing_deck');
            localStorage.removeItem('editing_deck_title');
        } catch (e) {
            console.error("Erro ao carregar deck salvo:", e);
        }
    }
});
