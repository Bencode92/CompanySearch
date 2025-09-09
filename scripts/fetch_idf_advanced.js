// Script avancé de collecte SIREN - Île-de-France complète
// Supporte : tous départements IDF, codes NAF multiples, export multi-formats
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ====== CONFIGURATION ======
const BASE = 'https://recherche-entreprises.api.gouv.fr';
const IDF_DEPARTEMENTS = ['75', '77', '78', '91', '92', '93', '94', '95']; // Tous les départements IDF
const PER_PAGE = 25;
const SLEEP_MS = 200;

// ====== PARSING CLI ======
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

// Paramètres avec valeurs par défaut
const DEPARTEMENTS = args.deps ? args.deps.split(',') : IDF_DEPARTEMENTS;
const NAF_CODES = args.naf ? args.naf.split(',') : ['78.20Z']; // Par défaut intérim
const OUTPUT_FORMAT = args.format || 'csv'; // csv, json, xlsx
const OUTPUT_DIR = args.out || 'output';
const BATCH_SIZE = parseInt(args.batch) || 0; // 0 = pas de limite

// Nom de fichier descriptif
const depStr = DEPARTEMENTS.length === 8 ? 'idf' : DEPARTEMENTS.join('_');
const nafStr = NAF_CODES.map(n => n.replace(/\./g, '')).join('_');
const timestamp = args.timestamp ? `_${new Date().toISOString().slice(0,10)}` : '';
const baseFilename = `sirens_${nafStr}_${depStr}${timestamp}`;

// ====== HELPERS ======
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showHelp() {
  console.log(`
📋 USAGE : node scripts/fetch_idf_advanced.js [options]

OPTIONS :
  --deps=75,92,93        Départements (défaut: tous IDF)
  --naf=78.20Z,78.30Z    Codes NAF, séparés par virgules
  --format=csv|json|xlsx Format de sortie (défaut: csv)
  --batch=1000           Limite de résultats (0 = tout)
  --timestamp            Ajoute la date au nom du fichier
  --out=output           Dossier de sortie
  --help                 Affiche cette aide

EXEMPLES :
  # Intérim sur toute l'IDF
  node scripts/fetch_idf_advanced.js
  
  # Conseil (70.22Z) sur Paris uniquement
  node scripts/fetch_idf_advanced.js --deps=75 --naf=70.22Z
  
  # Multi-NAF sur 92 et 93, format JSON
  node scripts/fetch_idf_advanced.js --deps=92,93 --naf=78.20Z,78.30Z --format=json
`);
}

async function fetchSirens(departement, naf) {
  const sirens = new Set();
  let page = 1, totalPages = 1;
  
  console.log(`  📍 Dept ${departement}, NAF ${naf}...`);
  
  do {
    const params = {
      activite_principale: naf,
      departement: departement,
      etat_administratif: 'A',
      page,
      per_page: PER_PAGE
    };

    try {
      const { data } = await axios.get(`${BASE}/search`, { params, timeout: 20000 });
      const results = data?.results || [];
      totalPages = data?.total_pages || page;

      for (const it of results) {
        const siren = 
          it?.siren ||
          it?.siren_formate?.replace(/\D/g,'') ||
          it?.unite_legale?.siren;
        if (siren && /^\d{9}$/.test(String(siren))) {
          sirens.add(String(siren));
          
          // Limite batch si spécifiée
          if (BATCH_SIZE > 0 && sirens.size >= BATCH_SIZE) {
            console.log(`    ⚠️ Limite batch atteinte (${BATCH_SIZE})`);
            return sirens;
          }
        }
      }

      console.log(`    Page ${page}/${totalPages} — ${sirens.size} SIREN`);
      page++;
      await sleep(SLEEP_MS);
    } catch (e) {
      console.error(`    ⚠️ Erreur:`, e.message);
      break;
    }
  } while (page <= totalPages);
  
  return sirens;
}

function exportCSV(sirens, filepath) {
  const rows = ['siren', ...Array.from(sirens)].join('\n');
  fs.writeFileSync(filepath, rows, 'utf8');
}

function exportJSON(sirens, filepath) {
  const data = {
    metadata: {
      date: new Date().toISOString(),
      departements: DEPARTEMENTS,
      codes_naf: NAF_CODES,
      total: sirens.size
    },
    sirens: Array.from(sirens)
  };
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

async function exportXLSX(sirens, filepath) {
  try {
    // Essai d'import xlsx si disponible
    const XLSX = require('xlsx');
    const data = Array.from(sirens).map(s => ({ siren: s }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SIREN');
    XLSX.writeFile(wb, filepath);
  } catch (e) {
    console.warn('⚠️ Module xlsx non installé. Export en CSV à la place.');
    exportCSV(sirens, filepath.replace('.xlsx', '.csv'));
  }
}

// ====== MAIN ======
(async () => {
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  console.log('🔎 Collecte des SIREN avec paramètres avancés');
  console.log(`📍 Départements : ${DEPARTEMENTS.join(', ')}`);
  console.log(`📋 Codes NAF : ${NAF_CODES.join(', ')}`);
  console.log(`💾 Format : ${OUTPUT_FORMAT}`);
  if (BATCH_SIZE > 0) console.log(`📦 Limite batch : ${BATCH_SIZE}`);
  console.log('');
  
  const allSirens = new Set();
  
  // Parcours de toutes les combinaisons département/NAF
  for (const dept of DEPARTEMENTS) {
    for (const naf of NAF_CODES) {
      const sirens = await fetchSirens(dept, naf);
      
      // Fusion des résultats
      for (const s of sirens) {
        allSirens.add(s);
        
        // Vérif limite globale
        if (BATCH_SIZE > 0 && allSirens.size >= BATCH_SIZE) {
          console.log(`\n⚠️ Limite batch globale atteinte (${BATCH_SIZE})`);
          break;
        }
      }
      
      if (BATCH_SIZE > 0 && allSirens.size >= BATCH_SIZE) break;
    }
    if (BATCH_SIZE > 0 && allSirens.size >= BATCH_SIZE) break;
  }
  
  // Export selon le format demandé
  const outputPath = path.join(OUTPUT_DIR, `${baseFilename}.${OUTPUT_FORMAT}`);
  
  console.log(`\n💾 Export de ${allSirens.size} SIREN...`);
  
  switch (OUTPUT_FORMAT) {
    case 'json':
      exportJSON(allSirens, outputPath);
      break;
    case 'xlsx':
      await exportXLSX(allSirens, outputPath);
      break;
    default:
      exportCSV(allSirens, outputPath);
  }
  
  console.log(`✅ Fichier créé : ${outputPath}`);
  console.log(`📊 Total : ${allSirens.size} SIREN uniques`);
})();