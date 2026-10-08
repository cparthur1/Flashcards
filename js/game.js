import { GoogleGenerativeAI } from '@google/generative-ai';
import { normalizeString, calculateSimilarity, shuffleArray, callWithRetry, checkAndResetModelFallback, ROUTES, renderMathAndMarkdown } from './utils.js';
import { initTransfer } from './transfer.js';
import { initStatsSession, recordStatsAnswer, recordStatsAiCorrection, archiveCurrentSession, completeCurrentSession } from './stats-tracker.js';
import { getApiKeyAsync, getCachedApiKey, saveApiKey, clearApiKey, isKeyRemembered } from './key-manager.js';

// --- DOM ELEMENTS ---
const deckTitle = document.getElementById('deck-title');
const deckSelectTrigger = document.getElementById('deck-select-trigger');
const deckSelectDropdown = document.getElementById('deck-select-dropdown');
const deckSelectArrow = document.getElementById('deck-select-arrow');
const deckItemNormal = document.getElementById('deck-item-normal');
const deckItemNormalName = document.getElementById('deck-item-normal-name');
const deckItemNotebook = document.getElementById('deck-item-notebook');
const deckItemExam = document.getElementById('deck-item-exam');
const deckItemExamSub = document.getElementById('deck-item-exam-sub');
const dropdownExamDecksSection = document.getElementById('dropdown-exam-decks-section');
const dropdownExamDecksCount = document.getElementById('dropdown-exam-decks-count');
const dropdownExamDecksList = document.getElementById('dropdown-exam-decks-list');
const dropdownAddDeckBtn = document.getElementById('dropdown-add-deck-btn');
const dropdownAddDeckInput = document.getElementById('dropdown-add-deck-input');
const bookmarkCardBtn = document.getElementById('bookmark-card-btn');
const bookmarkCardIcon = document.getElementById('bookmark-card-icon');

const hamburgerBtn = document.getElementById('hamburger-btn');
const hamburgerMenu = document.getElementById('hamburger-menu');
const hamburgerBackdrop = document.getElementById('hamburger-backdrop');
const statsBtn = document.getElementById('stats-btn');
const receiveSessionBtn = document.getElementById('receive-session-btn');
const transferSessionBtn = document.getElementById('transfer-session-btn');
const menuAiIcon = document.getElementById('menu-ai-icon');
const menuAiStatusBadge = document.getElementById('menu-ai-status-badge');
const menuAiTitle = document.getElementById('menu-ai-title');
const menuAiSubtitle = document.getElementById('menu-ai-subtitle');

const resetBtn = document.getElementById('reset-btn');
const restartGameBtn = document.getElementById('restart-game-btn');
const exportBtn = document.getElementById('export-btn');
const gameContainer = document.getElementById('game-container');
const goToEditorBtn = document.getElementById('go-to-editor-btn');

const questionText = document.getElementById('question-text');
const questionSourceTag = document.getElementById('question-source-tag');
const questionBodyText = document.getElementById('question-body-text');
const questionFeedbackText = document.getElementById('question-feedback-text');

function ensureQuestionStructure() {
    if (!questionText) return;
    if (!document.getElementById('question-body-text')) {
        questionText.innerHTML = `
            <span id="question-source-tag" class="hidden text-xs uppercase tracking-wider text-blue-500 font-bold mb-1.5 block select-none"></span>
            <span id="question-body-text"></span>
            <span id="question-feedback-text" class="hidden mt-2 block"></span>
        `;
    }
}
const textHighlightPopup = document.getElementById('text-highlight-popup');
const hlTriggerBtn = document.getElementById('hl-trigger-btn');
const hlPalette = document.getElementById('hl-palette');
const scoreDisplay = document.getElementById('score');
const questionsLeftDisplay = document.getElementById('questions-left');
const questionCard = document.getElementById('question-card');
const deleteCardBtn = document.getElementById('delete-card-btn');
const questionImageContainer = document.getElementById('question-image-container');
const questionImagePlaceholder = document.getElementById('question-image-placeholder');
const questionImage = document.getElementById('question-image');

const deckCompletionView = document.getElementById('deck-completion-view');
const deckCompletionSubtitle = document.getElementById('deck-completion-subtitle');
const completionStatCards = document.getElementById('completion-stat-cards');
const completionStatAcc = document.getElementById('completion-stat-acc');
const completionStatTime = document.getElementById('completion-stat-time');
const completionStatStreak = document.getElementById('completion-stat-streak');
const completionStatsBtn = document.getElementById('completion-stats-btn');
const completionRestartBtn = document.getElementById('completion-restart-btn');
const shockwaveContainer = document.getElementById('shockwave-container');
const actionButtonsArea = document.getElementById('action-buttons-area');

const correctionOptions = document.getElementById('correction-options');
const editBtn = document.getElementById('edit-btn');
const deleteCorrectionBtn = document.getElementById('delete-correction-btn');

const streakPill = document.getElementById('streak-pill');
const streakBgColor = document.getElementById('streak-bg-color');
const streakShimmerSweep = document.getElementById('streak-shimmer-sweep');
const streakFireIcon = document.getElementById('streak-fire-icon');
const streakCount = document.getElementById('streak-count');

let currentStreak = 0;
let lastStreakBeforeWrong = 0;

const editModal = document.getElementById('edit-modal');
const editQuestionInput = document.getElementById('edit-question-input');
const editAnswerInput = document.getElementById('edit-answer-input');
const editAnswer2Group = document.getElementById('edit-answer-2-group');
const editAnswer2Input = document.getElementById('edit-answer-2-input');
const editImagePreviewContainer = document.getElementById('edit-image-preview-container');
const editImagePreview = document.getElementById('edit-image-preview');
const editRemoveImageBtn = document.getElementById('edit-remove-image-btn');
const editImageUrlInput = document.getElementById('edit-image-url-input');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveEditBtn = document.getElementById('save-edit-btn');

const imageZoomModal = document.getElementById('image-zoom-modal');
const zoomedImage = document.getElementById('zoomed-image');
const closeImageZoomBtn = document.getElementById('close-image-zoom-btn');

const openAnswerArea = document.getElementById('open-answer-area');
const flashcardAnswerForm = document.getElementById('flashcard-answer-form');
const answerInput = document.getElementById('answer-input');
const openDoubleAnswerArea = document.getElementById('open-double-answer-area');
const answerInput1 = document.getElementById('answer-input-1');
const answerInput2 = document.getElementById('answer-input-2');
const mcAnswerArea = document.getElementById('mc-answer-area');
let mcOptionBtns = document.querySelectorAll('.mc-option-btn');

// Anki DOM Elements
const ankiAnswerContainer = document.getElementById('anki-answer-container');
const ankiAnswerText = document.getElementById('anki-answer-text');
const ankiAnswerImageContainer = document.getElementById('anki-answer-image-container');
const ankiAnswerImagePlaceholder = document.getElementById('anki-answer-image-placeholder');
const ankiAnswerImage = document.getElementById('anki-answer-image');

const ankiControlsArea = document.getElementById('anki-controls-area');
const ankiUnflippedControls = document.getElementById('anki-unflipped-controls');
const ankiFlippedControls = document.getElementById('anki-flipped-controls');
const ankiFlipBtn = document.getElementById('anki-flip-btn');
const ankiBtnAgain = document.getElementById('anki-btn-again');
const ankiBtnHard = document.getElementById('anki-btn-hard');
const ankiBtnGood = document.getElementById('anki-btn-good');
const ankiBtnEasy = document.getElementById('anki-btn-easy');

// Edit Modal Additional Fields
const editAnswer1Group = document.getElementById('edit-answer-1-group');
const editAnswer1Label = document.getElementById('edit-answer-1-label');
const editAnkiAnswerGroup = document.getElementById('edit-anki-answer-group');
const editAnkiAnswerInput = document.getElementById('edit-anki-answer-input');
const editMcOptionsGroup = document.getElementById('edit-mc-options-group');
const editMcOptionsList = document.getElementById('edit-mc-options-list');
const editAddMcOptBtn = document.getElementById('edit-add-mc-opt-btn');
const editAnsImageGroup = document.getElementById('edit-ans-image-group');
const editAnsImagePreviewContainer = document.getElementById('edit-ans-image-preview-container');
const editAnsImagePreview = document.getElementById('edit-ans-image-preview');
const editRemoveAnsImageBtn = document.getElementById('edit-remove-ans-image-btn');
const editAnsImageUrlInput = document.getElementById('edit-ans-image-url-input');
const editFillAnswerGroup = document.getElementById('edit-fill-answer-group');
const editFillAnswerInput = document.getElementById('edit-fill-answer-input');

const submitBtn = document.getElementById('submit-btn');
const nextQuestionBtn = document.getElementById('next-question-btn');

const aiToggleBtn = document.getElementById('ai-toggle-btn');
const aiIconOff = document.getElementById('ai-icon-off');
const aiIconOn = document.getElementById('ai-icon-on');
const apiModal = document.getElementById('api-modal');
const apiKeyForm = document.getElementById('api-key-form');
const closeApiModal = document.getElementById('close-api-modal');
const apiKeyInput = document.getElementById('api-key-input');
const apiKeyRemember = document.getElementById('api-key-remember');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const disableAiBtn = document.getElementById('disable-ai-btn');
const openAiInstructions = document.getElementById('open-ai-instructions');
const instructionsModal = document.getElementById('instructions-modal');
const closeInstructionsBtn = document.getElementById('close-instructions-btn');
const instructionsReadyBtn = document.getElementById('instructions-ready-btn');

const askAiBtn = document.getElementById('ask-ai-btn');
const aiChatContainer = document.getElementById('ai-chat-container');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

const canvas = document.getElementById('background-canvas');
const ctx = canvas.getContext('2d');

// --- GAME STATE ---
let activeMode = 'normal'; // 'normal' or 'notebook'
let allQuestions = [];
let questionsPool = [];
let score = 0;
let currentQuestion = {};
let currentQuestionIndexInPool = -1;
let balls = [];
let isFirstQuestion = true;
let hasChatInteraction = false;
let isAnimating = false;
let currentStep = 0;
let consecutiveDueCardsCount = 0;
let isAnkiFlipped = false;
let pendingEditAnsImage = '';
let questionStartTime = Date.now();

// --- AI STATE ---
let isAiEnabled = false;
let geminiApiKey = getCachedApiKey();
let genAI = null;
let lastUserAnswerForChat = "";
let currentChatSession = null;
let currentChatModel = "gemini-flash-lite-latest";
let ai503ErrorCount = 0;
let lastLatencyNotificationTime = 0;

// --- UI UTILITIES ---
const imageLoadTokens = new WeakMap();

function setupCardImageWithPlaceholder(srcUrl, imgElem, containerElem, placeholderElem) {
    if (!containerElem || !imgElem) return;

    if (!srcUrl) {
        containerElem.classList.add('hidden');
        if (placeholderElem) placeholderElem.classList.add('hidden');
        imgElem.classList.add('hidden');
        imgElem.classList.remove('opacity-100');
        imgElem.classList.add('opacity-0');
        imgElem.src = '';
        return;
    }

    const token = (imageLoadTokens.get(imgElem) || 0) + 1;
    imageLoadTokens.set(imgElem, token);

    // CRITICAL: Immediately clear src and hide previous card's image to prevent rendering the previous image
    imgElem.classList.add('hidden');
    imgElem.classList.remove('opacity-100');
    imgElem.classList.add('opacity-0');
    imgElem.src = '';

    // Show container and animated skeleton placeholder
    containerElem.classList.remove('hidden');
    if (placeholderElem) {
        placeholderElem.classList.remove('hidden');
    }

    const preloader = new Image();
    preloader.src = srcUrl;

    const revealImage = () => {
        if (imageLoadTokens.get(imgElem) !== token) return;
        imgElem.src = srcUrl;
        if (placeholderElem) {
            placeholderElem.classList.add('hidden');
        }
        imgElem.classList.remove('hidden');
        requestAnimationFrame(() => {
            imgElem.classList.remove('opacity-0');
            imgElem.classList.add('opacity-100');
        });
    };

    const handleLoadError = () => {
        if (imageLoadTokens.get(imgElem) !== token) return;
        if (placeholderElem) {
            placeholderElem.classList.add('hidden');
        }
        containerElem.classList.add('hidden');
    };

    if (preloader.complete && preloader.naturalWidth > 0) {
        revealImage();
    } else if (typeof preloader.decode === 'function') {
        preloader.decode().then(revealImage).catch(() => {
            if (preloader.complete && preloader.naturalWidth > 0) {
                revealImage();
            } else {
                preloader.onload = revealImage;
                preloader.onerror = handleLoadError;
            }
        });
    } else {
        preloader.onload = revealImage;
        preloader.onerror = handleLoadError;
    }
}
function showNotificationPill(message, iconName, isWarning = false) {
    const existing = document.getElementById('notification-pill');
    if (existing) existing.remove();

    const pill = document.createElement('div');
    pill.id = 'notification-pill';
    // Samsung One UI style: pill-shaped, superior, blurred, centered
    pill.className = `fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-2.5 rounded-full shadow-2xl backdrop-blur-xl border border-white/20 transition-all duration-500 transform -translate-y-20 opacity-0 ${isWarning ? 'bg-yellow-100/90' : 'bg-white/90'}`;
    pill.innerHTML = `
        <img src="../assets/img/${iconName}" class="w-5 h-5" alt="icon">
        <span class="text-[13px] font-medium text-gray-800 whitespace-nowrap">${message}</span>
    `;

    document.body.appendChild(pill);

    requestAnimationFrame(() => {
        pill.classList.remove('-translate-y-20', 'opacity-0');
        pill.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
        pill.classList.remove('translate-y-0', 'opacity-100');
        pill.classList.add('-translate-y-20', 'opacity-0');
        setTimeout(() => pill.remove(), 500);
    }, 4000);
}

// --- HAPTIC FEEDBACK (VIBRATION API) ---
const HAPTIC_STORAGE_KEY = 'flashcardsHapticEnabled';

const HAPTIC_PATTERNS = {
    // Subtle crisp tap for mechanical / tactile micro-confirmations
    tap: [10],
    correct: [12],
    scorePulse: [15],
    cardFlip: [10],
    // "zzzTZ": vibra leve enquanto sobe (micro-pulsos rápidos ~170ms), pausa na descida e curto mais forte quando some (42ms)
    // Duração total: 172ms + 210ms + 42ms = 424ms (dentro dos 550ms da animação gráfica)
    cardToBack: [12, 20, 12, 20, 12, 20, 12, 20, 12, 20, 12, 210, 42],
    // Rhythmic double flutter synchronized with shake oscillations (450ms - 500ms)
    wrong: [20, 50, 20],
    shake: [20, 50, 20],
    // Soft distinct tactile pop right when fill-the-blank morphs yellow revealing correct answer
    fillPop: [18],
    // Rising energetic pulse on streak milestones (>= 3)
    streakUp: [15, 35, 25],
    // Subtle damping notch when streak resets
    streakReset: [25]
};

function isHapticEnabled() {
    return localStorage.getItem(HAPTIC_STORAGE_KEY) !== 'false';
}

function setHapticEnabled(enabled) {
    localStorage.setItem(HAPTIC_STORAGE_KEY, enabled ? 'true' : 'false');
    updateHapticUI();
    if (enabled) {
        triggerHaptic('tap');
    }
}

function triggerHaptic(type) {
    if (!isHapticEnabled()) return;
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try {
        if (type === 'stop') {
            navigator.vibrate(0);
            return;
        }
        const pattern = Array.isArray(type) ? type : (HAPTIC_PATTERNS[type] || [12]);
        navigator.vibrate(pattern);
    } catch (e) {
        // Silently catch if blocked by browser policy or platform restrictions
    }
}

function updateHapticUI() {
    const hapticSwitch = document.getElementById('haptic-switch');
    const hapticStatusBadge = document.getElementById('haptic-status-badge');
    if (!hapticSwitch && !hapticStatusBadge) return;
    const hasVibrationSupport = typeof navigator !== 'undefined' && 'vibrate' in navigator;
    const enabled = isHapticEnabled();

    if (hapticSwitch) {
        if (!hasVibrationSupport) {
            hapticSwitch.disabled = true;
            hapticSwitch.selected = false;
            hapticSwitch.title = 'Vibração indisponível neste dispositivo';
        } else {
            hapticSwitch.disabled = false;
            hapticSwitch.selected = enabled;
            hapticSwitch.title = enabled ? 'Vibração ativada' : 'Vibração desativada';
        }
    }

    if (hapticStatusBadge) {
        if (!hasVibrationSupport) {
            hapticStatusBadge.textContent = 'Indisponível';
            hapticStatusBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500';
            return;
        }

        if (enabled) {
            hapticStatusBadge.textContent = 'Ativa';
            hapticStatusBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700';
        } else {
            hapticStatusBadge.textContent = 'Desativada';
            hapticStatusBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500';
        }
    }
}

// --- CARD ANIMATION UTILITIES ---
function getHeaderScoreTarget() {
    const scoreVal = document.getElementById('score');
    const scoreContainer = document.getElementById('score-container');
    const scoreWrapper = document.getElementById('score-wrapper');

    if (scoreVal && scoreVal.offsetParent !== null) return scoreVal;
    if (scoreContainer && scoreContainer.offsetParent !== null) return scoreContainer;
    return scoreWrapper || scoreContainer || scoreVal;
}

function animateCardToBack(callback) {
    if (questionsPool.length === 0) {
        if (callback) callback();
        return;
    }
    if (isAnimating) {
        if (callback) callback();
        return;
    }
    isAnimating = true;

    const rect = questionCard.getBoundingClientRect();
    const clone = questionCard.cloneNode(true);
    clone.id = 'anim-card-back-clone';
    clone.style.position = 'absolute';
    clone.style.top = `${questionCard.offsetTop}px`;
    clone.style.left = `${questionCard.offsetLeft}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.margin = '0';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '25';

    gameContainer.appendChild(clone);

    if (callback) callback();

    questionCard.style.opacity = '0.85';
    questionCard.style.transform = 'scale(0.96)';
    questionCard.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';

    clone.classList.add('anim-card-to-back');

    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion) {
        triggerHaptic('cardToBack');
    }

    setTimeout(() => {
        if (clone && clone.parentElement) {
            clone.style.zIndex = '5';
        }
    }, 200);

    requestAnimationFrame(() => {
        setTimeout(() => {
            questionCard.style.opacity = '1';
            questionCard.style.transform = 'scale(1)';
        }, 150);
    });

    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        triggerHaptic('stop');
        clone.remove();
        questionCard.style.transition = '';
        questionCard.style.transform = '';
        questionCard.style.opacity = '';
        isAnimating = false;
    };

    clone.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 700);
}

function animateCardToHeader(callback) {
    if (questionsPool.length === 0) {
        if (callback) callback();
        return;
    }
    if (isAnimating) {
        if (callback) callback();
        return;
    }
    isAnimating = true;

    const cardRect = questionCard.getBoundingClientRect();
    const targetEl = getHeaderScoreTarget();
    const targetRect = targetEl.getBoundingClientRect();

    const clone = questionCard.cloneNode(true);
    clone.id = 'flying-card-to-header';
    clone.style.position = 'fixed';
    clone.style.top = `${cardRect.top}px`;
    clone.style.left = `${cardRect.left}px`;
    clone.style.width = `${cardRect.width}px`;
    clone.style.height = `${cardRect.height}px`;
    clone.style.margin = '0';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '9999';
    clone.style.transformOrigin = 'center center';
    clone.classList.add('glow-correct');
    document.body.appendChild(clone);

    questionCard.style.opacity = '0';

    const deltaX = (targetRect.left + targetRect.width / 2) - (cardRect.left + cardRect.width / 2);
    const deltaY = (targetRect.top + targetRect.height / 2) - (cardRect.top + cardRect.height / 2);

    const anim = clone.animate([
        {
            transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
            opacity: 1,
            filter: 'brightness(1)'
        },
        {
            transform: `translate(${deltaX * 0.35}px, ${deltaY * 0.45 - 25}px) scale(0.65) rotate(-6deg)`,
            opacity: 0.95,
            filter: 'brightness(1.1)',
            offset: 0.45
        },
        {
            transform: `translate(${deltaX * 0.85}px, ${deltaY * 0.9}px) scale(0.2) rotate(-10deg)`,
            opacity: 0.7,
            filter: 'brightness(1.2)',
            offset: 0.85
        },
        {
            transform: `translate(${deltaX}px, ${deltaY}px) scale(0.04) rotate(-12deg)`,
            opacity: 0,
            filter: 'brightness(1.4)',
            offset: 1
        }
    ], {
        duration: 650,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        fill: 'forwards'
    });

    let finished = false;
    const finishFlight = () => {
        if (finished) return;
        finished = true;
        clone.remove();
        triggerHaptic('scorePulse');

        const pulseTarget = document.getElementById('score') || targetEl;
        pulseTarget.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.4)', filter: 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.9))' },
            { transform: 'scale(0.95)' },
            { transform: 'scale(1)' }
        ], {
            duration: 350,
            easing: 'ease-out'
        });

        if (callback) callback();
        questionCard.style.opacity = '1';
        questionCard.animate([
            { opacity: 0, transform: 'scale(0.96)' },
            { opacity: 1, transform: 'scale(1)' }
        ], {
            duration: 250,
            easing: 'ease-out'
        });
        isAnimating = false;
    };

    anim.onfinish = finishFlight;
    setTimeout(finishFlight, 800);
}

function animateCardsFromHeaderToDeck(callback) {
    if (isAnimating) {
        if (callback) callback();
        return;
    }
    isAnimating = true;

    const cardRect = questionCard.getBoundingClientRect();
    const targetEl = getHeaderScoreTarget();
    const targetRect = targetEl.getBoundingClientRect();

    const deltaX = (targetRect.left + targetRect.width / 2) - (cardRect.left + cardRect.width / 2);
    const deltaY = (targetRect.top + targetRect.height / 2) - (cardRect.top + cardRect.height / 2);

    const pulseTarget = document.getElementById('score') || targetEl;
    pulseTarget.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.25)', filter: 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.8))' },
        { transform: 'scale(1)' }
    ], {
        duration: 300,
        easing: 'ease-out'
    });

    const cardCount = 3;
    let finishedCount = 0;

    for (let i = 0; i < cardCount; i++) {
        setTimeout(() => {
            const cardEl = document.createElement('div');
            cardEl.className = 'fixed rounded-lg shadow-xl border border-blue-200 bg-white flex items-center justify-center pointer-events-none';
            cardEl.style.width = `${cardRect.width}px`;
            cardEl.style.height = `${cardRect.height}px`;
            cardEl.style.top = `${cardRect.top}px`;
            cardEl.style.left = `${cardRect.left}px`;
            cardEl.style.zIndex = `${9990 + i}`;
            cardEl.style.transformOrigin = 'center center';
            cardEl.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-2 text-blue-500 opacity-70">
                    <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                </div>
            `;
            document.body.appendChild(cardEl);

            const rotation = i % 2 === 0 ? 4 : -4;
            const anim = cardEl.animate([
                {
                    transform: `translate(${deltaX}px, ${deltaY}px) scale(0.04) rotate(-12deg)`,
                    opacity: 0.3,
                    filter: 'brightness(1.3)'
                },
                {
                    transform: `translate(${deltaX * 0.4}px, ${deltaY * 0.35 - 20}px) scale(0.65) rotate(${rotation}deg)`,
                    opacity: 0.95,
                    filter: 'brightness(1.05)',
                    offset: 0.55
                },
                {
                    transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
                    opacity: 1,
                    filter: 'brightness(1)',
                    offset: 1
                }
            ], {
                duration: 550,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'forwards'
            });

            anim.onfinish = () => {
                cardEl.remove();
                finishedCount++;
                if (finishedCount === cardCount) {
                    questionCard.animate([
                        { transform: 'scale(1)' },
                        { transform: 'scale(1.02)' },
                        { transform: 'scale(1)' }
                    ], {
                        duration: 200,
                        easing: 'ease-out'
                    });
                    if (callback) callback();
                    isAnimating = false;
                }
            };
        }, i * 90);
    }
}

// --- CANVAS ANIMATION ---
let isCanvasLoopRunning = false;
let canvasAnimationId = null;
let celebrationParticles = [];

function startCanvasLoop() {
    if (!isCanvasLoopRunning) {
        isCanvasLoopRunning = true;
        canvasAnimationId = requestAnimationFrame(animate);
    }
}

function clearBalls() {
    balls = [];
    celebrationParticles = [];
    if (canvasAnimationId) {
        cancelAnimationFrame(canvasAnimationId);
        canvasAnimationId = null;
    }
    isCanvasLoopRunning = false;
    if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function launchCelebrationParticles(count = 140) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    const colors = [
        '#10B981', '#34D399', '#F59E0B', '#FBBF24', 
        '#6366F1', '#818CF8', '#EC4899', '#F43F5E', 
        '#06B6D4', '#3B82F6', '#8B5CF6'
    ];
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;
    for (let i = 0; i < count; i++) {
        celebrationParticles.push({
            x: Math.random() * w,
            y: -15 - Math.random() * (h * 0.4),
            vx: (Math.random() - 0.5) * 5,
            vy: Math.random() * 4 + 2,
            size: Math.random() * 8 + 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 8,
            wobble: Math.random() * Math.PI,
            wobbleSpeed: Math.random() * 0.08 + 0.04,
            shape: Math.random() > 0.35 ? 'rect' : 'circle'
        });
    }
    startCanvasLoop();
}

function cleanShockwaveContainer() {
    if (shockwaveContainer) {
        shockwaveContainer.innerHTML = '';
    }
}

function playCompletionShockwave() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !shockwaveContainer || !questionCard) return;

    // Reset any ongoing ripple elements
    cleanShockwaveContainer();

    // Subtle tactile physical pulse on the question card holder
    questionCard.classList.remove('card-shockwave-pulse');
    void questionCard.offsetWidth;
    questionCard.classList.add('card-shockwave-pulse');
    setTimeout(() => questionCard.classList.remove('card-shockwave-pulse'), 750);

    const rect = questionCard.getBoundingClientRect();
    const cx = Math.round(rect.left + rect.width / 2);
    const cy = Math.round(rect.top + rect.height / 2);

    // Distance from center of card to farthest viewport corner + margin
    const maxDist = Math.hypot(
        Math.max(cx, window.innerWidth - cx),
        Math.max(cy, window.innerHeight - cy)
    ) + 60;

    const diameter = Math.round(maxDist * 2);

    // Wave 1: Ethereal translucent emerald & cobalt gradient ring (pure gradient, no solid lines)
    const wave1 = document.createElement('div');
    wave1.className = 'completion-ripple-wave';
    wave1.style.left = `${cx}px`;
    wave1.style.top = `${cy}px`;
    wave1.style.width = `${diameter}px`;
    wave1.style.height = `${diameter}px`;
    wave1.style.background = 'radial-gradient(circle closest-side, rgba(16, 185, 129, 0) 0%, rgba(16, 185, 129, 0.04) 42%, rgba(16, 185, 129, 0.22) 68%, rgba(37, 99, 235, 0.26) 82%, rgba(59, 130, 246, 0.12) 92%, rgba(37, 99, 235, 0) 100%)';
    shockwaveContainer.appendChild(wave1);

    const anim1 = wave1.animate([
        { transform: 'translate(-50%, -50%) scale(0.04)', opacity: 0.95, offset: 0, easing: 'cubic-bezier(0.16, 0.92, 0.28, 1.25)' },
        { transform: 'translate(-50%, -50%) scale(0.32)', opacity: 0.92, offset: 0.22, easing: 'cubic-bezier(0.55, -0.28, 0.72, 0.1)' },
        { transform: 'translate(-50%, -50%) scale(0.23)', opacity: 0.86, offset: 0.36, easing: 'cubic-bezier(0.12, 0.45, 0.18, 1)' },
        { transform: 'translate(-50%, -50%) scale(1.08)', opacity: 0, offset: 1.0 }
    ], {
        duration: 1020,
        fill: 'forwards'
    });
    anim1.onfinish = () => wave1.remove();

    // Wave 2: Trailing softer blue-emerald gradient (bounces with wave 1, delayed by 90ms)
    setTimeout(() => {
        if (!shockwaveContainer) return;
        const wave2 = document.createElement('div');
        wave2.className = 'completion-ripple-wave';
        wave2.style.left = `${cx}px`;
        wave2.style.top = `${cy}px`;
        wave2.style.width = `${diameter}px`;
        wave2.style.height = `${diameter}px`;
        wave2.style.background = 'radial-gradient(circle closest-side, rgba(37, 99, 235, 0) 0%, rgba(37, 99, 235, 0.04) 48%, rgba(37, 99, 235, 0.18) 72%, rgba(16, 185, 129, 0.22) 85%, rgba(16, 185, 129, 0.08) 93%, rgba(16, 185, 129, 0) 100%)';
        shockwaveContainer.appendChild(wave2);

        const anim2 = wave2.animate([
            { transform: 'translate(-50%, -50%) scale(0.04)', opacity: 0.88, offset: 0, easing: 'cubic-bezier(0.16, 0.92, 0.28, 1.25)' },
            { transform: 'translate(-50%, -50%) scale(0.28)', opacity: 0.84, offset: 0.22, easing: 'cubic-bezier(0.55, -0.28, 0.72, 0.1)' },
            { transform: 'translate(-50%, -50%) scale(0.20)', opacity: 0.78, offset: 0.36, easing: 'cubic-bezier(0.12, 0.45, 0.18, 1)' },
            { transform: 'translate(-50%, -50%) scale(1.06)', opacity: 0, offset: 1.0 }
        ], {
            duration: 960,
            fill: 'forwards'
        });
        anim2.onfinish = () => wave2.remove();
    }, 90);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    balls.forEach(ball => {
        if (ball.y + ball.radius > canvas.height) {
            ball.y = canvas.height - ball.radius;
        }
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.closePath();
    });
    if (balls.some(b => !b.isStatic) || celebrationParticles.length > 0) {
        startCanvasLoop();
    }
}

function createBall(isCorrect) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const radius = Math.random() * 5 + 8;
    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const y = prefersReducedMotion ? (canvas.height - radius) : -radius;
    const color = isCorrect ? 'rgba(74, 222, 128, 0.8)' : 'rgba(239, 68, 68, 0.8)';
    balls.push({ x, y, radius, color, dy: 0, isStatic: prefersReducedMotion });

    if (prefersReducedMotion) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.closePath();
    } else {
        startCanvasLoop();
    }
    return balls.length - 1;
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let anyMoving = false;

    // Render and update celebration confetti particles
    if (celebrationParticles.length > 0) {
        anyMoving = true;
        for (let i = celebrationParticles.length - 1; i >= 0; i--) {
            const p = celebrationParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.wobble += p.wobbleSpeed;
            p.x += Math.sin(p.wobble) * 1.6;
            p.rotation += p.rotationSpeed;
            p.vy += 0.05; // gravity
            if (p.y > canvas.height + 25) {
                celebrationParticles.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;
            if (p.shape === 'rect') {
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    for (let i = 0; i < balls.length; i++) {
        const ball = balls[i];
        if (!ball.isStatic) {
            anyMoving = true;
            ball.dy += 0.2;
            ball.y += ball.dy;
            if (ball.y + ball.radius >= canvas.height) {
                ball.y = canvas.height - ball.radius;
                ball.isStatic = true;
                continue;
            }
            let isTouchingStatic = false;
            for (let j = 0; j < balls.length; j++) {
                if (i === j || !balls[j].isStatic) continue;
                const otherBall = balls[j];
                const dx = ball.x - otherBall.x;
                const dy = ball.y - otherBall.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = ball.radius + otherBall.radius;
                if (distance < minDistance && ball.y < otherBall.y) {
                    isTouchingStatic = true;
                    if (!ball.firstContactTime) ball.firstContactTime = Date.now();
                    ball.dy *= -0.3;
                    const overlap = minDistance - distance;
                    const angle = Math.atan2(dy, dx);
                    ball.x += Math.cos(angle) * overlap;
                    ball.y += Math.sin(angle) * overlap;
                    ball.x += dx * 0.08; // Rolling force
                    break;
                }
            }
            if (isTouchingStatic && ball.firstContactTime) {
                if (Date.now() - ball.firstContactTime > 5000) {
                    ball.isStatic = true;
                }
            }
        }
    }
    balls.forEach(ball => {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.closePath();
    });
    if (balls.length > 300) balls.shift();

    if (anyMoving) {
        canvasAnimationId = requestAnimationFrame(animate);
    } else {
        isCanvasLoopRunning = false;
        canvasAnimationId = null;
    }
}


// --- HELPER: RENDER FILL-IN-THE-BLANKS QUESTION WITH INTERACTIVE INPUTS ---
function renderFillBlanksQuestion(text) {
    if (!text) return '';
    // 1. Temporarily extract block and inline LaTeX math to protect math underscores
    const mathBlocks = [];
    let placeholderText = text.replace(/\\\[([\s\S]*?)\\\]/g, (match) => {
        mathBlocks.push(match);
        return `%%MATH_${mathBlocks.length - 1}%%`;
    });
    placeholderText = placeholderText.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
        mathBlocks.push(match);
        return `%%MATH_${mathBlocks.length - 1}%%`;
    });
    placeholderText = placeholderText.replace(/\\\(([\s\S]*?)\\\)/g, (match) => {
        mathBlocks.push(match);
        return `%%MATH_${mathBlocks.length - 1}%%`;
    });
    placeholderText = placeholderText.replace(/\$(?!\s)((?:\\\$|[^\$])+?)(?<!\s)\$/g, (match) => {
        mathBlocks.push(match);
        return `%%MATH_${mathBlocks.length - 1}%%`;
    });

    // 2. Identify blank spots: e.g. '_', '___', '[_]', '[___]'
    const blankRegex = /(?:\[\s*_{1,}\s*\]|(?<![a-zA-Z0-9\u00C0-\u017F])_{1,}(?![a-zA-Z0-9\u00C0-\u017F]))/g;
    let spotIndex = 0;
    placeholderText = placeholderText.replace(blankRegex, () => {
        const token = `%%FILL_SPOT_${spotIndex}%%`;
        spotIndex++;
        return token;
    });

    // 3. Restore math blocks before markdown parsing
    placeholderText = placeholderText.replace(/%%MATH_(\d+)%%/g, (_, idx) => mathBlocks[parseInt(idx, 10)] || '');

    // 4. Render Markdown and KaTeX math
    let renderedHtml = renderMathAndMarkdown(placeholderText);

    // 5. Replace each spot token with an interactive inline <input>
    const totalSpots = spotIndex;
    for (let i = 0; i < totalSpots; i++) {
        const enterHint = i < totalSpots - 1 ? 'next' : 'done';
        const inputHtml = `<input type="text" class="fill-blank-input" data-blank-index="${i}" enterkeyhint="${enterHint}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore="true" data-bwignore="true">`;
        renderedHtml = renderedHtml.replace(new RegExp(`%%FILL_SPOT_${i}%%`, 'g'), inputHtml);
    }

    return renderedHtml;
}

function initFillBlankInputs() {
    const inputs = Array.from(questionCard.querySelectorAll('.fill-blank-input'));
    if (inputs.length === 0) return;

    inputs.forEach((input, index) => {
        const updateWidth = () => {
            const len = input.value.length;
            input.style.width = Math.max(64, Math.min(240, (len + 2) * 11)) + 'px';
        };
        input.addEventListener('input', updateWidth);

        input.addEventListener('keydown', (e) => {
            if (e.isComposing) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                    inputs[index + 1].select();
                } else {
                    handleOpenSubmit();
                }
            }
        });
    });

    setTimeout(() => {
        inputs[0]?.focus();
    }, 50);
}

// --- STREAK COUNTER LOGIC & ANIMATIONS ---
function getStreakColorConfig(streak) {
    if (streak < 3) {
        return {
            active: false,
            gradient: '',
            border: '',
            glow: '',
            shimmerGradient: 'linear-gradient(0deg, transparent 0%, rgba(255, 255, 255, 0.8) 50%, transparent 100%)'
        };
    }
    if (streak === 3) {
        return {
            active: true,
            gradient: 'linear-gradient(135deg, #eab308, #ca8a04)',
            border: '#eab308',
            glow: '0 0 10px rgba(234, 179, 8, 0.45)',
            shimmerGradient: 'linear-gradient(0deg, transparent 0%, rgba(254, 240, 138, 0.9) 50%, transparent 100%)'
        };
    } else if (streak === 4) {
        return {
            active: true,
            gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
            border: '#f59e0b',
            glow: '0 0 12px rgba(245, 158, 11, 0.5)',
            shimmerGradient: 'linear-gradient(0deg, transparent 0%, rgba(253, 230, 138, 0.9) 50%, transparent 100%)'
        };
    } else if (streak === 5) {
        return {
            active: true,
            gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
            border: '#f97316',
            glow: '0 0 14px rgba(249, 115, 22, 0.55)',
            shimmerGradient: 'linear-gradient(0deg, transparent 0%, rgba(254, 215, 170, 0.9) 50%, transparent 100%)'
        };
    } else if (streak === 6) {
        return {
            active: true,
            gradient: 'linear-gradient(135deg, #fb923c, #dc2626)',
            border: '#ea580c',
            glow: '0 0 16px rgba(234, 88, 12, 0.6)',
            shimmerGradient: 'linear-gradient(0deg, transparent 0%, rgba(254, 205, 211, 0.9) 50%, transparent 100%)'
        };
    } else if (streak === 7) {
        return {
            active: true,
            gradient: 'linear-gradient(135deg, #f87171, #ef4444)',
            border: '#ef4444',
            glow: '0 0 18px rgba(239, 68, 68, 0.65)',
            shimmerGradient: 'linear-gradient(0deg, transparent 0%, rgba(254, 202, 202, 0.9) 50%, transparent 100%)'
        };
    } else if (streak === 8) {
        return {
            active: true,
            gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
            border: '#dc2626',
            glow: '0 0 20px rgba(220, 38, 38, 0.7)',
            shimmerGradient: 'linear-gradient(0deg, transparent 0%, rgba(255, 255, 255, 0.9) 50%, transparent 100%)'
        };
    } else if (streak === 9) {
        return {
            active: true,
            gradient: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            border: '#b91c1c',
            glow: '0 0 22px rgba(185, 28, 28, 0.75)',
            shimmerGradient: 'linear-gradient(0deg, transparent 0%, rgba(255, 255, 255, 0.95) 50%, transparent 100%)'
        };
    } else {
        return {
            active: true,
            gradient: 'linear-gradient(135deg, #e11d48, #991b1b)',
            border: '#e11d48',
            glow: '0 0 25px rgba(225, 29, 72, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
            shimmerGradient: 'linear-gradient(0deg, transparent 0%, rgba(255, 255, 255, 1) 50%, transparent 100%)'
        };
    }
}

function updateStreakUI(animate = false) {
    if (!streakPill || !streakCount) return;
    const config = getStreakColorConfig(currentStreak);

    streakCount.textContent = currentStreak;

    if (config.active) {
        if (streakBgColor) {
            streakBgColor.style.background = config.gradient;
            streakBgColor.style.opacity = '1';
        }
        streakPill.style.borderColor = config.border;
        streakPill.style.boxShadow = config.glow;
        streakPill.style.color = '#ffffff';

        if (streakFireIcon) {
            streakFireIcon.style.filter = 'none';
            streakFireIcon.style.opacity = '1';
            streakFireIcon.style.transform = currentStreak >= 8 ? 'scale(1.25)' : 'scale(1.1)';
        }

        streakCount.className = 'relative z-10 font-black tracking-tight text-xs text-white drop-shadow-sm';

        if (animate && streakShimmerSweep) {
            streakShimmerSweep.style.background = config.shimmerGradient;
            streakShimmerSweep.classList.remove('anim-streak-up', 'anim-streak-down');
            void streakShimmerSweep.offsetWidth;
            streakShimmerSweep.classList.add('anim-streak-up');

            streakPill.classList.remove('anim-streak-pop');
            void streakPill.offsetWidth;
            streakPill.classList.add('anim-streak-pop');
        }
    } else {
        if (streakBgColor) {
            streakBgColor.style.opacity = '0';
        }
        streakPill.style.borderColor = '';
        streakPill.style.boxShadow = '';
        streakPill.style.color = '';

        if (streakFireIcon) {
            streakFireIcon.style.filter = 'grayscale(1)';
            streakFireIcon.style.opacity = '0.6';
            streakFireIcon.style.transform = 'scale(0.95)';
        }

        streakCount.className = 'relative z-10 font-black tracking-tight text-xs text-gray-600';
    }
}

function incrementStreak() {
    currentStreak++;
    saveGameState();
    const shouldShimmer = currentStreak >= 3;
    updateStreakUI(shouldShimmer);
    if (shouldShimmer) {
        triggerHaptic('streakUp');
    }
}

function resetStreak() {
    lastStreakBeforeWrong = currentStreak;
    const hadStreak = currentStreak > 0;
    currentStreak = 0;
    saveGameState();

    if (hadStreak && streakShimmerSweep) {
        // Shimmer from top to bottom graying out the pill back to 0
        streakShimmerSweep.style.background = 'linear-gradient(180deg, rgba(156, 163, 175, 0.95) 0%, rgba(107, 114, 128, 0.9) 50%, rgba(75, 85, 99, 0.8) 100%)';
        streakShimmerSweep.classList.remove('anim-streak-up', 'anim-streak-down');
        void streakShimmerSweep.offsetWidth;
        streakShimmerSweep.classList.add('anim-streak-down');

        if (lastStreakBeforeWrong >= 3) {
            triggerHaptic('streakReset');
        }

        setTimeout(() => {
            updateStreakUI(false);
        }, 220);
    } else {
        updateStreakUI(false);
    }
}

function restoreStreakAfterAiCorrection() {
    currentStreak = lastStreakBeforeWrong + 1;
    saveGameState();
    updateStreakUI(currentStreak >= 3);
}

// --- HELPER: FILTER PLAYABLE CARDS (EXCLUDE DEVISORS / NOTES) ---
function isPlayableCard(card) {
    return card && card.type !== 'divisor' && card.type !== 'divider' && card.type !== 'note';
}

// --- SPACED REPETITION & LEAN ALGORITHM HELPERS ---

/**
 * Calculates repetition gap for cards based on thinking time.
 * Inversely proportional to thinking time:
 * - Hard cards (long thinking time): shorter gap (closer to min 5)
 * - Quick answers / fast misses: larger waiting line gap
 * Minimum gap is always 5 cards.
 */
function calculateThinkingGap(thinkingTimeSec) {
    const minGap = 5;
    const t = Math.max(0.8, thinkingTimeSec || 1);
    const bonus = Math.min(15, Math.max(0, Math.round(15 / t - 1)));
    const gap = minGap + bonus;
    console.log("[Algorithm] calculateThinkingGap:", {
        thinkingTime: Math.round(t * 10) / 10 + 's',
        bonus,
        finalGap: gap
    });
    return gap;
}

let precomputedNextCard = null;

/**
 * Selects the next card following adaptive spaced repetition and anti-monotony rules:
 * 1. Identifies dueCards (dueStep <= step), newCards (unseen), and futureCards (dueStep > step).
 * 2. When there's too much due (dueCards.length >= 3 or consecutiveDueCardsCount >= 2 with dueCards.length >= 2):
 *    - Injects a random card from nonDueCards (prioritizing unseen newCards) into the queue.
 *    - Guarantees at most 2 due cards in a row before a fresh card is interleaved.
 *    - Injects with ~35% organic probability during heavy due backlogs (dueCards.length >= 3).
 * 3. Otherwise picks randomly among dueCards (Requirement 5: avoids linear queue).
 * 4. If no due cards, picks randomly among unreviewed newCards.
 * 5. Fallback: picks randomly among cards with earliest future dueStep.
 */
function selectNextCard(candidateList, step) {
    if (!candidateList || candidateList.length === 0) return null;
    if (candidateList.length === 1) return candidateList[0];

    const dueCards = candidateList.filter(c => c.dueStep !== undefined && c.dueStep <= step);
    const newCards = candidateList.filter(c => c.dueStep === undefined);
    const futureCards = candidateList.filter(c => c.dueStep !== undefined && c.dueStep > step);
    const nonDueCards = newCards.length > 0 ? newCards : futureCards;

    if (dueCards.length > 0) {
        const canInjectRandom = nonDueCards.length > 0;
        const isTooMuchDue = dueCards.length >= 3;

        // Anti-repetition rule:
        // When there is too much due, inject a few random cards into the queue
        // - Guarantees a fresh card if the user has already answered 2 consecutive due cards
        // - Injects with ~35% probability during heavy backlogs (>= 3 due cards)
        const shouldInjectRandom = canInjectRandom && (
            (consecutiveDueCardsCount >= 2 && dueCards.length >= 2) ||
            (isTooMuchDue && Math.random() < 0.35)
        );

        if (shouldInjectRandom) {
            const injectedCard = nonDueCards[Math.floor(Math.random() * nonDueCards.length)];
            console.log("[Algorithm] Too much due (" + dueCards.length + " cards). Injetando card aleatório fresco na fila:", {
                desc: (injectedCard.description || '').slice(0, 35),
                tipo: newCards.length > 0 ? 'novo/não visto' : 'futuro',
                dueCount: dueCards.length,
                consecutiveDue: consecutiveDueCardsCount
            });
            return injectedCard;
        }

        // Random pick among due cards (prevents linear queue)
        const pickedDue = dueCards[Math.floor(Math.random() * dueCards.length)];
        console.log("[Algorithm] Card due selecionado:", {
            desc: (pickedDue.description || '').slice(0, 35),
            dueStep: pickedDue.dueStep,
            step,
            dueCount: dueCards.length,
            consecutiveDue: consecutiveDueCardsCount
        });
        return pickedDue;
    }

    // No cards due: pick randomly among unreviewed new cards
    if (newCards.length > 0) {
        const pickedNew = newCards[Math.floor(Math.random() * newCards.length)];
        console.log("[Algorithm] Card novo selecionado:", {
            desc: (pickedNew.description || '').slice(0, 35)
        });
        return pickedNew;
    }

    // Fallback: all remaining cards are scheduled in the future (dueStep > step)
    let minDue = Infinity;
    for (const c of candidateList) {
        const d = c.dueStep || 0;
        if (d < minDue) minDue = d;
    }
    const earliestCards = candidateList.filter(c => (c.dueStep || 0) === minDue);
    const pickedEarliest = earliestCards[Math.floor(Math.random() * earliestCards.length)] || candidateList[0];
    console.log("[Algorithm] Card futuro mais próximo selecionado:", {
        desc: (pickedEarliest?.description || '').slice(0, 35),
        minDue
    });
    return pickedEarliest;
}

/**
 * Precomputes candidate for the next step while the user is thinking on the current card.
 * Offloads algorithm execution from the animated "next card" transition.
 */
function precomputeNextCandidate() {
    if (!questionsPool || questionsPool.length === 0) {
        precomputedNextCard = null;
        return;
    }

    if (questionsPool.length === 1) {
        precomputedNextCard = questionsPool[0];
        console.log("[Algorithm] Apenas 1 card no pool. Próximo selecionado:", (precomputedNextCard.description || '').slice(0, 30));
        return;
    }

    const nextStep = currentStep + 1;
    // Exclude current card because any rescheduled card has gap >= 5, so it cannot be next
    const candidates = questionsPool.filter(c => c !== currentQuestion);
    precomputedNextCard = selectNextCard(candidates.length > 0 ? candidates : questionsPool, nextStep);
}

function schedulePrecomputeNextCard() {
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => precomputeNextCandidate(), { timeout: 100 });
    } else {
        setTimeout(precomputeNextCandidate, 0);
    }
}

function formatTimeDisplay(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function showDeckCompletionScreen() {
    try {
        clearBalls();
        isAnimating = false;
        document.getElementById('flying-card-to-header')?.remove();
        document.getElementById('anim-card-back-clone')?.remove();
        if (questionCard) {
            questionCard.style.opacity = '1';
            questionCard.style.transform = '';
            questionCard.classList.remove('glow-correct', 'glow-incorrect', 'card-shake');
        }
        precomputedNextCard = null;
        const completedSession = completeCurrentSession();
        showNotificationPill("Sessão concluída! Parabéns!", "stats.svg");
        
        // Silky-smooth translucent gradient shockwave (GPU-composited)
        playCompletionShockwave();
        
        // Lightweight victory confetti with small delay to keep framerates locked at 60fps
        setTimeout(() => {
            launchCelebrationParticles(45);
        }, 420);

        // Hide normal card UI elements
        deleteCardBtn?.classList.add('hidden');
        bookmarkCardBtn?.classList.add('hidden');
        questionImageContainer?.classList.add('hidden');
        if (questionImage) questionImage.src = '';
        questionText?.classList.add('hidden');
        ankiAnswerContainer?.classList.add('hidden');
        ankiControlsArea?.classList.add('hidden');
        actionButtonsArea?.classList.add('hidden');
        openAnswerArea?.classList.add('hidden');
        openDoubleAnswerArea?.classList.add('hidden');
        mcAnswerArea?.classList.add('hidden');
        flashcardAnswerForm?.classList.add('hidden');
        correctionOptions?.classList.add('hidden');

        // Populate completion stats
        const total = completedSession?.cardsAnswered || (allQuestions ? allQuestions.filter(isPlayableCard).length : 0);
        if (completionStatCards) {
            completionStatCards.textContent = total;
        }
        if (completionStatAcc) {
            const acc = completedSession?.accuracy !== undefined ? completedSession.accuracy : 
                (total > 0 && completedSession?.correctCount !== undefined ? Math.round((completedSession.correctCount / total) * 100) : 100);
            completionStatAcc.textContent = `${acc}%`;
        }
        if (completionStatTime) {
            completionStatTime.textContent = formatTimeDisplay(completedSession?.durationSeconds || 0);
        }
        if (completionStatStreak) {
            const streakVal = completedSession?.bestStreak || completedSession?.maxStreak || currentStreak || 0;
            completionStatStreak.textContent = streakVal;
        }
        if (deckCompletionSubtitle) {
            const dTitle = (deckTitle?.textContent || '').trim() || 'deste baralho';
            deckCompletionSubtitle.textContent = `Todos os cards de "${dTitle}" foram concluídos com sucesso nesta rodada!`;
        }

        // Unhide completion card holder view
        if (deckCompletionView) {
            deckCompletionView.classList.remove('hidden');
        }
        questionCard?.classList.remove('hidden');
    } catch (err) {
        console.error("[Game] Erro em showDeckCompletionScreen:", err);
        // Fallback: guarantee view is shown no matter what
        deckCompletionView?.classList.remove('hidden');
        questionCard?.classList.remove('hidden');
    }
}

function hideDeckCompletionScreen() {
    if (deckCompletionView) {
        deckCompletionView.classList.add('hidden');
    }
    if (questionText) {
        questionText.classList.remove('hidden');
    }
    if (flashcardAnswerForm) {
        flashcardAnswerForm.classList.remove('hidden');
    }
}

function restartDeckSession() {
    clearBalls();
    cleanShockwaveContainer();
    score = 0;
    currentStreak = 0;
    consecutiveDueCardsCount = 0;
    updateStreakUI(false);
    scoreDisplay.textContent = '0';
    if (allQuestions && allQuestions.length > 0) {
        allQuestions.forEach(q => {
            delete q.dueStep;
            delete q.correctStreak;
            delete q.wrongCount;
            delete q.isBeingCorrected;
        });
    }
    if (activeMode === 'exam') {
        let examData = {};
        try { examData = JSON.parse(localStorage.getItem('flashcardsExam')) || {}; } catch (e) {}
        const enabledDeckIds = new Set((examData.decks || []).filter(d => d.enabled !== false).map(d => d.id));
        const playable = allQuestions.filter(q => isPlayableCard(q) && (!q.deckId || enabledDeckIds.has(q.deckId)));
        questionsPool = shuffleArray(playable);
    } else {
        questionsPool = shuffleArray(allQuestions.filter(isPlayableCard));
    }
    currentStep = 0;
    precomputedNextCard = null;
    saveGameState(true);
    updateScoreDisplay();
    initStatsSession(deckTitle?.textContent || 'Flashcards', activeMode, questionsPool.length, 0, true);
    hideDeckCompletionScreen();
    loadQuestion();
    showNotificationPill("Baralho reiniciado!", "reset.svg");
    console.log("[Game] Baralho reiniciado com sucesso. Nova sessão de estatísticas iniciada.");
}

// Expose completion testing helpers globally
window.testDeckCompletion = showDeckCompletionScreen;
window.restartDeckSession = restartDeckSession;

// --- CORE GAME LOGIC ---
function loadQuestion() {
    questionsPool = questionsPool.filter(isPlayableCard);
    if (questionsPool.length === 0) {
        showDeckCompletionScreen();
        return;
    }

    currentStep++;
    resetUI();
    questionStartTime = Date.now();
    bookmarkCardBtn.classList.remove('hidden');
    questionsLeftDisplay.textContent = questionsPool.length;

    // Fast-path: use precomputed next card if valid and still in pool
    if (precomputedNextCard && questionsPool.includes(precomputedNextCard)) {
        currentQuestion = precomputedNextCard;
        currentQuestionIndexInPool = questionsPool.indexOf(precomputedNextCard);
    } else {
        // Fallback / Initial pick: use selectNextCard
        currentQuestion = selectNextCard(questionsPool, currentStep);
        currentQuestionIndexInPool = questionsPool.indexOf(currentQuestion);
    }

    // Always clear transient correction flags for the newly loaded card
    if (currentQuestion) {
        delete currentQuestion.isBeingCorrected;
    }
    isBeingCorrected = false;

    // Update consecutive due counter
    if (currentQuestion && currentQuestion.dueStep !== undefined && currentQuestion.dueStep <= currentStep) {
        consecutiveDueCardsCount++;
    } else {
        consecutiveDueCardsCount = 0;
    }

    console.log("[Game] Card carregado:", {
        step: currentStep,
        type: currentQuestion?.type,
        dueStep: currentQuestion?.dueStep,
        poolLeft: questionsPool.length,
        desc: (currentQuestion?.description || '').slice(0, 40)
    });

    // Clear precomputed slot and immediately queue precomputation for subsequent card in background
    precomputedNextCard = null;
    schedulePrecomputeNextCard();

    renderBookmarkIcon();
    hideHighlightPopup();

    ensureQuestionStructure();
    const sourceTagElem = document.getElementById('question-source-tag');
    const bodyElem = document.getElementById('question-body-text');
    const feedbackElem = document.getElementById('question-feedback-text');

    if (feedbackElem) {
        feedbackElem.innerHTML = '';
        feedbackElem.classList.add('hidden');
    }

    const formatQuestionText = (card) => {
        if (!card) return '';
        if (card.type === 'fill') {
            return renderFillBlanksQuestion(card.description || '');
        }
        return renderMathAndMarkdown(card.description || '');
    };

    if ((activeMode === 'notebook' || activeMode === 'exam') && currentQuestion.sourceDeck) {
        if (sourceTagElem) {
            sourceTagElem.textContent = currentQuestion.sourceDeck;
            sourceTagElem.classList.remove('hidden');
        }
        if (bodyElem) {
            bodyElem.innerHTML = formatQuestionText(currentQuestion);
        } else {
            const desc = formatQuestionText(currentQuestion);
            questionText.innerHTML = `<span class="text-xs uppercase tracking-wider text-blue-500 font-bold mb-1.5 block">${currentQuestion.sourceDeck}</span>${desc}`;
        }
    } else {
        if (sourceTagElem) {
            sourceTagElem.classList.add('hidden');
        }
        if (bodyElem) {
            bodyElem.innerHTML = formatQuestionText(currentQuestion);
        } else {
            questionText.innerHTML = formatQuestionText(currentQuestion);
        }
    }

    setupCardImageWithPlaceholder(currentQuestion.image, questionImage, questionImageContainer, questionImagePlaceholder);

    openAnswerArea.classList.add('hidden');
    openDoubleAnswerArea.classList.add('hidden');
    mcAnswerArea.classList.add('hidden');
    if (ankiAnswerContainer) ankiAnswerContainer.classList.add('hidden');
    if (ankiControlsArea) ankiControlsArea.classList.add('hidden');

    if (actionButtonsArea) actionButtonsArea.classList.remove('hidden');
    deleteCardBtn.classList.remove('hidden');

    if (currentQuestion.type === 'anki') {
        if (actionButtonsArea) actionButtonsArea.classList.add('hidden');
        if (ankiControlsArea) {
            ankiControlsArea.classList.remove('hidden');
            ankiUnflippedControls.classList.remove('hidden');
            ankiFlippedControls.classList.add('hidden');
        }
        isAnkiFlipped = false;
    } else if (currentQuestion.type === 'multiple_choice' && currentQuestion.options) {
        mcAnswerArea.classList.remove('hidden');
        submitBtn.classList.add('hidden'); // MCQ submits on click
        renderDynamicMcOptions(currentQuestion.options);
    } else if (currentQuestion.type === 'open_double') {
        openDoubleAnswerArea.classList.remove('hidden');
        submitBtn.classList.remove('hidden');
        answerInput1.placeholder = currentQuestion.placeholder1 || 'Resposta 1';
        answerInput2.placeholder = currentQuestion.placeholder2 || 'Resposta 2';
        answerInput1.focus();
    } else if (currentQuestion.type === 'fill') {
        submitBtn.classList.remove('hidden');
        initFillBlankInputs();
    } else {
        openAnswerArea.classList.remove('hidden');
        submitBtn.classList.remove('hidden');
        answerInput.focus();
    }
    currentChatSession = null;

    if (isFirstQuestion) {
        chatMessages.innerHTML = ''; // Limpa o placeholder inicial do HTML
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'chat-message-ai';
        welcomeMsg.textContent = 'Olá! Como posso ajudar você a entender melhor esta questão?';
        chatMessages.appendChild(welcomeMsg);
        isFirstQuestion = false;
    } else if (hasChatInteraction) {
        // Adiciona o separador ondulado apenas se houve interação na questão anterior
        const separator = document.createElement('div');
        separator.className = 'chat-separator';
        separator.innerHTML = `
            <img src="../assets/img/wavy.svg" alt="separador">
            <span class="chat-question-label">Nova Questão</span>
        `;
        chatMessages.appendChild(separator);

        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'chat-message-ai';
        welcomeMsg.textContent = 'Olá! Como posso ajudar você a entender melhor esta questão?';
        chatMessages.appendChild(welcomeMsg);

        // Garantir que o scroll vá para o final para mostrar a nova mensagem
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);

        hasChatInteraction = false;
    }
}

function renderDynamicMcOptions(rawOptions) {
    mcAnswerArea.innerHTML = '';
    const options = [...rawOptions].filter(Boolean);
    shuffleArray(options);

    // Responsive grid classes for 2 to 6 options
    if (options.length === 2) {
        mcAnswerArea.className = "grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10";
    } else if (options.length === 3) {
        mcAnswerArea.className = "grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10";
    } else if (options.length === 4) {
        mcAnswerArea.className = "grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10";
    } else {
        mcAnswerArea.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10";
    }

    options.forEach(optText => {
        const btn = document.createElement('button');
        btn.className = "mc-option-btn w-full";
        btn.textContent = optText;
        btn.onclick = () => handleMCSubmit(btn);
        mcAnswerArea.appendChild(btn);
    });
}

function formatMultiParagraphText(text) {
    if (!text) return '';
    if (/<(p|br|div|mark)[\s>]/i.test(text)) {
        return text;
    }
    const paragraphs = text.split(/\r?\n\r?\n/);
    if (paragraphs.length > 1) {
        return paragraphs.map(p => `<p class="mb-2 last:mb-0">${p.trim()}</p>`).join('');
    }
    return text;
}

function flipAnkiCard() {
    if (currentQuestion.type !== 'anki' || isAnkiFlipped) return;
    isAnkiFlipped = true;

    if (ankiAnswerContainer) {
        ankiAnswerText.innerHTML = renderMathAndMarkdown(currentQuestion.answer || '');
        setupCardImageWithPlaceholder(currentQuestion.answerImage, ankiAnswerImage, ankiAnswerImageContainer, ankiAnswerImagePlaceholder);
        ankiAnswerContainer.classList.remove('hidden');
    }

    if (ankiUnflippedControls) ankiUnflippedControls.classList.add('hidden');
    if (ankiFlippedControls) ankiFlippedControls.classList.remove('hidden');
}

function handleAnkiRating(rating) {
    if (currentQuestion.type !== 'anki' || !isAnkiFlipped) return;
    if (isAnimating) {
        console.warn("[Anki] Avaliação ignorada: animação em andamento.");
        return;
    }

    const elapsedSeconds = (Date.now() - questionStartTime) / 1000;
    console.log("[Anki] Avaliando card:", { rating, elapsedSeconds: Math.round(elapsedSeconds * 10) / 10 + 's' });

    try {
        recordStatsAnswer({
            card: currentQuestion,
            isCorrect: (rating === 'good' || rating === 'easy'),
            rating: rating,
            timeSpentSeconds: elapsedSeconds
        });
    } catch (e) {
        console.error("[Anki] Erro ao gravar stats anki:", e);
    }

    if (rating === 'easy') {
        const isLastCard = questionsPool.length === 1 && questionsPool.includes(currentQuestion);
        if (!isLastCard) {
            createBall(true);
            questionCard.classList.add('glow-correct');
        }
        triggerHaptic('correct');

        currentQuestion.correctStreak = (currentQuestion.correctStreak || 0) + 1;
        const totalWrongs = currentQuestion.wrongCount || 0;
        const isLeech = totalWrongs > 4;
        const shouldRemove = !isLeech || currentQuestion.correctStreak >= 2;

        if (shouldRemove) {
            score++;
            const idx = questionsPool.indexOf(currentQuestion);
            if (idx !== -1) {
                questionsPool.splice(idx, 1);
            } else if (currentQuestionIndexInPool >= 0 && currentQuestionIndexInPool < questionsPool.length) {
                questionsPool.splice(currentQuestionIndexInPool, 1);
            }
            saveGameState();
            console.log("[Anki] Card removido do deck (acerto fácil). Restam:", questionsPool.length);

            // On the last card of deck, skip normal animations and play end game directly!
            if (questionsPool.length === 0) {
                clearBalls();
                questionCard.classList.remove('glow-correct', 'glow-incorrect', 'card-shake');
                updateScoreDisplay();
                showDeckCompletionScreen();
                return;
            }

            setTimeout(() => {
                animateCardToHeader(() => {
                    updateScoreDisplay();
                    loadQuestion();
                });
            }, 300);
        } else {
            // Leech card (>4 errors): maintain in game until guessed right 2x
            currentQuestion.dueStep = currentStep + 8;
            saveGameState();
            console.log("[Anki] Card leech reagendado para dueStep:", currentQuestion.dueStep);
            setTimeout(() => {
                animateCardToBack(() => {
                    loadQuestion();
                });
            }, 300);
        }
    } else if (rating === 'good') {
        createBall(true);
        currentQuestion.correctStreak = (currentQuestion.correctStreak || 0) + 1;
        currentQuestion.dueStep = currentStep + 12;
        saveGameState();
        console.log("[Anki] Card marcado como bom. Próximo dueStep:", currentQuestion.dueStep);
        animateCardToBack(() => {
            loadQuestion();
        });
    } else if (rating === 'hard') {
        createBall(false);
        currentQuestion.dueStep = currentStep + 7;
        saveGameState();
        console.log("[Anki] Card marcado como difícil. Próximo dueStep:", currentQuestion.dueStep);
        animateCardToBack(() => {
            loadQuestion();
        });
    } else if (rating === 'again') {
        createBall(false);
        questionCard.classList.remove('card-shake');
        void questionCard.offsetWidth;
        questionCard.classList.add('card-shake');
        triggerHaptic('shake');
        setTimeout(() => questionCard.classList.remove('card-shake'), 450);

        currentQuestion.wrongCount = (currentQuestion.wrongCount || 0) + 1;
        currentQuestion.correctStreak = 0;
        // Requirement 2: at least 5 cards gap
        currentQuestion.dueStep = currentStep + 5;
        saveGameState();
        console.log("[Anki] Card marcado como erro (again). Próximo dueStep:", currentQuestion.dueStep);
        setTimeout(() => {
            animateCardToBack(() => {
                loadQuestion();
            });
        }, 400);
    }
}

let isOpenSubmitting = false;
let isBeingCorrected = false;

function resetUI() {
    isOpenSubmitting = false;
    isAnimating = false;
    isBeingCorrected = false;
    hideHighlightPopup();
    hideDeckCompletionScreen();
    [answerInput, answerInput1, answerInput2].forEach(inp => {
        inp.value = ''; inp.disabled = false;
        inp.classList.remove('animate-pulse', 'border-red-500');
    });
    answerInput.placeholder = 'Digite sua resposta aqui...';

    const fillInputs = questionCard.querySelectorAll('.fill-blank-input');
    fillInputs.forEach(inp => {
        inp.disabled = false;
        inp.readOnly = false;
        inp.classList.remove('animate-pulse', 'border-red-500', 'border-green-500', 'border-amber-400', 'bg-amber-50', 'bg-green-50', 'bg-red-50', 'text-amber-800', 'fill-box-shake', 'fill-box-pop', 'fill-box-pop-yellow');
    });

    if (currentQuestion) {
        delete currentQuestion.isBeingCorrected;
    }
    isAnkiFlipped = false;
    if (ankiAnswerContainer) ankiAnswerContainer.classList.add('hidden');
    if (ankiAnswerImageContainer) ankiAnswerImageContainer.classList.add('hidden');
    if (ankiAnswerImagePlaceholder) ankiAnswerImagePlaceholder.classList.add('hidden');
    if (ankiAnswerImage) {
        ankiAnswerImage.classList.add('hidden');
        ankiAnswerImage.classList.remove('opacity-100');
        ankiAnswerImage.classList.add('opacity-0');
        ankiAnswerImage.src = '';
    }
    if (ankiControlsArea) ankiControlsArea.classList.add('hidden');

    submitBtn.disabled = false;
    submitBtn.classList.remove('hidden');
    nextQuestionBtn.classList.add('hidden');
    correctionOptions.classList.add('hidden');
    correctionOptions.classList.remove('flex');
    questionCard.classList.remove('glow-correct', 'glow-incorrect', 'card-shake');
    questionText.classList.remove('text-red-500', 'text-green-500');

    const feedbackElem = document.getElementById('question-feedback-text');
    if (feedbackElem) {
        feedbackElem.innerHTML = '';
        feedbackElem.classList.add('hidden');
    }

    const dynamicMcBtns = mcAnswerArea.querySelectorAll('.mc-option-btn');
    dynamicMcBtns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('bg-green-500', 'bg-red-500', 'text-white');
        btn.classList.add('bg-gray-200');
    });

    console.log("[Game] resetUI executado: campos limpos e botões reativados.");
}

function handleFillSubmit() {
    // Auto-heal: se o botão de verificar está ativo/habilitado e visível, não estamos em estado de correção
    if (submitBtn && !submitBtn.disabled && !submitBtn.classList.contains('hidden')) {
        isBeingCorrected = false;
        if (currentQuestion) delete currentQuestion.isBeingCorrected;
    }

    console.log("[Game] handleFillSubmit chamado.", {
        isOpenSubmitting,
        btnDisabled: submitBtn?.disabled,
        isBeingCorrected: isBeingCorrected || currentQuestion?.isBeingCorrected,
        isAnimating
    });

    if (isOpenSubmitting || submitBtn.disabled || isBeingCorrected || currentQuestion?.isBeingCorrected || isAnimating) {
        console.warn("[Game] Submissão fill bloqueada por flag:", {
            isOpenSubmitting,
            btnDisabled: submitBtn?.disabled,
            isBeingCorrected: isBeingCorrected || currentQuestion?.isBeingCorrected,
            isAnimating
        });
        return;
    }
    const inputs = Array.from(questionCard.querySelectorAll('.fill-blank-input'));
    if (inputs.length === 0) {
        console.warn("[Game] Nenhuma lacuna .fill-blank-input encontrada no card.");
        return;
    }

    const userAnswers = inputs.map(inp => inp.value.trim());
    if (userAnswers.every(ans => !ans)) {
        console.warn("[Game] Submissão fill ignorada: todas as lacunas estão vazias.");
        inputs[0].classList.add('animate-pulse', 'border-red-500');
        setTimeout(() => inputs[0].classList.remove('animate-pulse', 'border-red-500'), 800);
        inputs[0].focus();
        return;
    }

    isOpenSubmitting = true;

    try {
        const rawExpected = currentQuestion.answers && currentQuestion.answers.length > 0
            ? currentQuestion.answers
            : String(currentQuestion.answer || '').split(';').map(s => s.trim());

        let allCorrect = true;
        const blankResults = inputs.map((input, i) => {
            const userVal = userAnswers[i] || '';
            const expectedVal = rawExpected[i] || '';
            const synonyms = expectedVal.split('/').map(s => s.trim()).filter(Boolean);

            const maxSim = synonyms.length > 0
                ? Math.max(...synonyms.map(syn => calculateSimilarity(normalizeString(userVal), normalizeString(syn))))
                : 0;
            const isCorrect = maxSim >= 0.8;

            if (!isCorrect) allCorrect = false;

            return { input, userVal, expectedVal, synonyms, isCorrect, maxSim };
        });

        console.log("[Game] Lacunas avaliadas:", {
            allCorrect,
            results: blankResults.map(r => ({
                user: r.userVal,
                expected: r.expectedVal,
                similarity: Math.round(r.maxSim * 100) + '%',
                isCorrect: r.isCorrect
            }))
        });

        currentQuestion._lastUserAnswer = userAnswers.join(' ; ');

        if (allCorrect) {
            inputs.forEach(input => {
                input.readOnly = true;
                input.blur();
                input.classList.remove('border-dashed', 'border-blue-400');
                input.classList.add('border-solid', 'border-green-500', 'bg-green-50', 'text-green-600');
            });
            showFeedback(true);
        } else {
            isAnimating = true;

            // Phase 1: Correct boxes turn green immediately; wrong boxes turn red and shake side-to-side for ~500ms
            blankResults.forEach(({ input, isCorrect }) => {
                input.readOnly = true;
                input.blur();
                input.classList.remove('border-dashed', 'border-blue-400', 'border-green-500', 'border-red-500', 'border-amber-400', 'bg-green-50', 'bg-red-50', 'bg-amber-50', 'text-green-600', 'text-red-600', 'text-amber-800', 'fill-box-shake', 'fill-box-pop', 'fill-box-pop-yellow');

                if (isCorrect) {
                    input.classList.add('border-solid', 'border-green-500', 'bg-green-50', 'text-green-600');
                } else {
                    input.classList.add('border-solid', 'border-red-500', 'bg-red-50', 'text-red-600', 'fill-box-shake');
                }
            });

            triggerHaptic('shake');
            showFeedback(false);

            // Phase 2: At ~550ms, wrong boxes pop yellow with the right answer so user knows where to focus (total duration ~1.2s)
            setTimeout(() => {
                let anyPopped = false;
                blankResults.forEach(({ input, synonyms, expectedVal, isCorrect }) => {
                    if (!isCorrect) {
                        anyPopped = true;
                        const primaryExpected = synonyms[0] || expectedVal;
                        input.classList.remove('border-red-500', 'bg-red-50', 'text-red-600', 'fill-box-shake');
                        input.classList.add('border-solid', 'border-amber-400', 'bg-amber-50', 'text-amber-800', 'fill-box-pop-yellow');
                        input.value = primaryExpected;
                        if (synonyms.length > 1) {
                            input.title = synonyms.join(' / ');
                        }

                        // Dynamically adjust box width to fit the correct answer comfortably
                        const len = primaryExpected.length;
                        input.style.width = Math.max(64, Math.min(240, (len + 2) * 11)) + 'px';
                    }
                });

                if (anyPopped) {
                    triggerHaptic('fillPop');
                }

                // Unlock next navigation once the 1.2s correction animation completes
                setTimeout(() => {
                    isAnimating = false;
                }, 650);
            }, 550);
        }
    } catch (err) {
        console.error("[Game] Erro durante handleFillSubmit:", err);
        isOpenSubmitting = false;
        isAnimating = false;
    }
}

function handleOpenSubmit() {
    // Auto-heal: se o botão de verificar está ativo/habilitado e visível, não estamos em estado de correção
    if (submitBtn && !submitBtn.disabled && !submitBtn.classList.contains('hidden')) {
        isBeingCorrected = false;
        if (currentQuestion) delete currentQuestion.isBeingCorrected;
    }

    console.log("[Game] handleOpenSubmit acionado.", {
        type: currentQuestion?.type,
        isOpenSubmitting,
        btnDisabled: submitBtn?.disabled,
        isBeingCorrected: isBeingCorrected || currentQuestion?.isBeingCorrected
    });

    if (isOpenSubmitting || submitBtn.disabled || isBeingCorrected || currentQuestion?.isBeingCorrected) {
        console.warn("[Game] handleOpenSubmit bloqueado por flag:", {
            isOpenSubmitting,
            btnDisabled: submitBtn?.disabled,
            isBeingCorrected: isBeingCorrected || currentQuestion?.isBeingCorrected
        });
        return;
    }
    const type = currentQuestion?.type;

    if (type === 'fill') {
        handleFillSubmit();
        return;
    }

    const ans1 = normalizeString(answerInput.value);
    const ans1_d = normalizeString(answerInput1.value);
    const ans2_d = normalizeString(answerInput2.value);

    if (type === 'open_double') {
        if (!ans1_d || !ans2_d) {
            console.warn("[Game] Submissão open_double ignorada: campos incompletos.", { ans1_d, ans2_d });
            if (!ans1_d) {
                answerInput1.classList.add('animate-pulse', 'border-red-500');
                setTimeout(() => answerInput1.classList.remove('animate-pulse', 'border-red-500'), 800);
                answerInput1.focus();
            } else {
                answerInput2.classList.add('animate-pulse', 'border-red-500');
                setTimeout(() => answerInput2.classList.remove('animate-pulse', 'border-red-500'), 800);
                answerInput2.focus();
            }
            return;
        }
    } else {
        if (!ans1) {
            console.warn("[Game] Submissão ignorada: campo de resposta vazio.");
            answerInput.classList.add('animate-pulse', 'border-red-500');
            setTimeout(() => answerInput.classList.remove('animate-pulse', 'border-red-500'), 800);
            answerInput.focus();
            return;
        }
    }

    isOpenSubmitting = true;

    try {
        const correct1 = String(currentQuestion?.answer || "").split('/').map(s => s.trim()).filter(Boolean);
        const correct2 = String(currentQuestion?.answer2 || "").split('/').map(s => s.trim()).filter(Boolean);

        const sim1 = type === 'open_double'
            ? (correct1.length > 0 ? Math.max(...correct1.map(c => calculateSimilarity(ans1_d, normalizeString(c)))) : 0)
            : (correct1.length > 0 ? Math.max(...correct1.map(c => calculateSimilarity(ans1, normalizeString(c)))) : 0);

        const sim2 = type === 'open_double'
            ? (correct2.length > 0 ? Math.max(...correct2.map(c => calculateSimilarity(ans2_d, normalizeString(c)))) : 0)
            : 1.0;

        const isCorrect1 = sim1 >= 0.8;
        const isCorrect2 = sim2 >= 0.8;
        const isCorrect = isCorrect1 && isCorrect2;

        console.log("[Game] Resposta do usuário avaliada:", {
            type,
            userAnswer: type === 'open_double' ? `${ans1_d} | ${ans2_d}` : ans1,
            expected: type === 'open_double' ? `${currentQuestion.answer} | ${currentQuestion.answer2}` : currentQuestion.answer,
            sim1: Math.round(sim1 * 100) + '%',
            sim2: Math.round(sim2 * 100) + '%',
            isCorrect
        });

        showFeedback(isCorrect);
    } catch (err) {
        console.error("[Game] Erro durante handleOpenSubmit:", err);
        isOpenSubmitting = false;
    }
}

function handleMCSubmit(btn) {
    if (btn.disabled) return;
    const isCorrect = normalizeString(btn.textContent) === normalizeString(currentQuestion.answer);
    console.log("[Game] Opção múltipla escolha clicada:", {
        chosen: btn.textContent,
        expected: currentQuestion.answer,
        isCorrect
    });
    showFeedback(isCorrect, btn);
}

function showFeedback(isCorrect, element) {
    try {
        console.log("[Game] showFeedback executado:", {
            isCorrect,
            cardType: currentQuestion?.type,
            step: currentStep,
            score
        });

        // Capturar a resposta do usuário para o contexto do chat de IA
        let userAnswer = "";
        if (currentQuestion.type === 'open_double') {
            userAnswer = `${answerInput1.value} ; ${answerInput2.value}`;
        } else if (currentQuestion.type === 'multiple_choice') {
            userAnswer = element ? element.textContent : "";
        } else if (currentQuestion.type === 'fill') {
            const fillInputs = Array.from(questionCard.querySelectorAll('.fill-blank-input'));
            userAnswer = currentQuestion._lastUserAnswer || fillInputs.map(inp => inp.value.trim()).join(' ; ');
        } else {
            userAnswer = answerInput.value;
        }
        lastUserAnswerForChat = userAnswer;

        const elapsedSeconds = (Date.now() - questionStartTime) / 1000;
        try {
            recordStatsAnswer({
                card: currentQuestion,
                isCorrect: isCorrect,
                rating: isCorrect ? 'correct' : 'incorrect',
                timeSpentSeconds: elapsedSeconds,
                userAnswer: userAnswer
            });
        } catch (statErr) {
            console.error("[Game] Erro ao registrar estatística (não bloqueante):", statErr);
        }

        const isLastCard = isCorrect && (questionsPool.length === 1 && questionsPool.includes(currentQuestion));
        const ballIdx = !isLastCard ? createBall(isCorrect) : null;
        if (!isLastCard) {
            questionCard.classList.add(isCorrect ? 'glow-correct' : 'glow-incorrect');
        }

        if (isCorrect) {
            triggerHaptic('correct');
        }

        // Update streak counter (Anki cards are handled separately and do NOT touch streak)
        if (currentQuestion && currentQuestion.type !== 'anki') {
            if (isCorrect) {
                incrementStreak();
            } else {
                resetStreak();
            }
        }

        if (!isCorrect && isAiEnabled) {
            askAiBtn.classList.remove('hidden');
            if (userAnswer) {
                checkAnswerWithAi(currentQuestion, userAnswer, ballIdx);
            }
        } else {
            askAiBtn.classList.add('hidden');
        }

        if (element) {
            const dynamicMcBtns = mcAnswerArea.querySelectorAll('.mc-option-btn');
            dynamicMcBtns.forEach(b => b.disabled = true);
            element.classList.add(isCorrect ? 'mc-correct' : 'mc-incorrect');
            if (!isCorrect) {
                dynamicMcBtns.forEach(b => {
                    if (normalizeString(b.textContent) === normalizeString(currentQuestion.answer)) b.classList.add('mc-correct');
                });
            }
        }

        if (!isCorrect) {
            if (currentQuestion.type !== 'fill') {
                // Card shakes on wrong guess and waits for user to skip/ask/edit/delete
                questionCard.classList.remove('card-shake');
                void questionCard.offsetWidth; // Force reflow
                questionCard.classList.add('card-shake');
                triggerHaptic('shake');
                setTimeout(() => questionCard.classList.remove('card-shake'), 450);
            }

            isBeingCorrected = true;
            currentQuestion.isBeingCorrected = true;
            isOpenSubmitting = false;

            // Spaced repetition & leech tracking
            currentQuestion.wrongCount = (currentQuestion.wrongCount || 0) + 1;
            currentQuestion.correctStreak = 0;
            const gap = calculateThinkingGap(elapsedSeconds);
            currentQuestion.dueStep = currentStep + gap;
            console.log("[Algorithm] Card incorreto reagendado:", {
                tempoPensamento: Math.round(elapsedSeconds * 10) / 10 + 's',
                gap,
                currentStep,
                dueStep: currentQuestion.dueStep,
                totalErros: currentQuestion.wrongCount
            });
            saveGameState();
            precomputeNextCandidate();

            if (!element) {
                updateFeedbackText();
                submitBtn.classList.add('hidden');
                submitBtn.disabled = true;
                [answerInput, answerInput1, answerInput2].forEach(inp => {
                    if (inp) inp.disabled = true;
                });
                if (currentQuestion.type !== 'fill') {
                    const fillInputs = questionCard.querySelectorAll('.fill-blank-input');
                    fillInputs.forEach(inp => inp.disabled = true);
                }
            }
            nextQuestionBtn.classList.remove('hidden');
            correctionOptions.classList.add('flex');
            correctionOptions.classList.remove('hidden');
        } else {
            isBeingCorrected = false;
            delete currentQuestion.isBeingCorrected;
            currentQuestion.correctStreak = (currentQuestion.correctStreak || 0) + 1;
            const totalWrongs = currentQuestion.wrongCount || 0;
            // Requirement 4: If guessed wrong >4x, keep in game until guessed right 2x
            const isLeech = totalWrongs > 4;
            const shouldRemove = !isLeech || currentQuestion.correctStreak >= 2;

            console.log("[Algorithm] Card correto avaliado:", {
                totalWrongs,
                correctStreak: currentQuestion.correctStreak,
                isLeech,
                shouldRemove
            });

            if (shouldRemove) {
                score++;
                const idx = questionsPool.indexOf(currentQuestion);
                if (idx !== -1) {
                    questionsPool.splice(idx, 1);
                } else if (currentQuestionIndexInPool >= 0 && currentQuestionIndexInPool < questionsPool.length) {
                    questionsPool.splice(currentQuestionIndexInPool, 1);
                }
                saveGameState();
                console.log("[Game] Card removido do pool ativo. Restam:", questionsPool.length);

                // On the last card of deck, skip normal animations and play end game directly!
                if (questionsPool.length === 0) {
                    clearBalls();
                    questionCard.classList.remove('glow-correct', 'glow-incorrect', 'card-shake');
                    updateScoreDisplay();
                    showDeckCompletionScreen();
                    return;
                }

                setTimeout(() => {
                    animateCardToHeader(() => {
                        updateScoreDisplay();
                        loadQuestion();
                    });
                }, 400);
            } else {
                // Leech card: maintain in game until guessed right 2x
                currentQuestion.dueStep = currentStep + 5;
                saveGameState();
                console.log("[Game] Card leech mantido no jogo até 2 acertos. dueStep:", currentQuestion.dueStep);
                setTimeout(() => {
                    animateCardToBack(() => {
                        loadQuestion();
                    });
                }, 400);
            }
        }
    } catch (err) {
        console.error("[Game] Erro fatal em showFeedback:", err);
        isOpenSubmitting = false;
    }
}

function updateFeedbackText() {
    ensureQuestionStructure();
    const bodyElem = document.getElementById('question-body-text');
    const feedbackElem = document.getElementById('question-feedback-text');

    if (currentQuestion && (isBeingCorrected || currentQuestion.isBeingCorrected)) {
        if (bodyElem && currentQuestion.type !== 'fill') {
            bodyElem.innerHTML = renderMathAndMarkdown(currentQuestion.description || '');
        }
        let feedbackHtml = '';
        if (currentQuestion.type === 'open_double') {
            const label1 = currentQuestion.placeholder1 || 'Resposta 1';
            const label2 = currentQuestion.placeholder2 || 'Resposta 2';
            const a1 = (currentQuestion.answer || '').replace('/', ' ou ');
            const a2 = (currentQuestion.answer2 || '').replace('/', ' ou ');
            feedbackHtml = `
                <span class="text-green-500 font-semibold mt-2 block">${label1}: ${a1}</span>
                <span class="text-green-500 font-semibold mt-2 block">${label2}: ${a2}</span>
            `;
        } else if (currentQuestion.type === 'fill') {
            feedbackHtml = '';
        } else if (currentQuestion.type === 'anki') {
            feedbackHtml = `<span class="text-indigo-500 font-semibold mt-2 block">Resposta: ${currentQuestion.answer || ''}</span>`;
        } else {
            const a1 = (currentQuestion.answer || '').replace('/', ' ou ');
            feedbackHtml = `<span class="text-green-500 font-semibold mt-2 block">Resposta: ${a1}</span>`;
        }

        if (feedbackElem) {
            feedbackElem.innerHTML = feedbackHtml;
            if (feedbackHtml) {
                feedbackElem.classList.remove('hidden');
            } else {
                feedbackElem.classList.add('hidden');
            }
        } else if (feedbackHtml) {
            questionText.innerHTML = `${renderMathAndMarkdown(currentQuestion.description || '')}<br>${feedbackHtml}`;
        }
    } else {
        if (bodyElem && currentQuestion && currentQuestion.type !== 'fill') {
            bodyElem.innerHTML = renderMathAndMarkdown(currentQuestion.description || '');
        }
        if (feedbackElem) {
            feedbackElem.innerHTML = '';
            feedbackElem.classList.add('hidden');
        }
    }
}

let saveStateTimeout = null;

function executeSaveGameState() {
    saveStateTimeout = null;
    try {
        if (questionsPool) questionsPool.forEach(q => { if (q) delete q.isBeingCorrected; });
        if (allQuestions) allQuestions.forEach(q => { if (q) delete q.isBeingCorrected; });

        if (activeMode === 'notebook') {
            localStorage.setItem('flashcardsNotebook', JSON.stringify({
                questionsPool, allQuestions, score, currentStreak, currentStep, consecutiveDueCardsCount, deckTitle: "Caderno"
            }));
        } else if (activeMode === 'exam') {
            let examData = {};
            try {
                examData = JSON.parse(localStorage.getItem('flashcardsExam')) || {};
            } catch (err) {}
            localStorage.setItem('flashcardsExam', JSON.stringify({
                ...examData,
                questionsPool,
                allQuestions,
                score,
                currentStreak,
                currentStep,
                consecutiveDueCardsCount,
                deckTitle: "Semana de Provas"
            }));
        } else {
            localStorage.setItem('flashcardsSave', JSON.stringify({
                questionsPool, allQuestions, score, currentStreak, currentStep, consecutiveDueCardsCount, deckTitle: deckTitle.textContent
            }));
        }
    } catch (e) {
        console.error("Erro ao salvar estado do jogo no localStorage:", e);
    }
}

function saveGameState(immediate = false) {
    if (immediate) {
        if (saveStateTimeout) {
            clearTimeout(saveStateTimeout);
            saveStateTimeout = null;
        }
        executeSaveGameState();
        return;
    }

    if (!saveStateTimeout) {
        saveStateTimeout = setTimeout(() => {
            executeSaveGameState();
        }, 80);
    }
}

window.addEventListener('beforeunload', () => {
    if (saveStateTimeout) {
        clearTimeout(saveStateTimeout);
        executeSaveGameState();
    }
});
window.addEventListener('pagehide', () => {
    if (saveStateTimeout) {
        clearTimeout(saveStateTimeout);
        executeSaveGameState();
    }
});

function updateScoreDisplay() {
    const scoreVal = document.getElementById('score');
    const scoreContainer = document.getElementById('score-container');
    if (scoreVal) scoreVal.textContent = score;
    if (scoreContainer) scoreContainer.classList.remove('hidden');
}

// --- AI LOGIC ---
function updateAiUI() {
    if (isAiEnabled) {
        if (menuAiIcon) menuAiIcon.src = '../assets/img/enabled_ai.svg';
        if (menuAiStatusBadge) {
            menuAiStatusBadge.textContent = 'Ativada';
            menuAiStatusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700';
        }
        if (menuAiSubtitle) menuAiSubtitle.textContent = 'Verificação inteligente ativa';
        if (aiIconOff) aiIconOff.classList.add('hidden');
        if (aiIconOn) aiIconOn.classList.remove('hidden');
    } else {
        if (menuAiIcon) menuAiIcon.src = '../assets/img/config_ai.svg';
        if (menuAiStatusBadge) {
            menuAiStatusBadge.textContent = 'Desativada';
            menuAiStatusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500';
        }
        if (menuAiSubtitle) menuAiSubtitle.textContent = 'Clique para configurar';
        if (aiIconOff) aiIconOff.classList.remove('hidden');
        if (aiIconOn) aiIconOn.classList.add('hidden');
    }
}

function initializeAi() {
    if (geminiApiKey) {
        genAI = new GoogleGenerativeAI(geminiApiKey);
        isAiEnabled = true;
    }
    updateAiUI();
}

async function checkAnswerWithAi(questionObj, actualAnswer, ballIdx) {
    if (!isAiEnabled || !genAI) return;
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-lite-latest",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        correto: {
                            type: "BOOLEAN",
                            description: "true se a resposta do usuário for semanticamente correta ou variação aceitável, false se estiver incorreta ou contiver erros factuais."
                        },
                        justificativa: {
                            type: "STRING",
                            description: "Breve explicação do porquê a resposta foi considerada correta ou incorreta."
                        }
                    },
                    required: ["correto", "justificativa"]
                }
            }
        });

        const expected = (questionObj.type === 'fill' && questionObj.answers && questionObj.answers.length > 0)
            ? questionObj.answers.join(' ; ')
            : [questionObj.answer, questionObj.answer2].filter(Boolean).join(' / ');

        const prompt = `
            Você é um revisor de flashcards acadêmicos rigoroso. 
            O sistema automático marcou a resposta do usuário como incorreta. Avalie se a resposta digitada é semanticamente válida ou uma variação aceitável em relação à resposta esperada.

            Pergunta: "${questionObj.description}"
            Resposta(s) Esperada(s) no Banco: "${expected}"
            Resposta Digitada pelo Usuário: "${actualAnswer}"

            DIRETRIZES DE AVALIAÇÃO:
            1. Se o usuário usou um sinônimo exato, termo equivalente aceito pela comunidade acadêmica ou abreviação padrão, considere CORRETO (correto: true).
            2. Se o usuário digitou uma parte fundamental suficiente para demonstrar conhecimento técnico exato (ex: "Braquial" para "Músculo braquial"), considere CORRETO (correto: true).
            3. Se a questão pedir múltiplos valores, durações ou sequências (ex: em ordem ou 'respectivamente'), TODOS os valores/sequências devem estar corretos. Se qualquer valor numérico ou duração estiver incorreto (ex: 50 ms em vez de 40 ms, ou números errados na sequência), considere INCORRETO (correto: false).
            4. Se a resposta contiver erros factuais, dados numéricos incorretos, for vaga ou sobre outra estrutura, considere INCORRETO (correto: false).

            Retorne um JSON com 'correto' (boolean) e 'justificativa' (string).
        `;

        const startTime = Date.now();
        const result = await callWithRetry(() => model.generateContent(prompt));
        const latency = Date.now() - startTime;

        const modelVersion = result.response.modelVersion || "unknown";
        console.log(`agent API call worked. Model version: ${modelVersion}, Latency ${latency}ms`);

        if (latency > 15000) {
            const now = Date.now();
            if (now - lastLatencyNotificationTime > 10 * 60 * 1000) {
                showNotificationPill("A conexão está lenta", "poor_wifi.svg", true);
                lastLatencyNotificationTime = now;
            }
        }

        const responseText = result.response.text();
        let evalData = null;
        try {
            evalData = JSON.parse(responseText);
        } catch (parseErr) {
            console.error("Erro ao analisar JSON da avaliação IA:", parseErr, responseText);
            return;
        }

        if (evalData && evalData.correto) {
            console.log("Agente corrigiu a resposta (ACEITA):", evalData.justificativa);

            // Sucesso! A IA corrigiu o erro.
            if (balls[ballIdx]) balls[ballIdx].color = 'rgba(250, 204, 21, 0.8)'; // Amarelo/Dourado para correção IA
            restoreStreakAfterAiCorrection();

            // Reverte a penalização inicial e ajusta métricas do cartão
            questionObj.wrongCount = Math.max(0, (questionObj.wrongCount || 1) - 1);
            questionObj.correctStreak = (questionObj.correctStreak || 0) + 1;

            const totalWrongs = questionObj.wrongCount || 0;
            const isLeech = totalWrongs > 4;
            const shouldRemove = !isLeech || questionObj.correctStreak >= 2;

            // Registra correção da IA no subsistema de estatísticas
            recordStatsAiCorrection({
                card: questionObj,
                explanation: evalData.justificativa,
                currentStreak: currentStreak
            });

            if (shouldRemove) {
                score++;
                // Remove da pool se ainda for a mesma questão e salva
                const idx = questionsPool.findIndex(card => card.description === questionObj.description);
                if (idx > -1) {
                    questionsPool.splice(idx, 1);
                    saveGameState();
                }
            } else {
                // Se for leech card precisando de 2 acertos consecutivos, reagenda com gap
                questionObj.dueStep = currentStep + 5;
                saveGameState();
                console.log("[Algorithm] Card leech corrigido por IA mantido no deck para 2º acerto consecutivo.");
            }

            delete questionObj.isBeingCorrected;

            // Somente aplica feedback visual e carrega nova questão se o usuário ainda estiver na mesma questão
            if (questionObj === currentQuestion) {
                isBeingCorrected = false;
                if (correctionOptions) {
                    correctionOptions.classList.add('hidden');
                    correctionOptions.classList.remove('flex');
                }
                if (nextQuestionBtn) nextQuestionBtn.classList.add('hidden');

                triggerHaptic('correct');
                questionCard.classList.remove('glow-incorrect', 'card-shake');

                // On the last card of deck, skip normal animations and play end game directly!
                if (shouldRemove && questionsPool.length === 0) {
                    clearBalls();
                    questionCard.classList.remove('glow-correct', 'glow-incorrect', 'card-shake');
                    updateScoreDisplay();
                    showDeckCompletionScreen();
                    return;
                }

                questionCard.classList.add('glow-correct');
                setTimeout(() => {
                    if (shouldRemove) {
                        animateCardToHeader(() => {
                            updateScoreDisplay();
                            loadQuestion();
                        });
                    } else {
                        updateScoreDisplay();
                        loadQuestion();
                    }
                }, 400);
            } else {
                // Se o usuário já passou de fase, apenas atualizamos o contador visual
                updateScoreDisplay();
                questionsLeftDisplay.textContent = questionsPool.length;
                if (questionsPool.length === 0) {
                    clearBalls();
                    showDeckCompletionScreen();
                }
            }
        } else if (evalData) {
            console.log("Agente manteve a resposta como incorreta (REJEITADA):", evalData.justificativa);
        }
    } catch (e) {
        console.error("Erro na correção IA:", e);
        if (e.message && e.message.includes("503")) {
            ai503ErrorCount++;
            if (ai503ErrorCount >= 10) {
                isAiEnabled = false;
                showNotificationPill("IA não quer trabalhar hoje", "cloud_alert.svg");
            }
        }
    }
}

async function sendChatMessage() {
    const msg = chatInput.value.trim();
    if (!msg || !isAiEnabled || !genAI) return;
    hasChatInteraction = true;
    addMsg('user', msg); chatInput.value = '';
    const tid = showTyping();
    try {
        if (!currentChatSession) {
            const correctAnswers = (currentQuestion.type === 'fill' && currentQuestion.answers && currentQuestion.answers.length > 0)
                ? [currentQuestion.answers.join(' ; ')]
                : [currentQuestion.answer];
            if (currentQuestion.type !== 'fill' && currentQuestion.answer2) correctAnswers.push(currentQuestion.answer2);

            const systemPrompt = `
                Você é um professor tutor ajudando um estudante com um flashcard.
                
                CONTEXTO DA QUESTÃO:
                Pergunta: "${currentQuestion.description}"
                Resposta(s) Correta(s) no Banco: "${correctAnswers.join(' / ')}"
                Resposta que o Usuário deu inicialmente: "${lastUserAnswerForChat}"
                
                Responda de forma didática, objetiva e curta. Se o usuário errou, explique o porquê de forma simples. Use Markdown para listas, tabelas, ênfase e fórmulas matemáticas/químicas em LaTeX ($...$ ou $$...$$).
                Mantenha o contexto desta questão durante toda a conversa.
            `;

            const model = genAI.getGenerativeModel({ model: currentChatModel, systemInstruction: systemPrompt });
            currentChatSession = model.startChat();
        }
        const result = await callWithRetry(() => currentChatSession.sendMessage(msg));
        hideTyping(tid); addMsg('ai', result.response.text());
    } catch (e) {
        console.error(e);
        hideTyping(tid);
        if (e.message.includes("429") || e.message.includes("quota")) {
            addMsg('ai', "Erro de cota excedida na API do Gemini. Por favor, tente novamente mais tarde.");
        } else {
            addMsg('ai', "Erro ao conectar com a IA.");
        }
    }
}

function addMsg(sender, text) {
    const div = document.createElement('div');
    div.className = sender === 'ai' ? 'chat-message-ai' : 'chat-message-user';

    if (sender === 'ai' && typeof marked !== 'undefined') {
        // AI content is parsed as markdown with math rendering
        div.innerHTML = renderMathAndMarkdown(text);
    } else {
        // User content is strictly plain text to prevent XSS
        div.textContent = text;
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
    const id = 't-' + Date.now();
    const div = document.createElement('div');
    div.id = id; div.className = 'typing-indicator';
    div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    chatMessages.appendChild(div);
    return id;
}

function hideTyping(id) { document.getElementById(id)?.remove(); }

// --- EVENT LISTENERS ---
resetBtn.addEventListener('click', () => { 
    if (confirm("Sair?")) { 
        localStorage.removeItem('flashcardsSave'); 
        localStorage.removeItem('flashcardsActiveMode');
        window.location.href = ROUTES.HOME; 
    } 
});
// --- HAMBURGER MENU LOGIC ---
function openHamburgerMenu() {
    if (!hamburgerMenu) return;
    updateHapticUI();
    hamburgerBackdrop?.classList.remove('hidden');
    hamburgerMenu.classList.remove('hidden');
    hamburgerBtn?.setAttribute('aria-expanded', 'true');
}

function closeHamburgerMenu() {
    if (!hamburgerMenu) return;
    hamburgerMenu.classList.add('hidden');
    hamburgerBackdrop?.classList.add('hidden');
    hamburgerBtn?.setAttribute('aria-expanded', 'false');
}

function toggleHamburgerMenu(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (!hamburgerMenu) return;
    if (hamburgerMenu.classList.contains('hidden')) {
        openHamburgerMenu();
    } else {
        closeHamburgerMenu();
    }
}

// Expose functions globally for bulletproof execution
window.openHamburgerMenu = openHamburgerMenu;
window.closeHamburgerMenu = closeHamburgerMenu;
window.toggleHamburgerMenu = toggleHamburgerMenu;

hamburgerBtn?.addEventListener('click', toggleHamburgerMenu);

hamburgerBackdrop?.addEventListener('click', closeHamburgerMenu);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeHamburgerMenu();
        if (aiChatContainer && aiChatContainer.classList.contains('open')) {
            aiChatContainer.classList.remove('open');
        }
    }
});

// Close hamburger menu when any action is selected
[exportBtn, goToEditorBtn, restartGameBtn, resetBtn, statsBtn, receiveSessionBtn, transferSessionBtn, aiToggleBtn].forEach(el => {
    el?.addEventListener('click', () => {
        closeHamburgerMenu();
    });
});

// --- TEXT HIGHLIGHTER & PASTEL COLORS LOGIC ---
let activeHighlightRange = null;
let activeHighlightField = null; // 'description' or 'answer'
let isInteractingWithPopup = false;
let selectionDebounceTimer = null;

function hideHighlightPopup() {
    isInteractingWithPopup = false;
    if (!textHighlightPopup) return;
    textHighlightPopup.classList.add('hidden');
    if (hlPalette) {
        hlPalette.classList.add('hidden');
        hlPalette.classList.remove('flex');
    }
    if (hlTriggerBtn) {
        hlTriggerBtn.classList.remove('is-marked');
        hlTriggerBtn.title = "Marca-texto";
    }
}

function showHighlightPopup(range, isMarked) {
    if (!textHighlightPopup || !range) return;

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    if (hlPalette) {
        hlPalette.classList.add('hidden');
        hlPalette.classList.remove('flex');
    }

    if (hlTriggerBtn) {
        if (isMarked) {
            hlTriggerBtn.classList.add('is-marked');
            hlTriggerBtn.title = "Tirar marcação";
        } else {
            hlTriggerBtn.classList.remove('is-marked');
            hlTriggerBtn.title = "Marca-texto";
        }
    }

    textHighlightPopup.classList.remove('hidden');

    const popupHeight = 44;
    // Account for potential open palette width (~190px) so popup never cuts off on mobile edges
    const estimatedPopupWidth = 190;

    let left = rect.left + rect.width / 2;
    let top = rect.top - popupHeight - 10;

    // Header offset: ensure it stays below fixed header (~64px) on mobile
    if (top < 70) {
        top = rect.bottom + 10;
    }

    // Keep within horizontal screen bounds accounting for full palette width
    const minLeft = estimatedPopupWidth / 2 + 10;
    const maxLeft = window.innerWidth - (estimatedPopupWidth / 2 + 10);
    if (maxLeft >= minLeft) {
        left = Math.max(minLeft, Math.min(maxLeft, left));
    } else {
        left = window.innerWidth / 2;
    }

    // Ensure it doesn't overflow bottom of viewport
    if (top + popupHeight > window.innerHeight - 12) {
        top = Math.max(70, rect.top - popupHeight - 10);
    }

    textHighlightPopup.style.top = `${top}px`;
    textHighlightPopup.style.left = `${left}px`;
}

function isRangeMarked(range, container) {
    if (!range || !container) return false;

    let node = range.commonAncestorContainer;
    while (node && node !== container) {
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'MARK' && node.classList.contains('card-hl')) {
            return true;
        }
        node = node.parentNode;
    }

    const marks = container.querySelectorAll('mark.card-hl');
    for (const mark of marks) {
        try {
            if (range.intersectsNode(mark)) {
                return true;
            }
        } catch (e) {}
    }

    return false;
}

function applyHighlight(color) {
    isInteractingWithPopup = false;
    if (!activeHighlightRange || !activeHighlightField) return;

    const container = activeHighlightField === 'description' 
        ? (document.getElementById('question-body-text') || questionText) 
        : ankiAnswerText;
    if (!container) return;

    const range = activeHighlightRange;
    const selectedText = range.toString().trim();
    if (!selectedText) return;

    // Unmark any existing marks inside this range to avoid nested marks
    const existingMarks = container.querySelectorAll('mark.card-hl');
    existingMarks.forEach(mark => {
        try {
            if (range.intersectsNode(mark)) {
                mark.replaceWith(...mark.childNodes);
            }
        } catch (e) {}
    });

    const mark = document.createElement('mark');
    mark.className = `card-hl card-hl-${color}`;

    try {
        const extracted = range.extractContents();
        mark.appendChild(extracted);
        range.insertNode(mark);
    } catch (e) {
        const selectedText = range.toString();
        if (selectedText) {
            mark.textContent = selectedText;
            range.deleteContents();
            range.insertNode(mark);
        }
    }

    container.normalize();
    persistHighlightedContent(activeHighlightField);
    hideHighlightPopup();
    
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
}

function removeHighlight() {
    isInteractingWithPopup = false;
    if (!activeHighlightRange || !activeHighlightField) return;

    const container = activeHighlightField === 'description' 
        ? (document.getElementById('question-body-text') || questionText) 
        : ankiAnswerText;
    if (!container) return;

    const range = activeHighlightRange;
    let removedAny = false;

    // Check parent chain of common ancestor
    let node = range.commonAncestorContainer;
    while (node && node !== container) {
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'MARK' && node.classList.contains('card-hl')) {
            node.replaceWith(...node.childNodes);
            removedAny = true;
            break;
        }
        node = node.parentNode;
    }

    // Check intersecting marks
    const marks = container.querySelectorAll('mark.card-hl');
    marks.forEach(mark => {
        try {
            if (range.intersectsNode(mark)) {
                mark.replaceWith(...mark.childNodes);
                removedAny = true;
            }
        } catch (e) {}
    });

    if (removedAny) {
        container.normalize();
        persistHighlightedContent(activeHighlightField);
    }

    hideHighlightPopup();
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
}

function persistHighlightedContent(targetField) {
    if (!currentQuestion) return;

    if (targetField === 'description') {
        const bodyElem = document.getElementById('question-body-text');
        const descHtml = bodyElem ? bodyElem.innerHTML : questionText.innerHTML;
        currentQuestion.description = descHtml;
    } else if (targetField === 'answer' && ankiAnswerText) {
        currentQuestion.answer = ankiAnswerText.innerHTML;
    }

    // Update reference in allQuestions
    const cardInAll = allQuestions.find(q => q === currentQuestion || (q.description && q.description.replace(/<[^>]*>/g, '').trim() === currentQuestion.description.replace(/<[^>]*>/g, '').trim()));
    if (cardInAll) {
        cardInAll.description = currentQuestion.description;
        if (currentQuestion.answer) cardInAll.answer = currentQuestion.answer;
    }

    // If active mode is notebook, sync to normal deck in storage
    if (activeMode === 'notebook') {
        const normalData = JSON.parse(localStorage.getItem('flashcardsSave'));
        if (normalData) {
            const syncArray = (arr) => {
                if (!arr) return;
                arr.forEach(q => {
                    if (q.description && q.description.replace(/<[^>]*>/g, '').trim() === currentQuestion.description.replace(/<[^>]*>/g, '').trim()) {
                        q.description = currentQuestion.description;
                        if (currentQuestion.answer) q.answer = currentQuestion.answer;
                    }
                });
            };
            syncArray(normalData.allQuestions);
            syncArray(normalData.questionsPool);
            localStorage.setItem('flashcardsSave', JSON.stringify(normalData));
        }
    } else {
        // If normal mode, also sync to notebook if present
        const notebookData = JSON.parse(localStorage.getItem('flashcardsNotebook'));
        if (notebookData) {
            const syncArray = (arr) => {
                if (!arr) return;
                arr.forEach(q => {
                    if (q.description && q.description.replace(/<[^>]*>/g, '').trim() === currentQuestion.description.replace(/<[^>]*>/g, '').trim()) {
                        q.description = currentQuestion.description;
                        if (currentQuestion.answer) q.answer = currentQuestion.answer;
                    }
                });
            };
            syncArray(notebookData.allQuestions);
            syncArray(notebookData.questionsPool);
            localStorage.setItem('flashcardsNotebook', JSON.stringify(notebookData));
        }
    }

    saveGameState();
}

function handleTextSelection(e) {
    if (isInteractingWithPopup) return;

    // Ignore clicks inside the highlight popup itself
    if (e && e.target && typeof e.target.closest === 'function' && e.target.closest('#text-highlight-popup')) {
        return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        if (!isInteractingWithPopup) {
            hideHighlightPopup();
        }
        return;
    }

    const text = sel.toString().trim();
    if (!text || text.length === 0) {
        if (!isInteractingWithPopup) {
            hideHighlightPopup();
        }
        return;
    }

    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer;

    const questionBody = document.getElementById('question-body-text') || questionText;
    const ankiAnswer = ankiAnswerText;

    let field = null;
    let container = null;

    if (questionBody && questionBody.contains(common)) {
        field = 'description';
        container = questionBody;
    } else if (ankiAnswer && ankiAnswer.contains(common) && !ankiAnswerContainer?.classList.contains('hidden')) {
        field = 'answer';
        container = ankiAnswer;
    } else {
        if (!isInteractingWithPopup) {
            hideHighlightPopup();
        }
        return;
    }

    activeHighlightRange = range.cloneRange();
    activeHighlightField = field;

    const isMarked = isRangeMarked(range, container);
    showHighlightPopup(range, isMarked);
}

if (hlTriggerBtn) {
    hlTriggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (hlTriggerBtn.classList.contains('is-marked')) {
            removeHighlight();
        } else {
            if (hlPalette) {
                const isHidden = hlPalette.classList.contains('hidden');
                if (isHidden) {
                    hlPalette.classList.remove('hidden');
                    hlPalette.classList.add('flex');
                } else {
                    hlPalette.classList.add('hidden');
                    hlPalette.classList.remove('flex');
                }
            }
        }
    });
}

document.querySelectorAll('.hl-color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const color = btn.getAttribute('data-color');
        if (color) {
            applyHighlight(color);
        }
    });
});

function onSelectionChange() {
    if (isInteractingWithPopup) return;
    clearTimeout(selectionDebounceTimer);
    selectionDebounceTimer = setTimeout(() => {
        handleTextSelection();
    }, 120);
}

document.addEventListener('selectionchange', onSelectionChange);
document.addEventListener('mouseup', handleTextSelection);
document.addEventListener('touchend', (e) => {
    if (e.target && typeof e.target.closest === 'function' && e.target.closest('#text-highlight-popup')) {
        return;
    }
    setTimeout(() => {
        handleTextSelection(e);
    }, 60);
});

if (textHighlightPopup) {
    const handlePopupTouch = () => {
        isInteractingWithPopup = true;
    };
    textHighlightPopup.addEventListener('pointerdown', handlePopupTouch);
    textHighlightPopup.addEventListener('touchstart', handlePopupTouch, { passive: true });
    textHighlightPopup.addEventListener('mousedown', (e) => {
        isInteractingWithPopup = true;
        // Prevent default so text selection in card is not cleared on click
        e.preventDefault();
    });
}

// Click listener to handle tapping existing highlighted marks directly & dismiss popup on click outside
document.addEventListener('click', (e) => {
    const mark = e.target.closest('mark.card-hl');
    if (mark) {
        e.stopPropagation();
        e.preventDefault();

        const questionBody = document.getElementById('question-body-text') || questionText;
        const ankiAnswer = ankiAnswerText;
        const field = (ankiAnswer && ankiAnswer.contains(mark)) ? 'answer' : 'description';

        const range = document.createRange();
        range.selectNode(mark);
        activeHighlightRange = range.cloneRange();
        activeHighlightField = field;

        isInteractingWithPopup = true;
        showHighlightPopup(range, true);
        return;
    }

    if (e.target && typeof e.target.closest === 'function' && !e.target.closest('#text-highlight-popup')) {
        const sel = window.getSelection();
        const hasSelection = sel && !sel.isCollapsed && sel.toString().trim().length > 0;
        if (!hasSelection) {
            hideHighlightPopup();
        }
    }
});

// Dismiss popup when tapping outside on touchscreens
document.addEventListener('pointerdown', (e) => {
    if (!textHighlightPopup || textHighlightPopup.classList.contains('hidden')) return;
    if (e.target && typeof e.target.closest === 'function') {
        if (e.target.closest('#text-highlight-popup') || e.target.closest('mark.card-hl')) {
            return;
        }
    }
    isInteractingWithPopup = false;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        hideHighlightPopup();
    }
});

window.addEventListener('resize', hideHighlightPopup);
window.addEventListener('scroll', hideHighlightPopup, true);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hideHighlightPopup();
    }
});

if (restartGameBtn) {
    restartGameBtn.addEventListener('click', () => {
        if (isAnimating) return;

        const resetIcon = restartGameBtn.querySelector('img');
        if (resetIcon) {
            resetIcon.animate([
                { transform: 'rotate(0deg)' },
                { transform: 'rotate(-360deg)' }
            ], { duration: 500, easing: 'ease-in-out' });
        }

        animateCardsFromHeaderToDeck(() => {
            clearBalls();
            score = 0;
            currentStreak = 0;
            updateStreakUI(false);
            scoreDisplay.textContent = '0';
            if (activeMode === 'exam') {
                let examData = {};
                try { examData = JSON.parse(localStorage.getItem('flashcardsExam')) || {}; } catch (e) {}
                const enabledDeckIds = new Set((examData.decks || []).filter(d => d.enabled !== false).map(d => d.id));
                const playable = allQuestions.filter(q => isPlayableCard(q) && (!q.deckId || enabledDeckIds.has(q.deckId)));
                questionsPool = shuffleArray(playable);
            } else {
                questionsPool = shuffleArray(allQuestions.filter(isPlayableCard));
            }
            currentStep = 0;
            consecutiveDueCardsCount = 0;
            precomputedNextCard = null;
            saveGameState(true);
            updateScoreDisplay();
            archiveCurrentSession(false);
            initStatsSession(deckTitle.textContent, activeMode, questionsPool.length, 0, true);
            hideDeckCompletionScreen();
            loadQuestion();
            showNotificationPill("Jogo reiniciado!", "reset.svg");
            console.log("[Game] Jogo reiniciado via header com sucesso.");
        });
    });
}

if (completionRestartBtn) {
    completionRestartBtn.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        restartDeckSession();
    });
}
exportBtn.addEventListener('click', () => {
    let exportData;
    let filename;
    if (activeMode === 'notebook') {
        exportData = {
            __flashcards_watermark__: "notebook_backup_v1",
            deckTitle: "Caderno",
            cards: allQuestions
        };
        filename = `caderno_backup.json`;
    } else if (activeMode === 'exam') {
        let examData = {};
        try { examData = JSON.parse(localStorage.getItem('flashcardsExam')) || {}; } catch (e) {}
        exportData = {
            __flashcards_watermark__: "exam_week_backup_v1",
            deckTitle: "Semana de Provas",
            decks: examData.decks || [],
            cards: allQuestions
        };
        filename = `semana_de_provas_backup.json`;
    } else {
        exportData = allQuestions;
        filename = `${deckTitle.textContent}.json`;
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
});
goToEditorBtn.addEventListener('click', () => {
    localStorage.setItem('editing_deck', JSON.stringify(allQuestions));
    localStorage.setItem('editing_deck_title', deckTitle.textContent);
    window.location.href = ROUTES.GENERATE;
});
aiToggleBtn.addEventListener('click', async () => { 
    closeHamburgerMenu();
    apiModal.classList.remove('hidden'); 
    geminiApiKey = await getApiKeyAsync();
    apiKeyInput.value = geminiApiKey; 
    if (apiKeyRemember) apiKeyRemember.checked = isKeyRemembered();
    setTimeout(() => apiKeyInput.focus(), 50);
});

const hapticSwitch = document.getElementById('haptic-switch');
const hapticSettingRow = document.getElementById('haptic-setting-row');
const hapticToggleBtn = document.getElementById('haptic-toggle-btn');

if (hapticSwitch) {
    hapticSwitch.selected = isHapticEnabled();

    hapticSwitch.addEventListener('change', () => {
        const nextState = hapticSwitch.selected;
        setHapticEnabled(nextState);
        showNotificationPill(
            nextState ? "Vibração tátil ativada" : "Vibração tátil desativada",
            "stats.svg"
        );
    });
}

if (hapticSettingRow && hapticSwitch) {
    hapticSettingRow.addEventListener('click', (e) => {
        // If clicking directly on the switch control, let md-switch handle it natively
        if (e.target.closest('md-switch')) return;
        e.preventDefault();
        if (hapticSwitch.disabled) return;
        hapticSwitch.selected = !hapticSwitch.selected;
        hapticSwitch.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

if (hapticToggleBtn) {
    hapticToggleBtn.addEventListener('click', () => {
        const nextState = !isHapticEnabled();
        setHapticEnabled(nextState);
        showNotificationPill(
            nextState ? "Vibração tátil ativada" : "Vibração tátil desativada",
            "stats.svg"
        );
    });
}

const handleSaveApiKey = async (e) => {
    if (e) e.preventDefault();
    geminiApiKey = apiKeyInput.value.trim();
    if (geminiApiKey) {
        const remember = Boolean(apiKeyRemember?.checked);
        await saveApiKey(geminiApiKey, remember);
        initializeAi(); 
        apiModal.classList.add('hidden');
        showNotificationPill(
            remember ? "IA Ativada e Chave Salva com Segurança!" : "IA Ativada com Sucesso!",
            "enabled_ai.svg"
        );
    }
};

saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
if (apiKeyForm) {
    apiKeyForm.addEventListener('submit', handleSaveApiKey);
}

disableAiBtn.addEventListener('click', async (e) => {
    if (e) e.preventDefault();
    isAiEnabled = false; 
    geminiApiKey = ''; 
    await clearApiKey();
    if (apiKeyRemember) apiKeyRemember.checked = false;
    updateAiUI();
    apiModal.classList.add('hidden');
    showNotificationPill("Recursos de IA desativados", "config_ai.svg");
});
closeApiModal.addEventListener('click', () => apiModal.classList.add('hidden'));
openAiInstructions.addEventListener('click', () => instructionsModal.classList.remove('hidden'));
[closeInstructionsBtn, instructionsReadyBtn].forEach(b => b.addEventListener('click', () => instructionsModal.classList.add('hidden')));
instructionsModal.addEventListener('click', (e) => { if (e.target === instructionsModal) instructionsModal.classList.add('hidden'); });
askAiBtn.addEventListener('click', () => { aiChatContainer.classList.add('open'); chatInput.focus(); });
closeChatBtn.addEventListener('click', () => aiChatContainer.classList.remove('open'));
sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (e.isComposing || e.keyCode === 229) return;
        sendChatMessage();
    }
});
submitBtn.addEventListener('click', () => {
    console.log("[Game] Botão #submit-btn ('Verificar Resposta') clicado.");
    handleOpenSubmit();
});

if (flashcardAnswerForm) {
    flashcardAnswerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log("[Game] Form submetido via Enter.");
        handleOpenSubmit();
    });
}
[answerInput, answerInput1, answerInput2].forEach(inp => {
    inp?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            console.log("[Game] Enter detectado no input:", inp.id);
            handleOpenSubmit();
        }
    });
});

if (answerInput1 && answerInput2) {
    answerInput1.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && answerInput1.value.trim() && !answerInput2.value.trim()) {
            e.preventDefault();
            console.log("[Game] Enter em answerInput1 focando answerInput2.");
            answerInput2.focus();
        }
    });
}
nextQuestionBtn.addEventListener('click', () => {
    console.log("[Game] #next-question-btn ('Pular / Próxima Questão') clicado.");
    if (isAnimating) {
        console.warn("[Game] Transição bloqueada: animação em andamento.");
        return;
    }
    if (questionsPool.length === 0) {
        clearBalls();
        showDeckCompletionScreen();
        return;
    }
    animateCardToBack(() => {
        loadQuestion();
    });
});

const handleDelete = () => {
    if (!confirm("Excluir?")) return;
    allQuestions = allQuestions.filter(q => q !== currentQuestion);
    questionsPool.splice(currentQuestionIndexInPool, 1);
    saveGameState();
    if (questionsPool.length === 0) {
        clearBalls();
        updateScoreDisplay();
        showDeckCompletionScreen();
        return;
    }
    loadQuestion();
};
deleteCardBtn.addEventListener('click', handleDelete);
deleteCorrectionBtn.addEventListener('click', handleDelete);

// --- ANKI CONTROLS & GAMEPAD LOGIC ---
if (ankiFlipBtn) ankiFlipBtn.addEventListener('click', flipAnkiCard);
if (ankiBtnAgain) ankiBtnAgain.addEventListener('click', () => handleAnkiRating('again'));
if (ankiBtnHard) ankiBtnHard.addEventListener('click', () => handleAnkiRating('hard'));
if (ankiBtnGood) ankiBtnGood.addEventListener('click', () => handleAnkiRating('good'));
if (ankiBtnEasy) ankiBtnEasy.addEventListener('click', () => handleAnkiRating('easy'));

// Question card click to flip for Anki
if (questionCard) {
    questionCard.addEventListener('click', (e) => {
        if (currentQuestion && currentQuestion.type === 'anki' && !isAnkiFlipped) {
            // Ignore if clicked on bookmark, delete, image zoom, highlight popup, or marked text
            if (e.target.closest('#bookmark-card-btn') || e.target.closest('#delete-card-btn') || e.target.closest('#question-image-container') || e.target.closest('#text-highlight-popup') || e.target.closest('mark.card-hl')) {
                return;
            }
            // If highlight popup is open, clicking the card dismisses the popup instead of flipping
            if (textHighlightPopup && !textHighlightPopup.classList.contains('hidden')) {
                hideHighlightPopup();
                return;
            }
            // Ignore if text selection is active
            const sel = window.getSelection();
            if (sel && sel.toString().trim().length > 0) {
                return;
            }
            // On touch devices, ignore direct taps on question text so users can select text / double-tap without accidental flips
            if (e.target.closest('#question-text') && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
                return;
            }
            flipAnkiCard();
        }
    });
}

// Keyboard shortcuts for study flow
document.addEventListener('keydown', (e) => {
    // Ignore when typing in inputs, textareas, contenteditable elements, or inside the tutor chat
    const activeEl = document.activeElement;
    const targetEl = e.target;
    const isTextInput = (el) => el && (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable ||
        (typeof el.closest === 'function' && el.closest('#ai-chat-container'))
    );
    if (isTextInput(activeEl) || isTextInput(targetEl)) {
        return;
    }

    // Ignore when any modal, hamburger menu, or tutor chat drawer is open
    const hasOpenModal = document.querySelector('.modal-overlay:not(.hidden)') !== null;
    const isChatOpen = aiChatContainer && aiChatContainer.classList.contains('open');
    const isHamburgerOpen = hamburgerMenu && !hamburgerMenu.classList.contains('hidden');
    if (hasOpenModal || isChatOpen || isHamburgerOpen) return;

    // If next / skip question button is visible and active, advance to next question on Enter / Space
    if (nextQuestionBtn && !nextQuestionBtn.classList.contains('hidden') && !isAnimating) {
        if (e.key === 'Enter' || e.code === 'Space') {
            e.preventDefault();
            console.log("[Game] Atalho Enter/Espaço para avançar card após correção.");
            nextQuestionBtn.click();
            return;
        }
    }

    if (currentQuestion && currentQuestion.type === 'anki') {
        if (!isAnkiFlipped) {
            if (e.code === 'Space' || e.key === 'Enter') {
                e.preventDefault();
                flipAnkiCard();
            }
        } else {
            if (e.key === '1' || e.code === 'Numpad1') {
                e.preventDefault();
                handleAnkiRating('again');
            } else if (e.key === '2' || e.code === 'Numpad2') {
                e.preventDefault();
                handleAnkiRating('hard');
            } else if (e.key === '3' || e.code === 'Numpad3' || e.code === 'Space' || e.key === 'Enter') {
                e.preventDefault();
                handleAnkiRating('good');
            } else if (e.key === '4' || e.code === 'Numpad4') {
                e.preventDefault();
                handleAnkiRating('easy');
            }
        }
    } else if (currentQuestion && currentQuestion.type === 'multiple_choice') {
        const keyNum = parseInt(e.key);
        if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 6) {
            const btns = mcAnswerArea.querySelectorAll('.mc-option-btn');
            if (btns[keyNum - 1] && !btns[keyNum - 1].disabled) {
                e.preventDefault();
                btns[keyNum - 1].click();
            }
        }
    }
});

// Gamepad API controller polling (Event-driven to preserve battery/CPU)
let lastGamepadButtonState = {};
let gamepadRafId = null;

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let hasActiveGamepad = false;

    for (const gp of gamepads) {
        if (!gp) continue;
        hasActiveGamepad = true;
        
        const isPressed = (btnIndex) => {
            const b = gp.buttons[btnIndex];
            if (!b) return false;
            return typeof b === 'object' ? b.pressed : b > 0.5;
        };

        const justPressed = (btnIndex) => {
            const pressed = isPressed(btnIndex);
            const key = `${gp.index}_${btnIndex}`;
            const wasPressed = !!lastGamepadButtonState[key];
            lastGamepadButtonState[key] = pressed;
            return pressed && !wasPressed;
        };

        const isModalOpen = [editModal, apiModal, instructionsModal, imageZoomModal].some(m => m && !m.classList.contains('hidden'));
        if (isModalOpen) continue;

        if (currentQuestion && currentQuestion.type === 'anki') {
            if (!isAnkiFlipped) {
                // Any face button or shoulder triggers card flip
                if (justPressed(0) || justPressed(1) || justPressed(2) || justPressed(3) || justPressed(4) || justPressed(5)) {
                    flipAnkiCard();
                }
            } else {
                // Gamepad layout:
                // Errei (Left / red): X (button 2), Dpad Left (button 14), L1 (button 4)
                if (justPressed(2) || justPressed(14) || justPressed(4)) {
                    handleAnkiRating('again');
                }
                // Difícil (Top / orange): Y (button 3), Dpad Up (button 12)
                else if (justPressed(3) || justPressed(12)) {
                    handleAnkiRating('hard');
                }
                // Médio (Bottom / green): A (button 0), Dpad Down (button 13), R1 (button 5)
                else if (justPressed(0) || justPressed(13) || justPressed(5)) {
                    handleAnkiRating('good');
                }
                // Fácil (Right / blue): B (button 1), Dpad Right (button 15)
                else if (justPressed(1) || justPressed(15)) {
                    handleAnkiRating('easy');
                }
            }
        }
    }

    if (hasActiveGamepad) {
        gamepadRafId = requestAnimationFrame(pollGamepad);
    } else {
        stopGamepadLoop();
    }
}

function startGamepadLoop() {
    if (!gamepadRafId) {
        console.log("[Gamepad] Controle físico detectado. Polling iniciado.");
        gamepadRafId = requestAnimationFrame(pollGamepad);
    }
}

function stopGamepadLoop() {
    if (gamepadRafId) {
        cancelAnimationFrame(gamepadRafId);
        gamepadRafId = null;
        console.log("[Gamepad] Nenhum controle físico ativo. Polling pausado para poupar bateria e CPU.");
    }
}

window.addEventListener('gamepadconnected', (e) => {
    console.log("[Gamepad] Conectado:", e.gamepad.id);
    startGamepadLoop();
});

window.addEventListener('gamepaddisconnected', (e) => {
    console.log("[Gamepad] Desconectado:", e.gamepad.id);
    const active = (navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean);
    if (active.length === 0) {
        stopGamepadLoop();
    }
});

// --- IMAGE LIGHTBOX ZOOM ---
if (questionImage && imageZoomModal && zoomedImage) {
    questionImage.addEventListener('click', () => {
        if (questionImage.src && !questionImage.classList.contains('hidden')) {
            zoomedImage.src = questionImage.src;
            imageZoomModal.classList.remove('hidden');
        }
    });
}
if (ankiAnswerImage && imageZoomModal && zoomedImage) {
    ankiAnswerImage.addEventListener('click', () => {
        if (ankiAnswerImage.src && !ankiAnswerImage.classList.contains('hidden')) {
            zoomedImage.src = ankiAnswerImage.src;
            imageZoomModal.classList.remove('hidden');
        }
    });
}
if (closeImageZoomBtn && imageZoomModal) {
    closeImageZoomBtn.addEventListener('click', () => {
        imageZoomModal.classList.add('hidden');
    });
}
if (imageZoomModal) {
    imageZoomModal.addEventListener('click', (e) => {
        if (e.target === imageZoomModal) {
            imageZoomModal.classList.add('hidden');
        }
    });
}

// --- EDIT MODAL HANDLING (FOR ALL CARD TYPES) ---
let pendingEditImage = '';

function updateEditImagePreviewUI(imgSrc) {
    if (imgSrc && editImagePreview && editImagePreviewContainer) {
        editImagePreview.src = imgSrc;
        editImagePreviewContainer.classList.remove('hidden');
    } else if (editImagePreviewContainer) {
        if (editImagePreview) editImagePreview.src = '';
        editImagePreviewContainer.classList.add('hidden');
    }
}

function updateEditAnsImagePreviewUI(imgSrc) {
    if (imgSrc && editAnsImagePreview && editAnsImagePreviewContainer) {
        editAnsImagePreview.src = imgSrc;
        editAnsImagePreviewContainer.classList.remove('hidden');
    } else if (editAnsImagePreviewContainer) {
        if (editAnsImagePreview) editAnsImagePreview.src = '';
        editAnsImagePreviewContainer.classList.add('hidden');
    }
}

if (editImageUrlInput) {
    editImageUrlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        pendingEditImage = url;
        updateEditImagePreviewUI(pendingEditImage);
    });
}

if (editRemoveImageBtn) {
    editRemoveImageBtn.addEventListener('click', () => {
        pendingEditImage = '';
        if (editImageUrlInput) editImageUrlInput.value = '';
        updateEditImagePreviewUI('');
    });
}

if (editAnsImageUrlInput) {
    editAnsImageUrlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        pendingEditAnsImage = url;
        updateEditAnsImagePreviewUI(pendingEditAnsImage);
    });
}

if (editRemoveAnsImageBtn) {
    editRemoveAnsImageBtn.addEventListener('click', () => {
        pendingEditAnsImage = '';
        if (editAnsImageUrlInput) editAnsImageUrlInput.value = '';
        updateEditAnsImagePreviewUI('');
    });
}

// Edit Modal MCQ Options
function renderEditMcOptions(options = ["", "", "", ""], correctAnswer = "") {
    if (!editMcOptionsList) return;
    editMcOptionsList.innerHTML = '';
    options.forEach((optText, i) => {
        const isCorrect = optText === correctAnswer;
        const row = document.createElement('div');
        row.className = "flex items-center gap-2";
        row.innerHTML = `
            <input type="radio" name="edit-mc-correct" value="${i}" ${isCorrect ? 'checked' : ''} class="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer" title="Marcar como correta">
            <input type="text" class="edit-mc-opt-val flex-1 p-2 bg-gray-50 border border-gray-300 rounded-lg text-sm" value="${optText}">
            <button type="button" class="edit-mc-remove-opt-btn p-1 text-gray-400 hover:text-red-500 transition" title="Remover alternativa">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        const removeBtn = row.querySelector('.edit-mc-remove-opt-btn');
        removeBtn.addEventListener('click', () => {
            const currentVals = Array.from(document.querySelectorAll('.edit-mc-opt-val')).map(inp => inp.value);
            if (currentVals.length <= 2) {
                alert("A questão de múltipla escolha deve conter pelo menos 2 alternativas.");
                return;
            }
            currentVals.splice(i, 1);
            renderEditMcOptions(currentVals, correctAnswer);
        });
        editMcOptionsList.appendChild(row);
    });

    if (editAddMcOptBtn) {
        editAddMcOptBtn.classList.toggle('hidden', options.length >= 6);
    }
}

if (editAddMcOptBtn) {
    editAddMcOptBtn.addEventListener('click', () => {
        const currentVals = Array.from(document.querySelectorAll('.edit-mc-opt-val')).map(inp => inp.value);
        if (currentVals.length >= 6) return;
        currentVals.push("");
        const checkedRadio = document.querySelector('input[name="edit-mc-correct"]:checked');
        const correctIdx = checkedRadio ? parseInt(checkedRadio.value) : 0;
        const curCorrect = currentVals[correctIdx] || "";
        renderEditMcOptions(currentVals, curCorrect);
    });
}

editBtn.addEventListener('click', () => {
    editQuestionInput.value = currentQuestion.description || '';

    const t = currentQuestion.type || 'open';
    if (editAnswer1Group) editAnswer1Group.classList.toggle('hidden', t === 'anki' || t === 'multiple_choice' || t === 'fill');
    if (editAnswer2Group) editAnswer2Group.classList.toggle('hidden', t !== 'open_double');
    if (editAnkiAnswerGroup) editAnkiAnswerGroup.classList.toggle('hidden', t !== 'anki');
    if (editMcOptionsGroup) editMcOptionsGroup.classList.toggle('hidden', t !== 'multiple_choice');
    if (editAnsImageGroup) editAnsImageGroup.classList.toggle('hidden', t !== 'anki');
    if (editFillAnswerGroup) editFillAnswerGroup.classList.toggle('hidden', t !== 'fill');

    if (t === 'open') {
        if (editAnswer1Label) editAnswer1Label.textContent = "Resposta Principal";
        editAnswerInput.value = currentQuestion.answer || '';
    } else if (t === 'open_double') {
        if (editAnswer1Label) editAnswer1Label.textContent = "Resposta 1";
        editAnswerInput.value = currentQuestion.answer || '';
        editAnswer2Input.value = currentQuestion.answer2 || '';
    } else if (t === 'fill') {
        if (editFillAnswerInput) {
            editFillAnswerInput.value = currentQuestion.answer || (currentQuestion.answers || []).join('; ');
        }
    } else if (t === 'anki') {
        editAnkiAnswerInput.value = currentQuestion.answer || '';
    } else if (t === 'multiple_choice') {
        renderEditMcOptions(currentQuestion.options || ["", "", "", ""], currentQuestion.answer);
    }

    pendingEditImage = currentQuestion.image || '';
    if (editImageUrlInput) editImageUrlInput.value = pendingEditImage;
    updateEditImagePreviewUI(pendingEditImage);

    pendingEditAnsImage = currentQuestion.answerImage || '';
    if (editAnsImageUrlInput) editAnsImageUrlInput.value = pendingEditAnsImage;
    updateEditAnsImagePreviewUI(pendingEditAnsImage);

    editModal.classList.remove('hidden');
});

saveEditBtn.addEventListener('click', () => {
    currentQuestion.description = editQuestionInput.value;

    const t = currentQuestion.type || 'open';
    if (t === 'open') {
        currentQuestion.answer = editAnswerInput.value;
    } else if (t === 'open_double') {
        currentQuestion.answer = editAnswerInput.value;
        currentQuestion.answer2 = editAnswer2Input.value;
    } else if (t === 'fill') {
        const val = editFillAnswerInput ? editFillAnswerInput.value.trim() : '';
        currentQuestion.answer = val;
        currentQuestion.answers = val.split(';').map(s => s.trim()).filter(Boolean);
    } else if (t === 'anki') {
        currentQuestion.answer = editAnkiAnswerInput.value;
        if (pendingEditAnsImage) currentQuestion.answerImage = pendingEditAnsImage;
        else delete currentQuestion.answerImage;
    } else if (t === 'multiple_choice') {
        const optInputs = Array.from(document.querySelectorAll('.edit-mc-opt-val'));
        const options = optInputs.map(inp => inp.value.trim()).filter(Boolean);
        const checkedRadio = document.querySelector('input[name="edit-mc-correct"]:checked');
        const correctIdx = checkedRadio ? parseInt(checkedRadio.value) : 0;
        currentQuestion.options = options;
        currentQuestion.answer = optInputs[correctIdx]?.value.trim() || options[0];
    }
    
    if (pendingEditImage) {
        currentQuestion.image = pendingEditImage;
    } else {
        delete currentQuestion.image;
    }

    saveGameState();
    editModal.classList.add('hidden');
    updateFeedbackText();
    animateCardToBack(() => {
        loadQuestion();
    });
});
[closeModalBtn, cancelEditBtn].forEach(b => b.addEventListener('click', () => editModal.classList.add('hidden')));

// --- BOOKMARK & DROPDOWN SELECTOR LOGIC ---
function toggleBookmark() {
    const isMatchingDesc = (d1, d2) => d1 === d2 || (d1 && d2 && d1.replace(/<[^>]*>/g, '').trim() === d2.replace(/<[^>]*>/g, '').trim());
    const isBookmarked = isCardBookmarked(currentQuestion);
    
    // Load notebook state
    let notebookState = JSON.parse(localStorage.getItem('flashcardsNotebook')) || {
        questionsPool: [], allQuestions: [], score: 0, deckTitle: "Caderno"
    };

    if (isBookmarked) {
        // Un-bookmark: Remove from Notebook
        notebookState.allQuestions = notebookState.allQuestions.filter(q => !isMatchingDesc(q.description, currentQuestion.description));
        notebookState.questionsPool = notebookState.questionsPool.filter(q => !isMatchingDesc(q.description, currentQuestion.description));
        
        // Also un-bookmark in normal deck (if present)
        let normalData = JSON.parse(localStorage.getItem('flashcardsSave'));
        if (normalData) {
            const findAndUnbookmark = (arr) => arr.forEach(q => {
                if (isMatchingDesc(q.description, currentQuestion.description)) q.bookmarked = false;
            });
            findAndUnbookmark(normalData.allQuestions);
            findAndUnbookmark(normalData.questionsPool);
            localStorage.setItem('flashcardsSave', JSON.stringify(normalData));
        }

        // Also update the active session's in-memory references if we are in normal mode
        if (activeMode === 'normal') {
            currentQuestion.bookmarked = false;
            const cardInAll = allQuestions.find(q => isMatchingDesc(q.description, currentQuestion.description));
            if (cardInAll) cardInAll.bookmarked = false;
        }

        localStorage.setItem('flashcardsNotebook', JSON.stringify(notebookState));
        showNotificationPill("Card removido do Caderno", "add_bookmark.svg");

        // If we are currently in notebook mode, remove from in-memory and go to next question
        if (activeMode === 'notebook') {
            allQuestions = allQuestions.filter(q => !isMatchingDesc(q.description, currentQuestion.description));
            questionsPool = questionsPool.filter(q => !isMatchingDesc(q.description, currentQuestion.description));
            loadQuestion();
            return;
        }
    } else {
        // Bookmark: Add to Notebook
        currentQuestion.bookmarked = true;
        
        const normalData = JSON.parse(localStorage.getItem('flashcardsSave'));
        const sourceDeckTitle = (activeMode === 'exam' && currentQuestion.sourceDeck) 
            ? currentQuestion.sourceDeck 
            : (normalData ? normalData.deckTitle : "Flashcards");
        currentQuestion.sourceDeck = currentQuestion.sourceDeck || sourceDeckTitle;
        
        // Also mark as bookmarked in normal deck in storage
        if (normalData) {
            const findAndBookmark = (arr) => arr.forEach(q => {
                if (isMatchingDesc(q.description, currentQuestion.description)) {
                    q.bookmarked = true;
                    q.sourceDeck = sourceDeckTitle;
                }
            });
            findAndBookmark(normalData.allQuestions);
            findAndBookmark(normalData.questionsPool);
            localStorage.setItem('flashcardsSave', JSON.stringify(normalData));
        }

        // Also update current session's in-memory reference
        const cardInAll = allQuestions.find(q => isMatchingDesc(q.description, currentQuestion.description));
        if (cardInAll) {
            cardInAll.bookmarked = true;
            cardInAll.sourceDeck = sourceDeckTitle;
        }

        notebookState.allQuestions.push({ ...currentQuestion });
        notebookState.questionsPool.push({ ...currentQuestion });

        localStorage.setItem('flashcardsNotebook', JSON.stringify(notebookState));
        showNotificationPill("Card adicionado ao Caderno", "bookmark_check.svg");
    }

    renderBookmarkIcon();
}

function isCardBookmarked(question) {
    if (!question || !question.description) return false;
    let notebookState = JSON.parse(localStorage.getItem('flashcardsNotebook'));
    if (!notebookState || !notebookState.allQuestions) return false;
    return notebookState.allQuestions.some(q => q.description === question.description || (q.description && q.description.replace(/<[^>]*>/g, '').trim() === question.description.replace(/<[^>]*>/g, '').trim()));
}

function renderBookmarkIcon() {
    if (isCardBookmarked(currentQuestion)) {
        bookmarkCardIcon.src = "../assets/img/bookmark_check.svg";
    } else {
        bookmarkCardIcon.src = "../assets/img/add_bookmark.svg";
    }
}

function openDeckDropdown() {
    deckSelectDropdown.classList.remove('hidden');
    deckSelectArrow.classList.add('rotate-180');
    
    const normalData = JSON.parse(localStorage.getItem('flashcardsSave'));
    const normalTitle = normalData ? normalData.deckTitle : "Flashcards";
    if (deckItemNormalName) deckItemNormalName.textContent = normalTitle;

    let examData = null;
    try {
        examData = JSON.parse(localStorage.getItem('flashcardsExam'));
    } catch (e) {}
    const hasExam = !!(examData && examData.allQuestions && examData.allQuestions.length > 0);

    if (deckItemExam) {
        if (hasExam || activeMode === 'exam') {
            deckItemExam.classList.remove('hidden');
            const totalCards = (examData && examData.questionsPool) ? examData.questionsPool.length : 0;
            const numDecks = (examData && examData.decks) ? examData.decks.length : 0;
            if (deckItemExamSub) {
                deckItemExamSub.textContent = `${numDecks} baralhos • ${totalCards} cards`;
            }
        } else {
            deckItemExam.classList.add('hidden');
        }
    }
    
    // Clear highlights
    [deckItemNormal, deckItemNotebook, deckItemExam].forEach(el => {
        el?.classList.remove('bg-blue-50', 'text-blue-600', 'bg-purple-50', 'text-purple-600');
    });

    if (activeMode === 'notebook') {
        deckItemNotebook?.classList.add('bg-blue-50', 'text-blue-600');
        dropdownExamDecksSection?.classList.add('hidden');
    } else if (activeMode === 'exam') {
        deckItemExam?.classList.add('bg-purple-50', 'text-purple-600');
        renderExamDecksInDropdown(examData);
    } else {
        deckItemNormal?.classList.add('bg-blue-50', 'text-blue-600');
        dropdownExamDecksSection?.classList.add('hidden');
    }
}

function renderExamDecksInDropdown(examData) {
    if (!dropdownExamDecksSection || !dropdownExamDecksList) return;
    dropdownExamDecksSection.classList.remove('hidden');
    dropdownExamDecksList.innerHTML = '';

    const decks = (examData && examData.decks) ? examData.decks : [];
    if (dropdownExamDecksCount) {
        dropdownExamDecksCount.textContent = `${decks.length} baralho${decks.length !== 1 ? 's' : ''}`;
    }

    if (decks.length === 0) {
        dropdownExamDecksList.innerHTML = '<p class="text-xs text-gray-400 text-center py-2 italic">Nenhum baralho na mistura.</p>';
        return;
    }

    decks.forEach((deck) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-2 rounded-xl bg-gray-50/80 hover:bg-gray-100 transition text-xs';
        
        const isEnabled = deck.enabled !== false;
        const cardCount = allQuestions.filter(q => q.deckId === deck.id || q.sourceDeck === deck.name).length;

        item.innerHTML = `
            <label class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer select-none">
                <input type="checkbox" class="exam-deck-toggle rounded text-purple-600 focus:ring-purple-500" ${isEnabled ? 'checked' : ''} data-deck-id="${deck.id}">
                <span class="font-medium text-gray-800 truncate ${isEnabled ? '' : 'line-through opacity-50'}" title="${deck.name}">${deck.name}</span>
            </label>
            <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">${cardCount}</span>
                <button type="button" class="exam-deck-del-btn p-1 text-gray-400 hover:text-red-500 transition" title="Remover da mistura">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `;

        const toggle = item.querySelector('.exam-deck-toggle');
        toggle.addEventListener('change', (e) => {
            e.stopPropagation();
            toggleDeckInExamMix(deck.id, toggle.checked);
        });

        const delBtn = item.querySelector('.exam-deck-del-btn');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Remover o baralho "${deck.name}" da Semana de Provas?`)) {
                removeDeckFromExamMix(deck.id);
            }
        });

        dropdownExamDecksList.appendChild(item);
    });
}

function toggleDeckInExamMix(deckId, enabled) {
    if (activeMode !== 'exam') return;
    let examData = {};
    try { examData = JSON.parse(localStorage.getItem('flashcardsExam')) || {}; } catch(e){}
    const decks = examData.decks || [];
    const targetDeck = decks.find(d => d.id === deckId);
    if (!targetDeck) return;
    targetDeck.enabled = enabled;
    examData.decks = decks;

    if (enabled) {
        const cardsToAdd = allQuestions.filter(q => (q.deckId === deckId || q.sourceDeck === targetDeck.name) && isPlayableCard(q));
        const existingDescriptions = new Set(questionsPool.map(q => q.description));
        const newCards = cardsToAdd.filter(c => !existingDescriptions.has(c.description));
        questionsPool = shuffleArray([...questionsPool, ...newCards]);
    } else {
        questionsPool = questionsPool.filter(q => q.deckId !== deckId && q.sourceDeck !== targetDeck.name);
    }

    saveGameState();
    updateScoreDisplay();

    if (!enabled && currentQuestion && (currentQuestion.deckId === deckId || currentQuestion.sourceDeck === targetDeck.name)) {
        loadQuestion();
    }

    renderExamDecksInDropdown(examData);
    showNotificationPill(`${targetDeck.name}: ${enabled ? 'Ativado' : 'Desativado'}`, "dropdown.svg");
}

function removeDeckFromExamMix(deckId) {
    if (activeMode !== 'exam') return;
    let examData = {};
    try { examData = JSON.parse(localStorage.getItem('flashcardsExam')) || {}; } catch(e){}
    const removedDeck = (examData.decks || []).find(d => d.id === deckId);
    const removedName = removedDeck ? removedDeck.name : '';
    const decks = (examData.decks || []).filter(d => d.id !== deckId);

    examData.decks = decks;

    allQuestions = allQuestions.filter(q => q.deckId !== deckId && q.sourceDeck !== removedName);
    questionsPool = questionsPool.filter(q => q.deckId !== deckId && q.sourceDeck !== removedName);

    examData.allQuestions = allQuestions;
    examData.questionsPool = questionsPool;
    localStorage.setItem('flashcardsExam', JSON.stringify(examData));

    updateScoreDisplay();

    if (currentQuestion && (currentQuestion.deckId === deckId || currentQuestion.sourceDeck === removedName)) {
        loadQuestion();
    }

    renderExamDecksInDropdown(examData);
    showNotificationPill(`Baralho removido da mistura`, "delete.svg");
}

// Add Deck to Mix from Dropdown
if (dropdownAddDeckBtn && dropdownAddDeckInput) {
    dropdownAddDeckBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownAddDeckInput.click();
    });

    dropdownAddDeckInput.addEventListener('change', async () => {
        if (!dropdownAddDeckInput.files || dropdownAddDeckInput.files.length === 0) return;
        const files = Array.from(dropdownAddDeckInput.files);
        dropdownAddDeckInput.value = '';

        let addedCardsCount = 0;
        let examData = {};
        try { examData = JSON.parse(localStorage.getItem('flashcardsExam')) || {}; } catch(e){}
        const decks = examData.decks || [];

        for (const file of files) {
            if (!file.name.toLowerCase().endsWith('.json')) continue;
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                let cards = [];
                let name = file.name.replace(/\.json$/i, '');

                if (parsed && parsed.__flashcards_watermark__ === "notebook_backup_v1") {
                    cards = parsed.cards || [];
                    name = parsed.deckTitle || "Caderno";
                } else if (Array.isArray(parsed)) {
                    cards = parsed;
                }

                if (cards.length > 0) {
                    const newDeckId = 'deck_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                    decks.push({
                        id: newDeckId,
                        name: name,
                        enabled: true,
                        cardCount: cards.length
                    });

                    const taggedCards = cards.map(c => ({
                        ...c,
                        deckId: newDeckId,
                        sourceDeck: name
                    }));

                    allQuestions.push(...taggedCards);
                    const playable = taggedCards.filter(isPlayableCard);
                    questionsPool.push(...playable);
                    addedCardsCount += playable.length;
                }
            } catch (err) {
                console.error("Erro ao adicionar baralho:", err);
            }
        }

        questionsPool = shuffleArray(questionsPool);
        examData.decks = decks;
        examData.allQuestions = allQuestions;
        examData.questionsPool = questionsPool;
        localStorage.setItem('flashcardsExam', JSON.stringify(examData));

        updateScoreDisplay();
        renderExamDecksInDropdown(examData);
        showNotificationPill(`+${addedCardsCount} cards adicionados à mistura!`, "new.svg");
    });
}

function closeDeckDropdown() {
    deckSelectDropdown?.classList.add('hidden');
    deckSelectArrow?.classList.remove('rotate-180');
}

function switchActiveMode(newMode) {
    saveGameState();
    archiveCurrentSession(false);
    
    activeMode = newMode;
    localStorage.setItem('flashcardsActiveMode', newMode);
    
    const storageKey = newMode === 'notebook' 
        ? 'flashcardsNotebook' 
        : (newMode === 'exam' ? 'flashcardsExam' : 'flashcardsSave');
    let data = JSON.parse(localStorage.getItem(storageKey));
    
    if (newMode === 'notebook' && (!data || !data.allQuestions)) {
        data = {
            allQuestions: [],
            questionsPool: [],
            score: 0,
            deckTitle: "Caderno"
        };
        localStorage.setItem('flashcardsNotebook', JSON.stringify(data));
    }
    
    allQuestions = data.allQuestions || [];
    questionsPool = (data.questionsPool || []).filter(isPlayableCard);
    score = data.score || 0;
    currentStep = data.currentStep || 0;
    precomputedNextCard = null;
    if (score === 0) {
        questionsPool = shuffleArray(questionsPool);
    }
    deckTitle.textContent = data.deckTitle || (newMode === 'notebook' ? "Caderno" : (newMode === 'exam' ? "Semana de Provas" : "Flashcards"));
    document.title = data.deckTitle ? `${data.deckTitle} | Flashcards` : "Estudando Flashcards";
    
    clearBalls();
    scoreDisplay.textContent = score;
    updateScoreDisplay();
    isFirstQuestion = true;
    
    initStatsSession(deckTitle.textContent, newMode, allQuestions.filter(isPlayableCard).length, score);
    loadQuestion();
    
    const pillIcon = newMode === 'notebook' ? "collection.svg" : (newMode === 'exam' ? "magic.svg" : "uploaded.svg");
    showNotificationPill(`Estudando: ${deckTitle.textContent}`, pillIcon);
}

// Bind Bookmark & Dropdown Listeners
bookmarkCardBtn.addEventListener('click', toggleBookmark);

deckSelectTrigger.addEventListener('click', (e) => {
    const isOpen = !deckSelectDropdown.classList.contains('hidden');
    if (isOpen) {
        closeDeckDropdown();
    } else {
        openDeckDropdown();
    }
    e.stopPropagation();
});

document.addEventListener('click', () => {
    closeDeckDropdown();
});

deckItemNormal.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDeckDropdown();
    if (activeMode === 'normal') return;
    switchActiveMode('normal');
});

deckItemNotebook.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDeckDropdown();
    if (activeMode === 'notebook') return;
    switchActiveMode('notebook');
});

if (deckItemExam) {
    deckItemExam.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDeckDropdown();
        if (activeMode === 'exam') return;
        switchActiveMode('exam');
    });
}

function keepCardInFocus() {
    if (window.innerWidth <= 768) {
        const header = document.getElementById('global-header');
        const headerHeight = header ? header.offsetHeight : 54;
        const container = document.getElementById('game-container');
        if (container) {
            const rect = container.getBoundingClientRect();
            if (rect.top < headerHeight + 4) {
                window.scrollTo({
                    top: Math.max(0, window.scrollY + rect.top - headerHeight - 6),
                    behavior: 'smooth'
                });
            }
        }
    }
}

function initMobileFocusHelpers() {
    const inputs = [answerInput, answerInput1, answerInput2].filter(Boolean);
    
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            document.body.classList.add('keyboard-open');
            setTimeout(keepCardInFocus, 100);
            setTimeout(keepCardInFocus, 300);
        });

        input.addEventListener('blur', () => {
            document.body.classList.remove('keyboard-open');
        });
    });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            if (document.activeElement && inputs.includes(document.activeElement)) {
                setTimeout(keepCardInFocus, 50);
            }
        });
    }
}

async function initGame() {
    checkAndResetModelFallback();
    resizeCanvas(); animate();
    
    initTransfer(); // Initialize P2P logic from transfer.js

    activeMode = localStorage.getItem('flashcardsActiveMode') || 'normal';

    const saveState = localStorage.getItem('flashcardsSave');
    const notebookState = localStorage.getItem('flashcardsNotebook');
    const examState = localStorage.getItem('flashcardsExam');

    if (!saveState && !notebookState && !examState) {
        window.location.href = ROUTES.HOME;
        return;
    }

    const storageKey = activeMode === 'notebook' 
        ? 'flashcardsNotebook' 
        : (activeMode === 'exam' ? 'flashcardsExam' : 'flashcardsSave');
    let data = JSON.parse(localStorage.getItem(storageKey));

    if (!data) {
        if (examState) activeMode = 'exam';
        else if (saveState) activeMode = 'normal';
        else activeMode = 'notebook';

        localStorage.setItem('flashcardsActiveMode', activeMode);
        const fallbackKey = activeMode === 'notebook' 
            ? 'flashcardsNotebook' 
            : (activeMode === 'exam' ? 'flashcardsExam' : 'flashcardsSave');
        data = JSON.parse(localStorage.getItem(fallbackKey));
    }

    allQuestions = data.allQuestions || [];
    questionsPool = (data.questionsPool || []).filter(isPlayableCard);
    allQuestions.forEach(q => { if (q) delete q.isBeingCorrected; });
    questionsPool.forEach(q => { if (q) delete q.isBeingCorrected; });
    isBeingCorrected = false;
    score = data.score || 0;
    currentStreak = data.currentStreak || 0;
    currentStep = data.currentStep || 0;
    consecutiveDueCardsCount = data.consecutiveDueCardsCount || 0;
    precomputedNextCard = null;
    // Requirement 1: Make all cards random at start
    if (score === 0 || !data.questionsPool || data.questionsPool.length === allQuestions.filter(isPlayableCard).length) {
        questionsPool = shuffleArray(questionsPool);
    }
    updateStreakUI(false);
    deckTitle.textContent = data.deckTitle || (activeMode === 'notebook' ? "Caderno" : (activeMode === 'exam' ? "Semana de Provas" : "Flashcards"));
    document.title = data.deckTitle ? `${data.deckTitle} | Flashcards` : "Estudando Flashcards";
    scoreDisplay.textContent = score; 
    
    const normalData = JSON.parse(localStorage.getItem('flashcardsSave'));
    if (normalData && deckItemNormalName) {
        deckItemNormalName.textContent = normalData.deckTitle || "Flashcards";
    }

    updateScoreDisplay();
    initStatsSession(deckTitle.textContent, activeMode, allQuestions.filter(isPlayableCard).length, score);
    loadQuestion(); 
    const loadedKey = await getApiKeyAsync();
    if (loadedKey) {
        geminiApiKey = loadedKey;
    }
    initializeAi();
    updateAiUI();
    updateHapticUI();
    const initialGamepads = (navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean);
    if (initialGamepads.length > 0) {
        startGamepadLoop();
    }
    initMobileFocusHelpers();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

window.addEventListener('resize', resizeCanvas);
window.addMsg = addMsg;

