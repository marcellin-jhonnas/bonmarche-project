const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";
let tousLesProduits = [];
let panier = [];
let datePlanifiee = null; // Variable globale pour la date choisie

// 1. CHARGEMENT DE LA BOUTIQUE
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

// 2. GESTION DU PANIER
function ajouterAuPanier(nom, prix) {
    const produitExistant = panier.find(item => item.nom === nom);
    if (produitExistant) {
        produitExistant.quantite += 1;
    } else {
        panier.push({ nom, prix, quantite: 1 });
    }
    
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

// 3. FILTRAGE ET RECHERCHE
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

// 4. PLANIFICATION (RENDEZ-VOUS / ACHAT PLANIFIÉ)
function ouvrirPlanification(titre) {
    const modal = document.getElementById('modal-planification');
    if (modal) {
        document.getElementById('planif-titre').innerText = titre;
        modal.style.display = "flex";
        toggleSidebar(); // On ferme la sidebar
    }
}

function fermerPlanif() {
    document.getElementById('modal-planification').style.display = "none";
}

function sauvegarderPlanif() {
    const dateInput = document.getElementById('date-planif').value;
    if(!dateInput) { alert("Veuillez choisir une date !"); return; }
    
    datePlanifiee = dateInput; 
    
    // Affichage du bandeau de confirmation en haut de la boutique
    const statusDiv = document.getElementById('status-planif');
    const dateSpan = document.getElementById('date-affichage');
    
    if(statusDiv && dateSpan) {
        dateSpan.innerText = new Date(datePlanifiee).toLocaleString('fr-FR');
        statusDiv.style.display = "block";
    }
    
    alert("✅ Planification enregistrée !");
    fermerPlanif();
}

function annulerPlanif() {
    datePlanifiee = null;
    const statusDiv = document.getElementById('status-planif');
    if(statusDiv) statusDiv.style.display = "none";
}

// 5. ENVOI DE LA COMMANDE
async function envoyerCommande() {
    if (panier.length === 0) { alert("Votre panier est vide !"); return; }
    if (!localStorage.getItem('saferun_nom')) {
        alert("Merci de compléter votre profil avant de commander !");
        ouvrirInscription(); 
    } else {
        ouvrirTicketAutomatique();
    }
}

function ouvrirTicketAutomatique() {
    const modal = document.getElementById('modal-panier');
    const detail = document.getElementById('detail-panier');
    const totalLabel = document.getElementById('total-modal');
    
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

    // On ajoute l'info de planification dans le résumé si elle existe
    if(datePlanifiee) {
        resume += `<div style="color:var(--orange); font-weight:bold; margin-top:10px; border-top:1px dashed #ccc; padding-top:10px;">
                    📅 LIVRAISON PLANIFIÉE : ${new Date(datePlanifiee).toLocaleString('fr-FR')}
                   </div>`;
    }

    detail.innerHTML = `<strong>Récapitulatif</strong><hr>${resume}`;
    totalLabel.innerText = total.toLocaleString() + " Ar";
    
    const btnEnvoi = modal.querySelector('.btn-inscription');
    btnEnvoi.onclick = envoyerDonneesAuSheet;
    modal.style.display = "flex";
}

async function envoyerDonneesAuSheet() {
    const btn = window.event.target;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Envoi...";
    btn.disabled = true;

    const data = {
        nom: localStorage.getItem('saferun_nom'),
        tel: localStorage.getItem('saferun_tel'),
        quartier: localStorage.getItem('saferun_quartier'),
        produits: panier.map(i => `${i.quantite}x ${i.nom}`).join(', '),
        total: panier.reduce((sum, i) => sum + (i.prix * i.quantite), 0),
        date: new Date().toLocaleString(),
        type: datePlanifiee ? "PLANIFIÉ" : "SITE_WEB",
        planif: datePlanifiee ? new Date(datePlanifiee).toLocaleString('fr-FR') : "ASAP"
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(data)
        });

        document.querySelector('#modal-panier .popup-content').innerHTML = `
            <div style="text-align:center; padding:20px;">
                <i class="fas fa-check-circle" style="font-size:50px; color:var(--success);"></i>
                <h2>Commande reçue !</h2>
                <p>Merci ${data.nom}. Notre équipe prépare votre livraison.</p>
                <button onclick="location.reload();" class="btn-inscription" style="width:100%;">RETOUR</button>
            </div>`;
        
        panier = [];
        datePlanifiee = null;
    } catch (e) { alert("Erreur. Essayez via WhatsApp."); finaliserVersWhatsApp(); }
}

function finaliserVersWhatsApp() {
    const message = `Commande SafeRun :\n${panier.map(i => `- ${i.quantite}x ${i.nom}`).join('\n')}\nTotal: ${panier.reduce((sum, i) => sum + (i.prix * i.quantite), 0)} Ar`;
    window.open(`https://wa.me/261382453610?text=${encodeURIComponent(message)}`, '_blank');
}

// 6. PROFILS ET SIDEBAR
function toggleSidebar() {
    const sidebar = document.getElementById('user-sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

function rafraichirSidebar() {
    const nom = localStorage.getItem('saferun_nom');
    const tel = localStorage.getItem('saferun_tel');
    const quartier = localStorage.getItem('saferun_quartier');
    if (nom) document.getElementById('side-user-nom').innerText = nom;
    if (tel) document.getElementById('side-user-tel').innerHTML = `<i class="fas fa-phone"></i> ${tel}`;
    if (quartier) document.getElementById('side-user-quartier').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${quartier}`;
    if (nom) document.getElementById('user-initials').innerText = nom.charAt(0).toUpperCase();
}

function ouvrirInscription() {
    let n = prompt("Nom complet :", localStorage.getItem('saferun_nom') || "");
    let t = prompt("Téléphone :", localStorage.getItem('saferun_tel') || "");
    let q = prompt("Quartier :", localStorage.getItem('saferun_quartier') || "");
    if (n && t && q) {
        localStorage.setItem('saferun_nom', n);
        localStorage.setItem('saferun_tel', t);
        localStorage.setItem('saferun_quartier', q);
        rafraichirSidebar();
    }
}

// 7. INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
    chargerBoutique();
    rafraichirSidebar();
    
    // Recherche
    document.getElementById('search').addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        rendreProduits(tousLesProduits.filter(p => p.Nom.toLowerCase().includes(val)));
    });

    if (!localStorage.getItem('saferun_nom')) {
        setTimeout(() => document.getElementById('welcome-popup').classList.add('show'), 3000);
    }
});