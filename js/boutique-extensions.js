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
                    <div class="sr-total"><span>Total</span><span id="sr-total">0 Ar</span></div>
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
        document.getElementById('sr-total').textContent = fmtAr(total);
        document.getElementById('sr-valider').disabled = !panier.length;
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
    }

    // Validation : l'envoi à la Sheet et le paiement se font sur l'accueil (main.js), qui recharge la page et la sidebar
    function validerCommande() {
        if (!lirePanier().length) return;
        if (!localStorage.getItem('saferun_secteur_valide')) {
            afficherToast('Choisissez d\'abord votre zone de livraison sur <a href="index.html" style="color:#7CFC9A;font-weight:700;">la page d\'accueil</a>.');
            return;
        }
        window.location.href = 'index.html?panier=1';
    }

    function ajouterAuPanierPartage(produitId, option) {
        const liste = window.tousLesProduits || [];
        const prod = liste.find(p => String(p.ID) === String(produitId));
        if (!prod) { afficherToast("Produit introuvable, rechargez la page."); return; }

        if (!localStorage.getItem('saferun_secteur_valide')) {
            afficherToast('Choisissez d\'abord votre zone de livraison sur <a href="index.html" style="color:#7CFC9A;font-weight:700;">la page d\'accueil</a>.');
            return;
        }

        const nom = (option && option !== "Unique") ? prod.Nom + " [" + option + "]" : prod.Nom;
        const prix = Number(String(prod.Prix).replace(/[^0-9.]/g, "")) || 0;
        const panier = lirePanier();
        const ligne = panier.find(a => a.nom === nom);
        if (ligne) ligne.quantite = (Number(ligne.quantite) || 0) + 1;
        else panier.push({ nom: nom, prix: prix, quantite: 1 });
        ecrirePanier(panier);

        afficherToast('✅ ' + nom + ' ajouté au panier');
        mettreAJourPastilles();
        if (document.getElementById('sr-volet') && document.getElementById('sr-volet').classList.contains('ouvert')) rendreVolet();
    }
    window.addEventListener('storage', () => { mettreAJourPastilles(); if (document.getElementById('sr-corps')) rendreVolet(); });
    document.addEventListener('DOMContentLoaded', () => setTimeout(creerIcones, 600));
    window.ouvrirPanierBoutique = ouvrirPanier;

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