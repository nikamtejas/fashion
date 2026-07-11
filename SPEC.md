# Fashion E-commerce Platform — Product Spec & Build Prompt

This document turns your requirements into (1) a clean "master prompt" you can hand to a developer or an AI coding tool, and (2) a detailed module-by-module flow so everything is unambiguous before anyone writes code.

---

## 1. Master prompt — give this to Claude / Claude Code as-is

This is written to be handed directly to Claude (ideally Claude Code, working in a real repo) as the project brief. It's decisive about stack choices on purpose — an agent works better from concrete defaults it can push back on than from `[your stack]` placeholders. Edit the stack line if you have a preference; otherwise let Claude run with it.

> You are building a production-grade fashion e-commerce platform: a customer storefront + an admin panel, sharing one backend and database. Read this entire brief before writing code. Work through it milestone by milestone (see the Milestones section below) — at the end of each milestone, stop, summarize what you built, and confirm it runs before moving to the next one. Don't jump ahead to later milestones' features early.
>
> **Stack (use this unless you have a strong reason to deviate — explain if you do)**
> - Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
> - Backend: Next.js API routes or a separate Node/Express service — your call based on deployment target
> - Database: MongoDB + Mongoose (or the native driver) for schema/validation
> - Auth: NextAuth or a similar session-based auth library, with `customer` and `admin` roles
> - Image AI transformation: Google Gemini image API (Nano Banana Pro — `gemini-3-pro-image-preview` — for highest-fidelity product shots; its faster/cheaper sibling `gemini-3.1-flash-image` "Nano Banana 2" if volume/cost matters more than top quality) for turning a raw admin-uploaded photo into a clean catalog-style image
> - Image storage & delivery: Cloudinary — stores both the original and the Gemini-enhanced result, and handles CDN delivery/responsive formats (`f_auto,q_auto`)
> - Payments: Razorpay (Standard Checkout, which also surfaces Snapmint EMI once enabled on the account)
> - Shipping: DHL API (MyDHL Express or DHL eCommerce, depending on region — ask the user which if unclear)
> - Deployment target: ask the user, or default to Vercel (frontend) + MongoDB Atlas (database)
>
> **Non-negotiable engineering standards**
> - Mobile-first, fully responsive down to 360px width, on every screen — catalog, product detail, cart, checkout, order tracking, and the admin panel.
> - Performance budget: LCP < 2.5s, CLS < 0.1, INP < 200ms on a throttled mobile connection. Lazy-load images, use `next/image` with Cloudinary's responsive/auto-format delivery (`f_auto,q_auto`), code-split by route, cache catalog reads (CDN/edge or in-memory with invalidation on admin writes).
> - Skeleton loaders instead of blank screens or layout shift while data or AI-enhanced images load.
> - Type-safe end to end (TypeScript, Mongoose schemas or Zod, validated API inputs).
> - Never hardcode secrets, GST rates, or API keys — GST threshold/rates are admin-configurable fields (see Pricing engine below), and all API keys (MongoDB URI, Cloudinary, Razorpay, DHL) live in environment variables.
> - Write the app so each external integration (Gemini image transformation, Cloudinary, Razorpay, Snapmint, DHL) is isolated behind its own service module — if the user swaps a provider later, only that module should need to change.
> - After each milestone, the app should actually run (`npm run dev` or equivalent) with no broken pages — don't leave half-wired features on the main path.
>
> **Feature spec**
>
> *Catalog*: Admin creates products with multiple images. Every uploaded image is sent through an AI image-enhancement step (background cleanup, lighting/color correction, upscaling) before being saved as the product image; admin sees a before/after preview and can accept, re-run, or keep the original — never auto-publish an enhanced image without that confirmation. Products have variants (size, color), stock count, category, tags.
>
> *Pricing engine*: When admin adds/edits a product, compute: `Base Cost = Purchase Price + Fixed Cost`; `Pre-tax Price = Base Cost + (Base Cost × Margin %)`; GST rate is picked from two admin-configurable rates based on an admin-configurable price threshold; `Final Price = Pre-tax Price + (Pre-tax Price × GST Rate)`. Show the full breakdown live in the admin form. Store every component (not just final price) so margins can be recalculated if rates change later.
>
> *Cart & checkout*: Coupon codes (flat or percentage, with expiry/usage limits/min cart value). Payment options: Razorpay (cards/UPI/netbanking/wallets), Snapmint EMI (enabled as a Razorpay Standard Checkout payment method — no separate SDK needed), and Cash on Delivery as a distinct order-status path. Wishlist/favorites toggle on every product card, persisted per logged-in user.
>
> *Fulfillment*: On order confirmation, create a DHL shipment, generate a label, store the tracking number on the order. Customer order page polls/displays live DHL tracking status.
>
> *Notifications*:
> - Order confirmation email: sent automatically the moment an order is placed/confirmed, via a transactional email service (Resend, SendGrid, or AWS SES). Include order items, price breakdown, and the DHL tracking link once it exists (send a follow-up email or update when tracking becomes available if it's not ready at order time).
> - Capture the customer's WhatsApp number at checkout and store it on the order record.
> - In the admin order view, each order shows a WhatsApp icon/button next to the customer's number. Clicking it opens a `wa.me` click-to-chat link (`https://wa.me/<number>?text=<url-encoded message>`) in a new tab — this opens WhatsApp (app or web) with the message pre-filled in the chat box; the admin still presses send inside WhatsApp, since WhatsApp's click-to-chat links can't auto-send without that final tap — that's WhatsApp's own restriction, not a limitation of this build. Message template: `Hi {name}, your order is confirmed — {product name}, ₹{price}. {other order info}. Track it here: {tracking link}`.
> - Note for later: fully automated WhatsApp sending (no click, no manual send) requires the separate WhatsApp Business Platform (Cloud API) with Meta approval and pre-approved message templates — flag this to the user as a possible v2 upgrade rather than building it now unless they specifically ask for it.
>
> *Admin dashboard*: Revenue/sales analytics (daily/weekly/monthly, by product/category), order management (status, payment method, tracking link), product management (images, stock, pricing breakdown), coupon management. Paginate or virtualize any table that could grow large — don't load every order at once.
>
> Ask the user before making irreversible choices (e.g. which DHL API variant, which AI image-enhancement provider, hosting target) if the brief doesn't specify one clearly enough to proceed confidently.

---

## 2. Build milestones

Paste this right after the master prompt so Claude treats it as the execution order. Each milestone ends in something demoable, not just backend plumbing — Claude should build, run, and briefly report on each one before starting the next.

**M1 — Foundation**
- Project setup, mobile-first responsive layout shell (header, nav, footer, grid system), auth (customer + admin roles), CDN/image pipeline wired up.
- *Done when*: a blank but responsive storefront and admin login work on mobile and desktop.

**M2 — Catalog + AI image enhancement (Gemini)**
- Product CRUD in admin, multi-image upload. On upload, send the raw photo to the Gemini image API with a fixed edit prompt (see §4.1) that restages the garment as a clean, professional catalog photo — without changing the garment itself. Store the result via Cloudinary. Admin gets a before/after preview with accept/re-enhance/use-original choice. Responsive product listing and product detail pages with lazy-loaded images.
- *Done when*: admin uploads a casual/random clothing photo and gets back a realistic, catalog-quality version of the same garment, with the option to reject it if it looks off.

**M3 — Pricing engine**
- Purchase price / fixed cost / margin % / GST threshold & rates as admin fields, live price breakdown preview, final price stored per product.
- *Done when*: admin sees cost → margin → GST → final price update live while filling the product form.

**M4 — Cart, coupons, wishlist**
- Add/update/remove cart, persistent cart for logged-in users, coupon code validation and discount application, wishlist toggle on product cards.
- *Done when*: a customer can browse, favorite, add to cart, and apply a coupon end-to-end.

**M5 — Payments (Razorpay, Snapmint EMI, COD)**
- Razorpay Standard Checkout integration, Snapmint enabled as an EMI option, COD as a separate order-status path, order record capturing payment method/status.
- *Done when*: a test order can be completed with each of the three payment paths.

**M6 — Shipping (DHL)**
- DHL account/API access approved, shipment creation on order confirmation, label generation, tracking number stored, customer-facing tracking status page.
- *Done when*: a confirmed order automatically gets a DHL label and the customer can see live tracking.

**M7 — Notifications (email + WhatsApp)**
- Order confirmation email triggered on order placement, with items/price/tracking link. WhatsApp number captured at checkout and stored on the order. Admin order view gets a WhatsApp click-to-chat button that opens `wa.me` with the pre-filled confirmation message.
- *Done when*: placing a test order sends a confirmation email, and clicking the WhatsApp icon on that order in admin opens WhatsApp with the correct message ready to send.

**M8 — Admin dashboard**
- Revenue/sales analytics, order management with filters, product management view, coupon management, paginated/virtualized tables.
- *Done when*: admin can answer "how much did we sell this week and what shipped today" from the dashboard alone.

**M9 — Performance pass & launch**
- Run Lighthouse/PageSpeed on every core page, fix LCP/CLS/INP regressions, verify responsive breakpoints on real devices, load-test checkout, final QA on all three payment paths, DHL tracking, and both notification channels.
- *Done when*: Core Web Vitals targets are met on mobile and the full order flow — including email and WhatsApp notifications — has been tested end to end.

---

## 3. End-to-end flow

The diagram above shows the five stages. Details for each:

**1. Catalog + AI image enhancement** → **2. Pricing calculator** → **3. Cart & checkout (coupon, EMI, payment)** → **4. Order fulfillment (DHL)** → **5. Admin dashboard** (which also feeds back into stock/pricing).

---

## 4. Module details

### 4.1 Catalog — AI image enhancement (Gemini)

**Flow**
1. Admin uploads a raw product photo — could be a phone photo, a supplier image, anything.
2. The photo is sent to the Gemini image API as an **edit** request (image + text prompt), not a from-scratch generation — this is the key distinction that keeps the result from looking "fake": you're asking the model to restage the *same* garment, not invent a new one.
3. Use a fixed, tested prompt template (tune this with a few real samples before locking it in), something like:

   > "Edit this photo of a clothing item into a professional e-commerce product photo. Keep the garment's exact color, pattern, texture, and design completely unchanged — do not alter or reinterpret the print, fabric, or shape. Place it on a clean, evenly lit studio background (soft light gray or white), remove clutter and background distractions, correct exposure and color balance, and present it centered and well-framed as it would appear on a fashion retail website. The result should look like a real photograph taken in a studio, not an illustration or an obviously AI-generated image."

4. Gemini returns the edited image; upload it to Cloudinary (both the Gemini output and the original raw photo are kept).
5. Admin sees a before/after preview and chooses accept / re-run with an adjusted prompt / keep the original — never auto-publish, since occasionally a generative edit can shift a color or a print detail in ways that matter a lot for apparel.

**Model choice**
- **Nano Banana Pro** (`gemini-3-pro-image-preview`) — higher fidelity, better at preserving garment detail and text/label accuracy, higher cost per image (~$0.13–0.24 depending on resolution). Best for hero/primary product shots.
- **Nano Banana 2** (`gemini-3.1-flash-image`) — faster and cheaper, still solid quality, good for secondary angles or high-volume catalogs where every image doesn't need the top tier.
- Both models embed an invisible SynthID watermark in the output (Google's standard for AI-generated/edited images) — it doesn't affect visual quality or how the image displays, just worth knowing it's there.

**On "not looking fake"**
- The realism comes mostly from three things: (1) editing rather than generating from a text description alone, (2) an explicit instruction to preserve the garment exactly, and (3) a consistent, restrained prompt (clean studio background, natural lighting) rather than an elaborate stylized scene. Resist the urge to make the prompt fancier — the more specific and modest the ask, the more it reads as a real photograph.
- Budget a short calibration round: run 10–15 real product photos through the prompt, have admin review them, and adjust wording before this becomes the default pipeline.

**Storage**
- Product images live in Cloudinary; each product document stores both the original and enhanced Cloudinary URLs/IDs plus an approval status (see data model in §5).

### 4.2 Pricing calculator

This is the core logic you described. Suggested formula:

```
Base Cost      = Purchase Price + Fixed Cost
Margin Amount  = Base Cost × Margin %
Pre-tax Price  = Base Cost + Margin Amount
GST Rate       = Rate B  if Pre-tax Price >= Threshold Value
               = Rate A  if Pre-tax Price <  Threshold Value
GST Amount     = Pre-tax Price × GST Rate
Final Price    = Pre-tax Price + GST Amount
```

- **Purchase Price**: what you paid your supplier for that item.
- **Fixed Cost**: per-unit packaging, handling, platform fees, etc.
- **Margin %**: your profit margin, applied on (Purchase Price + Fixed Cost).
- **Threshold Value + two GST rates**: make both the cutoff and the two rates admin-configurable fields, not hardcoded — GST slabs for apparel/footwear are value-based in India and have changed more than once, so don't hardcode a rate; let admin update it when policy changes, and verify the current rate with a tax advisor or the GST portal before launch.
- Show the full breakdown (Base Cost → Margin → Pre-tax → GST → Final Price) on screen so admin can sanity-check every product before publishing, and store each component (not just the final price) so you can recompute margins later even if rates change.

### 4.3 Coupon engine

- Coupon types: flat amount off, or percentage off (with an optional max discount cap).
- Rules: expiry date, usage limit (total and/or per-customer), minimum cart value, applicable categories/products.
- Applied at checkout before EMI/payment method is chosen, recalculating the final payable amount.

### 4.4 EMI — Snapmint

Snapmint's cardless EMI is available as a native payment method inside Razorpay Checkout — no additional integration is required to show Snapmint as a cardless EMI option on Razorpay's Standard Checkout, and Snapmint's BNPL is now available as a native payment method for Razorpay merchants without a separate technical integration. Practically this means:
- You don't need a separate Snapmint SDK if you're already on Razorpay — you request Snapmint be enabled on your Razorpay account, and it shows up as an EMI option at checkout automatically.
- Customer flow: select Snapmint on the payment screen → enter phone number + OTP for verification → instant eligibility check → choose 3/6/9-month plan → confirm.
- Snapmint requires Merchant ID, Key, and Token production credentials plus an existing Razorpay account to activate this — get these from your Snapmint merchant dashboard.
- If you ever need a custom (non-Razorpay) checkout, Snapmint also offers a direct server-to-server API for authorize/capture/void/refund calls, and needs shipping/billing address plus basket details for its credit underwriting check — but going through Razorpay is the simpler path since you're already using it for payments.

### 4.5 Payments — Razorpay + COD

- Razorpay Standard Checkout handles cards, UPI, netbanking, wallets, and (once enabled) Snapmint EMI in one integration.
- Cash on Delivery: a separate order status flow — order is confirmed without payment capture, payment is marked "collected on delivery" once DHL/courier confirms delivery, reconciled manually or via a COD remittance report.
- Order record should always store: payment method, payment status, Razorpay payment ID (if online), and amount actually collected.

### 4.6 Shipping — DHL

- DHL exposes this via the DHL API Developer Portal, with separate APIs depending on your shipment type and region (DHL Express "MyDHL API" for international express, DHL eCommerce APIs for domestic parcel, and a Shipment Tracking – Unified API for tracking across services). You need an active DHL Express customer account to use the API.
- Flow: order confirmed → create shipment (address, package weight/dimensions, service type) → DHL returns a tracking number and shipping label → label auto-attached to the packing slip → tracking number saved on the order.
- Customer-facing tracking page/section polls the Shipment Tracking API (or DHL's push/webhook version) and displays status history (picked up → in transit → out for delivery → delivered).
- Note DHL is currently migrating parts of its tracking API platform, so build the integration against their current API version and watch their changelog for the "post_de" → "svb" service-parameter rename mentioned in their docs.

### 4.7 Notifications — email + WhatsApp

**Order confirmation email**
- Trigger: immediately when an order moves to "confirmed" status.
- Send via a transactional email API (Resend/SendGrid/SES) — not raw SMTP, for deliverability and tracking.
- Content: order ID, items with images, price breakdown, payment method, delivery address, and the DHL tracking link (if not yet available, send it in a follow-up "your order has shipped" email instead of leaving a broken link).

**WhatsApp — click-to-chat (what you described)**
- At checkout, capture the customer's WhatsApp number (can default to their phone number field, editable) and store it on the order record.
- In the admin order list/detail view, show a WhatsApp icon next to the number. On click, open:
  `https://wa.me/<countrycode><number>?text=<URL-encoded message>`
  in a new tab. This opens WhatsApp (desktop app, mobile app, or web) with the message already typed into the chat box for that number.
- **Important behavior to build correctly**: WhatsApp's click-to-chat links pre-fill the message but do not send it — the admin (the person clicking) still taps send inside WhatsApp. That's a restriction WhatsApp enforces on `wa.me` links themselves, not something this build can bypass. This matches what you described ("when I click on this number ... it sends the msg") in the sense that it's a one-click send from the admin's side, just with WhatsApp's own send button as the last step.
- Suggested message template:
  `Hi {name}, your order is confirmed — {product_name}, ₹{price}. {other_order_info}. Track it here: {tracking_link}`
- Build the message string server-side (or in a small utility function) so it's consistent, then `encodeURIComponent()` it into the `wa.me` URL.

**If you want zero-click, fully automatic WhatsApp sending later**: that needs the WhatsApp Business Platform (Cloud API), which requires Meta business verification and pre-approved message templates for anything sent without the customer messaging you first. It's a bigger integration — worth flagging to your developer as a possible phase 2, but don't scope it into the initial build unless you specifically want to go through Meta's approval process now.

### 4.8 Admin dashboard

- **Revenue/sales**: daily/weekly/monthly revenue, order count, average order value, top-selling products, filter by date range/category.
- **Orders**: list with status (placed, paid, shipped, delivered, cancelled, returned), payment method, tracking link.
- **Products**: image gallery with AI-enhanced previews, stock levels, price breakdown per product, favorites/wishlist count per product.
- **Coupons**: create/edit/deactivate, usage stats.
- **Customers** (optional but recommended): order history, lifetime value.

### 4.9 Customer-side extras

- Wishlist/favorites: heart icon on product card, toggled per logged-in user, synced to a `favorites` table.
- Cart: standard add/update/remove, persists across sessions for logged-in users.

---

## 5. Suggested data model (MongoDB collections)

Document-based, so images and variants are embedded where they're always read together with the product; things that grow independently (orders, favorites) are their own collections referencing `product`/`user` by ObjectId.

```
products {
  _id, name, category, tags[], stock,
  variants: [{ size, color, sku, stock }],
  pricing: {
    purchasePrice, fixedCost, marginPct,
    gstThreshold, gstRateLow, gstRateHigh,
    finalPrice        // computed and stored, recompute if inputs change
  },
  images: [{ cloudinaryId, originalUrl, enhancedUrl, geminiModel, status }], // status: pending | accepted | rejected
  createdAt, updatedAt
}

coupons {
  _id, code, type,        // "flat" | "percentage"
  value, maxDiscount, minCartValue,
  expiresAt, usageLimit, usedCount
}

orders {
  _id, userId,
  items: [{ productId, variantSku, name, price, qty }],
  subtotal, couponId, discount, gstAmount, total,
  payment: { method, status, razorpayPaymentId },  // method: razorpay | snapmint | cod
  shipping: { dhlTrackingId, status },
  whatsappNumber, confirmationEmailSentAt,
  status,               // placed | confirmed | shipped | delivered | cancelled | returned
  createdAt, updatedAt
}

favorites {
  _id, userId, productId, createdAt
}

users {
  _id, name, email, phone, whatsappNumber,
  addresses: [{ line1, line2, city, state, pincode, isDefault }],
  role,                 // customer | admin
  createdAt
}
```

Notes for Claude/whoever builds this:
- Index `products.category`, `orders.userId`, `orders.status`, and `favorites.{userId, productId}` (compound, unique) — these are the fields you'll filter/sort on constantly.
- Keep `pricing.finalPrice` denormalized (stored, not computed on every read) so storefront reads don't recompute GST math per request — recalculate and update it only when an admin edits pricing inputs.
- Don't embed `orders` inside `users` — order volume per user is unbounded and you'll query orders independently (by status, by date) far more than "get all of this user's orders."

---

## 6. Notes before you build

- **GST rates**: don't hardcode them — confirm current apparel/footwear GST slabs with a tax professional or the official GST portal, since rates are policy-driven and change.
- **DHL account**: you need a business DHL Express or DHL eCommerce account (with API access approved) before any of this works — apply on the [DHL Developer Portal](https://developer.dhl.com/) first.
- **Snapmint + Razorpay**: contact Snapmint/Razorpay to get Snapmint enabled on your Razorpay account; it's a dashboard toggle, not a separate integration, once you have Snapmint's production credentials.
- **AI image transformation via Gemini**: this is an image-*editing* call (photo + instruction), not text-to-image generation — that distinction is what keeps results looking like real photos of your actual garments instead of AI-invented ones. Calibrate the prompt on real samples before locking it in, and keep Cloudinary as the storage/delivery layer regardless of which Gemini model tier you use.
- **MongoDB schema discipline**: MongoDB won't stop you from storing inconsistent documents, so enforce structure at the application layer — Mongoose schemas (or Zod validation on every write) are what actually keeps `products`/`orders` documents consistent over time.
- **WhatsApp**: the click-to-chat (`wa.me`) approach is quick to build and needs no approval process, but it always requires the admin to tap send inside WhatsApp — there's no way around that with this method. If you later want messages to go out with zero manual step, that's a separate WhatsApp Business Platform integration requiring Meta approval — worth knowing now so you don't expect fully automatic sending from the click-to-chat version.
