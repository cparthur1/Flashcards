// SPDX-License-Identifier: GPL-2.0-only
/**
 * backend-api.js
 * Client communication layer with Cloudflare Worker Backend
 */

import { getCurrentUserToken } from './firebase-client.js';

export const BACKEND_URL = 'https://flashcards-backend.camblu.workers.dev';

async function fetchWithAuth(endpoint, options = {}) {
  const token = await getCurrentUserToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers
  });

  return response;
}

/**
 * Get current user Pro status & monthly quota
 */
export async function getUserStatus() {
  const res = await fetchWithAuth('/api/user/status');
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error('Falha ao obter status do usuário');
  }
  return await res.json();
}

/**
 * Request Pro Subscription checkout / Pix (R$ 5,00/mês)
 */
export async function createProSubscription(params = {}) {
  const res = await fetchWithAuth('/api/payment/subscribe', {
    method: 'POST',
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Erro ao gerar assinatura Pro');
  }
  return await res.json();
}

/**
 * Buy extra deck generation (R$ 0,99)
 */
export async function buyExtraGeneration(params = {}) {
  const res = await fetchWithAuth('/api/payment/extra-generation', {
    method: 'POST',
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Erro ao gerar pagamento da geração extra');
  }
  return await res.json();
}

/**
 * Generate Flashcards deck using Backend Gemini Proxy
 */
export async function generateDeckAI({ contents, systemInstruction, generationConfig, onChunk, stream = true }) {
  const res = await fetchWithAuth('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify({
      contents,
      systemInstruction,
      generationConfig,
      stream
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw err;
  }

  if (stream && onChunk) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (textChunk) {
              accumulatedText += textChunk;
              onChunk(textChunk, accumulatedText);
            }
          } catch (e) {
            // Ignore parse errors on partial frames
          }
        }
      }
    }
    return accumulatedText;
  }

  return await res.json();
}

/**
 * Tutor AI inquiry during study
 */
export async function askTutorAI(prompt, systemInstruction = null) {
  const res = await fetchWithAuth('/api/ai/tutor', {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Erro ao consultar Tutor IA');
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Stats AI cognitive diagnostics
 */
export async function getStatsAIInsights(statsPrompt) {
  const res = await fetchWithAuth('/api/ai/stats', {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: statsPrompt }] }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Erro ao gerar análise de estatísticas');
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Get detailed subscription info from backend / Asaas
 */
export async function getSubscriptionDetails() {
  const res = await fetchWithAuth('/api/subscription/details');
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error('Falha ao obter detalhes da assinatura');
  }
  return await res.json();
}

/**
 * Cancel only the Asaas recurring subscription (keeps user account and decks)
 */
export async function cancelSubscriptionOnly() {
  const res = await fetchWithAuth('/api/subscription/cancel', {
    method: 'POST'
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Erro ao cancelar assinatura');
  }

  return await res.json();
}

/**
 * Cancel Pro Subscription and Permanently Delete User Account & All Data
 */
export async function deleteAccountAndCancelSubscription() {
  const res = await fetchWithAuth('/api/user/delete-account', {
    method: 'POST'
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Erro ao cancelar assinatura e excluir conta');
  }

  return await res.json();
}

