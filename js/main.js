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
let pageActuelle = 1;
const produitsParPage = 8; // Affiche 8 produits par page pour un rendu propre sur mobile
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
// --- CHARGEMENT INITIAL DES EXCEPTIONS ---
let joursFermesSafeRun = []; 

async function chargerExceptionsSheet() {
    try {
        const response = await fetch(API_URL + "?action=getDatesFermees");
        joursFermesSafeRun = await response.json();
        // Une fois les dates reçues, on rafraîchit l'affichage si besoin
        if(document.getElementById('date-affichage')) {
             // Optionnel : actualiser le texte ici
        }
    } catch (e) {
        console.warn("Impossible de lire le Sheet, mode standard uniquement.");
    }
}
chargerExceptionsSheet();
function genererHTMLProduit(p) {
    const nomPropre = p.Nom.replace(/'/g, "\\'");
    const prixFormatte = Number(p.Prix).toLocaleString();
    const likesAleatoires = Math.floor(Math.random() * 37) + 12;

    return `
    <div class="carte-produit">
        <div class="prix-badge">${prixFormatte} Ar</div>
        <div class="img-container">
            <img src="${p.Image_URL}" alt="${p.Nom}" onclick="ouvrirZoomProduit('${nomPropre}', ${p.Prix}, '${p.Image_URL}')" style="cursor:zoom-in;">
        </div>
        <div style="padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <span class="cat-tag">${p.Categorie || 'Essentiel'}</span>
                <div style="color:#ffcc00; font-size:0.7rem; display:flex; gap:2px;">
                    <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i>
                </div>
            </div>
            <h3 style="margin:5px 0 10px 0; font-size:0.95rem; min-height:40px;">${p.Nom}</h3>
            <button class="btn-commander" onclick="ajouterAuPanier('${nomPropre}', ${p.Prix})" style="width:100%; padding:10px; border-radius:10px; background:linear-gradient(135deg, #ffcc00, #ff9900); border:none; font-weight:700; cursor:pointer; color:#1a1a1a; font-size:0.8rem;">
                <i class="fas fa-cart-plus"></i> AJOUTER
            </button>
        </div>
    </div>`;
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

    // --- ÉTAPE A : SÉPARATION DES PRODUITS ---
    const produitsPPN = liste.filter(p => (p.Categorie || "").toUpperCase() === 'PPN');
    const produitsMarche = liste.filter(p => (p.Categorie || "").toUpperCase() !== 'PPN');

    // --- ÉTAPE B : AFFICHAGE DES PPN (Pas de pagination ici) ---
    produitsPPN.forEach(p => {
        containerScroll.insertAdjacentHTML('beforeend', genererCodeCarte(p));
    });

    // --- ÉTAPE C : PAGINATION POUR "TOUT LE MARCHÉ" ---
    const totalProduitsMarche = produitsMarche.length;
    const debut = (pageActuelle - 1) * produitsParPage;
    const fin = debut + produitsParPage;
    const produitsAPresenter = produitsMarche.slice(debut, fin);

    produitsAPresenter.forEach(p => {
        containerGrille.insertAdjacentHTML('beforeend', genererCodeCarte(p));
    });

    // --- ÉTAPE D : CRÉER LES BOUTONS 1, 2, 3... ---
    creerBarrePagination(totalProduitsMarche);
}

// Fonction utilitaire pour garder ton design exact (Évite les erreurs de copier-coller)
function genererCodeCarte(p) {
    const nomPropre = p.Nom.replace(/'/g, "\\'");
    const likesAleatoires = Math.floor(Math.random() * 37) + 12;
    const prixFormatte = Number(p.Prix).toLocaleString();
    const descEchappee = (p.Description || "Qualité SafeRun").replace(/'/g, "\\'");

    return `
    <div class="carte-produit" style="display: flex; flex-direction: column; height: 100%; border-radius: 20px; background: #fff; border: 1px solid #eee; overflow: hidden; transition: all 0.3s ease; position: relative;">
        
        <div style="position: absolute; top: 10px; right: 10px; z-index: 5; background: #ffcc00; color: #1a1a1a; width: 65px; height: 65px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem; box-shadow: 0 4px 10px rgba(0,0,0,0.2); border: 2px solid #fff; line-height: 1;">
            <span>${prixFormatte}</span>
            <small style="font-size: 0.55rem; margin-top: 2px;">AR</small>
        </div>
        
        <div class="img-container" style="height: 170px; overflow: hidden; background: #f8f9fa;">
            <img src="${p.Image_URL}" alt="${p.Nom}" loading="lazy" 
                 onerror="this.src='https://via.placeholder.com/150?text=SafeRun'"
                 onclick="ouvrirZoomProduit('${nomPropre}', ${p.Prix}, '${p.Image_URL}', '${descEchappee}')"
                 style="width: 100%; height: 100%; object-fit: cover; cursor: zoom-in; transition: 0.5s;">
        </div>

        <div style="padding: 12px; display: flex; flex-direction: column; flex-grow: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <span class="cat-tag" style="font-size: 0.65rem; color: #ffa000; font-weight: 700;">${p.Categorie || 'Market'}</span>
                <div style="color: #ffcc00; font-size: 0.7rem;"><i class="fas fa-star"></i> 4.8</div>
            </div>

            <h3 style="margin: 5px 0; font-size: 0.95rem; font-weight: 700; color: #2c3e50; line-height: 1.2; height: 2.4em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.Nom}</h3>
            
            <p style="font-size: 0.75rem; color: #7f8c8d; margin: 5px 0; line-height: 1.3; height: 2.6em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; flex-grow: 1;">
                ${p.Description || ""}
            </p>

            <div class="interaction-bar" style="display: flex; gap: 15px; padding: 8px 0; border-top: 1px solid #f8f8f8; margin-top: auto;">
                <div class="btn-interaction" onclick="actionLike(this)" style="cursor:pointer; display:flex; align-items:center; gap:5px; color:#95a5a6; font-size:0.75rem;">
                    <i class="far fa-heart"></i> <span class="nb-likes">${likesAleatoires}</span>
                </div>
                <div style="font-size:0.75rem; color:#27ae60; font-weight:bold; display:flex; align-items:center; gap:3px;">
                    ${(Math.random() * (4.9 - 4.6) + 4.6).toFixed(1)} <i class="fas fa-check-circle" style="font-size:0.65rem;"></i>
                </div>
            </div>

            <button class="btn-commander" 
                    onclick="ajouterAuPanier('${nomPropre}', ${p.Prix})"
                    onmouseover="this.style.background='linear-gradient(135deg, #ffcc00, #ff9900)'; this.style.color='#1a1a1a'; this.style.transform='scale(1.02)';"
                    onmouseout="this.style.background='#1a1a1a'; this.style.color='#fff'; this.style.transform='scale(1)';"
                    style="width: 100%; padding: 12px; border-radius: 12px; background: #1a1a1a; border: none; font-weight: 700; cursor: pointer; color: #fff; font-size: 0.8rem; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s ease;">
                <i class="fas fa-shopping-basket" style="color: #ffcc00;"></i> AJOUTER
            </button>
        </div>
    </div>`;
}
function creerBarrePagination(total) {
    let container = document.getElementById('pagination-container');
    
    // Si le container n'existe pas dans le HTML, on le crée sous la grille
    if (!container) {
        container = document.createElement('div');
        container.id = 'pagination-container';
        container.className = 'pagination-flex';
        document.getElementById('boutique').after(container);
    }

    const nbPages = Math.ceil(total / produitsParPage);
    let html = "";

    // Bouton Précédent
    if (pageActuelle > 1) {
        html += `<button onclick="allerPage(${pageActuelle - 1})" class="btn-page"> <i class="fas fa-chevron-left"></i> </button>`;
    }

    // Numéros de pages
    for (let i = 1; i <= nbPages; i++) {
        if (i === 1 || i === nbPages || (i >= pageActuelle - 1 && i <= pageActuelle + 1)) {
            html += `<button onclick="allerPage(${i})" class="btn-page ${i === pageActuelle ? 'active' : ''}">${i}</button>`;
        } else if (i === pageActuelle - 2 || i === pageActuelle + 2) {
            html += `<span style="color:#ccc;">...</span>`;
        }
    }

    // Bouton Suivant
    if (pageActuelle < nbPages) {
        html += `<button onclick="allerPage(${pageActuelle + 1})" class="btn-page"> <i class="fas fa-chevron-right"></i> </button>`;
    }

    container.innerHTML = html;
}

function allerPage(num) {
    pageActuelle = num;
    // On rappelle la fonction avec la liste globale (tousLesProduits)
    rendreProduits(tousLesProduits); 
    // Remonter en haut de la liste "Tout le Marché" proprement
    document.getElementById('boutique').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    
    // On dessine le panier normalement
    afficherPanier(); 
    
    const btnEnvoi = modal.querySelector('.btn-inscription');
    if (btnEnvoi) {
        // État initial du bouton
        btnEnvoi.innerHTML = "🚀 CONFIRMER LA COMMANDE";
        btnEnvoi.disabled = false;
        btnEnvoi.style.pointerEvents = "auto";
        btnEnvoi.style.background = ""; // Reset couleur si besoin

        btnEnvoi.onclick = function() {
            // 1. VERROUILLAGE IMMÉDIAT
            btnEnvoi.disabled = true;
            btnEnvoi.style.pointerEvents = "none";
            btnEnvoi.innerHTML = "⌛ ENVOI EN COURS...";
            
            // On cache la croix de fermeture pour éviter de perdre le suivi
            const btnFermer = modal.querySelector('.close-modal') || document.querySelector('.close');
            if (btnFermer) btnFermer.style.display = "none";

            // 2. LANCEMENT DE L'ENVOI (Ta fonction vers Google Sheet)
            if (typeof envoyerDonneesAuSheet === "function") {
                envoyerDonneesAuSheet();
            }

            // 3. TRANSFORMATION EN BOUTON DE NAVIGATION (Après un court délai)
            setTimeout(() => {
                btnEnvoi.disabled = false;
                btnEnvoi.style.pointerEvents = "auto";
                btnEnvoi.style.background = "#1e293b"; // Couleur foncée pour le style
                btnEnvoi.innerHTML = "🔄 REVENIR AU PAIEMENT";
                
                // Nouveau comportement : réafficher la modale VISA/MVOLA
                btnEnvoi.onclick = function() {
                    // On ferme le panier
                    modal.classList.remove('show');
                    setTimeout(() => {
                        modal.style.display = "none";
                        
                        // On réaffiche ton choix de paiement Luxe
                        // Utilise les variables globales id et montant stockées lors de l'envoi
                        if (typeof idCommandeActuelle !== 'undefined') {
                            afficherChoixPaiementLuxe(idCommandeActuelle, montantTotalGlobal);
                        }
                    }, 300);
                };
            }, 1500); // Laisse le temps au client de voir que l'envoi est fait
        };
    }

    modal.style.display = "flex";
    setTimeout(() => modal.classList.add('show'), 10);
}

async function envoyerDonneesAuSheet() {
    const montantTotal = window.dernierTotalCalcule || 0;
    const tel = localStorage.getItem('saferun_tel');
    const nom = localStorage.getItem('saferun_nom');
    const quartier = localStorage.getItem('saferun_quartier'); 

    console.log("--- DIAGNOSTIC ENVOI ---");
    console.log("Nom trouvé :", nom);
    console.log("Tel trouvé :", tel);
    console.log("Quartier trouvé :", quartier);
    console.log("Panier actuel :", panier);

    if (!tel || montantTotal <= 0) {
        alert("Action impossible : Profil incomplet ou panier vide.");
        return;
    }

    const idCommande = "SR-" + Date.now().toString().slice(-6);
    const infoLivraison = calculerLivraison(); 
    
    const payload = {
        action: "nouvelleCommande",
        nom: nom || "NOM_MANQUANT",
        telClient: tel || "TEL_MANQUANT",
        id: idCommande,
        correlationId: idCommande,
        montant: montantTotal,
        produits: panier.length > 0 ? panier.map(p => `${p.nom} (x${p.quantite})`).join(", ") : "PANIER_VIDE",
        livraison: infoLivraison || "ERREUR_FONCTION_LIVRAISON",
        quartier: quartier || "QUARTIER_VIDE_LOCALSTORAGE",
        statut: "NOUVEAU"
    };

    console.log("Payload envoyé au Sheet :", payload);

    // 1. Envoi au Google Sheet
    fetch(API_URL, { 
        method: "POST", 
        mode: "no-cors", 
        body: JSON.stringify(payload) 
    });

    let historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");

    const nouvelleCommandeLocale = {
        id: idCommande,
        ID: idCommande,
        date: new Date().toLocaleDateString('fr-FR'),
        produits: payload.produits,
        total: montantTotal, // <--- C'EST CETTE LIGNE QUI RÉPARE L'ERREUR "cmd.total"
        statut: "NOUVEAU",
        livraison: infoLivraison,
        quartier: quartier || "Non précisé"
    };

    historique.unshift(nouvelleCommandeLocale); 
    localStorage.setItem('saferun_commandes', JSON.stringify(historique));
    localStorage.setItem('livraison_vue', 'false'); // Badge rouge

    // 3. MISES À JOUR VISUELLES
    if (typeof mettreAJourBadgeLivraison === "function") mettreAJourBadgeLivraison();
    
    // Nettoyage panier
    panier = []; 
    localStorage.removeItem('saferun_panier');
    if (typeof mettreAJourAffichagePanier === "function") mettreAJourAffichagePanier();
    
    // Affichage de la modale de paiement Marcellin
    afficherChoixPaiementLuxe(idCommande, montantTotal);
}

function afficherChoixPaiementLuxe(id, montant) {
    const old = document.getElementById('modale-saferun-pay');
    if(old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modale-saferun-pay';
    overlay.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background: radial-gradient(circle at center, rgba(30, 41, 59, 0.7) 0%, rgba(0,0,0,0.9) 100%);
        z-index:999999; display:flex; align-items:center; justify-content:center;
        backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
        font-family:'Poppins', sans-serif;
    `;
    
    overlay.innerHTML = `
        <div class="glass-card" style="background:rgba(255,255,255,0.98); padding:45px 35px; border-radius:40px; width:92%; max-width:420px; text-align:center; box-shadow:0 40px 100px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.5); position:relative; overflow:hidden;">
            
            <div style="position:absolute; top:-50%; left:-50%; width:200%; height:200%; background: radial-gradient(circle, rgba(255,204,0,0.05) 0%, transparent 50%); animation: rotateBg 15s linear infinite; pointer-events:none;"></div>

            <div style="font-size:3.5rem; margin-bottom:15px; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.1));">🛍️</div>
            <h2 style="margin:0; color:#1e293b; font-size:1.8rem; font-weight:900; letter-spacing:-0.5px;">SafeRun Pay</h2>
            <p style="color:#64748b; margin:5px 0; font-size:0.9rem; font-weight:500;">Commande sécurisée #${id}</p>
            
            <div class="amount-badge" style="background:#f8fafc; padding:25px; border-radius:30px; margin:30px 0; border:1px solid #e2e8f0; transition: 0.3s;">
                <span style="display:block; color:#94a3b8; font-size:0.75rem; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:8px;">Montant Total</span>
                <span style="font-size:2.6rem; font-weight:900; color:#059669; display:block; line-height:1;">${montant.toLocaleString()} <small style="font-size:1.2rem;">Ar</small></span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 15px;">
                <button id="go-visa" class="btn-luxe btn-dark">
                    <span class="icon">💳</span> CB / VISA / MASTERCARD
                    <div class="shimmer"></div>
                </button>

                <button id="go-mvola" class="btn-luxe btn-yellow">
                    <span class="icon">📱</span> PAYER PAR MVOLA
                </button>
            </div>

            <p onclick="document.getElementById('modale-saferun-pay').remove()" style="margin-top:30px; color:#94a3b8; font-size:0.85rem; cursor:pointer; text-decoration:none; font-weight:600; transition:0.3s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">
                ← Retour au panier
            </p>
        </div>

        <style>
            @keyframes slideUp { from { opacity:0; transform:translateY(40px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
            @keyframes rotateBg { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes shimmer { 0% { left: -100%; } 100% { left: 100%; } }
            
            .glass-card { animation: slideUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            
            .btn-luxe {
                position: relative; overflow: hidden;
                width: 100%; padding: 22px; border: none; border-radius: 22px;
                font-weight: 800; font-size: 1rem; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .btn-dark { background: #1e293b; color: white; box-shadow: 0 10px 25px rgba(30,41,59,0.2); }
            .btn-yellow { background: #ffcc00; color: #1a1a1a; box-shadow: 0 10px 25px rgba(255,204,0,0.2); }
            
            .btn-luxe:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(0,0,0,0.15); }
            .btn-luxe:active { transform: translateY(0) scale(0.97); }
            
            .icon { margin-right: 12px; font-size: 1.3rem; transition: 0.3s; }
            .btn-luxe:hover .icon { transform: scale(1.2) rotate(-5deg); }

            .shimmer {
                position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                transform: skewX(-20deg); animation: shimmer 3s infinite;
            }
            
            .amount-badge:hover { transform: scale(1.02); background: #fff; border-color: #10b981; }
        </style>
    `;
    document.body.appendChild(overlay);

    // --- LOGIQUE DE RÉPARATION (Utilise API_URL et envoie au Sheet) ---
    const envoyerActionSheet = (statut) => {
        if (typeof API_URL !== 'undefined') {
            fetch(API_URL, {
                method: "POST",
                mode: "no-cors",
                body: JSON.stringify({
                    action: "nouvelleCommande",
                    id: id,
                    nom: typeof nomClient !== 'undefined' ? nomClient : "MARCELLIN",
                    telClient: typeof telClient !== 'undefined' ? telClient : "0344414702",
                    montant: montant,
                    statut: statut,
                    produits: typeof produitsCommande !== 'undefined' ? produitsCommande : "Commande SafeRun",
                    quartier: typeof quartierClient !== 'undefined' ? quartierClient : "Belanitra"
                })
            });
        }
    };

    document.getElementById('go-visa').onclick = function() {
        this.id = "btn-visa-active";
        this.innerHTML = "⌛ Connexion sécurisée...";
        this.style.opacity = "0.6";
        this.disabled = true;
        
        envoyerActionSheet("ATTENTE VISA");
        lancerPayUnit(id, montant); 
    };

    document.getElementById('go-mvola').onclick = function() {
        envoyerActionSheet("NOUVEAU");
        overlay.remove();
        if (typeof afficherInstructionsMvola === "function") {
            afficherInstructionsMvola(montant, id);
        }
    };
}

// Fonction pour l'option MVola (On garde ton ancienne logique de facture)
function afficherInstructionsMvola(montant, idCommande) {
    const quartier = localStorage.getItem('saferun_quartier') || "Non précisé";
    const infoLivraison = calculerLivraison(); 
    const numeroMarcellin = "038 24 536 10";

    let modalPay = document.getElementById('temp-modal-pay');
    if (!modalPay) {
        modalPay = document.createElement('div');
        modalPay.id = 'temp-modal-pay';
        document.body.appendChild(modalPay);
    }

    modalPay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',Roboto,sans-serif;padding:15px;backdrop-filter:blur(8px);";
    
    modalPay.innerHTML = `
        <div style="background:#fff;padding:0;border-radius:30px;max-width:420px;width:100%;text-align:center;position:relative;box-shadow:0 20px 50px rgba(0,0,0,0.5);overflow:hidden;animation: slideUp 0.3s ease-out;">
            
            <div style="background: linear-gradient(135deg, #ffcc00 0%, #ff9900 100%); padding: 25px 15px; color: #000;">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="position:absolute;top:15px;right:15px;border:none;background:rgba(255,255,255,0.3);width:30px;height:30px;border-radius:50%;cursor:pointer;font-weight:bold;">&times;</button>
                <img src="https://www.mvola.mg/wp-content/uploads/2021/03/Logo-MVola.png" style="height:40px;margin-bottom:10px;" alt="MVola">
                <h3 style="margin:0;text-transform:uppercase;letter-spacing:1px;font-size:1.1rem;">Instructions de Paiement</h3>
            </div>

            <div style="padding:20px; overflow-y:auto; max-height:75vh;">
                
                <div style="display:flex;justify-content:space-between;background:#f8f9fa;padding:12px;border-radius:15px;margin-bottom:20px;font-size:0.85rem;border:1px solid #eee;">
                    <span>📍 <b>${quartier}</b></span>
                    <span>📅 <b>${infoLivraison}</b></span>
                </div>

                <div style="background:#fffdf0;padding:20px;border-radius:20px;border:2px solid #ffcc00;margin-bottom:20px; position:relative;">
                    <p style="margin:0;font-size:0.9rem;color:#666;">Montant exact à envoyer :</p>
                    <h2 style="margin:5px 0;color:#d35400;font-size:1.8rem;">${montant.toLocaleString()} Ar</h2>
                    
                    <div style="margin:15px 0;padding:10px;background:white;border-radius:10px;border:1px solid #ffeaa7;">
                        <p style="margin:0 0 5px 0;font-size:0.8rem;color:#7f8c8d;">Numéro MVola (Marcellin) :</p>
                        <b style="font-size:1.3rem;color:#2c3e50;letter-spacing:1px;">${numeroMarcellin}</b>
                    </div>

                    <p style="margin:0;font-size:0.8rem;color:#7f8c8d;">Référence obligatoire :</p>
                    <b style="font-size:1.1rem;color:#c0392b;background:#ffeaa7;padding:4px 12px;border-radius:8px;display:inline-block;margin-top:5px;border:1px solid #fab1a0;">${idCommande}</b>
                </div>

                <div style="background:#e3f2fd; padding:15px; border-radius:18px; margin-bottom:20px; border-left:5px solid #2196f3; text-align:left;">
                    <div style="display:flex; align-items:center;">
                        <span style="font-size:1.5rem; margin-right:12px;">📸</span>
                        <div>
                            <p style="margin:0; font-size:0.85rem; font-weight:bold; color:#0d47a1;">Astuce Rapidité :</p>
                            <p style="margin:2px 0 0 0; font-size:0.75rem; color:#1565c0;">Envoyez une <b>capture d'écran</b> du transfert dans le chat pour une validation instantanée !</p>
                        </div>
                    </div>
                </div>

                <div style="text-align:left; padding:0 10px; margin-bottom:25px;">
                    <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
                        <div style="background:#27ae60;color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-right:10px;flex-shrink:0;font-size:0.7rem;">✓</div>
                        <p style="margin:0;font-size:0.8rem;color:#444;">Confirmation par <b>SMS</b> après réception.</p>
                    </div>
                    <div style="display:flex;align-items:flex-start;">
                        <div style="background:#27ae60;color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-right:10px;flex-shrink:0;font-size:0.7rem;">✓</div>
                        <p style="margin:0;font-size:0.8rem;color:#444;">Suivi en temps réel sur votre <b>Espace Client</b>.</p>
                    </div>
                </div>

                <button onclick="window.location.reload()" style="width:100%;padding:18px;background:#27ae60;color:white;border:none;border-radius:15px;font-weight:bold;font-size:1rem;cursor:pointer;box-shadow:0 10px 20px rgba(39,174,96,0.3); transition:0.3s;">
                    J'AI EFFECTUÉ LE TRANSFERT
                </button>
                
                <p style="margin-top:15px; font-size:0.75rem; color:#95a5a6;">SafeRun Market - Livraison sécurisée</p>
            </div>
        </div>
        
        <style>
            @keyframes slideUp {
                from { transform: translateY(50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        </style>
    `;
}
async function lancerPayUnit(id, montant) {
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzAy80IbBLBeL3M4sNIzuoE1XzuoO5XdrPYe3Grf9J1irb0ApX7pzCDftzJKqFEB3YV/exec";
    
    // --- CALCULS ---
    const TAUX_MGA_USD = 4900;
    const FRAIS_FIXE = 0.30;
    const FRAIS_POURCENT = 0.044;
    let montantFinalUSD = (((montant / TAUX_MGA_USD) + FRAIS_FIXE) / (1 - FRAIS_POURCENT)).toFixed(2);

    // --- DONNÉES CLIENT ---
    const nomClient = document.getElementById('nom-client')?.value || "Client SafeRun";
    const telClient = document.getElementById('tel-client')?.value || "034...";
    const quartierClient = document.getElementById('quartier-client')?.value || "Antananarivo";
    const produitsCommande = typeof panier !== 'undefined' ? panier.map(p => `${p.nom} (x${p.quantite})`).join(', ') : "Commande SafeRun";

    // --- NETTOYAGE ---
    if (document.getElementById('paypal-overlay')) document.getElementById('paypal-overlay').remove();

    // --- INTERFACE VIVANTE & SCROLLABLE ---
    const overlay = document.createElement('div');
    overlay.id = "paypal-overlay";
    
    overlay.style.cssText = `
        position: fixed !important; top: 0 !important; left: 0 !important;
        width: 100vw !important; height: 100vh !important;
        background: linear-gradient(-45deg, rgba(0,0,0,0.8), rgba(26,26,26,0.9), rgba(0,0,0,0.8)) !important;
        background-size: 400% 400% !important;
        animation: gradientBG 10s ease infinite !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        z-index: 2147483647 !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
        font-family: 'Poppins', sans-serif !important;
        overflow: hidden !important;
    `;

    overlay.innerHTML = `
        <div id="paypal-modal" style="
            background: rgba(255, 255, 255, 0.95) !important; 
            width: 92% !important; 
            max-width: 440px !important; 
            max-height: 85vh !important; 
            border-radius: 30px !important; 
            box-shadow: 0 40px 100px rgba(0,0,0,0.8) !important;
            display: flex !important; 
            flex-direction: column !important;
            animation: modalPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
            overflow: hidden !important;
            border: 1px solid rgba(255,255,255,0.3) !important;">
            
            <div style="background: var(--primary, #ffcc00) !important; padding: 20px !important; text-align: center !important; flex-shrink: 0 !important;">
                <h3 style="margin: 0 !important; color: #1a1a1a !important; font-weight: 800 !important; letter-spacing: -0.5px !important;">Paiement Sécurisé</h3>
                <small style="opacity: 0.7 !important; font-size: 0.7rem !important;">SafeRun Market • ID ${id}</small>
            </div>
            
            <div id="modal-scroll-body" style="
                padding: 25px !important; 
                overflow-y: auto !important; 
                flex-grow: 1 !important; 
                -webkit-overflow-scrolling: touch !important;
                scrollbar-width: thin !important;">
                
                <div style="text-align: center !important; margin-bottom: 20px !important;">
                    <div style="font-size: 2.2rem !important; font-weight: 900 !important; color: #1a1a1a !important;">$${montantFinalUSD} <small style="font-size: 0.9rem !important; font-weight: 500 !important;">USD</small></div>
                    <div style="background: #f0fdf4 !important; color: #16a34a !important; padding: 5px 15px !important; border-radius: 20px !important; font-size: 0.85rem !important; font-weight: 600 !important; display: inline-block !important; margin-top: 5px !important;">
                        ≈ ${montant.toLocaleString()} Ar
                    </div>
                </div>

                <div id="paypal-button-container" style="min-height: 350px !important;"></div>
                
                <div style="text-align: center !important; margin-top: 20px !important; padding-top: 15px !important; border-top: 1px solid #eee !important;">
                    <button onclick="window.fermerPaypal()" style="background: none !important; border: none !important; color: #ef4444 !important; cursor: pointer !important; font-weight: 700 !important; font-size: 0.85rem !important; text-decoration: underline !important;">
                        ✕ Annuler le paiement
                    </button>
                </div>
            </div>
        </div>

        <style>
            @keyframes gradientBG { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
            @keyframes modalPop { from { opacity: 0; transform: translateY(40px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
            #modal-scroll-body::-webkit-scrollbar { width: 6px; }
            #modal-scroll-body::-webkit-scrollbar-thumb { background: #ddd; border-radius: 10px; }
        </style>
    `;

    document.body.appendChild(overlay);

    // --- FONCTION DE FERMETURE ET RÉACTIVATION ---
    window.fermerPaypal = function() {
        overlay.style.opacity = "0";
        setTimeout(() => {
            overlay.remove();
            
            // On cherche le bouton VISA bloqué sur la modale de choix et on le réactive
            const btnVisa = document.getElementById('btn-visa-active');
            if (btnVisa) {
                btnVisa.disabled = false;
                btnVisa.style.opacity = "1";
                btnVisa.id = "go-visa"; // On restaure l'ID d'origine
                btnVisa.innerHTML = "<span style='margin-right:10px;'>💳</span> VISA / MASTERCARD";
            }
        }, 300);
    };

    // --- INITIALISATION ---
    setTimeout(() => {
        if (typeof paypal === 'undefined') {
            alert("Erreur: PayPal n'a pas pu charger.");
            window.fermerPaypal();
            return;
        }

        paypal.Buttons({
            style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'pay' },
            createOrder: (data, actions) => actions.order.create({
                purchase_units: [{ reference_id: id, amount: { currency_code: 'USD', value: montantFinalUSD } }]
            }),
            onApprove: async (data, actions) => {
                return actions.order.capture().then(async (details) => {
                    document.getElementById('paypal-modal').innerHTML = `
                        <div style="padding: 60px 20px; text-align: center; animation: modalPop 0.4s ease;">
                            <div style="font-size: 60px; margin-bottom: 20px;">✅</div>
                            <h2 style="font-weight: 800; color: #1a1a1a;">Paiement Réussi !</h2>
                            <p style="color: #64748b;">Merci ${details.payer.name.given_name}, votre commande est enregistrée.</p>
                        </div>
                    `;

                    try {
                        await fetch(SCRIPT_URL, {
                            method: "POST",
                            mode: "no-cors",
                            body: JSON.stringify({
                                action: "nouvelleCommande",
                                id: id, nom: nomClient, tel: telClient, quartier: quartierClient,
                                montant: montant, produits: produitsCommande,
                                transactionId: details.id, statut: "PAYÉ"
                            })
                        });
                        if (typeof viderPanier === 'function') viderPanier();
                        setTimeout(() => location.reload(), 3000);
                    } catch (e) { console.error(e); }
                });
            }
        }).render('#paypal-button-container');
    }, 500);
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
// Correction de l'erreur ReferenceError: fermerPopup is not defined
function fermerPopup() {
    // 1. On cible la popup de bienvenue/inscription
    const popup = document.getElementById('welcome-popup');
    if (popup) {
        popup.classList.remove('show');
        console.log("Popup SafeRun fermée");
    }
    
    // 2. Par sécurité, on ferme aussi l'overlay si tu en as un
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.style.display = 'none';
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
    if(!dateInput) { alert("Veuillez choisir une date et une heure !"); return; }

    const dateObj = new Date(dateInput);
    const jour = dateObj.getDay(); 
    const heure = dateObj.getHours();

    // --- TES RÈGLES DE VALIDATION ---
    if (jour === 0) {
        alert("Nous sommes fermés le dimanche. Choisissez un autre jour.");
        return;
    }

    if (heure < 8 || heure >= 17) {
        alert("Veuillez choisir un créneau entre 8h et 17h.");
        return;
    }

    // --- STOCKAGE POUR LA FACTURE ---
    datePlanifiee = dateInput; 
    
    // On crée une version lisible (ex: "5 mars à 14:30")
    const dateLisible = dateObj.toLocaleString('fr-FR', { 
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
    });

    // On met à jour l'affichage sur la page
    document.getElementById('date-affichage').innerText = dateLisible;
    document.getElementById('status-planif').style.display = "block";
    
    // IMPORTANT : On sauvegarde dans le localStorage pour que la facture le récupère
    localStorage.setItem('saferun_creneau_final', dateLisible);
    
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

// On ajoute "adresse" à la fin des arguments
async function traiterPaiement(montant, telClient, livraison, adresse) {
    const SCRIPT_PAYS_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec"; 

    try {
        const payload = {
            action: "nouvelleCommande", 
            nom: localStorage.getItem('saferun_nom') || "Client Site",
            telClient: telClient, 
            montant: montant, 
            produits: panier.map(i => `${i.quantite}x ${i.nom}`).join(', '),
            correlationId: "SR" + Date.now().toString().slice(-6),
            
            // --- CORRECTION ICI ---
            // On utilise 'adresse' (passée par la fonction) 
            // OU 'saferun_quartier' (le nom exact dans ton localStorage)
            quartier: adresse || localStorage.getItem('saferun_quartier') || "Non précisé",
            
            livraison: livraison 
        };

        console.log("Données envoyées au Sheet :", payload);

        // On utilise await pour s'assurer que l'envoi est initié avant de continuer
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
        img: 'https://images.unsplash.com/photo-1616118132534-381148898bb4?w=1200',
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
        img: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=1200',
        badge: "🥫 Épicerie",
        title: "CONSERVES ET PPN",
        desc: "Tout votre stock de provisions livré en moins de 2h."
    },
    {
        img: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=800',
        badge: "🍎 Fraîcheur",
        title: "FRUITS ET LÉGUMES FRAIS",
        desc: "Le goût du marché d'Anosibe, sans bouger de chez vous."
    }
];

// --- ANIMATION DU HERO SLIDER DYNAMIQUE ---
function updateHeroAnimate() {
    const heroSection = document.getElementById('hero-slider');
    const title = document.getElementById('hero-title');
    const desc = document.getElementById('hero-desc');
    const badge = document.getElementById('hero-badge');

    if (!heroSection || !title || !desc || !badge) return;

    // 1. PHASE DE SORTIE : Les éléments glissent vers le bas et disparaissent
    const elements = [badge, title, desc];
    
    elements.forEach((el, index) => {
        el.style.transition = "all 0.5s ease-in-out";
        el.style.opacity = "0";
        el.style.transform = "translateY(20px)";
        el.style.filter = "blur(5px)"; // Petit effet de flou pour le mouvement
    });

    setTimeout(() => {
        // Changement d'index
        currentHeroIdx = (currentHeroIdx + 1) % heroData.length;
        const current = heroData[currentHeroIdx];

        // 2. MISE À JOUR DU CONTENU ET DU FOND
        // J'ajoute un dégradé noir pour que le texte blanc reste toujours lisible sur les images claires
        heroSection.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url('${current.img}')`;
        
        badge.innerText = current.badge;
        title.innerText = current.title;
        desc.innerText = current.desc;

        // Préparation des éléments en haut (invisible) pour l'effet d'entrée
        elements.forEach(el => {
            el.style.transition = "none"; // On coupe la transition pour le repositionnement
            el.style.transform = "translateY(-20px)"; 
        });

        // 3. PHASE D'ENTRÉE : Les éléments redescendent à leur place avec un effet de cascade
        setTimeout(() => {
            elements.forEach((el, index) => {
                // On rétablit la transition avec un délai différent pour chaque élément (cascade)
                el.style.transition = `all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${index * 0.15}s`;
                el.style.opacity = "1";
                el.style.transform = "translateY(0)";
                el.style.filter = "blur(0)";
            });
        }, 50); // Petit délai pour laisser le navigateur enregistrer le changement de position

    }, 600); // Temps correspondant à la phase de sortie
}

// Lancer l'animation toutes les 5 secondes (5000ms)
setInterval(updateHeroAnimate, 5000);

let heroInterval; // Variable pour stocker le cycle

function startHeroCycle() {
    // Lance l'animation toutes les 5 secondes
    heroInterval = setInterval(updateHeroAnimate, 5000);
}

function stopHeroCycle() {
    // Arrête l'animation immédiatement
    clearInterval(heroInterval);
}

// --- INITIALISATION DES ÉVÉNEMENTS ---
const heroSlider = document.getElementById('hero-slider');

if (heroSlider) {
    // Quand la souris entre : on arrête
    heroSlider.addEventListener('mouseenter', () => {
        stopHeroCycle();
        console.log("Slider en pause pour lecture...");
    });

    // Quand la souris sort : on relance
    heroSlider.addEventListener('mouseleave', () => {
        startHeroCycle();
        console.log("Slider relancé.");
    });
}

// Lancement initial au chargement de la page
startHeroCycle();

const categorySlider = document.getElementById('category-slider');
let isSliderPaused = false;
let scrollStep = 1; 

if (categorySlider) {
    categorySlider.addEventListener('mouseenter', () => isSliderPaused = true);
    categorySlider.addEventListener('mouseleave', () => isSliderPaused = false);
    categorySlider.addEventListener('touchstart', () => isSliderPaused = true, { passive: true });
    categorySlider.addEventListener('touchend', () => isSliderPaused = false, { passive: true });

    function loopCategories() {
        if (!isSliderPaused) {
            // VERIFICATION : Est-ce que le contenu dépasse vraiment de l'écran ?
            const hasOverflow = categorySlider.scrollWidth > categorySlider.clientWidth;

            if (hasOverflow) {
                // On ne fait défiler QUE si les boutons sont trop larges pour l'écran
                categorySlider.scrollLeft += scrollStep;
                
                if (categorySlider.scrollLeft >= (categorySlider.scrollWidth - categorySlider.clientWidth - 1)) {
                    categorySlider.scrollLeft = 0;
                }
            } else {
                // Si tout est visible (comme sur ta capture), on force le scroll à 0
                categorySlider.scrollLeft = 0;
            }
        }
        requestAnimationFrame(loopCategories);
    }
    requestAnimationFrame(loopCategories);
}
(function() {
    function getSafeRunDelivery() {
        const now = new Date();
        const day = now.getDay();
        const hr = now.getHours() + (now.getMinutes() / 60);
        let deliveryDate = new Date();
        let labelFr = "";
        let labelMg = "";

        if ((day === 6 && hr > 11) || day === 0) {
            let offset = (day === 0) ? 1 : 2;
            deliveryDate.setDate(now.getDate() + offset);
            labelFr = "ce lundi matin (9h-11h)";
            labelMg = "ny alatsinainy maraina";
        } else if (hr >= 5 && hr <= 11) {
            labelFr = "cet après-midi (14h-17h)";
            labelMg = "anio tolakandro";
        } else {
            deliveryDate.setDate(now.getDate() + 1);
            if (deliveryDate.getDay() === 0) deliveryDate.setDate(now.getDate() + 2);
            
            const isMon = deliveryDate.getDay() === 1;
            labelFr = isMon ? "lundi matin (9h-11h)" : "demain matin (9h-11h)";
            labelMg = isMon ? "ny alatsinainy maraina" : "rahampitso maraina";
        }

        const dateStr = deliveryDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
        
        const mgEl = document.getElementById('sr-date-mg');
        const frEl = document.getElementById('sr-date-fr');
        if(mgEl) mgEl.innerText = `Livraison manaraka: ${dateStr}, ${labelMg}`;
        if(frEl) frEl.innerText = `Prévu le ${dateStr}, ${labelFr}`;
    }

    document.addEventListener("DOMContentLoaded", () => {
        getSafeRunDelivery();
        const slides = document.querySelectorAll('.sr-slide-item');
        const banner = document.getElementById('srBanner');
        let current = 0;

        if(!slides.length || !banner) return;

        setInterval(() => {
            slides[current].classList.remove('active');
            current = (current + 1) % slides.length;
            
            // Transition de fond douce
            banner.style.background = slides[current].getAttribute('data-bg');
            slides[current].classList.add('active');
        }, 5000);
    });
})();
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
/* --- TA FONCTION MISE À JOUR (Garde le même nom pour la facture) --- */

function calculerLivraison() {
    // --- PRIORITÉ 1 : SI LE CLIENT A CHOISI UNE DATE MANUELLE ---
    // On vérifie si 'datePlanifiee' existe (choix via ouvrirPlanification)
    if (datePlanifiee) {
        const d = new Date(datePlanifiee);
        const optionsPlanif = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
        let dateLisible = d.toLocaleString('fr-FR', optionsPlanif);
        return `LIVRAISON : ${dateLisible.charAt(0).toUpperCase() + dateLisible.slice(1)}`;
    }

    // --- PRIORITÉ 2 : CALCUL AUTOMATIQUE (TON CODE D'ORIGINE) ---
    const maintenant = new Date();
    const jourSemaine = maintenant.getDay(); 
    const heure = maintenant.getHours();
    const tempsActuel = heure + (maintenant.getMinutes() / 60);
    let dateLivraison = new Date();
    let creneau = "";

    if ((jourSemaine === 6 && tempsActuel > 11) || jourSemaine === 0) {
        let joursAAjouter = (jourSemaine === 0) ? 1 : 2;
        dateLivraison.setDate(maintenant.getDate() + joursAAjouter);
        creneau = "Lundi matin (entre 9h et 11h)";
    } else {
        if (tempsActuel >= 5 && tempsActuel <= 11) {
            creneau = "cet après-midi (entre 14h et 17h)";
        } else {
            dateLivraison.setDate(maintenant.getDate() + 1);
            if (dateLivraison.getDay() === 0) { 
                dateLivraison.setDate(dateLivraison.getDate() + 1);
                creneau = "Lundi matin (entre 9h et 11h)";
            } else {
                creneau = "demain matin (entre 9h et 11h)";
            }
        }
    }

    // --- PRIORITÉ 3 : FILTRE DE SÉCURITÉ (GOOGLE SHEET) ---
    const formatISO = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    let securite = 0;
    // On décale si la date est dans le Sheet OU si c'est un dimanche
    while ((joursFermesSafeRun.includes(formatISO(dateLivraison)) || dateLivraison.getDay() === 0) && securite < 15) {
        dateLivraison.setDate(dateLivraison.getDate() + 1);
        creneau = (dateLivraison.getDay() === 1) ? "Lundi matin (entre 9h et 11h)" : "au matin (entre 9h et 11h)";
        securite++;
    }

    // --- FORMATAGE FINAL ---
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    let dateFormatee = dateLivraison.toLocaleDateString('fr-FR', options);
    
    return `LIVRAISON : ${dateFormatee.charAt(0).toUpperCase() + dateFormatee.slice(1)}, ${creneau}`;
}

function genererFactureFinale(montant, nom) {
    const container = document.getElementById('facture-container');
    const ref = "SR-" + Date.now().toString().slice(-6);
    
    // 1. Récupération du quartier enregistré
    const adresseClient = localStorage.getItem('saferun_quartier') || "Quartier à préciser";
    
    // --- ÉTAPE CRITIQUE : LE CHOIX DE LA DATE ---
    const planifManuelle = localStorage.getItem('saferun_creneau_final');
    let livraisonInfo;
    
    if (planifManuelle) {
        livraisonInfo = "LIVRAISON : " + planifManuelle;
        localStorage.removeItem('saferun_creneau_final');
    } else {
        livraisonInfo = calculerLivraison(); 
    }

    const tel = localStorage.getItem('saferun_tel') || "N/A";

    // --- ÉTAPE A : ENVOI RÉEL ---
    // IMPORTANT : On ajoute adresseClient comme 4ème argument ici !
    if (typeof traiterPaiement === "function") {
        const telNettoye = tel.replace(/\s+/g, '').replace('+261', '0');
        traiterPaiement(montant, telNettoye, livraisonInfo, adresseClient); 
    }

    // --- ÉTAPE B : VIDAGE DU PANIER (On le fait AVANT l'affichage pour être sûr) ---
    panier = []; 
    localStorage.removeItem('saferun_panier');
    if (typeof rafraichirPanier === "function") rafraichirPanier(); // Mise à jour visuelle du compteur

    // --- ÉTAPE C : HISTORIQUE LOCAL ---
    let historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
    historique.unshift({
        id: ref,
        date: new Date().toLocaleString('fr-FR'),
        produits: typeof panierMap === "function" ? panier.map(i => `${i.quantite}x ${i.nom}`).join(', ') : "Produits",
        total: montant,
        statut: "En attente",
        livraisonPrevue: livraisonInfo
    });
    localStorage.setItem('saferun_commandes', JSON.stringify(historique));

    // --- ÉTAPE D : AFFICHAGE FINAL ---
    container.innerHTML = `
        <div style="text-align:center; animation: fadeIn 0.5s;">
            <i class="fas fa-check-circle" style="font-size:3rem; color:#27ae60;"></i>
            <h2 style="margin:10px 0; color:#27ae60;">Commande Envoyée !</h2>
            
            <div id="qrcode-place" style="display:flex; justify-content:center; margin:15px 0;"></div>

            <div style="background:#f9f9f9; padding:15px; border-radius:15px; text-align:left; font-size:0.85rem; margin:15px 0; border:1px solid #eee;">
                <p><b>Réf :</b> ${ref}</p>
                <p><b>Client :</b> ${nom}</p>
                <p><b>📍 Lieu :</b> ${adresseClient}</p> 
                <hr style="border:none; border-top:1px dashed #ccc; margin:10px 0;">
                <p style="color:#d35400; font-weight:bold;"><i class="fas fa-truck"></i> ${livraisonInfo}</p>
            </div>

            <button onclick="location.href=location.pathname" style="width:100%; background:#333; color:white; border:none; padding:16px; border-radius:12px; font-weight:bold; cursor:pointer;">
                RETOUR À L'ACCUEIL
            </button>
        </div>
    `;

    // Génération du QR Code
    if (document.getElementById("qrcode-place")) {
        new QRCode(document.getElementById("qrcode-place"), {
            text: `REF:${ref}|TOTAL:${montant}`,
            width: 120, height: 120
        });
    }
}

async function synchroniserAchats() {
    let historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
    if (historique.length === 0) return;

    try {
        const response = await fetch(`${API_URL}?action=getCommandes&t=${Date.now()}`);
        const commandesSheet = await response.json();

        let modification = false;

        historique.forEach(maCmd => {
            // 1. On prépare l'ID local (ex: SR-123456)
            const idLocal = String(maCmd.id || maCmd.ID || "").trim();
            const chiffresLocaux = idLocal.replace(/\D/g, "");

            // 2. Recherche dans les données du Sheet
            const match = commandesSheet.find(c => {
                const idSheet = String(c.ID || c.id || "").trim();
                const chiffresSheet = idSheet.replace(/\D/g, "");
                
                // Correspondance exacte OU par chiffres (avec tolérance de 5 pour Date.now)
                return idSheet === idLocal || 
                       (chiffresSheet !== "" && (chiffresSheet === chiffresLocaux || Math.abs(parseInt(chiffresSheet) - parseInt(chiffresLocaux)) < 5));
            });

            if (match) {
                // 3. On récupère le statut et on le nettoie (Majuscules + sans espaces)
                const statutSheet = String(match.Statut || match.statut || "").toUpperCase().trim();

                // 4. VERIFICATION : On ajoute "PAYÉ" à la liste des succès
                if (statutSheet.includes("SÉRIEUX") || 
                    statutSheet.includes("VALIDE") || 
                    statutSheet.includes("PAYÉ")) {
                    
                    if (maCmd.statut !== "VALIDÉ") {
                        maCmd.statut = "VALIDÉ"; // On harmonise en majuscules
                        // On garde l'ID officiel du Sheet pour le reçu
                        maCmd.id = match.ID || match.id || maCmd.id; 
                        modification = true;
                    }
                }
            }
        });

        if (modification) {
            localStorage.setItem('saferun_commandes', JSON.stringify(historique));
        }
    } catch (e) {
        console.error("Erreur synchro:", e);
    }
}


async function ouvrirAchatsValides() {
    document.body.classList.remove('sidebar-open');
    await synchroniserAchats();

    const historique = JSON.parse(localStorage.getItem('saferun_commandes') || "[]");
    const valides = historique.filter(cmd => {
  // On harmonise le texte du statut
  const s = String(cmd.statut || cmd.Statut || "").toUpperCase().trim();
  // On affiche le reçu si c'est l'un de ces 3 mots
  return s === "VALIDÉ" || s === "SÉRIEUX" || s === "PAYÉ";
});

    let html = `
        <div style="padding:15px; text-align:center;">
            <h3 style="margin-bottom:20px;"><i class="fas fa-receipt"></i> Mes Reçus</h3>
            <div style="max-height:400px; overflow-y:auto;">`;

    if (valides.length === 0) {
        html += `
            <div style="padding:30px; border:2px dashed #eee; border-radius:20px; color:#888;">
                <p>Aucune commande validée pour le moment.</p>
            </div>`;
    } else {
        valides.forEach(cmd => {
            const montant = cmd.Montant || cmd.montant || cmd.total || 0;
            html += `
                <div class="recu-card">
                    <div class="recu-header">
                        <div>
                            <small style="color:#aaa; display:block;">REF</small>
                            <b>#${cmd.id}</b>
                        </div>
                        <div class="recu-status">CONFIRMÉ</div>
                    </div>
                    <p style="font-size:0.85rem; color:#666; margin:10px 0;">${cmd.produits}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f9f9f9; pt:10px; padding-top:10px;">
                        <b style="color:#27ae60;">${Number(montant).toLocaleString()} Ar</b>
                        <button class="recu-details-btn" onclick="afficherRecuDetaille('${cmd.id}')">DÉTAILS</button>
                    </div>
                </div>`;
        });
    }

    html += `</div>
        <button onclick="fermerModal()" style="width:100%; padding:12px; margin-top:15px; border:none; background:#eee; border-radius:12px; cursor:pointer;">Fermer</button>
    </div>`;

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
    // CHIRURGIE : Remplace la ligne de calcul du nombre par celle-ci
const nbValides = historique.filter(cmd => {
    const s = String(cmd.statut || "").toUpperCase();
    return s === "VALIDÉ" || s === "SÉRIEUX" || s === "PAYÉ";
}).length;
    
    if (nbValides > 0) {
        badge.innerText = nbValides;
        badge.style.display = "flex";
        badge.style.background = "#27ae60"; // Vert
        badge.classList.add('pulse-alerte'); 
    } else {
        badge.style.display = "none";
    }
}
// Vérifier les achats dès l'ouverture
window.addEventListener('load', async () => {
    await synchroniserAchats();
    mettreAJourSignalValidation();
});

// Vérifier toutes les 30 secondes ET allumer le badge
setInterval(async () => {
    await synchroniserAchats();
    mettreAJourSignalValidation(); // <--- Très important pour que le signal s'allume tout seul
}, 30000);

// --- SYSTÈME D'IDENTIFICATION UNIQUE ---
// Génère ou récupère l'identifiant unique (Inscrit ou Invité)
function obtenirIdentiteChat() {
    // 1. On cherche d'abord le téléphone (c'est l'identifiant unique parfait)
    const telClient = localStorage.getItem('saferun_tel');
    if (telClient && telClient !== "") return telClient;

    // 2. Si pas de tel, on cherche si l'utilisateur a déjà un ID d'invité
    let guestId = localStorage.getItem('saferun_guest_id');
    
    // 3. Si rien n'existe du tout, on crée le GUEST ID
    if (!guestId) {
        guestId = "GUEST-" + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem('saferun_guest_id', guestId);
    }
    return guestId;
}
// 1. CONFIGURATION GLOBALE (En haut du fichier)
const scriptURL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";
let dernierNombreMessages = 0;
let indexMsg = 0;

// 2. GESTION DU BOUTON ET DES SECTIONS
function toggleChat() {
    const chatWindow = document.getElementById('chat-window');
    const promo = document.getElementById('chat-promo-container');
    
    if (chatWindow.style.display === "none" || chatWindow.style.display === "") {
        chatWindow.style.display = "flex";
        
        // On cache la promo pour ne pas encombrer l'écran ouvert
        if (promo) promo.style.display = "none";
        
        document.getElementById('chat-notif').style.display = "none";
        
        const msgContainer = document.getElementById('chat-messages');
        if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
    } else {
        chatWindow.style.display = "none";
        
        if (promo) {
            promo.style.display = "block";
            // MODIFICATION ICI : on relance l'animation de frappe
            // pour que le site redevienne "vivant" immédiatement.
            animerMessagePromo(); 
        }
    }
}

// 3. LOGIQUE DU VOLET ROULANT (BILINGUE + EFFET FRAPPE)
function obtenirMessagesSelonHeure() {
    const heure = new Date().getHours();
    
    // Ton nouveau message d'accueil (Matin)
    const messagesMatin = [
        "👋 Bienvenue chez SafeRun Market",
        "👋 Tongasoa eto amin’ny SafeRun Market",
        "Nous livrons vos produits rapidement à Tana",
        "Entana ilainao alefa haingana eto Antananarivo",
        "Besoin d’aide pour choisir ?",
        "💬 Mila fanazavana ve ianao?",
        "💬 Discutez avec nous maintenant.",
        "💬 Mifandraisa aminay izao."
    ];

    // Ton offre spéciale (Après-midi dès 14h)
    const messagesApresMidi = [
        "🎁 Offre spéciale aujourd’hui",
        "🎁 Tolotra manokana anio",
        "Livraison disponible demain matin.",
        "Afaka alefa rahampitso maraina ny entanao.",
        "Commandez maintenant pour réserver !",
        "🛒 Manaova commande dieny izao.",
        "💬 Un conseiller vous répond ici",
        "💬 Miresaha aminay ato."
    ];

    return (heure >= 14) ? messagesApresMidi : messagesMatin;
}

let isTyping = false;

function taperMessage(element, texte, callback) {
    if (!element) return;
    let i = 0;
    element.innerHTML = ""; 
    isTyping = true;
    
    function type() {
        if (i < texte.length) {
            element.innerHTML += texte.charAt(i);
            i++;
            setTimeout(type, 35); // Vitesse légèrement plus rapide pour le confort (35ms)
        } else {
            isTyping = false;
            if (callback) setTimeout(callback, 2500); // Pause avant le prochain message
        }
    }
    type();
}

function animerMessagePromo() {
    const bubble = document.getElementById('chat-promo-text');
    const chatWindow = document.getElementById('chat-window');
    
    // On vérifie si le chat est ouvert
    const isChatOpen = chatWindow && (chatWindow.style.display === "flex");

    if (isChatOpen || isTyping || !bubble) return;

    const messagesActuels = obtenirMessagesSelonHeure();
    const messageATaper = messagesActuels[indexMsg];

    bubble.style.opacity = "1";
    
    taperMessage(bubble, messageATaper, () => {
        indexMsg = (indexMsg + 1) % messagesActuels.length;
        animerMessagePromo(); 
    });
}

let quantiteZoom = 1;

function ouvrirZoomProduit(nom, prix, image, description) {
    quantiteZoom = 1; 
    let modal = document.getElementById('modal-zoom-produit');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-zoom-produit';
        modal.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:1000000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);padding:15px;";
        document.body.appendChild(modal);
    }

    const nomEchappe = nom.replace(/'/g, "\\'");
    modal.style.display = "flex";
    modal.innerHTML = `
    <div style="background:white;width:100%;max-width:400px;border-radius:30px;overflow:hidden;position:relative;box-shadow:0 20px 50px rgba(0,0,0,0.5);animation: zoomIn 0.3s ease;">
        <button onclick="this.parentElement.parentElement.style.display='none'"
                style="position:absolute;top:15px;right:15px;border:none;background:rgba(0,0,0,0.5);color:white;width:35px;height:35px;border-radius:50%;cursor:pointer;font-size:20px;z-index:10;">&times;</button>
        
        <div class="img-zoom-container" style="position: relative; overflow: hidden; width: 100%; height: 280px; background: #f0f0f0;">
            <img src="${image}" class="img-zoom-animated" style="width: 100%; height: 100%; object-fit: cover; display: block; position: relative; z-index: 1;">
            <div style="position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%); transform: skewX(-15deg); animation: refletBrillant 2s infinite; z-index: 2;"></div>
        </div>

        <div style="padding:25px; text-align:center;">
            <h2 style="margin:0;font-size:1.5rem;color:#2c3e50;font-weight:800;">${nom}</h2>
            <h3 style="color:#e67e22;margin:10px 0;font-size:1.3rem;font-weight:700;">${Number(prix).toLocaleString()} Ar</h3>
            
            <div style="background:#f8f9fa; padding:12px; border-radius:15px; margin:10px 0; text-align:left; max-height:90px; overflow-y:auto; border: 1px solid #eee;">
                <p style="margin:0; font-size:0.85rem; color:#555; line-height:1.4;">
                    <i class="fas fa-info-circle" style="color:#3498db; margin-right:5px;"></i> ${description || "Qualité garantie SafeRun."}
                </p>
            </div>

            <hr style="border:0;border-top:1px solid #eee;margin:15px 0;">
            
            <div style="display:flex;align-items:center;justify-content:center;gap:25px;margin-bottom:25px;">
                <button onclick="majQtyZoom(-1)" style="width:40px;height:40px;border-radius:50%;border:1px solid #ddd;background:#f8f9fa;font-size:1.2rem;cursor:pointer;">-</button>
                <b id="val-qty-zoom" style="font-size:1.6rem;min-width:40px;">1</b>
                <button onclick="majQtyZoom(1)" style="width:40px;height:40px;border-radius:50%;border:1px solid #ddd;background:#f8f9fa;font-size:1.2rem;cursor:pointer;">+</button>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <button onclick="discuterWhatsApp('${nomEchappe}')" 
                        onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"
                        style="padding:12px;background:#25D366;color:white;border:none;border-radius:15px;font-weight:bold;font-size:0.75rem;cursor:pointer;transition:0.3s;">
                    <i class="fab fa-whatsapp"></i> WHATSAPP
                </button>
                <button onclick="discuterDepuisZoom('${nomEchappe}')" 
                        onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"
                        style="padding:12px;background:#3498db;color:white;border:none;border-radius:15px;font-weight:bold;font-size:0.75rem;cursor:pointer;transition:0.3s;">
                    <i class="fas fa-comment-dots"></i> CHAT
                </button>
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="validerAjoutZoom('${nomEchappe}', ${prix})" 
                        onmouseover="this.style.background='#ffcc00'; this.style.color='#1a1a1a'; this.style.transform='translateY(-2px)';"
                        onmouseout="this.style.background='#27ae60'; this.style.color='#fff'; this.style.transform='translateY(0)';"
                        style="flex:2;padding:18px;background:#27ae60;color:white;border:none;border-radius:15px;font-weight:bold;font-size:0.9rem;cursor:pointer;box-shadow:0 5px 15px rgba(39,174,96,0.3);transition:all 0.3s ease;">
                    🛒 AJOUTER
                </button>
                <button onclick="document.getElementById('modal-zoom-produit').style.display='none'" 
                        style="flex:1;padding:18px;background:#f1f2f6;color:#666;border:none;border-radius:15px;font-weight:bold;font-size:0.8rem;cursor:pointer;">
                    RETOUR
                </button>
            </div>
        </div>
    </div>
    
    <style>
        @keyframes refletBrillant { 0% { left: -100%; } 100% { left: 150%; } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
    </style>
    `;
}

// Fonction pour ouvrir WhatsApp avec un message automatique
function discuterWhatsApp(produit) {
    const numero = "261382453610"; // Remplace par ton vrai numéro Marcellin
    const texte = encodeURIComponent(`Bonjour SafeRun ! Je souhaite commander : ${produit}. Pouvez-vous m'aider ?`);
    window.open(`https://wa.me/${numero}?text=${texte}`, '_blank');
}

function majQtyZoom(v) {
    quantiteZoom += v;
    if (quantiteZoom < 1) quantiteZoom = 1;
    document.getElementById('val-qty-zoom').innerText = quantiteZoom;
}

function validerAjoutZoom(nom, prix) {
    // On appelle ta fonction ajouterAuPanier autant de fois que la quantité choisie
    for(let i=0; i < quantiteZoom; i++) {
        ajouterAuPanier(nom, prix);
    }
    document.getElementById('modal-zoom-produit').style.display = 'none';
}

function discuterDepuisZoom(nom) {
    // 1. Fermer proprement le zoom
    const modalZoom = document.getElementById('modal-zoom-produit');
    if (modalZoom) modalZoom.style.display = 'none';

    // 2. Ouvrir ton interface de chat (si la fonction existe)
    if (typeof ouvrirChat === "function") {
        ouvrirChat(); 
    } else {
        // Si tu n'as pas de fonction ouvrirChat, on affiche juste le bloc chat
        const fenetreChat = document.getElementById('chat-window'); // Vérifie ton ID
        if (fenetreChat) fenetreChat.style.display = 'block';
    }

    // 3. Cibler l'input et envoyer le texte du produit
    setTimeout(() => {
        const inputChat = document.querySelector('.chat-input');
        if (inputChat) {
            inputChat.value = "Bonjour, je voudrais plus d'infos sur : " + nom;
            inputChat.focus();
            
            // Optionnel : on peut même ajouter un petit effet visuel pour montrer que c'est prêt
            inputChat.style.border = "2px solid #ffcc00";
        }
    }, 300); // Un léger délai pour laisser le temps au chat de s'ouvrir
}
async function piloterBanniereDynamique() {
    try {
        // --- 1. RÉCUPÉRATION DES DONNÉES (PARALLÈLE) ---
        const [resSign, resPub] = await Promise.all([
            fetch(`${API_URL}?action=getSignalisation`),
            fetch(`${API_URL}?action=getRemises`)
        ]);
        
        const signal = await resSign.json();
        const pubs = await resPub.json();

        // Fonction interne pour nettoyer les dates bizarres (ISO) en format simple dd/mm/yyyy
        const nettoyerDate = (dStr) => {
            if (!dStr) return "";
            const d = new Date(dStr);
            if (isNaN(d.getTime())) return dStr; // Si ce n'est pas une date ISO, on garde le texte original
            return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        // --- 2. GESTION DE LA FERMETURE (SLIDE 3) ---
        if (signal.boutiqueOuverte === "NON") {
            const dateMg = document.getElementById('sr-date-mg');
            const dateFr = document.getElementById('sr-date-fr');
            
            // Calcul automatique de la réouverture
            const parts = signal.dateFerme.split('/');
            const dateF = new Date(parts[2], parts[1] - 1, parts[0]);
            const dateR = new Date(dateF);
            dateR.setDate(dateF.getDate() + 1);
            
            const dR = dateR.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const dF = signal.dateFerme;

            // Design Compact & Professionnel Malgache
            if (dateMg) {
                dateMg.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                    <span style="background:#e74c3c; color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.8em;">LIVRAISON : PAUSE</span>
                    <span style="font-weight:bold; color:#2c3e50;">${dF}</span>
                    <span style="background:#27ae60; color:#fff; font-size:0.7em; padding:2px 8px; border-radius:15px; font-weight:bold;">✔ 24/7</span>
                </div>
                <div style="font-size:0.85em; color:#34495e; line-height:1.4;">
                    Miverina ny <b>${dR}</b>. Afaka <b>mividy foana</b> ianao izao, voaray tsara ny commande-nao.
                    <br><b style="color:#27ae60;">👉 Tohizo ny shopping-nao</b>
                </div>`;
            }
            // Design Compact & Professionnel Français
            if (dateFr) {
                dateFr.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                    <span style="background:#e74c3c; color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.8em;">LIVRAISON : PAUSE</span>
                    <span style="font-weight:bold; color:#2c3e50;">${dF}</span>
                    <span style="background:#27ae60; color:#fff; font-size:0.7em; padding:2px 8px; border-radius:15px; font-weight:bold;">✔ 24/7</span>
                </div>
                <div style="font-size:0.85em; color:#34495e; line-height:1.4;">
                    Reprise le <b>${dR}</b>. Les commandes restent <b>ouvertes 24h/7</b> : achat sécurisé.
                    <br><b style="color:#2980b9;">👉 Commandez en toute sérénité</b>
                </div>`;
            }
        }

        // --- 3. GESTION DE LA PROMO & IMAGE (SLIDE 1) ---
        if (pubs && pubs.length > 0) {
            const p = pubs[0];
            const allSlides = document.querySelectorAll('.sr-slide-item');
            const firstSlide = allSlides[0]; 

            if (firstSlide) {
                const imgElement = firstSlide.querySelector('img');
                const mainMg = firstSlide.querySelector('.sr-main-mg');
                const subFr = firstSlide.querySelector('.sr-sub-fr');
                const tag = firstSlide.querySelector('.sr-tag');

                if (mainMg) mainMg.innerText = p.titre;
                
                // Nettoyage de la date de fin pour éviter le format ISO (2026-04-19T21...)
                if (subFr) {
                    const dateFinPropre = nettoyerDate(p.dateFin);
                    subFr.innerText = dateFinPropre ? `${p.desc} — Jusqu'au ${dateFinPropre}` : p.desc;
                }

                if (tag) {
                    tag.innerText = "PROMO";
                    tag.style.background = "#e74c3c";
                }

                // FORCE LE CHANGEMENT D'IMAGE
                if (imgElement && p.image) {
                    const cacheBuster = p.image.includes('?') ? '&' : '?';
                    const finalImageUrl = p.image.trim() + cacheBuster + "t=" + new Date().getTime();
                    
                    imgElement.src = finalImageUrl;
                    imgElement.style.opacity = "0.5";
                    imgElement.onload = () => { imgElement.style.opacity = "1"; };
                }
            }
        }
    } catch (e) {
        console.error("Erreur d'affichage :", e);
    }
}

// Lancement au chargement
window.addEventListener('load', piloterBanniereDynamique);
// ==========================================
// GESTION DES AVIS CLIENTS (SAFERUN MARKET)
// ==========================================

// 1. Ouvrir/Fermer le modal d'avis
function ouvrirModalAvis() { 
    document.getElementById('modal-avis').style.display = 'flex'; 
}

function fermerModalAvis() { 
    document.getElementById('modal-avis').style.display = 'none'; 
}

// 2. Publier l'avis sur ImgBB puis sur Google Sheets
async function publierAvis() {
    const texte = document.getElementById('comm-client').value;
    const photoInput = document.getElementById('photo-client');
    const photo = photoInput.files[0];
    
    // Utilisation de ta clé de stockage exacte
    const nom = localStorage.getItem('saferun_nom') || "Client SafeRun";
    const btn = document.getElementById('btn-publier');

    // Vérification de sécurité
    if (!texte || !photo) {
        alert("Marcellin dit : N'oubliez pas le commentaire et la photo !");
        return;
    }

    // Blocage du bouton pour éviter les doubles clics
    btn.disabled = true;
    btn.innerText = "⏳ Publication...";

    try {
        // --- ÉTAPE A : Envoi de la photo vers ImgBB ---
        const formData = new FormData();
        formData.append("image", photo);
        
        const responseImg = await fetch("https://api.imgbb.com/1/upload?key=75ed3024736a6c38bb523b6226d2e933", {
            method: "POST",
            body: formData
        });
        
        if (!responseImg.ok) throw new Error("Erreur ImgBB");
        
        const dataImg = await responseImg.json();
        const finalPhotoUrl = dataImg.data.url;

        // --- ÉTAPE B : Envoi des données vers ton Google Sheet ---
        const avisPourGas = {
            action: "publierAvis",
            nom: nom,
            message: texte,
            photo: finalPhotoUrl
        };

        // Utilisation de ton API_URL déclarée en entête
        const responseSheet = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(avisPourGas)
        });

        if (responseSheet.ok) {
            alert("Merci " + nom + " ! Votre avis est bien enregistré.");
            fermerModalAvis();
            
            // Mise à jour visuelle immédiate sans recharger
            ajouterAvisAuFlux({
                nom: nom,
                message: texte,
                photo: finalPhotoUrl
            });
            
            // Réinitialisation du formulaire
            document.getElementById('comm-client').value = "";
            photoInput.value = "";
        } else {
            throw new Error("Erreur Google Sheet");
        }

    } catch (e) {
        console.error("Erreur technique:", e);
        alert("Erreur de connexion. Vérifiez votre connexion internet.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Publier";
    }
}

// 3. Charger les avis existants au démarrage du site
async function chargerAvisDepuisSheet() {
    const container = document.getElementById('display-avis-footer');
    try {
        // Appel à ton API avec l'action getAvis configurée dans ton GAS
        const res = await fetch(API_URL + "?action=getAvis");
        const avis = await res.json();
        
        if (avis && avis.length > 0) {
            container.innerHTML = ""; // On retire le message "Chargement..."
            // On affiche les 5 derniers avis
            avis.slice(0, 5).forEach(item => {
                ajouterAvisAuFlux(item);
            });
        } else {
            container.innerHTML = "<p style='font-size:0.7rem; color:#888;'>Soyez le premier à donner votre avis !</p>";
        }
    } catch (err) {
        console.log("Erreur chargement avis:", err);
        container.innerHTML = ""; 
    }
}

// 4. Ajouter l'avis visuellement dans le footer
function ajouterAvisAuFlux(data) {
    const container = document.getElementById('display-avis-footer');
    const html = `
        <div class="avis-card-footer" style="display: flex; gap: 10px; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 10px; margin-bottom: 8px; border-left: 3px solid #ffcc00;">
            <img src="${data.photo}" alt="user" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 1px solid #ffcc00;">
            <div style="text-align: left;">
                <b style="font-size:0.75rem; color:#ffcc00; display: block;">${data.nom}</b>
                <p style="font-size:0.7rem; margin:0; color: #fff; line-height: 1.2;">${data.message}</p>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('afterbegin', html);
}

// Lancer le chargement automatique
document.addEventListener('DOMContentLoaded', chargerAvisDepuisSheet);
// 4. ENVOI DE MESSAGE

async function envoyerMessageChat() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    // On récupère l'ID (GUEST ou TEL)
    const idClient = obtenirIdentiteChat(); 
    
    // CONDITION : On récupère le nom s'il existe, sinon on utilise l'ID
    const nomClient = localStorage.getItem('saferun_nom');
    const expediteurFinal = (nomClient && nomClient !== "Anonyme") ? nomClient : idClient;

    if (!message) return;

    // 1. AFFICHAGE IMMÉDIAT (UI Optimiste)
    const container = document.getElementById('chat-messages');
    container.innerHTML += `
        <div class="message client" style="background: #dcf8c6; align-self: flex-end; padding: 8px 12px; border-radius: 15px; border-bottom-right-radius: 2px; max-width: 80%; font-size: 0.9rem; margin-bottom:5px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
            ${formaterMessage(message)}
        </div>
    `;
    input.value = "";
    container.scrollTop = container.scrollHeight;

    // 2. MISE À JOUR DU COMPTEUR
    dernierNombreMessages++; 

    try {
        await fetch(scriptURL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({ 
                action: "sendChatMessage", 
                idClient: idClient, 
                expediteur: expediteurFinal, 
                message: message 
            })
        });
    } catch (e) { 
        console.error("Erreur d'envoi", e);
    }
}

async function envoyerPhotoChat() {
    const fileInput = document.getElementById('chat-file');
    if (fileInput.files.length === 0) return;

    const file = fileInput.files[0];
    const idClient = obtenirIdentiteChat(); 
    const nomClient = localStorage.getItem('saferun_nom');
    const expediteurFinal = (nomClient && nomClient !== "Anonyme") ? nomClient : idClient;

    // 1. On affiche un message temporaire pour dire que ça charge
    const container = document.getElementById('chat-messages');
    container.innerHTML += `<div class="message-bubble" style="align-self:flex-end; background:#dcf8c6; padding:8px; border-radius:10px; font-size:0.8rem; opacity:0.7;">Envoi de l'image...</div>`;
    container.scrollTop = container.scrollHeight;

    // 2. Lecture et envoi de l'image
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const base64Data = reader.result.split(',')[1]; // On récupère uniquement les données

        try {
            await fetch(scriptURL, {
                method: "POST",
                // Attention : on garde no-cors si ton GAS actuel utilise cette méthode
                mode: "no-cors", 
                body: JSON.stringify({ 
                    action: "sendChatMessage", 
                    idClient: idClient, 
                    expediteur: expediteurFinal, 
                    message: "IMAGE_SENT", // Mot-clé pour le GAS
                    image: base64Data, 
                    nomFichier: "Capture_" + idClient + "_" + Date.now() + ".jpg"
                })
            });
            fileInput.value = ""; // On vide l'input
        } catch (e) { 
            console.error("Erreur d'envoi de la photo", e);
        }
    };
}
function formaterMessage(texte) {
  if (!texte) return "";
  const t = texte.toString().trim();
  
  // 1. Détection des liens (ImgBB ou Google)
  const estLien = t.startsWith("http");
  const estGoogle = t.includes("google.com") || t.includes("googleusercontent.com");

  if (estLien) {
    let lienAffichage = t;

    // Si c'est un ancien lien Google, on garde ta logique de conversion
    if (estGoogle) {
      lienAffichage = t.replace("view", "download").replace("open", "download");
    }

    return `
      <div class="chat-image-container" style="margin-top: 5px;">
        <img src="${lienAffichage}" 
             alt="Photo jointe" 
             style="max-width:100%; border-radius:10px; cursor:pointer; display:block; box-shadow: 0 1px 3px rgba(0,0,0,0.2);" 
             onclick="window.open('${t}')"
             onerror="this.onerror=null; this.src='https://placehold.co/200x150?text=Image+en+chargement...'">
        <span style="font-size:0.65rem; color:#888; display:block; margin-top:2px;">
          <i class="fas fa-search-plus"></i> Cliquez pour agrandir
        </span>
      </div>`;
  }

  // 2. Si c'est du texte normal, on le renvoie tel quel
  return t;
}
// 5. RÉCEPTION DES MESSAGES (Toutes les 5 secondes)
async function chargerMessagesChat() {
    const idClient = obtenirIdentiteChat(); 
    const chatWindow = document.getElementById('chat-window');

    try {
        const response = await fetch(`${scriptURL}?action=readChat&idClient=${idClient}`);
        const messages = await response.json();

        if (messages.length !== dernierNombreMessages) {
            const container = document.getElementById('chat-messages');
            if (!container) return;
            
            container.innerHTML = ""; 
            
            messages.forEach(msg => {
                const estAdmin = (msg.expediteur === "Admin" || msg.expediteur === "Support");
                const styleBulle = estAdmin ? 
                    "background:white; align-self:flex-start; border-bottom-left-radius:2px;" : 
                    "background:#dcf8c6; align-self:flex-end; border-bottom-right-radius:2px;";

                const dateMsg = new Date(msg.date);
                const heure = dateMsg.getHours().toString().padStart(2, '0') + ":" + dateMsg.getMinutes().toString().padStart(2, '0');

                // --- RENDU DU MESSAGE (TEXTE OU IMAGE VIA IMGBB/DRIVE) ---
                const contenuMessage = formaterMessage(msg.message);

                container.innerHTML += `
                    <div class="message-bubble" style="max-width:80%; padding:8px 12px; border-radius:15px; margin-bottom:8px; font-size:0.9rem; box-shadow:0 1px 2px rgba(0,0,0,0.1); display:flex; flex-direction:column; ${styleBulle}">
                        ${contenuMessage}
                        <div style="font-size:0.65rem; color:#888; text-align:right; margin-top:3px;">${heure}</div>
                    </div>
                `;
            });

            // Gestion du badge de notification
            if (chatWindow && chatWindow.style.display !== "flex" && dernierNombreMessages !== 0) {
                const badge = document.getElementById('chat-notif');
                if (badge) {
                    badge.style.display = "flex";
                    badge.innerText = messages.length - dernierNombreMessages;
                }
            }

            dernierNombreMessages = messages.length;
            container.scrollTop = container.scrollHeight;
        }
    } catch (e) { 
        console.log("Erreur synchro chat client:", e); 
    }
}

setInterval(chargerMessagesChat, 3000);
// Lancement sécurisé une fois que tout le HTML est chargé
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(animerMessagePromo, 2000);
});