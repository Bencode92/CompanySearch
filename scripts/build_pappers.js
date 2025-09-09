// Node.js 18+
// npm i
// cp .env.example .env  (puis mettre la clé)
// npm run build

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const PAPPERS_API_KEY = process.env.PAPPERS_API_KEY;
if (!PAPPERS_API_KEY) {
  console.error('❌ Manque PAPPERS_API_KEY (cf. .env)');
  process.exit(1);
}

// === Réglages ===
const NAF = '78.20Z';                          // intérim
const DATE_MAX_DIR = '31-12-1961';             // dirigeants nés avant 1962
const PAR_CURSEUR = 500;                       // taille page /recherche (max 1000)
const OUT_FILE = path.join('output', 'interim_dirigeants_<=1961.csv');

const http = axios.create({
  baseURL: 'https://api.pappers.fr/v2',
  timeout: 25000,
  headers: { 'api-key': PAPPERS_API_KEY }
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// CSV safe pour Excel FR (séparateur ';')
function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Si contient ; " \n, on quote et on échappe "
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsvRow(arr) { return arr.map(csvEscape).join(';'); }

// Essaie d'extraire une année (aaaa) d'une date libre
function extractYear(val) {
  if (!val) return null;
  const m = String(val).match(/\b(19\d{2}|20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

// --- 1) Récupérer tous les SIREN éligibles via /recherche ---
// On filtre directement côté Pappers: code_naf + date_de_naissance_dirigeant_max + entreprise_cessee=false
async function* iteratePappersRecherche() {
  let curseur = '*';
  while (true) {
    const params = {
      bases: 'entreprises',
      code_naf: NAF,
      date_de_naissance_dirigeant_max: DATE_MAX_DIR, // JJ-MM-AAAA
      entreprise_cessee: false,
      curseur,
      par_curseur: PAR_CURSEUR,
      precision: 'standard'
    };
    const { data } = await http.get('/recherche', { params });
    const resultats = data?.resultats || [];
    for (const it of resultats) yield it;
    const next = data?.curseurSuivant;
    if (!next || next === curseur) break;
    curseur = next;
    // throttle léger pour rester cool avec l'API
    await sleep(150);
  }
}

// --- 2) Pour chaque SIREN, tirer la fiche /entreprise et filtrer les dirigeants nés ≤ 1961 ---
async function fetchEntreprise(siren) {
  try {
    const { data } = await http.get('/entreprise', {
      params: { siren, integrer_diffusions_partielles: true }
    });
    return data;
  } catch (e) {
    console.error(`⚠️ /entreprise échec pour ${siren}:`, e?.response?.status, e?.response?.data || e.message);
    return null;
  }
}

async function main() {
  fs.mkdirSync('output', { recursive: true });

  const header = [
    'siren',
    'denomination',
    'code_naf',
    'libelle_code_naf',
    'entreprise_cessee',
    'dir_nom',
    'dir_prenom',
    'dir_qualite',
    'dir_date_naissance',
    'dir_age_estime',
  ];
  const rows = [toCsvRow(header)];

  // 1) Liste des SIREN depuis /recherche
  const seen = new Set();
  const sirens = [];
  console.log('🔎 Parcours Pappers /recherche…');
  for await (const r of iteratePappersRecherche()) {
    const s = r?.siren || r?.siren_formate?.replace(/\D/g, '');
    if (!s || s.length !== 9) continue;
    if (!seen.has(s)) {
      seen.add(s);
      sirens.push(s);
    }
  }
  console.log(`✅ ${sirens.length} SIREN trouvés (NAF ${NAF}, dirigeant né ≤ ${DATE_MAX_DIR})`);

  // 2) Fiches détaillées + filtrage dirigeants
  let cpt = 0;
  for (const siren of sirens) {
    cpt++;
    if (cpt % 50 === 0) console.log(`… ${cpt}/${sirens.length}`);

    const ent = await fetchEntreprise(siren);
    if (!ent) { await sleep(200); continue; }

    const denom = ent.denomination || ent.nom_entreprise || '';
    const naf = ent.code_naf || '';
    const libNaf = ent.libelle_code_naf || '';
    const cessee = !!ent.entreprise_cessee;

    const reps = ent.representants || [];
    for (const r of reps) {
      // On ne garde que les personnes physiques avec année <= 1961
      // Champs possibles : date_de_naissance, date_naissance, age, informations_naissance
      const y = extractYear(r.date_de_naissance || r.date_naissance || r.age || r.informations_naissance);
      if (y && y <= 1961) {
        rows.push(toCsvRow([
          siren,
          denom,
          naf,
          libNaf,
          cessee ? 'oui' : 'non',
          r.nom || '',
          r.prenom || '',
          r.qualite || r.fonction || '',
          r.date_de_naissance || r.date_naissance || '',
          r.age || ''
        ]));
      }
    }

    // throttle léger pour être sympa avec l'API
    await sleep(120);
  }

  fs.writeFileSync(OUT_FILE, rows.join('\n'), 'utf8');
  console.log(`📄 Fichier prêt: ${OUT_FILE}`);
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});