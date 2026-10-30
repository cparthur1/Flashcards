// SPDX-License-Identifier: GPL-2.0-only
/**
 * asaas.js - Asaas Payment Gateway Integration for Cloudflare Worker
 */

function getAsaasBaseUrl(isProduction = true) {
  return isProduction ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
}

/**
 * Find or create Asaas Customer
 */
export async function getOrCreateCustomer({ name, email, cpfCnpj = null, apiKey, isProduction = true }) {
  const baseUrl = getAsaasBaseUrl(isProduction);
  const headers = {
    'Content-Type': 'application/json',
    'access_token': apiKey
  };

  // Search existing customer by email
  const searchUrl = `${baseUrl}/customers?email=${encodeURIComponent(email)}`;
  const searchRes = await fetch(searchUrl, { headers });
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.data && data.data.length > 0) {
      return data.data[0];
    }
  }

  // Create new customer
  const createRes = await fetch(`${baseUrl}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: name || email.split('@')[0],
      email,
      cpfCnpj: cpfCnpj || undefined,
      notificationDisabled: false
    })
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Erro ao criar cliente no Asaas: ${err}`);
  }

  return await createRes.json();
}

/**
 * Create Monthly Pro Subscription (R$ 5.00/mês)
 */
export async function createSubscription({ customerId, uid, apiKey, isProduction = true, value = 5.00 }) {
  const baseUrl = getAsaasBaseUrl(isProduction);
  const headers = {
    'Content-Type': 'application/json',
    'access_token': apiKey
  };

  // Today + 1 day for first due date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextDueDate = tomorrow.toISOString().split('T')[0];

  const subRes = await fetch(`${baseUrl}/subscriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customer: customerId,
      billingType: 'UNDEFINED', // Allows customer to pay with Pix or Credit Card
      value: value,
      nextDueDate,
      cycle: 'MONTHLY',
      description: 'Flashcards Pro - Assinatura Mensal (R$ 5,00/mês)',
      externalReference: `sub:${uid}`
    })
  });

  if (!subRes.ok) {
    const err = await subRes.text();
    throw new Error(`Erro ao criar assinatura no Asaas: ${err}`);
  }

  const subData = await subRes.json();

  // Fetch the first generated payment to provide Pix or Checkout URL immediately
  let firstPayment = null;
  const paymentsRes = await fetch(`${baseUrl}/subscriptions/${subData.id}/payments`, { headers });
  if (paymentsRes.ok) {
    const payData = await paymentsRes.json();
    if (payData.data && payData.data.length > 0) {
      firstPayment = payData.data[0];
    }
  }

  // If first payment exists, fetch Pix QR Code
  let pixData = null;
  if (firstPayment && firstPayment.id) {
    const pixRes = await fetch(`${baseUrl}/payments/${firstPayment.id}/pixQrCode`, { headers });
    if (pixRes.ok) {
      pixData = await pixRes.json();
    }
  }

  return {
    subscriptionId: subData.id,
    paymentId: firstPayment ? firstPayment.id : null,
    invoiceUrl: firstPayment ? firstPayment.invoiceUrl : null,
    bankSlipUrl: firstPayment ? firstPayment.bankSlipUrl : null,
    pix: pixData
  };
}

/**
 * Create Extra Deck Generation Payment (R$ 0.99)
 */
export async function createExtraGenerationPayment({ customerId, uid, apiKey, isProduction = true, value = 0.99 }) {
  const baseUrl = getAsaasBaseUrl(isProduction);
  const headers = {
    'Content-Type': 'application/json',
    'access_token': apiKey
  };

  const today = new Date().toISOString().split('T')[0];

  const payRes = await fetch(`${baseUrl}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customer: customerId,
      billingType: 'PIX',
      value: value,
      dueDate: today,
      description: 'Flashcards - 1 Geração de Baralho Extra (R$ 0,99)',
      externalReference: `extra:${uid}`
    })
  });

  if (!payRes.ok) {
    const err = await payRes.text();
    throw new Error(`Erro ao gerar cobrança de deck extra: ${err}`);
  }

  const payData = await payRes.json();

  // Fetch Pix details
  const pixRes = await fetch(`${baseUrl}/payments/${payData.id}/pixQrCode`, { headers });
  let pixData = null;
  if (pixRes.ok) {
    pixData = await pixRes.json();
  }

  return {
    paymentId: payData.id,
    invoiceUrl: payData.invoiceUrl,
    pix: pixData
  };
}

/**
 * Get details and latest payment of an Asaas Subscription
 */
export async function getSubscriptionDetails({ subscriptionId, apiKey, isProduction = true }) {
  if (!subscriptionId) return null;
  const baseUrl = getAsaasBaseUrl(isProduction);
  const headers = {
    'Content-Type': 'application/json',
    'access_token': apiKey
  };

  try {
    const subRes = await fetch(`${baseUrl}/subscriptions/${subscriptionId}`, { headers });
    if (!subRes.ok) return null;
    const subData = await subRes.json();

    let invoiceUrl = null;
    let bankSlipUrl = null;
    const paymentsRes = await fetch(`${baseUrl}/subscriptions/${subscriptionId}/payments?limit=1&order=desc`, { headers });
    if (paymentsRes.ok) {
      const pData = await paymentsRes.json();
      if (pData.data && pData.data.length > 0) {
        invoiceUrl = pData.data[0].invoiceUrl;
        bankSlipUrl = pData.data[0].bankSlipUrl;
      }
    }

    return {
      id: subData.id,
      status: subData.status,
      billingType: subData.billingType,
      value: subData.value,
      nextDueDate: subData.nextDueDate,
      cycle: subData.cycle,
      invoiceUrl,
      bankSlipUrl
    };
  } catch (e) {
    console.warn(`Erro ao buscar detalhes da assinatura Asaas (${subscriptionId}):`, e);
    return null;
  }
}

/**
 * Cancel an existing Asaas Subscription
 */
export async function cancelSubscription({ subscriptionId, apiKey, isProduction = true }) {
  if (!subscriptionId) return false;
  const baseUrl = getAsaasBaseUrl(isProduction);
  const headers = {
    'Content-Type': 'application/json',
    'access_token': apiKey
  };

  const res = await fetch(`${baseUrl}/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    console.warn(`Erro ao cancelar assinatura no Asaas (${subscriptionId}):`, err);
    return false;
  }
  return true;
}

