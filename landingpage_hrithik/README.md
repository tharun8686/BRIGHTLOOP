# Standalone Brightloop Landing Page (Jeton.com Inspired)

This folder contains the complete, self-contained **Brightloop Landing Page** designed as a standalone asset. It does not interfere with the internal Brightloop application routes (`/app`, `/auth`, etc.).

---

## 1. Quick Preview & How to Run Alone

Because `index.html` is 100% self-contained with embedded styles, responsive layout logic, SVG brand marks, and interactive JavaScript:

### Method A: Double-Click (Zero Install)
Simply double-click `standalone-landing/index.html` in your file explorer, and it will open directly in Google Chrome, Edge, Safari, or Firefox.

### Method B: Any Local Static Server
You can also preview it with any lightweight local static server:
```bash
# Using Python
cd standalone-landing
python -m http.server 8080

# Or using npx serve
npx serve standalone-landing -p 8080
```
Then visit **`http://localhost:8080`**.

---

## 2. In-Depth Feature Comparison: Jeton.com vs. BrightLoop

| Jeton.com Design Pattern | Brightloop Implemented Feature in Codebase | How It Was Translated in the Standalone Landing Page |
|---|---|---|
| **Core Value Proposition** | *"One wallet for all needs"* (eWallet, cards, transfers, multi-currency). | *"Every subscription. One seamless flow."* — Unified subscription operations, relational lifecycle, billing, payments, and financial visibility. |
| **Primary Visual Accent** | High-energy vermilion orange-red (`#F73B20`) on crisp white / warm off-whites. | `#F73B20` accent for primary CTAs, active lifecycle nodes, and metrics, grounded by deep warm brown (`#360802`) and clean `#F7F6F3`. |
| **Hero Visualization** | Floating 3D card tokens, glowing digital wallets, and balance displays. | Realistic 3D-perspective SaaS workspace mockup featuring live MRR (`₹4,85,000`), active subscriptions (`1,428`), revenue collected (`₹42,10,000`), an SVG revenue curve, and upcoming renewal toasts. |
| **Brand Motif** | Coin-shaped circular glyphs and looping payment pathways. | **Continuous Subscription Loop** SVG mark: Interlocking infinity rings representing `Product → Plan → Quote → Subscription → Invoice → Payment → Renewal`. |
| **Problem / Transformation** | Overcoming fragmented banking apps and cross-border fees. | **Transformation Matrix**: Comparing spreadsheet chaos, missed renewals, and manual invoicing against Brightloop's relational SQLite database. |
| **Core Workflow** | Sign up → Fund account → Virtual Card → Transact. | **Interactive 6-Stage Lifecycle Flow**: 1. Products & Plans, 2. Quotations, 3. Subscriptions, 4. Recurring Invoices, 5. Payments, 6. Financial Insights. |
| **Feature Presentation** | Asymmetric Bento Grid (card freeze, limits, instant transfers). | **Asymmetric 6-Card Bento Grid**: Subscription Control, Automated Invoicing, Flexible Cadences, Payment Tracking, Revenue Intelligence, and Customer Portal. |
| **Financial Intelligence** | Personal spending analytics and cashback meters. | **Executive Financial Dashboard**: Normalized MRR/ARR, collection efficiency (94.6%), overdue debt ageing (>30 days), and audit event timeline. |
| **Audience Segments** | Personal vs Business Merchant accounts. | **Role-Based Experience Cards**: 3 tailored UI views for Administrators, Operations Staff, and Customers. |
| **Closing Visual Field** | Full-bleed red brand banner with high-contrast pill CTA. | Full-bleed `#F73B20` closing field with animated concentric loop geometry and **Enter Brightloop →** button. |

---

## 3. How to Integrate into Next.js Afterwards

When you are ready to integrate this landing page into your main application, you can choose either of these two paths:

### Option 1: Direct Root Route in Next.js
1. Copy `standalone-landing/index.html`'s structure into `src/app/page.tsx` (or use the pre-built React components in `src/components/landing/`).
2. Replace `export default function Home() { redirect('/app'); }` in `src/app/page.tsx`.
3. Set your destination URL in `.env.local` using `NEXT_PUBLIC_BRIGHTLOOP_APP_URL`.

### Option 2: Deploy Separately (Marketing Subdomain)
You can deploy `standalone-landing/` directly to Vercel, Netlify, Cloudflare Pages, or AWS S3 as your public marketing site (e.g. `https://brightloop.io`), while keeping your application running on `https://app.brightloop.io`. All CTAs on the landing page will link directly to your application!

