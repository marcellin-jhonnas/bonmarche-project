const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";
let tousLesProduits = [];

// 1. CHARGEMENT DES PRODUITS
async function chargerBoutique() {
    const container = document.getElementById('boutique');
    try {
        const response = await fetch(API_URL);
        tousLesProduits = await response.json();
        rendreProduits(tousLesProduits);
    } catch (e) {
        container.innerHTML = "<p>Erreur de connexion...</p>";
    }
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
                <p class="desc">${p.Description}</p>
                <button onclick="commanderWhatsApp('${p.Nom.replace(/'/g, "\\'")}', ${p.Prix})">
                    <i class="fas fa-shopping-cart"></i> ACHETER
                </button>
            </div>
        </div>
    `).join('');
}

// 2. GESTION DU COMPTE (LocalStorage)
// Cette fonction permet d'enregistrer les infos du client sur son propre téléphone
function gererCompte() {
    const nomExistant = localStorage.getItem('saferun_nom') || "";
    const quartierExistant = localStorage.getItem('saferun_quartier') || "";

    const nouveauNom = prompt("Votre Nom complet pour les livraisons :", nomExistant);
    const nouveauQuartier = prompt("Votre Quartier (ex: Itaosy, Ivato...) :", quartierExistant);

    if (nouveauNom && nouveauQuartier) {
        localStorage.setItem('saferun_nom', nouveauNom);
        localStorage.setItem('saferun_quartier', nouveauQuartier);
        alert("✅ Informations enregistrées ! Vos prochaines commandes seront instantanées.");
    }
}

// Associer la fonction au bouton Compte du HTML
document.querySelector('.icon-item:first-child').onclick = gererCompte;

// 3. LA MÉTHODE D'ACHAT WHATSAPP
function commanderWhatsApp(nomProduit, prixProduit) {
    const numeroWA = "261382453610";
    
    // On récupère les infos si elles existent dans la mémoire du téléphone
    const clientNom = localStorage.getItem('saferun_nom') || "[À COMPLÉTER]";
    const clientQuartier = localStorage.getItem('saferun_quartier') || "[À COMPLÉTER]";
    
    const prixF = prixProduit ? `${prixProduit.toLocaleString()} Ar` : "à confirmer";

    const message = `Bonjour SafeRun Market ! 🛒\n\n` +
                    `📦 *PRODUIT :* ${nomProduit}\n` +
                    `💰 *PRIX :* ${prixF}\n\n` +
                    `--- INFOS LIVRAISON ---\n` +
                    `👤 *NOM :* ${clientNom}\n` +
                    `📍 *QUARTIER :* ${clientQuartier}\n` +
                    `---------------------------\n\n` +
                    `Merci de me confirmer la livraison.`;

    const url = `https://wa.me/${numeroWA}?text=${encodeURIComponent(message)}`;
    
    // Si le client n'a jamais rempli son compte, on lui suggère de le faire
    if(clientNom === "[À COMPLÉTER]") {
        alert("💡 Conseil : Cliquez sur l'icône 'Compte' plus tard pour ne plus avoir à remplir vos infos !");
    }

    window.open(url, '_blank');
}

// Recherche
document.getElementById('search').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const filtrés = tousLesProduits.filter(p => p.Nom.toLowerCase().includes(val) || p.Categorie.toLowerCase().includes(val));
    rendreProduits(filtrés);
});

chargerBoutique();