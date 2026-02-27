if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SafeRun PWA prête !'))
      .catch(err => console.log('Erreur PWA', err));
  });
}
// --- CONFIGURATION DES PONTS GOOGLE ---
// Ce lien sert à LIRE tes produits
const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";

// Ce lien sert à ENVOYER la commande et PAYER (Ton dernier déploiement)
const SCRIPT_PAYS_URL = "https://script.google.com/macros/s/AKfycbV7YHbxOYUzgFN-ji7yjamKnwJdrIZU2PuJVClrPWFra5Us69gyUK8sklpvi0mX5Ew/exec";
let datePlanifiee = null; 
let rdvData = null;       
let tousLesProduits = [];
let panier = JSON.parse(localStorage.getItem('saferun_panier')) || [];
mettreAJourBadge(); // Pour afficher le nombre dès l'ouverture

// 1. CHARGEMENT
async function chargerBoutique() {
    const loader = document.getElementById('loading-placeholder');
    const boutique = document.getElementById('boutique');

    try {
        // 1. On s'assure que le loader est visible au début
        if (loader) loader.style.display = 'grid';
        if (boutique) boutique.style.opacity = '0'; // On prépare l'apparition douce

        const response = await fetch(API_URL);
        tousLesProduits = await response.json();
        
        // 2. On génère les produits (mais ils sont encore invisibles)
        rendreProduits(tousLesProduits);

        // 3. On cache le skeleton et on montre la boutique avec élégance
        setTimeout(() => {
            if (loader) {
                loader.style.transition = "opacity 0.5s ease";
                loader.style.opacity = "0";
                
                setTimeout(() => {
                    loader.style.display = 'none';
                    if (boutique) {
                        boutique.style.display = 'grid';
                        // Petit délai pour l'effet de fondu (Fade-in)
                        setTimeout(() => boutique.style.opacity = '1', 50);
                    }
                }, 500);
            }
        }, 800); // On laisse le skeleton 0.8s pour un effet visuel pro

    } catch (e) { 
        console.error("Erreur de chargement", e); 
        if (loader) loader.style.display = 'none';
        if (boutique) {
            boutique.style.display = 'block';
            boutique.style.opacity = '1';
            boutique.innerHTML = "<p style='text-align:center; padding:20px;'>⚠️ Impossible de charger les produits. Vérifiez votre connexion.</p>";
        }
    }
}

function rendreProduits(liste) {
    const container = document.getElementById('boutique');
    if (!container) return;
    
    const loader = document.getElementById('loading-placeholder');
    if (loader) loader.style.display = 'none';
    container.style.display = 'grid';

    if (liste.length === 0) {
        container.innerHTML = "<p style='padding:20px;'>Aucun produit trouvé.</p>";
        return;
    }

    container.innerHTML = liste.map(p => {
        const nomPropre = p.Nom.replace(/'/g, "\\'");
        // Génère un nombre de likes aléatoire entre 12 et 48 pour faire "vivant"
        const likesAleatoires = Math.floor(Math.random() * 37) + 12;

        return `
        <div class="carte-produit">
            <div class="prix-badge">${Number(p.Prix).toLocaleString()} Ar</div>
            <img src="${p.Image_URL}" alt="${p.Nom}" onerror="this.src='https://via.placeholder.com/150?text=SafeRun'">
            <div style="padding:15px;">
                <span class="cat-tag">${p.Categorie || 'Essentiel'}</span>
                <h3>${p.Nom}</h3>
                
                <div class="interaction-bar" style="display: flex; gap: 15px; padding: 10px 0; border-top: 1px solid #f0f0f0; margin: 10px 0;">
                    <div class="btn-interaction" onclick="actionLike(this)" style="cursor:pointer; display:flex; align-items:center; gap:5px; color:#666; font-size:0.85rem;">
                        <i class="far fa-heart"></i>
                        <span class="txt-like">J'aime</span>
                        <span class="nb-likes" style="opacity:0.6;">${likesAleatoires}</span>
                    </div>
                    <div class="btn-interaction" onclick="actionCommentaire('${nomPropre}')" style="cursor:pointer; display:flex; align-items:center; gap:5px; color:#666; font-size:0.85rem;">
                        <i class="far fa-comment"></i>
                        <span>Commenter</span>
                    </div>
                </div>

                <button class="btn-commander" onclick="ajouterAuPanier('${nomPropre}', ${p.Prix})" style="width:100%; padding:12px; border-radius:12px; background:linear-gradient(135deg, #ffcc00, #ff9900); border:none; font-weight:700; cursor:pointer; color:#1a1a1a;">
                    <i class="fas fa-cart-plus"></i> AJOUTER AU PANIER
                </button>
            </div>
        </div>
    `}).join('');
}

// AJOUTE CES DEUX FONCTIONS TOUT EN BAS DE TON main.js
function actionLike(element) {
    const icon = element.querySelector('i');
    const span = element.querySelector('span');
    
    if (icon.classList.contains('far')) {
        // ACTIVER : Rouge et Gras
        icon.classList.replace('far', 'fas');
        icon.style.color = "#ff3b30";
        span.style.fontWeight = "bold";
        span.style.color = "#1a1a1a";
    } else {
        // DESACTIVER : Gris et Normal
        icon.classList.replace('fas', 'far');
        icon.style.color = "#666";
        span.style.fontWeight = "normal";
        span.style.color = "#666";
    }
}

function actionCommentaire(nom) {
    const avis = prompt("Donnez votre avis sur " + nom + " :");
    if (avis) {
        alert("Merci ! Votre avis sur " + nom + " a été envoyé.");
    }
}
// 2. PANIER
function ajouterAuPanier(nom, prix) {
    const produitExistant = panier.find(item => item.nom === nom);
    
    if (produitExistant) {
        produitExistant.quantite += 1;
    } else {
        panier.push({ nom, prix, quantite: 1 });
    }

    // Animation du panier flottant
    const cartBtn = document.querySelector('.floating-cart');
    if (cartBtn) {
        cartBtn.style.animation = "none";
        setTimeout(() => { cartBtn.style.animation = "bounce 0.5s ease-in-out"; }, 10);
    }

    // Sauvegarde immédiate dans le téléphone
    localStorage.setItem('saferun_panier', JSON.stringify(panier));

    // MISE À JOUR DES COMPTEURS (On envoie le total réel, pas la longueur)
    const totalArticles = panier.reduce((acc, item) => acc + item.quantite, 0);
    
    mettreAJourBadge(); 
    synchroniserBadges(totalArticles); // Utilise le total calculé ici !

    // Petit point rouge et vibration
    const dot = document.getElementById('cart-dot');
    if(dot) dot.style.display = 'block';

    const navCart = document.querySelector('.nav-item-m i.fa-shopping-bag');
    if(navCart) {
        navCart.style.transform = "scale(1.4)";
        setTimeout(() => { navCart.style.transform = "scale(1)"; }, 300);
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
    
    // Calcul précis du montant
    const montantTotal = panier.reduce((sum, i) => sum + (i.prix * i.quantite), 0);
    const telClient = localStorage.getItem('saferun_tel');
    
    // Sécurité si le téléphone n'existe pas
    if (!telClient) {
        alert("Veuillez entrer votre numéro de téléphone dans votre profil.");
        return;
    }

    const telNettoye = telClient.replace(/\s+/g, '').replace('+261', '0');

    if (btn && btn.tagName === 'BUTTON') {
        btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Paiement en cours...";
        btn.disabled = true;
    }

    try {
        // --- ÉTAPE : MVOLA + ENREGISTREMENT ---
        const paiementLance = await traiterPaiement(montantTotal, telNettoye);

        if (paiementLance) {
            // Sauvegarde dans l'historique local pour le client
            const historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
            historique.push({
                id: Date.now(),
                date: new Date().toLocaleString('fr-FR'),
                produits: panier.map(i => `${i.quantite}x ${i.nom}`).join(', '),
                total: montantTotal,
                statut: "En attente de paiement"
            });
            localStorage.setItem('saferun_commandes', JSON.stringify(historique));
            
            // --- LE NETTOYAGE CRITIQUE ---
            alert("Commande enregistrée ! Vérifiez votre téléphone pour confirmer le paiement Mvola.");
            
            panier = []; // Vide la variable
            localStorage.removeItem('saferun_panier'); // Vide la mémoire du téléphone
            
            if (typeof mettreAJourBadge === 'function') mettreAJourBadge();
            if (typeof synchroniserBadges === 'function') synchroniserBadges(0);

            // Rechargement pour appliquer le panier vide
            location.reload(); 
        } else {
            if (btn) {
                btn.innerHTML = "Réessayer le paiement";
                btn.disabled = false;
            }
        }
    } catch (error) {
        console.error("Erreur critique lors de l'envoi:", error);
        // En cas d'erreur réseau, on bascule sur WhatsApp
        finaliserVersWhatsApp();
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
    genererQRCodeClient();
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

// CONFIGURATION (À REMPLIR) IRETO LE CLE ROA 

// --- 7. GESTION MVOLA (SÉCURISÉE VIA GOOGLE SCRIPT) ---

async function traiterPaiement(montant, telClient) {
    // Ton URL de script Google (le pont vers MVola)
    const SCRIPT_PAYS_URL = "https://script.google.com/macros/s/AKfycbV7YHbxOYUzgFN-ji7yjamKnwJdrIZU2PuJVClrPWFra5Us69gyUK8sklpvi0mX5Ew/exec"; 

    try {
        console.log("Initialisation MVola pour:", telClient);

        // On envoie tout en un seul bloc au script Google
        await fetch(SCRIPT_PAYS_URL, {
            method: "POST",
            mode: "no-cors", // Pour GitHub Pages
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                typePaiement: "MVOLA_INIT",
                nom: localStorage.getItem('saferun_nom') || "Client",
                telClient: telClient,
                montant: String(montant),
                produits: panier.map(i => `${i.quantite}x ${i.nom}`).join(', '),
                correlationId: "SR" + Date.now()
            })
        });

        // Comme on est en "no-cors", on ne peut pas lire la réponse,
        // donc on affiche directement l'instruction au client.
        alert("📲 Demande envoyée !\n\nVeuillez saisir votre code secret MVola sur votre téléphone pour valider le paiement de " + montant + " Ar.");
        return true; 

    } catch (error) {
        console.error("Erreur de liaison script:", error);
        alert("⚠️ Erreur de connexion au service de paiement.");
        return false;
    }
}

// Note : verifierStatut n'est plus nécessaire car le client 
// reçoit directement la notification USSD sur son téléphone.

function animerBadgePanier() {
    const badge = document.getElementById('cart-count');
    badge.style.transform = "scale(1.5)";
    badge.style.backgroundColor = "#ff3b30"; // Devient rouge flash
    setTimeout(() => {
        badge.style.transform = "scale(1)";
        badge.style.backgroundColor = "var(--primary)"; // Revient au jaune
    }, 300);
}

function montrerNotificationAchat() {
    const quartiers = ["Itaosy", "Analakely", "Ivato", "Talatamaty", "Ankorondrano"];
    const quartier = quartiers[Math.floor(Math.random() * quartiers.length)];
    
    const notif = document.createElement('div');
    notif.innerHTML = `🛒 Une commande vient d'être livrée à <b>${quartier}</b>`;
    notif.style = "position:fixed; bottom:20px; left:20px; background:white; padding:12px 20px; border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,0.2); z-index:10000; border-left:5px solid #ffcc00; font-size:0.8rem; animation: slideIn 0.5s forwards;";
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = "slideOut 0.5s forwards";
        setTimeout(() => notif.remove(), 500);
    }, 4000);
}

// Lance une fausse notification après 5 secondes, puis toutes les 30 secondes
setTimeout(montrerNotificationAchat, 5000);
setInterval(montrerNotificationAchat, 30000);

// Cette fonction synchronise les deux badges automatiquement
function synchroniserBadges(nombre) {
    const badgeHaut = document.getElementById('cart-count');
    const badgeFlottant = document.getElementById('cart-count-float');
    
    if (badgeHaut) {
        badgeHaut.innerText = nombre;
        badgeHaut.style.display = nombre > 0 ? "block" : "none";
    }
    
    if (badgeFlottant) {
        badgeFlottant.innerText = nombre;
        badgeFlottant.style.display = nombre > 0 ? "block" : "none";
    }
}

// Fonction pour le Like (Rouge + Gras)
// Gère le Like (Rouge + Gras + Compteur)
function actionLike(element) {
    const icon = element.querySelector('i');
    const txt = element.querySelector('.txt-like');
    const count = element.querySelector('.nb-likes');
    let nb = parseInt(count.innerText);
    
    if (icon.classList.contains('far')) {
        // ACTIVER
        icon.classList.replace('far', 'fas');
        icon.style.color = "#ff3b30";
        txt.style.fontWeight = "bold";
        txt.style.color = "#1a1a1a";
        count.innerText = nb + 1;
        count.style.color = "#ff3b30";
        element.style.transform = "scale(1.1)";
        setTimeout(() => element.style.transform = "scale(1)", 200);
    } else {
        // DESACTIVER
        icon.classList.replace('fas', 'far');
        icon.style.color = "#666";
        txt.style.fontWeight = "normal";
        txt.style.color = "#666";
        count.innerText = nb - 1;
        count.style.color = "#666";
    }
}

// Gère le commentaire via WhatsApp (Plus efficace pour vendre)
function actionCommentaire(nomProduit) {
    const avis = prompt(`Qu'en pensez-vous de : ${nomProduit} ?`);
    if (avis && avis.trim() !== "") {
        const tel = "261382453610"; // Ton numéro WhatsApp
        const msg = `Bonjour SafeRun ! Voici mon avis sur le produit *${nomProduit}* : \n\n"${avis}"`;
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
    }
}
// --- GESTION DE LA BARRE DE NAVIGATION MOBILE ---
document.querySelectorAll('.nav-item-m').forEach(item => {
    item.addEventListener('click', function() {
        // 1. Retirer la classe 'active-m' de tous les boutons
        document.querySelectorAll('.nav-item-m').forEach(nav => nav.classList.remove('active-m'));
        
        // 2. Ajouter la classe 'active-m' uniquement sur celui cliqué
        this.classList.add('active-m');
    });
});
// Détection du scroll pour animer le header
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});
/* ==========================================================
   NOUVEAU : GESTION DU HERO DYNAMIQUE (5 IMAGES + TEXTES)
   ========================================================== */

const heroData = [
    {
        img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?q=80&w=2000',
        badge: "🌻 Cuisine",
        title: "HUILES ET MATIÈRES GRASSES",
        desc: "L'essentiel pour vos cuissons au meilleur prix du marché."
    },
    {
        img: 'https://images.unsplash.com/photo-1552829722-b5939e1f414f?q=80&w=2000',
        badge: "💧 Hydratation",
        title: "CRISTALINE & EAU DE SOURCE",
        desc: "Restez hydraté ! Vos packs livrés directement à l'étage."
    },
    {
        img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?q=80&w=2000',
        badge: "🍚 Essentiel",
        title: "LE MEILLEUR RIZ GASY",
        desc: "La base de votre alimentation, sélectionnée avec soin."
    },
    {
        img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2000',
        badge: "🥫 Épicerie",
        title: "CONSERVES ET PPN",
        desc: "Tout votre stock de provisions livré en moins de 2h."
    },
    {
        img: 'https://images.unsplash.com/photo-1488459711615-22823943807b?q=80&w=2000',
        badge: "🍎 Fraîcheur",
        title: "FRUITS ET LÉGUMES FRAIS",
        desc: "Le goût du marché d'Anosibe, sans bouger de chez vous."
    }
];

let currentHeroIdx = 0; // Changé le nom pour éviter tout conflit

function updateHeroAnimate() {
    const heroSection = document.getElementById('hero-slider');
    const title = document.getElementById('hero-title');
    const desc = document.getElementById('hero-desc');
    const badge = document.getElementById('hero-badge');

    if (!heroSection || !title || !desc || !badge) return;

    // 1. Sortie (disparition douce)
    title.style.opacity = "0";
    desc.style.opacity = "0";
    badge.style.opacity = "0";

    setTimeout(() => {
        currentHeroIdx = (currentHeroIdx + 1) % heroData.length;
        const current = heroData[currentHeroIdx];

        // 2. Mise à jour du contenu
        heroSection.style.setProperty('--bg-image', `url('${current.img}')`);
        badge.innerText = current.badge;
        title.innerText = current.title;
        desc.innerText = current.desc;

        // 3. Entrée (apparition douce)
        title.style.opacity = "1";
        desc.style.opacity = "1";
        badge.style.opacity = "1";
    }, 600);
}

// Lancer l'animation toutes les 5 secondes
setInterval(updateHeroAnimate, 5000);

function genererQRCodeClient() {
    const nom = localStorage.getItem('saferun_nom');
    const tel = localStorage.getItem('saferun_tel');
    const container = document.getElementById('qrcode-container');
    const qrcodeDiv = document.getElementById('qrcode');

    if (nom && tel) {
        // On vide l'ancien QR code s'il existe
        qrcodeDiv.innerHTML = "";
        
        // On crée les données du client (format JSON simple)
        const donneesClient = `SafeRun-${tel}-${nom}`;

        // On génère le nouveau QR Code
        new QRCode(qrcodeDiv, {
            text: donneesClient,
            width: 120,
            height: 120,
            colorDark : "#1a1a1a",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });

        // On affiche le conteneur
        container.style.display = "block";
    } else {
        container.style.display = "none";
    }
}
const CACHE_NAME = 'saferun-v1';
const assets = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/main.js'
];

// Installation : Mise en cache des fichiers
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(assets);
    })
  );
});

// Intercepter les requêtes pour servir le cache
self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(response => {
      return response || fetch(evt.request);
    })
  );
});