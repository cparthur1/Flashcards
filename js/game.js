import { GoogleGenerativeAI } from '@google/generative-ai';
import { normalizeString, calculateSimilarity, shuffleArray, callWithRetry, ROUTES } from './utils.js';

// --- DOM ELEMENTS ---
const deckTitle = document.getElementById('deck-title');
const resetBtn = document.getElementById('reset-btn');
const exportBtn = document.getElementById('export-btn');
const gameContainer = document.getElementById('game-container');
const goToEditorBtn = document.getElementById('go-to-editor-btn');

const questionText = document.getElementById('question-text');
const scoreDisplay = document.getElementById('score');
const questionsLeftDisplay = document.getElementById('questions-left');
const questionCard = document.getElementById('question-card');
const deleteCardBtn = document.getElementById('delete-card-btn');

const correctionOptions = document.getElementById('correction-options');
const editBtn = document.getElementById('edit-btn');
const deleteCorrectionBtn = document.getElementById('delete-correction-btn');

const editModal = document.getElementById('edit-modal');
const editQuestionInput = document.getElementById('edit-question-input');
const editAnswerInput = document.getElementById('edit-answer-input');
const editAnswer2Group = document.getElementById('edit-answer-2-group');
const editAnswer2Input = document.getElementById('edit-answer-2-input');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveEditBtn = document.getElementById('save-edit-btn');

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

const askAiBtn = document.getElementById('ask-ai-btn');
const aiChatContainer = document.getElementById('ai-chat-container');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

const canvas = document.getElementById('background-canvas');
const ctx = canvas.getContext('2d');

// --- GAME STATE ---
let allQuestions = [];
let questionsPool = [];
let score = 0;
let currentQuestion = {};
let currentQuestionIndexInPool = -1;
let balls = [];

// --- AI STATE ---
let isAiEnabled = false;
let geminiApiKey = localStorage.getItem('gemini_api_key_checker') || '';
let genAI = null;
let lastUserAnswerForChat = "";
let currentChatSession = null;

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
    balls.forEach((ball, i) => {
        if (!ball.isStatic) {
            ball.dy += 0.2;
            ball.y += ball.dy;
            if (ball.y + ball.radius >= canvas.height) {
                ball.y = canvas.height - ball.radius;
                ball.isStatic = true;
            }
            // Simple collision check with static balls
            for (let j = 0; j < balls.length; j++) {
                if (i === j || !balls[j].isStatic) continue;
                const other = balls[j];
                const dx = ball.x - other.x;
                const dy = ball.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < ball.radius + other.radius && ball.y < other.y) {
                    ball.dy *= -0.3;
                    ball.y = other.y - (ball.radius + other.radius);
                    ball.x += dx * 0.05;
                }
            }
        }
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
    questionsLeftDisplay.textContent = questionsPool.length;
    currentQuestionIndexInPool = Math.floor(Math.random() * questionsPool.length);
    currentQuestion = questionsPool[currentQuestionIndexInPool];
    questionText.textContent = currentQuestion.description;

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
    chatMessages.innerHTML = '<div class="chat-message-ai">Olá! Como posso ajudar você a entender melhor esta questão?</div>';
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
        scoreDisplay.textContent = score;
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
    localStorage.setItem('flashcardsSave', JSON.stringify({
        questionsPool, allQuestions, score, deckTitle: deckTitle.textContent
    }));
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

        const expected = [questionObj.answer, questionObj.answer2].filter(Boolean).join(' / ');
        
        const prompt = `
            Você é um revisor de flashcards. 
            O usuário deu uma resposta que o sistema automático marcou como incorreta, mas você deve avaliar se ela é semanticamente válida ou uma variação aceitável (como abreviações, sinônimos ou partes fundamentais da resposta).

            Pergunta: "${questionObj.description}"
            Resposta(s) Esperada(s) no Banco: "${expected}"
            Resposta Digitada pelo Usuário: "${actualAnswer}"

            DIRETRIZES DE AVALIAÇÃO:
            1. Se o usuário digitou uma parte fundamental da resposta que é suficiente para demonstrar conhecimento (ex: "Braquial" para "Músculo braquial"), considere CORRETO, seja rígido nesse critério.
            2. Se o usuário usou um sinônimo exato ou termo tecnicamente equivalente, aceito pela comunidade acadêmica, considere CORRETO.
            3. Se a resposta for apenas uma descrição vaga, confusa ou estiver errada, não faça nada.

            Se a resposta for semanticamente equivalente ou uma variação aceitável, mantendo a especificidade e falando da mesma estrutura da resposta original, chame a função 'marcar_como_correto'.
        `;

        const result = await callWithRetry(() => model.generateContent(prompt));
        const calls = result.response.candidates[0].content.parts.filter(p => !!p.functionCall);

        if (calls.length > 0 && calls[0].functionCall.name === 'marcar_como_correto') {
            console.log("Agente corrigiu a resposta:", calls[0].functionCall.args.justificativa);
            
            // Sucesso! A IA corrigiu o erro.
            balls[ballIdx].color = 'rgba(250, 204, 21, 0.8)'; // Amarelo/Dourado para correção IA
            score++;
            scoreDisplay.textContent = score;
            
            // Remove da pool se ainda for a mesma questão e salva
            const idx = questionsPool.findIndex(card => card.description === questionObj.description);
            if (idx > -1) {
                questionsPool.splice(idx, 1);
                saveGameState();
            }
            
            // Feedback visual de sucesso
            questionCard.classList.remove('glow-incorrect');
            questionCard.classList.add('glow-correct');
            setTimeout(loadQuestion, 2000);
        }
    } catch (e) {
        console.error("Erro na correção IA:", e);
    }
}

async function sendChatMessage() {
    const msg = chatInput.value.trim();
    if (!msg || !isAiEnabled || !genAI) return;
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

            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest", systemInstruction: systemPrompt });
            currentChatSession = model.startChat();
        }
        const result = await callWithRetry(() => currentChatSession.sendMessage(msg));
        hideTyping(tid); addMsg('ai', result.response.text());
    } catch (e) { console.error(e); hideTyping(tid); addMsg('ai', "Erro ao conectar com a IA."); }
}

function addMsg(sender, text) {
    const div = document.createElement('div');
    div.className = sender === 'ai' ? 'chat-message-ai' : 'chat-message-user';
    div.innerHTML = sender === 'ai' && typeof marked !== 'undefined' ? marked.parse(text) : text;
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
resetBtn.addEventListener('click', () => { if (confirm("Sair?")) { localStorage.removeItem('flashcardsSave'); window.location.href = ROUTES.HOME; } });
exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(allQuestions, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${deckTitle.textContent}.json`; a.click();
});
goToEditorBtn.addEventListener('click', () => {
    localStorage.setItem('editing_deck', JSON.stringify(allQuestions));
    localStorage.setItem('editing_deck_title', deckTitle.textContent);
    window.location.href = ROUTES.GENERATE;
});
aiToggleBtn.addEventListener('click', () => { apiModal.classList.remove('hidden'); apiKeyInput.value = geminiApiKey; });
saveApiKeyBtn.addEventListener('click', () => {
    geminiApiKey = apiKeyInput.value.trim();
    localStorage.setItem('gemini_api_key_checker', geminiApiKey);
    initializeAi(); apiModal.classList.add('hidden');
});
disableAiBtn.addEventListener('click', () => {
    isAiEnabled = false; geminiApiKey = ''; localStorage.removeItem('gemini_api_key_checker');
    aiIconOff.classList.remove('hidden'); aiIconOn.classList.add('hidden'); apiModal.classList.add('hidden');
});
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

editBtn.addEventListener('click', () => {
    editQuestionInput.value = currentQuestion.description;
    editAnswerInput.value = currentQuestion.answer;
    editAnswer2Group.classList.toggle('hidden', currentQuestion.type !== 'open_double');
    editAnswer2Input.value = currentQuestion.answer2 || '';
    editModal.classList.remove('hidden');
});
saveEditBtn.addEventListener('click', () => {
    currentQuestion.description = editQuestionInput.value;
    currentQuestion.answer = editAnswerInput.value;
    if (currentQuestion.type === 'open_double') currentQuestion.answer2 = editAnswer2Input.value;
    saveGameState(); editModal.classList.add('hidden'); updateFeedbackText();
});
[closeModalBtn, cancelEditBtn].forEach(b => b.addEventListener('click', () => editModal.classList.add('hidden')));

document.addEventListener('DOMContentLoaded', () => {
    resizeCanvas(); animate();
    const data = JSON.parse(localStorage.getItem('flashcardsSave'));
    if (!data) window.location.href = ROUTES.HOME;
    else {
        allQuestions = data.allQuestions; questionsPool = data.questionsPool;
        score = data.score; deckTitle.textContent = data.deckTitle;
        scoreDisplay.textContent = score; loadQuestion(); initializeAi();
    }
});
window.addEventListener('resize', resizeCanvas);
