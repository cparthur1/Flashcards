// --- ELEMENTOS DO DOM ---
const deckTitle = document.getElementById('deck-title');
const resetBtn = document.getElementById('reset-btn');
const uploadScreen = document.getElementById('upload-screen');
const gameContainer = document.getElementById('game-container');
const fileInput = document.getElementById('file-input');
const startBtn = document.getElementById('start-btn');
const uploadError = document.getElementById('upload-error');

const questionText = document.getElementById('question-text');
const scoreDisplay = document.getElementById('score');
const questionsLeftDisplay = document.getElementById('questions-left');
const questionCard = document.getElementById('question-card');

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

// Canvas elements for background animation
const canvas = document.getElementById('background-canvas');
const ctx = canvas.getContext('2d');

// --- ESTADO DO JOGO ---
let allQuestions = [];
let questionsPool = [];
let score = 0;
let currentQuestion = {};
let currentQuestionIndexInPool = -1;
let balls = [];
let currentFile = null; // Para guardar a referência ao arquivo

// --- LÓGICA DE UPLOAD ---
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        currentFile = fileInput.files[0]; // Armazena o arquivo
        startBtn.disabled = false;
        uploadError.textContent = '';
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
            const fileName = currentFile.name.replace(/\.json$/i, ''); // Remove .json
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

// --- LÓGICA DA ANIMAÇÃO (CANVAS) ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function createBall(isCorrect) {
    const radius = Math.random() * 5 + 8; // Smaller balls
    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const y = -radius;
    const color = isCorrect ? 'rgba(74, 222, 128, 0.8)' : 'rgba(239, 68, 68, 0.8)';
    const dy = 0; // Initial vertical velocity
    balls.push({ x, y, radius, color, dy, isStatic: false });
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < balls.length; i++) {
        const ball = balls[i];

        if (!ball.isStatic) {
            ball.dy += 0.2; // Gravity
            ball.y += ball.dy;

            // Colisão com o chão (condição final para parar)
            if (ball.y + ball.radius >= canvas.height) {
                ball.y = canvas.height - ball.radius;
                ball.isStatic = true;
                continue; // Pula para a próxima bola, pois esta já se tornou estática
            }

            let isTouchingStatic = false;

            // Loop de colisão com outras bolas
            for (let j = 0; j < balls.length; j++) {
                if (i === j || !balls[j].isStatic) continue;

                const otherBall = balls[j];
                const dx = ball.x - otherBall.x;
                const dy = ball.y - otherBall.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = ball.radius + otherBall.radius;

                if (distance < minDistance && ball.y < otherBall.y) {
                    isTouchingStatic = true; // Marca que a bola está em contato nesta frame
                    
                    // --- INÍCIO DA LÓGICA DO TEMPORIZADOR ---
                    // Se o temporizador ainda não foi iniciado para esta bola, inicie-o agora.
                    if (!ball.firstContactTime) {
                        ball.firstContactTime = Date.now();
                    }
                    
                    // Aplica a física do quique e rolamento
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

            // --- VERIFICAÇÃO DO TEMPORIZADOR (APÓS O LOOP DE COLISÃO) ---
            if (isTouchingStatic) {
                // Se a bola está em contato E o temporizador foi iniciado...
                if (ball.firstContactTime) {
                    // Verifique se já se passaram 5 segundos (5000 milissegundos)
                    const timeSinceFirstContact = Date.now() - ball.firstContactTime;
                    if (timeSinceFirstContact > 5000) {
                        ball.isStatic = true;
                    }
                }
            }
        }
    }
    
    // Draw all balls
    balls.forEach(ball => {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.closePath();
    });
    
    // Limit the number of balls to maintain performance
    if (balls.length > 400) {
        balls.shift();
    }

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
        setTimeout(() => {
            balls = []; // Clear balls on restart
            startGame();
        }, 3000);
        return;
    }
    
    resetUI();
    questionsLeftDisplay.textContent = questionsPool.length;
    currentQuestionIndexInPool = Math.floor(Math.random() * questionsPool.length);
    currentQuestion = questionsPool[currentQuestionIndexInPool];
    questionText.textContent = currentQuestion.description;

    // Esconde todas as áreas de resposta
    openAnswerArea.classList.add('hidden');
    openDoubleAnswerArea.classList.add('hidden');
    mcAnswerArea.classList.add('hidden');
    actionButtonsArea.classList.add('hidden');

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
    } else { // 'open' type
        openAnswerArea.classList.remove('hidden');
        actionButtonsArea.classList.remove('hidden');
        answerInput.focus();
    }
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
    submitBtn.classList.remove('hidden'); // Garante que o botão de verificar apareça
    nextQuestionBtn.classList.add('hidden'); // Esconde o botão de próxima questão
    
    questionCard.classList.remove('glow-correct', 'glow-incorrect');
    questionText.classList.remove('text-red-500', 'text-green-500');
    // Limpa o texto do HTML, caso a resposta anterior tenha sido mostrada
    questionText.textContent = currentQuestion.description || ''; 
    
    mcOptionBtns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('bg-green-500', 'bg-red-500', 'text-white', 'hover:bg-green-500', 'hover:bg-red-500');
        btn.classList.add('bg-gray-200', 'dark:bg-gray-600', 'hover:bg-blue-200', 'dark:hover:bg-blue-800');
    });
}

function handleOpenSubmit() {
    // Previne cliques múltiplos se o botão já estiver desabilitado
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

    // Se a questão foi marcada como "sendo corrigida"
    if (currentQuestion.isBeingCorrected) {
        const isNowCorrect = correctAnswers.some(correctAnswer => {
            const normalizedCorrectAnswer = normalizeString(correctAnswer);
            return calculateSimilarity(userAnswer, normalizedCorrectAnswer) >= 0.9; // Correção estrita
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

    // Lógica original de verificação
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

    // Se a questão foi marcada como "sendo corrigida"
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
            // Se errar a correção, limpa os campos para tentar de novo
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

    // Lógica original de verificação
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


function showFeedback(isCorrect, element) {
    createBall(isCorrect);
    questionCard.classList.add(isCorrect ? 'glow-correct' : 'glow-incorrect');

    if (element) { // Múltipla escolha
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
    } else { // Resposta Aberta (Simples ou Dupla)
        if (!isCorrect) {
            currentQuestion.isBeingCorrected = true; // Marca a questão para o modo de correção
            
            if (currentQuestion.type === 'open_double') {
                // Mostra ambas as respostas corretas
                const label1 = currentQuestion.placeholder1 || 'Resposta 1';
                const label2 = currentQuestion.placeholder2 || 'Resposta 2';
                questionText.innerHTML = `
                    ${currentQuestion.description}<br>
                    <span class="text-green-500 font-semibold mt-2 block">${label1}: ${currentQuestion.answer.replace('/', ' ou ')}</span>
                    <span class="text-green-500 font-semibold mt-2 block">${label2}: ${currentQuestion.answer2.replace('/', ' ou ')}</span>
                `;
                // Prepara campos para correção
                answerInput1.value = '';
                answerInput2.value = '';
                answerInput1.placeholder = 'Digite a Resposta 1 correta ou pule ⚡';
                answerInput2.placeholder = 'Digite a Resposta 2 correta ou pule ⚡';
                answerInput1.disabled = false; // Reativa o campo
                answerInput2.disabled = false; // Reativa o campo
                answerInput1.focus();

            } else { // 'open' simples
                // Mostra a resposta correta
                questionText.innerHTML = `${currentQuestion.description}<br><span class="text-green-500 font-semibold mt-2 block">Resposta: ${currentQuestion.answer.replace('/', ' ou ')}</span>`;
                // Prepara campo para correção
                answerInput.value = '';
                answerInput.placeholder = 'Digite a resposta correta ou pule ⚡';
                answerInput.disabled = false; // Reativa o campo
                answerInput.focus();
            }
            
            // Lógica comum para botões em caso de erro
            submitBtn.classList.add('hidden'); 
            submitBtn.disabled = false; // Deixa habilitado para o "Enter" continuar funcionando
            nextQuestionBtn.classList.remove('hidden');
        }
    }

    if (isCorrect) {
        score++;
        scoreDisplay.textContent = score;
        questionsPool.splice(currentQuestionIndexInPool, 1);
        saveGameState();
        setTimeout(loadQuestion, 2500); // Avança automaticamente se acertar
    } else if (currentQuestion.type === 'multiple_choice') {
        // Para múltipla escolha, avança com timeout após o erro
        setTimeout(loadQuestion, 3500);
    }
    // Se for 'open' ou 'open_double' e errada, espera a ação do usuário (digitar ou pular)
}

function handleMCSubmit(button) {
    if (button.disabled) return;
    const userAnswer = normalizeString(button.textContent);
    const correctAnswer = normalizeString(currentQuestion.answer);
    const isCorrect = userAnswer === correctAnswer;
    showFeedback(isCorrect, button);
}

function resetToUploadScreen() {
    // Esconde a tela de jogo e mostra a de upload
    gameContainer.classList.add('hidden');
    uploadScreen.classList.remove('hidden');

    // Reseta o estado do jogo
    allQuestions = [];
    questionsPool = [];
    score = 0;
    currentQuestion = {};
    currentQuestionIndexInPool = -1;
    scoreDisplay.textContent = '0';
    questionsLeftDisplay.textContent = '0';

    // Limpa o input de arquivo e desabilita o botão
    fileInput.value = null; 
    currentFile = null; // Limpa a referência ao arquivo
    startBtn.disabled = true;
    uploadError.textContent = '';

    // Reseta o título para o padrão
    deckTitle.textContent = 'Flashcards';

    // Limpa as bolinhas da animação
    balls = [];
    
    // Garante que a UI do card esteja limpa (chama resetUI sem um currentQuestion válido)
    currentQuestion = {}; // Esvazia para garantir que resetUI limpe tudo
    resetUI();

    // Erase localStorage
    localStorage.removeItem('flashcardsSave');
}

// --- EVENT LISTENERS ---
resetBtn.addEventListener('click', resetToUploadScreen);
submitBtn.addEventListener('click', handleOpenSubmit);

// Adiciona listeners para a tecla 'Enter' em todos os campos de input
answerInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') handleOpenSubmit();
});
answerInput1.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') handleOpenSubmit();
});
answerInput2.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') handleOpenSubmit();
});

window.addEventListener('resize', resizeCanvas, false);
nextQuestionBtn.addEventListener('click', () => {
    loadQuestion();
});

// --- INITIALIZATION ---
// Adiciona um listener para garantir que o DOM esteja pronto
document.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    animate();

    // Lógica de Carregamento
    const savedData = localStorage.getItem('flashcardsSave');
    if (savedData) {
        try {
            const gameState = JSON.parse(savedData);
            
            // Restaura as variáveis globais
            questionsPool = gameState.questionsPool;
            allQuestions = gameState.allQuestions;
            score = gameState.score;
            
            // Atualiza a Interface
            deckTitle.textContent = gameState.deckTitle;
            scoreDisplay.textContent = score;
            
            // Troca de tela (esconde upload, mostra jogo)
            uploadScreen.classList.add('hidden');
            gameContainer.classList.remove('hidden');
            
            loadQuestion(); // Carrega a próxima questão salva
        } catch (e) {
            console.error("Erro ao carregar save:", e);
            localStorage.removeItem('flashcardsSave'); // Limpa save corrompido
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
