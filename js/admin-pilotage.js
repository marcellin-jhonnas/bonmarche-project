/* =========================================================================
   SafeRun Admin OS · Centre de pilotage (module à part, aucune modification du reste d'admin.html)
   Une seule ligne à ajouter dans admin.html, tout à la fin, juste avant </body> :
        <script src="js/admin-pilotage.js"></script>
   Pour le retirer : supprimer cette ligne. L'ancien admin revient exactement comme avant.

   Vues : Aujourd'hui · Performance · Clients · Rentabilité · Livreurs · Alertes · Journal
   Lit les données déjà chargées par admin.html (allData) + le script Google (suivi des appels, cadeaux, parrainages, journal).
   Si le script Google n'est pas à jour, le module fonctionne quand même (il se rabat sur la colonne Note).
   ========================================================================= */
(function () {
"use strict";
if (window.__srPilotage) return;
window.__srPilotage = true;
try {

var DELAI_MVOLA_H = 2;
var PENDANT = ["NOUVEAU", "ATTENTE VISA", "A VERIFIER", "EN ATTENTE DE PAIEMENT"];
var ENCOURS = ["SERIEUX", "PLANIFIE", "VALIDE", "PAYE", "REPORTE"];
var VALIDES = ["SERIEUX", "PLANIFIE", "VALIDE", "PAYE", "REPORTE", "LIVRE"];
var cache = { suivi: {}, cad: {}, ok: false, t: 0, enCours: false, filtre: "", vue: "jour", produits: [], tProd: 0, parrains: [], promesses: [], journal: null, seg: "", ouvert: "", livStats: [], positions: [], caisse: [], consignes: [], livOk: false };

function $(i) { return document.getElementById(i); }
function sansAccent(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function cle(s) { return sansAccent(s).trim().toUpperCase(); }
function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function nb(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
function ar(n) { return nb(n) + " Ar"; }
function pct(a, b) { return b > 0 ? Math.round(a / b * 100) + " %" : "–"; }
function num(v) { if (typeof v === "number") return isFinite(v) ? Math.round(v) : 0; var n = parseInt(String(v == null ? "" : v).replace(/[.,]\d{1,2}\s*(ar)?$/i, "").replace(/[^\d-]/g, ""), 10); return isNaN(n) ? 0 : n; }
function donnees() { try { return (typeof allData !== "undefined" && Array.isArray(allData)) ? allData : []; } catch (e) { return []; } }
function postAPI(p) { return (window.SR && window.SR.postAPI) ? window.SR.postAPI(p) : Promise.reject(new Error("admin non prêt")); }
function apiUrl() { try { return CONFIG.API; } catch (e) { return ""; } }
function debut(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function ajoute(d, j) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + j); return x; }
function jourStr(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function lsGet(k, def) { try { var v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function toast(m) {
  var t = $("sr-pil-toast"); if (!t) { t = document.createElement("div"); t.id = "sr-pil-toast"; t.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;z-index:100000;display:none"; document.body.appendChild(t); }
  t.textContent = m; t.style.display = "block"; clearTimeout(t._t); t._t = setTimeout(function () { t.style.display = "none"; }, 3500);
}
function digits(t) { return String(t || "").replace(/\D/g, ""); }
function tel9(t) { var d = digits(t); return d.length >= 9 ? d.slice(-9) : d; }
function lienWA(tel, texte) { var d = digits(tel); if (d.indexOf("261") === 0) d = d.slice(3); d = d.replace(/^0/, ""); return d ? "https://wa.me/261" + d + (texte ? "?text=" + encodeURIComponent(texte) : "") : ""; }

/* ---------------- Lecture d'une commande ---------------- */
var RE_COD = /\ba la livraison\b|\bcod\b|contre[- ]?remboursement/;
function lire(c) {
  var id = String(c.ID == null ? "" : c.ID).trim(), note = String(c.Note || ""), sv = cache.suivi[id] || {};
  var mode = sv.mode || (RE_COD.test(sansAccent(note).toLowerCase()) ? "LIVRAISON" : (note.trim() === "" ? "MVOLA" : ""));
  var d = new Date(c.Date), t = String(c["Téléphone"] || c.Telephone || "").replace(/^'/, "");
  return {
    id: id, client: String(c.Client || c.Nom || "Client"), tel: t, t9: tel9(t), montant: num(c.Montant), frais: num(c.FraisLivraison),
    statut: cle(c.Statut), mode: mode, note: note, date: isNaN(d) ? null : d, livreur: String(c.Livreur || "").trim(),
    quartier: String(c["Lieu Exact"] || c.Quartier || ""), livraison: String(c.Livraison || ""), produits: String(c.Produits || ""),
    tent: sv.tentatives || 0, motif: sv.motif || "", cad: cache.cad[id] || null
  };
}
function toutes() { return donnees().map(lire); }
function actif(o) { return o.statut !== "ANNULE" && o.statut !== "LIVRE"; }
function enAttente(o) { return PENDANT.indexOf(o.statut) !== -1; }
function valide(o) { return VALIDES.indexOf(o.statut) !== -1; }
function heuresDepuis(o) { return o.date ? (Date.now() - o.date.getTime()) / 3600000 : 0; }
function depuis(o) { var h = heuresDepuis(o); return h < 1 ? Math.max(1, Math.round(h * 60)) + " min" : h < 24 ? Math.floor(h) + " h" : Math.floor(h / 24) + " j"; }
function verifCad(o) { return !!(o.cad && o.cad.Verif && o.cad.Verif !== "OK"); }
function coutCad(o) { return o.cad && o.cad.Cadeau ? (Number(o.cad.Cadeau_Valeur) || 0) : 0; }
function dateLiv(o) { try { var d = window.SR && window.SR.dateLivraison ? window.SR.dateLivraison(o.livraison) : null; if (d) return debut(d); } catch (e) {} return o.date ? debut(o.date) : null; }

/* ---------------- À encaisser à la livraison ---------------- */
function aEncaisser(o) {
  if (o.mode !== "LIVRAISON") return { v: 0 };
  var g = o.cad, ded = g && g.Cadeau_Type !== "OBJET" && g.Deja_Deduit !== "OUI" ? (Number(g.Cadeau_Valeur) || 0) : 0;
  if (o.frais > 0) return { v: Math.max(0, o.montant - o.frais - ded) };
  if (g && g.Cadeau_Type === "LIVRAISON_OFFERTE" && g.Deja_Deduit === "OUI") return { v: Math.max(0, o.montant - ded) };
  return { v: null, raison: "frais non confirmés" };
}

/* ---------------- Alertes ---------------- */
function alertes(l) {
  var out = [], ac = l.filter(actif), auj = debut(new Date());
  var appel3 = ac.filter(function (o) { return enAttente(o) && o.mode === "LIVRAISON" && o.tent >= 3; });
  if (appel3.length) out.push({ n: "crit", t: appel3.length + " commande(s) avec 3 appels sans réponse : à annuler", f: "appel", v: "jour" });
  var appel = ac.filter(function (o) { return enAttente(o) && o.mode === "LIVRAISON" && o.tent < 3; });
  if (appel.length) out.push({ n: "crit", t: appel.length + " client(s) à appeler pour confirmer la commande", f: "appel", v: "jour" });
  var mv = ac.filter(function (o) { return enAttente(o) && o.mode === "MVOLA" && heuresDepuis(o) >= DELAI_MVOLA_H; });
  if (mv.length) out.push({ n: "crit", t: mv.length + " paiement(s) MVola non reçu(s) depuis plus de " + DELAI_MVOLA_H + " h", f: "mvola", v: "jour" });
  var cv = ac.filter(verifCad);
  if (cv.length) out.push({ n: "crit", t: cv.length + " cadeau(x) à vérifier (montant différent du calcul du serveur)", f: "cadeau", v: "jour" });
  var av = ac.filter(function (o) { return o.statut === "A VERIFIER" || /A VERIFIER/.test(sansAccent(o.note).toUpperCase()); });
  if (av.length) out.push({ n: "crit", t: av.length + " commande(s) signalée(s) « À VÉRIFIER » par le serveur", f: "", v: "jour" });
  var retard = ac.filter(function (o) { if (ENCOURS.indexOf(o.statut) === -1) return false; var d = dateLiv(o); return d && d < auj; });
  if (retard.length) out.push({ n: "crit", t: retard.length + " commande(s) confirmée(s) dont la date de livraison est dépassée", f: "retard", v: "jour" });
  var cash = ac.filter(function (o) { return ENCOURS.indexOf(o.statut) !== -1 && o.mode === "LIVRAISON" && aEncaisser(o).v === null; });
  if (cash.length) out.push({ n: "att", t: cash.length + " commande(s) à payer à la livraison dont les frais ne sont pas confirmés", f: "", v: "livreurs" });
  var sl = ac.filter(function (o) { return ENCOURS.indexOf(o.statut) !== -1 && !o.livreur; });
  if (sl.length) out.push({ n: "att", t: sl.length + " commande(s) confirmée(s) sans livreur", f: "sansLivreur", v: "jour" });
  var s7 = l.filter(function (o) { return o.date && (Date.now() - o.date.getTime()) < 7 * 86400000; }), an7 = s7.filter(function (o) { return o.statut === "ANNULE"; });
  if (s7.length >= 5 && an7.length / s7.length > 0.2) out.push({ n: "att", t: "Taux d'annulation élevé sur 7 jours : " + pct(an7.length, s7.length) + " (" + an7.length + "/" + s7.length + ")", f: "", v: "perf" });
  var obj = lsGet("sr_pil_obj", { jour: 0, semaine: 0 }), h = new Date().getHours();
  if (obj.jour > 0 && h >= 16 && stat(l, auj, ajoute(auj, 1)).ca < obj.jour * 0.5) out.push({ n: "att", t: "Objectif du jour en retard : moins de 50 % à " + h + " h", f: "", v: "perf" });
  var ec = cache.livStats.filter(function (o) { return o.ecart30 < 0; });
  if (ec.length) out.push({ n: "att", t: "Écart de caisse négatif sur 30 jours : " + ec.map(function (o) { return o.nom + " (" + ar(o.ecart30) + ")"; }).join(", "), f: "", v: "livreurs" });
  var mauvais = clients(l).filter(function (c) { return c.annul >= 2; }).length;
  if (mauvais) out.push({ n: "att", t: mauvais + " client(s) avec 2 annulations ou plus : à surveiller", f: "", v: "clients", seg: "risque" });
  return out;
}
function compteCritique() { return alertes(toutes()).filter(function (a) { return a.n === "crit"; }).length; }
function majPastille() {
  var lien = $("sr-pil-nav"); if (!lien) return;
  var n = compteCritique(), b = $("sr-pil-badge");
  if (!b) { b = document.createElement("span"); b.id = "sr-pil-badge"; b.style.cssText = "margin-left:auto;background:#ef4444;color:#fff;border-radius:10px;font-size:11px;font-weight:800;padding:1px 8px"; lien.appendChild(b); }
  b.textContent = n; b.style.display = n ? "" : "none";
  var base = document.title.replace(/^\(\d+\)\s*/, ""); document.title = n ? "(" + n + ") " + base : base;
}

/* ---------------- Statistiques ---------------- */
function stat(l, a, b) {                                  // commandes passées entre a (inclus) et b (exclu)
  var r = l.filter(function (o) { return o.date && o.date >= a && o.date < b && o.statut !== "ANNULE"; });
  var v = r.filter(valide), ca = v.reduce(function (s, o) { return s + o.montant; }, 0);
  return { n: r.length, nv: v.length, ca: ca, pm: v.length ? ca / v.length : 0 };
}
function clients(l) {
  var m = {};
  l.forEach(function (o) {
    if (!o.t9) return;
    var c = m[o.t9] = m[o.t9] || { t9: o.t9, tel: o.tel, nom: o.client, cmds: [], n: 0, liv: 0, ca: 0, annul: 0, appels: 0, cad: 0, premier: null, dernier: null };
    c.cmds.push(o); c.nom = o.client || c.nom; c.tel = o.tel || c.tel;
    if (o.statut === "ANNULE") c.annul++; else { c.n++; if (o.date) { if (!c.dernier || o.date > c.dernier) c.dernier = o.date; } }
    if (o.statut === "LIVRE") c.liv++;
    if (valide(o)) c.ca += o.montant;
    c.appels += o.tent; if (o.cad && o.cad.Cadeau) c.cad++;
    if (o.date && (!c.premier || o.date < c.premier)) c.premier = o.date;
  });
  return Object.keys(m).map(function (k) { return m[k]; });
}
function parserLignes(texte) {
  var out = [];
  String(texte || "").split(/,(?![^(]*\))/).forEach(function (it) {
    var t = it.trim(); if (!t) return;
    var m = t.match(/^(.+?)\s*\(x(\d+)\)\s*$/i) || t.match(/^(\d+)\s*x\s*(.+)$/i), nom, q;
    if (m) { if (/^\d+$/.test(m[1])) { q = +m[1]; nom = m[2]; } else { nom = m[1]; q = +m[2]; } } else { nom = t; q = 1; }
    out.push({ nom: nom.replace(/\s*\[[^\]]*\]\s*$/, "").trim(), qte: q || 1 });
  });
  return out;
}
function cleProd(n) { return sansAccent(n).toLowerCase().trim().replace(/\s+/g, " "); }
function prixAchat() { return lsGet("sr_cfg_prix_achat", {}) || {}; }

/* ---------------- Styles ---------------- */
var CSS = "#tab-pilotage .pil-sub{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;position:sticky;top:0;background:#f8fafc;padding:6px 0;z-index:5}" +
  "#tab-pilotage .pil-sub button{border:0;background:#e2e8f0;color:#334155;padding:8px 14px;border-radius:20px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}#tab-pilotage .pil-sub button.on{background:#0f172a;color:#fff}" +
  "#tab-pilotage .pil-sub .n{background:#ef4444;color:#fff;border-radius:9px;font-size:10px;padding:1px 6px;margin-left:5px}" +
  "#tab-pilotage .pil-bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}" +
  "#tab-pilotage .pil-chip{flex:1 1 170px;background:#fff;border:2px solid #e2e8f0;border-radius:12px;padding:12px 14px;cursor:pointer;text-align:left;font:inherit}" +
  "#tab-pilotage .pil-chip b{display:block;font-size:26px;line-height:1.1}#tab-pilotage .pil-chip span{font-size:12px;color:#64748b;font-weight:600}" +
  "#tab-pilotage .pil-chip.on{border-color:#ff6b00;box-shadow:0 0 0 3px rgba(255,107,0,.15)}#tab-pilotage .pil-chip.rouge b{color:#dc2626}#tab-pilotage .pil-chip.zero b{color:#16a34a}" +
  "#tab-pilotage h3.pil-t{margin:22px 0 10px;font-size:15px;color:#0f172a}" +
  "#tab-pilotage .pil-board{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;align-items:start}" +
  "#tab-pilotage .pil-col{background:#f1f5f9;border-radius:12px;padding:10px;min-height:80px}" +
  "#tab-pilotage .pil-col>h4{margin:2px 4px 8px;font-size:13px;display:flex;justify-content:space-between;color:#334155}" +
  "#tab-pilotage .pil-card{background:#fff;border-radius:10px;padding:10px 11px;margin-bottom:8px;box-shadow:0 1px 2px rgba(0,0,0,.06);font-size:12.5px;line-height:1.45}" +
  "#tab-pilotage .pil-card .t{display:flex;justify-content:space-between;gap:8px;font-weight:800}" +
  "#tab-pilotage .pil-b{display:inline-block;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:9px;margin:3px 4px 0 0}" +
  "#tab-pilotage .pil-btn{border:0;border-radius:8px;padding:6px 10px;font-size:11.5px;font-weight:700;cursor:pointer;margin:6px 5px 0 0;background:#e2e8f0;color:#0f172a;text-decoration:none;display:inline-block;font-family:inherit}" +
  "#tab-pilotage .pil-btn.ok{background:#16a34a;color:#fff}#tab-pilotage .pil-btn.bad{background:#dc2626;color:#fff}#tab-pilotage .pil-btn.or{background:#ff6b00;color:#fff}" +
  "#tab-pilotage table.pil-tb{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;font-size:13px}" +
  "#tab-pilotage .pil-tb th,#tab-pilotage .pil-tb td{padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:left;vertical-align:top}#tab-pilotage .pil-tb .r{text-align:right}#tab-pilotage .pil-tb th{background:#f8fafc;font-size:12px;color:#475569}" +
  "#tab-pilotage .pil-tb tr.cl{cursor:pointer}#tab-pilotage .pil-tb tr.cl:hover{background:#fff7ed}" +
  "#tab-pilotage .pil-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}" +
  "#tab-pilotage .pil-kpi{background:#fff;border-radius:10px;padding:12px 14px}#tab-pilotage .pil-kpi small{color:#64748b;font-weight:600;font-size:12px}#tab-pilotage .pil-kpi b{display:block;font-size:20px}#tab-pilotage .pil-kpi i{font-style:normal;font-size:12px;font-weight:700}" +
  "#tab-pilotage .pil-vide{color:#94a3b8;font-size:12px;text-align:center;padding:10px}" +
  "#tab-pilotage .pil-prog{height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden;margin:6px 0}#tab-pilotage .pil-prog i{display:block;height:100%;background:linear-gradient(90deg,#ff6b00,#ffb347)}" +
  "#tab-pilotage .pil-al{background:#fff;border-left:5px solid #94a3b8;border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:13px}" +
  "#tab-pilotage .pil-al.crit{border-color:#dc2626}#tab-pilotage .pil-al.att{border-color:#f59e0b}" +
  "#tab-pilotage input.pil-in{border:1px solid #cbd5e1;border-radius:8px;padding:6px 9px;font:inherit;font-size:13px;width:130px}" +
  "@media(max-width:700px){#tab-pilotage .pil-tb{font-size:12px}#tab-pilotage .pil-tb th,#tab-pilotage .pil-tb td{padding:7px 6px}}";

function kpi(t, v, sous) { return '<div class="pil-kpi"><small>' + t + "</small><b>" + v + "</b>" + (sous ? "<i>" + sous + "</i>" : "") + "</div>"; }
function variation(a, b) { if (!(b > 0)) return a > 0 ? '<span style="color:#16a34a">nouveau</span>' : ""; var p = Math.round((a - b) / b * 100); return '<span style="color:' + (p >= 0 ? "#16a34a" : "#dc2626") + '">' + (p >= 0 ? "▲ +" : "▼ ") + p + " %</span>"; }
function badgeMode(o) {
  if (o.mode === "LIVRAISON") return '<span class="pil-b" style="background:#fff7ed;color:#9a3412">💵 Payer à la livraison</span>';
  if (o.mode === "MVOLA") return '<span class="pil-b" style="background:#eff6ff;color:#1d4ed8">📲 MVola</span>';
  if (o.mode === "VISA") return '<span class="pil-b" style="background:#f5f3ff;color:#6d28d9">💳 Carte</span>';
  return "";
}

/* =============== VUE 1 : AUJOURD'HUI =============== */
function carte(o) {
  var h = '<div class="pil-card" data-id="' + esc(o.id) + '"><div class="t"><span>#' + esc(o.id) + " · " + esc(o.client) + "</span><span>" + ar(o.montant) + "</span></div>";
  h += '<div style="color:#64748b">' + esc(o.tel) + (o.quartier ? " · 📍 " + esc(o.quartier.split(" --")[0]) : "") + " · il y a " + depuis(o) + "</div>" + badgeMode(o);
  if (o.mode === "MVOLA" && enAttente(o) && heuresDepuis(o) >= DELAI_MVOLA_H) h += '<span class="pil-b" style="background:#fef2f2;color:#b91c1c">⏱️ MVola non reçu depuis ' + depuis(o) + "</span>";
  if (o.cad && o.cad.Cadeau) h += '<span class="pil-b" style="background:#ecfdf5;color:#065f46">🎁 ' + esc(o.cad.Cadeau) + (o.cad.Cadeau_Valeur ? " (" + ar(o.cad.Cadeau_Valeur) + ")" : "") + "</span>";
  if (verifCad(o)) h += '<span class="pil-b" style="background:#fef2f2;color:#b91c1c">⚠️ Cadeau à vérifier</span>';
  if (o.livreur) h += '<span class="pil-b" style="background:#f1f5f9;color:#334155">🛵 ' + esc(o.livreur) + "</span>";
  if (o.mode === "LIVRAISON" && enAttente(o)) h += '<div style="margin-top:4px;color:#9a3412"><b>📞 Appels sans réponse : ' + o.tent + "/3</b></div>";
  h += "<div>";
  if (o.tel) h += '<a class="pil-btn" href="tel:' + esc(digits(o.tel)) + '">📞 Appeler</a>';
  var wa = lienWA(o.tel); if (wa) h += '<a class="pil-btn" target="_blank" rel="noopener" href="' + esc(wa) + '">💬 WhatsApp</a>';
  if (o.mode === "LIVRAISON" && enAttente(o)) {
    h += '<button class="pil-btn ok" data-act="valider" type="button">✔ Client joint : valider</button><button class="pil-btn" data-act="non" type="button">📵 Sans réponse</button>';
    if (o.tent > 0) h += '<button class="pil-btn" data-act="raz" type="button">↺ 0</button>';
    if (o.tent >= 3) h += '<button class="pil-btn bad" data-act="annuler" type="button">✖ Annuler (3 appels)</button>';
  } else if (enAttente(o)) h += '<button class="pil-btn ok" data-act="valider" type="button">✔ Paiement reçu : valider</button>';
  if (actif(o) && ENCOURS.indexOf(o.statut) !== -1 && !o.livreur) h += '<button class="pil-btn" data-act="proche" type="button">🛵 Livreur le plus proche</button>';
  return h + "</div></div>";
}
function colonne(titre, liste, couleur) {
  return '<div class="pil-col"><h4><span style="color:' + couleur + '">' + titre + "</span><span>" + liste.length + "</span></h4>" +
    (liste.length ? liste.slice(0, 25).map(carte).join("") + (liste.length > 25 ? '<div class="pil-vide">+ ' + (liste.length - 25) + " autres</div>" : "") : '<div class="pil-vide">Rien ici</div>') + "</div>";
}
var FILTRES = { appel: "📞 Clients à appeler", mvola: "⏱️ MVola non reçu (>" + DELAI_MVOLA_H + " h)", cadeau: "🎁 Cadeaux à vérifier", retard: "🕒 Livraison dépassée", sansLivreur: "🛵 Confirmées sans livreur" };
function urgences(l) {
  var ac = l.filter(actif), auj = debut(new Date());
  return {
    appel: ac.filter(function (o) { return enAttente(o) && o.mode === "LIVRAISON"; }),
    mvola: ac.filter(function (o) { return enAttente(o) && o.mode === "MVOLA" && heuresDepuis(o) >= DELAI_MVOLA_H; }),
    cadeau: ac.filter(verifCad),
    retard: ac.filter(function (o) { if (ENCOURS.indexOf(o.statut) === -1) return false; var d = dateLiv(o); return d && d < auj; }),
    sansLivreur: ac.filter(function (o) { return ENCOURS.indexOf(o.statut) !== -1 && !o.livreur; })
  };
}
function vueJour(l) {
  var u = urgences(l), h = '<div class="pil-bar">';
  Object.keys(FILTRES).forEach(function (k) {
    var n = u[k].length, bad = (k !== "sansLivreur") && n > 0;
    h += '<button type="button" class="pil-chip' + (cache.filtre === k ? " on" : "") + (bad ? " rouge" : "") + (n === 0 ? " zero" : "") + '" data-f="' + k + '"><b>' + n + "</b><span>" + FILTRES[k] + "</span></button>";
  });
  h += "</div>";
  if (cache.filtre) {
    h += '<h3 class="pil-t">' + FILTRES[cache.filtre] + ' <button class="pil-btn" data-f="" type="button">Tout afficher</button></h3><div class="pil-board">' + (u[cache.filtre].length ? u[cache.filtre].map(carte).join("") : '<div class="pil-vide">Rien à faire ici ✅</div>') + "</div>";
  } else {
    var ac = l.filter(actif), recent = function (o) { return o.date && (Date.now() - o.date.getTime()) < 2 * 86400000; };
    h += '<h3 class="pil-t">📋 Commandes par état</h3><div class="pil-board">' + [
      colonne("📞 À confirmer", ac.filter(function (o) { return enAttente(o) && o.mode === "LIVRAISON"; }), "#9a3412"),
      colonne("🟡 À payer", ac.filter(function (o) { return enAttente(o) && o.mode !== "LIVRAISON"; }), "#92400e"),
      colonne("🟢 Confirmées", ac.filter(function (o) { return ENCOURS.indexOf(o.statut) !== -1 && !o.livreur; }), "#166534"),
      colonne("🚚 En livraison", ac.filter(function (o) { return ENCOURS.indexOf(o.statut) !== -1 && o.livreur; }), "#1d4ed8"),
      colonne("✅ Livrées (2 j)", l.filter(function (o) { return o.statut === "LIVRE" && recent(o); }), "#475569"),
      colonne("❌ Annulées (2 j)", l.filter(function (o) { return o.statut === "ANNULE" && recent(o); }), "#991b1b")].join("") + "</div>";
  }
  var enc = l.filter(function (o) { return ENCOURS.indexOf(o.statut) !== -1 && o.mode === "LIVRAISON"; }), total = 0, inc = 0;
  enc.forEach(function (o) { var e = aEncaisser(o); if (e.v === null) inc++; else total += e.v; });
  h += '<h3 class="pil-t">💵 À encaisser à la livraison</h3><div class="pil-kpis">' + kpi("Total à récupérer auprès des clients", ar(total)) + kpi("Commandes payées à la livraison (en cours)", enc.length) + (inc ? kpi("⚠️ Montant à vérifier", '<span style="color:#dc2626">' + inc + "</span>") : "") + '</div><div style="font-size:12px;color:#64748b;margin-top:6px">Détail par livreur et écart de caisse : onglet « Livreurs ».</div>';
  return h;
}

/* =============== VUE 2 : PERFORMANCE =============== */
function barres(vals, labels) {
  var max = Math.max.apply(null, vals.concat([1])), w = 100 / vals.length, s = '<svg viewBox="0 0 100 40" preserveAspectRatio="none" style="width:100%;height:110px;background:#fff;border-radius:10px;padding:6px">';
  vals.forEach(function (v, i) { var hh = Math.max(0.6, v / max * 32); s += '<rect x="' + (i * w + w * 0.15) + '" y="' + (36 - hh) + '" width="' + (w * 0.7) + '" height="' + hh + '" rx="1" fill="' + (i === vals.length - 1 ? "#ff6b00" : "#fdba74") + '"><title>' + esc(labels[i]) + " : " + ar(v) + "</title></rect>"; });
  return s + "</svg>";
}
function vuePerf(l) {
  var auj = debut(new Date()), dem = ajoute(auj, 1), hier = ajoute(auj, -1), sem = ajoute(auj, -7);
  var t = stat(l, auj, dem), hr = stat(l, hier, auj), s7 = stat(l, sem, auj), sPrec = stat(l, ajoute(auj, -14), sem);
  var s7b = stat(l, ajoute(auj, -6), dem), obj = lsGet("sr_pil_obj", { jour: 0, semaine: 0 });
  var lundi = ajoute(auj, -((auj.getDay() + 6) % 7)), cs = stat(l, lundi, dem);
  var h = '<h3 class="pil-t" style="margin-top:0">📈 Performance</h3><div class="pil-kpis">' +
    kpi("Chiffre d'affaires aujourd'hui", ar(t.ca), variation(t.ca, hr.ca) + " vs hier (" + ar(hr.ca) + ")") +
    kpi("Commandes aujourd'hui", t.n, variation(t.n, hr.n) + " vs hier (" + hr.n + ")") +
    kpi("Panier moyen (7 jours)", ar(s7b.pm), variation(s7b.pm, sPrec.pm) + " vs 7 jours précédents") +
    kpi("CA des 7 derniers jours", ar(s7b.ca), variation(s7b.ca, sPrec.ca) + " vs 7 jours précédents") + "</div>";
  var vals = [], labs = [];
  for (var i = 13; i >= 0; i--) { var d = ajoute(auj, -i); vals.push(stat(l, d, ajoute(d, 1)).ca); labs.push(d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })); }
  h += '<h3 class="pil-t">Chiffre d\'affaires des 14 derniers jours</h3>' + barres(vals, labs);
  h += '<h3 class="pil-t">🎯 Objectifs</h3><div class="pil-kpis"><div class="pil-kpi"><small>Objectif du jour (Ar)</small><input class="pil-in" id="pil-obj-j" type="number" min="0" step="10000" value="' + (obj.jour || "") + '" placeholder="ex : 200000">' +
    (obj.jour ? '<div class="pil-prog"><i style="width:' + Math.min(100, Math.round(t.ca / obj.jour * 100)) + '%"></i></div><i>' + ar(t.ca) + " / " + ar(obj.jour) + " (" + pct(t.ca, obj.jour) + ")</i>" : "") + "</div>" +
    '<div class="pil-kpi"><small>Objectif de la semaine (Ar)</small><input class="pil-in" id="pil-obj-s" type="number" min="0" step="50000" value="' + (obj.semaine || "") + '" placeholder="ex : 1000000">' +
    (obj.semaine ? '<div class="pil-prog"><i style="width:' + Math.min(100, Math.round(cs.ca / obj.semaine * 100)) + '%"></i></div><i>' + ar(cs.ca) + " / " + ar(obj.semaine) + " (" + pct(cs.ca, obj.semaine) + ")</i>" : "") + "</div></div>";
  // qualité
  var p7 = l.filter(function (o) { return o.date && o.date >= sem; }), an = p7.filter(function (o) { return o.statut === "ANNULE"; });
  var parAppels = an.filter(function (o) { return o.tent >= 3 || /appel/i.test(o.motif); }).length, parMvola = an.filter(function (o) { return o.mode === "MVOLA"; }).length;
  var attente = l.filter(function (o) { return actif(o) && enAttente(o); }), ageMoy = attente.length ? attente.reduce(function (s, o) { return s + heuresDepuis(o); }, 0) / attente.length : 0;
  var clAll = clients(l), nouveaux7 = clAll.filter(function (c) { return c.premier && c.premier >= sem; }).length;
  h += '<h3 class="pil-t">🩺 Qualité (7 derniers jours)</h3><div class="pil-kpis">' +
    kpi("Taux d'annulation", pct(an.length, p7.length), an.length + " annulée(s) sur " + p7.length) +
    kpi("… pour 3 appels sans réponse", parAppels) + kpi("… MVola non payé", parMvola) +
    kpi("Commandes en attente de confirmation", attente.length, attente.length ? "âge moyen " + (ageMoy < 1 ? Math.round(ageMoy * 60) + " min" : ageMoy.toFixed(1) + " h") : "") +
    kpi("Nouveaux clients", nouveaux7, "sur 7 jours") + "</div>";
  return h;
}

/* =============== VUE 3 : CLIENTS =============== */
var SEGMENTS = { nouveaux: "🆕 Nouveaux (1ʳᵉ commande, 30 j)", fideles: "⭐ Fidèles (3 livraisons ou +)", vip: "👑 Meilleurs clients", dormants: "😴 Dormants (>30 j)", risque: "⚠️ À surveiller", parrains: "🤝 Parrains" };
function segmenter(cl) {
  var seg = { nouveaux: [], fideles: [], vip: [], dormants: [], risque: [], parrains: [] }, now = Date.now();
  var vip = cl.filter(function (c) { return c.n >= 2 && c.ca > 0; }).sort(function (a, b) { return b.ca - a.ca; }).slice(0, 10);
  var filleuls = {}; cache.parrains.forEach(function (p) { if (p.parrain) filleuls[p.parrain] = (filleuls[p.parrain] || 0) + 1; });
  cl.forEach(function (c) {
    c.jours = c.dernier ? Math.floor((now - c.dernier.getTime()) / 86400000) : 999; c.filleuls = filleuls[c.t9] || 0;
    if (c.n === 1 && c.premier && now - c.premier.getTime() < 30 * 86400000) seg.nouveaux.push(c);
    if (c.liv >= 3) seg.fideles.push(c);
    if (c.n >= 2 && c.jours > 30) seg.dormants.push(c);
    if (c.annul >= 2 || c.appels >= 3) seg.risque.push(c);
    if (c.filleuls > 0) seg.parrains.push(c);
  });
  seg.vip = vip; return seg;
}
function ficheClient(c) {
  var h = '<tr><td colspan="6" style="background:#f8fafc"><b>Commandes de ' + esc(c.nom) + "</b><table class='pil-tb' style='margin-top:6px'><tr><th>N°</th><th>Date</th><th class='r'>Montant</th><th>Statut</th><th>Paiement</th><th>Cadeau</th></tr>" +
    c.cmds.slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); }).map(function (o) { return "<tr><td>#" + esc(o.id) + "</td><td>" + (o.date ? o.date.toLocaleDateString("fr-FR") : "") + '</td><td class="r">' + ar(o.montant) + "</td><td>" + esc(o.statut) + "</td><td>" + (o.mode === "LIVRAISON" ? "À la livraison" : o.mode === "VISA" ? "Carte" : o.mode === "MVOLA" ? "MVola" : "") + "</td><td>" + (o.cad && o.cad.Cadeau ? esc(o.cad.Cadeau) : "") + (o.tent ? " · 📞 " + o.tent + "/3" : "") + "</td></tr>"; }).join("") + "</table></td></tr>";
  return h;
}
function vueClients(l) {
  var cl = clients(l), seg = segmenter(cl);
  var h = '<h3 class="pil-t" style="margin-top:0">👥 Clients (' + cl.length + ")</h3><div class=\"pil-bar\">";
  Object.keys(SEGMENTS).forEach(function (k) { h += '<button type="button" class="pil-chip' + (cache.seg === k ? " on" : "") + '" data-seg="' + k + '"><b>' + seg[k].length + "</b><span>" + SEGMENTS[k] + "</span></button>"; });
  h += "</div>";
  var liste = cache.seg ? seg[cache.seg] : cl.slice().sort(function (a, b) { return b.ca - a.ca; });
  var msg = { dormants: "Bonjour {n} ! Ça fait un moment 😊 SafeRun Market vous offre un petit cadeau sur votre prochaine commande. À très vite !", nouveaux: "Bonjour {n}, merci pour votre première commande chez SafeRun Market ! Avez-vous été satisfait(e) ?", fideles: "Bonjour {n}, merci pour votre fidélité à SafeRun Market 🙏 Un cadeau vous attend sur votre prochaine commande.", vip: "Bonjour {n}, vous faites partie de nos meilleurs clients chez SafeRun Market. Merci !" };
  h += '<h3 class="pil-t">' + (cache.seg ? SEGMENTS[cache.seg] + ' <button class="pil-btn" data-seg="" type="button">Tous les clients</button>' : "Tous les clients (par chiffre d'affaires)") + "</h3>";
  if (!liste.length) return h + '<div class="pil-vide">Aucun client dans ce segment</div>';
  h += '<table class="pil-tb"><tr><th>Client</th><th class="r">Commandes</th><th class="r">CA</th><th>Dernière</th><th>Signaux</th><th>Actions</th></tr>';
  liste.slice(0, 60).forEach(function (c) {
    var tags = (c.cad ? '<span class="pil-b" style="background:#ecfdf5;color:#065f46">🎁 ' + c.cad + "</span>" : "") + (c.annul ? '<span class="pil-b" style="background:#fef2f2;color:#b91c1c">✖ ' + c.annul + " annulée(s)</span>" : "") + (c.appels >= 2 ? '<span class="pil-b" style="background:#fff7ed;color:#9a3412">📞 ' + c.appels + " appels manqués</span>" : "") + (c.filleuls ? '<span class="pil-b" style="background:#eff6ff;color:#1d4ed8">🤝 ' + c.filleuls + " filleul(s)</span>" : "");
    var texte = (msg[cache.seg] || "Bonjour {n}, ici SafeRun Market.").replace("{n}", c.nom), wa = lienWA(c.tel, texte);
    h += '<tr class="cl" data-cl="' + esc(c.t9) + '"><td><b>' + esc(c.nom) + '</b><br><span style="color:#64748b">' + esc(c.tel) + '</span></td><td class="r">' + c.n + (c.liv ? " (" + c.liv + " livrées)" : "") + '</td><td class="r"><b>' + ar(c.ca) + "</b></td><td>" + (c.dernier ? c.dernier.toLocaleDateString("fr-FR") + "<br><span style='color:#64748b'>il y a " + c.jours + " j</span>" : "") + "</td><td>" + tags + '</td><td data-stop="1">' +
      (wa ? '<a class="pil-btn" target="_blank" rel="noopener" href="' + esc(wa) + '">💬</a>' : "") + '<a class="pil-btn" href="tel:' + esc(digits(c.tel)) + '">📞</a><button class="pil-btn or" data-gift="' + esc(c.t9) + '" type="button">🎁 Offrir</button></td></tr>';
    if (cache.ouvert === c.t9) h += ficheClient(c);
  });
  return h + "</table>" + (liste.length > 60 ? '<div class="pil-vide">60 premiers sur ' + liste.length + "</div>" : "");
}

/* =============== VUE 4 : RENTABILITÉ =============== */
function vueRenta(l) {
  var lim = Date.now() - 30 * 86400000, p30 = l.filter(function (o) { return o.date && o.date.getTime() >= lim && valide(o); });
  var prix = {}, cat = {}; cache.produits.forEach(function (p) { var k = cleProd(p.Nom); prix[k] = Number(String(p.Prix).replace(/[^0-9.]/g, "")) || 0; cat[k] = String(p.Categorie || "Autres"); });
  var achat = prixAchat(), lignes = {}, caProd = 0, caAvecAchat = 0, marge = 0;
  p30.forEach(function (o) {
    parserLignes(o.produits).forEach(function (ln) {
      var k = cleProd(ln.nom), pv = prix[k]; if (!pv) return;
      var r = lignes[k] = lignes[k] || { nom: ln.nom, cat: cat[k], q: 0, ca: 0, marge: 0, achat: achat[k] != null ? Number(achat[k]) : null };
      r.q += ln.qte; r.ca += pv * ln.qte; caProd += pv * ln.qte;
      if (r.achat != null && r.achat > 0) { var m = (pv - r.achat) * ln.qte; r.marge += m; marge += m; caAvecAchat += pv * ln.qte; }
    });
  });
  var cout = p30.reduce(function (s, o) { return s + coutCad(o); }, 0), arr = Object.keys(lignes).map(function (k) { return lignes[k]; });
  var h = '<h3 class="pil-t" style="margin-top:0">💰 Rentabilité (30 derniers jours)</h3>';
  if (!cache.produits.length) h += '<div class="pil-vide">Liste des produits indisponible : actualisez.</div>';
  h += '<div class="pil-kpis">' + kpi("Ventes de produits", ar(caProd), p30.length + " commandes confirmées") +
    kpi("Marge connue", ar(marge), caAvecAchat ? "soit " + pct(marge, caAvecAchat) + " des ventes renseignées" : "prix d'achat à renseigner") +
    kpi("Prix d'achat renseignés", pct(caAvecAchat, caProd), "part des ventes couverte") +
    kpi("Coût des cadeaux", ar(cout), pct(cout, caProd) + " des ventes") +
    kpi("Marge après cadeaux", ar(marge - cout), cache.ok ? "" : "script Google V3 requis") + "</div>";
  var top = arr.slice().sort(function (a, b) { return b.ca - a.ca; }).slice(0, 15);
  h += '<h3 class="pil-t">Produits les plus vendus</h3>' + (top.length ? '<table class="pil-tb"><tr><th>Produit</th><th class="r">Quantité</th><th class="r">Ventes</th><th class="r">Marge</th><th class="r">Marge %</th><th></th></tr>' +
    top.map(function (r) { return "<tr><td>" + esc(r.nom) + '<br><span style="color:#64748b;font-size:11px">' + esc(r.cat) + '</span></td><td class="r">' + r.q + '</td><td class="r">' + ar(r.ca) + '</td><td class="r">' + (r.achat ? "<b>" + ar(r.marge) + "</b>" : "–") + '</td><td class="r">' + (r.achat ? pct(r.marge, r.ca) : '<span style="color:#f59e0b">à renseigner</span>') + '</td><td><button class="pil-btn" data-achat="' + esc(r.nom) + '" type="button">' + (r.achat ? "✏️ Prix d'achat" : "➕ Prix d'achat") + "</button></td></tr>"; }).join("") + "</table>" : '<div class="pil-vide">Pas encore de ventes sur la période</div>');
  var parCat = {}; arr.forEach(function (r) { var c = parCat[r.cat] = parCat[r.cat] || { ca: 0, marge: 0, q: 0 }; c.ca += r.ca; c.marge += r.marge; c.q += r.q; });
  var kc = Object.keys(parCat).sort(function (a, b) { return parCat[b].ca - parCat[a].ca; });
  if (kc.length) h += '<h3 class="pil-t">Par catégorie / boutique</h3><table class="pil-tb"><tr><th>Catégorie</th><th class="r">Quantité</th><th class="r">Ventes</th><th class="r">Marge connue</th></tr>' + kc.map(function (k) { return "<tr><td>" + esc(k) + '</td><td class="r">' + parCat[k].q + '</td><td class="r">' + ar(parCat[k].ca) + '</td><td class="r">' + (parCat[k].marge ? ar(parCat[k].marge) : "–") + "</td></tr>"; }).join("") + "</table>";
  // rentabilité des cadeaux
  var gp = {}, sans = p30.filter(function (o) { return !(o.cad && o.cad.Cadeau); });
  p30.forEach(function (o) { if (o.cad && o.cad.Cadeau) { var r = gp[o.cad.Cadeau] = gp[o.cad.Cadeau] || { n: 0, cout: 0, ca: 0 }; r.n++; r.cout += coutCad(o); r.ca += o.montant; } });
  var pmSans = sans.length ? sans.reduce(function (s, o) { return s + o.montant; }, 0) / sans.length : 0, kg = Object.keys(gp).sort(function (a, b) { return gp[b].cout - gp[a].cout; });
  h += '<h3 class="pil-t">🎁 Les cadeaux rapportent-ils plus qu\'ils ne coûtent ?</h3>' + (cache.ok ? (kg.length ? '<table class="pil-tb"><tr><th>Cadeau</th><th class="r">Commandes</th><th class="r">Coût</th><th class="r">Ventes générées</th><th class="r">Panier moyen</th><th class="r">Coût / ventes</th></tr>' +
    kg.map(function (k) { var r = gp[k]; return "<tr><td>" + esc(k) + '</td><td class="r">' + r.n + '</td><td class="r">' + ar(r.cout) + '</td><td class="r">' + ar(r.ca) + '</td><td class="r">' + ar(r.ca / r.n) + (pmSans ? "<br><span style='color:" + (r.ca / r.n >= pmSans ? "#16a34a" : "#dc2626") + "'>" + (r.ca / r.n >= pmSans ? "▲" : "▼") + " vs " + ar(pmSans) + " sans cadeau</span>" : "") + '</td><td class="r"><b>' + pct(r.cout, r.ca) + "</b></td></tr>"; }).join("") + "</table>" : '<div class="pil-vide">Aucun cadeau accordé sur la période</div>') : '<div class="pil-vide">Disponible une fois le script Google installé</div>');
  return h;
}

/* =============== VUE 5 : LIVREURS =============== */
function remisDuJour(jour) {
  var m = {}; cache.caisse.forEach(function (c) { if (c.jour === jour) m[c.livreur] = c.remis; });
  var loc = lsGet("sr_pil_remis_" + jour, {}); Object.keys(loc).forEach(function (k) { if (m[k] === undefined) m[k] = loc[k]; });
  return m;
}
var MOTIFS_LIB = { INJOIGNABLE: "injoignable", ADRESSE: "adresse introuvable", ABSENT: "absent", REFUSE: "refus", PAIEMENT: "paiement", AUTRE: "autre" };
function minutesTxt(m) { return m === null || m === undefined ? "" : m < 1 ? "à l'instant" : m < 60 ? "il y a " + m + " min" : m < 1440 ? "il y a " + Math.floor(m / 60) + " h" : "il y a " + Math.floor(m / 1440) + " j"; }
function blocsLivreurs(noms) {
  var h = "";
  if (!cache.livOk) return h + '<div class="pil-vide" style="margin-top:14px">Jours travaillés, positions, consigne et caisse partagée : installez le script Google « Espace livreur V3 ».</div>';
  var mois = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  h += '<h3 class="pil-t">🗓️ Jours travaillés — ' + esc(mois) + ' <span style="font-weight:400;color:#64748b;font-size:12px">(base de paie à la journée : un jour compte dès qu\'une livraison est confirmée)</span></h3>' +
    '<table class="pil-tb"><tr><th>Livreur</th><th class="r">Jours travaillés</th><th class="r">Livraisons du mois</th><th class="r">Livraisons 30 j</th><th>Problèmes signalés (30 j)</th><th class="r">Écart de caisse (30 j)</th></tr>' +
    cache.livStats.map(function (o) { var pb = Object.keys(o.problemes || {}).map(function (k) { return esc(MOTIFS_LIB[k] || k) + " " + o.problemes[k]; }).join(" · ");
      return "<tr><td><b>" + esc(o.nom) + '</b></td><td class="r"><b>' + o.joursMois + '</b></td><td class="r">' + o.livraisonsMois + '</td><td class="r">' + o.livraisons30 + "</td><td>" + (pb || "–") + '</td><td class="r"><b style="color:' + (o.ecart30 < 0 ? "#dc2626" : o.ecart30 > 0 ? "#f59e0b" : "#16a34a") + '">' + (o.ecart30 > 0 ? "+" : "") + ar(o.ecart30) + "</b></td></tr>"; }).join("") + "</table>" +
    '<div style="font-size:12px;color:#64748b;margin-top:4px">L\'historique commence à l\'installation du script V3 (les livraisons plus anciennes ne comptent pas).</div>';
  h += '<h3 class="pil-t">📍 Où sont-ils ? <span style="font-weight:400;color:#64748b;font-size:12px">(position envoyée tant que leur application est ouverte)</span></h3>';
  h += cache.positions.length ? '<table class="pil-tb"><tr><th>Livreur</th><th>Dernière position</th><th>Précision</th><th></th></tr>' + cache.positions.slice().sort(function (a, b) { return (a.minutes || 0) - (b.minutes || 0); }).map(function (x) { return "<tr><td><b>" + esc(x.nom) + '</b></td><td style="color:' + (x.minutes > 30 ? "#dc2626" : "#16a34a") + '">' + esc(minutesTxt(x.minutes)) + "</td><td>±" + x.prec + ' m</td><td><a class="pil-btn" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + x.lat + "," + x.lng + '">🗺️ Voir</a></td></tr>'; }).join("") + "</table>" : '<div class="pil-vide">Aucune position reçue pour le moment</div>';
  var jour = jourStr(debut(new Date()));
  h += '<h3 class="pil-t">📢 Consigne du jour</h3><div class="pil-kpi" style="margin-bottom:8px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select id="pil-cs-cible" class="pil-in"><option value="TOUS">Tous les livreurs</option>' + cache.livStats.map(function (o) { return '<option value="' + esc(o.nom) + '">' + esc(o.nom) + "</option>"; }).join("") + '</select><input id="pil-cs-txt" class="pil-in" style="flex:1;min-width:220px" maxlength="300" placeholder="Ex : Pluie, prévoir 30 min de plus"><button class="pil-btn or" data-cs="pub" type="button">Publier</button><button class="pil-btn" data-cs="off" type="button">Retirer</button></div>' +
    (cache.consignes.length ? '<div style="margin-top:8px;font-size:12px">Actives : ' + cache.consignes.map(function (c) { return "<b>" + esc(c.cible) + "</b> : " + esc(c.texte); }).join(" · ") + "</div>" : "") + "</div>";
  var sem = {}; cache.caisse.forEach(function (c) { sem[c.livreur] = (sem[c.livreur] || []).concat([c]); });
  var der = cache.caisse.slice(-14).reverse();
  if (der.length) h += '<h3 class="pil-t">🧾 Dernières remises de caisse</h3><table class="pil-tb"><tr><th>Jour</th><th>Livreur</th><th class="r">Attendu</th><th class="r">Remis</th><th class="r">Écart</th></tr>' + der.map(function (c) { return "<tr><td>" + esc(c.jour.split("-").reverse().join("/")) + "</td><td>" + esc(c.livreur) + '</td><td class="r">' + ar(c.attendu) + '</td><td class="r">' + ar(c.remis) + '</td><td class="r"><b style="color:' + (c.ecart === 0 ? "#16a34a" : "#dc2626") + '">' + (c.ecart > 0 ? "+" : "") + ar(c.ecart) + "</b></td></tr>"; }).join("") + "</table>" +
    '<div style="font-size:12px;color:#64748b;margin-top:4px">La caisse n\'est jamais visible par les livreurs.</div>';
  return h;
}
function vueLivreurs(l) {
  var lim = Date.now() - 30 * 86400000, par = {}, auj = debut(new Date()), jour = jourStr(auj);
  l.forEach(function (o) {
    if (!o.livreur || !o.date || o.date.getTime() < lim) return;
    var r = par[o.livreur] = par[o.livreur] || { liv: 0, ann: 0, enc: 0, ca: 0, aEnc: 0, inc: 0, attendu: 0, inc2: 0 };
    if (o.statut === "LIVRE") { r.liv++; r.ca += o.montant; var d = dateLiv(o); if (d && jourStr(d) === jour) { var e = aEncaisser(o); if (e.v === null) r.inc2++; else r.attendu += e.v; } }
    else if (o.statut === "ANNULE") r.ann++;
    else if (ENCOURS.indexOf(o.statut) !== -1) { r.enc++; var e2 = aEncaisser(o); if (e2.v === null) r.inc++; else r.aEnc += e2.v; }
  });
  var noms = Object.keys(par).sort(function (a, b) { return par[b].liv - par[a].liv; }), remis = remisDuJour(jour);
  var h = '<h3 class="pil-t" style="margin-top:0">🛵 Livreurs (30 derniers jours)</h3>';
  if (!noms.length) return h + '<div class="pil-vide">Aucune commande assignée à un livreur sur la période</div>' + blocsLivreurs([]);
  h += '<table class="pil-tb"><tr><th>Livreur</th><th class="r">En cours</th><th class="r">Livrées</th><th class="r">Annulées</th><th class="r">Taux de livraison</th><th class="r">Ventes livrées</th><th class="r">À encaisser (en cours)</th></tr>' +
    noms.map(function (k) { var r = par[k]; return "<tr><td><b>" + esc(k) + '</b></td><td class="r">' + r.enc + '</td><td class="r">' + r.liv + '</td><td class="r">' + r.ann + '</td><td class="r">' + pct(r.liv, r.liv + r.ann) + '</td><td class="r">' + ar(r.ca) + '</td><td class="r"><b>' + ar(r.aEnc) + "</b>" + (r.inc ? ' <span style="color:#dc2626" title="frais non confirmés">⚠️ ' + r.inc + "</span>" : "") + "</td></tr>"; }).join("") + "</table>";
  h += '<h3 class="pil-t">💵 Écart de caisse du jour (' + auj.toLocaleDateString("fr-FR") + ')</h3><div style="font-size:12px;color:#64748b;margin-bottom:6px">« Attendu » = argent à récupérer sur les commandes payées à la livraison et livrées aujourd\'hui. Saisissez ce que chaque livreur vous a remis : l\'écart apparaît tout de suite (enregistré sur cet appareil).</div>' +
    '<table class="pil-tb"><tr><th>Livreur</th><th class="r">Attendu</th><th class="r">Remis</th><th class="r">Écart</th></tr>' +
    noms.map(function (k) { var r = par[k], rem = remis[k], ec = rem === undefined || rem === "" ? null : Number(rem) - r.attendu; return "<tr><td>" + esc(k) + '</td><td class="r">' + ar(r.attendu) + (r.inc2 ? ' <span style="color:#dc2626">⚠️ ' + r.inc2 + "</span>" : "") + '</td><td class="r"><input class="pil-in" type="number" min="0" data-remis="' + esc(k) + '" value="' + (rem === undefined ? "" : esc(rem)) + '" placeholder="montant remis"></td><td class="r">' + (ec === null ? "–" : '<b style="color:' + (ec === 0 ? "#16a34a" : "#dc2626") + '">' + (ec > 0 ? "+" : "") + ar(ec) + (ec === 0 ? " ✔" : ec < 0 ? " manquant" : " en trop") + "</b>") + "</td></tr>"; }).join("") + "</table>";
  return h + blocsLivreurs(noms);
}

/* =============== VUE 6 : ALERTES =============== */
function vueAlertes(l) {
  var al = alertes(l), h = '<h3 class="pil-t" style="margin-top:0">🔔 Alertes (' + al.length + ")</h3>";
  if (!al.length) return h + '<div class="pil-vide" style="font-size:14px">✅ Tout est sous contrôle</div>';
  al.forEach(function (a, i) { h += '<div class="pil-al ' + a.n + '"><span>' + (a.n === "crit" ? "🔴 " : "🟠 ") + esc(a.t) + '</span><button class="pil-btn" data-al="' + i + '" type="button">Voir</button></div>'; });
  return h;
}

/* =============== VUE 7 : JOURNAL =============== */
function vueJournal() {
  var h = '<h3 class="pil-t" style="margin-top:0">📜 Journal des actions</h3>';
  if (cache.journal === null) return h + '<div class="pil-vide">Chargement…</div>';
  if (!cache.journal.length) return h + '<div class="pil-vide">Aucune ligne (ou script Google à mettre à jour)</div>';
  return h + '<table class="pil-tb"><tr><th>Date</th><th>Action</th><th>Détail</th></tr>' + cache.journal.slice(0, 150).map(function (j) { return "<tr><td style='white-space:nowrap'>" + esc(j.date) + "</td><td>" + esc(j.action) + "</td><td>" + esc(j.detail) + "</td></tr>"; }).join("") + "</table>";
}

/* ---------------- Rendu général ---------------- */
var VUES = [["jour", "🎯 Aujourd'hui"], ["perf", "📈 Performance"], ["clients", "👥 Clients"], ["renta", "💰 Rentabilité"], ["livreurs", "🛵 Livreurs"], ["alertes", "🔔 Alertes"], ["journal", "📜 Journal"]];
function rendre() {
  var tab = $("tab-pilotage"); if (!tab) return;
  var l = toutes(), nCrit = alertes(l).filter(function (a) { return a.n === "crit"; }).length, h = '<div class="pil-sub">';
  VUES.forEach(function (v) { h += '<button type="button" data-v="' + v[0] + '" class="' + (cache.vue === v[0] ? "on" : "") + '">' + v[1] + (v[0] === "alertes" && nCrit ? '<span class="n">' + nCrit + "</span>" : "") + "</button>"; });
  h += '<span style="margin-left:auto;font-size:12px;color:#64748b;align-self:center">' + (cache.ok ? "Données serveur à jour" : "⚠️ Script Google pas encore à jour : suivi limité") + ' <button class="pil-btn" id="pil-refresh" type="button">↻</button></span></div>';
  var f = { jour: vueJour, perf: vuePerf, clients: vueClients, renta: vueRenta, livreurs: vueLivreurs, alertes: vueAlertes, journal: vueJournal }[cache.vue] || vueJour;
  var scroll = tab.scrollTop;
  tab.innerHTML = h + f(l);
  majPastille();
}

/* ---------------- Données du script Google ---------------- */
async function charger(force) {
  if (cache.enCours || (!force && Date.now() - cache.t < 45000)) return;
  cache.enCours = true;
  try {
    var s = await postAPI({ action: "gestionCadeaux", operation: "suiviCommandes" });
    var c = await postAPI({ action: "gestionCadeaux", operation: "cadeauxCommandes" });
    cache.suivi = s.suivi || {}; cache.cad = c.cadeaux || {}; cache.ok = true;
  } catch (e) { cache.ok = false; }
  try { var pa = await postAPI({ action: "gestionCadeaux", operation: "clientsParrainage" }); cache.parrains = pa.clients || []; } catch (e) {}
  await chargerLivreurs();
  if (force || Date.now() - cache.tProd > 600000) {
    try { var r = await fetch(apiUrl() + "?t=" + Date.now()); var j = await r.json(); if (Array.isArray(j)) { cache.produits = j; cache.tProd = Date.now(); } } catch (e) {}
  }
  if (cache.vue === "journal") await chargerJournal();
  cache.t = Date.now(); cache.enCours = false;
  var tab = $("tab-pilotage"); if (tab && tab.style.display !== "none") rendre(); else majPastille();
}
async function chargerLivreurs() {
  try {
    var a = await postAPI({ action: "livreurAdmin", operation: "statsLivreurs" }); cache.livStats = a.livreurs || []; cache.livOk = true;
    try { cache.positions = (await postAPI({ action: "livreurAdmin", operation: "positions" })).positions || []; } catch (e) {}
    try { cache.caisse = (await postAPI({ action: "livreurAdmin", operation: "caisseListe" })).caisse || []; } catch (e) {}
    try { cache.consignes = (await postAPI({ action: "livreurAdmin", operation: "consigneLire" })).consignes || []; } catch (e) {}
  } catch (e) { cache.livOk = false; }
}
async function chargerJournal() { try { var j = await postAPI({ action: "gestionCadeaux", operation: "journal" }); cache.journal = j.journal || []; } catch (e) { cache.journal = []; } }
function noter(texte) { postAPI({ action: "gestionCadeaux", operation: "journaliser", texte: texte }).catch(function () {}); }

/* ---------------- Actions ---------------- */
function attenduJour(nom) {
  var jour = jourStr(debut(new Date())), tot = 0;
  toutes().forEach(function (o) { if (o.livreur === nom && o.statut === "LIVRE") { var d = dateLiv(o); if (d && jourStr(d) === jour) { var e = aEncaisser(o); if (e.v !== null) tot += e.v; } } });
  return tot;
}
async function publierConsigne(publier) {
  var cible = ($("pil-cs-cible") || {}).value || "TOUS", texte = publier ? (($("pil-cs-txt") || {}).value || "").trim() : "";
  if (publier && !texte) { toast("Écrivez la consigne"); return; }
  try { var r = await postAPI({ action: "livreurAdmin", operation: "consigne", cible: cible, texte: texte }); toast("✔ " + (r.message || "Fait")); noter("Consigne " + cible + " : " + (texte || "retirée")); await chargerLivreurs(); rendre(); }
  catch (e) { toast("❌ " + e.message); }
}
async function plusProche(id) {
  try {
    var r = await postAPI({ action: "livreurAdmin", operation: "proches", idCommande: id });
    var l = (r.livreurs || []).slice(0, 3);
    if (!l.length) { toast("Aucun livreur n'a envoyé sa position"); return; }
    toast("🛵 Plus proche de #" + id + " : " + l.map(function (x) { return x.nom + " " + String(x.km).replace(".", ",") + " km (" + minutesTxt(x.minutes) + ")"; }).join(" · ") + (r.commande.src === "quartier" ? " — adresse approximative" : ""));
  } catch (e) { toast("❌ " + e.message); }
}
async function agir(id, act) {
  if (act === "proche") { plusProche(id); return; }
  try {
    if (act === "valider") { if (typeof updateStatus === "function") await updateStatus(id, "SÉRIEUX"); noter("Commande #" + id + " validée depuis Pilotage"); }
    else if (act === "non" || act === "raz") { var r = await postAPI({ action: "gestionCadeaux", operation: act === "non" ? "appelSansReponse" : "reinitialiserAppels", idCommande: id }); toast("✔ " + (r.message || "Enregistré")); }
    else if (act === "annuler") {
      if (!confirm("Annuler la commande #" + id + " après 3 appels sans réponse ?")) return;
      var r2 = await postAPI({ action: "gestionCadeaux", operation: "annulerNonReponse", idCommande: id }); toast("✔ " + (r2.message || "Annulée"));
      if (typeof refreshAll === "function") await refreshAll();
    }
    await charger(true);
  } catch (e) { toast("❌ " + e.message); }
}
async function offrirCadeau(t9, forcer, saisie) {
  var c = clients(toutes()).filter(function (x) { return x.t9 === t9; })[0]; if (!c) return;
  if (!saisie) {
    var ch = prompt("Cadeau pour " + c.nom + " :\n1 = Livraison offerte\n2 = Remise en Ar\n3 = Remise en %", "1"); if (!ch) return;
    saisie = { type: ch === "2" ? "REMISE_AR" : ch === "3" ? "REMISE_PCT" : "LIVRAISON_OFFERTE", valeur: 0, plafond: 0 };
    if (saisie.type === "REMISE_AR") { var v = prompt("Montant de la remise (Ar) :", "3000"); if (!v) return; saisie.valeur = num(v); }
    if (saisie.type === "REMISE_PCT") { var p = prompt("Pourcentage (1 à 50) :", "10"); if (!p) return; saisie.valeur = num(p); saisie.plafond = 5000; }
    if (saisie.type === "LIVRAISON_OFFERTE") saisie.plafond = 6000;
    saisie.motif = prompt("Motif (facultatif) :", "Geste commercial") || "";
  }
  try {
    var r = await postAPI({ action: "gestionCadeaux", operation: "offrirPromesse", tel: c.tel, type: saisie.type, valeur: saisie.valeur, plafond: saisie.plafond, motif: saisie.motif, forcer: !!forcer });
    toast("✔ " + (r.message || "Cadeau promis"));
  } catch (e) {
    if (/dépasse/.test(e.message) && !forcer && confirm(e.message + "\n\nOffrir quand même ?")) return offrirCadeau(t9, true, saisie);
    toast("❌ " + e.message);
  }
}
function saisirAchat(nom) {
  var a = prixAchat(), k = cleProd(nom), v = prompt("Prix d'achat unitaire (Ar) pour « " + nom + " » :", a[k] != null ? a[k] : ""); if (v === null) return;
  var n = num(v); if (n > 0) a[k] = n; else delete a[k];
  lsSet("sr_cfg_prix_achat", a); toast("✔ Prix d'achat enregistré"); rendre();
}

/* ---------------- Mise en place ---------------- */
function installer() {
  if ($("tab-pilotage")) return;
  var zone = document.querySelector(".content"), nav = document.querySelector(".sidebar nav");
  if (!zone || !nav) return;
  var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  var tab = document.createElement("div"); tab.id = "tab-pilotage"; tab.className = "tab-content"; tab.style.cssText = "display:none;padding:20px;"; zone.insertBefore(tab, zone.firstChild);
  var lien = document.createElement("div"); lien.id = "sr-pil-nav"; lien.className = "nav-link"; lien.setAttribute("onclick", "showTab('tab-pilotage', this)");
  lien.innerHTML = '<i class="fas fa-bullseye"></i> Pilotage'; lien.style.display = "none"; nav.insertBefore(lien, nav.firstChild);
  tab.addEventListener("click", function (e) {
    var t = e.target, b; if (!t.closest) return;
    if ((b = t.closest("[data-v]"))) { cache.vue = b.getAttribute("data-v"); if (cache.vue === "journal") { cache.journal = null; rendre(); chargerJournal().then(rendre); } else rendre(); return; }
    if ((b = t.closest("[data-f]"))) { var v = b.getAttribute("data-f"); cache.filtre = (cache.filtre === v) ? "" : v; rendre(); return; }
    if ((b = t.closest("[data-seg]"))) { var s = b.getAttribute("data-seg"); cache.seg = (cache.seg === s) ? "" : s; cache.ouvert = ""; rendre(); return; }
    if ((b = t.closest("[data-al]"))) { var a = alertes(toutes())[Number(b.getAttribute("data-al"))]; if (a) { cache.vue = a.v || "jour"; cache.filtre = a.f || ""; cache.seg = a.seg || ""; rendre(); } return; }
    if ((b = t.closest("[data-gift]"))) { offrirCadeau(b.getAttribute("data-gift")); return; }
    if ((b = t.closest("[data-achat]"))) { saisirAchat(b.getAttribute("data-achat")); return; }
    if (t.closest("#pil-refresh")) { charger(true); if (typeof refreshAll === "function") refreshAll(); return; }
    if ((b = t.closest("[data-cs]"))) { publierConsigne(b.getAttribute("data-cs") === "pub"); return; }
    if ((b = t.closest("[data-act]"))) { var c = b.closest(".pil-card"); if (c) agir(c.getAttribute("data-id"), b.getAttribute("data-act")); return; }
    if (t.closest("[data-stop]")) return;
    if ((b = t.closest("tr.cl"))) { var k = b.getAttribute("data-cl"); cache.ouvert = cache.ouvert === k ? "" : k; rendre(); }
  });
  tab.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "pil-obj-j" || t.id === "pil-obj-s") { var o = lsGet("sr_pil_obj", { jour: 0, semaine: 0 }); o[t.id === "pil-obj-j" ? "jour" : "semaine"] = num(t.value); lsSet("sr_pil_obj", o); rendre(); }
    else if (t.getAttribute && t.getAttribute("data-remis") !== null) {
      var lv = t.getAttribute("data-remis"), jr = jourStr(debut(new Date())), loc = lsGet("sr_pil_remis_" + jr, {}); loc[lv] = t.value; lsSet("sr_pil_remis_" + jr, loc);
      if (t.value === "") { rendre(); return; }
      var att = attenduJour(lv), rem = num(t.value);
      postAPI({ action: "livreurAdmin", operation: "caisseEnregistrer", jour: jr, livreur: lv, attendu: att, remis: rem }).then(function (r) {
        cache.caisse = cache.caisse.filter(function (c) { return !(c.jour === jr && c.livreur === lv); }).concat([{ jour: jr, livreur: lv, attendu: att, remis: rem, ecart: rem - att }]);
        toast("✔ Remise de caisse enregistrée"); noter("Caisse " + lv + " : attendu " + att + ", remis " + rem); rendre();
      }).catch(function () { toast("⚠️ Enregistré sur cet appareil seulement (script Google V3 requis)"); rendre(); });
    }
  });
}
function accrocher() {
  installer();
  if (typeof window.showTab === "function" && !window.showTab.__pil) {
    var s0 = window.showTab; window.showTab = function (id, el) { s0.apply(this, arguments); if (id === "tab-pilotage") { var vt = $("view-title"); if (vt) vt.innerText = "Pilotage"; rendre(); charger(true); } };
    window.showTab.__pil = true;
  }
  if (typeof window.appliquerDroits === "function" && !window.appliquerDroits.__pil) {      // le Pilotage est réservé à l'ADMIN (marges, caisse, journal)
    var d0 = window.appliquerDroits; window.appliquerDroits = function (role) { d0.apply(this, arguments); var n = $("sr-pil-nav"); if (n) n.style.display = role === "ADMIN" ? "flex" : "none"; };
    window.appliquerDroits.__pil = true;
  }
  if (typeof window.refreshAll === "function" && !window.refreshAll.__pil) {
    var r0 = window.refreshAll; window.refreshAll = async function () { var x = await r0.apply(this, arguments); try { var tb = $("tab-pilotage"); if (tb && tb.style.display !== "none") rendre(); else majPastille(); charger(false); } catch (e) {} return x; };
    window.refreshAll.__pil = true;
  }
}
accrocher();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", accrocher);
setTimeout(accrocher, 1500);

} catch (e) { console.error("[Pilotage]", e); }
})();