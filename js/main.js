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
const POURCENTAGE_LIVRAISON = 0.15; // 15% de frais de service
const MINIMUM_LIVRAISON = 3500;     // Minimum de perception (3.500 Ar)
const SEUIL_LIVRAISON_GRATUITE = 200000; // Cadeau si le client achète beaucoup (Optionnel)
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
    const containerGrille = document.getElementById('boutique');
    const containerScroll = document.getElementById('boutique-ppn'); 
    
    if (!containerGrille) return;
    
    const loader = document.getElementById('loading-placeholder');
    if (loader) loader.style.display = 'none';

    if (liste.length === 0) {
        containerGrille.innerHTML = "<p style='padding:20px;'>Aucun produit trouvé.</p>";
        if (containerScroll) containerScroll.innerHTML = "";
        return;
    }

    // On vide proprement les deux zones
    containerGrille.innerHTML = "";
    if (containerScroll) containerScroll.innerHTML = "";

    liste.forEach(p => {
        const nomPropre = p.Nom.replace(/'/g, "\\'");
        const likesAleatoires = Math.floor(Math.random() * 37) + 12;
        const prixFormatte = Number(p.Prix).toLocaleString();

        // --- GÉNÉRATION DE LA CARTE AVEC STRUCTURE PREMIUM ---
        const carteHTML = `
        <div class="carte-produit">
            <div class="prix-badge">${prixFormatte} Ar</div>
            
            <div class="img-container">
                <img src="${p.Image_URL}" alt="${p.Nom}" loading="lazy" onerror="this.src='https://via.placeholder.com/150?text=SafeRun'">
            </div>

            <div style="padding:12px;">
                <span class="cat-tag">${p.Categorie || 'Essentiel'}</span>
                <h3>${p.Nom}</h3>
                
                <div class="interaction-bar" style="display: flex; gap: 15px; padding: 8px 0; border-top: 1px solid #f8f8f8; margin: 8px 0;">
                    <div class="btn-interaction" onclick="actionLike(this)" style="cursor:pointer; display:flex; align-items:center; gap:5px; color:#666; font-size:0.75rem;">
                        <i class="far fa-heart"></i> 
                        <span class="nb-likes">${likesAleatoires}</span>
                    </div>
                    <div style="color:#eee;">|</div>
                    <div style="font-size:0.75rem; color:#999;">Top Vente</div>
                </div>

                <button class="btn-commander" onclick="ajouterAuPanier('${nomPropre}', ${p.Prix})" style="width:100%; padding:10px; border-radius:10px; background:linear-gradient(135deg, #ffcc00, #ff9900); border:none; font-weight:700; cursor:pointer; color:#1a1a1a; font-size:0.8rem;">
                    <i class="fas fa-cart-plus"></i> AJOUTER
                </button>
            </div>
        </div>`;

        // --- TRI INTELLIGENT ---
        const categorie = (p.Categorie || "").toUpperCase();
        
        if (categorie === 'PPN' && containerScroll) {
            containerScroll.insertAdjacentHTML('beforeend', carteHTML);
        } else {
            containerGrille.insertAdjacentHTML('beforeend', carteHTML);
        }
    });
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

function afficherPanier() {
    const detail = document.getElementById('detail-panier');
    const totalLabel = document.getElementById('total-modal');
    if(!detail || !totalLabel) return;

    let sousTotal = 0; 
    let resume = "";

    if (panier.length === 0) {
        resume = "<p style='text-align:center; padding:20px;'>Votre panier est vide.</p>";
    } else {
        panier.forEach((item, index) => {
            const st = item.prix * item.quantite;
            sousTotal += st; // On calcule le prix des articles
            resume += `
                <div class="item-panier-ligne" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 0.9rem;">${item.nom}</div>
                        <div style="font-size: 0.8rem; color: #666;">${item.quantite} x ${item.prix.toLocaleString()} Ar</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-weight: bold; font-size: 0.85rem;">${st.toLocaleString()} Ar</span>
                        <button onclick="supprimerProduitDirectement(${index})" style="background: #fff5f5; border: none; color: #ff4757; width: 30px; height: 30px; border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>`;
        });
    }

    // --- LE CALCUL DOIT ÊTRE ICI (APRES LA BOUCLE) ---
    let fraisLivraison = 0;
    if (sousTotal > 0) {
        let calcul15 = sousTotal * 0.15;
        fraisLivraison = Math.max(calcul15, 3500); 
        fraisLivraison = Math.ceil(fraisLivraison / 10) * 10; 
    }

    let totalFinal = sousTotal + fraisLivraison;

    // --- MISE À JOUR DE L'AFFICHAGE ---
    detail.innerHTML = `
        <strong>Récapitulatif</strong><hr>
        ${resume}
        ${sousTotal > 0 ? `
        <div style="margin-top:15px; padding:10px; background:#f9f9f9; border-radius:8px; border:1px solid #eee;">
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#666;">
                <span>Articles :</span> <span>${sousTotal.toLocaleString()} Ar</span>
            </div>
            <div style="display:flex; justify-content:space-between; color:#d35400; font-weight:bold; margin-top:5px;">
                <span>Livraison (15%) :</span> <span>+ ${fraisLivraison.toLocaleString()} Ar</span>
            </div>
        </div>` : ''}
    `;

    // Utilisation de totalFinal ici au lieu de total
    totalLabel.innerText = totalFinal.toLocaleString() + " Ar";
    
    // On garde en mémoire pour MVola
    window.dernierTotalCalcule = totalFinal;
}
// FONCTION DE SUPPRESSION
function supprimerProduitDirectement(index) {
    panier.splice(index, 1);
    localStorage.setItem('saferun_panier', JSON.stringify(panier));
    mettreAJourBadge();
    const totalArticles = panier.reduce((acc, item) => acc + item.quantite, 0);
    synchroniserBadges(totalArticles);
    afficherPanier(); // Rafraîchit la liste
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
    if(!modal) return;
    
    // Appelle la fonction qu'on vient de créer pour dessiner la liste
    afficherPanier(); 
    
    const btnEnvoi = modal.querySelector('.btn-inscription');
    if (btnEnvoi) {
        btnEnvoi.innerHTML = "🚀 CONFIRMER LA COMMANDE";
        btnEnvoi.onclick = envoyerDonneesAuSheet;
    }

    modal.style.display = "flex";
    setTimeout(() => modal.classList.add('show'), 10);
}

async function envoyerDonneesAuSheet() {
    const montantFinal = window.dernierTotalCalcule || 0;
    const nomClient = localStorage.getItem('saferun_nom') || "Client";
    const telClient = localStorage.getItem('saferun_tel');

    if (!telClient || montantFinal <= 0) {
        alert("Profil incomplet ou panier vide !");
        return;
    }

    // 1. Fermer le panier
    if (typeof fermerModal === "function") { fermerModal(); }

    // 2. Créer le Modal de Paiement
    const modalPaiement = document.createElement('div');
    modalPaiement.id = "modal-paiement-final";
    modalPaiement.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:20000; display:flex; align-items:center; justify-content:center; padding:10px;";
    
    modalPaiement.innerHTML = `
        <div id="facture-container" style="background:white; padding:30px; border-radius:25px; width:100%; max-width:400px; text-align:center;">
            <img src="https://i.imgur.com/nSlqv5W.jpeg" style="width:100px; height:100px; border-radius:50%; border:3px solid #ffcc00; margin-bottom:15px;">
            <h3 style="margin:0;">Paiement Sécurisé</h3>
            <p style="font-size:0.9rem;">Envoyez <b>${montantFinal.toLocaleString()} Ar</b> à :</p>
            <p><strong>MARCELLIN JHONNAS</strong> (038 24 536 10)</p>
            
            <div style="background:#f4f4f4; padding:15px; border-radius:15px; margin:15px 0;">
                <code style="font-size:1.1rem; font-weight:bold;">#111*1*2*0382453610*${montantFinal}#</code>
            </div>

            <button id="confirm-pay-btn" style="width:100%; background:#27ae60; color:white; border:none; padding:16px; border-radius:12px; font-weight:bold; cursor:pointer;">
                J'AI ENVOYÉ LE PAIEMENT ✅
            </button>
        </div>
    `;
    document.body.appendChild(modalPaiement);

    // 3. Gérer le clic sur le bouton de validation
    document.getElementById('confirm-pay-btn').onclick = function() {
        this.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Vérification...";
        this.disabled = true;

        // Lancement de la facture après 2 secondes
        setTimeout(() => {
            genererFactureFinale(montantFinal, nomClient);
        }, 2000);
    };
}
// 5. SIDEBAR ET POPUP
function toggleSidebar() {
    // 1. On cible le corps de la page et l'icône du bouton
    const body = document.body;
    const icon = document.getElementById('menu-icon-main');

    // 2. On ajoute ou on enlève la classe 'sidebar-open' au body
    // C'est cette classe qui va déclencher le mouvement CSS du menu ET du contenu
    body.classList.toggle('sidebar-open');

    // 3. Changement d'icône dynamique pour le bouton fixe
    if (body.classList.contains('sidebar-open')) {
        // Si le menu est ouvert, l'icône devient une croix (X)
        if (icon) icon.className = "fas fa-times";
    } else {
        // Si le menu est fermé, on remet les 3 barres (Hamburger)
        if (icon) icon.className = "fas fa-bars";
    }
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
        // 1. On enregistre les données
        localStorage.setItem('saferun_nom', n.trim());
        localStorage.setItem('saferun_tel', t.trim());
        localStorage.setItem('saferun_quartier', q.trim());
        
        // 2. On met à jour la barre latérale (ton ancien code)
        rafraichirSidebar();
        
        // 3. ON AJOUTE LA MISE À JOUR DU NOM SUR LE BOUTON ICI
        if (typeof rafraichirNomUtilisateur === 'function') {
            rafraichirNomUtilisateur();
        }

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
    // --- SÉCURITÉ : Fermer le sidebar s'il est ouvert ---
    if (document.body.classList.contains('sidebar-open')) {
        toggleSidebar(); 
    }
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
    // --- SÉCURITÉ : Fermer le sidebar s'il est ouvert ---
    if (document.body.classList.contains('sidebar-open')) {
        toggleSidebar(); 
    }
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

async function traiterPaiement(montant, telClient, livraison) {
    const SCRIPT_PAYS_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec"; 

    try {
        const payload = {
            action: "nouvelleCommande", 
            nom: localStorage.getItem('saferun_nom') || "Client Site",
            telClient: telClient, 
            montant: montant, 
            produits: panier.map(i => `${i.quantite}x ${i.nom}`).join(', '),
            correlationId: "SR" + Date.now().toString().slice(-6),
            quartier: localStorage.getItem('saferun_quartier') || "Non précisé",
            livraison: livraison // <--- AJOUTÉ : l'info va maintenant vers la colonne H
        };

        console.log("Données envoyées au Sheet :", payload);

        fetch(SCRIPT_PAYS_URL, {
            method: "POST",
            mode: "no-cors", 
            cache: "no-cache",
            body: JSON.stringify(payload)
        });

        return true; 
    } catch (error) {
        console.error("Erreur d'envoi Sheet:", error);
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
// 1. Ouvrir ou fermer le menu
// 1. Ouvrir/Fermer le menu (Sécurisé)
function toggleSettings() {
    const menu = document.getElementById('settings-menu');
    const qrArea = document.getElementById('qrcode-area');
    
    if (!menu) return; // Si le menu n'existe pas, on arrête sans erreur

    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.style.display = 'flex';
    } else {
        menu.style.display = 'none';
        // On nettoie le QR seulement si la zone existe
        if (qrArea) qrArea.innerHTML = "";
    }
}

// 2. Changer le thème (Sécurisé)
function changerTheme(theme) {
    // 1. On garde ta méthode de classe sur le body
    document.body.className = 'theme-' + theme;
    
    // 2. On enregistre le choix
    localStorage.setItem('saferun_theme', theme);
    
    const root = document.documentElement;

    // 3. On change la variable --bg-color (celle de ton CSS)
    if (theme === 'sombre') {
        root.style.setProperty('--bg-color', '#121212'); // Fond noir
        root.style.setProperty('--secondary', '#ffffff'); // Texte blanc
        root.style.setProperty('--white', '#1e1e1e');    // Cartes sombres
    } else if (theme === 'moderne') {
        root.style.setProperty('--bg-color', '#eef2f7'); // Gris bleu
        root.style.setProperty('--secondary', '#2c3e50'); // Texte bleu nuit
        root.style.setProperty('--white', '#ffffff');
    } else {
        // Mode Blanc par défaut
        root.style.setProperty('--bg-color', '#f4f7f6');
        root.style.setProperty('--secondary', '#1a1a1a');
        root.style.setProperty('--white', '#ffffff');
    }
}

// 3. Générer le QR Code (Sécurisé contre les doublons)
function genererMonQR() {
    const tel = localStorage.getItem('saferun_tel') || "Non configuré";
    const zoneQR = document.getElementById('qrcode-area');
    const numDisplay = document.getElementById('qr-number');
    
    if (!zoneQR) return; // Sécurité : si la zone n'existe pas, on sort

    zoneQR.innerHTML = ""; // Nettoyage
    
    // On vérifie si la bibliothèque QRCode est bien chargée
    if (typeof QRCode !== "undefined") {
        new QRCode(zoneQR, {
            text: tel,
            width: 160,
            height: 160,
            colorDark : "#000000",
            colorLight : "#ffffff"
        });
    }

    if (numDisplay) numDisplay.innerText = "Numéro : " + tel;
}

// 4. Affichage du prénom (Sécurisé et robuste)
function rafraichirNomUtilisateur() {
    const nomComplet = localStorage.getItem('saferun_nom');
    const display = document.getElementById('user-name-display');
    const icon = document.getElementById('user-icon');

    if (nomComplet && nomComplet.trim().length > 0) {
        let prenom = nomComplet.trim().split(' ')[0];
        // On met la première lettre en majuscule proprement
        prenom = prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase();
        
        if (display) {
            display.innerText = prenom;
            display.style.display = "inline-block";
        }
        
        if (icon) {
            // On force le changement de classe pour remplacer la roue par le profil
            icon.className = "fas fa-user-circle"; 
        }
    } else {
        // Si pas de nom, on s'assure que l'icône reste la roue dentée
        if (icon) icon.className = "fas fa-cog";
        if (display) display.style.display = "none";
    }
}

// --- INITIALISATION ---
window.addEventListener('load', () => {
    // Charger le thème
    const themeSauve = localStorage.getItem('saferun_theme') || 'blanc';
    changerTheme(themeSauve);
    
    // Charger le nom d'utilisateur
    rafraichirNomUtilisateur();
});
// FONCTION POUR SUPPRIMER UN PRODUIT DU PANIER
function supprimerProduitDirectement(index) {
    // 1. Retirer l'élément du tableau grâce à son index
    panier.splice(index, 1);
    
    // 2. Sauvegarder le panier modifié dans le stockage du téléphone
    localStorage.setItem('panier', JSON.stringify(panier));
    
    // 3. Mettre à jour l'affichage immédiatement
    if (typeof mettreAJourBadge === "function") mettreAJourBadge(); 
    if (typeof afficherPanier === "function") afficherPanier();
    
    console.log("Produit retiré du panier");
}

let currentHeroIdx = 0;
function updateHeroAnimate() {
    const heroSection = document.getElementById('hero-slider');
    const title = document.getElementById('hero-title');
    const desc = document.getElementById('hero-desc');
    const badge = document.getElementById('hero-badge');
    if (!heroSection || !title) return;
    currentHeroIdx = (currentHeroIdx + 1) % heroData.length;
    const current = heroData[currentHeroIdx];
    heroSection.style.setProperty('--bg-image', `url('${current.img}')`);
    if(badge) badge.innerText = current.badge;
    if(title) title.innerText = current.title;
    if(desc) desc.innerText = current.desc;
}
setInterval(updateHeroAnimate, 5000);

// RÉPARATION FINALE DU BOUTON X
function fermerModal() {
    const ids = ['modal-panier', 'modal-rdv', 'modal-planification', 'modal-livraisons', 'welcome-popup'];
    ids.forEach(id => {
        const m = document.getElementById(id);
        if(m) {
            m.classList.remove('show');
            setTimeout(() => { m.style.display = "none"; }, 300);
        }
    });
}
function calculerLivraison() {
    const maintenant = new Date();
    const jourSemaine = maintenant.getDay(); // 0 = Dimanche
    const heure = maintenant.getHours();
    const tempsActuel = heure + (maintenant.getMinutes() / 60);

    let dateLivraison = new Date();
    let creneau = "";

    // Règle Dimanche ou Samedi après 11h
    if ((jourSemaine === 6 && tempsActuel > 11) || jourSemaine === 0) {
        let joursAAjouter = (jourSemaine === 0) ? 1 : 2;
        dateLivraison.setDate(maintenant.getDate() + joursAAjouter);
        creneau = "Lundi matin (entre 9h et 11h)";
    } 
    else {
        if (tempsActuel >= 5 && tempsActuel <= 11) {
            creneau = "cet après-midi (entre 14h et 17h)";
        } else {
            dateLivraison.setDate(maintenant.getDate() + 1);
            if (dateLivraison.getDay() === 0) { // Si demain est dimanche
                dateLivraison.setDate(dateLivraison.getDate() + 1);
                creneau = "Lundi matin (entre 9h et 11h)";
            } else {
                creneau = "demain matin (entre 9h et 11h)";
            }
        }
    }

    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    let dateFormatee = dateLivraison.toLocaleDateString('fr-FR', options);
    return `LIVRAISON : ${dateFormatee.charAt(0).toUpperCase() + dateFormatee.slice(1)}, ${creneau}`;
}
function genererFactureFinale(montant, nom) {
    const container = document.getElementById('facture-container');
    const ref = "SR-" + Date.now().toString().slice(-6);
    const livraisonInfo = calculerLivraison(); // On récupère la date/heure ici
    const tel = localStorage.getItem('saferun_tel') || "N/A";

    // --- ÉTAPE A : ENVOI RÉEL ---
    if (typeof traiterPaiement === "function") {
        const telNettoye = tel.replace(/\s+/g, '').replace('+261', '0');
        
        // ON PASSE LES 3 PARAMÈTRES : montant, téléphone, et livraison
        traiterPaiement(montant, telNettoye, livraisonInfo); 
    }

    // --- ÉTAPE B : HISTORIQUE LOCAL ---
    let historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
    historique.unshift({
        id: ref,
        date: new Date().toLocaleString('fr-FR'),
        produits: panier.map(i => `${i.quantite}x ${i.nom}`).join(', '),
        total: montant,
        statut: "En attente",
        livraisonPrevue: livraisonInfo
    });
    localStorage.setItem('saferun_commandes', JSON.stringify(historique));

    // --- ÉTAPE C : AFFICHAGE ---
    container.innerHTML = `
        <div style="text-align:center; animation: fadeIn 0.5s;">
            <i class="fas fa-check-circle" style="font-size:3rem; color:#27ae60;"></i>
            <h2 style="margin:10px 0; color:#27ae60;">Succès !</h2>
            <div id="qrcode-place" style="display:flex; justify-content:center; margin:15px 0;"></div>
            <div style="background:#f9f9f9; padding:15px; border-radius:15px; text-align:left; font-size:0.85rem;">
                <p><b>Réf :</b> ${ref}</p>
                <p><b>Montant :</b> ${montant.toLocaleString()} Ar</p>
                <hr style="border:none; border-top:1px dashed #ccc;">
                <p style="color:#d35400; font-weight:bold;"><i class="fas fa-truck"></i> ${livraisonInfo}</p>
            </div>
            <button onclick="window.location.reload()" style="width:100%; background:#333; color:white; border:none; padding:14px; border-radius:12px; margin-top:15px; font-weight:bold;">RETOUR AU SITE</button>
        </div>
    `;

    new QRCode(document.getElementById("qrcode-place"), {
        text: `REF:${ref}|TOTAL:${montant}`,
        width: 120, height: 120
    });

    panier = [];
    localStorage.removeItem('saferun_panier');
}

async function synchroniserAchats() {
    let historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
    if (historique.length === 0) return;

    try {
        // Le paramètre ?t= évite que le navigateur ne te montre une ancienne version du Sheet
        const response = await fetch(API_URL + "?action=getCommandes&t=" + Date.now());
        const commandesSheet = await response.json();

        let modification = false;

        historique.forEach(maCmd => {
            // NETTOYAGE : On enlève les espaces et on met en MAJUSCULES
            const idLocal = String(maCmd.id).trim().toUpperCase();

            // On cherche dans la liste reçue du Sheet
            const cmdSheet = commandesSheet.find(c => {
                const idSheet = String(c.ID).trim().toUpperCase();
                return idSheet === idLocal;
            });

            if (cmdSheet) {
                const statutSheet = String(cmdSheet.Statut).toUpperCase().trim();
                console.log("Analyse : " + idLocal + " | Statut trouvé : " + statutSheet);

                // On vérifie si l'admin a écrit SÉRIEUX ou VALIDÉ
                if ((statutSheet === "SÉRIEUX" || statutSheet === "VALIDÉ") && maCmd.statut !== "Validé") {
                    maCmd.statut = "Validé";
                    modification = true;
                    console.log("✅ MATCH ! Commande " + idLocal + " passée en Validé.");
                }
            }
        });

        if (modification) {
            localStorage.setItem('saferun_commandes', JSON.stringify(historique));
            
            // On met à jour le badge vert sur le bouton
            if (typeof mettreAJourSignalValidation === "function") {
                mettreAJourSignalValidation();
            }
            
            // Si l'utilisateur a la fenêtre ouverte, on la rafraîchit en direct
            const modal = document.getElementById('modal-panier');
            if (modal && modal.style.display === "flex") {
                ouvrirAchatsValides();
            }
        }
    } catch (e) {
        console.error("Erreur lors de la récupération des données Google Sheet", e);
    }
}

function ouvrirAchatsValides() {
    // 1. Fermer le sidebar immédiatement
    if (document.body.classList.contains('sidebar-open')) {
        toggleSidebar(); 
    }

    const historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
    // On filtre ce qui est "Validé"
    const valides = historique.filter(cmd => cmd.statut === "Validé");

    let html = `<div style="padding:10px; text-align:center;">
                <h3 style="color:#27ae60;"><i class="fas fa-check-circle"></i> Achats Confirmés</h3>`;

    if (valides.length === 0) {
        html += `<p style="margin:20px 0; color:#888;">Aucun achat validé trouvé.<br>Récupération des données...</p>`;
        // On relance une synchro forcée si c'est vide
        synchroniserAchats();
    } else {
        valides.forEach(cmd => {
            html += `
                <div style="background:#f1f9f4; padding:15px; border-radius:15px; margin-bottom:10px; text-align:left; border-left:5px solid #27ae60;">
                    <b>Réf: ${cmd.id}</b> ✅<br>
                    <small>${cmd.produits}</small>
                </div>`;
        });
    }

    html += `<button onclick="fermerModal()" style="width:100%; padding:12px; margin-top:10px; border-radius:10px; border:none; background:#333; color:white;">Fermer</button></div>`;
    
    afficherModalGenerique(html);
}
function supprimerAchatLivre(id) {
    if (confirm("Confirmez-vous avoir reçu votre colis ? Cela supprimera le reçu de votre historique.")) {
        let historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
        // On filtre pour garder TOUT sauf l'ID qu'on veut supprimer
        historique = historique.filter(cmd => cmd.id !== id);
        
        localStorage.setItem('saferun_commandes', JSON.stringify(historique));
        
        // Rafraîchir l'affichage
        ouvrirAchatsValides();
        // Optionnel : mettre à jour les badges de notification
        if (typeof mettreAJourBadges === "function") mettreAJourBadges();
    }
}
function afficherRecuDetaille(id) {
    const historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
    const cmd = historique.find(c => c.id === id);

    if(!cmd) return;

    const htmlRecu = `
        <div style="padding:20px; text-align:center; font-family:sans-serif;">
            <div id="qrcode-rappel" style="display:flex; justify-content:center; margin-bottom:15px;"></div>
            <h3 style="margin:0; color:#27ae60;">FACTURE PAYÉE</h3>
            <p style="font-size:0.8rem; color:#888;">Réf: ${cmd.id}</p>
            <div style="text-align:left; background:#f9f9f9; padding:15px; border-radius:12px; margin-top:15px;">
                <p><b>Client:</b> ${localStorage.getItem('saferun_nom')}</p>
                <p><b>Produits:</b> ${cmd.produits}</p>
                <p><b>Total:</b> ${cmd.total.toLocaleString()} Ar</p>
                <p><b>Livraison:</b> ${cmd.livraisonPrevue}</p>
            </div>
            <button onclick="fermerModal()" style="width:100%; margin-top:20px; padding:12px; border:none; background:#333; color:white; border-radius:10px;">Fermer</button>
        </div>
    `;

    afficherModalGenerique(htmlRecu);

    // On régénère le QR Code pour le marchand si besoin
    new QRCode(document.getElementById("qrcode-rappel"), {
        text: `REF:${cmd.id}|TOTAL:${cmd.total}`,
        width: 130,
        height: 130
    });
}
/* --- FONCTION POUR AFFICHER LES FENETRES (MODALS) --- */
function afficherModalGenerique(contenu) {
    const modal = document.getElementById('modal-panier');
    const detail = document.getElementById('detail-panier');
    
    if (modal && detail) {
        detail.innerHTML = contenu;
        
        // On force les styles pour être sûr que ça s'affiche
        modal.style.display = "flex";
        modal.style.opacity = "1";
        modal.style.zIndex = "99999"; // On le met tout devant
        modal.classList.add('show');

        // On cache le bouton de commande du bas s'il existe
        const footer = modal.querySelector('.modal-footer');
        if (footer) footer.style.display = "none";
    } else {
        alert("Éléments modal introuvables dans le HTML");
    }
}

/* --- FONCTION POUR FERMER ET RÉINITIALISER --- */
function fermerModalGenerique() {
    const modal = document.getElementById('modal-panier');
    const footer = modal ? modal.querySelector('.modal-footer') : null;
    
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = "none";
            // On réaffiche le footer pour que le panier normal fonctionne après
            if (footer) footer.style.display = "flex";
        }, 300);
    }
}
function mettreAJourSignalValidation() {
    const badge = document.getElementById('badge-achats-valides');
    if (!badge) return;

    const historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
    const nbValides = historique.filter(cmd => cmd.statut === "Validé").length;
    
    if (nbValides > 0) {
        badge.innerText = nbValides;
        badge.style.display = "flex";
        badge.style.background = "#27ae60"; // Vert
        badge.classList.add('pulse-alerte'); 
    } else {
        badge.style.display = "none";
    }
}