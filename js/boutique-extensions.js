(function() {
    const IMAGES_DEMO_BOUTIQUES = {
        "VETEMENTS": "https://i.imgur.com/jKHHTgl.jpeg", 
        "CHAUSSURES": "https://i.imgur.com/Fo4VcB7.jpeg",
        "DEFAUT": "https://i.imgur.com/L5uiDsH.png"
    };

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

    window.genererMenuDropdownBoutiques = function(tousLesProduits) {
        const dropdown = document.getElementById("liste-dropdown-boutiques");
        if (!dropdown) return;
        let boutiques = ["VETEMENTS", "CHAUSSURES"]; // Boutiques par défaut

        dropdown.innerHTML = "";
        boutiques.forEach(b => {
            const nomPropre = b.charAt(0) + b.slice(1).toLowerCase();
            const urlImage = IMAGES_DEMO_BOUTIQUES[b] || IMAGES_DEMO_BOUTIQUES["DEFAUT"];
            const item = document.createElement("a");
            item.href = `boutique.html?type=${nomPropre}`;
            item.style = "display:flex; justify-content:space-between; align-items:center; padding:10px 15px; color:#1a1a1a; text-decoration:none; font-size:0.85rem; font-weight:600; border-bottom:1px solid #f9f9f9;";
            item.innerHTML = `<div><span>Espace ${nomPropre}</span></div><img src="${urlImage}" style="width:28px; height:28px; object-fit:contain; margin-left:10px;">`;
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

// 📸 GESTION ET ENVOI DE PHOTOS AU SHEET DEPUIS LE CHAT
window.envoyerPhotoChatExtension = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Image = e.target.result; // Conversion de l'image en texte sécurisé

        // Étape A : Affichage dans le chat local
        const historique = JSON.parse(localStorage.getItem("saferun_chat_history") || "[]");
        historique.push({ expediteur: "client", texte: "📷 [Image envoyée]" });
        localStorage.setItem("saferun_chat_history", JSON.stringify(historique));
        window.chargerHistoriqueMessagesPartages();

        // Étape B : Envoi de la photo convertie au Google Sheet
        const API_URL = "https://google.com";
        
        fetch(API_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({
                action: "envoiPhotoChat",
                image: base64Image,
                nom: document.getElementById("side-user-nom") ? document.getElementById("side-user-nom").innerText : "Client"
            })
        });
    };
    reader.readAsDataURL(file);
};

