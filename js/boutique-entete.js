// =========================================================================
// MODULE EN-TÊTE & BARRE D'OUTILS DE LA BOUTIQUE  (fichier autonome : js/boutique-entete.js)
// Ajoute, sans modifier les autres fichiers :
//   1. dans l'en-tête : un menu (Marché, Boutiques, Offres, Aide) + une rangée de boutiques cliquables
//   2. au-dessus de « Articles Disponibles » : une bande d'avantages + une barre de recherche et de filtres de prix
// Les boutiques sont lues dans la Sheet (catégories) : une nouvelle catégorie crée automatiquement sa pastille.
// =========================================================================
(function () {
    "use strict";
    const WHATSAPP = "261382453610";
    const BOUTIQUES_PAR_DEFAUT = ["Food Express", "Vêtements", "Chaussures", "Technologie"];
    const ICONES = { FOODEXPRESS: "🍔", VETEMENTS: "👕", CHAUSSURES: "👟", TECHNOLOGIE: "📱", ELECTRONIQUE: "📱", BEAUTE: "💄", MAISON: "🏠", SPORT: "⚽", ACCESSOIRES: "👜" };

    const cle = t => String(t || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const maBoutique = cle(new URLSearchParams(window.location.search).get("type") || "");
    const icone = nom => ICONES[cle(nom)] || "🛍️";
    function el(tag, attrs, html) {
        const n = document.createElement(tag);
        Object.keys(attrs || {}).forEach(k => { if (k === "class") n.className = attrs[k]; else n.setAttribute(k, attrs[k]); });
        if (html != null) n.innerHTML = html;
        return n;
    }
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    /* ------------------------------ Liste des boutiques ------------------------------ */
    function listeBoutiques() {
        let produits = window.tousLesProduits;
        if (!Array.isArray(produits) || !produits.length) { try { produits = JSON.parse(localStorage.getItem("saferun_cache_produits") || "[]"); } catch (e) { produits = []; } }
        const m = new Map();
        BOUTIQUES_PAR_DEFAUT.forEach(n => m.set(cle(n), n));
        (Array.isArray(produits) ? produits : []).forEach(p => {
            const nom = String((p && p.Categorie) || "").trim();
            if (!nom) return;
            try { if (typeof estRayonAccueil === "function" && estRayonAccueil(nom)) return; } catch (e) {}
            if (!m.has(cle(nom))) m.set(cle(nom), nom);
        });
        return Array.from(m.values());
    }
    const lien = nom => "boutique.html?type=" + encodeURIComponent(nom);

    /* ------------------------------ Styles ------------------------------ */
    function styles() {
        if (document.getElementById("sr-hd-styles")) return;
        const s = document.createElement("style");
        s.id = "sr-hd-styles";
        s.textContent = `
        .sr-hd-nav{display:flex;align-items:center;gap:4px;font-family:Poppins,sans-serif;}
        .sr-hd-nav a,.sr-hd-nav button.sr-hd-btn{background:none;border:0;color:#1a1a1a;font:600 .82rem Poppins,sans-serif;padding:9px 14px;border-radius:50px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:background .2s;}
        .sr-hd-nav a:hover,.sr-hd-nav button.sr-hd-btn:hover{background:rgba(255,204,0,.28);}
        .sr-hd-nav .sr-hd-actif{background:#1a1a1a;color:#fff;}
        .sr-hd-nav .sr-hd-actif:hover{background:#000;}
        .sr-hd-menu{position:relative;}
        .sr-hd-liste{position:absolute;top:calc(100% + 8px);left:0;min-width:230px;background:#fff;border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.16);padding:8px;display:none;z-index:1100;}
        .sr-hd-liste.ouvert{display:block;}
        .sr-hd-liste a{display:flex;width:100%;box-sizing:border-box;border-radius:10px;padding:10px 12px;font-weight:600;}
        .sr-hd-liste a.sr-hd-actif{background:#fff7d6;color:#1a1a1a;}
        .sr-hd-puce{border:1px solid #e2e8f0;}
        .sr-hd-barre{max-width:1200px;margin:10px auto 0;display:flex;gap:8px;overflow-x:auto;padding:2px 0 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
        .sr-hd-barre::-webkit-scrollbar{display:none;}
        .sr-hd-puce{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;background:#fff;color:#1a1a1a;font:600 .8rem Poppins,sans-serif;padding:8px 15px;border-radius:50px;text-decoration:none;white-space:nowrap;transition:all .2s;}
        .sr-hd-puce:hover{border-color:#ffcc00;background:#fffbe6;}
        .sr-hd-puce.sr-hd-actif{background:linear-gradient(135deg,#ffcc00,#ff9900);border-color:transparent;color:#1a1a1a;box-shadow:0 4px 12px rgba(255,153,0,.3);}
        @media (max-width:820px){.sr-hd-nav{display:none;}}
        @media (min-width:821px){.sr-hd-barre{display:none;}}

        .sr-av{max-width:1200px;margin:0 auto 22px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;font-family:Poppins,sans-serif;}
        .sr-av div{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid rgba(0,0,0,.05);border-radius:16px;padding:14px 16px;box-shadow:0 4px 14px rgba(0,0,0,.03);}
        .sr-av i{font-style:normal;font-size:1.5rem;line-height:1;}
        .sr-av b{display:block;font-size:.84rem;color:#1a1a1a;}
        .sr-av span{display:block;font-size:.72rem;color:#64748b;margin-top:2px;line-height:1.3;}
        @media (max-width:820px){.sr-av{grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px;}.sr-av div{padding:10px 12px;gap:9px;}.sr-av i{font-size:1.2rem;}.sr-av b{font-size:.76rem;}.sr-av span{font-size:.66rem;}}

        .sr-bo{max-width:1200px;margin:0 auto 18px;font-family:Poppins,sans-serif;}
        .sr-bo-ligne{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
        .sr-bo-champ{flex:1 1 260px;position:relative;}
        .sr-bo-champ input{width:100%;box-sizing:border-box;padding:12px 40px 12px 42px;border:1px solid #e2e8f0;border-radius:50px;font:500 .9rem Poppins,sans-serif;background:#fff;outline:none;transition:border .2s,box-shadow .2s;}
        .sr-bo-champ input:focus{border-color:#ffcc00;box-shadow:0 0 0 4px rgba(255,204,0,.2);}
        .sr-bo-champ .sr-bo-loupe{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:.95rem;pointer-events:none;}
        .sr-bo-champ .sr-bo-x{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:#e2e8f0;border:0;width:22px;height:22px;border-radius:50%;cursor:pointer;display:none;font-size:.8rem;line-height:1;color:#475569;}
        .sr-bo-prix{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;}
        .sr-bo-prix::-webkit-scrollbar{display:none;}
        .sr-bo-prix button{flex:0 0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:50px;padding:9px 14px;font:600 .76rem Poppins,sans-serif;color:#334155;cursor:pointer;white-space:nowrap;}
        .sr-bo-prix button.on{background:#1a1a1a;border-color:#1a1a1a;color:#fff;}
        .sr-bo-info{margin-top:10px;font-size:.78rem;color:#64748b;display:flex;justify-content:space-between;gap:10px;}
        .sr-bo-aucun{display:none;text-align:center;padding:30px 16px;color:#64748b;font-size:.9rem;background:#fff;border-radius:16px;border:1px dashed #cbd5e1;margin-bottom:16px;}
        `;
        document.head.appendChild(s);
    }

    /* ------------------------------ En-tête ------------------------------ */
    function construireEntete() {
        const header = document.querySelector("header");
        const conteneur = header && header.querySelector(".header-container");
        if (!header || !conteneur) return;
        const noms = listeBoutiques();

        // --- menu pour grand écran (entre le logo et le bouton retour) ---
        let nav = document.getElementById("sr-hd-nav");
        if (!nav) {
            nav = el("nav", { class: "sr-hd-nav", id: "sr-hd-nav", "aria-label": "Navigation" });
            const retour = conteneur.querySelector(".btn-retour-accueil");
            conteneur.insertBefore(nav, retour || null);
        }
        nav.innerHTML =
            '<a href="index.html">🏠 Marché</a>' +
            '<div class="sr-hd-menu"><button type="button" class="sr-hd-btn" id="sr-hd-ouvrir" aria-haspopup="true" aria-expanded="false">🛍️ Boutiques <i class="fas fa-chevron-down" style="font-size:.65rem"></i></button>' +
            '<div class="sr-hd-liste" id="sr-hd-liste">' + noms.map(n => '<a href="' + lien(n) + '" class="' + (cle(n) === maBoutique ? "sr-hd-actif" : "") + '">' + icone(n) + " " + esc(n) + "</a>").join("") + "</div></div>" +
            '<a href="#sr-bo-ancre" id="sr-hd-offres">🔥 Articles</a>' +
            '<a href="https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent("Bonjour SafeRun Market, j'ai une question.") + '" target="_blank" rel="noopener noreferrer">💬 Aide</a>';
        const ouvrir = document.getElementById("sr-hd-ouvrir"), liste = document.getElementById("sr-hd-liste");
        ouvrir.addEventListener("click", e => { e.stopPropagation(); const o = liste.classList.toggle("ouvert"); ouvrir.setAttribute("aria-expanded", o ? "true" : "false"); });
        if (!window.__srHdFerme) { window.__srHdFerme = true; document.addEventListener("click", () => { const l = document.getElementById("sr-hd-liste"); if (l) l.classList.remove("ouvert"); }); }

        // --- rangée de pastilles (téléphone) ---
        let barre = document.getElementById("sr-hd-barre");
        if (!barre) { barre = el("div", { class: "sr-hd-barre", id: "sr-hd-barre", role: "navigation", "aria-label": "Boutiques" }); header.appendChild(barre); }
        barre.innerHTML = '<a class="sr-hd-puce" href="index.html">🏠 Marché</a>' +
            noms.map(n => '<a class="sr-hd-puce' + (cle(n) === maBoutique ? " sr-hd-actif" : "") + '" href="' + lien(n) + '">' + icone(n) + " " + esc(n) + "</a>").join("");
        const actif = barre.querySelector(".sr-hd-actif");
        if (actif && actif.scrollIntoView) { try { barre.scrollLeft = Math.max(0, actif.offsetLeft - 16); } catch (e) {} }
    }

    /* ------------------------------ Avantages + recherche ------------------------------ */
    let filtre = { q: "", prix: "tous" };
    const normaliser = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const prixDe = carte => { const e = carte.querySelector(".zl-prix"); return e ? (parseInt(String(e.textContent).replace(/[^0-9]/g, ""), 10) || 0) : 0; };
    const dansTranche = (p, t) => t === "tous" || (t === "bas" && p < 20000) || (t === "moyen" && p >= 20000 && p <= 50000) || (t === "haut" && p > 50000);

    function appliquerFiltre() {
        const g = document.getElementById("grille-boutique-dediee");
        if (!g) return;
        const q = normaliser(filtre.q).trim();
        const actif = q !== "" || filtre.prix !== "tous";
        let visibles = 0, total = 0;
        g.querySelectorAll(":scope > .zl-carte").forEach(c => {
            total++;
            const nom = normaliser((c.querySelector(".zl-nom") || {}).textContent);
            const ok = (!q || nom.indexOf(q) !== -1) && dansTranche(prixDe(c), filtre.prix);
            c.style.display = ok ? "" : "none";
            if (ok) visibles++;
        });
        // pendant une recherche, on masque les annonces pour ne montrer que les résultats
        g.querySelectorAll(":scope > .zl-annonce, :scope > .sr-pub-gr").forEach(a => { a.style.display = actif ? "none" : ""; });
        const info = document.getElementById("sr-bo-compte"), aucun = document.getElementById("sr-bo-aucun"), x = document.getElementById("sr-bo-x");
        if (info) info.textContent = total ? (actif ? visibles + " résultat" + (visibles > 1 ? "s" : "") + " sur " + total : total + " article" + (total > 1 ? "s" : "")) : "";
        if (aucun) aucun.style.display = (total && !visibles) ? "block" : "none";
        if (x) x.style.display = q ? "block" : "none";
    }

    function construireOutils() {
        const titre = document.getElementById("section-title-dynamique") || document.querySelector(".section-title");
        if (!titre || document.getElementById("sr-bo")) return;
        const ancre = el("span", { id: "sr-bo-ancre" });
        const av = el("div", { class: "sr-av", id: "sr-av" },
            '<div><i>🚚</i><p style="margin:0"><b>Livraison rapide</b><span>Flash ou standard, selon la boutique</span></p></div>' +
            '<div><i>🔒</i><p style="margin:0"><b>Paiement sécurisé</b><span>MVola, Visa, Mastercard</span></p></div>' +
            '<div><i>✅</i><p style="margin:0"><b>Produits contrôlés</b><span>Qualité vérifiée avant l\'envoi</span></p></div>' +
            '<div><i>💬</i><p style="margin:0"><b>Service client</b><span>Une question ? WhatsApp</span></p></div>');
        const bo = el("div", { class: "sr-bo", id: "sr-bo" },
            '<div class="sr-bo-ligne">' +
              '<div class="sr-bo-champ"><i class="fas fa-search sr-bo-loupe"></i><input id="sr-bo-q" type="search" placeholder="Rechercher dans cette boutique…" autocomplete="off" aria-label="Rechercher un article"><button type="button" class="sr-bo-x" id="sr-bo-x" aria-label="Effacer">&times;</button></div>' +
              '<div class="sr-bo-prix" id="sr-bo-prix" role="group" aria-label="Filtrer par prix">' +
                '<button type="button" data-p="tous" class="on">Tous les prix</button><button type="button" data-p="bas">Moins de 20 000 Ar</button><button type="button" data-p="moyen">20 000 – 50 000 Ar</button><button type="button" data-p="haut">Plus de 50 000 Ar</button>' +
              '</div>' +
            '</div>' +
            '<div class="sr-bo-info"><span id="sr-bo-compte"></span></div>');
        const aucun = el("div", { class: "sr-bo-aucun", id: "sr-bo-aucun" }, "Aucun article ne correspond à votre recherche.<br><small>Essayez un autre mot ou « Tous les prix ».</small>");
        const parent = titre.parentNode;
        parent.insertBefore(ancre, titre);
        parent.insertBefore(av, titre);
        parent.insertBefore(bo, titre);
        titre.parentNode.insertBefore(aucun, titre.nextSibling);

        const champ = document.getElementById("sr-bo-q");
        champ.addEventListener("input", () => { filtre.q = champ.value; appliquerFiltre(); });
        document.getElementById("sr-bo-x").addEventListener("click", () => { champ.value = ""; filtre.q = ""; appliquerFiltre(); champ.focus(); });
        document.querySelectorAll("#sr-bo-prix button").forEach(b => b.addEventListener("click", () => {
            document.querySelectorAll("#sr-bo-prix button").forEach(x => x.classList.toggle("on", x === b));
            filtre.prix = b.getAttribute("data-p"); appliquerFiltre();
        }));
        // la grille est reconstruite (cache puis données fraîches) : on réapplique le filtre à chaque fois
        const g = document.getElementById("grille-boutique-dediee");
        if (g) {
            let plan = false;
            new MutationObserver(() => { if (plan) return; plan = true; requestAnimationFrame(() => { plan = false; appliquerFiltre(); }); }).observe(g, { childList: true });
        }
        appliquerFiltre();
    }

    /* ------------------------------ Démarrage ------------------------------ */
    function demarrer() {
        styles();
        try { construireEntete(); } catch (e) { console.warn("[entête]", e); }
        try { construireOutils(); } catch (e) { console.warn("[outils]", e); }
        // quand les produits arrivent de la Sheet, on met à jour la liste des boutiques (nouvelles catégories)
        let essais = 0, derniere = listeBoutiques().join("|");
        const t = setInterval(() => {
            essais++;
            const maintenant = listeBoutiques().join("|");
            if (maintenant !== derniere) { derniere = maintenant; try { construireEntete(); } catch (e) {} }
            if (essais > 40) clearInterval(t);
        }, 500);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer); else demarrer();
})();