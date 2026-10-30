// SPDX-License-Identifier: GPL-2.0-only
/*
 * Copyright (C) 2026 Arthur <arthur.paludo.c@gmail.com>
 */
/**
 * js/engine/notifications.js
 * Módulo de notificações diárias para lembretes de estudo e proteção de streak.
 * Permite agendamentos independentes para Manhã, Meio-dia e Noite (com alerta agressivo).
 * Desativadas por padrão, configuráveis pelo usuário.
 */

import { getTodayDateString, getDailyStreak } from './notebook-scheduler.js';
import { debouncedSyncSlotsToCloud } from '../slot-manager.js';

export const NOTIFICATIONS_STORAGE_KEY = 'flashcards_notifications_settings';

export const DEFAULT_NOTIFICATION_SETTINGS = {
    enabled: false,
    morning: {
        enabled: false,
        time: '09:00'
    },
    noon: {
        enabled: false,
        time: '13:00'
    },
    night: {
        enabled: false,
        time: '21:00'
    }
};

/**
 * Retorna as configurações salvas ou padrão (desativadas por padrão).
 */
export function getNotificationSettings() {
    try {
        const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                enabled: Boolean(parsed.enabled),
                morning: {
                    enabled: Boolean(parsed.morning?.enabled),
                    time: parsed.morning?.time || '09:00'
                },
                noon: {
                    enabled: Boolean(parsed.noon?.enabled),
                    time: parsed.noon?.time || '13:00'
                },
                night: {
                    enabled: Boolean(parsed.night?.enabled),
                    time: parsed.night?.time || '21:00'
                }
            };
        }
    } catch (e) {
        console.warn("[Notifications] Erro ao carregar configurações:", e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS));
}

/**
 * Salva as configurações de notificação.
 */
export function saveNotificationSettings(settings) {
    try {
        localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(settings));
        updateNotificationsUI();
        debouncedSyncSlotsToCloud();
    } catch (e) {
        console.warn("[Notifications] Erro ao salvar configurações:", e);
    }
}

/**
 * Verifica se a Web Notification API é suportada.
 */
export function hasNotificationSupport() {
    return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Solicita permissão ao usuário.
 */
export async function requestNotificationPermission() {
    if (!hasNotificationSupport()) {
        return 'unsupported';
    }
    if (Notification.permission === 'granted') {
        return 'granted';
    }
    if (Notification.permission === 'denied') {
        return 'denied';
    }
    try {
        const result = await Notification.requestPermission();
        return result;
    } catch (e) {
        return 'denied';
    }
}

/**
 * Dispara uma notificação para o período indicado (morning, noon, night).
 * A notificação da noite é mais agressiva e urgente para salvar o streak.
 */
export async function sendDailyNotification(period, forced = false) {
    if (!hasNotificationSupport()) return false;
    if (Notification.permission !== 'granted') return false;

    const streakInfo = getDailyStreak();
    const streakDays = streakInfo.streak || 0;
    const isTodayStudied = streakInfo.isTodayStudied || false;

    let title = 'Hora dos Flashcards';
    let body = 'Reserve alguns minutos para revisar seus cards e acelerar seu aprendizado.';
    let requireInteraction = false;
    let vibrate = [100, 50, 100];
    let tag = `flashcards-${period}`;

    if (period === 'morning') {
        title = 'Flashcards: Comece o dia com foco!';
        body = isTodayStudied 
            ? 'Otimo comeco! Deseja avancar ainda mais na sua meta de hoje?' 
            : 'Revise alguns cards agora pela manha para ativar sua memoria de longo prazo.';
    } else if (period === 'noon') {
        title = 'Flashcards: Pausa do Meio-dia';
        body = isTodayStudied
            ? 'Sua meta esta em andamento! Que tal uma revisao rapida de consolidacao?'
            : 'Aproveite o intervalo do almoco para adiantar seus cards e manter a mente afiada.';
    } else if (period === 'night') {
        // Alerta Agressivo Noturno: Salvar Sequência antes da meia-noite!
        requireInteraction = true;
        vibrate = [300, 150, 300, 150, 600];
        tag = 'flashcards-streak-danger';

        if (!isTodayStudied) {
            title = 'ATENCAO: Sua sequencia vai ser perdida!';
            body = streakDays > 0 
                ? `Resta pouco tempo antes da meia-noite! Voce ainda nao estudou hoje e vai perder seu streak de ${streakDays} dias. Entre agora para salvar sua sequencia!`
                : 'O dia esta acabando e voce ainda nao praticou hoje! Faca seus cards antes da meia-noite para manter o ritmo de estudos.';
        } else {
            title = 'Revisao Noturna de Consolidacao';
            body = 'Sua sequencia de hoje ja esta salva, mas revisar antes de dormir ajuda a fixar conexoes neurais durante o sono.';
            requireInteraction = false;
        }
    }

    const isSubpage = typeof window !== 'undefined' && window.location.pathname.includes('/pages/');
    const assetBase = isSubpage ? '../assets/img/' : 'assets/img/';
    const iconUrl = typeof window !== 'undefined' ? new URL(`${assetBase}logo.png`, window.location.href).href : `${assetBase}logo.png`;
    const badgeUrl = typeof window !== 'undefined' ? new URL(`${assetBase}badge.png`, window.location.href).href : `${assetBase}badge.png`;

    const options = {
        body,
        icon: iconUrl,
        badge: badgeUrl,
        tag,
        renotify: true,
        requireInteraction,
        vibrate,
        data: {
            url: './pages/game.html',
            period,
            timestamp: Date.now()
        }
    };

    try {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg && 'showNotification' in reg) {
                await reg.showNotification(title, options);
                return true;
            }
        }
        new Notification(title, options);
        return true;
    } catch (e) {
        console.warn("[Notifications] Falha ao disparar notificacao:", e);
        return false;
    }
}

/**
 * Checa os horários e dispara as notificações agendadas.
 */
export function checkAndTriggerScheduledNotifications() {
    const settings = getNotificationSettings();
    if (!settings.enabled) return;
    if (!hasNotificationSupport() || Notification.permission !== 'granted') return;

    const now = new Date();
    const todayStr = getTodayDateString(now);
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    const periods = ['morning', 'noon', 'night'];
    periods.forEach(period => {
        const config = settings[period];
        if (!config || !config.enabled) return;

        const sentKey = `flashcards_notif_sent_${period}_${todayStr}`;
        if (localStorage.getItem(sentKey)) return;

        // Dispara quando o horário for igual ou até 45 minutos depois
        if (currentTimeStr >= config.time) {
            const [targetH, targetM] = config.time.split(':').map(Number);
            const currentTotalMin = now.getHours() * 60 + now.getMinutes();
            const targetTotalMin = targetH * 60 + targetM;
            const diffMin = currentTotalMin - targetTotalMin;

            if (diffMin >= 0 && diffMin <= 45) {
                localStorage.setItem(sentKey, 'true');
                sendDailyNotification(period, false);
            }
        }
    });
}

let notificationSchedulerTimer = null;

export function startNotificationScheduler() {
    if (notificationSchedulerTimer) clearInterval(notificationSchedulerTimer);
    checkAndTriggerScheduledNotifications();
    notificationSchedulerTimer = setInterval(checkAndTriggerScheduledNotifications, 45000);
}

/**
 * Sincroniza a interface do modal de configurações com os valores salvos.
 */
export function updateNotificationsUI() {
    const settings = getNotificationSettings();

    const masterSwitch = document.getElementById('setting-notif-master-switch');
    const periodsContainer = document.getElementById('setting-notif-periods-container');

    const morningSwitch = document.getElementById('setting-notif-morning-switch');
    const morningTimeInput = document.getElementById('setting-notif-morning-time');

    const noonSwitch = document.getElementById('setting-notif-noon-switch');
    const noonTimeInput = document.getElementById('setting-notif-noon-time');

    const nightSwitch = document.getElementById('setting-notif-night-switch');
    const nightTimeInput = document.getElementById('setting-notif-night-time');

    if (masterSwitch) {
        masterSwitch.selected = settings.enabled;
    }

    if (periodsContainer) {
        if (settings.enabled) {
            periodsContainer.classList.remove('opacity-60', 'pointer-events-none');
        } else {
            periodsContainer.classList.add('opacity-60', 'pointer-events-none');
        }
    }

    if (morningSwitch) morningSwitch.selected = settings.morning.enabled;
    if (morningTimeInput) morningTimeInput.value = settings.morning.time || '09:00';

    if (noonSwitch) noonSwitch.selected = settings.noon.enabled;
    if (noonTimeInput) noonTimeInput.value = settings.noon.time || '13:00';

    if (nightSwitch) nightSwitch.selected = settings.night.enabled;
    if (nightTimeInput) nightTimeInput.value = settings.night.time || '21:00';
}

if (typeof window !== 'undefined') {
    window.addEventListener('flashcards:sync-updated', () => {
        updateNotificationsUI();
    });
}
