const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";
let datePlanifiee = null; 
let rdvData = null;       
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
    const btn = (window.event && window.event.target) ? window.event.target : null;
    if (btn && btn.tagName === 'BUTTON') {
        btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Envoi...";
        btn.disabled = true;
    }

    const commandeData = {
        nom: localStorage.getItem('saferun_nom'),
        tel: localStorage.getItem('saferun_tel'),
        quartier: localStorage.getItem('saferun_quartier'),
        produits: panier.map(i => `${i.quantite}x ${i.nom}`).join(', '),
        total: panier.reduce((sum, i) => sum + (i.prix * i.quantite), 0),
        date: new Date().toLocaleString('fr-FR'),
        type: rdvData ? "RENDEZ-VOUS" : (datePlanifiee ? "PLANIFIÉ" : "DIRECT"),
        planif: rdvData 
                 ? `RDV le ${rdvData.date} ${rdvData.heure}` 
                 : (datePlanifiee ? datePlanifiee : "ASAP (Dès que possible)")
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(commandeData)
        });

        const modalContent = document.querySelector('#modal-panier .popup-content');
        if (modalContent) {
            modalContent.innerHTML = `
                <div style="text-align:center; padding:20px;">
                    <div style="font-size:60px; color:#27ae60; margin-bottom:15px;"><i class="fas fa-check-circle"></i></div>
                    <h2>Merci !</h2>
                    <p>Commande transmise avec succès.</p>
                    <button onclick="location.reload();" class="btn-inscription" style="width:100%; margin-top:15px;">RETOUR</button>
                </div>`;
        }
        panier = [];
        datePlanifiee = null;
        rdvData = null;
    } catch (error) {
        console.error("Erreur:", error);
        finaliserVersWhatsApp();
    }
}

function finaliserVersWhatsApp() {
    const message = `Commande SafeRun :\n${panier.map(i => `- ${i.quantite}x ${i.nom}`).join('\n')}`;
    window.open(`https://wa.me/261382453610?text=${encodeURIComponent(message)}`, '_blank');
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

    if (nom) {
        document.getElementById('side-user-nom').innerText = nom;
        document.getElementById('user-initials').innerText = nom.charAt(0).toUpperCase();
    }
    
    // Correction de l'affichage du téléphone et quartier
    const elTel = document.getElementById('side-user-tel');
    if (elTel) {
        elTel.innerHTML = tel ? `<i class="fas fa-phone"></i> ${tel}` : `<i class="fas fa-phone"></i> Non renseigné`;
    }
    
    const elQuartier = document.getElementById('side-user-quartier');
    if (elQuartier) {
        elQuartier.innerHTML = quartier ? `<i class="fas fa-map-marker-alt"></i> ${quartier}` : `<i class="fas fa-map-marker-alt"></i> Quartier non renseigné`;
    }
}

function ouvrirInscription() {
    const popup = document.getElementById('welcome-popup');
    if (popup) popup.classList.remove('show');

    const prevNom = localStorage.getItem('saferun_nom') || "";
    const prevTel = localStorage.getItem('saferun_tel') || "";
    const prevQuartier = localStorage.getItem('saferun_quartier') || "";

    let n = prompt("Nom complet :", prevNom);
    if (n === null) return;
    
    let t = prompt("Téléphone :", prevTel);
    if (t === null) return;

    let q = prompt("Quartier :", prevQuartier);
    if (q === null) return;

    if (n.trim() && t.trim() && q.trim()) {
        localStorage.setItem('saferun_nom', n.trim());
        localStorage.setItem('saferun_tel', t.trim());
        localStorage.setItem('saferun_quartier', q.trim());
        rafraichirSidebar();
        alert("✨ Profil mis à jour !");
    } else {
        alert("Tous les champs sont obligatoires.");
    }
}

// 6. RDV ET PLANIF
function ouvrirRdv() {
    const modal = document.getElementById('modal-rdv');
    if (modal) {
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add('show'), 10);
    }
    const sidebar = document.getElementById('user-sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

function fermerRdv() {
    const modal = document.getElementById('modal-rdv');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = "none", 300);
    }
}

function envoyerRdv() {
    const nom = document.getElementById('rdv-nom').value;
    const tel = document.getElementById('rdv-tel').value;
    const date = document.getElementById('rdv-date').value;
    if(!nom || !tel || !date){ alert("Champs obligatoires manquants"); return; }
    rdvData = { nom, tel, date, heure: document.getElementById('rdv-heure').value, type: "RENDEZ-VOUS" };
    fermerRdv();
    alert("✅ Rendez-vous enregistré !");
}

function ouvrirPlanification(titre) {
    const modal = document.getElementById('modal-planification');
    if (modal) {
        document.getElementById('planif-titre').innerText = titre;
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add('show'), 10);
    }
    const sidebar = document.getElementById('user-sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

function fermerPlanif() {
    const modal = document.getElementById('modal-planification');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = "none", 300);
    }
}

function sauvegarderPlanif() {
    const dateInput = document.getElementById('date-planif').value;
    if(!dateInput) { alert("Veuillez choisir une date !"); return; }
    datePlanifiee = dateInput;
    document.getElementById('date-affichage').innerText = new Date(datePlanifiee).toLocaleString('fr-FR');
    document.getElementById('status-planif').style.display = "block";
    fermerPlanif();
}

function annulerPlanif() {
    datePlanifiee = null;
    document.getElementById('status-planif').style.display = "none";
}

// 7. INIT
document.addEventListener('DOMContentLoaded', () => {
    chargerBoutique();
    rafraichirSidebar();
    
    const searchBar = document.getElementById('search');
    if(searchBar) {
        searchBar.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            rendreProduits(tousLesProduits.filter(p => p.Nom.toLowerCase().includes(val)));
        });
    }

    setInterval(() => {
        const estInscrit = localStorage.getItem('saferun_nom');
        const popup = document.getElementById('welcome-popup');
        if (!estInscrit && popup && !popup.classList.contains('show')) {
            popup.classList.add('show');
        }
    }, 10000); 
});

function contacterAssistance() {
    const numeroWA = "261382453610";
    const nom = localStorage.getItem('saferun_nom') || "Client";
    const quartier = localStorage.getItem('saferun_quartier') || "non précisé";
    const message = `Bonjour SafeRun ! 👋\n\nJe suis *${nom}* du quartier de *${quartier}*.\nJ'aurais besoin d'une assistance concernant le marché en ligne.`;
    if(typeof toggleSidebar === 'function') toggleSidebar();
    window.open(`https://wa.me/${numeroWA}?text=${encodeURIComponent(message)}`, '_blank');
}