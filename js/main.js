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

        // SAUVEGARDE DANS L'HISTORIQUE LOCAL
        const historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
        historique.push({
            id: Date.now(),
            date: new Date().toLocaleString('fr-FR'),
            produits: commandeData.produits,
            total: commandeData.total,
            statut: "En préparation"
        });
        localStorage.setItem('saferun_commandes', JSON.stringify(historique));
        
        // 2. RÉINITIALISATION DU BADGE (REDEVIENT ROUGE)
        localStorage.setItem('livraison_vue', 'false');
        mettreAJourBadgeLivraison();

        // 3. FERMER LA SIDEBAR (Pour libérer l'écran et voir le succès)
        const sidebar = document.getElementById('user-sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }

        // 4. AFFICHAGE DU SUCCÈS (Forcé au milieu via ton nouveau CSS)
        const modalContent = document.querySelector('#modal-panier .popup-content');
        if (modalContent) {
            modalContent.innerHTML = `
                <div style="text-align:center; padding:20px;">
                    <div style="font-size:60px; color:#27ae60; margin-bottom:15px;"><i class="fas fa-check-circle"></i></div>
                    <h2 style="margin-bottom:10px;">Merci ${localStorage.getItem('saferun_nom')} !</h2>
                    <p>Votre commande est enregistrée.</p>
                    <button onclick="location.reload();" class="btn-inscription" style="width:100%; margin-top:20px;">RETOUR À LA BOUTIQUE</button>
                </div>`;
        }
        
        // RÉINITIALISATION DU PANIER
        panier = [];
        mettreAJourBadge();

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
    mettreAJourBadgeLivraison();
    // --- À INSERER VERS LA LIGNE 251 ---
    const historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
    if (historique.length > 0) {
        setTimeout(() => {
            const sidebar = document.getElementById('user-sidebar');
            if (sidebar && !sidebar.classList.contains('open')) toggleSidebar();
        }, 1500); 
    }
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

function ouvrirLivraisons() {
    localStorage.setItem('livraison_vue', 'true');
    mettreAJourBadgeLivraison();
    const modal = document.getElementById('modal-livraisons');
    const container = document.getElementById('liste-livraisons');
    const historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");

    if (modal) {
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add('show'), 10);
    }

    if (historique.length === 0) {
        container.innerHTML = "<p style='color: #666;'>Aucune commande en cours.</p>";
    } else {
        container.innerHTML = historique.reverse().map(cmd => `
            <div style="background: #f9f9f9; border-left: 4px solid var(--orange); padding: 10px; margin-bottom: 10px; border-radius: 5px; font-size: 0.85rem;">
                <div style="display: flex; justify-content: space-between; font-weight: bold;">
                    <span>📦 Commande #${cmd.id.toString().slice(-4)}</span>
                    <span style="color: var(--orange);">${cmd.statut}</span>
                </div>
                <div style="margin-top: 5px; color: #555;">${cmd.produits}</div>
                <div style="margin-top: 5px; font-weight: bold;">Total: ${cmd.total.toLocaleString()} Ar</div>
                <div style="font-size: 0.7rem; color: #999; margin-top: 5px;">Passée le : ${cmd.date}</div>
            </div>
        `).join('');
    }
    
    if(typeof toggleSidebar === 'function') {
        const sidebar = document.getElementById('user-sidebar');
        if(sidebar && sidebar.classList.contains('open')) toggleSidebar();
    }
}

function fermerLivraisons() {
    const modal = document.getElementById('modal-livraisons');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = "none", 300);
    }
}

function viderHistorique() {
    if(confirm("Voulez-vous effacer l'historique de vos livraisons ?")) {
        localStorage.removeItem('saferun_commandes');
        mettreAJourBadgeLivraison();
        ouvrirLivraisons(); // Rafraîchit l'affichage
    }
}
function mettreAJourBadgeLivraison() {
    const badge = document.getElementById('badge-livraison');
    if (!badge) return;

    const historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
    const dejaVu = localStorage.getItem('livraison_vue') === 'true';
    
    if (historique.length > 0) {
        badge.innerText = historique.length;
        badge.style.display = "inline-block";

        if (dejaVu) {
            badge.classList.add('lu');
            badge.classList.remove('pulse-alerte');
            badge.style.backgroundColor = "#bdc3c7"; // Gris
        } else {
            badge.classList.remove('lu');
            badge.classList.add('pulse-alerte');
            badge.style.backgroundColor = "#ff3b30"; // Rouge
        }
    } else {
        badge.style.display = "none";
    }
}
function fermerModal() {
    const modal = document.getElementById('modal-panier');
    if(modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = "none", 300);
    }
}