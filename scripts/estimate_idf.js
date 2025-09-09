// npm i axios
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE = 'https://recherche-entreprises.api.gouv.fr';
const NAF = '78.20Z';          // intérim
const REGION = '11';           // Île-de-France
const PER_PAGE = 25;
const SLEEP_MS = 200;

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
      const m = a.match(/^--([^=]+)=(.*)$/);
      return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
    })
  );

  console.log('📊 Estimation du volume pour IDF NAF 78.20Z...\n');
  
  let totalCount = 0;
  let page = 1, totalPages = 1;
  
  do {
    const params = {
      activite_principale: NAF,
      region: REGION,
      etat_administratif: 'A',
      page,
      per_page: PER_PAGE
    };

    const { data } = await axios.get(`${BASE}/search`, { params, timeout: 20000 });
    const results = data?.results || [];
    totalPages = data?.total_pages || page;
    totalCount = data?.total_results || totalCount + results.length;
    
    if (page === 1) {
      console.log(`📍 Région : Île-de-France (11)`);
      console.log(`🏢 Code NAF : ${NAF} (Intérim)`);
      console.log(`📄 Total pages : ${totalPages}`);
      console.log(`🔢 Total entreprises : ${totalCount}\n`);
      break; // On s'arrête après la première page pour l'estimation
    }
    
    page++;
    await sleep(SLEEP_MS);
  } while (page <= totalPages);

  console.log('💰 Estimation des coûts Pappers :');
  console.log(`   - Enrichissement : ${totalCount} crédits (1 crédit/entreprise)`);
  console.log(`   - Durée estimée : ~${Math.round(totalCount * 0.12 / 60)} minutes\n`);
  
  if (args.full) {
    console.log('🔄 Récupération complète en cours...');
    const sirens = new Set();
    page = 1;
    
    do {
      const params = {
        activite_principale: NAF,
        region: REGION,
        etat_administratif: 'A',
        page,
        per_page: PER_PAGE
      };

      const { data } = await axios.get(`${BASE}/search`, { params, timeout: 20000 });
      const results = data?.results || [];
      totalPages = data?.total_pages || page;

      for (const it of results) {
        const siren = it?.siren || it?.siren_formate?.replace(/\D/g,'') || it?.unite_legale?.siren;
        if (siren && /^\d{9}$/.test(String(siren))) sirens.add(String(siren));
      }

      if (page % 10 === 0) console.log(`   Page ${page}/${totalPages}...`);
      page++;
      await sleep(SLEEP_MS);
    } while (page <= totalPages);
    
    console.log(`\n✅ ${sirens.size} SIREN uniques récupérés`);
    
    if (args.save) {
      const OUT = path.join('input', 'sirens_idf.csv');
      fs.mkdirSync('input', { recursive: true });
      const rows = ['siren', ...Array.from(sirens)].join('\n');
      fs.writeFileSync(OUT, rows, 'utf8');
      console.log(`💾 Sauvegardé dans ${OUT}`);
    }
  } else {
    console.log('💡 Utilisez --full pour récupérer tous les SIREN');
    console.log('💡 Utilisez --full --save pour sauvegarder dans input/sirens_idf.csv');
  }
})();