/* =========================================================================
   SafeRun · Module « Mes cadeaux » (greffé, il ne modifie AUCUNE fonction existante)
   - Lit les règles dans la feuille « Cadeaux » (via le script Google).
   - Feuille vide ou script non mis à jour  =>  le module ne fait rien et ne montre rien.
   - Ajoute : un bouton « Mes cadeaux » dans le menu latéral, une ligne dans le panier,
     une fenêtre de suivi (bienvenue, fidélité, parrainage).
   - Lit seulement : window.dernierTotalCalcule, localStorage (saferun_tel, saferun_nom).
   Pour le retirer : supprimer la ligne <script src="js/cadeaux.js"></script>.
   ========================================================================= */
(function () {
"use strict";
try {

var API = (typeof API_URL !== "undefined" && API_URL) ? API_URL : "https://script.google.com/macros/s/AKfycbzVMmVo9wnzWiCQowYZF775QE0nXAkE74pVlmaeP6pkYeGUdfd2tWyvI1hXe_55z7_G/exec";
var CLE_PARRAIN = "saferun_parrain_code";
var etat = { donnees: null, apercu: null, dernierMontant: -1, tel: "", enCours: false };

function $(i) { return document.getElementById(i); }
function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function ar(n) { return (Math.round(Number(n) || 0)).toLocaleString("fr-FR") + " Ar"; }
function lire(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
function ecrire(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
function telPropre() { var d = lire("saferun_tel").replace(/\D/g, ""); return d.length >= 9 ? d : ""; }
function montantPanier() { var m = Number(window.dernierTotalCalcule); return isNaN(m) ? 0 : m; }

function decrire(r) {
  if (r.type === "LIVRAISON_OFFERTE") return "livraison offerte" + (r.plafond ? " (jusqu'à " + ar(r.plafond) + ")" : "");
  if (r.type === "REMISE_PCT") return "remise de " + r.valeur + " %" + (r.plafond ? " (maximum " + ar(r.plafond) + ")" : "");
  if (r.type === "REMISE_AR") return "remise de " + ar(r.valeur);
  return r.nom || "cadeau surprise";
}
function regles(decl) { return ((etat.donnees && etat.donnees.regles) || []).filter(function (r) { return r.declencheur === decl; }); }

/* ---------------- Appels serveur ---------------- */
async function charger(montant) {
  var tel = telPropre(), url = API + "?action=getCadeauxClient&t=" + Date.now();
  if (tel) url += "&tel=" + encodeURIComponent(tel) + "&nom=" + encodeURIComponent(lire("saferun_nom"));
  if (montant > 0) url += "&montant=" + Math.round(montant);
  var rep = await fetch(url), d = await rep.json();
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("format");
  return d;
}
async function rafraichir() {
  if (etat.enCours) return;
  etat.enCours = true;
  try {
    var m = montantPanier(); etat.dernierMontant = m;        // mémorisé avant l'appel : jamais de boucle si le réseau échoue
    var d = await charger(m);
    etat.tel = telPropre(); etat.donnees = d; etat.apercu = d.actif ? d.disponible || null : null;
  } catch (e) { /* silencieux : le site reste normal */ }
  etat.enCours = false;
  majMenu(); majPanier();
}

/* ---------------- Menu latéral ---------------- */
function majMenu() {
  var d = etat.donnees, nav = document.querySelector(".sidebar-nav"); if (!nav) return;
  var item = $("sr-cad-menu");
  if (!d || !d.actif) { if (item) item.remove(); return; }
  var dispo = !!(d.disponible || d.promesse);
  if (!item) {
    item = document.createElement("a"); item.id = "sr-cad-menu"; item.href = "javascript:void(0)"; item.className = "nav-item";
    item.innerHTML = '<i class="fas fa-gift"></i><div><span>Mes cadeaux</span><small>Fidélité et parrainage</small></div><span class="badge-notif" id="sr-cad-badge" style="display:none">1</span>';
    item.addEventListener("click", function () { ouvrirFenetre(); if (document.body.classList.contains("sidebar-open") && typeof toggleSidebar === "function") { try { toggleSidebar(); } catch (e) {} } });
    var wa = null; nav.querySelectorAll(".nav-item").forEach(function (a) { if (/contacterAssistance/.test(a.getAttribute("onclick") || "")) wa = a; });
    if (wa) nav.insertBefore(item, wa); else nav.appendChild(item);
  }
  var b = $("sr-cad-badge"); if (b) b.style.display = dispo ? "" : "none";
}

/* ---------------- Ligne dans le panier ---------------- */
function htmlPanier() {
  var d = etat.donnees; if (!d || !d.actif) return "";
  var m = montantPanier(), ap = etat.apercu;
  if (ap) {
    var v = ap.type === "OBJET" ? "" : ' <b>(−' + ar(ap.valeur) + ")</b>";
    return '<div style="margin-top:8px;padding:10px 12px;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:12px;color:#065f46;font-size:.8rem;font-weight:600;line-height:1.4">🎁 Cadeau : ' + esc(ap.nom) + v +
      '<div style="font-weight:500;font-size:.72rem;margin-top:2px">' + (ap.type === "OBJET" ? "Remis avec votre commande." : "Déduit du reste à payer à la livraison.") + "</div></div>";
  }
  var prochain = null;
  regles("PANIER").forEach(function (r) { if (r.seuilMin > m && (!prochain || r.seuilMin < prochain.seuilMin)) prochain = r; });
  if (!prochain) return "";
  var pct = Math.max(4, Math.min(100, Math.round(m / prochain.seuilMin * 100)));
  return '<div style="margin-top:8px;padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;color:#92400e;font-size:.78rem;font-weight:600">🎁 Plus que ' + ar(prochain.seuilMin - m) + " pour : " + esc(decrire(prochain)) +
    '<div style="height:6px;background:#fde68a;border-radius:6px;margin-top:6px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#ffcc00,#ff9900)"></div></div></div>';
}
var obs = null;
function majPanier() {
  var det = $("detail-panier"); if (!det) return;
  if (obs) obs.disconnect();
  var ancien = $("sr-cad-ligne"); if (ancien) ancien.remove();
  var box = $("panierTotalSticky"), h = htmlPanier();
  if (box && h) { var w = document.createElement("div"); w.id = "sr-cad-ligne"; w.innerHTML = h; box.appendChild(w); }
  if (obs) obs.observe(det, { childList: true });
  if (box && montantPanier() !== etat.dernierMontant) planifier();
}
var minuteur = null;
function planifier() { clearTimeout(minuteur); minuteur = setTimeout(function () { if (montantPanier() !== etat.dernierMontant) rafraichir(); }, 700); }

/* ---------------- Fenêtre « Mes cadeaux » ---------------- */
function styles() {
  if ($("sr-cad-css")) return;
  var s = document.createElement("style"); s.id = "sr-cad-css";
  s.textContent = "#sr-cad-ov{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:100002;display:none;align-items:flex-end;justify-content:center}#sr-cad-ov.on{display:flex}" +
    "#sr-cad-box{background:#f8fafc;width:100%;max-width:520px;max-height:92vh;overflow-y:auto;border-radius:24px 24px 0 0;padding:22px 18px 26px;position:relative;font-family:inherit}" +
    "@media(min-width:600px){#sr-cad-ov{align-items:center}#sr-cad-box{border-radius:24px}}" +
    "#sr-cad-box h2{margin:0 36px 4px 0;font-size:1.2rem;font-weight:800}#sr-cad-box .sub{color:#64748b;font-size:.8rem;margin-bottom:14px}" +
    "#sr-cad-x{position:absolute;right:14px;top:12px;border:0;background:#e2e8f0;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:1rem}" +
    ".sr-c{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;margin-bottom:12px}.sr-c h3{margin:0 0 6px;font-size:.92rem;font-weight:800}.sr-c p{margin:0;font-size:.8rem;color:#475569;line-height:1.5}" +
    ".sr-c.or{background:linear-gradient(135deg,#fff8db,#fff);border-color:#fcd34d}.sr-c.vert{background:#ecfdf5;border-color:#6ee7b7}" +
    ".sr-pal{display:flex;justify-content:space-between;gap:8px;font-size:.78rem;padding:6px 0;border-bottom:1px dashed #e2e8f0}.sr-pal:last-child{border:0}" +
    ".sr-bar{height:8px;background:#e2e8f0;border-radius:8px;overflow:hidden;margin:8px 0}.sr-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffcc00,#ff9900)}" +
    ".sr-code{display:inline-block;background:#1a1a1a;color:#ffcc00;font-weight:800;letter-spacing:2px;padding:8px 16px;border-radius:10px;font-size:1.05rem;margin:6px 0}" +
    ".sr-btn{border:0;border-radius:50px;padding:10px 18px;font-weight:700;font-size:.8rem;cursor:pointer;background:linear-gradient(135deg,#ffcc00,#ff9900);color:#1a1a1a;margin:4px 6px 0 0}.sr-btn.wa{background:#25d366;color:#fff}" +
    ".sr-in{border:1.5px solid #e2e8f0;border-radius:12px;padding:9px 12px;font-size:.85rem;text-transform:uppercase;width:150px;font-family:inherit}.sr-msg{font-size:.76rem;margin-top:6px;font-weight:600}";
  document.head.appendChild(s);
}
function ouvrirFenetre() {
  styles();
  var ov = $("sr-cad-ov");
  if (!ov) {
    ov = document.createElement("div"); ov.id = "sr-cad-ov";
    ov.innerHTML = '<div id="sr-cad-box" role="dialog" aria-label="Mes cadeaux"></div>';
    ov.addEventListener("click", function (e) { if (e.target === ov || (e.target.id === "sr-cad-x")) fermerFenetre(); });
    document.body.appendChild(ov);
  }
  $("sr-cad-box").innerHTML = '<button id="sr-cad-x" type="button" aria-label="Fermer">✕</button><h2>🎁 Mes cadeaux</h2><div class="sub">Chargement…</div>';
  ov.classList.add("on");
  rafraichir().then(rendreFenetre);
}
function fermerFenetre() { var ov = $("sr-cad-ov"); if (ov) ov.classList.remove("on"); }
function lienParrainage(code) { return location.href.split("#")[0].split("?")[0] + "?parrain=" + encodeURIComponent(code); }

function rendreFenetre() {
  var box = $("sr-cad-box"), ov = $("sr-cad-ov"); if (!box || !ov || !ov.classList.contains("on")) return;
  var d = etat.donnees, h = '<button id="sr-cad-x" type="button" aria-label="Fermer">✕</button><h2>🎁 Mes cadeaux</h2>';
  if (!d || !d.actif) { box.innerHTML = h + '<div class="sub">Aucune offre n\'est disponible pour le moment. Revenez bientôt !</div>'; return; }
  h += '<div class="sub">Plus vous commandez, plus vous êtes récompensé.</div>';
  if (!d.code) {                                         // pas de profil : on ne peut pas suivre les cadeaux
    h += '<div class="sr-c or"><h3>Complétez votre profil</h3><p>Pour suivre vos cadeaux et votre parrainage, enregistrez votre nom et votre numéro de téléphone.</p>' +
      (typeof ouvrirInscription === "function" ? '<button class="sr-btn" id="sr-cad-profil" type="button">Compléter mon profil</button>' : "") + "</div>";
    h += rendrePaliers(); box.innerHTML = h; branches(); return;
  }
  var hs = d.historique || { livrees: 0, actives: 0, filleulsLivres: 0, recompensesParrain: 0 };
  if (d.promesse) h += '<div class="sr-c vert"><h3>🎁 Un cadeau vous attend : ' + esc(d.promesse.nom) + '</h3><p>Il sera appliqué automatiquement à votre prochaine commande' + (d.promesse.expire ? " (valable jusqu'au " + esc(d.promesse.expire) + ")" : "") + ".</p></div>";
  else if (d.disponible) h += '<div class="sr-c vert"><h3>🎁 Cadeau disponible : ' + esc(d.disponible.nom) + '</h3><p>Il s\'applique automatiquement à votre prochaine commande.</p></div>';

  var bien = regles("BIENVENUE")[0];
  if (bien && hs.actives === 0) h += '<div class="sr-c or"><h3>👋 Cadeau de bienvenue</h3><p>Pour votre 1ʳᵉ commande' + (bien.seuilMin ? " (dès " + ar(bien.seuilMin) + ")" : "") + " : <b>" + esc(decrire(bien)) + "</b>.</p></div>";

  var fid = regles("FIDELITE").sort(function (a, b) { return a.seuilMin - b.seuilMin; });
  if (fid.length) {
    var suivant = fid.filter(function (r) { return r.seuilMin > hs.livrees; })[0];
    h += '<div class="sr-c"><h3>⭐ Fidélité</h3><p>Commandes livrées : <b>' + hs.livrees + "</b></p>";
    if (suivant) { var avant = Math.max(0, suivant.seuilMin - 1 - hs.livrees), base = Math.max(1, suivant.seuilMin - 1); h += '<div class="sr-bar"><i style="width:' + Math.min(100, Math.round(hs.livrees / base * 100)) + '%"></i></div><p>' + (avant === 0 ? "🎉 Votre prochaine commande est une commande cadeau !" : "Encore " + avant + " commande" + (avant > 1 ? "s" : "") + " livrée" + (avant > 1 ? "s" : "") + " avant votre prochain cadeau.") + "</p>"; }
    fid.forEach(function (r) { h += '<div class="sr-pal"><span>' + r.seuilMin + "ᵉ commande : " + esc(decrire(r)) + "</span><span>" + (hs.livrees >= r.seuilMin ? "✔ obtenu" : hs.livrees + 1 === r.seuilMin ? "← la prochaine" : "") + "</span></div>"; });
    h += "</div>";
  }
  var pAmi = regles("PARRAINAGE_AMI")[0], pPar = regles("PARRAINAGE_PARRAIN")[0];
  if (pAmi || pPar) {
    var lien = lienParrainage(d.code), msg = "Bonjour ! Je commande sur SafeRun Market à Antananarivo, c'est rapide et fiable. Avec mon code " + d.code + (pAmi ? " vous recevez : " + decrire(pAmi) : " vous avez un cadeau") + " sur votre 1ère commande : " + lien;
    h += '<div class="sr-c"><h3>🤝 Parrainez vos amis</h3><p>Votre code personnel :</p><div class="sr-code">' + esc(d.code) + "</div><p>" +
      (pAmi ? "Votre ami reçoit : <b>" + esc(decrire(pAmi)) + "</b>. " : "") + (pPar ? "Vous recevez : <b>" + esc(decrire(pPar)) + "</b> dès que son ami a reçu sa première commande." : "") + "</p>" +
      '<button class="sr-btn wa" id="sr-cad-wa" type="button" data-msg="' + esc(msg) + '">Partager sur WhatsApp</button><button class="sr-btn" id="sr-cad-copie" type="button" data-msg="' + esc(lien) + '">Copier le lien</button>' +
      (pPar ? '<p style="margin-top:8px">Amis ayant reçu leur 1ʳᵉ commande : <b>' + (hs.filleulsLivres || 0) + "</b>" + (hs.recompensesParrain ? " · récompense disponible : <b>" + hs.recompensesParrain + "</b>" : "") + "</p>" : "") + "</div>";
    if (pAmi && hs.actives === 0 && !d.aParrain) {
      h += '<div class="sr-c"><h3>J\'ai un code de parrainage</h3><p>Saisissez le code d\'un ami avant votre 1ʳᵉ commande.</p><div style="margin-top:8px"><input class="sr-in" id="sr-cad-code" maxlength="8" placeholder="SRXXXXX" value="' + esc(lire(CLE_PARRAIN)) + '"> <button class="sr-btn" id="sr-cad-ok" type="button">Valider</button></div><div class="sr-msg" id="sr-cad-msg"></div></div>';
    } else if (d.aParrain) h += '<div class="sr-c vert"><p>✔ Un code de parrainage est enregistré pour votre numéro.</p></div>';
  }
  h += rendrePaliers();
  box.innerHTML = h; branches();
}
function rendrePaliers() {
  var p = regles("PANIER").sort(function (a, b) { return a.seuilMin - b.seuilMin; });
  if (!p.length) return "";
  var h = '<div class="sr-c"><h3>🛒 Selon votre panier</h3>';
  p.forEach(function (r) { h += '<div class="sr-pal"><span>Dès ' + ar(r.seuilMin) + (r.seuilMax ? " (jusqu'à " + ar(r.seuilMax) + ")" : "") + "</span><span><b>" + esc(decrire(r)) + "</b></span></div>"; });
  return h + '<p style="margin-top:6px">Un seul cadeau par commande : le plus avantageux est appliqué.</p></div>';
}
function branches() {
  var b = $("sr-cad-profil"); if (b) b.onclick = function () { fermerFenetre(); try { ouvrirInscription(); } catch (e) {} };
  b = $("sr-cad-wa"); if (b) b.onclick = function () { window.open("https://wa.me/?text=" + encodeURIComponent(b.getAttribute("data-msg")), "_blank", "noopener"); };
  b = $("sr-cad-copie"); if (b) b.onclick = function () { var t = b.getAttribute("data-msg"); try { navigator.clipboard.writeText(t).then(function () { b.textContent = "✔ Lien copié"; }); } catch (e) { window.prompt("Copiez ce lien :", t); } };
  b = $("sr-cad-ok"); if (b) b.onclick = function () { declarer($("sr-cad-code").value, true); };
}

/* ---------------- Parrainage : déclarer un code ---------------- */
function jeton() {
  return new Promise(function (res) {
    try {
      var cle = typeof SITE_KEY_RECAPTCHA !== "undefined" ? SITE_KEY_RECAPTCHA : "";
      if (!window.grecaptcha || !cle) { res(""); return; }
      var fini = false, t = setTimeout(function () { if (!fini) { fini = true; res(""); } }, 6000);
      grecaptcha.ready(function () { grecaptcha.execute(cle, { action: "parrainage" }).then(function (x) { if (!fini) { fini = true; clearTimeout(t); res(x); } }, function () { if (!fini) { fini = true; clearTimeout(t); res(""); } }); });
    } catch (e) { res(""); }
  });
}
async function declarer(code, visible) {
  code = String(code || "").trim().toUpperCase();
  var msg = $("sr-cad-msg");
  function dire(t, ok) { if (msg && visible) { msg.textContent = t; msg.style.color = ok ? "#047857" : "#b91c1c"; } }
  if (!/^SR[A-Z0-9]{5}$/.test(code)) { dire("Code invalide (exemple : SR4K9PT).", false); return; }
  var tel = telPropre(); if (!tel) { dire("Complétez d'abord votre profil.", false); return; }
  dire("Vérification…", true);
  try {
    var res = await fetch(API, { method: "POST", body: JSON.stringify({ action: "declarerParrain", tel: tel, nom: lire("saferun_nom"), code: code, recaptchaToken: await jeton() }) });
    var d = await res.json();
    if (d && d.status === "success") { ecrire(CLE_PARRAIN, null); dire("✔ " + (d.message || "Code enregistré"), true); await rafraichir(); if (visible) setTimeout(rendreFenetre, 900); }
    else { ecrire(CLE_PARRAIN, null); dire((d && d.message) || "Code refusé", false); }
  } catch (e) { dire("Connexion impossible, réessayez.", false); }
}

/* ---------------- Démarrage ---------------- */
function demarrer() {
  try {
    var m = (location.search.match(/[?&]parrain=([A-Za-z0-9]+)/) || [])[1];
    if (m) ecrire(CLE_PARRAIN, m.toUpperCase().slice(0, 8));
  } catch (e) {}
  var det = $("detail-panier");
  if (det && window.MutationObserver) { obs = new MutationObserver(function () { majPanier(); }); obs.observe(det, { childList: true }); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fermerFenetre(); });
  rafraichir().then(function () {
    var c = lire(CLE_PARRAIN), d = etat.donnees;
    if (c && d && d.actif && etat.tel && !d.aParrain && d.historique && d.historique.actives === 0 && c !== d.code) declarer(c, false);
  });
  setInterval(function () { if (document.visibilityState === "visible") rafraichir(); }, 120000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(demarrer, 800); });
else setTimeout(demarrer, 800);

} catch (e) { /* ne jamais casser le site */ }
})();