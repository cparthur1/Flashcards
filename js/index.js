// Handles landing page functionality: redirects and file uploads.
import { ROUTES } from './utils.js';

function init() {
    // Redirect to game if active deck session exists
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

    const fileInput = document.getElementById('file-input');
    const startBtn = document.getElementById('start-btn');
    const uploadError = document.getElementById('upload-error');
    let currentFile = null;

    // --- FILE UPLOAD ---
    function handleFileSelection() {
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            currentFile = fileInput.files[0];
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                startBtn.classList.add('bg-green-600', 'hover:bg-green-700');
                startBtn.innerHTML = `<img src="assets/img/folder.svg" class="w-6 h-6" alt="Pasta"> Abrir ${currentFile.name}`;
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
        startBtn.addEventListener('click', () => {
            if (!currentFile) {
                uploadError.textContent = 'Por favor, selecione um arquivo.';
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    let questions = [];
                    let deckTitle = currentFile.name.replace(/\.json$/i, '');
                    let isNotebook = false;

                    if (parsed && parsed.__flashcards_watermark__ === "notebook_backup_v1") {
                        questions = parsed.cards || [];
                        deckTitle = parsed.deckTitle || "Caderno";
                        isNotebook = true;
                    } else if (Array.isArray(parsed)) {
                        questions = parsed;
                    } else {
                        throw new Error("O arquivo JSON deve ser um array de questões ou um backup do Caderno.");
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
            };
            reader.readAsText(currentFile);
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
                uploadError.innerHTML = `<img src="assets/img/error.svg" class="w-5 h-5 inline-block mr-1" alt="Erro"> Este baralho é grande demais para salvar no navegador (provavelmente contém imagens locais antigas). Converta as imagens para links da web.`;
            } else {
                uploadError.innerHTML = `<img src="assets/img/error.svg" class="w-5 h-5 inline-block mr-1" alt="Erro"> Erro ao salvar baralho: ${err.message}`;
            }
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
