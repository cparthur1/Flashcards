# Stripe Checkout Integration Guide

## Values to Replace

All credentials from your Stripe Live Account have been successfully retrieved, configured, and deployed!

**Files containing configuration:**
- [worker/src/index.js](worker/src/index.js)
- [worker/wrangler.jsonc](worker/wrangler.jsonc)
- [js/config.js](js/config.js)

| Field | Configured Value | Status |
|-------|-----------------|--------|
| `line_items[].price` | `price_1UWEb0Rynl9tIFFYF2cvZ3RB` | Configured (Spaiq PRO R$ 4,99 / mês) |
| `STRIPE_SECRET_KEY` | `rk_live_...` | Uploaded to Cloudflare Secrets via `wrangler secret put` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_6Z9o3CgSS6dkaWkhTPqmsgCY6Sp5Fbbe` | Uploaded to Cloudflare Secrets & registered in Stripe |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_51UWEHsRynl9tIFFYm32d9vyXApB9FLeUcI5oNBuaCwkkxA0yc0pAVjKioRBO0Zy8j7CVQU6LSp09mM5Lss3EaDNg00qvRJ4VIT` | Configured in `js/config.js` |
| `mode` | `subscription` | Configured for recurring monthly billing |

---

## Configured Parameters

These parameters were configured in Checkout Studio and are active in production.

**Files containing these parameters:**
- [worker/src/index.js](worker/src/index.js)
- [js/explore-modal.js](js/explore-modal.js)

| Parameter | Value | Description |
|-----------|-------|-------------|
| `ui_mode` | `form` | Embedded form rendering within the Flashcards Pro modal |
| `mode` | `subscription` | Recurring monthly subscription at R$ 4,99 / mês |
| `billing_address_collection` | `auto` | Automatic address collection per customer location |
| `phone_number_collection` | `{"enabled": false}` | Phone number collection disabled |
| `automatic_tax` | `{"enabled": false}` | Automatic tax calculation disabled |
| `payment_method_collection` | `always` | Collect and save payment methods for subscription renewals |
| `submit_type` | `auto` | Default payment submit action |
| `saved_payment_method_options` | `{"payment_method_save": "enabled"}` | Allow customers to save card details for seamless renewals |
| `integration_identifier (Pro)` | `custom_embedded_web_0001` | Unique custom integration identifier for Pro monthly subscription |
| `integration_identifier (Extra Deck)` | `custom_embedded_web_0002` | Unique custom integration identifier for one-time Extra Deck purchase (R$ 0,99) |
| `appearance.theme` | `flat` | Clean flat theme matching Material Design 3 tokens |
| `appearance.variables.colorPrimary` | `#3b82f7` | Primary brand accent |
| `appearance.variables.borderRadius` | `4px` | Form input corner radius |

---

## Setup and Next Steps

### 1. What was completed automatically:

1. **Found Stripe Products & Prices**:
   - `price_1UWEb0Rynl9tIFFYF2cvZ3RB` ("Spaiq PRO" - R$ 4,99 / mês)
   - `price_1UWEc0Rynl9tIFFYhgaFcei3` ("Deck extra" - R$ 0,99 / compra única)
2. **Created Stripe Webhook Endpoint**:
   - Webhook ID: `we_1UWF4hRynl9tIFFYTAqrlu1F`
   - URL: `https://flashcards-backend.camblu.workers.dev/api/webhook/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`
   - Secret: `whsec_6Z9o3CgSS6dkaWkhTPqmsgCY6Sp5Fbbe`
3. **Provisioned Cloudflare Worker Secrets**:
   - `STRIPE_SECRET_KEY` -> Saved to Cloudflare encrypted secret store
   - `STRIPE_WEBHOOK_SECRET` -> Saved to Cloudflare encrypted secret store
4. **Configured Frontend Client**:
   - `STRIPE_PUBLISHABLE_KEY` configured in [js/config.js](js/config.js)
5. **Deployed Worker**:
   - Deployed live to `https://flashcards-backend.camblu.workers.dev`

---

### 2. Project Structure of Integration Files

```
Flashcards/
├── STRIPE_INTEGRATION_TODO.md     # Reference guide
├── .env.example                   # Reference environment variables
├── index.html                     # Loads Stripe Dahlia JS SDK in <head>
├── pages/
│   ├── game.html                  # Loads Stripe Dahlia JS SDK in <head>
│   ├── generate.html              # Loads Stripe Dahlia JS SDK in <head>
│   ├── stats.html                 # Loads Stripe Dahlia JS SDK in <head>
│   └── bulk-add.html              # Loads Stripe Dahlia JS SDK in <head>
├── js/
│   ├── config.js                  # Holds window.STRIPE_PUBLISHABLE_KEY
│   ├── backend-api.js             # Calls /api/create-checkout-session with Firebase Bearer Auth
│   └── explore-modal.js           # Initializes and mounts Stripe Embedded Form with M3 Appearance
└── worker/
    ├── package.json               # Node dependency: stripe@^23.1.0 with apiVersion 2026-03-25.dahlia
    ├── wrangler.jsonc             # Cloudflare Worker config and variables
    └── src/
        └── index.js               # POST /api/create-checkout-session and POST /api/webhook/stripe
```

---

### 3. How the Integration Works

```
[User clicks "Flashcards Pro"]
            │
            ▼
[js/explore-modal.js]
  • Initializes Stripe(STRIPE_PUBLISHABLE_KEY)
  • Requests POST /api/create-checkout-session with Firebase user Bearer token
            │
            ▼
[Cloudflare Worker Backend: POST /api/create-checkout-session]
  • Authenticates user UID and email
  • Calls stripe.checkout.sessions.create({
      ui_mode: "form",
      mode: "subscription",
      line_items: [{ price: "price_1UWEb0Rynl9tIFFYF2cvZ3RB", quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.uid,
      metadata: { uid: user.uid },
      ...fixed_by_ui_params
    })
  • Returns { client_secret: session.client_secret }
            │
            ▼
[Client Embedded Checkout Form]
  • stripe.initCheckoutFormSdk({ clientSecret, appearance })
  • checkout.createForm({ layout: 'expanded' }).mount('#checkout-form')
  • Listens to form 'confirm' event and confirms action
            │
            ▼
[Stripe processes payment (Card / Apple Pay / Google Pay)]
            │
            ▼
[Stripe Webhook: POST /api/webhook/stripe]
  • Validates stripe-signature with STRIPE_WEBHOOK_SECRET
  • checkout.session.completed event fires:
      - Sets Firebase Custom Claim { pro: true }
      - Updates Firestore user document subscription: { status: 'active', provider: 'stripe' }
  • Instant activation on client via /api/payment/verify fallback
```

---

### 4. Official Resources

- Stripe Support: https://support.stripe.com
- Stripe Developer Documentation: https://docs.stripe.com
- Stripe Model Context Protocol (MCP): https://docs.stripe.com/mcp
