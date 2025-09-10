// scripts/enrich_seniors_eco.js
// Usage : node scripts/enrich_seniors_eco.js --cutoff-year=1962 --in=output/sirens_interim_75_92.csv --out=output/dirigeants_seniors_eco.csv

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

const CUTOFF_YEAR = parseInt(args['cutoff-year'] || '1962', 10);
const IN_FILE = args.in || 'output/sirens_interim_75_92.csv';
const OUT_FILE = args.out || 'output/dirigeants_seniors_eco.csv';

// ---------- API KEY ----------
const PAPPERS_API_KEY = process.env.PAPPERS_API_KEY;
if (!PAPPERS_API_KEY) {
  console.error('❌ PAPPERS_API_KEY manquant (secret GitHub ou .env)');
  process.exit(1);
}

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

// CSV RFC 4180 (délimiteur virgule). On cite si : guillemet, virgule, point-virgule, retour ligne.
const DELIM = ',';
function csvEscape(v){
  if (v == null) return '';
  const s = String(v);
  if (/[",;\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsvRow(arr){ return arr.map(csvEscape).join(DELIM) + '\n'; }

function parseYearFromDate(str){
  if (!str) return null;
  const m = String(str).match(/(\d{4})-\d{2}-\d{2}/) || String(str).match(/\b(19\d{2}|20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}
function ageFromYear(year){ return year ? (new Date().getFullYear() - year) : ''; }

function loadSirens(file){
  if (!fs.existsSync(file)) {
    console.error(`❌ Fichier introuvable : ${file}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const out = [];
  for (let i=1;i<lines.length;i++){
    const s = lines[i].trim().replace(/\D/g,'');
    if (/^\d{9}$/.test(s)) out.push(s);
  }
  return Array.from(new Set(out));
}

// Nom société / SIRET siège / Ville / NAF via API gouv (gratuit)
async function fetchFreeCompanyMeta(siren){
  try{
    const { data } = await httpGouv.get('/search', { params: { siren, page:1, per_page:1 } });
    const it = (data?.results || data?.resultats || [])[0];
    if (!it) return {};
    const nom =
      it.nom_entreprise ||
      it.denomination ||
      it.unite_legale?.denomination ||
      it.unite_legale?.nom_raison_sociale || '';
    const siretSiege = it.siret_siege || it.siege?.siret || it.etablissement_siege?.siret || '';
    const ville = it.siege?.ville || it.etablissement_siege?.libelle_commune || it.etablissement_siege?.ville || '';
    const codeNaf = it.activite_principale || it.code_naf || it.siege?.activite_principale || '';
    return { nom, siretSiege, ville, codeNaf };
  } catch { return {}; }
}

// Normalisation sans accents
function normalize(s){
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function isStrictPresident(f){
  const n = normalize(f);
  // on accepte exactement "president" (éventuellement avec majuscules/accents)
  return n === 'president';
}

// ---------- main ----------
(async () => {
  const sirens = loadSirens(IN_FILE);
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  const ws = fs.createWriteStream(OUT_FILE, 'utf8');
  ws.write(toCsvRow([
    'Societe','SIREN','SIRET_siege',
    'Nom_president','Prenom_president','Fonction',
    'Date_naissance','Age','Ville_siege','Code_NAF'
  ]));

  const dateMax = `31-12-${String(CUTOFF_YEAR - 1)}`; // nés AVANT CUTOFF_YEAR
  let totalFound = 0, processed = 0;

  console.log(`🎯 Présidents (personnes physiques) nés avant ${CUTOFF_YEAR} — date_max=${dateMax}`);
  console.log(`📂 Source: ${IN_FILE}  →  📄 Sortie: ${OUT_FILE}`);
  console.log(`🧮 ${sirens.length} SIREN à parcourir\n`);

  for (const siren of sirens){
    processed++;
    if (processed % 25 === 0){
      const pct = Math.round(processed*100/sirens.length);
      console.log(`… ${processed}/${sirens.length} (${pct}%) — présidents trouvés: ${totalFound}`);
    }

    // Métadonnées gratuites
    const meta = await fetchFreeCompanyMeta(siren);

    // Cherche uniquement la qualité "Président"
    let page = 1;
    let tookOneForThisSiren = false; // on garde le premier président (s'il y en a plusieurs, rare)
    while (!tookOneForThisSiren){
      try{
        const { data } = await httpPappers.get('/recherche-dirigeants', {
          params: {
            siren,
            type_dirigeant: 'physique',
            qualite_dirigeant: 'Président',                 // 🔹 filtration côté API
            date_de_naissance_dirigeant_max: dateMax,       // 🔹 nés avant cutoff
            par_page: 100,
            page
          }
        });

        const results = data?.resultats || [];
        if (results.length === 0) break;

        // prends le premier "vrai" président
        for (const r of results){
          const fonction = r.qualite || r.fonction || r.role || '';
          if (!isStrictPresident(fonction)) continue;       // 🔹 re-filtre sécurité

          const nom = r.nom || r.representant?.nom || '';
          const prenom = r.prenom || r.representant?.prenom || '';
          const dob = r.date_de_naissance || r.date_naissance || r.informations_naissance || '';
          const year = parseYearFromDate(dob);
          const age = year ? ageFromYear(year) : (r.age || '');

          const societe =
            meta.nom ||
            r.entreprise?.denomination ||
            r.entreprise?.nom_entreprise || '';

          ws.write(toCsvRow([
            societe, siren, meta.siretSiege || '',
            nom, prenom, 'Président',
            dob || (year ? String(year) : ''), age,
            meta.ville || '', meta.codeNaf || r.code_naf || ''
          ]));

          totalFound++;
          tookOneForThisSiren = true; // 1 ligne max par SIREN
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