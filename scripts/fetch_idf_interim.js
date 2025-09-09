// npm i axios
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OUT = path.join('input', 'sirens.csv');
fs.mkdirSync('input', { recursive: true });

const BASE = 'https://recherche-entreprises.api.gouv.fr';
const NAF = '78.20Z';          // intérim
const DEPARTEMENTS = ['75', '92'];  // Paris et Hauts-de-Seine uniquement
const PER_PAGE = 25;           // limite doc : 25
const SLEEP_MS = 200;          // 7 req/s max -> on reste soft

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const sirens = new Set();
  
  console.log('🔎 Collecte des SIREN (NAF 78.20Z, départements 75 et 92, actives)…');
  
  // Parcourir chaque département
  for (const dept of DEPARTEMENTS) {
    let page = 1, totalPages = 1;
    console.log(`\n📍 Département ${dept}...`);
    
    do {
      const params = {
        activite_principale: NAF,    // filtre NAF entreprise
        departement: dept,           // filtre sur le département
        etat_administratif: 'A',     // entreprises actives
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
          if (siren && /^\d{9}$/.test(String(siren))) sirens.add(String(siren));
        }

        console.log(`  Dept ${dept} - page ${page}/${totalPages} — cumul ${sirens.size} SIREN`);
        page++;
        await sleep(SLEEP_MS);
      } catch (e) {
        console.error(`  ⚠️ Erreur dept ${dept} page ${page}:`, e.message);
        break;
      }
    } while (page <= totalPages);
  }

  const rows = ['siren', ...Array.from(sirens)].join('\n');
  fs.writeFileSync(OUT, rows, 'utf8');
  console.log(`\n✅ Écrit ${sirens.size} SIREN dans ${OUT} (départements 75 et 92)`);
})();