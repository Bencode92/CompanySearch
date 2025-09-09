// Script d'enrichissement Pappers avancé avec batch, filtres et multi-formats
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// ====== CONFIG API ======
const TOKEN = process.env.PAPPERS_API_KEY;
if (!TOKEN) {
  console.error('❌ Manque PAPPERS_API_KEY (dans .env en local, ou secret GitHub en CI).');
  process.exit(1);
}

// ====== PARSING CLI ======
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

// Paramètres avec valeurs par défaut
const IN = path.resolve(args.in || 'output/sirens_7820Z_idf.csv');
const CUT = args.date ? String(args.date).trim() : null;
const FORMAT = args.format || 'csv'; // csv, json, xlsx
const BATCH_SIZE = parseInt(args.batch) || 100; // Traitement par batch
const MIN_CA = parseInt(args.ca_min) || 0;
const MAX_CA = parseInt(args.ca_max) || 0;
const MIN_EFFECTIF = parseInt(args.effectif_min) || 0;
const MAX_EFFECTIF = parseInt(args.effectif_max) || 0;
const VILLE_FILTER = args.ville ? args.ville.toLowerCase().split(',') : [];
const INCLUDE_INACTIVE = args.inactive === 'true';
const CONCURRENT_REQUESTS = parseInt(args.concurrent) || 3; // Requêtes parallèles

// Nom de sortie
const timestamp = new Date().toISOString().slice(0, 10);
const filterSuffix = CUT ? `_avant_${CUT.replace(/[^\d]/g, '')}` : '';
const outputName = args.out || `dirigeants_enrichis${filterSuffix}_${timestamp}`;
const OUTPUT_DIR = path.dirname(args.out || 'output/dummy');
const OUT = path.join(OUTPUT_DIR, `${path.basename(outputName, path.extname(outputName))}.${FORMAT}`);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ====== HELPERS ======
const http = axios.create({
  baseURL: 'https://api.pappers.fr/v2',
  timeout: 25000,
  headers: { 'api-key': TOKEN }
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsvRow(a) { return a.map(csvEscape).join(';') + '\n'; }

// Parse flexible date formats
function parseFlexibleDate(str) {
  if (!str) return null;
  const s = String(str).trim();

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };

  m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return { y: +m[3], m: +m[2], d: +m[1] };

  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return { y: +m[3], m: +m[2], d: +m[1] };

  m = s.match(/^(\d{4})$/);
  if (m) return { y: +m[1], m: 1, d: 1 };

  return null;
}

function cmpDates(a, b) {
  const av = (a.y || 0) * 10000 + (a.m || 1) * 100 + (a.d || 1);
  const bv = (b.y || 0) * 10000 + (b.m || 1) * 100 + (b.d || 1);
  return av - bv;
}

function calcAgeAt(dob, at) {
  let age = at.y - dob.y;
  if ((at.m < dob.m) || (at.m === dob.m && at.d < dob.d)) age--;
  return age;
}

function isPhysical(rep) {
  if (rep?.siren || rep?.denomination) return false;
  return !!(rep?.nom || rep?.prenom || rep?.date_de_naissance || rep?.date_naissance);
}

function loadSirens(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  if (lines.length === 0) return [];

  const sep = lines[0].includes(';') ? ';' : lines[0].includes(',') ? ',' : /\t/.test(lines[0]) ? '\t' : ';';
  const header = lines[0].split(sep).map(s => s.trim().toLowerCase());
  const idx = header.indexOf('siren') !== -1 ? header.indexOf('siren') : 0;

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const s = (cols[idx] || '').replace(/\D/g, '');
    if (/^\d{9}$/.test(s)) out.push(s);
  }
  return Array.from(new Set(out));
}

function showHelp() {
  console.log(`
📋 USAGE : node scripts/enrich_pappers_advanced.js [options]

OPTIONS PRINCIPALES :
  --in=fichier.csv             Fichier CSV d'entrée avec SIREN
  --date=YYYY-MM-DD           Date cutoff pour l'âge des dirigeants
  --format=csv|json|xlsx      Format de sortie (défaut: csv)
  --batch=100                 Taille des batchs (défaut: 100)
  --concurrent=3              Requêtes parallèles (défaut: 3)

FILTRES ENTREPRISE :
  --ca_min=1000000           CA minimum en euros
  --ca_max=10000000          CA maximum en euros
  --effectif_min=10          Effectif minimum
  --effectif_max=500         Effectif maximum
  --ville=paris,lyon         Villes du siège (virgules)
  --inactive=true            Inclure entreprises cessées

EXEMPLES :
  # Dirigeants seniors avec CA > 1M€
  node scripts/enrich_pappers_advanced.js --date=1965-12-31 --ca_min=1000000
  
  # Export JSON, entreprises de Paris uniquement
  node scripts/enrich_pappers_advanced.js --format=json --ville=paris
  
  # Batch rapide avec 5 requêtes parallèles
  node scripts/enrich_pappers_advanced.js --batch=200 --concurrent=5
`);
}

// Traitement d'un batch de SIREN
async function processBatch(sirens, cutoff, results) {
  const promises = sirens.map(async (siren) => {
    try {
      const { data: ent } = await http.get('/entreprise', {
        params: { siren, integrer_diffusions_partielles: true }
      });

      // Filtres entreprise
      if (!INCLUDE_INACTIVE && ent.entreprise_cessee) return null;
      
      const ca = ent.chiffre_affaires || 0;
      if (MIN_CA > 0 && ca < MIN_CA) return null;
      if (MAX_CA > 0 && ca > MAX_CA) return null;
      
      const effectif = ent.effectif || 0;
      if (MIN_EFFECTIF > 0 && effectif < MIN_EFFECTIF) return null;
      if (MAX_EFFECTIF > 0 && effectif > MAX_EFFECTIF) return null;
      
      const ville = (ent?.siege?.ville || '').toLowerCase();
      if (VILLE_FILTER.length > 0 && !VILLE_FILTER.includes(ville)) return null;

      // Extraction des données
      const denom = ent.denomination || ent.nom_entreprise || '';
      const naf = ent.code_naf || '';
      const libNaf = ent.libelle_code_naf || '';
      const villeSiege = ent?.siege?.ville || '';
      const codePostal = ent?.siege?.code_postal || '';
      const cessee = !!ent.entreprise_cessee;
      const dateCreation = ent.date_creation || '';
      const formeJuridique = ent.forme_juridique || '';
      const trancheCA = ent.tranche_chiffre_affaires || '';
      const trancheEffectif = ent.tranche_effectif || '';

      const reps = Array.isArray(ent.representants) ? ent.representants : [];
      const dirigeants = [];

      for (const r of reps) {
        if (!isPhysical(r)) continue;

        const raw = r.date_de_naissance || r.date_naissance || '';
        const dob = parseFlexibleDate(raw);
        
        // Filtre par date si spécifié
        if (cutoff && dob && cmpDates(dob, cutoff) >= 0) continue;

        let age = '';
        if (dob && dob.y) {
          const today = { y: new Date().getFullYear(), m: new Date().getMonth() + 1, d: new Date().getDate() };
          age = calcAgeAt(dob, today);
        }

        dirigeants.push({
          siren,
          denomination: denom,
          code_naf: naf,
          libelle_code_naf: libNaf,
          ville_siege: villeSiege,
          code_postal: codePostal,
          entreprise_cessee: cessee ? 'oui' : 'non',
          date_creation: dateCreation,
          forme_juridique: formeJuridique,
          tranche_ca: trancheCA,
          tranche_effectif: trancheEffectif,
          chiffre_affaires: ca,
          effectif: effectif,
          dir_nom: r.nom || '',
          dir_prenom: r.prenom || '',
          dir_qualite: r.qualite || r.fonction || '',
          dir_date_naissance: raw,
          dir_age_actuel: age
        });
      }

      return dirigeants.length > 0 ? dirigeants : null;
    } catch (e) {
      console.error(`⚠️ Erreur ${siren}:`, e?.response?.status || e.message);
      return null;
    }
  });

  const batchResults = await Promise.all(promises);
  
  // Aplatir et filtrer les nulls
  for (const result of batchResults) {
    if (result) {
      results.push(...result);
    }
  }
  
  // Petit délai entre les batchs
  await sleep(100);
}

// Export des résultats
function exportResults(results, format, filepath) {
  switch (format) {
    case 'json':
      const jsonData = {
        metadata: {
          date_export: new Date().toISOString(),
          total_dirigeants: results.length,
          filtres: {
            date_cutoff: CUT,
            ca_min: MIN_CA,
            ca_max: MAX_CA,
            effectif_min: MIN_EFFECTIF,
            effectif_max: MAX_EFFECTIF,
            villes: VILLE_FILTER
          }
        },
        dirigeants: results
      };
      fs.writeFileSync(filepath, JSON.stringify(jsonData, null, 2), 'utf8');
      break;
      
    case 'xlsx':
      try {
        const XLSX = require('xlsx');
        const ws = XLSX.utils.json_to_sheet(results);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Dirigeants');
        XLSX.writeFile(wb, filepath);
      } catch (e) {
        console.warn('⚠️ Module xlsx non installé. Export en CSV.');
        exportCSV(results, filepath.replace('.xlsx', '.csv'));
      }
      break;
      
    default: // CSV
      exportCSV(results, filepath);
  }
}

function exportCSV(results, filepath) {
  if (results.length === 0) {
    fs.writeFileSync(filepath, 'Aucun résultat\n', 'utf8');
    return;
  }
  
  const headers = Object.keys(results[0]);
  let csv = toCsvRow(headers);
  
  for (const row of results) {
    csv += toCsvRow(headers.map(h => row[h]));
  }
  
  fs.writeFileSync(filepath, csv, 'utf8');
}

// ====== MAIN ======
(async () => {
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const sirens = loadSirens(IN);
  if (!sirens.length) {
    console.error(`❌ Aucun SIREN trouvé dans ${IN}`);
    process.exit(1);
  }

  const cutoff = CUT ? parseFlexibleDate(CUT) : null;
  
  console.log('🚀 Enrichissement Pappers avancé');
  console.log(`📄 Fichier source : ${IN}`);
  console.log(`🧾 ${sirens.length} SIREN à enrichir`);
  if (cutoff) console.log(`📅 Date cutoff : ${CUT}`);
  console.log(`📦 Batch : ${BATCH_SIZE} | Parallèle : ${CONCURRENT_REQUESTS}`);
  
  if (MIN_CA || MAX_CA) console.log(`💰 CA : ${MIN_CA || 0} - ${MAX_CA || '∞'} €`);
  if (MIN_EFFECTIF || MAX_EFFECTIF) console.log(`👥 Effectif : ${MIN_EFFECTIF || 0} - ${MAX_EFFECTIF || '∞'}`);
  if (VILLE_FILTER.length) console.log(`📍 Villes : ${VILLE_FILTER.join(', ')}`);
  console.log('');

  const results = [];
  const startTime = Date.now();
  
  // Traitement par batchs
  for (let i = 0; i < sirens.length; i += BATCH_SIZE) {
    const batch = sirens.slice(i, i + BATCH_SIZE);
    const progress = Math.min(i + BATCH_SIZE, sirens.length);
    
    console.log(`⏳ Batch ${Math.floor(i / BATCH_SIZE) + 1} : ${progress}/${sirens.length} (${Math.round(progress * 100 / sirens.length)}%)`);
    
    // Division du batch en sous-groupes pour parallélisation
    const subBatches = [];
    for (let j = 0; j < batch.length; j += CONCURRENT_REQUESTS) {
      subBatches.push(batch.slice(j, j + CONCURRENT_REQUESTS));
    }
    
    for (const subBatch of subBatches) {
      await processBatch(subBatch, cutoff, results);
    }
    
    console.log(`   → ${results.length} dirigeants trouvés`);
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  console.log(`\n💾 Export de ${results.length} dirigeants...`);
  exportResults(results, FORMAT, OUT);
  
  console.log(`✅ Terminé en ${duration}s`);
  console.log(`📄 Fichier : ${OUT}`);
  console.log(`📊 Total : ${results.length} dirigeants`);
})();