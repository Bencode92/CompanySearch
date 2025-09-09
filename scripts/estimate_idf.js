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
  console.log('📊 Estimation du volume pour Paris (75) et Hauts-de-Seine (92) - NAF 78.20Z...\n');
  
  let totalCount = 0;
  const deptCounts = {};
  
  for (const dept of DEPARTEMENTS) {
    let page = 1;
    
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
  console.log('\n💡 Pour récupérer la liste des SIREN, utilisez : npm run fetch');
})();