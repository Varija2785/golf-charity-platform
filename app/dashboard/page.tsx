"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
import { supabase } from "../../lib/supabase"
import type { User, Session } from "@supabase/supabase-js"

// ─── Types ────────────────────────────────────────────────────────────────────
type AppView = "loading" | "auth" | "subscribe" | "dashboard" | "admin"
type AuthMode = "login" | "signup"
type NavSection =
  | "overview"
  | "scores"
  | "draw"
  | "charity"
  | "subscription"
  | "wins"
  | "settings"

type AdminSection =
  | "admin-overview"
  | "admin-users"
  | "admin-draws"
  | "admin-charities"
  | "admin-winners"
  | "admin-reports"

interface Score {
  id: string
  score: number
  date: string
  user_id: string
}

interface DrawRecord {
  id: string
  user_id: string
  month: string
  drawn_numbers: number[]
  matched_numbers: number[]
  prize: number
  created_at: string
  status?: "pending" | "paid" | "rejected"
  proof_url?: string
  user_email?: string
}

interface SubRecord {
  id: string
  user_id: string
  status: "active" | "cancelled" | "lapsed"
  plan: "monthly" | "yearly"
  created_at: string
  renewal_date?: string
  user_email?: string
}

interface CharityProfile {
  id: string
  name: string
  cat: string
  description: string
  website?: string
  featured?: boolean
  events?: string[]
}

interface ToastItem {
  id: number
  msg: string
  type: "ok" | "err" | "gold"
}

interface Ball {
  num: number | null
  state: "idle" | "spin" | "done" | "match"
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CHARITIES: CharityProfile[] = [
  {
    id: "alz",
    name: "Alzheimer's Research UK",
    cat: "Medical Research",
    description:
      "Pioneering dementia research to find preventions, treatments and a cure. Every penny goes directly to breakthrough scientific studies.",
    website: "https://www.alzheimersresearchuk.org",
    featured: true,
    events: ["Annual Golf Day — July 2026", "Charity Auction — September 2026"],
  },
  {
    id: "gf",
    name: "Golf Foundation",
    cat: "Sport & Youth",
    description:
      "Transforming lives through golf. Getting young people aged 5–18 active, improving their wellbeing and life skills through the sport.",
    website: "https://www.golf-foundation.org",
    events: ["Junior Open Day — May 2026"],
  },
  {
    id: "mac",
    name: "Macmillan Cancer Support",
    cat: "Cancer Care",
    description:
      "No one should face cancer alone. Macmillan provides medical, emotional, practical and financial support to everyone affected by cancer.",
    website: "https://www.macmillan.org.uk",
    featured: true,
    events: ["World's Biggest Coffee Morning — October 2026"],
  },
  {
    id: "rnli",
    name: "RNLI",
    cat: "Lifesaving",
    description:
      "The Royal National Lifeboat Institution saves lives at sea. Volunteer lifeboat crews and lifeguards operate 24/7, 365 days a year.",
    website: "https://rnli.org",
    events: ["Coastal Golf Classic — August 2026"],
  },
  {
    id: "mind",
    name: "Mind UK",
    cat: "Mental Health",
    description:
      "Fighting for better mental health for everyone. Mind provides advice, support, and campaigns to create a society that promotes good mental health.",
    website: "https://www.mind.org.uk",
    events: ["Mental Health Awareness Week Golf Day — May 2026"],
  },
]

const MEMBER_COUNT = 1240
const AVG_FEE = 9.99
const POOL_PCT = 0.6
const POOL_TOTAL = Math.round(MEMBER_COUNT * AVG_FEE * POOL_PCT)
const PRIZE_5 = Math.round(POOL_TOTAL * 0.4)
const PRIZE_4 = Math.round((POOL_TOTAL * 0.35) / 3)
const PRIZE_3 = Math.round((POOL_TOTAL * 0.25) / 8)

const ADMIN_EMAIL = "admin@fairwayflow.co.uk"
const ADMIN_PASSWORD = "Admin@FF2026"

const CURRENT_MONTH = new Date().toISOString().slice(0, 7)

function calcPrize(m: number): number {
  if (m === 5) return PRIZE_5
  if (m === 4) return PRIZE_4
  if (m === 3) return PRIZE_3
  return 0
}

function fmt(n: number): string {
  return "£" + n.toLocaleString("en-GB")
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-")
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function mkInitials(email: string) {
  const p = email.split("@")[0].split(/[._\-+]/)
  return p.length >= 2
    ? (p[0][0] + p[1][0]).toUpperCase()
    : email.slice(0, 2).toUpperCase()
}

function lvl(s: number) {
  if (s >= 35) return { color: "var(--green)", label: "Excellent" }
  if (s >= 25) return { color: "var(--g1)", label: "Good" }
  if (s >= 15) return { color: "var(--t3)", label: "Average" }
  return { color: "var(--t5)", label: "Fair" }
}

const QP = [10, 18, 24, 30, 36]

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Courier+Prime:wght@400;700&display=swap');

*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}

:root{
  /* Beautiful pastel color palette */
  --bg-primary:#fef7f0;--bg-secondary:#fdf3e8;--bg-tertiary:#fcefdc;--bg-card:#ffffff;
  --text-primary:#2d3748;--text-secondary:#4a5568;--text-tertiary:#718096;--text-muted:#a0aec0;
  --accent-primary:#b794f6;--accent-secondary:#f687b3;--accent-light:#fed7e2;
  --border-light:#e2e8f0;--border-medium:#cbd5e0;
  --shadow-light:rgba(0,0,0,.05);--shadow-medium:rgba(0,0,0,.1);
  
  /* Status colors */
  --success:#48bb78;--success-bg:rgba(72,187,120,.07);--success-b:rgba(72,187,120,.24);
  --warning:#ed8936;--warning-bg:rgba(237,137,54,.07);--warning-b:rgba(237,137,54,.22);
  --error:#f56565;--error-bg:rgba(245,101,101,.07);--error-b:rgba(245,101,101,.22);
  --info:#4299e1;--info-bg:rgba(66,153,225,.07);--info-b:rgba(66,153,225,.25);
  
  /* Font families */
  --font-text:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --font-numbers:'Courier Prime','Courier New',monospace;
  
  /* Legacy variables for compatibility */
  --g1:#b794f6;--g2:#f687b3;--g3:#9f7aea;--g4:#fed7e2;
  --bg:var(--bg-primary);--bg2:var(--bg-secondary);--bg3:var(--bg-tertiary);--bg4:var(--bg-card);
  --t1:var(--text-primary);--t2:var(--text-secondary);--t3:var(--text-tertiary);--t4:var(--text-muted);--t5:var(--text-muted);--t6:var(--text-muted);
  --b1:var(--border-light);--b2:var(--border-medium);--b3:var(--border-medium);
  --green:var(--success);--green-bg:var(--success-bg);--green-b:var(--success-b);
  --red:var(--error);--red-bg:var(--error-bg);--red-b:var(--error-b);
  --blue:var(--info);--blue-bg:var(--info-bg);--blue-b:var(--info-b);
  --amber:var(--warning);--amber-bg:var(--warning-bg);--amber-b:var(--warning-b);
  --serif:var(--font-numbers);--sans:var(--font-text);
  
  /* Animations & spacing */
  --e1:cubic-bezier(.25,.46,.45,.94);
  --e2:cubic-bezier(.16,1,.3,1);
  --e3:cubic-bezier(.34,1.56,.64,1);
  --r:4px;--r2:8px;--r3:12px;
  --nav:64px;
  --sidebar:240px;
  --shadow:0 4px 20px var(--shadow-light),0 2px 8px var(--shadow-medium);
  --shadow-gold:0 0 0 1px var(--border-light),0 4px 20px var(--shadow-light);
}

html,body{
  background:var(--bg);color:var(--t1);
  font-family:var(--font-text);font-weight:400;font-size:15px;line-height:1.6;
  overflow-x:clip;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
}
input,select,button,textarea{font-family:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
button{cursor:pointer;}
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--b1);border-radius:2px;}

/* ── NOISE TEXTURE ── */
.noise{
  position:fixed;inset:0;pointer-events:none;z-index:9;
  mix-blend-mode:soft-light;opacity:.18;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
}

/* ══ KEYFRAMES ══ */
@keyframes barSlide{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes slideInLeft{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
@keyframes slideInRight{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes popIn{0%{opacity:0;transform:scale(.2) rotate(-20deg)}60%{transform:scale(1.14) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(1.4)}}
@keyframes goldPulse{0%,100%{box-shadow:0 0 0 0 rgba(102,126,234,0)}50%{box-shadow:0 0 0 6px rgba(102,126,234,.12)}}
@keyframes winnerGlow{0%,100%{box-shadow:var(--shadow)}50%{box-shadow:0 0 40px rgba(102,126,234,.35),var(--shadow)}}
@keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes ripple{0%{transform:scale(0);opacity:.6}100%{transform:scale(4);opacity:0}}
@keyframes navPop{0%{transform:translateY(4px) scale(.9)}100%{transform:translateY(0) scale(1)}}
@keyframes drawerIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}

/* 🌟 New Light Animations */
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes glow{0%,100%{background:var(--bg-card);box-shadow:0 4px 20px var(--shadow-light)}50%{background:var(--accent-light);box-shadow:0 8px 32px rgba(102,126,234,.15)}}
@keyframes slideInFade{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:translateX(0)}}
@keyframes bounce{0%,100%{transform:translateY(0)}25%{transform:translateY(-5px)}50%{transform:translateY(0)}75%{transform:translateY(-2px)}}
@keyframes wave{0%{transform:rotate(0deg)}10%{transform:rotate(14deg)}20%{transform:rotate(-8deg)}30%{transform:rotate(14deg)}40%{transform:rotate(-4deg)}50%{transform:rotate(10deg)}60%{transform:rotate(0deg)}100%{transform:rotate(0deg)}}
@keyframes lightSweep{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes breathe{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.02);opacity:0.8}}

/* ── PAGE TRANSITION ── */
.page-enter{animation:scaleIn .32s var(--e2) both;}
.page-fade{animation:fadeIn .28s var(--e1) both;}

/* ═══════════════════════════════════════════
   LOADING
═══════════════════════════════════════════ */
.screen-loading{
  position:fixed;inset:0;background:var(--bg);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;z-index:200;
}
.loading-logo{font-family:var(--serif);font-size:40px;font-weight:300;letter-spacing:.08em;animation:fadeUp .9s var(--e2) both;}
.loading-logo em{color:var(--g1);font-style:italic;}
.loading-tagline{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--t5);animation:fadeUp .9s .18s var(--e2) both;}
.loading-bar{width:160px;height:1px;background:var(--b1);overflow:hidden;animation:fadeIn .5s .35s both;}
.loading-fill{height:100%;width:42%;background:linear-gradient(90deg,var(--g4),var(--g1),var(--g2));animation:barSlide 1.6s ease-in-out infinite;}

/* ═══════════════════════════════════════════
   AUTH
═══════════════════════════════════════════ */
.screen-auth{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;background:var(--bg);}
.auth-hero{
  background:var(--bg2);border-right:1px solid var(--b1);
  display:flex;flex-direction:column;justify-content:center;
  padding:72px 64px;position:relative;overflow:hidden;
}
.auth-hero::before{
  content:'';position:absolute;top:-180px;left:-180px;width:580px;height:580px;
  background:radial-gradient(circle,rgba(232,184,75,.07) 0%,transparent 65%);
  pointer-events:none;
}
.auth-hero::after{
  content:'';position:absolute;bottom:-140px;right:-120px;width:400px;height:400px;
  background:radial-gradient(circle,rgba(232,184,75,.04) 0%,transparent 65%);
  pointer-events:none;
}
.auth-hero-logo{font-family:var(--serif);font-size:19px;font-weight:300;letter-spacing:.08em;margin-bottom:52px;color:var(--t2);animation:fadeUp .7s var(--e2) both;}
.auth-hero-logo em{color:var(--g1);font-style:italic;}
.auth-hero h1{font-family:var(--serif);font-size:54px;font-weight:300;line-height:1.02;margin-bottom:18px;letter-spacing:-.01em;animation:fadeUp .7s .1s var(--e2) both;}
.auth-hero h1 em{color:var(--g1);font-style:italic;display:block;}
.auth-hero p{font-size:14px;color:var(--t3);line-height:1.9;max-width:320px;animation:fadeUp .7s .2s var(--e2) both;}
.auth-perks{margin-top:44px;display:flex;flex-direction:column;gap:13px;}
.auth-perk{display:flex;align-items:center;gap:12px;animation:slideInLeft .5s var(--e2) both;}
.auth-perk:nth-child(1){animation-delay:.25s}
.auth-perk:nth-child(2){animation-delay:.32s}
.auth-perk:nth-child(3){animation-delay:.39s}
.auth-perk:nth-child(4){animation-delay:.46s}
.auth-perk:nth-child(5){animation-delay:.53s}
.perk-line{width:18px;height:1px;background:var(--g1);flex-shrink:0;}
.perk-text{font-size:13px;color:var(--t2);}
.auth-badge{
  display:inline-flex;align-items:center;gap:7px;padding:6px 12px;
  background:var(--green-bg);border:1px solid var(--green-b);border-radius:20px;
  font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--green);margin-bottom:26px;
  animation:fadeUp .6s var(--e2) both;
}
.auth-badge-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 2.4s infinite;}
.auth-panel{display:flex;align-items:center;justify-content:center;padding:48px 44px;background:var(--bg);contain:layout style;}
.auth-box{width:100%;max-width:380px;transform:translateZ(0);}
.auth-tabs{
  display:flex;gap:2px;background:rgba(255,255,255,.04);padding:3px;
  margin-bottom:28px;border-radius:var(--r2);
}
.auth-tab{
  flex:1;padding:12px 14px;background:transparent;border:none;
  font-size:10px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--t5);cursor:pointer;border-radius:6px;
}
.auth-tab.active{background:var(--bg3);color:var(--t1);box-shadow:0 2px 8px rgba(183,148,246,.2);}
.auth-heading{font-family:var(--serif);font-size:30px;font-weight:300;margin-bottom:5px;color:var(--t1);}
.auth-sub{font-size:13px;color:var(--t4);margin-bottom:24px;line-height:1.65;}
.field{margin-bottom:14px;}
.field label{display:block;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--t4);margin-bottom:7px;font-weight:400;}
.field input,.field select,.field textarea{
  width:100%;background:rgba(255,255,255,.04);
  border:1.5px solid var(--b1);color:var(--t1);
  font-size:16px;padding:14px;outline:none;
  border-radius:var(--r2);-webkit-appearance:none;
  box-shadow:inset 0 1px 3px rgba(183,148,246,.1);
}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--b2);background:rgba(232,184,75,.025);}
.field input::placeholder,.field textarea::placeholder{color:var(--t5);}
.field select option{background:var(--bg3);}
.field-error{margin-top:5px;font-size:12px;color:var(--red);}
.btn-gold{
  display:flex;align-items:center;justify-content:center;gap:8px;
  width:100%;padding:16px;margin-top:6px;
  background:linear-gradient(135deg,var(--g2) 0%,var(--g1) 40%,var(--g3) 100%);
  border:none;border-radius:var(--r2);
  color:#120E00;font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;
  cursor:pointer;box-shadow:0 4px 20px rgba(232,184,75,.3);min-height:52px;
  position:relative;overflow:hidden;
}
.btn-gold::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.15),transparent);pointer-events:none;}
.btn-gold:active{transform:scale(.985);}
.btn-gold:disabled{opacity:.3;cursor:not-allowed;}
.auth-switch{text-align:center;margin-top:18px;font-size:13px;color:var(--t5);}
.auth-switch button{background:none;border:none;color:var(--g1);cursor:pointer;font-size:13px;text-decoration:underline;}
.auth-divider{display:flex;align-items:center;gap:10px;margin:20px 0;color:var(--t6);font-size:10px;letter-spacing:.12em;text-transform:uppercase;}
.auth-divider::before,.auth-divider::after{content:'';flex:1;height:1px;background:var(--b1);}

/* Mobile auth top */
.auth-mob-header{
  display:none;width:100%;flex-direction:column;align-items:center;
  padding:48px 28px 32px;text-align:center;
  background:linear-gradient(180deg,var(--bg2) 0%,var(--bg) 100%);
  border-bottom:1px solid var(--b1);
}
.auth-mob-logo{font-family:var(--serif);font-size:28px;font-weight:300;letter-spacing:.07em;color:var(--t1);margin-bottom:6px;}
.auth-mob-logo em{color:var(--g1);font-style:italic;}
.auth-mob-tag{font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:var(--t5);margin-bottom:22px;}
.auth-mob-perks{display:flex;flex-direction:column;gap:8px;width:100%;max-width:300px;}
.auth-mob-perk{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--t2);}
.auth-mob-perk-dot{width:4px;height:4px;border-radius:50%;background:var(--g1);flex-shrink:0;}

/* ═══════════════════════════════════════════
   SUBSCRIBE
═══════════════════════════════════════════ */
.screen-sub{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:52px 24px;background:var(--bg);}
.sub-logo{font-family:var(--serif);font-size:20px;font-weight:300;margin-bottom:44px;letter-spacing:.08em;animation:fadeUp .7s var(--e2) both;}
.sub-logo em{color:var(--g1);font-style:italic;}
.sub-headline{font-family:var(--serif);font-size:42px;font-weight:300;text-align:center;margin-bottom:12px;line-height:1.06;animation:fadeUp .7s .1s var(--e2) both;}
.sub-headline em{color:var(--g1);font-style:italic;}
.sub-desc{font-size:14px;color:var(--t3);text-align:center;max-width:420px;line-height:1.8;margin-bottom:36px;animation:fadeUp .7s .18s var(--e2) both;}
.plans{display:grid;grid-template-columns:1fr 1fr;gap:3px;width:100%;max-width:540px;background:var(--b1);margin-bottom:26px;border-radius:var(--r2);overflow:hidden;animation:scaleIn .6s .2s var(--e2) both;}
.plan{background:var(--bg2);padding:26px 22px;cursor:pointer;position:relative;border:2px solid transparent;}
.plan.active{background:rgba(232,184,75,.07);border-color:var(--b2);}
.plan-badge{display:inline-block;background:var(--g1);color:#120E00;font-size:8px;letter-spacing:.16em;text-transform:uppercase;padding:3px 8px;font-weight:700;margin-bottom:12px;border-radius:3px;}
.plan-label{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--t4);margin-bottom:8px;}
.plan-price{font-family:var(--serif);font-size:44px;font-weight:300;line-height:1;}
.plan-price sup{font-size:16px;color:var(--t4);vertical-align:super;}
.plan-price .dec{font-size:20px;color:var(--t4);}
.plan-cycle{font-size:11px;color:var(--t5);margin-top:5px;}
.plan-save{font-size:11px;color:var(--g1);margin-top:4px;}
.plan-tick{position:absolute;top:12px;right:14px;width:20px;height:20px;border-radius:50%;background:var(--g1);display:flex;align-items:center;justify-content:center;opacity:0;}
.plan.active .plan-tick{opacity:1;}
.sub-features{display:grid;grid-template-columns:1fr 1fr;gap:9px 22px;width:100%;max-width:540px;margin-bottom:22px;animation:fadeUp .6s .3s var(--e2) both;}
.sub-feat{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--t2);}
.feat-chk{width:16px;height:16px;flex-shrink:0;border-radius:50%;background:var(--green-bg);border:1px solid var(--green-b);display:flex;align-items:center;justify-content:center;}
.btn-sub{
  display:flex;align-items:center;justify-content:center;gap:8px;
  width:100%;max-width:540px;padding:17px;
  background:linear-gradient(135deg,var(--g2),var(--g1),var(--g3));
  border:none;border-radius:var(--r2);color:#120E00;
  font-size:11px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;
  cursor:pointer;margin-bottom:14px;
  box-shadow:0 4px 24px rgba(232,184,75,.28);
  animation:fadeUp .6s .35s var(--e2) both;
}
.btn-sub:active{transform:scale(.985);}
.btn-sub:disabled{opacity:.3;cursor:not-allowed;}
.sub-back{background:none;border:none;font-size:12px;color:var(--t5);cursor:pointer;letter-spacing:.12em;text-transform:uppercase;}
.sub-back:active{color:var(--red);}

/* ═══════════════════════════════════════════
   DASHBOARD SHELL
═══════════════════════════════════════════ */
.db{display:flex;min-height:100vh;background:var(--bg);}

/* Sidebar */
.sidebar{position:fixed;left:0;top:0;bottom:0;width:var(--sidebar);background:var(--bg2);border-right:1px solid var(--b1);display:flex;flex-direction:column;z-index:100;}
.sidebar.admin-mode{border-right-color:rgba(91,158,245,.22);}
.sb-brand{padding:26px 22px;border-bottom:1px solid var(--b1);}
.sb-brand-name{font-family:var(--serif);font-size:18px;font-weight:300;letter-spacing:.06em;}
.sb-brand-name em{color:var(--g1);font-style:italic;}
.sb-brand-sub{font-size:9px;letter-spacing:.28em;text-transform:uppercase;color:var(--t6);margin-top:3px;}
.sb-brand-sub.admin{color:var(--blue);}
.sb-nav{flex:1;padding:12px 0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;}
.sb-grp-label{font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:var(--t6);padding:0 22px;margin:14px 0 4px;}
.sb-link{
  display:flex;align-items:center;gap:10px;width:100%;
  padding:12px 22px;background:none;border:none;
  font-size:11px;letter-spacing:.07em;text-transform:uppercase;
  color:var(--t4);cursor:pointer;position:relative;text-align:left;
  transition:color .18s var(--e1);
}
.sb-link:hover{color:var(--t1);}
.sb-link.on{color:var(--g1);}
.sb-link.on::before{content:'';position:absolute;left:0;top:18%;bottom:18%;width:2px;background:var(--g1);border-radius:0 2px 2px 0;box-shadow:0 0 10px rgba(232,184,75,.6);}
.admin-mode .sb-link.on{color:var(--blue);}
.admin-mode .sb-link.on::before{background:var(--blue);box-shadow:0 0 10px rgba(91,158,245,.5);}
.sb-link svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.75;flex-shrink:0;}
.sb-footer{padding:14px 22px;border-top:1px solid var(--b1);}
.sb-user{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.sb-avatar{width:34px;height:34px;border-radius:50%;background:rgba(232,184,75,.1);border:1px solid var(--b1);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:13px;color:var(--g1);flex-shrink:0;}
.sb-avatar.admin-av{background:rgba(91,158,245,.1);border-color:rgba(91,158,245,.25);color:var(--blue);}
.sb-user-name{font-size:13px;color:var(--t1);font-weight:400;}
.sb-user-email{font-size:10px;color:var(--t5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;}
.sb-status{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;font-size:9px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:9px;border-radius:20px;}
.sb-status.active{background:var(--green-bg);border:1px solid var(--green-b);color:var(--green);}
.sb-status.inactive{background:var(--red-bg);border:1px solid var(--red-b);color:var(--red);}
.sb-status.admin-status{background:var(--blue-bg);border:1px solid var(--blue-b);color:var(--blue);}
.sb-status-dot{width:5px;height:5px;border-radius:50%;background:currentColor;}
.sb-status.active .sb-status-dot{animation:pulse 2s infinite;}
.sb-logout{display:flex;align-items:center;gap:7px;width:100%;background:none;border:none;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--t5);cursor:pointer;padding:3px 0;}
.sb-logout svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.5;}

/* Main content */
.main{margin-left:var(--sidebar);flex:1;display:flex;flex-direction:column;min-height:100vh;}
.topbar{
  padding:18px 36px;border-bottom:1px solid var(--b1);
  display:flex;align-items:center;justify-content:space-between;
  background:var(--bg-card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  position:sticky;top:0;z-index:50;
}
.topbar-title{font-family:var(--serif);font-size:22px;font-weight:300;}
.topbar-title em{color:var(--g1);font-style:italic;}
.topbar-right{display:flex;align-items:center;gap:16px;}
.topbar-meta{font-size:11px;color:var(--t5);letter-spacing:.07em;}
.topbar-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:9px;letter-spacing:.16em;text-transform:uppercase;}
.topbar-pill.admin-pill{background:var(--blue-bg);border:1px solid var(--blue-b);color:var(--blue);}
.content{padding:28px 36px;flex:1;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;}

/* ── Hamburger ── */
.mob-menu-btn{display:none;align-items:center;justify-content:center;width:38px;height:38px;background:rgba(232,184,75,.07);border:1px solid var(--b1);border-radius:var(--r);cursor:pointer;flex-shrink:0;}
.mob-menu-btn svg{width:18px;height:18px;stroke:var(--g1);fill:none;stroke-width:1.8;}

/* ── Mobile overlay + drawer ── */
.mob-overlay{position:fixed;inset:0;background:rgba(183,148,246,.3);z-index:200;opacity:0;pointer-events:none;transition:opacity .28s var(--e1);}
.mob-overlay.open{opacity:1;pointer-events:all;}
.mob-drawer{
  position:fixed;left:0;top:0;bottom:0;width:282px;
  background:var(--bg2);border-right:1px solid var(--b1);
  display:flex;flex-direction:column;z-index:201;
  transform:translateX(-100%);
  will-change:transform;
  transition:transform .3s var(--e2);
}
.mob-drawer.open{transform:translateX(0);}
.mob-drawer-head{padding:20px 18px 16px;border-bottom:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between;}
.mob-drawer-logo{font-family:var(--serif);font-size:18px;font-weight:300;letter-spacing:.06em;}
.mob-drawer-logo em{color:var(--g1);font-style:italic;}
.mob-drawer-close{width:32px;height:32px;background:rgba(255,255,255,.04);border:1px solid var(--b1);border-radius:var(--r);cursor:pointer;display:flex;align-items:center;justify-content:center;}
.mob-drawer-close svg{width:14px;height:14px;stroke:var(--t3);fill:none;stroke-width:2;}
.mob-drawer-nav{flex:1;padding:10px 0;overflow-y:auto;-webkit-overflow-scrolling:touch;}
.mob-drawer-user{padding:14px 18px;border-top:1px solid var(--b1);}
.mob-drawer-user-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}

/* ── Mobile bottom nav ── */
.mob-bottom-nav{
  display:none;position:fixed;bottom:0;left:0;right:0;
  height:var(--nav);
  background:var(--bg-card);
  backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
  border-top:1px solid var(--b1);z-index:150;
  padding:0 4px env(safe-area-inset-bottom);align-items:stretch;
  will-change:transform;
}
.mob-nav-item{
  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
  background:none;border:none;cursor:pointer;padding:6px 2px;min-width:0;
  position:relative;
}
.mob-nav-item svg{width:21px;height:21px;stroke:var(--t5);fill:none;stroke-width:1.6;flex-shrink:0;transition:stroke .18s var(--e1),transform .18s var(--e3);}
.mob-nav-item span{font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:var(--t5);white-space:nowrap;transition:color .18s var(--e1);}
.mob-nav-item.on svg{stroke:var(--g1);transform:translateY(-1px);}
.mob-nav-item.on span{color:var(--g1);}
.mob-nav-item.on::before{
  content:'';position:absolute;top:0;left:15%;right:15%;height:2px;
  background:linear-gradient(90deg,transparent,var(--g1),transparent);
  border-radius:0 0 3px 3px;
}

/* ═══════════════════════════════════════════
   CARDS - Enhanced with Animations
═══════════════════════════════════════════ */
.card{
  background:var(--bg-card);border:1px solid var(--border-light);
  padding:22px;border-radius:var(--r2);
  transition:all .3s var(--e2);
  position:relative;overflow:hidden;
}
.card::before{
  content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;
  background:linear-gradient(90deg,transparent,rgba(102,126,234,.1),transparent);
  transition:left 0.6s var(--e2);
}
.card:hover{
  border-color:var(--accent-primary);
  box-shadow:0 8px 32px rgba(102,126,234,.15);
  transform:translateY(-2px);
}
.card:hover::before{left:100%;}
.card-title{font-family:var(--serif);font-size:19px;font-weight:300;line-height:1.2;}
.card-title em{color:var(--g1);font-style:italic;}
.card-sub{font-size:12px;color:var(--t4);margin-top:3px;}
.card-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;gap:12px;}
.card-badge{font-size:9px;letter-spacing:.18em;text-transform:uppercase;padding:4px 9px;border:1px solid var(--b1);color:var(--t4);border-radius:20px;white-space:nowrap;flex-shrink:0;}
.card-badge.green{border-color:var(--green-b);color:var(--green);background:var(--green-bg);}
.card-badge.gold{border-color:rgba(232,184,75,.35);color:var(--g1);background:rgba(232,184,75,.06);}
.card-badge.red{border-color:var(--red-b);color:var(--red);background:var(--red-bg);}
.card-badge.blue{border-color:var(--blue-b);color:var(--blue);background:var(--blue-bg);}
.card-badge.amber{border-color:var(--amber-b);color:var(--amber);background:var(--amber-bg);}
.divider{height:1px;background:rgba(232,184,75,.08);margin:18px 0;}
.sec-label{font-size:9px;letter-spacing:.28em;text-transform:uppercase;color:var(--g1);display:flex;align-items:center;gap:8px;margin-bottom:12px;}
.sec-label::before{content:'';width:12px;height:1px;background:var(--g1);flex-shrink:0;}

/* ── GRIDS ── */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px;background:var(--b1);border-radius:var(--r);overflow:hidden;}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:var(--b1);margin-bottom:18px;border-radius:var(--r);overflow:hidden;}
.g4-3{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:var(--b1);border-radius:var(--r);overflow:hidden;}
.gwr{display:grid;grid-template-columns:1.35fr 1fr;gap:16px;}
.gwl{display:grid;grid-template-columns:1fr 1.35fr;gap:16px;}
.stack{display:flex;flex-direction:column;gap:16px;}

/* stat cells */
.stat-cell{background:var(--bg);padding:20px 18px;}
.stat-lbl{font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--t5);margin-bottom:9px;}
.stat-val{font-family:var(--serif);font-size:32px;font-weight:300;line-height:1;}
.stat-val.g{color:var(--g1);}
.stat-val.gr{color:var(--green);}
.stat-val.r{color:var(--red);}
.stat-val.b{color:var(--blue);}
.stat-note{font-size:11px;color:var(--t4);margin-top:5px;}
.mini-cell{background:var(--bg);padding:14px 12px;}
.mini-lbl{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--t5);margin-bottom:4px;}
.mini-val{font-family:var(--serif);font-size:20px;font-weight:300;color:var(--g1);}
.mini-val.w{color:var(--t1);}
.mini-val.gr{color:var(--green);}
.mini-val.r{color:var(--red);}

/* ═══════════════════════════════════════════
   SCORE INPUT — PREMIUM
═══════════════════════════════════════════ */
.score-wrap{background:var(--bg3);border:1px solid var(--b1);padding:22px;margin-bottom:16px;border-radius:var(--r2);}
.score-lbl{font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:var(--t5);text-align:center;margin-bottom:16px;font-weight:400;}
.stepper-row{display:flex;align-items:stretch;border:1.5px solid var(--b2);border-radius:var(--r2);overflow:hidden;margin-bottom:18px;background:var(--bg);}
.step-btn{
  width:58px;background:transparent;border:none;
  color:var(--g1);font-size:28px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;user-select:none;font-weight:300;line-height:1;
  min-height:72px;position:relative;overflow:hidden;
  touch-action:manipulation;
}
.step-btn::after{content:'';position:absolute;inset:0;background:rgba(232,184,75,.0);}
.step-btn:active:not(:disabled)::after{background:rgba(232,184,75,.15);}
.step-btn:disabled{opacity:.18;cursor:not-allowed;}
.score-center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 0;border-left:1px solid var(--b1);border-right:1px solid var(--b1);}
.score-num{
  font-family:var(--serif);font-size:54px;font-weight:300;color:var(--g1);line-height:1;
  background:transparent;border:none;outline:none;
  width:110px;text-align:center;-moz-appearance:textfield;
}
.score-num::-webkit-outer-spin-button,.score-num::-webkit-inner-spin-button{-webkit-appearance:none;}
.score-num::placeholder{color:rgba(232,184,75,.2);font-size:40px;}
.score-pts{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--t6);margin-top:2px;}
.score-range{
  width:100%;height:6px;appearance:none;
  background:rgba(232,184,75,.1);outline:none;cursor:pointer;
  border-radius:3px;margin-bottom:4px;
  touch-action:pan-x;
}
.score-range::-webkit-slider-thumb{
  -webkit-appearance:none;width:22px;height:22px;border-radius:50%;
  background:linear-gradient(135deg,var(--g2),var(--g1));cursor:pointer;
  box-shadow:0 2px 8px rgba(232,184,75,.4);
}
.score-range::-moz-range-thumb{width:22px;height:22px;border-radius:50%;border:none;background:var(--g1);cursor:pointer;}
.range-lbl{display:flex;justify-content:space-between;font-size:10px;color:var(--t6);margin-bottom:14px;}
.qp-row{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:14px;}
.qp-btn{
  padding:10px 0;background:var(--bg);border:1px solid var(--b1);
  border-radius:var(--r);color:var(--t4);font-size:14px;cursor:pointer;
  text-align:center;min-height:44px;position:relative;overflow:hidden;
}
.qp-btn::after{content:'';position:absolute;inset:0;background:rgba(232,184,75,0);}
.qp-btn:active::after{background:rgba(232,184,75,.12);}
.qp-btn.on{border-color:var(--g1);background:rgba(232,184,75,.08);color:var(--g1);}
.score-hint{font-size:11px;color:var(--t6);text-align:center;margin-bottom:12px;line-height:1.55;}
.locked-bar{padding:11px 14px;background:var(--red-bg);border:1px solid var(--red-b);border-radius:var(--r);font-size:12px;color:var(--red);margin-bottom:12px;}

/* ═══════════════════════════════════════════
   BUTTONS — PREMIUM
═══════════════════════════════════════════ */
.btn{
  display:flex;align-items:center;justify-content:center;gap:6px;
  padding:13px 20px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;
  cursor:pointer;border:none;font-weight:500;border-radius:var(--r2);
  min-height:44px;position:relative;overflow:hidden;
}
.btn::after{content:'';position:absolute;inset:0;background:rgba(255,255,255,0);pointer-events:none;}
.btn:active::after{background:rgba(255,255,255,.06);}
.btn-g{
  background:linear-gradient(135deg,var(--g2) 0%,var(--g1) 45%,var(--g3) 100%);
  color:#120E00;font-weight:700;
  box-shadow:0 3px 14px rgba(232,184,75,.22);
}
.btn-g:active{transform:scale(.98);}
.btn-g:disabled{opacity:.25;cursor:not-allowed;transform:none;box-shadow:none;}
.btn-o{background:transparent;border:1px solid var(--b2);color:var(--t2);}
.btn-o:active{background:rgba(232,184,75,.06);}
.btn-o:disabled{opacity:.25;cursor:not-allowed;}
.btn-d{background:var(--red-bg);border:1px solid var(--red-b);color:var(--red);}
.btn-d:active{background:rgba(224,85,85,.14);}
.btn-d:disabled{opacity:.25;cursor:not-allowed;}
.btn-b{background:var(--blue-bg);border:1px solid var(--blue-b);color:var(--blue);}
.btn-b:active{background:rgba(91,158,245,.14);}
.btn-b:disabled{opacity:.25;cursor:not-allowed;}
.btn-amber{background:var(--amber-bg);border:1px solid var(--amber-b);color:var(--amber);}
.btn-amber:active{background:rgba(245,166,35,.14);}
.btn-full{width:100%;}
.btn-sm{padding:9px 14px;font-size:9px;min-height:38px;}

/* ── SCORE ROWS ── */
.score-rows{display:flex;flex-direction:column;gap:4px;}
.score-row{display:flex;align-items:center;background:var(--bg);border:1px solid var(--b1);border-radius:var(--r2);animation:slideInLeft .35s var(--e2) both;overflow:hidden;}
.sc-rank{width:24px;text-align:center;font-size:9px;color:var(--t6);flex-shrink:0;padding-left:8px;}
.sc-num{font-family:var(--serif);font-size:28px;font-weight:300;color:var(--g1);padding:11px 10px;min-width:50px;text-align:center;border-right:1px solid var(--b1);flex-shrink:0;}
.sc-info{flex:1;padding:11px 10px;min-width:0;}
.sc-date{font-size:12px;color:var(--t2);font-weight:400;white-space:normal;word-break:break-word;line-height:1.3;}
.sc-tag{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--t6);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sc-right{display:flex;align-items:center;gap:4px;padding:11px 10px 11px 6px;flex-shrink:0;max-width:90px;}
.lvl-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;}
.lvl-name{font-size:8px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;}
.score-empty{text-align:center;padding:32px 16px;border:1px dashed rgba(232,184,75,.1);border-radius:var(--r2);}

/* ── DRAW / BALLS ── */
.balls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
.ball{
  width:56px;height:56px;border-radius:50%;
  border:1.5px solid var(--b1);
  display:flex;align-items:center;justify-content:center;
  font-family:var(--serif);font-size:20px;font-weight:300;color:var(--t6);
}
.ball.done{border-color:var(--g1);color:var(--g1);background:rgba(232,184,75,.07);box-shadow:0 0 18px rgba(232,184,75,.15);}
.ball.match{border-color:var(--green);color:var(--green);background:rgba(77,217,122,.08);box-shadow:0 0 18px rgba(77,217,122,.18);}
.ball.spin{animation:popIn .48s var(--e3);}
.result-box{padding:24px;border:1px solid var(--b1);text-align:center;border-radius:var(--r2);}
.result-box.jackpot{border-color:rgba(232,184,75,.5);background:rgba(232,184,75,.05);animation:winnerGlow 2s ease-in-out infinite;}
.result-box.win4{border-color:rgba(77,217,122,.42);background:rgba(77,217,122,.04);}
.result-box.win3{border-color:rgba(77,217,122,.24);background:rgba(77,217,122,.03);}
.result-emoji{font-size:32px;margin-bottom:6px;}
.result-title{font-family:var(--serif);font-size:24px;font-weight:300;}
.result-prize{font-family:var(--serif);font-size:44px;color:var(--g1);margin:8px 0 5px;}
.result-desc{font-size:12px;color:var(--t3);line-height:1.7;}
.result-pills{display:flex;justify-content:center;gap:5px;margin-top:12px;flex-wrap:wrap;}
.result-pill{padding:4px 9px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;border-radius:20px;}
.result-pill.y{background:var(--green-bg);border:1px solid var(--green-b);color:var(--green);}
.result-pill.n{background:var(--red-bg);border:1px solid var(--red-b);color:var(--red);}
.draw-locked{padding:14px 16px;background:var(--green-bg);border:1px solid var(--green-b);border-radius:var(--r2);display:flex;align-items:flex-start;gap:12px;}
.draw-locked-icon{font-size:18px;flex-shrink:0;margin-top:1px;}
.draw-locked-title{font-size:14px;color:var(--green);font-weight:400;margin-bottom:3px;}
.draw-locked-desc{font-size:12px;color:var(--t3);line-height:1.65;}
.draw-hist{display:flex;flex-direction:column;gap:2px;}
.dhr{display:flex;align-items:center;gap:8px;padding:11px 12px;background:var(--bg);border:1px solid var(--b1);border-radius:var(--r2);animation:slideInLeft .35s var(--e2) both;flex-wrap:wrap;}
.dhr-month{font-size:12px;color:var(--t3);min-width:86px;font-weight:400;}
.dhr-balls{display:flex;gap:3px;flex:1;}
.dhr-ball{width:26px;height:26px;border-radius:50%;border:1px solid var(--b1);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--t5);}
.dhr-ball.m{border-color:var(--green-b);background:var(--green-bg);color:var(--green);}
.dhr-match{font-size:11px;color:var(--t4);white-space:nowrap;}
.dhr-prize{font-family:var(--serif);font-size:17px;color:var(--g1);min-width:56px;text-align:right;white-space:nowrap;}
.dhr-status{font-size:8px;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:20px;}
.dhr-status.pending{background:var(--amber-bg);border:1px solid var(--amber-b);color:var(--amber);}
.dhr-status.paid{background:var(--green-bg);border:1px solid var(--green-b);color:var(--green);}
.dhr-status.no{background:transparent;border:1px solid var(--b1);color:var(--t6);}
.dhr-status.rejected{background:var(--red-bg);border:1px solid var(--red-b);color:var(--red);}

/* ── UPLOAD ── */
.upload-area{border:2px dashed var(--b2);border-radius:var(--r2);padding:28px;text-align:center;cursor:pointer;background:var(--bg);}
.upload-area.uploaded{border-color:var(--green-b);background:var(--green-bg);}
.upload-icon{font-size:28px;margin-bottom:10px;}
.upload-text{font-size:13px;color:var(--t3);}
.upload-sub{font-size:11px;color:var(--t5);margin-top:4px;}

/* ── CHARITY ── */
.ch-list{display:flex;flex-direction:column;gap:3px;margin-bottom:16px;}
.ch-item{display:flex;align-items:center;border:1px solid var(--b1);cursor:pointer;border-radius:var(--r2);}
.ch-item.sel{border-color:var(--b2);background:rgba(232,184,75,.05);}
.ch-radio{width:44px;height:56px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-right:1px solid var(--b1);}
.ch-ring{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--b1);display:flex;align-items:center;justify-content:center;}
.ch-item.sel .ch-ring{border-color:var(--g1);background:var(--g1);}
.ch-dot{width:6px;height:6px;border-radius:50%;background:var(--bg);opacity:0;}
.ch-item.sel .ch-dot{opacity:1;}
.ch-info{flex:1;padding:10px 14px;}
.ch-name{font-size:14px;color:var(--t1);font-weight:400;}
.ch-cat{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--t5);margin-top:2px;}
.ch-feat{font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;background:rgba(232,184,75,.08);border:1px solid var(--b1);color:var(--g1);border-radius:20px;flex-shrink:0;margin-right:12px;}
.pct-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.pct-txt{font-size:13px;color:var(--t2);}
.pct-num{font-family:var(--serif);font-size:30px;color:var(--g1);}
.pct-track{height:3px;background:rgba(232,184,75,.1);border-radius:2px;overflow:hidden;}
.pct-fill{height:100%;background:linear-gradient(90deg,var(--g4),var(--g1));transition:width .6s var(--e2);}
.ch-events{display:flex;flex-direction:column;gap:6px;}
.ch-event{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--t2);}
.ch-event-dot{width:4px;height:4px;border-radius:50%;background:var(--g1);flex-shrink:0;}

/* ── SUBSCRIPTION ── */
.ssbar{display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(232,184,75,.03);border:1px solid var(--b1);margin-bottom:14px;border-radius:var(--r2);}
.ssbar-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.ssbar-dot.on{background:var(--green);box-shadow:0 0 8px rgba(77,217,122,.5);animation:pulse 2s infinite;}
.ssbar-dot.off{background:var(--red);}
.ssbar-info{flex:1;}
.ssbar-title{font-size:14px;color:var(--t1);font-weight:400;}
.ssbar-detail{font-size:11px;color:var(--t4);margin-top:2px;}
.ssbar-plan{font-family:var(--serif);font-size:20px;color:var(--g1);}
.plan-opts{display:flex;gap:3px;background:var(--b1);margin-bottom:14px;border-radius:var(--r2);overflow:hidden;}
.plan-opt{flex:1;padding:15px 13px;background:var(--bg);cursor:pointer;position:relative;border:2px solid transparent;}
.plan-opt.on{background:rgba(232,184,75,.08);border-color:var(--b2);}
.po-label{font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:var(--t5);margin-bottom:6px;display:flex;align-items:center;gap:6px;}
.po-badge{background:var(--g1);color:#120E00;font-size:7px;letter-spacing:.1em;padding:2px 5px;font-weight:700;border-radius:3px;}
.po-price{font-family:var(--serif);font-size:26px;font-weight:300;}
.po-price sup{font-size:11px;color:var(--t5);vertical-align:super;}
.po-save{font-size:11px;color:var(--g1);margin-top:3px;}
.po-cycle{font-size:10px;color:var(--t5);margin-top:2px;}
.po-tick{position:absolute;top:10px;right:11px;font-size:13px;color:var(--g1);}
.feat-list{display:flex;flex-direction:column;}
.feat-row{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid rgba(232,184,75,.07);}
.feat-row:last-child{border-bottom:none;}
.feat-icon{width:18px;height:18px;border-radius:50%;flex-shrink:0;background:var(--green-bg);border:1px solid var(--green-b);display:flex;align-items:center;justify-content:center;margin-top:1px;}
.feat-text{font-size:13px;color:var(--t2);line-height:1.5;}

/* ── WIN HISTORY ── */
.win-row{display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:1px solid rgba(232,184,75,.07);flex-wrap:wrap;}
.win-row:last-child{border-bottom:none;}
.win-month{font-size:12px;color:var(--t3);min-width:68px;font-weight:400;}
.win-balls{display:flex;gap:3px;}
.win-ball{width:24px;height:24px;border-radius:50%;border:1px solid var(--b1);display:flex;align-items:center;justify-content:center;font-size:8px;color:var(--t5);}
.win-ball.m{border-color:var(--green-b);background:var(--green-bg);color:var(--green);}
.win-match{font-size:11px;color:var(--t4);white-space:nowrap;}
.win-prize{font-family:var(--serif);font-size:17px;color:var(--g1);margin-left:auto;white-space:nowrap;}
.win-status{font-size:8px;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:20px;flex-shrink:0;}
.win-status.paid{background:var(--green-bg);border:1px solid var(--green-b);color:var(--green);}
.win-status.pending{background:var(--amber-bg);border:1px solid var(--amber-b);color:var(--amber);}
.win-status.no{background:transparent;border:1px solid var(--b1);color:var(--t6);}
.win-status.rejected{background:var(--red-bg);border:1px solid var(--red-b);color:var(--red);}

/* ═══════════════════════════════════════════
   SETTINGS — PREMIUM REDESIGN
═══════════════════════════════════════════ */
.settings-wrap{display:flex;flex-direction:column;gap:18px;width:100%;}
.set-section-card{background:var(--bg2);border:1px solid var(--b1);border-radius:var(--r2);overflow:hidden;width:100%;}
.set-section-header{padding:16px 20px;border-bottom:1px solid var(--b1);display:flex;align-items:center;gap:12px;}
.set-section-icon{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.set-section-icon.gold{background:rgba(232,184,75,.1);border:1px solid rgba(232,184,75,.2);}
.set-section-icon.green{background:var(--green-bg);border:1px solid var(--green-b);}
.set-section-icon.red{background:var(--red-bg);border:1px solid var(--red-b);}
.set-section-icon.blue{background:var(--blue-bg);border:1px solid var(--blue-b);}
.set-section-icon svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;}
.set-section-icon.gold svg{color:var(--g1);}
.set-section-icon.green svg{color:var(--green);}
.set-section-icon.red svg{color:var(--red);}
.set-section-icon.blue svg{color:var(--blue);}
.set-section-label{font-size:13px;font-weight:500;color:var(--t1);}
.set-section-sub{font-size:11px;color:var(--t5);margin-top:2px;}
.set-body{padding:18px 20px;display:flex;flex-direction:column;gap:16px;}
.set-field-row{display:flex;flex-direction:column;gap:7px;width:100%;}
.set-field-row label{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--t4);font-weight:400;}
.set-field-input-row{display:flex;gap:10px;align-items:center;width:100%;}
.set-field-input-row .field-input{flex:1;min-width:0;background:rgba(255,255,255,.04);border:1.5px solid var(--b1);color:var(--t1);font-size:15px;padding:12px 14px;outline:none;border-radius:var(--r2);-webkit-appearance:none;box-shadow:inset 0 1px 3px rgba(183,148,246,.1);}
.set-field-input-row .field-input:focus{border-color:var(--b2);}
.set-field-input-row .field-input::placeholder{color:var(--t5);}
.set-field-input-row .btn{flex-shrink:0;white-space:nowrap;}
.set-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid rgba(232,184,75,.07);}
.set-toggle-row:last-child{border-bottom:none;}
.set-toggle-info{flex:1;min-width:0;}
.set-toggle-title{font-size:14px;color:var(--t1);font-weight:400;}
.set-toggle-desc{font-size:12px;color:var(--t4);margin-top:3px;line-height:1.5;}
.set-toggle-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:500;cursor:pointer;flex-shrink:0;}
.set-toggle-pill.on{background:var(--green-bg);border:1px solid var(--green-b);color:var(--green);}
.set-danger-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid rgba(232,184,75,.07);}
.set-danger-row:last-child{border-bottom:none;}
.set-danger-info{flex:1;min-width:0;}
.set-danger-title{font-size:14px;font-weight:400;}
.set-danger-desc{font-size:12px;color:var(--t4);margin-top:3px;line-height:1.5;}
.set-profile-bar{display:flex;align-items:center;gap:16px;padding:20px;border-bottom:1px solid var(--b1);}
.set-avatar-lg{width:52px;height:52px;border-radius:50%;background:rgba(232,184,75,.1);border:1px solid var(--b1);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:20px;color:var(--g1);flex-shrink:0;}
.set-profile-name{font-size:16px;color:var(--t1);font-weight:400;}
.set-profile-email{font-size:12px;color:var(--t4);margin-top:3px;word-break:break-all;}
.set-profile-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;background:var(--green-bg);border:1px solid var(--green-b);color:var(--green);font-size:9px;letter-spacing:.14em;text-transform:uppercase;border-radius:20px;margin-top:6px;}

/* ─ MODAL bottom sheet ─ */
.overlay{position:fixed;inset:0;background:rgba(183,148,246,.4);z-index:500;display:flex;align-items:flex-end;justify-content:center;padding:0;}
.modal{
  background:var(--bg2);border:1px solid var(--b1);border-bottom:none;
  padding:28px 24px 36px;width:100%;max-width:100%;
  border-radius:var(--r3) var(--r3) 0 0;
  will-change:transform;
}
.modal.wide{max-width:100%;}
.modal-title{font-family:var(--serif);font-size:22px;font-weight:300;margin-bottom:8px;}
.modal-title em{color:var(--g1);font-style:italic;}
.modal-desc{font-size:13px;color:var(--t3);line-height:1.75;margin-bottom:16px;}
.modal-warn{padding:10px 14px;background:var(--red-bg);border:1px solid var(--red-b);border-radius:var(--r2);font-size:12px;color:var(--red);margin-bottom:14px;line-height:1.65;}
.modal-btns{display:flex;gap:10px;}
.modal-btns .btn{flex:1;}

/* ── INDEPENDENT DONATION ── */
.donate-card{background:linear-gradient(135deg,rgba(232,184,75,.06),rgba(232,184,75,.02));border:1px solid var(--b2);border-radius:var(--r2);padding:20px;}
.donate-amounts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}
.donate-amt{padding:10px 0;background:var(--bg);border:1.5px solid var(--b1);border-radius:var(--r2);font-family:var(--serif);font-size:16px;color:var(--t3);text-align:center;cursor:pointer;transition:border-color .15s,color .15s;}
.donate-amt:hover{border-color:var(--b2);color:var(--t1);}
.donate-amt.on{border-color:var(--g1);background:rgba(232,184,75,.08);color:var(--g1);}
.donate-custom{display:flex;align-items:center;gap:8px;margin-bottom:14px;}
.donate-custom-input{flex:1;background:rgba(255,255,255,.04);border:1.5px solid var(--b1);color:var(--t1);font-size:16px;padding:11px 14px;outline:none;border-radius:var(--r2);-webkit-appearance:none;}
.donate-custom-input:focus{border-color:var(--b2);}
.donate-custom-prefix{font-family:var(--serif);font-size:22px;color:var(--g1);}
.donate-history{display:flex;flex-direction:column;gap:4px;margin-top:12px;}
.donate-hist-row{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--bg);border:1px solid var(--b1);border-radius:var(--r2);font-size:12px;}
.donate-hist-charity{color:var(--t3);}
.donate-hist-amount{font-family:var(--serif);font-size:16px;color:var(--g1);}
.donate-hist-date{font-size:10px;color:var(--t6);}

.info-box{padding:12px 15px;background:var(--bg3);border:1px solid var(--b1);border-radius:var(--r2);font-size:13px;color:var(--t2);line-height:1.7;}
.info-box.warn{border-color:rgba(232,184,75,.28);background:rgba(232,184,75,.04);}
.info-box.green{border-color:var(--green-b);background:var(--green-bg);}
.info-box.red{border-color:var(--red-b);background:var(--red-bg);color:var(--red);}
.info-box.blue{border-color:var(--blue-b);background:var(--blue-bg);}
.info-box strong{color:var(--t1);font-weight:500;}

/* ── TOAST ── */
.toasts{position:fixed;top:16px;right:14px;left:14px;z-index:9000;display:flex;flex-direction:column;gap:7px;pointer-events:none;}
.toast{
  display:flex;align-items:center;gap:9px;padding:13px 15px;
  background:var(--bg4);border:1px solid var(--b1);
  font-size:13px;color:var(--t1);
  box-shadow:0 12px 40px rgba(183,148,246,.15),0 2px 8px rgba(183,148,246,.1);
  border-radius:var(--r2);
  animation:fadeDown .3s var(--e2) both;
  backdrop-filter:blur(16px);
}
.toast.ok{border-color:var(--green-b);}
.toast.err{border-color:var(--red-b);}
.toast.gold{border-color:rgba(232,184,75,.45);}
.toast-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.toast.ok .toast-dot{background:var(--green);}
.toast.err .toast-dot{background:var(--red);}
.toast.gold .toast-dot{background:var(--g1);}

/* ── ADMIN ── */
.admin-table{width:100%;border-collapse:collapse;}
.admin-table th{font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--t5);padding:10px 14px;text-align:left;border-bottom:1px solid var(--b1);font-weight:400;}
.admin-table td{padding:12px 14px;border-bottom:1px solid rgba(232,184,75,.06);font-size:13px;color:var(--t2);vertical-align:middle;}
.admin-table tr:last-child td{border-bottom:none;}
.admin-table .td-mono{font-family:var(--serif);font-size:15px;color:var(--g1);}
.admin-table .td-email{color:var(--t3);font-size:12px;}
.admin-table .td-action{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.admin-panel-card{background:var(--bg2);border:1px solid var(--b1);border-radius:var(--r2);overflow:hidden;}
.admin-panel-head{padding:16px 18px;border-bottom:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between;}
.admin-panel-title{font-family:var(--serif);font-size:17px;font-weight:300;}
.admin-panel-title em{color:var(--g1);font-style:italic;}
.sim-controls{display:flex;flex-direction:column;gap:12px;padding:16px;background:var(--bg3);border:1px solid var(--b1);border-radius:var(--r2);margin-bottom:14px;}
.sim-label{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--t4);margin-bottom:6px;}
.sim-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.sim-tag{display:inline-flex;align-items:center;padding:3px 8px;background:var(--blue-bg);border:1px solid var(--blue-b);border-radius:20px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--blue);}
.winner-card{padding:16px;background:var(--bg3);border:1px solid var(--b1);border-radius:var(--r2);margin-bottom:8px;}
.winner-card.win-jackpot{border-left:3px solid var(--g1);}
.winner-card.win-4{border-left:3px solid var(--green);}
.winner-card.win-3{border-left:3px solid var(--blue);}
.winner-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap;}
.winner-email{font-size:13px;color:var(--t1);font-weight:400;word-break:break-all;}
.winner-prize{font-family:var(--serif);font-size:22px;color:var(--g1);flex-shrink:0;}
.winner-meta{font-size:11px;color:var(--t4);}
.winner-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;}
.proof-thumb{width:100%;padding:10px;background:var(--bg);border:1px solid var(--b1);border-radius:var(--r2);font-size:12px;color:var(--blue);display:flex;align-items:center;gap:8px;margin-top:8px;}
.charity-admin-row{display:flex;align-items:flex-start;gap:10px;padding:14px;background:var(--bg);border:1px solid var(--b1);border-radius:var(--r2);margin-bottom:3px;flex-wrap:wrap;}
.analytics-bar{height:5px;background:var(--b1);border-radius:3px;overflow:hidden;margin-top:6px;}
.analytics-fill{height:100%;background:linear-gradient(90deg,var(--g4),var(--g1));border-radius:3px;}
.table-controls{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
.search-input{flex:1;background:var(--bg3);border:1px solid var(--b1);color:var(--t1);font-size:14px;padding:11px 14px;outline:none;border-radius:var(--r2);-webkit-appearance:none;}
.search-input:focus{border-color:var(--b2);}
.search-input::placeholder{color:var(--t6);}

/* ═══════════════════════════════════════════
   RESPONSIVE — MOBILE FIRST
═══════════════════════════════════════════ */

/* ── 1120px: Large tablet ── */
@media(max-width:1120px){
  .g2,.gwr,.gwl{grid-template-columns:1fr;}
  .g4{grid-template-columns:1fr 1fr;}
  .g4-3{grid-template-columns:1fr 1fr;}
  .content{padding:22px 28px;}
}

/* ── 860px: Tablet — sidebar hidden ── */
@media(max-width:860px){
  .sidebar{display:none;}
  .main{margin-left:0;}
  .content{padding:18px 18px 24px;}
  .topbar{padding:13px 16px;}
  .topbar-meta{display:none;}
  .mob-menu-btn{display:flex;}
  /* Auth mobile */
  .screen-auth{grid-template-columns:1fr;min-height:100vh;}
  .auth-hero{display:none;}
  .auth-panel{display:block;padding:0;background:var(--bg);min-height:100vh;width:100%;contain:none;}
  .auth-mob-header{display:flex;}
  .auth-box{max-width:100%;width:100%;padding:28px 24px 64px;box-sizing:border-box;transform:none;}
  /* Modals become bottom sheets */
  .overlay{align-items:flex-end;padding:0;}
  .modal{max-width:100%;border-radius:20px 20px 0 0;border-bottom:none;padding:28px 22px 40px;}
  .modal.wide{max-width:100%;}
  /* Settings */
  .set-field-input-row{flex-direction:column;}
  .set-field-input-row .btn{width:100%;}
  /* Grids single column on tablet */
  .g2,.gwr,.gwl{grid-template-columns:1fr;}
  .stack{gap:14px;}
}

/* ── 640px: Mobile ── */
@media(max-width:640px){
  :root{--nav:62px;}

  /* Layout */
  .content{padding:14px 14px 20px;}
  .topbar{padding:12px 14px;}
  .topbar-title{font-size:17px;}
  .mob-bottom-nav{display:flex;}
  .main{padding-bottom:calc(var(--nav) + 8px);}

  /* Cards — generous breathing room */
  .card{padding:16px 14px;border-radius:var(--r2);}
  .card-head{margin-bottom:14px;}
  .card-title{font-size:17px;}
  .card-sub{font-size:11px;}
  .divider{margin:14px 0;}
  .sec-label{font-size:8px;margin-bottom:10px;}

  /* Grids */
  .g2,.gwr,.gwl{grid-template-columns:1fr;gap:12px;}
  .g3{grid-template-columns:repeat(3,1fr);}
  .g4,.g4-3{grid-template-columns:1fr 1fr;}
  .stack{gap:12px;}

  /* Stat cells */
  .stat-cell{padding:14px 12px;}
  .stat-lbl{font-size:8px;letter-spacing:.18em;margin-bottom:7px;}
  .stat-val{font-size:22px;}
  .stat-note{font-size:10px;margin-top:4px;}
  .mini-cell{padding:12px 10px;}
  .mini-lbl{font-size:8px;}
  .mini-val{font-size:16px;}

  /* Score input */
  .score-wrap{padding:16px 14px;margin-bottom:14px;}
  .score-lbl{font-size:9px;margin-bottom:14px;}
  .stepper-row{margin-bottom:16px;}
  .step-btn{width:52px;min-height:70px;font-size:26px;}
  .score-num{font-size:46px;width:96px;}
  .score-pts{font-size:8px;}
  .score-range{height:8px;margin-bottom:6px;}
  .range-lbl{font-size:10px;margin-bottom:12px;}
  .qp-row{grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px;}
  .qp-btn{padding:10px 0;font-size:13px;min-height:44px;}

  /* Score rows */
  .sc-rank{width:20px;font-size:8px;}
  .sc-num{font-size:20px;padding:10px 8px;min-width:42px;}
  .sc-info{padding:10px 8px;}
  .sc-date{font-size:11px;}
  .sc-tag{font-size:8px;}
  .sc-right{padding:10px 8px 10px 4px;max-width:80px;}
  .lvl-name{font-size:7px;letter-spacing:.08em;}
  .lvl-dot{width:4px;height:4px;}

  /* Draw balls */
  .balls{gap:7px;flex-wrap:wrap;justify-content:center;}
  .ball{width:50px;height:50px;font-size:17px;}

  /* Charity */
  .ch-item{border-radius:var(--r2);}
  .ch-radio{width:40px;height:54px;}
  .ch-name{font-size:13px;}
  .ch-cat{font-size:9px;}
  .donate-amounts{grid-template-columns:repeat(4,1fr);gap:7px;}
  .donate-amt{padding:11px 0;font-size:15px;}

  /* Buttons */
  .btn{padding:13px 16px;font-size:10px;min-height:46px;}
  .btn-sm{padding:10px 12px;font-size:9px;min-height:40px;}

  /* Toasts */
  .toasts{top:10px;right:10px;left:10px;}
  .toast{font-size:12px;padding:11px 13px;gap:8px;}

  /* Auth */
  .auth-mob-header{padding:40px 24px 28px;}
  .auth-mob-logo{font-size:26px;}
  .auth-mob-tag{font-size:10px;margin-bottom:18px;}
  .auth-mob-perks{gap:8px;}
  .auth-mob-perk{font-size:12px;}
  .auth-box{padding:24px 20px 48px;}
  .auth-heading{font-size:26px;}
  .auth-sub{font-size:12px;margin-bottom:20px;}
  .auth-tabs{margin-bottom:24px;}
  .auth-tab{padding:12px 10px;font-size:9px;}
  .field{margin-bottom:16px;}
  .field input{padding:14px;}
  .btn-gold{padding:16px;font-size:11px;min-height:52px;}

  /* Subscribe screen */
  .screen-sub{padding:32px 16px 48px;}
  .sub-logo{margin-bottom:28px;font-size:18px;}
  .sub-headline{font-size:26px;}
  .sub-desc{font-size:13px;margin-bottom:28px;}
  .plans{grid-template-columns:1fr 1fr;gap:2px;}
  .plan{padding:18px 14px;}
  .plan-price{font-size:34px;}
  .plan-badge{font-size:7px;}
  .sub-features{grid-template-columns:1fr;gap:7px;margin-bottom:20px;}
  .sub-feat{font-size:12px;}
  .btn-sub{padding:16px;font-size:10px;min-height:52px;}

  /* Settings */
  .settings-wrap{gap:12px;}
  .set-section-card{border-radius:var(--r2);}
  .set-section-header{padding:14px 16px;gap:10px;}
  .set-section-icon{width:30px;height:30px;border-radius:6px;}
  .set-section-icon svg{width:13px;height:13px;}
  .set-section-label{font-size:12px;}
  .set-section-sub{font-size:10px;}
  .set-body{padding:14px 16px;gap:14px;}
  .set-profile-bar{padding:16px;gap:12px;}
  .set-avatar-lg{width:44px;height:44px;font-size:17px;}
  .set-profile-name{font-size:14px;}
  .set-profile-email{font-size:11px;}
  .set-toggle-row{padding:12px 0;gap:10px;}
  .set-toggle-title{font-size:13px;}
  .set-toggle-desc{font-size:11px;}
  .set-danger-row{flex-direction:column;align-items:flex-start;gap:10px;padding:12px 0;}
  .set-danger-row .btn{width:100%;justify-content:center;}
  .set-danger-title{font-size:13px;}

  /* Subscription plan opts */
  .plan-opts{flex-direction:column;}
  .plan-opt{border-radius:var(--r);}

  /* Draw history rows */
  .dhr{flex-direction:column;align-items:flex-start;gap:6px;padding:12px;}
  .dhr-month{min-width:unset;font-size:11px;}
  .dhr-balls{flex-wrap:wrap;}
  .dhr-prize{font-size:16px;}

  /* Win history rows */
  .win-row{flex-wrap:wrap;gap:6px;padding:12px 0;}
  .win-prize{margin-left:0;font-size:16px;}
  .win-month{font-size:11px;}

  /* Admin */
  .admin-panel-card{overflow-x:auto;}
  .admin-table{min-width:480px;}
  .charity-admin-row{flex-direction:column;align-items:flex-start;}
  .winner-actions{flex-direction:column;}
  .winner-actions .btn{width:100%;}

  /* Modal */
  .modal{padding:22px 18px 38px;}
  .modal-title{font-size:20px;}
  .modal-desc{font-size:12px;}
}

/* ── 390px: Very small phones ── */
@media(max-width:390px){
  .content{padding:10px 10px 16px;}
  .card{padding:14px 12px;}
  .topbar-title{font-size:16px;}
  .stat-val{font-size:20px;}
  .stat-cell{padding:12px 10px;}
  .mini-val{font-size:15px;}
  .mini-cell{padding:10px 8px;}
  .ball{width:44px;height:44px;font-size:15px;}
  .balls{gap:5px;}
  .step-btn{width:46px;font-size:24px;}
  .score-num{font-size:40px;width:84px;}
  .qp-btn{font-size:12px;}
  .sub-headline{font-size:22px;}
  .plan-price{font-size:28px;}
  .plans{grid-template-columns:1fr;}
  .donate-amounts{grid-template-columns:repeat(2,1fr);gap:8px;}
  .donate-amt{padding:13px 0;}
  .set-section-header{padding:12px 14px;}
  .set-body{padding:12px 14px;}
  .set-profile-bar{padding:12px 14px;}
  .auth-box{padding:20px 16px 48px;}
  .auth-mob-header{padding:32px 18px 24px;}
}
`

// ─── Sound Engine ─────────────────────────────────────────────────────────────
const SFX = (() => {
  let ctx: AudioContext | null = null
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    return ctx
  }
  const tone = (freq: number, dur: number, vol = 0.18, type: OscillatorType = "sine", decay = 0.8) => {
    try {
      const c = getCtx()
      const o = c.createOscillator()
      const g = c.createGain()
      o.connect(g); g.connect(c.destination)
      o.frequency.setValueAtTime(freq, c.currentTime)
      o.type = type
      g.gain.setValueAtTime(vol, c.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur)
      o.start(c.currentTime); o.stop(c.currentTime + dur)
    } catch {}
  }
  const chord = (freqs: number[], dur: number, vol = 0.12) => freqs.forEach(f => tone(f, dur, vol))
  return {
    tick:    () => { tone(600, 0.06, 0.1, "sine"); tone(900, 0.04, 0.05, "sine") },
    select:  () => { tone(440, 0.08, 0.14, "sine"); setTimeout(() => tone(660, 0.1, 0.1, "sine"), 40) },
    confirm: () => chord([330, 415, 523], 0.18, 0.1),
    log:     () => { tone(523, 0.1, 0.15, "sine"); setTimeout(() => tone(659, 0.14, 0.12, "sine"), 80); setTimeout(() => tone(784, 0.2, 0.1, "sine"), 160) },
    nav:     () => tone(380, 0.07, 0.08, "sine"),
    win:     () => {
      const seq = [[523,659,784],[587,740,880],[659,830,987]]
      seq.forEach(([a,b,c], i) => setTimeout(() => chord([a,b,c], 0.22, 0.08), i * 120))
    },
    jackpot: () => {
      const seq = [523,659,784,1047,1319]
      seq.forEach((f, i) => setTimeout(() => tone(f, 0.3, 0.14, "sine"), i * 90))
      setTimeout(() => chord([523,659,784,1047], 0.5, 0.1), seq.length * 90)
    },
    lose:    () => { tone(300, 0.2, 0.12, "sine"); setTimeout(() => tone(220, 0.3, 0.1, "sine"), 150) },
    drawer:  () => tone(280, 0.09, 0.06, "sine"),
  }
})()

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreInput({
  subscribed,
  onAdd,
  saving,
}: {
  subscribed: boolean
  onAdd: (v: number) => void
  saving: boolean
}) {
  const [val, setVal] = useState<number | null>(null)
  const clamp = (n: number) => Math.min(45, Math.max(1, Math.round(n)))
  const effective = val ?? 1

  return (
    <div className="score-wrap">
      <div className="score-lbl">Enter Stableford Score · 1 – 45 Points</div>
      <div className="stepper-row">
        <button className="step-btn" onClick={() => { setVal(clamp(effective - 1)); SFX.tick() }} disabled={!subscribed || effective <= 1}>
          −
        </button>
        <div className="score-center">
          <input
            type="number"
            className="score-num"
            value={val === null ? "" : val}
            placeholder="—"
            min={1}
            max={45}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === "") { setVal(null); return }
              const n = parseInt(raw, 10)
              if (!isNaN(n) && n >= 1 && n <= 45) setVal(n)
            }}
            onBlur={(e) => {
              const n = parseInt(e.target.value, 10)
              if (e.target.value === "" || isNaN(n)) setVal(null)
              else setVal(clamp(n))
            }}
          />
          <span className="score-pts">stableford points</span>
        </div>
        <button className="step-btn" onClick={() => { setVal(clamp(effective + 1)); SFX.tick() }} disabled={!subscribed || effective >= 45}>
          +
        </button>
      </div>
      <input
        type="range"
        className="score-range"
        min={1}
        max={45}
        step={1}
        value={val ?? 1}
        onChange={(e) => setVal(parseInt(e.target.value, 10))}
      />
      <div className="range-lbl">
        <span>1 pt</span>
        <span>45 pts</span>
      </div>
      <div style={{ fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--t6)", marginBottom: 7 }}>
        Quick Select
      </div>
      <div className="qp-row">
        {QP.map((q) => (
          <button key={q} className={`qp-btn${val === q ? " on" : ""}`} onClick={() => { setVal(q); SFX.select() }}>
            {q}
          </button>
        ))}
      </div>
      <p className="score-hint">Keeps your 5 most recent scores · Oldest auto-removed when full</p>
      {!subscribed && (
        <div className="locked-bar">⚠ Active subscription required to log scores</div>
      )}
      <button
        className="btn btn-g btn-full"
        disabled={!subscribed || saving || val === null}
        onClick={() => { if (val !== null) { SFX.log(); onAdd(val) } }}
      >
        {saving ? "Saving…" : val !== null ? `Log ${val} Points →` : "Select a score above"}
      </button>
    </div>
  )
}

function ScoreRows({ scores }: { scores: Score[] }) {
  if (!scores.length)
    return (
      <div className="score-empty">
        <p
          style={{
            fontFamily: "var(--serif)",
            fontSize: 30,
            color: "rgba(232,184,75,.12)",
            marginBottom: 7,
          }}
        >
          ◇
        </p>
        <p style={{ fontSize: 13, color: "var(--t5)" }}>No scores logged yet</p>
      </div>
    )
  return (
    <div className="score-rows">
      {scores.map((s, i) => {
        const l = lvl(s.score)
        return (
          <div
            className="score-row"
            key={s.id}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="sc-rank">#{i + 1}</div>
            <div className="sc-num">{s.score}</div>
            <div className="sc-info">
              <div className="sc-date">{fmtDate(s.date)}</div>
              <div className="sc-tag">Stableford · Round {scores.length - i}</div>
            </div>
            <div className="sc-right">
              <div className="lvl-dot" style={{ background: l.color }} />
              <div className="lvl-name" style={{ color: l.color }}>
                {l.label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function GolfPlatform() {
  const [view, setView] = useState<AppView>("loading")
  const [authMode, setAuthMode] = useState<AuthMode>("login")
  const [section, setSection] = useState<NavSection>("overview")
  const [adminSection, setAdminSection] = useState<AdminSection>("admin-overview")
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Auth
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authErr, setAuthErr] = useState("")
  const [authBusy, setAuthBusy] = useState(false)

  // Subscription
  const [subscribed, setSubscribed] = useState(false)
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly")
  const [subRenewal, setSubRenewal] = useState<string>("")

  // Scores
  const [scores, setScores] = useState<Score[]>([])
  const [savingScore, setSavingScore] = useState(false)

  // Charity
  const [charityIdx, setCharityIdx] = useState(0)
  const [charityPct, setCharityPct] = useState(15)
  const [allTimeDonated, setAllTimeDonated] = useState(18.5)

  // Draw
  const [balls, setBalls] = useState<Ball[]>(Array(5).fill({ num: null, state: "idle" }))
  const [drawResult, setDrawResult] = useState<{
    matches: number
    prize: number
    nums: number[]
    matched: number[]
  } | null>(null)
  const [drawRunning, setDrawRunning] = useState(false)
  const [drawHistory, setDrawHistory] = useState<DrawRecord[]>([])

  // In-app wallet (simulated, no real money)
  const [walletBalance, setWalletBalance] = useState(0)

  // Independent donations
  const [donations, setDonations] = useState<{id:string;charity:string;amount:number;date:string}[]>([])

  const loadDonations = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("donations")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(10)
    if (data) setDonations(data.map((d: any) => ({
      id: d.id, charity: d.charity_name, amount: d.amount,
      date: new Date(d.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })
    })))
  }, [])

  // Proof upload
  const [showProofModal, setShowProofModal] = useState(false)
  const [proofDrawId, setProofDrawId] = useState<string | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofSubmitting, setProofSubmitting] = useState(false)

  // Settings
  const [showClearModal, setShowClearModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [settingsEmail, setSettingsEmail] = useState("")
  const [settingsPwd, setSettingsPwd] = useState("")
  const [settingsBusy, setSettingsBusy] = useState(false)

  // Admin state
  const [adminUsers, setAdminUsers] = useState<SubRecord[]>([])
  const [adminWinners, setAdminWinners] = useState<DrawRecord[]>([])
  const [adminCharities, setAdminCharities] = useState<CharityProfile[]>([...CHARITIES])
  const [adminSearch, setAdminSearch] = useState("")
  const [adminDrawMonth, setAdminDrawMonth] = useState(CURRENT_MONTH)
  const [adminSimResult, setAdminSimResult] = useState<{
    nums: number[]
    simulatedWinners: number
  } | null>(null)
  const [adminDrawPublished, setAdminDrawPublished] = useState(false)
  const [newCharity, setNewCharity] = useState({ name: "", cat: "", description: "" })
  const [showAddCharity, setShowAddCharity] = useState(false)
  const [editCharity, setEditCharity] = useState<CharityProfile | null>(null)
  const [jackpotRolledOver, setJackpotRolledOver] = useState(false)

  // Mobile nav
  const [mobDrawerOpen, setMobDrawerOpen] = useState(false)

  const [toasts, setToasts] = useState<ToastItem[]>([])
  const toastId = useRef(0)

  const toast = useCallback((msg: string, type: ToastItem["type"] = "ok") => {
    const id = ++toastId.current
    setToasts((p) => [...p, { id, msg, type }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4200)
  }, [])

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadScores = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("scores")
      .select("*")
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .limit(5)
    setScores(data || [])
  }, [])

  const loadDrawHistory = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("draws")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
    setDrawHistory(data || [])
  }, [])

  const loadSub = useCallback(async (uid: string): Promise<boolean> => {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", uid)
      .in("status", ["active", "lapsed"])
      .maybeSingle()
    if (data) {
      setSubscribed(data.status === "active")
      setPlan(data.plan || "yearly")
      setSubRenewal(data.renewal_date || "")
      return data.status === "active"
    }
    setSubscribed(false)
    return false
  }, [])

  const loadCharityPrefs = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("charity_prefs")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle()
    if (data) {
      const idx = CHARITIES.findIndex((c) => c.id === data.charity_id)
      if (idx >= 0) setCharityIdx(idx)
      setCharityPct(data.pct || 15)
      setAllTimeDonated(data.all_time || 18.5)
    }
  }, [])

  const loadWallet = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", uid)
      .maybeSingle()
    if (data) setWalletBalance(data.balance || 0)
    else setWalletBalance(0)
  }, [])

  const creditWallet = useCallback(async (uid: string, amount: number) => {
    // Upsert wallet — add prize to balance instantly (simulated payout)
    const { data: existing } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", uid)
      .maybeSingle()
    const newBalance = (existing?.balance || 0) + amount
    await supabase.from("wallets").upsert(
      { user_id: uid, balance: newBalance, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    setWalletBalance(newBalance)
  }, [])

  const loadAdminData = useCallback(async () => {
    // Load all subscriptions
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false })
    setAdminUsers(subs || [])

    // Load all draws with a prize (potential winners)
    const { data: wins } = await supabase
      .from("draws")
      .select("*")
      .gt("prize", 0)
      .order("created_at", { ascending: false })
    setAdminWinners(wins || [])
  }, [])

  const bootstrap = useCallback(
    async (u: User) => {
      const adminFlag = u.email === ADMIN_EMAIL
      setUser(u)
      setIsAdmin(adminFlag)
      setSettingsEmail(u.email || "")

      if (adminFlag) {
        await loadAdminData()
        setView("admin")
        return
      }

      await Promise.all([loadScores(u.id), loadDrawHistory(u.id), loadCharityPrefs(u.id), loadWallet(u.id), loadDonations(u.id)])
      const hasSub = await loadSub(u.id)
      setView(hasSub ? "dashboard" : "subscribe")
    },
    [loadScores, loadDrawHistory, loadSub, loadCharityPrefs, loadAdminData, loadWallet, loadDonations]
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (session?.user) bootstrap(session.user)
      else setView("auth")
    })
    const {
      data: { subscription: sub },
    } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      if (!session) {
        setUser(null)
        setView("auth")
      }
    })
    return () => sub.unsubscribe()
  }, [bootstrap])

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleAuth = async () => {
    setAuthErr("")
    if (!email.trim() || !password) {
      setAuthErr("Email and password are required.")
      return
    }
    setAuthBusy(true)
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      setAuthBusy(false)
      if (error) {
        setAuthErr(error.message)
        return
      }
      toast("Account created! Check your email to confirm your account.", "gold")
      setAuthMode("login")
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      setAuthBusy(false)
      if (error) {
        setAuthErr("Invalid email or password.")
        return
      }
      if (data.user) bootstrap(data.user)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setScores([])
    setSubscribed(false)
    setIsAdmin(false)
    setBalls(Array(5).fill({ num: null, state: "idle" }))
    setDrawResult(null)
    setDrawRunning(false)
    setDrawHistory([])
    setView("auth")
    setEmail("")
    setPassword("")
    toast("Signed out.", "ok")
  }

  // ── Subscription ──────────────────────────────────────────────────────────

  const handleSubscribe = async () => {
    if (!user) return
    const renewal = new Date()
    if (plan === "monthly") renewal.setMonth(renewal.getMonth() + 1)
    else renewal.setFullYear(renewal.getFullYear() + 1)
    const renewalStr = renewal.toISOString().slice(0, 10)
    const payload = {
      user_id: user.id,
      status: "active",
      plan,
      renewal_date: renewalStr,
    }

    // Check if a subscription row already exists for this user
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    let error: any = null
    if (existing) {
      // Update existing row
      const res = await supabase
        .from("subscriptions")
        .update({ status: "active", plan, renewal_date: renewalStr })
        .eq("user_id", user.id)
      error = res.error
    } else {
      // Insert new row
      const res = await supabase
        .from("subscriptions")
        .insert({ user_id: user.id, plan, status: "active", renewal_date: renewalStr })
      error = res.error
    }

    if (error) {
      toast("Subscription failed — " + error.message, "err")
      return
    }
    setSubscribed(true)
    setSubRenewal(renewalStr)
    setView("dashboard")
    toast(`${plan === "yearly" ? "Yearly" : "Monthly"} plan activated — welcome!`, "gold")
  }

  const handleCancelSub = async () => {
    if (!user) return
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
    if (error) {
      toast("Could not cancel — please try again.", "err")
      return
    }
    setSubscribed(false)
    setShowCancelModal(false)
    toast("Subscription cancelled. Access retained until renewal.", "ok")
  }

  const handleChangePlan = async (newPlan: "monthly" | "yearly") => {
    if (!user) return
    const renewal = new Date()
    if (newPlan === "monthly") renewal.setMonth(renewal.getMonth() + 1)
    else renewal.setFullYear(renewal.getFullYear() + 1)
    const renewalStr = renewal.toISOString().slice(0, 10)

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    let error: any = null
    if (existing) {
      const res = await supabase
        .from("subscriptions")
        .update({ plan: newPlan, status: "active", renewal_date: renewalStr })
        .eq("user_id", user.id)
      error = res.error
    } else {
      const res = await supabase
        .from("subscriptions")
        .insert({ user_id: user.id, plan: newPlan, status: "active", renewal_date: renewalStr })
      error = res.error
    }

    if (error) {
      toast("Could not update plan — " + error.message, "err")
      return
    }
    setPlan(newPlan)
    setSubRenewal(renewalStr)
    toast(`Switched to ${newPlan === "yearly" ? "Yearly" : "Monthly"} plan ✓`, "gold")
  }

  // ── Scores ────────────────────────────────────────────────────────────────

  const addScore = async (val: number) => {
    if (!subscribed || !user || savingScore) return
    setSavingScore(true)
    const { error } = await supabase.from("scores").insert({
      user_id: user.id,
      score: val,
      date: new Date().toISOString(),
    })
    if (error) {
      toast("Could not save score.", "err")
      setSavingScore(false)
      return
    }
    // Enforce max 5
    const { data: all } = await supabase
      .from("scores")
      .select("id")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
    if (all && all.length > 5) {
      await supabase
        .from("scores")
        .delete()
        .in(
          "id",
          all.slice(5).map((r: { id: string }) => r.id)
        )
    }
    await loadScores(user.id)
    setSavingScore(false)
    toast(`Score of ${val} pts logged!`, "gold")
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  const thisMonthDraw = drawHistory.find((d) => d.month === CURRENT_MONTH)
  const drawAlreadyDone = !!thisMonthDraw

  const runDraw = async () => {
    if (!subscribed || !user || drawRunning || drawAlreadyDone) return
    if (scores.length === 0) {
      toast("Log at least one score before running the draw.", "err")
      return
    }

    setDrawRunning(true)
    setDrawResult(null)
    setBalls(Array(5).fill({ num: null, state: "idle" }))

    const drawn: number[] = []
    while (drawn.length < 5) {
      const n = Math.floor(Math.random() * 45) + 1
      if (!drawn.includes(n)) drawn.push(n)
    }
    const userNums = scores.map((s) => s.score)

    drawn.forEach((n, i) => {
      setTimeout(() => {
        setBalls((prev) => {
          const next = [...prev]
          next[i] = { num: n, state: "spin" }
          return next
        })
        setTimeout(() => {
          setBalls((prev) => {
            const next = [...prev]
            next[i] = {
              num: n,
              state: userNums.includes(n) ? "match" : "done",
            }
            return next
          })
        }, 300)
        if (i === 4) {
          setTimeout(async () => {
            const matched = drawn.filter((x) => userNums.includes(x))
            const m = matched.length
            const prize = calcPrize(m)

            const { error: insertError } = await supabase.from("draws").insert({
              user_id: user.id,
              month: CURRENT_MONTH,
              drawn_numbers: drawn,
              matched_numbers: matched,
              prize,
              status: prize > 0 ? "pending" : "no_win",
            })

            if (insertError) {
              console.error("Draw insert error:", insertError.message)
            } else {
              await loadDrawHistory(user.id)
            }

            // Always show result and lock the button regardless of DB
            setDrawResult({ matches: m, prize, nums: drawn, matched })
            setDrawRunning(false)

            if (m === 5) { SFX.jackpot(); toast(`🏆 JACKPOT! All 5 matched — ${fmt(prize)}! Upload your proof to claim.`, "gold") }
            else if (m >= 3) { SFX.win(); toast(`💰 ${m}-match win — ${fmt(prize)}! Upload proof to claim your prize.`, "gold") }
            else { SFX.lose(); toast("No match this draw. Better luck next month!", "err") }
          }, 500)
        }
      }, i * 540)
    })
  }

  // ── Proof upload ──────────────────────────────────────────────────────────

  const handleSubmitProof = async () => {
    if (!proofFile || !proofDrawId || !user) return
    setProofSubmitting(true)

    // Upload file to Supabase Storage
    const ext = proofFile.name.split(".").pop()
    const path = `proofs/${user.id}/${proofDrawId}.${ext}`
    const { error: upErr } = await supabase.storage
      .from("winner-proofs")
      .upload(path, proofFile, { upsert: true })

    if (upErr) {
      toast("Upload failed: " + upErr.message, "err")
      setProofSubmitting(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from("winner-proofs")
      .getPublicUrl(path)

    await supabase
      .from("draws")
      .update({
        proof_url: urlData.publicUrl,
        status: "pending",
      })
      .eq("id", proofDrawId)

    await loadDrawHistory(user.id)
    setProofSubmitting(false)
    setShowProofModal(false)
    setProofFile(null)
    toast("Proof submitted for verification!", "gold")
  }

  // ── Charity ───────────────────────────────────────────────────────────────

  const saveCharityPrefs = async (idx: number, pct: number) => {
    if (!user) return
    await supabase.from("charity_prefs").upsert(
      {
        user_id: user.id,
        charity_id: CHARITIES[idx].id,
        pct,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    setCharityIdx(idx)
    setCharityPct(pct)
    toast(`Saved: ${CHARITIES[idx].name} at ${pct}%`, "gold")
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  const handleClearScores = async () => {
    if (!user) return
    setSettingsBusy(true)
    await supabase.from("scores").delete().eq("user_id", user.id)
    await loadScores(user.id)
    setSettingsBusy(false)
    setShowClearModal(false)
    toast("All scores cleared.", "ok")
  }

  const handleUpdateEmail = async () => {
    if (!settingsEmail.trim()) return
    setSettingsBusy(true)
    const { error } = await supabase.auth.updateUser({ email: settingsEmail.trim() })
    setSettingsBusy(false)
    if (error) {
      toast("Could not update email: " + error.message, "err")
      return
    }
    toast("Confirmation sent — check your new inbox.", "gold")
  }

  const handleUpdatePassword = async () => {
    if (settingsPwd.length < 6) {
      toast("Password must be at least 6 characters.", "err")
      return
    }
    setSettingsBusy(true)
    const { error } = await supabase.auth.updateUser({ password: settingsPwd })
    setSettingsBusy(false)
    if (error) {
      toast("Could not update password: " + error.message, "err")
      return
    }
    setSettingsPwd("")
    toast("Password updated.", "gold")
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    setSettingsBusy(true)

    try {
      // Delete all user data first
      await supabase.from("scores").delete().eq("user_id", user.id)
      await supabase.from("draws").delete().eq("user_id", user.id)
      await supabase.from("subscriptions").delete().eq("user_id", user.id)
      await supabase.from("charity_prefs").delete().eq("user_id", user.id)
      await supabase.from("wallets").delete().eq("user_id", user.id)

      // Delete the auth user via Postgres RPC (requires the SQL function below)
      const { error: rpcError } = await supabase.rpc("delete_user")

      if (rpcError) {
        // Fallback — just sign out if RPC not set up yet
        console.warn("RPC delete_user not available:", rpcError.message)
        await supabase.auth.signOut()
        setSettingsBusy(false)
        setShowDeleteModal(false)
        setUser(null)
        setView("auth")
        toast("Account data removed. You have been signed out.", "ok")
        return
      }

      await supabase.auth.signOut()
      setSettingsBusy(false)
      setShowDeleteModal(false)
      setUser(null)
      setSubscribed(false)
      setScores([])
      setDrawHistory([])
      setView("auth")
      toast("Account permanently deleted.", "ok")
    } catch (e) {
      setSettingsBusy(false)
      toast("Could not delete account. Please try again.", "err")
    }
  }

  // ── Admin actions ─────────────────────────────────────────────────────────

  const handleAdminVerifyWinner = async (drawId: string, approve: boolean) => {
    const newStatus = approve ? "paid" : "rejected"
    const { error } = await supabase
      .from("draws")
      .update({ status: newStatus })
      .eq("id", drawId)
    if (error) {
      toast("Update failed.", "err")
      return
    }
    // Credit wallet when admin approves
    if (approve) {
      const winner = adminWinners.find((w) => w.id === drawId)
      if (winner && winner.prize > 0) {
        await creditWallet(winner.user_id, winner.prize)
      }
    }
    await loadAdminData()
    toast(
      approve ? "Winner approved — prize credited to wallet!" : "Submission rejected.",
      approve ? "gold" : "err"
    )
  }

  const handleAdminCancelSub = async (userId: string) => {
    await supabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", userId)
    await loadAdminData()
    toast("Subscription cancelled.", "ok")
  }

  const handleAdminRunSim = () => {
    const drawn: number[] = []
    while (drawn.length < 5) {
      const n = Math.floor(Math.random() * 45) + 1
      if (!drawn.includes(n)) drawn.push(n)
    }
    const simWinners = Math.floor(Math.random() * 4)
    setAdminSimResult({ nums: drawn, simulatedWinners: simWinners })
    toast(`Simulation complete — ${simWinners} simulated winners.`, "gold")
  }

  const handleAdminPublishDraw = async () => {
    if (!adminSimResult) {
      toast("Run a simulation first.", "err")
      return
    }
    setAdminDrawPublished(true)
    toast(`Draw for ${fmtMonth(adminDrawMonth)} published!`, "gold")
  }

  const handleAdminAddCharity = () => {
    if (!newCharity.name || !newCharity.cat) {
      toast("Name and category are required.", "err")
      return
    }
    const c: CharityProfile = {
      id: Date.now().toString(),
      name: newCharity.name,
      cat: newCharity.cat,
      description: newCharity.description,
    }
    setAdminCharities((prev) => [...prev, c])
    setNewCharity({ name: "", cat: "", description: "" })
    setShowAddCharity(false)
    toast("Charity added.", "gold")
  }

  const handleAdminDeleteCharity = (id: string) => {
    setAdminCharities((prev) => prev.filter((c) => c.id !== id))
    toast("Charity removed.", "ok")
  }

  const handleAdminSaveCharity = () => {
    if (!editCharity) return
    setAdminCharities((prev) =>
      prev.map((c) => (c.id === editCharity.id ? editCharity : c))
    )
    setEditCharity(null)
    toast("Charity updated.", "gold")
  }

  const handleAdminEditScore = async (scoreId: string, newVal: number) => {
    await supabase.from("scores").update({ score: newVal }).eq("id", scoreId)
    toast("Score updated.", "gold")
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const greeting = (() => {
    const h = new Date().getHours()
    return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"
  })()
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const initials = user ? mkInitials(user.email || "GU") : "GU"
  const firstName =
    user?.email?.split("@")[0].split(/[._\-+]/)[0] || "there"
  const totalWon = drawHistory.reduce((a, d) => a + (d.prize || 0), 0)
  const userNums = scores.map((s) => s.score)
  const monthlyDonate = ((plan === "monthly" ? 9.99 : 89.99 / 12) * charityPct / 100).toFixed(2)
  const yearlyDonate = (89.99 * charityPct / 100).toFixed(2)
  const nextMonthStr = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    d.setDate(1)
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  })()

  // ── Section components ────────────────────────────────────────────────────

  function Overview() {
    const avg = scores.length ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : null
    const best = scores.length ? Math.max(...scores.map(s => s.score)) : null

    return (
      <>
        {/* ── 4-stat strip ── */}
        <div className="g4" style={{ marginBottom: 16 }}>
          <div className="stat-cell">
            <div className="stat-lbl">Subscription</div>
            <div className={`stat-val ${subscribed ? "gr" : "r"}`}>
              {subscribed ? "Active" : "Inactive"}
            </div>
            <div className="stat-note">
              {subscribed ? `${plan === "yearly" ? "Yearly" : "Monthly"}` : "No plan"}
            </div>
          </div>
          <div className="stat-cell">
            <div className="stat-lbl">Scores</div>
            <div className="stat-val g">
              {scores.length}<span style={{ fontSize: 13, color: "var(--t6)" }}>/5</span>
            </div>
            <div className="stat-note">rounds logged</div>
          </div>
          <div className="stat-cell">
            <div className="stat-lbl">Prize Pool</div>
            <div className="stat-val g">{fmt(POOL_TOTAL)}</div>
            <div className="stat-note">this month</div>
          </div>
          <div className="stat-cell">
            <div className="stat-lbl">Wallet Balance</div>
            <div className="stat-val g">{fmt(walletBalance)}</div>
            <div className="stat-note">in-app credits · {drawHistory.length} draw{drawHistory.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {/* ── Main content two-col (stacks on mobile) ── */}
        <div className="g2" style={{ alignItems: "start" }}>

          {/* LEFT: Recent scores — read-only display */}
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Recent <em>Scores</em></div>
                <div className="card-sub">Last {scores.length || 0} Stableford rounds</div>
              </div>
              <div className={`card-badge${scores.length === 5 ? " gold" : ""}`}>
                {scores.length} / 5
              </div>
            </div>

            <ScoreRows scores={scores} />

            {scores.length >= 2 && (
              <>
                <div className="divider" />
                <div className="g3">
                  <div className="mini-cell">
                    <div className="mini-lbl">Best</div>
                    <div className="mini-val">{best}</div>
                  </div>
                  <div className="mini-cell">
                    <div className="mini-lbl">Average</div>
                    <div className="mini-val">{avg}</div>
                  </div>
                  <div className="mini-cell">
                    <div className="mini-lbl">Rounds</div>
                    <div className="mini-val w">{scores.length}</div>
                  </div>
                </div>
              </>
            )}

            <div className="divider" />
            <button className="btn btn-g btn-full" onClick={() => setSection("scores")}>
              {scores.length === 0 ? "Log Your First Score →" : "Log a New Score →"}
            </button>
          </div>

          {/* RIGHT: Charity · Draw · Plan */}
          <div className="stack">

            {/* Charity snapshot */}
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Your <em>Charity</em></div>
                  <div className="card-sub">{CHARITIES[charityIdx]?.name}</div>
                </div>
                <div className="card-badge gold">{charityPct}%</div>
              </div>
              <div className="pct-track" style={{ marginBottom: 10 }}>
                <div className="pct-fill" style={{ width: `${((charityPct - 10) / 40) * 100}%` }} />
              </div>
              <div className="g3">
                <div className="mini-cell">
                  <div className="mini-lbl">Monthly</div>
                  <div className="mini-val">£{monthlyDonate}</div>
                </div>
                <div className="mini-cell">
                  <div className="mini-lbl">All Time</div>
                  <div className="mini-val">£{allTimeDonated.toFixed(2)}</div>
                </div>
                <div className="mini-cell">
                  <div className="mini-lbl">Jackpot</div>
                  <div className="mini-val">{fmt(PRIZE_5)}</div>
                </div>
              </div>
            </div>

            {/* Draw snapshot */}
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">
                    {fmtMonth(CURRENT_MONTH).split(" ")[0]} <em>Draw</em>
                  </div>
                  <div className="card-sub">
                    {fmt(PRIZE_5)} jackpot{jackpotRolledOver && " + rollover"}
                  </div>
                </div>
                <div className={`card-badge${drawAlreadyDone ? " green" : ""}`}>
                  {drawAlreadyDone ? "Done" : "Ready"}
                </div>
              </div>
              <div className="balls" style={{ marginBottom: 10 }}>
                {(drawAlreadyDone ? thisMonthDraw!.drawn_numbers : Array(5).fill(null))
                  .map((n: number | null, i: number) => (
                    <div key={i}
                      className={`ball${drawAlreadyDone
                        ? (thisMonthDraw!.matched_numbers.includes(n as number) ? " match" : " done")
                        : ""}`}
                      style={{ width: 42, height: 42, fontSize: 15 }}>
                      {drawAlreadyDone ? n : "?"}
                    </div>
                  ))}
              </div>
              <button className="btn btn-o btn-full" onClick={() => setSection("draw")}>
                {drawAlreadyDone ? "View Result →" : "Go to Draw →"}
              </button>
            </div>

            {/* Plan status */}
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Your <em>Plan</em></div>
                  <div className="card-sub">
                    {subscribed
                      ? `${plan === "yearly" ? "Yearly" : "Monthly"} · renews ${subRenewal || "—"}`
                      : "No active subscription"}
                  </div>
                </div>
                <div className={`card-badge${subscribed ? " green" : " red"}`}>
                  {subscribed ? "Active" : "Inactive"}
                </div>
              </div>
              <button className="btn btn-o btn-full" onClick={() => setSection("subscription")}>
                {subscribed ? "Manage Plan →" : "Subscribe Now →"}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  function Scores() {
    return (
      <div className="g2">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                Add a <em>Score</em>
              </div>
              <div className="card-sub">+/− buttons, slider, or quick select</div>
            </div>
            <div className={`card-badge${scores.length === 5 ? " gold" : ""}`}>
              {scores.length} / 5
            </div>
          </div>
          <ScoreInput subscribed={subscribed} onAdd={addScore} saving={savingScore} />
          {scores.length === 5 && (
            <div className="info-box warn">
              <strong>Scorecard is full.</strong> Logging a new score will automatically
              remove your oldest entry.
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                Your <em>Scorecard</em>
              </div>
              <div className="card-sub">Rolling last 5 rounds · newest first</div>
            </div>
          </div>
          <ScoreRows scores={scores} />
          {scores.length >= 2 && (
            <>
              <div className="divider" />
              <div className="g3">
                <div className="mini-cell">
                  <div className="mini-lbl">Highest</div>
                  <div className="mini-val">
                    {Math.max(...scores.map((s) => s.score))}
                  </div>
                </div>
                <div className="mini-cell">
                  <div className="mini-lbl">Average</div>
                  <div className="mini-val">
                    {Math.round(
                      scores.reduce((a, s) => a + s.score, 0) / scores.length
                    )}
                  </div>
                </div>
                <div className="mini-cell">
                  <div className="mini-lbl">Lowest</div>
                  <div className="mini-val w">
                    {Math.min(...scores.map((s) => s.score))}
                  </div>
                </div>
              </div>
              <div className="divider" />
              <div
                className="info-box"
                style={{ fontSize: 12, lineHeight: 1.6 }}
              >
                <strong>Draw eligibility:</strong> Your scores{" "}
                <strong style={{ color: "var(--g1)" }}>
                  {userNums.join(", ")}
                </strong>{" "}
                are used as your lottery numbers. Match 3, 4, or all 5 drawn
                numbers to win.
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  function Draw() {
    const displayResult =
      drawResult ||
      (thisMonthDraw
        ? {
            matches: thisMonthDraw.matched_numbers.length,
            prize: thisMonthDraw.prize,
            nums: thisMonthDraw.drawn_numbers,
            matched: thisMonthDraw.matched_numbers,
          }
        : null)

    const pendingWin =
      drawHistory.find((d) => d.prize > 0 && (!d.status || d.status === "pending"))

    return (
      <>
        <div
          className="g3"
          style={{ marginBottom: 18, borderRadius: "var(--r)", overflow: "hidden" }}
        >
          <div className="mini-cell">
            <div className="mini-lbl">
              Jackpot (5-match · 40% pool{jackpotRolledOver ? " + rollover" : ""})
            </div>
            <div className="mini-val">{fmt(PRIZE_5)}</div>
          </div>
          <div className="mini-cell">
            <div className="mini-lbl">4-Match · 35% pool ÷ ~3 winners</div>
            <div className="mini-val">{fmt(PRIZE_4)} est.</div>
          </div>
          <div className="mini-cell">
            <div className="mini-lbl">3-Match · 25% pool ÷ ~8 winners</div>
            <div className="mini-val w">{fmt(PRIZE_3)} est.</div>
          </div>
        </div>

        <div className="g2">
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">
                  Monthly <em>Draw</em>
                </div>
                <div className="card-sub">
                  {fmtMonth(CURRENT_MONTH)} · {fmt(POOL_TOTAL)} pool
                </div>
              </div>
              <div
                className={`card-badge${
                  drawAlreadyDone
                    ? " green"
                    : drawRunning
                    ? " gold"
                    : ""
                }`}
              >
                {drawRunning
                  ? "Running…"
                  : drawAlreadyDone
                  ? "Done this month"
                  : "Ready to run"}
              </div>
            </div>

            <p
              style={{
                fontSize: 13,
                color: "var(--t3)",
                lineHeight: 1.8,
                marginBottom: 18,
              }}
            >
              Five numbers (1–45) are drawn and matched against your Stableford
              scores. Pool is{" "}
              <strong style={{ color: "var(--t2)" }}>60% of monthly fees</strong> (
              {MEMBER_COUNT.toLocaleString()} members × £{AVG_FEE}). Split: 40%
              jackpot · 35% four-match · 25% three-match, shared between winners.
              Jackpot <strong style={{ color: "var(--g1)" }}>rolls over</strong> if
              unclaimed.
            </p>

            <div className="balls">
              {balls.map((b, i) => (
                <div
                  key={i}
                  className={`ball${
                    b.state === "spin"
                      ? " spin"
                      : b.state === "match"
                      ? " match"
                      : b.state === "done"
                      ? " done"
                      : ""
                  }`}
                >
                  {b.num !== null ? b.num : "—"}
                </div>
              ))}
            </div>

            {drawAlreadyDone && thisMonthDraw ? (
              <div className="draw-locked">
                <div className="draw-locked-icon">🔒</div>
                <div>
                  <div className="draw-locked-title">
                    Draw completed for {fmtMonth(CURRENT_MONTH)}
                  </div>
                  <div className="draw-locked-desc">
                    Run on{" "}
                    {new Date(thisMonthDraw.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    . One draw per calendar month. Next draw opens {nextMonthStr}.
                  </div>
                </div>
              </div>
            ) : (
              <>
                <button
                  className="btn btn-g btn-full"
                  style={{ padding: "14px 0", marginBottom: 8 }}
                  onClick={runDraw}
                  disabled={drawRunning || scores.length === 0 || !subscribed}
                >
                  {drawRunning
                    ? "Drawing numbers…"
                    : `Run ${fmtMonth(CURRENT_MONTH).split(" ")[0]} Draw →`}
                </button>
                {scores.length === 0 && (
                  <div className="info-box" style={{ marginTop: 4 }}>
                    Log at least one score to run the draw.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">
                  Your <em>Result</em>
                </div>
                <div className="card-sub">Your scores matched against drawn numbers</div>
              </div>
            </div>

            {!displayResult ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 16px",
                  border: "1px dashed rgba(232,184,75,.1)",
                  borderRadius: "var(--r)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 38,
                    color: "rgba(232,184,75,.1)",
                    marginBottom: 8,
                  }}
                >
                  ◇
                </p>
                <p style={{ fontSize: 13, color: "var(--t5)" }}>
                  Run the draw to see your result
                </p>
              </div>
            ) : (
              (() => {
                const mx = displayResult.matches
                const clsx =
                  mx === 5
                    ? "jackpot"
                    : mx === 4
                    ? "win4"
                    : mx === 3
                    ? "win3"
                    : ""
                return (
                  <div className={`result-box ${clsx}`}>
                    <div className="result-emoji">
                      {mx === 5 ? "🏆" : mx === 4 ? "💰" : mx === 3 ? "👍" : "😔"}
                    </div>
                    <div className="result-title">
                      {mx === 5 ? "Jackpot!" : mx === 4 ? "4-Match Win" : mx === 3 ? "3-Match Win" : "No Match"}
                    </div>
                    {displayResult.prize > 0 && (
                      <div className="result-prize">{fmt(displayResult.prize)}</div>
                    )}
                    <div className="result-desc" style={{ marginTop: 8 }}>
                      {mx >= 3
                        ? `🎉 You matched ${mx} numbers and won ${fmt(displayResult.prize)}! Upload proof of your scores to claim your prize.`
                        : "Keep logging scores — your numbers improve your odds each month."}
                    </div>

                    {/* Your score logs — each one marked if it matched a drawn number */}
                    <div style={{ marginTop: 14, width: "100%" }}>
                      <div style={{ fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--t5)", marginBottom: 8, textAlign: "left" }}>
                        Your scores vs drawn numbers
                      </div>
                      {userNums.length === 0 ? (
                        <div style={{ fontSize: 12, color: "var(--t5)" }}>No scores logged</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {userNums.map((score, i) => {
                            const hit = displayResult.nums.includes(score)
                            return (
                              <div key={i} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "8px 12px",
                                background: hit ? "rgba(77,217,122,.07)" : "rgba(255,255,255,.03)",
                                border: `1px solid ${hit ? "var(--green-b)" : "rgba(255,255,255,.07)"}`,
                                borderRadius: "var(--r2)",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{
                                    width: 30, height: 30, borderRadius: "50%",
                                    background: hit ? "var(--green-bg)" : "rgba(255,255,255,.05)",
                                    border: `1.5px solid ${hit ? "var(--green-b)" : "rgba(255,255,255,.1)"}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontFamily: "var(--serif)", fontSize: 14,
                                    color: hit ? "var(--green)" : "var(--t4)",
                                  }}>
                                    {score}
                                  </div>
                                  <span style={{ fontSize: 12, color: "var(--t4)" }}>Score #{i + 1}</span>
                                </div>
                                <div style={{
                                  fontSize: 10, fontWeight: 600, letterSpacing: ".1em",
                                  textTransform: "uppercase",
                                  color: hit ? "var(--green)" : "var(--red)",
                                }}>
                                  {hit ? "✓ Matched" : "✗ No match"}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {mx >= 3 && (
                      <div style={{
                        marginTop: 14, padding: "10px 14px",
                        background: "rgba(232,184,75,.06)", border: "1px solid var(--b2)",
                        borderRadius: "var(--r2)", display: "flex", alignItems: "center",
                        gap: 8, fontSize: 12, color: "var(--t2)"
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--g1)" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        Prize pending admin verification. Upload your score screenshot below to claim.
                      </div>
                    )}
                    {mx >= 3 && thisMonthDraw && (
                      <button
                        className="btn btn-amber btn-full"
                        style={{ marginTop: 10 }}
                        onClick={() => { setProofDrawId(thisMonthDraw.id); setShowProofModal(true) }}
                      >
                        Upload Proof to Claim →
                      </button>
                    )}
                  </div>
                )
              })()
            )}
          </div>
        </div>

        {drawHistory.length > 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <div className="card-head">
              <div>
                <div className="card-title">
                  Draw <em>History</em>
                </div>
                <div className="card-sub">All your previous monthly draws</div>
              </div>
            </div>
            <div className="draw-hist">
              {drawHistory.map((d, i) => (
                <div
                  className="dhr"
                  key={d.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="dhr-month">{fmtMonth(d.month)}</div>
                  <div className="dhr-balls">
                    {d.drawn_numbers.map((n, j) => (
                      <div
                        key={j}
                        className={`dhr-ball${
                          d.matched_numbers.includes(n) ? " m" : ""
                        }`}
                      >
                        {n}
                      </div>
                    ))}
                  </div>
                  <div className="dhr-match">
                    {d.matched_numbers.length > 0
                      ? `${d.matched_numbers.length} matched`
                      : "No match"}
                  </div>
                  <div className="dhr-prize">{d.prize > 0 ? fmt(d.prize) : "—"}</div>
                  <div
                    className={`dhr-status ${
                      d.status === "paid" ? "paid"
                      : d.status === "rejected" ? "rejected"
                      : d.prize > 0 ? "pending"
                      : "no"
                    }`}
                  >
                    {d.status === "paid" ? "Paid"
                      : d.status === "rejected" ? "Rejected"
                      : d.prize > 0 ? "Pending"
                      : "No win"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Proof Upload Modal */}
        {showProofModal && (
          <div
            className="overlay"
            onClick={(e) =>
              e.target === e.currentTarget && setShowProofModal(false)
            }
          >
            <div className="modal">
              <div className="modal-title">
                Upload <em>Proof</em>
              </div>
              <div className="modal-desc">
                Upload a screenshot of your Stableford scores from the golf
                platform. Winners are verified within 72 hours. Prizes are paid
                directly to your registered account.
              </div>
              <div
                className={`upload-area${proofFile ? " uploaded" : ""}`}
                onClick={() =>
                  document.getElementById("proof-file-input")?.click()
                }
              >
                <div className="upload-icon">{proofFile ? "✅" : "📎"}</div>
                <div className="upload-text">
                  {proofFile ? proofFile.name : "Click to choose file"}
                </div>
                <div className="upload-sub">PNG, JPG, or PDF · max 10MB</div>
                <input
                  id="proof-file-input"
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setProofFile(f)
                  }}
                />
              </div>
              <div className="modal-btns" style={{ marginTop: 16 }}>
                <button className="btn btn-o" onClick={() => setShowProofModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-g"
                  onClick={handleSubmitProof}
                  disabled={!proofFile || proofSubmitting}
                >
                  {proofSubmitting ? "Uploading…" : "Submit Claim →"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  function Charity() {
    const [localIdx, setLocalIdx] = useState(charityIdx)
    const [localPct, setLocalPct] = useState(charityPct)
    const [donateAmt, setDonateAmt] = useState<number | null>(null)
    const [customAmt, setCustomAmt] = useState("")
    const [donating, setDonating] = useState(false)
    const mGive = (9.99 * localPct / 100).toFixed(2)
    const yGive = (89.99 * localPct / 100).toFixed(2)
    const selCharity = adminCharities[localIdx] || CHARITIES[localIdx]
    const presets = [5, 10, 25, 50]
    const effectiveAmt = customAmt ? parseFloat(customAmt) : donateAmt

    const handleDonate = async () => {
      if (!user || !effectiveAmt || effectiveAmt < 1) {
        toast("Enter a valid donation amount (min £1).", "err"); return
      }
      setDonating(true)
      const { error } = await supabase.from("donations").insert({
        user_id: user.id,
        charity_name: selCharity?.name || "Selected Charity",
        amount: effectiveAmt,
      })
      if (error) {
        toast("Donation failed — " + error.message, "err")
      } else {
        setAllTimeDonated(p => p + effectiveAmt)
        setDonateAmt(null)
        setCustomAmt("")
        await loadDonations(user.id)
        SFX.confirm()
        toast(`£${effectiveAmt.toFixed(2)} donated to ${selCharity?.name} 💚`, "gold")
      }
      setDonating(false)
    }

    return (
      <div className="g2">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Choose <em>Charity</em></div>
              <div className="card-sub">Select one · update anytime</div>
            </div>
          </div>
          <div className="ch-list">
            {adminCharities.map((c, i) => (
              <div key={c.id} className={`ch-item${localIdx === i ? " sel" : ""}`} onClick={() => setLocalIdx(i)}>
                <div className="ch-radio"><div className="ch-ring"><div className="ch-dot" /></div></div>
                <div className="ch-info">
                  <div className="ch-name">{c.name}</div>
                  <div className="ch-cat">{c.cat}</div>
                </div>
                {c.featured && <div className="ch-feat">Featured</div>}
              </div>
            ))}
          </div>
          <div className="info-box" style={{ marginBottom: 14 }}>
            <strong>Currently donating to:</strong>{" "}
            {CHARITIES[charityIdx]?.name} at {charityPct}% of your subscription.
          </div>
          <button className="btn btn-g btn-full" onClick={() => saveCharityPrefs(localIdx, localPct)}>
            Save Charity & Contribution →
          </button>

          {/* Contribution slider */}
          <div className="divider" />
          <div className="sec-label">Monthly Contribution</div>
          <div className="pct-row">
            <span className="pct-txt">Donate <strong style={{color:"var(--t1)"}}>{localPct}%</strong> of subscription</span>
            <span className="pct-num">{localPct}%</span>
          </div>
          <input type="range" className="score-range" min={10} max={50} step={5} value={localPct}
            onChange={(e) => setLocalPct(parseInt(e.target.value))} />
          <div className="range-lbl"><span>10%</span><span>50%</span></div>
          <div className="pct-track" style={{ marginBottom: 12 }}>
            <div className="pct-fill" style={{ width: `${((localPct - 10) / 40) * 100}%` }} />
          </div>
          <div className="g2" style={{ gap:2, background:"var(--b1)", marginTop:14, borderRadius:"var(--r)", overflow:"hidden" }}>
            <div className="mini-cell"><div className="mini-lbl">Monthly donation</div><div className="mini-val">£{mGive}/mo</div></div>
            <div className="mini-cell"><div className="mini-lbl">Yearly total</div><div className="mini-val">£{yGive}</div></div>
            <div className="mini-cell"><div className="mini-lbl">Effective /mo (yearly)</div><div className="mini-val">£{(parseFloat(yGive)/12).toFixed(2)}</div></div>
            <div className="mini-cell"><div className="mini-lbl">All Time Donated</div><div className="mini-val w">£{allTimeDonated.toFixed(2)}</div></div>
          </div>
        </div>

        <div className="stack">
          {/* Independent one-time donation */}
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">One-Time <em>Donation</em></div>
                <div className="card-sub">Independent · not tied to subscription</div>
              </div>
              <div className="card-badge gold">PRD §8</div>
            </div>
            <div className="donate-card">
              <div style={{fontSize:13,color:"var(--t3)",marginBottom:14,lineHeight:1.7}}>
                Make a direct donation to <strong style={{color:"var(--t1)"}}>{selCharity?.name || "your chosen charity"}</strong> — independent of your monthly contribution.
              </div>
              <div className="donate-amounts">
                {presets.map((p) => (
                  <button key={p} className={`donate-amt${donateAmt === p && !customAmt ? " on" : ""}`}
                    onClick={() => { setDonateAmt(p); setCustomAmt(""); SFX.select() }}>
                    £{p}
                  </button>
                ))}
              </div>
              <div className="donate-custom">
                <span className="donate-custom-prefix">£</span>
                <input
                  className="donate-custom-input"
                  type="number"
                  min={1}
                  placeholder="Custom amount"
                  value={customAmt}
                  onChange={(e) => { setCustomAmt(e.target.value); setDonateAmt(null) }}
                />
              </div>
              <button
                className="btn btn-g btn-full"
                disabled={!effectiveAmt || effectiveAmt < 1 || donating}
                onClick={handleDonate}
              >
                {donating ? "Processing…" : effectiveAmt && effectiveAmt >= 1 ? `Donate £${effectiveAmt.toFixed(2)} →` : "Select an amount"}
              </button>
            </div>

            {/* Donation history */}
            {donations.length > 0 && (
              <>
                <div className="divider" />
                <div className="sec-label">Donation History</div>
                <div className="donate-history">
                  {donations.map((d) => (
                    <div key={d.id} className="donate-hist-row">
                      <div className="donate-hist-charity">{d.charity}</div>
                      <div className="donate-hist-amount">£{d.amount.toFixed(2)}</div>
                      <div className="donate-hist-date">{d.date}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Charity profile */}
          {selCharity && (
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">About <em>{selCharity.name.split(" ")[0]}</em></div>
                  <div className="card-sub">{selCharity.cat}</div>
                </div>
                {selCharity.featured && <div className="card-badge gold">Featured</div>}
              </div>
              <p style={{ fontSize:13, color:"var(--t3)", lineHeight:1.75, marginBottom:14 }}>
                {selCharity.description}
              </p>
              {selCharity.events && selCharity.events.length > 0 && (
                <>
                  <div className="sec-label">Upcoming Events</div>
                  <div className="ch-events">
                    {selCharity.events.map((ev, i) => (
                      <div key={i} className="ch-event">
                        <div className="ch-event-dot" />{ev}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {selCharity.website && (
                <a href={selCharity.website} target="_blank" rel="noopener noreferrer"
                  className="btn btn-o" style={{ marginTop:14, display:"inline-flex" }}>
                  Visit Website →
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
  function Subscription() {
    const saved = (9.99 * 12 - 89.99).toFixed(2)
    // Track what plan user is selecting (may differ from current saved plan)
    const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">(plan)
    const planChanged = selectedPlan !== plan
    return (
      <div className="g2">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                Your <em>Plan</em>
              </div>
              <div className="card-sub">Billing & subscription management</div>
            </div>
          </div>
          <div className="ssbar">
            <div className={`ssbar-dot${subscribed ? " on" : " off"}`} />
            <div className="ssbar-info">
              <div className="ssbar-title">
                {subscribed ? "Subscription Active" : "No Active Subscription"}
              </div>
              <div className="ssbar-detail">
                {subscribed
                  ? `Renews ${subRenewal || "—"}`
                  : "Subscribe to access all features"}
              </div>
            </div>
            {subscribed && (
              <div className="ssbar-plan">
                {plan === "yearly" ? "Yearly" : "Monthly"}
              </div>
            )}
          </div>
          <div className="plan-opts">
            {(["monthly", "yearly"] as const).map((p) => (
              <div
                key={p}
                className={`plan-opt${selectedPlan === p ? " on" : ""}`}
                onClick={() => setSelectedPlan(p)}
              >
                {selectedPlan === p && <div className="po-tick">✓</div>}
                {/* Show "Current" badge if this is the active plan */}
                {plan === p && selectedPlan !== p && (
                  <div style={{
                    position:"absolute",top:9,right:10,
                    fontSize:8,letterSpacing:".1em",textTransform:"uppercase",
                    color:"var(--t5)",padding:"2px 6px",
                    border:"1px solid var(--b1)",borderRadius:20,
                  }}>Current</div>
                )}
                <div className="po-label">
                  {p === "monthly" ? (
                    "Monthly"
                  ) : (
                    <>
                      <span>Yearly</span>
                      <span className="po-badge">BEST</span>
                    </>
                  )}
                </div>
                <div className="po-price">
                  <sup>£</sup>
                  {p === "monthly" ? "9.99" : "89.99"}
                </div>
                <div className="po-cycle">
                  per {p === "monthly" ? "month" : "year"}
                </div>
                {p === "yearly" && (
                  <>
                    <div className="po-save">Only £{(89.99 / 12).toFixed(2)}/month</div>
                    <div className="po-save">Save £{saved} vs monthly</div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {!subscribed ? (
              <button
                className="btn btn-g btn-full"
                onClick={() => { setPlan(selectedPlan); SFX.confirm(); handleSubscribe() }}
              >
                Activate {selectedPlan === "yearly" ? "Yearly" : "Monthly"} Plan →
              </button>
            ) : (
              <>
                <button
                  className="btn btn-g"
                  style={{ flex: 1 }}
                  disabled={!planChanged}
                  onClick={() => handleChangePlan(selectedPlan)}
                >
                  {planChanged
                    ? `Switch to ${selectedPlan === "yearly" ? "Yearly" : "Monthly"} →`
                    : "Already on this plan"}
                </button>
                <button
                  className="btn btn-d"
                  onClick={() => setShowCancelModal(true)}
                >
                  Cancel Plan
                </button>
              </>
            )}
          </div>
          <div className="divider" />
          <div className="info-box">
            <strong>How the prize pool works:</strong> 60% of all subscription
            fees go into the draw pool. With {MEMBER_COUNT.toLocaleString()} members
            averaging £{AVG_FEE}, the pool this month is{" "}
            <strong>{fmt(POOL_TOTAL)}</strong>. Breakdown: 40% jackpot (
            <strong>{fmt(PRIZE_5)}</strong>) · 35% four-match (~
            {fmt(PRIZE_4)} per winner) · 25% three-match (~{fmt(PRIZE_3)} per
            winner). Prizes split equally between multiple winners per tier.
            Jackpot rolls over if unclaimed.
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                What's <em>Included</em>
              </div>
            </div>
          </div>
          <div className="feat-list">
            {[
              "Monthly prize draw — one entry per calendar month",
              "Rolling 5-score Stableford tracker with full stats",
              `Real prize pool: ${fmt(POOL_TOTAL)} this month`,
              "Charity contribution — minimum 10% of subscription",
              "Jackpot rolls over to next month if unclaimed",
              "Winner verification & payout within 72 hours",
              "Full draw history with matched number breakdown",
              "Independent charity donation option",
              "Cancel anytime — no commitment",
            ].map((f) => (
              <div key={f} className="feat-row">
                <div className="feat-icon">
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--green)"
                    strokeWidth="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="feat-text">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {showCancelModal && (
          <div
            className="overlay"
            onClick={(e) =>
              e.target === e.currentTarget && setShowCancelModal(false)
            }
          >
            <div className="modal">
              <div className="modal-title">
                Cancel <em>Subscription</em>
              </div>
              <div className="modal-desc">
                You will retain access until your renewal date (
                {subRenewal || "—"}). After that, score logging and draw
                entry will be disabled. Your data is preserved.
              </div>
              <div className="modal-warn">
                ⚠ You won't be able to participate in future draws after the
                renewal date.
              </div>
              <div className="modal-btns">
                <button className="btn btn-o" onClick={() => setShowCancelModal(false)}>
                  Keep Plan
                </button>
                <button
                  className="btn btn-d"
                  onClick={handleCancelSub}
                  disabled={settingsBusy}
                >
                  Cancel Subscription
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  function Wins() {
    if (drawHistory.length === 0)
      return (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                Win <em>History</em>
              </div>
              <div className="card-sub">All your previous draws</div>
            </div>
          </div>
          <div className="score-empty" style={{ padding: "32px 16px" }}>
            <p
              style={{
                fontFamily: "var(--serif)",
                fontSize: 30,
                color: "rgba(232,184,75,.12)",
                marginBottom: 7,
              }}
            >
              ◇
            </p>
            <p style={{ fontSize: 13, color: "var(--t5)" }}>
              No draws yet — run your first draw in Monthly Draw
            </p>
          </div>
        </div>
      )

    return (
      <div className="g2">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                Win <em>History</em>
              </div>
              <div className="card-sub">All previous draws · newest first</div>
            </div>
          </div>
          {drawHistory.map((d) => (
            <div key={d.id} className="win-row">
              <div className="win-month">{fmtMonth(d.month)}</div>
              <div className="win-balls">
                {d.drawn_numbers.map((n, j) => (
                  <div
                    key={j}
                    className={`win-ball${
                      d.matched_numbers.includes(n) ? " m" : ""
                    }`}
                  >
                    {n}
                  </div>
                ))}
              </div>
              <div className="win-match">
                {d.matched_numbers.length > 0
                  ? `${d.matched_numbers.length} matched`
                  : "No match"}
              </div>
              <div
                className="win-prize"
                style={d.prize === 0 ? { color: "var(--t6)" } : {}}
              >
                {d.prize > 0 ? fmt(d.prize) : "—"}
              </div>
              <div
                className={`win-status ${
                  d.status === "paid" ? "paid"
                  : d.status === "rejected" ? "rejected"
                  : d.prize > 0 ? "pending"
                  : "no"
                }`}
              >
                {d.status === "paid" ? "✓ Paid"
                  : d.status === "rejected" ? "Rejected"
                  : d.prize > 0 ? "Pending"
                  : "No win"}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                Wallet <em>Balance</em>
              </div>
            </div>
          </div>

          {/* Wallet balance highlight */}
          <div style={{
            padding:"20px",background:"rgba(232,184,75,.05)",
            border:"1px solid var(--b2)",borderRadius:"var(--r2)",
            marginBottom:16,textAlign:"center"
          }}>
            <div style={{fontSize:10,letterSpacing:".22em",textTransform:"uppercase",color:"var(--t5)",marginBottom:8}}>
              In-App Wallet
            </div>
            <div style={{fontFamily:"var(--serif)",fontSize:44,color:"var(--g1)",lineHeight:1}}>
              {fmt(walletBalance)}
            </div>
            <div style={{fontSize:12,color:"var(--green)",marginTop:6,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Credited instantly on every win
            </div>
          </div>

          <div
            className="g3"
            style={{ marginBottom: 16, borderRadius: "var(--r)", overflow: "hidden" }}
          >
            <div className="mini-cell">
              <div className="mini-lbl">Total Earned</div>
              <div className="mini-val">{fmt(totalWon)}</div>
            </div>
            <div className="mini-cell">
              <div className="mini-lbl">Draws</div>
              <div className="mini-val w">{drawHistory.length}</div>
            </div>
            <div className="mini-cell">
              <div className="mini-lbl">Win Rate</div>
              <div className="mini-val w">
                {drawHistory.length > 0
                  ? Math.round((drawHistory.filter((d) => d.prize > 0).length / drawHistory.length) * 100)
                  : 0}%
              </div>
            </div>
          </div>
          <div className="info-box">
            <strong>Claiming prizes:</strong> Upload a screenshot of your Stableford scores as proof. Admin verifies within 72 hours and marks your payout as paid — which credits your wallet. Contact <span style={{ color: "var(--g1)" }}>winners@fairwayflow.co.uk</span> for support.
          </div>
        </div>
      </div>
    )
  }

  function Settings() {
    return (
      <div className="settings-wrap">

        {/* ── Profile card ── */}
        <div className="set-section-card">
          <div className="set-profile-bar">
            <div className="set-avatar-lg">{initials}</div>
            <div>
              <div className="set-profile-name">{firstName}</div>
              <div className="set-profile-email">{user?.email}</div>
              <div className="set-profile-badge">
                <div style={{width:4,height:4,borderRadius:'50%',background:'var(--green)',animation:'pulse 2s infinite'}} />
                {subscribed ? "Active member" : "Inactive"}
              </div>
            </div>
          </div>

          <div className="set-body">
            <div className="set-field-row">
              <label>Email Address</label>
              <div className="set-field-input-row">
                <input
                  className="field-input"
                  type="email"
                  value={settingsEmail}
                  onChange={(e) => setSettingsEmail(e.target.value)}
                  placeholder={user?.email || "your@email.com"}
                />
                <button className="btn btn-g btn-sm" onClick={handleUpdateEmail} disabled={settingsBusy} style={{flexShrink:0}}>
                  Update
                </button>
              </div>
            </div>

            <div className="set-field-row">
              <label>New Password</label>
              <div className="set-field-input-row">
                <input
                  className="field-input"
                  type="password"
                  value={settingsPwd}
                  onChange={(e) => setSettingsPwd(e.target.value)}
                  placeholder="Min. 6 characters"
                />
                <button className="btn btn-g btn-sm" onClick={handleUpdatePassword} disabled={settingsBusy || settingsPwd.length < 6} style={{flexShrink:0}}>
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Notifications card ── */}
        <div className="set-section-card">
          <div className="set-section-header">
            <div className="set-section-icon blue">
              <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
            </div>
            <div>
              <div className="set-section-label">Notifications</div>
              <div className="set-section-sub">Email alerts & updates</div>
            </div>
          </div>
          <div className="set-body">
            {[
              { title: "Draw Result Emails", desc: "Get notified when the monthly draw result is published." },
              { title: "Winner Verification Alerts", desc: "Receive updates on your prize claim status." },
              { title: "Subscription Reminders", desc: "Renewal notices before your plan expires." },
            ].map((item) => (
              <div key={item.title} className="set-toggle-row">
                <div className="set-toggle-info">
                  <div className="set-toggle-title">{item.title}</div>
                  <div className="set-toggle-desc">{item.desc}</div>
                </div>
                <div className="set-toggle-pill on">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  On
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Data card ── */}
        <div className="set-section-card">
          <div className="set-section-header">
            <div className="set-section-icon gold">
              <svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            </div>
            <div>
              <div className="set-section-label">Data & Storage</div>
              <div className="set-section-sub">Manage your stored data</div>
            </div>
          </div>
          <div className="set-body">
            <div className="set-danger-row">
              <div className="set-danger-info">
                <div className="set-danger-title" style={{color:'var(--t1)'}}>Score History</div>
                <div className="set-danger-desc">
                  {scores.length === 0
                    ? "No scores stored."
                    : `${scores.length} score${scores.length !== 1 ? "s" : ""} stored. Clearing removes them permanently.`}
                </div>
              </div>
              <button className="btn btn-d btn-sm" onClick={() => setShowClearModal(true)} disabled={scores.length === 0} style={{flexShrink:0}}>
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* ── Account card ── */}
        <div className="set-section-card">
          <div className="set-section-header">
            <div className="set-section-icon red">
              <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <div className="set-section-label">Account</div>
              <div className="set-section-sub">Sign out or delete your account</div>
            </div>
          </div>
          <div className="set-body">
            <div className="set-danger-row">
              <div className="set-danger-info">
                <div className="set-danger-title" style={{color:'var(--t1)'}}>Sign Out</div>
                <div className="set-danger-desc">Sign out of this device. Your data is saved.</div>
              </div>
              <button className="btn btn-o btn-sm" onClick={handleLogout} style={{flexShrink:0}}>Sign Out</button>
            </div>
            <div className="set-danger-row">
              <div className="set-danger-info">
                <div className="set-danger-title" style={{color:'var(--red)'}}>Delete Account</div>
                <div className="set-danger-desc">Permanently removes your account, scores, draws, and subscription.</div>
              </div>
              <button className="btn btn-d btn-sm" onClick={() => { setDeleteConfirm(""); setShowDeleteModal(true) }} style={{flexShrink:0}}>
                Delete
              </button>
            </div>
          </div>
        </div>

        {showClearModal && (
          <div className="overlay" onClick={(e) => e.target === e.currentTarget && setShowClearModal(false)}>
            <div className="modal">
              <div className="modal-title">Clear <em>Score Logs</em></div>
              <div className="modal-desc">This will permanently delete all {scores.length} stored Stableford scores. Draw history and subscription are not affected.</div>
              <div className="modal-warn">⚠ This cannot be undone.</div>
              <div className="modal-btns">
                <button className="btn btn-o" onClick={() => setShowClearModal(false)}>Cancel</button>
                <button className="btn btn-d" onClick={handleClearScores} disabled={settingsBusy}>{settingsBusy ? "Clearing…" : "Yes, Clear"}</button>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="overlay" onClick={(e) => e.target === e.currentTarget && setShowDeleteModal(false)}>
            <div className="modal">
              <div className="modal-title">Delete <em>Account</em></div>
              <div className="modal-desc">Permanently deletes your account, all scores, draw history, and subscription. You will be signed out immediately.</div>
              <div className="modal-warn">⚠ Irreversible. Type <strong>DELETE</strong> to confirm.</div>
              <div className="field">
                <label>Confirm</label>
                <input
                  id="delete-confirm-input"
                  type="text"
                  defaultValue=""
                  placeholder="Type DELETE"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  style={{background:'rgba(255,255,255,.04)',border:'1px solid var(--b1)',color:'var(--t1)',fontSize:15,padding:'12px 14px',outline:'none',borderRadius:'var(--r)',width:'100%'}}
                />
              </div>
              <div className="modal-btns">
                <button className="btn btn-o" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                <button className="btn btn-d" disabled={settingsBusy} onClick={() => {
                  const val = (document.getElementById("delete-confirm-input") as HTMLInputElement)?.value
                  if (val !== "DELETE") {
                    toast('Type "DELETE" exactly to confirm.', "err")
                    return
                  }
                  handleDeleteAccount()
                }}>
                  {settingsBusy ? "Deleting…" : "Delete Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── ADMIN SECTIONS ────────────────────────────────────────────────────────

  function AdminOverview() {
    const activeCount = adminUsers.filter((u) => u.status === "active").length
    const cancelledCount = adminUsers.filter((u) => u.status === "cancelled").length
    const monthlyRevenue = adminUsers
      .filter((u) => u.status === "active")
      .reduce((a, u) => a + (u.plan === "monthly" ? 9.99 : 89.99 / 12), 0)
    const charityTotal = adminUsers
      .filter((u) => u.status === "active")
      .reduce((a, u) => a + (u.plan === "monthly" ? 9.99 : 89.99 / 12) * 0.15, 0)
    const pendingWinners = adminWinners.filter(
      (w) => !w.status || w.status === "pending"
    ).length

    return (
      <>
        <div className="g4">
          <div className="stat-cell">
            <div className="stat-lbl">Active Subscribers</div>
            <div className="stat-val gr">{activeCount}</div>
            <div className="stat-note">of {adminUsers.length} total accounts</div>
          </div>
          <div className="stat-cell">
            <div className="stat-lbl">Monthly Revenue</div>
            <div className="stat-val g">£{monthlyRevenue.toFixed(0)}</div>
            <div className="stat-note">est. this month</div>
          </div>
          <div className="stat-cell">
            <div className="stat-lbl">Prize Pool</div>
            <div className="stat-val g">{fmt(POOL_TOTAL)}</div>
            <div className="stat-note">60% of member fees</div>
          </div>
          <div className="stat-cell">
            <div className="stat-lbl">Pending Verifications</div>
            <div className="stat-val b">{pendingWinners}</div>
            <div className="stat-note">winners awaiting review</div>
          </div>
        </div>

        <div className="g2">
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">
                  Platform <em>Analytics</em>
                </div>
                <div className="card-sub">Key metrics overview</div>
              </div>
            </div>
            <div className="g4-3" style={{ marginBottom: 14, borderRadius: "var(--r)", overflow: "hidden" }}>
              <div className="mini-cell">
                <div className="mini-lbl">Monthly Plans</div>
                <div className="mini-val">
                  {adminUsers.filter((u) => u.plan === "monthly" && u.status === "active").length}
                </div>
              </div>
              <div className="mini-cell">
                <div className="mini-lbl">Yearly Plans</div>
                <div className="mini-val">
                  {adminUsers.filter((u) => u.plan === "yearly" && u.status === "active").length}
                </div>
              </div>
              <div className="mini-cell">
                <div className="mini-lbl">Cancelled</div>
                <div className="mini-val r">{cancelledCount}</div>
              </div>
              <div className="mini-cell">
                <div className="mini-lbl">Charity Pool</div>
                <div className="mini-val gr">£{charityTotal.toFixed(0)}</div>
              </div>
            </div>
            <div className="sec-label">Subscription Split</div>
            {["Monthly", "Yearly", "Cancelled"].map((label, i) => {
              const count = [
                adminUsers.filter((u) => u.plan === "monthly" && u.status === "active").length,
                adminUsers.filter((u) => u.plan === "yearly" && u.status === "active").length,
                cancelledCount,
              ][i]
              const pct = adminUsers.length
                ? Math.round((count / adminUsers.length) * 100)
                : 0
              return (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: "var(--t3)",
                      marginBottom: 4,
                    }}
                  >
                    <span>{label}</span>
                    <span>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="analytics-bar">
                    <div
                      className="analytics-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">
                  Quick <em>Actions</em>
                </div>
              </div>
            </div>
            <div className="stack">
              <button
                className="btn btn-b btn-full"
                onClick={() => setAdminSection("admin-winners")}
              >
                Review Pending Winners ({pendingWinners}) →
              </button>
              <button
                className="btn btn-o btn-full"
                onClick={() => setAdminSection("admin-draws")}
              >
                Manage Draw System →
              </button>
              <button
                className="btn btn-o btn-full"
                onClick={() => setAdminSection("admin-charities")}
              >
                Manage Charities →
              </button>
              <button
                className="btn btn-o btn-full"
                onClick={() => setAdminSection("admin-reports")}
              >
                View Reports →
              </button>
            </div>
            <div className="divider" />
            <div className="info-box blue">
              <strong>Admin credentials:</strong>
              <br />
              Email: {ADMIN_EMAIL}
              <br />
              Password: {ADMIN_PASSWORD}
            </div>
          </div>
        </div>
      </>
    )
  }

  function AdminUsers() {
    const [localSearch, setLocalSearch] = useState(adminSearch)
    const [editScoreUser, setEditScoreUser] = useState<string | null>(null)
    const [editScoreVal, setEditScoreVal] = useState(18)

    const filtered = adminUsers.filter((u) =>
      (u.user_email || "").toLowerCase().includes(localSearch.toLowerCase())
    )

    return (
      <div className="stack">
        <div className="admin-panel-card">
          <div className="admin-panel-head">
            <div className="admin-panel-title">
              User <em>Management</em>
            </div>
            <div className="card-badge blue">
              {adminUsers.length} accounts
            </div>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <div className="table-controls">
              <input
                className="search-input"
                placeholder="Search by email…"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
              />
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Renewal</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--t5)", padding: 24 }}>
                      No users found
                    </td>
                  </tr>
                )}
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td className="td-email">{u.user_email || u.user_id}</td>
                    <td>
                      <span
                        className={`card-badge${
                          u.plan === "yearly" ? " gold" : ""
                        }`}
                      >
                        {u.plan}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`card-badge${
                          u.status === "active"
                            ? " green"
                            : u.status === "cancelled"
                            ? " red"
                            : " amber"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--t4)" }}>
                      {u.renewal_date || "—"}
                    </td>
                    <td>
                      <div className="td-action">
                        {u.status === "active" && (
                          <button
                            className="btn btn-d btn-sm"
                            onClick={() => handleAdminCancelSub(u.user_id)}
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          className="btn btn-o btn-sm"
                          onClick={() => {
                            setEditScoreUser(u.user_id)
                            setEditScoreVal(18)
                          }}
                        >
                          Edit Scores
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {editScoreUser && (
          <div
            className="overlay"
            onClick={(e) =>
              e.target === e.currentTarget && setEditScoreUser(null)
            }
          >
            <div className="modal">
              <div className="modal-title">
                Edit <em>Score</em>
              </div>
              <div className="modal-desc">
                Enter the corrected score for user{" "}
                <strong style={{ color: "var(--g1)" }}>
                  {editScoreUser}
                </strong>
                . This will update their score record.
              </div>
              <div className="field">
                <label>Score (1–45)</label>
                <input
                  type="number"
                  min={1}
                  max={45}
                  value={editScoreVal}
                  onChange={(e) =>
                    setEditScoreVal(
                      Math.min(45, Math.max(1, parseInt(e.target.value) || 18))
                    )
                  }
                />
              </div>
              <div className="modal-btns">
                <button
                  className="btn btn-o"
                  onClick={() => setEditScoreUser(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-g"
                  onClick={() => {
                    handleAdminEditScore(editScoreUser, editScoreVal)
                    setEditScoreUser(null)
                  }}
                >
                  Save Score
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  function AdminDraws() {
    return (
      <div className="g2">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                Draw <em>Configuration</em>
              </div>
              <div className="card-sub">Configure & run the monthly draw</div>
            </div>
          </div>

          <div className="sim-controls">
            <div className="sim-label">Draw Month</div>
            <div className="sim-row">
              <input
                type="month"
                className="field input"
                value={adminDrawMonth}
                onChange={(e) => setAdminDrawMonth(e.target.value)}
                style={{
                  flex: 1,
                  background: "var(--bg)",
                  border: "1px solid var(--b1)",
                  color: "var(--t1)",
                  padding: "9px 12px",
                  outline: "none",
                  borderRadius: "var(--r)",
                  fontSize: 14,
                }}
              />
              <div className="sim-tag">{fmtMonth(adminDrawMonth)}</div>
            </div>
            <div className="sim-label" style={{ marginTop: 8 }}>
              Draw Logic
            </div>
            <div className="sim-row" style={{ gap: 8 }}>
              {["Random", "Weighted Algorithm"].map((mode) => (
                <div
                  key={mode}
                  style={{
                    flex: 1,
                    padding: "9px 14px",
                    background: mode === "Random" ? "rgba(232,184,75,.09)" : "var(--bg)",
                    border: `1px solid ${mode === "Random" ? "var(--b2)" : "var(--b1)"}`,
                    borderRadius: "var(--r)",
                    fontSize: 12,
                    color: mode === "Random" ? "var(--g1)" : "var(--t4)",
                    cursor: "pointer",
                    textAlign: "center" as const,
                  }}
                >
                  {mode}
                </div>
              ))}
            </div>
          </div>

          <button className="btn btn-b btn-full" onClick={handleAdminRunSim}>
            Run Simulation / Pre-Analysis →
          </button>

          {adminSimResult && (
            <>
              <div className="divider" />
              <div className="sec-label">Simulation Result</div>
              <div style={{ marginBottom: 14 }}>
                <div className="balls" style={{ marginBottom: 8 }}>
                  {adminSimResult.nums.map((n, i) => (
                    <div
                      key={i}
                      className="ball done"
                      style={{ width: 46, height: 46, fontSize: 17 }}
                    >
                      {n}
                    </div>
                  ))}
                </div>
                <div className="info-box">
                  Simulated draw produced{" "}
                  <strong style={{ color: "var(--g1)" }}>
                    {adminSimResult.simulatedWinners}
                  </strong>{" "}
                  estimated winner
                  {adminSimResult.simulatedWinners !== 1 ? "s" : ""} across
                  all tiers.
                </div>
              </div>
              <button
                className="btn btn-g btn-full"
                onClick={handleAdminPublishDraw}
                disabled={adminDrawPublished}
              >
                {adminDrawPublished
                  ? "✓ Draw Published"
                  : "Publish Official Draw →"}
              </button>
            </>
          )}

          <div className="divider" />
          <div className="info-box warn">
            <strong>Jackpot rollover:</strong>{" "}
            {jackpotRolledOver
              ? "Jackpot is currently rolled over from a previous month."
              : "No jackpot rollover active."}{" "}
            <span
              style={{ color: "var(--g1)", cursor: "pointer", textDecoration: "underline" }}
              onClick={() => {
                setJackpotRolledOver((v) => !v)
                toast(
                  jackpotRolledOver
                    ? "Jackpot rollover cleared."
                    : "Jackpot rollover activated.",
                  "gold"
                )
              }}
            >
              {jackpotRolledOver ? "Clear rollover" : "Activate rollover"}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                Prize Pool <em>Breakdown</em>
              </div>
              <div className="card-sub">{fmtMonth(adminDrawMonth)}</div>
            </div>
          </div>
          <div
            className="g3"
            style={{ marginBottom: 16, borderRadius: "var(--r)", overflow: "hidden" }}
          >
            <div className="mini-cell">
              <div className="mini-lbl">Total Pool</div>
              <div className="mini-val">{fmt(POOL_TOTAL)}</div>
            </div>
            <div className="mini-cell">
              <div className="mini-lbl">Members</div>
              <div className="mini-val w">{MEMBER_COUNT.toLocaleString()}</div>
            </div>
            <div className="mini-cell">
              <div className="mini-lbl">Pool %</div>
              <div className="mini-val w">60%</div>
            </div>
          </div>
          <div className="feat-list">
            {[
              ["5-Match Jackpot (40%)", fmt(PRIZE_5), jackpotRolledOver ? " + rollover" : ""],
              ["4-Match Pool (35%)", fmt(PRIZE_4) + " est/winner", ""],
              ["3-Match Pool (25%)", fmt(PRIZE_3) + " est/winner", ""],
            ].map(([label, val, note]) => (
              <div key={label} className="feat-row" style={{ justifyContent: "space-between" }}>
                <span className="feat-text">{label}</span>
                <span
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 17,
                    color: "var(--g1)",
                  }}
                >
                  {val}
                  {note && (
                    <span style={{ fontSize: 10, color: "var(--amber)" }}>
                      {note}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function AdminCharities() {
    return (
      <div className="stack">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 2,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: ".24em", textTransform: "uppercase", color: "var(--g1)" }}>
            {adminCharities.length} charities listed
          </div>
          <button
            className="btn btn-g btn-sm"
            onClick={() => setShowAddCharity(true)}
          >
            + Add Charity
          </button>
        </div>

        {adminCharities.map((c) => (
          <div key={c.id} className="charity-admin-row">
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 3,
                }}
              >
                <span style={{ fontSize: 14, color: "var(--t1)", fontWeight: 400 }}>
                  {c.name}
                </span>
                {c.featured && (
                  <span className="card-badge gold">Featured</span>
                )}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--t5)",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                }}
              >
                {c.cat}
              </div>
              {c.description && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--t4)",
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  {c.description.slice(0, 80)}…
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                className="btn btn-o btn-sm"
                onClick={() => setEditCharity({ ...c })}
              >
                Edit
              </button>
              <button
                className="btn btn-amber btn-sm"
                onClick={() => {
                  setAdminCharities((prev) =>
                    prev.map((x) =>
                      x.id === c.id ? { ...x, featured: !x.featured } : x
                    )
                  )
                  toast(
                    c.featured ? "Removed from featured." : "Set as featured.",
                    "gold"
                  )
                }}
              >
                {c.featured ? "Unfeature" : "Feature"}
              </button>
              <button
                className="btn btn-d btn-sm"
                onClick={() => handleAdminDeleteCharity(c.id)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        {/* Add Charity Modal */}
        {showAddCharity && (
          <div
            className="overlay"
            onClick={(e) =>
              e.target === e.currentTarget && setShowAddCharity(false)
            }
          >
            <div className="modal wide">
              <div className="modal-title">
                Add <em>Charity</em>
              </div>
              <div className="field">
                <label>Charity Name *</label>
                <input
                  type="text"
                  placeholder="e.g. British Red Cross"
                  value={newCharity.name}
                  onChange={(e) =>
                    setNewCharity((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label>Category *</label>
                <input
                  type="text"
                  placeholder="e.g. Humanitarian Aid"
                  value={newCharity.cat}
                  onChange={(e) =>
                    setNewCharity((p) => ({ ...p, cat: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea
                  rows={3}
                  placeholder="Brief description of the charity's mission…"
                  value={newCharity.description}
                  onChange={(e) =>
                    setNewCharity((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,.035)",
                    border: "1px solid var(--b1)",
                    color: "var(--t1)",
                    padding: "12px 14px",
                    outline: "none",
                    borderRadius: "var(--r)",
                    resize: "vertical",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                />
              </div>
              <div className="modal-btns">
                <button
                  className="btn btn-o"
                  onClick={() => setShowAddCharity(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-g" onClick={handleAdminAddCharity}>
                  Add Charity →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Charity Modal */}
        {editCharity && (
          <div
            className="overlay"
            onClick={(e) =>
              e.target === e.currentTarget && setEditCharity(null)
            }
          >
            <div className="modal wide">
              <div className="modal-title">
                Edit <em>Charity</em>
              </div>
              <div className="field">
                <label>Name</label>
                <input
                  type="text"
                  value={editCharity.name}
                  onChange={(e) =>
                    setEditCharity((p) => p && { ...p, name: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Category</label>
                <input
                  type="text"
                  value={editCharity.cat}
                  onChange={(e) =>
                    setEditCharity((p) => p && { ...p, cat: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea
                  rows={3}
                  value={editCharity.description}
                  onChange={(e) =>
                    setEditCharity((p) =>
                      p && { ...p, description: e.target.value }
                    )
                  }
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,.035)",
                    border: "1px solid var(--b1)",
                    color: "var(--t1)",
                    padding: "12px 14px",
                    outline: "none",
                    borderRadius: "var(--r)",
                    resize: "vertical",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                />
              </div>
              <div className="field">
                <label>Website URL</label>
                <input
                  type="url"
                  value={editCharity.website || ""}
                  placeholder="https://…"
                  onChange={(e) =>
                    setEditCharity((p) =>
                      p && { ...p, website: e.target.value }
                    )
                  }
                />
              </div>
              <div className="modal-btns">
                <button className="btn btn-o" onClick={() => setEditCharity(null)}>
                  Cancel
                </button>
                <button className="btn btn-g" onClick={handleAdminSaveCharity}>
                  Save Changes →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  function AdminWinners() {
    const pending = adminWinners.filter(
      (w) => !w.status || w.status === "pending"
    )
    const processed = adminWinners.filter(
      (w) => w.status === "paid" || w.status === "rejected"
    )

    const WinnerBlock = ({
      w,
      showActions,
    }: {
      w: DrawRecord
      showActions: boolean
    }) => {
      const matchCount = w.matched_numbers?.length || 0
      const cls =
        matchCount === 5 ? "win-jackpot" : matchCount === 4 ? "win-4" : "win-3"
      return (
        <div className={`winner-card ${cls}`}>
          <div className="winner-card-head">
            <div>
              <div className="winner-email">
                {w.user_email || w.user_id}
              </div>
              <div className="winner-meta">
                {fmtMonth(w.month)} · {matchCount}-match ·{" "}
                {fmtDate(w.created_at)}
              </div>
            </div>
            <div className="winner-prize">{fmt(w.prize)}</div>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, marginBottom: 6 }}>
            {w.drawn_numbers?.map((n, j) => (
              <div
                key={j}
                className={`dhr-ball${
                  w.matched_numbers?.includes(n) ? " m" : ""
                }`}
              >
                {n}
              </div>
            ))}
          </div>
          {w.proof_url && (
            <div className="proof-thumb">
              📎 Proof submitted —{" "}
              <a
                href={w.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--blue)", textDecoration: "underline" }}
              >
                View file
              </a>
            </div>
          )}
          <div
            className={`dhr-status ${
              w.status === "paid"
                ? "paid"
                : w.status === "rejected"
                ? "rejected"
                : "pending"
            }`}
            style={{ marginTop: 8, display: "inline-block" }}
          >
            {w.status === "paid"
              ? "✓ Paid"
              : w.status === "rejected"
              ? "✗ Rejected"
              : "⏳ Pending Verification"}
          </div>
          {showActions && (
            <div className="winner-actions">
              <button
                className="btn btn-g btn-sm"
                onClick={() => handleAdminVerifyWinner(w.id, true)}
              >
                ✓ Approve & Mark Paid
              </button>
              <button
                className="btn btn-d btn-sm"
                onClick={() => handleAdminVerifyWinner(w.id, false)}
              >
                ✗ Reject
              </button>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="g2">
        <div>
          <div className="sec-label" style={{ marginBottom: 12 }}>
            Pending Verification ({pending.length})
          </div>
          {pending.length === 0 ? (
            <div className="info-box green">
              No pending verifications — all winners have been processed.
            </div>
          ) : (
            pending.map((w) => (
              <WinnerBlock key={w.id} w={w} showActions={true} />
            ))
          )}
        </div>
        <div>
          <div className="sec-label" style={{ marginBottom: 12 }}>
            Processed ({processed.length})
          </div>
          {processed.length === 0 ? (
            <div
              className="score-empty"
              style={{ padding: 20, border: "1px dashed rgba(232,184,75,.1)", borderRadius: "var(--r)" }}
            >
              <p style={{ fontSize: 13, color: "var(--t5)" }}>
                No processed winners yet
              </p>
            </div>
          ) : (
            processed.map((w) => (
              <WinnerBlock key={w.id} w={w} showActions={false} />
            ))
          )}
        </div>
      </div>
    )
  }

  function AdminReports() {
    const totalRevenue = adminUsers
      .filter((u) => u.status === "active")
      .reduce((a, u) => a + (u.plan === "monthly" ? 9.99 : 89.99 / 12), 0)
    const charityContrib = totalRevenue * 0.15
    const prizesPaid = adminWinners
      .filter((w) => w.status === "paid")
      .reduce((a, w) => a + w.prize, 0)

    return (
      <div className="g2">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                Financial <em>Report</em>
              </div>
              <div className="card-sub">Current month estimate</div>
            </div>
          </div>
          <div className="g3" style={{ marginBottom: 16, borderRadius: "var(--r)", overflow: "hidden" }}>
            <div className="mini-cell">
              <div className="mini-lbl">Gross Revenue</div>
              <div className="mini-val">£{totalRevenue.toFixed(0)}</div>
            </div>
            <div className="mini-cell">
              <div className="mini-lbl">Prize Pool</div>
              <div className="mini-val">{fmt(POOL_TOTAL)}</div>
            </div>
            <div className="mini-cell">
              <div className="mini-lbl">Charity Pot</div>
              <div className="mini-val gr">£{charityContrib.toFixed(0)}</div>
            </div>
          </div>
          <div className="feat-list">
            {[
              ["Active Subscribers", adminUsers.filter((u) => u.status === "active").length.toString()],
              [
                "Monthly Plan Revenue",
                "£" +
                  adminUsers
                    .filter((u) => u.plan === "monthly" && u.status === "active")
                    .reduce((a) => a + 9.99, 0)
                    .toFixed(0),
              ],
              [
                "Yearly Plan Revenue (pro-rated)",
                "£" +
                  adminUsers
                    .filter((u) => u.plan === "yearly" && u.status === "active")
                    .reduce((a) => a + 89.99 / 12, 0)
                    .toFixed(0),
              ],
              ["Total Prizes Paid", fmt(prizesPaid)],
              ["Pending Prizes", fmt(adminWinners.filter((w) => !w.status || w.status === "pending").reduce((a, w) => a + w.prize, 0))],
              ["Total Charity Contributions", "£" + charityContrib.toFixed(2)],
            ].map(([label, val]) => (
              <div
                key={label}
                className="feat-row"
                style={{ justifyContent: "space-between" }}
              >
                <span className="feat-text">{label}</span>
                <span
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 17,
                    color: "var(--g1)",
                  }}
                >
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                Draw <em>Statistics</em>
              </div>
            </div>
          </div>
          <div className="g3" style={{ marginBottom: 16, borderRadius: "var(--r)", overflow: "hidden" }}>
            <div className="mini-cell">
              <div className="mini-lbl">Total Draws</div>
              <div className="mini-val w">
                {adminWinners.length}
              </div>
            </div>
            <div className="mini-cell">
              <div className="mini-lbl">Jackpot Wins</div>
              <div className="mini-val">
                {adminWinners.filter((w) => w.matched_numbers?.length === 5).length}
              </div>
            </div>
            <div className="mini-cell">
              <div className="mini-lbl">4-Match Wins</div>
              <div className="mini-val w">
                {adminWinners.filter((w) => w.matched_numbers?.length === 4).length}
              </div>
            </div>
          </div>
          <div className="info-box">
            <strong>Data accuracy:</strong> All prize pool calculations are based on{" "}
            {MEMBER_COUNT.toLocaleString()} active members at £{AVG_FEE} average
            subscription, with 60% allocated to the prize pool. Reports update in
            real-time as users subscribe and draws are processed.
          </div>
          <div className="divider" />
          <div className="info-box blue">
            <strong>Scalability note:</strong> The architecture supports multi-country
            expansion, team/corporate accounts, and a campaign module. The database
            schema is designed for a future mobile app version.
          </div>
        </div>
      </div>
    )
  }

  // ── Nav definitions ───────────────────────────────────────────────────────

  const USER_NAV: {
    id: NavSection
    label: string
    group: string
    icon: React.ReactNode
  }[] = [
    {
      id: "overview",
      label: "Overview",
      group: "Main",
      icon: (
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      id: "scores",
      label: "My Scores",
      group: "Main",
      icon: (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 15" />
        </svg>
      ),
    },
    {
      id: "draw",
      label: "Monthly Draw",
      group: "Main",
      icon: (
        <svg viewBox="0 0 24 24">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
    {
      id: "charity",
      label: "Charity",
      group: "Account",
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      ),
    },
    {
      id: "subscription",
      label: "Subscription",
      group: "Account",
      icon: (
        <svg viewBox="0 0 24 24">
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
    },
    {
      id: "wins",
      label: "Winnings",
      group: "Account",
      icon: (
        <svg viewBox="0 0 24 24">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      group: "Account",
      icon: (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
    },
  ]

  const ADMIN_NAV: {
    id: AdminSection
    label: string
    group: string
    icon: React.ReactNode
  }[] = [
    {
      id: "admin-overview",
      label: "Overview",
      group: "Admin",
      icon: (
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      id: "admin-users",
      label: "Users",
      group: "Admin",
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
    },
    {
      id: "admin-draws",
      label: "Draw System",
      group: "Admin",
      icon: (
        <svg viewBox="0 0 24 24">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
    {
      id: "admin-charities",
      label: "Charities",
      group: "Admin",
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      ),
    },
    {
      id: "admin-winners",
      label: "Winners",
      group: "Admin",
      icon: (
        <svg viewBox="0 0 24 24">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
    },
    {
      id: "admin-reports",
      label: "Reports",
      group: "Admin",
      icon: (
        <svg viewBox="0 0 24 24">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
  ]

  const USER_TITLES: Record<NavSection, React.ReactNode> = {
    overview: (
      <>
        Good {greeting}, <em>{firstName}.</em>
      </>
    ),
    scores: (
      <>
        My <em>Scores</em>
      </>
    ),
    draw: (
      <>
        Monthly <em>Draw</em>
      </>
    ),
    charity: (
      <>
        Charity <em>Portal</em>
      </>
    ),
    subscription: (
      <>
        Your <em>Plan</em>
      </>
    ),
    wins: (
      <>
        Win <em>History</em>
      </>
    ),
    settings: (
      <>
        Account <em>Settings</em>
      </>
    ),
  }

  const ADMIN_TITLES: Record<AdminSection, React.ReactNode> = {
    "admin-overview": (
      <>
        Admin <em>Overview</em>
      </>
    ),
    "admin-users": (
      <>
        User <em>Management</em>
      </>
    ),
    "admin-draws": (
      <>
        Draw <em>System</em>
      </>
    ),
    "admin-charities": (
      <>
        Charity <em>Management</em>
      </>
    ),
    "admin-winners": (
      <>
        Winner <em>Verification</em>
      </>
    ),
    "admin-reports": (
      <>
        Reports & <em>Analytics</em>
      </>
    ),
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="noise" />

      {/* Toasts */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-dot" />
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── LOADING ── */}
      {view === "loading" && (
        <div className="screen-loading page-fade">
          <div className="loading-logo">
            Fairway <em>Flow</em>
          </div>
          <div className="loading-tagline">
            Golf · Charity · Monthly Draws
          </div>
          <div className="loading-bar">
            <div className="loading-fill" />
          </div>
        </div>
      )}

      {/* ── AUTH ── */}
      {view === "auth" && (
        <div className="screen-auth page-fade">
          <div className="auth-hero">
            <div className="auth-hero-logo">
              Fairway <em>Flow</em>
            </div>
            <div className="auth-badge">
              <div className="auth-badge-dot" />
              Live — {MEMBER_COUNT.toLocaleString()} active members
            </div>
            <h1>
              Play Golf.
              <em>Win Big.</em>
            </h1>
            <p>
              The UK's premier golf subscription combining Stableford scoring,
              monthly prize draws, and meaningful charity giving.
            </p>
            <div className="auth-perks">
              {[
                `Monthly prize pool — ${fmt(POOL_TOTAL)} this month`,
                "Track your last 5 Stableford scores",
                "Support a charity of your choice",
                `Jackpot up to ${fmt(PRIZE_5)} — match all 5`,
                "Cancel anytime, no commitment",
              ].map((p) => (
                <div key={p} className="auth-perk">
                  <div className="perk-line" />
                  <span className="perk-text">{p}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-panel">
            {/* Mobile-only header shown when hero is hidden */}
            <div className="auth-mob-header">
              <div className="auth-mob-logo">Fairway <em>&</em> Forward</div>
              <div className="auth-mob-tag">Golf · Charity · Monthly Draws</div>
              <div className="auth-mob-perks">
                {[
                  `${fmt(POOL_TOTAL)} prize pool this month`,
                  `Jackpot up to ${fmt(PRIZE_5)}`,
                  "Track your Stableford scores",
                  "Support a charity you believe in",
                ].map((p) => (
                  <div key={p} className="auth-mob-perk">
                    <div className="auth-mob-perk-dot" />
                    {p}
                  </div>
                ))}
              </div>
            </div>
            <div className="auth-box">
              <div className="auth-tabs">
                {(["login", "signup"] as AuthMode[]).map((m) => (
                  <button
                    key={m}
                    className={`auth-tab${authMode === m ? " active" : ""}`}
                    onClick={() => {
                      setAuthMode(m)
                      setAuthErr("")
                    }}
                  >
                    {m === "login" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              <div className="auth-heading">
                {authMode === "login" ? "Welcome back" : "Join the club"}
              </div>
              <p className="auth-sub">
                {authMode === "login"
                  ? "Sign in to access your scorecard and draws."
                  : "Create your account and enter this month's draw."}
              </p>

              <div className="field">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                  autoComplete="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {authErr && <div className="field-error">{authErr}</div>}
              </div>
              <button
                className="btn-gold"
                onClick={() => { SFX.confirm(); handleAuth() }}
                disabled={authBusy}
              >
                {authBusy
                  ? "Please wait…"
                  : authMode === "login"
                  ? "Sign In →"
                  : "Create Account →"}
              </button>

              <div className="auth-switch">
                {authMode === "login" ? "No account? " : "Already a member? "}
                <button
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "signup" : "login")
                    setAuthErr("")
                  }}
                >
                  {authMode === "login" ? "Sign up free" : "Sign in"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBSCRIBE ── */}
      {view === "subscribe" && (
        <div className="screen-sub page-fade">
          <div className="sub-logo">
            Fairway <em>Flow</em>
          </div>
          <h1 className="sub-headline">
            Choose Your <em>Plan</em>
          </h1>
          <p className="sub-desc">
            Select a plan to get started. No payment required — activate instantly and begin playing.
          </p>

          <div className="plans">
            {(["monthly", "yearly"] as const).map((p) => (
              <div
                key={p}
                className={`plan${plan === p ? " active" : ""}`}
                onClick={() => { SFX.select(); setPlan(p) }}
              >
                {p === "yearly" && (
                  <div className="plan-badge">Best Value — Save £{(9.99 * 12 - 89.99).toFixed(2)}</div>
                )}
                <div className="plan-label">{p === "monthly" ? "Monthly" : "Yearly"}</div>
                <div className="plan-price">
                  <sup>£</sup>
                  {p === "monthly" ? <>9<span className="dec">.99</span></> : <>89<span className="dec">.99</span></>}
                </div>
                <div className="plan-cycle">{p === "monthly" ? "per month" : "per year"}</div>
                {p === "yearly" && <div className="plan-save">Only £{(89.99 / 12).toFixed(2)}/month</div>}
                <div className="plan-tick">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#120E00" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          <div className="sub-features">
            {[
              "Score tracking (5 rolling)",
              "Monthly prize draw",
              `In-app prizes up to ${fmt(PRIZE_5)}`,
              "Charity contribution",
              "Win history & analytics",
              "Jackpot rollover",
              "Instant in-app payouts",
              "Cancel anytime",
            ].map((f) => (
              <div key={f} className="sub-feat">
                <div className="feat-chk">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                {f}
              </div>
            ))}
          </div>
          <button className="btn-sub" onClick={() => { SFX.confirm(); handleSubscribe() }}>
            Start {plan === "yearly" ? "Yearly" : "Monthly"} Plan →
          </button>
          <button className="sub-back" onClick={handleLogout}>
            ← Sign out / switch account
          </button>
        </div>
      )}

      {/* ── USER DASHBOARD ── */}
      {view === "dashboard" && (
        <div className="db">
          {/* Mobile drawer overlay */}
          <div className={`mob-overlay${mobDrawerOpen ? " open" : ""}`} onClick={() => setMobDrawerOpen(false)} />
          {/* Mobile slide-in drawer */}
          <div className={`mob-drawer${mobDrawerOpen ? " open" : ""}`}>
            <div className="mob-drawer-head">
              <div className="mob-drawer-logo">Fairway <em>&</em> Forward</div>
              <button className="mob-drawer-close" onClick={() => setMobDrawerOpen(false)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <nav className="mob-drawer-nav">
              {["Main", "Account"].map((grp) => (
                <div key={grp}>
                  <div className="sb-grp-label">{grp}</div>
                  {USER_NAV.filter((n) => n.group === grp).map((n) => (
                    <button key={n.id} className={`sb-link${section === n.id ? " on" : ""}`}
                      onClick={() => { SFX.nav(); setSection(n.id); setMobDrawerOpen(false) }}>
                      {n.icon}{n.label}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
            <div className="mob-drawer-user">
              <div className="mob-drawer-user-row">
                <div className="sb-avatar">{initials}</div>
                <div>
                  <div className="sb-user-name">{firstName}</div>
                  <div className="sb-user-email">{user?.email}</div>
                </div>
              </div>
              <div className={`sb-status${subscribed ? " active" : " inactive"}`} style={{marginBottom:10}}>
                <div className="sb-status-dot" />{subscribed ? "Active" : "Inactive"}
              </div>
              <button className="sb-logout" onClick={handleLogout}>
                <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign Out
              </button>
            </div>
          </div>

          <aside className="sidebar">
            <div className="sb-brand">
              <div className="sb-brand-name">Fairway <em>&</em> Forward</div>
              <div className="sb-brand-sub">Member Dashboard</div>
            </div>
            <nav className="sb-nav">
              {["Main", "Account"].map((grp) => (
                <div key={grp}>
                  <div className="sb-grp-label">{grp}</div>
                  {USER_NAV.filter((n) => n.group === grp).map((n) => (
                    <button key={n.id} className={`sb-link${section === n.id ? " on" : ""}`} onClick={() => { SFX.nav(); setSection(n.id) }}>
                      {n.icon}{n.label}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
            <div className="sb-footer">
              <div className="sb-user">
                <div className="sb-avatar">{initials}</div>
                <div>
                  <div className="sb-user-name">{firstName}</div>
                  <div className="sb-user-email">{user?.email}</div>
                </div>
              </div>
              <div className={`sb-status${subscribed ? " active" : " inactive"}`}>
                <div className="sb-status-dot" />
                {subscribed ? "Active" : "Inactive"}
              </div>
              <button className="sb-logout" onClick={handleLogout}>
                <svg viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          </aside>
          <main className="main">
            <div className="topbar">
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <button className="mob-menu-btn" onClick={() => setMobDrawerOpen(true)}>
                  <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <div className="topbar-title">{USER_TITLES[section]}</div>
              </div>
              <div className="topbar-right">
                <div className="topbar-meta">{today}</div>
              </div>
            </div>
            <div className="content">
              <div key={section} className="page-enter">
                {section === "overview" && <Overview />}
                {section === "scores" && <Scores />}
                {section === "draw" && <Draw />}
                {section === "charity" && <Charity />}
                {section === "subscription" && <Subscription />}
                {section === "wins" && <Wins />}
                {section === "settings" && <Settings />}
              </div>
            </div>
          </main>

          {/* Mobile bottom navigation — shows 5 primary items */}
          <nav className="mob-bottom-nav">
            {[
              { id: "overview" as NavSection, label: "Home", icon: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
              { id: "scores" as NavSection, label: "Scores", icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg> },
              { id: "draw" as NavSection, label: "Draw", icon: <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
              { id: "charity" as NavSection, label: "Charity", icon: <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> },
              { id: "settings" as NavSection, label: "More", icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/></svg>, isMore: true },
            ].map((item) => (
              <button key={item.id}
                className={`mob-nav-item${(item.isMore ? ["subscription","wins","settings"].includes(section) : section === item.id) ? " on" : ""}${item.isMore ? " mob-nav-more" : ""}`}
                onClick={() => { if (item.isMore) { SFX.drawer(); setMobDrawerOpen(true) } else { SFX.nav(); setSection(item.id) } }}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* ── ADMIN DASHBOARD ── */}
      {view === "admin" && (
        <div className="db">
          {/* Mobile drawer for admin */}
          <div className={`mob-overlay${mobDrawerOpen ? " open" : ""}`} onClick={() => setMobDrawerOpen(false)} />
          <div className={`mob-drawer${mobDrawerOpen ? " open" : ""}`}>
            <div className="mob-drawer-head">
              <div className="mob-drawer-logo">Fairway <em>&</em> Forward</div>
              <button className="mob-drawer-close" onClick={() => setMobDrawerOpen(false)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <nav className="mob-drawer-nav">
              <div className="sb-grp-label">Administration</div>
              {ADMIN_NAV.map((n) => (
                <button key={n.id} className={`sb-link${adminSection === n.id ? " on" : ""}`}
                  onClick={() => { SFX.nav(); setAdminSection(n.id); setMobDrawerOpen(false) }}>
                  {n.icon}{n.label}
                </button>
              ))}
            </nav>
            <div className="mob-drawer-user">
              <div className="mob-drawer-user-row">
                <div className="sb-avatar admin-av">AD</div>
                <div>
                  <div className="sb-user-name">Admin</div>
                  <div className="sb-user-email">{user?.email}</div>
                </div>
              </div>
              <button className="sb-logout" onClick={handleLogout}>
                <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign Out
              </button>
            </div>
          </div>

          <aside className="sidebar admin-mode">
            <div className="sb-brand">
              <div className="sb-brand-name">
                Fairway <em>Flow</em>
              </div>
              <div className="sb-brand-sub admin">Admin Panel</div>
            </div>
            <nav className="sb-nav">
              <div className="sb-grp-label">Administration</div>
              {ADMIN_NAV.map((n) => (
                <button
                  key={n.id}
                  className={`sb-link${adminSection === n.id ? " on" : ""}`}
                  onClick={() => { SFX.nav(); setAdminSection(n.id) }}
                >
                  {n.icon}
                  {n.label}
                </button>
              ))}
            </nav>
            <div className="sb-footer">
              <div className="sb-user">
                <div className="sb-avatar admin-av">AD</div>
                <div>
                  <div className="sb-user-name">Admin</div>
                  <div className="sb-user-email">{user?.email}</div>
                </div>
              </div>
              <div className="sb-status admin-status">
                <div className="sb-status-dot" />
                Administrator
              </div>
              <button className="sb-logout" onClick={handleLogout}>
                <svg viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          </aside>
          <main className="main">
            <div className="topbar">
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <button className="mob-menu-btn" onClick={() => setMobDrawerOpen(true)}>
                  <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <div className="topbar-title">{ADMIN_TITLES[adminSection]}</div>
              </div>
              <div className="topbar-right">
                <div className="topbar-pill admin-pill">Admin Mode</div>
                <div className="topbar-meta">{today}</div>
              </div>
            </div>
            <div className="content">
              <div key={adminSection} className="page-enter">
                {adminSection === "admin-overview" && <AdminOverview />}
                {adminSection === "admin-users" && <AdminUsers />}
                {adminSection === "admin-draws" && <AdminDraws />}
                {adminSection === "admin-charities" && <AdminCharities />}
                {adminSection === "admin-winners" && <AdminWinners />}
                {adminSection === "admin-reports" && <AdminReports />}
              </div>
            </div>
          </main>
        </div>
      )}
    </>
  )
}