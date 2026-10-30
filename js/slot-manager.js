// SPDX-License-Identifier: GPL-2.0-only
/**
 * slot-manager.js
 * Manages the 3 deck slots, the dedicated notebook slot, and cloud synchronization
 */

import { auth, db, doc, getDoc, setDoc, updateDoc, onSnapshot } from './firebase-client.js';
import { getCloudSlots, saveCloudSlots } from './backend-api.js';

let syncTimeout = null;

/**
 * Debounced sync to avoid excessive requests during rapid card review
 */
export function debouncedSyncSlotsToCloud(delay = 2500) {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncSlotsToCloud();
  }, delay);
}

const SLOTS_STORAGE_KEY = 'flashcards_deck_slots';
const ACTIVE_MODE_KEY = 'flashcardsActiveMode';
const SAVE_KEY = 'flashcardsSave';
const NOTEBOOK_KEY = 'flashcardsNotebook';

/**
 * Default empty 3 slots
 */
function createDefaultSlots() {
  return [
    { slotIndex: 0, deckId: null, title: 'Slot 1 (Vazio)', cardCount: 0, isFixed: false, isCurrent: false, deckData: null, updatedAt: 0 },
    { slotIndex: 1, deckId: null, title: 'Slot 2 (Vazio)', cardCount: 0, isFixed: false, isCurrent: false, deckData: null, updatedAt: 0 },
    { slotIndex: 2, deckId: null, title: 'Slot 3 (Vazio)', cardCount: 0, isFixed: false, isCurrent: false, deckData: null, updatedAt: 0 }
  ];
}

/**
 * Load local slots from localStorage
 */
export function getLocalSlots() {
  try {
    const raw = localStorage.getItem(SLOTS_STORAGE_KEY);
    if (!raw) {
      const defaultSlots = createDefaultSlots();
      saveLocalSlots(defaultSlots);
      return defaultSlots;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler slots locais:', e);
    return createDefaultSlots();
  }
}

/**
 * Save slots to localStorage
 */
export function saveLocalSlots(slots) {
  try {
    localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(slots));
  } catch (e) {
    console.error('Erro ao salvar slots locais:', e);
  }
}

/**
 * Load notebook data
 */
export function getNotebookSlotData() {
  try {
    const raw = localStorage.getItem(NOTEBOOK_KEY);
    if (!raw) return { title: 'Caderno', cardCount: 0, deckData: null };
    const data = JSON.parse(raw);
    return {
      title: 'Caderno de Erros',
      cardCount: (data.allQuestions || []).length,
      deckData: data
    };
  } catch (e) {
    return { title: 'Caderno', cardCount: 0, deckData: null };
  }
}

/**
 * Put a deck into the 3-slot system
 * Rule 1.1: Save 3 latest decks.
 * - If sharing the file: fixed on the slot without being overwritten.
 * - The currently opened slot is always overwritable.
 */
export function openDeckInSlots(deckData, deckName = 'Baralho') {
  const slots = getLocalSlots();
  const cardCount = (deckData.allQuestions || []).length;
  const newDeckId = deckData.deckId || `deck_${Date.now()}`;
  deckData.deckId = newDeckId;
  deckData.deckName = deckName;

  // 1. Check if this deck is already in one of the slots (matching ID or title & questions length)
  const existingIndex = slots.findIndex(s => s.deckData && (s.deckId === newDeckId || s.title === deckName));

  let targetIndex = 0;

  if (existingIndex !== -1) {
    // Deck already in a slot, make it active
    targetIndex = existingIndex;
  } else {
    // Find slot to overwrite:
    // First priority: The currently active slot IF not fixed
    const currentActiveIndex = slots.findIndex(s => s.isCurrent && !s.isFixed);
    if (currentActiveIndex !== -1) {
      targetIndex = currentActiveIndex;
    } else {
      // Second priority: Any empty slot
      const emptyIndex = slots.findIndex(s => !s.deckData);
      if (emptyIndex !== -1) {
        targetIndex = emptyIndex;
      } else {
        // Third priority: Oldest slot that is not fixed
        const unfixedSlots = slots
          .map((s, idx) => ({ ...s, originalIdx: idx }))
          .filter(s => !s.isFixed);

        if (unfixedSlots.length > 0) {
          unfixedSlots.sort((a, b) => a.updatedAt - b.updatedAt);
          targetIndex = unfixedSlots[0].originalIdx;
        } else {
          // If all 3 slots are fixed, overwrite slot 0
          targetIndex = 0;
        }
      }
    }
  }

  // Update target slot
  slots.forEach((s, idx) => {
    s.isCurrent = (idx === targetIndex);
  });

  slots[targetIndex] = {
    slotIndex: targetIndex,
    deckId: newDeckId,
    title: deckName,
    cardCount,
    isFixed: slots[targetIndex].isFixed || false,
    isCurrent: true,
    deckData,
    updatedAt: Date.now()
  };

  saveLocalSlots(slots);

  // Save to active game session
  localStorage.setItem(SAVE_KEY, JSON.stringify(deckData));
  localStorage.setItem(ACTIVE_MODE_KEY, 'normal');

  // Trigger cloud sync
  syncSlotsToCloud();

  return targetIndex;
}

/**
 * Fix / Pin slot when sharing
 */
export function fixSlot(slotIndex, fixed = true) {
  const slots = getLocalSlots();
  if (slots[slotIndex]) {
    slots[slotIndex].isFixed = fixed;
    saveLocalSlots(slots);
    syncSlotsToCloud();
  }
}

/**
 * Delete a deck from a slot
 */
export function deleteSlot(slotIndex) {
  const slots = getLocalSlots();
  if (slots[slotIndex]) {
    const wasCurrent = slots[slotIndex].isCurrent;
    const shareSlug = slots[slotIndex].shareSlug;

    // If deck was shared, mark share as deleted in Firestore
    if (shareSlug) {
      try {
        updateDoc(doc(db, 'shares', shareSlug), { deleted: true, deletedAt: Date.now() }).catch(() => {});
      } catch (e) {}
    }

    slots[slotIndex] = {
      slotIndex,
      deckId: null,
      shareSlug: null,
      title: `Slot ${slotIndex + 1} (Vazio)`,
      cardCount: 0,
      isFixed: false,
      isCurrent: false,
      deckData: null,
      updatedAt: 0
    };

    if (wasCurrent) {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(ACTIVE_MODE_KEY);
    }

    saveLocalSlots(slots);
    syncSlotsToCloud();
  }
}

/**
 * Clear notebook slot
 */
export function clearNotebookSlot() {
  localStorage.removeItem(NOTEBOOK_KEY);
  syncSlotsToCloud();
}

/**
 * Import a notebook backup into localStorage
 */
export function importNotebookBackupData(parsedData) {
  let cards = [];

  if (parsedData && parsedData.__flashcards_watermark__ === "notebook_backup_v1" && Array.isArray(parsedData.cards)) {
    cards = parsedData.cards;
  } else if (parsedData && Array.isArray(parsedData.allQuestions)) {
    cards = parsedData.allQuestions;
  } else if (parsedData && Array.isArray(parsedData.cards)) {
    cards = parsedData.cards;
  } else if (Array.isArray(parsedData)) {
    cards = parsedData;
  } else {
    throw new Error('O arquivo não possui o formato esperado de backup de caderno.');
  }

  if (cards.length === 0) {
    throw new Error('O arquivo está vazio ou não contém cartões válidos.');
  }

  const playable = cards.filter(q => q && q.type !== 'divisor' && q.type !== 'divider' && q.type !== 'note');
  const notebookState = {
    deckTitle: "Caderno",
    score: parsedData.score || 0,
    notebookReviewsCount: parsedData.notebookReviewsCount || 0,
    currentStreak: parsedData.currentStreak || 0,
    currentStep: parsedData.currentStep || 0,
    consecutiveDueCardsCount: parsedData.consecutiveDueCardsCount || 0,
    consecutiveNewCardsCount: parsedData.consecutiveNewCardsCount || 0,
    allQuestions: cards,
    questionsPool: Array.isArray(parsedData.questionsPool) && parsedData.questionsPool.length > 0 ? parsedData.questionsPool : [...playable],
    updatedAt: Date.now()
  };

  localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(notebookState));
  syncSlotsToCloud();
  return cards.length;
}

/**
 * Synchronize slots and user progress to Firestore via Backend Admin API
 */
export async function syncSlotsToCloud() {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  const user = auth.currentUser;
  if (!user) return;

  try {
    const slots = getLocalSlots();

    // Keep active slot updated with the latest normal game session if active
    const activeMode = localStorage.getItem(ACTIVE_MODE_KEY) || 'normal';
    const activeSave = localStorage.getItem(SAVE_KEY);
    if (activeMode === 'normal' && activeSave) {
      try {
        const parsedSave = JSON.parse(activeSave);
        const currentSlotIndex = slots.findIndex(s => s.isCurrent);
        if (currentSlotIndex !== -1 && slots[currentSlotIndex]) {
          slots[currentSlotIndex].deckData = parsedSave;
          slots[currentSlotIndex].cardCount = (parsedSave.allQuestions || []).length;
          slots[currentSlotIndex].title = parsedSave.deckTitle || slots[currentSlotIndex].title;
          slots[currentSlotIndex].updatedAt = Date.now();
          saveLocalSlots(slots);
        }
      } catch (e) {}
    }

    const notebookData = getNotebookSlotData();

    // Stats
    let stats = {};
    try {
      const statsRaw = localStorage.getItem('flashcardsStats');
      if (statsRaw) stats = JSON.parse(statsRaw);
    } catch (e) {}

    await saveCloudSlots({
      slots,
      notebookData,
      stats
    });
  } catch (err) {
    console.warn('Erro ao sincronizar com nuvem via backend:', err);
  }
}

/**
 * Load cloud slots when user logs in on a device
 */
export async function loadSlotsFromCloud() {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    const cloudData = await getCloudSlots();
    if (!cloudData) return false;

    let hasSlotChanges = false;
    const localSlots = getLocalSlots();

    if (cloudData.deckSlots && Array.isArray(cloudData.deckSlots) && cloudData.deckSlots.length > 0) {
      for (const cloudSlot of cloudData.deckSlots) {
        const idx = cloudSlot.slotIndex;
        if (idx !== undefined && idx >= 0 && idx < 3) {
          const localSlot = localSlots[idx];
          const cloudUpdatedAt = cloudSlot.updatedAt || cloudData.lastSyncedAt || 0;
          const localUpdatedAt = localSlot?.updatedAt || 0;

          if (cloudSlot.deckData && (!localSlot?.deckData || cloudUpdatedAt >= localUpdatedAt)) {
            localSlots[idx] = {
              slotIndex: idx,
              deckId: cloudSlot.deckId,
              title: cloudSlot.title,
              cardCount: cloudSlot.cardCount,
              isFixed: Boolean(cloudSlot.isFixed),
              isCurrent: Boolean(cloudSlot.isCurrent),
              deckData: cloudSlot.deckData,
              updatedAt: cloudUpdatedAt
            };
            hasSlotChanges = true;

            if (cloudSlot.isCurrent) {
              localStorage.setItem(SAVE_KEY, JSON.stringify(cloudSlot.deckData));
              localStorage.setItem(ACTIVE_MODE_KEY, 'normal');
            }
          }
        }
      }
      if (hasSlotChanges) {
        saveLocalSlots(localSlots);
      }
    } else {
      // If cloud has no slots yet, but local device has decks or notebook, push local to cloud!
      const hasLocalDecks = localSlots.some(s => s.deckData);
      const localNotebook = getNotebookSlotData();
      if (hasLocalDecks || localNotebook?.deckData) {
        await syncSlotsToCloud();
      }
    }

    // Load cloud notebook
    if (cloudData.notebookSlot?.deckData) {
      const localNotebook = getNotebookSlotData();
      const cloudNotebookUpdated = cloudData.notebookSlot.deckData.updatedAt || cloudData.lastSyncedAt || 0;
      const localNotebookUpdated = localNotebook?.deckData?.updatedAt || 0;
      if (!localNotebook?.deckData || cloudNotebookUpdated >= localNotebookUpdated) {
        localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(cloudData.notebookSlot.deckData));
      }
    }

    // Load cloud stats
    if (cloudData.stats && typeof cloudData.stats === 'object' && Object.keys(cloudData.stats).length > 0) {
      try {
        const localStatsRaw = localStorage.getItem('flashcardsStats');
        const localStats = localStatsRaw ? JSON.parse(localStatsRaw) : null;
        if (!localStats || (cloudData.lastSyncedAt && cloudData.lastSyncedAt >= (localStats.updatedAt || 0))) {
          localStorage.setItem('flashcardsStats', JSON.stringify(cloudData.stats));
        }
      } catch (e) {}
    }

    return hasSlotChanges;
  } catch (e) {
    console.warn('Erro ao carregar slots da nuvem:', e);
    return false;
  }
}
