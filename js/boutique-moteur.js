document.addEventListener("DOMContentLoaded", () => {
    // 1. Dictionnaire visuel premium avec de vraies images HD Unsplash (Fini les liens cassés)
        // 🛠️ CONFIGURATION DES BANNIÈRES CORRIGÉE (ÉLIMINE L'ERREUR NS_BINDING_ABORTED)
    const DESIGN_BOUTIQUES = {
        "VETEMENTS": {
            bannerImg: "https://unsplash.com",
            phrase: "Affirmez votre style. Collection textile sélectionnée pour vous à Tana.",
            badge: "Mode & Tendance 2026"
        },
        "CHAUSSURES": {
            bannerImg: "https://unsplash.com",
            phrase: "Le confort à chaque pas. Modèles durables et élégants.",
            badge: "Premium Footwear"
        },
        "FOOD EXPRESS": {
            bannerImg: "https://unsplash.com",
            phrase: "Vos plats chauds préférés livrés en mode express.",
            badge: "Livraison Flash"
        },
        "DEFAUT": {
            bannerImg: "https://unsplash.com",
            phrase: "Vos espaces exclusifs SafeRun Market.",
            badge: "Boutique Partenaire"
        }
    };

    // 2. Détection de la boutique cible dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const boutiqueCible = urlParams.get('type') || ""; 

    // SÉCURITÉ PWA STRICTE : Si l'URL n'a pas de paramètre, on force "Vetements" pour éviter d'afficher un mélange vide
    const espaceActuel = boutiqueCible ? boutiqueCible.trim() : "Vetements";
    const cleBoutique = espaceActuel.toUpperCase();
    const configVisuelle = DESIGN_BOUTIQUES[cleBoutique] || DESIGN_BOUTIQUES["DEFAUT"];

    // Injection des éléments graphiques dans le en-tête
    if(document.getElementById("shop-subname")) document.getElementById("shop-subname").innerText = espaceActuel.toUpperCase();
    if(document.getElementById("shop-banner-title")) document.getElementById("shop-banner-title").innerText = `ESPACE ${espaceActuel.toUpperCase()}`;
    if(document.getElementById("shop-banner-text")) document.getElementById("shop-banner-text").innerText = configVisuelle.phrase;
    if(document.getElementById("hero-badge")) document.getElementById("hero-badge").innerText = configVisuelle.badge;
    
    const shopHero = document.getElementById("shop-hero");
    if(shopHero) shopHero.style.backgroundImage = `url('${configVisuelle.bannerImg}')`;

    // 3. STRATÉGIE DE CHARGEMENT HYBRIDE (Spécial PWA Hors-ligne / Rapide)
    const cacheGlobal = localStorage.getItem("saferun_cache_produits");
    
    if (cacheGlobal) {
        // Étape A : Affichage instantané en 0 milliseconde depuis la mémoire de la PWA
        console.log("[SafeRun PWA] Chargement instantané depuis la mémoire locale.");
        const tousLesProduits = JSON.parse(cacheGlobal);
        traiterEtAfficherGrilleEtanche(tousLesProduits, cleBoutique);
    } else {
        // Étape B : Si premier démarrage ou cache vide, appel réseau vers le script d'origine
        console.log("[SafeRun PWA] Mémoire locale vide, synchronisation avec le serveur Google...");
        executerFetchServeur(cleBoutique);
    }
});

// Fonction d'appel réseau isolée
function executerFetchServeur(cleBoutique) {
    const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec"; 

    fetch(API_URL)
        .then(response => response.json())
        .then(produits => {
            // Sauvegarder dans la structure de cache pour les prochaines requêtes PWA
            localStorage.setItem("saferun_cache_produits", JSON.stringify(produits));
            traiterEtAfficherGrilleEtanche(produits, cleBoutique);
        })
        .catch(err => {
            console.log("Erreur de synchronisation réseau:", err);
            const grille = document.getElementById("grille-boutique-dediee");
            if(grille) grille.innerHTML = `<div style="grid-column: span 3; text-align:center; padding: 40px; color: #ef4444;">Erreur de connexion. Vérifiez votre réseau à Antananarivo.</div>`;
        });
}

// Fonction de filtrage étanche (Élimine le mélange des catégories)
function traiterEtAfficherGrilleEtanche(produits, cleFiltre) {
    const grille = document.getElementById("grille-boutique-dediee");
    if (!grille) return;
    grille.innerHTML = ""; // Vider l'icône de chargement

    // FILTRAGE STRICT : On vérifie que la catégorie correspond EXACTEMENT à la page ouverte
    const produitsFiltres = produits.filter(p => (p.Categorie || "").trim().toUpperCase() === cleFiltre);

    if (produitsFiltres.length === 0) {
        grille.innerHTML = `
            <div style="grid-column: span 3; text-align:center; padding: 50px 20px; color: #7f8c8d; font-family: 'Poppins', sans-serif;">
                <i class="fas fa-box-open" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 15px; display: block;"></i>
                Aucun article disponible pour la catégorie <b>${cleFiltre}</b> actuellement.
            </div>`;
        return;
    }

    // Affichage propre de la collection filtrée
    produitsFiltres.forEach(prod => {
        const htmlOptionsStock = window.genererStructureOptionsStock ? window.genererStructureOptionsStock(prod) : "";
        const estEpuise = prod.Options_Disponibles && prod.Options_Disponibles.trim().toUpperCase() === "EPUISE";

        const carte = document.createElement("div");
        carte.className = "carte-premium";
        carte.innerHTML = `
            <div class="prix-tag-premium">${prod.Prix ? Number(prod.Prix).toLocaleString('fr-FR') : 0} Ar</div>
            <div class="img-container-premium">
                <img src="${prod.Image || 'https://placeholder.com'}" alt="${prod.Nom}">
            </div>
            <div class="infos-produit">
                <h3>${prod.Nom}</h3>
                ${htmlOptionsStock}
                <button class="btn-panier-premium" ${estEpuise ? "disabled style='background:#cbd5e1;color:#64748b;cursor:not-allowed;'" : ""} onclick="window.ajouterAuPanierNouveauSysteme('${prod.ID}', '${prod.Categorie}')">
                    <i class="${estEpuise ? 'fas fa-minus-circle' : 'fas fa-shopping-bag'}"></i> 
                    ${estEpuise ? "RUPTURE DE STOCK" : "AJOUTER AU PANIER"}
                </button>
            </div>`;
        grille.appendChild(carte);
    });
}
