const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";
let tousLesProduits = [];
let panier = [];

// 1. CHARGEMENT
async function chargerBoutique() {
    try {
        const response = await fetch(API_URL);
        tousLesProduits = await response.json();
        rendreProduits(tousLesProduits);
    } catch (e) { 
        console.error("Erreur de chargement", e); 
        document.getElementById('boutique').innerHTML = "<p>Erreur de chargement des produits...</p>";
    }
}

function rendreProduits(liste) {
    const container = document.getElementById('boutique');
    if (liste.length === 0) {
        container.innerHTML = "<p style='padding:20px;'>Aucun produit trouvé.</p>";
        return;
    }
    container.innerHTML = liste.map(p => `
        <div class="carte-produit">
            <div class="prix-badge">${Number(p.Prix).toLocaleString()} Ar</div>
            <img src="${p.Image_URL}" alt="${p.Nom}" onerror="this.src='https://via.placeholder.com/150?text=SafeRun'">
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
    const produitExistant = panier.find(item => item.nom === nom);
    if (produitExistant) {
        produitExistant.quantite += 1;
    } else {
        panier.push({ nom, prix, quantite: 1 });
    }
    mettreAJourBadge();
    
    const badge = document.getElementById('cart-count');
    if(badge) {
        badge.style.transform = "scale(1.3)";
        setTimeout(() => badge.style.transform = "scale(1)", 200);
    }
}

function mettreAJourBadge() {
    const badge = document.getElementById('cart-count');
    if(badge) {
        const totalArticles = panier.reduce((sum, item) => sum + item.quantite, 0);
        badge.innerText = totalArticles;
        badge.style.display = totalArticles > 0 ? "block" : "none";
    }
}

// 3. FILTRAGE PAR CATÉGORIE (Version Robuste)
function filtrerParCategorie(categorieCible) {
    // Gérer l'apparence des boutons
    const boutons = document.querySelectorAll('.cat-btn');
    boutons.forEach(btn => btn.classList.remove('active'));
    
    // On cherche le bouton qui a été cliqué pour lui mettre la classe active
    if (event) {
        event.currentTarget.classList.add('active');
    }

    if (categorieCible === 'Tous') {
        rendreProduits(tousLesProduits);
    } else {
        const filtrés = tousLesProduits.filter(p => {
            // Comparaison propre (minuscules et sans espaces)
            const catProd = (p.Categorie || "").toString().trim().toLowerCase();
            const catRecherche = categorieCible.trim().toLowerCase();
            return catProd === catRecherche;
        });
        rendreProduits(filtrés);
    }
}

// 4. ENVOI WHATSAPP
function envoyerCommande() {
    if (panier.length === 0) {
        alert("Votre panier est vide !");
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

// 5. INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
    // Liaison du panier
    const cartTrigger = document.querySelector('.cart-trigger');
    if(cartTrigger) cartTrigger.onclick = envoyerCommande;

    // Recherche
    const searchBar = document.getElementById('search');
    if(searchBar) {
        searchBar.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const filtrés = tousLesProduits.filter(p => p.Nom.toLowerCase().includes(val));
            rendreProduits(filtrés);
        });
    }

    chargerBoutique();
});
// Afficher le popup après 3 secondes
wwindow.onload = function() {
    // On ne l'affiche que si l'utilisateur n'est pas déjà enregistré
    if (!localStorage.getItem('saferun_nom')) {
        setTimeout(() => {
            const popup = document.getElementById('welcome-popup');
            if (popup) popup.classList.add('show');
        }, 3000); 
    }
};

function fermerPopup() {
    const popup = document.getElementById('welcome-popup');
    if (popup) popup.classList.remove('show');
}

function ouvrirInscription() {
    // 1. On ferme le popup d'abord
    fermerPopup();

    // 2. On attend 300ms (le temps que le popup disparaisse) pour lancer l'inscription
    setTimeout(() => {
        // On vérifie si gererCompte existe, sinon on met le code en direct ici
        const nomExistant = localStorage.getItem('saferun_nom') || "";
        const quartierExistant = localStorage.getItem('saferun_quartier') || "";

        const n = prompt("Bienvenue ! Quel est votre Nom complet ?", nomExistant);
        const q = prompt("Dans quel Quartier habitez-vous ?", quartierExistant);

        if (n && q && n.trim() !== "" && q.trim() !== "") {
            localStorage.setItem('saferun_nom', n.trim());
            localStorage.setItem('saferun_quartier', q.trim());
            alert("✅ Merci " + n + ", vos informations sont enregistrées !");
        }
    }, 300);
}