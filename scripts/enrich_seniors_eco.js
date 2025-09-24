// scripts/enrich_seniors_eco.js
// Objectif: 1 ligne / SIREN avec le Président (personne physique) si dispo
// Coût base: /recherche-dirigeants (~0,1 crédit / dirigeant trouvé)
// Bonus OFF par défaut: remplir "Objet_social" via /entreprise quand PAPPERS_FETCH_ENTREPRISE=1 (coûte des crédits)

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// ---------- CLI ----------
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);
const IN_FILE  = args.in  || 'output/sirens_interim_75_92.csv';
const OUT_FILE = args.out || 'output/dirigeants_eco.csv';

// ---------- API KEY ----------
const PAPPERS_API_KEY = process.env.PAPPERS_API_KEY;
if (!PAPPERS_API_KEY) {
  console.error('❌ PAPPERS_API_KEY manquant (secret GitHub ou .env)');
  process.exit(1);
}

// Optionnel: enrichir "Objet_social" via /entreprise (OFF par défaut)
const FETCH_ENTREPRISE = String(process.env.PAPPERS_FETCH_ENTREPRISE || '0') === '1';

// ---------- HTTP ----------
const httpPappers = axios.create({
  baseURL: 'https://api.pappers.fr/v2',
  timeout: 25000,
  headers: { 'api-key': PAPPERS_API_KEY }
});

const httpGouv = axios.create({
  baseURL: 'https://recherche-entreprises.api.gouv.fr',
  timeout: 20000
});

// ---------- helpers ----------
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
const safe = v => (v && v !== 'undefined' && v !== 'null') ? String(v) : '';

// CSV (séparateur virgule)
const DELIM = ',';
function csvEscape(v){
  if (v == null) return '';
  const s = String(v);
  if (/[",;\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsvRow(arr){ return arr.map(csvEscape).join(DELIM) + '\n'; }

function loadSirens(file){
  if (!fs.existsSync(file)) {
    console.error(`❌ Fichier introuvable : ${file}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const out = [];
  for (let i=1;i<lines.length;i++){
    const s = lines[i].trim().replace(/[^\d]/g,'');
    if (/^\d{9}$/.test(s)) out.push(s);
  }
  return Array.from(new Set(out));
}

// Nominalize & checks
function normalize(s){ return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
function isStrictPresident(f){ return normalize(f) === 'president'; }

// Meta gratuite via API gouv
function hasAnyMeta(m){ return !!(m && (m.nom || m.siretSiege || m.ville || m.codeNaf)); }
function hasEnoughMeta(m){ return !!(m && (m.nom || m.siretSiege || m.ville)); }

function pickMetaFromGouv(it){
  if (!it) return {};
  const siege =
    it.siege ||
    it.etablissement_siege ||
    (Array.isArray(it.etablissements) ? it.etablissements.find(e => e?.siege) : null) ||
    (Array.isArray(it.etablissements) ? it.etablissements[0] : null) ||
    {};

  const nomPM =
    safe(it.nom_entreprise) ||
    safe(it.denomination) ||
    safe(it.enseigne) ||
    safe(it.unite_legale?.denomination) ||
    safe(it.raison_sociale) ||
    safe(it.nom_raison_sociale);

  const nomPP = [safe(it.unite_legale?.nom), safe(it.unite_legale?.prenoms)]
    .filter(Boolean).join(' ').trim();

  const nom = nomPM || nomPP || safe(it.nom_complet) || '';

  const siretSiege =
    safe(it.siret_siege) ||
    safe(siege?.siret) ||
    safe(siege?.siret_formate)?.replace(/\D/g,'') ||
    '';

  const ville =
    safe(siege?.ville) ||
    safe(siege?.libelle_commune) ||
    safe(siege?.libelle_commune_etranger) ||
    safe(siege?.commune) ||
    '';

  const codeNaf =
    safe(it.activite_principale) ||
    safe(siege?.activite_principale) ||
    safe(siege?.code_naf) ||
    safe(it.code_naf) ||
    safe(it.unite_legale?.activite_principale) ||
    '';

  return { nom, siretSiege, ville, codeNaf };
}

async function fetchFreeCompanyMeta(siren){
  try{
    const { data } = await httpGouv.get('/search', {
      params: { q: siren, precision: 'exacte', page: 1, per_page: 1 }
    });
    const it = (data?.results || data?.resultats || [])[0];
    const m1 = pickMetaFromGouv(it);
    if (hasEnoughMeta(m1)) return m1;
  }catch{}
  try{
    const { data } = await httpGouv.get('/search', {
      params: { siren, page: 1, per_page: 1 }
    });
    const it = (data?.results || data?.resultats || [])[0];
    const m2 = pickMetaFromGouv(it);
    if (hasAnyMeta(m2)) return m2;
  }catch{}
  return {};
}

// Map Libellé NAF minimal (utile pour lecture)
function nafLabel(naf){
  if (naf === '78.20Z') return 'Activités des agences de travail temporaire';
  return '';
}

// Optionnel: /entreprise pour objet social (coûte des crédits selon Pappers)
async function maybeFetchObjetSocial(siren){
  if (!FETCH_ENTREPRISE) return '';
  try{
    const { data } = await httpPappers.get('/entreprise', {
      params: { siren, integrer_diffusions_partielles: true }
    });
    return safe(data?.objet_social) || '';
  }catch{
    return '';
  }
}

// ---------- main ----------
(async () => {
  const sirens = loadSirens(IN_FILE);
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  const ws = fs.createWriteStream(OUT_FILE, 'utf8');
  ws.write(toCsvRow([
    'Societe','SIREN','SIRET_siege',
    'Nom_president','Prenom_president','Fonction',
    'Ville_siege','Code_NAF','Libelle_NAF','Objet_social'
  ]));

  let totalFound = 0, processed = 0;

  console.log(`🎯 Extraction des Présidents (sans filtre d'âge)`);
  console.log(`📂 Source: ${IN_FILE}  →  📄 Sortie: ${OUT_FILE}`);
  console.log(`🧮 ${sirens.length} SIREN à parcourir\n`);

  for (const siren of sirens){
    processed++;
    if (processed % 25 === 0){
      const pct = Math.round(processed*100/sirens.length);
      console.log(`… ${processed}/${sirens.length} (${pct}%) — présidents trouvés: ${totalFound}`);
    }

    // 1) Méta gratuite
    const meta = await fetchFreeCompanyMeta(siren);

    // 2) Cherche uniquement la qualité "Président" (personne physique) — pas de filtre date
    let page = 1;
    let tookOneForThisSiren = false; // 1 ligne max / SIREN
    while (!tookOneForThisSiren){
      try{
        const { data } = await httpPappers.get('/recherche-dirigeants', {
          params: {
            siren,
            type_dirigeant: 'physique',
            qualite_dirigeant: 'Président',
            par_page: 100,
            page
          }
        });

        const results = data?.resultats || [];
        if (results.length === 0) break;

        for (const r of results){
          const fonction = r.qualite || r.fonction || r.role || '';
          if (!isStrictPresident(fonction)) continue; // sécurité

          const pEnt = r.entreprise || {};
          const pSiege = pEnt.siege || {};

          const societe =
            safe(meta.nom) ||
            safe(pEnt.denomination) ||
            safe(pEnt.nom_entreprise) ||
            safe(r.denomination) ||
            safe(r.nom_entreprise) ||
            '';

          const siretSiege =
            safe(meta.siretSiege) ||
            safe(pSiege.siret) ||
            safe(pSiege.siret_formate)?.replace(/\D/g,'') ||
            '';

          const ville =
            safe(meta.ville) ||
            safe(pSiege.ville) ||
            '';

          const codeNaf =
            safe(meta.codeNaf) ||
            safe(r.code_naf) ||
            safe(pEnt.code_naf) ||
            '';

          const nom = safe(r.nom) || safe(r.representant?.nom) || '';
          const prenom = safe(r.prenom) || safe(r.representant?.prenom) || '';

          // Optionnel: objet social (si activé)
          const objetSocial = await maybeFetchObjetSocial(siren);

          ws.write(toCsvRow([
            societe,
            siren,
            siretSiege,
            nom,
            prenom,
            'Président',
            ville,
            codeNaf,
            nafLabel(codeNaf),
            objetSocial
          ]));

          totalFound++;
          tookOneForThisSiren = true;
          break;
        }

        if (!tookOneForThisSiren){
          page++;
          await sleep(120);
        }
      } catch(e){
        if (e?.response?.status === 429){
          console.log('⏳ Rate limit, pause 5s…');
          await sleep(5000);
          continue;
        }
        break; // autre erreur -> siren suivant
      }
    }

    await sleep(80); // petit délai inter-SIREN
  }

  ws.end();
  await new Promise(res => ws.on('finish', res));
  console.log(`\n✅ Terminé — Présidents trouvés: ${totalFound}`);
  console.log(`💳 Crédits (≈): ${Math.round(totalFound)/10} (0,1 par résultat)`);
  console.log(`📄 ${OUT_FILE}`);
})();
