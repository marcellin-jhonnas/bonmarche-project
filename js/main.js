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
        const container = document.getElementById('boutique');
        if(container) container.innerHTML = "<p>Erreur de chargement des produits...</p>";
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
        panier.push({ nom, prix, quantite: 1 });
    }
    
    // Animation du badge
    const badge = document.getElementById('cart-count');
    if(badge) {
        badge.style.transform = "scale(1.3)";
        setTimeout(() => badge.style.transform = "scale(1)", 200);
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
    if (window.event) window.event.currentTarget.classList.add('active');

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

// 4. COMMANDE ET ENVOI
async function envoyerCommande() {
    if (panier.length === 0) { alert("Votre panier est vide !"); return; }
    const estInscrit = localStorage.getItem('saferun_nom');

    if (!estInscrit) {
        alert("Pour commander, merci de compléter votre profil !");
        ouvrirInscription(); 
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

    detail.innerHTML = `<strong>Récapitulatif de votre commande</strong><hr>${resume}`;
    totalLabel.innerText = total.toLocaleString() + " Ar";
    
    const btnEnvoi = modal.querySelector('.btn-inscription');
    btnEnvoi.innerHTML = "🚀 CONFIRMER LA COMMANDE";
    btnEnvoi.onclick = envoyerDonneesAuSheet;

    modal.style.display = "flex";
    setTimeout(() => modal.classList.add('show'), 10);
}

async function envoyerDonneesAuSheet() {
    const btn = window.event.target;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Envoi au serveur...";
    btn.disabled = true;

    // On prépare les données avec la date de planification si elle existe
    const commandeData = {
        nom: localStorage.getItem('saferun_nom'),
        tel: localStorage.getItem('saferun_tel'),
        quartier: localStorage.getItem('saferun_quartier'),
        produits: panier.map(i => `${i.quantite}x ${i.nom}`).join(', '),
        total: panier.reduce((sum, i) => sum + (i.prix * i.quantite), 0),
        date: new Date().toLocaleString(),
        // On utilise la variable globale datePlanifiee
        type: datePlanifiee ? "PLANIFIÉ" : "DIRECT",
        planif: datePlanifiee ? new Date(datePlanifiee).toLocaleString('fr-FR') : "Dès que possible (ASAP)"
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(commandeData)
        });

        const modalContent = document.querySelector('#modal-panier .popup-content');
        modalContent.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <div style="font-size:60px; color:#27ae60; margin-bottom:15px;"><i class="fas fa-check-circle"></i></div>
                <h2 style="color:#2c3e50;">Merci !</h2>
                <p>Votre commande <strong>${commandeData.type}</strong> a été transmise.</p>
                ${datePlanifiee ? `<p style="background:#e8f4fd; padding:10px; border-radius:8px;">📅 Prévue pour : <b>${commandeData.planif}</b></p>` : ''}
                <button onclick="location.reload();" class="btn-inscription" style="width:100%; background:var(--orange); margin-top:15px;">
                    RETOUR À LA BOUTIQUE
                </button>
            </div>
        `;

        panier = [];
        datePlanifiee = null; // On réinitialise pour la prochaine fois
        mettreAJourBadge();

    } catch (error) {
        console.error("Erreur:", error);
        finaliserVersWhatsApp();
    }
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

function fermerModal() {
    const modal = document.getElementById('modal-panier');
    if(modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = "none", 300);
    }
}

// 5. SIDEBAR ET POPUP
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

function ouvrirInscription() {
    const popup = document.getElementById('welcome-popup');
    if (popup) popup.classList.remove('show');
    
    setTimeout(() => {
        let n = prompt("Votre Nom complet :", localStorage.getItem('saferun_nom') || "");
        let t = prompt("Votre Numéro de téléphone :", localStorage.getItem('saferun_tel') || "");
        let q = prompt("Votre Quartier :", localStorage.getItem('saferun_quartier') || "");

        if (n && t && q) {
            localStorage.setItem('saferun_nom', n.trim());
            localStorage.setItem('saferun_tel', t.trim());
            localStorage.setItem('saferun_quartier', q.trim());
            rafraichirSidebar();
            alert("✨ Profil mis à jour !");
        }
    }, 400);
}

// 6. INIT
document.addEventListener('DOMContentLoaded', () => {
    chargerBoutique();
    rafraichirSidebar();

    // Bouton Compte
    const compteBtn = document.querySelector('.fa-user');
    if (compteBtn) {
        compteBtn.parentElement.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSidebar();
        });
    }

    // Bouton Panier (Cart Trigger)
    const cartTrigger = document.querySelector('.cart-trigger');
    if (cartTrigger) {
        cartTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            envoyerCommande();
        });
    }

    // Barre de recherche
    const searchBar = document.getElementById('search');
    if(searchBar) {
        searchBar.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const filtrés = tousLesProduits.filter(p => p.Nom.toLowerCase().includes(val));
            rendreProduits(filtrés);
        });
    }

    // Popup initiale
    if (!localStorage.getItem('saferun_nom')) {
        setTimeout(() => {
            const popup = document.getElementById('welcome-popup');
            if (popup) popup.classList.add('show');
        }, 3000); 
    }
});

let datePlanifiee = null;

function ouvrirPlanification(titre) {
    const modal = document.getElementById('modal-planification');
    if (modal) {
        document.getElementById('planif-titre').innerText = titre;
        modal.style.display = "flex"; // On utilise flex pour le centrage
        
        // On ferme la sidebar automatiquement pour voir le modal
        const sidebar = document.getElementById('user-sidebar');
        if (sidebar) sidebar.classList.remove('open');
    }
}

function fermerPlanif() {
    document.getElementById('modal-planification').style.display = "none";
}

function sauvegarderPlanif() {
    const dateInput = document.getElementById('date-planif').value;
    if(!dateInput) { alert("Veuillez choisir une date !"); return; }
    
    datePlanifiee = dateInput; // On stocke la date
    
    // On affiche le badge bleu en haut
    const statusDiv = document.getElementById('status-planif');
    const dateSpan = document.getElementById('date-affichage');
    
    if(statusDiv && dateSpan) {
        dateSpan.innerText = new Date(datePlanifiee).toLocaleString('fr-FR');
        statusDiv.style.display = "block"; // On montre le badge
    }
    
    fermerPlanif();
}

// Fonction pour annuler la planification si le client change d'avis
function annulerPlanif() {
    datePlanifiee = null;
    document.getElementById('status-planif').style.display = "none";
}

// MODIFIER LA FONCTION envoyerDonneesAuSheet pour inclure la date
// Dans le bloc 'commandeData' de ton main.js, modifie comme ceci :
const commandeData = {
    // ... tes autres données ...
    planif: datePlanifiee || "ASAP (Dès que possible)", // Ajoute cette ligne
    type: datePlanifiee ? "PLANIFIÉ" : "DIRECT"
};