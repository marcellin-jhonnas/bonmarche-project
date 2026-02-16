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

// 2. LOGIQUE DU PANIER
function ajouterAuPanier(nom, prix) {
    panier.push({ nom, prix });
    mettreAJourBadge();
    
    // Petite notification discrète au lieu d'une alerte bloquante
    console.log(`${nom} ajouté au panier`);
}

function mettreAJourBadge() {
    const badge = document.getElementById('cart-count');
    if(badge) {
        badge.innerText = panier.length;
        badge.style.display = panier.length > 0 ? "block" : "none";
    }
}

// 3. ENVOI DE LA COMMANDE GROUPÉE
function envoyerCommande() {
    if (panier.length === 0) {
        alert("Votre panier est vide ! Choisissez des produits d'abord.");
        return;
    }

    const numeroWA = "261382453610";
    const clientNom = localStorage.getItem('saferun_nom') || "[À COMPLÉTER]";
    const clientQuartier = localStorage.getItem('saferun_quartier') || "[À COMPLÉTER]";

    // Construire la liste des produits pour le message
    let listeProduits = "";
    let total = 0;
    
    panier.forEach((item, index) => {
        listeProduits += `${index + 1}. *${item.nom}* (${item.prix.toLocaleString()} Ar)\n`;
        total += item.prix;
    });

    const message = `Bonjour SafeRun Market ! 🛒\n\n` +
                    `Je souhaite commander ces produits :\n` +
                    `---------------------------\n` +
                    `${listeProduits}` +
                    `---------------------------\n` +
                    `💰 *TOTAL : ${total.toLocaleString()} Ar*\n\n` +
                    `--- INFOS LIVRAISON ---\n` +
                    `👤 NOM : ${clientNom}\n` +
                    `📍 QUARTIER : ${clientQuartier}\n` +
                    `---------------------------\n` +
                    `Merci de confirmer ma commande !`;

    window.open(`https://wa.me/${numeroWA}?text=${encodeURIComponent(message)}`, '_blank');
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