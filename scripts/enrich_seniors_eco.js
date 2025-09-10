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

// ---------- API KEYS ----------
const PAPPERS_API_KEY = process.env.PAPPERS_API_KEY;
if (!PAPPERS_API_KEY) {
  console.error('❌ PAPPERS_API_KEY manquant (secret GitHub ou .env)');
  process.exit(1);
}

// ---------- HTTP clients ----------
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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsvRow(arr) { return arr.map(csvEscape).join(';') + '\n'; }

function parseYearFromDate(str) {
  if (!str) return null;
  const m =
    String(str).match(/(\d{4})-\d{2}-\d{2}/) ||          // YYYY-MM-DD
    String(str).match(/\b(19\d{2}|20\d{2})\b/);          // year only
  return m ? parseInt(m[1], 10) : null;
}
function ageFromYear(year) {
  if (!year) return '';
  const now = new Date();
  return now.getFullYear() - year;
}

function loadSirens(file) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Fichier introuvable : ${file}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const s = lines[i].trim().replace(/\D/g, '');
    if (/^\d{9}$/.test(s)) out.push(s);
  }
  return Array.from(new Set(out));
}

// Récup infos gratuites: nom société, SIRET siège, ville, NAF
async function fetchFreeCompanyMeta(siren) {
  try {
    const { data } = await httpGouv.get('/search', {
      params: { siren, page: 1, per_page: 1 }
    });
    const it = (data?.results || data?.resultats || [])[0];
    if (!it) return {};
    const nom =
      it.nom_entreprise ||
      it.denomination ||
      it.unite_legale?.denomination ||
      it.unite_legale?.nom_raison_sociale ||
      '';
    const siretSiege =
      it.siret_siege ||
      it.siege?.siret ||
      it.etablissement_siege?.siret ||
      '';
    const ville =
      it.siege?.ville || it.etablissement_siege?.libelle_commune || it.etablissement_siege?.ville || '';
    const codeNaf =
      it.activite_principale || it.code_naf || it.siege?.activite_principale || '';
    return { nom, siretSiege, ville, codeNaf };
  } catch {
    return {};
  }
}

// ---------- main ----------
(async () => {
  const sirens = loadSirens(IN_FILE);
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  const ws = fs.createWriteStream(OUT_FILE, 'utf8');
  ws.write(toCsvRow([
    'Société',
    'SIREN',
    'SIRET_siege',
    'Nom_dirigeant',
    'Prenom_dirigeant',
    'Fonction',
    'Date_naissance',
    'Age',
    'Ville_siege',
    'Code_NAF'
  ]));

  let totalFound = 0;
  const dateMax = `31-12-${String(CUTOFF_YEAR - 1)}`; // nés AVANT CUTOFF_YEAR

  console.log(`🔎 Dirigeants personnes PHYSIQUES nés avant ${CUTOFF_YEAR} (date_max=${dateMax})`);
  console.log(`📂 Source: ${IN_FILE}  →  📄 Sortie: ${OUT_FILE}`);
  console.log(`🧮 ${sirens.length} SIREN à parcourir\n`);

  let processed = 0;
  for (const siren of sirens) {
    processed++;
    if (processed % 25 === 0) {
      const pct = Math.round((processed * 100) / sirens.length);
      console.log(`… ${processed}/${sirens.length} (${pct}%) — cumul résultats: ${totalFound}`);
    }

    // Métadonnées gratuites (1 appel gratuit / SIREN)
    const meta = await fetchFreeCompanyMeta(siren);

    // Recherche dirigeant (0,1 crédit / résultat)
    let page = 1;
    while (true) {
      try {
        const { data } = await httpPappers.get('/recherche-dirigeants', {
          params: {
            siren,
            type_dirigeant: 'physique',
            date_de_naissance_dirigeant_max: dateMax, // JJ-MM-AAAA
            par_page: 100,
            page
          }
        });

        const results = data?.resultats || [];
        if (results.length === 0) break;

        for (const r of results) {
          // champs tolérants selon schéma Pappers
          const nom = r.nom || r.representant?.nom || '';
          const prenom = r.prenom || r.representant?.prenom || '';
          const fonction = r.qualite || r.fonction || r.role || '';
          const dob = r.date_de_naissance || r.date_naissance || r.informations_naissance || '';
          const year = parseYearFromDate(dob);
          const age = year ? ageFromYear(year) : (r.age || '');
          const societe =
            meta.nom ||
            r.denomination ||
            r.entreprise?.denomination ||
            r.entreprise?.nom_entreprise ||
            '';
          const siretSiege = meta.siretSiege || '';
          const ville = meta.ville || '';
          const codeNaf = meta.codeNaf || r.code_naf || '';

          ws.write(toCsvRow([
            societe,
            siren,
            siretSiege,
            nom,
            prenom,
            fonction,
            dob || (year ? String(year) : ''),
            age,
            ville,
            codeNaf
          ]));
          totalFound++;
        }

        page++;
        await sleep(120); // throttle doux Pappers
      } catch (e) {
        if (e?.response?.status === 429) {
          console.log('⏳ Rate limit, pause 5s…');
          await sleep(5000);
          continue;
        }
        // autre erreur → on passe au SIREN suivant
        break;
      }
    }

    // léger délai entre SIREN
    await sleep(80);
  }

  ws.end();
  await new Promise(res => ws.on('finish', res));

  console.log('\n✅ Terminé');
  console.log(`📈 Dirigeants seniors trouvés: ${totalFound}`);
  console.log(`💳 Crédits consommés (≈): ${Math.round(totalFound) / 10} (0,1 / résultat)`);
  console.log(`📄 Fichier: ${OUT_FILE}`);
})();