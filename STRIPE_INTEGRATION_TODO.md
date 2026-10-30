# Stripe Checkout Integration Guide

## Values to Replace

The following values are placeholders and must be updated before going live.

**Files containing placeholders:**
- [worker/src/index.js](worker/src/index.js)
- [worker/wrangler.jsonc](worker/wrangler.jsonc)
- [js/config.js](js/config.js)
- [.env.example](.env.example)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| `line_items[].price` | `price_1Q_PLACEHOLDER` | Your actual Stripe Price ID from the Dashboard (https://dashboard.stripe.com/prices) or API for the Flashcards Pro subscription (R$ 4,99 / mês). |
| `STRIPE_SECRET_KEY` | `sk_test_placeholder` | Your secret API key from the Stripe Dashboard (https://dashboard.stripe.com/test/apikeys). Store securely via Cloudflare Worker secrets: `npx wrangler secret put STRIPE_SECRET_KEY`. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_placeholder` | Webhook signing secret from Stripe Workbench (https://dashboard.stripe.com/workbench/webhooks) configured for the endpoint `https://flashcards-backend.camblu.workers.dev/api/webhook/stripe`. Store securely via `npx wrangler secret put STRIPE_WEBHOOK_SECRET`. |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_placeholder` | Your publishable API key from Stripe Dashboard (https://dashboard.stripe.com/test/apikeys). Set in `js/config.js` (`window.STRIPE_PUBLISHABLE_KEY = 'pk_test_...'`). |
| `mode` | `subscription` | Set to `"subscription"` for recurring monthly billing (already configured). |

---

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

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
| `integration_identifier` | `custom_embedded_web_0001` | Unique custom integration identifier |
| `appearance.theme` | `flat` | Clean flat theme matching Material Design 3 tokens |
| `appearance.variables.colorPrimary` | `#3b82f7` | Primary brand accent |
| `appearance.variables.borderRadius` | `4px` | Form input corner radius |

---

## Setup and Next Steps

### 1. Environment Variables & API Keys

1. **Get Stripe Keys**:
   - Access [Stripe Dashboard > Developers > API Keys](https://dashboard.stripe.com/test/apikeys).
   - Copy **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`).

2. **Configure Client Key**:
   - Open [js/config.js](js/config.js).
   - Set:
     ```javascript
     window.STRIPE_PUBLISHABLE_KEY = 'pk_test_...';
     ```

3. **Create the Recurring Price in Stripe**:
   - Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/products).
   - Click **Add Product**:
     - Name: `Flashcards Pro`
     - Price: `R$ 4,99` (BRL)
     - Billing: `Recurring` > `Monthly`
   - Copy the generated Price ID (e.g., `price_1Qxyz...`).
   - Add this Price ID in [worker/wrangler.jsonc](worker/wrangler.jsonc) or pass as environment variable `STRIPE_PRICE_ID`.

4. **Deploy Secrets to Cloudflare Worker**:
   Run in your terminal:
   ```bash
   cd worker
   npx wrangler secret put STRIPE_SECRET_KEY
   # Enter your sk_test_... or sk_live_... when prompted

   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   # Enter your whsec_... when prompted
   ```

5. **Configure Stripe Webhooks**:
   - Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/workbench/webhooks).
   - Add endpoint URL:
     `https://flashcards-backend.camblu.workers.dev/api/webhook/stripe`
   - Select events to listen for:
     - `checkout.session.completed` (activates Pro status in Firebase Auth claims & Firestore)
     - `customer.subscription.deleted` (deactivates Pro status upon cancellation)
   - Copy the Signing Secret (`whsec_...`) and save it via `wrangler secret put STRIPE_WEBHOOK_SECRET`.

---

### 2. Project Structure of Integration Files

```
Flashcards/
├── STRIPE_INTEGRATION_TODO.md     # Single source of truth for setup and config
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
    ├── .dev.vars.example          # Local dev environment template
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
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
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

### 4. Testing Credit Cards & Test Modes

While using test keys (`pk_test_...` and `sk_test_...`):

- **Stripe Test Cards**:
  - Regular success card: `4242 • 4242 • 4242 • 4242`
  - Any future expiration date (e.g. `12/34`)
  - Any 3 digits CVC (e.g. `123`)
  - Any ZIP / Postal Code (e.g. `90210` or `01310-100`)
- **3D Secure Authentication Testing**:
  - Test card requiring 3DS: `4000 • 0027 • 6000 • 3184`
- Full test card list: [Stripe Test Cards Documentation](https://docs.stripe.com/testing#cards)

---

### 5. Next Steps for Production

1. **Verify Live Mode**:
   - When ready to accept real payments, toggle the Stripe Dashboard switch to **Live mode**.
   - Create the live recurring price for `R$ 4,99` and update `STRIPE_PRICE_ID`.
   - Update `STRIPE_PUBLISHABLE_KEY` in `js/config.js` with your `pk_live_...` key.
   - Set live secret keys in Cloudflare Worker via `npx wrangler secret put STRIPE_SECRET_KEY` and `npx wrangler secret put STRIPE_WEBHOOK_SECRET`.
   - Add live webhook endpoint in Stripe Dashboard.

2. **Customer Portal (Optional)**:
   - To let users manage or cancel their subscriptions directly via Stripe-hosted billing portal, enable the Customer Portal in [Stripe Billing Portal Settings](https://dashboard.stripe.com/settings/billing/portal).

---

### 6. Official Resources

- Stripe Support: https://support.stripe.com
- Stripe Developer Documentation: https://docs.stripe.com
- Stripe Model Context Protocol (MCP): https://docs.stripe.com/mcp
