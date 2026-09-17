import { getStatsStorage, saveStatsStorage, resetAllStats, injectSampleHistory } from './stats-tracker.js';
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
const insightTitle = document.getElementById('insight-title');
const insightText = document.getElementById('insight-text');

// History Elements
const alltimeSessions = document.getElementById('alltime-sessions');
const alltimeTime = document.getElementById('alltime-time');
const alltimeCards = document.getElementById('alltime-cards');
const alltimeAccuracy = document.getElementById('alltime-accuracy');
const chartTrendBadge = document.getElementById('chart-trend-badge');
const accuracyChartContainer = document.getElementById('accuracy-chart-container');
const historyList = document.getElementById('history-list');

// Struggling Elements
const strugglingList = document.getElementById('struggling-list');
const addAllToNotebookBtn = document.getElementById('add-all-to-notebook-btn');

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
    renderCurrentSession(statsData.currentSession, gameState);

    // --- TAB 2: HISTORY ---
    renderHistory(statsData);

    // --- TAB 3: STRUGGLING CARDS ---
    renderStrugglingCards(statsData.currentSession);
}

function renderCurrentSession(sess, gameState) {
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

    // Timeline Flow
    renderTimelineFlow(sess);

    // Pedagogical Insights
    generatePedagogicalInsight(progressPct, accuracyPct, avgSeconds, anki, answered);
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

function renderTimelineFlow(sess) {
    timelineStrip.innerHTML = '';
    const log = sess && sess.answersLog ? sess.answersLog : [];

    if (log.length === 0) {
        timelineStrip.innerHTML = '<p class="text-xs text-gray-400 italic py-2">Nenhum card respondido nesta sessão ainda.</p>';
        return;
    }

    log.forEach((entry, idx) => {
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

        dot.className = `flex-shrink-0 w-8 h-8 rounded-xl ${badgeColor} flex items-center justify-center font-bold text-xs cursor-pointer shadow-sm hover:scale-110 transition-transform relative group`;
        dot.innerHTML = `
            <span>${label}</span>
            <!-- Tooltip -->
            <div class="hidden group-hover:block absolute bottom-full mb-2 z-30 p-2.5 bg-gray-900/95 text-white text-[11px] rounded-xl shadow-xl w-48 text-left backdrop-blur-sm pointer-events-none -left-20">
                <p class="font-bold text-gray-200 truncate mb-1">#${idx + 1} ${entry.question}</p>
                <p class="text-gray-400 text-[10px]">Tempo: ${entry.timeSeconds}s</p>
                ${entry.userAnswer ? `<p class="text-blue-300 text-[10px] truncate">Digitou: ${entry.userAnswer}</p>` : ''}
            </div>
        `;
        timelineStrip.appendChild(dot);
    });
}

function generatePedagogicalInsight(progressPct, accuracyPct, avgSeconds, anki, answered) {
    if (answered === 0) {
        insightTitle.textContent = 'Sessão em Andamento';
        insightText.textContent = 'Continue estudando seus flashcards para que nosso sistema trace sua curva de retenção e ritmo de aprendizado.';
        return;
    }

    if (accuracyPct >= 85) {
        insightTitle.textContent = '🎉 Alta Retenção e Domínio!';
        insightText.textContent = `Você está com ${accuracyPct}% de precisão com média de ${avgSeconds}s por cartão. Seu recall ativo está muito afiado! Recomendamos avançar nos cartões restantes para consolidar o baralho na memória de longo prazo.`;
    } else if (accuracyPct >= 70) {
        insightTitle.textContent = '📈 Bom Progresso com Margem de Ajuste';
        insightText.textContent = `Sua precisão atual é de ${accuracyPct}%. Foque nos cards marcados como "Errei" ou "Difícil" para fechar lacunas pontuais de retenção antes de finalizar a rodada.`;
    } else {
        insightTitle.textContent = '⚠️ Foco Recomendado em Revisão Espaçada';
        insightText.textContent = `A precisão atual está em ${accuracyPct}%. Cartões errados continuarão aparecendo em intervalos menores para fortalecer as sinapses neurais desse conteúdo.`;
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

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    renderAllStats();
});
