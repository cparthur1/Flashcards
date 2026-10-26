/**
 * js/engine/scheduler.js
 * Módulo de agendamento de repetição espaçada, cálculo de gaps,
 * seleção adaptativa de próximos cartões e regras de graduação/leech.
 *
 * Módulo puro: não possui acoplamento direto com o DOM ou UI gráfica.
 */

import { secureRandom } from '../utils.js';

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
    return String(card.topic || card.aiTopic || card.subject || card.aiSubject || card.category || card.sourceDeck || '').trim().toLowerCase();
}

/**
 * Calcula o intervalo adaptativo (gap de cartões futuros) aproveitando os pilares
 * neurobiológicos de Dificuldades Desejáveis, Erro de Predição, Latência de Resposta
 * e Proteção contra Avalanche de Erros:
 * 
 * 1. Base Escalável por Tamanho do Baralho:
 *    - Baralhos médios/grandes (pool >= 15): gap base de 8-10 cards, garantindo que o usuário
 *      continue avançando em cartas novas antes de reencontrar o cartão errado.
 *    - Baralhos moderados (pool 8-14): gap base de 6-7 cards.
 *    - Baralhos pequenos (pool < 8): gap base proporcional Math.max(3, poolSize - 1).
 * 
 * 2. Erro de Predição & Latência (Dopamina e Consolidação):
 *    - Erro rápido (t < 2.5s): chute impulsivo ou ilusão de competência -> adiciona +3 a +4 cards
 *      de bônus para que o traço superficial de memória de curto prazo decaia de verdade.
 *    - Erro moderado (2.5s <= t <= 7s): tentativa normal -> +1 a +2 cards de bônus.
 *    - Erro exaustivo (t > 7s): busca exaustiva sem sucesso -> sem bônus extra para não perder o traço.
 * 
 * 3. Proteção contra o "Vórtice do Erro" (Leech & Frustração):
 *    - NÃO reduz o gap quando há múltiplos erros. Pelo contrário: se o cartão já foi errado 2+ vezes,
 *      espaçar o reaparecimento (+2 a +5 cards de respiro) evita saturação semântica, frustração
 *      e permite que o usuário construa novos esquemas mentais com cartas novas antes de tentar de novo.
 * 
 * 4. Jitter / Dispersão Anti-Cluster:
 *    - Adiciona uma pequena variação pseudo-aleatória (-1 a +1) para que múltiplos erros cometidos em
 *      sequência não vençam todos juntos no mesmo passo futuro, prevenindo a temida "avalanche de revisões".
 * 
 * @param {number} thinkingTimeSec - Tempo de reflexão/latência em segundos
 * @param {Object} [card=null] - Cartão avaliado com histórico de erros
 * @param {number} [poolSize=0] - Quantidade atual de cartões no pool ativo
 * @returns {number}
 */
export function calculateThinkingGap(thinkingTimeSec, card = null, poolSize = 0) {
    const t = Math.max(0.5, Number(thinkingTimeSec) || 1);
    const wrongCount = card ? (card.wrongCount || 1) : 1;
    const currentPool = Math.max(1, Number(poolSize) || (card && card.poolSize) || 20);

    // 1. Base adaptativa ao tamanho do baralho
    let baseGap = 7;
    let minGap = 5;
    if (currentPool >= 20) {
        baseGap = 9;
        minGap = 7;
    } else if (currentPool >= 12) {
        baseGap = 7;
        minGap = 6;
    } else if (currentPool >= 6) {
        baseGap = 5;
        minGap = 4;
    } else {
        baseGap = Math.max(2, currentPool - 1);
        minGap = Math.max(2, Math.min(3, currentPool - 1));
    }

    // 2. Bônus por latência de resposta (Erro de Predição)
    let latencyBonus = 0;
    if (t < 2.5) {
        latencyBonus = 3;
    } else if (t < 7.0) {
        latencyBonus = 1;
    } else {
        latencyBonus = 0;
    }

    // 3. Expansão de respiro para erros repetidos (Anti-Frustração)
    // Em vez de diminuir o gap (que aprisionava o usuário num loop curto),
    // damos espaço para que cartas novas oxigenem a mente do usuário.
    const repeatedErrorBreathing = Math.min(5, Math.max(0, (wrongCount - 1) * 2));

    // 4. Jitter anti-clustering (-1, 0, 1) para espalhar vencimentos
    const jitter = Math.floor(secureRandom() * 3) - 1;

    let gap = baseGap + latencyBonus + repeatedErrorBreathing + jitter;
    gap = Math.max(minGap, gap);

    // Limita para não ultrapassar 1.4x o tamanho do pool (se o pool for relevante)
    if (currentPool > 3) {
        gap = Math.min(gap, Math.max(minGap, Math.round(currentPool * 1.4)));
    }

    console.log("[Algorithm] calculateThinkingGap (Neuroscience v2):", {
        thinkingTime: Math.round(t * 10) / 10 + 's',
        wrongCount,
        currentPool,
        baseGap,
        latencyBonus,
        repeatedErrorBreathing,
        jitter,
        finalGap: gap
    });
    return gap;
}

/**
 * Seleciona o próximo cartão com arquitetura cognitiva de fluxo de aprendizado:
 * - Anti-Aprisionamento: Não deixa o usuário preso em cartões errados.
 * - Injeção Contínua de Cartas Novas: Se existem cartas novas (não vistas),
 *   garante a introdução constante de conteúdo inédito intercalado com revisões.
 * - Ritmo Intercalado (Desirable Difficulties & Interleaving Effect):
 *   Intercala tópicos distintos e mantém cadência entre novas cartas e revisões de erros.
 * - Proteção de Recência: Evita mostrar o mesmo cartão consecutivamente.
 *
 * @param {Array<Object>|Object} candidateListOrConfig - Lista de candidatos ou objeto de configuração
 * @param {number} [step=0] - Passo atual da sessão
 * @param {number} [consecutiveDueCardsCount=0] - Contador de revisões consecutivas de vencidos
 * @param {string} [lastCardTopic=''] - Tópico do cartão anterior para intercalação
 * @param {Object} [currentCard=null] - Cartão atual para evitar repetição consecutiva imediata
 * @param {number} [consecutiveNewCardsCount=0] - Contador de cartas novas consecutivas
 * @returns {Object|null}
 */
export function selectNextCard(
    candidateListOrConfig,
    step = 0,
    consecutiveDueCardsCount = 0,
    lastCardTopic = '',
    currentCard = null,
    consecutiveNewCardsCount = 0
) {
    let candidateList = candidateListOrConfig;
    if (candidateListOrConfig && !Array.isArray(candidateListOrConfig) && typeof candidateListOrConfig === 'object') {
        candidateList = candidateListOrConfig.candidateList || candidateListOrConfig.pool || [];
        step = candidateListOrConfig.step ?? step;
        consecutiveDueCardsCount = candidateListOrConfig.consecutiveDueCardsCount ?? consecutiveDueCardsCount;
        lastCardTopic = candidateListOrConfig.lastCardTopic ?? lastCardTopic;
        currentCard = candidateListOrConfig.currentCard ?? currentCard;
        consecutiveNewCardsCount = candidateListOrConfig.consecutiveNewCardsCount ?? consecutiveNewCardsCount;
    }

    if (!candidateList || candidateList.length === 0) return null;
    if (candidateList.length === 1) return candidateList[0];

    // Evita o mesmo cartão imediatamente consecutivo (quando há mais de 1 opção)
    let pool = candidateList;
    if (currentCard && candidateList.length > 1) {
        const withoutCurrent = candidateList.filter(c => c !== currentCard);
        if (withoutCurrent.length > 0) {
            pool = withoutCurrent;
        }
    }

    const dueCards = pool.filter(c => c.dueStep !== undefined && c.dueStep <= step);
    const newCards = pool.filter(c => c.dueStep === undefined);
    const futureCards = pool.filter(c => c.dueStep !== undefined && c.dueStep > step);

    // Filtro de intercalação de tópicos
    const normalizedLastTopic = String(lastCardTopic || '').trim().toLowerCase();
    const filterInterleaved = (list) => {
        if (!normalizedLastTopic || list.length <= 1) return list;
        const diffTopic = list.filter(c => getCardTopic(c) !== normalizedLastTopic);
        return diffTopic.length > 0 ? diffTopic : list;
    };

    // Helper de seleção com intercalação
    const pickFrom = (list, reason = '') => {
        const interleaved = filterInterleaved(list);
        const picked = interleaved[Math.floor(secureRandom() * interleaved.length)] || list[0];
        console.log(`[Algorithm] Card selecionado (${reason}):`, {
            desc: (picked.description || '').slice(0, 35),
            tipo: picked.dueStep === undefined ? 'novo' : (picked.dueStep <= step ? 'due' : 'futuro'),
            topic: getCardTopic(picked) || 'Geral',
            dueStep: picked.dueStep,
            step,
            newCardsLeft: newCards.length,
            dueCardsLeft: dueCards.length
        });
        return picked;
    };

    // CENÁRIO 1: Existem tanto Cartas Novas quanto Cartas Vencidas (Due)
    // O grande diferencial pedagógico: dosar o fluxo entre novidade e consolidação.
    if (newCards.length > 0 && dueCards.length > 0) {
        // Regra 1.1: Limite rígido anti-aprisionamento.
        // Se o usuário já respondeu 2 revisões seguidas de vencidos, 100% DEVE ser carta nova!
        if (consecutiveDueCardsCount >= 2) {
            return pickFrom(newCards, 'anti-trap: forçando carta nova após 2 revisões seguidas');
        }

        // Regra 1.2: Se o usuário respondeu 1 revisão de vencido recentemente,
        // dar alta probabilidade (80%) para carta nova, desobstruindo a fila.
        if (consecutiveDueCardsCount === 1) {
            if (secureRandom() < 0.80) {
                return pickFrom(newCards, 'fluxo saudável: alternando para carta nova após revisão');
            } else {
                return pickFrom(dueCards, 'revisão due espaçada (20%)');
            }
        }

        // Regra 1.3: Se o usuário já viu muitas cartas novas seguidas (>= 3) e há cartões vencidos,
        // hora de consolidar para não deixar a curva do esquecimento apagar a memória!
        if (consecutiveNewCardsCount >= 3) {
            return pickFrom(dueCards, 'consolidação periódica: cartão due após sequência de novos');
        }

        // Regra 1.4: Em estado neutro, dosar de acordo com a proporção de cartas novas no baralho.
        // Garante que cartas novas continuem fluindo (entre 45% e 75% de chance).
        const newCardShare = newCards.length / (newCards.length + dueCards.length);
        const targetNewChance = Math.min(0.75, Math.max(0.45, newCardShare));

        if (secureRandom() < targetNewChance) {
            return pickFrom(newCards, `ritmo balanceado: carta nova (chance: ${Math.round(targetNewChance * 100)}%)`);
        } else {
            return pickFrom(dueCards, 'ritmo balanceado: revisão due');
        }
    }

    // CENÁRIO 2: Apenas Cartas Novas disponíveis (sem vencidos)
    if (newCards.length > 0) {
        return pickFrom(newCards, 'novo: nenhum vencido no momento');
    }

    // CENÁRIO 3: Não há cartas novas, mas há Cartas Vencidas (Fase de Consolidação)
    // O usuário já viu todo o baralho inicial e agora está revisando as cartas que errou.
    if (dueCards.length > 0) {
        // Se há muitas cartas vencidas e cartões futuros disponíveis, pode intercalar levemente
        if (consecutiveDueCardsCount >= 3 && futureCards.length > 0 && secureRandom() < 0.30) {
            return pickFrom(futureCards, 'intercalação leve com cartão futuro próximo');
        }
        return pickFrom(dueCards, 'revisão: consolidação de cartões vencidos');
    }

    // CENÁRIO 4: Todas as cartas restantes estão no futuro (dueStep > step)
    // Nenhuma carta nova restante e nenhum vencido exatamente agora.
    // Seleciona o cartão mais próximo de vencer (menor dueStep).
    let minDue = Infinity;
    for (const c of pool) {
        const d = c.dueStep || 0;
        if (d < minDue) minDue = d;
    }
    const earliestCards = pool.filter(c => (c.dueStep || 0) === minDue);
    return pickFrom(earliestCards, 'futuro mais próximo: adiantamento suave');
}

/**
 * Verifica se o cartão atingiu o limiar de sanguessuga (leech: >= 4 erros).
 * @param {Object} card 
 * @returns {boolean}
 */
export function isLeechCard(card) {
    return Boolean(card && (card.wrongCount || 0) >= 4);
}

/**
 * Determina se o cartão deve ser graduado/removido do pool ativo na sessão.
 * 
 * Regras Neurobiológicas & Pedagógicas:
 * 1. Cartões Leech (sanguessugas: >= 4 erros): histórico de instabilidade severa.
 *    Exigem 2 acertos consecutivos para confirmação genuína de retenção.
 * 2. Cartões com múltiplos erros crônicos (>= 3 erros) E latência extrema (> 15s):
 *    Recuperação ainda muito tênue no limiar do esquecimento, exige confirmação (correctStreak >= 2).
 * 3. Demais cartões (novos ou com 1-2 erros prévios):
 *    Acertou -> GRADUA! A recuperação após esforço (Desirable Difficulty) consolida o traço.
 *    Prender o usuário que acertou um cartão após pensar com cuidado era uma das maiores
 *    causas de frustração e aprisionamento.
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
    const chronicStruggler = (card.wrongCount || 0) >= 3;
    const extremeLatency = Number(latencySec) > 15;
    if (chronicStruggler && extremeLatency) {
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
