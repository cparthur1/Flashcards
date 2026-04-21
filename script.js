import { GoogleGenerativeAI } from '@google/generative-ai';

// --- ELEMENTOS DO DOM ---
const deckTitle = document.getElementById('deck-title');
const resetBtn = document.getElementById('reset-btn');
const exportBtn = document.getElementById('export-btn');
const uploadScreen = document.getElementById('upload-screen');
const gameContainer = document.getElementById('game-container');
const fileInput = document.getElementById('file-input');
const startBtn = document.getElementById('start-btn');
const uploadError = document.getElementById('upload-error');

// NEW CREATE BUTTON & MODALS
const openCreateBtn = document.getElementById('open-create-btn');
const createModal = document.getElementById('create-modal');
const closeCreateBtn = document.getElementById('close-create-btn');
const openInstructionsBtn = document.getElementById('open-instructions-btn');
const instructionsModal = document.getElementById('instructions-modal');
const closeInstructionsBtn = document.getElementById('close-instructions-btn');
const loadPastedDeckBtn = document.getElementById('load-pasted-deck-btn');
const newDeckNameInput = document.getElementById('new-deck-name');
const pastedJsonInput = document.getElementById('pasted-json');

const questionText = document.getElementById('question-text');
const scoreDisplay = document.getElementById('score');
const questionsLeftDisplay = document.getElementById('questions-left');
const questionCard = document.getElementById('question-card');
const deleteCardBtn = document.getElementById('delete-card-btn');

const correctionOptions = document.getElementById('correction-options');
const editBtn = document.getElementById('edit-btn');
const deleteCorrectionBtn = document.getElementById('delete-correction-btn');

// Modal Elements (Edição)
const editModal = document.getElementById('edit-modal');
const editQuestionInput = document.getElementById('edit-question-input');
const editAnswerInput = document.getElementById('edit-answer-input');
const editAnswer2Group = document.getElementById('edit-answer-2-group');
const editAnswer2Input = document.getElementById('edit-answer-2-input');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveEditBtn = document.getElementById('save-edit-btn');

// Áreas de Resposta
const openAnswerArea = document.getElementById('open-answer-area');
const answerInput = document.getElementById('answer-input');
const openDoubleAnswerArea = document.getElementById('open-double-answer-area');
const answerInput1 = document.getElementById('answer-input-1');
const answerInput2 = document.getElementById('answer-input-2');
const mcAnswerArea = document.getElementById('mc-answer-area');
const mcOptionBtns = document.querySelectorAll('.mc-option-btn');

// Botões de Ação
const actionButtonsArea = document.getElementById('action-buttons-area');
const nextQuestionBtn = document.getElementById('next-question-btn');
const submitBtn = document.getElementById('submit-btn');

// Elementos de IA
const aiToggleBtn = document.getElementById('ai-toggle-btn');
const aiIconOff = document.getElementById('ai-icon-off');
const aiIconOn = document.getElementById('ai-icon-on');
const apiModal = document.getElementById('api-modal');
const closeApiModal = document.getElementById('close-api-modal');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const disableAiBtn = document.getElementById('disable-ai-btn');
const openAiInstructions = document.getElementById('open-ai-instructions');
const aiInstructionsModal = document.getElementById('ai-instructions-modal');
const closeAiInstructions = document.getElementById('close-ai-instructions');
const aiInstructionsReady = document.getElementById('ai-instructions-ready');

// Elementos do Chat de IA
const askAiBtn = document.getElementById('ask-ai-btn');
const aiChatContainer = document.getElementById('ai-chat-container');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

const canvas = document.getElementById('background-canvas');
const ctx = canvas.getContext('2d');

// --- ESTADO DO JOGO ---
let allQuestions = [];
let questionsPool = [];
let score = 0;
let currentQuestion = {};
let currentQuestionIndexInPool = -1;
let balls = [];
let currentFile = null;

// ESTADO DA IA
let isAiEnabled = false;
let geminiApiKey = localStorage.getItem('gemini_api_key_checker') || '';
let genAI = null;
let lastUserAnswerForChat = "";
let currentChatSession = null;

// --- LÓGICA DE UPLOAD ---
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        currentFile = fileInput.files[0];
        startBtn.disabled = false;
        uploadError.textContent = '';
        startBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        startBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        startBtn.textContent = "📂 Abrir " + currentFile.name;
    }
});

startBtn.addEventListener('click', () => {
    if (!currentFile) {
        uploadError.textContent = 'Por favor, selecione um arquivo.';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const parsedQuestions = JSON.parse(event.target.result);
            if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
                throw new Error("O arquivo JSON deve ser um array de questões e não pode estar vazio.");
            }
            allQuestions = parsedQuestions;
            const fileName = currentFile.name.replace(/\.json$/i, '');
            deckTitle.textContent = fileName;
            uploadScreen.classList.add('hidden');
            gameContainer.classList.remove('hidden');
            startGame();
        } catch (e) {
            uploadError.textContent = `Erro ao ler o arquivo: ${e.message}`;
        }
    };
    reader.onerror = () => {
        uploadError.textContent = 'Não foi possível ler o arquivo.';
    };
    reader.readAsText(currentFile);
});

// --- LÓGICA DE CRIAÇÃO (DIRECIONA PARA MESMA ABA) ---
openCreateBtn.addEventListener('click', () => {
    window.location.href = 'generate.html';
});


// --- EVENT LISTENERS DE IA ---
if (aiToggleBtn) {
    aiToggleBtn.addEventListener('click', () => {
        apiModal.classList.remove('hidden');
        apiKeyInput.value = geminiApiKey;
    });
}

if (closeApiModal) {
    closeApiModal.addEventListener('click', () => apiModal.classList.add('hidden'));
}

if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            geminiApiKey = key;
            localStorage.setItem('gemini_api_key_checker', key);
            initializeAi();
            apiModal.classList.add('hidden');
        }
    });
}

if (disableAiBtn) {
    disableAiBtn.addEventListener('click', () => {
        isAiEnabled = false;
        geminiApiKey = '';
        localStorage.removeItem('gemini_api_key_checker');
        aiIconOff.classList.remove('hidden');
        aiIconOn.classList.add('hidden');
        apiModal.classList.add('hidden');
    });
}

if (openAiInstructions) openAiInstructions.addEventListener('click', () => aiInstructionsModal.classList.remove('hidden'));
if (closeAiInstructions) closeAiInstructions.addEventListener('click', () => aiInstructionsModal.classList.add('hidden'));
if (aiInstructionsReady) aiInstructionsReady.addEventListener('click', () => aiInstructionsModal.classList.add('hidden'));

// --- EVENT LISTENERS DE CHAT DE IA ---
if (askAiBtn) {
    askAiBtn.addEventListener('click', () => {
        openAiChat();
    });
}

if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => {
        aiChatContainer.classList.remove('open');
    });
}

if (sendChatBtn) {
    sendChatBtn.addEventListener('click', sendChatMessage);
}

if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
}

// --- LÓGICA DA ANIMAÇÃO (CANVAS) ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function createBall(isCorrect) {
    const radius = Math.random() * 5 + 8;
    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const y = -radius;
    const color = isCorrect ? 'rgba(74, 222, 128, 0.8)' : 'rgba(239, 68, 68, 0.8)';
    const dy = 0;
    balls.push({ x, y, radius, color, dy, isStatic: false });
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
                    if (!ball.firstContactTime) {
                        ball.firstContactTime = Date.now();
                    }
                    ball.dy *= -0.3;
                    const overlap = minDistance - distance;
                    const angle = Math.atan2(dy, dx);
                    ball.x += Math.cos(angle) * overlap;
                    ball.y += Math.sin(angle) * overlap;
                    const rollForce = dx * 0.08;
                    ball.x += rollForce;
                    break;
                }
            }
            if (isTouchingStatic) {
                if (ball.firstContactTime) {
                    const timeSinceFirstContact = Date.now() - ball.firstContactTime;
                    if (timeSinceFirstContact > 5000) {
                        ball.isStatic = true;
                    }
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
    if (balls.length > 400) balls.shift();
    requestAnimationFrame(animate);
}

// --- FUNÇÕES AUXILIARES ---
function normalizeString(str) {
    if (!str) return '';
    return str.replace(/\(.*?\)/g, '').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/-/g, ' ');
}

function calculateSimilarity(s1, s2) {
    let longer = s1, shorter = s2;
    if (s1.length < s2.length) { longer = s2; shorter = s1; }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    const distance = (s1, s2) => {
        const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
        for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
        for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
        for (let j = 1; j <= s2.length; j += 1) {
            for (let i = 1; i <= s1.length; i += 1) {
                const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(track[j][i - 1] + 1, track[j - 1][i] + 1, track[j - 1][i - 1] + indicator);
            }
        }
        return track[s2.length][s1.length];
    };
    return (longerLength - distance(longer, shorter)) / longerLength;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- FUNÇÕES DE ARQUIVO E GERENCIAMENTO ---
function exportUpdatedJson() {
    if (allQuestions.length === 0) {
        alert("Não há questões para exportar!");
        return;
    }
    const jsonStr = JSON.stringify(allQuestions, null, 4);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deckTitle.textContent}_editado.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function deleteCurrentCard() {
    if (!confirm("Tem certeza que deseja excluir este card permanentemente do baralho?")) return;
    const indexInAll = allQuestions.findIndex(q =>
        q.description === currentQuestion.description &&
        q.answer === currentQuestion.answer
    );
    if (indexInAll > -1) allQuestions.splice(indexInAll, 1);
    if (currentQuestionIndexInPool > -1) questionsPool.splice(currentQuestionIndexInPool, 1);
    questionsLeftDisplay.textContent = questionsPool.length;
    saveGameState();
    loadQuestion();
}

// --- FUNÇÕES DO MODAL DE EDIÇÃO ---
function openEditModal() {
    editQuestionInput.value = currentQuestion.description;
    editAnswerInput.value = currentQuestion.answer;
    if (currentQuestion.type === 'open_double') {
        editAnswer2Group.classList.remove('hidden');
        editAnswer2Input.value = currentQuestion.answer2;
    } else {
        editAnswer2Group.classList.add('hidden');
    }
    editModal.classList.remove('hidden');
}

function closeEditModal() {
    editModal.classList.add('hidden');
}

function saveEditedCard() {
    currentQuestion.description = editQuestionInput.value;
    currentQuestion.answer = editAnswerInput.value;
    if (currentQuestion.type === 'open_double') {
        currentQuestion.answer2 = editAnswer2Input.value;
    }
    updateFeedbackText();
    saveGameState();
    closeEditModal();
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
            questionText.innerHTML = `
                ${currentQuestion.description}<br>
                <span class="text-green-500 font-semibold mt-2 block">Resposta: ${currentQuestion.answer.replace('/', ' ou ')}</span>
            `;
        }
    } else {
        questionText.textContent = currentQuestion.description;
    }
}

// --- LÓGICA DO JOGO ---
function startGame() {
    score = 0;
    scoreDisplay.textContent = '0';
    questionsPool = [...allQuestions];
    loadQuestion();
}

function loadQuestion() {
    if (questionsPool.length === 0) {
        questionText.textContent = "Parabéns! Você concluiu todas as questões. O ciclo será reiniciado...";
        deleteCardBtn.classList.add('hidden');
        setTimeout(() => {
            balls = [];
            startGame();
        }, 3000);
        return;
    }

    resetUI();
    questionsLeftDisplay.textContent = questionsPool.length;
    currentQuestionIndexInPool = Math.floor(Math.random() * questionsPool.length);
    currentQuestion = questionsPool[currentQuestionIndexInPool];
    questionText.textContent = currentQuestion.description;

    openAnswerArea.classList.add('hidden');
    openDoubleAnswerArea.classList.add('hidden');
    mcAnswerArea.classList.add('hidden');
    actionButtonsArea.classList.add('hidden');
    deleteCardBtn.classList.remove('hidden');

    if (currentQuestion.type === 'multiple_choice' && currentQuestion.options) {
        mcAnswerArea.classList.remove('hidden');
        const options = [...currentQuestion.options];
        shuffleArray(options);
        mcOptionBtns.forEach((btn, index) => {
            if (options[index]) {
                btn.textContent = options[index];
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
            btn.onclick = () => handleMCSubmit(btn);
        });
    } else if (currentQuestion.type === 'open_double') {
        openDoubleAnswerArea.classList.remove('hidden');
        actionButtonsArea.classList.remove('hidden');
        answerInput1.placeholder = currentQuestion.placeholder1 || 'Resposta 1';
        answerInput2.placeholder = currentQuestion.placeholder2 || 'Resposta 2';
        answerInput1.focus();
    } else {
        openAnswerArea.classList.remove('hidden');
        actionButtonsArea.classList.remove('hidden');
        answerInput.focus();
    }

    // Resetar chat para nova questão
    chatMessages.innerHTML = '<div class="chat-message-ai">Olá! Como posso ajudar você a entender melhor esta questão?</div>';
    currentChatSession = null;
}

function resetUI() {
    answerInput.value = '';
    answerInput.disabled = false;
    answerInput.placeholder = 'Digite sua resposta aqui...';
    answerInput1.value = '';
    answerInput1.disabled = false;
    answerInput1.placeholder = 'Resposta 1';
    answerInput2.value = '';
    answerInput2.disabled = false;
    answerInput2.placeholder = 'Resposta 2';

    if (currentQuestion) delete currentQuestion.isBeingCorrected;

    submitBtn.disabled = false;
    submitBtn.classList.remove('hidden');
    nextQuestionBtn.classList.add('hidden');
    correctionOptions.classList.add('hidden');
    correctionOptions.classList.remove('flex');

    questionCard.classList.remove('glow-correct', 'glow-incorrect');
    questionText.classList.remove('text-red-500', 'text-green-500');
    questionText.textContent = currentQuestion.description || '';

    mcOptionBtns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('bg-green-500', 'bg-red-500', 'text-white', 'hover:bg-green-500', 'hover:bg-red-500');
        btn.classList.add('bg-gray-200', 'dark:bg-gray-600', 'hover:bg-blue-200', 'dark:hover:bg-blue-800');
    });
}

function handleOpenSubmit() {
    if (submitBtn.disabled) return;
    if (currentQuestion.type === 'open_double') {
        handleOpenDoubleSubmit();
    } else {
        handleOpenSingleSubmit();
    }
}

function handleOpenSingleSubmit() {
    if (!currentQuestion.answer) return;
    const userAnswer = normalizeString(answerInput.value);
    if (!userAnswer) return;
    const correctAnswers = currentQuestion.answer.split('/');
    if (currentQuestion.isBeingCorrected) {
        const isNowCorrect = correctAnswers.some(correctAnswer => {
            const normalizedCorrectAnswer = normalizeString(correctAnswer);
            return calculateSimilarity(userAnswer, normalizedCorrectAnswer) >= 0.9;
        });
        if (isNowCorrect) {
            loadQuestion();
        } else {
            answerInput.value = '';
            answerInput.classList.add('animate-pulse', 'border-red-500');
            setTimeout(() => answerInput.classList.remove('animate-pulse', 'border-red-500'), 1000);
        }
        return;
    }
    answerInput.disabled = true;
    submitBtn.disabled = true;
    const isCorrect = correctAnswers.some(correctAnswer => {
        const normalizedCorrectAnswer = normalizeString(correctAnswer);
        return calculateSimilarity(userAnswer, normalizedCorrectAnswer) >= 0.8;
    });
    showFeedback(isCorrect, null);
}

function handleOpenDoubleSubmit() {
    if (!currentQuestion.answer || !currentQuestion.answer2) return;
    const userAnswer1 = normalizeString(answerInput1.value);
    const userAnswer2 = normalizeString(answerInput2.value);
    if (!userAnswer1 || !userAnswer2) return;
    const correctAnswers1 = currentQuestion.answer.split('/');
    const correctAnswers2 = currentQuestion.answer2.split('/');
    if (currentQuestion.isBeingCorrected) {
        const isNowCorrect1 = correctAnswers1.some(correctAnswer =>
            calculateSimilarity(userAnswer1, normalizeString(correctAnswer)) >= 0.9
        );
        const isNowCorrect2 = correctAnswers2.some(correctAnswer =>
            calculateSimilarity(userAnswer2, normalizeString(correctAnswer)) >= 0.9
        );
        if (isNowCorrect1 && isNowCorrect2) {
            loadQuestion();
        } else {
            answerInput1.value = '';
            answerInput2.value = '';
            answerInput1.classList.add('animate-pulse', 'border-red-500');
            answerInput2.classList.add('animate-pulse', 'border-red-500');
            setTimeout(() => {
                answerInput1.classList.remove('animate-pulse', 'border-red-500');
                answerInput2.classList.remove('animate-pulse', 'border-red-500');
            }, 1000);
        }
        return;
    }
    answerInput1.disabled = true;
    answerInput2.disabled = true;
    submitBtn.disabled = true;
    const isCorrect1 = correctAnswers1.some(correctAnswer =>
        calculateSimilarity(userAnswer1, normalizeString(correctAnswer)) >= 0.8
    );
    const isCorrect2 = correctAnswers2.some(correctAnswer =>
        calculateSimilarity(userAnswer2, normalizeString(correctAnswer)) >= 0.8
    );
    showFeedback(isCorrect1 && isCorrect2, null);
}

// --- LÓGICA DE IA ---
function initializeAi() {
    if (geminiApiKey) {
        try {
            genAI = new GoogleGenerativeAI(geminiApiKey);
            isAiEnabled = true;
            aiIconOff.classList.add('hidden');
            aiIconOn.classList.remove('hidden');
        } catch (e) {
            console.error("Erro ao inicializar Gemini:", e);
            isAiEnabled = false;
        }
    }
}

async function checkAnswerWithAi(question, correctAnswers, userAnswer, ballIndex) {
    if (!isAiEnabled || !genAI) return;

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-lite-latest",
            tools: [{
                functionDeclarations: [{
                    name: "marcar_como_correto",
                    description: "Marca a resposta do usuário como correta se ela for semanticamente igual à resposta esperada, ignorando erros de digitação ou pequenas omissões.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            justificativa: { type: "STRING", description: "Breve explicação do porquê a resposta foi aceita." }
                        },
                        required: ["justificativa"]
                    }
                }]
            }]
        });

        const prompt = `
            Você é um revisor de flashcards especializado em medicina e anatomia. 
            O usuário deu uma resposta que o sistema automático marcou como incorreta, mas você deve avaliar se ela é semanticamente válida ou uma variação aceitável (como abreviações, sinônimos ou partes fundamentais da resposta).

            Pergunta: "${question}"
            Resposta(s) Esperada(s) no Banco: "${correctAnswers.join(' / ')}"
            Resposta Digitada pelo Usuário: "${userAnswer}"

            DIRETRIZES DE AVALIAÇÃO:
            1. Se o usuário digitou uma parte fundamental da resposta que é suficiente para demonstrar conhecimento (ex: "Braquial" para "Músculo braquial"), considere CORRETO.
            2. Se o usuário usou um sinônimo exato ou termo tecnicamente equivalente, considere CORRETO.
            3. Se a resposta for apenas uma descrição vaga ou estiver errada, não faça nada.

            Se a resposta for semanticamente equivalente ou uma variação aceitável, chame a função 'marcar_como_correto'.
        `;

        const chat = model.startChat();
        const result = await chat.sendMessage(prompt);
        const response = result.response;
        const calls = response.candidates[0].content.parts.filter(p => !!p.functionCall);

        if (calls.length > 0) {
            const call = calls[0].functionCall;
            if (call.name === 'marcar_como_correto') {
                console.log("IA corrigiu a resposta:", call.args.justificativa);
                applyAiCorrection(ballIndex);
            }
        }
    } catch (e) {
        console.error("Erro na verificação de IA:", e);
    }
}

function applyAiCorrection(ballIndex) {
    // 1. Transformar a bola vermelha em amarela
    if (balls[ballIndex]) {
        balls[ballIndex].color = 'rgba(250, 204, 21, 0.8)'; // Yellow-400
    }

    // 2. Incrementar pontuação
    score++;
    scoreDisplay.textContent = score;

    // 3. Remover do pool se ainda estiver lá
    // Nota: A questão atual pode já ter mudado se o usuário for rápido, 
    // mas o pool ainda contém as questões que ele errou.
    // Como o pool é embaralhado, precisamos encontrar a questão correta.
    // Por simplicidade, vamos marcar que essa questão específica foi resolvida.
    // No entanto, showFeedback já remove do pool se isCorrect for true.
    // Se foi AI, precisamos remover agora.

    // Se a questão que a IA corrigiu ainda for a questão atual que está sendo exibida como "erro":
    if (currentQuestion.isBeingCorrected) {
        questionsPool.splice(currentQuestionIndexInPool, 1);
        saveGameState();
        // Se o usuário ainda estiver na tela de erro, avança
        if (!nextQuestionBtn.classList.contains('hidden')) {
            loadQuestion();
        }
    } else {
        // Se o usuário já pulou ou errou outra, tentamos achar no pool
        // Mas isso é mais complexo. O requisito diz "marcada como correta no deck".
        // Vamos apenas garantir que ela saia do pool se estiver lá.
        const idx = questionsPool.findIndex(q => q.description === currentQuestion.description);
        if (idx > -1) {
            questionsPool.splice(idx, 1);
            saveGameState();
        }
    }
}

function openAiChat() {
    aiChatContainer.classList.add('open');
    chatInput.focus();
}

async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message || !isAiEnabled || !genAI) return;

    // Adicionar mensagem do usuário na tela
    addMessageToChat('user', message);
    chatInput.value = '';

    // Mostrar animação de digitando
    const typingId = showTypingIndicator();

    try {
        // Se for o início de uma nova conversa para esta questão, inicializamos o modelo com o contexto
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

            const model = genAI.getGenerativeModel({
                model: "gemini-flash-latest",
                systemInstruction: systemPrompt
            });
            currentChatSession = model.startChat();
        }

        const result = await currentChatSession.sendMessage(message);
        const response = await result.response;

        hideTypingIndicator(typingId);
        addMessageToChat('ai', response.text());
    } catch (e) {
        console.error("Erro no chat de IA:", e);
        hideTypingIndicator(typingId);
        addMessageToChat('ai', "Desculpe, tive um erro ao processar sua pergunta. Verifique sua conexão ou chave de API.");
        // Resetar sessão em caso de erro crítico para permitir tentar novamente
        currentChatSession = null;
    }
}

function addMessageToChat(sender, text) {
    const div = document.createElement('div');
    div.className = sender === 'ai' ? 'chat-message-ai' : 'chat-message-user';

    if (sender === 'ai' && window.marked) {
        div.innerHTML = marked.parse(text);
    } else {
        div.textContent = text;
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'typing-indicator';
    div.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
}

function hideTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

function showFeedback(isCorrect, element) {
    // Capturar a resposta do usuário para o contexto do chat de IA
    let userAnswer = "";
    if (currentQuestion.type === 'open_double') {
        userAnswer = `${answerInput1.value} ; ${answerInput2.value}`;
    } else if (currentQuestion.type === 'open') {
        userAnswer = answerInput.value;
    } else if (element) {
        userAnswer = element.textContent;
    }
    lastUserAnswerForChat = userAnswer;

    const ballIndex = createBall(isCorrect);

    // Background AI Check if wrong
    if (!isCorrect && isAiEnabled) {
        if (userAnswer) {
            const correctAnswers = [currentQuestion.answer];
            if (currentQuestion.answer2) correctAnswers.push(currentQuestion.answer2);
            checkAnswerWithAi(currentQuestion.description, correctAnswers, userAnswer, ballIndex);
        }
    }

    questionCard.classList.add(isCorrect ? 'glow-correct' : 'glow-incorrect');

    if (!isCorrect && isAiEnabled) {
        askAiBtn.style.display = 'flex';
        askAiBtn.classList.remove('hidden');
    } else {
        askAiBtn.style.display = 'none';
        askAiBtn.classList.add('hidden');
    }

    if (element) {
        mcOptionBtns.forEach(btn => btn.disabled = true);
        element.classList.remove('bg-gray-200', 'dark:bg-gray-600', 'hover:bg-blue-200', 'dark:hover:bg-blue-800');
        if (isCorrect) {
            element.classList.add('bg-green-500', 'text-white', 'hover:bg-green-500');
        } else {
            element.classList.add('bg-red-500', 'text-white', 'hover:bg-red-500');
            mcOptionBtns.forEach(btn => {
                if (normalizeString(btn.textContent) === normalizeString(currentQuestion.answer)) {
                    btn.classList.remove('bg-gray-200', 'dark:bg-gray-600');
                    btn.classList.add('bg-green-500', 'text-white');
                }
            });
        }
    } else {
        if (!isCorrect) {
            currentQuestion.isBeingCorrected = true;
            updateFeedbackText();
            if (currentQuestion.type === 'open_double') {
                answerInput1.value = ''; answerInput2.value = '';
                answerInput1.placeholder = 'Digite a Resposta 1 correta ou pule ⚡';
                answerInput2.placeholder = 'Digite a Resposta 2 correta ou pule ⚡';
                answerInput1.disabled = false; answerInput2.disabled = false;
                answerInput1.focus();
            } else {
                answerInput.value = '';
                answerInput.placeholder = 'Digite a resposta correta ou pule ⚡';
                answerInput.disabled = false;
                answerInput.focus();
            }
            submitBtn.classList.add('hidden');
            submitBtn.disabled = false;
            nextQuestionBtn.classList.remove('hidden');
            correctionOptions.classList.remove('hidden');
            correctionOptions.classList.add('flex');
        }
    }
    if (isCorrect) {
        score++;
        scoreDisplay.textContent = score;
        questionsPool.splice(currentQuestionIndexInPool, 1);
        saveGameState();
        setTimeout(loadQuestion, 2500);
    } else if (currentQuestion.type === 'multiple_choice') {
        setTimeout(loadQuestion, 3500);
    }
}

function handleMCSubmit(button) {
    if (button.disabled) return;
    const userAnswer = normalizeString(button.textContent);
    const correctAnswer = normalizeString(currentQuestion.answer);
    const isCorrect = userAnswer === correctAnswer;
    showFeedback(isCorrect, button);
}

function resetToUploadScreen() {
    gameContainer.classList.add('hidden');
    uploadScreen.classList.remove('hidden');
    allQuestions = [];
    questionsPool = [];
    score = 0;
    currentQuestion = {};
    currentQuestionIndexInPool = -1;
    scoreDisplay.textContent = '0';
    questionsLeftDisplay.textContent = '0';
    fileInput.value = null;
    currentFile = null;
    startBtn.disabled = true;
    startBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
    startBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    startBtn.textContent = "📂 Abrir Arquivo";
    uploadError.textContent = '';
    deckTitle.textContent = 'Flashcards';
    balls = [];
    resetUI();
    localStorage.removeItem('flashcardsSave');
}

// --- EVENT LISTENERS ---
resetBtn.addEventListener('click', resetToUploadScreen);
submitBtn.addEventListener('click', handleOpenSubmit);
exportBtn.addEventListener('click', exportUpdatedJson);
deleteCardBtn.addEventListener('click', deleteCurrentCard);

deleteCorrectionBtn.addEventListener('click', deleteCurrentCard);
editBtn.addEventListener('click', openEditModal);

closeModalBtn.addEventListener('click', closeEditModal);
cancelEditBtn.addEventListener('click', closeEditModal);
saveEditBtn.addEventListener('click', saveEditedCard);

editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });

answerInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') handleOpenSubmit(); });
answerInput1.addEventListener('keyup', (event) => { if (event.key === 'Enter') handleOpenSubmit(); });
answerInput2.addEventListener('keyup', (event) => { if (event.key === 'Enter') handleOpenSubmit(); });

window.addEventListener('resize', resizeCanvas, false);
nextQuestionBtn.addEventListener('click', () => { loadQuestion(); });

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    animate();
    const savedData = localStorage.getItem('flashcardsSave');
    initializeAi();
    if (savedData) {
        try {
            const gameState = JSON.parse(savedData);
            questionsPool = gameState.questionsPool;
            allQuestions = gameState.allQuestions;
            score = gameState.score;
            deckTitle.textContent = gameState.deckTitle;
            scoreDisplay.textContent = score;
            uploadScreen.classList.add('hidden');
            gameContainer.classList.remove('hidden');
            loadQuestion();
        } catch (e) {
            console.error("Erro ao carregar save:", e);
            localStorage.removeItem('flashcardsSave');
        }
    }
});

function saveGameState() {
    const gameState = {
        questionsPool: questionsPool,
        allQuestions: allQuestions,
        score: score,
        deckTitle: deckTitle.textContent
    };
    localStorage.setItem('flashcardsSave', JSON.stringify(gameState));
}