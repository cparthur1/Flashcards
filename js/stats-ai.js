/**
 * stats-ai.js
 * AI-powered deck and topic categorization using Gemini Flash-Lite with Function Calling.
 * Groups decks into broad subjects (matérias) and cards into specific topics (assuntos)
 * with the minimal possible number of categories for clear, aggregated analytics.
 */

const AI_CATEGORIES_KEY = 'flashcards_ai_categories';
const DEFAULT_MODEL = 'gemini-flash-lite-latest';
const FALLBACK_MODEL = 'gemini-flash-latest';

// Gemini Function Calling Schema
export const categorizeTool = {
    functionDeclarations: [
        {
            name: "salvar_categorizacao_estudos",
            description: "Salva a categorização consolidada de baralhos em matérias gerais e dos cartões em assuntos específicos com agrupamento máximo e o menor número possível de categorias.",
            parameters: {
                type: "OBJECT",
                properties: {
                    deckSubjects: {
                        type: "ARRAY",
                        description: "Mapeamento de cada baralho para uma matéria geral ampla agregadora (ex: Medicina, Semiologia, Farmacologia, Direito Constitucional, etc.).",
                        items: {
                            type: "OBJECT",
                            properties: {
                                deckTitle: { type: "STRING", description: "Nome exato do baralho fornecido" },
                                subject: { type: "STRING", description: "Nome da matéria ou disciplina ampla de alto nível" }
                            },
                            required: ["deckTitle", "subject"]
                        }
                    },
                    cardTopics: {
                        type: "ARRAY",
                        description: "Mapeamento de cada cartão do baralho atual para um assunto/tópico conciso (agrupado ao máximo, agrupando cartões correlatos no mesmo tema).",
                        items: {
                            type: "OBJECT",
                            properties: {
                                cardIndex: { type: "NUMBER", description: "Índice numérico do cartão (0 a N-1)" },
                                topic: { type: "STRING", description: "Nome do assunto conciso agrupador (ex: Valvopatias, Eletrocardiograma, Arritmias, etc.)" }
                            },
                            required: ["cardIndex", "topic"]
                        }
                    }
                },
                required: ["deckSubjects", "cardTopics"]
            }
        }
    ]
};

export function getStoredAiCategories() {
    try {
        const raw = localStorage.getItem(AI_CATEGORIES_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.error("Erro ao ler categorias de IA do localStorage:", e);
        return null;
    }
}

export function saveStoredAiCategories(data) {
    try {
        localStorage.setItem(AI_CATEGORIES_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("Erro ao salvar categorias de IA no localStorage:", e);
    }
}

/**
 * Calls Gemini Flash-Lite using Function Calling to categorize all decks and current cards at once.
 */
export async function callGeminiFlashLiteCategorization({
    apiKey,
    currentDeckTitle,
    deckTitles,
    cards,
    existingCategories
}) {
    if (!apiKey) {
        throw new Error("Gemini API Key não informada.");
    }

    // Clean and truncate cards for prompt efficiency
    const formattedCards = (cards || []).map((c, idx) => {
        const cleanDesc = (c.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 120);
        const cleanAns = (c.answer || '').replace(/<[^>]*>/g, '').trim().slice(0, 80);
        return {
            index: idx,
            text: `${cleanDesc}${cleanAns ? ` | R: ${cleanAns}` : ''}`
        };
    });

    const knownSubjects = existingCategories?.knownSubjects || [];
    const knownTopics = existingCategories?.knownTopicsByDeck?.[currentDeckTitle] || [];

    const promptText = `Você é um classificador pedagógico de alta eficiência.
Sua missão é classificar os baralhos em Matérias/Disciplinas amplas e classificar os cartões do baralho atual em Assuntos/Tópicos específicos.

BARALHOS PARA CATEGORIZAR EM MATÉRIAS:
${JSON.stringify(deckTitles, null, 2)}

CARTÕES DO BARALHO ATUAL ("${currentDeckTitle}") PARA CATEGORIZAR EM ASSUNTOS:
${JSON.stringify(formattedCards, null, 2)}

CATEGORIAS JÁ EXISTENTES PARA REUTILIZAR E MANTER O AGRUPAMENTO CONSISTENTE:
- Matérias já existentes no histórico: ${JSON.stringify(knownSubjects)}
- Assuntos já existentes para este baralho: ${JSON.stringify(knownTopics)}

REGRAS CRÍTICAS E OBRIGATÓRIAS:
1. MENOR NÚMERO POSSÍVEL DE CATEGORIAS: Agrupe ao máximo! Utilize temas consolidados e amplos (por exemplo: agrupe baralhos de cardiologia, nefrologia e pneumologia em 'Medicina Clínica' ou 'Medicina', a menos que haja necessidade clara de separar; agrupe perguntas semelhantes no mesmo assunto). Evite categorizações excessivamente fragmentadas.
2. REUTILIZAÇÃO: Priorize reutilizar as Matérias e Assuntos já existentes fornecidos acima sempre que coerente.
3. CHAME A FUNÇÃO: Você DEVE chamar obrigatoriamente a função 'salvar_categorizacao_estudos' enviando o mapeamento completo em 'deckSubjects' e 'cardTopics'.`;

    // Try primary model (gemini-flash-lite-latest), then fallback
    const models = [DEFAULT_MODEL, FALLBACK_MODEL];
    let lastError = null;

    for (const modelName of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const requestBody = {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: promptText }]
                    }
                ],
                tools: [categorizeTool],
                toolConfig: {
                    functionCallingConfig: {
                        mode: "ANY",
                        allowedFunctionNames: ["salvar_categorizacao_estudos"]
                    }
                }
            };

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error?.message || `Erro HTTP ${response.status}`;
                throw new Error(errMsg);
            }

            const data = await response.json();
            const candidate = data.candidates?.[0];
            if (!candidate) {
                throw new Error("Nenhum resultado retornado pelo modelo.");
            }

            // Extract functionCall
            let functionCall = null;
            if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.functionCall && part.functionCall.name === "salvar_categorizacao_estudos") {
                        functionCall = part.functionCall;
                        break;
                    }
                }
            }

            // Fallback parse if model returned JSON directly in text
            if (!functionCall && candidate.content?.parts?.[0]?.text) {
                try {
                    const text = candidate.content.parts[0].text;
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.deckSubjects && parsed.cardTopics) {
                            functionCall = { args: parsed };
                        }
                    }
                } catch (e) {
                    // Ignore parse fallback error
                }
            }

            if (!functionCall || !functionCall.args) {
                throw new Error("O Gemini não retornou a chamada de categorização estruturada.");
            }

            const args = typeof functionCall.args === 'string' ? JSON.parse(functionCall.args) : functionCall.args;
            const deckSubjects = args.deckSubjects || [];
            const cardTopics = args.cardTopics || [];

            // Merge with known categories
            const newSubjects = Array.from(new Set([...knownSubjects, ...deckSubjects.map(ds => ds.subject)])).filter(Boolean);
            const deckTopics = Array.from(new Set([...knownTopics, ...cardTopics.map(ct => ct.topic)])).filter(Boolean);

            const updatedCategories = {
                ...existingCategories,
                knownSubjects: newSubjects,
                knownTopicsByDeck: {
                    ...(existingCategories?.knownTopicsByDeck || {}),
                    [currentDeckTitle]: deckTopics
                },
                deckSubjectMap: {
                    ...(existingCategories?.deckSubjectMap || {}),
                    ...Object.fromEntries(deckSubjects.map(ds => [ds.deckTitle, ds.subject]))
                },
                cardTopicsByDeck: {
                    ...(existingCategories?.cardTopicsByDeck || {}),
                    [currentDeckTitle]: cardTopics
                },
                lastUpdated: Date.now()
            };

            saveStoredAiCategories(updatedCategories);

            return {
                deckSubjects,
                cardTopics,
                updatedCategories
            };

        } catch (err) {
            console.warn(`Tentativa com ${modelName} falhou:`, err.message);
            lastError = err;
        }
    }

    throw lastError || new Error("Falha ao categorizar com Gemini Flash-Lite.");
}

/**
 * Computes performance analytics for Subjects (all decks) and Topics (current deck).
 */
export function computeAiStats({
    categories,
    currentDeckTitle,
    allQuestions,
    currentSession,
    history
}) {
    if (!categories) {
        return { subjectsStats: [], topicsStats: [] };
    }

    const deckSubjectMap = categories.deckSubjectMap || {};
    // Fallback if current deck is unmapped
    if (currentDeckTitle && !deckSubjectMap[currentDeckTitle]) {
        deckSubjectMap[currentDeckTitle] = "Geral";
    }

    // 1. Group Decks into Subjects
    const subjectsMap = {};

    // Seed subjects with known mapped decks
    Object.keys(deckSubjectMap).forEach(title => {
        const subj = deckSubjectMap[title] || "Outros";
        if (!subjectsMap[subj]) {
            subjectsMap[subj] = {
                subject: subj,
                decks: [],
                totalAnswered: 0,
                totalCorrect: 0,
                totalSessions: 0
            };
        }
        if (!subjectsMap[subj].decks.includes(title)) {
            subjectsMap[subj].decks.push(title);
        }
    });

    // Aggregate stats from history sessions
    (history || []).forEach(sess => {
        const title = sess.deckTitle || currentDeckTitle;
        const subj = deckSubjectMap[title] || "Outros";
        if (!subjectsMap[subj]) {
            subjectsMap[subj] = { subject: subj, decks: [title], totalAnswered: 0, totalCorrect: 0, totalSessions: 0 };
        }
        subjectsMap[subj].totalSessions++;
        subjectsMap[subj].totalAnswered += (sess.cardsAnswered || 0);
        subjectsMap[subj].totalCorrect += (sess.correctCount || 0);
    });

    // Aggregate stats from current session
    if (currentSession && currentSession.cardsAnswered > 0) {
        const title = currentSession.deckTitle || currentDeckTitle;
        const subj = deckSubjectMap[title] || "Outros";
        if (!subjectsMap[subj]) {
            subjectsMap[subj] = { subject: subj, decks: [title], totalAnswered: 0, totalCorrect: 0, totalSessions: 0 };
        }
        subjectsMap[subj].totalAnswered += (currentSession.cardsAnswered || 0);
        subjectsMap[subj].totalCorrect += (currentSession.correctCount || 0);
        // Only increment session count if not already archived
        if (!history || !history.some(h => h.id === currentSession.id)) {
            subjectsMap[subj].totalSessions++;
        }
    }

    const subjectsStats = Object.values(subjectsMap).map(s => {
        const acc = s.totalAnswered > 0 ? Math.round((s.totalCorrect / s.totalAnswered) * 100) : 0;
        return {
            subject: s.subject,
            decks: s.decks,
            totalAnswered: s.totalAnswered,
            totalCorrect: s.totalCorrect,
            totalSessions: s.totalSessions,
            accuracy: acc
        };
    }).sort((a, b) => b.accuracy - a.accuracy || b.totalAnswered - a.totalAnswered);

    // 2. Group Cards of Current Deck into Topics
    const cardTopicsList = categories.cardTopicsByDeck?.[currentDeckTitle] || [];
    const cardTopicMap = {};
    cardTopicsList.forEach(ct => {
        cardTopicMap[ct.cardIndex] = ct.topic;
    });

    const topicsMap = {};
    (allQuestions || []).forEach((card, idx) => {
        const topic = cardTopicMap[idx] || "Geral";
        if (!topicsMap[topic]) {
            topicsMap[topic] = {
                topic: topic,
                cardsCount: 0,
                answeredCount: 0,
                correctCount: 0,
                hasStruggling: false
            };
        }
        topicsMap[topic].cardsCount++;

        // Check if this card was answered in currentSession answersLog
        const cardDesc = (card.description || '').replace(/<[^>]*>/g, '').trim().toLowerCase();
        const answersLog = currentSession?.answersLog || [];
        const logEntry = answersLog.find(e => {
            const entryQ = (e.question || '').replace(/<[^>]*>/g, '').trim().toLowerCase();
            return entryQ.includes(cardDesc.slice(0, 40)) || cardDesc.includes(entryQ.slice(0, 40));
        });

        if (logEntry) {
            topicsMap[topic].answeredCount++;
            if (logEntry.isCorrect) topicsMap[topic].correctCount++;
        }

        // Check strugglingCards
        const struggling = currentSession?.strugglingCards || {};
        const isStruggling = Object.values(struggling).some(sc => {
            const scDesc = (sc.description || '').replace(/<[^>]*>/g, '').trim().toLowerCase();
            return scDesc.includes(cardDesc.slice(0, 40)) || cardDesc.includes(scDesc.slice(0, 40));
        });

        if (isStruggling) {
            topicsMap[topic].hasStruggling = true;
        }
    });

    const topicsStats = Object.values(topicsMap).map(t => {
        const acc = t.answeredCount > 0 ? Math.round((t.correctCount / t.answeredCount) * 100) : null;
        return {
            topic: t.topic,
            cardsCount: t.cardsCount,
            answeredCount: t.answeredCount,
            correctCount: t.correctCount,
            accuracy: acc,
            hasStruggling: t.hasStruggling
        };
    }).sort((a, b) => {
        if (a.accuracy !== null && b.accuracy !== null) return b.accuracy - a.accuracy;
        if (a.accuracy !== null) return -1;
        if (b.accuracy !== null) return 1;
        return b.cardsCount - a.cardsCount;
    });

    return { subjectsStats, topicsStats };
}
