/**
 * js/bulk-add.js
 * Módulo de importação em lote de decks para o Caderno de Erros / Revisão Contínua.
 * Exibe dois painéis de deck preview, seleção individual/geral por checkbox,
 * transferência direta com animações de física Material You Expressive, e edição/exclusão.
 */

import { renderMathAndMarkdown, escapeHtml, sanitizeImageUrl, generateSecureId, stripHtml, ROUTES } from './utils.js';
import { triggerHaptic } from './engine/effects.js';
import { isPlayableCard } from './engine/scheduler.js';

// --- DOM ELEMENTS ---
const bulkFileInput = document.getElementById('bulk-file-input');
const uploadDropzone = document.getElementById('upload-dropzone');
const triggerUploadBtn = document.getElementById('trigger-upload-btn');
const uploadZoneWrapper = document.getElementById('upload-zone-wrapper');
const uploadSummaryBar = document.getElementById('upload-summary-bar');
const summaryDecksText = document.getElementById('summary-decks-text');
const summaryCardsText = document.getElementById('summary-cards-text');
const btnLoadMore = document.getElementById('btn-load-more');

const deckPreviewsWorkspace = document.getElementById('deck-previews-workspace');
const leftDeckPanel = document.getElementById('left-deck-panel');
const rightDeckPanel = document.getElementById('right-deck-panel');
const leftDeckBlur = document.getElementById('left-deck-blur');
const rightDeckBlur = document.getElementById('right-deck-blur');
const transferSquircle = document.getElementById('transfer-squircle');
const transferSquircleBadge = document.getElementById('transfer-squircle-badge');

const leftCardsList = document.getElementById('left-cards-list');
const leftCardsCountBadge = document.getElementById('left-cards-count-badge');
const btnSelectAll = document.getElementById('btn-select-all');
const selectActionsSeparator = document.getElementById('select-actions-separator');
const btnDeselectAll = document.getElementById('btn-deselect-all');

const btnAddToNotebook = document.getElementById('btn-add-to-notebook');
const selectedPillCounter = document.getElementById('selected-pill-counter');

const rightCardsList = document.getElementById('right-cards-list');
const rightCardsCountBadge = document.getElementById('right-cards-count-badge');
const rightEmptyHint = document.getElementById('right-empty-hint');

const notebookTotalBadge = document.getElementById('notebook-total-badge');
const notebookTotalCount = document.getElementById('notebook-total-count');

// Notebook Overview Modal Elements
const notebookOverviewModal = document.getElementById('notebook-overview-modal');
const closeNotebookModalBtn = document.getElementById('close-notebook-modal-btn');
const notebookModalSubtitle = document.getElementById('notebook-modal-subtitle');
const notebookModalSearch = document.getElementById('notebook-modal-search');
const clearNotebookSearchBtn = document.getElementById('clear-notebook-search-btn');
const notebookDeckChips = document.getElementById('notebook-deck-chips');
const notebookModalCardsContainer = document.getElementById('notebook-modal-cards-container');
const notebookModalFooterInfo = document.getElementById('notebook-modal-footer-info');
const notebookModalDoneBtn = document.getElementById('notebook-modal-done-btn');

// Edit Modal Elements
const editCardModal = document.getElementById('edit-card-modal');
const editModalFront = document.getElementById('edit-modal-front');
const editModalBack = document.getElementById('edit-modal-back');
const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveEditBtn = document.getElementById('save-edit-btn');

// Notification Pill Elements
const bulkNotificationPill = document.getElementById('bulk-notification-pill');
const bulkPillIcon = document.getElementById('bulk-pill-icon');
const bulkPillText = document.getElementById('bulk-pill-text');

// --- STATE ---
let uploadedCards = []; // Cards do painel esquerdo
let selectedCardIds = new Set(); // IDs selecionados no painel esquerdo
let sessionAddedCards = []; // Cards adicionados nesta sessão no painel direito (evita sobrecarga)
let loadedDecksCount = 0;
let editingCardId = null;
let notificationTimeout = null;

// Notebook Overview Modal State
let activeDeckFilter = 'ALL';
let notebookSearchQuery = '';
const collapsedDecks = new Set();

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    updateNotebookHeaderBadge();
    setupUploadHandlers();
    setupSelectionHandlers();
    setupTransferHandlers();
    setupEditModalHandlers();
    setupNotebookOverviewHandlers();
});

function getNotebookDataFromStorage() {
    try {
        const raw = localStorage.getItem('flashcardsNotebook');
        if (!raw) return { allQuestions: [], questionsPool: [], score: 0, notebookReviewsCount: 0, deckTitle: "Caderno" };
        const parsed = JSON.parse(raw);
        return {
            allQuestions: Array.isArray(parsed.allQuestions) ? parsed.allQuestions : [],
            questionsPool: Array.isArray(parsed.questionsPool) ? parsed.questionsPool : [],
            score: Number(parsed.score) || 0,
            notebookReviewsCount: Number(parsed.notebookReviewsCount) || 0,
            deckTitle: parsed.deckTitle || "Caderno"
        };
    } catch (e) {
        console.error("[BulkAdd] Erro ao ler flashcardsNotebook:", e);
        return { allQuestions: [], questionsPool: [], score: 0, notebookReviewsCount: 0, deckTitle: "Caderno" };
    }
}

function saveNotebookDataToStorage(data) {
    try {
        localStorage.setItem('flashcardsNotebook', JSON.stringify(data));
        updateNotebookHeaderBadge();
    } catch (e) {
        console.error("[BulkAdd] Erro ao salvar flashcardsNotebook:", e);
        showNotification("Erro ao salvar no armazenamento local", "warning");
    }
}

function updateNotebookHeaderBadge() {
    const data = getNotebookDataFromStorage();
    const count = data.allQuestions ? data.allQuestions.filter(isPlayableCard).length : 0;
    if (notebookTotalCount) {
        notebookTotalCount.textContent = `${count} ${count === 1 ? 'no caderno' : 'no caderno'}`;
    }
}

// --- FILE UPLOAD HANDLING ---
function setupUploadHandlers() {
    triggerUploadBtn?.addEventListener('click', () => bulkFileInput.click());
    uploadDropzone?.addEventListener('click', (e) => {
        if (e.target !== triggerUploadBtn && !triggerUploadBtn?.contains(e.target)) {
            bulkFileInput.click();
        }
    });

    btnLoadMore?.addEventListener('click', () => bulkFileInput.click());

    bulkFileInput?.addEventListener('change', handleFilesSelected);

    // Drag and drop
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadDropzone?.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadDropzone.classList.add('border-blue-500', 'bg-blue-50/30');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadDropzone?.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadDropzone.classList.remove('border-blue-500', 'bg-blue-50/30');
        });
    });

    uploadDropzone?.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            processFilesList(Array.from(files));
        }
    });
}

function handleFilesSelected(e) {
    const files = e.target?.files;
    if (files && files.length > 0) {
        processFilesList(Array.from(files));
    }
    // Reset file input so user can re-upload same file if desired
    bulkFileInput.value = '';
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
    });
}

async function processFilesList(files) {
    let newCardsLoaded = [];
    let filesSuccessCount = 0;

    for (const file of files) {
        try {
            const rawText = await readFileAsText(file);
            let deckName = file.name.replace(/\.[^/.]+$/, "");
            let cards = [];

            if (file.name.endsWith('.json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
                const parsed = JSON.parse(rawText);
                if (parsed && parsed.__flashcards_watermark__ === "notebook_backup_v1") {
                    cards = parsed.cards || [];
                    deckName = parsed.deckTitle || deckName;
                } else if (parsed && parsed.__flashcards_watermark__ === "exam_week_backup_v1") {
                    cards = parsed.cards || [];
                    deckName = parsed.deckTitle || deckName;
                } else if (Array.isArray(parsed)) {
                    cards = parsed;
                } else if (parsed && (parsed.allQuestions || parsed.cards)) {
                    cards = parsed.allQuestions || parsed.cards;
                    deckName = parsed.deckTitle || deckName;
                }
            } else {
                // Parse text file line by line (pergunta : resposta)
                const lines = rawText.split('\n');
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) return;
                    if (trimmed.includes(':')) {
                        const parts = trimmed.split(':');
                        const front = parts[0].trim();
                        const back = parts.slice(1).join(':').trim();
                        if (front && back) {
                            cards.push({
                                description: front,
                                answer: back,
                                type: 'open'
                            });
                        }
                    }
                });
            }

            if (Array.isArray(cards) && cards.length > 0) {
                filesSuccessCount++;
                cards.forEach(c => {
                    if (isPlayableCard(c)) {
                        newCardsLoaded.push({
                            ...c,
                            id: c.id || generateSecureId('card'),
                            sourceDeck: c.sourceDeck || deckName
                        });
                    }
                });
            }
        } catch (err) {
            console.warn(`[BulkAdd] Erro ao processar arquivo ${file.name}:`, err);
        }
    }

    if (newCardsLoaded.length === 0) {
        showNotification("Nenhum cartão válido encontrado nos arquivos.", "warning");
        return;
    }

    loadedDecksCount += filesSuccessCount;
    uploadedCards.push(...newCardsLoaded);

    // Inicialmente, ao carregar os decks, nenhum card está selecionado
    selectedCardIds.clear();

    // Show workspace & compact summary bar
    uploadZoneWrapper?.classList.add('hidden');
    uploadSummaryBar?.classList.remove('hidden');
    deckPreviewsWorkspace?.classList.remove('hidden');

    if (summaryDecksText) {
        summaryDecksText.textContent = `${loadedDecksCount} ${loadedDecksCount === 1 ? 'baralho carregado' : 'baralhos carregados'}`;
    }
    if (summaryCardsText) {
        summaryCardsText.textContent = `${uploadedCards.length} cartões disponíveis na lista`;
    }

    triggerHaptic('snap');
    renderLeftCardsList();
    updateSelectAllButtonState();
    updateTransferButtonState();
    showNotification(`${newCardsLoaded.length} cartões carregados com sucesso!`, "collections_bookmark");
}

// --- NATIVE HARDWARE-ACCELERATED CARD RENDERING ---
function updateLeftCardsCountBadge() {
    if (leftCardsCountBadge) {
        const totalCards = uploadedCards.length;
        leftCardsCountBadge.textContent = `${totalCards} ${totalCards === 1 ? 'card' : 'cards'}`;
    }
}

function showLeftEmptyState() {
    if (!leftCardsList) return;
    leftCardsList.innerHTML = `
        <div class="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400 select-none">
            <svg class="w-12 h-12 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p class="font-bold text-sm text-gray-600">Todos os cartões foram transferidos!</p>
            <p class="text-xs mt-1">Carregue mais baralhos se desejar adicionar outros cartões.</p>
        </div>
    `;
    updateSelectAllButtonState();
    updateTransferButtonState();
}

function renderLeftCardsList() {
    if (!leftCardsList) return;

    updateLeftCardsCountBadge();

    if (uploadedCards.length === 0) {
        showLeftEmptyState();
        return;
    }

    const fragment = document.createDocumentFragment();
    uploadedCards.forEach((card, idx) => {
        const cardEl = createLeftCardElement(card, idx);
        fragment.appendChild(cardEl);
    });

    leftCardsList.innerHTML = '';
    leftCardsList.appendChild(fragment);
}

function getTypeBadgeInfo(type) {
    if (type === 'anki') {
        return { label: "Anki", classes: "bg-indigo-100 text-indigo-800" };
    } else if (type === 'multiple_choice') {
        return { label: "Múltipla escolha", classes: "bg-cyan-100 text-cyan-800" };
    } else if (type === 'open_double') {
        return { label: "Escrever duplo", classes: "bg-amber-100 text-amber-800" };
    } else if (type === 'fill') {
        return { label: "Preencher", classes: "bg-teal-100 text-teal-800" };
    } else {
        return { label: "Escrever", classes: "bg-gray-100 text-gray-700" };
    }
}

function createLeftCardElement(card, idx) {
    const cardEl = document.createElement('div');
    const isSelected = selectedCardIds.has(card.id);
    cardEl.className = `flashcard-item bg-white border ${isSelected ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-gray-200'} p-3.5 rounded-2xl shadow-xs relative group flex flex-col justify-between mb-3 h-[136px] transition-all cursor-pointer select-none overflow-hidden`;
    cardEl.dataset.id = card.id;

    // Type Badge & Source Deck
    const topBar = document.createElement('div');
    topBar.className = "flex items-center justify-between gap-2 pl-9 pr-1 flex-shrink-0";

    const sourceTag = document.createElement('span');
    sourceTag.className = "text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full truncate max-w-[180px]";
    sourceTag.textContent = card.sourceDeck || 'Baralho';
    sourceTag.title = card.sourceDeck || '';

    const typeBadge = document.createElement('span');
    const typeInfo = getTypeBadgeInfo(card.type);
    typeBadge.className = `text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${typeInfo.classes}`;
    typeBadge.textContent = typeInfo.label;

    topBar.appendChild(sourceTag);
    topBar.appendChild(typeBadge);
    cardEl.appendChild(topBar);

    // Left Controls Column in top-left corner (Checkbox on top, Instant Move Arrow underneath)
    const leftControlsCol = document.createElement('div');
    leftControlsCol.className = "absolute top-3 left-3 z-10 flex flex-col items-center gap-1.5";
    
    const checkbox = document.createElement('md-checkbox');
    checkbox.className = "bulk-card-checkbox";
    checkbox.touchTarget = "wrapper";
    checkbox.checked = isSelected;
    checkbox.setAttribute('aria-label', 'Selecionar cartão');

    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        toggleCardSelection(card.id, checkbox.checked);
    });

    // Instant Move Button (Flecha para a direita embaixo do checkbox)
    const instantMoveBtn = document.createElement('button');
    instantMoveBtn.type = "button";
    instantMoveBtn.className = "btn-instant-move w-6 h-6 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200/90 hover:border-blue-600 flex items-center justify-center transition-all duration-200 shadow-2xs hover:shadow-xs active:scale-90 group/instant cursor-pointer";
    instantMoveBtn.title = "Mover instantaneamente para o Caderno";
    instantMoveBtn.setAttribute('aria-label', 'Mover instantaneamente para o Caderno');
    instantMoveBtn.innerHTML = `
        <svg class="w-3.5 h-3.5 transition-transform group-hover/instant:translate-x-0.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
        </svg>
    `;

    instantMoveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleInstantMoveCard(card, cardEl);
    });

    leftControlsCol.appendChild(checkbox);
    leftControlsCol.appendChild(instantMoveBtn);
    cardEl.appendChild(leftControlsCol);

    // Front (Question) & Back (Answer) Content com altura previsível e sem quebra de scroll
    const contentBox = document.createElement('div');
    contentBox.className = "flex flex-col gap-1 pl-9 flex-1 min-h-0 justify-center";

    const descHtml = renderMathAndMarkdown(card.description || '(Sem texto)');
    const frontEl = document.createElement('div');
    frontEl.className = "text-xs text-gray-900 font-medium leading-snug line-clamp-2";
    frontEl.innerHTML = `<strong>Frente:</strong> <span class="text-gray-800">${descHtml}</span>`;
    contentBox.appendChild(frontEl);

    const ansHtml = renderMathAndMarkdown(card.answer || '');
    const backEl = document.createElement('div');
    backEl.className = "text-xs text-emerald-700 leading-snug line-clamp-2";
    backEl.innerHTML = `<strong>Verso:</strong> <span class="text-emerald-800">${ansHtml}</span>`;
    contentBox.appendChild(backEl);

    if (card.image) {
        const imgChip = document.createElement('span');
        imgChip.className = "inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium w-fit";
        imgChip.innerHTML = `<img src="../assets/img/image.svg" class="w-3 h-3 flex-shrink-0" alt="Imagem"><span>Imagem</span>`;
        contentBox.appendChild(imgChip);
    }

    cardEl.appendChild(contentBox);

    // Click whole card to toggle checkbox (ignora cliques no checkbox e no botão instantâneo)
    cardEl.addEventListener('click', (e) => {
        if (e.target.closest('md-checkbox') || e.target.closest('.btn-instant-move')) return;
        const nextState = !selectedCardIds.has(card.id);
        checkbox.checked = nextState;
        toggleCardSelection(card.id, nextState);
    });

    return cardEl;
}

// --- SELECTION HANDLING ---
function setupSelectionHandlers() {
    btnSelectAll?.addEventListener('click', handleToggleSelectAll);
    btnDeselectAll?.addEventListener('click', handleClearSelection);
}

function handleToggleSelectAll() {
    const totalCards = uploadedCards.length;
    if (totalCards === 0) return;

    const isAllSelected = (selectedCardIds.size === totalCards);

    if (isAllSelected) {
        // Estava tudo selecionado: limpa a seleção
        selectedCardIds.clear();
    } else {
        // Seleciona todos os cards
        uploadedCards.forEach(c => selectedCardIds.add(c.id));
    }

    updateSelectAllButtonState();
    updateVisibleCheckboxes();
    updateTransferButtonState();
    triggerHaptic('tick');
}

function handleClearSelection() {
    selectedCardIds.clear();
    updateSelectAllButtonState();
    updateVisibleCheckboxes();
    updateTransferButtonState();
    triggerHaptic('tick');
}

function updateSelectAllButtonState() {
    if (!btnSelectAll) return;
    const totalCards = uploadedCards.length;
    const selectedCount = selectedCardIds.size;

    if (totalCards === 0) {
        btnSelectAll.textContent = "Selecionar todos";
        btnSelectAll.disabled = true;
        btnSelectAll.classList.add('opacity-50', 'pointer-events-none');
        selectActionsSeparator?.classList.add('hidden');
        btnDeselectAll?.classList.add('hidden');
        return;
    }

    btnSelectAll.disabled = false;
    btnSelectAll.classList.remove('opacity-50', 'pointer-events-none');

    // Quando todos os cards estiverem selecionados, o botão "Selecionar todos" automaticamente vira "Limpar seleção"
    if (selectedCount === totalCards) {
        btnSelectAll.textContent = "Limpar seleção";
        selectActionsSeparator?.classList.add('hidden');
        btnDeselectAll?.classList.add('hidden');
    } else if (selectedCount > 0) {
        btnSelectAll.textContent = "Selecionar todos";
        selectActionsSeparator?.classList.remove('hidden');
        btnDeselectAll?.classList.remove('hidden');
    } else {
        btnSelectAll.textContent = "Selecionar todos";
        selectActionsSeparator?.classList.add('hidden');
        btnDeselectAll?.classList.add('hidden');
    }
}

function toggleCardSelection(cardId, isChecked) {
    if (isChecked) {
        selectedCardIds.add(cardId);
    } else {
        selectedCardIds.delete(cardId);
    }

    const cardEl = leftCardsList?.querySelector(`[data-id="${cardId}"]`);
    if (cardEl) {
        if (isChecked) {
            cardEl.classList.add('border-blue-400', 'ring-2', 'ring-blue-500/20');
            cardEl.classList.remove('border-gray-200');
        } else {
            cardEl.classList.remove('border-blue-400', 'ring-2', 'ring-blue-500/20');
            cardEl.classList.add('border-gray-200');
        }
    }

    updateSelectAllButtonState();
    updateTransferButtonState();
    triggerHaptic('tick');
}

function updateVisibleCheckboxes() {
    if (!leftCardsList) return;
    const cardElements = leftCardsList.querySelectorAll('.flashcard-item');
    cardElements.forEach(el => {
        const id = el.dataset?.id;
        const isChecked = selectedCardIds.has(id);
        const cb = el.querySelector('md-checkbox');
        if (cb) cb.checked = isChecked;

        if (isChecked) {
            el.classList.add('border-blue-400', 'ring-2', 'ring-blue-500/20');
            el.classList.remove('border-gray-200');
        } else {
            el.classList.remove('border-blue-400', 'ring-2', 'ring-blue-500/20');
            el.classList.add('border-gray-200');
        }
    });
}

function updateTransferButtonState() {
    const count = selectedCardIds.size;
    if (btnAddToNotebook) {
        btnAddToNotebook.disabled = (count === 0);
    }
    if (selectedPillCounter) {
        if (count > 0) {
            selectedPillCounter.textContent = `${count} ${count === 1 ? 'selecionado' : 'selecionados'}`;
            selectedPillCounter.classList.remove('hidden');
        } else {
            selectedPillCounter.classList.add('hidden');
        }
    }
}

// --- INSTANT MOVE SINGLE CARD (COM FÍSICA EXPRESSIVE MATERIAL YOU) ---
function handleInstantMoveCard(card, cardEl) {
    if (!card || !cardEl) return;

    // 1. Remove da seleção se estava marcado
    if (selectedCardIds.has(card.id)) {
        selectedCardIds.delete(card.id);
        updateSelectAllButtonState();
        updateTransferButtonState();
    }

    // 2. Prepara e salva o cartão no flashcardsNotebook
    const nbData = getNotebookDataFromStorage();
    const copy = { ...card };
    delete copy.dueStep;
    if (!copy.easeFactor) copy.easeFactor = 2.5;
    if (!copy.intervalDays) copy.intervalDays = 1;
    if (!copy.repetitions) copy.repetitions = 0;
    if (!copy.lapses) copy.lapses = 0;

    nbData.allQuestions.push(copy);
    nbData.questionsPool.push(copy);
    saveNotebookDataToStorage(nbData);

    // 3. Efeito de Física Material You Expressive (Instant Launch)
    // Recoil com antecipação, aceleração elástica para a direita e colapso de altura
    cardEl.classList.add('card-instant-moving-out');
    triggerHaptic('pop');

    // Cria o cartão na lista da direita com entrada bouncy (spring-in)
    setTimeout(() => {
        sessionAddedCards.push(copy);

        if (rightEmptyHint) rightEmptyHint.classList.add('hidden');

        const rightEl = createRightCardElement(copy);
        rightEl.classList.add('card-spring-in');
        // Insere no início da lista da direita para feedback visual imediato
        rightCardsList.insertBefore(rightEl, rightCardsList.firstChild);

        if (rightCardsCountBadge) {
            rightCardsCountBadge.textContent = `${sessionAddedCards.length} ${sessionAddedCards.length === 1 ? 'adicionado' : 'adicionados'}`;
        }
    }, 180);

    // Remove da lista da esquerda
    setTimeout(() => {
        uploadedCards = uploadedCards.filter(c => c.id !== card.id);

        if (summaryCardsText) {
            summaryCardsText.textContent = `${uploadedCards.length} cartões disponíveis na lista`;
        }

        cardEl.remove();
        if (uploadedCards.length === 0) {
            showLeftEmptyState();
        }

        updateLeftCardsCountBadge();
        updateSelectAllButtonState();
        updateTransferButtonState();
        showNotification("Cartão movido para o Caderno!", "check_circle");
    }, 300);
}

// --- TRANSFER FROM LEFT TO RIGHT (CINEMATIC SQUIRCLE LIFT & FLY WITH BLUR) ---
let isTransferring = false;

function setupTransferHandlers() {
    btnAddToNotebook?.addEventListener('click', handleTransferSelectedCards);
}

function handleTransferSelectedCards() {
    if (isTransferring || selectedCardIds.size === 0) return;

    const cardsToTransfer = uploadedCards.filter(c => selectedCardIds.has(c.id));
    if (cardsToTransfer.length === 0) return;

    isTransferring = true;
    if (btnAddToNotebook) {
        btnAddToNotebook.disabled = true;
    }

    // 1. Salva os cartões no save do Caderno no localStorage
    // (Mesmo save dos que já estavam no caderno antes)
    const nbData = getNotebookDataFromStorage();

    const preparedCards = cardsToTransfer.map(c => {
        const copy = { ...c };
        delete copy.dueStep;
        if (!copy.easeFactor) copy.easeFactor = 2.5;
        if (!copy.intervalDays) copy.intervalDays = 1;
        if (!copy.repetitions) copy.repetitions = 0;
        if (!copy.lapses) copy.lapses = 0;
        return copy;
    });

    nbData.allQuestions.push(...preparedCards);
    nbData.questionsPool.push(...preparedCards);
    saveNotebookDataToStorage(nbData);

    // 2. Animação Cinematográfica Otimizada de Transferência em Lote:
    // Passo A: Fade in blur somente em cima dos deck-previews (listas de cartões)
    if (leftDeckBlur) {
        leftDeckBlur.classList.remove('opacity-0', 'pointer-events-none');
        leftDeckBlur.classList.add('opacity-100', 'pointer-events-auto');
    }
    if (rightDeckBlur) {
        rightDeckBlur.classList.remove('opacity-0', 'pointer-events-none');
        rightDeckBlur.classList.add('opacity-100', 'pointer-events-auto');
    }

    // Calcula coordenadas precisas do centro dos dois deck-previews
    const leftRect = leftCardsList.getBoundingClientRect();
    const rightRect = rightCardsList.getBoundingClientRect();

    const squircleSize = (window.innerWidth < 640) ? 64 : 80;
    const startX = leftRect.left + (leftRect.width / 2) - (squircleSize / 2);
    const startY = leftRect.top + (leftRect.height / 2) - (squircleSize / 2);
    const endX = rightRect.left + (rightRect.width / 2) - (squircleSize / 2);
    const endY = rightRect.top + (rightRect.height / 2) - (squircleSize / 2);

    if (transferSquircleBadge) {
        transferSquircleBadge.textContent = cardsToTransfer.length;
    }

    // Passo B: Surge no deck da esquerda o ícone da Semana de Provas dentro do squircle
    // Esse aumenta em tamanho e renderiza um dropshadow azul pronunciado (como se tivesse levantado)
    // Move-se para cima da lista da direita e desce
    if (transferSquircle) {
        transferSquircle.classList.remove('hidden');
        transferSquircle.classList.add('flex');
    }

    triggerHaptic('pop');

    // Executa a física de levantamento, voo e aterrissagem acelerada por GPU (sem tons roxos)
    transferSquircle?.animate([
        // 0%: Surge repousando no centro do deck esquerdo
        {
            transform: `translate3d(${startX}px, ${startY}px, 0) scale(0.65)`,
            filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.15))',
            opacity: 0,
            offset: 0
        },
        // 25%: Levanta de cima da lista da esquerda (aumenta de tamanho e ganha drop-shadow azul claro pronunciado)
        {
            transform: `translate3d(${startX}px, ${startY - 25}px, 0) scale(1.35)`,
            filter: 'drop-shadow(0 28px 45px rgba(37, 99, 235, 0.45)) drop-shadow(0 14px 22px rgba(0, 0, 0, 0.25))',
            opacity: 1,
            offset: 0.25
        },
        // 68%: Move-se para cima da lista da direita (ainda elevado)
        {
            transform: `translate3d(${endX}px, ${endY - 25}px, 0) scale(1.35)`,
            filter: 'drop-shadow(0 28px 45px rgba(37, 99, 235, 0.45)) drop-shadow(0 14px 22px rgba(0, 0, 0, 0.25))',
            opacity: 1,
            offset: 0.68
        },
        // 88%: Desce em cima da lista da direita
        {
            transform: `translate3d(${endX}px, ${endY}px, 0) scale(0.85)`,
            filter: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.2))',
            opacity: 1,
            offset: 0.88
        },
        // 100%: Fade out suave ao pousar
        {
            transform: `translate3d(${endX}px, ${endY}px, 0) scale(0.75)`,
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
            opacity: 0,
            offset: 1.0
        }
    ], {
        duration: 800,
        easing: 'cubic-bezier(0.2, 0.0, 0.2, 1)',
        fill: 'forwards'
    });

    // Passo C: Por baixo do blur os cards simplesmente somem sem animação
    // Executado no meio do voo (~400ms), enquanto ambos os decks estão completamente sob o blur
    setTimeout(() => {
        // Remove os elementos selecionados do DOM no deck da esquerda (cards somem sem animação)
        selectedCardIds.forEach(id => {
            const el = leftCardsList?.querySelector(`[data-id="${id}"]`);
            if (el) el.remove();
        });

        uploadedCards = uploadedCards.filter(c => !selectedCardIds.has(c.id));
        selectedCardIds.clear();

        sessionAddedCards.push(...preparedCards);

        if (rightEmptyHint) rightEmptyHint.classList.add('hidden');

        // Renderiza no deck da direita sem animação por card (somem/aparecem instantâneos por baixo do blur)
        const fragment = document.createDocumentFragment();
        preparedCards.forEach(c => {
            const rightEl = createRightCardElement(c);
            fragment.appendChild(rightEl);
        });
        rightCardsList.appendChild(fragment);

        if (rightCardsCountBadge) {
            rightCardsCountBadge.textContent = `${sessionAddedCards.length} ${sessionAddedCards.length === 1 ? 'adicionado' : 'adicionados'}`;
        }

        if (uploadedCards.length === 0) {
            showLeftEmptyState();
        }

        updateLeftCardsCountBadge();
        updateSelectAllButtonState();
        updateTransferButtonState();

        if (summaryCardsText) {
            summaryCardsText.textContent = `${uploadedCards.length} cartões disponíveis na lista`;
        }
    }, 400);

    // Passo D: Desce sobre a direita e blur fade out
    setTimeout(() => {
        triggerHaptic('snap');
        // Blur fade out
        if (leftDeckBlur) {
            leftDeckBlur.classList.remove('opacity-100', 'pointer-events-auto');
            leftDeckBlur.classList.add('opacity-0', 'pointer-events-none');
        }
        if (rightDeckBlur) {
            rightDeckBlur.classList.remove('opacity-100', 'pointer-events-auto');
            rightDeckBlur.classList.add('opacity-0', 'pointer-events-none');
        }
    }, 700);

    // Finaliza transição
    setTimeout(() => {
        if (transferSquircle) {
            transferSquircle.classList.add('hidden');
            transferSquircle.classList.remove('flex');
        }
        isTransferring = false;
        showNotification(`${preparedCards.length} ${preparedCards.length === 1 ? 'cartão adicionado' : 'cartões adicionados'} ao Caderno!`, "check_circle");
    }, 850);
}

// --- RENDER RIGHT DECK PREVIEW (CARDS ADDED TO NOTEBOOK) ---
function createRightCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = "flashcard-item bg-white border border-emerald-200 p-4 rounded-2xl shadow-xs relative group flex flex-col gap-2 transition-all select-none";
    cardEl.dataset.id = card.id;

    // Top Bar with Source Tag & Type Badge
    const topBar = document.createElement('div');
    topBar.className = "flex items-center justify-between gap-2 pr-1";

    const sourceTag = document.createElement('span');
    sourceTag.className = "text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full truncate max-w-[180px]";
    sourceTag.textContent = card.sourceDeck || 'Caderno';
    sourceTag.title = card.sourceDeck || '';

    const typeBadge = document.createElement('span');
    const typeInfo = getTypeBadgeInfo(card.type);
    typeBadge.className = `text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${typeInfo.classes}`;
    typeBadge.textContent = typeInfo.label;

    topBar.appendChild(sourceTag);
    topBar.appendChild(typeBadge);
    cardEl.appendChild(topBar);

    // Front (Question) & Back (Answer) Content
    const contentBox = document.createElement('div');
    contentBox.className = "flex flex-col gap-1.5 mt-1";

    const descHtml = renderMathAndMarkdown(card.description || '(Sem texto)');
    const frontEl = document.createElement('div');
    frontEl.className = "text-sm text-gray-900 font-medium leading-relaxed card-desc-view";
    frontEl.innerHTML = `<strong>Frente:</strong> <div class="mt-0.5 text-gray-800">${descHtml}</div>`;
    contentBox.appendChild(frontEl);

    const ansHtml = renderMathAndMarkdown(card.answer || '');
    const backEl = document.createElement('div');
    backEl.className = "text-sm text-emerald-700 mt-1 card-ans-view";
    backEl.innerHTML = `<strong>Verso:</strong> <div class="mt-0.5 text-emerald-800">${ansHtml}</div>`;
    contentBox.appendChild(backEl);

    // Images if present
    const safeImg = sanitizeImageUrl(card.image);
    if (safeImg) {
        const imgCont = document.createElement('div');
        imgCont.className = "mt-2 max-h-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center p-1";
        imgCont.innerHTML = `<img src="${safeImg}" class="max-h-20 w-auto object-contain rounded" alt="Imagem">`;
        contentBox.appendChild(imgCont);
    }

    cardEl.appendChild(contentBox);

    // Right Action Buttons: Lixeira e Lápis
    const actionsBar = document.createElement('div');
    actionsBar.className = "flex items-center justify-end gap-2 pt-2 border-t border-gray-100 mt-1";

    // Edit (Lápis) Button
    const editBtn = document.createElement('button');
    editBtn.type = "button";
    editBtn.className = "p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-600 transition flex items-center justify-center shadow-2xs";
    editBtn.title = "Editar este cartão";
    editBtn.innerHTML = `<img src="../assets/img/edit.svg" class="w-4 h-4 pointer-events-none" alt="Editar">`;
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(card.id);
    });

    // Delete (Lixeira) Button
    const delBtn = document.createElement('button');
    delBtn.type = "button";
    delBtn.className = "p-1.5 rounded-xl bg-red-50 hover:bg-red-100 active:scale-95 text-red-600 transition flex items-center justify-center shadow-2xs";
    delBtn.title = "Remover do Caderno";
    delBtn.innerHTML = `<img src="../assets/img/delete.svg" class="w-4 h-4 pointer-events-none" alt="Excluir">`;
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteCardFromNotebook(card.id, cardEl);
    });

    actionsBar.appendChild(editBtn);
    actionsBar.appendChild(delBtn);
    cardEl.appendChild(actionsBar);

    return cardEl;
}

// --- DELETE ACTION WITH EXPRESSIVE PHYSICS ---
function handleDeleteCardFromNotebook(cardId, cardEl) {
    if (!cardEl) return;

    // 1. Remove do save do Caderno no localStorage
    const nbData = getNotebookDataFromStorage();
    nbData.allQuestions = nbData.allQuestions.filter(c => c.id !== cardId);
    nbData.questionsPool = nbData.questionsPool.filter(c => c.id !== cardId);
    saveNotebookDataToStorage(nbData);

    // 2. Remove do estado in-memory da sessão
    sessionAddedCards = sessionAddedCards.filter(c => c.id !== cardId);

    // 3. Efeito de física Material You Expressive ao apagar (elastic pop + shrink collapse)
    cardEl.classList.add('card-elastic-delete');
    triggerHaptic('delete');

    setTimeout(() => {
        cardEl.remove();

        if (rightCardsCountBadge) {
            rightCardsCountBadge.textContent = `${sessionAddedCards.length} ${sessionAddedCards.length === 1 ? 'adicionado' : 'adicionados'}`;
        }

        // Se a lista da direita ficou vazia, reexibe a dica no fundo
        if (sessionAddedCards.length === 0 && rightEmptyHint) {
            rightEmptyHint.classList.remove('hidden');
        }

        if (notebookOverviewModal && !notebookOverviewModal.classList.contains('hidden')) {
            renderNotebookOverviewModalContent();
        }

        showNotification("Cartão removido do Caderno", "delete");
    }, 320);
}

// --- EDIT MODAL HANDLING ---
function setupEditModalHandlers() {
    closeEditModalBtn?.addEventListener('click', closeEditModal);
    cancelEditBtn?.addEventListener('click', closeEditModal);
    editCardModal?.addEventListener('click', (e) => {
        if (e.target === editCardModal) closeEditModal();
    });

    saveEditBtn?.addEventListener('click', handleSaveCardEdit);
}

function openEditModal(cardId) {
    const nbData = getNotebookDataFromStorage();
    const card = sessionAddedCards.find(c => c.id === cardId) || (nbData.allQuestions || []).find(c => c.id === cardId);
    if (!card) return;

    editingCardId = cardId;
    if (editModalFront) editModalFront.value = card.description || '';
    if (editModalBack) editModalBack.value = card.answer || '';

    editCardModal?.classList.remove('hidden');
    setTimeout(() => editModalFront?.focus(), 60);
}

function closeEditModal() {
    editCardModal?.classList.add('hidden');
    editingCardId = null;
}

function handleSaveCardEdit() {
    if (!editingCardId) return;

    const newFront = editModalFront?.value.trim() || '';
    const newBack = editModalBack?.value.trim() || '';

    if (!newFront) {
        alert("A pergunta/frente não pode ficar vazia.");
        return;
    }

    // 1. Atualiza no estado in-memory da sessão
    const card = sessionAddedCards.find(c => c.id === editingCardId);
    if (card) {
        card.description = newFront;
        card.answer = newBack;
    }

    // 2. Atualiza no save do Caderno no localStorage
    const nbData = getNotebookDataFromStorage();
    const updateInList = (list) => {
        if (!Array.isArray(list)) return;
        const target = list.find(c => c.id === editingCardId);
        if (target) {
            target.description = newFront;
            target.answer = newBack;
        }
    };
    updateInList(nbData.allQuestions);
    updateInList(nbData.questionsPool);
    saveNotebookDataToStorage(nbData);

    // 3. Atualiza na UI do cartão na direita se existir
    const cardEl = rightCardsList?.querySelector(`[data-id="${editingCardId}"]`);
    if (cardEl) {
        const descView = cardEl.querySelector('.card-desc-view');
        const ansView = cardEl.querySelector('.card-ans-view');
        if (descView) {
            descView.innerHTML = `<strong>Frente:</strong> <div class="mt-0.5 text-gray-800">${renderMathAndMarkdown(newFront)}</div>`;
        }
        if (ansView) {
            ansView.innerHTML = `<strong>Verso:</strong> <div class="mt-0.5 text-emerald-800">${renderMathAndMarkdown(newBack)}</div>`;
        }
    }

    // 4. Se o modal de visualização do Caderno estiver aberto, re-renderiza o conteúdo dele
    if (notebookOverviewModal && !notebookOverviewModal.classList.contains('hidden')) {
        renderNotebookOverviewModalContent();
    }

    closeEditModal();
    triggerHaptic('snap');
    showNotification("Cartão atualizado com sucesso!", "edit");
}

// --- NOTEBOOK OVERVIEW MODAL (DECKS & CARDS SAVED IN NOTEBOOK) ---
function setupNotebookOverviewHandlers() {
    notebookTotalBadge?.addEventListener('click', () => {
        openNotebookOverviewModal();
    });

    closeNotebookModalBtn?.addEventListener('click', closeNotebookOverviewModal);
    notebookModalDoneBtn?.addEventListener('click', closeNotebookOverviewModal);

    notebookOverviewModal?.addEventListener('click', (e) => {
        if (e.target === notebookOverviewModal) {
            closeNotebookOverviewModal();
        }
    });

    notebookModalSearch?.addEventListener('input', (e) => {
        notebookSearchQuery = (e.target.value || '').trim().toLowerCase();
        if (notebookSearchQuery) {
            clearNotebookSearchBtn?.classList.remove('hidden');
        } else {
            clearNotebookSearchBtn?.classList.add('hidden');
        }
        renderNotebookOverviewModalContent();
    });

    clearNotebookSearchBtn?.addEventListener('click', () => {
        if (notebookModalSearch) {
            notebookModalSearch.value = '';
        }
        notebookSearchQuery = '';
        clearNotebookSearchBtn?.classList.add('hidden');
        renderNotebookOverviewModalContent();
        notebookModalSearch?.focus();
    });

    // Close open modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (editCardModal && !editCardModal.classList.contains('hidden')) {
                closeEditModal();
            } else if (notebookOverviewModal && !notebookOverviewModal.classList.contains('hidden')) {
                closeNotebookOverviewModal();
            }
        }
    });
}

function openNotebookOverviewModal() {
    activeDeckFilter = 'ALL';
    notebookSearchQuery = '';
    if (notebookModalSearch) notebookModalSearch.value = '';
    clearNotebookSearchBtn?.classList.add('hidden');

    renderNotebookOverviewModalContent();
    notebookOverviewModal?.classList.remove('hidden');
    triggerHaptic('tick');
}

function closeNotebookOverviewModal() {
    notebookOverviewModal?.classList.add('hidden');
}

function renderNotebookOverviewModalContent() {
    if (!notebookModalCardsContainer) return;

    const nbData = getNotebookDataFromStorage();
    const allCards = (nbData.allQuestions || []).filter(isPlayableCard);
    const totalCardsCount = allCards.length;

    // Group cards by sourceDeck
    const deckMap = new Map();
    allCards.forEach(card => {
        const deckName = (card.sourceDeck || '').trim() || 'Caderno';
        if (!deckMap.has(deckName)) {
            deckMap.set(deckName, []);
        }
        deckMap.get(deckName).push(card);
    });

    const totalDecksCount = deckMap.size;

    // Update Subtitle
    if (notebookModalSubtitle) {
        notebookModalSubtitle.textContent = `${totalCardsCount} ${totalCardsCount === 1 ? 'cartão salvo' : 'cartões salvos'} de ${totalDecksCount} ${totalDecksCount === 1 ? 'baralho' : 'baralhos'}`;
    }

    // Empty state if Caderno has no cards
    if (totalCardsCount === 0) {
        if (notebookDeckChips) notebookDeckChips.innerHTML = '';
        notebookModalCardsContainer.innerHTML = `
            <div class="py-16 flex flex-col items-center justify-center text-center p-6 text-gray-400 select-none">
                <div class="w-16 h-16 rounded-3xl bg-blue-50 text-blue-500 flex items-center justify-center mb-3 shadow-2xs">
                    <span class="material-symbols-rounded text-3xl opacity-80">bookmark_border</span>
                </div>
                <h4 class="text-base font-bold text-gray-800">Seu Caderno está vazio</h4>
                <p class="text-xs text-gray-500 max-w-sm mt-1.5 leading-relaxed">
                    Nenhum cartão salvo ainda. Faça upload de baralhos e clique em "Adicionar ao Caderno" para começar suas revisões espaçadas contínuas.
                </p>
            </div>
        `;
        if (notebookModalFooterInfo) {
            notebookModalFooterInfo.textContent = "0 cartões salvos";
        }
        return;
    }

    // Build Deck Filter Chips
    if (notebookDeckChips) {
        notebookDeckChips.innerHTML = '';
        const chipsFragment = document.createDocumentFragment();

        // "Todos" chip
        const allChip = document.createElement('button');
        allChip.type = 'button';
        const isAllActive = (activeDeckFilter === 'ALL');
        allChip.className = `px-3 py-1.5 rounded-full font-semibold transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
            isAllActive 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }`;
        allChip.innerHTML = `<span>Todos</span> <span class="px-1.5 py-0.2 rounded-full text-[10px] ${isAllActive ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'}">${totalCardsCount}</span>`;
        allChip.addEventListener('click', () => {
            activeDeckFilter = 'ALL';
            triggerHaptic('tick');
            renderNotebookOverviewModalContent();
        });
        chipsFragment.appendChild(allChip);

        // Deck Chips
        deckMap.forEach((cards, deckName) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            const isActive = (activeDeckFilter === deckName);
            chip.className = `px-3 py-1.5 rounded-full font-semibold transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer max-w-[220px] ${
                isActive 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`;
            chip.title = deckName;
            chip.innerHTML = `
                <span class="truncate">${escapeHtml(deckName)}</span>
                <span class="px-1.5 py-0.2 rounded-full text-[10px] flex-shrink-0 ${isActive ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'}">${cards.length}</span>
            `;
            chip.addEventListener('click', () => {
                activeDeckFilter = deckName;
                triggerHaptic('tick');
                renderNotebookOverviewModalContent();
            });
            chipsFragment.appendChild(chip);
        });

        notebookDeckChips.appendChild(chipsFragment);
    }

    // Filter cards by active chip and search query
    let visibleCardsCount = 0;
    const matchingDecks = [];

    deckMap.forEach((cards, deckName) => {
        if (activeDeckFilter !== 'ALL' && activeDeckFilter !== deckName) {
            return;
        }

        let matchingCards = cards;
        if (notebookSearchQuery) {
            const query = notebookSearchQuery.toLowerCase();
            matchingCards = cards.filter(c => {
                const front = (c.description || '').toLowerCase();
                const back = (c.answer || '').toLowerCase();
                const deck = deckName.toLowerCase();
                return front.includes(query) || back.includes(query) || deck.includes(query);
            });
        }

        if (matchingCards.length > 0) {
            matchingDecks.push({
                name: deckName,
                cards: matchingCards,
                totalDeckCards: cards.length
            });
            visibleCardsCount += matchingCards.length;
        }
    });

    if (matchingDecks.length === 0) {
        notebookModalCardsContainer.innerHTML = `
            <div class="py-12 flex flex-col items-center justify-center text-center p-6 text-gray-400 select-none">
                <span class="material-symbols-rounded text-3xl mb-2 opacity-50">search_off</span>
                <p class="font-bold text-sm text-gray-700">Nenhum cartão encontrado</p>
                <p class="text-xs mt-1 text-gray-500">Tente buscar por outro termo ou selecione outro baralho no filtro acima.</p>
            </div>
        `;
        if (notebookModalFooterInfo) {
            notebookModalFooterInfo.textContent = `Mostrando 0 de ${totalCardsCount} cartões`;
        }
        return;
    }

    // Render deck sections and cards
    const containerFragment = document.createDocumentFragment();

    matchingDecks.forEach(deckObj => {
        const deckSection = document.createElement('div');
        deckSection.className = "bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden transition-all";

        const isCollapsed = collapsedDecks.has(deckObj.name);

        // Header
        const header = document.createElement('div');
        header.className = "px-4 py-3 bg-gradient-to-r from-blue-50/70 via-blue-50/30 to-white border-b border-gray-100 flex items-center justify-between gap-3 cursor-pointer select-none group/deck";
        header.innerHTML = `
            <div class="flex items-center gap-2 min-w-0">
                <span class="material-symbols-rounded text-blue-600 text-lg transition-transform duration-200 deck-chevron ${isCollapsed ? '-rotate-90' : ''}">expand_more</span>
                <span class="material-symbols-rounded text-blue-500 text-lg flex-shrink-0">style</span>
                <h4 class="font-bold text-sm text-gray-900 truncate" title="${escapeHtml(deckObj.name)}">${escapeHtml(deckObj.name)}</h4>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex-shrink-0">
                    ${deckObj.cards.length}${deckObj.cards.length !== deckObj.totalDeckCards ? ` de ${deckObj.totalDeckCards}` : ''} ${deckObj.totalDeckCards === 1 ? 'card' : 'cards'}
                </span>
            </div>
            <div class="flex items-center gap-1">
                <button type="button" class="btn-remove-deck text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer" title="Remover todos os cartões deste baralho do Caderno">
                    <span class="material-symbols-rounded text-sm">delete</span>
                    <span class="hidden sm:inline">Remover baralho</span>
                </button>
            </div>
        `;

        const deleteDeckBtn = header.querySelector('.btn-remove-deck');
        deleteDeckBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            handleModalDeleteDeck(deckObj.name);
        });

        // Cards list wrapper
        const cardsList = document.createElement('div');
        cardsList.className = `p-3 sm:p-4 space-y-3 ${isCollapsed ? 'hidden' : ''}`;

        header.addEventListener('click', (e) => {
            if (e.target.closest('.btn-remove-deck')) return;
            const chevron = header.querySelector('.deck-chevron');
            if (collapsedDecks.has(deckObj.name)) {
                collapsedDecks.delete(deckObj.name);
                cardsList.classList.remove('hidden');
                chevron?.classList.remove('-rotate-90');
            } else {
                collapsedDecks.add(deckObj.name);
                cardsList.classList.add('hidden');
                chevron?.classList.add('-rotate-90');
            }
        });

        deckObj.cards.forEach((card, idx) => {
            const cardEl = createModalCardElement(card, idx);
            cardsList.appendChild(cardEl);
        });

        deckSection.appendChild(header);
        deckSection.appendChild(cardsList);
        containerFragment.appendChild(deckSection);
    });

    notebookModalCardsContainer.innerHTML = '';
    notebookModalCardsContainer.appendChild(containerFragment);

    if (notebookModalFooterInfo) {
        notebookModalFooterInfo.textContent = `Mostrando ${visibleCardsCount} de ${totalCardsCount} ${totalCardsCount === 1 ? 'cartão' : 'cartões'}`;
    }
}

function createModalCardElement(card, idx) {
    const cardEl = document.createElement('div');
    cardEl.className = "bg-white border border-gray-200/90 hover:border-gray-300 rounded-xl p-3 sm:p-3.5 shadow-2xs transition-all flex flex-col gap-2 relative group";
    cardEl.dataset.id = card.id;

    const typeInfo = getTypeBadgeInfo(card.type);

    const srsBadgeHtml = (card.repetitions && card.repetitions > 0)
        ? `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
             <span class="material-symbols-rounded text-[11px]">history</span>
             <span>Revisado ${card.repetitions}x · Intervalo ${card.intervalDays || 1}d</span>
           </span>`
        : `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
             <span class="material-symbols-rounded text-[11px]">fiber_new</span>
             <span>Novo</span>
           </span>`;

    // Top Row
    const topRow = document.createElement('div');
    topRow.className = "flex items-center justify-between gap-2";

    const leftMeta = document.createElement('div');
    leftMeta.className = "flex items-center gap-1.5 flex-wrap";
    leftMeta.innerHTML = `
        <span class="text-[10px] font-bold text-gray-400">#${idx + 1}</span>
        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${typeInfo.classes}">
            ${typeInfo.label}
        </span>
        ${srsBadgeHtml}
    `;

    const rightActions = document.createElement('div');
    rightActions.className = "flex items-center gap-1";

    const editBtn = document.createElement('button');
    editBtn.type = "button";
    editBtn.className = "p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer";
    editBtn.title = "Editar este cartão";
    editBtn.innerHTML = `<span class="material-symbols-rounded text-base">edit</span>`;
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(card.id);
    });

    const delBtn = document.createElement('button');
    delBtn.type = "button";
    delBtn.className = "p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer";
    delBtn.title = "Remover do Caderno";
    delBtn.innerHTML = `<span class="material-symbols-rounded text-base">delete</span>`;
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleModalDeleteCard(card.id, cardEl);
    });

    rightActions.appendChild(editBtn);
    rightActions.appendChild(delBtn);

    topRow.appendChild(leftMeta);
    topRow.appendChild(rightActions);
    cardEl.appendChild(topRow);

    // Front (Question)
    const frontEl = document.createElement('div');
    frontEl.className = "text-xs sm:text-sm text-gray-900 leading-snug card-desc-view";
    frontEl.innerHTML = `<strong class="text-gray-900 font-semibold">Frente:</strong> <div class="text-gray-800 mt-0.5">${renderMathAndMarkdown(card.description || '(Sem texto)')}</div>`;
    cardEl.appendChild(frontEl);

    // Back (Answer)
    const backEl = document.createElement('div');
    backEl.className = "text-xs sm:text-sm text-emerald-800 leading-snug border-t border-gray-100 pt-1.5 mt-0.5 card-ans-view";
    backEl.innerHTML = `<strong class="text-emerald-900 font-semibold">Verso:</strong> <div class="text-emerald-800 mt-0.5">${renderMathAndMarkdown(card.answer || '')}</div>`;
    cardEl.appendChild(backEl);

    // Image if present
    const safeImg = sanitizeImageUrl(card.image);
    if (safeImg) {
        const imgCont = document.createElement('div');
        imgCont.className = "mt-1 max-h-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center p-1";
        imgCont.innerHTML = `<img src="${safeImg}" class="max-h-20 w-auto object-contain rounded" alt="Imagem">`;
        cardEl.appendChild(imgCont);
    }

    return cardEl;
}

function handleModalDeleteCard(cardId, cardEl) {
    if (!cardId) return;

    // 1. Remove do save do Caderno no localStorage
    const nbData = getNotebookDataFromStorage();
    nbData.allQuestions = nbData.allQuestions.filter(c => c.id !== cardId);
    nbData.questionsPool = nbData.questionsPool.filter(c => c.id !== cardId);
    saveNotebookDataToStorage(nbData);

    // 2. Remove do estado in-memory da sessão
    sessionAddedCards = sessionAddedCards.filter(c => c.id !== cardId);

    // 3. Remove da lista da direita (rightCardsList) se estiver renderizado lá
    const rightEl = rightCardsList?.querySelector(`[data-id="${cardId}"]`);
    if (rightEl) {
        rightEl.remove();
        if (rightCardsCountBadge) {
            rightCardsCountBadge.textContent = `${sessionAddedCards.length} ${sessionAddedCards.length === 1 ? 'adicionado' : 'adicionados'}`;
        }
        if (sessionAddedCards.length === 0 && rightEmptyHint) {
            rightEmptyHint.classList.remove('hidden');
        }
    }

    // 4. Animação de saída no modal
    triggerHaptic('delete');
    if (cardEl) {
        cardEl.style.transition = 'all 0.2s ease-out';
        cardEl.style.opacity = '0';
        cardEl.style.transform = 'scale(0.95)';
        setTimeout(() => {
            renderNotebookOverviewModalContent();
        }, 180);
    } else {
        renderNotebookOverviewModalContent();
    }

    showNotification("Cartão removido do Caderno", "delete");
}

function handleModalDeleteDeck(deckName) {
    if (!deckName) return;

    if (!confirm(`Remover todos os cartões do baralho "${deckName}" do seu Caderno?`)) {
        return;
    }

    const nbData = getNotebookDataFromStorage();
    const countBefore = nbData.allQuestions.length;
    nbData.allQuestions = nbData.allQuestions.filter(c => ((c.sourceDeck || '').trim() || 'Caderno') !== deckName);
    nbData.questionsPool = nbData.questionsPool.filter(c => ((c.sourceDeck || '').trim() || 'Caderno') !== deckName);
    const removedCount = countBefore - nbData.allQuestions.length;
    saveNotebookDataToStorage(nbData);

    sessionAddedCards = sessionAddedCards.filter(c => ((c.sourceDeck || '').trim() || 'Caderno') !== deckName);

    // Sync rightCardsList
    if (rightCardsList) {
        const items = rightCardsList.querySelectorAll('.flashcard-item');
        items.forEach(item => {
            const id = item.dataset?.id;
            if (!sessionAddedCards.some(c => c.id === id)) {
                item.remove();
            }
        });
        if (rightCardsCountBadge) {
            rightCardsCountBadge.textContent = `${sessionAddedCards.length} ${sessionAddedCards.length === 1 ? 'adicionado' : 'adicionados'}`;
        }
        if (sessionAddedCards.length === 0 && rightEmptyHint) {
            rightEmptyHint.classList.remove('hidden');
        }
    }

    if (activeDeckFilter === deckName) {
        activeDeckFilter = 'ALL';
    }

    triggerHaptic('delete');
    renderNotebookOverviewModalContent();
    showNotification(`${removedCount} ${removedCount === 1 ? 'cartão removido' : 'cartões removidos'} do Caderno`, "delete");
}

// --- NOTIFICATION PILL ---
function showNotification(text, icon = "check_circle") {
    if (!bulkNotificationPill || !bulkPillText) return;

    bulkPillText.textContent = text;
    if (bulkPillIcon) bulkPillIcon.textContent = icon;

    bulkNotificationPill.classList.remove('translate-y-16', 'opacity-0');
    bulkNotificationPill.classList.add('translate-y-0', 'opacity-100');

    if (notificationTimeout) clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
        bulkNotificationPill.classList.add('translate-y-16', 'opacity-0');
        bulkNotificationPill.classList.remove('translate-y-0', 'opacity-100');
    }, 2800);
}
