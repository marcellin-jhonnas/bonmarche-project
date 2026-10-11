/* ==========================================================================
   SafeRun - boutique-moteur.js (version dynamique)
   - Les boutiques = les catégories de la Google Sheet (aucune liste en dur)
   - La bannière = diaporama des images des produits de la boutique
   - Cache PWA affiché instantanément + rafraîchissement silencieux en arrière-plan
   ========================================================================== */

// ----- Réglages du diaporama (les seuls chiffres à modifier si besoin) -----
const BANNIERE_DUREE_MS = 4000;     // temps d'affichage de chaque image
const BANNIERE_MAX_IMAGES = 8;      // nombre maximum d'images dans le diaporama

// Textes personnalisés OPTIONNELS (une boutique absente d'ici reçoit un texte automatique)
const TEXTES_PERSONNALISES = {
    "VETEMENTS":  { phrase: "Affirmez votre style. Collection textile sélectionnée pour vous à Tana.", badge: "Mode & Tendance 2026" },
    "CHAUSSURES": { phrase: "Le confort à chaque pas. Modèles durables et élégants.", badge: "Premium Footwear" },
    "FOOD EXPRESS": { phrase: "Vos plats chauds préférés livrés en mode express.", badge: "Livraison Flash" }
};

document.addEventListener("DOMContentLoaded", () => {
    // 1. Boutique demandée dans l'URL (peut être vide : dans ce cas la 1re boutique de la Sheet est utilisée)
    const urlParams = new URLSearchParams(window.location.search);
    const boutiqueUrl = (urlParams.get('type') || "").trim();

    // Titre provisoire pendant le chargement
    if (boutiqueUrl) afficherNomBoutique(boutiqueUrl);

    // 2. STRATÉGIE DE CHARGEMENT HYBRIDE (Spécial PWA Hors-ligne / Rapide)
    let cache = null;
    try {
        const brut = localStorage.getItem("saferun_cache_produits");
        if (brut) cache = JSON.parse(brut);
    } catch (e) { cache = null; }

    if (Array.isArray(cache) && cache.length) {
        // Étape A : affichage instantané depuis la mémoire locale
        console.log("[SafeRun PWA] Chargement instantané depuis la mémoire locale.");
        lancerBoutique(cache, boutiqueUrl);
        // Étape B : vérification silencieuse auprès du serveur (détecte les nouveaux produits/catégories)
        executerFetchServeur(boutiqueUrl, true);
    } else {
        console.log("[SafeRun PWA] Mémoire locale vide, synchronisation avec le serveur Google...");
        executerFetchServeur(boutiqueUrl, false);
    }
});

/* ------------------------------ Utilitaires ------------------------------ */

// Clé de comparaison : sans accents, sans espaces superflus, en majuscules
function normaliserCle(texte) {
    return String(texte || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

// Rayons déjà gérés par l'accueil (index.html) : ils ne créent PAS de bouton de boutique
const RAYONS_ACCUEIL = ["PPN", "PRODUITSDEPREMIERENECESSITE", "ALIMENTAIRE", "CONSERVES", "FRAIS", "HYGIENE", "ENERGIE", "BOULANGERIE"];
function estRayonAccueil(nomOuCle) {
    const k = normaliserCle(nomOuCle).replace(/[^A-Z0-9]/g, "");
    return RAYONS_ACCUEIL.indexOf(k) !== -1;
}

// Liste des boutiques = catégories distinctes trouvées dans les produits (hors rayons de l'accueil)
function listerBoutiques(produits) {
    const vues = new Map();
    (produits || []).forEach(p => {
        const nom = String((p && p.Categorie) || "").trim();
        if (!nom) return;
        if (estRayonAccueil(nom)) return;
        const cle = normaliserCle(nom);
        if (!vues.has(cle)) vues.set(cle, { cle: cle, nom: nom });
    });
    return Array.from(vues.values());
}

function estEpuise(p) {
    return String((p && p.Options_Disponibles) || "").trim().toUpperCase() === "EPUISE";
}

// Répare automatiquement les liens d'images "page" en liens directs
// (imgur.com/AbCdEf -> i.imgur.com/AbCdEf.jpg ; Google Drive -> lien image ; http -> https)
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

function melanger(tableau) {
    const t = tableau.slice();
    for (let i = t.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [t[i], t[j]] = [t[j], t[i]];
    }
    return t;
}

function afficherNomBoutique(nom) {
    const majuscule = String(nom).toUpperCase();
    const sub = document.getElementById("shop-subname");
    const titre = document.getElementById("shop-banner-title");
    if (sub) sub.innerText = majuscule;
    if (titre) titre.innerText = `ESPACE ${majuscule}`;
}

/* ------------------------- Démarrage d'une boutique ------------------------ */

function lancerBoutique(produits, boutiqueUrl) {
    window.tousLesProduits = produits;   // utilisé aussi par le menu "Boutiques"
    const boutiques = listerBoutiques(produits);

    let cle, nom;
    if (boutiqueUrl) {
        cle = normaliserCle(boutiqueUrl);
        const trouvee = boutiques.find(b => b.cle === cle);
        nom = trouvee ? trouvee.nom : boutiqueUrl;
    } else if (boutiques.length) {
        cle = boutiques[0].cle;
        nom = boutiques[0].nom;
    } else {
        cle = "VETEMENTS";
        nom = "Vetements";
    }

    afficherNomBoutique(nom);

    const perso = TEXTES_PERSONNALISES[cle];
    const nomPropre = nom.charAt(0).toUpperCase() + nom.slice(1).toLowerCase();
    const phrase = perso ? perso.phrase : `Découvrez toute la sélection ${nomPropre} sur SafeRun Market.`;
    const badge = perso ? perso.badge : "Boutique SafeRun";
    const txt = document.getElementById("shop-banner-text");
    const bdg = document.getElementById("hero-badge");
    if (txt) txt.innerText = phrase;
    if (bdg) bdg.innerText = badge;

    initialiserBanniere(produits, cle, nom);
    traiterEtAfficherGrilleEtanche(produits, cle);
}

/* ------------------------ Bannière : diaporama produits --------------------- */

function degradeAutomatique(nom) {
    let h = 0;
    for (const c of String(nom)) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `linear-gradient(135deg, hsl(${h},55%,22%) 0%, #0f172a 65%, hsl(${(h + 40) % 360},80%,45%) 170%)`;
}

function injecterStylesBanniere() {
    if (document.getElementById("saferun-styles-banniere")) return;
    const style = document.createElement("style");
    style.id = "saferun-styles-banniere";
    style.textContent = `
        .premium-hero .hero-slide { position:absolute; top:0; left:0; width:100%; height:100%; z-index:0;
            background-size:cover; background-position:center; opacity:0; transition:opacity 1.2s ease-in-out; }
        .premium-hero .hero-slide.visible { opacity:1; }
        @media (prefers-reduced-motion: reduce) { .premium-hero .hero-slide { transition:none; } }`;
    document.head.appendChild(style);
}

function initialiserBanniere(produits, cle, nom) {
    const hero = document.getElementById("shop-hero");
    if (!hero) return;

    // Nettoyage si la bannière est relancée (rafraîchissement des données)
    if (window.__saferunBanniereTimer) { clearInterval(window.__saferunBanniereTimer); window.__saferunBanniereTimer = null; }
    hero.querySelectorAll(".hero-slide").forEach(e => e.remove());

    injecterStylesBanniere();
    // Fond de secours : dégradé propre au nom de la boutique (jamais de fausse photo)
    hero.style.backgroundImage = degradeAutomatique(nom);

    const overlay = hero.querySelector(".hero-overlay");
    const couches = [document.createElement("div"), document.createElement("div")];
    couches.forEach(c => {
        c.className = "hero-slide";
        hero.insertBefore(c, overlay || hero.firstChild);
    });

    // Images candidates : produits de CETTE boutique, non épuisés, avec un lien valide
    const vues = new Set();
    const candidates = [];
    (produits || []).forEach(p => {
        if (normaliserCle(p.Categorie) !== cle || estEpuise(p)) return;
        const url = normaliserUrlImage(p.Image_URL || p.Image);
        if (!/^https?:\/\//i.test(url) || vues.has(url)) return;
        vues.add(url);
        candidates.push(url);
    });

    // On teste un peu plus d'images que nécessaire : les liens cassés sont ignorés
    const aTester = melanger(candidates).slice(0, BANNIERE_MAX_IMAGES + 4);
    const chargees = [];
    let actif = 0, index = -1;
    const reduit = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function montrer(i) {
        const suivante = couches[1 - actif];
        suivante.style.backgroundImage = `url("${chargees[i].replace(/"/g, "%22")}")`;
        suivante.classList.add("visible");
        couches[actif].classList.remove("visible");
        actif = 1 - actif;
        index = i;
    }

    function demarrerRotation() {
        if (window.__saferunBanniereTimer || reduit || chargees.length < 2) return;
        window.__saferunBanniereTimer = setInterval(() => montrer((index + 1) % chargees.length), BANNIERE_DUREE_MS);
    }

    aTester.forEach(url => {
        const img = new Image();
        img.onload = () => {
            if (chargees.length >= BANNIERE_MAX_IMAGES) return;
            chargees.push(url);
            if (chargees.length === 1) montrer(0);
            else demarrerRotation();
        };
        img.src = url;   // en cas d'erreur : image simplement ignorée
    });
}

/* ------------------------------ Appel réseau ------------------------------ */

function executerFetchServeur(boutiqueUrl, silencieux) {
    const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";

    fetch(API_URL)
        .then(response => response.json())
        .then(produits => {
            if (!Array.isArray(produits)) return;
            const ancien = localStorage.getItem("saferun_cache_produits");
            const nouveau = JSON.stringify(produits);
            localStorage.setItem("saferun_cache_produits", nouveau);
            // Mode silencieux : on ne redessine que si la Sheet a réellement changé
            if (silencieux && ancien === nouveau) return;
            lancerBoutique(produits, boutiqueUrl);
        })
        .catch(err => {
            console.log("Erreur de synchronisation réseau:", err);
            if (silencieux) return;   // le cache est déjà affiché : on ne gâche pas l'écran
            const grille = document.getElementById("grille-boutique-dediee");
            if (grille) grille.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color: #ef4444;">Erreur de connexion. Vérifiez votre réseau à Antananarivo.</div>`;
        });
}

/* ------------------- Filtrage étanche + affichage des cartes ---------------- */

function traiterEtAfficherGrilleEtanche(produits, cleFiltre) {
    const grille = document.getElementById("grille-boutique-dediee");
    if (!grille) return;
    grille.innerHTML = ""; // Vider l'icône de chargement

    // IDENTIFIANT STABLE : la feuille n'a pas forcément de colonne ID -> on le déduit du nom
    (produits || []).forEach(p => {
        if (p && (p.ID === undefined || p.ID === null || String(p.ID).trim() === "")) {
            p.ID = "P-" + normaliserCle(p.Nom).replace(/[^A-Z0-9]/g, "");
        }
    });

    // FILTRAGE STRICT : la catégorie doit correspondre à la boutique ouverte
    const produitsFiltres = produits.filter(p => normaliserCle(p.Categorie) === cleFiltre);

    if (produitsFiltres.length === 0) {
        grille.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding: 50px 20px; color: #7f8c8d; font-family: 'Poppins', sans-serif;">
                <i class="fas fa-box-open" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 15px; display: block;"></i>
                Aucun article disponible pour la catégorie <b>${cleFiltre}</b> actuellement.
            </div>`;
        return;
    }

    injecterStylesGrille();
    const nomBoutique = String(produitsFiltres[0].Categorie || cleFiltre).trim();
    const positions = positionsAnnonces(produitsFiltres.length);

    produitsFiltres.forEach((prod, idx) => {
        const epuise = estEpuise(prod);
        const htmlOptionsStock = window.genererStructureOptionsStock ? window.genererStructureOptionsStock(prod) : "";
        const prix = Number(String(prod.Prix).replace(/[^0-9.]/g, "")) || 0;
        const img = normaliserUrlImage(prod.Image_URL || prod.Image) || 'https://placehold.co/400x500?text=SafeRun';

        const carte = document.createElement("div");
        carte.className = "carte-premium zl-carte" + (epuise ? " zl-epuise" : "");
        carte.innerHTML = `
            <div class="img-container-premium zl-img">
                <img src="${echapperHtml(img)}" alt="${echapperHtml(prod.Nom)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://placehold.co/400x500?text=SafeRun'">
                ${epuise ? '<span class="zl-badge">Rupture</span>' : ''}
            </div>
            <div class="infos-produit zl-infos">
                <h3 class="zl-nom">${echapperHtml(prod.Nom)}</h3>
                <div class="zl-prix">${prix.toLocaleString('fr-FR')} Ar</div>
                ${htmlOptionsStock}
                <button type="button" class="btn-panier-premium zl-btn" ${epuise ? "disabled" : ""}>
                    <i class="${epuise ? 'fas fa-minus-circle' : 'fas fa-shopping-bag'}"></i>
                    ${epuise ? "Rupture de stock" : "Ajouter"}
                </button>
            </div>`;
        const bouton = carte.querySelector(".zl-btn");
        if (bouton && !epuise) bouton.addEventListener("click", () => window.ajouterAuPanierNouveauSysteme(prod.ID, prod.Categorie));
        grille.appendChild(carte);

        // Annonce insérée au milieu de la grille
        const rang = positions.indexOf(idx + 1);
        if (rang !== -1) grille.appendChild(construireAnnonce(rang, nomBoutique, produitsFiltres));
    });
}

/* --------------------------- Annonces dans la grille --------------------------- */

function echapperHtml(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Après quel produit insérer une annonce (1 au milieu ; 2 si la boutique est grande)
function positionsAnnonces(n) {
    if (n < 4) return [];
    if (n >= 12) return [Math.round(n / 3 / 2) * 2, Math.round(n * 2 / 3 / 2) * 2];
    return [Math.max(2, Math.round(n / 2 / 2) * 2)];
}

// Textes particuliers à une boutique (facultatif) — sinon texte automatique construit avec la catégorie
const ANNONCES_BOUTIQUE = {
    "VETEMENTS":  { accroche: "Nouvelle tenue, nouveau look", texte: "Les pièces de la saison sont arrivées. Stock limité, ne laissez pas votre taille partir." },
    "CHAUSSURES": { accroche: "Trouvez la paire parfaite", texte: "Confort et style à chaque pas. Les pointures partent vite." }
};

function produitsAvecImage(produits) {
    return melanger((produits || []).filter(p => !estEpuise(p) && /^https?:\/\//i.test(normaliserUrlImage(p.Image_URL || p.Image))));
}

function construireAnnonce(rang, nomBoutique, produits) {
    const cle = normaliserCle(nomBoutique);
    const candidats = produitsAvecImage(produits);
    const vedette = candidats[0] || null;
    const div = document.createElement("div");
    div.className = "zl-annonce " + (rang % 2 === 0 ? "zl-annonce-promo" : "zl-annonce-boutique");
    const imageUrl = vedette ? normaliserUrlImage(vedette.Image_URL || vedette.Image) : "";
    const imgHtml = imageUrl
        ? `<img src="${echapperHtml(imageUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.style.display='none'">`
        : "";

    if (rang % 2 === 0) {
        // Annonce commune à toutes les boutiques : stimule l'achat
        div.innerHTML = `
            <div class="zl-annonce-txt">
                <span class="zl-annonce-tag">Offre SafeRun</span>
                <h4>Commandez aujourd'hui, recevez vite</h4>
                <p>Livraison rapide à Antananarivo · Paiement sécurisé MVola · Votre commande suivie en direct.</p>
            </div>
            <div class="zl-annonce-img">${imgHtml}</div>`;
    } else {
        // Annonce propre à la boutique, tirée de ses produits dans la Sheet
        const perso = ANNONCES_BOUTIQUE[cle];
        const accroche = perso ? perso.accroche : `Coup de cœur ${nomBoutique}`;
        const texte = perso ? perso.texte : (vedette
            ? `Découvrez « ${vedette.Nom} » à ${(Number(String(vedette.Prix).replace(/[^0-9.]/g, "")) || 0).toLocaleString('fr-FR')} Ar, choisi dans l'espace ${nomBoutique}.`
            : `Toute la sélection ${nomBoutique} sur SafeRun Market.`);
        div.innerHTML = `
            <div class="zl-annonce-txt">
                <span class="zl-annonce-tag">Espace ${echapperHtml(nomBoutique)}</span>
                <h4>${echapperHtml(accroche)}</h4>
                <p>${echapperHtml(texte)}</p>
            </div>
            <div class="zl-annonce-img">${imgHtml}</div>`;
    }
    return div;
}

/* ------------------- Styles de la grille (façon boutique mode) ------------------- */

function injecterStylesGrille() {
    if (document.getElementById("zl-styles")) return;
    const s = document.createElement("style");
    s.id = "zl-styles";
    s.textContent = `
    #grille-boutique-dediee { display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:14px 10px !important; align-items:start; }
    @media (min-width: 900px) { #grille-boutique-dediee { grid-template-columns:repeat(4,minmax(0,1fr)) !important; gap:22px 16px !important; } }
    #grille-boutique-dediee .zl-carte { background:transparent !important; box-shadow:none !important; border:0 !important; border-radius:0 !important; padding:0 !important; display:flex; flex-direction:column; }
    #grille-boutique-dediee .zl-img { position:relative; width:100%; aspect-ratio:3/4; height:auto !important; background:#f1f3f5; border-radius:6px; overflow:hidden; }
    #grille-boutique-dediee .zl-img img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .4s; }
    #grille-boutique-dediee .zl-carte:hover .zl-img img { transform:scale(1.04); }
    #grille-boutique-dediee .zl-badge { position:absolute; left:8px; top:8px; background:#1e293b; color:#fff; font:600 .68rem Poppins,sans-serif; padding:4px 8px; border-radius:4px; }
    #grille-boutique-dediee .zl-epuise .zl-img img { filter:grayscale(1); opacity:.55; }
    #grille-boutique-dediee .zl-infos { padding:8px 2px 0 !important; text-align:left; }
    #grille-boutique-dediee .zl-nom { font:500 .85rem Poppins,sans-serif; color:#1a1a1a; margin:0 0 3px; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    #grille-boutique-dediee .zl-prix { font:700 .95rem Poppins,sans-serif; color:#1a1a1a; margin-bottom:6px; }
    #grille-boutique-dediee .zl-btn { width:100%; padding:9px 10px !important; border-radius:6px !important; font:600 .78rem Poppins,sans-serif !important; letter-spacing:.2px; }
    #grille-boutique-dediee .zl-btn:disabled { background:#e2e8f0 !important; color:#64748b !important; cursor:not-allowed; }
    .zl-annonce { grid-column:1 / -1; display:flex; align-items:stretch; justify-content:space-between; gap:14px; border-radius:14px; overflow:hidden; min-height:130px; font-family:Poppins,sans-serif; }
    .zl-annonce-promo { background:linear-gradient(135deg,#0f3d2e,#27ae60); color:#fff; }
    .zl-annonce-boutique { background:linear-gradient(135deg,#1e293b,#475569); color:#fff; }
    .zl-annonce-txt { padding:18px 16px; flex:1; display:flex; flex-direction:column; justify-content:center; gap:6px; }
    .zl-annonce-tag { align-self:flex-start; background:rgba(255,255,255,.18); padding:3px 10px; border-radius:20px; font-size:.68rem; font-weight:600; letter-spacing:.4px; text-transform:uppercase; }
    .zl-annonce h4 { margin:0; font-size:1.05rem; font-weight:700; line-height:1.25; }
    .zl-annonce p { margin:0; font-size:.78rem; opacity:.9; line-height:1.45; }
    .zl-annonce-img { width:38%; max-width:260px; flex-shrink:0; }
    .zl-annonce-img img { width:100%; height:100%; object-fit:cover; display:block; }
    `;
    document.head.appendChild(s);
}