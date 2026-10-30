// SPDX-License-Identifier: GPL-2.0-only
/**
 * explore-modal.js
 * Universal "Explorar arquivos" Modal (Material Design 3 Expressive)
 * Used across index.html and pages/game.html
 */

import { auth, signInWithGoogle, signOutUser, onAuthChange } from './firebase-client.js';
import {
  getLocalSlots,
  getNotebookSlotData,
  openDeckInSlots,
  deleteSlot,
  fixSlot,
  clearNotebookSlot,
  importNotebookBackupData,
  loadSlotsFromCloud
} from './slot-manager.js';
import { shareDeckToCloud } from './share-manager.js';
import { getUserStatus, createProSubscription, buyExtraGeneration, deleteAccountAndCancelSubscription } from './backend-api.js';
import { ROUTES } from './utils.js';

let modalInitialized = false;
let currentUser = null;
let userProStatus = null;

export const LIFETIME_PRO_EMAILS = [
  'arthur.paludo.c@gmail.com',
  'clarazanchett@gmail.com'
];

export function isLifetime(user) {
  if (!user || !user.email) return false;
  return LIFETIME_PRO_EMAILS.includes(user.email.toLowerCase().trim());
}

export function isUserPro(user = (currentUser || auth.currentUser), status = userProStatus) {
  if (!user) return false;
  if (isLifetime(user)) return true;
  // Crucial: ensure status actually belongs to this specific user UID!
  if (status && status.uid && status.uid !== user.uid) {
    return false;
  }
  return Boolean(status?.isPro || status?.subscription?.status === 'active');
}

/**
 * Refreshes Pro status from backend for a specific user
 */
export async function refreshUserProStatus(user = (currentUser || auth.currentUser)) {
  if (!user) {
    userProStatus = null;
    return null;
  }
  if (isLifetime(user)) {
    userProStatus = { uid: user.uid, isPro: true, isLifetimePro: true };
    return userProStatus;
  }
  userProStatus = await getUserStatus().catch(() => null);
  return userProStatus;
}

/**
 * Initializes the Explore Files modal
 */
export function initExploreModal() {
  if (modalInitialized) return;
  modalInitialized = true;

  injectModalHtml();
  attachModalEventListeners();

  // Listen to Auth State
  onAuthChange(async (user) => {
    const prevUid = currentUser?.uid;
    currentUser = user;
    if (user) {
      if (prevUid !== user.uid) {
        userProStatus = isLifetime(user) ? { uid: user.uid, isPro: true, isLifetimePro: true } : null;
      }
      try {
        await refreshUserProStatus(user);
        await loadSlotsFromCloud();
      } catch (e) {
        console.warn('Erro ao atualizar dados Pro do usuário:', e);
      }
    } else {
      userProStatus = null;
    }
    renderModalContent();
  });
}

/**
 * Open the Explore Files modal
 */
export function openExploreModal() {
  initExploreModal();
  renderModalContent();
  const modal = document.getElementById('explore-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

/**
 * Close the Explore Files modal
 */
export function closeExploreModal() {
  const modal = document.getElementById('explore-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

/**
 * Open Pro Subscription Dialog
 */
export function openProModal() {
  initExploreModal();
  renderProModalContent();
  const proModal = document.getElementById('pro-subscription-modal');
  if (proModal) {
    proModal.classList.remove('hidden');
    proModal.classList.add('flex');
  }
}

export function closeProModal() {
  const proModal = document.getElementById('pro-subscription-modal');
  if (proModal) {
    proModal.classList.add('hidden');
    proModal.classList.remove('flex');
  }
}

// Global expose for triggers across any page
if (typeof window !== 'undefined') {
  window.flashcardsOpenProModal = openProModal;
  window.flashcardsCloseProModal = closeProModal;
}

/**
 * Injects modal HTML into DOM
 */
function injectModalHtml() {
  if (document.getElementById('explore-modal')) return;

  const container = document.createElement('div');
  container.id = 'explore-modal-wrapper';
  container.innerHTML = `
    <!-- EXPLORAR ARQUIVOS MODAL -->
    <div id="explore-modal" class="hidden fixed inset-0 modal-overlay z-[100] items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div class="m3-dialog-card w-full max-w-2xl bg-[var(--md-sys-color-surface-container-lowest)] rounded-[28px] shadow-2xl border border-[var(--md-sys-color-outline-variant)] overflow-hidden flex flex-col max-h-[92vh] animate-fadeIn">
        
        <!-- HEADER (Matches Mockup) -->
        <div class="p-4 sm:p-5 border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] flex items-center justify-between">
          <div id="modal-auth-section" class="flex items-center gap-3 min-w-0">
            <!-- Injected dynamically: Google login or User profile -->
          </div>
          <button id="close-explore-modal-btn" class="p-2 rounded-full hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] transition-colors flex-shrink-0" title="Fechar">
            <span class="material-symbols-rounded text-xl">close</span>
          </button>
        </div>

        <!-- MODAL BODY -->
        <div class="p-4 sm:p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          
          <!-- ROW 1: 3 LATEST DECKS -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-bold uppercase tracking-wider text-[var(--md-sys-color-on-surface-variant)]">Baralhos Recentes (3 Slots)</span>
              <span class="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">Slot aberto é sobrescritível</span>
            </div>
            <div id="deck-slots-grid" class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- ROW 2: NOTEBOOK (CADERNO) -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-bold uppercase tracking-wider text-[var(--md-sys-color-on-surface-variant)]">Caderno de Erros</span>
              <span class="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">Slot permanente</span>
            </div>
            <div id="notebook-slot-container">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- EXTRA ACTIONS: UPLOAD & EXAM WEEK -->
          <div class="pt-2 border-t border-[var(--md-sys-color-outline-variant)] flex flex-wrap gap-2.5">
            <button id="modal-upload-btn" class="m3-btn-expressive m3-btn-tonal text-xs py-2.5 px-4 font-bold flex items-center gap-2">
              <span class="material-symbols-rounded text-lg">upload_file</span>
              <span>Carregar Arquivo (.json)</span>
            </button>
            <input type="file" id="modal-hidden-file-input" accept=".json" class="hidden" />
            <input type="file" id="modal-hidden-notebook-file-input" accept=".json" class="hidden" />

            <button id="modal-exam-btn" class="m3-btn-expressive m3-btn-outlined text-xs py-2.5 px-4 font-bold flex items-center gap-2 text-purple-700 border-purple-300 hover:bg-purple-50">
              <span class="material-symbols-rounded text-lg text-purple-600">bolt</span>
              <span>Semana de Provas (Misturar)</span>
            </button>
          </div>

        </div>

      </div>
    </div>

    <!-- PRO SUBSCRIPTION MODAL (R$ 5,00/MÊS) -->
    <div id="pro-subscription-modal" class="hidden fixed inset-0 modal-overlay z-[110] items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div class="m3-dialog-card w-full max-w-md bg-[var(--md-sys-color-surface-container-lowest)] rounded-[28px] shadow-2xl border border-[var(--md-sys-color-outline-variant)] p-6 text-center animate-fadeIn">
        <div class="w-12 h-12 rounded-2xl bg-blue-100 text-[var(--md-sys-color-primary)] flex items-center justify-center mx-auto mb-3">
          <span class="material-symbols-rounded text-2xl">workspace_premium</span>
        </div>
        <h2 class="text-xl font-bold text-[var(--md-sys-color-on-surface)] mb-1">Flashcards Pro</h2>
        <p class="text-xs text-[var(--md-sys-color-on-surface-variant)] mb-4">Sincronização em nuvem e recursos de Inteligência Artificial sem chave de API.</p>

        <div class="bg-[var(--md-sys-color-surface-container-low)] p-4 rounded-2xl text-left space-y-2 mb-4 text-xs">
          <div class="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
            <span class="material-symbols-rounded text-base text-green-600">check_circle</span>
            <span><strong>Gerar flashcards com IA</strong> usando seus materiais</span>
          </div>
          <div class="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
            <span class="material-symbols-rounded text-base text-green-600">check_circle</span>
            <span><strong>Tutor de IA</strong> que explica seu card</span>
          </div>
          <div class="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
            <span class="material-symbols-rounded text-base text-green-600">check_circle</span>
            <span><strong>Corretor</strong> de respostas com sinônimos</span>
          </div>
          <div class="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
            <span class="material-symbols-rounded text-base text-green-600">check_circle</span>
            <span><strong>Estatísticas</strong> aprimoradas</span>
          </div>
          <div class="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
            <span class="material-symbols-rounded text-base text-green-600">check_circle</span>
            <span><strong>Sincronização</strong> entre dispositivos</span>
          </div>
          <div class="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
            <span class="material-symbols-rounded text-base text-green-600">check_circle</span>
            <span><strong>Compartilhar</strong> decks por link</span>
          </div>
        </div>

        <div class="mb-5">
          <span class="text-3xl font-extrabold text-[var(--md-sys-color-primary)]">R$ 5,00</span>
          <span class="text-xs text-[var(--md-sys-color-on-surface-variant)]">/ mês</span>
        </div>

        <!-- Checkout View -->
        <div id="pro-checkout-container" class="space-y-3">
          <input type="text" id="pro-cpf-input" placeholder="CPF para NF (opcional)" class="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500" />
          <button id="pro-generate-pix-btn" class="m3-btn-expressive m3-btn-filled w-full py-3 px-4 font-bold text-sm flex items-center justify-center gap-2 shadow">
            <span class="material-symbols-rounded text-lg">pix</span>
            <span>Assinar via Pix ou Cartão</span>
          </button>
        </div>

        <!-- Pix QR Code Result View (Hidden by default) -->
        <div id="pro-pix-result" class="hidden space-y-3">
          <div class="p-3 bg-white border border-gray-200 rounded-2xl inline-block mx-auto shadow-sm">
            <img id="pro-pix-qr-img" class="w-48 h-48 mx-auto" alt="QR Code Pix" />
          </div>
          <div class="text-xs text-gray-500">Escaneie o QR Code ou copie a chave Pix abaixo:</div>
          <button id="pro-copy-pix-btn" class="m3-btn-expressive m3-btn-tonal w-full py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5">
            <span class="material-symbols-rounded text-base">content_copy</span>
            <span>Copiar Chave Pix</span>
          </button>
          <a id="pro-invoice-link" href="#" target="_blank" rel="noopener noreferrer" class="block text-xs text-blue-600 underline font-medium mt-1">Pagar com Cartão no Asaas</a>
        </div>

        <button id="close-pro-modal-btn" class="mt-4 text-xs text-gray-400 hover:text-gray-600 underline block mx-auto">
          Voltar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(container);
}

/**
 * Attaches event listeners for modals
 */
function attachModalEventListeners() {
  document.getElementById('close-explore-modal-btn')?.addEventListener('click', closeExploreModal);
  document.getElementById('close-pro-modal-btn')?.addEventListener('click', closeProModal);

  // File Upload inside modal
  const uploadBtn = document.getElementById('modal-upload-btn');
  const hiddenInput = document.getElementById('modal-hidden-file-input');
  uploadBtn?.addEventListener('click', () => hiddenInput?.click());

  hiddenInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed && parsed.__flashcards_watermark__ === "notebook_backup_v1") {
        const importAsNotebook = confirm('Este arquivo é um backup do Caderno de Erros.\n\nDeseja restaurá-lo diretamente no seu Caderno de Erros?');
        if (importAsNotebook) {
          const importedCount = importNotebookBackupData(parsed);
          renderNotebookSlot();
          hiddenInput.value = '';
          alert(`Backup do Caderno restaurado com sucesso! (${importedCount} cards carregados)`);
          return;
        }
      }

      const deckName = file.name.replace(/\.[^/.]+$/, '');
      let cards = [];
      let deckTitle = deckName;

      if (Array.isArray(parsed)) {
        cards = parsed;
      } else if (parsed && Array.isArray(parsed.allQuestions)) {
        cards = parsed.allQuestions;
        deckTitle = parsed.deckTitle || deckName;
      } else if (parsed && Array.isArray(parsed.cards)) {
        cards = parsed.cards;
        deckTitle = parsed.deckTitle || deckName;
      } else {
        alert('Arquivo inválido: o JSON não possui a estrutura esperada de baralho.');
        return;
      }

      if (cards.length === 0) {
        alert('O arquivo JSON está vazio ou não contém cartões válidos.');
        return;
      }

      const playable = cards.filter(q => q && q.type !== 'divisor' && q.type !== 'divider' && q.type !== 'note');
      const gameState = {
        questionsPool: [...playable],
        allQuestions: [...cards],
        score: 0,
        deckTitle: deckTitle
      };

      openDeckInSlots(gameState, deckTitle);
      renderModalContent();
      // Reset input to allow selecting same file again
      hiddenInput.value = '';
      // Redirect to game
      window.location.href = ROUTES.GAME;
    } catch (err) {
      alert('Erro ao ler o arquivo JSON selecionado: ' + (err.message || 'formato inválido'));
    }
  });

  // Notebook Backup File Upload inside modal
  const hiddenNotebookInput = document.getElementById('modal-hidden-notebook-file-input');
  hiddenNotebookInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedCount = importNotebookBackupData(parsed);

      // Update landing page badge if present
      const notebookCountEl = document.getElementById('notebook-count');
      const notebookCountLabel = document.getElementById('notebook-count-label');
      if (notebookCountEl) {
        notebookCountEl.textContent = importedCount;
        if (notebookCountLabel) {
          notebookCountLabel.textContent = importedCount === 1 ? 'card' : 'cards';
        }
      }

      renderNotebookSlot();
      alert(`Backup do Caderno importado com sucesso!\n${importedCount} cards carregados no Caderno de Erros.`);
    } catch (err) {
      alert('Erro ao importar backup do caderno: ' + (err.message || 'Arquivo corrompido'));
    } finally {
      if (hiddenNotebookInput) hiddenNotebookInput.value = '';
    }
  });

  // Exam Week button
  document.getElementById('modal-exam-btn')?.addEventListener('click', () => {
    closeExploreModal();
    const examModal = document.getElementById('exam-modal');
    if (examModal) {
      examModal.classList.remove('hidden');
      examModal.classList.add('flex');
    }
  });

  // Pro Subscription Pix button
  bindProCheckoutBtn();
}

function bindProCheckoutBtn() {
  document.getElementById('pro-generate-pix-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('pro-generate-pix-btn');
    const cpfInput = document.getElementById('pro-cpf-input');
    btn.disabled = true;
    btn.textContent = 'Gerando cobrança...';

    try {
      const result = await createProSubscription({
        cpfCnpj: cpfInput?.value?.trim() || undefined
      });

      if (result.pix?.encodedImage) {
        document.getElementById('pro-checkout-container')?.classList.add('hidden');
        const pixResult = document.getElementById('pro-pix-result');
        pixResult?.classList.remove('hidden');

        const qrImg = document.getElementById('pro-pix-qr-img');
        if (qrImg) qrImg.src = `data:image/png;base64,${result.pix.encodedImage}`;

        const copyBtn = document.getElementById('pro-copy-pix-btn');
        if (copyBtn) {
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(result.pix.payload);
            copyBtn.textContent = 'Copiado!';
            setTimeout(() => { copyBtn.innerHTML = '<span class="material-symbols-rounded text-base">content_copy</span><span>Copiar Chave Pix</span>'; }, 2000);
          };
        }

        const invoiceLink = document.getElementById('pro-invoice-link');
        if (invoiceLink && result.invoiceUrl) {
          invoiceLink.href = result.invoiceUrl;
        }
      } else if (result.invoiceUrl) {
        window.open(result.invoiceUrl, '_blank');
      }
    } catch (e) {
      alert(e.message || 'Erro ao gerar assinatura. Tente novamente.');
      btn.disabled = false;
      btn.textContent = 'Assinar via Pix ou Cartão';
    }
  });
}

/**
 * Render Pro Modal View according to user status
 */
export function renderProModalContent() {
  const container = document.getElementById('pro-checkout-container');
  if (!container) return;

  const pixResult = document.getElementById('pro-pix-result');
  if (pixResult) pixResult.classList.add('hidden');
  container.classList.remove('hidden');

  const pro = isUserPro(currentUser, userProStatus);
  const lifetime = isLifetime(currentUser);

  if (pro) {
    container.innerHTML = `
      <div class="p-3.5 bg-green-50 border border-green-200 rounded-2xl text-xs text-green-800 font-bold flex items-center justify-center gap-2">
        <span class="material-symbols-rounded text-lg text-green-600">verified</span>
        <span>Você já possui o plano PRO ${lifetime ? 'VITALÍCIO' : 'ATIVO'}!</span>
      </div>
      <button id="pro-dismiss-btn" class="m3-btn-expressive m3-btn-filled w-full py-2.5 mt-3 font-bold text-xs bg-green-600 hover:bg-green-700 text-white shadow">
        Continuar Estudando
      </button>
    `;
    document.getElementById('pro-dismiss-btn')?.addEventListener('click', closeProModal);
    return;
  }

  if (!currentUser) {
    container.innerHTML = `
      <div class="space-y-3">
        <button id="pro-google-login-btn" class="m3-btn-expressive m3-btn-filled w-full py-3.5 px-4 font-bold text-sm flex items-center justify-center gap-2.5 shadow bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition">
          <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="#ffffff"><path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          <span>Fazer Login com Google</span>
        </button>
        <p class="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">Faça login com sua conta Google para assinar o plano Pro.</p>
      </div>
    `;

    document.getElementById('pro-google-login-btn')?.addEventListener('click', async () => {
      try {
        const user = await signInWithGoogle();
        if (user) {
          renderProModalContent();
          renderModalContent();
        }
      } catch (e) {
        alert('Erro ao autenticar com Google.');
      }
    });
    return;
  }

  // Logged in but not Pro
  container.innerHTML = `
    <input type="text" id="pro-cpf-input" placeholder="CPF para NF (opcional)" class="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500" />
    <button id="pro-generate-pix-btn" class="m3-btn-expressive m3-btn-filled w-full py-3 px-4 font-bold text-sm flex items-center justify-center gap-2 shadow">
      <span class="material-symbols-rounded text-lg">pix</span>
      <span>Assinar via Pix ou Cartão</span>
    </button>
  `;
  bindProCheckoutBtn();
}

/**
 * Render modal content according to current state
 */
export function renderModalContent() {
  renderAuthHeader();
  renderDeckSlots();
  renderNotebookSlot();
}

/**
 * Render Header section (Logged out vs Logged in)
 */
function renderAuthHeader() {
  const container = document.getElementById('modal-auth-section');
  if (!container) return;

  if (currentUser) {
    const photo = currentUser.photoURL || '';
    const name = currentUser.displayName || currentUser.email.split('@')[0];
    const lifetime = isLifetime(currentUser);
    const isPro = Boolean(lifetime || userProStatus?.isPro || currentUser.pro);

    container.innerHTML = `
      <div class="relative">
        ${photo ? `<img src="${photo}" class="w-10 h-10 rounded-full border border-blue-200 object-cover" alt="Avatar">`
                : `<span class="material-symbols-rounded text-4xl text-blue-600">account_circle</span>`}
        ${isPro ? `<span class="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 text-[10px]" title="Assinante Pro"><span class="material-symbols-rounded text-xs block">star</span></span>` : ''}
      </div>
      <div class="text-left min-w-0">
        <div class="flex items-center gap-1.5">
          <p class="font-bold text-sm text-[var(--md-sys-color-on-surface)] truncate max-w-[140px] sm:max-w-[200px]">${name}</p>
          ${isPro ? `<span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full border border-amber-300">${lifetime ? 'PRO VITALÍCIO' : 'PRO'}</span>` : ''}
        </div>
        <div class="flex items-center gap-3">
          <button id="modal-logout-btn" class="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer">
            <span class="material-symbols-rounded text-sm">logout</span> Sair
          </button>
          ${isPro 
            ? `<button id="modal-manage-account-btn" class="text-xs text-blue-600 hover:text-blue-700 font-bold underline cursor-pointer">Gerenciar assinatura</button>` 
            : `<button id="modal-upgrade-pro-btn" class="text-xs text-blue-600 hover:text-blue-700 font-bold underline cursor-pointer">Assinar Pro</button>`}
        </div>
      </div>
    `;

    document.getElementById('modal-logout-btn')?.addEventListener('click', async () => {
      await signOutUser();
    });
    document.getElementById('modal-upgrade-pro-btn')?.addEventListener('click', openProModal);
    document.getElementById('modal-manage-account-btn')?.addEventListener('click', () => {
      if (typeof window !== 'undefined' && window.flashcardsOpenAccountModal) {
        window.flashcardsOpenAccountModal();
      } else {
        import('./account-modal.js').then(m => m.openAccountModal());
      }
    });

  } else {
    container.innerHTML = `
      <div>
        <button id="modal-login-btn" class="flex items-center gap-2.5 px-4 py-2 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-300 rounded-full shadow-sm text-xs sm:text-sm font-semibold text-gray-700 transition">
          <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          <span>Sign in with Google</span>
        </button>
        <p class="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1 text-left font-medium">Salve decks e progresso na nuvem</p>
      </div>
    `;

    document.getElementById('modal-login-btn')?.addEventListener('click', async () => {
      try {
        const user = await signInWithGoogle();
        if (user) {
          renderModalContent();
        }
      } catch (err) {
        alert('Erro ao autenticar com o Google.');
      }
    });
  }
}

/**
 * Render Row 1: 3 Deck Slots
 */
function renderDeckSlots() {
  const container = document.getElementById('deck-slots-grid');
  if (!container) return;

  const slots = getLocalSlots();
  container.innerHTML = slots.map((slot, idx) => {
    const hasData = Boolean(slot.deckData && slot.cardCount > 0);
    const isCurrent = Boolean(slot.isCurrent);
    const isFixed = Boolean(slot.isFixed);

    if (!hasData) {
      return `
        <div class="slot-card-empty border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-2xl p-4 flex flex-col items-center justify-center text-center min-h-[140px] cursor-pointer transition-colors bg-[var(--md-sys-color-surface-container-low)]" onclick="document.getElementById('modal-hidden-file-input').click()">
          <span class="material-symbols-rounded text-3xl text-gray-400 mb-1">add_circle</span>
          <span class="text-xs font-bold text-gray-600">Slot ${idx + 1} Vazio</span>
          <span class="text-[10px] text-gray-400 mt-0.5">Clique para carregar</span>
        </div>
      `;
    }

    return `
      <div class="slot-card relative bg-white border ${isCurrent ? 'border-blue-500 shadow-md ring-2 ring-blue-100' : 'border-gray-200'} rounded-2xl p-3 flex flex-col justify-between min-h-[140px] transition-all hover:shadow-lg">
        
        <!-- Top Status Indicators -->
        <div class="flex items-center justify-between gap-1 mb-2">
          ${isCurrent ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Aberto agora</span>` : `<span class="text-[10px] text-gray-400 font-semibold">Slot ${idx + 1}</span>`}
          ${isFixed ? `<span class="material-symbols-rounded text-sm text-blue-600" title="Fixado: protegido contra sobrescrita">lock</span>` : `<span class="text-[10px] text-gray-400" title="Sobrescritível ao abrir novos decks">Sobrescritível</span>`}
        </div>

        <!-- Deck Content / Title -->
        <div class="cursor-pointer flex-1 my-1" onclick="window.flashcardsOpenSlot(${idx})">
          <h4 class="text-sm font-bold text-gray-900 line-clamp-2 leading-tight" title="${slot.title}">${slot.title}</h4>
          <p class="text-xs text-gray-500 mt-1">${slot.cardCount} cards</p>
        </div>

        <!-- Action Bar: Red Delete & Blue Share (Matching Mockup) -->
        <div class="pt-2 mt-1 border-t border-gray-100 flex items-center justify-between">
          <button class="p-1.5 rounded-lg text-red-500 hover:bg-red-50 active:bg-red-100 transition" title="Excluir do Slot" onclick="window.flashcardsDeleteSlot(${idx})">
            <span class="material-symbols-rounded text-lg">delete</span>
          </button>
          <button class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition" title="Compartilhar & Fixar no Slot" onclick="window.flashcardsShareSlot(${idx})">
            <span class="material-symbols-rounded text-lg">share</span>
          </button>
        </div>

      </div>
    `;
  }).join('');
}

/**
 * Render Row 2: Caderno Slot
 */
function renderNotebookSlot() {
  const container = document.getElementById('notebook-slot-container');
  if (!container) return;

  const notebook = getNotebookSlotData();
  const hasCards = notebook.cardCount > 0;

  if (!hasCards) {
    container.innerHTML = `
      <div class="border border-gray-200 rounded-2xl p-4 flex items-center justify-between bg-[var(--md-sys-color-surface-container-low)]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <span class="material-symbols-rounded text-2xl">bookmark</span>
          </div>
          <div class="text-left">
            <p class="text-sm font-bold text-gray-800">Caderno de Erros</p>
            <p class="text-xs text-gray-400">Nenhum card salvo no caderno ainda</p>
          </div>
        </div>
        <button id="import-notebook-btn" class="p-2 sm:px-3 sm:py-1.5 rounded-xl text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer" title="Importar Backup do Caderno" onclick="window.flashcardsImportNotebookBackup()">
          <span class="material-symbols-rounded text-lg">file_upload</span>
          <span class="hidden sm:inline">Importar Backup</span>
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="bg-white border border-blue-200 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition">
      <div class="flex items-center gap-3 min-w-0 cursor-pointer flex-1" onclick="window.flashcardsOpenNotebook()">
        <div class="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
          <span class="material-symbols-rounded text-2xl">bookmark</span>
        </div>
        <div class="text-left min-w-0">
          <p class="text-sm font-bold text-gray-900 truncate">Caderno de Erros</p>
          <p class="text-xs text-gray-500">${notebook.cardCount} cards para revisão</p>
        </div>
      </div>

      <!-- Action Bar: Import, Delete, Share -->
      <div class="flex items-center gap-1 flex-shrink-0">
        <button class="p-2 rounded-xl text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition cursor-pointer" title="Importar Backup do Caderno" onclick="window.flashcardsImportNotebookBackup()">
          <span class="material-symbols-rounded text-xl">file_upload</span>
        </button>
        <button class="p-2 rounded-xl text-red-500 hover:bg-red-50 active:bg-red-100 transition cursor-pointer" title="Limpar Caderno" onclick="window.flashcardsClearNotebook()">
          <span class="material-symbols-rounded text-xl">delete</span>
        </button>
        <button class="p-2 rounded-xl text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition cursor-pointer" title="Compartilhar Caderno" onclick="window.flashcardsShareNotebook()">
          <span class="material-symbols-rounded text-xl">share</span>
        </button>
      </div>
    </div>
  `;
}

// Global window actions for inline onclick triggers
window.flashcardsOpenSlot = function(slotIdx) {
  const slots = getLocalSlots();
  const slot = slots[slotIdx];
  if (slot?.deckData) {
    slots.forEach((s, idx) => { s.isCurrent = (idx === slotIdx); });
    localStorage.setItem('flashcards_deck_slots', JSON.stringify(slots));
    localStorage.setItem('flashcardsSave', JSON.stringify(slot.deckData));
    localStorage.setItem('flashcardsActiveMode', 'normal');
    closeExploreModal();
    window.location.href = ROUTES.GAME;
  }
};

window.flashcardsDeleteSlot = function(slotIdx) {
  if (confirm('Deseja realmente remover este baralho do slot?')) {
    deleteSlot(slotIdx);
    renderDeckSlots();
  }
};

window.flashcardsShareSlot = async function(slotIdx) {
  if (!isUserPro()) {
    openProModal();
    return;
  }
  const slots = getLocalSlots();
  const slot = slots[slotIdx];
  if (!slot?.deckData) return;

  try {
    const { shareUrl } = await shareDeckToCloud(slot.deckData, slot.title, slotIdx);
    fixSlot(slotIdx, true);
    renderDeckSlots();
    alert(`Baralho compartilhado e fixado no slot!\n\nLink copiado para a área de transferência:\n${shareUrl}`);
  } catch (err) {
    alert('Erro ao compartilhar baralho.');
  }
};

window.flashcardsOpenNotebook = function() {
  localStorage.setItem('flashcardsActiveMode', 'notebook');
  closeExploreModal();
  window.location.href = ROUTES.GAME;
};

window.flashcardsClearNotebook = function() {
  if (confirm('Tem certeza de que deseja limpar todos os cards do seu Caderno?')) {
    clearNotebookSlot();
    renderNotebookSlot();
  }
};

window.flashcardsImportNotebookBackup = function() {
  document.getElementById('modal-hidden-notebook-file-input')?.click();
};

window.flashcardsShareNotebook = async function() {
  if (!isUserPro()) {
    openProModal();
    return;
  }
  const notebook = getNotebookSlotData();
  if (!notebook.deckData) return;
  try {
    const { shareUrl } = await shareDeckToCloud(notebook.deckData, 'Caderno de Erros', null);
    alert(`Caderno compartilhado!\n\nLink copiado para a área de transferência:\n${shareUrl}`);
  } catch (e) {
    alert('Erro ao compartilhar caderno.');
  }
};
