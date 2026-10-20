// ==UserScript==
// @name         Dot Ads
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Chặn quảng cáo với một chạm.
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_listValues
// @grant        GM.listValues
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

(async function () {
    'use strict';
    const CONFIG = {
        allow: [],
        names: ['smartbanner', 'app-banner', 'cookie-popup', '*adsbygoogle*'],
        texts: ['Tải ứng dụng', 'Quảng cáo'],
        hosts: [
            'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.',
            'pagead2.', 'googletagservices.com', '/adsbygoogle.js', '/pagead/', 'taboola.com', 'outbrain.com',
            'popads.net', 'popcash.net', 'propellerads.com', 'onclickads.net', 'exoclick.com', 'exosrv.com',
            'juicyads.com', 'adsterra.com', 'mgid.com', 'revcontent.com', 'adnxs.com', 'criteo.com', 'criteo.net',
            'pubmatic.com', 'rubiconproject.com', 'openx.net', 'amazon-adsystem.com', 'zedo.com', 'adform.net',
            'an.yandex.', 'smartadserver.com', 'adsco.re', 'a-ads.com', 'hilltopads', 'clickadu.com',
            'trafficjunky.net', 'tsyndicate.com', 'ad-maven', 'admaven.com', 'adcash.com', 'mondiad.com',
            'richpush.co', 'pushnami.com', 'adskeeper.com', 'bidvertiser.com', 'yllix.com', 'monetag.com',
            'profitablecpm', 'effectivecpm', 'effectivegatecpm', 'highperformanceformat', 'topcreativeformat',
            'profitablegate', 'highcpmgate', 'cpmgate', 'ratecpm', 'acscdn.com', 'onclkds.com', 'realsrv.com',
            'magsrv.com', 'adtng.com', 'tmrjmp.com', 'plugrush.com', 'trafficstars.com', 'adspyglass.com',
            'ero-advertising.com', 'adsrvr.org', 'casalemedia.com', 'indexww.com', 'bidswitch.net', 'rtbhouse.com',
            'adtima.vn', 'eclick.vn', 'adnow.com', 'ad.plus', 'pushails.com', 'clickaine.com', 'adf.ly',
            'shorte.st', 'ouo.io', 'linkvertise.com', 'cpmstar.com', 'displayvertising.com', 'jads.co',
            'adstune.com', 'ad-delivery.net', 'applovin.com', 'adcolony.com', 'coinzilla',
            'galaksion.com', 'clickadilla.com', 'evadav.com', 'onclickmega.com', 'richads.com', 'rollerads.com',
            'trafficfactory.biz', 'zeropark.com', 'dolohen.com', 'adexchangeclear', 'adxadserv',
            'bet365', 'popcdn', 'popunder',
            '/aclib', 'popmagic', '/popunder', '/pop-under', '/clickunder'
        ],
        links: ['tinyurl', 'bit.ly', 'cutt.ly', 'shorturl', 'bet', 'win']
    };

    const DOT_SIDE = 'left', DOT_X = 18, DOT_Y = 14;

    try { if (window.self !== window.top || window.frameElement) return; } catch (e) { return; }
    if (location.protocol === 'about:' || window.__gdarLoaded) return;
    window.__gdarLoaded = true;

    if (!document.documentElement) {
        await new Promise(res => {
            const mo = new MutationObserver(() => { if (document.documentElement) { mo.disconnect(); res(); } });
            mo.observe(document, { childList: true });
        });
    }

    const LEGACY_SITE_KEY = 'gdar_rules', CACHE_KEY = 'gdar_cache', HOST = location.hostname, SITE_PREFIX = 'site:';
    const HOLD_MS = 400, TOGGLE_DELAY = 1500, RED_MS = 150, PICK_MS = 250, MOVE_TOL = 10;
    const ATTR = 'data-gdar', INV_ATTR = 'data-gdar-inv', PICK_ATTR = 'data-gdar-pick', PRESS_ATTR = 'data-gdar-press';
    const LNK_ATTR = 'data-gdar-lk', TOUCH_ATTR = 'data-gdar-t', LNK_HREF = 'data-gdar-href', GUARD_ATTR = 'data-gdar-g';
    const Q_ATTR = 'data-gdar-q', MARK = 'data-gdar-m', OK_ATTR = 'data-gdar-ok';
    const DECIDE_MS = 1500, GUARD_MS = 20000, WATCH_MS = 3000, INV_SCAN_MS = 400, MEDIA_SWEEP_MS = 500, LEARN_MAX = 40;
    const AUTO_WORDS = ['ad', 'ads', 'adv', 'popup', 'banner', 'app-download', 'float'];
    const NAME_RE = /^\*?[\w-]+\*?$/;
    const INV_SEL = 'a[href],area[href],iframe';
    const MEDIA_SEL = 'video,audio';
    const MEDIA_IN = 'img,video,canvas,svg,picture,iframe,input,button,textarea,select,audio,object,embed';
    const HIDE = 'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important';
    const QHIDE = 'clip-path:inset(100%)!important;-webkit-clip-path:inset(100%)!important;pointer-events:none!important';
    const NOT_ME = ':not(html,body,#gdar-host)';
    const NOT_POPUP_TAG = /^(HEAD|BODY|HTML|SCRIPT|STYLE|LINK|META|NOSCRIPT|TEMPLATE|MAIN|HEADER|FOOTER|NAV|ARTICLE|FORM)$/;
    const STOP_ID = /^(app|root|__next|__nuxt|wrapper|page|content|container)$/i;
    const SKIP_TAG = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/;
    const DYN_RE = /\d{4,}|^gdar/i;
    const ATTRS = ['alt', 'title', 'aria-label'];
    const ATTR_SEL = ATTRS.map(a => `[${a}]`).join(',');

    const SUSPECT = [
        'dialog', '[role=dialog]', '[role=alertdialog]', '[aria-modal=true]', 'iframe',
        ...['popup', 'pop-up', 'modal', 'overlay', 'lightbox', 'interstitial', 'backdrop', 'dialog']
            .flatMap(w => [`[id*="${w}" i]`, `[class*="${w}" i]`]),
        ...['mask', 'promo', 'welcome', 'announce', 'swal', 'drawer'].map(w => `[class*="${w}" i]`),
        '[class~="fixed"]', '[class*="inset-0"]', '[class*="z-50"]', '[class*="z-["]', '[class*="z-9"]',
        '[style*="fixed" i]', '[style*="2147483" i]'
    ].join(',');

    const hasGM = typeof GM !== 'undefined' && GM;
    const gmGet = (hasGM && typeof GM.getValue === 'function') ? (k, d) => GM.getValue(k, d)
        : (typeof GM_getValue === 'function' ? (k, d) => Promise.resolve(GM_getValue(k, d)) : null);
    const gmSet = (hasGM && typeof GM.setValue === 'function') ? (k, v) => GM.setValue(k, v)
        : (typeof GM_setValue === 'function' ? (k, v) => Promise.resolve(GM_setValue(k, v)) : null);
    const GMOK = !!(gmGet && gmSet);

    const gmGetSync = k => {
        try {
            if (typeof GM_getValue !== 'function') return null;
            let v = GM_getValue(k, null);
            if (v && typeof v.then === 'function') return null;
            if (typeof v === 'string') v = JSON.parse(v);
            return (v && typeof v === 'object') ? v : null;
        } catch (e) { return null; }
    };

    const DEF_SET = { on: true, auto: true, pick: true, deep: true, links: true, pop: true };
    const DEF_RULES = () => ({ sel: [], txt: [], lnk: [] });
    const DEF_LEARN = () => ({ l: [], p: [] });
    const strArr = a => (Array.isArray(a) ? a.filter(x => typeof x === 'string') : []);

    const normSet = o => {
        const s = Object.assign({}, DEF_SET, o);
        if (o && 'ovl' in o) s.pop = !!(s.pop || o.ovl);
        delete s.ovl;
        delete s.light;
        return s;
    };
    const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
    const normRules = o => { const r = DEF_RULES(); Object.keys(r).forEach(k => { r[k] = strArr(o && o[k]); }); return r; };
    const normLearn = o => {
        const r = DEF_LEARN();
        if (o && Array.isArray(o.l)) r.l = o.l.filter(x => x && typeof x.s === 'string' && typeof x.k === 'string').slice(-LEARN_MAX);
        r.p = strArr(o && o.p).filter(Boolean).slice(-LEARN_MAX);
        return r;
    };

    let writing = 0;
    const gReadRaw = async k => {
        try {
            let v = GMOK ? await gmGet(k, null) : localStorage.getItem('gdar_' + k);
            if (typeof v === 'string') v = JSON.parse(v);
            return (v && typeof v === 'object') ? v : null;
        } catch (e) { return null; }
    };
    const gRead = async (k, d) => { const v = await gReadRaw(k); return v ? Object.assign({}, d, v) : d; };
    const gWrite = (k, o) => {
        if (k === 'settings') o._t = Date.now();
        writeCache();
        let p;
        try {
            const s = JSON.stringify(o);
            if (GMOK) p = Promise.resolve(gmSet(k, s));
            else { localStorage.setItem('gdar_' + k, s); p = Promise.resolve(); }
        } catch (e) { p = Promise.resolve(); }
        writing++;
        return p.catch(() => {}).then(() => { writing--; });
    };
    const siteKey = SITE_PREFIX + HOST, learnKey = 'learn:' + HOST;
    const siteWrite = () => gWrite(siteKey, site);
    const learnWrite = () => gWrite(learnKey, learn);
    const writeCache = () => lsSet(CACHE_KEY, { set, glb, site, learn });

    const syncSet = gmGetSync('settings'), syncGlb = gmGetSync('global');
    const syncSite = gmGetSync(siteKey), syncLearn = gmGetSync(learnKey);
    const cache = lsGet(CACHE_KEY) || {};
    const newer = (a, b) => (a && b) ? ((b._t || 0) > (a._t || 0) ? b : a) : (a || b || null);
    let set = normSet(newer(syncSet, cache.set));
    let glb = normRules(syncGlb || cache.glb);
    let site = normRules(syncSite || cache.site || lsGet(LEGACY_SITE_KEY));
    let learn = normLearn(syncLearn || cache.learn);
    if (syncSet || syncGlb || syncSite || syncLearn) writeCache();
    let scope = 'all', tab = 'sel', shieldUntil = 0;
    const shieldOn = () => set.on || Date.now() < shieldUntil;
    let uiReady = false, hostEl = null, dotEl = null;
    let promote = () => {}, render = () => {};
    let keys = [], lkeys = [], lastRules = null;
    let lnkBlocked = 0, budget = 0;

    const pickOn = () => !!(set.on && set.pick);
    const cur = () => (scope === 'all' ? glb : site);
    const saveCur = () => (scope === 'all' ? gWrite('global', glb) : siteWrite());

    const SHIELD = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerover', 'pointerout',
        'pointerenter', 'pointerleave', 'gotpointercapture', 'lostpointercapture',
        'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'click',
        'auxclick', 'dblclick', 'contextmenu', 'touchstart', 'touchmove', 'touchend', 'touchcancel',
        'gesturestart', 'gesturechange', 'gestureend', 'selectstart', 'dragstart',
        'keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'focus', 'blur', 'focusin', 'focusout'];
    const MOVE_RE = /^(pointer|mouse)move$/;
    const GHOST = { touchend: 1, mouseup: 1, mousedown: 1, click: 1 };
    const HND = Object.create(null);
    const bind = (el, type, fn) => { (HND[type] || (HND[type] = new WeakMap())).set(el, fn); };
    const inHost = e => !!hostEl && (e.target === hostEl || hostEl.contains(e.target));
    const stamp = () => { try { document.documentElement.setAttribute(TOUCH_ATTR, String(Date.now())); } catch (e) {} };
    SHIELD.forEach(t => window.addEventListener(t, e => {
        if (!inHost(e)) return;
        if (shieldOn() && !MOVE_RE.test(t)) stamp();
        const path = e.composedPath(), tg = path[0];
        if (dotEl && GHOST[t] && e.cancelable && path.includes(dotEl)) e.preventDefault();
        const m = HND[t];
        if (m) for (const n of path) {
            const f = m.get(n);
            if (f) f.call(n, e, tg);
            if (n === hostEl) break;
        }
        e.stopImmediatePropagation();
    }, { capture: true, passive: false }));

    let gestured = false, rafQ = false;
    const T0 = Date.now();
    const guardOn = () => !gestured && Date.now() - T0 < GUARD_MS;
    const fresh = new Set(), watch = new Map();

    function syncGuard() {
        const de = document.documentElement;
        if (!de) return;
        if (set.on && set.pop && guardOn()) { if (!de.hasAttribute(GUARD_ATTR)) de.setAttribute(GUARD_ATTR, ''); }
        else de.removeAttribute(GUARD_ATTR);
    }
    function endGuard() {
        if (gestured) return;
        gestured = true;
        try { document.querySelectorAll(`[${Q_ATTR}]`).forEach(e => e.removeAttribute(Q_ATTR)); } catch (e) {}
        fresh.clear(); watch.clear();
        syncGuard();
    }
    ['touchstart', 'pointerdown', 'mousedown', 'keydown'].forEach(t =>
        window.addEventListener(t, e => { if (e.isTrusted) endGuard(); }, true));
    setTimeout(() => { fresh.clear(); watch.clear(); syncGuard(); }, GUARD_MS + 50);

    const cssEsc = s => (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&');
    const clsOf = el => {
        const c = typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '';
        return c.trim().replace(/\s+/g, ' ');
    };
    const inHostNode = el => !!(el.closest && el.closest('#gdar-host'));
    const attrEsc = s => String(s).replace(/["\\]/g, '\\$&');
    const vpSize = () => [window.innerWidth || document.documentElement.clientWidth || 0,
        window.innerHeight || document.documentElement.clientHeight || 0];
    const hideAll = a => a.map(s => `${s}{${HIDE}}`).join('\n');
    const tryQ = (fn, d) => { try { return fn(); } catch (e) { return d; } };
    const eachMatch = (root, sel, fn) => tryQ(() => {
        if (root.nodeType === 1 && root.matches(sel)) fn(root);
        if (root.querySelectorAll) root.querySelectorAll(sel).forEach(fn);
    });
    const classSel = (el, n, strict) => clsOf(el).split(' ')
        .filter(c => c && c.length <= 40 && !DYN_RE.test(c) && (!strict || NAME_RE.test(c)))
        .slice(0, n).map(c => '.' + cssEsc(c)).join('');
    const okId = el => el.id && NAME_RE.test(el.id) && !DYN_RE.test(el.id);

    function nameToSel(n) {
        n = String(n || '').trim();
        if (!n) return '';
        const partial = n.startsWith('*') || n.endsWith('*');
        const v = attrEsc(n.replace(/^\*+|\*+$/g, ''));
        if (!v) return '';
        return partial ? `[id*="${v}" i],[class*="${v}" i],[name*="${v}" i]`
            : `[id="${v}" i],[class~="${v}" i],[name="${v}" i]`;
    }
    const toCss = s => (NAME_RE.test(s) ? nameToSel(s) : s);

    const BUILTIN_SEL = (CONFIG.names || []).map(nameToSel).filter(Boolean);
    const BUILTIN_CSS = hideAll(BUILTIN_SEL);
    const BUILTIN_TXT = (CONFIG.texts || []).map(t => String(t).trim().toLowerCase()).filter(Boolean);

    const AUTO_SEL = (() => {
        const out = [];
        ['id', 'class'].forEach(a => AUTO_WORDS.forEach(w => {
            out.push(`[${a}~="${w}" i]`, `[${a}^="${w}-" i]`, `[${a}^="${w}_" i]`,
                `[${a}$="-${w}" i]`, `[${a}$="_${w}" i]`, `[${a}*="-${w}-" i]`, `[${a}*="_${w}_" i]`,
                `[${a}*=" ${w}-" i]`, `[${a}*=" ${w}_" i]`, `[${a}*="-${w} " i]`, `[${a}*="_${w} " i]`);
        }));
        return `:is(${out.join(',')})${NOT_ME}`;
    })();
    const AUTO_CSS = `${AUTO_SEL}{${HIDE}}`;

    const parseMulti = raw => {
        const out = [];
        String(raw || '').split(/[;\n]+/).forEach(x => { x = x.trim(); if (x && !out.includes(x)) out.push(x); });
        return out;
    };

    const PAGE_CSS = `
        [${ATTR}],[${INV_ATTR}]{${HIDE}}
        html[${PICK_ATTR}] *{-webkit-touch-callout:none!important}
        html[${PICK_ATTR}] img{-webkit-user-drag:none!important}
        html[${PRESS_ATTR}],html[${PRESS_ATTR}] *{-webkit-user-select:none!important;user-select:none!important;
            -webkit-touch-callout:none!important}`;

    const mkStyle = () => document.createElement('style');
    const page = mkStyle(), autoStyle = mkStyle(), ruleStyle = mkStyle();
    page.textContent = PAGE_CSS;
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

    let adopted = null;
    try { adopted = new CSSStyleSheet(); } catch (e) {}
    const setAdopted = css => { if (adopted) tryQ(() => adopted.replaceSync(css)); };
    const attachAdopted = () => {
        if (!adopted) return;
        tryQ(() => {
            const list = document.adoptedStyleSheets;
            if (!list.includes(adopted)) document.adoptedStyleSheets = [...list, adopted];
        });
    };

    const probe = document.createDocumentFragment();
    const validSel = s => tryQ(() => { probe.querySelector(s); return true; }, false);

    let killSel = '', popKillSel = '';
    const publishRules = () => tryQ(() => document.documentElement.setAttribute(LNK_ATTR, JSON.stringify(lastRules)));

    const calcKeys = () => {
        keys = [...BUILTIN_TXT, ...glb.txt, ...site.txt].map(t => t.toLowerCase());
        lkeys = [...(CONFIG.links || []), ...glb.lnk, ...site.lnk].map(t => String(t).trim().toLowerCase()).filter(Boolean);
        const res = [...(CONFIG.hosts || []).map(h => h.toLowerCase()), ...lkeys.filter(k => /[.\/]/.test(k))];
        lastRules = {
            on: shieldOn(), keys: set.links ? lkeys : [], res, pop: !!set.pop, ovl: !!set.pop,
            allow: (CONFIG.allow || []).map(x => String(x).toLowerCase()), kill: killSel
        };
        publishRules();
    };

    const learnSels = () => (!set.on ? [] : learn.l.filter(x => keys.includes(x.k) && validSel(x.s)).map(x => x.s));
    const learnPops = () => learn.p.filter(validSel);
    const learnActive = () => learnSels().length + learnPops().length;

    const attrSel = () => {
        if (!set.on || !keys.length) return '';
        const sels = [];
        keys.forEach(k => { const v = attrEsc(k); if (v) ATTRS.forEach(a => sels.push(`[${a}*="${v}" i]`)); });
        return sels.length ? `:is(${sels.join(',')})${NOT_ME}` : '';
    };

    const buildCss = () => {
        autoStyle.textContent = (set.on && set.auto) ? AUTO_CSS : '';
        const userSels = [...glb.sel, ...site.sel].map(toCss).filter(validSel);
        const ls = learnSels(), as = attrSel();
        ruleStyle.textContent = set.on ? [BUILTIN_CSS, hideAll(userSels), hideAll(ls), as ? `${as}{${HIDE}}` : ''].join('\n') : '';
        killSel = set.on ? [...BUILTIN_SEL, ...userSels, ...ls, (set.auto ? AUTO_SEL : '')].filter(Boolean).join(',') : '';
        if (lastRules) { lastRules.kill = killSel; publishRules(); }

        let guardCss = '';
        popKillSel = '';
        if (set.on && set.pop) {
            const ps = learnPops();
            if (ps.length) guardCss += `html[${GUARD_ATTR}] :is(${ps.join(',')})${NOT_ME}{${HIDE}}\n`;
            guardCss += `html[${GUARD_ATTR}] :is(${SUSPECT}):not([${OK_ATTR}],html,body,#gdar-host){${QHIDE}}\n`;
            guardCss += `html[${GUARD_ATTR}] [${Q_ATTR}]${NOT_ME}{${QHIDE}}`;
            popKillSel = ps.join(',');
        }
        setAdopted([PAGE_CSS, autoStyle.textContent, ruleStyle.textContent, guardCss].join('\n'));
    };

    const ensureStyles = () => {
        const de = document.documentElement;
        if (!de) return;
        [page, autoStyle, ruleStyle, fontLink].forEach(s => { if (!s.isConnected) de.appendChild(s); });
        attachAdopted();
        if (hostEl && !hostEl.isConnected) { de.appendChild(hostEl); promote(); }
        if (lastRules && !de.hasAttribute(LNK_ATTR)) publishRules();
        if (set.on && set.pop && guardOn() && !de.hasAttribute(GUARD_ATTR)) de.setAttribute(GUARD_ATTR, '');
    };

    calcKeys(); buildCss(); ensureStyles(); syncGuard();

    const hush = m => tryQ(() => {
        m.setAttribute(MARK, '');
        m.muted = true; m.volume = 0; m.autoplay = false;
        m.removeAttribute('autoplay');
        if (!m.paused) { const r = m.pause(); if (r && r.catch) r.catch(() => {}); }
    });
    const stopMedia = el => {
        const f = m => {
            hush(m);
            tryQ(() => {
                m.querySelectorAll('source').forEach(s => s.removeAttribute('src'));
                m.removeAttribute('src');
                if (m.srcObject) m.srcObject = null;
                if (m.load) m.load();
            });
        };
        if (el.matches && el.matches(MEDIA_SEL)) f(el);
        if (el.querySelectorAll) el.querySelectorAll(MEDIA_SEL).forEach(f);
    };
    function kill(el) {
        if (!el || el.nodeType !== 1 || el === document.body || el === document.documentElement || inHostNode(el)) return false;
        try { stopMedia(el); el.remove(); if (!el.isConnected) return true; } catch (e) {}
        el.setAttribute(ATTR, '');
        return false;
    }
    const purgePop = root => {
        if (!popKillSel || !set.on || !set.pop || !root || !guardOn()) return;
        eachMatch(root, popKillSel, e => { if (kill(e)) unlockScroll(); });
    };
    const purgeSel = root => { if (set.on && killSel && root) eachMatch(root, killSel, kill); };

    const sameSite = h => { const me = location.hostname.toLowerCase(); return h === me || h.endsWith('.' + me) || me.endsWith('.' + h); };
    const parseExt = u => {
        if (!u) return null;
        let o;
        try { o = new URL(String(u), location.href); } catch (e) { return null; }
        return (/^https?:$/.test(o.protocol) && !sameSite(o.hostname.toLowerCase())) ? o : null;
    };
    const HOST_KEYS = (CONFIG.hosts || []).map(h => String(h).toLowerCase());
    const hitKeys = (o, list) => {
        const h = o.hostname.toLowerCase();
        const full = h + o.pathname.toLowerCase() + o.search.toLowerCase();
        return list.some(k => (/[\/?=&]/.test(k) ? full.includes(k) : h.includes(k)));
    };
    const urlBad = u => {
        if (!set.on) return false;
        const o = parseExt(u);
        return !!o && (hitKeys(o, HOST_KEYS) || !!(set.links && lkeys.length && hitKeys(o, lkeys)));
    };
    const AD_SRC_SEL = 'iframe[src],embed[src],object[data],script[src],img[src],video[src],audio[src],source[src]';
    const adSrcBad = u => { if (!set.on || !u) return false; const o = parseExt(u); return !!o && hitKeys(o, HOST_KEYS); };
    const purgeAdSrc = root => {
        if (!set.on || !root) return;
        eachMatch(root, AD_SRC_SEL, e => {
            if (!adSrcBad(e.getAttribute('src') || e.getAttribute('data'))) return;
            if (e.tagName === 'SCRIPT') tryQ(() => { e.type = 'javascript/blocked'; });
            kill(e.tagName === 'SOURCE' && e.parentElement && e.parentElement.matches(MEDIA_SEL) ? e.parentElement : e);
        });
    };
    const purgeMeta = root => {
        if (!set.on || !set.pop || !root) return;
        eachMatch(root, 'meta[http-equiv="refresh" i]', m => {
            const u = ((m.getAttribute('content') || '').match(/url\s*=\s*['"]?([^'";\s]+)/i) || [])[1];
            if (u && parseExt(u)) kill(m);
        });
    };
    const neutralize = a => {
        const h = a.getAttribute && a.getAttribute('href');
        if (h && urlBad(h) && !inHostNode(a)) { a.setAttribute(LNK_HREF, h); a.removeAttribute('href'); }
    };
    const neutralizeIn = root => { if (set.on && root) eachMatch(root, 'a[href],area[href]', neutralize); };
    const linkSweep = () => {
        document.querySelectorAll(`[${LNK_HREF}]`).forEach(a => {
            const o = a.getAttribute(LNK_HREF);
            if (!urlBad(o)) { a.setAttribute('href', o); a.removeAttribute(LNK_HREF); }
        });
        neutralizeIn(document.documentElement);
    };

    let intent = null;
    const hostOf = u => tryQ(() => new URL(String(u), location.href).hostname.toLowerCase(), '');
    function restoreIntent() {
        const it = intent;
        if (!it || !set.on || !set.pop) return;
        if (Date.now() - it.t > 4000) { intent = null; return; }
        const a = it.a;
        if (!a.isConnected) return;
        tryQ(() => {
            const h = a.getAttribute('href');
            if (h !== it.href && it.href != null && parseExt(h) && hostOf(h) !== it.host) {
                a.setAttribute('href', it.href);
                lnkBlocked++;
                if (uiReady) render();
            }
            const tg = a.getAttribute('target');
            if (tg !== it.tgt && /_blank/i.test(tg || '')) {
                if (it.tgt == null) a.removeAttribute('target'); else a.setAttribute('target', it.tgt);
            }
        });
    }
    ['pointerdown', 'touchstart', 'mousedown', 'pointerup', 'touchend', 'mouseup', 'click'].forEach(t =>
        window.addEventListener(t, e => {
            if (!e.isTrusted || !set.on || !set.pop) return;
            const el = e.target;
            if (!el || el.nodeType !== 1 || inHostNode(el)) return;
            const a = el.closest && el.closest('a[href]');
            if (!a) return;
            const now = Date.now();
            if (!intent || intent.a !== a || now - intent.t > 4000)
                intent = { a, href: a.getAttribute('href'), tgt: a.getAttribute('target'), host: hostOf(a.href), t: now };
            else restoreIntent();
        }, { capture: true, passive: true }));

    ['click', 'auxclick'].forEach(t => window.addEventListener(t, e => {
        const el = e.target;
        if (!el || !el.closest || inHostNode(el)) return;
        const a = el.closest('a[href],area[href],a[' + LNK_HREF + ']');
        if (a && urlBad(a.getAttribute('href') || a.getAttribute(LNK_HREF))) {
            e.preventDefault();
            e.stopImmediatePropagation();
            lnkBlocked++;
            if (uiReady) render();
        }
    }, true));

    function pageShield(W, INIT, MARK_PW) {
        if (W.__gdarShield) return;
        W.__gdarShield = true;
        const D = W.document, de = D.documentElement;
        let raw = '', R = INIT || null;
        const rules = () => {
            const e = D.documentElement;
            const s = (e && e.getAttribute('data-gdar-lk')) || '';
            if (s && s !== raw) { raw = s; try { R = JSON.parse(s); } catch (x) {} }
            return R;
        };
        const parse = u => {
            try { const o = new W.URL(String(u), W.location.href); return /^https?:$/.test(o.protocol) ? o : null; }
            catch (e) { return null; }
        };
        const same = h => { const me = W.location.hostname.toLowerCase(); return h === me || h.endsWith('.' + me) || me.endsWith('.' + h); };
        const OKHOST = /(^|\.)(accounts\.google\.com|appleid\.apple\.com|login\.microsoftonline\.com|login\.live\.com|github\.com|discord\.com|paypal\.com|stripe\.com|vnpay\.vn|vnpayment\.vn|momo\.vn|zalopay\.vn|facebook\.com)$/i;
        const AD_URL = /popunder|clickunder|pop[-_]?under|utm_medium=pop/i;
        const AD_SIG = /popMagic|PopMagic|aclib\.runPop|ExoLoader|atOptions\s*=|popunder|clickunder|pop_under|\brunPop\b|HilltopAds|adsterra|ad-maven|admaven/i;
        const okHost = h => { const r = rules(); return OKHOST.test(h) || !!(r && r.allow && r.allow.some(k => h === k || h.endsWith('.' + k))); };
        const hit = (o, list) => {
            const h = o.hostname.toLowerCase();
            const full = h + o.pathname.toLowerCase() + o.search.toLowerCase();
            return list.some(k => /[\/?=&]/.test(k) ? full.includes(k) : h.includes(k));
        };
        const badNav = u => {
            const r = rules();
            if (!r || !r.on || !u) return false;
            const o = parse(u);
            if (!o || same(o.hostname.toLowerCase())) return false;
            return !!((r.keys && r.keys.length && hit(o, r.keys)) || (r.res && r.res.length && hit(o, r.res)));
        };
        const badRes = u => {
            const r = rules();
            if (!r || !r.on || !r.res || !u) return false;
            const o = parse(u);
            return !!o && !same(o.hostname.toLowerCase()) && hit(o, r.res);
        };
        const locked = ms => {
            const r = rules(), e = D.documentElement;
            return !!(r && r.on) && Date.now() - (+(e && e.getAttribute('data-gdar-t')) || 0) < (ms || 3000);
        };

        let gT = 0, gOK = false, gHref = '', gDepth = 0, popSig = 0, gIsoT = 0, tapN = 0, hijT = 0;
        ['pointerdown', 'touchstart', 'mousedown', 'click', 'keydown'].forEach(t => W.addEventListener(t, e => {
            if (!e.isTrusted) return;
            const el = e.target;
            if (el && el.id === 'gdar-host') return;
            const now = Date.now();
            if (now - gT > 800) tapN++;
            gT = now;
            gOK = !!(el && el.closest && el.closest('a[href],button,[role=button],input,select,summary,label'));
            const a = el && el.closest && el.closest('a[href]');
            const rh = a ? (a.getAttribute('href') || '') : '';
            gHref = (a && rh && !/^(#|javascript:)/i.test(rh)) ? a.href : '';
            if (gHref && !gIsoT) gIsoT = gT;
        }, { capture: true, passive: true }));
        const popOK = () => Date.now() - gT < 1500 && gOK;
        const isolate = ev => {
            const r = rules();
            return !!(r && r.on && r.pop && gIsoT && gHref && ev && ev.isTrusted && Date.now() - gIsoT < 1500);
        };
        const markHijack = () => { if (tapN === 1 && !gOK && !gHref && Date.now() - gT < 1500) hijT = Date.now(); };

        const gestureLink = o => {
            if (!gHref || Date.now() - gT > 3000) return false;
            const g = parse(gHref);
            return !!g && g.origin === o.origin && g.pathname === o.pathname;
        };
        const samePage = o => { const L = W.location; return o.origin === L.origin && o.pathname === L.pathname && o.search === L.search; };
        const navBad = o => {
            const r = rules();
            if (!r || !r.on || !o) return false;
            if (badNav(o.href) || AD_URL.test(o.href) || locked(6000)) return true;
            const h = o.hostname.toLowerCase();
            if (same(h) || okHost(h) || !r.pop) return false;
            return !gestureLink(o);
        };
        const popBlocked = u => {
            const r = rules();
            return !!(r && r.on) && (locked() || badNav(u) || (!!r.pop && !popOK()));
        };
        const fakeWin = () => new Proxy(function () {}, {
            get: (t, k) => (k === 'closed' ? false : (typeof k === 'symbol' || k === 'then') ? undefined : fakeWin()),
            set: () => true, apply: () => undefined
        });

        const WATCH = { SCRIPT: 1, IFRAME: 1, IMG: 1, LINK: 1, SOURCE: 1, EMBED: 1, OBJECT: 1, VIDEO: 1, AUDIO: 1, TRACK: 1 };
        const blockEl = el => {
            try { if (el.tagName === 'SCRIPT') el.type = 'javascript/blocked'; } catch (e) {}
            W.setTimeout(() => { try { el.dispatchEvent(new W.Event('load')); } catch (e) {} }, 0);
        };
        const sa = W.Element.prototype.setAttribute;
        W.Element.prototype.setAttribute = function (n, v) {
            if (WATCH[this.tagName] && typeof n === 'string') {
                const l = n.toLowerCase();
                if ((l === 'src' || l === 'href' || l === 'data') && badRes(v)) { blockEl(this); return; }
                if (l === 'src' && (this.tagName === 'VIDEO' || this.tagName === 'AUDIO') && isAdMedia(this)) return;
            }
            return sa.apply(this, arguments);
        };
        const defSet = (P, p, wrap) => {
            const d = P && Object.getOwnPropertyDescriptor(P, p);
            if (!d || !d.set) return;
            Object.defineProperty(P, p, { configurable: true, enumerable: d.enumerable, get: d.get, set: wrap(d) });
        };
        [['HTMLScriptElement', 'src'], ['HTMLIFrameElement', 'src'], ['HTMLImageElement', 'src'],
         ['HTMLLinkElement', 'href'], ['HTMLSourceElement', 'src'], ['HTMLEmbedElement', 'src'],
         ['HTMLObjectElement', 'data'], ['HTMLMediaElement', 'src']].forEach(x => {
            const C = W[x[0]];
            defSet(C && C.prototype, x[1], d => function (v) { if (badRes(v)) { blockEl(this); return; } return d.set.call(this, v); });
        });

        const MP = W.HTMLMediaElement && W.HTMLMediaElement.prototype;
        const gd = n => MP && Object.getOwnPropertyDescriptor(MP, n);
        const dMu = gd('muted'), dVo = gd('volume'), dAu = gd('autoplay');
        const isAdMedia = m => {
            try {
                const r = rules();
                if (!r || !r.on || !m) return false;
                if (m.hasAttribute('data-gdar-m')) return true;
                const s = m.getAttribute('src') || m.currentSrc || '';
                if (s && badRes(s)) return true;
                if (m.isConnected) {
                    if (m.closest('[data-gdar],[data-gdar-inv]')) return true;
                    if (r.kill && m.closest(r.kill)) return true;
                }
            } catch (e) {}
            return false;
        };
        const hushMedia = m => {
            try { sa.call(m, 'data-gdar-m', ''); } catch (e) {}
            try { if (dMu && dMu.set) dMu.set.call(m, true); } catch (e) {}
            try { if (dVo && dVo.set) dVo.set.call(m, 0); } catch (e) {}
            try { if (dAu && dAu.set) dAu.set.call(m, false); } catch (e) {}
            try { m.removeAttribute('autoplay'); } catch (e) {}
            try { if (!m.paused) m.pause(); } catch (e) {}
        };
        if (MP) {
            const pl0 = MP.play;
            if (pl0) MP.play = function () {
                if (isAdMedia(this)) { hushMedia(this); return W.Promise.resolve(); }
                return pl0.apply(this, arguments);
            };
            [['src', () => true], ['srcObject', v => !!v], ['autoplay', v => !!v], ['muted', v => !v], ['volume', v => +v > 0]]
                .forEach(([name, risky]) => defSet(MP, name, d => function (v) {
                    if (risky(v) && isAdMedia(this)) { hushMedia(this); return; }
                    return d.set.call(this, v);
                }));
        }
        try {
            const A0 = W.Audio;
            if (A0) {
                const A = function (s) {
                    const a = new A0();
                    if (s != null) {
                        if (badRes(s)) { try { sa.call(a, 'data-gdar-m', ''); } catch (e) {} }
                        else a.src = s;
                    }
                    return a;
                };
                A.prototype = A0.prototype;
                W.Audio = A;
            }
        } catch (e) {}

        const f0 = W.fetch;
        if (f0) W.fetch = function (i) {
            const u = i && i.url ? i.url : i;
            if (badRes(u)) return W.Promise.resolve(new W.Response('', { status: 200 }));
            return f0.apply(this, arguments);
        };
        const xo = W.XMLHttpRequest && W.XMLHttpRequest.prototype.open;
        if (xo) W.XMLHttpRequest.prototype.open = function () {
            const a = [].slice.call(arguments);
            if (badRes(a[1])) a[1] = 'data:text/plain,';
            return xo.apply(this, a);
        };
        const sb = W.Navigator && W.Navigator.prototype.sendBeacon;
        if (sb) W.Navigator.prototype.sendBeacon = function (u) { if (badRes(u)) return true; return sb.apply(this, arguments); };

        const strip = s => {
            if (typeof s !== 'string' || s.length > 300000 || s.indexOf('<') < 0) return s;
            const r = rules();
            if (!r || !r.on) return s;
            return s.replace(/<(script|iframe|img|embed)\b[^>]*?\bsrc\s*=\s*["']?([^"'\s>]+)[^>]*>(\s*<\/\1>)?/gi,
                (m, t, u) => (badRes(u) ? '' : m))
                .replace(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi, (m, c) => (AD_SIG.test(c) ? '' : m));
        };
        ['write', 'writeln'].forEach(k => {
            const o = W.Document.prototype[k];
            W.Document.prototype[k] = function () { return o.apply(this, [].map.call(arguments, strip)); };
        });
        const iah = W.Element.prototype.insertAdjacentHTML;
        W.Element.prototype.insertAdjacentHTML = function (p, h) { return iah.call(this, p, strip(h)); };
        defSet(W.Element.prototype, 'innerHTML', d => function (v) { return d.set.call(this, strip(v)); });
        defSet(W.HTMLIFrameElement && W.HTMLIFrameElement.prototype, 'srcdoc', d => function (v) { return d.set.call(this, strip(v)); });

        const op = W.open;
        const guardedOpen = function (u, t) {
            const r = rules();
            if (r && r.on) {
                const o = u ? parse(u) : null;
                const tg = String(t || '').toLowerCase();
                let bad = popBlocked(u);
                if (!bad && o) {
                    if (tg === '_self' || tg === '_top' || tg === '_parent') bad = navBad(o);
                    else if (AD_URL.test(o.href)) bad = true;
                    else if (r.pop) {
                        const hh = o.hostname.toLowerCase();
                        if (samePage(o)) bad = true;
                        else if (!same(hh) && !okHost(hh) && !gestureLink(o)) bad = true;
                        else if (gDepth > 0 && !gestureLink(o)) bad = true;
                    }
                } else if (!bad && !o && r.pop && (!u || /^about:blank$/i.test(String(u)))) bad = true;
                if (bad) { popSig = Date.now(); return fakeWin(); }
            }
            return op.apply(this, arguments);
        };
        try { Object.defineProperty(W, 'open', { configurable: false, enumerable: true, get: () => guardedOpen, set: () => {} }); }
        catch (e) { W.open = guardedOpen; }

        ['showModal', 'show'].forEach(k => {
            const P = W.HTMLDialogElement && W.HTMLDialogElement.prototype, o = P && P[k];
            if (o) P[k] = function () {
                const r = rules();
                if (r && r.on && r.ovl && !gT) return;
                return o.apply(this, arguments);
            };
        });
        const blockA = a => {
            const r = rules();
            if (!r || !r.on) return false;
            const o = parse(a.href);
            if (!o) return false;
            if (locked() || badNav(a.href) || AD_URL.test(a.href)) return true;
            if (!r.pop) return false;
            const h = o.hostname.toLowerCase();
            if (!same(h)) return !(okHost(h) || (popOK() && gestureLink(o)));
            return a.target === '_blank' && (!popOK() || samePage(o));
        };
        const ac = W.HTMLAnchorElement.prototype.click;
        W.HTMLAnchorElement.prototype.click = function () { if (blockA(this)) return; return ac.apply(this, arguments); };
        W.addEventListener('click', e => {
            if (e.isTrusted) return;
            const a = e.target && e.target.closest && e.target.closest('a[href]');
            if (a && blockA(a)) { e.preventDefault(); e.stopImmediatePropagation(); }
        }, true);

        const blockForm = f => {
            const r = rules();
            if (!r || !r.on) return false;
            const act = f.getAttribute('action') || W.location.href;
            const o = parse(act);
            if (!o) return false;
            if (locked() || badNav(act)) return true;
            const h = o.hostname.toLowerCase();
            return !!r.pop && ((!same(h) && !okHost(h)) || (f.target === '_blank' && !popOK()));
        };
        const FP = W.HTMLFormElement && W.HTMLFormElement.prototype;
        if (FP) ['submit', 'requestSubmit'].forEach(k => {
            const o = FP[k];
            if (o) FP[k] = function () { if (blockForm(this)) return; return o.apply(this, arguments); };
        });

        try {
            const nav = W.navigation;
            if (nav) nav.addEventListener('navigate', e => {
                if (!e.cancelable || e.hashChange || e.downloadRequest != null) return;
                const r = rules();
                if (!r || !r.on) return;
                const o = parse(e.destination.url);
                if (!o || o.origin === W.location.origin) return;
                if (e.userInitiated) {
                    const nt = e.navigationType;
                    if (r.pop && gHref && (nt === 'push' || nt === 'replace') && Date.now() - gT < 3000 && !gestureLink(o)) {
                        const hh = o.hostname.toLowerCase();
                        if (!same(hh) && !okHost(hh)) {
                            popSig = Date.now();
                            e.preventDefault();
                            const g = gHref;
                            W.setTimeout(() => { try { W.location.href = g; } catch (x) {} }, 0);
                        }
                    }
                    return;
                }
                if (navBad(o)) { popSig = Date.now(); e.preventDefault(); }
            });
        } catch (e) {}

        W.addEventListener('beforeunload', e => {
            const r = rules();
            if (!r || !r.on) return;
            if (locked()) { try { e.preventDefault(); e.returnValue = ''; } catch (x) {} }
            const hij = !!hijT && Date.now() - hijT < 1500 && !gHref;
            if (!W.navigation && r.pop && (Date.now() - popSig < 1200 || gDepth > 0 || hij)) {
                popSig = Date.now();
                [0, 10, 30, 60, 100, 150, 250, 400, 600, 1000, 1500].forEach(ms => W.setTimeout(() => { try { W.stop(); } catch (x) {} }, ms));
            }
        });

        try {
            const GT = { click: 1, auxclick: 1, mousedown: 1, mouseup: 1, pointerdown: 1, pointerup: 1, touchstart: 1, touchend: 1 };
            const wrapMap = new WeakMap();
            const isGlobal = t => t === W || t === D || t === D.documentElement || t === de || t === D.body;
            const ael = W.EventTarget.prototype.addEventListener;
            const rel = W.EventTarget.prototype.removeEventListener;
            const keyOf = (type, o) => type + ((typeof o === 'boolean' ? o : !!(o && o.capture)) ? 'c' : 'b');
            const wrapFn = fn => function (ev) { if (isolate(ev)) return; gDepth++; try { return fn.apply(this, arguments); } finally { gDepth--; markHijack(); } };
            W.EventTarget.prototype.addEventListener = function (type, fn, o) {
                if (GT[type] && fn && isGlobal(this)) {
                    try {
                        let m = wrapMap.get(fn);
                        if (!m) { m = new Map(); wrapMap.set(fn, m); }
                        const k = keyOf(type, o);
                        let w = m.get(k);
                        if (!w) {
                            w = typeof fn === 'function' ? wrapFn(fn) : { handleEvent: wrapFn(fn.handleEvent.bind(fn)) };
                            m.set(k, w);
                        }
                        return ael.call(this, type, w, o);
                    } catch (x) {}
                }
                return ael.apply(this, arguments);
            };
            W.EventTarget.prototype.removeEventListener = function (type, fn, o) {
                if (GT[type] && fn && isGlobal(this)) {
                    const m = wrapMap.get(fn), w = m && m.get(keyOf(type, o));
                    if (w) return rel.call(this, type, w, o);
                }
                return rel.apply(this, arguments);
            };
        } catch (e) {}

        const blockScript = n => {
            try {
                const r = rules();
                if (!r || !r.on || !n || n.tagName !== 'SCRIPT') return;
                const s = n.getAttribute('src');
                if (s) { if (badRes(s)) n.type = 'javascript/blocked'; return; }
                const t = n.textContent || '';
                if (t.length < 400000 && AD_SIG.test(t)) n.type = 'javascript/blocked';
            } catch (e) {}
        };
        const vetNode = n => {
            try {
                if (!n) return n;
                if (n.nodeType === 1 && n.tagName === 'SCRIPT') blockScript(n);
                else if ((n.nodeType === 1 || n.nodeType === 11) && n.querySelectorAll) n.querySelectorAll('script').forEach(blockScript);
            } catch (e) {}
            return n;
        };
        try {
            const fixWin = w => {
                try { if (w && !w.__gdarO) { w.__gdarO = 1; Object.defineProperty(w, 'open', { configurable: false, get: () => guardedOpen, set: () => {} }); } } catch (e) {}
                return w;
            };
            const IP = W.HTMLIFrameElement.prototype;
            defGet(IP, 'contentWindow', g => function () { return fixWin(g.call(this)); });
            defGet(IP, 'contentDocument', g => function () { const d = g.call(this); try { if (d) fixWin(d.defaultView); } catch (e) {} return d; });
            function defGet(P, p, wrap) {
                const d = Object.getOwnPropertyDescriptor(P, p);
                if (d && d.get) Object.defineProperty(P, p, { configurable: true, enumerable: d.enumerable, get: wrap(d.get) });
            }
        } catch (e) {}

        try {
            const q = [];
            q.push = function () { return 0; };
            Object.defineProperty(W, 'adsbygoogle', { configurable: true, get: function () { return q; }, set: function () {} });
        } catch (e) {}

        const rc = W.Node.prototype.removeChild;
        W.Node.prototype.removeChild = function (c) { if (c && c.parentNode !== this) return c; return rc.apply(this, arguments); };
        const ib = W.Node.prototype.insertBefore;
        W.Node.prototype.insertBefore = function (n, r) {
            vetNode(n);
            if (r && r.parentNode !== this) return ib.call(this, n, null);
            return ib.apply(this, arguments);
        };
        const apc = W.Node.prototype.appendChild;
        W.Node.prototype.appendChild = function (n) { vetNode(n); return apc.apply(this, arguments); };
        ['append', 'prepend'].forEach(k => {
            const o = W.Element.prototype[k];
            if (o) W.Element.prototype[k] = function () { [].forEach.call(arguments, vetNode); return o.apply(this, arguments); };
        });

        if (de && MARK_PW) de.setAttribute('data-gdar-pw', '1');
    }
    (function injectShield() {
        const de = document.documentElement;
        const code = '(' + pageShield.toString() + ')(window,' + JSON.stringify(lastRules) + ',true);';
        try {
            const sc = document.createElement('script');
            sc.textContent = code;
            de.appendChild(sc);
            sc.remove();
        } catch (e) {}
        if (!de.hasAttribute('data-gdar-pw')) {
            try {
                const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
                const sc = document.createElement('script');
                sc.src = url;
                sc.onload = sc.onerror = () => { try { sc.remove(); URL.revokeObjectURL(url); } catch (e) {} };
                de.appendChild(sc);
            } catch (e) {}
        }
        try { pageShield((typeof unsafeWindow !== 'undefined' && unsafeWindow) || window, lastRules, false); } catch (e) {}
    })();

    const invQ = new Set(), invStrike = new WeakMap(), invNeg = new WeakMap();

    const alphaZero = c => !c || c === 'transparent' || /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(\.0+)?\s*\)$/.test(c);
    const effOpacity = el => {
        let o = 1;
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
            const v = parseFloat(getComputedStyle(n).opacity);
            if (!isNaN(v)) o *= v;
            if (o < 0.03) break;
        }
        return o;
    };
    const coverRatio = (el, vw, vh) => {
        const q = el.getBoundingClientRect();
        const w = Math.max(0, Math.min(q.right, vw) - Math.max(q.left, 0));
        const h = Math.max(0, Math.min(q.bottom, vh) - Math.max(q.top, 0));
        return (w * h) / (vw * vh);
    };
    const isOverlayPos = cs => cs.position === 'fixed' || cs.position === 'absolute';
    const plain = cs => alphaZero(cs.backgroundColor) && cs.backgroundImage === 'none';
    const hasContent = el => !!((el.textContent || '').trim() || el.querySelector(MEDIA_IN));

    function invTarget(el) {
        const isFrame = el.tagName === 'IFRAME';
        if (!isFrame && !parseExt(el.getAttribute('href'))) return null;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') return null;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return null;
        const [vw, vh] = vpSize();
        if (!vw || !vh) return null;
        if (isFrame) return (isOverlayPos(cs) && coverRatio(el, vw, vh) >= 0.1 && effOpacity(el) < 0.03) ? el : null;

        if (!isOverlayPos(cs) && coverRatio(el, vw, vh) >= 0.6 && plain(cs) && !hasContent(el)) return el;

        let box = el, bcs = cs;
        for (let i = 0; i < 4 && !isOverlayPos(bcs); i++) {
            box = box.parentElement;
            if (!box || box === document.body || box === document.documentElement) { box = null; break; }
            bcs = getComputedStyle(box);
        }
        if (!box || !isOverlayPos(bcs)) return null;
        const c = coverRatio(box, vw, vh);
        if (c >= 0.25 && effOpacity(el) < 0.03) return el;
        if (c < 0.4 || hasContent(box)) return null;
        return (plain(cs) && plain(bcs)) ? box : null;
    }

    function invCheck(el, now) {
        if (!el || el.nodeType !== 1 || el.hasAttribute(INV_ATTR) || inHostNode(el)) return 'no';
        const t = tryQ(() => invTarget(el), null);
        if (!t) { invStrike.delete(el); return 'no'; }
        if (!now) {
            const n = (invStrike.get(el) || 0) + 1;
            invStrike.set(el, n);
            if (n < 2) return 'wait';
        }
        kill(t);
        t.setAttribute(INV_ATTR, '');
        return 'hit';
    }

    const collectInv = n => {
        if (n.nodeType !== 1) return;
        if (n.matches(INV_SEL)) invQ.add(n);
        if (n.firstElementChild) n.querySelectorAll(INV_SEL).forEach(x => invQ.add(x));
    };
    const invScan = () => {
        if (!set.on || document.hidden || !document.body || !invQ.size) return;
        let n = 0;
        for (const el of invQ) {
            if (!el.isConnected || el.hasAttribute(INV_ATTR)) { invQ.delete(el); continue; }
            if (++n > 80) break;
            const r = invCheck(el, guardOn());
            if (r === 'hit') invQ.delete(el);
            else if (r === 'no') {
                const c = (invNeg.get(el) || 0) + 1;
                invNeg.set(el, c);
                if (c >= 3) invQ.delete(el);
            }
        }
    };
    const invClear = () => document.querySelectorAll(`[${INV_ATTR}]`).forEach(e => e.removeAttribute(INV_ATTR));

    const GHOST_SKIP = /^(HTML|BODY|INPUT|TEXTAREA|SELECT|VIDEO|AUDIO|CANVAS|DIALOG|IMG|SVG|BUTTON|A|LABEL|MAIN|HEADER|FOOTER|NAV)$/;
    function ghostOverlay(el) {
        if (!el || el.nodeType !== 1 || GHOST_SKIP.test(el.tagName.toUpperCase()) || inHostNode(el) || el.hasAttribute(INV_ATTR)) return null;
        const cs = getComputedStyle(el);
        const z = parseInt(cs.zIndex, 10) || 0;
        if (!isOverlayPos(cs) || z < 100) return null;
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') return null;
        const [vw, vh] = vpSize();
        if (!vw || !vh || coverRatio(el, vw, vh) < 0.3) return null;
        if (el.closest('dialog[open],[aria-modal=true],[role=dialog],[role=alertdialog]')) return null;
        if (effOpacity(el) >= 0.03) {
            if (z < 1000 || (el.textContent || '').trim() || el.querySelector(MEDIA_IN + ',a,button') || !plain(cs)) return null;
        } else if (el.querySelector('input,select,textarea')) return null;
        return el;
    }
    const ghostSweep = (x, y) => {
        let list = [];
        try { list = document.elementsFromPoint(x, y).slice(0, 8); } catch (err) { return; }
        for (const el of list) {
            const c = el.closest && el.closest(INV_SEL);
            if (c) invCheck(c, true);
            const g = tryQ(() => ghostOverlay(el), null);
            if (g) { kill(g); tryQ(() => g.setAttribute(INV_ATTR, '')); }
        }
    };
    window.addEventListener('pointerdown', e => { if (set.on) ghostSweep(e.clientX, e.clientY); }, true);
    window.addEventListener('touchstart', e => {
        const t = e.touches && e.touches[0];
        if (set.on && t) ghostSweep(t.clientX, t.clientY);
    }, { capture: true, passive: true });

    function popupState(el) {
        if (NOT_POPUP_TAG.test(el.tagName) || STOP_ID.test(el.id || '')) return 'no';
        const cs = getComputedStyle(el);
        const dlg = el.tagName === 'DIALOG';
        const role = el.getAttribute('role');
        const isDlg = dlg || role === 'dialog' || role === 'alertdialog' || el.getAttribute('aria-modal') === 'true';
        const z = parseInt(cs.zIndex, 10) || 0, pos = cs.position;
        if (!(pos === 'fixed' || (pos === 'absolute' && z >= 100) || dlg)) return 'no';
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return 'pending';
        const [vw, vh] = vpSize();
        if (!vw || !vh) return 'pending';
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 20) return 'pending';
        const c = coverRatio(el, vw, vh);
        const center = r.left < vw / 2 && r.right > vw / 2 && r.top < vh / 2 && r.bottom > vh / 2;
        const big = c >= 0.2 || (z >= 1000 && c >= 0.12) || (isDlg && c > 0.02) ||
            (center && c >= 0.06 && (z >= 10 || isDlg || pos === 'fixed'));
        if (!big) {
            let loading = false;
            el.querySelectorAll('img').forEach(i => { if (!i.complete) loading = true; });
            return loading ? 'pending' : 'no';
        }
        if (el.querySelector('video,canvas,form,input,textarea,select')) return 'no';
        if ((el.textContent || '').length > 2000) return 'no';
        return 'popup';
    }
    const stateOf = el => tryQ(() => popupState(el), 'no');
    function unlockScroll() {
        requestAnimationFrame(() => {
            [document.documentElement, document.body].forEach(e => {
                if (e && getComputedStyle(e).overflowY === 'hidden') e.style.setProperty('overflow', 'visible', 'important');
            });
        });
    }
    function popSel(el) {
        if (okId(el)) return '#' + cssEsc(el.id);
        const c = classSel(el, 3, true);
        if (!c) return '';
        const s = el.tagName.toLowerCase() + c;
        return tryQ(() => document.querySelectorAll(s).length <= 3 ? s : '', '');
    }
    function popup(el) {
        const s = popSel(el);
        if (s && !learn.p.includes(s)) {
            learn.p.push(s);
            if (learn.p.length > LEARN_MAX) learn.p.shift();
            learnWrite();
            buildCss();
        }
        kill(el);
        unlockScroll();
        if (uiReady) render();
    }
    const kick = () => { if (!rafQ) { rafQ = true; requestAnimationFrame(tick); } };
    const release = el => { el.removeAttribute(Q_ATTR); el.setAttribute(OK_ATTR, ''); };
    function freshCheck(el) {
        if (!set.on || !el.isConnected || inHostNode(el)) return;
        if (el.matches(INV_SEL) && invCheck(el, true) === 'hit') return;
        if (!set.pop || !guardOn() || el.hasAttribute(ATTR)) return;
        const st = stateOf(el);
        if (st === 'popup') { watch.delete(el); popup(el); return; }
        if (st === 'pending') {
            el.setAttribute(Q_ATTR, '');
            watch.set(el, Date.now() + DECIDE_MS);
        } else {
            release(el);
            watch.set(el, Date.now() + WATCH_MS);
        }
        kick();
    }
    function tick() {
        rafQ = false;
        if (!guardOn()) { fresh.clear(); watch.clear(); return; }
        let n = 0;
        for (const el of fresh) {
            fresh.delete(el);
            if (++n > 80) break;
            freshCheck(el);
        }
        const now = Date.now();
        let w = 0;
        for (const [el, exp] of watch) {
            if (!el.isConnected || el.hasAttribute(ATTR)) { watch.delete(el); continue; }
            const q = el.hasAttribute(Q_ATTR);
            if (now > exp) { watch.delete(el); if (q) release(el); continue; }
            if (++w > 150) break;
            const st = stateOf(el);
            if (st === 'popup') { watch.delete(el); popup(el); }
            else if (q && st === 'no') { watch.delete(el); release(el); watch.set(el, now + WATCH_MS); }
        }
        if (fresh.size || watch.size) kick();
    }
    const vetSoon = el => {
        if (budget > 0) { budget--; freshCheck(el); }
        else { fresh.add(el); kick(); }
    };
    const overlayish = n => {
        if (budget <= 0 || n.nodeType !== 1 || NOT_POPUP_TAG.test(n.tagName)) return false;
        return tryQ(() => { const cs = getComputedStyle(n); return cs.position === 'fixed' || (cs.position === 'absolute' && (parseInt(cs.zIndex, 10) || 0) >= 100); }, false);
    };
    const watchFresh = n => {
        if (!set.on || !set.pop || !guardOn()) return;
        const b = document.body, de = document.documentElement;
        if ((b && n.parentElement === b) || n.parentElement === de || n.matches(SUSPECT) || overlayish(n)) vetSoon(n);
        if (n.firstElementChild) n.querySelectorAll(SUSPECT).forEach(vetSoon);
    };
    const watchAttr = t => {
        if (!set.on || !set.pop || t.nodeType !== 1 || !guardOn()) return;
        if (t === document.body || t === document.documentElement || inHostNode(t)) return;
        if (tryQ(() => t.matches(SUSPECT), false) || (document.body && t.parentElement === document.body)) vetSoon(t);
    };
    function scanGuard() {
        if (!set.on || !set.pop || !guardOn() || !document.documentElement) return;
        budget = 200;
        purgePop(document.documentElement);
        document.querySelectorAll(SUSPECT).forEach(el => { if (!inHostNode(el)) vetSoon(el); });
        if (document.body) [...document.body.children].forEach(vetSoon);
    }

    const hiddenByUs = m => tryQ(() => m.hasAttribute(MARK) || !!m.closest(`[${ATTR}],[${INV_ATTR}]`) || !!(killSel && m.closest(killSel)), false);
    const killMedia = m => {
        if (!set.on || !m || m.nodeType !== 1 || !hiddenByUs(m)) return;
        hush(m);
        if (m.isConnected && !inHostNode(m)) kill(m);
    };
    const killMediaIn = root => { if (set.on && root) eachMatch(root, MEDIA_SEL, killMedia); };
    ['play', 'playing', 'loadedmetadata', 'loadeddata', 'canplay', 'volumechange'].forEach(t =>
        window.addEventListener(t, e => {
            const m = e.target;
            if (m && m.nodeType === 1 && m.matches && m.matches(MEDIA_SEL)) killMedia(m);
        }, true));
    setInterval(() => { if (set.on) killMediaIn(document.documentElement); }, MEDIA_SWEEP_MS);

    const STOP_TAG = /^(HTML|BODY|MAIN|HEADER|FOOTER|NAV|ARTICLE|FORM)$/;
    function climb(p, len) {
        if (!set.deep) return p;
        let t = p;
        const lim = len + 60;
        while (t.parentElement) {
            const par = t.parentElement;
            if (par === document.body || par === document.documentElement) break;
            if (STOP_TAG.test(par.tagName) || STOP_ID.test(par.id || '') || par.id === 'gdar-host') break;
            if ((par.textContent || '').trim().length > lim) break;
            if (par.getElementsByTagName('*').length > 40) break;
            if (par.querySelectorAll('img,video,canvas,iframe').length > 4) break;
            t = par;
        }
        return t;
    }

    const hasKey = el => {
        const t = (el.textContent || '').toLowerCase();
        if (keys.some(k => t.includes(k))) return true;
        const as = attrSel();
        return tryQ(() => !!as && (el.matches(as) || !!el.querySelector(as)), false);
    };
    function stableSel(el) {
        const parts = [];
        let n = el;
        for (let d = 0; n && n.nodeType === 1 && d < 6 && n !== document.body && n !== document.documentElement; d++, n = n.parentElement) {
            const p = okId(n) ? '#' + cssEsc(n.id) : n.tagName.toLowerCase() + classSel(n, 2);
            parts.unshift(p);
            if (!/[#.]/.test(parts.join(''))) continue;
            const q = parts.join(' > ');
            try {
                const ms = document.querySelectorAll(q);
                if (ms.length === 1) return q;
                if (ms.length > 1 && ms.length <= 12 && [...ms].every(hasKey)) return q;
            } catch (e) { return ''; }
            if (p[0] === '#') break;
        }
        return '';
    }

    const learned = new WeakSet();
    function learnAdd(el, k) {
        if (!k || !set.on) return;
        const s = stableSel(el);
        if (!s || learn.l.some(x => x.s === s && x.k === k)) return;
        learn.l.push({ s, k });
        if (learn.l.length > LEARN_MAX) learn.l.shift();
        learnWrite();
        buildCss();
        if (uiReady) render();
    }
    function hideText(p, len, k) {
        const t = climb(p, len);
        if (!learned.has(t)) { learned.add(t); learnAdd(t, k); }
        kill(t);
        return t;
    }

    const keyIn = v => keys.find(x => v.includes(x));
    const checkText = n => {
        if (!set.on || !keys.length) return;
        const p = n.parentElement;
        if (!p || SKIP_TAG.test(p.tagName)) return;
        const v = (n.nodeValue || '').toLowerCase();
        const k = v && keyIn(v);
        if (k) return hideText(p, v.trim().length, k);
    };
    const checkEl = el => {
        if (!set.on || !keys.length || el.nodeType !== 1 || SKIP_TAG.test(el.tagName) || inHostNode(el)) return null;
        for (const a of ATTRS) {
            const v = (el.getAttribute(a) || '').toLowerCase();
            const k = v && keyIn(v);
            if (k) return hideText(el, v.trim().length, k);
        }
        return null;
    };
    function scan(root) {
        if (!set.on) return;
        if (root.nodeType === 3) { checkText(root); return; }
        if (root.nodeType !== 1) return;
        if (keys.length) {
            const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let n;
            while ((n = w.nextNode())) checkText(n);
            checkEl(root);
            root.querySelectorAll(ATTR_SEL).forEach(checkEl);
        }
        killMediaIn(root);
    }

    function sweep() {
        if (!set.on) {
            document.querySelectorAll(`[${ATTR}]`).forEach(e => e.removeAttribute(ATTR));
            document.querySelectorAll(`[${MARK}]`).forEach(e => e.removeAttribute(MARK));
            invClear();
            linkSweep();
            return;
        }
        const stale = new Set(document.querySelectorAll(`[${ATTR}]`));
        purgeSel(document.documentElement);
        purgeAdSrc(document.documentElement);
        purgeMeta(document.documentElement);
        const root = document.body || document.documentElement;
        if (root && keys.length) {
            const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let n;
            while ((n = w.nextNode())) {
                const t = checkText(n);
                if (t) { stale.delete(t); stale.delete(n.parentElement); }
            }
            document.querySelectorAll(ATTR_SEL).forEach(el => {
                const t = checkEl(el);
                if (t) { stale.delete(t); stale.delete(el); }
            });
        }
        stale.forEach(e => e.removeAttribute(ATTR));
        document.querySelectorAll(INV_SEL).forEach(x => invQ.add(x));
        killMediaIn(document.documentElement);
        linkSweep();
    }

    function applyRules() { calcKeys(); buildCss(); ensureStyles(); syncGuard(); sweep(); }

    const TL_SEL = 'dialog,[popover]';
    let promoteQ = false, promoteAt = 0;
    const schedulePromote = () => {
        if (promoteQ) return;
        promoteQ = true;
        Promise.resolve().then(() => {
            promoteQ = false;
            if (Date.now() - promoteAt < 250) return;
            promoteAt = Date.now();
            promote();
        });
    };

    const mo = new MutationObserver(muts => {
        ensureStyles();
        if (!set.on) return;
        budget = 60;
        for (const m of muts) {
            if (m.type === 'childList') {
                m.addedNodes.forEach(n => {
                    if (n.nodeType === 1 && n.id === 'gdar-host') return;
                    if (n.nodeType === 1) {
                        purgeSel(n); purgePop(n); purgeAdSrc(n); purgeMeta(n);
                        if (!n.isConnected) return;
                        neutralizeIn(n);
                        collectInv(n);
                        watchFresh(n);
                        if (n.matches(TL_SEL) || (n.firstElementChild && n.querySelector(TL_SEL))) schedulePromote();
                    }
                    scan(n);
                });
            } else if (m.type === 'characterData') {
                checkText(m.target);
            } else if (m.type === 'attributes') {
                const an = m.attributeName, tg = m.target;
                if ((an === 'href' || an === 'target') && intent && tg === intent.a) restoreIntent();
                if (an === 'href') neutralize(tg);
                else if (an === 'class' || an === 'style' || an === 'hidden' || an === 'open') {
                    watchAttr(tg);
                    if (an === 'open' && tg.nodeType === 1 && tg.matches(TL_SEL)) schedulePromote();
                } else if (an !== 'target') checkEl(tg);
            }
        }
    });
    const MO_OPTS = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS, 'href', 'target', 'class', 'style', 'hidden', 'open'] };
    let moRoot = null;
    const attachMo = () => {
        const d = document.documentElement;
        if (!d || d === moRoot) return;
        const again = !!moRoot;
        moRoot = d;
        mo.observe(d, MO_OPTS);
        if (again) { calcKeys(); buildCss(); ensureStyles(); sweep(); }
    };
    attachMo();
    applyRules();
    scanGuard();

    const guardKick = () => { if (guardOn()) { scanGuard(); kick(); } };
    window.addEventListener('load', guardKick, true);
    document.addEventListener('readystatechange', guardKick);
    setInterval(invScan, INV_SCAN_MS);
    setInterval(() => { ensureStyles(); attachMo(); }, 700);
    document.addEventListener('DOMContentLoaded', () => { ensureStyles(); sweep(); invScan(); scanGuard(); }, { once: true });
    window.addEventListener('load', () => { sweep(); setTimeout(sweep, 1000); setTimeout(sweep, 3000); }, { once: true });
    window.addEventListener('pageshow', e => { if (e.persisted) { ensureStyles(); sweep(); } });

    const syncFromStore = async () => {
        if (writing) return;
        const [s, gRaw, stRaw, lrRaw] = await Promise.all([
            gReadRaw('settings'), gRead('global', DEF_RULES()), gRead(siteKey, DEF_RULES()), gRead(learnKey, DEF_LEARN())
        ]);
        const g = normRules(gRaw), st = normRules(stRaw), lr = normLearn(lrRaw);

        let migrated = false;
        const legacy = GMOK ? lsGet(LEGACY_SITE_KEY) : null;
        if (legacy) {
            const l = normRules(legacy);
            ['sel', 'txt'].forEach(k => l[k].forEach(v => { if (!st[k].includes(v)) { st[k].push(v); migrated = true; } }));
            try { localStorage.removeItem(LEGACY_SITE_KEY); } catch (e) {}
        }

        if (writing) return;
        const before = JSON.stringify([set, glb, site, learn]);
        let pushSet = false;
        if (s && (s._t || 0) >= (set._t || 0)) set = normSet(s);
        else if (set._t) pushSet = true;
        glb = g; site = st;
        lr.l.forEach(x => { if (!learn.l.some(y => y.s === x.s && y.k === x.k)) learn.l.push(x); });
        learn.l = learn.l.slice(-LEARN_MAX);
        lr.p.forEach(x => { if (!learn.p.includes(x)) learn.p.push(x); });
        learn.p = learn.p.slice(-LEARN_MAX);
        if (migrated) siteWrite(); else writeCache();
        if (pushSet) gWrite('settings', set);
        if (JSON.stringify([set, glb, site, learn]) !== before) applyRules();
        if (uiReady) render();
    };
    const storeP = syncFromStore().catch(() => {});

    function initUI() {
        if (document.getElementById('gdar-host') || !document.documentElement) return;

        const TL = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';
        const toTop = el => {
            if (!TL || !el || !el.isConnected) return;
            tryQ(() => el.hidePopover());
            tryQ(() => el.showPopover());
        };
        const hideLater = el => {
            if (!TL) return;
            setTimeout(() => { if (!el.classList.contains('show')) tryQ(() => el.hidePopover()); }, 500);
        };

        const ICONS = {
            x: '<path d="M6 6l12 12M18 6L6 18"/>',
            plus: '<path d="M12 5v14M5 12h14"/>',
            copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H16"/>',
            check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
            swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
            list: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
            eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A16.6 16.6 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'
        };
        const ic = (n, s = 16) =>
            `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;flex:none">${ICONS[n]}</svg>`;

        const host = document.createElement('div');
        hostEl = host;
        host.id = 'gdar-host';
        host.style.cssText = 'display:block!important;position:static!important;width:0!important;height:0!important;' +
            'margin:0!important;padding:0!important;border:0!important;opacity:1!important;visibility:visible!important;' +
            'transform:none!important;filter:none!important;overflow:visible!important;';
        const root = host.attachShadow({ mode: 'open' });
        const SIDE = DOT_SIDE === 'left' ? 'left' : 'right';

        root.innerHTML = `
    <style>
        :host{all:initial;
            --ne:#1fff6a;--ac:#34d36b;--ink:#04230f;--fg:#f5f5f7;--gy:#8b8b93;--gy2:#C7C7CB;--bad:#f87171;
            --w06:rgba(255,255,255,.06);--w08:rgba(255,255,255,.08);--w12:rgba(255,255,255,.12);
            --t42:rgba(255,255,255,.42);--t45:rgba(255,255,255,.45);--t55:rgba(255,255,255,.55);
            --sheet:#1c1c1e;--grab:rgba(255,255,255,.28);--cl:rgba(255,255,255,.75);
            --tabbg:rgba(255,255,255,.07);--tabact:rgba(255,255,255,.14);--ph:rgba(255,255,255,.28);
            --stbg:rgba(31,255,106,.14);
            --glow:0 0 5px 1px rgba(31,255,106,.85);
            --ff:'Plus Jakarta Sans',-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
            font-family:var(--ff);color:var(--fg)}
        *,*::before,*::after{box-sizing:border-box;margin:0;letter-spacing:normal;text-transform:none;line-height:1.3;
            -webkit-text-size-adjust:100%}
        button{font:inherit;font-size:15px;color:inherit;border:0;background:none;padding:0;cursor:pointer;
            -webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;text-align:center}
        label{display:flex}
        .g-dot{position:fixed;inset:auto;${SIDE}:${DOT_X}px;bottom:${DOT_Y}px;margin:0;padding:0;border:0;overflow:visible;
            width:6px;height:6px;border-radius:50%;
            background:#1fff6a;z-index:2147483646;touch-action:none;-webkit-tap-highlight-color:transparent;
            -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;
            animation:gdarBlink 3.4s cubic-bezier(.45,0,.55,1) infinite;
            transition:transform .25s ease}
        .g-dot::backdrop{display:none}
        .g-dot::before{content:"";position:absolute;inset:-16px}
        .g-dot.off{background:#8b8b93;box-shadow:none;animation:none;opacity:.55}
        .g-dot.hold{background:linear-gradient(180deg,#F20021 0%,#FF404D 100%);
            box-shadow:0 0 12px #F8132C, inset 0 .5px .2px #ED5967;animation:none;opacity:1;transform:scale(1.5)}
        @keyframes gdarBlink{
            0%,100%{opacity:.55;box-shadow:0 0 4px 1px rgba(31,255,106,.55)}
            50%{opacity:1;box-shadow:0 0 8px 3px rgba(31,255,106,1)}}
        .g-hl{position:fixed;display:none;pointer-events:none;z-index:2147483645;
            border:2px solid #1fff6a;border-radius:3px;background:rgba(31,255,106,.12);
            box-shadow:0 0 0 1px rgba(0,0,0,.35)}
    </style>
    <div class="g-dot" popover="manual"></div>
    <div class="g-hl"></div>`;
        document.documentElement.appendChild(host);

        const $ = id => root.querySelector('#' + id);
        const dot = root.querySelector('.g-dot');
        const hl = root.querySelector('.g-hl');
        dotEl = dot;
        toTop(dot);
        let built = false;
        let ov, sheet, ov2, sheet2, kindBtns;

        promote = () => {
            if (!TL) return;
            toTop(dot);
            if (built && ov.classList.contains('show')) toTop(ov);
            if (built && ov2.classList.contains('show')) toTop(ov2);
        };

        setInterval(() => {
            if (document.hidden || !dot.isConnected) return;
            const r = dot.getBoundingClientRect();
            if (!r.width) return;
            const t = tryQ(() => document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), null);
            if (!t || t === host) return;
            if (TL) promote();
            else { const c = t.closest && t.closest(INV_SEL); if (c) invCheck(c, true); }
        }, 1000);

        const PH = { sel: 'smartbanner hoặc .banner, #popup', txt: 'Quảng cáo, tải ứng dụng', lnk: 'tinyurl, win, bet,...' };
        const PH_BULK = {
            sel: 'Nhập các phần tử cần chặn, phân tách bằng dấu ";" hoặc xuống dòng.',
            txt: 'Nhập từ khoá cần chặn',
            lnk: 'Nhập các tên miền cần chặn. Ex: bet, win,...'
        };
        const count = o => o.sel.length + o.txt.length + o.lnk.length;
        const applyPick = () => {
            if (pickOn()) document.documentElement.setAttribute(PICK_ATTR, '');
            else document.documentElement.removeAttribute(PICK_ATTR);
        };

        async function copyText(text) {
            try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
            try {
                const t = document.createElement('textarea');
                t.value = text;
                t.setAttribute('readonly', '');
                t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
                document.documentElement.appendChild(t);
                t.focus(); t.select(); t.setSelectionRange(0, text.length);
                const ok = document.execCommand('copy');
                t.remove();
                return ok;
            } catch (e) { return false; }
        }
        const flash = (b, ok, idleHTML) => {
            b.innerHTML = (ok ? ic('check', 14) : ic('x', 14)) + `<span>${ok ? 'Đã chép' : 'Lỗi'}</span>`;
            b.classList.toggle('ok', ok);
            setTimeout(() => { b.innerHTML = idleHTML; b.classList.remove('ok'); }, 1200);
        };

        let renderSheet = () => {}, closeInfo = () => {}, showInfoImpl = () => {};

        const ROWS_A = [
            ['g-on', 'on', 'Chặn quảng cáo', 'Xoá quảng cáo, tắt tiếng &amp; dừng video/audio, chặn link/iframe vô hình.'],
            ['g-auto', 'auto', 'Tự động chặn', 'ads, popup, banner, float…'],
            ['g-pop', 'pop', 'Chặn popup &amp; tab lạ', 'Chặn lớp phủ, popup và tab tự mở khi bạn không bấm.'],
            ['g-links', 'links', 'Chặn chuyển hướng ngoài', '', 'g-lnk-s'],
            ['g-deep', 'deep', 'Ẩn cả khung chứa', 'Ẩn luôn khung, viền, nút ✕ quanh chữ quảng cáo.']
        ];
        const ROW_PICK = ['g-pick', 'pick', 'Nhấn giữ xem phần tử',
            `Giữ ${(PICK_MS / 1000).toFixed(2).replace(/0$/, '').replace('.', ',')}s để xem &amp; sao chép phần tử.`];
        const SW_KEYS = [...ROWS_A, ROW_PICK].map(r => [r[0], r[1]]);

        function mkSwitch(id, horiz, onTxt, offTxt) {
            const mk = (tag, cls, txt) => {
                const e = document.createElement(tag);
                if (cls) e.className = cls;
                if (txt) e.textContent = txt;
                return e;
            };
            const wrap = mk('div', 'g-sw' + (horiz ? ' h' : ''));
            const input = mk('input');
            input.type = 'checkbox';
            input.id = id;
            wrap.append(input, mk('div', 'on', onTxt || 'Bật'), mk('div', 'off', offTxt || 'Tắt'), mk('span'));
            return wrap;
        }

        function build() {
            if (built) return;
            built = true;
            const SW = (id, h) => `<span class="g-swh" data-id="${id}"${h ? ' data-h="1"' : ''}></span>`;
            const rowHtml = ([id, , title, sub, subId]) =>
                `<label class="g-set"><div>${title}<small${subId ? ` id="${subId}"` : ''}>${sub}</small></div>${SW(id)}</label>`;
            const tpl = document.createElement('template');
            tpl.innerHTML = `
    <style>
        .g-ov{position:fixed;inset:0;width:auto;height:auto;max-width:none;max-height:none;margin:0;padding:0;border:0;
            overflow:visible;z-index:2147483647;background:transparent;--bd:.4;
            visibility:hidden;transition:visibility 0s linear .46s;touch-action:none}
        .g-ov.lite{--bd:.12}
        .g-ov::backdrop{display:none}
        .g-ov::before{content:"";position:absolute;inset:0;background:#000;opacity:0;
            transition:opacity .38s ease;will-change:opacity}
        .g-ov.show{visibility:visible;transition:visibility 0s}
        .g-ov.show::before{opacity:var(--bd)}
        .g-ov.drag::before{transition:none}
        .g-sheet{position:absolute;left:8px;right:8px;bottom:8px;margin:0 auto;max-width:480px;
            max-height:80vh;max-height:80dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;color:var(--fg);
            touch-action:pan-y;
            padding:8px 16px calc(16px + env(safe-area-inset-bottom,0px));border-radius:28px;
            background:var(--sheet);border:1px solid var(--w08);
            box-shadow:0 10px 36px rgba(0,0,0,.5);
            transform-origin:50% 100%;
            opacity:0;transform:translate3d(0,16px,0) scale(.55);
            transition:transform .3s cubic-bezier(.4,0,.2,1),opacity .22s ease;
            will-change:transform,opacity;-webkit-backface-visibility:hidden;backface-visibility:hidden}
        .g-ov.show .g-sheet{opacity:1;transform:translate3d(0,0,0) scale(1);
            transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .3s ease}
        *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}
        input[type=text],textarea{-webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default!important}

        .g-close,.g-add,.g-chip button,.g-tab,.g-cp,.g-act,.g-bulk-btn{display:inline-flex;align-items:center;justify-content:center}
        .g-close,.g-chip button,.g-cp,.g-bulk-btn.sec,.g-act{background:var(--w12)}
        .g-add,.g-bulk-btn,.g-cp.ok,.g-act.ok,.g-act.pri{background:var(--ac);color:var(--ink)}
        .g-bulk-btn.sec{color:var(--fg)}
        .g-add:active{transform:scale(.92)}
        .g-cp:active,.g-bulk-btn:active{transform:scale(.95)}
        .g-act:active{transform:scale(.97)}
        .g-add,.g-cp,.g-bulk-btn,.g-act{transition:transform .15s,background .2s}
        .g-card,.g-bulk{background:var(--w06)}
        .g-card{border-radius:16px;overflow:hidden}
        .g-set + .g-set,.g-info + .g-info{border-top:1px solid var(--w06)}
        .g-sub,.g-set small,.g-hint,.g-empty{color:var(--t45)}

        .g-grab{height:26px;margin-bottom:-8px;display:flex;justify-content:center;align-items:flex-start;
            padding-top:4px;touch-action:none;cursor:grab}
        .g-grab i{display:block;width:36px;height:4px;border-radius:2px;background:var(--grab)}
        .g-close{position:absolute;top:12px;right:14px;z-index:3;width:30px;height:30px;border-radius:50%;
            color:var(--cl);transition:background .2s,transform .2s cubic-bezier(.34,1.56,.64,1)}
        .g-close:active{transform:scale(.88) rotate(90deg)}
        .g-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0 14px}
        .g-title{font-size:20px;font-weight:700;white-space:nowrap}
        .g-sub{font-size:13px;margin-top:2px}
        .g-od{display:inline-block;width:.34em;height:.34em;margin:0 .08em 0 .06em;border-radius:50%;vertical-align:.1em;
            background:var(--ne);box-shadow:0 0 6px 1px rgba(31,255,106,.85)}
        .g-state{flex:none;display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;
            font-size:13px;font-weight:600;white-space:nowrap;background:var(--stbg);color:var(--ne);
            transition:background .35s ease,color .35s ease}
        .g-state i{display:block;width:6px;height:6px;border-radius:50%;background:currentColor}
        .g-state.off{background:var(--w08);color:var(--t55)}
        .g-set{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;font-size:15px}
        .g-set small{display:block;font-size:12px;margin-top:2px;transition:color .25s}

        .g-sw{position:relative;flex:none;height:24px;width:46px;font-family:var(--ff);
            -webkit-font-smoothing:antialiased;font-synthesis:none}
        .g-sw input{display:block;-webkit-appearance:none;appearance:none;position:absolute;top:0;left:0;width:100%;height:24px;
            border:0;padding:0;margin:0;cursor:pointer;background:none;-webkit-tap-highlight-color:rgba(0,0,0,0);z-index:1}
        .g-sw .on,.g-sw .off{position:absolute;top:0;right:12px;display:block;font-size:12.8px;font-weight:500;line-height:24px;
            width:100%;text-align:right;color:var(--ne);transform-origin:right 12px;
            -webkit-user-select:none;user-select:none;transition:all .3s ease;pointer-events:none}
        .g-sw .on{transform:translateY(12px) scale(.8);opacity:0;filter:blur(3px)}
        .g-sw .off{transform:translateY(0) scale(1);opacity:1;filter:blur(0)}
        .g-sw span{position:absolute;top:6.5px;right:0;width:4px;height:4px;background:var(--gy2);border-radius:50%;
            box-shadow:0 7px 0 var(--gy2);pointer-events:none}
        .g-sw span:after{content:"";position:absolute;top:0;left:0;width:100%;height:100%;background:var(--ne);border-radius:50%;
            transform:translateY(0);transition:all .2s ease}
        .g-sw input:checked ~ .on{transform:translateY(0) scale(1);opacity:1;filter:blur(0)}
        .g-sw input:checked ~ span:after{transform:translateY(7px)}
        .g-sw input:checked ~ .off{transform:translateY(-12px) scale(.8);opacity:0;filter:blur(3px)}

        .g-sw.h{width:40px}
        .g-sw.h .on,.g-sw.h .off{right:17px;font-size:11px}
        .g-sw.h span{top:10px;right:0;box-shadow:-7px 0 0 var(--gy2)}
        .g-sw.h span:after{transform:translateX(-7px)}
        .g-sw.h input:checked ~ span:after{transform:translateX(0)}

        .g-ld{flex:none;position:relative;width:46px;height:24px;display:flex;align-items:center;justify-content:flex-end}
        .g-ld::before{content:"";position:absolute;inset:-10px -4px}
        .g-ld i{display:block;width:6px;height:6px;margin-right:-1px;border-radius:50%;background:var(--gy2);
            transition:background .25s,transform .15s}
        .g-ld.has i{background:var(--ne)}
        .g-ld:active i{transform:scale(1.6)}

        .g-bar{display:flex;gap:8px;align-items:center;margin:12px 0 8px}
        .g-tabs{display:flex;flex:1;min-width:0;gap:2px;padding:2px;border-radius:10px;background:var(--tabbg)}
        .g-tab{flex:1;min-width:0;padding:7px 4px;border-radius:8px;font-size:13px;font-weight:500;white-space:nowrap;
            color:var(--t55);transition:all .2s}
        .g-tab.act{background:var(--tabact);color:var(--fg);box-shadow:0 1px 3px rgba(0,0,0,.25)}
        .g-lb{position:relative;display:inline-block}
        .g-tab.has .g-lb::after{content:"";position:absolute;top:-3px;right:-7px;width:5px;height:5px;border-radius:50%;
            background:var(--ne);box-shadow:var(--glow)}
        .g-scope{flex:none;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 10px;border-radius:10px;
            background:var(--w08);font-size:13px;font-weight:600;color:var(--fg);transition:transform .15s,background .2s}
        .g-scope:active{transform:scale(.95)}
        .g-scope b{padding:1px 6px;border-radius:8px;font-size:11px;font-weight:600;background:var(--ac);color:var(--ink)}
        .g-scope svg{color:var(--t55)}
        .g-hint,.g-warn{margin:8px 2px 0;font-size:12px;font-style:italic}
        .g-warn{color:#d99a0b;display:none}
        .g-row{display:flex;gap:8px;align-items:center}
        input[type=text],textarea{flex:1;min-width:0;width:100%;padding:0 12px;border-radius:10px;color:var(--fg);
            border:1px solid transparent;background:var(--w08);font:inherit;font-size:16px;outline:none;
            -webkit-appearance:none;appearance:none;transition:border-color .2s}
        input[type=text]{height:36px}
        textarea{display:block;height:auto;min-height:48px;padding:8px 12px;resize:none;line-height:1.35}
        input[type=text]::placeholder,textarea::placeholder{color:var(--ph);font-size:12.5px}
        input[type=text]:focus,textarea:focus{border-color:rgba(52,211,107,.7)}
        .g-add{flex:none;width:36px;height:36px;border-radius:10px}

        .g-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;align-items:start}
        .g-bulk{padding:8px;border-radius:14px;min-width:0;min-height:0;display:flex;flex-direction:column;
            aspect-ratio:1/1;overflow:hidden;
            background:linear-gradient(180deg,var(--w08) 0%,var(--w06) 100%);border:1px solid var(--w06)}
        .g-bulk-h{flex:none;display:flex;align-items:center;gap:5px;margin-bottom:6px;font-size:11.5px;font-weight:600;white-space:nowrap}
        .g-bulk-h svg{color:var(--ac);width:12px;height:12px}
        .g-bulk-h span{overflow:hidden;text-overflow:ellipsis}

        .g-ta{position:relative;flex:1 1 0;min-height:0;overflow:hidden;border-radius:9px;background:var(--w08)}
        .g-ta textarea{position:absolute;top:0;left:0;width:133.34%;height:133.34%;min-height:0;
            padding:7px 9px;font-size:16px;line-height:1.3;border:0;border-radius:0;background:transparent;
            transform:scale(.75);transform-origin:0 0}
        .g-ta textarea::placeholder{font-size:14px}
        .g-ta textarea:focus{box-shadow:inset 0 0 0 1.5px rgba(52,211,107,.7)}

        .g-bulk-b{flex:none;display:flex;flex-direction:column;align-items:stretch;gap:3px;margin-top:6px}
        .g-bulk-btn{flex:none;gap:4px;width:100%;height:28px;padding:0 6px;border-radius:9px;font-size:11.5px;font-weight:600;white-space:nowrap}
        .g-bulk-btn svg{width:12px;height:12px}
        .g-io-o{flex:none;display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:6px;font-size:11px;color:var(--t55)}
        .g-io-o > span{line-height:1.2}
        .g-io-r{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px}
        .g-io-r .g-bulk-btn{height:26px;padding:0 3px;font-size:11px}
        .g-io-r .g-bulk-btn svg{display:none}
        .g-msg{flex:none;min-width:0;text-align:center;font-size:10.5px;color:var(--t55)}
        .g-msg:empty{display:none}
        .g-msg.ok{color:var(--ne)}
        .g-msg.err{color:var(--bad)}
        #g-io-msg{margin-top:3px}
        @media (max-width:340px){.g-cols{grid-template-columns:1fr}}

        .g-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
        .g-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:4px 4px 4px 10px;
            border-radius:999px;background:var(--w08);font-size:13px;word-break:break-all;animation:gdarIn .25s ease}
        .g-chip button{flex:none;width:18px;height:18px;border-radius:50%;color:var(--cl);transition:background .2s}
        .g-chip button:active{background:var(--w12)}
        .g-empty{width:100%;padding:8px 0 2px;text-align:center;font-size:13px;opacity:.8}
        @keyframes gdarIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
        .g-info{display:flex;align-items:flex-start;gap:10px;padding:10px 14px}
        .g-info > div{flex:1;min-width:0}
        .g-info small{display:block;font-size:11px;font-weight:600;letter-spacing:.04em;
            text-transform:uppercase;color:var(--t42);margin-bottom:2px}
        .g-info code{display:block;font:500 13px/1.4 var(--ff);color:var(--fg);word-break:break-all}
        .g-cp{flex:none;gap:5px;padding:6px 10px;border-radius:10px;font-size:13px;font-weight:600}
        .g-acts{display:flex;gap:8px;margin-top:12px}
        .g-act{flex:1;gap:7px;padding:11px 8px;border-radius:12px;font-size:14px;font-weight:600}
    </style>

    <div class="g-ov" id="g-ov1" popover="manual">
        <div class="g-sheet">
            <div class="g-grab" id="g-grab1"><i></i></div>
            <button class="g-close" id="g-close" aria-label="Đóng">${ic('x', 14)}</button>
            <div class="g-head">
                <div>
                    <div class="g-title" aria-label="Dot Ads">D<span class="g-od" aria-hidden="true"></span>t Ads</div>
                    <div class="g-sub">Chặn quảng cáo với một chạm</div>
                </div>
                <div class="g-state" id="g-state"><i></i><span id="g-state-t"></span></div>
            </div>

            <div class="g-card">
                ${ROWS_A.map(rowHtml).join('')}
                <div class="g-set"><div>Chặn tức thì<small id="g-learn-s"></small></div><button class="g-ld" id="g-learn-clr" aria-label="Xoá các mục đã nhớ"><i></i></button></div>
                ${rowHtml(ROW_PICK)}
            </div>

            <div class="g-bar">
                <div class="g-tabs" id="g-kind">
                    <button class="g-tab act" data-tab="sel"><span class="g-lb">Phần tử</span></button>
                    <button class="g-tab" data-tab="txt"><span class="g-lb">Từ khoá</span></button>
                    <button class="g-tab" data-tab="lnk"><span class="g-lb">Liên kết</span></button>
                </div>
                <button class="g-scope" id="g-scope"><span id="g-sc-t"></span><b id="g-sc-n">0</b>${ic('swap', 13)}</button>
            </div>

            <div class="g-row">
                <input type="text" id="g-in" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
                <button class="g-add" id="g-add" aria-label="Thêm">${ic('plus', 18)}</button>
            </div>

            <div class="g-hint" id="g-hint"></div>
            <div class="g-warn" id="g-warn">Chưa hỗ trợ GM.setValue: luật có thể mất khi xoá dữ liệu web của Safari.</div>
            <div class="g-chips" id="g-list"></div>

            <div class="g-cols">
                <div class="g-bulk">
                    <div class="g-bulk-h">${ic('list', 14)}<span>Thêm nhiều</span></div>
                    <div class="g-ta"><textarea id="g-bulk" autocapitalize="off" autocorrect="off" spellcheck="false" rows="4"></textarea></div>
                    <div class="g-bulk-b">
                        <button class="g-bulk-btn" id="g-bulk-go">${ic('plus', 14)}<span>Thêm tất cả</span></button>
                        <div class="g-msg" id="g-msg"></div>
                    </div>
                </div>

                <div class="g-bulk">
                    <div class="g-bulk-h">${ic('copy', 14)}<span>Sao lưu / Khôi phục</span></div>
                    <div class="g-ta"><textarea id="g-io" autocapitalize="off" autocorrect="off" spellcheck="false" rows="4" placeholder="Dán JSON để nhập"></textarea></div>
                    <label class="g-io-o"><span>Thay thế</span>${SW('g-replace', true)}</label>
                    <div class="g-io-r">
                        <button class="g-bulk-btn sec" id="g-exp">${ic('copy', 14)}<span>Xuất</span></button>
                        <button class="g-bulk-btn" id="g-expf"><span>Lưu tệp</span></button>
                        <button class="g-bulk-btn sec" id="g-imp"><span>Nhập</span></button>
                        <button class="g-bulk-btn" id="g-impf"><span>Chọn tệp</span></button>
                        <input type="file" id="g-file" accept=".json,application/json,text/plain" style="display:none">
                    </div>
                    <div class="g-msg" id="g-io-msg"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="g-ov lite" id="g-ov2" popover="manual">
        <div class="g-sheet">
            <div class="g-grab" id="g-grab2"><i></i></div>
            <button class="g-close" id="g-close2" aria-label="Đóng">${ic('x', 14)}</button>
            <div class="g-head"><div><div class="g-title">Phần tử</div><div class="g-sub" id="g-sub2"></div></div></div>
            <div class="g-card" id="g-info"></div>
            <div class="g-acts">
                <button class="g-act" id="g-copyall">${ic('copy', 15)}<span>Sao chép tất cả</span></button>
                <button class="g-act pri" id="g-hideit">${ic('eyeoff', 15)}<span>Ẩn phần tử này</span></button>
            </div>
        </div>
    </div>`;
            root.appendChild(tpl.content);

            root.querySelectorAll('.g-swh').forEach(h => h.replaceWith(
                mkSwitch(h.dataset.id, h.dataset.h === '1', h.dataset.on, h.dataset.off)));

            ov = $('g-ov1'); sheet = ov.querySelector('.g-sheet');
            ov2 = $('g-ov2'); sheet2 = ov2.querySelector('.g-sheet');
            kindBtns = root.querySelectorAll('[data-tab]');
            if (!GMOK) $('g-warn').style.display = 'block';

            const setMsg = (id, text, cls) => { const m = $(id); m.textContent = text || ''; m.className = 'g-msg' + (cls ? ' ' + cls : ''); };
            const msg = (t, c) => setMsg('g-msg', t, c);
            const ioMsg = (t, c) => setMsg('g-io-msg', t, c);

            renderSheet = function () {
                SW_KEYS.forEach(([id, k]) => { $(id).checked = !!set[k]; });
                $('g-lnk-s').textContent = 'Chặn tên miền lạ (tinyurl, bet, win…)' + (lnkBlocked ? ' · đã chặn ' + lnkBlocked : '');
                const nLearn = learnActive();
                $('g-learn-s').textContent = nLearn ? nLearn + ' mục đã nhớ, ẩn ngay khi tải trang' : 'Tự nhớ khung & popup để ẩn ngay lần sau';
                $('g-learn-s').classList.toggle('on', nLearn > 0);
                $('g-learn-clr').classList.toggle('has', nLearn > 0);
                $('g-state').classList.toggle('off', !set.on);
                $('g-state-t').textContent = set.on ? 'Đang bật' : 'Đang tắt';
                $('g-sc-t').textContent = scope === 'all' ? 'Mọi trang' : 'Trang này';
                $('g-sc-n').textContent = count(cur());
                $('g-hint').textContent = scope === 'all' ? 'Áp dụng cho mọi trang web' : 'Chỉ áp dụng cho ' + location.hostname;
                $('g-in').placeholder = PH[tab];
                $('g-bulk').placeholder = PH_BULK[tab];
                kindBtns.forEach(b => {
                    b.classList.toggle('act', b.dataset.tab === tab);
                    b.classList.toggle('has', cur()[b.dataset.tab].length > 0);
                });

                const list = $('g-list'), arr = cur()[tab];
                list.innerHTML = '';
                if (!arr.length) { list.innerHTML = '<div class="g-empty">Chưa có mục nào</div>'; return; }
                arr.forEach((v, i) => {
                    const chip = document.createElement('span');
                    chip.className = 'g-chip';
                    const s = document.createElement('span');
                    s.textContent = v;
                    const b = document.createElement('button');
                    b.setAttribute('aria-label', 'Xoá');
                    b.innerHTML = ic('x', 10);
                    bind(b, 'click', () => { arr.splice(i, 1); saveCur(); render(); applyRules(); });
                    chip.append(s, b);
                    list.appendChild(chip);
                });
            };

            function addMany(raw) {
                const items = parseMulti(raw), arr = cur()[tab];
                let added = 0, dup = 0, bad = 0;
                items.forEach(v => {
                    if (arr.includes(v)) { dup++; return; }
                    if (tab === 'sel' && !NAME_RE.test(v) && !validSel(v)) { bad++; return; }
                    arr.push(v);
                    added++;
                });
                if (added) { saveCur(); render(); applyRules(); }
                return { total: items.length, added, dup, bad };
            }
            const summary = r => [r.added && `Đã thêm ${r.added}`, r.dup && `${r.dup} trùng`, r.bad && `${r.bad} không hợp lệ`].filter(Boolean).join(' · ');

            function add() {
                const input = $('g-in');
                if (!input.value.trim()) return;
                const r = addMany(input.value);
                if (r.added) { input.value = ''; input.style.borderColor = ''; }
                else if (r.bad) input.style.borderColor = '#f87171';
            }
            function addBulk() {
                const ta = $('g-bulk'), r = addMany(ta.value);
                if (!r.total) { msg('Chưa nhập gì', 'err'); return; }
                if (r.added) ta.value = '';
                msg(summary(r), r.added ? 'ok' : 'err');
            }

            const listSites = async () => {
                const out = {};
                out[HOST] = site;
                try {
                    let ks = [];
                    if (hasGM && typeof GM.listValues === 'function') ks = await GM.listValues();
                    else if (typeof GM_listValues === 'function') ks = await Promise.resolve(GM_listValues());
                    for (const k of (ks || [])) {
                        if (typeof k !== 'string' || !k.startsWith(SITE_PREFIX)) continue;
                        const h = k.slice(SITE_PREFIX.length);
                        if (!h || h === HOST) continue;
                        const r = normRules(await gRead(k, DEF_RULES()));
                        if (count(r)) out[h] = r;
                    }
                } catch (e) {}
                if (!count(site)) delete out[HOST];
                return out;
            };
            const buildExport = async () => JSON.stringify({
                app: 'dot-ads', version: 1, exported: new Date().toISOString(),
                settings: set, global: glb, sites: await listSites()
            }, null, 2);

            const mergeInto = (dst, src, replace) => {
                const n = normRules(src);
                ['sel', 'txt', 'lnk'].forEach(k => {
                    if (replace) dst[k] = n[k].slice();
                    else n[k].forEach(v => { if (!dst[k].includes(v)) dst[k].push(v); });
                });
            };

            async function importData(text) {
                let d;
                try { d = JSON.parse(String(text || '').trim()); } catch (e) { ioMsg('JSON không hợp lệ', 'err'); return; }
                if (!d || typeof d !== 'object' || (d.app !== 'dot-ads' && !d.global && !d.sites && !d.settings)) {
                    ioMsg('Không phải tệp sao lưu Dot Ads', 'err'); return;
                }
                const replace = $('g-replace').checked;
                let nSites = 0;
                if (d.settings && typeof d.settings === 'object') { set = normSet(d.settings); gWrite('settings', set); }
                if (d.global) { mergeInto(glb, d.global, replace); gWrite('global', glb); }
                if (d.sites && typeof d.sites === 'object') {
                    for (const h of Object.keys(d.sites)) {
                        if (!h) continue;
                        nSites++;
                        if (h === HOST) { mergeInto(site, d.sites[h], replace); siteWrite(); }
                        else {
                            const c2 = replace ? DEF_RULES() : normRules(await gRead(SITE_PREFIX + h, DEF_RULES()));
                            mergeInto(c2, d.sites[h], replace);
                            gWrite(SITE_PREFIX + h, c2);
                        }
                    }
                }
                applyRules();
                render();
                ioMsg(`Đã nhập (${replace ? 'thay thế' : 'gộp'}) · ${nSites} trang`, 'ok');
            }

            bind($('g-exp'), 'click', async () => {
                const text = await buildExport();
                $('g-io').value = text;
                const ok = await copyText(text);
                ioMsg(ok ? 'Đã sao chép JSON sao lưu' : 'Không chép được, hãy chép thủ công từ ô trên', ok ? 'ok' : 'err');
            });
            bind($('g-expf'), 'click', async () => {
                const text = await buildExport();
                $('g-io').value = text;
                try {
                    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'dot-ads-backup.json';
                    document.documentElement.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                    ioMsg('Đã tạo tệp dot-ads-backup.json', 'ok');
                } catch (e) { ioMsg('Không lưu được tệp, hãy chép từ ô trên', 'err'); }
            });
            bind($('g-imp'), 'click', () => {
                const t = $('g-io').value;
                if (!t.trim()) { ioMsg('Chưa dán JSON', 'err'); return; }
                importData(t);
            });
            bind($('g-impf'), 'click', () => $('g-file').click());
            $('g-file').onchange = async e => {
                const f = e.target.files && e.target.files[0];
                e.target.value = '';
                if (!f) return;
                try { const t = await f.text(); $('g-io').value = t; importData(t); }
                catch (err) { ioMsg('Không đọc được tệp', 'err'); }
            };
            bind($('g-io'), 'input', () => ioMsg(''));

            let soonT = 0;
            const applySoon = () => { calcKeys(); clearTimeout(soonT); soonT = setTimeout(applyRules, 420); };
            bind($('g-add'), 'click', add);
            bind($('g-in'), 'keydown', e => { if (e.key === 'Enter') add(); });
            bind($('g-in'), 'input', (e, tg) => { tg.style.borderColor = ''; });
            bind($('g-bulk-go'), 'click', addBulk);
            bind($('g-bulk'), 'input', () => msg(''));

            const AFTER = {
                on: () => { render(); applySoon(); },
                auto: applySoon,
                pop: applySoon,
                links: () => { applySoon(); render(); },
                deep: () => { learn.l = []; learnWrite(); applySoon(); render(); },
                pick: applyPick
            };
            SW_KEYS.forEach(([id, k]) => {
                $(id).onchange = e => { set[k] = e.target.checked; gWrite('settings', set); AFTER[k](); };
            });
            bind($('g-learn-clr'), 'click', () => { learn.l = []; learn.p = []; learnWrite(); applyRules(); render(); });
            bind($('g-scope'), 'click', () => { scope = scope === 'all' ? 'site' : 'all'; $('g-in').value = ''; msg(''); render(); });
            kindBtns.forEach(b => bind(b, 'click', () => { tab = b.dataset.tab; $('g-in').value = ''; msg(''); render(); }));

            bind($('g-close'), 'click', close);
            bind(ov, 'click', (e, tg) => { if (tg === ov) close(); });

            function swipeClose(ovEl, sh, grab, closeFn) {
                let x0 = 0, y0 = 0, t0 = 0, dy = 0, tracking = false, drag = false, fromGrab = false;
                const lite = ovEl.classList.contains('lite');
                const start = (x, y, target) => {
                    tracking = true; drag = false; dy = 0;
                    x0 = x; y0 = y; t0 = Date.now();
                    fromGrab = grab.contains(target);
                };
                const move = (x, y, ev) => {
                    if (!tracking) return;
                    const dx = x - x0;
                    dy = y - y0;
                    if (!drag) {
                        if (Math.abs(dx) > Math.abs(dy) || Math.abs(dy) < 6) return;
                        if (dy < 0 || (sh.scrollTop > 0 && !fromGrab)) { tracking = false; return; }
                        drag = true;
                        sh.style.transition = 'none';
                        ovEl.classList.add('drag');
                    }
                    if (ev && ev.cancelable) ev.preventDefault();
                    const d = Math.max(0, dy);
                    sh.style.transform = `translate3d(0,${d}px,0) scale(${Math.max(0.85, 1 - d / 1600)})`;
                    ovEl.style.setProperty('--bd', String(Math.max(0, (lite ? .12 : .4) * (1 - d / 500))));
                };
                const end = () => {
                    if (!tracking) return;
                    tracking = false;
                    if (!drag) return;
                    drag = false;
                    const v = dy / Math.max(1, Date.now() - t0);
                    sh.style.transition = '';
                    ovEl.classList.remove('drag');
                    ovEl.style.removeProperty('--bd');
                    if (dy > 90 || v > 0.6) closeFn();
                    else sh.style.transform = '';
                };
                bind(sh, 'touchstart', (e, tg) => { if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY, tg); });
                bind(sh, 'touchmove', e => { if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY, e); });
                bind(sh, 'touchend', end);
                bind(sh, 'touchcancel', end);
                bind(ovEl, 'touchmove', (e, tg) => { if (tg === ovEl && e.cancelable) e.preventDefault(); });
                bind(grab, 'pointerdown', (e, tg) => {
                    if (e.pointerType !== 'mouse') return;
                    start(e.clientX, e.clientY, tg);
                    tryQ(() => grab.setPointerCapture(e.pointerId));
                });
                bind(grab, 'pointermove', e => { if (e.pointerType === 'mouse') move(e.clientX, e.clientY, e); });
                bind(grab, 'pointerup', e => { if (e.pointerType === 'mouse') end(); });
            }

            let pickedInfo = null;
            const placeHl = el => {
                const r = el.getBoundingClientRect();
                hl.style.cssText = `display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
            };

            showInfoImpl = function (el) {
                pickedInfo = {
                    tag: el.tagName.toLowerCase(), id: el.id || '', cls: clsOf(el),
                    name: el.getAttribute('name') || '', sel: selOf(el), href: '', src: '', hideSel: ''
                };
                const link = el.closest ? el.closest('a[href]') : null;
                const hrefV = (link && link.getAttribute('href')) || '';
                const srcEl = el.matches('img,video,iframe,source,audio') ? el : el.querySelector('img,video,iframe,source');
                pickedInfo.href = hrefV;
                pickedInfo.src = (srcEl && (srcEl.currentSrc || srcEl.getAttribute('src'))) || '';
                const ho = parseExt(hrefV);
                if (link && ho) pickedInfo.hideSel = `a[href*="${attrEsc(ho.hostname)}" i]`;
                placeHl(el);
                $('g-sub2').textContent = '<' + pickedInfo.tag + '>';

                const rows = [['ID', pickedInfo.id], ['Class', pickedInfo.cls], ['Name', pickedInfo.name],
                    ['Selector', pickedInfo.sel], ['Href', pickedInfo.href], ['Src', pickedInfo.src],
                    ['Chặn theo tên miền', pickedInfo.hideSel]];
                const box = $('g-info');
                box.innerHTML = '';
                const idleCp = ic('copy', 14) + '<span>Sao chép</span>';
                rows.forEach(([label, val]) => {
                    if (!val) return;
                    const row = document.createElement('div');
                    row.className = 'g-info';
                    const left = document.createElement('div');
                    const sm = document.createElement('small');
                    sm.textContent = label;
                    const code = document.createElement('code');
                    code.textContent = val;
                    left.append(sm, code);
                    const b = document.createElement('button');
                    b.className = 'g-cp';
                    b.innerHTML = idleCp;
                    bind(b, 'click', async () => flash(b, await copyText(val), idleCp));
                    row.append(left, b);
                    box.appendChild(row);
                });
                if (!box.children.length) box.innerHTML = '<div class="g-empty" style="padding:14px">Phần tử không có id / class / name</div>';
                toTop(ov2);
                void ov2.offsetWidth;
                requestAnimationFrame(() => ov2.classList.add('show'));
            };

            closeInfo = function () {
                sheet2.style.transform = '';
                ov2.classList.remove('drag', 'show');
                ov2.style.removeProperty('--bd');
                hl.style.display = 'none';
                hideLater(ov2);
            };
            bind($('g-close2'), 'click', closeInfo);
            bind(ov2, 'click', (e, tg) => { if (tg === ov2) closeInfo(); });

            swipeClose(ov, sheet, $('g-grab1'), close);
            swipeClose(ov2, sheet2, $('g-grab2'), closeInfo);

            const idleAll = ic('copy', 15) + '<span>Sao chép tất cả</span>';
            bind($('g-copyall'), 'click', async (e, tg) => {
                if (!pickedInfo) return;
                const p = pickedInfo;
                const txt = [`tag: ${p.tag}`, p.id && `id: ${p.id}`, p.cls && `class: ${p.cls}`, p.name && `name: ${p.name}`,
                    `selector: ${p.sel}`, p.href && `href: ${p.href}`, p.src && `src: ${p.src}`].filter(Boolean).join('\n');
                flash(tg.closest('button') || $('g-copyall'), await copyText(txt), idleAll);
            });
            bind($('g-hideit'), 'click', () => {
                if (!pickedInfo) return;
                if (!site.sel.includes(pickedInfo.sel)) site.sel.push(pickedInfo.sel);
                if (pickedInfo.hideSel && !site.sel.includes(pickedInfo.hideSel)) site.sel.push(pickedInfo.hideSel);
                siteWrite();
                applyRules();
                render();
                closeInfo();
            });
        }

        function selOf(el) {
            const path = [];
            let n = el;
            while (n && n.nodeType === 1 && n !== document.documentElement) {
                let p;
                if (n.id) p = '#' + cssEsc(n.id);
                else {
                    p = n.tagName.toLowerCase();
                    clsOf(n).split(' ').filter(c => c && !/^gdar/.test(c)).slice(0, 2).forEach(c => { p += '.' + cssEsc(c); });
                    const par = n.parentElement;
                    if (par) {
                        const sm = [...par.children].filter(x => x.tagName === n.tagName);
                        if (sm.length > 1) p += `:nth-of-type(${sm.indexOf(n) + 1})`;
                    }
                }
                path.unshift(p);
                const q = path.join(' > ');
                try { if (document.querySelectorAll(q).length === 1) return q; } catch (e) {}
                if (n.id) break;
                n = n.parentElement;
            }
            return path.join(' > ');
        }

        render = function () {
            dot.classList.toggle('off', !set.on);
            applyPick();
            if (!set.on) {
                stopPress();
                if (built && ov2.classList.contains('show')) closeInfo();
            }
            if (built) renderSheet();
        };

        const open = () => {
            build();
            render();
            toTop(ov);
            void ov.offsetWidth;
            requestAnimationFrame(() => ov.classList.add('show'));
            setTimeout(syncFromStore, 700);
        };
        function close() {
            sheet.style.transform = '';
            ov.classList.remove('drag', 'show');
            ov.style.removeProperty('--bd');
            hideLater(ov);
            $('g-in').blur(); $('g-bulk').blur();
        }

        let hold = null, redT = null, opened = false;
        const cancel = () => {
            clearTimeout(hold); clearTimeout(redT);
            hold = null; redT = null;
            dot.classList.remove('hold');
        };
        bind(dot, 'pointerdown', e => {
            e.preventDefault();
            cancel();
            opened = false;
            redT = setTimeout(() => { redT = null; dot.classList.add('hold'); }, RED_MS);
            hold = setTimeout(() => { opened = true; cancel(); open(); }, HOLD_MS);
        });
        bind(dot, 'pointerup', () => {
            const was = hold !== null;
            cancel();
            if (was && !opened) {
                set.on = !set.on;
                if (!set.on) { shieldUntil = Date.now() + TOGGLE_DELAY; setTimeout(calcKeys, TOGGLE_DELAY + 60); }
                gWrite('settings', set);
                render();
                applyRules();
            }
        });
        bind(dot, 'pointercancel', cancel);
        bind(dot, 'pointerleave', cancel);
        bind(dot, 'contextmenu', e => e.preventDefault());

        let pressTimer = null, pressing = false, blockUntil = 0, sx = 0, sy = 0, pTarget = null;
        const isBlocked = () => pressing || Date.now() < blockUntil;
        const clearSel = () => tryQ(() => getSelection().removeAllRanges());
        const setPress = on => on
            ? document.documentElement.setAttribute(PRESS_ATTR, '')
            : document.documentElement.removeAttribute(PRESS_ATTR);
        function stopPress() { clearTimeout(pressTimer); pressTimer = null; pressing = false; blockUntil = 0; setPress(false); }
        document.addEventListener('selectionchange', () => { if (pickOn() && isBlocked()) clearSel(); });

        window.addEventListener('pointerdown', e => {
            if (!pickOn() || !e.isPrimary) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            pTarget = e.target;
            if (!pTarget || pTarget.nodeType !== 1) return;
            sx = e.clientX; sy = e.clientY;
            pressing = true;
            setPress(true);
            clearTimeout(pressTimer);
            pressTimer = setTimeout(() => {
                pressTimer = null;
                if (!pickOn()) { stopPress(); return; }
                blockUntil = Date.now() + 900;
                clearSel();
                if (pTarget && pTarget.isConnected) { build(); showInfoImpl(pTarget); }
            }, PICK_MS);
        }, true);
        window.addEventListener('pointermove', e => {
            if (!pressTimer) return;
            if (Math.abs(e.clientX - sx) > MOVE_TOL || Math.abs(e.clientY - sy) > MOVE_TOL) stopPress();
        }, true);
        window.addEventListener('pointerup', () => {
            const fired = pressTimer === null && pressing && Date.now() < blockUntil;
            clearTimeout(pressTimer); pressTimer = null;
            if (fired) { blockUntil = Date.now() + 500; clearSel(); setTimeout(() => setPress(false), 700); }
            else setPress(false);
            pressing = false;
        }, true);
        window.addEventListener('pointercancel', stopPress, true);
        window.addEventListener('scroll', () => { if (pressTimer) stopPress(); }, true);

        ['click', 'auxclick', 'dblclick', 'contextmenu', 'selectstart', 'dragstart'].forEach(t =>
            window.addEventListener(t, e => {
                if (!pickOn()) return;
                const needBlock = (t === 'selectstart' || t === 'dragstart' || t === 'contextmenu') ? isBlocked() : Date.now() < blockUntil;
                if (needBlock) { e.preventDefault(); e.stopImmediatePropagation(); }
            }, true));
        window.addEventListener('touchend', e => {
            if (pickOn() && Date.now() < blockUntil && e.cancelable) e.preventDefault();
        }, { capture: true, passive: false });

        uiReady = true;
        render();

        const prebuild = () => { try { build(); render(); } catch (e) {} };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(prebuild, { timeout: 3000 });
        else setTimeout(prebuild, 1500);
    }

    initUI();
    await storeP;
})();
