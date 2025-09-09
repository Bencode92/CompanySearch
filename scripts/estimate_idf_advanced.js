// Script d'estimation du volume de données - Version avancée
const axios = require('axios');

const BASE = 'https://recherche-entreprises.api.gouv.fr';
const IDF_DEPARTEMENTS = ['75', '77', '78', '91', '92', '93', '94', '95'];

// Parsing des arguments CLI
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

const DEPARTEMENTS = args.deps ? args.deps.split(',') : IDF_DEPARTEMENTS;
const NAF_CODES = args.naf ? args.naf.split(',') : ['78.20Z'];

async function estimateVolume(dept, naf) {
  try {
    const params = {
      activite_principale: naf,
      departement: dept,
      etat_administratif: 'A',
      page: 1,
      per_page: 1
    };
    
    const { data } = await axios.get(`${BASE}/search`, { params, timeout: 10000 });
    return data?.total_results || 0;
  } catch (e) {
    console.error(`  ⚠️ Erreur dept ${dept} NAF ${naf}:`, e.message);
    return 0;
  }
}

(async () => {
  console.log('📊 ESTIMATION DU VOLUME DE DONNÉES');
  console.log('═══════════════════════════════════');
  console.log(`📍 Départements : ${DEPARTEMENTS.join(', ')}`);
  console.log(`📋 Codes NAF : ${NAF_CODES.join(', ')}`);
  console.log('');
  
  let grandTotal = 0;
  const details = [];
  
  // Collecte des estimations
  for (const dept of DEPARTEMENTS) {
    let deptTotal = 0;
    console.log(`\n🏢 Département ${dept} :`);
    
    for (const naf of NAF_CODES) {
      const count = await estimateVolume(dept, naf);
      deptTotal += count;
      grandTotal += count;
      
      if (count > 0) {
        console.log(`  • NAF ${naf} : ${count.toLocaleString('fr-FR')} entreprises`);
        details.push({ dept, naf, count });
      }
    }
    
    if (deptTotal > 0) {
      console.log(`  ➜ Sous-total : ${deptTotal.toLocaleString('fr-FR')} entreprises`);
    }
  }
  
  // Résumé
  console.log('\n═══════════════════════════════════');
  console.log('📈 RÉSUMÉ');
  console.log('═══════════════════════════════════');
  
  // Top 5 des combinaisons
  const top5 = details
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  if (top5.length > 0) {
    console.log('\n🏆 Top 5 des volumes :');
    top5.forEach((item, i) => {
      console.log(`  ${i + 1}. Dept ${item.dept} - NAF ${item.naf} : ${item.count.toLocaleString('fr-FR')}`);
    });
  }
  
  // Statistiques par NAF
  console.log('\n📊 Par code NAF :');
  for (const naf of NAF_CODES) {
    const nafTotal = details
      .filter(d => d.naf === naf)
      .reduce((sum, d) => sum + d.count, 0);
    
    if (nafTotal > 0) {
      console.log(`  • ${naf} : ${nafTotal.toLocaleString('fr-FR')} entreprises`);
    }
  }
  
  // Total et estimations
  console.log('\n═══════════════════════════════════');
  console.log(`✅ TOTAL ESTIMÉ : ${grandTotal.toLocaleString('fr-FR')} entreprises`);
  console.log('═══════════════════════════════════');
  
  // Estimations de temps et coûts
  const fetchTime = Math.ceil((grandTotal / 25) * 0.2 / 60); // 25 par page, 200ms par requête
  const enrichTime = Math.ceil((grandTotal * 0.12) / 60); // 120ms par entreprise
  const pappersCost = grandTotal * 0.02; // ~0.02€ par entreprise en moyenne
  
  console.log('\n⏱️  Estimations :');
  console.log(`  • Collecte SIREN : ~${fetchTime} minutes`);
  console.log(`  • Enrichissement Pappers : ~${enrichTime} minutes`);
  console.log(`  • Coût Pappers estimé : ~${pappersCost.toFixed(2)} €`);
  
  // Recommandations
  if (grandTotal > 10000) {
    console.log('\n⚠️  Volume important détecté !');
    console.log('  Recommandations :');
    console.log('  • Utilisez --batch pour limiter les résultats');
    console.log('  • Traitez par département pour éviter les timeouts');
    console.log('  • Activez le mode concurrent pour l\'enrichissement');
  }
  
  // Exemples de commandes
  console.log('\n💡 Commandes suggérées :');
  
  if (DEPARTEMENTS.length === 1 && NAF_CODES.length === 1) {
    console.log(`  node scripts/fetch_idf_advanced.js --deps=${DEPARTEMENTS[0]} --naf=${NAF_CODES[0]}`);
  } else {
    console.log(`  node scripts/fetch_idf_advanced.js --deps=${DEPARTEMENTS.join(',')} --naf=${NAF_CODES.join(',')}`);
  }
  
  if (grandTotal > 1000) {
    console.log(`  # Ou avec limite :`);
    console.log(`  node scripts/fetch_idf_advanced.js --deps=${DEPARTEMENTS.join(',')} --naf=${NAF_CODES.join(',')} --batch=1000`);
  }
})();