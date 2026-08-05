import { GoogleGenerativeAI } from '@google/generative-ai';
import { normalizeString, calculateSimilarity, shuffleArray, callWithRetry, checkAndResetModelFallback, compressImageFile, ROUTES } from './utils.js';
import { initTransfer } from './transfer.js';

// --- DOM ELEMENTS ---
const deckTitle = document.getElementById('deck-title');
const deckSelectTrigger = document.getElementById('deck-select-trigger');
const deckSelectDropdown = document.getElementById('deck-select-dropdown');
const deckSelectArrow = document.getElementById('deck-select-arrow');
const deckItemNormal = document.getElementById('deck-item-normal');
const deckItemNormalName = document.getElementById('deck-item-normal-name');
const deckItemNotebook = document.getElementById('deck-item-notebook');
const bookmarkCardBtn = document.getElementById('bookmark-card-btn');
const bookmarkCardIcon = document.getElementById('bookmark-card-icon');

const resetBtn = document.getElementById('reset-btn');
const exportBtn = document.getElementById('export-btn');
const gameContainer = document.getElementById('game-container');
const goToEditorBtn = document.getElementById('go-to-editor-btn');

const questionText = document.getElementById('question-text');
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
const editImageFileInput = document.getElementById('edit-image-file-input');
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
const mcOptionBtns = document.querySelectorAll('.mc-option-btn');

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


// --- CORE GAME LOGIC ---
function loadQuestion() {
    if (questionsPool.length === 0) {
        questionText.textContent = "Parabéns! Você concluiu todas as questões. Reiniciando...";
        deleteCardBtn.classList.add('hidden');
        bookmarkCardBtn.classList.add('hidden');
        setTimeout(() => {
            balls = [];
            score = 0;
            scoreDisplay.textContent = '0';
            questionsPool = [...allQuestions];
            loadQuestion();
        }, 3000);
        return;
    }

    resetUI();
    bookmarkCardBtn.classList.remove('hidden');
    questionsLeftDisplay.textContent = questionsPool.length;
    currentQuestionIndexInPool = Math.floor(Math.random() * questionsPool.length);
    currentQuestion = questionsPool[currentQuestionIndexInPool];
    renderBookmarkIcon();
    
    if (activeMode === 'notebook' && currentQuestion.sourceDeck) {
        questionText.innerHTML = `<span class="text-xs uppercase tracking-wider text-blue-500 font-bold mb-1.5 block">${currentQuestion.sourceDeck}</span>${currentQuestion.description}`;
    } else {
        questionText.textContent = currentQuestion.description;
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
    const actionButtonsArea = document.getElementById('action-buttons-area');
    if (actionButtonsArea) actionButtonsArea.classList.remove('hidden');
    deleteCardBtn.classList.remove('hidden');

    if (currentQuestion.type === 'multiple_choice' && currentQuestion.options) {
        mcAnswerArea.classList.remove('hidden');
        submitBtn.classList.add('hidden'); // MCQ submits on click
        const options = [...currentQuestion.options];
        shuffleArray(options);
        mcOptionBtns.forEach((btn, i) => {
            if (options[i]) {
                btn.textContent = options[i];
                btn.classList.remove('hidden');
                btn.onclick = () => handleMCSubmit(btn);
            } else btn.classList.add('hidden');
        });
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

function resetUI() {
    [answerInput, answerInput1, answerInput2].forEach(inp => {
        inp.value = ''; inp.disabled = false;
        inp.classList.remove('animate-pulse', 'border-red-500');
    });
    answerInput.placeholder = 'Digite sua resposta aqui...';

    delete currentQuestion.isBeingCorrected;
    submitBtn.disabled = false;
    submitBtn.classList.remove('hidden');
    nextQuestionBtn.classList.add('hidden');
    correctionOptions.classList.add('hidden');
    correctionOptions.classList.remove('flex');
    questionCard.classList.remove('glow-correct', 'glow-incorrect');
    questionText.classList.remove('text-red-500', 'text-green-500');

    mcOptionBtns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('bg-green-500', 'bg-red-500', 'text-white');
        btn.classList.add('bg-gray-200', 'dark:bg-gray-600');
    });
}

function handleOpenSubmit() {
    if (submitBtn.disabled) return;
    if (currentQuestion.isBeingCorrected) {
        loadQuestion();
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
        mcOptionBtns.forEach(b => b.disabled = true);
        element.classList.add(isCorrect ? 'bg-green-500' : 'bg-red-500', 'text-white');
        if (!isCorrect) {
            mcOptionBtns.forEach(b => {
                if (normalizeString(b.textContent) === normalizeString(currentQuestion.answer)) b.classList.add('bg-green-500', 'text-white');
            });
        }
    } else if (!isCorrect) {
        currentQuestion.isBeingCorrected = true;
        updateFeedbackText();
        submitBtn.classList.add('hidden');
        nextQuestionBtn.classList.remove('hidden');
        correctionOptions.classList.add('flex');
        correctionOptions.classList.remove('hidden');
    }

    if (isCorrect) {
        score++;
        updateScoreDisplay();
        questionsPool.splice(currentQuestionIndexInPool, 1);
        saveGameState();
        setTimeout(loadQuestion, 2500);
    } else if (currentQuestion.type === 'multiple_choice') setTimeout(loadQuestion, 3500);
}

function updateFeedbackText() {
    if (currentQuestion.isBeingCorrected) {
        if (currentQuestion.type === 'open_double') {
            const label1 = currentQuestion.placeholder1 || 'Resposta 1';
            const label2 = currentQuestion.placeholder2 || 'Resposta 2';
            questionText.innerHTML = `
                ${currentQuestion.description}<br>
                <span class="text-green-500 font-semibold mt-2 block">${label1}: ${currentQuestion.answer.replace('/', ' ou ')}</span>
                <span class="text-green-500 font-semibold mt-2 block">${label2}: ${currentQuestion.answer2.replace('/', ' ou ')}</span>
            `;
        } else {
            const a1 = currentQuestion.answer.replace('/', ' ou ');
            questionText.innerHTML = `${currentQuestion.description}<br><span class="text-green-500 font-semibold mt-2 block">Resposta: ${a1}</span>`;
        }
    } else questionText.textContent = currentQuestion.description;
}

function saveGameState() {
    if (activeMode === 'notebook') {
        localStorage.setItem('flashcardsNotebook', JSON.stringify({
            questionsPool, allQuestions, score, deckTitle: "Caderno"
        }));
    } else {
        localStorage.setItem('flashcardsSave', JSON.stringify({
            questionsPool, allQuestions, score, deckTitle: deckTitle.textContent
        }));
    }
}

function updateScoreDisplay() {
    const scoreVal = document.getElementById('score');
    const receiveBtn = document.getElementById('receive-session-btn');
    const scoreContainer = document.getElementById('score-container');
    
    if (scoreVal) scoreVal.textContent = score;

    // Check if we are in "Desktop/Landscape" mode
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    const isLargeScreen = window.innerWidth >= 1024;
    const isPillMode = isLargeScreen || (window.innerWidth >= 768 && isLandscape);

    if (isPillMode) {
        // Desktop/Landscape: Show score, hide download (cast icon is on the left)
        receiveBtn?.classList.add('hidden');
        scoreContainer?.classList.remove('hidden');
    } else {
        // Mobile Portrait: 
        if (score === 0) {
            // Show only download icon to import session
            receiveBtn?.classList.remove('hidden');
            scoreContainer?.classList.add('hidden');
        } else {
            // Hide download icon, show score once progress starts
            receiveBtn?.classList.add('hidden');
            scoreContainer?.classList.remove('hidden');
        }
    }
}

// --- AI LOGIC ---
function initializeAi() {
    if (geminiApiKey) {
        genAI = new GoogleGenerativeAI(geminiApiKey);
        isAiEnabled = true;
        aiIconOff.classList.add('hidden');
        aiIconOn.classList.remove('hidden');
    }
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
            updateScoreDisplay();

            // Remove da pool se ainda for a mesma questão e salva
            const idx = questionsPool.findIndex(card => card.description === questionObj.description);
            if (idx > -1) {
                questionsPool.splice(idx, 1);
                saveGameState();
            }

            // Somente aplica feedback visual e carrega nova questão se o usuário ainda estiver na mesma questão
            if (questionObj === currentQuestion) {
                questionCard.classList.remove('glow-incorrect');
                questionCard.classList.add('glow-correct');
                setTimeout(loadQuestion, 2000);
            } else {
                // Se o usuário já passou de fase, apenas atualizamos o contador visual
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
aiToggleBtn.addEventListener('click', () => { apiModal.classList.remove('hidden'); apiKeyInput.value = geminiApiKey; });
saveApiKeyBtn.addEventListener('click', () => {
    geminiApiKey = apiKeyInput.value.trim();
    sessionStorage.setItem('gemini_api_key', geminiApiKey);
    initializeAi(); apiModal.classList.add('hidden');
});
disableAiBtn.addEventListener('click', () => {
    isAiEnabled = false; geminiApiKey = ''; sessionStorage.removeItem('gemini_api_key');
    aiIconOff.classList.remove('hidden'); aiIconOn.classList.add('hidden'); apiModal.classList.add('hidden');
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
nextQuestionBtn.addEventListener('click', loadQuestion);

const handleDelete = () => {
    if (!confirm("Excluir?")) return;
    allQuestions = allQuestions.filter(q => q !== currentQuestion);
    questionsPool.splice(currentQuestionIndexInPool, 1);
    saveGameState(); loadQuestion();
};
deleteCardBtn.addEventListener('click', handleDelete);
deleteCorrectionBtn.addEventListener('click', handleDelete);

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

// --- EDIT MODAL IMAGE HANDLING ---
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

if (editImageFileInput) {
    editImageFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                pendingEditImage = await compressImageFile(file);
                updateEditImagePreviewUI(pendingEditImage);
            } catch (err) {
                console.error('Erro ao comprimir imagem:', err);
            }
        }
    });
}

if (editImageUrlInput) {
    editImageUrlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
            pendingEditImage = url;
            updateEditImagePreviewUI(pendingEditImage);
        }
    });
}

if (editRemoveImageBtn) {
    editRemoveImageBtn.addEventListener('click', () => {
        pendingEditImage = '';
        if (editImageFileInput) editImageFileInput.value = '';
        if (editImageUrlInput) editImageUrlInput.value = '';
        updateEditImagePreviewUI('');
    });
}

editBtn.addEventListener('click', () => {
    editQuestionInput.value = currentQuestion.description;
    editAnswerInput.value = currentQuestion.answer;
    editAnswer2Group.classList.toggle('hidden', currentQuestion.type !== 'open_double');
    editAnswer2Input.value = currentQuestion.answer2 || '';

    pendingEditImage = currentQuestion.image || '';
    if (editImageFileInput) editImageFileInput.value = '';
    if (editImageUrlInput) editImageUrlInput.value = '';
    updateEditImagePreviewUI(pendingEditImage);

    editModal.classList.remove('hidden');
});
saveEditBtn.addEventListener('click', () => {
    currentQuestion.description = editQuestionInput.value;
    currentQuestion.answer = editAnswerInput.value;
    if (currentQuestion.type === 'open_double') currentQuestion.answer2 = editAnswer2Input.value;
    
    if (pendingEditImage) {
        currentQuestion.image = pendingEditImage;
    } else {
        delete currentQuestion.image;
    }

    saveGameState(); editModal.classList.add('hidden'); updateFeedbackText(); loadQuestion();
});
[closeModalBtn, cancelEditBtn].forEach(b => b.addEventListener('click', () => editModal.classList.add('hidden')));

// --- BOOKMARK & DROPDOWN SELECTOR LOGIC ---
function toggleBookmark() {
    const isBookmarked = isCardBookmarked(currentQuestion);
    
    // Load notebook state
    let notebookState = JSON.parse(localStorage.getItem('flashcardsNotebook')) || {
        questionsPool: [], allQuestions: [], score: 0, deckTitle: "Caderno"
    };

    if (isBookmarked) {
        // Un-bookmark: Remove from Notebook
        notebookState.allQuestions = notebookState.allQuestions.filter(q => q.description !== currentQuestion.description);
        notebookState.questionsPool = notebookState.questionsPool.filter(q => q.description !== currentQuestion.description);
        
        // Also un-bookmark in normal deck (if present)
        let normalData = JSON.parse(localStorage.getItem('flashcardsSave'));
        if (normalData) {
            const findAndUnbookmark = (arr) => arr.forEach(q => {
                if (q.description === currentQuestion.description) q.bookmarked = false;
            });
            findAndUnbookmark(normalData.allQuestions);
            findAndUnbookmark(normalData.questionsPool);
            localStorage.setItem('flashcardsSave', JSON.stringify(normalData));
        }

        // Also update the active session's in-memory references if we are in normal mode
        if (activeMode === 'normal') {
            currentQuestion.bookmarked = false;
            const cardInAll = allQuestions.find(q => q.description === currentQuestion.description);
            if (cardInAll) cardInAll.bookmarked = false;
        }

        localStorage.setItem('flashcardsNotebook', JSON.stringify(notebookState));
        showNotificationPill("Card removido do Caderno", "add_bookmark.svg");

        // If we are currently in notebook mode, remove from in-memory and go to next question
        if (activeMode === 'notebook') {
            allQuestions = allQuestions.filter(q => q.description !== currentQuestion.description);
            questionsPool = questionsPool.filter(q => q.description !== currentQuestion.description);
            loadQuestion();
            return;
        }
    } else {
        // Bookmark: Add to Notebook
        currentQuestion.bookmarked = true;
        
        const normalData = JSON.parse(localStorage.getItem('flashcardsSave'));
        const sourceDeckTitle = normalData ? normalData.deckTitle : "Flashcards";
        currentQuestion.sourceDeck = sourceDeckTitle;
        
        // Also mark as bookmarked in normal deck in storage
        if (normalData) {
            const findAndBookmark = (arr) => arr.forEach(q => {
                if (q.description === currentQuestion.description) {
                    q.bookmarked = true;
                    q.sourceDeck = sourceDeckTitle;
                }
            });
            findAndBookmark(normalData.allQuestions);
            findAndBookmark(normalData.questionsPool);
            localStorage.setItem('flashcardsSave', JSON.stringify(normalData));
        }

        // Also update current session's in-memory reference
        const cardInAll = allQuestions.find(q => q.description === currentQuestion.description);
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
    return notebookState.allQuestions.some(q => q.description === question.description);
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
    deckItemNormalName.textContent = normalTitle;
    
    if (activeMode === 'notebook') {
        deckItemNotebook.classList.add('bg-blue-50', 'dark:bg-blue-900/30', 'text-blue-600', 'dark:text-blue-400');
        deckItemNormal.classList.remove('bg-blue-50', 'dark:bg-blue-900/30', 'text-blue-600', 'dark:text-blue-400');
    } else {
        deckItemNormal.classList.add('bg-blue-50', 'dark:bg-blue-900/30', 'text-blue-600', 'dark:text-blue-400');
        deckItemNotebook.classList.remove('bg-blue-50', 'dark:bg-blue-900/30', 'text-blue-600', 'dark:text-blue-400');
    }
}

function closeDeckDropdown() {
    deckSelectDropdown?.classList.add('hidden');
    deckSelectArrow?.classList.remove('rotate-180');
}

function switchActiveMode(newMode) {
    saveGameState();
    
    activeMode = newMode;
    localStorage.setItem('flashcardsActiveMode', newMode);
    
    const storageKey = newMode === 'notebook' ? 'flashcardsNotebook' : 'flashcardsSave';
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
    questionsPool = data.questionsPool || [];
    score = data.score || 0;
    deckTitle.textContent = data.deckTitle || (newMode === 'notebook' ? "Caderno" : "Flashcards");
    document.title = data.deckTitle ? `${data.deckTitle} | Flashcards` : "Estudando Flashcards";
    
    balls = [];
    scoreDisplay.textContent = score;
    updateScoreDisplay();
    isFirstQuestion = true;
    
    loadQuestion();
    
    showNotificationPill(`Estudando: ${deckTitle.textContent}`, newMode === 'notebook' ? "collection.svg" : "uploaded.svg");
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

document.addEventListener('DOMContentLoaded', () => {
    checkAndResetModelFallback();
    resizeCanvas(); animate();
    
    initTransfer(); // Initialize P2P logic from transfer.js

    activeMode = localStorage.getItem('flashcardsActiveMode') || 'normal';

    const saveState = localStorage.getItem('flashcardsSave');
    const notebookState = localStorage.getItem('flashcardsNotebook');

    if (!saveState && !notebookState) {
        window.location.href = ROUTES.HOME;
        return;
    }

    const storageKey = activeMode === 'notebook' ? 'flashcardsNotebook' : 'flashcardsSave';
    let data = JSON.parse(localStorage.getItem(storageKey));

    if (!data) {
        activeMode = activeMode === 'notebook' ? 'normal' : 'notebook';
        localStorage.setItem('flashcardsActiveMode', activeMode);
        const fallbackKey = activeMode === 'notebook' ? 'flashcardsNotebook' : 'flashcardsSave';
        data = JSON.parse(localStorage.getItem(fallbackKey));
    }

    allQuestions = data.allQuestions || [];
    questionsPool = data.questionsPool || [];
    score = data.score || 0;
    deckTitle.textContent = data.deckTitle || (activeMode === 'notebook' ? "Caderno" : "Flashcards");
    document.title = data.deckTitle ? `${data.deckTitle} | Flashcards` : "Estudando Flashcards";
    scoreDisplay.textContent = score; 
    
    const normalData = JSON.parse(localStorage.getItem('flashcardsSave'));
    if (normalData && deckItemNormalName) {
        deckItemNormalName.textContent = normalData.deckTitle || "Flashcards";
    }

    updateScoreDisplay();
    loadQuestion(); 
    initializeAi();
});
window.addEventListener('resize', resizeCanvas);
window.addMsg = addMsg;
