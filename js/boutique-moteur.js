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

// Liste des boutiques = catégories distinctes trouvées dans les produits
function listerBoutiques(produits) {
    const vues = new Map();
    (produits || []).forEach(p => {
        const nom = String((p && p.Categorie) || "").trim();
        if (!nom) return;
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
            if (grille) grille.innerHTML = `<div style="grid-column: span 3; text-align:center; padding: 40px; color: #ef4444;">Erreur de connexion. Vérifiez votre réseau à Antananarivo.</div>`;
        });
}

/* ------------------- Filtrage étanche + affichage des cartes ---------------- */

function traiterEtAfficherGrilleEtanche(produits, cleFiltre) {
    const grille = document.getElementById("grille-boutique-dediee");
    if (!grille) return;
    grille.innerHTML = ""; // Vider l'icône de chargement

    // FILTRAGE STRICT : la catégorie doit correspondre à la boutique ouverte
    const produitsFiltres = produits.filter(p => normaliserCle(p.Categorie) === cleFiltre);

    if (produitsFiltres.length === 0) {
        grille.innerHTML = `
            <div style="grid-column: span 3; text-align:center; padding: 50px 20px; color: #7f8c8d; font-family: 'Poppins', sans-serif;">
                <i class="fas fa-box-open" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 15px; display: block;"></i>
                Aucun article disponible pour la catégorie <b>${cleFiltre}</b> actuellement.
            </div>`;
        return;
    }

    produitsFiltres.forEach(prod => {
        const htmlOptionsStock = window.genererStructureOptionsStock ? window.genererStructureOptionsStock(prod) : "";
        const epuise = estEpuise(prod);

        const carte = document.createElement("div");
        carte.className = "carte-premium";
        carte.innerHTML = `
            <div class="prix-tag-premium">${prod.Prix ? Number(prod.Prix).toLocaleString('fr-FR') : 0} Ar</div>
            <div class="img-container-premium">
                <img src="${normaliserUrlImage(prod.Image_URL || prod.Image) || 'https://placehold.co/400x400?text=SafeRun'}" alt="${prod.Nom}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://placehold.co/400x400?text=SafeRun'">
            </div>
            <div class="infos-produit">
                <h3>${prod.Nom}</h3>
                ${htmlOptionsStock}
                <button class="btn-panier-premium" ${epuise ? "disabled style='background:#cbd5e1;color:#64748b;cursor:not-allowed;'" : ""} onclick="window.ajouterAuPanierNouveauSysteme('${prod.ID}', '${prod.Categorie}')">
                    <i class="${epuise ? 'fas fa-minus-circle' : 'fas fa-shopping-bag'}"></i>
                    ${epuise ? "RUPTURE DE STOCK" : "AJOUTER AU PANIER"}
                </button>
            </div>`;
        grille.appendChild(carte);
    });
}