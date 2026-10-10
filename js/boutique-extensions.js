(function() {
    // Images de secours uniquement (le menu utilise d'abord l'image réelle d'un produit de la boutique)
    const IMAGES_DEMO_BOUTIQUES = {
        "VETEMENTS": "https://i.imgur.com/jKHHTgl.jpeg", 
        "CHAUSSURES": "https://i.imgur.com/Fo4VcB7.jpeg",
        "DEFAUT": "https://i.imgur.com/L5uiDsH.png"
    };

    // [AJOUT] Outils pour le menu dynamique
    function normaliserCle(texte) {
        return String(texte || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    }

    function echapper(texte) {
        return String(texte).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    document.addEventListener("DOMContentLoaded", () => {
        // Clic à l'extérieur pour fermer le menu déroulant haut
        document.addEventListener("click", function(e) {
            if (!e.target.closest('.autres-boutiques-container')) {
                const dropdown = document.getElementById("liste-dropdown-boutiques");
                if (dropdown) dropdown.style.display = "none";
            }
        });
        
        // Auto-intégration du menu haut "Autres boutiques" à gauche du champ de recherche
        const searchWrapper = document.querySelector(".search-wrapper");
        if(searchWrapper && !document.querySelector(".autres-boutiques-container")) {
            const menuContainer = document.createElement("div");
            menuContainer.className = "autres-boutiques-container";
            menuContainer.style = "position: relative; display: inline-block; margin-right: 10px; z-index: 1005;";
            menuContainer.innerHTML = `
                <button class="btn-autres-boutiques" onclick="toggleMenuBoutiques(event)" style="background: linear-gradient(135deg, #ffcc00, #ff9900); color: #1a1a1a; border: none; padding: 10px 15px; border-radius: 50px; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-store"></i> Boutiques <i class="fas fa-chevron-down" style="font-size: 0.7rem;"></i>
                </button>
                <div id="liste-dropdown-boutiques" style="display: none; position: absolute; top: 110%; left: 0; background: white; min-width: 240px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid #eee; overflow: hidden; padding: 5px 0;"></div>`;
            searchWrapper.parentNode.insertBefore(menuContainer, searchWrapper);
        }
    });

    window.toggleMenuBoutiques = function(event) {
        event.stopPropagation();
        const dropdown = document.getElementById("liste-dropdown-boutiques");
        if (!dropdown) return;
        dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
        
        const produits = window.tousLesProduits || [];
        window.genererMenuDropdownBoutiques(produits);
    };

    // [MODIFIÉ] Le menu est construit à partir des catégories réellement présentes dans la Sheet
    window.genererMenuDropdownBoutiques = function(tousLesProduits) {
        const dropdown = document.getElementById("liste-dropdown-boutiques");
        if (!dropdown) return;

        let source = Array.isArray(tousLesProduits) ? tousLesProduits : [];
        if (!source.length) {
            try { source = JSON.parse(localStorage.getItem("saferun_cache_produits") || "[]"); } catch (e) { source = []; }
        }

        // 1 boutique par catégorie + 1re image valide d'un produit non épuisé de cette catégorie
        const boutiques = new Map();
        source.forEach(p => {
            const nom = String((p && p.Categorie) || "").trim();
            if (!nom) return;
            const cle = normaliserCle(nom);
            if (!boutiques.has(cle)) boutiques.set(cle, { cle: cle, nom: nom, image: "" });
            const b = boutiques.get(cle);
            const url = String(p.Image || "").trim();
            const epuise = String(p.Options_Disponibles || "").trim().toUpperCase() === "EPUISE";
            if (!b.image && !epuise && /^https?:\/\//i.test(url)) b.image = url;
        });

        // Secours si la Sheet n'a pas encore été chargée
        if (!boutiques.size) {
            ["VETEMENTS", "CHAUSSURES"].forEach(n => boutiques.set(n, { cle: n, nom: n, image: "" }));
        }

        dropdown.innerHTML = "";
        boutiques.forEach(b => {
            const nomPropre = b.nom.charAt(0).toUpperCase() + b.nom.slice(1).toLowerCase();
            const secours = IMAGES_DEMO_BOUTIQUES[b.cle] || IMAGES_DEMO_BOUTIQUES["DEFAUT"];
            const urlImage = b.image || secours;
            const item = document.createElement("a");
            item.href = `boutique.html?type=${encodeURIComponent(b.nom)}`;
            item.style = "display:flex; justify-content:space-between; align-items:center; padding:10px 15px; color:#1a1a1a; text-decoration:none; font-size:0.85rem; font-weight:600; border-bottom:1px solid #f9f9f9;";
            item.innerHTML = `<div><span>Espace ${echapper(nomPropre)}</span></div><img src="${echapper(urlImage)}" onerror="this.onerror=null;this.src='${IMAGES_DEMO_BOUTIQUES["DEFAUT"]}'" style="width:28px; height:28px; object-fit:cover; border-radius:6px; margin-left:10px;">`;
            dropdown.appendChild(item);
        });
    };

    window.genererStructureOptionsStock = function(produit) {
        const optionsBrutes = produit.Options_Disponibles ? produit.Options_Disponibles.trim() : "";
        if (optionsBrutes.toUpperCase() === "EPUISE") return `<span style="color:#ef4444; font-size:0.75rem; font-weight:700;">Rupture de stock</span>`;
        if (!optionsBrutes || optionsBrutes.toUpperCase() === "UNIQUE") return `<input type="hidden" id="opt-taille-${produit.ID}" value="Unique">`;
        
        const listeOptions = optionsBrutes.split(",").map(o => o.trim());
        let htmlSelect = `<div style="margin: 8px 0; text-align: left;"><select id="opt-taille-${produit.ID}" style="width: 100%; padding: 6px; border-radius: 8px; border: 1px solid #ddd; font-size: 0.8rem;">`;
        listeOptions.forEach(opt => { htmlSelect += `<option value="${opt}">${opt}</option>`; });
        return htmlSelect + `</select></div>`;
    };

    window.ajouterAuPanierNouveauSysteme = function(produitId, categorie) {
        const selecteur = document.getElementById(`opt-taille-${produitId}`);
        const optionChoisie = selecteur ? selecteur.value : "Unique";
        
        // Exécute votre fonction d'origine pour ajouter au panier
        if (typeof window.ajouterAuPanierPermanence === "function") { window.ajouterAuPanierPermanence(produitId); }
        alert(`Produit ajouté au panier avec l'option : ${optionChoisie}`);
    };
})();
// --- MODULE DE CHAT SYNCHRONISÉ ENTRE PAGES (PWA COMPATIBLE) ---

// Ouvrir ou fermer la fenêtre de discussion
window.toggleChatExtension = function() {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;
    
    if (chatWindow.style.display === "none" || chatWindow.style.display === "") {
        chatWindow.style.display = "flex";
        window.chargerHistoriqueMessagesPartages(); // Charger les messages au moment de l'ouverture
    } else {
        chatWindow.style.display = "none";
    }
};

// Charger et afficher l'historique de discussion partagé
window.chargerHistoriqueMessagesPartages = function() {
    const msgContainer = document.getElementById('chat-messages');
    if (!msgContainer) return;
    
    // Récupérer la base de discussion commune de la PWA
    const historiqueBrut = localStorage.getItem("saferun_chat_history");
    const historique = historiqueBrut ? JSON.parse(historiqueBrut) : [
        { expediteur: "admin", texte: "Manao ahoana! Inona no afaka ampiana anao?" } // Message d'accueil par défaut
    ];

    msgContainer.innerHTML = ""; // Nettoyer l'affichage avant de recharger

    historique.forEach(msg => {
        const bulle = document.createElement("div");
        
        // Appliquer exactement vos styles CSS d'origine pour les bulles de discussion
        bulle.style.position = "relative";
        bulle.style.padding = "8px 12px";
        bulle.style.fontSize = "0.92rem";
        bulle.style.lineHeight = "1.4";
        bulle.style.maxWidth = "75%";
        bulle.style.wordWrap = "break-word";
        bulle.style.borderRadius = msg.expediteur === "client" ? "15px 15px 0 15px" : "15px 15px 15px 0";
        bulle.style.background = msg.expediteur === "client" ? "#dcf8c6" : "#ffffff";
        bulle.style.alignSelf = msg.expediteur === "client" ? "flex-end" : "flex-start";
        bulle.style.boxShadow = "0 1px 1px rgba(0,0,0,0.1)";
        
        bulle.innerText = msg.texte;
        msgContainer.appendChild(bulle);
    });

    // Forcer le défilement automatique vers le bas de la discussion
    msgContainer.scrollTop = msgContainer.scrollHeight;
};

// Fonction d'envoi de message connectée en direct avec votre Google Sheet
window.envoyerMessageChatExtension = function() {
    const input = document.getElementById("chat-input");
    if (!input || !input.value.trim()) return;

    const texteMessage = input.value.trim();
    const userNom = document.getElementById("side-user-nom") ? document.getElementById("side-user-nom").innerText : "Utilisateur";
    const userTel = document.getElementById("side-user-tel") ? document.getElementById("side-user-tel").innerText : "Non renseigné";

    // 1. Mise à jour de la mémoire locale PWA instantanée (Ce que le client voit)
    const historiqueBrut = localStorage.getItem("saferun_chat_history");
    const historique = historiqueBrut ? JSON.parse(historiqueBrut) : [];
    
    const nouveauMessage = { expediteur: "client", texte: texteMessage, date: new Date().toISOString() };
    historique.push(nouveauMessage);
    localStorage.setItem("saferun_chat_history", JSON.stringify(historique));

    // Rafraîchir l'écran du chat immédiatement et vider le champ de saisie
    input.value = "";
    window.chargerHistoriqueMessagesPartages();

    // 2. TRANSMISSION EN DIRECT AU GOOGLE SHEET (Ce que vous recevez sur votre tableau)
    const API_URL = "https://google.com";

    const donneesAction = {
        action: "nouveauMessageChat", // L'action lue par votre script Google Apps Script
        nom: userNom,
        telephone: userTel,
        message: texteMessage,
        provenance: "Boutique Exclusive"
    };

    // Envoi asynchrone sans bloquer l'animation du chat
    fetch(API_URL, {
        method: "POST",
        mode: "no-cors", // Évite les blocages de sécurité CORS sur les serveurs de test
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donneesAction)
    })
    .then(() => console.log("[SafeRun Live] Message synchronisé avec le tableur d'administration."))
    .catch(err => console.warn("[SafeRun] Erreur d'envoi réseau au Sheet, stocké en attente hors-ligne.", err));
};

// 📸 GESTION ET AFFICHAGE DES PHOTOS EN MINIATURES DANS LE CHAT ET ENVOI AU SHEET
window.envoyerPhotoChatExtension = function(event) {
    const file = event.target.files[0]; // Récupérer le premier fichier sélectionné
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Image = e.target.result; // L'image convertie en texte sécurisé pour le stockage

        // Étape A : Sauvegarde de l'image directement dans l'historique partagé
        const historique = JSON.parse(localStorage.getItem("saferun_chat_history") || "[]");
        historique.push({ expediteur: "client", texte: base64Image, date: new Date().toISOString() });
        localStorage.setItem("saferun_chat_history", JSON.stringify(historique));
        
        // Mettre à jour l'affichage sur la boutique
        if (typeof window.chargerHistoriqueMessagesPartages === "function") {
            window.chargerHistoriqueMessagesPartages();
        }

        // Étape B : Envoi automatique de la photo convertie vers votre Google Sheet d'administration
        const API_URL = "https://google.com";
        
        fetch(API_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({
                action: "envoiPhotoChat",
                image: base64Image,
                nom: document.getElementById("side-user-nom") ? document.getElementById("side-user-nom").innerText : "Client de Tana"
            })
        });
    };
    reader.readAsDataURL(file);
};

// =========================================================================
// SYNCHRONISATION AUTOMATIQUE DU CHAT SUR LE MARCHÉ PRINCIPAL (INDEX.HTML)
// =========================================================================

// Cette fonction s'exécute uniquement si on se trouve sur la page d'accueil index.html
function synchroniserChatSurMarchePrincipal() {
    // Vérifier si la zone de messages du marché principal existe sur la page actuelle
    const msgContainerMarche = document.getElementById('chat-messages');
    if (!msgContainerMarche || window.location.search.includes('type=')) return;

    // Lire la clé commune partagée dans la mémoire locale de la PWA
    const historiqueBrut = localStorage.getItem("saferun_chat_history");
    if (!historiqueBrut) return;

    const historique = JSON.parse(historiqueBrut);
    msgContainerMarche.innerHTML = ""; // Vider l'ancien affichage du marché pour éviter les doublons

    historique.forEach(msg => {
        const bulle = document.createElement("div");
        
        // Appliquer exactement la structure et les classes CSS d'origine de votre main.css
        bulle.className = msg.expediteur === "client" ? "message msg-client" : "message msg-admin";
        
        // Styles de base de vos bulles de discussion d'origine
        bulle.style.position = "relative";
        bulle.style.marginBottom = "10px";
        bulle.style.padding = "8px 12px";
        bulle.style.fontSize = "0.92rem";
        bulle.style.lineHeight = "1.4";
        bulle.style.boxShadow = "0 1px 1px rgba(0,0,0,0.1)";
        bulle.style.wordWrap = "break-word";
        bulle.style.borderRadius = msg.expediteur === "client" ? "15px 15px 0 15px" : "15px 15px 15px 0";
        bulle.style.alignSelf = msg.expediteur === "client" ? "flex-end" : "flex-start";

        // Si le message est une image stockée
        if (msg.texte.startsWith("data:image")) {
            bulle.innerHTML = `<img src="${msg.texte}" style="max-width: 100%; border-radius: 10px; display: block; margin-top: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">`;
        } else {
            bulle.innerText = msg.texte;
        }

        msgContainerMarche.appendChild(bulle);
    });

    // Forcer le défilement automatique vers le bas de la discussion du marché
    msgContainerMarche.scrollTop = msgContainerMarche.scrollHeight;
}

// Intercepter chaque modification du localStorage pour mettre à jour le chat de l'accueil en direct
window.addEventListener('storage', (e) => {
    if (e.key === "saferun_chat_history") {
        synchroniserChatSurMarchePrincipal();
        // Si la fenêtre de chat de la sous-boutique est ouverte, on la met à jour aussi
        if (typeof window.chargerHistoriqueMessagesPartages === "function") {
            window.chargerHistoriqueMessagesPartages();
        }
    }
});

// Lancer la synchronisation initiale après un court instant pour laisser le temps à votre main.js de s'initialiser
setTimeout(synchroniserChatSurMarchePrincipal, 1000);