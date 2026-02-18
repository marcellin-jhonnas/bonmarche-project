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

// 2. PANIER
function ajouterAuPanier(nom, prix) {
    const produitExistant = panier.find(item => item.nom === nom);
    if (produitExistant) {
        produitExistant.quantite += 1;
    } else {
        // CORRECTION ICI : quantite: 1
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

// 4. COMMANDE HYBRIDE
async function envoyerCommande() {
    if (panier.length === 0) { alert("Votre panier est vide !"); return; }
    const estInscrit = localStorage.getItem('saferun_nom');

    if (!estInscrit) {
        alert("Pour un suivi automatique, inscrivez-vous ! Redirection vers WhatsApp...");
        finaliserVersWhatsApp(); 
    } else {
        ouvrirTicketAutomatique();
    }
}

function ouvrirTicketAutomatique() {
    const modal = document.getElementById('modal-panier');
    const detail = document.getElementById('detail-panier');
    const totalLabel = document.getElementById('total-modal');
    
    if(!modal) return;

    let resume = "";
    let total = 0;
    panier.forEach(item => {
        const st = item.prix * item.quantite;
        total += st;
        resume += `<div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span>${item.quantite}x ${item.nom}</span>
                    <span>${st.toLocaleString()} Ar</span>
                   </div>`;
    });

    detail.innerHTML = `<strong>Ticket Client Privilégié</strong><hr>${resume}`;
    totalLabel.innerText = total.toLocaleString() + " Ar";
    
    const btnEnvoi = modal.querySelector('.btn-inscription');
    btnEnvoi.innerHTML = "🚀 VALIDER MA COMMANDE (AUTO)";
    btnEnvoi.onclick = envoyerDonneesAuSheet;

    modal.style.display = "flex";
    setTimeout(() => modal.classList.add('show'), 10);
}

function finaliserVersWhatsApp() {
    const numeroWA = "261382453610";
    let listeProduits = "";
    let totalGeneral = 0;
    
    panier.forEach((item) => {
        const sousTotal = item.prix * item.quantite;
        totalGeneral += sousTotal;
        listeProduits += `✅ ${item.quantite} x *${item.nom}* : ${sousTotal.toLocaleString()} Ar\n`;
    });

    const message = `Bonjour SafeRun Market ! 🛒\n\n` +
                    `Je souhaite commander :\n---------------------------\n${listeProduits}---------------------------\n` +
                    `💰 *TOTAL : ${totalGeneral.toLocaleString()} Ar*\n\n` +
                    `Merci de me recontacter !`;

    window.open(`https://wa.me/${numeroWA}?text=${encodeURIComponent(message)}`, '_blank');
}

async function envoyerDonneesAuSheet() {
    const btn = event.target;
    btn.innerText = "Traitement en cours...";
    btn.disabled = true;

    const commandeData = {
        nom: localStorage.getItem('saferun_nom'),
        tel: localStorage.getItem('saferun_tel'),
        quartier: localStorage.getItem('saferun_quartier'),
        produits: panier.map(i => `${i.quantite}x ${i.nom}`).join(', '),
        total: panier.reduce((sum, i) => sum + (i.prix * i.quantite), 0),
        date: new Date().toLocaleString(),
        type: "AUTOMATIQUE"
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(commandeData)
        });

        // Avec no-cors, on simule le succès car on ne peut pas lire la réponse
        alert("✅ Commande envoyée ! Votre ticket a été créé dans notre système.");
        panier = [];
        mettreAJourBadge();
        fermerModal();
    } catch (error) {
        console.error("Erreur:", error);
        alert("Erreur de connexion. Basculement sur WhatsApp...");
        finaliserVersWhatsApp();
    }
}

function fermerModal() {
    const modal = document.getElementById('modal-panier');
    if(modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = "none", 300);
    }
}

// 5. SIDEBAR
function toggleSidebar() {
    const sidebar = document.getElementById('user-sidebar');
    if (sidebar) sidebar.classList.toggle('open');
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
    if (nom && initialsDiv) initialsDiv.innerText = nom.charAt(0).toUpperCase();
}

// 6. POPUP
function fermerPopup() {
    const popup = document.getElementById('welcome-popup');
    if (popup) popup.classList.remove('show');
}

function ouvrirInscription() {
    fermerPopup();
    setTimeout(() => {
        let n = prompt("Votre Nom complet :", localStorage.getItem('saferun_nom') || "");
        let t = prompt("Votre Numéro de téléphone :", localStorage.getItem('saferun_tel') || "");
        let q = prompt("Votre Quartier :", localStorage.getItem('saferun_quartier') || "");

        if (n && t && q) {
            localStorage.setItem('saferun_nom', n.trim());
            localStorage.setItem('saferun_tel', t.trim());
            localStorage.setItem('saferun_quartier', q.trim());
            rafraichirSidebar();
            toggleSidebar();
            alert("✨ Profil mis à jour !");
        }
    }, 400);
}

// 7. INIT (VERSION BLINDÉE)
document.addEventListener('DOMContentLoaded', () => {
    console.log("Système SafeRun Initialisé");
    chargerBoutique();
    rafraichirSidebar();

    // Gestion du bouton Compte/Sidebar
    const compteBtn = document.querySelector('.fa-user');
    if (compteBtn) {
        compteBtn.parentElement.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSidebar();
        });
    }

    // GESTION DU PANIER (Correction du blocage)
    const cartTrigger = document.querySelector('.cart-trigger');
    if (cartTrigger) {
        cartTrigger.addEventListener('click', (e) => {
            e.preventDefault(); // Empêche tout comportement par défaut
            console.log("Clic panier détecté !");
            envoyerCommande();
        });
    } else {
        console.error("ERREUR : Bouton .cart-trigger introuvable dans le HTML");
    }

    // Gestion Recherche
    const searchBar = document.getElementById('search');
    if(searchBar) {
        searchBar.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const filtrés = tousLesProduits.filter(p => p.Nom.toLowerCase().includes(val));
            rendreProduits(filtrés);
        });
    }

    // Popup de bienvenue
    if (!localStorage.getItem('saferun_nom')) {
        setTimeout(() => {
            const popup = document.getElementById('welcome-popup');
            if (popup) popup.classList.add('show');
        }, 3000); 
    }
});