import { GoogleGenerativeAI } from '@google/generative-ai';

async function compressPDF(file) {
    const { jsPDF } = window.jspdf;
    const arrayBuffer = await file.arrayBuffer();
    // Configurar o worker do PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const outPdf = new jsPDF();

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 0.5; // Reduz a escala para 50%
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        // Converte para JPEG com 70% de qualidade
        const imgData = canvas.toDataURL('image/jpeg', 0.7);

        if (i > 1) outPdf.addPage();

        // Ajusta a imagem ao tamanho da página do PDF
        const pdfWidth = outPdf.internal.pageSize.getWidth();
        const pdfHeight = outPdf.internal.pageSize.getHeight();
        outPdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    }

    return outPdf.output('blob');
}


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
const addCardBtn = document.getElementById('add-card-btn');

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

const systemInstruction = "Você é um assistente cirúrgico especializado em educação médica e editor de flashcards. Sua função é gerenciar um baralho de flashcards (Anki-style) para um estudante de medicina. Você pode adicionar, editar ou remover cards usando as ferramentas fornecidas. Mantenha o tom profissional, analítico e pragmático. Ao editar, busque clareza terminológica e precisão técnica. Você deve atuar como um agente, executando as ações solicitadas e confirmando-as de forma concisa.";


// Gemini Tools Definitions for Agentic Editing
const deckTools = [
    {
        functionDeclarations: [
            {
                name: "adicionar_card",
                description: "Adiciona um novo flashcard ao baralho.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        type: { type: "STRING", enum: ["open", "open_double", "multiple_choice"], description: "Tipo do card" },
                        description: { type: "STRING", description: "Pergunta ou descrição" },
                        answer: { type: "STRING", description: "Resposta principal" },
                        answer2: { type: "STRING", description: "Resposta secundária (apenas para open_double)" },
                        options: { type: "ARRAY", items: { type: "STRING" }, description: "Opções (apenas para multiple_choice)" }
                    },
                    required: ["type", "description", "answer"]
                }
            },
            {
                name: "editar_card",
                description: "Edita um flashcard existente pelo índice. Envie apenas os campos que deseja atualizar.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        index: { type: "NUMBER", description: "O índice (começando em 0) do card a ser editado." },
                        description: { type: "STRING" },
                        answer: { type: "STRING" },
                        answer2: { type: "STRING" },
                        options: { type: "ARRAY", items: { type: "STRING" } }
                    },
                    required: ["index"]
                }
            },
            {
                name: "remover_card",
                description: "Remove um único flashcard permanentemente do baralho.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        index: { type: "NUMBER", description: "Índice do card a ser removido." }
                    },
                    required: ["index"]
                }
            },
            {
                name: "remover_cards_por_indice",
                description: "Remove múltiplos flashcards de uma vez usando uma lista de índices. Use esta ferramenta quando o usuário pedir para deletar vários cards.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        indices: {
                            type: "ARRAY",
                            items: { type: "NUMBER" },
                            description: "Lista de índices dos cards a serem removidos."
                        }
                    },
                    required: ["indices"]
                }
            },

            {
                name: "adicionar_varios_cards",
                description: "Adiciona múltiplos cards de uma vez. Útil para geração em lote.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        cards: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    type: { type: "STRING", enum: ["open", "open_double", "multiple_choice"] },
                                    description: { type: "STRING" },
                                    answer: { type: "STRING" },
                                    answer2: { type: "STRING" },
                                    options: { type: "ARRAY", items: { type: "STRING" } }
                                },
                                required: ["type", "description", "answer"]
                            }
                        }
                    },
                    required: ["cards"]
                }
            }
        ]
    }
];

// Local implementations for Gemni to call
const toolFunctions = {
    adicionar_card: (args) => {
        deckCards.push(args);
        renderCardsList(true);
        return { success: true, message: "Card adicionado com sucesso." };
    },
    editar_card: (args) => {
        const { index, ...updates } = args;
        if (deckCards[index]) {
            deckCards[index] = { ...deckCards[index], ...updates };
            renderCardsList(true);
            return { success: true, message: `Card no índice ${index} foi editado.` };
        }
        return { success: false, message: `Erro: Card no índice ${index} não encontrado.` };
    },
    remover_card: (args) => {
        const { index } = args;
        if (deckCards[index]) {
            const removed = deckCards.splice(index, 1);
            renderCardsList(true);
            return { success: true, message: `Card "${removed[0].description.substring(0, 20)}..." removido.` };
        }
        return { success: false, message: `Erro: Card no índice ${index} não encontrado.` };
    },
    remover_cards_por_indice: (args) => {
        const { indices } = args;
        // IMPORTANTE: Ordenar decrescente para evitar o deslocamento dos índices ao dar splice
        const sortedIndices = [...new Set(indices)].sort((a, b) => b - a);
        let count = 0;
        sortedIndices.forEach(idx => {
            if (deckCards[idx]) {
                deckCards.splice(idx, 1);
                count++;
            }
        });
        renderCardsList(true);
        return { success: true, message: `${count} cards foram removidos com sucesso.` };
    },

    adicionar_varios_cards: (args) => {
        deckCards.push(...args.cards);
        renderCardsList(true);
        return { success: true, message: `${args.cards.length} cards adicionados ao deck.` };
    }
};


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
    const deckContainer = cardsList.parentNode;
    const deckHeader = cardsList.previousElementSibling;

    // Config specifically for Gemini 3 Reasoning - High depth for initial generation
    const generationConfig = {
        temperature: 1.0,
        responseMimeType: "application/json",
        thinkingConfig: {
            thinkingLevel: "high"
        }
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
        // gemini-3-flash-preview autochooses the latest flash model available and handles multimodal fine.
        model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            generationConfig,
            tools: deckTools,
            systemInstruction
        });

        currentGenModel = model;

        const basePrompt = `Com base nos arquivos enviados, gere uma lista extensa de flashcards médicos detalhados.
Sua resposta deve ser ESTRITAMENTE e APENAS o array JSON. 
PROIBIDO incluir títulos, explicações, preâmbulos ou qualquer texto fora do JSON.
O JSON deve ser uma lista ([]) contendo vários objetos de questão ({ }).

Formatos permitidos:
1. open: {"type": "open", "description": "Pergunta?", "answer": "Resposta"}
2. open_double: {"type": "open_double", "description": "Pergunta?", "answer": "Resposta1", "answer2": "Resposta2", "placeholder1": "Label1", "placeholder2":"Label2"}
3. multiple_choice: {"type": "multiple_choice", "description": "Pergunta?", "answer": "Certa", "options": ["A", "B", "Certa", "D"]}

Gere aproximadamente 100 flashcards.`;

        let extraPrompt = customPrompt.value.trim();
        let promptToSend = basePrompt;
        if (extraPrompt) {
            promptToSend += `\n\nInstruções Específicas Adicionais:\n${extraPrompt}`;
        }

        parts.push(promptToSend);
        const sourceParts = [promptToSend];

        for (let i = 0; i < filesUpload.files.length; i++) {
            let fileToProcess = filesUpload.files[i];

            // Se for PDF e for maior que 5MB, comprimimos
            if (fileToProcess.type === 'application/pdf' && fileToProcess.size > 5 * 1024 * 1024) {
                filesLoadingMsg.textContent = `⏳ Comprimindo ${fileToProcess.name}... (Isto pode levar um momento)`;
                try {
                    const compressedBlob = await compressPDF(fileToProcess);
                    fileToProcess = new File([compressedBlob], fileToProcess.name, {
                        type: 'application/pdf'
                    });
                } catch (err) {
                    console.error("Erro na compressão:", err);
                    // Se falhar, segue com o original
                }
            }

            const filePart = await fileToGenerativePart(fileToProcess);
            parts.push(filePart);
            sourceParts.push(filePart);
        }

        // Trigger title generation early using lite model and source material (exclude the tech prompt)
        generateDeckTitle(sourceParts.slice(1), genAI);

    } else if (sourceType === 'txt') {
        if (txtUpload.files.length === 0) {
            globalError.textContent = 'Por favor, selecione um arquivo .txt.';
            return;
        }
        generateTxtBtn.disabled = true;
        spinnerTxt.classList.remove('hidden');
        txtLoadingMsg.classList.remove('hidden');

        model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            generationConfig,
            tools: deckTools,
            systemInstruction
        });

        currentGenModel = model;

        const textContent = await readTextFile(txtUpload.files[0]);
        const linesCount = textContent.split('\n').filter(line => line.trim().length > 0).length;

        const prompt = `Esse documento está formatado no estilo: "ANSWER: Question" e tem ${linesCount} linhas, cada linha tem que ser um flashcard estilo open. A sua função é apenas adequar esse arquivo .txt no formato necessário .json baseado no estilo de formatação do exemplo, sem alterar NADA do conteúdo textual, transcreva literalmente como está no documento. Então no final deve ter ${linesCount} flashcards. 
As questões open e open_double tem o formato: 
1. open: {"type": "open", "description": "Pergunta?", "answer": "Resposta"} 
2. open_double: {"type": "open_double", "description": "Pergunta?", "answer": "Resposta1", "answer2": "Resposta2", "placeholder1": "Label1", "placeholder2":"Label2"}.
Retorne estritamente o array JSON.\n\nConteúdo:\n${textContent}`;
        parts.push(prompt);

        // Trigger title generation early using lite model and source material (exclude the tech prompt)
        generateDeckTitle([{text: textContent}], genAI);

    }

    try {
        // Transition to editor view early to show cards appearing
        dashboardView.classList.add('hidden');
        editorView.classList.remove('hidden');
        editorView.classList.add('flex');

        deckContainer.classList.add('generating-deck-bg');
        deckContainer.classList.remove('bg-white', 'dark:bg-gray-800');
        cardsList.classList.add('bg-transparent');

        deckCards = [];
        renderCardsList();
        deckTitleDisplay.textContent = "Gerando flashcards... (Isso pode levar alguns minutos)";

        const result = await model.generateContentStream(parts);
        let fullText = "";
        let processedIndex = 0;

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            fullText += chunkText;

            // Preamble stripping: find the first JSON-like start
            if (processedIndex === 0) {
                const startIdx = fullText.search(/[\{\[]/);
                if (startIdx !== -1) {
                    processedIndex = startIdx;
                } else {
                    // Still no JSON found, skip processing this chunk for now
                    continue;
                }
            }

            let possibleObjects = fullText.substring(processedIndex);

            // Regex to find complete JSON objects: {...}
            // We use a simplified regex that matches opening { and balanced closing }
            // Since we know the items are flat objects in this schema, this is relatively safe.
            const regex = /\{[^{}]*\}/g;
            let match;

            while ((match = regex.exec(possibleObjects)) !== null) {
                const objectStr = match[0];
                try {
                    const card = JSON.parse(objectStr);
                    // Basic validation to ensure it's a valid flashcard
                    if (card.type && card.description && (card.answer || card.answer2 || card.options)) {
                        deckCards.push(card);
                        renderCardsList();
                    }
                    processedIndex += match.index + objectStr.length;
                    // Reset regex lastIndex because we modified the string we are searching or the index
                    possibleObjects = fullText.substring(processedIndex);
                    regex.lastIndex = 0;
                } catch (e) {
                    // Not a full object yet or invalid JSON, skip and wait for more data
                }
            }
        }

        // Final attempt to parse using a robust regex extractor if stream parsing missed items
        if (deckCards.length === 0) {
            try {
                // Find anything between [ and ] or first { and last }
                const arrayMatch = fullText.match(/\[\s*\{[\s\S]*\}\s*\]/);
                const textResult = arrayMatch ? arrayMatch[0] : fullText.substring(fullText.search(/[\{\[]/));
                
                // Clean markdown blocks
                const cleaned = textResult.replace(/^```json\n/g, '').replace(/^```\n/g, '').replace(/```$/g, '').trim();
                deckCards = JSON.parse(cleaned);
                renderCardsList(true);
            } catch (e) {
                console.error("Erro ao processar JSON final:", e);
            }
        }

        if (deckCards.length > 0 && (deckTitleDisplay.textContent === "Gerando flashcards..." || deckTitleDisplay.textContent === "Gerando título...")) {
            // Title should already be generating or done
        }

        deckContainer.classList.remove('generating-deck-bg');
        deckContainer.classList.add('bg-white', 'dark:bg-gray-800');
        cardsList.classList.remove('bg-transparent');

        // Start chat session with Agent context and separate generation config (no JSON constraint)
        const chatGenerationConfig = {
            temperature: 1.0,
            thinkingConfig: {
                thinkingLevel: "low"
            }
        };

        geminiChatSession = model.startChat({
            history: [],
            generationConfig: chatGenerationConfig
        });

    } catch (error) {
        console.error(error);
        if (error.message.includes("API key")) {
            globalError.textContent = `Acesso negado: Reveja sua chave de API Gemini. (Detalhe: ${error.message})`;
        } else {
            globalError.textContent = `Erro ao gerar flashcards: ${error.message}. Talvez o arquivo seja muito grande.`;
        }
        // Go back to dashboard if error occurred early
        if (deckCards.length === 0) {
            dashboardView.classList.remove('hidden');
            editorView.classList.add('hidden');
            editorView.classList.remove('flex');
        }
        deckContainer.classList.remove('generating-deck-bg');
        deckContainer.classList.add('bg-white', 'dark:bg-gray-800');
        cardsList.classList.remove('bg-transparent');
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

async function generateDeckTitle(sourceParts, genAI) {
    if (!sourceParts || !genAI) return;

    deckTitleDisplay.textContent = "Gerando título...";

    try {
        // Use Flash Lite for the title - it's fast and efficient for summaries
        const liteModel = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });


        const titlePrompt = "Com base no material fornecido, sugira um título curto, criativo e profissional para este baralho de flashcards (máximo de 4 palavras). Retorne APENAS o título, sem aspas ou pontuação extra.";

        // Prepare parts for the lite model (exclude the original basePrompt to save context, just focus on content)
        // Actually, let's just send the whole source material provided.
        const titleParts = [titlePrompt, ...sourceParts.filter(p => !p.text || !p.text.includes("JSON"))];

        const result = await liteModel.generateContent(titleParts);
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
function renderCardsList(fullReRender = false) {
    deckSizeBadge.textContent = deckCards.length;

    if (fullReRender) {
        cardsList.innerHTML = '';
    }

    const currentRenderedCount = cardsList.children.length;

    for (let i = currentRenderedCount; i < deckCards.length; i++) {
        const cardEl = createCardElement(deckCards[i], i);
        cardsList.appendChild(cardEl);
    }
}

function createCardElement(card, index) {
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
            renderCardsList(true); // Full re-render on delete to update indices
        }
    };

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(delBtn);
    cardEl.appendChild(actionsDiv);

    return cardEl;
}

// Manual Add Card Handler
addCardBtn.addEventListener('click', () => {
    openEditModal(-1);
});

// Edit Modal Handlers
function openEditModal(index) {
    if (index === -1) {
        // New Card
        editCardIndex.value = -1;
        editCardDesc.value = '';
        editCardAns1.value = '';
        editCardAns2Group.classList.add('hidden');
        editCardAns2.value = '';
    } else {
        // Edit Existing Card
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
    const newCardData = {
        description: editCardDesc.value,
        answer: editCardAns1.value
    };

    if (i === -1) {
        // Add new card (default to 'open' type for manual addition)
        newCardData.type = 'open';
        deckCards.push(newCardData);
    } else {
        // Update existing card
        deckCards[i].description = newCardData.description;
        deckCards[i].answer = newCardData.answer;
        if (deckCards[i].type === 'open_double') {
            deckCards[i].answer2 = editCardAns2.value;
        }
    }

    renderCardsList(true); // Full re-render
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
        // Enviar o contexto atualizado dos cards para o modelo não se perder
        const contextLines = deckCards.map((c, i) => `[${i}] ${c.description.substring(0, 70)}...`).join('\n');
        const enrichedPrompt = `ATENÇÃO: O estado atual do baralho é este:\n${contextLines}\n\nComando do Usuário: ${text}`;

        // Simple message to the agent
        let result = await geminiChatSession.sendMessage(enrichedPrompt);
        let response = result.response;

        // Agent loop (handle tool calls)
        for (let i = 0; i < 5; i++) {
            const candidate = response.candidates[0];
            const calls = candidate.content.parts.filter(p => !!p.functionCall);
            if (calls.length === 0) break;

            const functionResponses = calls.map(call => {
                const { name, args } = call.functionCall;
                const output = toolFunctions[name] ? toolFunctions[name](args) : { error: "Função não encontrada" };
                return {
                    functionResponse: {
                        name,
                        response: output
                    }
                };
            });

            // Send tool outputs back
            result = await geminiChatSession.sendMessage(functionResponses);
            response = result.response;
        }

        const modelText = response.text();
        addChatMessage('model', modelText || 'Ação realizada.');

    } catch (e) {
        console.error(e);
        addChatMessage('model', `Houve um erro no processador: ${e.message}`);
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
