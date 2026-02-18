const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";
let tousLesProduits = [];
let panier = [];

// 1. CHARGEMENT DES PRODUITS
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
    if (!container) return;
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

// 2. LOGIQUE DU PANIER
function ajouterAuPanier(nom, prix) {
    const produitExistant = panier.find(item => item.nom === nom);
    if (produitExistant) {
        produitExistant.quantite += 1;
    } else {
        panier.push({ nom, prix, quantite: 1 });
    }
    mettreAJourBadge();
}

function mettreAJourBadge() {
    const badge = document.getElementById('cart-count');
    if(badge) {
        const totalArticles = panier.reduce((sum, item) => sum + item.quantite, 0);
        badge.innerText = totalArticles;
        badge.style.display = totalArticles > 0 ? "block" : "none";
    }
}

// 3. FILTRAGE
function filtrerParCategorie(categorieCible) {
    const boutons = document.querySelectorAll('.cat-btn');
    boutons.forEach(btn => btn.classList.remove('active'));
    if (event) event.currentTarget.classList.add('active');

    if (categorieCible === 'Tous') {
        rendreProduits(tousLesProduits);
    } else {
        const filtrés = tousLesProduits.filter(p => {
            const catProd = (p.Categorie || "").toString().trim().toLowerCase();
            return catProd === categorieCible.trim().toLowerCase();
        });
        rendreProduits(filtrés);
    }
}

// 4. WHATSAPP (Version amplifiée avec Téléphone)
function envoyerCommande() {
    if (panier.length === 0) { alert("Votre panier est vide !"); return; }
    const numeroWA = "261382453610";
    const clientNom = localStorage.getItem('saferun_nom') || "[À COMPLÉTER]";
    const clientTel = localStorage.getItem('saferun_tel') || "[À COMPLÉTER]";
    const clientQuartier = localStorage.getItem('saferun_quartier') || "[À COMPLÉTER]";

    let listeProduits = "";
    let totalGeneral = 0;
    panier.forEach((item) => {
        const sousTotal = item.prix * item.quantite;
        totalGeneral += sousTotal;
        listeProduits += `✅ ${item.quantite} x *${item.nom}* : ${sousTotal.toLocaleString()} Ar\n`;
    });

    const message = `Bonjour SafeRun Market ! 🛒\n\n` +
                    `Nouvelle commande de :\n---------------------------\n${listeProduits}---------------------------\n` +
                    `💰 *TOTAL À PAYER : ${totalGeneral.toLocaleString()} Ar*\n\n` +
                    `--- INFOS CLIENT ---\n👤 NOM : ${clientNom}\n📞 TEL : ${clientTel}\n📍 QUARTIER : ${clientQuartier}\n---------------------------\nJe confirme ma commande !`;
    window.open(`https://wa.me/${numeroWA}?text=${encodeURIComponent(message)}`, '_blank');
}

// 5. GESTION DU VOLET GAUCHE (SIDEBAR)
function toggleSidebar() {
    const sidebar = document.getElementById('user-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

function rafraichirSidebar() {
    const nom = localStorage.getItem('saferun_nom');
    const tel = localStorage.getItem('saferun_tel');
    const quartier = localStorage.getItem('saferun_quartier');

    const sideNom = document.getElementById('side-user-nom');
    const sideTel = document.getElementById('side-user-tel');
    const sideQuartier = document.getElementById('side-user-quartier');
    const initialsDiv = document.getElementById('user-initials');

    if (nom && sideNom) sideNom.innerText = nom;
    if (tel && sideTel) sideTel.innerHTML = `<i class="fas fa-phone"></i> ${tel}`;
    if (quartier && sideQuartier) sideQuartier.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${quartier}`;
    
    if (nom && initialsDiv) {
        initialsDiv.innerText = nom.charAt(0).toUpperCase();
    }
}

// 6. POPUP & INSCRIPTION (Version Amplifiée)
function fermerPopup() {
    const popup = document.getElementById('welcome-popup');
    if (popup) popup.classList.remove('show');
}

function ouvrirInscription() {
    fermerPopup();
    setTimeout(() => {
        let n = prompt("Votre Nom complet :", localStorage.getItem('saferun_nom') || "");
        let t = prompt("Votre Numéro de téléphone (WhatsApp) :", localStorage.getItem('saferun_tel') || "");
        let q = prompt("Votre Quartier et précisions (ex: Lot, repère) :", localStorage.getItem('saferun_quartier') || "");

        if (n && t && q) {
            localStorage.setItem('saferun_nom', n.trim());
            localStorage.setItem('saferun_tel', t.trim());
            localStorage.setItem('saferun_quartier', q.trim());
            
            rafraichirSidebar();
            toggleSidebar(); // Ouvre le volet pour montrer le résultat
            alert("✨ Profil mis à jour ! Bienvenue chez SafeRun Market.");
        }
    }, 400);
}

// 7. INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
    chargerBoutique();
    rafraichirSidebar();

    // Ouvrir la sidebar au clic sur "Compte"
    const compteBtn = document.querySelector('.fa-user').parentElement;
    if (compteBtn) compteBtn.onclick = toggleSidebar;

    const cartTrigger = document.querySelector('.cart-trigger');
    if(cartTrigger) cartTrigger.onclick = envoyerCommande;

    const searchBar = document.getElementById('search');
    if(searchBar) {
        searchBar.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const filtrés = tousLesProduits.filter(p => p.Nom.toLowerCase().includes(val));
            rendreProduits(filtrés);
        });
    }

    if (!localStorage.getItem('saferun_nom')) {
        setTimeout(() => {
            const popup = document.getElementById('welcome-popup');
            if (popup) popup.classList.add('show');
        }, 3000); 
    }
});