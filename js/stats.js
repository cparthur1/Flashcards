import { getStatsStorage, saveStatsStorage, resetAllStats, injectSampleHistory } from './stats-tracker.js';
import { 
    callGeminiFlashLiteCategorization, 
    getStoredAiCategories, 
    saveStoredAiCategories, 
    computeAiStats 
} from './stats-ai.js';
import { ROUTES } from './utils.js';

// DOM Elements
const backToGameBtn = document.getElementById('back-to-game-btn');
const deckBadge = document.getElementById('deck-badge');
const exportStatsBtn = document.getElementById('export-stats-btn');
const clearStatsBtn = document.getElementById('clear-stats-btn');
const seedDemoBtn = document.getElementById('seed-demo-btn');

// Tabs
const tabBtnCurrent = document.getElementById('tab-btn-current');
const tabBtnHistory = document.getElementById('tab-btn-history');
const tabBtnStruggling = document.getElementById('tab-btn-struggling');
const tabContentCurrent = document.getElementById('tab-content-current');
const tabContentHistory = document.getElementById('tab-content-history');
const tabContentStruggling = document.getElementById('tab-content-struggling');
const historyBadgeCount = document.getElementById('history-badge-count');
const strugglingBadgeCount = document.getElementById('struggling-badge-count');

// KPI Elements
const kpiProgressPercent = document.getElementById('kpi-progress-percent');
const kpiProgressRatio = document.getElementById('kpi-progress-ratio');
const kpiProgressBar = document.getElementById('kpi-progress-bar');
const kpiAccuracyPercent = document.getElementById('kpi-accuracy-percent');
const kpiAccuracyFeedback = document.getElementById('kpi-accuracy-feedback');
const kpiCorrectCount = document.getElementById('kpi-correct-count');
const kpiIncorrectCount = document.getElementById('kpi-incorrect-count');
const kpiDuration = document.getElementById('kpi-duration');
const kpiTimePerCard = document.getElementById('kpi-time-per-card');
const kpiCurrentStreak = document.getElementById('kpi-current-streak');
const kpiBestStreak = document.getElementById('kpi-best-streak');

// Anki Elements
const ankiTotalBadge = document.getElementById('anki-total-badge');
const ankiBarAgain = document.getElementById('anki-bar-again');
const ankiBarHard = document.getElementById('anki-bar-hard');
const ankiBarGood = document.getElementById('anki-bar-good');
const ankiBarEasy = document.getElementById('anki-bar-easy');
const ankiCountAgain = document.getElementById('anki-count-again');
const ankiCountHard = document.getElementById('anki-count-hard');
const ankiCountGood = document.getElementById('anki-count-good');
const ankiCountEasy = document.getElementById('anki-count-easy');
const ankiPctAgain = document.getElementById('anki-pct-again');
const ankiPctHard = document.getElementById('anki-pct-hard');
const ankiPctGood = document.getElementById('anki-pct-good');
const ankiPctEasy = document.getElementById('anki-pct-easy');

// Panels
const byTypeContainer = document.getElementById('by-type-container');
const timelineStrip = document.getElementById('timeline-strip');
const timelineCounterBadge = document.getElementById('timeline-counter-badge');
const insightTitle = document.getElementById('insight-title');
const insightText = document.getElementById('insight-text');

// Pace, Mastery & Highlights Elements
const paceEstimateBadge = document.getElementById('pace-estimate-badge');
const paceEstimateTime = document.getElementById('pace-estimate-time');
const paceEstimateSub = document.getElementById('pace-estimate-sub');
const paceFastestCard = document.getElementById('pace-fastest-card');
const paceSlowestCard = document.getElementById('pace-slowest-card');

const masteryLevelBadge = document.getElementById('mastery-level-badge');
const masteryScore = document.getElementById('mastery-score');
const masteryProgressBar = document.getElementById('mastery-progress-bar');
const masteryDescription = document.getElementById('mastery-description');

const highlightsTotalBadge = document.getElementById('highlights-total-badge');
const highlightsSummaryText = document.getElementById('highlights-summary-text');
const hlCountYellow = document.getElementById('hl-count-yellow');
const hlCountGreen = document.getElementById('hl-count-green');
const hlCountBlue = document.getElementById('hl-count-blue');
const hlCountPurple = document.getElementById('hl-count-purple');

// History Elements
const alltimeSessions = document.getElementById('alltime-sessions');
const alltimeTime = document.getElementById('alltime-time');
const alltimeCards = document.getElementById('alltime-cards');
const alltimeAccuracy = document.getElementById('alltime-accuracy');
const alltimeBestStreak = document.getElementById('alltime-best-streak');
const chartTrendBadge = document.getElementById('chart-trend-badge');
const accuracyChartContainer = document.getElementById('accuracy-chart-container');
const historyList = document.getElementById('history-list');

// Struggling Elements
const strugglingList = document.getElementById('struggling-list');
const addAllToNotebookBtn = document.getElementById('add-all-to-notebook-btn');

// AI Elements
const aiStatsSection = document.getElementById('ai-stats-section');
const aiHistorySubjectsSection = document.getElementById('ai-history-subjects-section');
const aiConfigModal = document.getElementById('ai-config-modal');
const closeAiModalBtn = document.getElementById('close-ai-modal-btn');
const modalApiKeyInput = document.getElementById('modal-api-key-input');
const modalSaveApiKeyBtn = document.getElementById('modal-save-api-key-btn');
const modalDisableAiBtn = document.getElementById('modal-disable-ai-btn');

let isAiLoading = false;

function getGeminiApiKey() {
    return sessionStorage.getItem('gemini_api_key') || localStorage.getItem('gemini_api_key') || '';
}

function setGeminiApiKey(key) {
    if (key) {
        sessionStorage.setItem('gemini_api_key', key);
        localStorage.setItem('gemini_api_key', key);
    } else {
        sessionStorage.removeItem('gemini_api_key');
        localStorage.removeItem('gemini_api_key');
    }
}

function openAiModal() {
    if (!aiConfigModal) return;
    if (modalApiKeyInput) modalApiKeyInput.value = getGeminiApiKey();
    aiConfigModal.classList.remove('hidden');
}

function closeAiModal() {
    if (!aiConfigModal) return;
    aiConfigModal.classList.add('hidden');
}

function formatSeconds(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function showStatsPill(message, isSuccess = true) {
    const existing = document.getElementById('stats-floating-pill');
    if (existing) existing.remove();

    const pill = document.createElement('div');
    pill.id = 'stats-floating-pill';
    pill.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full shadow-2xl backdrop-blur-xl border border-white/20 transition-all duration-300 transform translate-y-10 opacity-0 text-sm font-semibold flex items-center gap-2 ${
        isSuccess ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-white dark:bg-gray-700'
    }`;
    pill.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span>${message}</span>
    `;
    document.body.appendChild(pill);

    requestAnimationFrame(() => {
        pill.classList.remove('translate-y-10', 'opacity-0');
        pill.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
        pill.classList.remove('translate-y-0', 'opacity-100');
        pill.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => pill.remove(), 400);
    }, 3000);
}

// TAB SWITCHING
function switchTab(tabName) {
    [tabBtnCurrent, tabBtnHistory, tabBtnStruggling].forEach(btn => {
        btn.classList.remove('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'dark:text-blue-400', 'shadow-sm');
        btn.classList.add('text-gray-600', 'dark:text-gray-400');
    });

    [tabContentCurrent, tabContentHistory, tabContentStruggling].forEach(content => {
        content.classList.add('hidden');
    });

    if (tabName === 'current') {
        tabBtnCurrent.classList.add('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'dark:text-blue-400', 'shadow-sm');
        tabBtnCurrent.classList.remove('text-gray-600', 'dark:text-gray-400');
        tabContentCurrent.classList.remove('hidden');
    } else if (tabName === 'history') {
        tabBtnHistory.classList.add('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'dark:text-blue-400', 'shadow-sm');
        tabBtnHistory.classList.remove('text-gray-600', 'dark:text-gray-400');
        tabContentHistory.classList.remove('hidden');
    } else if (tabName === 'struggling') {
        tabBtnStruggling.classList.add('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'dark:text-blue-400', 'shadow-sm');
        tabBtnStruggling.classList.remove('text-gray-600', 'dark:text-gray-400');
        tabContentStruggling.classList.remove('hidden');
    }
}

// MAIN RENDER FUNCTION
function renderAllStats() {
    const statsData = getStatsStorage();
    const activeMode = localStorage.getItem('flashcardsActiveMode') || 'normal';
    const storageKey = activeMode === 'notebook' ? 'flashcardsNotebook' : 'flashcardsSave';
    const gameState = JSON.parse(localStorage.getItem(storageKey)) || {};

    const deckTitle = gameState.deckTitle || (activeMode === 'notebook' ? 'Caderno' : 'Flashcards');
    if (deckBadge) deckBadge.textContent = deckTitle;

    // --- TAB 1: CURRENT SESSION ---
    renderCurrentSession(statsData.currentSession, gameState, statsData.history);

    // --- AI SECTION: TOPICS & SUBJECTS ---
    renderAiSection(gameState, statsData);

    // --- TAB 2: HISTORY ---
    renderHistory(statsData);

    // --- TAB 3: STRUGGLING CARDS ---
    renderStrugglingCards(statsData.currentSession);
}

function renderCurrentSession(sess, gameState, history) {
    const totalCards = gameState.allQuestions ? gameState.allQuestions.length : (sess ? sess.totalCardsInDeck : 0);
    const poolRemaining = gameState.questionsPool ? gameState.questionsPool.length : 0;
    const completedCards = Math.max(0, totalCards - poolRemaining);

    const answered = sess && sess.cardsAnswered ? sess.cardsAnswered : completedCards;
    const correct = sess && sess.correctCount !== undefined ? sess.correctCount : completedCards;
    const incorrect = sess && sess.incorrectCount !== undefined ? sess.incorrectCount : 0;
    const duration = sess ? sess.durationSeconds || 0 : 0;

    const progressPct = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;
    const accuracyPct = answered > 0 ? Math.round((correct / answered) * 100) : 100;
    const avgSeconds = answered > 0 ? (duration / answered).toFixed(1) : '0';

    // Update KPIs
    kpiProgressPercent.textContent = `${progressPct}%`;
    kpiProgressRatio.textContent = `${completedCards} / ${totalCards} cards`;
    kpiProgressBar.style.width = `${progressPct}%`;

    kpiAccuracyPercent.textContent = `${accuracyPct}%`;
    kpiAccuracyPercent.className = `text-2xl sm:text-3xl font-extrabold ${
        accuracyPct >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
        accuracyPct >= 65 ? 'text-amber-500 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
    }`;
    kpiAccuracyFeedback.textContent = accuracyPct >= 85 ? 'Excelente Domínio' : accuracyPct >= 70 ? 'Bom Ritmo' : 'Atenção Necessária';
    kpiCorrectCount.textContent = correct;
    kpiIncorrectCount.textContent = incorrect;

    kpiDuration.textContent = formatSeconds(duration);
    kpiTimePerCard.textContent = `${avgSeconds}s`;

    kpiCurrentStreak.textContent = sess ? sess.currentStreak || 0 : 0;
    kpiBestStreak.textContent = sess ? sess.bestStreak || 0 : 0;

    // Sub-Card 1: Cognitive Pace & Completion Estimate
    renderPaceAndEstimate(sess, gameState, parseFloat(avgSeconds), poolRemaining);

    // Sub-Card 2: Deck Mastery Level
    renderDeckMastery(progressPct, accuracyPct, sess ? sess.currentStreak || 0 : 0, completedCards, totalCards);

    // Sub-Card 3: Flashcard Text Highlights
    renderHighlightsStats(gameState);

    // Anki Quality Distribution
    const anki = sess && sess.ankiRatings ? sess.ankiRatings : { again: 0, hard: 0, good: 0, easy: 0 };
    const ankiTotal = (anki.again || 0) + (anki.hard || 0) + (anki.good || 0) + (anki.easy || 0);
    ankiTotalBadge.textContent = `${ankiTotal} respostas`;

    const pctAgain = ankiTotal > 0 ? Math.round((anki.again / ankiTotal) * 100) : 0;
    const pctHard = ankiTotal > 0 ? Math.round((anki.hard / ankiTotal) * 100) : 0;
    const pctGood = ankiTotal > 0 ? Math.round((anki.good / ankiTotal) * 100) : 0;
    const pctEasy = ankiTotal > 0 ? Math.round((anki.easy / ankiTotal) * 100) : 0;

    ankiBarAgain.style.width = `${pctAgain}%`;
    ankiBarHard.style.width = `${pctHard}%`;
    ankiBarGood.style.width = `${pctGood}%`;
    ankiBarEasy.style.width = `${pctEasy}%`;

    ankiCountAgain.textContent = anki.again || 0;
    ankiCountHard.textContent = anki.hard || 0;
    ankiCountGood.textContent = anki.good || 0;
    ankiCountEasy.textContent = anki.easy || 0;

    ankiPctAgain.textContent = `${pctAgain}%`;
    ankiPctHard.textContent = `${pctHard}%`;
    ankiPctGood.textContent = `${pctGood}%`;
    ankiPctEasy.textContent = `${pctEasy}%`;

    // Performance by Question Type
    renderPerformanceByType(sess);

    // Timeline Flow (only last 10, newest on the left)
    renderTimelineFlow(sess);

    // Pedagogical Insights
    generatePedagogicalInsight(progressPct, accuracyPct, avgSeconds, anki, answered, history);
}

function renderPerformanceByType(sess) {
    byTypeContainer.innerHTML = '';
    const byType = sess && sess.byType ? sess.byType : {};

    const typeLabels = {
        'multiple_choice': { name: 'Múltipla Escolha', icon: '📝', color: 'bg-blue-500' },
        'open': { name: 'Resposta Aberta (Texto)', icon: '⌨️', color: 'bg-emerald-500' },
        'open_double': { name: 'Resposta Dupla', icon: '⚡', color: 'bg-purple-500' },
        'anki': { name: 'Conceito / Anki', icon: '🧠', color: 'bg-indigo-500' }
    };

    let hasAnyData = false;

    Object.keys(typeLabels).forEach(key => {
        const item = byType[key] || { total: 0, correct: 0 };
        if (item.total > 0) {
            hasAnyData = true;
            const pct = Math.round((item.correct / item.total) * 100);
            const info = typeLabels[key];

            const row = document.createElement('div');
            row.className = 'space-y-1.5';
            row.innerHTML = `
                <div class="flex items-center justify-between text-xs">
                    <span class="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <span>${info.icon}</span>
                        <span>${info.name}</span>
                    </span>
                    <span class="font-bold text-gray-900 dark:text-white">${pct}% <span class="text-gray-400 font-normal">(${item.correct}/${item.total})</span></span>
                </div>
                <div class="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                    <div class="${info.color} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
            `;
            byTypeContainer.appendChild(row);
        }
    });

    if (!hasAnyData) {
        byTypeContainer.innerHTML = `
            <p class="text-xs text-gray-400 dark:text-gray-500 italic py-2">
                Nenhum dado por formato registrado nesta sessão ainda.
            </p>
        `;
    }
}

function renderPaceAndEstimate(sess, gameState, avgSeconds, poolRemaining) {
    if (!paceEstimateTime) return;

    const log = sess && sess.answersLog ? sess.answersLog : [];

    // Fastest and slowest card
    if (log.length > 0) {
        const times = log.map(e => e.timeSeconds).filter(t => typeof t === 'number' && !isNaN(t));
        const correctEntries = log.filter(e => e.isCorrect && typeof e.timeSeconds === 'number');
        const minTime = correctEntries.length > 0 
            ? Math.min(...correctEntries.map(e => e.timeSeconds))
            : Math.min(...times);
        const maxTime = Math.max(...times);

        if (paceFastestCard) paceFastestCard.textContent = `${minTime}s`;
        if (paceSlowestCard) paceSlowestCard.textContent = `${maxTime}s`;
    } else {
        if (paceFastestCard) paceFastestCard.textContent = '--';
        if (paceSlowestCard) paceSlowestCard.textContent = '--';
    }

    // Remaining time estimate
    const allQuestionsCount = gameState.allQuestions ? gameState.allQuestions.length : 0;
    if (poolRemaining === 0 && allQuestionsCount > 0) {
        if (paceEstimateTime) paceEstimateTime.textContent = 'Concluído! 🎉';
        if (paceEstimateSub) paceEstimateSub.textContent = 'Todos os cards foram respondidos';
        if (paceEstimateBadge) {
            paceEstimateBadge.textContent = '100% Zerado';
            paceEstimateBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
        }
    } else if (poolRemaining > 0 && avgSeconds > 0) {
        const estSeconds = Math.round(poolRemaining * avgSeconds);
        const mins = Math.floor(estSeconds / 60);
        const secs = estSeconds % 60;
        const timeStr = mins > 0 ? `~${mins} min ${secs > 0 ? `${secs}s` : ''}` : `~${secs}s`;

        if (paceEstimateTime) paceEstimateTime.textContent = timeStr;
        if (paceEstimateSub) paceEstimateSub.textContent = `para ${poolRemaining} card${poolRemaining > 1 ? 's' : ''} restante${poolRemaining > 1 ? 's' : ''}`;
        if (paceEstimateBadge) {
            paceEstimateBadge.textContent = `Ritmo: ${avgSeconds}s/card`;
            paceEstimateBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
        }
    } else {
        if (paceEstimateTime) paceEstimateTime.textContent = '--';
        if (paceEstimateSub) paceEstimateSub.textContent = 'Inicie o estudo para calcular a previsão';
        if (paceEstimateBadge) {
            paceEstimateBadge.textContent = 'Aguardando dados';
            paceEstimateBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
        }
    }
}

function renderDeckMastery(progressPct, accuracyPct, currentStreak, completedCards, totalCards) {
    if (!masteryScore) return;

    if (totalCards === 0) {
        masteryScore.textContent = '0 pts';
        if (masteryProgressBar) masteryProgressBar.style.width = '0%';
        if (masteryLevelBadge) {
            masteryLevelBadge.textContent = 'Sem dados';
            masteryLevelBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
        }
        if (masteryDescription) masteryDescription.textContent = 'Nenhum card disponível no baralho.';
        return;
    }

    // 40% progress in deck, 45% accuracy, 15% streak bonus (clamped)
    const streakBonus = Math.min(15, (currentStreak || 0) * 1.5);
    const calculatedScore = Math.round((progressPct * 0.40) + (accuracyPct * 0.45) + streakBonus);
    const score = Math.max(0, Math.min(100, calculatedScore));

    masteryScore.textContent = `${score} pts`;
    if (masteryProgressBar) masteryProgressBar.style.width = `${score}%`;

    let badgeText = 'Iniciando 🥉';
    let badgeClass = 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300';
    let desc = 'Primeiras conexões neurais sendo formadas.';

    if (score >= 85) {
        badgeText = 'Mestre do Baralho 🏆';
        badgeClass = 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300';
        desc = 'Retenção sólida e velocidade de recall no nível máximo!';
    } else if (score >= 65) {
        badgeText = 'Domínio Avançado 🥇';
        badgeClass = 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
        desc = 'Excelente taxa de acertos e recall consistente.';
    } else if (score >= 40) {
        badgeText = 'Em Construção 🥈';
        badgeClass = 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
        desc = 'Fixação ativa em progresso constante.';
    }

    if (masteryLevelBadge) {
        masteryLevelBadge.textContent = badgeText;
        masteryLevelBadge.className = `text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`;
    }
    if (masteryDescription) {
        masteryDescription.textContent = desc;
    }
}

function renderHighlightsStats(gameState) {
    if (!highlightsSummaryText) return;

    const cards = gameState.allQuestions || [];
    let markedCardsCount = 0;
    let totalHighlightsCount = 0;
    let yellowCount = 0;
    let greenCount = 0;
    let blueCount = 0;
    let purpleCount = 0;

    cards.forEach(q => {
        const text = `${q.description || ''} ${q.answer || ''}`;
        const yellowMatches = text.match(/card-hl-yellow/g) || [];
        const greenMatches = text.match(/card-hl-green/g) || [];
        const blueMatches = text.match(/card-hl-blue/g) || [];
        const purpleMatches = text.match(/card-hl-purple/g) || [];

        const totalCardMarks = yellowMatches.length + greenMatches.length + blueMatches.length + purpleMatches.length;
        if (totalCardMarks > 0) {
            markedCardsCount++;
            totalHighlightsCount += totalCardMarks;
            yellowCount += yellowMatches.length;
            greenCount += greenMatches.length;
            blueCount += blueMatches.length;
            purpleCount += purpleMatches.length;
        }
    });

    if (highlightsTotalBadge) {
        highlightsTotalBadge.textContent = `${markedCardsCount} card${markedCardsCount !== 1 ? 's' : ''}`;
    }
    if (highlightsSummaryText) {
        highlightsSummaryText.textContent = totalHighlightsCount;
    }

    if (hlCountYellow) hlCountYellow.textContent = yellowCount;
    if (hlCountGreen) hlCountGreen.textContent = greenCount;
    if (hlCountBlue) hlCountBlue.textContent = blueCount;
    if (hlCountPurple) hlCountPurple.textContent = purpleCount;
}

function renderTimelineFlow(sess) {
    timelineStrip.innerHTML = '';
    const log = sess && sess.answersLog ? sess.answersLog : [];

    if (log.length === 0) {
        timelineStrip.innerHTML = '<p class="text-xs text-gray-400 italic py-2">Nenhum card respondido nesta sessão ainda.</p>';
        if (timelineCounterBadge) {
            timelineCounterBadge.innerHTML = '<span>&larr; Mais recentes (últimos 10)</span>';
        }
        return;
    }

    const totalAnswered = log.length;
    // Show only the last 10 answers, with the most recent on the left (index 0)
    const recent10 = log.slice(-10).reverse();

    if (timelineCounterBadge) {
        timelineCounterBadge.innerHTML = totalAnswered > 10
            ? `<span>&larr; Mais recentes (10 de ${totalAnswered} respondidos)</span>`
            : `<span>&larr; Mais recentes (${totalAnswered} nesta rodada)</span>`;
    }

    recent10.forEach((entry, reverseIdx) => {
        const originalCardNum = totalAnswered - reverseIdx;
        const isLatest = reverseIdx === 0;

        const dot = document.createElement('div');
        const isOk = entry.isCorrect;
        const isAnkiHard = entry.rating === 'hard';
        const isAnkiEasy = entry.rating === 'easy';

        let badgeColor = isOk ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white';
        let label = isOk ? '✓' : '✕';
        if (isAnkiHard) {
            badgeColor = 'bg-orange-500 text-white';
            label = '⚡';
        } else if (isAnkiEasy) {
            badgeColor = 'bg-blue-500 text-white';
            label = '★';
        }

        const ringEffect = isLatest 
            ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800' 
            : '';

        dot.className = `flex-shrink-0 w-8 h-8 rounded-xl ${badgeColor} ${ringEffect} flex items-center justify-center font-bold text-xs cursor-pointer shadow-sm hover:scale-110 transition-transform relative group`;
        dot.innerHTML = `
            <span>${label}</span>
            ${isLatest ? `<span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse" title="Mais recente"></span>` : ''}
            <!-- Tooltip -->
            <div class="hidden group-hover:block absolute bottom-full mb-2 z-30 p-2.5 bg-gray-900/95 text-white text-[11px] rounded-xl shadow-xl w-52 text-left backdrop-blur-sm pointer-events-none -left-20">
                <div class="flex items-center justify-between mb-1 pb-1 border-b border-gray-700">
                    <span class="font-bold text-gray-200">#${originalCardNum}</span>
                    <span class="text-[10px] font-semibold ${isLatest ? 'text-blue-400' : 'text-gray-400'}">
                        ${isLatest ? 'Último respondido' : `${reverseIdx + 1}º mais recente`}
                    </span>
                </div>
                <p class="text-gray-200 truncate mb-1" title="${entry.question}">${entry.question}</p>
                <div class="flex items-center justify-between text-gray-400 text-[10px]">
                    <span>Tempo: <b>${entry.timeSeconds}s</b></span>
                    <span>Classificação: <b>${entry.rating}</b></span>
                </div>
                ${entry.userAnswer ? `<p class="text-blue-300 text-[10px] truncate mt-1 pt-1 border-t border-gray-800">Digitou: ${entry.userAnswer}</p>` : ''}
            </div>
        `;
        timelineStrip.appendChild(dot);
    });
}

function generatePedagogicalInsight(progressPct, accuracyPct, avgSeconds, anki, answered, history) {
    if (answered === 0) {
        insightTitle.textContent = 'Sessão em Andamento';
        insightText.textContent = 'Continue estudando seus flashcards para que nosso sistema trace sua curva de retenção e ritmo de aprendizado.';
        return;
    }

    let comparisonText = '';
    if (history && history.length > 0) {
        const lastSess = history[0];
        const lastAcc = lastSess.accuracy !== undefined ? lastSess.accuracy : 0;
        const diff = accuracyPct - lastAcc;
        if (diff > 0) {
            comparisonText = ` Você está com desempenho +${diff}% superior à sua última sessão (${lastAcc}%)!`;
        } else if (diff < 0) {
            comparisonText = ` Seu rendimento está ${Math.abs(diff)}% abaixo da última sessão (${lastAcc}%). Revisite os cartões sinalizados para recuperar a retenção.`;
        } else {
            comparisonText = ` Seu índice de precisão está perfeitamente estável em relação à última sessão (${lastAcc}%).`;
        }
    }

    if (accuracyPct >= 85) {
        insightTitle.textContent = '🎉 Alta Retenção e Domínio!';
        insightText.textContent = `Você está com ${accuracyPct}% de precisão com média de ${avgSeconds}s por cartão. Seu recall ativo está muito afiado!${comparisonText} Recomendamos avançar nos cartões restantes para consolidar o baralho na memória de longo prazo.`;
    } else if (accuracyPct >= 70) {
        insightTitle.textContent = '📈 Bom Progresso com Margem de Ajuste';
        insightText.textContent = `Sua precisão atual é de ${accuracyPct}%.${comparisonText} Foque nos cards marcados como "Errei" ou "Difícil" para fechar lacunas pontuais de retenção antes de finalizar a rodada.`;
    } else {
        insightTitle.textContent = '⚠️ Foco Recomendado em Revisão Espaçada';
        insightText.textContent = `A precisão atual está em ${accuracyPct}%.${comparisonText} Cartões errados continuarão aparecendo em intervalos menores para fortalecer as sinapses neurais desse conteúdo.`;
    }
}

// ==================== SEÇÃO DE INTELIGÊNCIA ARTIFICIAL ====================

function renderTopicItem(t, idx) {
    const isAnswered = t.answeredCount > 0;
    const acc = t.accuracy;

    let badgeClass = 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    let badgeText = '⏳ Pendente';
    let barColor = 'bg-gray-300 dark:bg-gray-600';
    let barWidth = '0%';

    if (isAnswered) {
        barWidth = `${acc}%`;
        if (acc >= 80) {
            badgeClass = 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50';
            badgeText = idx === 0 ? '🏆 Melhor Assunto' : '🎯 Alta Retenção';
            barColor = 'bg-gradient-to-r from-emerald-500 to-teal-500';
        } else if (acc >= 60) {
            badgeClass = 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50';
            badgeText = '📈 Bom Progresso';
            barColor = 'bg-gradient-to-r from-blue-500 to-indigo-500';
        } else {
            badgeClass = 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50';
            badgeText = '⚠️ Atenção (Revisar)';
            barColor = 'bg-gradient-to-r from-red-500 to-rose-500';
        }
    }

    return `
        <div class="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-750 border border-gray-200/70 dark:border-gray-700/60 transition hover:border-purple-300 dark:hover:border-purple-700 shadow-xs">
            <div class="flex items-start justify-between gap-2 mb-2">
                <div class="min-w-0 flex-1">
                    <h4 class="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate" title="${t.topic}">
                        ${t.topic}
                    </h4>
                    <p class="text-[11px] text-gray-500 dark:text-gray-400">
                        ${t.cardsCount} card${t.cardsCount !== 1 ? 's' : ''} ${isAnswered ? `• ${t.correctCount}/${t.answeredCount} certos` : '• Não respondido nesta rodada'}
                    </p>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}">
                        ${badgeText}
                    </span>
                    <span class="text-xs font-extrabold text-gray-800 dark:text-gray-200">
                        ${isAnswered ? `${acc}%` : '--'}
                    </span>
                </div>
            </div>
            <!-- Progress / Retention Bar -->
            <div class="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden shadow-inner">
                <div class="${barColor} h-full rounded-full transition-all duration-500" style="width: ${barWidth}"></div>
            </div>
        </div>
    `;
}

function renderSubjectItem(s, idx, totalSubjects) {
    const acc = s.accuracy;
    let badgeClass = 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50';
    let badgeText = '📈 Estável';
    let barColor = 'bg-gradient-to-r from-blue-500 to-purple-500';

    if (idx === 0 && s.totalAnswered > 0) {
        badgeClass = 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50';
        badgeText = '🏆 Melhor Matéria';
        barColor = 'bg-gradient-to-r from-purple-500 to-indigo-600';
    } else if (idx === totalSubjects - 1 && totalSubjects > 1 && acc < 70 && s.totalAnswered > 0) {
        badgeClass = 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50';
        badgeText = '⚠️ Foco Recomendado';
        barColor = 'bg-gradient-to-r from-amber-500 to-orange-500';
    } else if (acc >= 80) {
        badgeClass = 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50';
        badgeText = '🥇 Alta Retenção';
        barColor = 'bg-gradient-to-r from-emerald-500 to-teal-500';
    }

    const deckNames = s.decks.join(', ');

    return `
        <div class="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-750 border border-gray-200/70 dark:border-gray-700/60 transition hover:border-purple-300 dark:hover:border-purple-700 shadow-xs">
            <div class="flex items-start justify-between gap-2 mb-2">
                <div class="min-w-0 flex-1">
                    <h4 class="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate" title="${s.subject}">
                        ${s.subject}
                    </h4>
                    <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title="${deckNames}">
                        ${s.decks.length} baralho${s.decks.length !== 1 ? 's' : ''}: ${deckNames}
                    </p>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}">
                        ${badgeText}
                    </span>
                    <span class="text-xs font-extrabold text-gray-800 dark:text-gray-200">
                        ${s.totalAnswered > 0 ? `${acc}%` : '--'}
                    </span>
                </div>
            </div>
            <!-- Accuracy Bar -->
            <div class="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden shadow-inner">
                <div class="${barColor} h-full rounded-full transition-all duration-500" style="width: ${s.totalAnswered > 0 ? acc : 0}%"></div>
            </div>
            <div class="flex items-center justify-between text-[10px] text-gray-400 mt-1.5">
                <span>${s.totalCorrect}/${s.totalAnswered} acertos</span>
                <span>${s.totalSessions} sessõe${s.totalSessions !== 1 ? 's' : 'ão'}</span>
            </div>
        </div>
    `;
}

function renderHistorySubjectsSection(subjectsStats) {
    if (!aiHistorySubjectsSection) return;
    if (!subjectsStats || subjectsStats.length === 0) {
        aiHistorySubjectsSection.innerHTML = '';
        return;
    }

    const subjectsHtml = subjectsStats.map((s, idx) => renderSubjectItem(s, idx, subjectsStats.length)).join('');

    aiHistorySubjectsSection.innerHTML = `
        <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                <div class="flex items-center gap-2">
                    <span class="text-base">📚</span>
                    <div>
                        <h2 class="font-bold text-base text-gray-900 dark:text-white">Desempenho por Matérias Globais (IA)</h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Baralhos agrupados em disciplinas com base no histórico</p>
                    </div>
                </div>
                <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                    ${subjectsStats.length} matéria${subjectsStats.length !== 1 ? 's' : ''}
                </span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                ${subjectsHtml}
            </div>
        </div>
    `;
}

function renderAiDashboard(currentDeckTitle, subjectsStats, topicsStats, gameState, statsData) {
    if (!aiStatsSection) return;

    const topicsHtml = topicsStats.length > 0
        ? topicsStats.map((t, idx) => renderTopicItem(t, idx)).join('')
        : '<p class="text-xs text-gray-400 italic py-4 text-center">Nenhum assunto classificado ainda.</p>';

    const subjectsHtml = subjectsStats.length > 0
        ? subjectsStats.map((s, idx) => renderSubjectItem(s, idx, subjectsStats.length)).join('')
        : '<p class="text-xs text-gray-400 italic py-4 text-center">Nenhuma matéria classificada ainda.</p>';

    aiStatsSection.innerHTML = `
        <div class="space-y-4">
            <!-- Header Bar -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-transparent dark:from-purple-950/20 dark:via-blue-950/20 dark:to-transparent p-4 rounded-2xl border border-purple-200/70 dark:border-purple-800/40">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="text-sm font-bold text-gray-900 dark:text-white">Categorização Inteligente</h2>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Flash-Lite Ativo
                            </span>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Classificação semântica em categorias consolidadas</p>
                    </div>
                </div>

                <div class="flex items-center gap-2 self-end sm:self-auto">
                    <button id="btn-refresh-ai-stats" class="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition shadow-xs flex items-center gap-1.5" title="Recalcular categorização com Gemini Flash-Lite">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Recategorizar com IA</span>
                    </button>
                    <button id="btn-change-ai-key" class="text-xs font-semibold px-2.5 py-1.5 rounded-xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition" title="Configurar chave de API">
                        Chave
                    </button>
                </div>
            </div>

            <!-- 2-Column Responsive Panels -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                <!-- Panel 1: Assuntos Dentro do Baralho Atual -->
                <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                            <div>
                                <h3 class="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                                    <span>🎯</span> Assuntos deste Baralho
                                </h3>
                                <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title="${currentDeckTitle}">
                                    ${currentDeckTitle}
                                </p>
                            </div>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                ${topicsStats.length} assunto${topicsStats.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        <div class="space-y-2.5 max-h-[360px] overflow-y-auto custom-scrollbar pr-1" id="ai-topics-list">
                            ${topicsHtml}
                        </div>
                    </div>
                </div>

                <!-- Panel 2: Matérias Globais (Visão de Todos os Baralhos) -->
                <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                            <div>
                                <h3 class="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                                    <span>📚</span> Desempenho por Matéria
                                </h3>
                                <p class="text-[11px] text-gray-500 dark:text-gray-400">
                                    Visão agregada de todos os baralhos
                                </p>
                            </div>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                ${subjectsStats.length} matéria${subjectsStats.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        <div class="space-y-2.5 max-h-[360px] overflow-y-auto custom-scrollbar pr-1" id="ai-subjects-list">
                            ${subjectsHtml}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `;

    document.getElementById('btn-refresh-ai-stats')?.addEventListener('click', () => {
        triggerAiCategorization(gameState, statsData);
    });

    document.getElementById('btn-change-ai-key')?.addEventListener('click', () => {
        openAiModal();
    });

    // Also update Tab 2 Subjects section if present
    if (aiHistorySubjectsSection) {
        renderHistorySubjectsSection(subjectsStats);
    }
}

function renderAiSection(gameState, statsData) {
    if (!aiStatsSection) return;

    const apiKey = getGeminiApiKey();
    const currentDeckTitle = gameState.deckTitle || (localStorage.getItem('flashcardsActiveMode') === 'notebook' ? 'Caderno' : 'Flashcards');
    const categories = getStoredAiCategories();

    // Case 1: AI is NOT activated -> Do nothing automatically, render prompt with API Key input
    if (!apiKey) {
        aiStatsSection.innerHTML = `
            <div class="bg-gradient-to-b from-purple-500/5 via-blue-500/5 to-transparent dark:from-purple-900/10 dark:via-blue-900/10 dark:to-transparent p-5 sm:p-6 rounded-2xl border border-purple-200/80 dark:border-purple-800/40 shadow-sm relative overflow-hidden">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-700/50">
                                <span class="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                                Gemini Flash-Lite
                            </span>
                            <span class="text-xs text-gray-400 dark:text-gray-500 font-medium">Categorização Semântica</span>
                        </div>
                        <h2 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Desempenho por Matérias & Assuntos (IA)</h2>
                        <p class="text-xs text-gray-600 dark:text-gray-400 max-w-xl leading-relaxed">
                            Descubra em quais matérias e assuntos você tem maior domínio ou precisa revisar. O Gemini agrupará seus baralhos e temas com o menor número possível de categorias.
                        </p>
                    </div>

                    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                        <div class="relative flex-1 sm:w-64">
                            <input type="password" id="ai-stats-key-input"
                                placeholder="Insira sua Gemini API Key..."
                                class="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white shadow-inner"
                                autocomplete="off">
                        </div>
                        <button id="btn-generate-ai-stats"
                            class="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-b from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 active:scale-[0.98] transition shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Gerar estatísticas de IA</span>
                        </button>
                    </div>
                </div>
                <div id="ai-stats-key-error" class="hidden text-xs text-red-500 dark:text-red-400 mt-2.5 font-medium"></div>
            </div>
        `;

        const btnGen = document.getElementById('btn-generate-ai-stats');
        const inputKey = document.getElementById('ai-stats-key-input');
        const errorKey = document.getElementById('ai-stats-key-error');

        btnGen?.addEventListener('click', () => {
            const key = (inputKey?.value || '').trim();
            if (!key) {
                if (errorKey) {
                    errorKey.textContent = "Por favor, insira uma Gemini API Key válida para gerar as estatísticas.";
                    errorKey.classList.remove('hidden');
                }
                return;
            }
            if (errorKey) errorKey.classList.add('hidden');
            setGeminiApiKey(key);
            triggerAiCategorization(gameState, statsData);
        });

        if (aiHistorySubjectsSection) aiHistorySubjectsSection.innerHTML = '';
        return;
    }

    // Case 2: Loading State
    if (isAiLoading) {
        aiStatsSection.innerHTML = `
            <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-purple-200 dark:border-purple-800/40 shadow-sm flex flex-col items-center justify-center text-center space-y-3 py-10">
                <div class="w-10 h-10 border-4 border-purple-200 dark:border-purple-900 border-t-purple-600 rounded-full animate-spin"></div>
                <div class="space-y-1">
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white">Analisando Baralhos e Assuntos com Gemini Flash-Lite...</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 max-w-md">
                        Categorizando seus baralhos em matérias amplas e mapeando os tópicos específicos dos cards com o menor número possível de categorias.
                    </p>
                </div>
            </div>
        `;
        return;
    }

    // Case 3: AI is active, check if current deck needs categorization
    const deckTopics = categories?.cardTopicsByDeck?.[currentDeckTitle];
    if (!categories || !deckTopics || deckTopics.length === 0) {
        triggerAiCategorization(gameState, statsData);
        return;
    }

    // Case 4: Render Categorized Dashboard
    const { subjectsStats, topicsStats } = computeAiStats({
        categories,
        currentDeckTitle,
        allQuestions: gameState.allQuestions || [],
        currentSession: statsData.currentSession,
        history: statsData.history
    });

    renderAiDashboard(currentDeckTitle, subjectsStats, topicsStats, gameState, statsData);
}

async function triggerAiCategorization(gameState, statsData) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return;

    isAiLoading = true;
    renderAiSection(gameState, statsData);

    try {
        const currentDeckTitle = gameState.deckTitle || (localStorage.getItem('flashcardsActiveMode') === 'notebook' ? 'Caderno' : 'Flashcards');
        const historyDeckTitles = (statsData.history || []).map(s => s.deckTitle).filter(Boolean);
        const deckTitles = Array.from(new Set([currentDeckTitle, ...historyDeckTitles]));
        const cards = gameState.allQuestions || [];
        const existingCategories = getStoredAiCategories() || { knownSubjects: [], knownTopicsByDeck: {} };

        await callGeminiFlashLiteCategorization({
            apiKey,
            currentDeckTitle,
            deckTitles,
            cards,
            existingCategories
        });

        isAiLoading = false;
        showStatsPill("Estatísticas de IA geradas com sucesso!", true);
        renderAiSection(gameState, statsData);

    } catch (err) {
        console.error("Erro na categorização IA:", err);
        isAiLoading = false;
        if (!aiStatsSection) return;

        aiStatsSection.innerHTML = `
            <div class="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="text-sm">⚠️</span>
                        <h3 class="text-sm font-bold text-red-800 dark:text-red-200">Não foi possível gerar as estatísticas com IA</h3>
                    </div>
                    <p class="text-xs text-red-700 dark:text-red-300 max-w-lg">
                        ${err.message || 'Verifique sua conexão ou se sua Gemini API Key tem cotas disponíveis.'}
                    </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button id="btn-retry-ai" class="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-sm">
                        Tentar Novamente
                    </button>
                    <button id="btn-change-key-error" class="px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 transition shadow-xs">
                        Alterar Chave
                    </button>
                </div>
            </div>
        `;

        document.getElementById('btn-retry-ai')?.addEventListener('click', () => {
            triggerAiCategorization(gameState, statsData);
        });
        document.getElementById('btn-change-key-error')?.addEventListener('click', () => {
            openAiModal();
        });
    }
}

// --- TAB 2: HISTORY ---
function renderHistory(statsData) {
    const history = statsData.history || [];
    historyBadgeCount.textContent = history.length;

    // Summary numbers
    alltimeSessions.textContent = statsData.allTime ? statsData.allTime.totalSessions || history.length : history.length;
    
    const totalSeconds = statsData.allTime ? statsData.allTime.totalTimeSeconds || 0 : 0;
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    alltimeTime.textContent = `${hours}h ${mins}m`;

    alltimeCards.textContent = statsData.allTime ? statsData.allTime.totalCardsAnswered || 0 : 0;
    
    const totalAns = statsData.allTime ? statsData.allTime.totalCardsAnswered || 0 : 0;
    const totalCorr = statsData.allTime ? statsData.allTime.totalCorrect || 0 : 0;
    const histAcc = totalAns > 0 ? Math.round((totalCorr / totalAns) * 100) : 0;
    alltimeAccuracy.textContent = `${histAcc}%`;

    if (alltimeBestStreak) {
        const bestStreak = statsData.allTime ? statsData.allTime.bestStreakAllTime || 0 : 0;
        alltimeBestStreak.textContent = `🔥 ${bestStreak}`;
    }

    // Render Accuracy Chart
    renderAccuracyChart(history);

    // Render Past Sessions List
    historyList.innerHTML = '';
    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="text-center py-8 text-gray-400 dark:text-gray-500">
                <p class="text-sm">Nenhuma sessão anterior concluída ainda.</p>
                <p class="text-xs mt-1">Conclua ou reinicie uma rodada para registrar seu histórico aqui!</p>
            </div>
        `;
        return;
    }

    history.forEach((sess, idx) => {
        const dateStr = new Date(sess.startTime).toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });

        const acc = sess.accuracy !== undefined ? sess.accuracy : 0;
        const accColor = acc >= 80 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' :
            acc >= 65 ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' :
            'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800';

        const card = document.createElement('div');
        card.className = 'p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition bg-gray-50/50 dark:bg-gray-750 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3';
        card.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    #${history.length - idx}
                </div>
                <div class="min-w-0">
                    <div class="flex items-center gap-2">
                        <h3 class="font-bold text-sm text-gray-900 dark:text-white truncate">${sess.deckTitle || 'Flashcards'}</h3>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-medium ${sess.completed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}">
                            ${sess.completed ? 'Concluída' : 'Parcial'}
                        </span>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${dateStr} • Duração: ${formatSeconds(sess.durationSeconds)} • ${sess.cardsAnswered || 0} cards</p>
                </div>
            </div>

            <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                ${sess.bestStreak ? `<span class="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">🔥 ${sess.bestStreak}</span>` : ''}
                <div class="px-3 py-1 rounded-xl border ${accColor} text-sm font-extrabold">
                    ${acc}%
                </div>
            </div>
        `;
        historyList.appendChild(card);
    });
}

function renderAccuracyChart(history) {
    accuracyChartContainer.innerHTML = '';
    if (!history || history.length === 0) {
        accuracyChartContainer.innerHTML = '<p class="text-xs text-gray-400 italic m-auto">Sem histórico de sessões para exibir gráfico.</p>';
        chartTrendBadge.classList.add('hidden');
        return;
    }

    // Sort chronologically for chart (oldest to newest, max last 15)
    const chartData = [...history].reverse().slice(-12);

    if (chartData.length >= 2) {
        const first = chartData[0].accuracy || 0;
        const last = chartData[chartData.length - 1].accuracy || 0;
        const diff = last - first;
        chartTrendBadge.textContent = diff >= 0 ? `📈 +${diff}%` : `📉 ${diff}%`;
        chartTrendBadge.className = `text-xs font-bold px-2.5 py-1 rounded-full ${
            diff >= 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
        }`;
        chartTrendBadge.classList.remove('hidden');
    } else {
        chartTrendBadge.classList.add('hidden');
    }

    chartData.forEach((item, index) => {
        const acc = item.accuracy !== undefined ? item.accuracy : 0;
        const heightPct = Math.max(8, Math.min(100, acc));

        const barColor = acc >= 80 ? 'bg-emerald-500 hover:bg-emerald-600' :
            acc >= 65 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-500 hover:bg-red-600';

        const col = document.createElement('div');
        col.className = 'flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer min-w-[28px]';
        col.innerHTML = `
            <!-- Tooltip -->
            <div class="hidden group-hover:block absolute bottom-full mb-2 z-30 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl whitespace-nowrap">
                <span class="font-bold">${acc}% de acerto</span><br>
                <span>${item.cardsAnswered || 0} cards • ${formatSeconds(item.durationSeconds)}</span>
            </div>
            <span class="text-[10px] font-bold text-gray-600 dark:text-gray-300 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">${acc}%</span>
            <div class="w-full max-w-[36px] ${barColor} rounded-t-lg transition-all duration-500" style="height: ${heightPct}%"></div>
            <span class="text-[9px] text-gray-400 mt-1 font-mono">S${index + 1}</span>
        `;
        accuracyChartContainer.appendChild(col);
    });
}

// --- TAB 3: STRUGGLING CARDS ---
function renderStrugglingCards(sess) {
    strugglingList.innerHTML = '';
    const strugglingObj = sess && sess.strugglingCards ? sess.strugglingCards : {};
    const strugglingKeys = Object.keys(strugglingObj);

    strugglingBadgeCount.textContent = strugglingKeys.length;
    if (strugglingKeys.length > 0) {
        strugglingBadgeCount.classList.remove('hidden');
        addAllToNotebookBtn.classList.remove('hidden');
    } else {
        strugglingBadgeCount.classList.add('hidden');
        addAllToNotebookBtn.classList.add('hidden');
    }

    if (strugglingKeys.length === 0) {
        strugglingList.innerHTML = `
            <div class="text-center py-8 text-gray-400 dark:text-gray-500">
                <p class="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Nenhum card com dificuldade nesta sessão! 👏</p>
                <p class="text-xs mt-1">Quando você errar ou marcar 'Difícil/Errei', eles aparecerão aqui para revisão focada.</p>
            </div>
        `;
        return;
    }

    strugglingKeys.forEach(key => {
        const item = strugglingObj[key];
        const cardEl = document.createElement('div');
        cardEl.className = 'p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3';
        cardEl.innerHTML = `
            <div class="space-y-1 flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-snug">${item.description}</p>
                <p class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Resposta: ${item.answer || 'Consultar cartão'}</p>
                <div class="flex items-center gap-2 text-[10px] text-gray-400">
                    <span class="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-bold">${item.incorrectCount} erro(s)</span>
                    <span>Última avaliação: ${item.lastRating}</span>
                </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <button class="add-single-notebook-btn px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 text-xs font-semibold transition"
                    data-desc="${encodeURIComponent(item.description)}" data-ans="${encodeURIComponent(item.answer || '')}" data-ans2="${encodeURIComponent(item.answer2 || '')}" data-type="${item.type || 'open'}">
                    + Caderno
                </button>
            </div>
        `;
        strugglingList.appendChild(cardEl);
    });

    // Add listener to "+ Caderno" buttons
    document.querySelectorAll('.add-single-notebook-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const desc = decodeURIComponent(btn.dataset.desc);
            const ans = decodeURIComponent(btn.dataset.ans);
            const ans2 = decodeURIComponent(btn.dataset.ans2);
            const type = btn.dataset.type;
            addCardToNotebook({ description: desc, answer: ans, answer2: ans2, type: type });
            btn.textContent = 'Adicionado ✓';
            btn.classList.add('bg-emerald-100', 'text-emerald-700');
            btn.disabled = true;
        });
    });
}

function addCardToNotebook(card) {
    let notebookState = JSON.parse(localStorage.getItem('flashcardsNotebook')) || {
        allQuestions: [], questionsPool: [], score: 0, deckTitle: 'Caderno'
    };

    const alreadyExists = notebookState.allQuestions.some(q => q.description === card.description);
    if (!alreadyExists) {
        notebookState.allQuestions.push(card);
        notebookState.questionsPool.push(card);
        localStorage.setItem('flashcardsNotebook', JSON.stringify(notebookState));
        showStatsPill("Card adicionado ao Caderno de Estudos!", true);
    } else {
        showStatsPill("Este card já estava no seu Caderno!", true);
    }
}

// ACTION LISTENERS
tabBtnCurrent?.addEventListener('click', () => switchTab('current'));
tabBtnHistory?.addEventListener('click', () => switchTab('history'));
tabBtnStruggling?.addEventListener('click', () => switchTab('struggling'));

addAllToNotebookBtn?.addEventListener('click', () => {
    const statsData = getStatsStorage();
    const strugglingObj = statsData.currentSession && statsData.currentSession.strugglingCards ? statsData.currentSession.strugglingCards : {};
    let addedCount = 0;

    Object.keys(strugglingObj).forEach(key => {
        const item = strugglingObj[key];
        let notebookState = JSON.parse(localStorage.getItem('flashcardsNotebook')) || {
            allQuestions: [], questionsPool: [], score: 0, deckTitle: 'Caderno'
        };
        if (!notebookState.allQuestions.some(q => q.description === item.description)) {
            notebookState.allQuestions.push(item);
            notebookState.questionsPool.push(item);
            localStorage.setItem('flashcardsNotebook', JSON.stringify(notebookState));
            addedCount++;
        }
    });

    showStatsPill(`${addedCount} cards adicionados ao Caderno!`, true);
    renderStrugglingCards(statsData.currentSession);
});

clearStatsBtn?.addEventListener('click', () => {
    if (confirm("Deseja realmente limpar todo o histórico de estatísticas? Essa ação não pode ser desfeita.")) {
        resetAllStats();
        showStatsPill("Estatísticas zeradas com sucesso!", true);
        renderAllStats();
    }
});

exportStatsBtn?.addEventListener('click', () => {
    const data = getStatsStorage();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcards_estatisticas_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showStatsPill("Relatório exportado!", true);
});

seedDemoBtn?.addEventListener('click', () => {
    injectSampleHistory("Semio locomotor");
    showStatsPill("Dados de demonstração gerados!", true);
    renderAllStats();
});

// AI CONFIG MODAL LISTENERS
closeAiModalBtn?.addEventListener('click', closeAiModal);
aiConfigModal?.addEventListener('click', (e) => {
    if (e.target === aiConfigModal) closeAiModal();
});

modalSaveApiKeyBtn?.addEventListener('click', () => {
    const key = (modalApiKeyInput?.value || '').trim();
    if (!key) {
        alert("Por favor, insira uma chave de API válida.");
        return;
    }
    setGeminiApiKey(key);
    closeAiModal();
    showStatsPill("Chave de API salva!", true);
    const activeMode = localStorage.getItem('flashcardsActiveMode') || 'normal';
    const storageKey = activeMode === 'notebook' ? 'flashcardsNotebook' : 'flashcardsSave';
    const gameState = JSON.parse(localStorage.getItem(storageKey)) || {};
    const statsData = getStatsStorage();
    triggerAiCategorization(gameState, statsData);
});

modalDisableAiBtn?.addEventListener('click', () => {
    setGeminiApiKey('');
    closeAiModal();
    showStatsPill("Recursos de IA desativados.", false);
    const activeMode = localStorage.getItem('flashcardsActiveMode') || 'normal';
    const storageKey = activeMode === 'notebook' ? 'flashcardsNotebook' : 'flashcardsSave';
    const gameState = JSON.parse(localStorage.getItem(storageKey)) || {};
    const statsData = getStatsStorage();
    renderAiSection(gameState, statsData);
});

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    renderAllStats();
});
