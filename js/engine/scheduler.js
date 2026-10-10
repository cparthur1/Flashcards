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

/**
 * Calcula o intervalo (gap de cartões futuros) inversamente proporcional
 * ao tempo que o usuário passou pensando no cartão incorreto:
 * - Cartões difíceis (tempo longo >= 15s): menor gap (mais próximo do mínimo 5).
 * - Respostas rápidas / chutes (<= 1s): maior fila de espera (até 20).
 * O gap mínimo absoluto é sempre 5 cartões.
 * 
 * @param {number} thinkingTimeSec - Tempo de reflexão em segundos
 * @returns {number}
 */
export function calculateThinkingGap(thinkingTimeSec) {
    const minGap = 5;
    const t = Math.max(0.8, thinkingTimeSec || 1);
    const bonus = Math.min(15, Math.max(0, Math.round(15 / t - 1)));
    const gap = minGap + bonus;
    console.log("[Algorithm] calculateThinkingGap:", {
        thinkingTime: Math.round(t * 10) / 10 + 's',
        bonus,
        finalGap: gap
    });
    return gap;
}

/**
 * Seleciona o próximo cartão seguindo regras adaptativas de repetição espaçada e anti-monotonia:
 * 1. Identifica dueCards (dueStep <= step), newCards (não vistos), e futureCards (dueStep > step).
 * 2. Quando há acúmulo de cartões vencidos (dueCards.length >= 3 ou 2 vencidos consecutivos):
 *    - Injeta cartão aleatório fresco (não visto ou futuro) na fila.
 *    - Garante no máximo 2 vencidos seguidos antes de intercalar um cartão novo.
 *    - Intercala com ~35% de probabilidade em filas longas.
 * 3. Do contrário, sorteia aleatoriamente entre os dueCards (evita fila linear previsível).
 * 4. Se não há vencidos, sorteia entre novos cartões não revisados.
 * 5. Fallback: sorteia entre cartões com o menor dueStep futuro.
 * 
 * @param {Array<Object>} candidateList - Lista de cartões candidatos
 * @param {number} step - Passo/etapa atual da sessão
 * @param {number} consecutiveDueCardsCount - Contador de cartões vencidos respondidos em sequência
 * @returns {Object|null}
 */
export function selectNextCard(candidateList, step, consecutiveDueCardsCount = 0) {
    if (!candidateList || candidateList.length === 0) return null;
    if (candidateList.length === 1) return candidateList[0];

    const dueCards = candidateList.filter(c => c.dueStep !== undefined && c.dueStep <= step);
    const newCards = candidateList.filter(c => c.dueStep === undefined);
    const futureCards = candidateList.filter(c => c.dueStep !== undefined && c.dueStep > step);
    const nonDueCards = newCards.length > 0 ? newCards : futureCards;

    if (dueCards.length > 0) {
        const canInjectRandom = nonDueCards.length > 0;
        const isTooMuchDue = dueCards.length >= 3;

        // Regra anti-monotonia / intercalação:
        const shouldInjectRandom = canInjectRandom && (
            (consecutiveDueCardsCount >= 2 && dueCards.length >= 2) ||
            (isTooMuchDue && Math.random() < 0.35)
        );

        if (shouldInjectRandom) {
            const injectedCard = nonDueCards[Math.floor(Math.random() * nonDueCards.length)];
            console.log("[Algorithm] Too much due (" + dueCards.length + " cards). Injetando card aleatório fresco na fila:", {
                desc: (injectedCard.description || '').slice(0, 35),
                tipo: newCards.length > 0 ? 'novo/não visto' : 'futuro',
                dueCount: dueCards.length,
                consecutiveDue: consecutiveDueCardsCount
            });
            return injectedCard;
        }

        // Sorteio aleatório entre cartões vencidos (evita fila estática linear)
        const pickedDue = dueCards[Math.floor(Math.random() * dueCards.length)];
        console.log("[Algorithm] Card due selecionado:", {
            desc: (pickedDue.description || '').slice(0, 35),
            dueStep: pickedDue.dueStep,
            step,
            dueCount: dueCards.length,
            consecutiveDue: consecutiveDueCardsCount
        });
        return pickedDue;
    }

    // Sem cartões vencidos: sorteia entre os novos cartões não vistos
    if (newCards.length > 0) {
        const pickedNew = newCards[Math.floor(Math.random() * newCards.length)];
        console.log("[Algorithm] Card novo selecionado:", {
            desc: (pickedNew.description || '').slice(0, 35)
        });
        return pickedNew;
    }

    // Fallback: todos os cartões restantes estão agendados no futuro (dueStep > step)
    let minDue = Infinity;
    for (const c of candidateList) {
        const d = c.dueStep || 0;
        if (d < minDue) minDue = d;
    }
    const earliestCards = candidateList.filter(c => (c.dueStep || 0) === minDue);
    const pickedEarliest = earliestCards[Math.floor(Math.random() * earliestCards.length)] || candidateList[0];
    console.log("[Algorithm] Card futuro mais próximo selecionado:", {
        desc: (pickedEarliest?.description || '').slice(0, 35),
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
 * Determina se o cartão deve ser graduado/removido do pool ativo na sessão:
 * - Cartões normais (<= 4 erros): removidos no primeiro acerto.
 * - Cartões leech (> 4 erros): exigem 2 acertos consecutivos.
 * 
 * @param {Object} card 
 * @returns {boolean}
 */
export function shouldGraduateCard(card) {
    if (!card) return true;
    const isLeech = isLeechCard(card);
    return !isLeech || (card.correctStreak || 0) >= 2;
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
