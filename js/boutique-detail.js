/* SafeRun Market - fiche produit (boutique.html)
   Un clic sur l'image ou le nom d'un produit ouvre une fiche détaillée avec possibilité de commander.
   Module ADDITIONNEL : il ne modifie aucune fonction existante, il appelle seulement celles du panier
   (window.ajusterQuantitePanier, window.ouvrirPanierBoutique). À charger APRÈS boutique-extensions.js. */
(function () {
    "use strict";
    if (window.__srDetailCharge) return;
    window.__srDetailCharge = true;
 
    var modal = null, produitCourant = null, qte = 1, dernierFocus = null;
 
    function esc(t) {
        return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
    }
    function cle(t) { return String(t || "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
    function listeProduits() {
        var l = window.tousLesProduits;
        if (Array.isArray(l) && l.length) return l;
        try { l = JSON.parse(localStorage.getItem("saferun_cache_produits") || "[]"); } catch (e) { l = []; }
        return Array.isArray(l) ? l : [];
    }
    function urlImage(p) {
        var brut = p.Image_URL || p.Image || "";
        try { if (typeof normaliserUrlImage === "function") brut = normaliserUrlImage(brut); } catch (e) {}
        return /^https?:\/\//i.test(brut) ? brut : "https://placehold.co/600x700?text=SafeRun";
    }
    function prixDe(p) { return Number(String(p.Prix).replace(/[^0-9.]/g, "")) || 0; }
    function estEpuiseP(p) {
        try { if (typeof estEpuise === "function") return !!estEpuise(p); } catch (e) {}
        return String(p.Options_Disponibles || "").trim().toUpperCase() === "EPUISE";
    }
    function options(p) {
        var b = String(p.Options_Disponibles || "").trim();
        if (!b || /^(UNIQUE|EPUISE)$/i.test(b)) return [];
        return b.split(",").map(function (o) { return o.trim(); }).filter(Boolean);
    }
    function produitDeCarte(carte) {
        var l = listeProduits();
        var c = carte.querySelector(".zl-compteur[data-pid]");
        if (c) { var pid = c.getAttribute("data-pid"); var t = l.find(function (p) { return String(p.ID) === String(pid); }); if (t) return t; }
        var h = carte.querySelector(".zl-nom");
        var nom = h ? h.textContent.trim() : "";
        return l.find(function (p) { return String(p.Nom).trim() === nom; }) || null;
    }
 
    function styles() {
        if (document.getElementById("sr-det-styles")) return;
        var s = document.createElement("style"); s.id = "sr-det-styles";
        s.textContent =
            "#grille-boutique-dediee .zl-img{cursor:pointer;}#grille-boutique-dediee .zl-nom{cursor:pointer;}#grille-boutique-dediee .zl-nom:hover{text-decoration:underline;}" +
            "#sr-det{position:fixed;inset:0;z-index:100001;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.62);backdrop-filter:blur(4px);font-family:Poppins,sans-serif;}" +
            "#sr-det.ouvert{display:flex;animation:srDetIn .2s ease;}@keyframes srDetIn{from{opacity:0}to{opacity:1}}" +
            ".sr-det-boite{position:relative;background:#fff;border-radius:22px;max-width:920px;width:100%;max-height:92vh;overflow:hidden;display:grid;grid-template-columns:1fr 1fr;box-shadow:0 30px 70px rgba(0,0,0,.35);}" +
            ".sr-det-img{background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:360px;position:relative;}" +
            ".sr-det-img img{width:100%;height:100%;object-fit:contain;display:block;max-height:92vh;}" +
            ".sr-det-badge{position:absolute;left:14px;top:14px;background:#1e293b;color:#fff;font:600 .72rem Poppins,sans-serif;padding:5px 12px;border-radius:50px;}" +
            ".sr-det-corps{padding:32px 30px 26px;overflow-y:auto;display:flex;flex-direction:column;gap:14px;max-height:92vh;}" +
            ".sr-det-tag{align-self:flex-start;background:#fff7d6;color:#7a5b00;font:700 .7rem Poppins,sans-serif;text-transform:uppercase;letter-spacing:.5px;padding:5px 12px;border-radius:50px;}" +
            ".sr-det-corps h2{margin:0;font-size:1.55rem;line-height:1.2;font-weight:800;color:#1a1a1a;}" +
            ".sr-det-prix{font-size:1.7rem;font-weight:800;color:#1a1a1a;}" +
            ".sr-det-desc{margin:0;color:#475569;font-size:.92rem;line-height:1.65;white-space:pre-line;}" +
            ".sr-det-infos{display:grid;gap:8px;margin:0;padding:0;list-style:none;}" +
            ".sr-det-infos li{display:flex;gap:10px;align-items:flex-start;font-size:.86rem;color:#334155;background:#f8fafc;border-radius:12px;padding:10px 12px;}" +
            ".sr-det-infos li b{min-width:92px;color:#0f172a;}" +
            ".sr-det-opt label{display:block;font:700 .78rem Poppins,sans-serif;color:#0f172a;margin-bottom:6px;}" +
            ".sr-det-choix{display:flex;flex-wrap:wrap;gap:8px;}" +
            ".sr-det-choix button{border:1.5px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 16px;font:600 .85rem Poppins,sans-serif;cursor:pointer;color:#1a1a1a;transition:.15s;}" +
            ".sr-det-choix button.actif{background:#1a1a1a;color:#fff;border-color:#1a1a1a;}" +
            ".sr-det-ligne{display:flex;gap:12px;align-items:center;margin-top:auto;padding-top:6px;}" +
            ".sr-det-qte{display:flex;align-items:center;border:1.5px solid #cbd5e1;border-radius:12px;overflow:hidden;}" +
            ".sr-det-qte button{width:42px;height:44px;border:0;background:#f8fafc;font:600 1.2rem Poppins,sans-serif;cursor:pointer;}" +
            ".sr-det-qte span{min-width:38px;text-align:center;font-weight:700;}" +
            ".sr-det-ajout{flex:1;border:0;border-radius:12px;height:46px;background:#27ae60;color:#fff;font:700 .92rem Poppins,sans-serif;cursor:pointer;transition:.15s;}" +
            ".sr-det-ajout:hover{background:#1f9a54;}" +
            ".sr-det-direct{border:0;border-radius:12px;height:46px;background:#1a1a1a;color:#fff;font:700 .92rem Poppins,sans-serif;cursor:pointer;padding:0 18px;}" +
            ".sr-det-direct:hover{background:#ff9900;color:#1a1a1a;}" +
            ".sr-det-note{font-size:.76rem;color:#64748b;margin:0;}" +
            ".sr-det-rupture{background:#e2e8f0;color:#475569;border-radius:12px;padding:14px;text-align:center;font-weight:700;}" +
            ".sr-det-x{position:absolute;right:12px;top:12px;z-index:3;width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.95);box-shadow:0 2px 10px rgba(0,0,0,.2);font-size:1.2rem;cursor:pointer;line-height:1;}" +
            "@media (max-width:768px){#sr-det{padding:0;align-items:flex-end;}.sr-det-boite{grid-template-columns:1fr;border-radius:22px 22px 0 0;max-height:94vh;overflow-y:auto;}" +
            ".sr-det-img{min-height:0;height:300px;}.sr-det-corps{overflow:visible;max-height:none;padding:22px 18px 22px;}.sr-det-ligne{flex-wrap:wrap;position:sticky;bottom:0;background:#fff;padding:12px 0 6px;box-shadow:0 -8px 14px rgba(255,255,255,.95);}.sr-det-direct{flex:1;}}";
        document.head.appendChild(s);
    }
 
    function fermer() {
        if (!modal) return;
        modal.classList.remove("ouvert");
        document.body.style.overflow = modal._overflow || "";
        produitCourant = null;
        if (dernierFocus && dernierFocus.focus) { try { dernierFocus.focus(); } catch (e) {} }
    }
 
    function ligneInfo(titre, valeur) { return valeur ? "<li><b>" + esc(titre) + "</b><span>" + esc(valeur) + "</span></li>" : ""; }
 
    function ouvrir(p) {
        styles();
        produitCourant = p; qte = 1;
        var epuise = estEpuiseP(p), opts = options(p), prix = prixDe(p);
        var desc = String(p.Description || p.Details || p.Détails || "").trim();
        var poids = Number(String(p.Poids || "").replace(",", "."));
        var type = String(p.Type_Livraison || "").trim();
        var horaire = String(p.Horaire_Livraison || "").trim();
        var livraison = type ? (/flash/i.test(type) ? "Flash (livraison rapide)" : type) : "";
        if (horaire && /flash/i.test(type)) livraison += " · créneau " + horaire;
        else if (horaire) livraison += (livraison ? " · " : "") + horaire;
 
        var html =
            '<div class="sr-det-boite" role="dialog" aria-modal="true" aria-label="' + esc(p.Nom) + '">' +
            '<button type="button" class="sr-det-x" aria-label="Fermer">&times;</button>' +
            '<div class="sr-det-img"><img src="' + esc(urlImage(p)) + '" alt="' + esc(p.Nom) + '" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'https://placehold.co/600x700?text=SafeRun\'">' +
            (epuise ? '<span class="sr-det-badge">Rupture</span>' : "") + "</div>" +
            '<div class="sr-det-corps">' +
            '<span class="sr-det-tag">' + esc(p.Categorie || "SafeRun") + "</span>" +
            "<h2>" + esc(p.Nom) + "</h2>" +
            '<div class="sr-det-prix">' + prix.toLocaleString("fr-FR") + " Ar</div>" +
            (desc ? '<p class="sr-det-desc">' + esc(desc) + "</p>" : "") +
            '<ul class="sr-det-infos">' +
            ligneInfo("Boutique", p.Categorie) +
            ligneInfo("Poids", poids > 0 ? (poids < 1 ? Math.round(poids * 1000) + " g" : poids + " kg") : "") +
            ligneInfo("Livraison", livraison) +
            ligneInfo("Disponibilité", epuise ? "Rupture de stock" : "En stock") +
            "</ul>";
 
        if (!epuise && opts.length) {
            html += '<div class="sr-det-opt"><label>Choisissez une option</label><div class="sr-det-choix">' +
                opts.map(function (o, i) { return '<button type="button" data-opt="' + esc(o) + '"' + (i === 0 ? ' class="actif"' : "") + ">" + esc(o) + "</button>"; }).join("") +
                "</div></div>";
        }
        if (epuise) html += '<div class="sr-det-rupture">Ce produit est momentanément indisponible</div>';
        else html +=
            '<div class="sr-det-ligne"><div class="sr-det-qte"><button type="button" data-q="-1" aria-label="Moins">&minus;</button><span id="sr-det-q">1</span><button type="button" data-q="1" aria-label="Plus">+</button></div>' +
            '<button type="button" class="sr-det-ajout">Ajouter au panier</button>' +
            '<button type="button" class="sr-det-direct">Commander</button></div>' +
            '<p class="sr-det-note">Les frais de livraison sont calculés selon votre quartier au moment de la commande.</p>';
        html += "</div></div>";
 
        if (!modal) {
            modal = document.createElement("div"); modal.id = "sr-det";
            modal.addEventListener("click", function (e) { if (e.target === modal) fermer(); });
            document.body.appendChild(modal);
        }
        modal.innerHTML = html;
        modal._overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        modal.classList.add("ouvert");
 
        modal.querySelector(".sr-det-x").addEventListener("click", fermer);
        modal.querySelectorAll(".sr-det-choix button").forEach(function (b) {
            b.addEventListener("click", function () {
                modal.querySelectorAll(".sr-det-choix button").forEach(function (x) { x.classList.remove("actif"); });
                b.classList.add("actif");
            });
        });
        modal.querySelectorAll(".sr-det-qte button").forEach(function (b) {
            b.addEventListener("click", function () {
                qte = Math.max(1, Math.min(20, qte + Number(b.getAttribute("data-q"))));
                modal.querySelector("#sr-det-q").textContent = qte;
            });
        });
        var ajout = modal.querySelector(".sr-det-ajout"), direct = modal.querySelector(".sr-det-direct");
        if (ajout) ajout.addEventListener("click", function () { ajouterAuPanier(false); });
        if (direct) direct.addEventListener("click", function () { ajouterAuPanier(true); });
        var x = modal.querySelector(".sr-det-x"); if (x) x.focus();
    }
 
    // Réutilise le panier existant : on positionne l'option sur la carte puis on appelle la fonction officielle
    function ajouterAuPanier(ouvrirPanier) {
        var p = produitCourant; if (!p) return;
        if (typeof window.ajusterQuantitePanier !== "function") { alert("Panier indisponible, rechargez la page."); return; }
        var actif = modal.querySelector(".sr-det-choix button.actif");
        var sel = document.getElementById("opt-taille-" + p.ID);
        if (sel && actif && sel.tagName === "SELECT") sel.value = actif.getAttribute("data-opt");
        var ok = true;
        for (var i = 0; i < qte; i++) {
            var r = window.ajusterQuantitePanier(p.ID, 1);
            if (r === null || r === undefined) { ok = false; break; }   // zone non choisie ou produit introuvable : le message est déjà affiché par le panier
        }
        if (!ok) return;
        if (typeof window.rafraichirCompteursCartes === "function") window.rafraichirCompteursCartes();
        fermer();
        if (ouvrirPanier && typeof window.ouvrirPanierBoutique === "function") window.ouvrirPanierBoutique();
    }
 
    // Délégation d'événements : fonctionne même quand la grille est redessinée
    document.addEventListener("click", function (e) {
        var cible = e.target;
        if (!cible || !cible.closest) return;
        if (cible.closest(".zl-like") || cible.closest(".zl-qte") || cible.closest("select") || cible.closest("button") && !cible.closest(".zl-img")) return;
        var zone = cible.closest("#grille-boutique-dediee .zl-img, #grille-boutique-dediee .zl-nom");
        if (!zone) return;
        var carte = zone.closest(".zl-carte"); if (!carte) return;
        var p = produitDeCarte(carte); if (!p) return;
        dernierFocus = document.activeElement;
        ouvrir(p);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal && modal.classList.contains("ouvert")) fermer(); });
})();
 
