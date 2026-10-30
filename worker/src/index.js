// SPDX-License-Identifier: GPL-2.0-only
/**
 * Flashcards WebApp - Cloudflare Worker Backend
 * Provides:
 * 1. Secure Gemini AI Proxy (without exposing server API keys to client)
 * 2. Asaas Payment & Subscription Processing (R$ 5/mês Pro, R$ 0.99 geração extra)
 * 3. Asaas Webhook Handler with Firebase Admin OAuth2 token minting
 * 4. User Quota & Pro Claim Management
 */

import { verifyFirebaseIdToken, setFirebaseUserProClaim, deleteFirebaseUser, getFirebaseUserByEmail } from './google-auth.js';
import { getOrCreateCustomer, createSubscription, createExtraGenerationPayment, cancelSubscription, getSubscriptionDetails, checkCustomerProStatusInAsaas } from './asaas.js';
import { callGemini } from './gemini.js';
import { getUserDocument, updateUserDocument, deleteUserDocument, getDocument, setDocument } from './firestore.js';
import Stripe from 'stripe';

const ALLOWED_ORIGINS = [
  'https://flashcards.camblu.org',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

export const LIFETIME_PRO_EMAILS = [
  'arthur.paludo.c@gmail.com',
  'clarazanchett@gmail.com'
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

function getServiceAccount(env) {
  if (env.FIREBASE_SERVICE_ACCOUNT_OBJ) return env.FIREBASE_SERVICE_ACCOUNT_OBJ;
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('Configuração FIREBASE_SERVICE_ACCOUNT não definida');
  }
  return typeof env.FIREBASE_SERVICE_ACCOUNT === 'string'
    ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
    : env.FIREBASE_SERVICE_ACCOUNT;
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request);

    // Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1. Health Check
      if (path === '/' || path === '/health') {
        return jsonResponse({
          status: 'ok',
          service: 'flashcards-backend',
          version: '1.0.0',
          time: new Date().toISOString()
        }, 200, corsHeaders);
      }



      // 2. Asaas Webhook (No client auth, called directly by Asaas servers)
      if (path === '/api/webhook/asaas' && request.method === 'POST') {
        return await handleAsaasWebhook(request, env);
      }

      // 2.1 Stripe Webhook (No client auth, called directly by Stripe servers)
      if ((path === '/api/webhook/stripe' || path === '/api/webhook') && request.method === 'POST') {
        return await handleStripeWebhook(request, env);
      }

      // Helper to authenticate user for protected routes
      async function authenticateUser() {
        const authHeader = request.headers.get('Authorization') || '';
        if (!authHeader.startsWith('Bearer ')) {
          throw new Response(JSON.stringify({ error: 'unauthorized', message: 'Token de autenticação ausente' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        const token = authHeader.substring(7);
        const projectId = env.FIREBASE_PROJECT_ID || 'flashcards-ead57';
        try {
          return await verifyFirebaseIdToken(token, projectId);
        } catch (authErr) {
          throw new Response(JSON.stringify({ error: 'unauthorized', message: authErr.message || 'Token inválido ou expirado' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      // 2.2 Create Stripe Embedded Checkout Form Session
      if (path === '/api/create-checkout-session' && request.method === 'POST') {
        let user = null;
        try {
          user = await authenticateUser();
        } catch (e) {
          // Authentication is optional for initial checkout session creation, but links user if logged in
        }

        // Mode is set to "subscription" for recurring billing (Flashcards Pro R$ 4,99 / mês)
        const mode = "subscription";

        // Checkout Session parameters configured per Field Intents
        const sessionParams = {
          ui_mode: "form",
          mode,
          billing_address_collection: "auto",
          phone_number_collection: {
            enabled: false
          },
          automatic_tax: {
            enabled: false
          },
          submit_type: "auto",
          saved_payment_method_options: {
            payment_method_save: "enabled"
          },
          integration_identifier: "custom_embedded_web_0001",
          line_items: [
            {
              price: env.STRIPE_PRICE_ID || "price_1UWEb0Rynl9tIFFYF2cvZ3RB",
              quantity: 1
            }
          ]
        };

        if (mode === "subscription") {
          sessionParams.payment_method_collection = "always";
        }

        if (user) {
          sessionParams.customer_email = user.email;
          sessionParams.client_reference_id = user.uid;
          sessionParams.metadata = { uid: user.uid };
          sessionParams.subscription_data = {
            metadata: { uid: user.uid }
          };
        }

        if (!env.STRIPE_SECRET_KEY) {
          return jsonResponse({
            error: 'configuration_error',
            message: 'STRIPE_SECRET_KEY não configurada no servidor. Consulte STRIPE_INTEGRATION_TODO.md.'
          }, 500, corsHeaders);
        }

        const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });
        const session = await stripe.checkout.sessions.create(sessionParams);

        if (user) {
          try {
            const serviceAccount = getServiceAccount(env);
            await updateUserDocument(serviceAccount, user.uid, {
              subscription: {
                id: session.id,
                provider: 'stripe',
                status: 'pending',
                updatedAt: new Date().toISOString()
              }
            });
          } catch (dbErr) {
            console.warn('[Stripe] Falha ao persistir sessão pendente no Firestore:', dbErr.message);
          }
        }

        return jsonResponse({ client_secret: session.client_secret }, 200, corsHeaders);
      }

      // 2.3 Create Stripe Embedded Checkout Session for Extra Deck Generation (R$ 0,99 one-time)
      if ((path === '/api/create-extra-deck-session' || path === '/api/payment/extra-deck-session') && request.method === 'POST') {
        let user = null;
        try {
          user = await authenticateUser();
        } catch (e) {
          // Authentication is optional for initial checkout session creation, but links user if logged in
        }

        const mode = "payment";

        const sessionParams = {
          mode,
          ui_mode: "form",
          line_items: [
            {
              price: env.STRIPE_EXTRA_PRICE_ID || "price_1UWEc0Rynl9tIFFYhgaFcei3",
              quantity: 1,
            },
          ],
          billing_address_collection: "auto",
          submit_type: "auto",
          integration_identifier: "custom_embedded_web_0002",
        };

        if (user) {
          sessionParams.customer_email = user.email;
          sessionParams.client_reference_id = user.uid;
          sessionParams.metadata = { uid: user.uid, type: "extra_deck" };
        }

        if (!env.STRIPE_SECRET_KEY) {
          return jsonResponse({
            error: 'configuration_error',
            message: 'STRIPE_SECRET_KEY não configurada no servidor.'
          }, 500, corsHeaders);
        }

        const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });
        const session = await stripe.checkout.sessions.create(sessionParams);

        return jsonResponse({ client_secret: session.client_secret }, 200, corsHeaders);
      }

      // 3. User Pro Status & Quota
      if (path === '/api/user/status' && request.method === 'GET') {
        const user = await authenticateUser();
        const isLifetime = LIFETIME_PRO_EMAILS.includes((user.email || '').toLowerCase().trim());
        let userDoc = null;
        let serviceAccount = null;

        try {
          serviceAccount = getServiceAccount(env);
          userDoc = await getUserDocument(serviceAccount, user.uid);
        } catch (docErr) {
          console.warn('[Status] Falha ao ler documento do Firestore:', docErr.message);
        }

        let isPro = Boolean(isLifetime || user.pro || userDoc?.subscription?.status === 'active');

        // If not recognized as Pro in Firestore/claims, verify directly with Asaas
        if (!isPro && env.ASAAS_API_KEY && user.email) {
          const asaasCheck = await checkCustomerProStatusInAsaas({
            email: user.email,
            customerId: userDoc?.subscription?.customerId || null,
            apiKey: env.ASAAS_API_KEY,
            isProduction: env.ASAAS_ENV !== 'sandbox'
          });

          if (asaasCheck.isPro) {
            isPro = true;
            if (serviceAccount) {
              ctx.waitUntil(Promise.all([
                setFirebaseUserProClaim(serviceAccount, user.uid, true).catch(() => {}),
                updateUserDocument(serviceAccount, user.uid, {
                  subscription: {
                    status: 'active',
                    plan: 'pro_monthly',
                    provider: 'asaas',
                    subscriptionId: asaasCheck.subscriptionId || userDoc?.subscription?.id || '',
                    customerId: asaasCheck.customerId || '',
                    lastPaymentId: asaasCheck.paymentId || '',
                    updatedAt: new Date().toISOString()
                  }
                }).catch(() => {})
              ]));
            }
          }
        }

        const currentMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-10"
        const lastReset = userDoc?.quotaLastResetMonth || '';
        let monthlyUsed = userDoc?.monthlyGenerationsUsed || 0;
        if (lastReset !== currentMonth) {
          monthlyUsed = 0;
        }
        const extraGenerations = userDoc?.extraGenerations || 0;
        const remainingIncluded = isLifetime ? 9999 : Math.max(0, 3 - monthlyUsed);
        const totalRemaining = isPro ? (isLifetime ? 9999 : remainingIncluded + extraGenerations) : 0;

        if (isLifetime && serviceAccount) {
          ctx.waitUntil(Promise.all([
            setFirebaseUserProClaim(serviceAccount, user.uid, true).catch(() => {}),
            updateUserDocument(serviceAccount, user.uid, {
              subscription: {
                status: 'active',
                plan: 'pro_lifetime',
                provider: 'whitelist',
                updatedAt: new Date().toISOString()
              }
            }).catch(() => {})
          ]));
        }

        return jsonResponse({
          uid: user.uid,
          email: user.email,
          isPro,
          isLifetimePro: isLifetime,
          monthlyGenerationsUsed: monthlyUsed,
          monthlyIncluded: isLifetime ? 9999 : 3,
          extraGenerations,
          remainingGenerations: totalRemaining,
          subscription: isLifetime ? { status: 'active', plan: 'pro_lifetime' } : (userDoc?.subscription || null)
        }, 200, corsHeaders);
      }

      // 3.1 Cloud Sync: Get User Slots, Decks and Notebook
      if (path === '/api/user/slots' && request.method === 'GET') {
        const user = await authenticateUser();
        const serviceAccount = getServiceAccount(env);
        const userDoc = await getUserDocument(serviceAccount, user.uid);
        if (!userDoc) {
          return jsonResponse({ deckSlots: null, notebookSlot: null, stats: null }, 200, corsHeaders);
        }

        const deckSlots = userDoc.deckSlots || [];
        // Populate full deckData for each slot if present
        for (const slot of deckSlots) {
          if (slot.deckId) {
            const deckDoc = await getDocument(serviceAccount, 'decks', slot.deckId).catch(() => null);
            if (deckDoc) {
              slot.deckData = deckDoc.deckData;
            }
          }
        }

        // Get notebook deckData
        let notebookData = null;
        const notebookDoc = await getDocument(serviceAccount, 'decks', `notebook_${user.uid}`).catch(() => null);
        if (notebookDoc) {
          notebookData = notebookDoc.deckData;
        }

        return jsonResponse({
          deckSlots,
          notebookSlot: {
            title: userDoc.notebookSlot?.title || 'Caderno de Erros',
            cardCount: userDoc.notebookSlot?.cardCount || 0,
            deckData: notebookData
          },
          stats: userDoc.stats || null,
          lastSyncedAt: userDoc.lastSyncedAt || 0
        }, 200, corsHeaders);
      }

      // 3.2 Cloud Sync: Save User Slots, Decks and Notebook
      if (path === '/api/user/slots' && request.method === 'POST') {
        const user = await authenticateUser();
        const body = await request.json().catch(() => ({}));
        const serviceAccount = getServiceAccount(env);

        const { slots = [], notebookData = null, stats = {} } = body;

        // Prepare lightweight metadata for user doc
        const deckSlotsMeta = slots.map(s => ({
          slotIndex: s.slotIndex,
          deckId: s.deckId,
          title: s.title,
          cardCount: s.cardCount,
          isFixed: Boolean(s.isFixed),
          isCurrent: Boolean(s.isCurrent),
          updatedAt: s.updatedAt || Date.now()
        }));

        // 1. Update user document
        await updateUserDocument(serviceAccount, user.uid, {
          deckSlots: deckSlotsMeta,
          notebookSlot: {
            cardCount: notebookData?.cardCount || 0,
            title: notebookData?.title || 'Caderno de Erros'
          },
          stats: stats || {},
          lastSyncedAt: Date.now()
        }).catch(err => console.warn('Erro ao atualizar user doc:', err));

        // 2. Save full deck documents
        for (const slot of slots) {
          if (slot.deckId && slot.deckData) {
            await setDocument(serviceAccount, 'decks', slot.deckId, {
              ownerUid: user.uid,
              title: slot.title,
              cardCount: slot.cardCount,
              isFixed: Boolean(slot.isFixed),
              deckData: slot.deckData,
              updatedAt: slot.updatedAt || Date.now()
            }).catch(err => console.warn(`Erro ao salvar deck ${slot.deckId}:`, err));
          }
        }

        // 3. Save notebook deck document
        if (notebookData?.deckData) {
          await setDocument(serviceAccount, 'decks', `notebook_${user.uid}`, {
            ownerUid: user.uid,
            title: 'Caderno de Erros',
            cardCount: notebookData.cardCount || 0,
            deckData: notebookData.deckData,
            updatedAt: Date.now()
          }).catch(err => console.warn('Erro ao salvar notebook:', err));
        }

        return jsonResponse({ success: true, syncedAt: Date.now() }, 200, corsHeaders);
      }

      // 4. Create Pro Subscription (R$ 5,00/mês)
      if (path === '/api/payment/subscribe' && request.method === 'POST') {
        const user = await authenticateUser();
        const body = await request.json().catch(() => ({}));
        const apiKey = env.ASAAS_API_KEY;
        const isProduction = env.ASAAS_ENV !== 'sandbox';

        const cleanCpf = body.cpfCnpj ? String(body.cpfCnpj).replace(/\D/g, '') : '';
        if (cleanCpf.length !== 11) {
          return jsonResponse({ error: 'Para assinar, é obrigatório informar um CPF válido de 11 dígitos.' }, 400, corsHeaders);
        }

        const customer = await getOrCreateCustomer({
          name: body.name || user.name || user.email.split('@')[0],
          email: user.email,
          cpfCnpj: cleanCpf,
          apiKey,
          isProduction
        });

        const allowedTypes = ['PIX', 'CREDIT_CARD'];
        const billingType = allowedTypes.includes(body.billingType) ? body.billingType : 'PIX';

        const subResult = await createSubscription({
          customerId: customer.id,
          uid: user.uid,
          apiKey,
          isProduction,
          value: 5.00,
          billingType
        });

        // Save pending subscription in user doc
        const serviceAccount = getServiceAccount(env);
        await updateUserDocument(serviceAccount, user.uid, {
          subscription: {
            id: subResult.subscriptionId,
            customerId: customer.id,
            status: 'pending',
            invoiceUrl: subResult.invoiceUrl || null,
            updatedAt: new Date().toISOString()
          }
        }).catch(err => console.warn('Erro ao salvar subscription pending no Firestore:', err));

        return jsonResponse(subResult, 200, corsHeaders);
      }

      // 4.1 Verify Payment Status & Activate Pro immediately
      if (path === '/api/payment/verify' && request.method === 'POST') {
        const user = await authenticateUser();
        const serviceAccount = getServiceAccount(env);
        const userDoc = await getUserDocument(serviceAccount, user.uid).catch(() => null);

        const isLifetime = LIFETIME_PRO_EMAILS.includes((user.email || '').toLowerCase().trim());
        if (isLifetime) {
          await setFirebaseUserProClaim(serviceAccount, user.uid, true).catch(() => {});
          return jsonResponse({ isPro: true, status: 'active', plan: 'pro_lifetime' }, 200, corsHeaders);
        }

        // Check Stripe subscription / session if applicable
        if (env.STRIPE_SECRET_KEY && (userDoc?.subscription?.provider === 'stripe' || userDoc?.subscription?.id?.startsWith('cs_'))) {
          try {
            const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });
            if (userDoc.subscription.id && userDoc.subscription.id.startsWith('cs_')) {
              const session = await stripe.checkout.sessions.retrieve(userDoc.subscription.id);
              if (session && (session.status === 'complete' || session.payment_status === 'paid')) {
                await Promise.all([
                  setFirebaseUserProClaim(serviceAccount, user.uid, true).catch(() => {}),
                  updateUserDocument(serviceAccount, user.uid, {
                    subscription: {
                      status: 'active',
                      plan: 'pro_monthly',
                      provider: 'stripe',
                      subscriptionId: session.subscription || '',
                      customerId: session.customer || '',
                      updatedAt: new Date().toISOString()
                    }
                  }).catch(() => {})
                ]);
                return jsonResponse({ isPro: true, status: 'active', plan: 'pro_monthly' }, 200, corsHeaders);
              }
            }
          } catch (stripeErr) {
            console.warn('[Verify] Erro ao checar Stripe:', stripeErr.message);
          }
        }

        const asaasCheck = await checkCustomerProStatusInAsaas({
          email: user.email,
          customerId: userDoc?.subscription?.customerId || null,
          apiKey: env.ASAAS_API_KEY,
          isProduction: env.ASAAS_ENV !== 'sandbox'
        });

        if (asaasCheck.isPro) {
          await Promise.all([
            setFirebaseUserProClaim(serviceAccount, user.uid, true).catch(() => {}),
            updateUserDocument(serviceAccount, user.uid, {
              subscription: {
                status: 'active',
                plan: 'pro_monthly',
                provider: 'asaas',
                subscriptionId: asaasCheck.subscriptionId || userDoc?.subscription?.id || '',
                customerId: asaasCheck.customerId || '',
                lastPaymentId: asaasCheck.paymentId || '',
                updatedAt: new Date().toISOString()
              }
            }).catch(() => {})
          ]);
          return jsonResponse({ isPro: true, status: 'active', plan: 'pro_monthly' }, 200, corsHeaders);
        }

        return jsonResponse({
          isPro: false,
          status: 'pending',
          message: 'Pagamento ainda não confirmado pelo banco. Se realizou o pagamento há poucos segundos, aguarde um instante e verifique novamente.'
        }, 200, corsHeaders);
      }

      // 5. Create Extra Deck Generation Payment (R$ 0,99)
      if (path === '/api/payment/extra-generation' && request.method === 'POST') {
        const user = await authenticateUser();
        const body = await request.json().catch(() => ({}));
        const apiKey = env.ASAAS_API_KEY;
        const isProduction = env.ASAAS_ENV !== 'sandbox';

        const customer = await getOrCreateCustomer({
          name: body.name || user.name || user.email.split('@')[0],
          email: user.email,
          cpfCnpj: body.cpfCnpj,
          apiKey,
          isProduction
        });

        const extraResult = await createExtraGenerationPayment({
          customerId: customer.id,
          uid: user.uid,
          apiKey,
          isProduction,
          value: 0.99
        });

        return jsonResponse(extraResult, 200, corsHeaders);
      }

      // 5.1 Cancel Subscription and Delete User Account & All Data
      if (path === '/api/user/delete-account' && request.method === 'POST') {
        const user = await authenticateUser();
        const serviceAccount = getServiceAccount(env);
        const userDoc = await getUserDocument(serviceAccount, user.uid);

        // 1. Cancel Asaas Subscription if exists
        const subId = userDoc?.subscription?.subscriptionId;
        if (subId) {
          await cancelSubscription({
            subscriptionId: subId,
            apiKey: env.ASAAS_API_KEY,
            isProduction: env.ASAAS_ENV !== 'sandbox'
          }).catch(err => console.warn('Falha ao cancelar assinatura Asaas:', err));
        }

        // 2. Delete Firestore data (user doc + user decks + shares)
        await deleteUserDocument(serviceAccount, user.uid).catch(err => console.warn('Falha ao excluir Firestore:', err));

        // 3. Delete Firebase Auth user
        await deleteFirebaseUser(serviceAccount, user.uid);

        return jsonResponse({
          success: true,
          message: 'Assinatura cancelada e conta excluída permanentemente com sucesso.'
        }, 200, corsHeaders);
      }

      // 5.2 Get Subscription Details from Asaas (for manage modal)
      if (path === '/api/subscription/details' && request.method === 'GET') {
        const user = await authenticateUser();
        const isLifetime = LIFETIME_PRO_EMAILS.includes((user.email || '').toLowerCase().trim());
        if (isLifetime) {
          return jsonResponse({
            isPro: true,
            isLifetime: true,
            status: 'active',
            plan: 'pro_lifetime'
          }, 200, corsHeaders);
        }

        let userDoc = null;
        let serviceAccount = null;
        try {
          serviceAccount = getServiceAccount(env);
          userDoc = await getUserDocument(serviceAccount, user.uid);
        } catch (e) {
          console.warn('[Subscription] Erro ao buscar Firestore:', e.message);
        }

        const subId = userDoc?.subscription?.subscriptionId;
        if (!subId) {
          return jsonResponse({
            isPro: Boolean(userDoc?.subscription?.status === 'active' || user.pro),
            isLifetime: false,
            status: userDoc?.subscription?.status || 'inactive'
          }, 200, corsHeaders);
        }

        const details = await getSubscriptionDetails({
          subscriptionId: subId,
          apiKey: env.ASAAS_API_KEY,
          isProduction: env.ASAAS_ENV !== 'sandbox'
        });

        return jsonResponse({
          isPro: details ? (details.status === 'ACTIVE') : Boolean(userDoc?.subscription?.status === 'active'),
          isLifetime: false,
          ...(details || {}),
          storedStatus: userDoc?.subscription?.status || 'inactive'
        }, 200, corsHeaders);
      }

      // 5.3 Cancel Asaas Subscription Only (keeps account and decks intact)
      if (path === '/api/subscription/cancel' && request.method === 'POST') {
        const user = await authenticateUser();
        let serviceAccount = null;
        let userDoc = null;
        try {
          serviceAccount = getServiceAccount(env);
          userDoc = await getUserDocument(serviceAccount, user.uid);
        } catch (e) {
          console.warn('[Subscription] Erro ao acessar Firestore no cancelamento:', e.message);
        }

        const subId = userDoc?.subscription?.subscriptionId;
        if (subId) {
          await cancelSubscription({
            subscriptionId: subId,
            apiKey: env.ASAAS_API_KEY,
            isProduction: env.ASAAS_ENV !== 'sandbox'
          }).catch(err => console.warn('Falha ao cancelar assinatura Asaas:', err));
        }

        if (serviceAccount) {
          await updateUserDocument(serviceAccount, user.uid, {
            'subscription.status': 'canceled',
            'subscription.canceledAt': new Date().toISOString()
          }).catch(err => console.warn('Falha ao atualizar Firestore:', err));

          await setFirebaseUserProClaim(serviceAccount, user.uid, false).catch(() => {});
        }

        return jsonResponse({
          success: true,
          message: 'Assinatura cancelada com sucesso.'
        }, 200, corsHeaders);
      }

      // 6. Gemini AI - Deck Generation (Requires Pro & Quota Check)
      if (path === '/api/ai/generate' && request.method === 'POST') {
        const user = await authenticateUser();
        const reqBody = await request.json();

        const isLifetime = LIFETIME_PRO_EMAILS.includes((user.email || '').toLowerCase().trim());
        let userDoc = null;
        let serviceAccount = null;
        try {
          serviceAccount = getServiceAccount(env);
          userDoc = await getUserDocument(serviceAccount, user.uid);
        } catch (e) {
          console.warn('[Generate] Falha ao ler Firestore:', e.message);
        }

        const isPro = Boolean(isLifetime || user.pro || userDoc?.subscription?.status === 'active');
        if (!isPro) {
          return jsonResponse({
            error: 'subscription_required',
            message: 'A geração de baralhos por IA é exclusiva para assinantes Pro (R$ 4,99/mês).'
          }, 403, corsHeaders);
        }

        // Quota check (bypassed for lifetime Pro or non-new deck operations)
        const isNewDeck = reqBody.isNewDeck !== false;
        if (isNewDeck && !isLifetime) {
          const currentMonth = new Date().toISOString().slice(0, 7);
          const lastReset = userDoc?.quotaLastResetMonth || '';
          let monthlyUsed = userDoc?.monthlyGenerationsUsed || 0;
          let extraGens = userDoc?.extraGenerations || 0;

          if (lastReset !== currentMonth) {
            monthlyUsed = 0;
          }

          if (monthlyUsed < 3) {
            monthlyUsed += 1;
          } else if (extraGens > 0) {
            extraGens -= 1;
          } else {
            return jsonResponse({
              error: 'quota_exceeded',
              message: 'Você atingiu o limite de 3 baralhos por IA este mês. Adquira gerações extras por R$ 0,99 cada.',
              limit: 3,
              used: monthlyUsed,
              extra: extraGens
            }, 402, corsHeaders);
          }

          // Update quota in Firestore if serviceAccount available
          if (serviceAccount) {
            await updateUserDocument(serviceAccount, user.uid, {
              monthlyGenerationsUsed: monthlyUsed,
              quotaLastResetMonth: currentMonth,
              extraGenerations: extraGens
            }).catch(() => {});
          }
        }

        // Proxy Gemini call
        const geminiRes = await callGemini({
          model: reqBody.model || 'gemini-flash-latest',
          contents: reqBody.contents,
          systemInstruction: reqBody.systemInstruction,
          generationConfig: reqBody.generationConfig,
          tools: reqBody.tools,
          toolConfig: reqBody.toolConfig,
          stream: Boolean(reqBody.stream),
          apiKey: env.GEMINI_API_KEY
        });

        // Forward headers with CORS
        const responseHeaders = new Headers(geminiRes.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => responseHeaders.set(k, v));
        return new Response(geminiRes.body, {
          status: geminiRes.status,
          headers: responseHeaders
        });
      }

      // 7. Gemini AI - Tutor Feedback during study (Unlimited for Pro)
      if (path === '/api/ai/tutor' && request.method === 'POST') {
        const user = await authenticateUser();
        const isLifetime = LIFETIME_PRO_EMAILS.includes((user.email || '').toLowerCase().trim());
        let isPro = isLifetime || Boolean(user.pro);

        if (!isPro) {
          try {
            const serviceAccount = getServiceAccount(env);
            const userDoc = await getUserDocument(serviceAccount, user.uid);
            if (userDoc?.subscription?.status === 'active') {
              isPro = true;
            }
          } catch (e) {
            console.warn('[Tutor] Falha ao checar assinatura no Firestore:', e.message);
          }
        }

        if (!isPro) {
          return jsonResponse({
            error: 'subscription_required',
            message: 'O Tutor de IA é exclusivo para assinantes Pro.'
          }, 403, corsHeaders);
        }

        const reqBody = await request.json();
        const geminiRes = await callGemini({
          model: reqBody.model || 'gemini-flash-lite-latest',
          contents: reqBody.contents,
          systemInstruction: reqBody.systemInstruction,
          generationConfig: reqBody.generationConfig,
          tools: reqBody.tools,
          toolConfig: reqBody.toolConfig,
          stream: false,
          apiKey: env.GEMINI_API_KEY
        });

        const responseHeaders = new Headers(geminiRes.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => responseHeaders.set(k, v));
        return new Response(geminiRes.body, {
          status: geminiRes.status,
          headers: responseHeaders
        });
      }

      // 8. Gemini AI - Stats Diagnostic Insights (Unlimited for Pro)
      if (path === '/api/ai/stats' && request.method === 'POST') {
        const user = await authenticateUser();
        const isLifetime = LIFETIME_PRO_EMAILS.includes((user.email || '').toLowerCase().trim());
        let isPro = isLifetime || Boolean(user.pro);

        if (!isPro) {
          try {
            const serviceAccount = getServiceAccount(env);
            const userDoc = await getUserDocument(serviceAccount, user.uid);
            if (userDoc?.subscription?.status === 'active') {
              isPro = true;
            }
          } catch (e) {
            console.warn('[Stats] Falha ao checar assinatura no Firestore:', e.message);
          }
        }

        if (!isPro) {
          return jsonResponse({
            error: 'subscription_required',
            message: 'O Diagnóstico Cognitivo por IA é exclusivo para assinantes Pro.'
          }, 403, corsHeaders);
        }

        const reqBody = await request.json();
        const geminiRes = await callGemini({
          model: reqBody.model || 'gemini-flash-lite-latest',
          contents: reqBody.contents,
          systemInstruction: reqBody.systemInstruction,
          generationConfig: reqBody.generationConfig,
          tools: reqBody.tools,
          toolConfig: reqBody.toolConfig,
          stream: false,
          apiKey: env.GEMINI_API_KEY
        });

        const responseHeaders = new Headers(geminiRes.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => responseHeaders.set(k, v));
        return new Response(geminiRes.body, {
          status: geminiRes.status,
          headers: responseHeaders
        });
      }

      return jsonResponse({ error: 'not_found', message: 'Rota não encontrada' }, 404, corsHeaders);

    } catch (err) {
      if (err instanceof Response) return err;
      console.error('Unhandled worker error:', err);
      return jsonResponse({
        error: 'internal_server_error',
        message: err.message || 'Erro inesperado no servidor'
      }, 500, corsHeaders);
    }
  }
};

/**
 * Handle Asaas Webhook events
 */
async function handleAsaasWebhook(request, env) {
  // Validate Asaas Webhook secret if configured
  const webhookToken = request.headers.get('asaas-access-token') || request.headers.get('webhook-token') || '';
  if (env.ASAAS_WEBHOOK_SECRET && webhookToken !== env.ASAAS_WEBHOOK_SECRET) {
    console.warn('[Asaas Webhook] Token de autenticação inválido ou ausente:', webhookToken);
    return new Response(JSON.stringify({ error: 'unauthorized', message: 'Token de webhook inválido' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.event) {
    return new Response('Payload inválido', { status: 400 });
  }

  const serviceAccount = getServiceAccount(env);
  const event = body.event;
  const payment = body.payment || {};
  const externalRef = payment.externalReference || '';

  console.log(`[Asaas Webhook] Event: ${event}, Ref: ${externalRef}, Id: ${payment.id}`);

  // Subscription confirmation
  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    let uid = externalRef.startsWith('sub:') ? externalRef.replace('sub:', '') : null;

    // 1. If not on payment, look up subscription externalReference
    if (!uid && payment.subscription && env.ASAAS_API_KEY) {
      try {
        const baseUrl = env.ASAAS_ENV === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
        const headers = { 'Content-Type': 'application/json', 'access_token': env.ASAAS_API_KEY, 'User-Agent': 'Flashcards/1.0 (https://flashcards.camblu.org)' };
        const subRes = await fetch(`${baseUrl}/subscriptions/${payment.subscription}`, { headers });
        if (subRes.ok) {
          const subData = await subRes.json();
          if (subData.externalReference && subData.externalReference.startsWith('sub:')) {
            uid = subData.externalReference.replace('sub:', '');
          }
        }
      } catch (err) {
        console.warn('[Asaas Webhook] Erro ao buscar assinatura do pagamento:', err);
      }
    }

    // 2. If still not found, look up customer email -> Firebase Auth UID
    if (!uid && payment.customer && env.ASAAS_API_KEY) {
      try {
        const baseUrl = env.ASAAS_ENV === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
        const headers = { 'Content-Type': 'application/json', 'access_token': env.ASAAS_API_KEY, 'User-Agent': 'Flashcards/1.0 (https://flashcards.camblu.org)' };
        const custRes = await fetch(`${baseUrl}/customers/${payment.customer}`, { headers });
        if (custRes.ok) {
          const custData = await custRes.json();
          if (custData.email) {
            const userRecord = await getFirebaseUserByEmail(serviceAccount, custData.email).catch(() => null);
            if (userRecord?.uid) {
              uid = userRecord.uid;
            }
          }
        }
      } catch (err) {
        console.warn('[Asaas Webhook] Erro ao buscar cliente do pagamento:', err);
      }
    }

    if (uid) {
      // 1. Assign Pro custom claim on Firebase Auth
      await setFirebaseUserProClaim(serviceAccount, uid, true);
      // 2. Update Firestore user document
      await updateUserDocument(serviceAccount, uid, {
        subscription: {
          status: 'active',
          plan: 'pro_monthly',
          provider: 'asaas',
          subscriptionId: payment.subscription || '',
          customerId: payment.customer || '',
          lastPaymentId: payment.id,
          updatedAt: new Date().toISOString()
        }
      });
      console.log(`[Asaas Webhook] Pro ativado com sucesso para UID: ${uid}`);
    } else if (externalRef.startsWith('extra:')) {
      const uidExtra = externalRef.replace('extra:', '');
      const userDoc = await getUserDocument(serviceAccount, uidExtra);
      const currentExtras = userDoc?.extraGenerations || 0;
      await updateUserDocument(serviceAccount, uidExtra, {
        extraGenerations: currentExtras + 1
      });
      console.log(`[Asaas Webhook] Geração extra adicionada para UID: ${uidExtra}`);
    }
  }

  // Subscription cancellation or delinquency
  if (event === 'SUBSCRIPTION_INACTIVATED' || event === 'PAYMENT_OVERDUE') {
    let uid = externalRef.startsWith('sub:') ? externalRef.replace('sub:', '') : null;
    if (!uid && payment.subscription && env.ASAAS_API_KEY) {
      try {
        const baseUrl = env.ASAAS_ENV === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
        const headers = { 'Content-Type': 'application/json', 'access_token': env.ASAAS_API_KEY, 'User-Agent': 'Flashcards/1.0 (https://flashcards.camblu.org)' };
        const subRes = await fetch(`${baseUrl}/subscriptions/${payment.subscription}`, { headers });
        if (subRes.ok) {
          const subData = await subRes.json();
          if (subData.externalReference && subData.externalReference.startsWith('sub:')) {
            uid = subData.externalReference.replace('sub:', '');
          }
        }
      } catch (e) {}
    }

    if (uid) {
      await setFirebaseUserProClaim(serviceAccount, uid, false);
      await updateUserDocument(serviceAccount, uid, {
        'subscription.status': 'canceled'
      });
      console.log(`[Asaas Webhook] Pro desativado para UID: ${uid}`);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle Stripe Webhook events
 */
async function handleStripeWebhook(request, env) {
  const sig = request.headers.get('stripe-signature');
  const bodyText = await request.text();
  let event;

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });

  if (env.STRIPE_WEBHOOK_SECRET && sig) {
    try {
      event = await stripe.webhooks.constructEventAsync(bodyText, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.warn('[Stripe Webhook] Erro ao validar assinatura:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
  } else {
    try {
      event = JSON.parse(bodyText);
    } catch (err) {
      return new Response('Invalid JSON payload', { status: 400 });
    }
  }

  const serviceAccount = getServiceAccount(env);
  const dataObject = event.data?.object || {};

  console.log(`[Stripe Webhook] Evento: ${event.type}, ID: ${dataObject.id}`);

  // 1. Checkout Session Completed -> Activate Pro
  if (event.type === 'checkout.session.completed') {
    let uid = dataObject.client_reference_id || dataObject.metadata?.uid || null;

    if (!uid && (dataObject.customer_details?.email || dataObject.customer_email)) {
      const email = dataObject.customer_details?.email || dataObject.customer_email;
      const userRecord = await getFirebaseUserByEmail(serviceAccount, email).catch(() => null);
      if (userRecord?.uid) {
        uid = userRecord.uid;
      }
    }

    if (uid) {
      if (dataObject.mode === 'payment' || dataObject.metadata?.type === 'extra_deck') {
        // ONE-TIME EXTRA DECK GENERATION PURCHASE
        const userDoc = await getUserDocument(serviceAccount, uid);
        const currentExtras = userDoc?.extraGenerations || 0;
        await updateUserDocument(serviceAccount, uid, {
          extraGenerations: currentExtras + 1,
          updatedAt: new Date().toISOString()
        });
        console.log(`[Stripe Webhook] Geração extra adicionada com sucesso para UID: ${uid} (novo total: ${currentExtras + 1})`);
      } else {
        // RECURRING MONTHLY PRO SUBSCRIPTION
        await setFirebaseUserProClaim(serviceAccount, uid, true);
        await updateUserDocument(serviceAccount, uid, {
          subscription: {
            status: 'active',
            plan: 'pro_monthly',
            provider: 'stripe',
            subscriptionId: dataObject.subscription || '',
            customerId: dataObject.customer || '',
            updatedAt: new Date().toISOString()
          }
        });
        console.log(`[Stripe Webhook] Pro ativado com sucesso para UID: ${uid}`);
      }
    }
  }

  // 2. Subscription Deleted / Canceled -> Deactivate Pro
  if (event.type === 'customer.subscription.deleted') {
    let uid = dataObject.metadata?.uid || null;
    if (!uid && dataObject.customer && env.STRIPE_SECRET_KEY) {
      try {
        const customer = await stripe.customers.retrieve(dataObject.customer);
        if (customer && customer.email) {
          const userRecord = await getFirebaseUserByEmail(serviceAccount, customer.email).catch(() => null);
          if (userRecord?.uid) {
            uid = userRecord.uid;
          }
        }
      } catch (e) {
        console.warn('[Stripe Webhook] Falha ao recuperar cliente cancelado:', e.message);
      }
    }

    if (uid) {
      await setFirebaseUserProClaim(serviceAccount, uid, false);
      await updateUserDocument(serviceAccount, uid, {
        'subscription.status': 'canceled',
        'subscription.canceledAt': new Date().toISOString()
      });
      console.log(`[Stripe Webhook] Pro desativado para UID: ${uid}`);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
