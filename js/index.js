// Handles landing page functionality: redirects, single deck and Semana de Provas multi-deck uploads.
import { ROUTES } from './utils.js';

function init() {
    // Redirect to game if active deck session exists
    const activeMode = localStorage.getItem('flashcardsActiveMode');
    if (activeMode === 'exam' && localStorage.getItem('flashcardsExam')) {
        window.location.href = ROUTES.GAME;
        return;
    }
    if (localStorage.getItem('flashcardsSave')) {
        window.location.href = ROUTES.GAME;
        return;
    }

    const openNotebookBtn = document.getElementById('open-notebook-btn');
    const notebookCount = document.getElementById('notebook-count');
    if (openNotebookBtn && notebookCount) {
        try {
            const notebookData = JSON.parse(localStorage.getItem('flashcardsNotebook'));
            if (notebookData && notebookData.allQuestions && notebookData.allQuestions.length > 0) {
                notebookCount.textContent = notebookData.allQuestions.length;
                openNotebookBtn.classList.remove('hidden');
                openNotebookBtn.addEventListener('click', () => {
                    localStorage.setItem('flashcardsActiveMode', 'notebook');
                    window.location.href = ROUTES.GAME;
                });
            }
        } catch (e) {
            console.error("Erro ao carregar contador do Caderno:", e);
        }
    }

    // --- Check Saved Exam Week Session ---
    const examSavedBadge = document.getElementById('exam-saved-badge');
    const examSavedSessionBox = document.getElementById('exam-saved-session-box');
    const examSavedCardsCount = document.getElementById('exam-saved-cards-count');
    const examSavedDecksText = document.getElementById('exam-saved-decks-text');
    const examContinueBtn = document.getElementById('exam-continue-btn');

    let savedExamData = null;
    try {
        const raw = localStorage.getItem('flashcardsExam');
        if (raw) {
            savedExamData = JSON.parse(raw);
            if (savedExamData && savedExamData.questionsPool && savedExamData.questionsPool.length > 0) {
                if (examSavedBadge) examSavedBadge.classList.remove('hidden');
                if (examSavedSessionBox) examSavedSessionBox.classList.remove('hidden');
                if (examSavedCardsCount) {
                    examSavedCardsCount.textContent = `${savedExamData.questionsPool.length} cards restantes`;
                }
                if (examSavedDecksText) {
                    const deckNames = (savedExamData.decks || []).map(d => d.name).join(', ');
                    examSavedDecksText.textContent = deckNames ? `Baralhos: ${deckNames}` : "Você já tem uma mistura salva.";
                }
            }
        }
    } catch (e) {
        console.warn("Erro ao ler sessão salva de Semana de Provas:", e);
    }

    if (examContinueBtn) {
        examContinueBtn.addEventListener('click', () => {
            localStorage.setItem('flashcardsActiveMode', 'exam');
            window.location.href = ROUTES.GAME;
        });
    }

    const fileInput = document.getElementById('file-input');
    const startBtn = document.getElementById('start-btn');
    const uploadError = document.getElementById('upload-error');
    let selectedFiles = [];

    // Helper: Fisher-Yates shuffle
    function shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Helper: Read single file as text
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (err) => reject(err);
            reader.readAsText(file);
        });
    }

    // Helper: Start Exam Week Session
    function startExamWeek(decksList) {
        if (!decksList || decksList.length === 0) return;

        let allCombinedQuestions = [];
        let registeredDecks = [];

        decksList.forEach(d => {
            registeredDecks.push({
                id: d.id,
                name: d.name,
                enabled: true,
                cardCount: d.cards.length
            });
            d.cards.forEach(card => {
                allCombinedQuestions.push({
                    ...card,
                    deckId: d.id,
                    sourceDeck: d.name
                });
            });
        });

        const playable = allCombinedQuestions.filter(q => q && q.type !== 'divisor' && q.type !== 'divider' && q.type !== 'note');
        const shuffledPool = shuffleArray(playable);

        const examState = {
            deckTitle: "Semana de Provas",
            score: 0,
            decks: registeredDecks,
            allQuestions: allCombinedQuestions,
            questionsPool: shuffledPool
        };

        try {
            localStorage.setItem('flashcardsExam', JSON.stringify(examState));
            localStorage.setItem('flashcardsActiveMode', 'exam');
            window.location.href = ROUTES.GAME;
        } catch (err) {
            if (err.name === 'QuotaExceededError') {
                alert("Os baralhos somados são grandes demais para o navegador. Tente carregar menos baralhos.");
            } else {
                alert("Erro ao iniciar Semana de Provas: " + err.message);
            }
        }
    }

    // --- MAIN FILE INPUT UPLOAD ---
    function handleFileSelection() {
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            selectedFiles = Array.from(fileInput.files);
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                startBtn.classList.add('bg-green-600', 'hover:bg-green-700');
                if (selectedFiles.length === 1) {
                    startBtn.innerHTML = `<img src="assets/img/folder.svg" class="w-6 h-6" alt="Pasta"> Abrir ${selectedFiles[0].name}`;
                } else {
                    startBtn.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg> Abrir Semana de Provas (${selectedFiles.length} baralhos)`;
                }
            }
            if (uploadError) uploadError.textContent = '';
        }
    }

    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
        fileInput.addEventListener('input', handleFileSelection);
        if (fileInput.files && fileInput.files.length > 0) {
            handleFileSelection();
        }
    }

    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            if (!selectedFiles || selectedFiles.length === 0) {
                uploadError.textContent = 'Por favor, selecione um ou mais arquivos .json.';
                return;
            }

            // Multi-deck mode triggered from main input
            if (selectedFiles.length > 1) {
                try {
                    const loadedDecks = [];
                    for (const file of selectedFiles) {
                        const content = await readFileAsText(file);
                        const parsed = JSON.parse(content);
                        let cards = [];
                        let name = file.name.replace(/\.json$/i, '');

                        if (parsed && parsed.__flashcards_watermark__ === "notebook_backup_v1") {
                            cards = parsed.cards || [];
                            name = parsed.deckTitle || "Caderno";
                        } else if (parsed && parsed.__flashcards_watermark__ === "exam_week_backup_v1") {
                            // Already an exam week backup
                            const examState = {
                                deckTitle: parsed.deckTitle || "Semana de Provas",
                                score: 0,
                                decks: parsed.decks || [],
                                allQuestions: parsed.cards || [],
                                questionsPool: shuffleArray((parsed.cards || []).filter(q => q && q.type !== 'divisor' && q.type !== 'divider' && q.type !== 'note'))
                            };
                            localStorage.setItem('flashcardsExam', JSON.stringify(examState));
                            localStorage.setItem('flashcardsActiveMode', 'exam');
                            window.location.href = ROUTES.GAME;
                            return;
                        } else if (Array.isArray(parsed)) {
                            cards = parsed;
                        }

                        if (cards.length > 0) {
                            loadedDecks.push({
                                id: 'deck_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                                name: name,
                                cards: cards
                            });
                        }
                    }

                    if (loadedDecks.length === 0) {
                        throw new Error("Nenhum card válido encontrado nos arquivos selecionados.");
                    }

                    startExamWeek(loadedDecks);
                } catch (e) {
                    uploadError.innerHTML = `<img src="assets/img/error.svg" class="w-5 h-5 inline-block mr-1" alt="Erro"> Erro ao carregar baralhos: ${e.message}`;
                }
                return;
            }

            // Single file upload
            const currentFile = selectedFiles[0];
            try {
                const content = await readFileAsText(currentFile);
                const parsed = JSON.parse(content);
                let questions = [];
                let deckTitle = currentFile.name.replace(/\.json$/i, '');
                let isNotebook = false;
                let isExamBackup = false;

                if (parsed && parsed.__flashcards_watermark__ === "notebook_backup_v1") {
                    questions = parsed.cards || [];
                    deckTitle = parsed.deckTitle || "Caderno";
                    isNotebook = true;
                } else if (parsed && parsed.__flashcards_watermark__ === "exam_week_backup_v1") {
                    isExamBackup = true;
                    const playable = (parsed.cards || []).filter(q => q && q.type !== 'divisor' && q.type !== 'divider' && q.type !== 'note');
                    const examState = {
                        deckTitle: parsed.deckTitle || "Semana de Provas",
                        score: 0,
                        decks: parsed.decks || [],
                        allQuestions: parsed.cards || [],
                        questionsPool: shuffleArray(playable)
                    };
                    localStorage.setItem('flashcardsExam', JSON.stringify(examState));
                    localStorage.setItem('flashcardsActiveMode', 'exam');
                    window.location.href = ROUTES.GAME;
                    return;
                } else if (Array.isArray(parsed)) {
                    questions = parsed;
                } else {
                    throw new Error("O arquivo JSON deve ser um array de questões ou um backup compatível.");
                }

                if (questions.length === 0) {
                    throw new Error("O arquivo JSON está vazio.");
                }

                if (isNotebook) {
                    const playable = questions.filter(q => q && q.type !== 'divisor' && q.type !== 'divider' && q.type !== 'note');
                    const notebookState = {
                        questionsPool: [...playable],
                        allQuestions: [...questions],
                        score: 0,
                        deckTitle: deckTitle
                    };
                    try {
                        localStorage.setItem('flashcardsNotebook', JSON.stringify(notebookState));
                        localStorage.setItem('flashcardsActiveMode', 'notebook');
                        window.location.href = ROUTES.GAME;
                    } catch (err) {
                        if (err.name === 'QuotaExceededError') {
                            uploadError.innerHTML = `<img src="assets/img/error.svg" class="w-5 h-5 inline-block mr-1" alt="Erro"> O backup do Caderno é grande demais para salvar no navegador.`;
                        } else {
                            uploadError.innerHTML = `<img src="assets/img/error.svg" class="w-5 h-5 inline-block mr-1" alt="Erro"> Erro ao salvar Caderno: ${err.message}`;
                        }
                    }
                } else {
                    localStorage.setItem('flashcardsActiveMode', 'normal');
                    saveAndRedirect(questions, deckTitle);
                }
            } catch (e) {
                uploadError.innerHTML = `<img src="assets/img/error.svg" class="w-5 h-5 inline-block mr-1" alt="Erro"> Erro ao ler o arquivo: ${e.message}`;
            }
        });
    }

    function saveAndRedirect(questions, title) {
        const playable = questions.filter(q => q && q.type !== 'divisor' && q.type !== 'divider' && q.type !== 'note');
        const gameState = {
            questionsPool: [...playable],
            allQuestions: [...questions],
            score: 0,
            deckTitle: title
        };
        try {
            localStorage.setItem('flashcardsSave', JSON.stringify(gameState));
            window.location.href = ROUTES.GAME;
        } catch (err) {
            if (err.name === 'QuotaExceededError') {
                uploadError.innerHTML = `<img src="assets/img/error.svg" class="w-5 h-5 inline-block mr-1" alt="Erro"> Este baralho é grande demais para salvar no navegador. Converta imagens para links da web.`;
            } else {
                uploadError.innerHTML = `<img src="assets/img/error.svg" class="w-5 h-5 inline-block mr-1" alt="Erro"> Erro ao salvar baralho: ${err.message}`;
            }
        }
    }

    // --- SEMANA DE PROVAS MODAL LOGIC ---
    const openExamBtn = document.getElementById('open-exam-btn');
    const examModal = document.getElementById('exam-modal');
    const closeExamModalBtn = document.getElementById('close-exam-modal-btn');
    const cancelExamModalBtn = document.getElementById('cancel-exam-modal-btn');
    const examDropZone = document.getElementById('exam-drop-zone');
    const examFileInput = document.getElementById('exam-file-input');
    const examDeckList = document.getElementById('exam-deck-list');
    const examEmptyMsg = document.getElementById('exam-empty-msg');
    const examDecksCount = document.getElementById('exam-decks-count');
    const examTotalCards = document.getElementById('exam-total-cards');
    const startExamBtn = document.getElementById('start-exam-btn');
    const examError = document.getElementById('exam-error');

    let modalDecks = []; // Array of { id, name, cards: [...] }

    function openExamModal() {
        if (examModal) {
            examModal.classList.remove('hidden');
        }
    }

    function closeExamModal() {
        if (examModal) {
            examModal.classList.add('hidden');
        }
    }

    if (openExamBtn) openExamBtn.addEventListener('click', openExamModal);
    if (closeExamModalBtn) closeExamModalBtn.addEventListener('click', closeExamModal);
    if (cancelExamModalBtn) cancelExamModalBtn.addEventListener('click', closeExamModal);

    if (examDropZone && examFileInput) {
        examDropZone.addEventListener('click', () => examFileInput.click());

        examDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            examDropZone.classList.add('border-purple-500', 'bg-purple-50/50');
        });

        examDropZone.addEventListener('dragleave', () => {
            examDropZone.classList.remove('border-purple-500', 'bg-purple-50/50');
        });

        examDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            examDropZone.classList.remove('border-purple-500', 'bg-purple-50/50');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processExamFiles(Array.from(e.dataTransfer.files));
            }
        });

        examFileInput.addEventListener('change', () => {
            if (examFileInput.files && examFileInput.files.length > 0) {
                processExamFiles(Array.from(examFileInput.files));
                examFileInput.value = '';
            }
        });
    }

    async function processExamFiles(files) {
        if (examError) {
            examError.textContent = '';
            examError.classList.add('hidden');
        }

        for (const file of files) {
            if (!file.name.toLowerCase().endsWith('.json')) continue;
            try {
                const text = await readFileAsText(file);
                const parsed = JSON.parse(text);
                let cards = [];
                let name = file.name.replace(/\.json$/i, '');

                if (parsed && parsed.__flashcards_watermark__ === "notebook_backup_v1") {
                    cards = parsed.cards || [];
                    name = parsed.deckTitle || "Caderno";
                } else if (parsed && parsed.__flashcards_watermark__ === "exam_week_backup_v1") {
                    // Import multiple decks from exam week backup
                    if (parsed.decks && Array.isArray(parsed.decks)) {
                        parsed.decks.forEach(d => {
                            const dCards = (parsed.cards || []).filter(c => c.deckId === d.id || c.sourceDeck === d.name);
                            modalDecks.push({
                                id: d.id || ('deck_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
                                name: d.name,
                                cards: dCards.length > 0 ? dCards : (parsed.cards || [])
                            });
                        });
                        continue;
                    }
                    cards = parsed.cards || [];
                } else if (Array.isArray(parsed)) {
                    cards = parsed;
                }

                if (cards.length > 0) {
                    modalDecks.push({
                        id: 'deck_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        name: name,
                        cards: cards
                    });
                }
            } catch (err) {
                if (examError) {
                    examError.textContent = `Erro ao ler ${file.name}: ${err.message}`;
                    examError.classList.remove('hidden');
                }
            }
        }
        renderExamDecksList();
    }

    function renderExamDecksList() {
        if (!examDeckList) return;
        examDeckList.innerHTML = '';

        if (modalDecks.length === 0) {
            if (examEmptyMsg) examEmptyMsg.classList.remove('hidden');
            if (examDecksCount) examDecksCount.textContent = '0';
            if (examTotalCards) examTotalCards.textContent = '0 cards no total';
            if (startExamBtn) startExamBtn.disabled = true;
            return;
        }

        if (examEmptyMsg) examEmptyMsg.classList.add('hidden');

        let totalCards = 0;

        modalDecks.forEach((deck, index) => {
            totalCards += deck.cards.length;

            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 transition group';
            item.innerHTML = `
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <svg class="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate flex-1 text-left" title="${deck.name}">${deck.name}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-medium flex-shrink-0">${deck.cards.length} cards</span>
                </div>
                <button type="button" class="remove-deck-btn ml-2 p-1 text-gray-400 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition" title="Remover baralho">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            `;

            const removeBtn = item.querySelector('.remove-deck-btn');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                modalDecks.splice(index, 1);
                renderExamDecksList();
            });

            examDeckList.appendChild(item);
        });

        if (examDecksCount) examDecksCount.textContent = modalDecks.length;
        if (examTotalCards) examTotalCards.textContent = `${totalCards} cards no total`;
        if (startExamBtn) startExamBtn.disabled = modalDecks.length === 0;
    }

    if (startExamBtn) {
        startExamBtn.addEventListener('click', () => {
            if (modalDecks.length === 0) return;
            startExamWeek(modalDecks);
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
