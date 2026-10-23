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
    const modeDebug = params.get("pub") === "debug";
    const forcer = params.get("pub") === "force" || modeDebug;           // ?pub=force : ignore la règle « 1 fois par jour » (tests)
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
        .sr-pub-hero{position:absolute;inset:0;z-index:5;opacity:0;pointer-events:none;transition:opacity .8s ease-in-out;border-radius:inherit;overflow:hidden;}
        .sr-pub-hero.on{opacity:1;pointer-events:auto;}
        .sr-pub-hs{position:absolute;inset:0;display:none;}
        .sr-pub-hs.on{display:block;}
        .sr-pub-hs .sr-pub-bg{position:absolute;inset:-24px;background-size:cover;background-position:center;filter:blur(22px) brightness(.65);}
        .sr-pub-hs img{position:relative;display:block;width:100%;height:100%;object-fit:contain;}
        .sr-pub-hero .sr-pub-chip{top:14px;left:14px;}
        .sr-pub-hero .sr-pub-annoncer{right:14px;bottom:14px;}
        .sr-pub-gr{grid-column:1 / -1;position:relative;border-radius:14px;overflow:hidden;background:#e2e8f0;box-shadow:0 2px 10px rgba(0,0,0,.08);aspect-ratio:4/1;display:block;}
        .sr-pub-gr img{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;}
        .sr-pub-gr .sr-pub-sl{position:absolute;inset:0;opacity:0;transition:opacity .6s;display:block;}
        .sr-pub-gr .sr-pub-sl.on{opacity:1;z-index:1;}
        @media (max-width:768px){.sr-pub-gr{aspect-ratio:16/7;}}
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
    function charger(src, delai) {
        return new Promise(resolve => {
            const i = new Image();
            let fini = false;
            const fin = (ok, why) => { if (fini) return; fini = true; if (!ok) console.warn("[pub] image non affichée (" + why + ") : " + src); resolve(ok); };
            i.onload = () => fin(true);
            i.onerror = () => fin(false, "introuvable : vérifiez le nom et le dossier pub/");
            i.src = src;
            setTimeout(() => fin(false, "trop lourde ou trop lente (plus de " + Math.round((delai || 12000) / 1000) + " s) : compressez-la"), delai || 12000);
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
    // Les annonces s'affichent DANS le grand bandeau de la boutique : le visuel normal, puis une annonce, puis le visuel, etc.
    // Réglages (facultatifs) dans promo.json : "banniere": { "mode": "hero", "premiere_ms": 2500, "pause_ms": 6000, "duree_ms": 4000 }
    function banniereHero(hero, ok) {
        if (hero.querySelector(".sr-pub-hero")) return;
        const b = cfg.banniere || {};
        const premiere = Math.max(500, Number(b.premiere_ms) || 2500), pause = Math.max(1500, Number(b.pause_ms) || 6000), duree = Math.max(1500, Number(b.duree_ms) || 4000);
        const couche = el("div", { class: "sr-pub-hero", "aria-label": "Publicité" });
        const slides = ok.map(a => {
            const l = lienDe(a);
            const s = el(l ? "a" : "div", { class: "sr-pub-hs" + (l ? " sr-pub-lien" : "") });
            if (l) { s.setAttribute("href", l); s.setAttribute("target", "_blank"); s.setAttribute("rel", "noopener noreferrer sponsored"); s.addEventListener("click", () => suivre(a, "clic")); }
            const bg = el("div", { class: "sr-pub-bg" }); bg.style.backgroundImage = 'url("' + String(a.image).replace(/"/g, "%22") + '")';
            s.appendChild(bg);
            s.appendChild(el("img", { src: a.image, alt: a.partenaire || "Publicité" }));
            s.appendChild(el("span", { class: "sr-pub-chip", text: a.maison ? "Publicité" : (a.etiquette || "Sponsorisé") }));
            couche.appendChild(s);
            return s;
        });
        const an = el("a", { class: "sr-pub-annoncer", target: "_blank", rel: "noopener noreferrer", text: "Annoncer ici" });
        an.addEventListener("click", ev => { ev.stopPropagation(); suivre({ id: "annoncer-ici", emplacement: "banniere" }, "clic"); });
        couche.appendChild(an);
        hero.appendChild(couche);
 
        let i = Math.floor(Math.random() * ok.length), timer = null;       // départ aléatoire : chaque annonceur passe en premier à tour de rôle
        const afficher = () => {
            if (document.hidden) { timer = setTimeout(afficher, 1000); return; }
            slides.forEach((s, k) => s.classList.toggle("on", k === i));
            const a = ok[i], lienAn = lienAnnoncer();
            an.style.display = (a.maison && lienAn) ? "" : "none";
            if (lienAn) an.setAttribute("href", lienAn);
            couche.classList.add("on");
            suivre(a, "vue");
            timer = setTimeout(() => { couche.classList.remove("on"); i = (i + 1) % ok.length; timer = setTimeout(afficher, pause); }, duree);
        };
        timer = setTimeout(afficher, premiere);
    }
 
    async function bandeau() {
        const hero = document.getElementById("shop-hero");
        if (!hero || document.getElementById("sr-pub-bandeau")) return;
        const liste = cfg.annonces.filter(a => a.emplacement === "banniere" && annonceActive(a));
        if (!liste.length) return;
        const verifs = await Promise.all(liste.map(a => charger(a.image)));
        const ok = liste.filter((a, i) => verifs[i]);
        if (!ok.length) return;
        if (document.getElementById("sr-pub-bandeau")) return;
        styles();
        const mode = (cfg.banniere && cfg.banniere.mode) || "hero";
        if (mode !== "bandeau") { banniereHero(hero, ok); return; }
        const boite = el("div", { class: "sr-pub-ban" });
        const pts = el("div", { class: "sr-pub-pts" });
        const slides = ok.map((a, i) => {
            const lien = lienDe(a);
            const s = el(lien ? "a" : "div", { class: "sr-pub-sl" + (lien ? " sr-pub-lien" : "") });
            if (lien) { s.setAttribute("href", lien); s.setAttribute("target", "_blank"); s.setAttribute("rel", "noopener noreferrer sponsored"); s.addEventListener("click", () => suivre(a, "clic")); }
            s.appendChild(el("img", { src: a.image, alt: a.partenaire || "Publicité" }));
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
    // Les annonces de la grille se regroupent par « slot » (champ "slot" de promo.json, 1 par défaut).
    // Toutes les annonces d'un même slot tournent dans UN SEUL carrousel : 8 annonceurs = 8 images qui défilent
    // au même endroit, et aucune n'est perdue. Un autre numéro de slot crée un 2e carrousel plus bas dans la grille.
    const PAUSE_GRILLE_MS = 5000;
    function construireSlot(id, annonces) {
        const bloc = el("div", { class: "sr-pub-gr", "data-slot": id });
        const pts = el("div", { class: "sr-pub-pts" });
        const an = el("a", { class: "sr-pub-annoncer", target: "_blank", rel: "noopener noreferrer", text: "Annoncer ici" });
        an.addEventListener("click", ev => { ev.stopPropagation(); suivre({ id: "annoncer-ici", emplacement: "grille" }, "clic"); });
        const ordre = annonces.slice();
        const depart = Math.floor(Math.random() * ordre.length);           // départ aléatoire : chaque annonceur passe en premier à tour de rôle
        const liste = ordre.slice(depart).concat(ordre.slice(0, depart));
        const slides = liste.map(a => {
            const l = lienDe(a);
            const s = el(l ? "a" : "div", { class: "sr-pub-sl" + (l ? " sr-pub-lien" : "") });
            if (l) { s.setAttribute("href", l); s.setAttribute("target", "_blank"); s.setAttribute("rel", "noopener noreferrer sponsored"); s.addEventListener("click", () => suivre(a, "clic")); }
            s.appendChild(el("img", { src: a.image, alt: a.partenaire || "Publicité" }));
            s.appendChild(el("span", { class: "sr-pub-chip", text: a.maison ? "Publicité" : (a.etiquette || "Sponsorisé") }));
            bloc.appendChild(s);
            if (liste.length > 1) pts.appendChild(el("i"));
            return s;
        });
        if (liste.length > 1) bloc.appendChild(pts);
        bloc.appendChild(an);
        let courant = 0, minuteur = null;
        bloc._visible = false;
        const montrer = i => {
            courant = i;
            slides.forEach((s, k) => s.classList.toggle("on", k === i));
            Array.prototype.forEach.call(pts.children, (p, k) => p.classList.toggle("on", k === i));
            const a = liste[i], lienAn = lienAnnoncer();
            an.style.display = (a.maison && lienAn) ? "" : "none";
            if (lienAn) an.setAttribute("href", lienAn);
            if (bloc._visible) suivre(a, "vue");
        };
        bloc._vueCourante = () => suivre(liste[courant], "vue");
        bloc.arreter = () => clearInterval(minuteur);
        montrer(0);
        if (liste.length > 1) {
            const demarrer = () => { clearInterval(minuteur); minuteur = setInterval(() => { if (document.hidden) return; montrer((courant + 1) % slides.length); }, PAUSE_GRILLE_MS); };
            demarrer();
            bloc.addEventListener("mouseenter", () => clearInterval(minuteur));
            bloc.addEventListener("mouseleave", demarrer);
        }
        return bloc;
    }
 
    async function grille() {
        const g = document.getElementById("grille-boutique-dediee");
        if (!g) return;
        const candidates = cfg.annonces.filter(a => a.emplacement === "grille" && annonceActive(a));
        if (!candidates.length) return;
        const verifs = await Promise.all(candidates.map(a => charger(a.image)));   // l'annonce n'apparaît qu'une fois l'image prête
        const liste = candidates.filter((a, i) => verifs[i]);
        if (!liste.length) return;
        styles();
 
        const groupes = new Map();
        liste.forEach(a => { const k = String(a.slot || "1"); if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(a); });
        const slots = Array.from(groupes.entries()).sort((x, y) => x[0].localeCompare(y[0], undefined, { numeric: true }))
            .map(([k, annonces], rang) => {
                const avecPos = annonces.find(a => Number(a.position) > 0);
                return { id: "slot-" + k, annonces: annonces, position: Math.max(2, avecPos ? Number(avecPos.position) : 6 + rang * 6) };
            });
        const blocs = {};
        let occupe = false;
        const placer = () => {
            if (occupe) return;
            occupe = true;
            try {
                const cartes = g.querySelectorAll(":scope > .zl-carte");
                if (cartes.length >= 2) {
                    const io = obsVue();
                    slots.forEach(sl => {
                        if (blocs[sl.id] && blocs[sl.id].isConnected && blocs[sl.id].parentNode === g) return;
                        if (blocs[sl.id]) blocs[sl.id].arreter();             // la grille a été reconstruite : on nettoie l'ancien carrousel
                        let pos = sl.position;
                        if (cartes.length < pos) pos = Math.floor(cartes.length / 2) * 2;   // petite boutique : après le dernier produit pair
                        let apres = cartes[pos - 1];
                        // pas d'annonce collée à celle de la boutique : on décale de deux produits
                        if (apres.nextElementSibling && apres.nextElementSibling.classList.contains("zl-annonce") && cartes[pos + 1]) apres = cartes[pos + 1];
                        const bloc = construireSlot(sl.id, sl.annonces);
                        blocs[sl.id] = bloc;
                        apres.parentNode.insertBefore(bloc, apres.nextSibling);
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
            const visible = e.isIntersecting && e.intersectionRatio >= 0.5;
            if (visible && !e.target._visible && e.target._vueCourante) e.target._vueCourante();
            e.target._visible = visible;
        }), { threshold: [0, 0.5] });
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
    // ?pub=debug : petit panneau qui explique, annonce par annonce, pourquoi elle s'affiche ou non (utile sur mobile)
    async function debug() {
        const lignes = [];
        lignes.push("boutique de la page : " + (boutiqueBrute || "(aucune)") + "  [" + cle(boutiqueBrute) + "]");
        for (const a of cfg.annonces) {
            let etat = [];
            if (a.actif === false) etat.push("actif=false");
            const j = aujourdhui();
            if (a.debut && j < String(a.debut)) etat.push("pas encore commencée");
            if (a.fin && j > String(a.fin)) etat.push("terminée");
            if (!imageSure(a.image)) etat.push("chemin d'image invalide");
            const b = String(a.boutique || "").trim();
            const bOk = !b || b === "*" || cle(b) === "TOUS" || cle(b) === "TOUTES" || b.split(",").some(x => cle(x) === cle(boutiqueBrute));
            if (!bOk) etat.push("autre boutique (" + b + ")");
            if (!etat.length) {
                try {
                    const t = performance.now();
                    const r = await fetch(a.image, { cache: "no-store" });
                    if (!r.ok) etat.push("IMAGE HTTP " + r.status + " (introuvable)");
                    else { const bl = await r.blob(); etat.push("OK, image " + Math.round(bl.size / 1024) + " Ko, " + Math.round(performance.now() - t) + " ms" + (bl.size > 400 * 1024 ? "  ⚠ TROP LOURDE : compressez" : "")); }
                } catch (e) { etat.push("IMAGE inaccessible"); }
            }
            lignes.push(a.id + " [" + a.emplacement + "] : " + etat.join(", "));
        }
        lignes.push("produits dans la grille : " + document.querySelectorAll("#grille-boutique-dediee > .zl-carte").length);
        lignes.push("bandeau : " + (document.querySelector(".sr-pub-hero") ? "dans le grand bandeau (mode hero)" : (document.getElementById("sr-pub-bandeau") ? "bande sous le grand bandeau (mode bandeau)" : "absent")));
        lignes.push("VERSION du fichier : v2 (carrousel + bandeau dans le hero)");
        lignes.push("cartes pub dans la grille : " + document.querySelectorAll(".sr-pub-gr").length);
        const box = el("pre", { style: "position:fixed;left:8px;right:8px;bottom:8px;z-index:100030;background:#0f172a;color:#e2e8f0;font:11px/1.4 monospace;padding:10px;border-radius:10px;white-space:pre-wrap;max-height:45vh;overflow:auto;opacity:.96;" });
        box.textContent = "DIAGNOSTIC PUB (touchez pour fermer)\n" + lignes.join("\n");
        box.addEventListener("click", () => box.remove());
        document.body.appendChild(box);
        console.log(box.textContent);
    }
 
    async function demarrer() {
        if (sansPub) return;
        const j = await chargerConfig();
        if (!j || !Array.isArray(j.annonces)) return;           // pas de promo.json : le site fonctionne normalement
        cfg = Object.assign({}, cfg, j, { plein_ecran: Object.assign({}, cfg.plein_ecran, j.plein_ecran || {}) });
        cfg.suivi = j.suivi === true;
        bandeau().catch(e => console.warn("[pub] bandeau :", e));
        grille().catch(e => console.warn("[pub] grille :", e));
        try { await pleinEcran(); } catch (e) { console.warn("[pub] plein écran :", e); }
        if (modeDebug) setTimeout(debug, 1500);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(demarrer, 300));
    else setTimeout(demarrer, 300);
})();
 
