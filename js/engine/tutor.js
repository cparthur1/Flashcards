/**
 * js/engine/tutor.js
 * Módulo de Inteligência Artificial: cliente do Google Gemini,
 * avaliação semântica de respostas, tutor virtual para chat interativo
 * e formatação de respostas didáticas com KaTeX/Markdown.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { callWithRetry, renderMathAndMarkdown } from '../utils.js';

let isAiEnabled = false;
let geminiApiKey = null;
let genAI = null;
let lastUserAnswerForChat = "";
let currentChatSession = null;
let currentChatModel = "gemini-flash-lite-latest";
let ai503ErrorCount = 0;
let lastLatencyNotificationTime = 0;
let hasChatInteraction = false;

export function isTutorEnabled() {
    return isAiEnabled;
}

export function setTutorApiKey(key) {
    geminiApiKey = key ? String(key).trim() : null;
    if (geminiApiKey) {
        genAI = new GoogleGenerativeAI(geminiApiKey);
        isAiEnabled = true;
    } else {
        genAI = null;
        isAiEnabled = false;
    }
}

export function disableTutor() {
    isAiEnabled = false;
    geminiApiKey = null;
    genAI = null;
    currentChatSession = null;
}

export function initTutor({ apiKey } = {}) {
    if (apiKey) {
        setTutorApiKey(apiKey);
    }
}

export function updateTutorUI(elements = {}) {
    const menuAiIcon = elements.menuAiIcon || document.getElementById('menu-ai-icon');
    const menuAiStatusBadge = elements.menuAiStatusBadge || document.getElementById('menu-ai-status-badge');
    const menuAiSubtitle = elements.menuAiSubtitle || document.getElementById('menu-ai-subtitle');
    const aiIconOff = elements.aiIconOff || document.getElementById('ai-icon-off');
    const aiIconOn = elements.aiIconOn || document.getElementById('ai-icon-on');
    const aiSwitch = elements.aiSwitch || document.getElementById('ai-switch');

    if (isAiEnabled) {
        if (menuAiIcon) menuAiIcon.src = '../assets/img/enabled_ai.svg';
        if (menuAiStatusBadge) {
            menuAiStatusBadge.textContent = 'Ativada';
            menuAiStatusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700';
        }
        if (menuAiSubtitle) menuAiSubtitle.textContent = 'Verificação inteligente ativa';
        if (aiIconOff) aiIconOff.classList.add('hidden');
        if (aiIconOn) aiIconOn.classList.remove('hidden');
        if (aiSwitch) aiSwitch.selected = true;
    } else {
        if (menuAiIcon) menuAiIcon.src = '../assets/img/config_ai.svg';
        if (menuAiStatusBadge) {
            menuAiStatusBadge.textContent = 'Desativada';
            menuAiStatusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500';
        }
        if (menuAiSubtitle) menuAiSubtitle.textContent = 'Clique para configurar';
        if (aiIconOff) aiIconOff.classList.remove('hidden');
        if (aiIconOn) aiIconOn.classList.add('hidden');
        if (aiSwitch) aiSwitch.selected = false;
    }
}

export function setLastUserAnswerForChat(ans) {
    lastUserAnswerForChat = ans || "";
}

export function getLastUserAnswerForChat() {
    return lastUserAnswerForChat;
}

export function resetTutorChatSession() {
    currentChatSession = null;
}

export function getHasChatInteraction() {
    return hasChatInteraction;
}

export function setHasChatInteraction(val) {
    hasChatInteraction = Boolean(val);
}

/**
 * Avalia semanticamente se a resposta digitada pelo usuário está correta
 * usando modelo Gemini com saída estruturada em JSON.
 * 
 * @param {Object} options
 * @param {Object} options.questionObj - O cartão atual
 * @param {string} options.actualAnswer - Resposta digitada pelo usuário
 * @param {Function} [options.onSlowConnection] - Callback quando latência > 15s
 * @param {Function} [options.onAiDisabledByErrors] - Callback quando múltiplos erros 503 ocorrem
 * @returns {Promise<{correto: boolean, justificativa: string}|null>}
 */
export async function evaluateAnswerSemantic({ questionObj, actualAnswer, onSlowConnection, onAiDisabledByErrors }) {
    if (!isAiEnabled || !genAI || !questionObj) return null;

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-lite-latest",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        correto: {
                            type: "BOOLEAN",
                            description: "true se a resposta do usuário for semanticamente correta ou variação aceitável, false se estiver incorreta ou contiver erros factuais."
                        },
                        justificativa: {
                            type: "STRING",
                            description: "Breve explicação do porquê a resposta foi considerada correta ou incorreta."
                        }
                    },
                    required: ["correto", "justificativa"]
                }
            }
        });

        const expected = (questionObj.type === 'fill' && questionObj.answers && questionObj.answers.length > 0)
            ? questionObj.answers.join(' ; ')
            : [questionObj.answer, questionObj.answer2].filter(Boolean).join(' / ');

        const prompt = `
            Você é um revisor de flashcards acadêmicos rigoroso. 
            O sistema automático marcou a resposta do usuário como incorreta. Avalie se a resposta digitada é semanticamente válida ou uma variação aceitável em relação à resposta esperada.

            Pergunta: "${questionObj.description}"
            Resposta(s) Esperada(s) no Banco: "${expected}"
            Resposta Digitada pelo Usuário: "${actualAnswer}"

            DIRETRIZES DE AVALIAÇÃO:
            1. Se o usuário usou um sinônimo exato, termo equivalente aceito pela comunidade acadêmica ou abreviação padrão, considere CORRETO (correto: true).
            2. Se o usuário digitou uma parte fundamental suficiente para demonstrar conhecimento técnico exato (ex: "Braquial" para "Músculo braquial"), considere CORRETO (correto: true).
            3. Se a questão pedir múltiplos valores, durações ou sequências (ex: em ordem ou 'respectivamente'), TODOS os valores/sequências devem estar corretos. Se qualquer valor numérico ou duração estiver incorreto (ex: 50 ms em vez de 40 ms, ou números errados na sequência), considere INCORRETO (correto: false).
            4. Se a resposta contiver erros factuais, dados numéricos incorretos, for vaga ou sobre outra estrutura, considere INCORRETO (correto: false).

            Retorne um JSON com 'correto' (boolean) e 'justificativa' (string).
        `;

        const startTime = Date.now();
        const result = await callWithRetry(() => model.generateContent(prompt));
        const latency = Date.now() - startTime;

        const modelVersion = result.response.modelVersion || "unknown";
        console.log(`[Tutor] Chamada Gemini executada com sucesso. Versão: ${modelVersion}, Latência: ${latency}ms`);

        if (latency > 15000) {
            const now = Date.now();
            if (now - lastLatencyNotificationTime > 10 * 60 * 1000) {
                lastLatencyNotificationTime = now;
                if (onSlowConnection) onSlowConnection();
            }
        }

        const responseText = result.response.text();
        let evalData = null;
        try {
            evalData = JSON.parse(responseText);
        } catch (parseErr) {
            console.error("[Tutor] Erro ao analisar JSON da avaliação IA:", parseErr, responseText);
            return null;
        }

        return evalData;
    } catch (e) {
        console.error("[Tutor] Erro na avaliação IA:", e);
        if (e.message && e.message.includes("503")) {
            ai503ErrorCount++;
            if (ai503ErrorCount >= 10) {
                isAiEnabled = false;
                if (onAiDisabledByErrors) onAiDisabledByErrors();
            }
        }
        return null;
    }
}

export function addMsg(sender, text, chatMessages) {
    const container = chatMessages || document.getElementById('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = sender === 'ai' ? 'chat-message-ai' : 'chat-message-user';

    if (sender === 'ai' && typeof marked !== 'undefined') {
        div.innerHTML = renderMathAndMarkdown(text);
    } else {
        div.textContent = text;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

export function showTyping(chatMessages) {
    const container = chatMessages || document.getElementById('chat-messages');
    if (!container) return null;

    const id = 't-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'typing-indicator';
    div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    container.appendChild(div);
    return id;
}

export function hideTyping(id) {
    if (id) document.getElementById(id)?.remove();
}

/**
 * Envia mensagem do usuário para o Tutor AI e exibe resposta.
 */
export async function sendTutorChatMessage({ msg, currentQuestion, chatInput, chatMessages }) {
    const text = (msg !== undefined ? msg : chatInput?.value || '').trim();
    const messagesContainer = chatMessages || document.getElementById('chat-messages');
    const inputElem = chatInput || document.getElementById('chat-input');

    if (!text || !isAiEnabled || !genAI || !currentQuestion) return;

    hasChatInteraction = true;
    addMsg('user', text, messagesContainer);
    if (inputElem) inputElem.value = '';

    const tid = showTyping(messagesContainer);
    try {
        if (!currentChatSession) {
            const correctAnswers = (currentQuestion.type === 'fill' && currentQuestion.answers && currentQuestion.answers.length > 0)
                ? [currentQuestion.answers.join(' ; ')]
                : [currentQuestion.answer];
            if (currentQuestion.type !== 'fill' && currentQuestion.answer2) correctAnswers.push(currentQuestion.answer2);

            const systemPrompt = `
                Você é um professor tutor ajudando um estudante com um flashcard.
                
                CONTEXTO DA QUESTÃO:
                Pergunta: "${currentQuestion.description}"
                Resposta(s) Correta(s) no Banco: "${correctAnswers.join(' / ')}"
                Resposta que o Usuário deu inicialmente: "${lastUserAnswerForChat}"
                
                Responda de forma didática, objetiva e curta. Se o usuário errou, explique o porquê de forma simples. Use Markdown para listas, tabelas, ênfase e fórmulas matemáticas/químicas em LaTeX ($...$ ou $$...$$).
                Mantenha o contexto desta questão durante toda a conversa.
            `;

            const model = genAI.getGenerativeModel({ model: currentChatModel, systemInstruction: systemPrompt });
            currentChatSession = model.startChat();
        }

        const result = await callWithRetry(() => currentChatSession.sendMessage(text));
        hideTyping(tid);
        addMsg('ai', result.response.text(), messagesContainer);
    } catch (e) {
        console.error("[Tutor] Erro no chat:", e);
        hideTyping(tid);
        if (e.message && (e.message.includes("429") || e.message.includes("quota"))) {
            addMsg('ai', "Erro de cota excedida na API do Gemini. Por favor, tente novamente mais tarde.", messagesContainer);
        } else {
            addMsg('ai', "Erro ao conectar com a IA.", messagesContainer);
        }
    }
}
