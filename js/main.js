const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";

async function afficherBoutique() {
    const container = document.getElementById('boutique');
    try {
        const reponse = await fetch(API_URL);
        const produits = await reponse.json();
        
        container.innerHTML = ""; // On vide le message de chargement

        produits.forEach(p => {
            container.innerHTML += `
                <div class="carte-produit">
                    <img src="${p.Image_URL}" width="100">
                    <h3>${p.Nom}</h3>
                    <p>${p.Description}</p>
                    <p class="prix">${p.Prix} Ar</p>
                    <button onclick="commander('${p.Nom}')">Commander</button>
                </div>
            `;
        });
    } catch (e) {
        container.innerHTML = "Erreur de connexion à la base de données.";
    }
}

afficherBoutique();
// Variable globale pour stocker les produits une fois chargés
let tousLesProduits = [];

async function afficherBoutique() {
    const response = await fetch(API_URL);
    tousLesProduits = await response.json();
    rendreProduits(tousLesProduits);
}

function rendreProduits(liste) {
    const container = document.getElementById('boutique');
    container.innerHTML = liste.map(p => `
        <div class="carte-produit">
            <div class="prix-badge">${p.Prix} Ar</div>
            <img src="${p.Image_URL}" style="width:100%; height:200px; object-fit:cover;">
            <div style="padding:15px;">
                <h3>${p.Nom}</h3>
                <p style="color:#7f8c8d; font-size:0.9rem;">${p.Description}</p>
                <button onclick="ajouterAuPanier('${p.Nom}', ${p.Prix})">AJOUTER AU PANIER</button>
            </div>
        </div>
    `).join('');
}

// Écouteur pour la recherche
document.getElementById('search').addEventListener('input', (e) => {
    const recherche = e.target.value.toLowerCase();
    const filtres = tousLesProduits.filter(p => 
        p.Nom.toLowerCase().includes(recherche) || 
        p.Description.toLowerCase().includes(recherche)
    );
    rendreProduits(filtres);
});