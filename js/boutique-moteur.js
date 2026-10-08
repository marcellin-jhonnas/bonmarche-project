document.addEventListener("DOMContentLoaded", () => {
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
        "DEFAUT": {
            bannerImg: "https://unsplash.com",
            phrase: "Vos espaces exclusifs SafeRun Market.",
            badge: "Boutique Partenaire"
        }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const boutiqueCible = urlParams.get('type') || ""; 
    if (!boutiqueCible) return;

    const cleBoutique = boutiqueCible.toUpperCase();
    const configVisuelle = DESIGN_BOUTIQUES[cleBoutique] || DESIGN_BOUTIQUES["DEFAUT"];

    document.getElementById("shop-subname").innerText = boutiqueCible.toUpperCase();
    document.getElementById("shop-banner-title").innerText = `ESPACE ${boutiqueCible.toUpperCase()}`;
    document.getElementById("shop-banner-text").innerText = configVisuelle.phrase;
    document.getElementById("hero-badge").innerText = configVisuelle.badge;
    document.getElementById("shop-hero").style.backgroundImage = `url('${configVisuelle.bannerImg}')`;

    // Lien de liaison vers votre Google Sheet existant (Modifier avec votre vrai ID de script si besoin)
    // Mettez à jour la ligne 62 (ou la ligne de votre définition d'URL) avec le vrai lien :
    const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec"; 

    fetch(API_URL)
        .then(response => response.json())
        .then(produits => {
            const produitsFiltres = produits.filter(p => (p.Categorie || "").trim().toUpperCase() === cleBoutique);
            const grille = document.getElementById("grille-boutique-dediee");
            if(!grille) return;
            grille.innerHTML = ""; 

            produitsFiltres.forEach(prod => {
                const htmlOptionsStock = window.genererStructureOptionsStock ? window.genererStructureOptionsStock(prod) : "";
                const estEpuise = prod.Options_Disponibles && prod.Options_Disponibles.trim().toUpperCase() === "EPUISE";

                const carte = document.createElement("div");
                carte.className = "carte-premium";
                carte.innerHTML = `
                    <div class="prix-tag-premium">${prod.Prix ? Number(prod.Prix).toLocaleString('fr-FR') : 0} Ar</div>
                    <div class="img-container-premium"><img src="${prod.Image || 'https://placeholder.com'}" alt="${prod.Nom}"></div>
                    <div class="infos-produit">
                        <h3>${prod.Nom}</h3>
                        ${htmlOptionsStock}
                        <button class="btn-panier-premium" ${estEpuise ? "disabled style='background:#cbd5e1;color:#64748b;'" : ""} onclick="window.ajouterAuPanierNouveauSysteme('${prod.ID}', '${prod.Categorie}')">
                            <i class="${estEpuise ? 'fas fa-minus-circle' : 'fas fa-shopping-bag'}"></i> ${estEpuise ? "RUPTURE" : "AJOUTER AU PANIER"}
                        </button>
                    </div>`;
                grille.appendChild(carte);
            });
        }).catch(err => console.log("Erreur API:", err));
});