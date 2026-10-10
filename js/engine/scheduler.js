/**
 * js/engine/scheduler.js
 * Módulo de agendamento de repetição espaçada, cálculo de gaps,
 * seleção adaptativa de próximos cartões e regras de graduação/leech.
 *
 * Módulo puro: não possui acoplamento direto com o DOM ou UI gráfica.
 */

/**
 * Filtra se um cartão é jogável (exclui divisores de seção e notas).
 * @param {Object} card 
 * @returns {boolean}
 */
export function isPlayableCard(card) {
    return Boolean(card && card.type !== 'divisor' && card.type !== 'divider' && card.type !== 'note');
}

export function getCardTopic(card) {
    if (!card) return '';
    return String(card.topic || card.aiTopic || card.subject || card.aiSubject || '').trim().toLowerCase();
}

/**
 * Calcula o intervalo adaptativo (gap de cartões futuros) aproveitando os pilares
 * neurobiológicos de Dificuldades Desejáveis, Erro de Predição e Latência de Resposta:
 * - Dificuldades Desejáveis: Garante intervalo mínimo (5 cartões) para que a memória
 *   de trabalho fonológica/visual decaia, forçando esforço genuíno de recuperação.
 * - Erro de Predição (Dopamina/Consolidação): Erros rápidos (t < 2s) revelam heurística
 *   automática ou chute cego (falsa confiança); recebem gap mais dilatado (8-10 cards)
 *   para desconstruir o viés intuitivo.
 * - Latência e Sobrecarga: Erros com tempo elevado (t > 12s) indicam busca exaustiva
 *   sem sucesso. O gap fica próximo ao mínimo (5 cards) para evitar extinção total do traço.
 * - Acúmulo de Erros (Leeches): Cartões com múltiplos erros mantêm intervalos controlados.
 * 
 * @param {number} thinkingTimeSec - Tempo de reflexão/latência em segundos
 * @param {Object} [card=null] - Cartão avaliado para levar em conta o histórico de erros
 * @returns {number}
 */
export function calculateThinkingGap(thinkingTimeSec, card = null) {
    const minGap = 5;
    const t = Math.max(0.8, Number(thinkingTimeSec) || 1);
    const wrongCount = card ? (card.wrongCount || 1) : 1;

    let bonus = 0;
    if (t < 2.0) {
        bonus = 4;
    } else if (t < 5.0) {
        bonus = 2;
    } else if (t < 10.0) {
        bonus = 1;
    } else {
        bonus = 0;
    }

    const wrongPenalty = Math.min(2, Math.floor((wrongCount - 1) / 2));
    const gap = Math.max(minGap, minGap + bonus - wrongPenalty);

    console.log("[Algorithm] calculateThinkingGap (Neuroscience):", {
        thinkingTime: Math.round(t * 10) / 10 + 's',
        wrongCount,
        bonus,
        wrongPenalty,
        finalGap: gap
    });
    return gap;
}

/**
 * Seleciona o próximo cartão seguindo regras adaptativas de repetição espaçada,
 * anti-monotonia e Prática Intercalada (Interleaving Effect):
 * 1. Prioriza alternância entre diferentes tópicos/categorias (evita repetição em bloco).
 * 2. Identifica dueCards (dueStep <= step), newCards (não vistos), e futureCards (dueStep > step).
 * 3. Quando há acúmulo de cartões vencidos (dueCards.length >= 3 ou 2 vencidos consecutivos):
 *    - Injeta cartão fresco intercalado na fila.
 * 4. Sorteia entre os cartões vencidos intercalados.
 * 5. Se não há vencidos, sorteia entre novos cartões não vistos intercalados.
 * 6. Fallback: menor dueStep futuro.
 * 
 * @param {Array<Object>} candidateList - Lista de cartões candidatos
 * @param {number} step - Passo/etapa atual da sessão
 * @param {number} consecutiveDueCardsCount - Contador de cartões vencidos respondidos em sequência
 * @param {string} [lastCardTopic=''] - Assunto do cartão anterior para efeito de intercalação
 * @returns {Object|null}
 */
export function selectNextCard(candidateList, step, consecutiveDueCardsCount = 0, lastCardTopic = '') {
    if (!candidateList || candidateList.length === 0) return null;
    if (candidateList.length === 1) return candidateList[0];

    const dueCards = candidateList.filter(c => c.dueStep !== undefined && c.dueStep <= step);
    const newCards = candidateList.filter(c => c.dueStep === undefined);
    const futureCards = candidateList.filter(c => c.dueStep !== undefined && c.dueStep > step);
    const nonDueCards = newCards.length > 0 ? newCards : futureCards;

    // Interleaving filter: prioriza tópicos diferentes do cartão anterior
    const normalizedLastTopic = String(lastCardTopic || '').trim().toLowerCase();
    const filterInterleaved = (list) => {
        if (!normalizedLastTopic || list.length <= 1) return list;
        const diffTopicCards = list.filter(c => getCardTopic(c) !== normalizedLastTopic);
        return diffTopicCards.length > 0 ? diffTopicCards : list;
    };

    if (dueCards.length > 0) {
        const canInjectRandom = nonDueCards.length > 0;
        const isTooMuchDue = dueCards.length >= 3;

        const shouldInjectRandom = canInjectRandom && (
            (consecutiveDueCardsCount >= 2 && dueCards.length >= 2) ||
            (isTooMuchDue && Math.random() < 0.35)
        );

        if (shouldInjectRandom) {
            const candidatePool = filterInterleaved(nonDueCards);
            const injectedCard = candidatePool[Math.floor(Math.random() * candidatePool.length)];
            console.log("[Algorithm] Intercalando card aleatório fresco (Interleaving Effect):", {
                desc: (injectedCard.description || '').slice(0, 35),
                tipo: newCards.length > 0 ? 'novo/não visto' : 'futuro',
                topic: getCardTopic(injectedCard) || 'Geral',
                lastTopic: normalizedLastTopic
            });
            return injectedCard;
        }

        const interleavedDue = filterInterleaved(dueCards);
        const pickedDue = interleavedDue[Math.floor(Math.random() * interleavedDue.length)];
        console.log("[Algorithm] Card due selecionado (Interleaving):", {
            desc: (pickedDue.description || '').slice(0, 35),
            topic: getCardTopic(pickedDue) || 'Geral',
            lastTopic: normalizedLastTopic,
            dueStep: pickedDue.dueStep,
            step
        });
        return pickedDue;
    }

    if (newCards.length > 0) {
        const interleavedNew = filterInterleaved(newCards);
        const pickedNew = interleavedNew[Math.floor(Math.random() * interleavedNew.length)];
        console.log("[Algorithm] Card novo selecionado (Interleaving):", {
            desc: (pickedNew.description || '').slice(0, 35),
            topic: getCardTopic(pickedNew) || 'Geral',
            lastTopic: normalizedLastTopic
        });
        return pickedNew;
    }

    let minDue = Infinity;
    for (const c of candidateList) {
        const d = c.dueStep || 0;
        if (d < minDue) minDue = d;
    }
    const earliestCards = candidateList.filter(c => (c.dueStep || 0) === minDue);
    const interleavedEarliest = filterInterleaved(earliestCards);
    const pickedEarliest = interleavedEarliest[Math.floor(Math.random() * interleavedEarliest.length)] || candidateList[0];
    console.log("[Algorithm] Card futuro mais próximo selecionado (Interleaving):", {
        desc: (pickedEarliest?.description || '').slice(0, 35),
        topic: getCardTopic(pickedEarliest) || 'Geral',
        minDue
    });
    return pickedEarliest;
}

/**
 * Verifica se o cartão atingiu o limiar de sanguessuga (leech: > 4 erros).
 * @param {Object} card 
 * @returns {boolean}
 */
export function isLeechCard(card) {
    return Boolean(card && (card.wrongCount || 0) > 4);
}

/**
 * Determina se o cartão deve ser graduado/removido do pool ativo na sessão,
 * integrando a Latência de Resposta e Dificuldades Desejáveis:
 * - Cartões Leech (> 4 erros): exigem rigorosamente 2 acertos consecutivos.
 * - Cartões com erros prévios respondidos com esforço extremo (latência > 10s):
 *   indicam recuperação frágil próxima do limiar de esquecimento, exigindo uma segunda
 *   confirmação antes de graduar (correctStreak >= 2).
 * - Cartões normais respondidos com recuperação fluente: graduados no primeiro acerto.
 * 
 * @param {Object} card 
 * @param {number} [latencySec=0]
 * @returns {boolean}
 */
export function shouldGraduateCard(card, latencySec = 0) {
    if (!card) return true;
    const isLeech = isLeechCard(card);
    if (isLeech) {
        return (card.correctStreak || 0) >= 2;
    }
    const hadPriorErrors = (card.wrongCount || 0) > 0;
    const isHighLatencyEffort = Number(latencySec) > 10;
    if (hadPriorErrors && isHighLatencyEffort) {
        return (card.correctStreak || 0) >= 2;
    }
    return true;
}

/**
 * Formata segundos no formato MM:SS.
 * @param {number} totalSeconds 
 * @returns {string}
 */
export function formatTimeDisplay(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
