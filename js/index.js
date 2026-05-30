// Handles landing page functionality: redirects and file uploads.
import { ROUTES } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
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
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                currentFile = fileInput.files[0];
                startBtn.disabled = false;
                uploadError.textContent = '';
                startBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                startBtn.classList.add('bg-green-600', 'hover:bg-green-700');
                startBtn.innerHTML = `<img src="assets/img/folder.svg" class="w-6 h-6" alt="Pasta"> Abrir ${currentFile.name}`;
            }
        });
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
                        const notebookState = {
                            questionsPool: [...questions],
                            allQuestions: [...questions],
                            score: 0,
                            deckTitle: deckTitle
                        };
                        localStorage.setItem('flashcardsNotebook', JSON.stringify(notebookState));
                        localStorage.setItem('flashcardsActiveMode', 'notebook');
                        window.location.href = ROUTES.GAME;
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
        const gameState = {
            questionsPool: [...questions],
            allQuestions: [...questions],
            score: 0,
            deckTitle: title
        };
        localStorage.setItem('flashcardsSave', JSON.stringify(gameState));
        window.location.href = ROUTES.GAME;
    }
});
