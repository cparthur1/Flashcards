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
const leftCardsList = document.getElementById('left-cards-list');
const leftSpacerTop = document.getElementById('left-spacer-top');
const leftCardsContainer = document.getElementById('left-cards-container');
const leftSpacerBottom = document.getElementById('left-spacer-bottom');
const leftCardsCountBadge = document.getElementById('left-cards-count-badge');
const btnSelectAll = document.getElementById('btn-select-all');
const selectActionsSeparator = document.getElementById('select-actions-separator');
const btnDeselectAll = document.getElementById('btn-deselect-all');

const btnAddToNotebook = document.getElementById('btn-add-to-notebook');
const selectedPillCounter = document.getElementById('selected-pill-counter');

const rightCardsList = document.getElementById('right-cards-list');
const rightCardsCountBadge = document.getElementById('right-cards-count-badge');
const rightEmptyHint = document.getElementById('right-empty-hint');

const notebookTotalCount = document.getElementById('notebook-total-count');

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

// Virtual Scrolling State (Renderiza apenas visíveis + 10 acima e 10 abaixo)
const VIRTUAL_BUFFER_ITEMS = 10;
const DEFAULT_CARD_HEIGHT = 145; // Altura estimada em px por card (incluindo margem de 12px)
const cardHeightCache = new Map(); // cardId -> altura medida em px
let currentRenderRange = { start: -1, end: -1 };
let isVirtualScrollScheduled = false;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    updateNotebookHeaderBadge();
    setupUploadHandlers();
    setupSelectionHandlers();
    setupTransferHandlers();
    setupEditModalHandlers();
    setupVirtualScrollListener();
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
        showNotification("Erro ao salvar no armazenamento local", "⚠️");
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
        showNotification("Nenhum cartão válido encontrado nos arquivos.", "⚠️");
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
    renderVirtualLeftCards(true);
    updateSelectAllButtonState();
    updateTransferButtonState();
    showNotification(`${newCardsLoaded.length} cartões carregados com sucesso!`, "📚");
}

// --- VIRTUAL SCROLLING ENGINE FOR LEFT DECK PREVIEW ---
// Renderiza apenas os cartões visíveis + 10 acima e 10 abaixo para evitar quedas de frames
function getCardHeight(card) {
    if (!card) return DEFAULT_CARD_HEIGHT;
    return cardHeightCache.get(card.id) || DEFAULT_CARD_HEIGHT;
}

function calculateVirtualRange() {
    if (!leftCardsList || uploadedCards.length === 0) {
        return { start: 0, end: 0, topSpacer: 0, bottomSpacer: 0 };
    }

    const scrollTop = leftCardsList.scrollTop;
    const viewportHeight = leftCardsList.clientHeight || 550;

    let accum = 0;
    let firstVisible = -1;
    let lastVisible = uploadedCards.length - 1;

    for (let i = 0; i < uploadedCards.length; i++) {
        const h = getCardHeight(uploadedCards[i]);
        if (firstVisible === -1 && accum + h >= scrollTop) {
            firstVisible = i;
        }
        if (firstVisible !== -1 && accum > scrollTop + viewportHeight) {
            lastVisible = i;
            break;
        }
        accum += h;
    }

    if (firstVisible === -1) firstVisible = 0;

    // Buffer de 10 cards acima e 10 cards abaixo que o usuário pode ver
    const start = Math.max(0, firstVisible - VIRTUAL_BUFFER_ITEMS);
    const end = Math.min(uploadedCards.length - 1, lastVisible + VIRTUAL_BUFFER_ITEMS);

    let topSpacer = 0;
    for (let i = 0; i < start; i++) {
        topSpacer += getCardHeight(uploadedCards[i]);
    }

    let bottomSpacer = 0;
    for (let i = end + 1; i < uploadedCards.length; i++) {
        bottomSpacer += getCardHeight(uploadedCards[i]);
    }

    return { start, end, topSpacer, bottomSpacer };
}

function renderVirtualLeftCards(force = false) {
    if (!leftCardsList || !leftCardsContainer) return;

    if (leftCardsCountBadge) {
        leftCardsCountBadge.textContent = `${uploadedCards.length} ${uploadedCards.length === 1 ? 'card' : 'cards'}`;
    }

    if (uploadedCards.length === 0) {
        if (leftSpacerTop) leftSpacerTop.style.height = '0px';
        if (leftSpacerBottom) leftSpacerBottom.style.height = '0px';
        leftCardsContainer.innerHTML = `
            <div class="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400 select-none">
                <svg class="w-12 h-12 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p class="font-bold text-sm text-gray-600">Todos os cartões foram transferidos!</p>
                <p class="text-xs mt-1">Carregue mais baralhos se desejar adicionar outros cartões.</p>
            </div>
        `;
        currentRenderRange = { start: -1, end: -1 };
        updateSelectAllButtonState();
        return;
    }

    const { start, end, topSpacer, bottomSpacer } = calculateVirtualRange();

    // Se o range de renderização não mudou e não é render forçado, evita re-render desnecessário
    if (!force && start === currentRenderRange.start && end === currentRenderRange.end) {
        return;
    }

    currentRenderRange = { start, end };
    if (leftSpacerTop) leftSpacerTop.style.height = `${topSpacer}px`;
    if (leftSpacerBottom) leftSpacerBottom.style.height = `${bottomSpacer}px`;

    const fragment = document.createDocumentFragment();
    for (let i = start; i <= end; i++) {
        const card = uploadedCards[i];
        const cardEl = createLeftCardElement(card, i);
        fragment.appendChild(cardEl);
    }

    leftCardsContainer.innerHTML = '';
    leftCardsContainer.appendChild(fragment);

    // Mede as alturas reais dos elementos renderizados para precisão do scroll
    requestAnimationFrame(() => {
        measureRenderedCardHeights();
    });
}

function measureRenderedCardHeights() {
    if (!leftCardsContainer) return;
    let anyChanged = false;
    const children = leftCardsContainer.children;
    for (let i = 0; i < children.length; i++) {
        const el = children[i];
        const id = el.dataset?.id;
        if (id) {
            const measured = el.offsetHeight + 12; // 12px de margin (space-y-3)
            const cached = cardHeightCache.get(id);
            if (!cached || Math.abs(cached - measured) > 4) {
                cardHeightCache.set(id, measured);
                anyChanged = true;
            }
        }
    }

    if (anyChanged) {
        const { topSpacer, bottomSpacer } = calculateVirtualRange();
        if (leftSpacerTop) leftSpacerTop.style.height = `${topSpacer}px`;
        if (leftSpacerBottom) leftSpacerBottom.style.height = `${bottomSpacer}px`;
    }
}

function setupVirtualScrollListener() {
    leftCardsList?.addEventListener('scroll', () => {
        if (!isVirtualScrollScheduled) {
            isVirtualScrollScheduled = true;
            requestAnimationFrame(() => {
                renderVirtualLeftCards(false);
                isVirtualScrollScheduled = false;
            });
        }
    }, { passive: true });
}

function createLeftCardElement(card, idx) {
    const cardEl = document.createElement('div');
    const isSelected = selectedCardIds.has(card.id);
    cardEl.className = `flashcard-item bg-white border ${isSelected ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-gray-200'} p-4 rounded-2xl shadow-xs relative group flex flex-col gap-2 transition-all cursor-pointer select-none`;
    cardEl.dataset.id = card.id;

    // Type Badge & Source Deck
    const topBar = document.createElement('div');
    topBar.className = "flex items-center justify-between gap-2 pl-9 pr-1";

    const sourceTag = document.createElement('span');
    sourceTag.className = "text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full truncate max-w-[180px]";
    sourceTag.textContent = card.sourceDeck || 'Baralho';
    sourceTag.title = card.sourceDeck || '';

    const typeBadge = document.createElement('span');
    typeBadge.className = "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded";
    if (card.type === 'anki') {
        typeBadge.className += " bg-indigo-100 text-indigo-800";
        typeBadge.textContent = "Anki";
    } else if (card.type === 'multiple_choice') {
        typeBadge.className += " bg-purple-100 text-purple-800";
        typeBadge.textContent = "Múltipla escolha";
    } else if (card.type === 'open_double') {
        typeBadge.className += " bg-amber-100 text-amber-800";
        typeBadge.textContent = "Escrever duplo";
    } else if (card.type === 'fill') {
        typeBadge.className += " bg-teal-100 text-teal-800";
        typeBadge.textContent = "Preencher";
    } else {
        typeBadge.className += " bg-gray-100 text-gray-700";
        typeBadge.textContent = "Escrever";
    }

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

    // Front (Question) & Back (Answer) Content (com recuo à esquerda para não sobrepor os controles)
    const contentBox = document.createElement('div');
    contentBox.className = "flex flex-col gap-1.5 mt-1 pl-9";

    const descHtml = renderMathAndMarkdown(card.description || '(Sem texto)');
    const frontEl = document.createElement('div');
    frontEl.className = "text-sm text-gray-900 font-medium leading-relaxed";
    frontEl.innerHTML = `<strong>Frente:</strong> <div class="mt-0.5 text-gray-800">${descHtml}</div>`;
    contentBox.appendChild(frontEl);

    const ansHtml = renderMathAndMarkdown(card.answer || '');
    const backEl = document.createElement('div');
    backEl.className = "text-sm text-emerald-700 mt-1";
    backEl.innerHTML = `<strong>Verso:</strong> <div class="mt-0.5 text-emerald-800">${ansHtml}</div>`;
    contentBox.appendChild(backEl);

    // Image previews if present
    const safeImg = sanitizeImageUrl(card.image);
    if (safeImg) {
        const imgCont = document.createElement('div');
        imgCont.className = "mt-2 max-h-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center p-1";
        imgCont.innerHTML = `<img src="${safeImg}" class="max-h-20 w-auto object-contain rounded" alt="Imagem">`;
        contentBox.appendChild(imgCont);
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

    const cardEl = leftCardsContainer?.querySelector(`[data-id="${cardId}"]`);
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
    if (!leftCardsContainer) return;
    const cardElements = leftCardsContainer.querySelectorAll('.flashcard-item');
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

    // Remove da lista da esquerda e sincroniza virtual scroller
    setTimeout(() => {
        uploadedCards = uploadedCards.filter(c => c.id !== card.id);
        cardHeightCache.delete(card.id);

        if (summaryCardsText) {
            summaryCardsText.textContent = `${uploadedCards.length} cartões disponíveis na lista`;
        }

        renderVirtualLeftCards(true);
        updateSelectAllButtonState();
        updateTransferButtonState();
        showNotification("Cartão movido para o Caderno!", "✨");
    }, 300);
}

// --- TRANSFER FROM LEFT TO RIGHT (WITH MATERIAL YOU EXPRESSIVE ANIMATIONS) ---
function setupTransferHandlers() {
    btnAddToNotebook?.addEventListener('click', handleTransferSelectedCards);
}

function handleTransferSelectedCards() {
    if (selectedCardIds.size === 0) return;

    const cardsToTransfer = uploadedCards.filter(c => selectedCardIds.has(c.id));
    if (cardsToTransfer.length === 0) return;

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

    // 2. Animação de Física Material You Expressive ao mover da esquerda para a direita:
    // Aplica slide-out apenas nos cartões selecionados atualmente visíveis na janela virtual
    const renderedItems = leftCardsContainer?.querySelectorAll('.flashcard-item') || [];
    renderedItems.forEach(el => {
        if (selectedCardIds.has(el.dataset?.id)) {
            el.classList.add('card-moving-out');
        }
    });

    triggerHaptic('pop');

    // Aguarda o slide out da física (240ms) e então move para a lista da direita
    setTimeout(() => {
        // Atualiza estado in-memory da esquerda
        uploadedCards = uploadedCards.filter(c => !selectedCardIds.has(c.id));
        cardsToTransfer.forEach(c => cardHeightCache.delete(c.id));
        selectedCardIds.clear();

        // Adiciona à lista de sessão da direita
        sessionAddedCards.push(...preparedCards);

        // Oculta a dica no fundo da direita
        if (rightEmptyHint) rightEmptyHint.classList.add('hidden');

        // Renderiza novos cartões na direita com efeito spring-in (apenas nos primeiros 10 para evitar frame drops)
        const fragment = document.createDocumentFragment();
        preparedCards.forEach((c, idx) => {
            const rightEl = createRightCardElement(c);
            if (idx < 10) {
                rightEl.classList.add('card-spring-in');
            }
            fragment.appendChild(rightEl);
        });
        rightCardsList.appendChild(fragment);

        // Atualiza badge de contagem da direita
        if (rightCardsCountBadge) {
            rightCardsCountBadge.textContent = `${sessionAddedCards.length} ${sessionAddedCards.length === 1 ? 'adicionado' : 'adicionados'}`;
        }

        // Re-renderiza a lista virtual da esquerda
        renderVirtualLeftCards(true);
        updateSelectAllButtonState();
        updateTransferButtonState();

        if (summaryCardsText) {
            summaryCardsText.textContent = `${uploadedCards.length} cartões disponíveis na lista`;
        }

        showNotification(`${preparedCards.length} ${preparedCards.length === 1 ? 'cartão adicionado' : 'cartões adicionados'} ao Caderno!`, "✨");
    }, 240);
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
    typeBadge.className = "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded";
    if (card.type === 'anki') {
        typeBadge.className += " bg-indigo-100 text-indigo-800";
        typeBadge.textContent = "Anki";
    } else if (card.type === 'multiple_choice') {
        typeBadge.className += " bg-purple-100 text-purple-800";
        typeBadge.textContent = "Múltipla escolha";
    } else if (card.type === 'open_double') {
        typeBadge.className += " bg-amber-100 text-amber-800";
        typeBadge.textContent = "Escrever duplo";
    } else if (card.type === 'fill') {
        typeBadge.className += " bg-teal-100 text-teal-800";
        typeBadge.textContent = "Preencher";
    } else {
        typeBadge.className += " bg-gray-100 text-gray-700";
        typeBadge.textContent = "Escrever";
    }

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

        showNotification("Cartão removido do Caderno", "🗑️");
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
    const card = sessionAddedCards.find(c => c.id === cardId);
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

    // 3. Atualiza na UI do cartão na direita
    const cardEl = rightCardsList.querySelector(`[data-id="${editingCardId}"]`);
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

    closeEditModal();
    triggerHaptic('snap');
    showNotification("Cartão atualizado com sucesso!", "✏️");
}

// --- NOTIFICATION PILL ---
function showNotification(text, icon = "✨") {
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
