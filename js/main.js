const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";
let tousLesProduits = [];
let panier = []; // Notre liste de produits choisis

// 1. CHARGEMENT
async function chargerBoutique() {
    try {
        const response = await fetch(API_URL);
        tousLesProduits = await response.json();
        rendreProduits(tousLesProduits);
    } catch (e) { console.log("Erreur de chargement"); }
}

function rendreProduits(liste) {
    const container = document.getElementById('boutique');
    container.innerHTML = liste.map(p => `
        <div class="carte-produit">
            <div class="prix-badge">${Number(p.Prix).toLocaleString()} Ar</div>
            <img src="${p.Image_URL}" alt="${p.Nom}">
            <div style="padding:15px;">
                <span class="cat-tag">${p.Categorie || 'Essentiel'}</span>
                <h3>${p.Nom}</h3>
                <button onclick="ajouterAuPanier('${p.Nom.replace(/'/g, "\\'")}', ${p.Prix})">
                    <i class="fas fa-cart-plus"></i> AJOUTER AU PANIER
                </button>
            </div>
        </div>
    `).join('');
}

// 2. LOGIQUE DU PANIER AVEC QUANTITÉS
function ajouterAuPanier(nom, prix) {
    // On cherche si le produit est déjà dans le panier
    const produitExistant = panier.find(item => item.nom === nom);

    if (produitExistant) {
        // Si oui, on augmente juste la quantité
        produitExistant.quantite += 1;
    } else {
        // Si non, on l'ajoute avec une quantité de 1
        panier.push({ nom, prix, quantite: 1 });
    }
    
    mettreAJourBadge();
    
    // Animation visuelle optionnelle : faire bouger le panier
    const badge = document.getElementById('cart-count');
    badge.style.transform = "scale(1.3)";
    setTimeout(() => badge.style.transform = "scale(1)", 200);
}

function mettreAJourBadge() {
    const badge = document.getElementById('cart-count');
    if(badge) {
        // On calcule le nombre total d'articles (3 huiles + 5 eaux = 8 articles)
        const totalArticles = panier.reduce((sum, item) => sum + item.quantite, 0);
        badge.innerText = totalArticles;
        badge.style.display = totalArticles > 0 ? "block" : "none";
    }
}

// 3. ENVOI DE LA COMMANDE GROUPÉE (Version Quantités)
function envoyerCommande() {
    if (panier.length === 0) {
        alert("Votre panier est vide ! Choisissez vos produits d'abord.");
        return;
    }

    const numeroWA = "261382453610";
    const clientNom = localStorage.getItem('saferun_nom') || "[À COMPLÉTER]";
    const clientQuartier = localStorage.getItem('saferun_quartier') || "[À COMPLÉTER]";

    let listeProduits = "";
    let totalGeneral = 0;
    
    panier.forEach((item) => {
        const sousTotal = item.prix * item.quantite;
        totalGeneral += sousTotal;
        // On affiche : "3 x Huile (15.000 Ar) = 45.000 Ar"
        listeProduits += `✅ ${item.quantite} x *${item.nom}* : ${sousTotal.toLocaleString()} Ar\n`;
    });

    const message = `Bonjour SafeRun Market ! 🛒\n\n` +
                    `Nouvelle commande de :\n` +
                    `---------------------------\n` +
                    `${listeProduits}` +
                    `---------------------------\n` +
                    `💰 *TOTAL À PAYER : ${totalGeneral.toLocaleString()} Ar*\n\n` +
                    `--- INFOS LIVRAISON ---\n` +
                    `👤 NOM : ${clientNom}\n` +
                    `📍 QUARTIER : ${clientQuartier}\n` +
                    `---------------------------\n` +
                    `Je confirme ma commande !`;

    window.open(`https://wa.me/${numeroWA}?text=${encodeURIComponent(message)}`, '_blank');
}
// Fonction pour filtrer les produits
function filtrerParCategorie(categorie) {
    // 1. Gérer l'apparence des boutons
    const boutons = document.querySelectorAll('.cat-btn');
    boutons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // 2. Filtrer la liste
    if (categorie === 'Tous') {
        rendreProduits(tousLesProduits);
    } else {
        const produitsFiltrés = tousLesProduits.filter(p => p.Categorie === categorie);
        rendreProduits(produitsFiltrés);
    }
}

// Lier le clic sur l'icône du panier à l'envoi de la commande
document.querySelector('.cart-trigger').onclick = envoyerCommande;

// Recherche
document.getElementById('search').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const filtrés = tousLesProduits.filter(p => p.Nom.toLowerCase().includes(val));
    rendreProduits(filtrés);
});

chargerBoutique();