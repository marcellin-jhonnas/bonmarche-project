const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";

// Variable pour stocker les produits en mémoire (évite de recharger la base à chaque recherche)
let tousLesProduits = [];

/**
 * Charge les produits depuis Google Sheets
 */
async function chargerBoutique() {
    const container = document.getElementById('boutique');
    try {
        const reponse = await fetch(API_URL);
        tousLesProduits = await reponse.json();
        
        if (tousLesProduits.length === 0) {
            container.innerHTML = "<p>Aucun produit disponible pour le moment.</p>";
            return;
        }

        rendreProduits(tousLesProduits);
    } catch (e) {
        container.innerHTML = "<div style='padding:20px; color:red;'>⚠️ Erreur de connexion à SafeRun Database. Vérifiez votre connexion internet.</div>";
        console.error("Erreur de chargement:", e);
    }
}

/**
 * Affiche les produits dans l'interface avec le design attrayant
 * @param {Array} liste - Liste des produits à afficher
 */
function rendreProduits(liste) {
    const container = document.getElementById('boutique');
    
    container.innerHTML = liste.map(p => `
        <div class="carte-produit">
            <div class="prix-badge">${p.Prix.toLocaleString()} Ar</div>
            
            <img src="${p.Image_URL || 'https://via.placeholder.com/200'}" alt="${p.Nom}">
            
            <div style="padding:15px;">
                <h3 style="margin: 0 0 10px 0; font-size: 1.1rem;">${p.Nom}</h3>
                <p style="color:#7f8c8d; font-size:0.85rem; height: 40px; overflow: hidden;">
                    ${p.Description || 'Qualité garantie par SafeRunMarket'}
                </p>
                
                <button onclick="ajouterAuPanier('${p.Nom.replace(/'/g, "\\'")}', ${p.Prix})">
                    <i class="fas fa-cart-plus"></i> AJOUTER AU PANIER
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Gère la recherche en temps réel
 */
const inputRecherche = document.getElementById('search');
if (inputRecherche) {
    inputRecherche.addEventListener('input', (e) => {
        const recherche = e.target.value.toLowerCase();
        const filtres = tousLesProduits.filter(p => 
            p.Nom.toLowerCase().includes(recherche) || 
            (p.Description && p.Description.toLowerCase().includes(recherche))
        );
        rendreProduits(filtres);
    });
}

/**
 * Fonction Panier (À améliorer plus tard vers WhatsApp)
 */
function ajouterAuPanier(nom) {
    const numeroWhatsApp = "261382453610"; // Ton numéro sans le +
    const message = `Bonjour SafeRun Market ! 🛒\nJe souhaite commander le produit suivant :\n- *${nom}*\n\nPourriez-vous me confirmer la disponibilité et le délai de livraison ? Merci !`;
    
    // Encode le message pour l'URL
    const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(message)}`;
    
    // Ouvre WhatsApp dans un nouvel onglet
    window.open(urlWhatsApp, '_blank');
}

// Lancement du chargement au démarrage
chargerBoutique();