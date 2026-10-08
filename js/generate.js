import { GoogleGenerativeAI } from '@google/generative-ai';
import { callWithRetry, checkAndResetModelFallback, sanitizeChatHistory, renderMathAndMarkdown } from './utils.js';
import { getApiKeyAsync, getCachedApiKey, saveApiKey, clearApiKey, isKeyRemembered } from './key-manager.js';

function compressPDFWithWorker(file) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('../js/pdf-worker.js');
        worker.onmessage = (e) => {
            if (e.data.success) resolve(e.data.blob);
            else reject(new Error(e.data.error));
            worker.terminate();
        };
        worker.onerror = (err) => {
            reject(err);
            worker.terminate();
        };
        worker.postMessage({ file, fileName: file.name });
    });
}

// --- DOM ELEMENTS ---
const dashboardView = document.getElementById('dashboard-view');
const editorView = document.getElementById('editor-view');
const globalError = document.getElementById('global-error');

// Mode Selection Cards (Netflix Style)
const cardMode11 = document.getElementById('card-mode-1-1');
const cardMode12 = document.getElementById('card-mode-1-2');
const cardMode21 = document.getElementById('card-mode-2-1');
const cardMode22 = document.getElementById('card-mode-2-2');

// Quick API Key Modal & Button
const openApiKeyModalBtn = document.getElementById('open-api-key-modal-btn');
const quickApiModal = document.getElementById('quick-api-modal');
const quickApiForm = document.getElementById('quick-api-form');
const quickApiInput = document.getElementById('quick-api-input');
const quickApiRemember = document.getElementById('quick-api-remember');
const saveQuickApiBtn = document.getElementById('save-quick-api-btn');
const closeQuickApiBtn = document.getElementById('close-quick-api-btn');
const clearQuickApiBtn = document.getElementById('clear-quick-api-btn');
const dashboardKeyStatus = document.getElementById('dashboard-key-status');

// Modal 1.2 Elements (Convert Doc)
const modal12 = document.getElementById('modal-1-2');
const closeModal12Btn = document.getElementById('close-modal-1-2-btn');
const cancelModal12Btn = document.getElementById('cancel-modal-1-2-btn');
const submitModal12Btn = document.getElementById('submit-modal-1-2-btn');
const modal12File = document.getElementById('modal-1-2-file');
const modal12FileName = document.getElementById('modal-1-2-file-name');
const modal12Error = document.getElementById('modal-1-2-error');

// Modal 2.1 Elements (AI Materials)
const modal21 = document.getElementById('modal-2-1');
const closeModal21Btn = document.getElementById('close-modal-2-1-btn');
const cancelModal21Btn = document.getElementById('cancel-modal-2-1-btn');
const submitModal21Btn = document.getElementById('submit-modal-2-1-btn');
const modal21ApiKey = document.getElementById('modal-2-1-api-key');
const modal21Remember = document.getElementById('modal-2-1-remember');
const modal21Files = document.getElementById('modal-2-1-files');
const modal21FilesText = document.getElementById('modal-2-1-files-text');
const modal21FilesCount = document.getElementById('modal-2-1-files-count');
const modal21IconsContainer = document.getElementById('modal-2-1-icons-container');
const modal21Prompt = document.getElementById('modal-2-1-prompt');
const modal21Error = document.getElementById('modal-2-1-error');
const modal21LoadingMsg = document.getElementById('modal-2-1-loading-msg');
const modal21Spinner = document.getElementById('modal-2-1-spinner');

// Modal 2.2 Elements (AI Enhance Doc)
const modal22 = document.getElementById('modal-2-2');
const closeModal22Btn = document.getElementById('close-modal-2-2-btn');
const cancelModal22Btn = document.getElementById('cancel-modal-2-2-btn');
const submitModal22Btn = document.getElementById('submit-modal-2-2-btn');
const modal22ApiKey = document.getElementById('modal-2-2-api-key');
const modal22Remember = document.getElementById('modal-2-2-remember');
const modal22File = document.getElementById('modal-2-2-file');
const modal22FileName = document.getElementById('modal-2-2-file-name');
const modal22Error = document.getElementById('modal-2-2-error');
const modal22LoadingMsg = document.getElementById('modal-2-2-loading-msg');
const modal22Spinner = document.getElementById('modal-2-2-spinner');

// Instructions Modal
const instructionsModal = document.getElementById('instructions-modal');
const closeInstructionsBtn = document.getElementById('close-instructions-btn');
const instructionsReadyBtn = document.getElementById('instructions-ready-btn');

// Gemini Down Modal
const geminiDownModal = document.getElementById('gemini-down-modal');
const useTraditionalTxtBtn = document.getElementById('use-traditional-txt-btn');
const retryGeminiBtn = document.getElementById('retry-gemini-btn');
const closeGeminiDownModalBtn = document.getElementById('close-gemini-down-modal-btn');

// Editor Sidebar Tabs & Panels
const tabCreatorBtn = document.getElementById('tab-creator-btn');
const tabAiChatBtn = document.getElementById('tab-ai-chat-btn');
const cardCreatorPanel = document.getElementById('card-creator-panel');
const aiEditorChatPanel = document.getElementById('ai-editor-chat-panel');

// Card Creator UI Elements
const creatorCardType = document.getElementById('creator-card-type');
const creatorTypeHint = document.getElementById('creator-type-hint');
const creatorQuestionLabel = document.getElementById('creator-question-label');
const creatorQuestion = document.getElementById('creator-question');
const creatorQImgUrl = document.getElementById('creator-q-img-url');
const creatorQImgPreviewContainer = document.getElementById('creator-q-img-preview-container');
const creatorQImgPreview = document.getElementById('creator-q-img-preview');
const creatorRemoveQImg = document.getElementById('creator-remove-q-img');

const creatorGroupOpen = document.getElementById('creator-group-open');
const creatorAnsOpen = document.getElementById('creator-ans-open');

const creatorGroupOpenDouble = document.getElementById('creator-group-open-double');
const creatorAnsDouble1 = document.getElementById('creator-ans-double-1');
const creatorAnsDouble2 = document.getElementById('creator-ans-double-2');

const creatorGroupFill = document.getElementById('creator-group-fill');
const creatorAnsFill = document.getElementById('creator-ans-fill');

const creatorGroupAnki = document.getElementById('creator-group-anki');
const creatorAnsAnki = document.getElementById('creator-ans-anki');
const creatorAnsImgUrl = document.getElementById('creator-ans-img-url');
const creatorAnsImgPreviewContainer = document.getElementById('creator-ans-img-preview-container');
const creatorAnsImgPreview = document.getElementById('creator-ans-img-preview');
const creatorRemoveAnsImg = document.getElementById('creator-remove-ans-img');

const creatorGroupMc = document.getElementById('creator-group-mc');
const creatorMcOptionsList = document.getElementById('creator-mc-options-list');
const creatorAddMcOptBtn = document.getElementById('creator-add-mc-opt-btn');

const creatorFeedback = document.getElementById('creator-feedback');
const creatorSubmitCardBtn = document.getElementById('creator-submit-card-btn');

// AI Chat Elements
const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatSpinner = document.getElementById('chat-spinner');

// Deck Preview (Right Column)
const cardsList = document.getElementById('cards-list');
const deckSizeBadge = document.getElementById('deck-size-badge');
const deckTitleDisplay = document.getElementById('deck-title-display');
const downloadDeckBtn = document.getElementById('download-deck-btn');
const playDeckBtn = document.getElementById('play-deck-btn');
const addCardBtn = document.getElementById('add-card-btn');

// Inline Edit Modal
const inlineEditModal = document.getElementById('inline-edit-modal');
const closeInlineEditBtn = document.getElementById('close-inline-edit-btn');
const cancelInlineEditBtn = document.getElementById('cancel-inline-edit-btn');
const saveInlineEditBtn = document.getElementById('save-inline-edit-btn');
const editCardIndex = document.getElementById('edit-card-index');
const editCardType = document.getElementById('edit-card-type');
const editCardDesc = document.getElementById('edit-card-desc');
const editCardAns1 = document.getElementById('edit-card-ans1');
const editCardAns1Group = document.getElementById('edit-card-ans1-group');
const editCardAns1Label = document.getElementById('edit-card-ans1-label');
const editCardAns2Group = document.getElementById('edit-card-ans2-group');
const editCardAns2 = document.getElementById('edit-card-ans2');
const editCardFillGroup = document.getElementById('edit-card-fill-group');
const editCardFillAnswer = document.getElementById('edit-card-fill-answer');
const editCardAnkiGroup = document.getElementById('edit-card-anki-group');
const editCardAnkiAnswer = document.getElementById('edit-card-anki-answer');
const editCardMcGroup = document.getElementById('edit-card-mc-group');
const editCardMcList = document.getElementById('edit-card-mc-list');
const editCardAddMcOptBtn = document.getElementById('edit-card-add-mc-opt-btn');

const inlineEditImagePreviewContainer = document.getElementById('inline-edit-image-preview-container');
const inlineEditImagePreview = document.getElementById('inline-edit-image-preview');
const inlineEditRemoveImageBtn = document.getElementById('inline-edit-remove-image-btn');
const inlineEditImageUrl = document.getElementById('inline-edit-image-url');

const inlineEditAnsImageGroup = document.getElementById('inline-edit-ans-image-group');
const inlineEditAnsImagePreviewContainer = document.getElementById('inline-edit-ans-image-preview-container');
const inlineEditAnsImagePreview = document.getElementById('inline-edit-ans-image-preview');
const inlineEditRemoveAnsImageBtn = document.getElementById('inline-edit-remove-ans-image-btn');
const inlineEditAnsImageUrl = document.getElementById('inline-edit-ans-image-url');

// --- STATE ---
let deckCards = [];
let geminiChatSession = null;
let currentGenModel = null;
let currentEditorModel = localStorage.getItem('model_fallback_active') === 'true' ? "gemini-flash-lite-latest" : "gemini-flash-latest";

let pendingCreatorQImage = '';
let pendingCreatorAnsImage = '';
let pendingInlineEditQImage = '';
let pendingInlineEditAnsImage = '';

let lastFailedSourceType = null;
let lastFailedLocalCards = null;

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const FILES_DEFAULT_SVG = '<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>';

const systemInstruction = "Sua função é gerenciar um baralho de flashcards para um estudante universitário. Você pode adicionar, editar ou remover cards usando as ferramentas fornecidas. Tipos suportados: 'open' (conceito aberto), 'open_double' (dupla resposta), 'multiple_choice' (múltipla escolha com 2 a 6 opções), 'fill' (preencher lacunas marcadas por '_' em frases ou textos), e 'anki' (conceito/pergunta e explicação detalhada para repetição espaçada).\n\n" +
    "REGRAS MANDATÓRIAS DE RESPOSTA E FORMATAÇÃO:\n" +
    "1. PERGUNTAS E ENUNCIADOS ('description'): As perguntas de TODOS os tipos de cartões — inclusive cartões de resposta escrita ('open', 'open_double' e 'fill') — PODEM e DEVEM conter elementos Markdown ricos (**negrito**, *itálico*, listas, tabelas) e fórmulas LaTeX ($...$ e $$...$$) livremente para destacar termos essenciais e organizar o raciocínio.\n" +
    "2. RESPOSTAS DIGITADAS NA GAMEPLAY ('open', 'open_double' e lacunas de 'fill'): A ÚNICA coisa que NÃO pode conter Markdown é a resposta que o estudante precisa digitar na gameplay. Os campos 'answer', 'answer2' e itens do array 'answers' DEVEM ser estritamente TEXTO PURO (sem negrito **, sem itálico *, sem crases ` de código).\n" +
    "3. FÓRMULAS NUNCA DEVEM SER RESPOSTAS DIGITADAS: Fórmulas matemáticas, químicas ou expressões em LaTeX ($...$, $$...$$, frações, potências, etc.) JAMAIS devem ser respostas digitadas nos tipos 'open', 'open_double' ou 'fill'. O estudante digita com teclado comum e não pode digitar fórmulas complexas. Se o conteúdo for sobre uma fórmula ou equação, crie OBRIGATORIAMENTE um card do tipo 'anki' (frente com o conceito e verso com a fórmula em LaTeX) ou 'multiple_choice' (onde o estudante seleciona a alternativa).\n" +
    "4. LIBERDADE TOTAL DE MARKDOWN EM 'ANKI' E 'MULTIPLE_CHOICE': Os tipos 'anki' (frente e verso) e 'multiple_choice' (enunciado, opções e resposta) podem e devem usar Markdown rico (tabelas, listas, negrito) e fórmulas LaTeX ($...$ e $$...$$) livremente.\n" +
    "5. NO TIPO 'FILL': O enunciado ('description') pode conter Markdown e fórmulas LaTeX para contextualização, mas as lacunas '_' devem ser preenchidas apenas com termos simples, números ou parâmetros em texto puro, sem Markdown.\n" +
    "6. RESPOSTAS CONVERSACIONAIS NO CHAT DO AGENTE: Em suas mensagens de resposta ao usuário no chat do assistente, utilize sempre formatação Markdown estruturada e limpa (títulos curtos como ###, listas com marcadores -, destaques em **negrito**, códigos em `...` e tabelas ou fórmulas LaTeX quando aplicável). Mantenha as respostas concisas, bem diagramadas e visualmente organizadas para leitura rápida.\n" +
    "7. CLASSIFICAÇÃO TAXONÔMICA ('subject' e 'topic'): Ao adicionar novos cards ('adicionar_card' ou 'adicionar_varios_cards'), atribua sempre 'subject' (disciplina ampla de alto nível, ex: 'Cardiologia') e 'topic' (assunto específico conciso, ex: 'Valvopatias') para possibilitar estatísticas e métricas de desempenho detalhadas.\n\n" +
    "Mantenha o tom profissional, analítico e pragmático.";

const generationSystemInstruction = `Você é um especialista em educação e elaboração de flashcards acadêmicos de alto rendimento.
Sua missão é sintetizar materiais de estudo (artigos, livros, apresentações, apostilas ou anotações) em flashcards de nível universitário/pós-graduação com máxima precisão conceitual, adaptando-se com rigor e profundidade ao domínio temático abordado (ciências da saúde, biológicas, exatas, engenharia, direito, humanas ou tecnologia).

DIRETRIZES DE FORMATO E QUALIDADE:
1. Retorne EXCLUSIVAMENTE um array JSON ([]) contendo os objetos de flashcards.
2. PROIBIDO incluir texto explicativo, introduções ou notas fora do array JSON.
3. Linhas ou anotações iniciadas por "#" nos arquivos de texto/documentos são notas ou títulos e devem ser ignoradas como perguntas diretas.

CLASSIFICAÇÃO TAXONÔMICA OBRIGATÓRIA ("subject" e "topic"):
Para CADA flashcard gerado, atribua OBRIGATORIAMENTE os seguintes campos de metadados:
- "subject": Nome da matéria ou disciplina ampla de alto nível (ex: "Cardiologia", "Fisiologia Humana", "Bioquímica", "Direito Constitucional", "Cálculo"). Mantenha a mesma matéria para todos os cards provenientes do mesmo material/disciplina.
- "topic": Nome do assunto ou subtópico conciso e específico agrupador (ex: "Valvopatias", "Eletrocardiograma", "Ciclo de Krebs", "Controle de Constitucionalidade", "Limites e Derivadas"). Agrupe cards sobre o mesmo conceito sob o mesmo "topic" padronizado para permitir acompanhamento de maestria e fraquezas do estudante por assunto.

REGRAS MANDATÓRIAS DE RESPOSTA E FORMATAÇÃO:
• PERGUNTAS E ENUNCIADOS PODEM USAR MARKDOWN LIVREMENTE:
  - As perguntas e enunciados ("description") de TODOS os tipos de cartões — inclusive cartões de resposta escrita ("open", "open_double", "fill") — PODEM E DEVEM usar elementos Markdown (**negrito**, *itálico*, listas, tabelas) e fórmulas LaTeX ($...$ e $$...$$) livremente para destacar termos essenciais e organizar o raciocínio.
• PROIBIDO O USO DE MARKDOWN EM RESPOSTAS DIGITADAS NA GAMEPLAY:
  - A ÚNICA coisa que NÃO PODE conter Markdown é a resposta que o usuário precisa digitar na gameplay.
  - Nos cartões com resposta digitada ("open", "open_double" e as lacunas de "fill"), os campos "answer", "answer2" e cada item do array "answers" DEVEM CONTER EXCLUSIVAMENTE TEXTO PURO (plain text).
  - NUNCA use negrito (**texto**), itálico (*texto* ou _texto_), crases de código (\`texto\`), cabeçalhos (#) ou delimitadores matemáticos nesses campos de resposta digitada.
• FÓRMULAS NUNCA DEVEM SER RESPOSTAS DIGITADAS:
  - Fórmulas matemáticas, equações físicas, reações químicas ou expressões em LaTeX ($...$, $$...$$, frações \\frac, potências, etc.) JAMAIS devem ser a resposta a ser digitada pelo estudante nos tipos "open", "open_double" ou "fill". O estudante utiliza teclado comum e não dispõe de teclado LaTeX para digitar fórmulas.
  - Se o material exigir a memorização de uma fórmula matemática ou científica:
    * Crie OBRIGATORIAMENTE um cartão "anki" (frente com o questionamento/conceito e verso com a fórmula completa em LaTeX KaTeX e explicação detalhada) OU um cartão "multiple_choice" (onde as alternativas contêm as fórmulas para o estudante reconhecer e escolher).
    * NUNCA crie perguntas abertas ou lacunas cuja resposta digitada seja uma fórmula!
• LIBERDADE DE MARKDOWN E LATEX EM "ANKI" E "MULTIPLE_CHOICE":
  - Cartões "anki": Uso de Markdown rico (tabelas, listas com marcadores, negrito de destaque) e fórmulas matemáticas/científicas em LaTeX ($fórmula$ inline e $$fórmula$$ em bloco) é TOTALMENTE LIBERADO E INCENTIVADO na frente ("description") e no verso/explicação ("answer").
  - Cartões "multiple_choice": Uso de Markdown e fórmulas LaTeX ($...$) é TOTALMENTE LIBERADO na pergunta ("description"), nas opções ("options") e na resposta correta ("answer").
• NO TIPO "FILL":
  - O enunciado ("description") PODE usar tabelas, listas e fórmulas LaTeX para contextualizar o texto com as lacunas "_".
  - Porém, as lacunas omitidas e suas respectivas respostas em "answers" DEVEM ser termos simples, palavras-chave, dosagens ou números em texto puro digitável, NUNCA código LaTeX ou fórmulas.

DISTRIBUIÇÃO E REGRAS POR TIPO DE CARTÃO:
- "open":
  • Pergunta ("description"): Formulação clara, direta e objetiva de um conceito, termo, estrutura, lei, patologia ou princípio. Pode e deve conter formatação Markdown (**negrito**, *itálico*, listas, destaques) e fórmulas LaTeX ($...$).
  • Resposta ("answer"): Curta, telegráfica e precisa (idealmente de 1 a 3 palavras) em TEXTO PURO, SEM Markdown (sem **, *, \`) e SEM fórmulas.
- "open_double":
  • Pergunta ("description"): Questionamento comparativo ou que envolva dois conceitos interligados (ex: causa e efeito, agonista e antagonista, dois parâmetros ou limites). Pode e deve conter formatação Markdown e fórmulas LaTeX ($...$).
  • Respostas ("answer" e "answer2"): Duas respostas diretas em TEXTO PURO, SEM Markdown e SEM fórmulas.
  • Rótulos ("placeholder1" e "placeholder2"): Rótulos descritivos e concisos para cada campo de resposta.
- "fill":
  • Enunciado / Frase ("description"): Texto, tabela, lista estruturada ou frase contendo lacunas representadas por "_" (ou "___") nos locais exatos onde os valores numéricos, dosagens, parâmetros ou termos foram omitidos para o estudante preencher diretamente no texto. Pode conter formatação Markdown e LaTeX no enunciado para contextualizar.
  • Respostas ("answer" e "answers"): As respostas corretas em TEXTO PURO (sem Markdown, sem LaTeX e sem fórmulas), na ordem exata de aparição das lacunas no texto. Forneça como array "answers" (ex: ["30", "3", "300"]) e como string "answer" separada por ponto e vírgula ";" (ex: "30; 3; 300"). Quando houver sinônimos aceitáveis para uma mesma lacuna, separe por "/" (ex: "30 / trinta").
- "multiple_choice":
  • Enunciado ("description"): Questão bem contextualizada, cenário aplicado, problema técnico ou pergunta conceitual.
  • Resposta ("answer"): A alternativa correta exata. Pode conter Markdown e fórmulas LaTeX ($...$).
  • Opções ("options"): Array com 4 alternativas plausíveis (1 correta e 3 distratores inteligentes). A resposta correta DEVE estar contida obrigatoriamente neste array.
- "anki":
  • Frente ("description"): Conceito, processo, dedução ou pergunta sobre fórmula a ser compreendida e memorizada. Suporta Markdown e fórmulas LaTeX ($...$).
  • Verso ("answer"): Explicação aprofundada, completa e estruturada para repetição espaçada. Suporta e deve utilizar Markdown rico (tópicos com marcadores, negrito para termos-chave, tabelas comparativas) e fórmulas matemáticas/científicas em LaTeX/KaTeX ($fórmula$ inline ou $$fórmula$$ em bloco) quando pertinentes.

EXEMPLOS DE ESTRUTURA (FEW-SHOT):
[
  {
    "type": "open",
    "description": "Enzima mitocondrial que catalisa a descarboxilação oxidativa do piruvato em acetil-CoA.",
    "answer": "Complexo Piruvato Desidrogenase",
    "topic": "Ciclo de Krebs e Bioenergética",
    "subject": "Bioquímica"
  },
  {
    "type": "open_double",
    "description": "Quais são, respectivamente, o principal neurotransmissor inibitório no encéfalo e o principal na medula espinhal?",
    "answer": "GABA",
    "answer2": "Glicina",
    "placeholder1": "Encéfalo",
    "placeholder2": "Medula espinhal",
    "topic": "Neurotransmissão",
    "subject": "Neurofisiologia"
  },
  {
    "type": "fill",
    "description": "Quais são as faixas de categorização da albuminúria pela Relação Albumina/Creatinina (RAC) em amostra isolada de urina?\\n\\nEstadiamento da Albuminúria (KDIGO / SBD):\\n• A1 (Normoalbuminúria ou ligeiro aumento): RAC < _ mg/g (< _ mg/mmol)\\n• A2 (Microalbuminúria / Aumento moderado): RAC entre _ e _ mg/g (_ — _ mg/mmol)\\n• A3 (Macroalbuminúria / Aumento grave): RAC > _ mg/g (> _ mg/mmol)",
    "answer": "30; 3; 30; 300; 3; 30; 300; 30",
    "answers": ["30", "3", "30", "300", "3", "30", "300", "30"],
    "topic": "Nefropatias e Albuminúria",
    "subject": "Nefrologia"
  },
  {
    "type": "multiple_choice",
    "description": "Qual das seguintes alterações fisiológicas promove o desvio da curva de dissociação da oxi-hemoglobina para a direita (efeito Bohr)?",
    "answer": "Aumento da concentração de $H^+$ (acidose)",
    "options": [
      "Aumento da concentração de $H^+$ (acidose)",
      "Redução da temperatura corpórea",
      "Queda nos níveis intraeritrocitários de 2,3-DPG",
      "Alcalose respiratória aguda"
    ],
    "topic": "Transporte de Gases",
    "subject": "Fisiologia Respiratória"
  },
  {
    "type": "anki",
    "description": "Qual é a base biofísica do potencial de equilíbrio de um íon e sua respectiva formulação matemática?",
    "answer": "O potencial de equilíbrio é a diferença de potencial elétrico transmembrana que contrabalança com exatidão a tendência termodinâmica de difusão de um íon gerada por seu gradiente de concentração.\\n\\n### Equação de Nernst:\\n$$E_{ion} = \\\\frac{RT}{zF} \\\\ln\\\\left(\\\\frac{[ion]_{ext}}{[ion]_{int}}\\\\right)$$\\n\\n**Pontos essenciais:**\\n- Para o íon $K^+$ em temperatura corporal ($37^\\\\circ\\\\text{C}$): $E_K \\\\approx -90\\\\text{ mV}$.\\n- Determina a voltagem em que o fluxo iônico líquido resultante é zero.",
    "topic": "Potenciais de Membrana",
    "subject": "Biofísica Celular"
  }
]`;

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
                        type: { type: "STRING", enum: ["open", "open_double", "multiple_choice", "anki", "divisor", "fill"], description: "Tipo do card: 'open', 'open_double', 'multiple_choice', 'anki', 'divisor' ou 'fill' (preencher lacunas '_')" },
                        description: { type: "STRING", description: "Pergunta, conceito, texto do divisor ou frase com lacunas '_' (para tipo 'fill'). As perguntas de TODOS os tipos de cartões (incluindo 'open', 'open_double', 'fill', 'anki') podem e devem usar Markdown (**negrito**, *itálico*, listas) e fórmulas LaTeX ($...$ ou $$...$$)." },
                        answer: { type: "STRING", description: "Resposta principal, explicação detalhada ou respostas das lacunas separadas por ';' (tipo 'fill'). REGRA: Para respostas digitadas ('open', 'open_double', 'fill'), use estritamente texto puro SEM Markdown (sem **, *, `) e NUNCA use fórmulas matemáticas/LaTeX como resposta digitada. Fórmulas e Markdown rico são permitidos apenas para 'anki' e 'multiple_choice'." },
                        answer2: { type: "STRING", description: "Resposta secundária (apenas para open_double). Estritamente texto puro, sem Markdown e sem fórmulas." },
                        answers: { type: "ARRAY", items: { type: "STRING" }, description: "Lista ordenada de respostas para preencher as lacunas '_' no tipo 'fill'. Use estritamente texto puro sem Markdown e sem fórmulas." },
                        options: { type: "ARRAY", items: { type: "STRING" }, description: "Opções (apenas para multiple_choice). Suporta Markdown e fórmulas LaTeX." },
                        topic: { type: "STRING", description: "Assunto específico conciso agrupador do card (ex: 'Valvopatias', 'Eletrocardiograma', 'Controle Concentrado')." },
                        subject: { type: "STRING", description: "Matéria ou disciplina ampla à qual o card pertence (ex: 'Cardiologia', 'Direito Constitucional')." },
                        image: { type: "STRING", description: "URL ou Base64 da imagem da pergunta (opcional)" },
                        answerImage: { type: "STRING", description: "URL ou Base64 da imagem da resposta (opcional)" }
                    },
                    required: ["type", "description"]
                }
            },
            {
                name: "editar_card",
                description: "Edita um flashcard existente pelo índice.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        index: { type: "NUMBER", description: "O índice (começando em 0) do card a ser editado." },
                        type: { type: "STRING", enum: ["open", "open_double", "multiple_choice", "anki", "divisor", "fill"] },
                        description: { type: "STRING", description: "Pergunta, conceito, texto do divisor ou frase com lacunas '_' (para tipo 'fill'). Suporta e incentiva Markdown e fórmulas LaTeX para todos os tipos de card." },
                        answer: { type: "STRING", description: "Resposta, explicação detalhada ou respostas das lacunas separadas por ';' (tipo 'fill'). REGRA: Para respostas digitadas ('open', 'open_double', 'fill'), use estritamente texto puro SEM Markdown e SEM fórmulas." },
                        answer2: { type: "STRING", description: "Resposta secundária (apenas para open_double). Estritamente texto puro, sem Markdown e sem fórmulas." },
                        answers: { type: "ARRAY", items: { type: "STRING" }, description: "Lista ordenada de respostas das lacunas (tipo 'fill'). Use estritamente texto puro sem Markdown e sem fórmulas." },
                        options: { type: "ARRAY", items: { type: "STRING" } },
                        topic: { type: "STRING", description: "Assunto específico agrupador do card." },
                        subject: { type: "STRING", description: "Matéria ampla à qual o card pertence." },
                        image: { type: "STRING" },
                        answerImage: { type: "STRING" }
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
                description: "Remove múltiplos flashcards de uma vez usando uma lista de índices.",
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
                description: "Adiciona múltiplos cards de uma vez.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        cards: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    type: { type: "STRING", enum: ["open", "open_double", "multiple_choice", "anki", "divisor", "fill"] },
                                    description: { type: "STRING", description: "Pergunta, conceito, texto do divisor ou frase com lacunas '_' (tipo 'fill'). Suporta e incentiva Markdown e fórmulas LaTeX para todos os tipos de card." },
                                    answer: { type: "STRING", description: "Resposta principal, explicação detalhada ou respostas das lacunas separadas por ';' (tipo 'fill'). REGRA: Para respostas digitadas ('open', 'open_double', 'fill'), use estritamente texto puro SEM Markdown e SEM fórmulas." },
                                    answer2: { type: "STRING", description: "Resposta secundária (apenas para open_double). Estritamente texto puro, sem Markdown e sem fórmulas." },
                                    answers: { type: "ARRAY", items: { type: "STRING" }, description: "Lista ordenada de respostas das lacunas (tipo 'fill'). Use estritamente texto puro sem Markdown e sem fórmulas." },
                                    options: { type: "ARRAY", items: { type: "STRING" } },
                                    topic: { type: "STRING", description: "Assunto específico conciso agrupador do card (ex: 'Valvopatias', 'Eletrocardiograma')." },
                                    subject: { type: "STRING", description: "Matéria ou disciplina ampla à qual o card pertence (ex: 'Cardiologia', 'Direito Constitucional')." },
                                    image: { type: "STRING" },
                                    answerImage: { type: "STRING" }
                                },
                                required: ["type", "description"]
                            }
                        }
                    },
                    required: ["cards"]
                }
            }
        ]
    }
];

// Local implementations for Gemini to call
const toolFunctions = {
    adicionar_card: (args) => {
        const card = normalizeCard(args) || args;
        appendNewCardWithElasticCollision(card);
        return { success: true, message: "Card adicionado com sucesso." };
    },
    editar_card: (args) => {
        const { index, ...updates } = args;
        if (deckCards[index]) {
            const merged = { ...deckCards[index], ...updates };
            deckCards[index] = normalizeCard(merged) || merged;
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
        const cardsToAdd = (args.cards || []).map(c => normalizeCard(c) || c);
        cardsToAdd.forEach(card => appendNewCardWithElasticCollision(card));
        return { success: true, message: `${cardsToAdd.length} cards adicionados ao deck.` };
    }
};

// --- HELPER FUNCTIONS ---
function getApiKey() {
    return getCachedApiKey();
}

async function setApiKey(key, remember = false) {
    if (key) {
        await saveApiKey(key, remember);
    } else {
        await clearApiKey();
    }
    updateApiKeyStatusUI();
}

function updateApiKeyStatusUI() {
    const key = getApiKey();
    if (dashboardKeyStatus) {
        dashboardKeyStatus.textContent = key ? "API Key Configurada ✓" : "Configurar API Key";
        if (key) {
            dashboardKeyStatus.classList.add("text-green-600");
        } else {
            dashboardKeyStatus.classList.remove("text-green-600");
        }
    }
    if (quickApiInput) quickApiInput.value = key;
    if (modal21ApiKey) modal21ApiKey.value = key;
    if (modal22ApiKey) modal22ApiKey.value = key;
    const remembered = isKeyRemembered();
    if (quickApiRemember) quickApiRemember.checked = remembered;
    if (modal21Remember) modal21Remember.checked = remembered;
    if (modal22Remember) modal22Remember.checked = remembered;
}

function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
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

/**
 * Strips markdown and LaTeX markup from typed answers (open, open_double, fill).
 * Multiple choice options and Anki cards are intentionally exempted.
 */
function stripMarkdownFromTypedAnswer(str) {
    if (!str || typeof str !== 'string') return '';
    let s = str.trim();
    // Strip LaTeX block ($$formula$$) and inline ($formula$)
    s = s.replace(/\$\$([^$]+)\$\$/g, '$1');
    s = s.replace(/\$([^$]+)\$/g, '$1');
    // Strip bold and italics: **text**, *text*, __text__
    s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
    s = s.replace(/\*([^*]+)\*/g, '$1');
    s = s.replace(/__([^_]+)__/g, '$1');
    // Strip code backticks `text`
    s = s.replace(/`([^`]+)`/g, '$1');
    // Strip markdown headers (#, ##, etc.)
    s = s.replace(/^#+\s*/gm, '');
    // Clean common LaTeX formatting wrappers like \text{...}, \mathrm{...}
    s = s.replace(/\\(?:text|mathrm|mathbf|mathit)\{([^}]+)\}/g, '$1');
    // Remove isolated backslashes from simple LaTeX commands
    s = s.replace(/\\([a-zA-Z]+)/g, '$1');
    return s.trim();
}

/**
 * Checks if a string contains a complex LaTeX or mathematical formula that cannot be typed.
 */
function containsComplexFormula(str) {
    if (!str || typeof str !== 'string') return false;
    // Detect typical LaTeX formula commands, block math, or equations with sub/superscript
    return /\\(?:frac|sqrt|int|sum|prod|partial|pm|times|div|alpha|beta|gamma|delta|theta|lambda|mu|sigma|omega|approx|leq|geq|infty|lim|sin|cos|tan|log|ln)\b|\$\$|\\begin\{|\b[a-zA-Z]\s*=\s*[^;,\n]{4,}/.test(str);
}

// Normalizes and validates card properties across all supported modes and aliases
function normalizeCard(raw) {
    if (!raw || typeof raw !== 'object') return null;

    let type = raw.type ? String(raw.type).toLowerCase().replace(/[-\s]/g, '_') : '';
    if (type === 'divisor' || type === 'divider' || type === 'note' || type === 'secao' || type === 'section') {
        const text = (raw.text || raw.description || raw.title || '').trim();
        if (!text) return null;
        return {
            type: 'divisor',
            text: text,
            description: text,
            answer: ''
        };
    }
    if (type === 'multiple_choice' || type === 'multipla_escolha' || type === 'mc') {
        type = 'multiple_choice';
    } else if (type === 'open_double' || type === 'duplo' || type === 'double') {
        type = 'open_double';
    } else if (type === 'fill' || type === 'fill_in_the_blank' || type === 'fill_blanks' || type === 'cloze' || type === 'preencher' || type === 'lacuna' || type === 'lacunas') {
        type = 'fill';
    } else if (type === 'anki' || type === 'anki_like') {
        type = 'anki';
    } else if (type === 'open' || type === 'open_ended' || type === 'traditional' || type === 'aberto') {
        type = 'open';
    } else {
        if (Array.isArray(raw.options) && raw.options.length >= 2) type = 'multiple_choice';
        else if (raw.answer2) type = 'open_double';
        else if (raw.answers && Array.isArray(raw.answers)) type = 'fill';
        else if (raw.description && /(?:\[\s*_{1,}\s*\]|(?<![a-zA-Z0-9\u00C0-\u017F])_{1,}(?![a-zA-Z0-9\u00C0-\u017F]))/.test(raw.description) && (raw.answer && raw.answer.includes(';'))) type = 'fill';
        else type = 'open';
    }

    const description = (raw.description || raw.question || raw.pergunta || raw.frente || raw.phrase || raw.text || '').trim();
    if (!description) return null;

    let answer = (raw.answer || raw.resposta || raw.verso || '').trim();
    let answer2 = (raw.answer2 || raw.resposta2 || '').trim();
    let options = Array.isArray(raw.options) ? raw.options.map(o => String(o).trim()).filter(Boolean) : (Array.isArray(raw.alternativas) ? raw.alternativas.map(o => String(o).trim()).filter(Boolean) : []);

    let answers = [];
    if (Array.isArray(raw.answers)) {
        answers = raw.answers.map(a => String(a).trim()).filter(Boolean);
    } else if (type === 'fill' && answer) {
        answers = answer.split(';').map(a => a.trim()).filter(Boolean);
    }
    if (type === 'fill' && !answer && answers.length > 0) {
        answer = answers.join('; ');
    }

    // If an 'open', 'open_double' or 'fill' card contains a complex formula as the answer, convert to 'anki'
    if ((type === 'open' || type === 'open_double') && (containsComplexFormula(answer) || containsComplexFormula(answer2))) {
        type = 'anki';
    } else if (type === 'fill' && answers.some(containsComplexFormula)) {
        type = 'anki';
    }

    // For typed answer cards ('open', 'open_double', 'fill'), strip any accidental markdown formatting
    if (type === 'open' || type === 'open_double' || type === 'fill') {
        answer = stripMarkdownFromTypedAnswer(answer);
        if (answer2) answer2 = stripMarkdownFromTypedAnswer(answer2);
        if (answers && answers.length > 0) {
            answers = answers.map(stripMarkdownFromTypedAnswer);
            answer = answers.join('; ');
        }
    }

    if (type === 'multiple_choice') {
        if (options.length < 2) return null;
        if (!answer) answer = options[0];
        else if (!options.includes(answer)) options.unshift(answer);
    } else if (type === 'open_double') {
        if (!answer && !answer2) return null;
    } else if (type === 'fill') {
        if (!answer && answers.length === 0) return null;
    } else {
        if (!answer && !raw.image && !raw.answerImage) return null;
    }

    const card = {
        type,
        description,
        answer
    };
    if (type === 'open_double') {
        card.answer2 = answer2;
        card.placeholder1 = raw.placeholder1 || "Resposta 1";
        card.placeholder2 = raw.placeholder2 || "Resposta 2";
    }
    if (type === 'fill') {
        card.answers = answers;
    }
    if (type === 'multiple_choice') {
        card.options = options;
    }
    if (raw.explanation) card.explanation = raw.explanation;
    if (raw.image) card.image = raw.image;
    if (raw.answerImage) card.answerImage = raw.answerImage;
    if (Array.isArray(raw.tags)) card.tags = raw.tags;

    // Pure system metadata (stats, categorization, subject/topic tracking)
    const topic = (raw.topic || raw.aiTopic || '').toString().trim();
    if (topic) {
        card.topic = topic;
        card.aiTopic = topic;
    }
    const subject = (raw.subject || raw.aiSubject || '').toString().trim();
    if (subject) {
        card.subject = subject;
        card.aiSubject = subject;
    }

    return card;
}

// Scans text for complete balanced JSON objects, respecting string quoting and escapes
function extractBalancedJsonObjects(text) {
    const results = [];
    if (!text) return results;

    let scanText = text;
    const wrapperMatch = text.match(/["'](?:cards|flashcards|questoes|perguntas|deck|items)["']\s*:\s*\[/i);
    if (wrapperMatch) {
        const arrStart = wrapperMatch.index + wrapperMatch[0].length;
        scanText = text.substring(arrStart);
    }

    let depth = 0;
    let inString = false;
    let escape = false;
    let start = -1;

    for (let i = 0; i < scanText.length; i++) {
        const c = scanText[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (c === '\\' && inString) {
            escape = true;
            continue;
        }
        if (c === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (c === '{') {
                if (depth === 0) {
                    start = i;
                }
                depth++;
            } else if (c === '}') {
                depth--;
                if (depth === 0 && start !== -1) {
                    const block = scanText.substring(start, i + 1);
                    try {
                        const parsed = JSON.parse(block);
                        if (parsed && typeof parsed === 'object') {
                            const arr = parsed.cards || parsed.flashcards || parsed.questoes || parsed.perguntas;
                            if (Array.isArray(arr)) {
                                for (const item of arr) {
                                    const n = normalizeCard(item);
                                    if (n) results.push(n);
                                }
                            } else {
                                const n = normalizeCard(parsed);
                                if (n) results.push(n);
                            }
                        }
                    } catch (_) {}
                    start = -1;
                } else if (depth < 0) {
                    depth = 0;
                    start = -1;
                }
            }
        }
    }
    return results;
}

// Safe multi-stage JSON parser with truncation repair that never throws unhandled syntax errors
function parseJsonCardsSafely(fullText) {
    if (!fullText || !fullText.trim()) return [];

    let clean = fullText.trim();
    // Strip markdown code fences
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // Strategy 1: Direct JSON parse
    try {
        const direct = JSON.parse(clean);
        if (Array.isArray(direct)) {
            const cards = direct.map(normalizeCard).filter(Boolean);
            if (cards.length > 0) return cards;
        }
        if (direct && typeof direct === 'object') {
            const arr = direct.cards || direct.flashcards || direct.questoes || direct.perguntas || direct.items;
            if (Array.isArray(arr)) {
                const cards = arr.map(normalizeCard).filter(Boolean);
                if (cards.length > 0) return cards;
            }
            const single = normalizeCard(direct);
            if (single) return [single];
        }
    } catch (_) {}

    // Strategy 2: Array substring parse
    const firstBracket = clean.indexOf('[');
    if (firstBracket !== -1) {
        const sub = clean.substring(firstBracket);
        const lastBracket = sub.lastIndexOf(']');
        if (lastBracket !== -1) {
            try {
                const arr = JSON.parse(sub.substring(0, lastBracket + 1));
                if (Array.isArray(arr)) {
                    const cards = arr.map(normalizeCard).filter(Boolean);
                    if (cards.length > 0) return cards;
                }
            } catch (_) {}
        }
        // Strategy 3: Truncation recovery - find last complete '}' and close with ']'
        const lastBrace = sub.lastIndexOf('}');
        if (lastBrace !== -1) {
            try {
                const repaired = sub.substring(0, lastBrace + 1) + ']';
                const arr = JSON.parse(repaired);
                if (Array.isArray(arr)) {
                    const cards = arr.map(normalizeCard).filter(Boolean);
                    if (cards.length > 0) return cards;
                }
            } catch (_) {}
        }
    }

    // Strategy 4: Balanced objects extraction
    const extracted = extractBalancedJsonObjects(clean);
    if (extracted.length > 0) return extracted;

    return [];
}

function updateGeneratingStatus(message) {
    const statusText = document.getElementById('generation-status-text');
    if (statusText) statusText.textContent = message;
}

function addAiChatGeneratingBubble(text) {
    removeAiChatGeneratingBubble();
    const bubble = document.createElement('div');
    bubble.id = 'ai-chat-generating-bubble';
    bubble.className = "self-start bg-gradient-to-b from-purple-50/90 to-purple-100/60 border border-purple-200/80 p-3.5 rounded-2xl rounded-tl-sm text-xs text-purple-900 flex items-center gap-3 shadow-[0_2px_8px_rgba(109,40,217,0.05),inset_0_1px_0_rgba(255,255,255,0.8)]";
    bubble.innerHTML = `
        <div class="relative flex-shrink-0 w-2.5 h-2.5 flex items-center justify-center">
            <span class="relative inline-flex rounded-full h-2 w-2 bg-purple-600 animate-pulse shadow-[0_0_6px_rgba(147,51,234,0.5)]"></span>
        </div>
        <span class="font-medium">${text}</span>
    `;
    chatHistory.appendChild(bubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function removeAiChatGeneratingBubble() {
    const bubble = document.getElementById('ai-chat-generating-bubble');
    if (bubble) bubble.remove();
}

function showChatTypingIndicator() {
    hideChatTypingIndicator();
    const indicator = document.createElement('div');
    indicator.id = 'chat-typing-indicator';
    indicator.className = 'typing-indicator my-1';
    indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    chatHistory.appendChild(indicator);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function hideChatTypingIndicator() {
    const indicator = document.getElementById('chat-typing-indicator');
    if (indicator) indicator.remove();
}

async function fileToGenerativePart(file) {
    const base64EncodedDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });
    const ext = getFileExtension(file.name);
    let mime = file.type;
    if (!mime || mime === 'application/octet-stream') {
        const mimeMap = {
            'pdf': 'application/pdf',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'webp': 'image/webp',
            'gif': 'image/gif',
            'txt': 'text/plain'
        };
        mime = mimeMap[ext] || mime || 'application/octet-stream';
    }
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: mime },
    };
}

async function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

// Robust text extractor supporting .txt, .docx (with mammoth), and .doc
async function extractTextFromFile(file) {
    const ext = getFileExtension(file.name);
    if (ext === 'txt') {
        return await readTextFile(file);
    } else if (ext === 'docx') {
        if (typeof mammoth !== 'undefined') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value || '';
        } else {
            throw new Error("Biblioteca Mammoth não disponível para ler arquivo .docx.");
        }
    } else if (ext === 'doc') {
        try {
            if (typeof mammoth !== 'undefined') {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                if (result.value && result.value.trim().length > 0) return result.value;
            }
        } catch (e) {
            // Mammoth is for docx, doc may throw
        }
        // Binary .doc fallback: string extraction
        const arrayBuffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const raw = decoder.decode(arrayBuffer);
        const matches = raw.match(/[\x20-\x7E\xC0-\xFF\n\r]{4,}/g);
        return matches ? matches.join('\n') : raw;
    } else {
        return await readTextFile(file);
    }
}

// PPTX text extractor using JSZip
async function extractTextFromPPTX(file) {
    if (typeof JSZip !== 'undefined') {
        try {
            const zip = await JSZip.loadAsync(file);
            const slideTexts = [];
            const slidePaths = Object.keys(zip.files)
                .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
                .sort((a, b) => {
                    const numA = parseInt((a.match(/\d+/) || [0])[0]);
                    const numB = parseInt((b.match(/\d+/) || [0])[0]);
                    return numA - numB;
                });

            for (const path of slidePaths) {
                const xml = await zip.files[path].async('text');
                const matches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/g);
                if (matches) {
                    const slideStr = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
                    if (slideStr.trim()) slideTexts.push(slideStr.trim());
                }
            }
            if (slideTexts.length > 0) {
                return `Conteúdo do slide (${file.name}):\n` + slideTexts.join('\n---\n');
            }
        } catch (e) {
            console.warn("Erro ao extrair slides PPTX:", e);
        }
    }
    return null;
}

// --- DOCUMENT PARSING (TRADITIONAL & ANKI) ---
function convertDocumentToCards(text, mode = 'anki') {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const cards = [];

    for (let line of lines) {
        if (line.startsWith('#')) {
            const noteText = line.replace(/^#+\s*/, '').trim();
            if (noteText) {
                cards.push({
                    type: "divisor",
                    text: noteText,
                    description: noteText,
                    answer: ""
                });
            }
            continue;
        }

        const openDoubleMatch = line.match(/^[\(\[]\s*(?:open[_-]?double|duplo)\s*[\)\]]:?\s*(.*)$/i);
        const fillMatch = line.match(/^[\(\[]\s*(?:fill|preencher|lacunas?|cloze)\s*[\)\]]:?\s*(.*)$/i);
        const mcMatch = line.match(/^[\(\[]\s*(?:multiple[_-]?choice|multipla[_-]?escolha|mc)\s*[\)\]]:?\s*(.*)$/i);
        const ankiMatch = line.match(/^[\(\[]\s*(?:anki[_-]?like|anki)\s*[\)\]]:?\s*(.*)$/i);

        if (fillMatch) {
            const content = fillMatch[1].trim();
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const part1 = content.substring(0, colonIndex).trim();
                const part2 = content.substring(colonIndex + 1).trim();

                let answersPart = part1;
                let description = part2;

                const blankRegex = /(?:\[\s*_{1,}\s*\]|(?<![a-zA-Z0-9\u00C0-\u017F])_{1,}(?![a-zA-Z0-9\u00C0-\u017F]))/;
                if (blankRegex.test(part1) && !blankRegex.test(part2)) {
                    description = part1;
                    answersPart = part2;
                }

                const answers = answersPart.split(';').map(a => a.trim()).filter(Boolean);
                cards.push({
                    type: "fill",
                    description: description,
                    answers: answers,
                    answer: answers.join('; ')
                });
            } else {
                cards.push({
                    type: "fill",
                    description: content,
                    answers: [],
                    answer: ""
                });
            }
        } else if (openDoubleMatch) {
            const content = openDoubleMatch[1].trim();
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const answersPart = content.substring(0, colonIndex).trim();
                const description = content.substring(colonIndex + 1).trim();
                const [ans1, ans2] = answersPart.split(';');
                cards.push({
                    type: "open_double",
                    description: description,
                    answer: ans1 ? ans1.trim() : "",
                    answer2: ans2 ? ans2.trim() : "",
                    placeholder1: "Resposta 1",
                    placeholder2: "Resposta 2"
                });
            }
        } else if (mcMatch) {
            const content = mcMatch[1].trim();
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const answer = content.substring(0, colonIndex).trim();
                const description = content.substring(colonIndex + 1).trim();
                cards.push({
                    type: "multiple_choice",
                    description: description,
                    answer: answer,
                    options: ["Opção 1", "Opção 2", answer, "Opção 4"]
                });
            }
        } else if (ankiMatch) {
            const content = ankiMatch[1].trim();
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const front = content.substring(0, colonIndex).trim();
                const back = content.substring(colonIndex + 1).trim();
                if (front && back) {
                    cards.push({
                        type: 'anki',
                        description: front,
                        answer: back
                    });
                }
            }
        } else if (mode === 'anki') {
            // In Anki-like: line is Frente (description) : Verso (answer)
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                const front = line.substring(0, colonIndex).trim();
                const back = line.substring(colonIndex + 1).trim();
                if (front && back) {
                    cards.push({
                        type: 'anki',
                        description: front,
                        answer: back
                    });
                }
            } else if (cards.length > 0 && cards[cards.length - 1].type !== 'divisor') {
                const lastCard = cards[cards.length - 1];
                if (lastCard.type === 'anki') {
                    lastCard.answer += ' ' + line;
                } else if (lastCard.type === 'fill') {
                    lastCard.description += '\n' + line;
                } else {
                    lastCard.description += ' ' + line;
                }
            }
        } else {
            // Traditional mode (open): before ':' is Answer, after ':' is Question (description)
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                const answer = line.substring(0, colonIndex).trim();
                const description = line.substring(colonIndex + 1).trim();
                if (answer && description) {
                    cards.push({
                        type: "open",
                        description: description,
                        answer: answer
                    });
                }
            } else if (cards.length > 0 && cards[cards.length - 1].type !== 'divisor') {
                const lastCard = cards[cards.length - 1];
                if (lastCard.type === 'anki') {
                    lastCard.answer += ' ' + line;
                } else if (lastCard.type === 'fill') {
                    lastCard.description += '\n' + line;
                } else {
                    lastCard.description += ' ' + line;
                }
            }
        }
    }
    return cards;
}

function parseTxtToJSONWithPlaceholders(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    const cards = [];
    let currentSectionTopic = "";

    for (let line of lines) {
        line = line.trim();
        let card = null;

        if (line.startsWith('#')) {
            const noteText = line.replace(/^#+\s*/, '').trim();
            if (noteText) {
                currentSectionTopic = noteText;
                cards.push({
                    type: "divisor",
                    text: noteText,
                    description: noteText,
                    answer: ""
                });
            }
            continue;
        }

        const openDoubleMatch = line.match(/^[\(\[]\s*(?:open[_-]?double|duplo)\s*[\)\]]:?\s*(.*)$/i);
        const fillMatch = line.match(/^[\(\[]\s*(?:fill|preencher|lacunas?|cloze)\s*[\)\]]:?\s*(.*)$/i);
        const mcMatch = line.match(/^[\(\[]\s*(?:multiple[_-]?choice|multipla[_-]?escolha|mc)\s*[\)\]]:?\s*(.*)$/i);
        const ankiMatch = line.match(/^[\(\[]\s*(?:anki[_-]?like|anki)\s*[\)\]]:?\s*(.*)$/i);

        if (fillMatch) {
            const content = fillMatch[1].trim();
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const part1 = content.substring(0, colonIndex).trim();
                const part2 = content.substring(colonIndex + 1).trim();

                let answersPart = part1;
                let description = part2;

                const blankRegex = /(?:\[\s*_{1,}\s*\]|(?<![a-zA-Z0-9\u00C0-\u017F])_{1,}(?![a-zA-Z0-9\u00C0-\u017F]))/;
                if (blankRegex.test(part1) && !blankRegex.test(part2)) {
                    description = part1;
                    answersPart = part2;
                }

                const answers = answersPart.split(';').map(a => a.trim()).filter(Boolean);
                card = {
                    type: "fill",
                    description: description,
                    answers: answers,
                    answer: answers.join('; ')
                };
            } else {
                card = {
                    type: "fill",
                    description: content,
                    answers: ["[GEMINI]"],
                    answer: "[GEMINI]"
                };
            }
        } else if (openDoubleMatch) {
            const content = openDoubleMatch[1].trim();
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const answersPart = content.substring(0, colonIndex).trim();
                const description = content.substring(colonIndex + 1).trim();
                const [ans1, ans2] = answersPart.split(';');
                card = {
                    type: "open_double",
                    description: description,
                    answer: ans1 ? ans1.trim() : "",
                    answer2: ans2 ? ans2.trim() : "",
                    placeholder1: "[GEMINI]",
                    placeholder2: "[GEMINI]"
                };
            }
        } else if (mcMatch) {
            const content = mcMatch[1].trim();
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const answer = content.substring(0, colonIndex).trim();
                const description = content.substring(colonIndex + 1).trim();
                card = {
                    type: "multiple_choice",
                    description: description,
                    answer: answer,
                    options: ["[GEMINI]", "[GEMINI]", answer, "[GEMINI]"]
                };
            }
        } else if (ankiMatch) {
            const content = ankiMatch[1].trim();
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const front = content.substring(0, colonIndex).trim();
                const back = content.substring(colonIndex + 1).trim();
                if (front && back) {
                    card = {
                        type: "anki",
                        description: front,
                        answer: back
                    };
                }
            }
        } else {
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                const answer = line.substring(0, colonIndex).trim();
                const description = line.substring(colonIndex + 1).trim();
                if (answer && description) {
                    card = {
                        type: "open",
                        description: description,
                        answer: answer
                    };
                }
            } else if (cards.length > 0 && cards[cards.length - 1].type !== 'divisor') {
                const lastCard = cards[cards.length - 1];
                if (lastCard.type === 'anki') {
                    lastCard.answer += ' ' + line;
                } else if (lastCard.type === 'fill') {
                    lastCard.description += '\n' + line;
                } else {
                    lastCard.description += ' ' + line;
                }
            }
        }

        if (card) {
            if (currentSectionTopic && !card.topic) {
                card.topic = currentSectionTopic;
                card.aiTopic = currentSectionTopic;
            }
            cards.push(card);
        }
    }
    return cards;
}

// Transition from Dashboard to Editor (M3 Fade Through Motion)
function openEditorView(initialTab = 'creator') {
    const updateDOM = () => {
        dashboardView.classList.add('hidden');
        dashboardView.classList.remove('m3-fade-through-enter');
        editorView.classList.remove('hidden');
        editorView.classList.add('flex', 'm3-fade-through-enter');

        switchSidebarTab(initialTab, true);
        renderCardsList(true);
    };

    if (document.startViewTransition) {
        document.startViewTransition({
            update: updateDOM,
            types: ['fade-through']
        });
    } else {
        updateDOM();
    }
}

// Sidebar Tab Switching (Material Design 3 Shared Axis X Motion)
let currentSidebarTab = 'creator';

function switchSidebarTab(tab, force = false) {
    if (!force && tab === currentSidebarTab && (!cardCreatorPanel.classList.contains('hidden') || !aiEditorChatPanel.classList.contains('hidden'))) {
        return;
    }

    const direction = tab === 'ai' ? 'forward' : 'backward';

    const updateDOM = () => {
        const tabAiChatIcon = tabAiChatBtn ? tabAiChatBtn.querySelector('img') : null;
        cardCreatorPanel.classList.remove('m3-tab-panel-enter-forward', 'm3-tab-panel-enter-backward');
        aiEditorChatPanel.classList.remove('m3-tab-panel-enter-forward', 'm3-tab-panel-enter-backward');

        if (tab === 'creator') {
            tabCreatorBtn.className = "flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition bg-blue-600 text-white shadow-sm";
            tabAiChatBtn.className = "flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition text-gray-600 hover:bg-gray-200";
            tabCreatorBtn.setAttribute('aria-selected', 'true');
            tabAiChatBtn.setAttribute('aria-selected', 'false');
            if (tabAiChatIcon) {
                tabAiChatIcon.classList.add('light-invert');
            }
            cardCreatorPanel.classList.remove('hidden');
            cardCreatorPanel.classList.add(direction === 'forward' ? 'm3-tab-panel-enter-forward' : 'm3-tab-panel-enter-backward');
            aiEditorChatPanel.classList.add('hidden');
        } else {
            tabAiChatBtn.className = "flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition bg-purple-600 text-white shadow-sm";
            tabCreatorBtn.className = "flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition text-gray-600 hover:bg-gray-200";
            tabAiChatBtn.setAttribute('aria-selected', 'true');
            tabCreatorBtn.setAttribute('aria-selected', 'false');
            if (tabAiChatIcon) {
                tabAiChatIcon.classList.remove('light-invert');
            }
            cardCreatorPanel.classList.add('hidden');
            aiEditorChatPanel.classList.remove('hidden');
            aiEditorChatPanel.classList.add(direction === 'forward' ? 'm3-tab-panel-enter-forward' : 'm3-tab-panel-enter-backward');
        }
        currentSidebarTab = tab;
    };

    if (document.startViewTransition) {
        document.startViewTransition({
            update: updateDOM,
            types: [direction]
        });
    } else {
        updateDOM();
    }
}

tabCreatorBtn.addEventListener('click', () => switchSidebarTab('creator'));
tabAiChatBtn.addEventListener('click', () => switchSidebarTab('ai'));

// --- DASHBOARD CARD HANDLERS ---

// 1.1 Crie agora — Escreva cada cartão direto no aplicativo
cardMode11.addEventListener('click', () => {
    deckCards = [];
    deckTitleDisplay.value = "Novo Baralho";
    openEditorView('creator');
});

// 1.2 Converta um doc — Importe um txt ou word já feito
cardMode12.addEventListener('click', () => {
    modal12Error.textContent = '';
    modal12File.value = '';
    modal12FileName.textContent = 'Clique ou arraste o arquivo aqui';
    modal12.classList.remove('hidden');
});

closeModal12Btn.addEventListener('click', () => modal12.classList.add('hidden'));
cancelModal12Btn.addEventListener('click', () => modal12.classList.add('hidden'));

modal12File.addEventListener('change', () => {
    if (modal12File.files.length > 0) {
        modal12FileName.textContent = modal12File.files[0].name;
    }
});

submitModal12Btn.addEventListener('click', async () => {
    modal12Error.textContent = '';
    if (!modal12File.files || modal12File.files.length === 0) {
        modal12Error.textContent = 'Por favor, selecione um arquivo (.txt, .doc ou .docx).';
        return;
    }

    const file = modal12File.files[0];
    const selectedMode = document.querySelector('input[name="modal-1-2-type"]:checked')?.value || 'anki';

    try {
        const text = await extractTextFromFile(file);
        const cards = convertDocumentToCards(text, selectedMode);

        const playableCards = cards.filter(c => c.type !== 'divisor' && c.type !== 'divider' && c.type !== 'note');
        if (playableCards.length === 0) {
            modal12Error.textContent = 'Nenhum flashcard válido encontrado no arquivo. Certifique-se de usar ":" para separar pergunta e resposta.';
            return;
        }

        deckCards = cards;
        deckTitleDisplay.value = file.name.replace(/\.[^/.]+$/, "");
        modal12.classList.add('hidden');
        openEditorView('creator');
    } catch (err) {
        modal12Error.textContent = `Erro ao ler o documento: ${err.message}`;
    }
});

// 2.1 Crie de materiais — Transforme slides, pdf, fotos... em cards
cardMode21.addEventListener('click', () => {
    modal21Error.textContent = '';
    modal21ApiKey.value = getApiKey();
    modal21Files.value = '';
    modal21FilesCount.textContent = 'Nenhum arquivo selecionado';
    modal21FilesText.classList.remove('hidden');
    renderFileIcons([], modal21IconsContainer, FILES_DEFAULT_SVG);
    modal21.classList.remove('hidden');
});

closeModal21Btn.addEventListener('click', () => modal21.classList.add('hidden'));
cancelModal21Btn.addEventListener('click', () => modal21.classList.add('hidden'));

modal21Files.addEventListener('change', () => {
    modal21Error.textContent = '';
    const files = Array.from(modal21Files.files);

    if (files.length > 10) {
        modal21Error.textContent = 'Limite excedido: você pode enviar no máximo 10 arquivos.';
        modal21Files.value = '';
        modal21FilesCount.textContent = 'Nenhum arquivo selecionado';
        renderFileIcons([], modal21IconsContainer, FILES_DEFAULT_SVG);
        return;
    }

    for (let f of files) {
        if (f.size > MAX_FILE_SIZE) {
            modal21Error.textContent = `O arquivo "${f.name}" excede 100MB e foi rejeitado.`;
            modal21Files.value = '';
            modal21FilesCount.textContent = 'Nenhum arquivo selecionado';
            renderFileIcons([], modal21IconsContainer, FILES_DEFAULT_SVG);
            return;
        }
    }

    if (files.length > 0) {
        modal21FilesCount.textContent = `${files.length} de 10 arquivo(s) selecionado(s)`;
        modal21FilesText.classList.add('hidden');
    } else {
        modal21FilesCount.textContent = 'Nenhum arquivo selecionado';
        modal21FilesText.classList.remove('hidden');
    }
    renderFileIcons(files, modal21IconsContainer, FILES_DEFAULT_SVG);
});

submitModal21Btn.addEventListener('click', async () => {
    modal21Error.textContent = '';
    const apiKey = modal21ApiKey.value.trim();
    if (!apiKey) {
        modal21Error.textContent = 'Por favor, insira sua Gemini API Key.';
        return;
    }
    const remember = Boolean(modal21Remember?.checked);
    await setApiKey(apiKey, remember);

    const files = Array.from(modal21Files.files);
    if (files.length === 0) {
        modal21Error.textContent = 'Selecione pelo menos um arquivo.';
        return;
    }
    if (files.length > 10) {
        modal21Error.textContent = 'Você pode enviar no máximo 10 arquivos.';
        return;
    }

    // Immediately close modal and transition to editor view with live animations
    modal21.classList.add('hidden');
    openEditorView('ai');

    deckCards = [];
    deckTitleDisplay.value = files[0].name.replace(/\.[^/.]+$/, "");

    showGeneratingAnimation("Processando materiais enviados...");
    addAiChatGeneratingBubble("O Gemini está analisando seus materiais para gerar os flashcards com nível universitário. Acompanhe a formulação ao vivo!");

    submitModal21Btn.disabled = true;
    modal21Spinner.classList.remove('hidden');
    modal21LoadingMsg.classList.remove('hidden');

    try {
        let userTaskPrompt = `Com base nos arquivos enviados, o objetivo é processar todo o conteúdo e gerar uma lista extensa de termos técnicos para revisão, incluindo nomes de moléculas, estruturas, etapas de processos e quaisquer conceitos com nomes específicos. Em seguida, usar das informações que classificou na primeira etapa para gerar um arquivo .json baseado em todo o conteúdo que juntou na primeira etapa. A sua resposta vai ser apenas o JSON com os flashcards, a primeira etapa serve apenas para você planejar os flashcards.
Gere aproximadamente 100 flashcards completos e aprofundados cobrindo todo o material enviado (se necessário para cobrir todo o conteúdo essencial, pode ultrapassar esse valor).
Atribua obrigatoriamente a matéria de alto nível ('subject') e o assunto específico agrupador ('topic') em cada flashcard para indexação taxonômica.
Ao final revise se os flashcards criados realmente abordam por extenso tudo que foi enviado.
Retorne EXCLUSIVAMENTE o array JSON ([]) contendo os flashcards estruturados conforme as diretrizes do sistema.`;

        const customText = modal21Prompt.value.trim();
        if (customText) {
            userTaskPrompt += `\n\nDemandas adicionais do usuário (prioridade máxima sobre os padrões quando conflitarem):\n${customText}`;
        }

        const parts = [userTaskPrompt];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            updateGeneratingStatus(`Processando arquivo ${i + 1} de ${files.length}: ${file.name}...`);
            const ext = getFileExtension(file.name);
            if (ext === 'pptx') {
                const pptxText = await extractTextFromPPTX(file);
                if (pptxText) {
                    parts.push(pptxText);
                    continue;
                }
            } else if (ext === 'docx' || ext === 'doc' || ext === 'txt') {
                try {
                    const text = await extractTextFromFile(file);
                    if (text) {
                        parts.push(text);
                        continue;
                    }
                } catch (e) {
                    console.warn("Falha ao extrair texto de " + file.name + ":", e);
                }
            } else if (file.type === 'application/pdf' && file.size > 5 * 1024 * 1024) {
                try {
                    const compressed = await compressPDFWithWorker(file);
                    const compFile = new File([compressed], file.name, { type: 'application/pdf' });
                    const part = await fileToGenerativePart(compFile);
                    parts.push(part);
                    continue;
                } catch (e) {
                    console.warn("Falha ao comprimir PDF:", e);
                }
            }
            const part = await fileToGenerativePart(file);
            parts.push(part);
        }

        updateGeneratingStatus("Conectando ao Gemini e gerando os cartões...");

        const genAI = new GoogleGenerativeAI(apiKey);
        const genModel = genAI.getGenerativeModel({
            model: currentEditorModel || "gemini-flash-latest",
            systemInstruction: generationSystemInstruction,
            generationConfig: {
                thinkingConfig: {
                    thinkingLevel: "HIGH"
                },
                responseMimeType: "application/json"
            }
        });

        const result = await callWithRetry(() => genModel.generateContentStream(parts));
        let fullText = "";
        const seenSignatures = new Set();

        for await (const chunk of result.stream) {
            let chunkText = "";
            try {
                chunkText = chunk.text();
            } catch (e) {
                if (chunk.candidates?.[0]?.content?.parts) {
                    for (const part of chunk.candidates[0].content.parts) {
                        if (part.text && !part.thought) chunkText += part.text;
                    }
                }
            }
            if (!chunkText && chunk.candidates?.[0]?.content?.parts) {
                for (const part of chunk.candidates[0].content.parts) {
                    if (part.text && !part.thought) chunkText += part.text;
                }
            }

            fullText += chunkText;

            // Extract balanced JSON objects in real-time as stream arrives
            const streamObjects = extractBalancedJsonObjects(fullText);
            for (const rawObj of streamObjects) {
                const card = normalizeCard(rawObj);
                if (card) {
                    const sig = `${card.type}::${card.description}::${card.answer}`;
                    if (!seenSignatures.has(sig)) {
                        seenSignatures.add(sig);
                        deckCards.push(card);
                        updateGeneratingProgress(deckCards.length);
                        renderCardsList();
                    }
                }
            }
        }

        // Stream completed. If no cards were extracted or some were missed, run safe fallback parser
        if (deckCards.length === 0 && fullText.trim()) {
            const fallbackCards = parseJsonCardsSafely(fullText);
            for (const card of fallbackCards) {
                const sig = `${card.type}::${card.description}::${card.answer}`;
                if (!seenSignatures.has(sig)) {
                    seenSignatures.add(sig);
                    deckCards.push(card);
                }
            }
            if (deckCards.length > 0) {
                renderCardsList(true);
            }
        }

        if (deckCards.length > 0) {
            finishGeneratingAnimation(true, deckCards.length);
            removeAiChatGeneratingBubble();
            addChatMessage('model', `✓ Baralho gerado com sucesso! Criei ${deckCards.length} flashcards técnicos com base no material enviado. Quer que eu ajuste algo, adicione mais perguntas ou altere alguma alternativa?`);
        } else {
            finishGeneratingAnimation(false, 0);
            removeAiChatGeneratingBubble();
            addChatMessage('model', 'Não foi possível extrair flashcards a partir dos materiais fornecidos. Tente enviar outros arquivos ou descrever o conteúdo.');
            renderCardsList(true);
        }

        // Initialize chat session for subsequent agentic edits in the sidebar
        const chatModel = genAI.getGenerativeModel({
            model: currentEditorModel || "gemini-flash-latest",
            systemInstruction,
            tools: deckTools
        });
        currentGenModel = chatModel;
        geminiChatSession = chatModel.startChat({ history: [] });

    } catch (err) {
        console.error("Erro na geração 2.1:", err);
        finishGeneratingAnimation(false, 0);
        removeAiChatGeneratingBubble();
        addChatMessage('model', `Erro durante a geração: ${err.message}`);
        showGeminiDownModal(err.message, 'files');
    } finally {
        submitModal21Btn.disabled = false;
        modal21Spinner.classList.add('hidden');
        modal21LoadingMsg.classList.add('hidden');
    }
});

// 2.2 Aprimore um doc — A partir de um txt ou word, aprimore cartões
cardMode22.addEventListener('click', () => {
    modal22Error.textContent = '';
    modal22ApiKey.value = getApiKey();
    modal22File.value = '';
    modal22FileName.textContent = 'Clique ou arraste o arquivo .txt ou Word';
    modal22.classList.remove('hidden');
});

closeModal22Btn.addEventListener('click', () => modal22.classList.add('hidden'));
cancelModal22Btn.addEventListener('click', () => modal22.classList.add('hidden'));

modal22File.addEventListener('change', () => {
    if (modal22File.files.length > 0) {
        modal22FileName.textContent = modal22File.files[0].name;
    }
});

submitModal22Btn.addEventListener('click', async () => {
    modal22Error.textContent = '';
    const apiKey = modal22ApiKey.value.trim();
    if (!apiKey) {
        modal22Error.textContent = 'Por favor, insira sua Gemini API Key.';
        return;
    }
    const remember = Boolean(modal22Remember?.checked);
    await setApiKey(apiKey, remember);

    if (!modal22File.files || modal22File.files.length === 0) {
        modal22Error.textContent = 'Selecione um arquivo .txt ou Word.';
        return;
    }

    submitModal22Btn.disabled = true;
    modal22Spinner.classList.remove('hidden');
    modal22LoadingMsg.classList.remove('hidden');

    const file = modal22File.files[0];
    let localCards = [];
    try {
        const textContent = await extractTextFromFile(file);
        localCards = parseTxtToJSONWithPlaceholders(textContent);

        const playableCards = localCards.filter(c => c.type !== 'divisor' && c.type !== 'divider' && c.type !== 'note');
        if (playableCards.length === 0) {
            modal22Error.textContent = 'Nenhum flashcard válido encontrado no documento. Verifique se as linhas contêm ":" para separar os campos.';
            return;
        }

        modal22.classList.add('hidden');
        openEditorView('ai');

        deckTitleDisplay.value = file.name.replace(/\.[^/.]+$/, "");
        deckCards = localCards;
        renderCardsList(true);

        const hasPlaceholders = JSON.stringify(localCards).includes("[GEMINI]");
        const genAI = new GoogleGenerativeAI(apiKey);

        if (!hasPlaceholders) {
            const model = genAI.getGenerativeModel({ model: currentEditorModel, systemInstruction, tools: deckTools });
            currentGenModel = model;
            geminiChatSession = model.startChat({ history: [] });
            addChatMessage('model', `✓ Documento importado com sucesso! ${deckCards.length} cartões foram carregados no baralho. Como posso ajudar a revisar ou enriquecer seus cards?`);
            return;
        }

        // Fill placeholders with Gemini
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            generationConfig: { temperature: 0.7, responseMimeType: "text/plain" },
            tools: deckTools,
            systemInstruction: systemInstruction + "\nPreencha os placeholders '[GEMINI]' no JSON de flashcards e retorne-os usando a ferramenta 'adicionar_varios_cards'. Preserve cards com type 'anki' (frente e verso), 'fill' (lacunas), 'open' e 'divisor' exatamente como foram fornecidos. REGRA MANDATÓRIA: As perguntas ('description') de todos os cartões podem e devem usar Markdown e LaTeX livremente. Apenas respostas digitadas na gameplay ('open', 'open_double', 'fill') NUNCA devem usar Markdown nem fórmulas matemáticas."
        });

        currentGenModel = model;

        const fillPrompt = `Aqui está uma lista de flashcards que precisam que você preencha os campos '[GEMINI]'.
As perguntas ('description') de todos os tipos de cartões podem usar formatação Markdown e fórmulas LaTeX livremente.
Para 'open_double', preencha 'placeholder1' e 'placeholder2' com rótulos descritivos curtos para as respostas. Respostas digitadas devem ser texto puro sem Markdown e sem fórmulas.
Para 'multiple_choice', complete o array 'options' com alternativas incorretas porém plausíveis (distratores), mantendo a resposta correta informada. Pode usar Markdown e LaTeX livremente.
Para 'fill', se 'answers' contiver '[GEMINI]' ou estiver vazio, identifique as respostas corretas para cada lacuna '_' na frase de 'description' e preencha o array 'answers' com as respostas em ordem. As respostas das lacunas DEVEM SER ESTRITAMENTE TEXTO PURO (sem negrito **, sem itálico *, sem código \` e sem fórmulas LaTeX). Se 'answers' já estiver preenchido, mantenha-o intacto.
Para 'anki', mantenha o type 'anki' intacto, preservando exatamente 'description' (frente/pergunta) e 'answer' (verso/resposta detalhada, que suporta Markdown e LaTeX livremente).
Para 'open', mantenha o type 'open' intacto com 'description' (que pode usar Markdown e LaTeX livremente) e 'answer' (estritamente texto puro, sem Markdown e sem fórmulas).
Mantenha quaisquer itens com type 'divisor', 'anki', 'fill' e 'open' intactos e em suas respectivas posições entre os cartões.
Ao terminar, chame 'adicionar_varios_cards' para enviar o baralho finalizado.

JSON:
${JSON.stringify(localCards, null, 2)}`;

        showGeneratingAnimation("Aprimorando flashcards e preenchendo detalhes com IA...");
        addAiChatGeneratingBubble("O Gemini está aprimorando seus flashcards e preenchendo as opções e rótulos...");
        const chat = model.startChat({ history: [] });
        deckCards = []; // Will be populated via function call
        renderCardsList(true);

        let result = await callWithRetry(() => chat.sendMessage(fillPrompt));
        let response = result.response;

        for (let i = 0; i < 4; i++) {
            const candidate = response.candidates[0];
            const calls = candidate.content.parts.filter(p => !!p.functionCall);
            if (calls.length === 0) break;

            const functionResponses = calls.map(call => {
                const { name, args } = call.functionCall;
                const output = toolFunctions[name] ? toolFunctions[name](args) : { error: "Função não encontrada" };
                return {
                    functionResponse: { name, response: output }
                };
            });

            result = await callWithRetry(() => chat.sendMessage(functionResponses));
            sanitizeChatHistory(chat);
            response = result.response;
        }

        finishGeneratingAnimation(true, deckCards.length);
        removeAiChatGeneratingBubble();
        addChatMessage('model', `✓ Flashcards aprimorados com sucesso! ${deckCards.length} cartões foram enriquecidos com alternativas e detalhes.`);
        geminiChatSession = model.startChat({ history: [] });

    } catch (err) {
        console.error("Erro na aprimoração 2.2:", err);
        finishGeneratingAnimation(false, 0);
        removeAiChatGeneratingBubble();
        addChatMessage('model', `Erro ao aprimorar os cartões: ${err.message}`);
        showGeminiDownModal(err.message, 'txt', localCards);
    } finally {
        submitModal22Btn.disabled = false;
        modal22Spinner.classList.add('hidden');
        modal22LoadingMsg.classList.add('hidden');
    }
});

// Quick API Key Modal Listeners
openApiKeyModalBtn.addEventListener('click', async () => {
    quickApiInput.value = await getApiKeyAsync();
    if (quickApiRemember) quickApiRemember.checked = isKeyRemembered();
    quickApiModal.classList.remove('hidden');
    setTimeout(() => quickApiInput.focus(), 50);
});
closeQuickApiBtn.addEventListener('click', () => quickApiModal.classList.add('hidden'));

if (quickApiForm) {
    quickApiForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveQuickApiBtn.click();
    });
}

saveQuickApiBtn.addEventListener('click', async () => {
    const remember = Boolean(quickApiRemember?.checked);
    await setApiKey(quickApiInput.value.trim(), remember);
    quickApiModal.classList.add('hidden');
});
clearQuickApiBtn.addEventListener('click', async () => {
    await setApiKey('');
    quickApiInput.value = '';
    if (quickApiRemember) quickApiRemember.checked = false;
    quickApiModal.classList.add('hidden');
});

// Instructions Modal Listeners
document.querySelectorAll('.open-instructions-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        instructionsModal.classList.remove('hidden');
    });
});
closeInstructionsBtn.addEventListener('click', () => instructionsModal.classList.add('hidden'));
instructionsReadyBtn.addEventListener('click', () => instructionsModal.classList.add('hidden'));

// Gemini Down Modal Listeners
function showGeminiDownModal(errorMsg, sourceType, localCards = null) {
    lastFailedSourceType = sourceType;
    lastFailedLocalCards = localCards;
    if (geminiDownModal) geminiDownModal.classList.remove('hidden');
}
function closeGeminiDownModal() {
    if (geminiDownModal) geminiDownModal.classList.add('hidden');
}
closeGeminiDownModalBtn.addEventListener('click', closeGeminiDownModal);
if (useTraditionalTxtBtn) {
    useTraditionalTxtBtn.addEventListener('click', () => {
        closeGeminiDownModal();
        if (lastFailedLocalCards) {
            deckCards = lastFailedLocalCards.map(c => {
                const copy = { ...c };
                if (copy.type === 'multiple_choice' && Array.isArray(copy.options)) {
                    copy.options = copy.options.map((o, i) => o === '[GEMINI]' ? `Opção ${i + 1}` : o);
                }
                if (copy.type === 'fill' && Array.isArray(copy.answers)) {
                    copy.answers = copy.answers.filter(a => a !== '[GEMINI]');
                    if (copy.answer === '[GEMINI]') copy.answer = copy.answers.join('; ');
                }
                return copy;
            });
            openEditorView('creator');
            renderCardsList(true);
        }
    });
}
if (retryGeminiBtn) {
    retryGeminiBtn.addEventListener('click', () => {
        closeGeminiDownModal();
        if (lastFailedSourceType === 'files') {
            modal21.classList.remove('hidden');
        } else if (lastFailedSourceType === 'txt') {
            modal22.classList.remove('hidden');
        }
    });
}

// Close modals on backdrop click
[modal12, modal21, modal22, quickApiModal, instructionsModal, geminiDownModal, inlineEditModal].forEach(modal => {
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }
});

// --- CARD CREATOR UI LOGIC (LEFT SIDEBAR) ---
const typeHints = {
    open: "Pergunta é uma descrição e você digita o nome do conceito.",
    open_double: "Uma pergunta, você digita duas respostas.",
    fill: "Frase com lacunas marcadas por '_' (ex: 'O KDIGO define A1 como < _ mg/g e A3 como > _ mg/g'). Você digita cada lacuna.",
    anki: "Pergunta é um conceito (curto), ou imagem, e resposta é uma descrição longa, ou imagem. Sem digitação.",
    multiple_choice: "Pergunta é um conceito, você escolhe entre alternativas (2 a 6 opções).",
    divisor: "Adiciona um comentário na lista para organizar tópicos no editor. Não aparece no jogo."
};

// --- M3 CUSTOM CARD TYPE SELECT CONTROLLER ---
function selectCardType(type, triggerChange = true) {
    const input = document.getElementById('creator-card-type');
    if (!input) return;
    input.value = type;

    const items = document.querySelectorAll('.m3-select-item');
    let matchedItem = null;
    items.forEach(item => {
        const isMatch = item.dataset.value === type;
        if (isMatch) matchedItem = item;
        item.classList.toggle('m3-select-item-selected', isMatch);
        item.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    if (matchedItem) {
        const labelEl = document.getElementById('creator-type-selected-label');
        const iconEl = document.getElementById('creator-type-selected-icon');
        if (labelEl) labelEl.textContent = matchedItem.dataset.label;
        if (iconEl) {
            iconEl.src = matchedItem.dataset.icon;
            iconEl.alt = matchedItem.dataset.label;
        }
    }

    if (triggerChange) {
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function toggleCardTypeDropdown(open) {
    const dropdown = document.getElementById('creator-card-type-dropdown');
    const btn = document.getElementById('creator-card-type-btn');
    if (!dropdown || !btn) return;

    const isOpen = open !== undefined ? open : dropdown.classList.contains('hidden');
    if (isOpen) {
        dropdown.classList.remove('hidden', 'm3-dropdown-close');
        dropdown.classList.add('m3-dropdown-open');
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.add('active');
    } else {
        dropdown.classList.remove('m3-dropdown-open');
        dropdown.classList.add('m3-dropdown-close');
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('active');
        setTimeout(() => {
            if (btn.getAttribute('aria-expanded') === 'false') {
                dropdown.classList.add('hidden');
                dropdown.classList.remove('m3-dropdown-close');
            }
        }, 150);
    }
}

function initCardTypeSelect() {
    const btn = document.getElementById('creator-card-type-btn');
    const wrapper = document.getElementById('creator-card-type-wrapper');
    const items = document.querySelectorAll('.m3-select-item');

    if (btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const dropdown = document.getElementById('creator-card-type-dropdown');
            const isCurrentlyOpen = dropdown && !dropdown.classList.contains('hidden') && !dropdown.classList.contains('m3-dropdown-close');
            toggleCardTypeDropdown(!isCurrentlyOpen);
        });

        btn.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCardTypeDropdown(true);
                const selected = document.querySelector('.m3-select-item-selected');
                if (selected) selected.focus();
            }
        });
    }

    items.forEach((item, index) => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const val = item.dataset.value;
            selectCardType(val);
            toggleCardTypeDropdown(false);
            btn?.focus();
        });

        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const val = item.dataset.value;
                selectCardType(val);
                toggleCardTypeDropdown(false);
                btn?.focus();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = items[index + 1] || items[0];
                next?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = items[index - 1] || items[items.length - 1];
                prev?.focus();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                toggleCardTypeDropdown(false);
                btn?.focus();
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (wrapper && !wrapper.contains(e.target)) {
            toggleCardTypeDropdown(false);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleCardTypeDropdown(false);
        }
    });
}

// Initialize custom select controller
initCardTypeSelect();

creatorCardType.addEventListener('change', () => {
    const t = creatorCardType.value;
    creatorTypeHint.textContent = typeHints[t] || '';

    // Adjust visibility
    creatorGroupOpen.classList.toggle('hidden', t !== 'open');
    creatorGroupOpenDouble.classList.toggle('hidden', t !== 'open_double');
    if (creatorGroupFill) creatorGroupFill.classList.toggle('hidden', t !== 'fill');
    creatorGroupAnki.classList.toggle('hidden', t !== 'anki');
    creatorGroupMc.classList.toggle('hidden', t !== 'multiple_choice');

    const qImgContainer = creatorQImgUrl?.parentElement?.parentElement;
    if (qImgContainer) {
        qImgContainer.classList.toggle('hidden', t === 'divisor');
    }

    if (t === 'divisor') {
        creatorQuestionLabel.textContent = "Texto do Comentário (#)";
        creatorQuestion.placeholder = "Ex: Seção 1 - Fisiologia Renal";
    } else if (t === 'fill') {
        creatorQuestionLabel.textContent = "Frase com lacunas (use '_' para cada lacuna)";
        creatorQuestion.placeholder = "Ex: No KDIGO, A1 é < _ mg/g, A2 é _-_ mg/g e A3 é > _ mg/g";
    } else if (t === 'anki') {
        creatorQuestionLabel.textContent = "Pergunta / Conceito (Curto)";
        creatorQuestion.placeholder = "Escreva a pergunta ou conceito...";
    } else {
        creatorQuestionLabel.textContent = "Pergunta / Descrição";
        creatorQuestion.placeholder = "Escreva a pergunta ou conceito...";
    }

    if (t === 'multiple_choice' && creatorMcOptionsList.children.length === 0) {
        renderCreatorMcOptions(["", "", "", ""], 0);
    }
});

// Creator MCQ Options (between 2 and 6 options)
function renderCreatorMcOptions(options = ["", "", "", ""], selectedIdx = 0) {
    creatorMcOptionsList.innerHTML = '';
    options.forEach((optText, i) => {
        const row = document.createElement('div');
        row.className = "flex items-center gap-2";
        row.innerHTML = `
            <input type="radio" name="creator-mc-correct" value="${i}" ${i === selectedIdx ? 'checked' : ''} class="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer" title="Marcar como alternativa correta">
            <input type="text" class="creator-mc-opt-val flex-1 p-2 bg-gray-50 border border-gray-300 rounded-lg text-sm" placeholder="Opção ${i + 1}" value="${optText}">
            <button type="button" class="creator-mc-remove-opt-btn p-1 text-gray-400 hover:text-red-500 transition" title="Remover alternativa">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;

        const removeBtn = row.querySelector('.creator-mc-remove-opt-btn');
        removeBtn.addEventListener('click', () => {
            const currentVals = Array.from(document.querySelectorAll('.creator-mc-opt-val')).map(inp => inp.value);
            if (currentVals.length <= 2) {
                alert("A questão de múltipla escolha deve ter pelo menos 2 alternativas.");
                return;
            }
            currentVals.splice(i, 1);
            let nextSelected = 0;
            const checkedRadio = document.querySelector('input[name="creator-mc-correct"]:checked');
            if (checkedRadio) {
                const oldCheckedIdx = parseInt(checkedRadio.value);
                if (oldCheckedIdx === i) nextSelected = 0;
                else if (oldCheckedIdx > i) nextSelected = oldCheckedIdx - 1;
                else nextSelected = oldCheckedIdx;
            }
            renderCreatorMcOptions(currentVals, nextSelected);
        });

        creatorMcOptionsList.appendChild(row);
    });

    creatorAddMcOptBtn.classList.toggle('hidden', options.length >= 6);
}

creatorAddMcOptBtn.addEventListener('click', () => {
    const currentVals = Array.from(document.querySelectorAll('.creator-mc-opt-val')).map(inp => inp.value);
    if (currentVals.length >= 6) return;
    const checkedRadio = document.querySelector('input[name="creator-mc-correct"]:checked');
    const checkedIdx = checkedRadio ? parseInt(checkedRadio.value) : 0;
    currentVals.push("");
    renderCreatorMcOptions(currentVals, checkedIdx);
});

// Creator Image Handling
creatorQImgUrl.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    pendingCreatorQImage = url;
    if (url) {
        creatorQImgPreview.src = url;
        creatorQImgPreviewContainer.classList.remove('hidden');
        creatorRemoveQImg.classList.remove('hidden');
    } else {
        creatorQImgPreview.src = '';
        creatorQImgPreviewContainer.classList.add('hidden');
        creatorRemoveQImg.classList.add('hidden');
    }
});
creatorRemoveQImg.addEventListener('click', () => {
    pendingCreatorQImage = '';
    creatorQImgUrl.value = '';
    creatorQImgPreview.src = '';
    creatorQImgPreviewContainer.classList.add('hidden');
    creatorRemoveQImg.classList.add('hidden');
});

creatorAnsImgUrl.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    pendingCreatorAnsImage = url;
    if (url) {
        creatorAnsImgPreview.src = url;
        creatorAnsImgPreviewContainer.classList.remove('hidden');
        creatorRemoveAnsImg.classList.remove('hidden');
    } else {
        creatorAnsImgPreview.src = '';
        creatorAnsImgPreviewContainer.classList.add('hidden');
        creatorRemoveAnsImg.classList.add('hidden');
    }
});
creatorRemoveAnsImg.addEventListener('click', () => {
    pendingCreatorAnsImage = '';
    creatorAnsImgUrl.value = '';
    creatorAnsImgPreview.src = '';
    creatorAnsImgPreviewContainer.classList.add('hidden');
    creatorRemoveAnsImg.classList.add('hidden');
});

// Submit New Card
creatorSubmitCardBtn.addEventListener('click', () => {
    creatorFeedback.classList.add('hidden');
    const type = creatorCardType.value;
    const desc = creatorQuestion.value.trim();

    if (type === 'divisor') {
        if (!desc) {
            alert("Por favor, digite o texto do comentário.");
            creatorQuestion.focus();
            return;
        }
        appendNewCardWithElasticCollision({
            type: 'divisor',
            text: desc,
            description: desc,
            answer: ''
        });
        creatorQuestion.value = '';
        return;
    }

    if (!desc && !pendingCreatorQImage) {
        alert("Por favor, informe a pergunta ou selecione uma imagem.");
        creatorQuestion.focus();
        return;
    }

    const newCard = {
        type,
        description: desc
    };

    if (pendingCreatorQImage) newCard.image = pendingCreatorQImage;

    if (type === 'open') {
        const ans = creatorAnsOpen.value.trim();
        if (!ans) {
            alert("Por favor, digite a resposta principal.");
            creatorAnsOpen.focus();
            return;
        }
        newCard.answer = ans;
    } else if (type === 'open_double') {
        const a1 = creatorAnsDouble1.value.trim();
        const a2 = creatorAnsDouble2.value.trim();
        if (!a1 || !a2) {
            alert("Por favor, preencha as duas respostas.");
            return;
        }
        newCard.answer = a1;
        newCard.answer2 = a2;
        newCard.placeholder1 = "Resposta 1";
        newCard.placeholder2 = "Resposta 2";
    } else if (type === 'anki') {
        const ans = creatorAnsAnki.value.trim();
        if (!ans && !pendingCreatorAnsImage) {
            alert("Por favor, informe a resposta ou uma imagem de resposta para o cartão Anki.");
            creatorAnsAnki.focus();
            return;
        }
        newCard.answer = ans;
        if (pendingCreatorAnsImage) newCard.answerImage = pendingCreatorAnsImage;
    } else if (type === 'multiple_choice') {
        const optInputs = Array.from(document.querySelectorAll('.creator-mc-opt-val'));
        const options = optInputs.map(inp => inp.value.trim()).filter(Boolean);
        if (options.length < 2 || options.length > 6) {
            alert("A questão de múltipla escolha deve conter entre 2 e 6 alternativas válidas.");
            return;
        }
        const checkedRadio = document.querySelector('input[name="creator-mc-correct"]:checked');
        const correctIdx = checkedRadio ? parseInt(checkedRadio.value) : 0;
        const correctText = optInputs[correctIdx]?.value.trim();
        if (!correctText) {
            alert("A alternativa correta selecionada não pode estar vazia.");
            return;
        }
        newCard.answer = correctText;
        newCard.options = options;
    } else if (type === 'fill') {
        const blankRegex = /(?:\[\s*_{1,}\s*\]|(?<![a-zA-Z0-9\u00C0-\u017F])_{1,}(?![a-zA-Z0-9\u00C0-\u017F]))/g;
        const blanksCount = (desc.match(blankRegex) || []).length;
        if (blanksCount === 0) {
            alert("A frase deve conter pelo menos uma lacuna '_' para preenchimento.");
            creatorQuestion.focus();
            return;
        }
        const ansRaw = creatorAnsFill ? creatorAnsFill.value.trim() : '';
        const answers = ansRaw.split(';').map(a => a.trim()).filter(Boolean);
        if (answers.length === 0) {
            alert("Por favor, informe a(s) resposta(s) esperada(s), separadas por ';' se houver mais de uma.");
            if (creatorAnsFill) creatorAnsFill.focus();
            return;
        }
        newCard.answers = answers;
        newCard.answer = answers.join('; ');
    }

    appendNewCardWithElasticCollision(newCard);

    // Reset Form Fields
    creatorQuestion.value = '';
    creatorAnsOpen.value = '';
    creatorAnsDouble1.value = '';
    creatorAnsDouble2.value = '';
    creatorAnsAnki.value = '';
    if (creatorAnsFill) creatorAnsFill.value = '';
    creatorRemoveQImg.click();
    creatorRemoveAnsImg.click();

    if (type === 'multiple_choice') {
        renderCreatorMcOptions(["", "", "", ""], 0);
    }

    creatorFeedback.textContent = "Card adicionado com sucesso!";
    creatorFeedback.classList.remove('hidden');
    setTimeout(() => creatorFeedback.classList.add('hidden'), 2000);
});

// Initialize default creator MCQ options
renderCreatorMcOptions(["", "", "", ""], 0);

// --- AI FLASHCARD GENERATION ANIMATION & PROGRESS ---
let isGeneratingCards = false;
let generationStatusPhrases = [
    "Processando conteúdo e identificando tópicos principais...",
    "Estruturando conceitos fundamentais e definições...",
    "Formulando perguntas abertas e respostas técnicas...",
    "Criando alternativas plausíveis e distratores...",
    "Organizando cartões e refinando o baralho..."
];
let generationStatusInterval = null;

function showGeneratingAnimation(initialMessage = "Processando arquivos e gerando flashcards...") {
    isGeneratingCards = true;
    const bannerContainer = document.getElementById('generation-banner-container');
    const statusText = document.getElementById('generation-status-text');
    const counterNum = document.getElementById('generation-counter-num');
    const badgeStatus = document.getElementById('generation-badge-status');
    const titleText = document.getElementById('generation-title-text');
    const progressBar = document.getElementById('generation-progress-bar-container');

    if (bannerContainer) {
        bannerContainer.classList.remove('hidden', 'opacity-0', 'scale-95');
    }
    if (statusText) statusText.textContent = initialMessage;
    if (counterNum) counterNum.textContent = '0';
    if (badgeStatus) {
        badgeStatus.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-b from-purple-50 to-purple-100 text-purple-700 border border-purple-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
        badgeStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span> AO VIVO';
    }
    if (titleText) titleText.textContent = "O Gemini está gerando seus flashcards";
    if (progressBar) progressBar.classList.remove('hidden');

    deckSizeBadge.classList.add('badge-generating-pulse');

    // Cycle status phrases periodically while waiting for cards
    let phraseIdx = 0;
    if (generationStatusInterval) clearInterval(generationStatusInterval);
    generationStatusInterval = setInterval(() => {
        if (!isGeneratingCards) {
            clearInterval(generationStatusInterval);
            return;
        }
        if (deckCards.length === 0 && statusText) {
            phraseIdx = (phraseIdx + 1) % generationStatusPhrases.length;
            statusText.textContent = generationStatusPhrases[phraseIdx];
        }
    }, 3200);

    renderCardsList(true);
}

function updateGeneratingProgress(count) {
    const counterNum = document.getElementById('generation-counter-num');
    const statusText = document.getElementById('generation-status-text');
    if (counterNum) counterNum.textContent = count;
    if (statusText) {
        if (count < 10) {
            statusText.textContent = `Identificando conceitos-chave... (${count} cards formulados)`;
        } else if (count < 25) {
            statusText.textContent = `Aprofundando em definições técnicas... (${count} cards formulados)`;
        } else if (count < 50) {
            statusText.textContent = `Construindo perguntas e alternativas... (${count} cards formulados)`;
        } else {
            statusText.textContent = `Finalizando os últimos cards do material... (${count} cards formulados)`;
        }
    }
}

function finishGeneratingAnimation(success = true, count = 0) {
    isGeneratingCards = false;
    if (generationStatusInterval) {
        clearInterval(generationStatusInterval);
        generationStatusInterval = null;
    }
    deckSizeBadge.classList.remove('badge-generating-pulse');

    const bannerContainer = document.getElementById('generation-banner-container');
    const titleText = document.getElementById('generation-title-text');
    const statusText = document.getElementById('generation-status-text');
    const badgeStatus = document.getElementById('generation-badge-status');
    const counterBadge = document.getElementById('generation-counter-badge');
    const progressBar = document.getElementById('generation-progress-bar-container');

    if (progressBar) progressBar.classList.add('hidden');

    if (success && count > 0) {
        if (titleText) titleText.textContent = "Flashcards gerados com sucesso!";
        if (statusText) statusText.textContent = `${count} cards prontos. Você já pode estudar ou pedir edições pelo Assistente de IA.`;
        if (badgeStatus) {
            badgeStatus.className = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-b from-green-50 to-green-100/90 text-green-700 border border-green-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
            badgeStatus.innerHTML = '✓ CONCLUÍDO';
        }
        if (counterBadge) {
            counterBadge.className = "text-xs font-semibold text-green-700 bg-gradient-to-b from-green-50 to-green-100/80 px-3 py-1 rounded-full border border-green-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
            counterBadge.textContent = `${count} cards`;
        }

        setTimeout(() => {
            if (bannerContainer && !isGeneratingCards) {
                bannerContainer.classList.add('opacity-0', 'scale-95');
                setTimeout(() => {
                    bannerContainer.classList.add('hidden');
                    bannerContainer.classList.remove('opacity-0', 'scale-95');
                }, 400);
            }
        }, 4000);
    } else {
        if (titleText) titleText.textContent = "Geração não concluída";
        if (statusText) statusText.textContent = "Não foi possível extrair cards automaticamente. Verifique os arquivos enviados ou tente novamente.";
        if (badgeStatus) {
            badgeStatus.className = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-b from-red-50 to-red-100/90 text-red-700 border border-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
            badgeStatus.innerHTML = '⚠ ATENÇÃO';
        }
    }
}

// --- DYNAMIC BORDER RADIUS FOR CARDS LIST (M3 CONNECTED DECK) ---
// Configures first, mid, last, or single shapes based on contiguous card groups
function updateCardsBorderRadius() {
    if (!cardsList) return;
    const children = Array.from(cardsList.children);
    let currentGroup = [];

    function applyGroupRadii(group) {
        if (group.length === 0) return;
        if (group.length === 1) {
            group[0].classList.remove('m3-card-shape-first', 'm3-card-shape-mid', 'm3-card-shape-last');
            group[0].classList.add('m3-card-shape-single');
        } else {
            group.forEach((cardEl, idx) => {
                cardEl.classList.remove('m3-card-shape-single', 'm3-card-shape-first', 'm3-card-shape-mid', 'm3-card-shape-last');
                if (idx === 0) {
                    cardEl.classList.add('m3-card-shape-first');
                } else if (idx === group.length - 1) {
                    cardEl.classList.add('m3-card-shape-last');
                } else {
                    cardEl.classList.add('m3-card-shape-mid');
                }
            });
        }
    }

    children.forEach(child => {
        if (child.classList && child.classList.contains('flashcard-item')) {
            currentGroup.push(child);
        } else if (child.classList && child.classList.contains('deck-divisor-item')) {
            applyGroupRadii(currentGroup);
            currentGroup = [];
        }
    });
    applyGroupRadii(currentGroup);
}

// --- APPEND NEW CARD WITH PHYSICAL ELASTIC COLLISION & AUTO-SCROLL ---
// Card enters from below, strikes previous card with elastic shock and damping, view scrolls down
function appendNewCardWithElasticCollision(cardItem) {
    deckCards.push(cardItem);
    const playableCount = deckCards.filter(c => c.type !== 'divisor' && c.type !== 'divider' && c.type !== 'note').length;
    deckSizeBadge.textContent = playableCount;

    // Clean up skeleton or empty state if present
    const skeleton = document.getElementById('cards-skeleton-loader');
    if (skeleton) skeleton.remove();
    const emptyState = cardsList.querySelector('.text-center');
    if (emptyState) emptyState.remove();

    // Identify previous last card element before appending
    const prevLastEl = cardsList.lastElementChild;

    const newIndex = deckCards.length - 1;
    let newEl;
    if (cardItem.type === 'divisor' || cardItem.type === 'divider' || cardItem.type === 'note') {
        newEl = createDivisorElement(cardItem, newIndex);
    } else {
        newEl = createCardElement(cardItem, newIndex);
    }

    // Set entrance animation class (entering from bottom with overshoot)
    newEl.classList.remove('card-enter-anim');
    newEl.classList.add('m3-card-elastic-in');
    newEl.addEventListener('animationend', () => {
        newEl.classList.remove('m3-card-elastic-in');
    }, { once: true });

    cardsList.appendChild(newEl);

    // If there was an existing card directly above, deliver elastic collision shock!
    if (prevLastEl) {
        prevLastEl.classList.remove('m3-card-elastic-collision-hit', 'm3-card-elastic-in');
        void prevLastEl.offsetWidth; // Force reflow to guarantee CSS keyframe plays
        prevLastEl.classList.add('m3-card-elastic-collision-hit');
        prevLastEl.addEventListener('animationend', () => {
            prevLastEl.classList.remove('m3-card-elastic-collision-hit');
        }, { once: true });
    }

    // Recalculate dynamic border radius so first, mid, and last shapes morph seamlessly
    updateCardsBorderRadius();

    // Smoothly scroll down so the user clearly sees the physical collision and damping unfold
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    requestAnimationFrame(() => {
        cardsList.scrollTo({
            top: cardsList.scrollHeight,
            behavior: scrollBehavior
        });
        newEl.scrollIntoView({
            behavior: scrollBehavior,
            block: 'nearest'
        });
    });

    return newEl;
}

// --- RENDER CARDS LIST IN EDITOR VIEW ---
function renderCardsList(fullReRender = false) {
    const playableCount = deckCards.filter(c => c.type !== 'divisor' && c.type !== 'divider' && c.type !== 'note').length;
    deckSizeBadge.textContent = playableCount;

    if (deckCards.length === 0) {
        if (isGeneratingCards) {
            cardsList.innerHTML = `
                <div id="cards-skeleton-loader" class="flex flex-col gap-3">
                    <div class="bg-white border border-gray-200/80 p-4 rounded-xl shadow-sm relative overflow-hidden flex flex-col gap-3 animate-pulse">
                        <div class="flex justify-between items-center">
                            <div class="h-3 w-20 bg-gray-200 rounded-md"></div>
                            <div class="h-4 w-16 bg-purple-100 rounded"></div>
                        </div>
                        <div class="space-y-2">
                            <div class="h-4 bg-gray-200 rounded-md w-5/6"></div>
                            <div class="h-4 bg-gray-100 rounded-md w-3/5"></div>
                        </div>
                        <div class="h-4 bg-green-100 rounded-md w-2/5 mt-1"></div>
                    </div>
                    <div class="bg-white border border-gray-200/80 p-4 rounded-xl shadow-sm relative overflow-hidden flex flex-col gap-3 animate-pulse opacity-75">
                        <div class="flex justify-between items-center">
                            <div class="h-3 w-20 bg-gray-200 rounded-md"></div>
                            <div class="h-4 w-24 bg-blue-100 rounded"></div>
                        </div>
                        <div class="space-y-2">
                            <div class="h-4 bg-gray-200 rounded-md w-11/12"></div>
                            <div class="h-4 bg-gray-100 rounded-md w-2/3"></div>
                        </div>
                        <div class="h-4 bg-green-100 rounded-md w-1/3 mt-1"></div>
                    </div>
                    <div class="bg-white border border-gray-200/80 p-4 rounded-xl shadow-sm relative overflow-hidden flex flex-col gap-3 animate-pulse opacity-50">
                        <div class="flex justify-between items-center">
                            <div class="h-3 w-20 bg-gray-200 rounded-md"></div>
                            <div class="h-4 w-20 bg-indigo-100 rounded"></div>
                        </div>
                        <div class="space-y-2">
                            <div class="h-4 bg-gray-200 rounded-md w-4/5"></div>
                            <div class="h-4 bg-gray-100 rounded-md w-1/2"></div>
                        </div>
                        <div class="h-4 bg-green-100 rounded-md w-1/4 mt-1"></div>
                    </div>
                </div>
            `;
            return;
        } else {
            cardsList.innerHTML = `
                <div class="text-center py-12 text-gray-400">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    <p class="font-medium text-sm">Nenhum cartão no baralho ainda.</p>
                    <p class="text-xs mt-1">Crie um novo cartão ao lado ou peça ao Assistente de IA.</p>
                </div>
            `;
            return;
        }
    }

    // Clean up skeleton or empty state if present
    const skeleton = document.getElementById('cards-skeleton-loader');
    if (skeleton) skeleton.remove();
    if (cardsList.querySelector('.text-center')) {
        cardsList.innerHTML = '';
    }

    if (fullReRender) {
        cardsList.innerHTML = '';
    }

    const currentCount = cardsList.children.length;
    for (let i = currentCount; i < deckCards.length; i++) {
        const item = deckCards[i];
        if (item.type === 'divisor' || item.type === 'divider' || item.type === 'note') {
            const divisorEl = createDivisorElement(item, i);
            cardsList.appendChild(divisorEl);
        } else {
            const cardEl = createCardElement(item, i);
            cardsList.appendChild(cardEl);
        }
    }

    updateCardsBorderRadius();
}

function createDivisorElement(divisor, index) {
    const divisorEl = document.createElement('div');
    divisorEl.className = "py-2 px-1 flex items-center gap-3 relative group transition select-none deck-divisor-item card-enter-anim";
    divisorEl.dataset.index = index;

    const leftLine = document.createElement('div');
    leftLine.className = "h-px bg-gray-300 flex-grow";

    const textSpan = document.createElement('div');
    textSpan.className = "flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-lg border border-gray-200 text-xs sm:text-sm font-semibold text-gray-600 shadow-sm max-w-[85%]";

    const hashTag = document.createElement('span');
    hashTag.className = "text-blue-500 font-mono font-bold text-xs select-none";
    hashTag.textContent = "#";

    const labelSpan = document.createElement('span');
    labelSpan.className = "truncate";
    labelSpan.textContent = divisor.text || divisor.description || 'Comentário';
    labelSpan.title = divisor.text || divisor.description || '';

    textSpan.appendChild(hashTag);
    textSpan.appendChild(labelSpan);

    const rightLine = document.createElement('div');
    rightLine.className = "h-px bg-gray-300 flex-grow";

    // Action buttons on hover (edit & delete)
    const actionsDiv = document.createElement('div');
    actionsDiv.className = "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0";

    const editBtn = document.createElement('button');
    editBtn.className = "p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition";
    editBtn.title = "Editar comentário";
    editBtn.innerHTML = '<img src="../assets/img/edit.svg" class="w-3.5 h-3.5" alt="Editar">';
    editBtn.onclick = () => {
        const currentText = divisor.text || divisor.description || '';
        const newText = prompt('Editar texto do comentário:', currentText);
        if (newText !== null && newText.trim() !== '') {
            divisor.text = newText.trim();
            divisor.description = newText.trim();
            renderCardsList(true);
        }
    };

    const delBtn = document.createElement('button');
    delBtn.className = "p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition";
    delBtn.title = "Excluir comentário";
    delBtn.innerHTML = '<img src="../assets/img/delete.svg" class="w-3.5 h-3.5" alt="Excluir">';
    delBtn.onclick = () => {
        deckCards.splice(index, 1);
        renderCardsList(true);
    };

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(delBtn);

    divisorEl.appendChild(leftLine);
    divisorEl.appendChild(textSpan);
    divisorEl.appendChild(rightLine);
    divisorEl.appendChild(actionsDiv);

    return divisorEl;
}

function createCardElement(card, index) {
    const cardEl = document.createElement('div');
    cardEl.className = "bg-white border border-gray-200 p-4 relative group shadow-sm flex flex-col gap-2 transition flashcard-item card-enter-anim";
    cardEl.dataset.index = index;

    const typeBadge = document.createElement('span');
    typeBadge.className = "absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded";

    if (card.type === 'anki') {
        typeBadge.className += " bg-indigo-100 text-indigo-800";
        typeBadge.textContent = "Anki";
    } else if (card.type === 'multiple_choice') {
        typeBadge.className += " bg-purple-100 text-purple-800";
        typeBadge.textContent = "Multipla escolha";
    } else if (card.type === 'open_double') {
        typeBadge.className += " bg-amber-100 text-amber-800";
        typeBadge.textContent = "Escrever duplo";
    } else if (card.type === 'fill') {
        typeBadge.className += " bg-teal-100 text-teal-800";
        const count = Array.isArray(card.answers) && card.answers.length > 0 ? card.answers.length : (card.answer ? card.answer.split(';').length : 1);
        typeBadge.textContent = `Preencher (${count})`;
    } else {
        typeBadge.className += " bg-gray-100 text-gray-700";
        typeBadge.textContent = "Escrever";
    }
    cardEl.appendChild(typeBadge);

    const descLabel = card.type === 'anki' ? 'Frente:' : (card.type === 'fill' ? 'Frase:' : 'P:');
    let descContent = card.description || '(Sem texto)';
    if (card.type === 'anki') {
        descContent = `<div class="anki-markdown-content text-gray-800 mt-0.5">${renderMathAndMarkdown(descContent)}</div>`;
    } else if (card.type === 'fill') {
        const blankRegex = /(?:\[\s*_{1,}\s*\]|(?<![a-zA-Z0-9\u00C0-\u017F])_{1,}(?![a-zA-Z0-9\u00C0-\u017F]))/g;
        let blankIndex = 0;
        const escaped = descContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const highlighted = escaped.replace(blankRegex, () => {
            blankIndex++;
            return `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-mono text-xs font-bold border border-teal-300">[${blankIndex}]</span>`;
        });
        descContent = `<span class="text-gray-800">${highlighted}</span>`;
    } else {
        descContent = `<span class="text-gray-800">${renderMathAndMarkdown(descContent)}</span>`;
    }
    const descStr = `<strong>${descLabel}</strong> ${descContent}`;
    let ansStr = `<strong>R:</strong> <span class="text-green-600">${card.answer || ''}</span>`;

    if (card.type === 'open_double') {
        ansStr += `<br><strong>R2:</strong> <span class="text-green-600">${card.answer2 || ''}</span>`;
    } else if (card.type === 'multiple_choice') {
        const optsList = (card.options || []).map(opt => {
            const isCorrect = opt === card.answer;
            return isCorrect ? `<strong class="text-green-600">✓ ${opt}</strong>` : opt;
        }).join(' | ');
        ansStr = `<span class="text-xs text-gray-500">Opções: ${optsList}</span>`;
    } else if (card.type === 'anki') {
        const renderedAns = renderMathAndMarkdown(card.answer || '');
        ansStr = `<strong>Verso:</strong> <div class="anki-markdown-content text-indigo-600 mt-1">${renderedAns}</div>`;
    } else if (card.type === 'fill') {
        const answers = Array.isArray(card.answers) && card.answers.length > 0 
            ? card.answers 
            : (card.answer ? card.answer.split(';').map(a => a.trim()).filter(Boolean) : []);
        if (answers.length > 0) {
            const badges = answers.map((a, i) => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold"><span class="text-teal-500 font-mono text-[10px]">${i + 1}:</span> ${a}</span>`).join(' ');
            ansStr = `<strong>Lacunas:</strong> <div class="inline-flex flex-wrap gap-1 mt-1">${badges}</div>`;
        } else {
            ansStr = `<strong>Lacunas:</strong> <span class="text-yellow-600 text-xs">Nenhuma resposta definida</span>`;
        }
    }

    const textCont = document.createElement('div');
    textCont.innerHTML = `<div class="mb-2 text-sm mt-3 pr-20">${descStr}</div><div class="text-sm">${ansStr}</div>`;
    cardEl.appendChild(textCont);

    // Question Image
    if (card.image) {
        const imgDiv = document.createElement('div');
        imgDiv.className = "w-full max-h-32 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center p-1 mt-1";
        imgDiv.innerHTML = `<img src="${card.image}" alt="Imagem" class="max-h-28 w-auto object-contain rounded">`;
        cardEl.appendChild(imgDiv);
    }

    // Answer Image (Anki)
    if (card.answerImage) {
        const ansImgDiv = document.createElement('div');
        ansImgDiv.className = "w-full max-h-32 overflow-hidden rounded-lg border border-indigo-200 bg-indigo-50/50 flex items-center justify-center p-1 mt-1";
        ansImgDiv.innerHTML = `<img src="${card.answerImage}" alt="Imagem Resposta" class="max-h-28 w-auto object-contain rounded">`;
        cardEl.appendChild(ansImgDiv);
    }

    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = "absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity";

    const editBtn = document.createElement('button');
    editBtn.className = "p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg";
    editBtn.innerHTML = '<img src="../assets/img/edit.svg" class="w-4 h-4" alt="Editar">';
    editBtn.onclick = () => openInlineEditModal(index);

    const delBtn = document.createElement('button');
    delBtn.className = "p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg";
    delBtn.innerHTML = '<img src="../assets/img/delete.svg" class="w-4 h-4" alt="Excluir">';
    delBtn.onclick = () => {
        if (confirm('Excluir este flashcard permanentemente?')) {
            deckCards.splice(index, 1);
            renderCardsList(true);
        }
    };

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(delBtn);
    cardEl.appendChild(actionsDiv);

    return cardEl;
}

addCardBtn.addEventListener('click', () => {
    switchSidebarTab('creator');
    creatorQuestion.focus();
});

// --- INLINE EDIT MODAL (FOR ALL TYPES) ---
function openInlineEditModal(index) {
    const card = deckCards[index];
    if (!card) return;

    editCardIndex.value = index;
    editCardType.value = card.type || 'open';
    editCardDesc.value = card.description || '';

    // Show/hide groups based on type
    const t = card.type || 'open';
    editCardAns1Group.classList.toggle('hidden', t === 'anki' || t === 'multiple_choice' || t === 'fill');
    editCardAns2Group.classList.toggle('hidden', t !== 'open_double');
    if (editCardFillGroup) editCardFillGroup.classList.toggle('hidden', t !== 'fill');
    editCardAnkiGroup.classList.toggle('hidden', t !== 'anki');
    editCardMcGroup.classList.toggle('hidden', t !== 'multiple_choice');
    inlineEditAnsImageGroup.classList.toggle('hidden', t !== 'anki');

    if (t === 'open') {
        editCardAns1Label.textContent = "Resposta Principal";
        editCardAns1.value = card.answer || '';
    } else if (t === 'open_double') {
        editCardAns1Label.textContent = "Resposta 1";
        editCardAns1.value = card.answer || '';
        editCardAns2.value = card.answer2 || '';
    } else if (t === 'anki') {
        editCardAnkiAnswer.value = card.answer || '';
    } else if (t === 'multiple_choice') {
        renderInlineEditMcOptions(card.options || ["", "", "", ""], card.answer);
    } else if (t === 'fill') {
        if (editCardFillAnswer) {
            const answers = Array.isArray(card.answers) && card.answers.length > 0 
                ? card.answers.join('; ') 
                : (card.answer || '');
            editCardFillAnswer.value = answers;
        }
    }

    pendingInlineEditQImage = card.image || '';
    inlineEditImageUrl.value = pendingInlineEditQImage;
    if (pendingInlineEditQImage) {
        inlineEditImagePreview.src = pendingInlineEditQImage;
        inlineEditImagePreviewContainer.classList.remove('hidden');
    } else {
        inlineEditImagePreviewContainer.classList.add('hidden');
    }

    pendingInlineEditAnsImage = card.answerImage || '';
    inlineEditAnsImageUrl.value = pendingInlineEditAnsImage;
    if (pendingInlineEditAnsImage) {
        inlineEditAnsImagePreview.src = pendingInlineEditAnsImage;
        inlineEditAnsImagePreviewContainer.classList.remove('hidden');
    } else {
        inlineEditAnsImagePreviewContainer.classList.add('hidden');
    }

    inlineEditModal.classList.remove('hidden');
}

function renderInlineEditMcOptions(options, correctAnswer) {
    editCardMcList.innerHTML = '';
    options.forEach((optText, i) => {
        const isCorrect = optText === correctAnswer;
        const row = document.createElement('div');
        row.className = "flex items-center gap-2";
        row.innerHTML = `
            <input type="radio" name="inline-edit-mc-correct" value="${i}" ${isCorrect ? 'checked' : ''} class="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer">
            <input type="text" class="inline-edit-mc-opt-val flex-1 p-2 bg-gray-50 border border-gray-300 rounded-lg text-sm" value="${optText}">
            <button type="button" class="inline-edit-remove-opt-btn p-1 text-gray-400 hover:text-red-500 transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        const removeBtn = row.querySelector('.inline-edit-remove-opt-btn');
        removeBtn.addEventListener('click', () => {
            const currentVals = Array.from(document.querySelectorAll('.inline-edit-mc-opt-val')).map(inp => inp.value);
            if (currentVals.length <= 2) {
                alert("Mínimo de 2 alternativas.");
                return;
            }
            currentVals.splice(i, 1);
            renderInlineEditMcOptions(currentVals, correctAnswer);
        });
        editCardMcList.appendChild(row);
    });

    editCardAddMcOptBtn.classList.toggle('hidden', options.length >= 6);
}

editCardAddMcOptBtn.addEventListener('click', () => {
    const currentVals = Array.from(document.querySelectorAll('.inline-edit-mc-opt-val')).map(inp => inp.value);
    if (currentVals.length >= 6) return;
    currentVals.push("");
    const checkedRadio = document.querySelector('input[name="inline-edit-mc-correct"]:checked');
    const correctIdx = checkedRadio ? parseInt(checkedRadio.value) : 0;
    const curCorrect = currentVals[correctIdx] || "";
    renderInlineEditMcOptions(currentVals, curCorrect);
});

// Inline Edit Image Listeners
inlineEditImageUrl.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    pendingInlineEditQImage = url;
    if (url) {
        inlineEditImagePreview.src = url;
        inlineEditImagePreviewContainer.classList.remove('hidden');
    } else {
        inlineEditImagePreview.src = '';
        inlineEditImagePreviewContainer.classList.add('hidden');
    }
});
inlineEditRemoveImageBtn.addEventListener('click', () => {
    pendingInlineEditQImage = '';
    inlineEditImageUrl.value = '';
    inlineEditImagePreview.src = '';
    inlineEditImagePreviewContainer.classList.add('hidden');
});

inlineEditAnsImageUrl.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    pendingInlineEditAnsImage = url;
    if (url) {
        inlineEditAnsImagePreview.src = url;
        inlineEditAnsImagePreviewContainer.classList.remove('hidden');
    } else {
        inlineEditAnsImagePreview.src = '';
        inlineEditAnsImagePreviewContainer.classList.add('hidden');
    }
});
inlineEditRemoveAnsImageBtn.addEventListener('click', () => {
    pendingInlineEditAnsImage = '';
    inlineEditAnsImageUrl.value = '';
    inlineEditAnsImagePreview.src = '';
    inlineEditAnsImagePreviewContainer.classList.add('hidden');
});

closeInlineEditBtn.addEventListener('click', () => inlineEditModal.classList.add('hidden'));
cancelInlineEditBtn.addEventListener('click', () => inlineEditModal.classList.add('hidden'));

saveInlineEditBtn.addEventListener('click', () => {
    const idx = parseInt(editCardIndex.value);
    if (idx < 0 || !deckCards[idx]) return;

    const card = deckCards[idx];
    card.description = editCardDesc.value.trim();

    if (pendingInlineEditQImage) card.image = pendingInlineEditQImage;
    else delete card.image;

    if (card.type === 'open') {
        card.answer = editCardAns1.value.trim();
    } else if (card.type === 'open_double') {
        card.answer = editCardAns1.value.trim();
        card.answer2 = editCardAns2.value.trim();
    } else if (card.type === 'anki') {
        card.answer = editCardAnkiAnswer.value.trim();
        if (pendingInlineEditAnsImage) card.answerImage = pendingInlineEditAnsImage;
        else delete card.answerImage;
    } else if (card.type === 'multiple_choice') {
        const optInputs = Array.from(document.querySelectorAll('.inline-edit-mc-opt-val'));
        const options = optInputs.map(inp => inp.value.trim()).filter(Boolean);
        const checkedRadio = document.querySelector('input[name="inline-edit-mc-correct"]:checked');
        const correctIdx = checkedRadio ? parseInt(checkedRadio.value) : 0;
        card.options = options;
        card.answer = optInputs[correctIdx]?.value.trim() || options[0];
    } else if (card.type === 'fill') {
        const rawAns = editCardFillAnswer ? editCardFillAnswer.value.trim() : '';
        const answers = rawAns.split(';').map(a => a.trim()).filter(Boolean);
        card.answers = answers;
        card.answer = answers.join('; ');
    }

    renderCardsList(true);
    inlineEditModal.classList.add('hidden');
});

// --- AI CHAT INTEGRATION ---
function addChatMessage(role, text) {
    const msg = document.createElement('div');
    const safeText = String(text || '');
    if (role === 'user') {
        msg.className = 'py-2 px-4 rounded-xl max-w-[85%] text-sm self-end bg-purple-600 text-white rounded-tr-sm break-words';
        msg.textContent = safeText;
    } else {
        msg.className = 'py-2.5 px-4 rounded-xl max-w-[88%] text-sm self-start bg-gray-200 text-gray-800 rounded-tl-sm chat-markdown-content break-words shadow-sm';
        try {
            msg.innerHTML = renderMathAndMarkdown(safeText);
        } catch (err) {
            console.error('Error rendering markdown in chat message:', err);
            msg.textContent = safeText;
        }
    }
    chatHistory.appendChild(msg);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

chatSendBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    const apiKey = getApiKey();
    if (!apiKey) {
        addChatMessage('model', 'Por favor, insira sua API Key para usar o assistente.');
        openApiKeyModalBtn.click();
        return;
    }

    if (!geminiChatSession) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: currentEditorModel,
            systemInstruction,
            tools: deckTools
        });
        currentGenModel = model;
        geminiChatSession = model.startChat({ history: [] });
    }

    chatInput.value = '';
    addChatMessage('user', text);

    chatInput.disabled = true;
    chatSendBtn.disabled = true;
    chatSpinner.classList.remove('hidden');
    showChatTypingIndicator();

    try {
        const contextLines = deckCards.map((c, i) => {
            if (c.type === 'divisor' || c.type === 'divider' || c.type === 'note') {
                return `[${i}] (divisor) # ${c.text || c.description || ''}`;
            }
            return `[${i}] (${c.type}) ${(c.description || '').substring(0, 60)}... | R: ${c.answer || ''}`;
        }).join('\n');
        const enrichedPrompt = `ATENÇÃO: O estado atual do baralho é:\n${contextLines}\n\nComando do Usuário: ${text}`;

        let result = await callWithRetry(() => geminiChatSession.sendMessage(enrichedPrompt));
        let response = result.response;

        for (let i = 0; i < 5; i++) {
            const candidate = response.candidates[0];
            const calls = candidate.content.parts.filter(p => !!p.functionCall);
            if (calls.length === 0) break;

            const functionResponses = calls.map(call => {
                const { name, args } = call.functionCall;
                const output = toolFunctions[name] ? toolFunctions[name](args) : { error: "Função não encontrada" };
                return {
                    functionResponse: { name, response: output }
                };
            });

            result = await callWithRetry(() => geminiChatSession.sendMessage(functionResponses));
            sanitizeChatHistory(geminiChatSession);
            response = result.response;
        }

        const modelText = response.text();
        hideChatTypingIndicator();
        addChatMessage('model', modelText || 'Ação realizada com sucesso.');

    } catch (e) {
        console.error(e);
        hideChatTypingIndicator();
        addChatMessage('model', `Erro ao processar: ${e.message}`);
    } finally {
        hideChatTypingIndicator();
        chatInput.disabled = false;
        chatSendBtn.disabled = false;
        chatSpinner.classList.add('hidden');
    }
});

chatInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') chatSendBtn.click();
});

// --- SAVE & PLAY DECK ---
downloadDeckBtn.addEventListener('click', () => {
    if (deckCards.length === 0) return;
    const jsonStr = JSON.stringify(deckCards, null, 4);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = deckTitleDisplay.value.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `${safeTitle || 'flashcards'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

playDeckBtn.addEventListener('click', () => {
    const playableCards = deckCards.filter(c => c.type !== 'divisor' && c.type !== 'divider' && c.type !== 'note');
    if (playableCards.length === 0) {
        alert("Adicione pelo menos um cartão antes de jogar.");
        return;
    }

    const title = deckTitleDisplay.value;
    const gameState = {
        questionsPool: [...playableCards],
        allQuestions: [...deckCards],
        score: 0,
        deckTitle: title
    };

    try {
        if (title === "Caderno") {
            localStorage.setItem('flashcardsNotebook', JSON.stringify(gameState));
            localStorage.setItem('flashcardsActiveMode', 'notebook');
        } else {
            localStorage.setItem('flashcardsSave', JSON.stringify(gameState));
            localStorage.setItem('flashcardsActiveMode', 'normal');
        }
        window.location.href = 'game.html';
    } catch (err) {
        if (err.name === 'QuotaExceededError') {
            alert("Erro de espaço: o baralho é grande demais para salvar no navegador (provavelmente contém imagens locais antigas). Por favor, use links de imagem da web.");
        } else {
            alert("Erro ao iniciar jogo: " + err.message);
        }
    }
});

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', async () => {
    checkAndResetModelFallback();
    await getApiKeyAsync();
    updateApiKeyStatusUI();

    // Check if loading an existing deck for editing
    const savedDeck = localStorage.getItem('editing_deck');
    const savedTitle = localStorage.getItem('editing_deck_title');

    if (savedDeck) {
        try {
            deckCards = JSON.parse(savedDeck);
            const displayTitle = savedTitle || "Flashcards";
            deckTitleDisplay.value = displayTitle;
            document.title = `${displayTitle} | Editor`;

            openEditorView('creator');

            localStorage.removeItem('editing_deck');
            localStorage.removeItem('editing_deck_title');
        } catch (e) {
            console.error("Erro ao carregar deck salvo:", e);
        }
    }
});
