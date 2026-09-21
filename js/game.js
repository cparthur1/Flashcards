import { GoogleGenerativeAI } from '@google/generative-ai';
import { normalizeString, calculateSimilarity, shuffleArray, callWithRetry, checkAndResetModelFallback, ROUTES } from './utils.js';
import { initTransfer } from './transfer.js';
import { initStatsSession, recordStatsAnswer, archiveCurrentSession } from './stats-tracker.js';

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
const questionImage = document.getElementById('question-image');

const correctionOptions = document.getElementById('correction-options');
const editBtn = document.getElementById('edit-btn');
const deleteCorrectionBtn = document.getElementById('delete-correction-btn');

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

const submitBtn = document.getElementById('submit-btn');
const nextQuestionBtn = document.getElementById('next-question-btn');

const aiToggleBtn = document.getElementById('ai-toggle-btn');
const aiIconOff = document.getElementById('ai-icon-off');
const aiIconOn = document.getElementById('ai-icon-on');
const apiModal = document.getElementById('api-modal');
const closeApiModal = document.getElementById('close-api-modal');
const apiKeyInput = document.getElementById('api-key-input');
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
let isAnkiFlipped = false;
let pendingEditAnsImage = '';
let questionStartTime = Date.now();

// --- AI STATE ---
let isAiEnabled = false;
let geminiApiKey = sessionStorage.getItem('gemini_api_key') || '';
let genAI = null;
let lastUserAnswerForChat = "";
let currentChatSession = null;
let currentChatModel = "gemini-flash-lite-latest";
let ai503ErrorCount = 0;
let lastLatencyNotificationTime = 0;

// --- UI UTILITIES ---
function showNotificationPill(message, iconName, isWarning = false) {
    const existing = document.getElementById('notification-pill');
    if (existing) existing.remove();

    const pill = document.createElement('div');
    pill.id = 'notification-pill';
    // Samsung One UI style: pill-shaped, superior, blurred, centered
    pill.className = `fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-2.5 rounded-full shadow-2xl backdrop-blur-xl border border-white/20 transition-all duration-500 transform -translate-y-20 opacity-0 ${isWarning ? 'bg-yellow-100/90 dark:bg-yellow-900/80' : 'bg-white/90 dark:bg-gray-800/90'}`;
    pill.innerHTML = `
        <img src="../assets/img/${iconName}" class="w-5 h-5" alt="icon">
        <span class="text-[13px] font-medium text-gray-800 dark:text-white whitespace-nowrap">${message}</span>
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
            cardEl.className = 'fixed rounded-lg shadow-xl border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 flex items-center justify-center pointer-events-none';
            cardEl.style.width = `${cardRect.width}px`;
            cardEl.style.height = `${cardRect.height}px`;
            cardEl.style.top = `${cardRect.top}px`;
            cardEl.style.left = `${cardRect.left}px`;
            cardEl.style.zIndex = `${9990 + i}`;
            cardEl.style.transformOrigin = 'center center';
            cardEl.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-2 text-blue-500 dark:text-blue-400 opacity-70">
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
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function createBall(isCorrect) {
    const radius = Math.random() * 5 + 8;
    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const y = -radius;
    const color = isCorrect ? 'rgba(74, 222, 128, 0.8)' : 'rgba(239, 68, 68, 0.8)';
    balls.push({ x, y, radius, color, dy: 0, isStatic: false });
    return balls.length - 1;
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < balls.length; i++) {
        const ball = balls[i];
        if (!ball.isStatic) {
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
        ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color; ctx.fill(); ctx.closePath();
    });
    if (balls.length > 300) balls.shift();
    requestAnimationFrame(animate);
}


// --- HELPER: FILTER PLAYABLE CARDS (EXCLUDE DEVISORS / NOTES) ---
function isPlayableCard(card) {
    return card && card.type !== 'divisor' && card.type !== 'divider' && card.type !== 'note';
}

// --- CORE GAME LOGIC ---
function loadQuestion() {
    questionsPool = questionsPool.filter(isPlayableCard);
    if (questionsPool.length === 0) {
        questionText.textContent = "Parabéns! Você concluiu todas as questões. Reiniciando...";
        deleteCardBtn.classList.add('hidden');
        bookmarkCardBtn.classList.add('hidden');
        if (ankiControlsArea) ankiControlsArea.classList.add('hidden');
        if (ankiAnswerContainer) ankiAnswerContainer.classList.add('hidden');
        archiveCurrentSession(true);
        showNotificationPill("Sessão concluída! Verifique suas estatísticas.", "stats.svg");
        setTimeout(() => {
            balls = [];
            score = 0;
            scoreDisplay.textContent = '0';
            questionsPool = allQuestions.filter(isPlayableCard);
            currentStep = 0;
            initStatsSession(deckTitle.textContent, activeMode, allQuestions.filter(isPlayableCard).length, 0);
            loadQuestion();
        }, 3000);
        return;
    }

    currentStep++;
    resetUI();
    questionStartTime = Date.now();
    bookmarkCardBtn.classList.remove('hidden');
    questionsLeftDisplay.textContent = questionsPool.length;

    // Selection algorithm:
    // 1. Check if there are due Anki cards (dueStep <= currentStep)
    const dueAnkiCards = questionsPool
        .map((card, idx) => ({ card, idx }))
        .filter(item => item.card.type === 'anki' && item.card.dueStep !== undefined && item.card.dueStep <= currentStep);

    if (dueAnkiCards.length > 0) {
        dueAnkiCards.sort((a, b) => a.card.dueStep - b.card.dueStep);
        currentQuestionIndexInPool = dueAnkiCards[0].idx;
    } else {
        // 2. Otherwise pick randomly among available cards (non-Anki cards or ready Anki cards)
        const availableCards = questionsPool
            .map((card, idx) => ({ card, idx }))
            .filter(item => item.card.dueStep === undefined || item.card.dueStep <= currentStep);

        if (availableCards.length > 0) {
            // Avoid immediately repeating the same card if other cards are available
            const otherCards = availableCards.filter(item => item.idx !== currentQuestionIndexInPool);
            const poolToPick = (otherCards.length > 0) ? otherCards : availableCards;
            const randItem = poolToPick[Math.floor(Math.random() * poolToPick.length)];
            currentQuestionIndexInPool = randItem.idx;
        } else {
            // 3. Fallback: all remaining cards are future Anki cards, pick the closest one
            const sortedAll = questionsPool
                .map((card, idx) => ({ card, idx }))
                .sort((a, b) => (a.card.dueStep || 0) - (b.card.dueStep || 0));
            currentQuestionIndexInPool = sortedAll[0].idx;
        }
    }

    currentQuestion = questionsPool[currentQuestionIndexInPool];
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

    if ((activeMode === 'notebook' || activeMode === 'exam') && currentQuestion.sourceDeck) {
        if (sourceTagElem) {
            sourceTagElem.textContent = currentQuestion.sourceDeck;
            sourceTagElem.classList.remove('hidden');
        }
        if (bodyElem) {
            bodyElem.innerHTML = currentQuestion.description || '';
        } else {
            questionText.innerHTML = `<span class="text-xs uppercase tracking-wider text-blue-500 font-bold mb-1.5 block">${currentQuestion.sourceDeck}</span>${currentQuestion.description || ''}`;
        }
    } else {
        if (sourceTagElem) {
            sourceTagElem.classList.add('hidden');
        }
        if (bodyElem) {
            bodyElem.innerHTML = currentQuestion.description || '';
        } else {
            questionText.innerHTML = currentQuestion.description || '';
        }
    }

    if (currentQuestion.image && questionImage && questionImageContainer) {
        questionImage.src = currentQuestion.image;
        questionImageContainer.classList.remove('hidden');
    } else if (questionImageContainer) {
        questionImageContainer.classList.add('hidden');
        questionImage.src = '';
    }

    openAnswerArea.classList.add('hidden');
    openDoubleAnswerArea.classList.add('hidden');
    mcAnswerArea.classList.add('hidden');
    if (ankiAnswerContainer) ankiAnswerContainer.classList.add('hidden');
    if (ankiControlsArea) ankiControlsArea.classList.add('hidden');

    const actionButtonsArea = document.getElementById('action-buttons-area');
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
        btn.className = "mc-option-btn w-full bg-gray-200 dark:bg-gray-600 hover:bg-blue-200 dark:hover:bg-blue-800 text-gray-800 dark:text-gray-200 font-semibold py-3.5 px-4 rounded-xl text-md transition text-left sm:text-center shadow-sm";
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
        ankiAnswerText.innerHTML = formatMultiParagraphText(currentQuestion.answer || '');
        if (currentQuestion.answerImage && ankiAnswerImage && ankiAnswerImageContainer) {
            ankiAnswerImage.src = currentQuestion.answerImage;
            ankiAnswerImageContainer.classList.remove('hidden');
        } else if (ankiAnswerImageContainer) {
            ankiAnswerImageContainer.classList.add('hidden');
            ankiAnswerImage.src = '';
        }
        ankiAnswerContainer.classList.remove('hidden');
    }

    if (ankiUnflippedControls) ankiUnflippedControls.classList.add('hidden');
    if (ankiFlippedControls) ankiFlippedControls.classList.remove('hidden');
}

function handleAnkiRating(rating) {
    if (currentQuestion.type !== 'anki' || !isAnkiFlipped) return;
    if (isAnimating) return;

    const elapsedSeconds = (Date.now() - questionStartTime) / 1000;
    recordStatsAnswer({
        card: currentQuestion,
        isCorrect: (rating === 'good' || rating === 'easy'),
        rating: rating,
        timeSpentSeconds: elapsedSeconds
    });

    if (rating === 'easy') {
        // "easy": removes card from deck
        createBall(true);
        questionCard.classList.add('glow-correct');
        score++;
        questionsPool.splice(currentQuestionIndexInPool, 1);
        saveGameState();
        setTimeout(() => {
            animateCardToHeader(() => {
                updateScoreDisplay();
                loadQuestion();
            });
        }, 300);
    } else if (rating === 'good') {
        // "medium": keeps card in rotation with moderate repetition frequency (+8)
        createBall(true);
        currentQuestion.dueStep = currentStep + 8;
        saveGameState();
        animateCardToBack(() => {
            loadQuestion();
        });
    } else if (rating === 'hard') {
        // "hard": keeps card in rotation with medium-high repetition frequency (+4)
        createBall(false);
        currentQuestion.dueStep = currentStep + 4;
        saveGameState();
        animateCardToBack(() => {
            loadQuestion();
        });
    } else if (rating === 'again') {
        // "errei": keeps card in rotation with high repetition frequency (+2)
        createBall(false);
        questionCard.classList.remove('card-shake');
        void questionCard.offsetWidth;
        questionCard.classList.add('card-shake');
        setTimeout(() => questionCard.classList.remove('card-shake'), 450);

        currentQuestion.dueStep = currentStep + 2;
        saveGameState();
        setTimeout(() => {
            animateCardToBack(() => {
                loadQuestion();
            });
        }, 400);
    }
}

function resetUI() {
    hideHighlightPopup();
    [answerInput, answerInput1, answerInput2].forEach(inp => {
        inp.value = ''; inp.disabled = false;
        inp.classList.remove('animate-pulse', 'border-red-500');
    });
    answerInput.placeholder = 'Digite sua resposta aqui...';

    if (currentQuestion) {
        delete currentQuestion.isBeingCorrected;
    }
    isAnkiFlipped = false;
    if (ankiAnswerContainer) ankiAnswerContainer.classList.add('hidden');
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
        btn.classList.add('bg-gray-200', 'dark:bg-gray-600');
    });
}

function handleOpenSubmit() {
    if (submitBtn.disabled) return;
    if (currentQuestion.isBeingCorrected) {
        if (isAnimating) return;
        animateCardToBack(() => {
            loadQuestion();
        });
        return;
    }
    const type = currentQuestion.type;
    const ans1 = normalizeString(answerInput.value);
    const ans1_d = normalizeString(answerInput1.value);
    const ans2_d = normalizeString(answerInput2.value);

    if (type === 'open_double' && (!ans1_d || !ans2_d)) return;
    if (type !== 'open_double' && !ans1) return;

    const correct1 = currentQuestion.answer.split('/');
    const correct2 = (currentQuestion.answer2 || "").split('/');

    const isCorrect1 = type === 'open_double'
        ? correct1.some(c => calculateSimilarity(ans1_d, normalizeString(c)) >= 0.8)
        : correct1.some(c => calculateSimilarity(ans1, normalizeString(c)) >= 0.8);

    const isCorrect2 = type === 'open_double'
        ? correct2.some(c => calculateSimilarity(ans2_d, normalizeString(c)) >= 0.8)
        : true;

    showFeedback(isCorrect1 && isCorrect2);
}

function handleMCSubmit(btn) {
    if (btn.disabled) return;
    const isCorrect = normalizeString(btn.textContent) === normalizeString(currentQuestion.answer);
    showFeedback(isCorrect, btn);
}

function showFeedback(isCorrect, element) {
    // Capturar a resposta do usuário para o contexto do chat de IA
    let userAnswer = "";
    if (currentQuestion.type === 'open_double') {
        userAnswer = `${answerInput1.value} ; ${answerInput2.value}`;
    } else if (currentQuestion.type === 'multiple_choice') {
        userAnswer = element ? element.textContent : "";
    } else {
        userAnswer = answerInput.value;
    }
    lastUserAnswerForChat = userAnswer;

    const elapsedSeconds = (Date.now() - questionStartTime) / 1000;
    recordStatsAnswer({
        card: currentQuestion,
        isCorrect: isCorrect,
        rating: isCorrect ? 'correct' : 'incorrect',
        timeSpentSeconds: elapsedSeconds,
        userAnswer: userAnswer
    });

    const ballIdx = createBall(isCorrect);
    questionCard.classList.add(isCorrect ? 'glow-correct' : 'glow-incorrect');

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
        element.classList.add(isCorrect ? 'bg-green-500' : 'bg-red-500', 'text-white');
        if (!isCorrect) {
            dynamicMcBtns.forEach(b => {
                if (normalizeString(b.textContent) === normalizeString(currentQuestion.answer)) b.classList.add('bg-green-500', 'text-white');
            });
        }
    }

    if (!isCorrect) {
        // Card shakes on wrong guess and waits for user to skip/ask/edit/delete
        questionCard.classList.remove('card-shake');
        void questionCard.offsetWidth; // Force reflow
        questionCard.classList.add('card-shake');
        setTimeout(() => questionCard.classList.remove('card-shake'), 450);

        currentQuestion.isBeingCorrected = true;
        if (!element) {
            updateFeedbackText();
            submitBtn.classList.add('hidden');
        }
        nextQuestionBtn.classList.remove('hidden');
        correctionOptions.classList.add('flex');
        correctionOptions.classList.remove('hidden');
    } else {
        // Card goes upwards toward the points counter in the header shrinking on the way to it
        score++;
        questionsPool.splice(currentQuestionIndexInPool, 1);
        saveGameState();
        setTimeout(() => {
            animateCardToHeader(() => {
                updateScoreDisplay();
                loadQuestion();
            });
        }, 400);
    }
}

function updateFeedbackText() {
    ensureQuestionStructure();
    const bodyElem = document.getElementById('question-body-text');
    const feedbackElem = document.getElementById('question-feedback-text');

    if (currentQuestion && currentQuestion.isBeingCorrected) {
        if (bodyElem) {
            bodyElem.innerHTML = currentQuestion.description || '';
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
        } else if (currentQuestion.type === 'anki') {
            feedbackHtml = `<span class="text-indigo-500 font-semibold mt-2 block">Resposta: ${currentQuestion.answer || ''}</span>`;
        } else {
            const a1 = (currentQuestion.answer || '').replace('/', ' ou ');
            feedbackHtml = `<span class="text-green-500 font-semibold mt-2 block">Resposta: ${a1}</span>`;
        }

        if (feedbackElem) {
            feedbackElem.innerHTML = feedbackHtml;
            feedbackElem.classList.remove('hidden');
        } else {
            questionText.innerHTML = `${currentQuestion.description || ''}<br>${feedbackHtml}`;
        }
    } else {
        if (bodyElem && currentQuestion) {
            bodyElem.innerHTML = currentQuestion.description || '';
        }
        if (feedbackElem) {
            feedbackElem.innerHTML = '';
            feedbackElem.classList.add('hidden');
        }
    }
}

function saveGameState() {
    try {
        if (activeMode === 'notebook') {
            localStorage.setItem('flashcardsNotebook', JSON.stringify({
                questionsPool, allQuestions, score, deckTitle: "Caderno"
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
                deckTitle: "Semana de Provas"
            }));
        } else {
            localStorage.setItem('flashcardsSave', JSON.stringify({
                questionsPool, allQuestions, score, deckTitle: deckTitle.textContent
            }));
        }
    } catch (e) {
        console.error("Erro ao salvar estado do jogo no localStorage:", e);
    }
}

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
            menuAiStatusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
        }
        if (menuAiSubtitle) menuAiSubtitle.textContent = 'Verificação inteligente ativa';
        if (aiIconOff) aiIconOff.classList.add('hidden');
        if (aiIconOn) aiIconOn.classList.remove('hidden');
    } else {
        if (menuAiIcon) menuAiIcon.src = '../assets/img/config_ai.svg';
        if (menuAiStatusBadge) {
            menuAiStatusBadge.textContent = 'Desativada';
            menuAiStatusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
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

        const expected = [questionObj.answer, questionObj.answer2].filter(Boolean).join(' / ');

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
            balls[ballIdx].color = 'rgba(250, 204, 21, 0.8)'; // Amarelo/Dourado para correção IA
            score++;

            // Remove da pool se ainda for a mesma questão e salva
            const idx = questionsPool.findIndex(card => card.description === questionObj.description);
            if (idx > -1) {
                questionsPool.splice(idx, 1);
                saveGameState();
            }

            // Somente aplica feedback visual e carrega nova questão se o usuário ainda estiver na mesma questão
            if (questionObj === currentQuestion) {
                questionCard.classList.remove('glow-incorrect', 'card-shake');
                questionCard.classList.add('glow-correct');
                setTimeout(() => {
                    animateCardToHeader(() => {
                        updateScoreDisplay();
                        loadQuestion();
                    });
                }, 400);
            } else {
                // Se o usuário já passou de fase, apenas atualizamos o contador visual
                updateScoreDisplay();
                questionsLeftDisplay.textContent = questionsPool.length;
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
            const correctAnswers = [currentQuestion.answer];
            if (currentQuestion.answer2) correctAnswers.push(currentQuestion.answer2);

            const systemPrompt = `
                Você é um professor tutor ajudando um estudante com um flashcard.
                
                CONTEXTO DA QUESTÃO:
                Pergunta: "${currentQuestion.description}"
                Resposta(s) Correta(s) no Banco: "${correctAnswers.join(' / ')}"
                Resposta que o Usuário deu inicialmente: "${lastUserAnswerForChat}"
                
                Responda de forma didática, objetiva e curta. Se o usuário errou, explique o porquê de forma simples. Use markdown se necessário para listas ou ênfase.
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

function renderMathAndMarkdown(text) {
    const mathBlocks = [];
    
    // 1. Temporarily extract block math ($$...$$)
    let placeholderText = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
        const placeholder = `%%BLOCK_MATH_${mathBlocks.length}%%`;
        mathBlocks.push({
            type: 'block',
            text: math
        });
        return placeholder;
    });

    // 2. Temporarily extract inline math ($...$)
    placeholderText = placeholderText.replace(/\$(?!\s)((?:\\\$|[^\$])+?)(?<!\s)\$/g, (match, math) => {
        const placeholder = `%%INLINE_MATH_${mathBlocks.length}%%`;
        mathBlocks.push({
            type: 'inline',
            text: math
        });
        return placeholder;
    });

    // 3. Parse Markdown
    let html = typeof marked !== 'undefined' ? marked.parse(placeholderText) : placeholderText;

    // 4. Extract code blocks from HTML to prevent rendering math inside them
    const codeBlocks = [];
    html = html.replace(/<code[\s\S]*?<\/code>/gi, (match) => {
        const placeholder = `%%CODE_BLOCK_${codeBlocks.length}%%`;
        codeBlocks.push(match);
        return placeholder;
    });

    // 5. Restore math blocks and render them with KaTeX
    if (typeof katex !== 'undefined') {
        html = html.replace(/%%(BLOCK|INLINE)_MATH_(\d+)%%/g, (match, type, index) => {
            const mathItem = mathBlocks[parseInt(index, 10)];
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
        // Fallback: restore raw math text
        html = html.replace(/%%(BLOCK|INLINE)_MATH_(\d+)%%/g, (match, type, index) => {
            const mathItem = mathBlocks[parseInt(index, 10)];
            return type === 'BLOCK' ? `$$${mathItem.text}$$` : `$${mathItem.text}$`;
        });
    }

    // 6. Restore code blocks
    html = html.replace(/%%CODE_BLOCK_(\d+)%%/g, (match, index) => {
        return codeBlocks[parseInt(index, 10)];
    });

    // 7. Restore any remaining math placeholders (which were inside code blocks)
    html = html.replace(/%%(BLOCK|INLINE)_MATH_(\d+)%%/g, (match, type, index) => {
        const mathItem = mathBlocks[parseInt(index, 10)];
        return type === 'BLOCK' ? `$$${mathItem.text}$$` : `$${mathItem.text}$`;
    });

    return html;
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

function hideHighlightPopup() {
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

    const popupWidth = 44;
    const popupHeight = 44;

    let left = rect.left + rect.width / 2;
    let top = rect.top - popupHeight - 8;

    if (top < 64) {
        top = rect.bottom + 8;
    }

    const minLeft = popupWidth / 2 + 12;
    const maxLeft = window.innerWidth - (popupWidth / 2 + 12);
    left = Math.max(minLeft, Math.min(maxLeft, left));

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
    setTimeout(() => {
        // Ignore clicks inside the highlight popup itself
        if (e && e.target && typeof e.target.closest === 'function' && e.target.closest('#text-highlight-popup')) {
            return;
        }

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
            hideHighlightPopup();
            return;
        }

        const text = sel.toString().trim();
        if (!text || text.length === 0) {
            hideHighlightPopup();
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
            hideHighlightPopup();
            return;
        }

        activeHighlightRange = range.cloneRange();
        activeHighlightField = field;

        const isMarked = isRangeMarked(range, container);
        showHighlightPopup(range, isMarked);
    }, 20);
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

document.addEventListener('mouseup', handleTextSelection);
document.addEventListener('touchend', handleTextSelection);

if (textHighlightPopup) {
    textHighlightPopup.addEventListener('mousedown', (e) => {
        // Prevent default so text selection in card is not cleared on click
        e.preventDefault();
    });
}

document.addEventListener('mousedown', (e) => {
    if (e.target && typeof e.target.closest === 'function' && !e.target.closest('#text-highlight-popup')) {
        const sel = window.getSelection();
        const hasSelection = sel && !sel.isCollapsed && sel.toString().trim().length > 0;
        if (!hasSelection) {
            hideHighlightPopup();
        }
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
            balls = [];
            score = 0;
            scoreDisplay.textContent = '0';
            if (activeMode === 'exam') {
                let examData = {};
                try { examData = JSON.parse(localStorage.getItem('flashcardsExam')) || {}; } catch (e) {}
                const enabledDeckIds = new Set((examData.decks || []).filter(d => d.enabled !== false).map(d => d.id));
                const playable = allQuestions.filter(q => isPlayableCard(q) && (!q.deckId || enabledDeckIds.has(q.deckId)));
                questionsPool = shuffleArray(playable);
            } else {
                questionsPool = allQuestions.filter(isPlayableCard);
            }
            saveGameState();
            updateScoreDisplay();
            archiveCurrentSession(false);
            initStatsSession(deckTitle.textContent, activeMode, allQuestions.filter(isPlayableCard).length, 0);
            loadQuestion();
            showNotificationPill("Jogo reiniciado!", "reset.svg");
        });
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
aiToggleBtn.addEventListener('click', () => { 
    closeHamburgerMenu();
    apiModal.classList.remove('hidden'); 
    apiKeyInput.value = geminiApiKey; 
});
saveApiKeyBtn.addEventListener('click', () => {
    geminiApiKey = apiKeyInput.value.trim();
    if (geminiApiKey) {
        sessionStorage.setItem('gemini_api_key', geminiApiKey);
        initializeAi(); 
        apiModal.classList.add('hidden');
        showNotificationPill("IA Ativada com Sucesso!", "enabled_ai.svg");
    }
});
disableAiBtn.addEventListener('click', () => {
    isAiEnabled = false; 
    geminiApiKey = ''; 
    sessionStorage.removeItem('gemini_api_key');
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
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });
submitBtn.addEventListener('click', handleOpenSubmit);
[answerInput, answerInput1, answerInput2].forEach(inp => {
    inp.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleOpenSubmit(); });
});
nextQuestionBtn.addEventListener('click', () => {
    if (isAnimating) return;
    animateCardToBack(() => {
        loadQuestion();
    });
});

const handleDelete = () => {
    if (!confirm("Excluir?")) return;
    allQuestions = allQuestions.filter(q => q !== currentQuestion);
    questionsPool.splice(currentQuestionIndexInPool, 1);
    saveGameState(); loadQuestion();
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
            // Ignore if clicked on bookmark, delete, image zoom, or highlight popup
            if (e.target.closest('#bookmark-card-btn') || e.target.closest('#delete-card-btn') || e.target.closest('#question-image-container') || e.target.closest('#text-highlight-popup')) {
                return;
            }
            // Ignore if text selection is active
            const sel = window.getSelection();
            if (sel && sel.toString().trim().length > 0) {
                return;
            }
            flipAnkiCard();
        }
    });
}

// Keyboard shortcuts for study flow
document.addEventListener('keydown', (e) => {
    // Ignore when typing in inputs or textareas
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
    }
    // Ignore when any modal is open
    const isModalOpen = [editModal, apiModal, instructionsModal, imageZoomModal].some(m => m && !m.classList.contains('hidden'));
    if (isModalOpen) return;

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

// Gamepad API controller polling
let lastGamepadButtonState = {};

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
        if (!gp) continue;
        
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
    requestAnimationFrame(pollGamepad);
}

// --- IMAGE LIGHTBOX ZOOM ---
if (questionImage && imageZoomModal && zoomedImage) {
    questionImage.addEventListener('click', () => {
        if (questionImage.src) {
            zoomedImage.src = questionImage.src;
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
            <input type="text" class="edit-mc-opt-val flex-1 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" value="${optText}">
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
    if (editAnswer1Group) editAnswer1Group.classList.toggle('hidden', t === 'anki' || t === 'multiple_choice');
    if (editAnswer2Group) editAnswer2Group.classList.toggle('hidden', t !== 'open_double');
    if (editAnkiAnswerGroup) editAnkiAnswerGroup.classList.toggle('hidden', t !== 'anki');
    if (editMcOptionsGroup) editMcOptionsGroup.classList.toggle('hidden', t !== 'multiple_choice');
    if (editAnsImageGroup) editAnsImageGroup.classList.toggle('hidden', t !== 'anki');

    if (t === 'open') {
        if (editAnswer1Label) editAnswer1Label.textContent = "Resposta Principal";
        editAnswerInput.value = currentQuestion.answer || '';
    } else if (t === 'open_double') {
        if (editAnswer1Label) editAnswer1Label.textContent = "Resposta 1";
        editAnswerInput.value = currentQuestion.answer || '';
        editAnswer2Input.value = currentQuestion.answer2 || '';
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
        el?.classList.remove('bg-blue-50', 'dark:bg-blue-900/30', 'text-blue-600', 'dark:text-blue-400', 'bg-purple-50', 'dark:bg-purple-900/30', 'text-purple-600', 'dark:text-purple-400');
    });

    if (activeMode === 'notebook') {
        deckItemNotebook?.classList.add('bg-blue-50', 'dark:bg-blue-900/30', 'text-blue-600', 'dark:text-blue-400');
        dropdownExamDecksSection?.classList.add('hidden');
    } else if (activeMode === 'exam') {
        deckItemExam?.classList.add('bg-purple-50', 'dark:bg-purple-900/30', 'text-purple-600', 'dark:text-purple-400');
        renderExamDecksInDropdown(examData);
    } else {
        deckItemNormal?.classList.add('bg-blue-50', 'dark:bg-blue-900/30', 'text-blue-600', 'dark:text-blue-400');
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
        item.className = 'flex items-center justify-between p-2 rounded-xl bg-gray-50/80 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-xs';
        
        const isEnabled = deck.enabled !== false;
        const cardCount = allQuestions.filter(q => q.deckId === deck.id || q.sourceDeck === deck.name).length;

        item.innerHTML = `
            <label class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer select-none">
                <input type="checkbox" class="exam-deck-toggle rounded text-purple-600 focus:ring-purple-500 dark:bg-gray-900 dark:border-gray-600" ${isEnabled ? 'checked' : ''} data-deck-id="${deck.id}">
                <span class="font-medium text-gray-800 dark:text-gray-200 truncate ${isEnabled ? '' : 'line-through opacity-50'}" title="${deck.name}">${deck.name}</span>
            </label>
            <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-semibold">${cardCount}</span>
                <button type="button" class="exam-deck-del-btn p-1 text-gray-400 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition" title="Remover da mistura">
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
    deckTitle.textContent = data.deckTitle || (newMode === 'notebook' ? "Caderno" : (newMode === 'exam' ? "Semana de Provas" : "Flashcards"));
    document.title = data.deckTitle ? `${data.deckTitle} | Flashcards` : "Estudando Flashcards";
    
    balls = [];
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

function initGame() {
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
    score = data.score || 0;
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
    initializeAi();
    updateAiUI();
    requestAnimationFrame(pollGamepad);
    initMobileFocusHelpers();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

window.addEventListener('resize', resizeCanvas);
window.addMsg = addMsg;

