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
 
// =========================================================================
// MODULE DE CHAT (branché sur le Google Apps Script : feuille "Chat")
// - envoi : action "sendChatMessage" (texte ou photo, la photo part sur Cloudinary côté script)
// - réception : action "readChat" (affiche aussi les réponses de l'admin et de l'assistante)
// - l'historique local "saferun_chat_history" reste partagé avec la page d'accueil
// Tout est dans une fonction isolée : aucun risque de conflit de noms avec main.js
// =========================================================================
(function () {
    const API_URL = "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";
    const CLE_HISTORIQUE = "saferun_chat_history";
    const INTERVALLE_MS = 10000;   // vérification des nouvelles réponses quand le chat est ouvert
    let timer = null;
 
    /* ------------------------------ Outils ------------------------------ */
 
    // Identité du client : EXACTEMENT la même règle que la page d'accueil (téléphone, sinon GUEST-xxxx)
    // → une seule conversation par client, quelle que soit la page utilisée.
    function idClient() {
        // Si main.js est chargé sur la page, on utilise directement sa fonction (garantie d'identité unique)
        if (typeof window.obtenirIdentiteChat === "function") {
            try { return window.obtenirIdentiteChat(); } catch (e) {}
        }
        // Sinon : copie fidèle de la même règle
        try {
            const telClient = localStorage.getItem('saferun_tel');
            if (telClient && telClient !== "") return telClient;
 
            let guestId = localStorage.getItem('saferun_guest_id');
            if (!guestId) {
                guestId = "GUEST-" + Math.floor(1000 + Math.random() * 9000);
                localStorage.setItem('saferun_guest_id', guestId);
            }
            return guestId;
        } catch (e) {
            return "GUEST-" + Math.floor(1000 + Math.random() * 9000);
        }
    }
 
    function lireHistorique() {
        try { return JSON.parse(localStorage.getItem(CLE_HISTORIQUE) || "[]"); } catch (e) { return []; }
    }
 
    function ecrireHistorique(liste) {
        try { localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(liste)); } catch (e) {
            console.warn("[SafeRun] Mémoire locale pleine : l'historique du chat n'a pas pu être sauvegardé.");
        }
    }
 
    function estImage(texte) {
        return /^data:image/.test(texte) ||
               /^https?:\/\/res\.cloudinary\.com\//i.test(texte) ||
               /^https?:\/\/\S+\.(png|jpe?g|webp|gif)(\?\S*)?$/i.test(texte);
    }
 
    // Réduit la photo avant envoi (max 1024 px, JPEG) : plus rapide et ne remplit pas la mémoire du téléphone
    function reduireImage(file, maxCote, qualite) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const ratio = Math.min(1, maxCote / Math.max(img.width, img.height));
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.round(img.width * ratio);
                    canvas.height = Math.round(img.height * ratio);
                    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/jpeg", qualite));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
 
    // Bulle de discussion (mêmes styles qu'avant) ; variante "marche" pour la page d'accueil
    function creerBulle(msg, variante) {
        const client = msg.expediteur === "client";
        const bulle = document.createElement("div");
        const texte = String(msg.texte || "");
 
        if (variante === "marche") {
            bulle.className = client ? "message msg-client" : "message msg-admin";
            bulle.style.marginBottom = "10px";
        } else {
            bulle.style.maxWidth = "75%";
            bulle.style.background = client ? "#dcf8c6" : "#ffffff";
        }
        bulle.style.position = "relative";
        bulle.style.padding = "8px 12px";
        bulle.style.fontSize = "0.92rem";
        bulle.style.lineHeight = "1.4";
        bulle.style.wordWrap = "break-word";
        bulle.style.borderRadius = client ? "15px 15px 0 15px" : "15px 15px 15px 0";
        bulle.style.alignSelf = client ? "flex-end" : "flex-start";
        bulle.style.boxShadow = "0 1px 1px rgba(0,0,0,0.1)";
 
        if (estImage(texte)) {
            const img = document.createElement("img");
            img.src = texte;
            img.style.cssText = "max-width: 100%; border-radius: 10px; display: block; margin-top: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);";
            bulle.appendChild(img);
        } else {
            bulle.textContent = texte;
        }
        return bulle;
    }
 
    /* ------------------------- Affichage du chat ------------------------- */
 
    // Charger et afficher l'historique de discussion partagé (fenêtre de la boutique)
    window.chargerHistoriqueMessagesPartages = function () {
        const msgContainer = document.getElementById('chat-messages');
        if (!msgContainer) return;
 
        const historiqueBrut = localStorage.getItem(CLE_HISTORIQUE);
        let historique = [];
        try { historique = historiqueBrut ? JSON.parse(historiqueBrut) : []; } catch (e) { historique = []; }
        if (!historique.length) {
            historique = [{ expediteur: "admin", texte: "Manao ahoana! Inona no afaka ampiana anao?" }]; // Message d'accueil par défaut
        }
 
        msgContainer.innerHTML = "";
        historique.forEach(msg => msgContainer.appendChild(creerBulle(msg, "boutique")));
        msgContainer.scrollTop = msgContainer.scrollHeight;   // défilement automatique vers le bas
    };
 
    // Synchronisation du chat sur le marché principal (index.html)
    window.synchroniserChatSurMarchePrincipal = function () {
        const msgContainerMarche = document.getElementById('chat-messages');
        if (!msgContainerMarche || window.location.search.includes('type=')) return;
 
        const historiqueBrut = localStorage.getItem(CLE_HISTORIQUE);
        if (!historiqueBrut) return;
        let historique = [];
        try { historique = JSON.parse(historiqueBrut); } catch (e) { return; }
 
        msgContainerMarche.innerHTML = "";
        historique.forEach(msg => msgContainerMarche.appendChild(creerBulle(msg, "marche")));
        msgContainerMarche.scrollTop = msgContainerMarche.scrollHeight;
    };
 
    function rafraichirAffichage() {
        window.chargerHistoriqueMessagesPartages();
        window.synchroniserChatSurMarchePrincipal();
    }
 
    /* --------------------------- Réception serveur --------------------------- */
 
    function rafraichirDepuisServeur() {
        return fetch(API_URL + "?action=readChat&idClient=" + encodeURIComponent(idClient()))
            .then(r => r.json())
            .then(liste => {
                if (!Array.isArray(liste) || !liste.length) return;
 
                const serveur = liste.map(m => ({
                    expediteur: String(m.expediteur || "").toLowerCase().includes("admin") ? "admin" : "client",
                    texte: String(m.message || ""),
                    date: m.date
                }));
 
                // On garde les messages envoyés depuis moins d'une minute que le serveur n'a pas encore renvoyés
                const enAttente = lireHistorique().filter(m =>
                    m.pending &&
                    (Date.now() - new Date(m.date).getTime()) < 60000 &&
                    !serveur.some(s => s.expediteur === "client" && s.texte === m.texte)
                );
 
                ecrireHistorique(serveur.concat(enAttente));
                rafraichirAffichage();
            })
            .catch(err => console.warn("[SafeRun] Lecture du chat impossible pour l'instant.", err));
    }
 
    /* ----------------------------- Envoi serveur ----------------------------- */
 
    function envoyerAuServeur(extra) {
        const corps = Object.assign({
            action: "sendChatMessage",      // l'action réellement lue par votre Apps Script
            idClient: idClient(),
            expediteur: "Client"
        }, extra);
 
        return fetch(API_URL, {
            method: "POST",
            mode: "no-cors",                // évite les blocages CORS ; la réponse n'est pas lisible
            body: JSON.stringify(corps)
        }).catch(err => console.warn("[SafeRun] Erreur d'envoi du message au serveur.", err));
    }
 
    function ajouterMessageLocal(texte) {
        const historique = lireHistorique();
        historique.push({ expediteur: "client", texte: texte, date: new Date().toISOString(), pending: true });
        ecrireHistorique(historique);
        rafraichirAffichage();
    }
 
    // Ouvrir ou fermer la fenêtre de discussion
    window.toggleChatExtension = function () {
        const chatWindow = document.getElementById('chat-window');
        if (!chatWindow) return;
 
        if (chatWindow.style.display === "none" || chatWindow.style.display === "") {
            chatWindow.style.display = "flex";
            window.chargerHistoriqueMessagesPartages();
            rafraichirDepuisServeur();
            if (!timer) timer = setInterval(rafraichirDepuisServeur, INTERVALLE_MS);
        } else {
            chatWindow.style.display = "none";
            if (timer) { clearInterval(timer); timer = null; }
        }
    };
 
    // Envoi d'un message texte
    window.envoyerMessageChatExtension = function () {
        const input = document.getElementById("chat-input");
        if (!input || !input.value.trim()) return;
 
        const texteMessage = input.value.trim();
        input.value = "";
        ajouterMessageLocal(texteMessage);   // affichage immédiat côté client
 
        envoyerAuServeur({ message: texteMessage })
            .then(() => setTimeout(rafraichirDepuisServeur, 2000));
    };
 
    // Envoi d'une photo (réduite avant envoi, puis hébergée par le script sur Cloudinary)
    window.envoyerPhotoChatExtension = function (event) {
        const file = event.target.files[0];
        if (!file || !/^image\//.test(file.type)) return;
 
        reduireImage(file, 1024, 0.7)
            .then(dataUrl => {
                ajouterMessageLocal(dataUrl);
                return envoyerAuServeur({ image: dataUrl, message: "" });
            })
            .then(() => setTimeout(rafraichirDepuisServeur, 4000))
            .catch(err => console.warn("[SafeRun] Photo illisible.", err));
 
        event.target.value = "";   // permet de renvoyer la même photo plus tard
    };
 
    // Mise à jour en direct quand une autre page/onglet modifie l'historique
    window.addEventListener('storage', (e) => {
        if (e.key === CLE_HISTORIQUE) rafraichirAffichage();
    });
 
    // Synchronisation initiale après un court instant pour laisser le temps à main.js de s'initialiser
    setTimeout(window.synchroniserChatSurMarchePrincipal, 1000);
})();
 
