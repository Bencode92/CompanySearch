// npm i axios
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE = 'https://recherche-entreprises.api.gouv.fr';
const NAF = '78.20Z';          // intérim
const DEPARTEMENTS = ['75', '92'];  // Paris et Hauts-de-Seine
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

  console.log('📊 Estimation du volume pour Paris (75) et Hauts-de-Seine (92) - NAF 78.20Z...\n');
  
  let totalCount = 0;
  const deptCounts = {};
  
  for (const dept of DEPARTEMENTS) {
    let page = 1, totalPages = 1;
    
    const params = {
      activite_principale: NAF,
      departement: dept,
      etat_administratif: 'A',
      page,
      per_page: PER_PAGE
    };

    try {
      const { data } = await axios.get(`${BASE}/search`, { params, timeout: 20000 });
      const deptCount = data?.total_results || 0;
      deptCounts[dept] = deptCount;
      totalCount += deptCount;
      
      console.log(`📍 Département ${dept} : ${deptCount} entreprises`);
    } catch (e) {
      console.error(`⚠️ Erreur département ${dept}:`, e.message);
      deptCounts[dept] = 0;
    }
    
    await sleep(SLEEP_MS);
  }
  
  console.log(`\n🔢 Total : ${totalCount} entreprises d'intérim`);
  console.log('\n💰 Estimation des coûts Pappers :');
  console.log(`   - Enrichissement : ${totalCount} crédits (1 crédit/entreprise)`);
  console.log(`   - Durée estimée : ~${Math.round(totalCount * 0.12 / 60)} minutes\n`);
  
  if (args.full) {
    console.log('🔄 Récupération complète en cours...');
    const sirens = new Set();
    
    for (const dept of DEPARTEMENTS) {
      let page = 1, totalPages = 1;
      console.log(`\n📍 Récupération département ${dept}...`);
      
      do {
        const params = {
          activite_principale: NAF,
          departement: dept,
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
    }
    
    console.log(`\n✅ ${sirens.size} SIREN uniques récupérés`);
    
    if (args.save) {
      const OUT = path.join('input', 'sirens_75_92.csv');
      fs.mkdirSync('input', { recursive: true });
      const rows = ['siren', ...Array.from(sirens)].join('\n');
      fs.writeFileSync(OUT, rows, 'utf8');
      console.log(`💾 Sauvegardé dans ${OUT}`);
    }
  } else {
    console.log('💡 Utilisez --full pour récupérer tous les SIREN');
    console.log('💡 Utilisez --full --save pour sauvegarder dans input/sirens_75_92.csv');
  }
})();