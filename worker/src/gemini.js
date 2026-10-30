// SPDX-License-Identifier: GPL-2.0-only
/**
 * gemini.js - Secure Gemini AI proxy for Cloudflare Worker
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Proxies generateContent or streamGenerateContent to Google Gemini
 * @param {object} params
 * @param {string} params.model - e.g. "gemini-2.5-flash"
 * @param {object} params.contents - Gemini request body contents
 * @param {object} [params.systemInstruction]
 * @param {object} [params.generationConfig]
 * @param {boolean} [params.stream]
 * @param {string} params.apiKey - Internal server Gemini API key
 */
export async function callGemini({
  model = 'gemini-2.5-flash',
  contents,
  systemInstruction,
  generationConfig,
  tools,
  toolConfig,
  stream = false,
  apiKey
}) {
  const action = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  const url = `${GEMINI_API_BASE}/models/${model}:${action}&key=${apiKey}`;

  const body = {
    contents
  };
  if (systemInstruction) {
    body.systemInstruction = typeof systemInstruction === 'string'
      ? { parts: [{ text: systemInstruction }] }
      : systemInstruction;
  }
  if (generationConfig) body.generationConfig = generationConfig;
  if (tools) body.tools = tools;
  if (toolConfig) body.toolConfig = toolConfig;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API do Gemini (${response.status}): ${errorText}`);
  }

  if (stream) {
    // Return readable stream with SSE headers
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
