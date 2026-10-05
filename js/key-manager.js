/**
 * key-manager.js
 * Gerenciador de persistência segura para a Google Gemini API Key.
 * Implementa a Abordagem 3: Web Cryptography API com CryptoKey não-exportável no IndexedDB.
 *
 * Características de Segurança:
 * - Chave AES-GCM (256 bits) gerada com `extractable: false` (o JavaScript não pode exportar a chave crua).
 * - A CryptoKey é preservada de forma isolada no IndexedDB do navegador.
 * - O segredo é cifrado com AES-GCM usando IV criptográfico de 12 bytes.
 * - Quando "Lembrar chave" estiver desmarcado, armazena estritamente na memória volátil/sessionStorage.
 * - Elimina resíduos antigos em texto puro do localStorage.
 */

const DB_NAME = 'flashcards_vault';
const DB_VERSION = 1;
const STORE_NAME = 'crypto_keys';
const KEY_RECORD_ID = 'gemini_non_exportable_key';

const STORAGE_SESSION_KEY = 'gemini_api_key';
const STORAGE_CIPHER_KEY = 'flashcards_persistent_key';
const STORAGE_REMEMBER_FLAG = 'flashcards_remember_key';
const STORAGE_LEGACY_KEYS = ['gemini_api_key_checker', 'gemini_api_key'];

// Cache em memória para evitar decifrações repetidas na mesma sessão
let inMemoryKey = '';

// Utilitários de codificação Base64
function bytesToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Abertura do cofre IndexedDB
function openVaultDb() {
    return new Promise((resolve, reject) => {
        const idb = typeof window !== 'undefined' ? (window.indexedDB || globalThis.indexedDB) : globalThis.indexedDB;
        if (!idb) {
            return reject(new Error('IndexedDB não suportado neste navegador.'));
        }
        const request = idb.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Grava a CryptoKey não-exportável no IndexedDB
async function storeCryptoKey(cryptoKey) {
    const db = await openVaultDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(cryptoKey, KEY_RECORD_ID);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
    });
}

// Recupera a CryptoKey do IndexedDB
async function retrieveCryptoKey() {
    const db = await openVaultDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(KEY_RECORD_ID);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
    });
}

// Remove a CryptoKey do IndexedDB
async function removeCryptoKey() {
    try {
        const db = await openVaultDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.delete(KEY_RECORD_ID);
            tx.oncomplete = () => {
                db.close();
                resolve(true);
            };
            tx.onerror = () => {
                db.close();
                resolve(false);
            };
        });
    } catch {
        return false;
    }
}

/**
 * Retorna a chave se já estiver carregada na sessão atual (síncrono).
 * Ideal para verificações imediatas no ciclo de vida de renderização.
 */
export function getCachedApiKey() {
    if (inMemoryKey) return inMemoryKey;
    try {
        const sessionKey = sessionStorage.getItem(STORAGE_SESSION_KEY);
        if (sessionKey) {
            inMemoryKey = sessionKey.trim();
            return inMemoryKey;
        }
    } catch (e) {
        // Modo estrito / cookies bloqueados
    }
    return '';
}

/**
 * Verifica se a opção "Lembrar chave" está ativada no dispositivo.
 */
export function isKeyRemembered() {
    try {
        return localStorage.getItem(STORAGE_REMEMBER_FLAG) === 'true' &&
            Boolean(localStorage.getItem(STORAGE_CIPHER_KEY));
    } catch {
        return false;
    }
}

/**
 * Obtém a chave de API assincronamente:
 * 1. Verifica a memória / sessionStorage.
 * 2. Se não estiver na sessão, tenta decifrar a chave persistida no IndexedDB via Web Crypto API.
 * 3. Migra automaticamente eventuais chaves em texto puro legadas do localStorage.
 */
export async function getApiKeyAsync() {
    const cached = getCachedApiKey();
    if (cached) return cached;

    // 1. Tentar decifrar chave persistida (Abordagem 3)
    try {
        const isRemembered = localStorage.getItem(STORAGE_REMEMBER_FLAG) === 'true';
        const cipherPayload = localStorage.getItem(STORAGE_CIPHER_KEY);

        if (isRemembered && cipherPayload && window.crypto?.subtle) {
            const parsed = JSON.parse(cipherPayload);
            if (parsed.iv && parsed.ciphertext) {
                const cryptoKey = await retrieveCryptoKey();
                if (cryptoKey) {
                    const iv = base64ToBytes(parsed.iv);
                    const ciphertext = base64ToBytes(parsed.ciphertext);
                    const decryptedBuffer = await window.crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv },
                        cryptoKey,
                        ciphertext
                    );
                    const rawKey = new TextDecoder().decode(decryptedBuffer).trim();
                    if (rawKey) {
                        inMemoryKey = rawKey;
                        try {
                            sessionStorage.setItem(STORAGE_SESSION_KEY, rawKey);
                        } catch {}
                        return rawKey;
                    }
                }
            }
        }
    } catch (err) {
        console.warn('Não foi possível decifrar chave persistida:', err);
    }

    // 2. Fallback de migração suave: se houver chave em texto puro legada em localStorage
    try {
        for (const legacyKeyName of STORAGE_LEGACY_KEYS) {
            const legacyVal = localStorage.getItem(legacyKeyName);
            if (legacyVal && legacyVal.trim()) {
                const trimmed = legacyVal.trim();
                inMemoryKey = trimmed;
                try {
                    sessionStorage.setItem(STORAGE_SESSION_KEY, trimmed);
                } catch {}
                // Se a flag não for explicitamente 'false', migra criptografando
                if (localStorage.getItem(STORAGE_REMEMBER_FLAG) !== 'false') {
                    await saveApiKey(trimmed, true);
                } else {
                    localStorage.removeItem(legacyKeyName);
                }
                return trimmed;
            }
        }
    } catch (e) {
        console.warn('Erro ao verificar chave legada:', e);
    }

    return '';
}

/**
 * Salva a API Key:
 * @param {string} key - Chave do Gemini fornecida pelo usuário.
 * @param {boolean} remember - Se verdadeiro, cifra com AES-GCM (chave não-exportável) no IndexedDB.
 */
export async function saveApiKey(key, remember = false) {
    const cleanKey = (key || '').trim();

    if (!cleanKey) {
        await clearApiKey();
        return;
    }

    inMemoryKey = cleanKey;
    try {
        sessionStorage.setItem(STORAGE_SESSION_KEY, cleanKey);
    } catch {}

    // Limpa resíduos legados em texto puro
    try {
        STORAGE_LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
    } catch {}

    if (remember && window.crypto?.subtle) {
        try {
            // 1. Gera chave AES-GCM de 256 bits com extractable: false
            const cryptoKey = await window.crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                false, // NÃO EXPORTÁVEL via JavaScript
                ['encrypt', 'decrypt']
            );

            // 2. Salva a CryptoKey diretamente no IndexedDB
            await storeCryptoKey(cryptoKey);

            // 3. Cifra a API Key com IV aleatório de 12 bytes
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encodedSecret = new TextEncoder().encode(cleanKey);
            const cipherBuffer = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                cryptoKey,
                encodedSecret
            );

            // 4. Salva apenas o payload cifrado no localStorage
            const payload = {
                iv: bytesToBase64(iv),
                ciphertext: bytesToBase64(new Uint8Array(cipherBuffer)),
                updatedAt: Date.now()
            };

            localStorage.setItem(STORAGE_CIPHER_KEY, JSON.stringify(payload));
            localStorage.setItem(STORAGE_REMEMBER_FLAG, 'true');
        } catch (err) {
            console.error('Falha ao persistir chave cifrada no IndexedDB:', err);
            // Fallback seguro: mantém apenas no sessionStorage
            try {
                localStorage.removeItem(STORAGE_CIPHER_KEY);
                localStorage.setItem(STORAGE_REMEMBER_FLAG, 'false');
            } catch {}
        }
    } else {
        // Não lembrar entre sessões: remove qualquer persistência cifrada anterior
        try {
            localStorage.removeItem(STORAGE_CIPHER_KEY);
            localStorage.setItem(STORAGE_REMEMBER_FLAG, 'false');
        } catch {}
        await removeCryptoKey();
    }
}

/**
 * Remove a API Key de todas as camadas (memória, sessionStorage, IndexedDB e localStorage).
 */
export async function clearApiKey() {
    inMemoryKey = '';
    try {
        sessionStorage.removeItem(STORAGE_SESSION_KEY);
    } catch {}
    try {
        localStorage.removeItem(STORAGE_CIPHER_KEY);
        localStorage.removeItem(STORAGE_REMEMBER_FLAG);
        STORAGE_LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
    } catch {}
    await removeCryptoKey();
}
