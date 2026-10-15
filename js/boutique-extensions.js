(function() {
    // Images de secours uniquement (le menu utilise d'abord l'image réelle d'un produit de la boutique)
    const IMAGES_DEMO_BOUTIQUES = {
        "VETEMENTS": "https://i.imgur.com/jKHHTgl.jpeg", 
        "CHAUSSURES": "https://i.imgur.com/Fo4VcB7.jpeg",
        "DEFAUT": "https://i.imgur.com/L5uiDsH.png"
    };

    // [AJOUT] Outils pour le menu dynamique
    function normaliserCle(texte) {
        return String(texte || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    }

    // Répare les liens d'images "page" (imgur.com/xxxx, Google Drive) en liens directs
    function normaliserUrlImage(brut) {
        let url = String(brut || "").trim();
        if (!url) return "";
        if (/^\/\//.test(url)) url = "https:" + url;
        if (!/^https?:\/\//i.test(url) && /^(i\.)?imgur\.com\//i.test(url)) url = "https://" + url;
        url = url.replace(/^http:\/\//i, "https://");
        let m = url.match(/^https:\/\/(?:www\.)?imgur\.com\/(?!a\/|gallery\/)([A-Za-z0-9]{5,8})(?:\.[a-z]{3,4})?(?:[?#].*)?$/i);
        if (m) return "https://i.imgur.com/" + m[1] + ".jpg";
        m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || url.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/);
        if (m) return "https://lh3.googleusercontent.com/d/" + m[1];
        return url;
    }

    // Rayons déjà gérés par l'accueil : pas de bouton de boutique pour eux
    function estRayonAccueil(nomOuCle) {
        const k = normaliserCle(nomOuCle).replace(/[^A-Z0-9]/g, "");
        return ["PPN", "PRODUITSDEPREMIERENECESSITE", "ALIMENTAIRE", "CONSERVES", "FRAIS", "HYGIENE", "ENERGIE", "BOULANGERIE"].indexOf(k) !== -1;
    }

    function echapper(texte) {
        return String(texte).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    document.addEventListener("DOMContentLoaded", () => {
        // Clic à l'extérieur pour fermer le menu déroulant haut
        document.addEventListener("click", function(e) {
            if (!e.target.closest('.autres-boutiques-container')) {
                const dropdown = document.getElementById("liste-dropdown-boutiques");
                if (dropdown) dropdown.style.display = "none";
            }
        });
        
        // Auto-intégration du menu haut "Autres boutiques" à gauche du champ de recherche
        const searchWrapper = document.querySelector(".search-wrapper");
        if(searchWrapper && !document.querySelector(".autres-boutiques-container")) {
            const menuContainer = document.createElement("div");
            menuContainer.className = "autres-boutiques-container";
            menuContainer.style = "position: relative; display: inline-block; margin-right: 10px; z-index: 1005;";
            menuContainer.innerHTML = `
                <button class="btn-autres-boutiques" onclick="toggleMenuBoutiques(event)" style="background: linear-gradient(135deg, #ffcc00, #ff9900); color: #1a1a1a; border: none; padding: 10px 15px; border-radius: 50px; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-store"></i> Boutiques <i class="fas fa-chevron-down" style="font-size: 0.7rem;"></i>
                </button>
                <div id="liste-dropdown-boutiques" style="display: none; position: absolute; top: 110%; left: 0; background: white; min-width: 240px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid #eee; overflow: hidden; padding: 5px 0;"></div>`;
            searchWrapper.parentNode.insertBefore(menuContainer, searchWrapper);
        }
    });

    window.toggleMenuBoutiques = function(event) {
        event.stopPropagation();
        const dropdown = document.getElementById("liste-dropdown-boutiques");
        if (!dropdown) return;
        dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
        
        const produits = window.tousLesProduits || [];
        window.genererMenuDropdownBoutiques(produits);
    };

    // [MODIFIÉ] Le menu est construit à partir des catégories réellement présentes dans la Sheet
    window.genererMenuDropdownBoutiques = function(tousLesProduits) {
        const dropdown = document.getElementById("liste-dropdown-boutiques");
        if (!dropdown) return;

        let source = Array.isArray(tousLesProduits) ? tousLesProduits : [];
        if (!source.length) {
            try { source = JSON.parse(localStorage.getItem("saferun_cache_produits") || "[]"); } catch (e) { source = []; }
        }

        // 1 boutique par catégorie + 1re image valide d'un produit non épuisé de cette catégorie
        const boutiques = new Map();
        source.forEach(p => {
            const nom = String((p && p.Categorie) || "").trim();
            if (!nom) return;
            if (estRayonAccueil(nom)) return;   // rayons déjà présents sur l'accueil
            const cle = normaliserCle(nom);
            if (!boutiques.has(cle)) boutiques.set(cle, { cle: cle, nom: nom, image: "" });
            const b = boutiques.get(cle);
            const url = normaliserUrlImage(p.Image_URL || p.Image);
            const epuise = String(p.Options_Disponibles || "").trim().toUpperCase() === "EPUISE";
            if (!b.image && !epuise && /^https?:\/\//i.test(url)) b.image = url;
        });

        // Secours si la Sheet n'a pas encore été chargée
        if (!boutiques.size) {
            ["VETEMENTS", "CHAUSSURES"].forEach(n => boutiques.set(n, { cle: n, nom: n, image: "" }));
        }

        dropdown.innerHTML = "";
        if (!boutiques.size) {
            dropdown.innerHTML = '<div style="padding:12px 15px;font-size:.8rem;color:#64748b;">Aucune autre boutique pour le moment</div>';
            return;
        }
        boutiques.forEach(b => {
            const nomPropre = b.nom.charAt(0).toUpperCase() + b.nom.slice(1).toLowerCase();
            const secours = IMAGES_DEMO_BOUTIQUES[b.cle] || IMAGES_DEMO_BOUTIQUES["DEFAUT"];
            const urlImage = b.image || secours;
            const item = document.createElement("a");
            item.href = `boutique.html?type=${encodeURIComponent(b.nom)}`;
            item.style = "display:flex; justify-content:space-between; align-items:center; padding:10px 15px; color:#1a1a1a; text-decoration:none; font-size:0.85rem; font-weight:600; border-bottom:1px solid #f9f9f9;";
            item.innerHTML = `<div><span>Espace ${echapper(nomPropre)}</span></div><img src="${echapper(urlImage)}" onerror="this.onerror=null;this.src='${IMAGES_DEMO_BOUTIQUES["DEFAUT"]}'" style="width:28px; height:28px; object-fit:cover; border-radius:6px; margin-left:10px;">`;
            dropdown.appendChild(item);
        });
    };

    window.genererStructureOptionsStock = function(produit) {
        const optionsBrutes = produit.Options_Disponibles ? produit.Options_Disponibles.trim() : "";
        if (optionsBrutes.toUpperCase() === "EPUISE") return `<span style="color:#ef4444; font-size:0.75rem; font-weight:700;">Rupture de stock</span>`;
        if (!optionsBrutes || optionsBrutes.toUpperCase() === "UNIQUE") return `<input type="hidden" id="opt-taille-${produit.ID}" value="Unique">`;
        
        const listeOptions = optionsBrutes.split(",").map(o => o.trim());
        let htmlSelect = `<div style="margin: 8px 0; text-align: left;"><select id="opt-taille-${produit.ID}" style="width: 100%; padding: 6px; border-radius: 8px; border: 1px solid #ddd; font-size: 0.8rem;">`;
        listeOptions.forEach(opt => { htmlSelect += `<option value="${opt}">${opt}</option>`; });
        return htmlSelect + `</select></div>`;
    };

    /* ---- PANIER PARTAGÉ avec main.js (même clé localStorage : saferun_panier) ---- */
    function lirePanier() {
        try { const p = JSON.parse(localStorage.getItem('saferun_panier') || '[]'); return Array.isArray(p) ? p : []; }
        catch (err) { return []; }
    }
    function ecrirePanier(p) { localStorage.setItem('saferun_panier', JSON.stringify(p)); }
    function compterArticles() {
        let n = 0;
        lirePanier().forEach(a => { n += Number(a.quantite) || 0; });
        return n;
    }
    function fmtAr(n) { return (Number(n) || 0).toLocaleString('fr-FR') + ' Ar'; }

    function afficherToast(html) {
        let t = document.getElementById('sr-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'sr-toast';
            t.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#1e293b;color:#fff;padding:12px 18px;border-radius:12px;font:500 0.85rem Poppins,sans-serif;z-index:100002;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:90vw;text-align:center;pointer-events:none;';
            document.body.appendChild(t);
        }
        t.innerHTML = html;
        t.style.display = 'block';
        clearTimeout(t._t);
        t._t = setTimeout(() => { t.style.display = 'none'; }, 3200);
    }

    // Retrouve le produit de la Sheet d'après le nom du panier (« Nom [option] »)
    function trouverProduitParNom(nomPanier) {
        const base = String(nomPanier).replace(/\s*\[[^\]]*\]\s*$/, "").trim();
        let liste = window.tousLesProduits;
        if (!Array.isArray(liste) || !liste.length) {
            try { liste = JSON.parse(localStorage.getItem('saferun_cache_produits') || '[]'); } catch (err) { liste = []; }
        }
        return liste.find(p => String(p.Nom).trim() === base) || null;
    }

    /* ---- Icône panier (en-tête + bouton flottant) avec pastille du nombre d'articles ---- */
    function creerIcones() {
        if (!document.getElementById('grille-boutique-dediee')) return;
        const style = 'position:relative;background:#1a1a1a;color:#fff;border:0;width:42px;height:42px;border-radius:50%;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:1rem;margin-left:10px;flex-shrink:0;';
        const searchWrapper = document.querySelector('.search-wrapper');
        if (searchWrapper && !document.getElementById('sr-icone-panier')) {
            const b = document.createElement('button');
            b.id = 'sr-icone-panier'; b.type = 'button'; b.setAttribute('aria-label', 'Ouvrir le panier');
            b.style.cssText = style;
            b.innerHTML = '<i class="fas fa-shopping-cart"></i><span class="sr-pastille"></span>';
            b.addEventListener('click', ouvrirPanier);
            searchWrapper.parentNode.insertBefore(b, searchWrapper.nextSibling);
        }
        if (!document.getElementById('sr-btn-panier')) {
            const f = document.createElement('button');
            f.id = 'sr-btn-panier'; f.type = 'button'; f.setAttribute('aria-label', 'Ouvrir le panier');
            f.style.cssText = 'position:fixed;right:16px;bottom:20px;background:#27ae60;color:#fff;border:0;width:56px;height:56px;border-radius:50%;font-size:1.2rem;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer;';
            f.innerHTML = '<i class="fas fa-shopping-cart"></i><span class="sr-pastille"></span>';
            f.addEventListener('click', ouvrirPanier);
            document.body.appendChild(f);
        }
        if (!document.getElementById('sr-styles-panier')) {
            const s = document.createElement('style');
            s.id = 'sr-styles-panier';
            s.textContent = `
            .sr-pastille{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#ef4444;color:#fff;font:700 .7rem/20px Poppins,sans-serif;text-align:center;box-sizing:border-box;}
            #sr-fond{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100000;display:none;}
            #sr-volet{position:fixed;top:0;right:0;height:100%;width:min(420px,100%);background:#fff;z-index:100001;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .3s;font-family:Poppins,sans-serif;box-shadow:-10px 0 30px rgba(0,0,0,.2);}
            #sr-volet.ouvert{transform:translateX(0);}
            .sr-vol-tete{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #eee;font-weight:700;font-size:1rem;}
            .sr-vol-tete button{background:none;border:0;font-size:1.3rem;cursor:pointer;color:#475569;}
            .sr-vol-corps{flex:1;overflow-y:auto;padding:8px 16px;}
            .sr-ligne{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f1f3f5;align-items:center;}
            .sr-ligne img{width:64px;height:80px;object-fit:cover;border-radius:6px;background:#f1f3f5;flex-shrink:0;}
            .sr-ligne-info{flex:1;min-width:0;}
            .sr-ligne-nom{font-size:.85rem;font-weight:600;color:#1a1a1a;line-height:1.25;}
            .sr-ligne-opt{font-size:.72rem;color:#64748b;margin-top:2px;}
            .sr-ligne-prix{font-size:.85rem;font-weight:700;margin-top:4px;}
            .sr-qte{display:flex;align-items:center;gap:8px;margin-top:6px;}
            .sr-qte button{width:28px;height:28px;border-radius:50%;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font-size:1rem;line-height:1;}
            .sr-qte span{min-width:18px;text-align:center;font-weight:600;font-size:.85rem;}
            .sr-qte .sr-poubelle{margin-left:auto;border:0;color:#ef4444;font-size:1rem;}
            .sr-vide{text-align:center;color:#64748b;padding:50px 10px;font-size:.9rem;}
            .sr-vol-pied{padding:14px 18px 18px;border-top:1px solid #eee;}
            .sr-total{display:flex;justify-content:space-between;font-weight:700;font-size:1rem;margin-bottom:12px;}
            #sr-detail{max-height:34vh;overflow-y:auto;}
            #sr-valider{width:100%;background:#27ae60;color:#fff;border:0;padding:14px;border-radius:10px;font:700 .95rem Poppins,sans-serif;cursor:pointer;}
            #sr-valider:disabled{background:#cbd5e1;cursor:not-allowed;}
            `;
            document.head.appendChild(s);
        }
        mettreAJourPastilles();
    }

    function mettreAJourPastilles() {
        const n = compterArticles();
        document.querySelectorAll('.sr-pastille').forEach(p => { p.textContent = n; p.style.display = n > 0 ? 'block' : 'none'; });
    }

    /* ---- Volet récapitulatif ---- */
    function ouvrirPanier() {
        if (!document.getElementById('sr-volet')) {
            const fond = document.createElement('div');
            fond.id = 'sr-fond';
            fond.addEventListener('click', fermerPanier);
            const volet = document.createElement('aside');
            volet.id = 'sr-volet';
            volet.innerHTML = `
                <div class="sr-vol-tete"><span>🛒 Mon panier</span><button type="button" aria-label="Fermer" id="sr-fermer">&times;</button></div>
                <div class="sr-vol-corps" id="sr-corps"></div>
                <div class="sr-vol-pied">
                    <div id="sr-detail"></div>
                    <div class="sr-total"><span>Total à payer</span><span id="sr-total">0 Ar</span></div>
                    <button type="button" id="sr-valider">Valider ma commande</button>
                </div>`;
            document.body.appendChild(fond);
            document.body.appendChild(volet);
            document.getElementById('sr-fermer').addEventListener('click', fermerPanier);
            document.getElementById('sr-valider').addEventListener('click', validerCommande);
        }
        const toast = document.getElementById('sr-toast'); if (toast) toast.style.display = 'none';
        rendreVolet();
        document.getElementById('sr-fond').style.display = 'block';
        requestAnimationFrame(() => document.getElementById('sr-volet').classList.add('ouvert'));
    }
    function fermerPanier() {
        const v = document.getElementById('sr-volet'), f = document.getElementById('sr-fond');
        if (v) v.classList.remove('ouvert');
        if (f) f.style.display = 'none';
    }

    function rendreVolet() {
        const corps = document.getElementById('sr-corps');
        if (!corps) return;
        const panier = lirePanier();
        corps.innerHTML = '';
        let total = 0;
        if (!panier.length) {
            corps.innerHTML = '<div class="sr-vide">Votre panier est vide.<br>Ajoutez des articles depuis la boutique.</div>';
        }
        panier.forEach((a, i) => {
            const q = Number(a.quantite) || 0, px = Number(a.prix) || 0;
            total += q * px;
            const prod = trouverProduitParNom(a.nom);
            const img = prod ? (normaliserUrlImage(prod.Image_URL || prod.Image) || '') : '';
            const m = String(a.nom).match(/^(.*?)\s*\[([^\]]*)\]\s*$/);
            const nomAff = m ? m[1] : a.nom, opt = m ? m[2] : '';
            const ligne = document.createElement('div');
            ligne.className = 'sr-ligne';
            ligne.innerHTML = `
                <img src="${echapper(img || 'https://placehold.co/128x160?text=SafeRun')}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://placehold.co/128x160?text=SafeRun'">
                <div class="sr-ligne-info">
                    <div class="sr-ligne-nom">${echapper(nomAff)}</div>
                    ${opt ? `<div class="sr-ligne-opt">Option : ${echapper(opt)}</div>` : ''}
                    <div class="sr-ligne-prix">${fmtAr(px)}</div>
                    <div class="sr-qte">
                        <button type="button" data-act="moins" aria-label="Diminuer">&minus;</button>
                        <span>${q}</span>
                        <button type="button" data-act="plus" aria-label="Augmenter">+</button>
                        <button type="button" class="sr-poubelle" data-act="suppr" aria-label="Supprimer"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
            ligne.querySelectorAll('button[data-act]').forEach(btn => btn.addEventListener('click', () => modifierLigne(i, btn.getAttribute('data-act'))));
            corps.appendChild(ligne);
        });
        let r = null;
        try { r = window.SRCheckout ? window.SRCheckout.resume(panier) : null; } catch (err) { r = null; }
        const detail = document.getElementById('sr-detail');
        if (detail) detail.innerHTML = r ? window.SRCheckout.htmlResume(r) : '';
        document.getElementById('sr-total').textContent = fmtAr(r ? r.total : total);
        document.getElementById('sr-valider').disabled = !panier.length || !!(r && r.bloque);
    }

    function modifierLigne(i, action) {
        const panier = lirePanier();
        if (!panier[i]) return;
        if (action === 'plus') panier[i].quantite = (Number(panier[i].quantite) || 0) + 1;
        else if (action === 'moins') panier[i].quantite = (Number(panier[i].quantite) || 0) - 1;
        if (action === 'suppr' || panier[i].quantite <= 0) panier.splice(i, 1);
        ecrirePanier(panier);
        rendreVolet();
        mettreAJourPastilles();
        rafraichirCompteurs();
    }

    // Validation : toute la commande (créneau, paiement, confirmation) se fait dans la boutique (module SRCheckout)
    function validerCommande() {
        if (!lirePanier().length) return;
        if (window.SRCheckout) { window.SRCheckout.demarrer(); return; }
        afficherToast('Module de commande indisponible, rechargez la page.');
    }

    function nomLignePanier(prod, option) {
        return (option && option !== "Unique") ? prod.Nom + " [" + option + "]" : prod.Nom;
    }
    function optionChoisieDe(produitId) {
        const sel = document.getElementById('opt-taille-' + produitId);
        return sel ? sel.value : "Unique";
    }

    // Change la quantité d'un produit dans le panier partagé (delta = +1 ou -1). Renvoie la nouvelle quantité (ou null)
    function ajusterQuantite(produitId, option, delta) {
        const liste = window.tousLesProduits || [];
        const prod = liste.find(p => String(p.ID) === String(produitId));
        if (!prod) { afficherToast("Produit introuvable, rechargez la page."); return null; }

        if (delta > 0 && !localStorage.getItem('saferun_secteur_valide')) {
            afficherToast('Choisissez d\'abord votre zone de livraison sur <a href="index.html" style="color:#7CFC9A;font-weight:700;">la page d\'accueil</a>.');
            return null;
        }

        const nom = nomLignePanier(prod, option);
        const prix = Number(String(prod.Prix).replace(/[^0-9.]/g, "")) || 0;
        const panier = lirePanier();
        const idx = panier.findIndex(a => a.nom === nom);
        let qte = idx === -1 ? 0 : (Number(panier[idx].quantite) || 0);
        qte = Math.max(0, qte + delta);

        if (idx === -1 && qte > 0) panier.push({ nom: nom, prix: prix, quantite: qte });
        else if (idx !== -1 && qte > 0) panier[idx].quantite = qte;
        else if (idx !== -1) panier.splice(idx, 1);
        ecrirePanier(panier);

        if (delta > 0) afficherToast('\u2705 ' + nom + ' ajouté au panier');
        mettreAJourPastilles();
        rafraichirCompteurs();
        if (document.getElementById('sr-volet') && document.getElementById('sr-volet').classList.contains('ouvert')) rendreVolet();
        return qte;
    }
    function ajouterAuPanierPartage(produitId, option) { return ajusterQuantite(produitId, option, 1); }

    // Quantité actuellement dans le panier pour un produit (selon l'option choisie sur la carte)
    function quantiteDansPanier(produitId) {
        const prod = (window.tousLesProduits || []).find(p => String(p.ID) === String(produitId));
        if (!prod) return 0;
        const nom = nomLignePanier(prod, optionChoisieDe(produitId));
        const ligne = lirePanier().find(a => a.nom === nom);
        return ligne ? (Number(ligne.quantite) || 0) : 0;
    }

    // Met à jour tous les compteurs −/0/+ affichés sur les cartes
    function rafraichirCompteurs() {
        document.querySelectorAll('.zl-compteur[data-pid]').forEach(el => {
            const q = quantiteDansPanier(el.getAttribute('data-pid'));
            el.textContent = q;
            const moins = el.parentNode.querySelector('[data-act="moins"]');
            if (moins) moins.disabled = q <= 0;
        });
    }
    window.ajusterQuantitePanier = function (produitId, delta) { return ajusterQuantite(produitId, optionChoisieDe(produitId), delta); };
    window.rafraichirCompteursCartes = rafraichirCompteurs;
    window.addEventListener('storage', () => { mettreAJourPastilles(); rafraichirCompteurs(); if (document.getElementById('sr-corps')) rendreVolet(); });
    document.addEventListener('DOMContentLoaded', () => setTimeout(creerIcones, 600));
    window.ouvrirPanierBoutique = ouvrirPanier;
    window.fermerPanierBoutique = fermerPanier;

    window.ajouterAuPanierNouveauSysteme = function(produitId, categorie) {
        const selecteur = document.getElementById(`opt-taille-${produitId}`);
        const optionChoisie = selecteur ? selecteur.value : "Unique";
        
        ajouterAuPanierPartage(produitId, optionChoisie);
    };
})();

// =========================================================================
// MODULE DE CHAT (branché sur le Google Apps Script : feuille "Chat")
// - envoi : action "sendChatMessage" (texte ou photo, la photo part sur Cloudinary côté script)
// - réception : action "readChat" (affiche aussi les réponses de l'admin et de l'assistante)
// - l'historique local "saferun_chat_history" reste partagé avec la page d'accueil
// Tout est dans une fonction isolée : aucun risque de conflit de noms avec main.js
// =========================================================================
(function () {
    const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";
    const CLE_HISTORIQUE = "saferun_chat_history";
    const INTERVALLE_MS = 10000;   // vérification des nouvelles réponses quand le chat est ouvert
    let timer = null;

    /* ------------------------------ Outils ------------------------------ */

    // Identité du client : EXACTEMENT la même règle que la page d'accueil (téléphone, sinon GUEST-xxxx)
    // → une seule conversation par client, quelle que soit la page utilisée.
    function idClient() {
        // Si main.js est chargé sur la page, on utilise directement sa fonction (garantie d'identité unique)
        if (typeof window.obtenirIdentiteChat === "function") {
            try { return window.obtenirIdentiteChat(); } catch (e) {}
        }
        // Sinon : copie fidèle de la même règle
        try {
            const telClient = localStorage.getItem('saferun_tel');
            if (telClient && telClient !== "") return telClient;

            let guestId = localStorage.getItem('saferun_guest_id');
            if (!guestId) {
                guestId = "GUEST-" + Math.floor(1000 + Math.random() * 9000);
                localStorage.setItem('saferun_guest_id', guestId);
            }
            return guestId;
        } catch (e) {
            return "GUEST-" + Math.floor(1000 + Math.random() * 9000);
        }
    }

    function lireHistorique() {
        try { return JSON.parse(localStorage.getItem(CLE_HISTORIQUE) || "[]"); } catch (e) { return []; }
    }

    function ecrireHistorique(liste) {
        try { localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(liste)); } catch (e) {
            console.warn("[SafeRun] Mémoire locale pleine : l'historique du chat n'a pas pu être sauvegardé.");
        }
    }

    function estImage(texte) {
        return /^data:image/.test(texte) ||
               /^https?:\/\/res\.cloudinary\.com\//i.test(texte) ||
               /^https?:\/\/\S+\.(png|jpe?g|webp|gif)(\?\S*)?$/i.test(texte);
    }

    // Réduit la photo avant envoi (max 1024 px, JPEG) : plus rapide et ne remplit pas la mémoire du téléphone
    function reduireImage(file, maxCote, qualite) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const ratio = Math.min(1, maxCote / Math.max(img.width, img.height));
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.round(img.width * ratio);
                    canvas.height = Math.round(img.height * ratio);
                    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/jpeg", qualite));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Bulle de discussion (mêmes styles qu'avant) ; variante "marche" pour la page d'accueil
    function creerBulle(msg, variante) {
        const client = msg.expediteur === "client";
        const bulle = document.createElement("div");
        const texte = String(msg.texte || "");

        if (variante === "marche") {
            bulle.className = client ? "message msg-client" : "message msg-admin";
            bulle.style.marginBottom = "10px";
        } else {
            bulle.style.maxWidth = "75%";
            bulle.style.background = client ? "#dcf8c6" : "#ffffff";
        }
        bulle.style.position = "relative";
        bulle.style.padding = "8px 12px";
        bulle.style.fontSize = "0.92rem";
        bulle.style.lineHeight = "1.4";
        bulle.style.wordWrap = "break-word";
        bulle.style.borderRadius = client ? "15px 15px 0 15px" : "15px 15px 15px 0";
        bulle.style.alignSelf = client ? "flex-end" : "flex-start";
        bulle.style.boxShadow = "0 1px 1px rgba(0,0,0,0.1)";

        if (estImage(texte)) {
            const img = document.createElement("img");
            img.src = texte;
            img.style.cssText = "max-width: 100%; border-radius: 10px; display: block; margin-top: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);";
            bulle.appendChild(img);
        } else {
            bulle.textContent = texte;
        }
        return bulle;
    }

    /* ------------------------- Affichage du chat ------------------------- */

    // Charger et afficher l'historique de discussion partagé (fenêtre de la boutique)
    window.chargerHistoriqueMessagesPartages = function () {
        const msgContainer = document.getElementById('chat-messages');
        if (!msgContainer) return;
        if (typeof window.chargerMessagesChat === "function") return; // main.js est propriétaire du chat

        const historiqueBrut = localStorage.getItem(CLE_HISTORIQUE);
        let historique = [];
        try { historique = historiqueBrut ? JSON.parse(historiqueBrut) : []; } catch (e) { historique = []; }
        if (!historique.length) {
            historique = [{ expediteur: "admin", texte: "Manao ahoana! Inona no afaka ampiana anao?" }]; // Message d'accueil par défaut
        }

        msgContainer.innerHTML = "";
        historique.forEach(msg => msgContainer.appendChild(creerBulle(msg, "boutique")));
        msgContainer.scrollTop = msgContainer.scrollHeight;   // défilement automatique vers le bas
    };

    // Synchronisation du chat sur le marché principal (index.html)
    window.synchroniserChatSurMarchePrincipal = function () {
        const msgContainerMarche = document.getElementById('chat-messages');
        if (!msgContainerMarche || window.location.search.includes('type=')) return;
        if (typeof window.chargerMessagesChat === "function") return; // main.js est propriétaire du chat

        const historiqueBrut = localStorage.getItem(CLE_HISTORIQUE);
        if (!historiqueBrut) return;
        let historique = [];
        try { historique = JSON.parse(historiqueBrut); } catch (e) { return; }

        msgContainerMarche.innerHTML = "";
        historique.forEach(msg => msgContainerMarche.appendChild(creerBulle(msg, "marche")));
        msgContainerMarche.scrollTop = msgContainerMarche.scrollHeight;
    };

    function rafraichirAffichage() {
        window.chargerHistoriqueMessagesPartages();
        window.synchroniserChatSurMarchePrincipal();
    }

    /* --------------------------- Réception serveur --------------------------- */

    function rafraichirDepuisServeur() {
        return fetch(API_URL + "?action=readChat&idClient=" + encodeURIComponent(idClient()))
            .then(r => r.json())
            .then(liste => {
                if (!Array.isArray(liste) || !liste.length) return;

                const serveur = liste.map(m => ({
                    expediteur: /admin|support/i.test(String(m.expediteur || "")) ? "admin" : "client",
                    texte: String(m.message || ""),
                    date: m.date
                }));

                // On garde les messages envoyés depuis moins d'une minute que le serveur n'a pas encore renvoyés
                const enAttente = lireHistorique().filter(m =>
                    m.pending &&
                    (Date.now() - new Date(m.date).getTime()) < 60000 &&
                    !serveur.some(s => s.expediteur === "client" && s.texte === m.texte)
                );

                ecrireHistorique(serveur.concat(enAttente));
                rafraichirAffichage();
            })
            .catch(err => console.warn("[SafeRun] Lecture du chat impossible pour l'instant.", err));
    }

    /* ----------------------------- Envoi serveur ----------------------------- */

    function expediteurClient() {
        try {
            const n = localStorage.getItem('saferun_nom');
            if (n && n !== "Anonyme") return n;
        } catch (err) {}
        return idClient();
    }

    function envoyerAuServeur(extra) {
        const corps = Object.assign({
            action: "sendChatMessage",      // l'action réellement lue par votre Apps Script
            idClient: idClient(),
            expediteur: expediteurClient()
        }, extra);

        return fetch(API_URL, {
            method: "POST",
            mode: "no-cors",                // évite les blocages CORS ; la réponse n'est pas lisible
            body: JSON.stringify(corps)
        }).catch(err => console.warn("[SafeRun] Erreur d'envoi du message au serveur.", err));
    }

    function ajouterMessageLocal(texte) {
        const historique = lireHistorique();
        historique.push({ expediteur: "client", texte: texte, date: new Date().toISOString(), pending: true });
        ecrireHistorique(historique);
        rafraichirAffichage();
    }

    // Ouvrir ou fermer la fenêtre de discussion
    window.toggleChatExtension = function () {
        const chatWindow = document.getElementById('chat-window');
        if (!chatWindow) return;

        if (chatWindow.style.display === "none" || chatWindow.style.display === "") {
            chatWindow.style.display = "flex";
            window.chargerHistoriqueMessagesPartages();
            rafraichirDepuisServeur();
            if (!timer) timer = setInterval(rafraichirDepuisServeur, INTERVALLE_MS);
        } else {
            chatWindow.style.display = "none";
            if (timer) { clearInterval(timer); timer = null; }
        }
    };

    // Envoi d'un message texte
    window.envoyerMessageChatExtension = function () {
        const input = document.getElementById("chat-input");
        if (!input || !input.value.trim()) return;

        const texteMessage = input.value.trim();
        input.value = "";
        ajouterMessageLocal(texteMessage);   // affichage immédiat côté client

        envoyerAuServeur({ message: texteMessage })
            .then(() => setTimeout(rafraichirDepuisServeur, 2000));
    };

    // Envoi d'une photo (réduite avant envoi, puis hébergée par le script sur Cloudinary)
    window.envoyerPhotoChatExtension = function (event) {
        const file = event.target.files[0];
        if (!file || !/^image\//.test(file.type)) return;

        reduireImage(file, 1024, 0.7)
            .then(dataUrl => {
                ajouterMessageLocal(dataUrl);
                return envoyerAuServeur({ image: dataUrl, message: "" });
            })
            .then(() => setTimeout(rafraichirDepuisServeur, 4000))
            .catch(err => console.warn("[SafeRun] Photo illisible.", err));

        event.target.value = "";   // permet de renvoyer la même photo plus tard
    };

    // Mise à jour en direct quand une autre page/onglet modifie l'historique
    window.addEventListener('storage', (e) => {
        if (e.key === CLE_HISTORIQUE) rafraichirAffichage();
    });

    // Synchronisation initiale après un court instant pour laisser le temps à main.js de s'initialiser
    setTimeout(window.synchroniserChatSurMarchePrincipal, 1000);
})();

// =========================================================================
// MODULE LIVRAISON & COMMANDE DE LA BOUTIQUE (étapes 2, 3)
// - Frais : colonnes Sheet "Frais", "Horaire_Livraison", "Type_Livraison" (+ "Poids" déjà utilisée par l'accueil)
// - Règles : le frais le plus élevé du panier ; tarif de la zone (15 %, minimum) dès que le seuil est atteint
//            ou si le panier contient un produit d'accueil ; gratuit au-dessus du seuil de la zone
// - Jours : dimanche toujours fermé + dates "getDatesFermees" du Sheet
// - Achat 100 % dans la boutique : récapitulatif → créneau → envoi (nouvelleCommande) → paiement → « Terminer »
// - Mêmes clés localStorage que main.js : l'accueil (sidebar, livraisons, chat) continue de fonctionner
// Tout est isolé dans une fonction : aucun conflit de noms avec main.js.
// =========================================================================
(function () {
    const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";
    const SITE_KEY_RECAPTCHA = "6Le_sp4tAAAAANYKex_BBhz7KP8TFc5f_g9H_1Nn";
    const NUMERO_MVOLA = "0382453610";
    const NUMERO_MVOLA_AFFICHE = "038 24 536 10";
    const SEUIL_PAIEMENT_LIVRAISON = 30000;      // comme main.js : paiement à la livraison sous 30 000 Ar
    const TARIF_KG_SUPP = 500;
    const SEUILS_POIDS = { velo: { leger: 8, plafond: 15 }, moto: { leger: 15, plafond: 25 } };

    let joursFermes = [];
    try {
        fetch(API_URL + "?action=getDatesFermees").then(r => r.json()).then(j => {
            if (Array.isArray(j)) joursFermes = j.map(x => String(x).trim());
        }).catch(() => {});
    } catch (e) {}

    /* ------------------------------ Outils ------------------------------ */
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const fmt = n => (Number(n) || 0).toLocaleString("fr-FR") + " Ar";
    const entier = v => { const n = parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10); return isNaN(n) ? null : n; };
    const decimal = v => { const n = parseFloat(String(v == null ? "" : v).replace(",", ".").replace(/[^0-9.]/g, "")); return isNaN(n) ? 0 : n; };
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const isoLocal = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const fmtH = x => { const h = Math.floor(x), m = Math.round((x - h) * 60); return h + "h" + (m ? String(m).padStart(2, "0") : ""); };
    const lire = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } };
    const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
    const retirer = k => { try { localStorage.removeItem(k); } catch (e) {} };
    function lirePanierLocal() { try { const p = JSON.parse(lire("saferun_panier", "[]")); return Array.isArray(p) ? p : []; } catch (e) { return []; } }
    function tarifsZone() {
        const tm = entier(lire("saferun_tarif_minimal", null));
        const sg = entier(lire("saferun_seuil_gratuite", null));
        return { tarifMin: tm !== null ? tm : 6000, seuilGratuit: sg !== null ? sg : 120000 };
    }
    function listeProduits() {
        let l = window.tousLesProduits;
        if (!Array.isArray(l) || !l.length) { try { l = JSON.parse(lire("saferun_cache_produits", "[]")); } catch (e) { l = []; } }
        return Array.isArray(l) ? l : [];
    }
    function produitDe(nomPanier) {
        const base = String(nomPanier).replace(/\s*\[[^\]]*\]\s*$/, "").trim();
        return listeProduits().find(p => String(p.Nom).trim() === base) || null;
    }
    function estProduitAccueil(p) {
        if (!p) return false;
        try { return typeof estRayonAccueil === "function" ? !!estRayonAccueil(p.Categorie) : false; } catch (e) { return false; }
    }

    // « 10h-14h », « 10h00 - 14h30 », « 10:00-14:00 », « 10h à 14h »
    function parserHoraire(brut) {
        const m = String(brut || "").toLowerCase().replace(/\s+/g, "").match(/(\d{1,2})(?:[h:](\d{2})?)?[-–—à]+(\d{1,2})(?:[h:](\d{2})?)?/);
        if (!m) return null;
        const d = parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) / 60 : 0);
        const f = parseInt(m[3], 10) + (m[4] ? parseInt(m[4], 10) / 60 : 0);
        if (!(d >= 0 && f <= 24 && d < f)) return null;
        return { d: d, f: f, label: fmtH(d) + "-" + fmtH(f) };
    }

    /* --------------------- Calcul du résumé (frais, horaires) --------------------- */
    function resume(lignes) {
        lignes = lignes || lirePanierLocal();
        const z = tarifsZone();
        const seuilAlgo = Math.ceil(z.tarifMin / 0.15);
        let sous = 0, poids = 0, flash = false, accueil = false, epuise = null;
        const frais = [], fenetres = [];
        const infos = lignes.map(a => {
            const q = Number(a.quantite) || 0, px = Number(a.prix) || 0;
            sous += q * px;
            const p = produitDe(a.nom);
            const info = { ligne: a, produit: p, fenetre: null };
            if (p) {
                poids += decimal(p.Poids) * q;
                const f = entier(p.Frais);
                if (f !== null) frais.push(f);
                if (/flash/i.test(String(p.Type_Livraison || ""))) flash = true;
                if (estProduitAccueil(p)) accueil = true;
                if (String(p.Options_Disponibles || "").trim().toUpperCase() === "EPUISE") epuise = p.Nom;
                const w = parserHoraire(p.Horaire_Livraison);
                if (w) { info.fenetre = w; fenetres.push(w); }
            }
            return info;
        });

        // --- Frais de livraison ---
        const algo = Math.ceil(Math.max(sous * 0.15, z.tarifMin) / 10) * 10;
        let fraisLiv = 0, mode = "zone";
        const messages = [];
        if (sous > 0) {
            if (sous >= z.seuilGratuit) { fraisLiv = 0; mode = "gratuit"; }
            else if (accueil || !frais.length || sous >= seuilAlgo) { fraisLiv = algo; mode = "zone"; }
            else { fraisLiv = Math.ceil(Math.max.apply(null, frais) / 10) * 10; mode = "boutique"; }
        }
        const distincts = frais.filter((v, i) => frais.indexOf(v) === i);
        if (mode === "boutique" && distincts.length > 1) messages.push({ t: "info", x: "Plusieurs frais de livraison dans votre panier : le plus élevé (" + fmt(fraisLiv) + ") est appliqué." });
        if (accueil && sous > 0 && mode !== "gratuit") messages.push({ t: "info", x: "Votre panier contient des produits de l'accueil : le tarif de votre zone s'applique." });

        // --- Poids (même règle que l'accueil) ---
        const vehicule = z.tarifMin <= 8000 ? "velo" : "moto";
        const sp = SEUILS_POIDS[vehicule];
        let supp = 0, bloque = false, raison = "";
        if (poids >= sp.plafond) {
            bloque = true;
            raison = "Votre commande pèse environ " + poids.toFixed(1) + " kg, ce qui dépasse la capacité de notre livreur (" + (vehicule === "velo" ? "vélo" : "moto") + "). Merci de réduire les quantités.";
        } else if (poids >= sp.leger) {
            supp = Math.ceil((poids - sp.leger) * TARIF_KG_SUPP);
            messages.push({ t: "info", x: "Colis un peu lourd (" + poids.toFixed(1) + " kg) : supplément de manutention de " + fmt(supp) + " inclus." });
        }
        if (sous > 0 && !bloque) fraisLiv += supp;
        if (epuise) { bloque = true; raison = "« " + epuise + " » est en rupture de stock. Retirez-le du panier pour continuer."; }

        // --- Horaires : fenêtre commune à tous les produits qui en ont une ---
        let fenetre = null, conflit = false, groupes = [];
        if (fenetres.length) {
            let d = 0, f = 24;
            fenetres.forEach(w => { d = Math.max(d, w.d); f = Math.min(f, w.f); });
            if (d < f) fenetre = { d: d, f: f, label: fmtH(d) + "-" + fmtH(f) };
            else {
                conflit = true;
                const vus = {};
                infos.forEach((inf, i) => { if (inf.fenetre) { const k = inf.fenetre.label; (vus[k] = vus[k] || { label: k, idx: [] }).idx.push(i); } });
                const libres = infos.map((inf, i) => inf.fenetre ? -1 : i).filter(i => i >= 0);
                groupes = Object.keys(vus).map(k => ({ label: k, idx: vus[k].idx.concat(libres) }));
                messages.push({ t: "warn", x: "Vos produits n'ont pas les mêmes horaires de livraison (" + groupes.map(g => g.label).join(" / ") + "). Ils seront livrés séparément : vous les commandez en deux fois." });
            }
        }
        if (flash && sous > 0) messages.push({ t: "ok", x: "⚡ Livraison Flash : votre commande est livrée en priorité." });

        // --- Progression vers la livraison offerte ---
        if (sous > 0 && sous < z.seuilGratuit) messages.push({ t: "prog", x: "Plus que " + fmt(z.seuilGratuit - sous) + " pour la livraison offerte !", pct: Math.min(100, Math.round(sous * 100 / z.seuilGratuit)) });
        if (mode === "gratuit") messages.push({ t: "ok", x: "🎉 Livraison offerte !" });

        return { sous: sous, frais: fraisLiv, total: sous + fraisLiv, mode: mode, flash: flash, fenetre: fenetre, conflit: conflit, groupes: groupes,
                 bloque: bloque, raison: raison, messages: messages, poids: poids, seuilGratuit: z.seuilGratuit, tarifMin: z.tarifMin };
    }

    function htmlResume(r) {
        if (!r || !r.sous) return "";
        injecterStyles();
        let h = '<div class="sr-res">';
        h += '<div class="sr-res-l"><span>Sous-total</span><b>' + fmt(r.sous) + '</b></div>';
        h += '<div class="sr-res-l"><span>Livraison estimée' + (r.flash ? ' ⚡' : '') + '</span><b>' + (r.mode === "gratuit" ? '<span style="color:#16a34a">Offerte</span>' : fmt(r.frais)) + '</b></div>';
        if (r.fenetre) h += '<div class="sr-res-l sr-res-h"><span>Horaire de livraison</span><b>' + esc(r.fenetre.label.replace("-", " – ")) + '</b></div>';
        r.messages.forEach(m => {
            if (m.t === "prog") h += '<div class="sr-msg sr-msg-prog"><div>' + esc(m.x) + '</div><div class="sr-bar"><i style="width:' + m.pct + '%"></i></div></div>';
            else h += '<div class="sr-msg sr-msg-' + m.t + '">' + esc(m.x) + '</div>';
        });
        if (r.bloque) h += '<div class="sr-msg sr-msg-err">' + esc(r.raison) + '</div>';
        return h + '</div>';
    }

    /* ------------------------------ Créneaux ------------------------------ */
    function ouvert(d) { return d.getDay() !== 0 && joursFermes.indexOf(isoLocal(d)) === -1; }
    function creneaux(r) {
        const now = new Date(), t = now.getHours() + now.getMinutes() / 60;
        const w = r.fenetre, flash = r.flash, prep = flash ? 0.5 : 1.5;
        const out = [];
        for (let k = 0; k < 21 && out.length < 6; k++) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
            if (!ouvert(d)) continue;
            let txt;
            if (w) {
                if (k === 0 && t + prep > w.f - 0.25) continue;
                if (k === 0 && t + prep > w.d) {
                    const dep = Math.ceil((t + prep) * 2) / 2;
                    txt = flash ? "dès que possible, avant " + fmtH(w.f) : "entre " + fmtH(dep) + " et " + fmtH(w.f);
                } else txt = "entre " + fmtH(w.d) + " et " + fmtH(w.f);
            } else if (k === 0) {
                if (flash) { if (t >= 7 && t <= 16.5) txt = "dès que possible (environ 1 h)"; else continue; }
                else if (t >= 5 && t <= 11) txt = "cet après-midi (entre 14h et 17h)";
                else continue;
            } else txt = flash ? "dès 9h (en priorité)" : "le matin (entre 9h et 11h)";
            const date = cap(d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
            const prefixe = k === 0 ? "Aujourd'hui · " : (k === 1 ? "Demain · " : "");
            out.push({ iso: isoLocal(d), texte: txt, affiche: prefixe + date + ", " + txt, livraison: "LIVRAISON : " + date + ", " + txt + (flash ? " ⚡ FLASH" : "") });
        }
        return out;
    }

    /* ------------------------------ Interface ------------------------------ */
    let co = null;   // état de la commande en cours
    function injecterStyles() {
        if (document.getElementById("sr-styles-co")) return;
        const s = document.createElement("style");
        s.id = "sr-styles-co";
        s.textContent = `
        .sr-res{margin-bottom:10px;font-family:Poppins,sans-serif;}
        .sr-res-l{display:flex;justify-content:space-between;font-size:.85rem;color:#334155;padding:3px 0;}
        .sr-res-h b{color:#0f172a;}
        .sr-msg{font-size:.76rem;line-height:1.35;border-radius:8px;padding:8px 10px;margin-top:7px;}
        .sr-msg-info{background:#eff6ff;color:#1d4ed8;}
        .sr-msg-warn{background:#fff7ed;color:#c2410c;}
        .sr-msg-ok{background:#ecfdf5;color:#047857;}
        .sr-msg-err{background:#fee2e2;color:#b91c1c;font-weight:600;}
        .sr-msg-prog{background:#f8fafc;color:#334155;}
        .sr-bar{height:6px;background:#e2e8f0;border-radius:6px;margin-top:6px;overflow:hidden;}
        .sr-bar i{display:block;height:100%;background:#27ae60;border-radius:6px;}
        #sr-co{position:fixed;inset:0;background:rgba(15,23,42,.7);z-index:100010;display:flex;align-items:flex-end;justify-content:center;font-family:Poppins,sans-serif;backdrop-filter:blur(4px);}
        #sr-co-boite{background:#fff;width:100%;max-width:480px;max-height:94vh;border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden;animation:srMonte .3s ease-out;}
        @media(min-width:560px){#sr-co{align-items:center;}#sr-co-boite{border-radius:22px;}}
        @keyframes srMonte{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
        .sr-co-tete{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid #eee;font-weight:700;}
        .sr-co-tete button{background:none;border:0;font-size:1.4rem;cursor:pointer;color:#475569;}
        #sr-co-corps{padding:16px 18px 20px;overflow-y:auto;font-size:.88rem;color:#1e293b;}
        .sr-co-titre{font-weight:700;font-size:.8rem;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin:14px 0 6px;}
        .sr-co-l{display:flex;justify-content:space-between;gap:10px;padding:5px 0;font-size:.84rem;border-bottom:1px dashed #eef0f3;}
        .sr-co-in{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cbd5e1;border-radius:10px;font:500 .9rem Poppins,sans-serif;margin-bottom:8px;background:#fff;}
        .sr-co-btn{width:100%;border:0;border-radius:14px;padding:15px;font:700 .95rem Poppins,sans-serif;cursor:pointer;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;}
        .sr-co-btn:disabled{opacity:.55;cursor:not-allowed;}
        .sr-b-vert{background:#27ae60;color:#fff;} .sr-b-noir{background:#1e293b;color:#fff;} .sr-b-jaune{background:#ffcc00;color:#1a1a1a;} .sr-b-gris{background:#f1f5f9;color:#334155;}
        .sr-co-err{background:#fee2e2;color:#b91c1c;border-radius:10px;padding:9px 11px;font-size:.8rem;margin:8px 0;display:none;}
        .sr-co-grand{text-align:center;font-size:2rem;font-weight:800;color:#059669;margin:6px 0 2px;}
        .sr-co-centre{text-align:center;}
        .sr-co-ref{display:inline-block;background:#ffeaa7;color:#c0392b;font-weight:800;padding:3px 12px;border-radius:8px;}
        .sr-co-mv{background:#fffdf0;border:2px solid #ffcc00;border-radius:16px;padding:16px;text-align:center;margin:12px 0;}
        `;
        document.head.appendChild(s);
    }
    function ouvrirModale(titre, avecFermer) {
        injecterStyles();
        let o = document.getElementById("sr-co");
        if (o) o.remove();
        o = document.createElement("div");
        o.id = "sr-co";
        o.innerHTML = '<div id="sr-co-boite" role="dialog" aria-modal="true"><div class="sr-co-tete"><span id="sr-co-titre"></span>' +
            (avecFermer ? '<button type="button" id="sr-co-x" aria-label="Fermer">&times;</button>' : '') +
            '</div><div id="sr-co-corps"></div></div>';
        document.body.appendChild(o);
        document.getElementById("sr-co-titre").textContent = titre;
        return o;
    }
    function fermerModale() { const o = document.getElementById("sr-co"); if (o) o.remove(); }
    function corps(html) { const c = document.getElementById("sr-co-corps"); if (c) c.innerHTML = html; return c; }
    function afficherErreur(msg) { const e = document.getElementById("sr-co-err"); if (e) { e.textContent = msg; e.style.display = "block"; } }

    function zoneOk() { return !!lire("saferun_secteur_valide", "") && !!lire("saferun_quartier", ""); }

    /* ------------------------------ Démarrage ------------------------------ */
    function demarrer() {
        const panier = lirePanierLocal();
        if (!panier.length) return;
        if (typeof window.fermerPanierBoutique === "function") window.fermerPanierBoutique();
        chargerRecaptcha();
        co = { id: null, lignes: panier, nom: lire("saferun_nom", ""), tel: lire("saferun_tel", "") };
        const r = resume(panier);
        if (!zoneOk()) {
            ouvrirModale("Zone de livraison", true);
            corps('<p>Pour calculer la livraison, choisissez d\'abord votre <b>zone de livraison</b> sur la page d\'accueil, puis revenez : votre panier est conservé.</p><a class="sr-co-btn sr-b-vert" style="text-decoration:none" href="index.html">Choisir ma zone</a>');
            document.getElementById("sr-co-x").onclick = fermerModale;
            return;
        }
        if (r.bloque) {
            ouvrirModale("Commande impossible", true);
            corps('<div class="sr-msg sr-msg-err">' + esc(r.raison) + '</div><button class="sr-co-btn sr-b-gris" id="sr-co-ok">Retour au panier</button>');
            document.getElementById("sr-co-x").onclick = fermerModale;
            document.getElementById("sr-co-ok").onclick = () => { fermerModale(); if (window.ouvrirPanierBoutique) window.ouvrirPanierBoutique(); };
            return;
        }
        if (r.conflit) { ecranChoixGroupe(r); return; }
        ecranRecap();
    }

    function ecranChoixGroupe(r) {
        ouvrirModale("Livraisons séparées", true);
        let h = '<div class="sr-msg sr-msg-warn">Vos produits ne se livrent pas aux mêmes horaires. Choisissez la commande à passer maintenant ; le reste de votre panier est conservé pour une 2e commande.</div>';
        r.groupes.forEach((g, i) => {
            const noms = g.idx.map(k => co.lignes[k].nom).join(", ");
            h += '<button type="button" class="sr-co-btn sr-b-gris" data-g="' + i + '" style="flex-direction:column;align-items:flex-start;text-align:left"><span>🕒 Livraison ' + esc(g.label.replace("-", " – ")) + '</span><small style="font-weight:500;color:#64748b">' + esc(noms) + '</small></button>';
        });
        corps(h);
        document.getElementById("sr-co-x").onclick = fermerModale;
        document.querySelectorAll("#sr-co-corps [data-g]").forEach(b => b.addEventListener("click", () => {
            const g = r.groupes[Number(b.getAttribute("data-g"))];
            co.lignes = g.idx.map(k => co.lignes[k]);
            ecranRecap();
        }));
    }

    function ecranRecap() {
        const r = resume(co.lignes);
        co.r = r;
        co.options = creneaux(r);
        ouvrirModale("Ma commande", true);
        let h = '<div class="sr-co-titre" style="margin-top:0">Articles</div>';
        co.lignes.forEach(a => { h += '<div class="sr-co-l"><span>' + esc(a.nom) + ' × ' + (Number(a.quantite) || 0) + '</span><b>' + fmt((Number(a.prix) || 0) * (Number(a.quantite) || 0)) + '</b></div>'; });
        h += '<div class="sr-co-titre">Livraison à ' + esc(lire("saferun_quartier", "")) + '</div>';
        if (!co.options.length) {
            h += '<div class="sr-msg sr-msg-err">Aucun créneau de livraison disponible pour le moment. Réessayez plus tard.</div>';
        } else {
            h += '<select id="sr-co-creneau" class="sr-co-in">' + co.options.map((o, i) => '<option value="' + i + '">' + esc(o.affiche) + '</option>').join("") + '</select>';
        }
        h += '<div class="sr-co-titre">Vos coordonnées</div>' +
             '<input id="sr-co-nom" class="sr-co-in" placeholder="Votre nom" autocomplete="name" value="' + esc(co.nom) + '">' +
             '<input id="sr-co-tel" class="sr-co-in" placeholder="Téléphone (ex : 034 12 345 67)" inputmode="tel" autocomplete="tel" value="' + esc(co.tel) + '">';
        h += '<div class="sr-co-titre">Récapitulatif</div>' + htmlResume(r);
        h += '<div class="sr-co-l" style="border:0;font-weight:800;font-size:1rem"><span>Total à payer</span><span>' + fmt(r.total) + '</span></div>';
        h += '<div class="sr-co-err" id="sr-co-err"></div>';
        h += '<button type="button" class="sr-co-btn sr-b-vert" id="sr-co-envoyer"' + (co.options.length ? '' : ' disabled') + '>Confirmer et choisir le paiement</button>';
        corps(h);
        document.getElementById("sr-co-x").onclick = fermerModale;
        document.getElementById("sr-co-envoyer").onclick = confirmerCommande;
    }

    /* ------------------------------ Envoi de la commande ------------------------------ */
    function chargerRecaptcha() {
        if (window.grecaptcha || document.getElementById("sr-recaptcha")) return;
        const s = document.createElement("script");
        s.id = "sr-recaptcha";
        s.src = "https://www.google.com/recaptcha/api.js?render=" + SITE_KEY_RECAPTCHA;
        s.async = true;
        document.head.appendChild(s);
    }
    function jetonRecaptcha() {
        // Jamais bloquant : le script Apps Script accepte la commande même sans jeton (il l'annote seulement)
        return new Promise(resolve => {
            const fin = setTimeout(() => resolve(""), 3000);
            try {
                if (!window.grecaptcha || !window.grecaptcha.ready) { clearTimeout(fin); return resolve(""); }
                window.grecaptcha.ready(() => {
                    window.grecaptcha.execute(SITE_KEY_RECAPTCHA, { action: "nouvelle_commande" })
                        .then(t => { clearTimeout(fin); resolve(t); }).catch(() => { clearTimeout(fin); resolve(""); });
                });
            } catch (e) { clearTimeout(fin); resolve(""); }
        });
    }
    // File d'attente hors-ligne : même clé et même format que main.js (l'accueil peut donc la vider aussi)
    function ajouterFile(url, payload) {
        let f = []; try { f = JSON.parse(lire("saferun_file_attente", "[]")); } catch (e) {}
        f.push({ id: "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8), url: url, payload: payload, dateAjout: new Date().toISOString() });
        ecrire("saferun_file_attente", JSON.stringify(f));
    }
    async function envoyer(payload) {
        if (!navigator.onLine) { ajouterFile(API_URL, payload); return { queued: true }; }
        try { await fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) }); return { queued: false }; }
        catch (e) { ajouterFile(API_URL, payload); return { queued: true }; }
    }
    async function viderFile() {
        if (!navigator.onLine) return;
        let f = []; try { f = JSON.parse(lire("saferun_file_attente", "[]")); } catch (e) {}
        for (const it of f) {
            try {
                await fetch(it.url, { method: "POST", mode: "no-cors", body: JSON.stringify(it.payload) });
                let cur = []; try { cur = JSON.parse(lire("saferun_file_attente", "[]")); } catch (e) {}
                ecrire("saferun_file_attente", JSON.stringify(cur.filter(x => x.id !== it.id)));
            } catch (e) { break; }
        }
    }
    window.addEventListener("online", () => setTimeout(viderFile, 1000));
    document.addEventListener("DOMContentLoaded", () => setTimeout(viderFile, 2500));

    function telValide(brut) {
        let t = String(brut || "").replace(/[\s.\-()]/g, "");
        if (/^\+?261/.test(t)) t = "0" + t.replace(/^\+?261/, "");
        return /^03[2-8]\d{7}$/.test(t) ? t : null;
    }

    function payloadCommande(statut, note, transactionId) {
        const r = co.r, o = co.creneau;
        const produits = co.lignes.map(p => p.nom + " (x" + p.quantite + ")").join(", ");
        return {
            action: "nouvelleCommande",
            nom: co.nom, telClient: co.tel, id: co.id, correlationId: co.id,
            montant: r.total, produits: produits,
            livraison: o.livraison, quartier: lire("saferun_quartier", "") || "Non précisé",
            statut: statut, note: note || "", transactionId: transactionId || "",
            recaptchaToken: co.jeton || "",
            // champs de contrôle pour le serveur (étape 4) : ignorés par l'ancien script
            source: "boutique", sousTotal: r.sous, fraisLivraison: r.frais, typeLivraison: r.flash ? "Flash" : "Standard",
            horaireLivraison: r.fenetre ? r.fenetre.label : "", dateLivraison: o.iso,
            lignes: co.lignes.map(p => ({ nom: p.nom, prix: Number(p.prix) || 0, quantite: Number(p.quantite) || 0 }))
        };
    }

    async function confirmerCommande() {
        const btn = document.getElementById("sr-co-envoyer");
        const nom = (document.getElementById("sr-co-nom").value || "").trim();
        const telBrut = document.getElementById("sr-co-tel").value;
        const tel = telValide(telBrut);
        const sel = document.getElementById("sr-co-creneau");
        if (nom.length < 2) return afficherErreur("Merci d'indiquer votre nom.");
        if (!tel) return afficherErreur("Numéro de téléphone invalide (ex : 034 12 345 67).");
        if (!sel || !co.options[Number(sel.value)]) return afficherErreur("Choisissez un créneau de livraison.");
        const o = co.options[Number(sel.value)];
        // Contrôle final : le jour choisi est-il toujours ouvert ? (le Sheet a pu changer)
        if (!ouvert(new Date(o.iso + "T12:00:00"))) return afficherErreur("Ce jour n'est plus disponible, choisissez un autre créneau.");
        // On recalcule tout au moment de l'envoi (tarifs, panier modifié depuis un autre onglet...)
        const panierActuel = lirePanierLocal();
        const noms = co.lignes.map(l => l.nom);
        co.lignes = co.lignes.map(l => panierActuel.find(a => a.nom === l.nom)).filter(Boolean);
        if (co.lignes.length !== noms.length || !co.lignes.length) { fermerModale(); return; }
        co.r = resume(co.lignes);
        if (co.r.bloque) return afficherErreur(co.r.raison);
        co.nom = nom; co.tel = tel; co.creneau = o;
        ecrire("saferun_nom", nom); ecrire("saferun_tel", tel);

        if (btn) { btn.disabled = true; btn.textContent = "Envoi en cours…"; }
        if (!co.id) co.id = "SR-" + Date.now().toString().slice(-6);
        co.jeton = await jetonRecaptcha();
        const payload = payloadCommande("NOUVEAU", "");
        const res = await envoyer(payload);

        // Historique local + commande en attente (mêmes clés que main.js)
        let hist = []; try { hist = JSON.parse(lire("saferun_commandes", "[]")); } catch (e) {}
        hist = hist.filter(c => c.id !== co.id);
        hist.unshift({ id: co.id, ID: co.id, date: new Date().toLocaleDateString("fr-FR"), produits: payload.produits, total: co.r.total,
                       statut: "NOUVEAU", livraison: o.livraison, livraisonPrevue: o.livraison, quartier: payload.quartier });
        ecrire("saferun_commandes", JSON.stringify(hist));
        ecrire("livraison_vue", "false");
        ecrire("saferun_commande_pendante_id", co.id);
        ecrire("saferun_commande_pendante_montant", String(co.r.total));
        ecrire("saferun_snapshot_commande", JSON.stringify({ id: co.id, produits: JSON.parse(JSON.stringify(co.lignes)), montant: co.r.total }));
        // On retire du panier uniquement les articles commandés
        ecrire("saferun_panier", JSON.stringify(panierActuel.filter(a => noms.indexOf(a.nom) === -1)));
        try { window.dispatchEvent(new Event("storage")); } catch (e) {}
        co.file = res.queued;
        ecranPaiement();
    }

    /* ------------------------------ Paiement ------------------------------ */
    function quitterAvantPaiement() {
        if (confirm("Votre commande est enregistrée. Vous pourrez la régler plus tard depuis l'accueil. Quitter ?")) terminer();
    }
    function ecranPaiement() {
        const r = co.r, eligible = r.total < SEUIL_PAIEMENT_LIVRAISON;
        ouvrirModale("SafeRun Pay", true);
        let h = '<div class="sr-co-centre"><div style="color:#64748b">Commande sécurisée <span class="sr-co-ref">#' + esc(co.id) + '</span></div>' +
                '<div style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-top:14px">Montant total</div>' +
                '<div class="sr-co-grand">' + fmt(r.total) + '</div>' +
                '<div style="font-size:.78rem;color:#64748b">' + esc(co.creneau.livraison.replace("LIVRAISON : ", "")) + '</div></div>';
        if (co.file) h += '<div class="sr-msg sr-msg-warn">Connexion instable : votre commande est enregistrée sur votre appareil et sera transmise dès le retour du réseau.</div>';
        h += '<div class="sr-co-err" id="sr-co-err"></div>' +
             '<button class="sr-co-btn sr-b-noir" id="sr-pay-visa">💳 CB / VISA / MASTERCARD</button>' +
             '<button class="sr-co-btn sr-b-jaune" id="sr-pay-mvola">📱 PAYER PAR MVOLA</button>' +
             '<button class="sr-co-btn ' + (eligible ? 'sr-b-vert' : 'sr-b-gris') + '" id="sr-pay-liv"' + (eligible ? '' : ' disabled') + '>🛵 PAIEMENT À LA LIVRAISON' +
             (eligible ? '' : '<small style="display:block;font-weight:500">Disponible pour les commandes sous ' + fmt(SEUIL_PAIEMENT_LIVRAISON) + '</small>') + '</button>';
        corps(h);
        document.getElementById("sr-co-x").onclick = quitterAvantPaiement;
        document.getElementById("sr-pay-mvola").onclick = () => ecranMvola(r.total, "Montant exact à envoyer", false);
        document.getElementById("sr-pay-visa").onclick = payerParCarte;
        if (eligible) document.getElementById("sr-pay-liv").onclick = payerALaLivraison;
    }

    function lienUssd(montant) { return "tel:*111*1*2*" + NUMERO_MVOLA + "*" + Math.floor(montant) + "%23"; }
    function ecranMvola(montant, libelle, livraison) {
        ouvrirModale("Paiement MVola", true);
        const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
        corps('<div class="sr-co-mv"><div style="font-size:.8rem;color:#666">' + esc(libelle) + '</div>' +
              '<div style="font-size:1.8rem;font-weight:800;color:#d35400">' + fmt(montant) + '</div>' +
              '<div style="background:#fff;border:1px solid #ffeaa7;border-radius:10px;padding:10px;margin:12px 0"><div style="font-size:.75rem;color:#7f8c8d">Numéro MVola</div><b style="font-size:1.25rem;letter-spacing:1px">' + NUMERO_MVOLA_AFFICHE + '</b></div>' +
              '<div style="font-size:.75rem;color:#7f8c8d">Référence obligatoire</div><span class="sr-co-ref">' + esc(co.id) + '</span></div>' +
              (mobile ? '<a class="sr-co-btn sr-b-jaune" style="text-decoration:none" href="' + lienUssd(montant) + '">📞 Envoyer via MVola maintenant</a>'
                      : '<div class="sr-msg sr-msg-info">Depuis votre mobile, un bouton direct MVola vous sera proposé.</div>') +
              '<button class="sr-co-btn sr-b-vert" id="sr-mv-ok">✅ J\'ai effectué le transfert</button>' +
              '<button class="sr-co-btn sr-b-gris" id="sr-mv-retour">← Autre moyen de paiement</button>');
        document.getElementById("sr-co-x").onclick = quitterAvantPaiement;
        document.getElementById("sr-mv-retour").onclick = ecranPaiement;
        document.getElementById("sr-mv-ok").onclick = () => ecranSucces(livraison ? "Livraison à régler à la remise." : "Nous vérifions votre paiement MVola et confirmons votre commande.");
    }

    async function payerALaLivraison() {
        const b = document.getElementById("sr-pay-liv");
        b.disabled = true; b.textContent = "Validation…";
        await envoyer(payloadCommande("NOUVEAU", "Payer à la livraison"));
        if (co.r.frais > 0) ecranMvola(co.r.frais, "Frais de livraison à envoyer", true);
        else ecranSucces("Votre commande sera payée à la livraison.");
    }

    async function payerParCarte() {
        const b = document.getElementById("sr-pay-visa");
        if (typeof window.paypal === "undefined") {
            afficherErreur("Le paiement par carte n'est pas disponible pour le moment. Choisissez MVola ou le paiement à la livraison.");
            return;
        }
        b.disabled = true; b.textContent = "Connexion…";
        await envoyer(payloadCommande("ATTENTE VISA", ""));
        const usd = (((co.r.total / 4900) + 0.30) / (1 - 0.044)).toFixed(2);
        ouvrirModale("Paiement par carte", true);
        corps('<div class="sr-co-centre" style="margin-bottom:10px">Montant : <b>' + fmt(co.r.total) + '</b> (≈ ' + usd + ' USD)</div><div id="sr-paypal" style="min-height:200px"></div><button class="sr-co-btn sr-b-gris" id="sr-cb-retour">← Autre moyen de paiement</button>');
        document.getElementById("sr-co-x").onclick = quitterAvantPaiement;
        document.getElementById("sr-cb-retour").onclick = ecranPaiement;
        window.paypal.Buttons({
            style: { layout: "vertical", color: "gold", shape: "pill", label: "pay" },
            createOrder: (d, a) => a.order.create({ purchase_units: [{ reference_id: co.id, amount: { currency_code: "USD", value: usd } }] }),
            onApprove: (d, a) => a.order.capture().then(async det => {
                await envoyer(payloadCommande("PAYÉ", "Carte bancaire", det.id));
                ecranSucces("Paiement reçu. Merci !");
            })
        }).render("#sr-paypal");
    }

    function ecranSucces(message) {
        ouvrirModale("Commande enregistrée", false);
        corps('<div class="sr-co-centre"><div style="font-size:3.2rem">✅</div><h3 style="margin:6px 0">Merci ' + esc(co.nom) + ' !</h3>' +
              '<div>Référence <span class="sr-co-ref">#' + esc(co.id) + '</span></div>' +
              '<p style="color:#475569;margin:14px 0 4px">' + esc(message) + '</p>' +
              '<p style="color:#475569;margin:4px 0"><b>' + esc(co.creneau.livraison.replace("LIVRAISON : ", "")) + '</b></p>' +
              '<p style="font-size:.78rem;color:#64748b">Suivez votre commande dans « Mes livraisons » sur la page d\'accueil.</p></div>' +
              '<button class="sr-co-btn sr-b-vert" id="sr-terminer">Terminer</button>');
        document.getElementById("sr-terminer").onclick = terminer;
    }

    // « Terminer » : on nettoie la commande en cours et on recharge la page → nouvel achat possible, accueil à jour
    function terminer() {
        retirer("saferun_commande_pendante_id");
        retirer("saferun_commande_pendante_montant");
        retirer("saferun_snapshot_commande");
        window.location.reload();
    }

    window.SRCheckout = { resume: resume, htmlResume: htmlResume, demarrer: demarrer, creneaux: creneaux, parserHoraire: parserHoraire };
})();