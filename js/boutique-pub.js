// =========================================================================
// MODULE PUBLICITÉ DE LA BOUTIQUE  (fichier autonome : js/boutique-pub.js)
// Lit pub/promo.json et affiche :
//   - un écran plein écran (1 fois par jour pour tout le site, croix après quelques secondes)
//   - un bandeau défilant sous le diaporama de la boutique
//   - des cartes publicitaires dans la grille de produits
// Il AJOUTE des éléments à la page ; il ne modifie aucun autre fichier.
// Comptage des vues/clics dans la Sheet (onglet "Pub_Stats") : désactivé tant que "suivi" n'est pas à true.
// =========================================================================
(function () {
    "use strict";

    const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";
    const PROMO_URL = "pub/promo.json";
    const CLE_CACHE = "saferun_pub_cache";
    const CLE_JOUR = "saferun_pub_plein_ecran_jour";

    const params = new URLSearchParams(window.location.search);
    const boutiqueBrute = (params.get("type") || "").trim();
    const forcer = params.get("pub") === "force";           // ?pub=force : ignore la règle « 1 fois par jour » (tests)
    const sansPub = params.get("pub") === "off";            // ?pub=off : aucune publicité

    /* ------------------------------ Outils ------------------------------ */
    const cle = t => String(t || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const aujourdhui = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    const lire = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
    const urlSure = u => { u = String(u || "").trim(); return /^https?:\/\//i.test(u) ? u : ""; };
    const imageSure = u => { u = String(u || "").trim(); return (/^https?:\/\//i.test(u) || /^[\w\-./]+\.(png|jpe?g|webp|gif|avif)(\?[\w=&.\-]*)?$/i.test(u)) ? u : ""; };
    function el(tag, attrs, enfants) {
        const n = document.createElement(tag);
        Object.keys(attrs || {}).forEach(k => {
            if (k === "class") n.className = attrs[k];
            else if (k === "text") n.textContent = attrs[k];
            else n.setAttribute(k, attrs[k]);
        });
        (enfants || []).forEach(c => n.appendChild(c));
        return n;
    }

    let cfg = { suivi: false, whatsapp: "", message_annoncer: "Bonjour, je souhaite annoncer sur SafeRun Market.", plein_ecran: { croix_apres_s: 3, ferme_apres_s: 6 }, annonces: [] };

    function annonceActive(a) {
        if (!a || a.actif === false || !imageSure(a.image)) return false;
        const j = aujourdhui();
        if (a.debut && j < String(a.debut)) return false;
        if (a.fin && j > String(a.fin)) return false;
        const b = String(a.boutique || "").trim();
        if (!b || b === "*" || cle(b) === "TOUS" || cle(b) === "TOUTES") return true;
        const maBoutique = cle(boutiqueBrute);
        return b.split(",").some(x => cle(x) === maBoutique);
    }
    function lienDe(a) {
        const direct = urlSure(a.lien);
        if (direct) return direct;
        const num = String(a.whatsapp || (a.maison ? cfg.whatsapp : "") || "").replace(/[^0-9]/g, "");
        if (num) return "https://wa.me/" + num + "?text=" + encodeURIComponent(a.message || (a.maison ? cfg.message_annoncer : "Bonjour, je vous contacte depuis SafeRun Market."));
        return "";
    }
    function lienAnnoncer() {
        const num = String(cfg.whatsapp || "").replace(/[^0-9]/g, "");
        return num ? "https://wa.me/" + num + "?text=" + encodeURIComponent(cfg.message_annoncer) : "";
    }

    /* ------------------------------ Suivi (vues / clics) ------------------------------ */
    const dejaEnvoye = {};
    function suivre(a, evenement) {
        if (!cfg.suivi || !a || !a.id) return;
        const k = a.id + "|" + evenement;
        if (evenement === "vue" && dejaEnvoye[k]) return;
        dejaEnvoye[k] = true;
        try {
            fetch(API_URL, { method: "POST", mode: "no-cors", keepalive: true,
                body: JSON.stringify({ action: "trackPub", id: a.id, evenement: evenement, boutique: boutiqueBrute, emplacement: a.emplacement || "" }) });
        } catch (e) {}
    }
    function ouvrirLien(a) {
        const l = lienDe(a);
        if (!l) return false;
        suivre(a, "clic");
        window.open(l, "_blank", "noopener,noreferrer");
        return true;
    }

    /* ------------------------------ Styles ------------------------------ */
    function styles() {
        if (document.getElementById("sr-pub-styles")) return;
        const s = document.createElement("style");
        s.id = "sr-pub-styles";
        s.textContent = `
        .sr-pub-chip{position:absolute;top:8px;left:8px;background:rgba(15,23,42,.72);color:#fff;font:600 .62rem Poppins,sans-serif;letter-spacing:.5px;text-transform:uppercase;padding:3px 8px;border-radius:20px;z-index:2;pointer-events:none;}
        .sr-pub-annoncer{position:absolute;right:8px;bottom:8px;background:rgba(255,255,255,.92);color:#0f172a;font:600 .66rem Poppins,sans-serif;padding:4px 10px;border-radius:20px;text-decoration:none;z-index:3;}
        .sr-pub-annoncer:hover{background:#ffcc00;}
        #sr-pub-bandeau{max-width:1200px;margin:14px auto 0;padding:0 12px;box-sizing:border-box;}
        .sr-pub-ban{position:relative;border-radius:14px;overflow:hidden;background:#e2e8f0;aspect-ratio:16/5;box-shadow:0 2px 10px rgba(0,0,0,.08);}
        .sr-pub-ban .sr-pub-sl{position:absolute;inset:0;opacity:0;transition:opacity .6s;display:block;}
        .sr-pub-ban .sr-pub-sl.on{opacity:1;z-index:1;}
        .sr-pub-ban img{width:100%;height:100%;object-fit:cover;display:block;}
        .sr-pub-pts{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);display:flex;gap:5px;z-index:3;}
        .sr-pub-pts i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.55);}
        .sr-pub-pts i.on{background:#fff;}
        .sr-pub-gr{grid-column:1 / -1;position:relative;border-radius:14px;overflow:hidden;background:#e2e8f0;box-shadow:0 2px 10px rgba(0,0,0,.08);}
        .sr-pub-gr img{width:100%;display:block;max-height:240px;object-fit:cover;}
        .sr-pub-lien{cursor:pointer;}
        #sr-pub-ecran{position:fixed;inset:0;z-index:100020;background:rgba(2,6,23,.9);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;animation:srPubIn .35s ease-out;}
        @keyframes srPubIn{from{opacity:0}to{opacity:1}}
        .sr-pub-cadre{position:relative;max-width:min(92vw,460px);max-height:84vh;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5);background:#111;}
        .sr-pub-cadre img{display:block;max-width:100%;max-height:84vh;object-fit:contain;margin:auto;}
        #sr-pub-x{position:absolute;top:10px;right:10px;min-width:38px;height:38px;border-radius:19px;border:0;background:rgba(255,255,255,.92);color:#0f172a;font:700 .8rem Poppins,sans-serif;cursor:default;z-index:4;padding:0 10px;}
        #sr-pub-x.pret{cursor:pointer;font-size:1.2rem;}
        @media (prefers-reduced-motion:reduce){#sr-pub-ecran{animation:none}.sr-pub-ban .sr-pub-sl{transition:none}}
        `;
        document.head.appendChild(s);
    }

    /* ------------------------------ Précharger une image ------------------------------ */
    function charger(src) {
        return new Promise(resolve => {
            const i = new Image();
            i.onload = () => resolve(true);
            i.onerror = () => resolve(false);
            i.src = src;
            setTimeout(() => resolve(false), 5000);
        });
    }

    /* ------------------------------ 1. Plein écran ------------------------------ */
    function choisirPleinEcran() {
        const l = cfg.annonces.filter(a => a.emplacement === "plein-ecran" && annonceActive(a));
        if (!l.length) return null;
        const specifique = a => !!String(a.boutique || "").trim() && String(a.boutique).trim() !== "*";
        const payantes = l.filter(a => !a.maison);
        const groupe = (payantes.filter(specifique).length ? payantes.filter(specifique) : (payantes.length ? payantes : l));
        return groupe[Math.floor(Math.random() * groupe.length)];
    }
    async function pleinEcran() {
        if (!forcer && lire(CLE_JOUR) === aujourdhui()) return;
        let panierPlein = false;
        try { const p = JSON.parse(lire("saferun_panier") || "[]"); panierPlein = Array.isArray(p) && p.length > 0; } catch (e) {}
        if (!forcer && (panierPlein || lire("saferun_commande_pendante_id"))) return;
        const a = choisirPleinEcran();
        if (!a) return;
        if (!(await charger(a.image))) return;                 // image introuvable : on n'affiche rien
        if (document.getElementById("sr-pub-ecran")) return;
        styles();
        ecrire(CLE_JOUR, aujourdhui());

        const cadre = el("div", { class: "sr-pub-cadre" });
        const img = el("img", { src: a.image, alt: a.partenaire || "Publicité" });
        const x = el("button", { id: "sr-pub-x", type: "button", "aria-label": "Fermer la publicité" });
        const fond = el("div", { id: "sr-pub-ecran", role: "dialog", "aria-modal": "true", "aria-label": "Publicité" }, [cadre]);
        cadre.appendChild(el("span", { class: "sr-pub-chip", text: a.maison ? "SafeRun Market" : (a.etiquette || "Publicité") }));
        cadre.appendChild(img);
        cadre.appendChild(x);
        if (a.maison && lienAnnoncer()) {
            const an = el("a", { class: "sr-pub-annoncer", href: lienAnnoncer(), target: "_blank", rel: "noopener noreferrer", text: "Annoncer ici" });
            an.addEventListener("click", ev => { ev.stopPropagation(); suivre({ id: "annoncer-ici", emplacement: "plein-ecran" }, "clic"); });
            cadre.appendChild(an);
        }
        document.body.appendChild(fond);
        suivre(a, "vue");

        const croixApres = Math.max(1, Number(cfg.plein_ecran.croix_apres_s) || 3);
        const fermeApres = Math.max(croixApres + 1, Number(cfg.plein_ecran.ferme_apres_s) || 6);
        let reste = croixApres, fini = false;
        const fermer = () => { if (fini) return; fini = true; clearInterval(tic); clearTimeout(auto); document.removeEventListener("keydown", touche); fond.remove(); };
        const touche = ev => { if (ev.key === "Escape" && x.classList.contains("pret")) fermer(); };
        x.textContent = String(reste);
        const tic = setInterval(() => {
            reste--;
            if (reste > 0) x.textContent = String(reste);
            else { clearInterval(tic); x.textContent = "✕"; x.classList.add("pret"); }
        }, 1000);
        const auto = setTimeout(fermer, fermeApres * 1000);
        x.addEventListener("click", ev => { ev.stopPropagation(); if (x.classList.contains("pret")) fermer(); });
        document.addEventListener("keydown", touche);
        if (lienDe(a)) {
            img.classList.add("sr-pub-lien");
            img.addEventListener("click", () => { if (ouvrirLien(a)) fermer(); });
        }
        // Filet de sécurité : la croix finit toujours par apparaître, même si le minuteur est ralenti
        setTimeout(() => { if (!fini && !x.classList.contains("pret")) { x.textContent = "✕"; x.classList.add("pret"); } }, (croixApres + 2) * 1000);
    }

    /* ------------------------------ 2. Bandeau sous le diaporama ------------------------------ */
    async function bandeau() {
        const hero = document.getElementById("shop-hero");
        if (!hero || document.getElementById("sr-pub-bandeau")) return;
        const liste = cfg.annonces.filter(a => a.emplacement === "banniere" && annonceActive(a));
        if (!liste.length) return;
        const ok = [];
        for (const a of liste) { if (await charger(a.image)) ok.push(a); }
        if (!ok.length) return;
        styles();
        const boite = el("div", { class: "sr-pub-ban" });
        const pts = el("div", { class: "sr-pub-pts" });
        const slides = ok.map((a, i) => {
            const lien = lienDe(a);
            const s = el(lien ? "a" : "div", { class: "sr-pub-sl" + (lien ? " sr-pub-lien" : "") });
            if (lien) { s.setAttribute("href", lien); s.setAttribute("target", "_blank"); s.setAttribute("rel", "noopener noreferrer sponsored"); s.addEventListener("click", () => suivre(a, "clic")); }
            s.appendChild(el("img", { src: a.image, alt: a.partenaire || "Publicité", loading: "lazy" }));
            s.appendChild(el("span", { class: "sr-pub-chip", text: a.maison ? "Publicité" : (a.etiquette || "Sponsorisé") }));
            boite.appendChild(s);
            if (ok.length > 1) pts.appendChild(el("i"));
            return s;
        });
        if (ok.length > 1) boite.appendChild(pts);
        if (ok.every(a => a.maison) && lienAnnoncer()) {
            const an = el("a", { class: "sr-pub-annoncer", href: lienAnnoncer(), target: "_blank", rel: "noopener noreferrer", text: "Annoncer ici" });
            an.addEventListener("click", () => suivre({ id: "annoncer-ici", emplacement: "banniere" }, "clic"));
            boite.appendChild(an);
        }
        const zone = el("section", { id: "sr-pub-bandeau", "aria-label": "Publicité" }, [boite]);
        hero.parentNode.insertBefore(zone, hero.nextSibling);

        let courant = 0, minuteur = null;
        const montrer = i => {
            courant = i;
            slides.forEach((s, k) => s.classList.toggle("on", k === i));
            Array.prototype.forEach.call(pts.children, (p, k) => p.classList.toggle("on", k === i));
            suivre(ok[i], "vue");
        };
        const suite = () => montrer((courant + 1) % slides.length);
        montrer(0);
        if (slides.length > 1) {
            const demarrer = () => { clearInterval(minuteur); minuteur = setInterval(suite, 4000); };
            demarrer();
            boite.addEventListener("mouseenter", () => clearInterval(minuteur));
            boite.addEventListener("mouseleave", demarrer);
        }
    }

    /* ------------------------------ 3. Cartes dans la grille ------------------------------ */
    function grille() {
        const g = document.getElementById("grille-boutique-dediee");
        if (!g) return;
        const liste = cfg.annonces.filter(a => a.emplacement === "grille" && annonceActive(a));
        if (!liste.length) return;
        styles();
        let occupe = false;
        const placer = () => {
            if (occupe) return;
            occupe = true;
            try {
                const cartes = g.querySelectorAll(":scope > .zl-carte");
                if (cartes.length) {
                    const io = obsVue();
                    liste.forEach((a, rang) => {
                        if (g.querySelector('.sr-pub-gr[data-id="' + (window.CSS && CSS.escape ? CSS.escape(a.id) : a.id) + '"]')) return;
                        let pos = Math.max(2, Number(a.position) || (6 + rang * 6));
                        if (cartes.length < pos) return;       // boutique trop petite pour cette annonce
                        let apres = cartes[pos - 1];
                        // pas d'annonce collée à celle de la boutique : on décale de deux produits
                        if (apres.nextElementSibling && apres.nextElementSibling.classList.contains("zl-annonce") && cartes[pos + 1]) apres = cartes[pos + 1];
                        const lien = lienDe(a);
                        const bloc = el(lien ? "a" : "div", { class: "sr-pub-gr" + (lien ? " sr-pub-lien" : ""), "data-id": a.id });
                        if (lien) { bloc.setAttribute("href", lien); bloc.setAttribute("target", "_blank"); bloc.setAttribute("rel", "noopener noreferrer sponsored"); bloc.addEventListener("click", () => suivre(a, "clic")); }
                        const im = el("img", { src: a.image, alt: a.partenaire || "Publicité", loading: "lazy" });
                        im.addEventListener("error", () => bloc.remove());
                        bloc.appendChild(im);
                        bloc.appendChild(el("span", { class: "sr-pub-chip", text: a.maison ? "Publicité" : (a.etiquette || "Sponsorisé") }));
                        if (a.maison && lienAnnoncer()) {
                            const an = el("a", { class: "sr-pub-annoncer", href: lienAnnoncer(), target: "_blank", rel: "noopener noreferrer", text: "Annoncer ici" });
                            an.addEventListener("click", ev => { ev.stopPropagation(); suivre({ id: "annoncer-ici", emplacement: "grille" }, "clic"); });
                            bloc.appendChild(an);
                        }
                        apres.parentNode.insertBefore(bloc, apres.nextSibling);
                        bloc._annonce = a;
                        if (io) io.observe(bloc);
                    });
                }
            } finally { occupe = false; }
        };
        let planifie = false;
        const obs = new MutationObserver(() => {
            if (planifie) return;
            planifie = true;
            requestAnimationFrame(() => { planifie = false; placer(); });
        });
        obs.observe(g, { childList: true });
        placer();
    }
    let _io = null;
    function obsVue() {
        if (_io !== null) return _io || null;
        if (!("IntersectionObserver" in window)) { _io = false; return null; }
        _io = new IntersectionObserver(es => es.forEach(e => {
            if (e.isIntersecting && e.intersectionRatio >= 0.5 && e.target._annonce) { suivre(e.target._annonce, "vue"); _io.unobserve(e.target); }
        }), { threshold: [0.5] });
        return _io;
    }

    /* ------------------------------ Démarrage ------------------------------ */
    async function chargerConfig() {
        try {
            const r = await fetch(PROMO_URL, { cache: "no-cache" });
            if (!r.ok) throw new Error("HTTP " + r.status);
            const j = await r.json();
            ecrire(CLE_CACHE, JSON.stringify(j));
            return j;
        } catch (e) {
            try { return JSON.parse(lire(CLE_CACHE) || "null"); } catch (e2) { return null; }
        }
    }
    async function demarrer() {
        if (sansPub) return;
        const j = await chargerConfig();
        if (!j || !Array.isArray(j.annonces)) return;           // pas de promo.json : le site fonctionne normalement
        cfg = Object.assign({}, cfg, j, { plein_ecran: Object.assign({}, cfg.plein_ecran, j.plein_ecran || {}) });
        cfg.suivi = j.suivi === true;
        try { bandeau(); } catch (e) { console.warn("[pub] bandeau :", e); }
        try { grille(); } catch (e) { console.warn("[pub] grille :", e); }
        try { await pleinEcran(); } catch (e) { console.warn("[pub] plein écran :", e); }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(demarrer, 300));
    else setTimeout(demarrer, 300);
})();