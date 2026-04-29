/**
 * Session Transfer Logic (Bitset QR Optimization)
 * Uses a string of 1s and 0s to represent the deck state.
 * This makes the QR code extremely simple and easy to scan.
 */

// --- ELEMENTS ---
const transferModal = document.getElementById('transfer-modal');
const transferModalContent = document.getElementById('transfer-modal-content');
const transferBtn = document.getElementById('transfer-session-btn');
const closeTransferBtn = document.getElementById('close-transfer-modal');
const receiveBtn = document.getElementById('receive-session-btn');
const scannerModal = document.getElementById('scanner-modal');
const closeScannerBtn = document.getElementById('close-scanner-modal');
const qrCanvas = document.getElementById('transfer-qrcode');
const transferStatus = document.getElementById('transfer-status');
const forceSyncBtn = document.getElementById('force-sync-btn');
const transferHostInput = document.getElementById('transfer-host-input');
const updateQrBtn = document.getElementById('update-qr-btn');
const syncOverlay = document.getElementById('sync-overlay');
const syncDebugLog = document.getElementById('sync-debug-log');

let html5QrCode = null;

function logSync(msg) {
    if (syncDebugLog) {
        syncDebugLog.innerHTML += `<br>> ${msg}`;
        syncDebugLog.scrollTop = syncDebugLog.scrollHeight;
    }
    console.log("[SyncLog] " + msg);
}

// --- STATE ---
let currentCompressedState = null;

/**
 * Initializes the transfer logic.
 */
export function initTransfer() {
    const urlParams = new URLSearchParams(window.location.search);
    const progressState = urlParams.get('prog');
    if (progressState) {
        applyProgress(progressState);
    }

    transferBtn?.addEventListener('click', openTransferModal);
    closeTransferBtn?.addEventListener('click', closeTransferModal);
    updateQrBtn?.addEventListener('click', () => {
        if (currentCompressedState) generateQR(currentCompressedState);
    });
    
    if (forceSyncBtn) {
        forceSyncBtn.textContent = "Atualizar Progresso";
        forceSyncBtn.onclick = startSender;
    }

    receiveBtn?.addEventListener('click', openScanner);
    closeScannerBtn?.addEventListener('click', closeScanner);
}

// --- SENDER LOGIC ---

function openTransferModal() {
    transferModal.classList.remove('hidden');
    setTimeout(() => {
        transferModalContent.classList.remove('scale-95', 'opacity-0');
        transferModalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
    startSender();
}

function closeTransferModal() {
    transferModalContent.classList.remove('scale-100', 'opacity-100');
    transferModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => transferModal.classList.add('hidden'), 300);
}

/**
 * SENDER: Creates a Bitset (1s and 0s) of the deck state
 */
function startSender() {
    transferStatus.textContent = "Otimizando QR...";
    const rawData = localStorage.getItem('flashcardsSave');
    if (!rawData) return;

    try {
        const gameData = JSON.parse(rawData);
        
        // BITSET OPTIMIZATION:
        // We create a string where 1 means "card still in pool" and 0 means "card completed"
        let bitset = "";
        const poolSet = new Set(gameData.questionsPool.map(q => q.description));
        
        gameData.allQuestions.forEach(q => {
            bitset += poolSet.has(q.description) ? "1" : "0";
        });

        const progressOnly = { 
            s: gameData.score, 
            b: bitset, // This is much smaller than a list of indices
            t: gameData.deckTitle 
        };

        const jsonString = JSON.stringify(progressOnly);
        // Compressed Bitset is ultra-tiny
        currentCompressedState = LZString.compressToEncodedURIComponent(jsonString);
        
        console.log("Bitset Data Size:", jsonString.length, "Compressed:", currentCompressedState.length);

        transferStatus.textContent = "Pronto! Use o app de câmera.";
        transferStatus.classList.add('text-green-600');
        generateQR(currentCompressedState);
    } catch (err) {
        console.error(err);
    }
}

function generateQR(stateString) {
    const host = transferHostInput.value || window.location.host;
    const protocol = window.location.protocol;
    const path = window.location.pathname;
    const fullUrl = `${protocol}//${host}${path}?prog=${stateString}`;

    QRCode.toCanvas(qrCanvas, fullUrl, { 
        width: 256, // Slightly larger for better scanning
        margin: 2,
        errorCorrectionLevel: 'M' 
    });
}

// --- RECEIVER LOGIC (SCANNER) ---

async function openScanner() {
    // Check for Secure Context (HTTPS)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        alert("O acesso à câmera é bloqueado em conexões não-seguras (HTTP).\n\nUse o app de câmera nativo do seu celular ou acesse via HTTPS.");
        return;
    }

    scannerModal.classList.remove('hidden');
    html5QrCode = new Html5Qrcode("reader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    try {
        await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
    } catch (err) {
        alert("Erro ao iniciar câmera. Verifique as permissões.");
        closeScanner();
    }
}

async function closeScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
    }
    scannerModal.classList.add('hidden');
}

function onScanSuccess(decodedText) {
    try {
        const url = new URL(decodedText);
        const progressState = url.searchParams.get('prog');
        if (progressState) {
            closeScanner();
            applyProgress(progressState);
        }
    } catch (e) {
        console.error("QR Code inválido:", decodedText);
    }
}

function applyProgress(stateString) {
    syncOverlay.classList.remove('hidden');
    logSync("Lendo progresso otimizado...");

    try {
        const decompressed = LZString.decompressFromEncodedURIComponent(stateString);
        if (!decompressed) throw new Error("Dados inválidos.");

        const progress = JSON.parse(decompressed);
        const localDataRaw = localStorage.getItem('flashcardsSave');
        
        if (!localDataRaw) throw new Error("Abra o deck no celular primeiro!");

        const localData = JSON.parse(localDataRaw);
        
        logSync("Sincronizando Bitset...");
        localData.score = progress.s;
        
        // Rebuild pool using the bitset
        const bitset = progress.b;
        const newPool = [];
        for(let i=0; i < localData.allQuestions.length; i++) {
            if (bitset[i] === "1") {
                newPool.push(localData.allQuestions[i]);
            }
        }
        localData.questionsPool = newPool;

        localStorage.setItem('flashcardsSave', JSON.stringify(localData));
        
        logSync("Sincronizado! Reiniciando...");
        setTimeout(() => {
            window.location.href = window.location.origin + window.location.pathname;
        }, 1000);
    } catch (err) {
        alert(err.message);
        window.location.search = '';
    }
}
