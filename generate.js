import { GoogleGenerativeAI } from '@google/generative-ai';

// Elements
const apiKeyInput = document.getElementById('api-key-input');
const filesUpload = document.getElementById('files-upload');
const filesCount = document.getElementById('files-count');
const filesIconsContainer = document.getElementById('files-icons-container');
const filesUploadText = document.getElementById('files-upload-text');
const customPrompt = document.getElementById('custom-prompt');
const generateFilesBtn = document.getElementById('generate-files-btn');
const spinnerFiles = document.getElementById('spinner-files');
const filesLoadingMsg = document.getElementById('files-loading-msg');

const txtUpload = document.getElementById('txt-upload');
const txtCount = document.getElementById('txt-count');
const txtIconsContainer = document.getElementById('txt-icons-container');
const txtUploadText = document.getElementById('txt-upload-text');
const generateTxtBtn = document.getElementById('generate-txt-btn');
const spinnerTxt = document.getElementById('spinner-txt');
const txtLoadingMsg = document.getElementById('txt-loading-msg');

const globalError = document.getElementById('global-error');

const dashboardView = document.getElementById('dashboard-view');
const editorView = document.getElementById('editor-view');

const cardsList = document.getElementById('cards-list');
const deckSizeBadge = document.getElementById('deck-size-badge');
const deckTitleDisplay = document.getElementById('deck-title-display');
const downloadDeckBtn = document.getElementById('download-deck-btn');
const playDeckBtn = document.getElementById('play-deck-btn');

const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatSpinner = document.getElementById('chat-spinner');

// Edit Modal
const editModal = document.getElementById('inline-edit-modal');
const closeEditBtn = document.getElementById('close-inline-edit-btn');
const cancelEditBtn = document.getElementById('cancel-inline-edit-btn');
const saveEditBtn = document.getElementById('save-inline-edit-btn');
const editCardIndex = document.getElementById('edit-card-index');
const editCardDesc = document.getElementById('edit-card-desc');
const editCardAns1 = document.getElementById('edit-card-ans1');
const editCardAns2 = document.getElementById('edit-card-ans2');
const editCardAns2Group = document.getElementById('edit-card-ans2-group');

// Instructions Modal
const instructionsModal = document.getElementById('instructions-modal');
const openInstructionsBtn = document.getElementById('open-instructions-btn');
const closeInstructionsBtn = document.getElementById('close-instructions-btn');
const instructionsReadyBtn = document.getElementById('instructions-ready-btn');

let deckCards = [];
let geminiChatSession = null;
let currentGenModel = null;

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const FILES_DEFAULT_SVG = '<svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>';
const TXT_DEFAULT_SVG = '<svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>';

function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
}

function renderFileIcons(files, container, defaultSvg) {
    container.innerHTML = '';
    if (files.length === 0) {
        container.innerHTML = defaultSvg;
        return;
    }

    Array.from(files).forEach(file => {
        const ext = getFileExtension(file.name) || '???';
        const icon = document.createElement('div');
        icon.className = 'squircle';
        icon.textContent = ext.substring(0, 4);
        icon.title = file.name;
        container.appendChild(icon);
    });
}

// File Upload UI Handlers
filesUpload.addEventListener('change', () => {
    globalError.textContent = '';
    const files = filesUpload.files;

    for (let file of files) {
        if (file.size > MAX_FILE_SIZE) {
            globalError.textContent = `O arquivo "${file.name}" excede o limite de 100MB e foi rejeitado.`;
            filesUpload.value = '';
            filesCount.textContent = 'Nenhum arquivo selecionado';
            renderFileIcons([], filesIconsContainer, FILES_DEFAULT_SVG);
            filesUploadText.classList.remove('hidden');
            return;
        }
    }

    if (files.length > 0) {
        filesCount.textContent = `${files.length} arquivo(s) selecionado(s)`;
        filesUploadText.classList.add('hidden');
    } else {
        filesCount.textContent = 'Nenhum arquivo selecionado';
        filesUploadText.classList.remove('hidden');
    }
    renderFileIcons(files, filesIconsContainer, FILES_DEFAULT_SVG);
});

txtUpload.addEventListener('change', () => {
    globalError.textContent = '';
    const files = txtUpload.files;

    if (files.length > 0) {
        const file = files[0];
        if (file.size > MAX_FILE_SIZE) {
            globalError.textContent = `O arquivo "${file.name}" excede o limite de 100MB e foi rejeitado.`;
            txtUpload.value = '';
            txtCount.textContent = 'Nenhum arquivo selecionado';
            renderFileIcons([], txtIconsContainer, TXT_DEFAULT_SVG);
            txtUploadText.classList.remove('hidden');
            return;
        }
        txtCount.textContent = file.name;
        txtUploadText.classList.add('hidden');
    } else {
        txtCount.textContent = 'Nenhum arquivo selecionado';
        txtUploadText.classList.remove('hidden');
    }
    renderFileIcons(files, txtIconsContainer, TXT_DEFAULT_SVG);
});

// Load saved key
const savedKey = localStorage.getItem('gemini_api_key');
if (savedKey) {
    apiKeyInput.value = savedKey;
}

apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('gemini_api_key', apiKeyInput.value.trim());
});

// Helper: Read file as Base64 for Gemini Parts
async function fileToGenerativePart(file) {
    const base64EncodedDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
}

// Helper: Read text file
async function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

// Generate Flashcards logic
async function generateFlashcards(sourceType) {
    globalError.textContent = '';
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        globalError.textContent = 'Por favor, insira uma chave de API do Gemini válida.';
        return;
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);

    // Config specifically for JSON output
    const generationConfig = {
        temperature: 0.2, // Low temp for more deterministic generation
        responseMimeType: "application/json",
    };

    let model;
    let parts = [];

    if (sourceType === 'files') {
        if (filesUpload.files.length === 0) {
            globalError.textContent = 'Por favor, selecione pelo menos um arquivo.';
            return;
        }
        generateFilesBtn.disabled = true;
        spinnerFiles.classList.remove('hidden');
        filesLoadingMsg.classList.remove('hidden');

        // Can use flash for speed or pro if many complex docs. Let's stick with flash to be faster/cheaper, or pro if PDF
        // gemini-flash-latest autochooses the latest flash model available and handles multimodal fine.
        model = genAI.getGenerativeModel({ model: "gemini-flash-latest", generationConfig });
        currentGenModel = model;

        const basePrompt = `Com base nos arquivos enviados, o objetivo é processar todo o conteúdo e gerar uma lista extensa de termos técnicos para revisão, incluindo nomes de moléculas, estruturas, etapas de processos e quaisquer conceitos com nomes específicos. Em seguida, usar das informações que classificou na primeira etapa para gerar um arquivo .json baseado em todo o conteúdo que juntou na primeira etapa. O nível de detalhe deve ser apropriado para um estudante de medicina. A sua resposta vai ser apenas o JSON com os flashcards, a primeira etapa serve apenas para você planejar os flashcards. Busque sempre fazer a pergunta como uma descrição e a(s) resposta(s) com o menor numero de palavras possíveis, preferencialmente o nome de um termo, conceito, molécula... Ao final revise se os flashcards criados realmente abordam por extenso tudo que foi enviado. Devem ser gerados aproximadamente 100 flashcards.
        
O arquivo .json deve ser uma lista (\[\]) contendo vários objetos de questão (\{ \}). Cada objeto precisa seguir um dos três formatos: 'open', 'open_double', 'multiple_choice' conforme a seguir:
1. open: {"type": "open", "description": "Pergunta?", "answer": "Resposta"}
2. open_double: {"type": "open_double", "description": "Pergunta?", "answer": "Resposta1", "answer2": "Resposta2", "placeholder1": "Label1", "placeholder2":"Label2"}
3. multiple_choice: {"type": "multiple_choice", "description": "Pergunta?", "answer": "Certa", "options": ["A", "B", "Certa", "D"]}
(Retorne puramente o array JSON).`;

        let extraPrompt = customPrompt.value.trim();
        let promptToSend = basePrompt;
        if (extraPrompt) {
            promptToSend += `\n\nInstruções Específicas Adicionais:\n${extraPrompt}`;
        }

        parts.push(promptToSend);

        for (let i = 0; i < filesUpload.files.length; i++) {
            parts.push(await fileToGenerativePart(filesUpload.files[i]));
        }

    } else if (sourceType === 'txt') {
        if (txtUpload.files.length === 0) {
            globalError.textContent = 'Por favor, selecione um arquivo .txt.';
            return;
        }
        generateTxtBtn.disabled = true;
        spinnerTxt.classList.remove('hidden');
        txtLoadingMsg.classList.remove('hidden');

        model = genAI.getGenerativeModel({ model: "gemini-flash-latest", generationConfig });
        currentGenModel = model;

        const textContent = await readTextFile(txtUpload.files[0]);
        const linesCount = textContent.split('\n').filter(line => line.trim().length > 0).length;

        const prompt = `Esse documento está formatado no estilo: "ANSWER: Question" e tem ${linesCount} linhas, cada linha tem que ser um flashcard estilo open. A sua função é apenas adequar esse arquivo .txt no formato necessário .json baseado no estilo de formatação do exemplo, sem alterar NADA do conteúdo textual, transcreva literalmente como está no documento. Então no final deve ter ${linesCount} flashcards. 
As questões open tem o formato: {"type": "open", "description": "Question", "answer": "ANSWER"}.
Retorne estritamente o array JSON.\n\nConteúdo:\n${textContent}`;
        parts.push(prompt);
    }

    try {
        const result = await model.generateContent(parts);
        const response = await result.response;
        let textResult = response.text();

        // Clean markdown blocks if present
        textResult = textResult.replace(/^```json\n/g, '').replace(/^```\n/g, '').replace(/```$/g, '');

        deckCards = JSON.parse(textResult);

        // Transition to editor view
        dashboardView.classList.add('hidden');
        editorView.classList.remove('hidden');
        editorView.classList.add('flex'); // Add flex back since it was disabled by hidden

        renderCardsList();
        generateDeckTitle(deckCards);

        // Start chat session with the context
        geminiChatSession = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "Gere os flashcards no JSON." }],
                },
                {
                    role: "model",
                    parts: [{ text: JSON.stringify(deckCards) }],
                }
            ],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json"
            }
        });

    } catch (error) {
        console.error(error);
        if (error.message.includes("API key")) {
            globalError.textContent = `Acesso negado: Reveja sua chave de API Gemini. (Detalhe: ${error.message})`;
        } else {
            globalError.textContent = `Erro ao gerar flashcards: ${error.message}. Talvez o arquivo seja muito grande.`;
        }
    } finally {
        generateFilesBtn.disabled = false;
        spinnerFiles.classList.add('hidden');
        filesLoadingMsg.classList.add('hidden');
        generateTxtBtn.disabled = false;
        spinnerTxt.classList.add('hidden');
        txtLoadingMsg.classList.add('hidden');
    }
}

generateFilesBtn.addEventListener('click', () => generateFlashcards('files'));
generateTxtBtn.addEventListener('click', () => generateFlashcards('txt'));

async function generateDeckTitle(cards) {
    if (!cards || cards.length === 0 || !currentGenModel) return;
    
    deckTitleDisplay.textContent = "Gerando título...";
    
    try {
        const sample = cards.slice(0, 5).map(c => c.description).join("\n");
        const prompt = `Com base nestas questões de flashcards, sugira um título curto e profissional para o baralho (máximo de 4 palavras). Retorne APENAS o título, sem aspas ou pontuação extra.\n\nQuestões:\n${sample}`;
        
        const result = await currentGenModel.generateContent(prompt);
        const response = await result.response;
        const title = response.text().trim().replace(/["']/g, '');
        
        if (title) {
            deckTitleDisplay.textContent = title;
        } else {
            deckTitleDisplay.textContent = "Meu Baralho";
        }
    } catch (e) {
        console.error("Erro ao gerar título:", e);
        deckTitleDisplay.textContent = "Meu Baralho";
    }
}

// Render Cards List
function renderCardsList() {
    deckSizeBadge.textContent = deckCards.length;
    cardsList.innerHTML = '';

    deckCards.forEach((card, index) => {
        const cardEl = document.createElement('div');
        cardEl.className = "bg-white dark:bg-gray-750 border border-gray-200 dark:border-gray-700 p-4 rounded-xl relative group shadow-sm flex flex-col gap-2";

        const typeBadge = document.createElement('span');
        typeBadge.className = "absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 dark:bg-gray-600 dark:text-gray-300 px-2 py-1 rounded";
        typeBadge.textContent = card.type === 'open' ? 'Aberto' : (card.type === 'multiple_choice' ? 'Múltipla Escolha' : 'Duplo Aberto');
        cardEl.appendChild(typeBadge);

        const descStr = `<strong>P:</strong> <span class="text-gray-800 dark:text-gray-200">${card.description}</span>`;
        let ansStr = `<strong>R:</strong> <span class="text-green-600 dark:text-green-400">${card.answer}</span>`;
        if (card.type === 'open_double') {
            ansStr += `<br><strong>R2:</strong> <span class="text-green-600 dark:text-green-400">${card.answer2}</span>`;
        } else if (card.type === 'multiple_choice') {
            ansStr += `<br><span class="text-xs text-gray-500">Opções: ${card.options?.join(', ')}</span>`;
        }

        const textCont = document.createElement('div');
        textCont.innerHTML = `<p class="mb-1 text-sm mt-3">${descStr}</p><p class="text-sm">${ansStr}</p>`;
        cardEl.appendChild(textCont);

        // Actions (Edit, Delete)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = "absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity";

        const editBtn = document.createElement('button');
        editBtn.className = "p-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-300 rounded";
        editBtn.innerHTML = '✏️';
        editBtn.onclick = () => openEditModal(index);

        const delBtn = document.createElement('button');
        delBtn.className = "p-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-300 rounded";
        delBtn.innerHTML = '🗑️';
        delBtn.onclick = () => {
            if (confirm('Excluir este flashcard?')) {
                deckCards.splice(index, 1);
                renderCardsList();
            }
        };

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(delBtn);
        cardEl.appendChild(actionsDiv);

        cardsList.appendChild(cardEl);
    });
}

// Edit Modal Handlers
function openEditModal(index) {
    const card = deckCards[index];
    editCardIndex.value = index;
    editCardDesc.value = card.description;
    editCardAns1.value = card.answer;

    if (card.type === 'open_double') {
        editCardAns2Group.classList.remove('hidden');
        editCardAns2.value = card.answer2;
    } else {
        editCardAns2Group.classList.add('hidden');
    }

    editModal.classList.remove('hidden');
}

function closeEditModalFn() {
    editModal.classList.add('hidden');
}

closeEditBtn.addEventListener('click', closeEditModalFn);
cancelEditBtn.addEventListener('click', closeEditModalFn);

saveEditBtn.addEventListener('click', () => {
    const i = parseInt(editCardIndex.value);
    deckCards[i].description = editCardDesc.value;
    deckCards[i].answer = editCardAns1.value;
    if (deckCards[i].type === 'open_double') {
        deckCards[i].answer2 = editCardAns2.value;
    }
    renderCardsList();
    closeEditModalFn();
});

// Instructions Modal Handlers
openInstructionsBtn.addEventListener('click', () => {
    instructionsModal.classList.remove('hidden');
});

const closeInstructionsModalFn = () => {
    instructionsModal.classList.add('hidden');
};

closeInstructionsBtn.addEventListener('click', closeInstructionsModalFn);
instructionsReadyBtn.addEventListener('click', closeInstructionsModalFn);

// Close modals on overlay click
[editModal, instructionsModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
});

// Chat integration
function addChatMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = `py-2 px-4 rounded-xl max-w-[85%] text-sm ${role === 'user' ? 'self-end bg-blue-600 text-white rounded-tr-sm' : 'self-start bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'}`;
    msg.textContent = text;
    chatHistory.appendChild(msg);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

chatSendBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text || !geminiChatSession) return;

    chatInput.value = '';
    addChatMessage('user', text);

    chatInput.disabled = true;
    chatSendBtn.disabled = true;
    chatSpinner.classList.remove('hidden');

    try {
        // Remind it of the current deck state just in case
        const prompt = `Aqui está o deck atual:\n${JSON.stringify(deckCards)}\n\nO usuário pede o seguinte ajuste:\n"${text}"\n\nPor favor aplique o ajuste neste array JSON e retorne APENAS o novo array JSON inteiro preservando adequadamente a estrutura requisitada.`;
        const result = await geminiChatSession.sendMessage(prompt);
        let textResult = result.response.text();
        textResult = textResult.replace(/^```json\n/g, '').replace(/^```\n/g, '').replace(/```$/g, '');

        try {
            const newDeck = JSON.parse(textResult);
            if (Array.isArray(newDeck)) {
                deckCards = newDeck;
                renderCardsList();
                addChatMessage('model', 'Feito! Atualizei os flashcards ao lado com o seu ajuste.');
            } else {
                addChatMessage('model', 'O modelo não retornou uma lista válida. Tente novamente.');
            }
        } catch (parseEx) {
            console.error(parseEx);
            addChatMessage('model', 'Erro ao interpretar a nova lista de flashcards.');
        }

    } catch (e) {
        addChatMessage('model', `Houve um erro: ${e.message}`);
    } finally {
        chatInput.disabled = false;
        chatSendBtn.disabled = false;
        chatSpinner.classList.add('hidden');
    }
});

chatInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') chatSendBtn.click();
});

// Download Deck
downloadDeckBtn.addEventListener('click', () => {
    if (deckCards.length === 0) return;
    const jsonStr = JSON.stringify(deckCards, null, 4);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcards_gerados.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Play Now (Save to load & return)
playDeckBtn.addEventListener('click', () => {
    if (deckCards.length === 0) return;

    const gameState = {
        questionsPool: [...deckCards],
        allQuestions: [...deckCards],
        score: 0,
        deckTitle: deckTitleDisplay.textContent
    };
    localStorage.setItem('flashcardsSave', JSON.stringify(gameState));

    window.location.href = 'index.html';
});
