// Script ULTRA-ÉCONOME - 0,1 crédit par dirigeant trouvé seulement !
// Utilise /recherche-dirigeants (Pappers) + API gratuite (nom société)
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// ====== PARSING CLI ======
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

const INPUT = args.in || 'output/sirens_interim_75_92.csv';
const OUTPUT = args.out || 'output/dirigeants_seniors_enrichis.csv';
const CUTOFF_YEAR = Number(args['cutoff-year'] || 1962);

// ====== CONFIGURATION API ======
const PAPPERS_API_KEY = process.env.PAPPERS_API_KEY;
if (!PAPPERS_API_KEY) {
  console.error('❌ ERREUR : Clé API Pappers manquante !');
  console.error('👉 Ajouter PAPPERS_API_KEY dans .env ou dans les secrets GitHub');
  process.exit(1);
}

// Client Pappers (payant - 0,1 crédit/dirigeant)
const pappers = axios.create({
  baseURL: 'https://api.pappers.fr/v2',
  timeout: 25000,
  headers: { 'api-key': PAPPERS_API_KEY }
});

// Client API gouvernementale (GRATUIT)
const gov = axios.create({
  baseURL: 'https://recherche-entreprises.api.gouv.fr',
  timeout: 20000
});

// ====== HELPERS ======
function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)); 
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsvRow(arr) { 
  return arr.map(csvEscape).join(';') + '\n'; 
}

// Parser l'année de naissance depuis différents formats
function parseBirthYear(dateStr) {
  if (!dateStr) return null;
  
  // Cherche une année plausible (1900-2010)
  const match = String(dateStr).match(/\b(19\d{2}|20(?:0\d|1[0-9]))\b/);
  const year = match ? Number(match[1]) : null;
  
  return (year && year >= 1900 && year <= new Date().getFullYear()) ? year : null;
}

// Calculer l'âge actuel
function calcAgeFromYear(year) {
  if (!year) return '';
  return new Date().getFullYear() - year;
}

// Charger les SIREN depuis le CSV
function loadSirens(filepath) {
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Fichier introuvable : ${filepath}`);
    console.error('👉 Lancez d\'abord : npm run fetch');
    process.exit(1);
  }
  
  const content = fs.readFileSync(filepath, 'utf8').trim().split(/\r?\n/);
  const sirens = [];
  
  // Ignorer l'en-tête, prendre la première colonne
  for (let i = 1; i < content.length; i++) {
    const siren = content[i].split(/[;,\t]/)[0].replace(/\D/g, '');
    if (/^\d{9}$/.test(siren)) {
      sirens.push(siren);
    }
  }
  
  return Array.from(new Set(sirens));
}

// Récupérer les infos de base GRATUITEMENT via l'API gouvernementale
async function getCompanyInfoFree(siren) {
  try {
    const { data } = await gov.get('/search', { 
      params: { 
        q: siren, 
        page: 1, 
        per_page: 1 
      } 
    });
    
    const result = data?.results?.[0] || data?.resultats?.[0];
    if (!result) return { nom: '', siret: '', ville: '' };
    
    // Extraire le nom de l'entreprise (plusieurs champs possibles)
    const nom = result.nom_entreprise || 
                result.nom_complet || 
                result.denomination || 
                result.unite_legale?.denomination || 
                '';
    
    // Extraire le SIRET du siège
    const siret = result.siret || 
                  result.siret_formate?.replace(/\D/g, '') ||
                  result.siege?.siret || 
                  result.etablissement?.siret || 
                  '';
    
    // Extraire la ville
    const ville = result.siege?.ville || 
                  result.ville || 
                  result.etablissement?.ville || 
                  '';
    
    return { nom, siret, ville };
  } catch (error) {
    console.error(`⚠️ Erreur API gov pour ${siren}: ${error.message}`);
    return { nom: '', siret: '', ville: '' };
  }
}

// Récupérer les dirigeants seniors via Pappers (0,1 crédit/résultat)
async function* getSeniorDirectors(siren, cutoffYear) {
  // Format de date pour l'API : "31-12-YYYY"
  const maxDate = `31-12-${cutoffYear - 1}`;
  
  const params = {
    siren: siren,
    type_dirigeant: 'physique',
    date_de_naissance_dirigeant_max: maxDate,
    precision: 'standard',
    par_page: 50,
    page: 1
  };
  
  while (true) {
    try {
      const { data } = await pappers.get('/recherche-dirigeants', { params });
      const dirigeants = data?.resultats || [];
      
      // Yield chaque dirigeant trouvé
      for (const dirigeant of dirigeants) {
        yield dirigeant;
      }
      
      // Pagination si nécessaire
      const currentPage = data?.page || params.page;
      const totalResults = data?.total || dirigeants.length;
      const totalPages = Math.ceil(totalResults / params.par_page);
      
      if (currentPage >= totalPages || dirigeants.length === 0) {
        break;
      }
      
      params.page++;
      await sleep(150); // Petite pause entre les pages
    } catch (error) {
      if (error?.response?.status === 429) {
        console.log('⏳ Rate limit atteint, pause de 5 secondes...');
        await sleep(5000);
      } else {
        throw error;
      }
    }
  }
}

// ====== MAIN ======
(async () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   💰 ENRICHISSEMENT ÉCONOMIQUE - DIRIGEANTS SENIORS');
  console.log('   📊 0,1 crédit par dirigeant trouvé (au lieu de 1-2/entreprise)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📂 Fichier source : ${INPUT}`);
  console.log(`🎯 Filtre : Dirigeants nés AVANT ${CUTOFF_YEAR}`);
  console.log(`💾 Fichier sortie : ${OUTPUT}`);
  console.log('');
  
  // Charger les SIREN
  const sirens = loadSirens(INPUT);
  console.log(`📦 ${sirens.length} SIREN à traiter`);
  console.log('');
  
  // Préparer le fichier de sortie
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const ws = fs.createWriteStream(OUTPUT, { encoding: 'utf8' });
  
  // En-tête du CSV
  ws.write(toCsvRow([
    'Société',
    'SIREN',
    'SIRET_siège',
    'Nom',
    'Prénom',
    'Fonction',
    'Date_naissance',
    'Année',
    'Âge',
    'Ville_siège'
  ]));
  
  let processed = 0;
  let found = 0;
  let credits = 0;
  const startTime = Date.now();
  
  // Set pour éviter les doublons (même dirigeant sur plusieurs mandats)
  const seen = new Set();
  
  console.log('⏳ Traitement en cours...');
  console.log('');
  
  for (const siren of sirens) {
    processed++;
    
    // Affichage progression
    if (processed % 25 === 0) {
      const pct = Math.round(processed * 100 / sirens.length);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`   → ${processed}/${sirens.length} (${pct}%) - ${found} dirigeants - ${credits} crédits - ${elapsed}s`);
    }
    
    // 1. Récupérer les infos de base GRATUITEMENT
    const companyInfo = await getCompanyInfoFree(siren);
    await sleep(150); // Respecter le rate limit API gov
    
    try {
      // 2. Récupérer les dirigeants seniors (PAYANT: 0,1 crédit/résultat)
      for await (const dirigeant of getSeniorDirectors(siren, CUTOFF_YEAR)) {
        // Extraire les champs (plusieurs formats possibles selon Pappers)
        const nom = dirigeant.nom || dirigeant.nom_dirigeant || '';
        const prenom = dirigeant.prenom || dirigeant.prenom_dirigeant || '';
        const fonction = dirigeant.qualite || dirigeant.fonction || '';
        const dateNaissance = dirigeant.date_de_naissance || 
                            dirigeant.date_naissance || 
                            dirigeant.informations_naissance || '';
        
        // Parser l'année
        const annee = parseBirthYear(dateNaissance);
        
        // Double vérification du filtre (normalement déjà fait par l'API)
        if (!annee || annee >= CUTOFF_YEAR) continue;
        
        // Clé unique pour éviter les doublons
        const key = `${siren}|${nom}|${prenom}|${annee}`;
        if (seen.has(key)) continue;
        seen.add(key);
        
        // Écrire la ligne
        ws.write(toCsvRow([
          companyInfo.nom,
          siren,
          companyInfo.siret,
          nom,
          prenom,
          fonction,
          dateNaissance,
          annee,
          calcAgeFromYear(annee),
          companyInfo.ville
        ]));
        
        found++;
        credits += 0.1; // Chaque dirigeant retourné = 0,1 crédit
      }
      
      await sleep(120); // Pause entre chaque entreprise
      
    } catch (error) {
      if (error?.response?.status === 404) {
        // Pas de dirigeants trouvés, c'est normal
      } else if (error?.response?.status === 429) {
        console.log('   ⚠️ Rate limit Pappers, pause de 5 secondes...');
        await sleep(5000);
      } else {
        console.error(`   ⚠️ Erreur SIREN ${siren}: ${error.message}`);
      }
    }
  }
  
  // Fermer le fichier
  ws.end();
  await new Promise(resolve => ws.on('finish', resolve));
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  // Résumé final
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   ✅ ENRICHISSEMENT TERMINÉ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📊 Résultats :`);
  console.log(`   • Entreprises traitées : ${processed}`);
  console.log(`   • Dirigeants seniors trouvés : ${found}`);
  console.log(`   • Crédits Pappers consommés : ${credits.toFixed(1)}`);
  console.log(`   • Temps total : ${duration} secondes`);
  console.log(`   • Coût estimé : ~${(credits * 0.02).toFixed(2)}€ (à 0,02€/crédit)`);
  console.log('');
  console.log(`📄 Fichier de sortie : ${OUTPUT}`);
  console.log('');
  
  if (found > 0) {
    console.log('💡 Prochaines étapes :');
    console.log('   1. Ouvrir le fichier CSV dans Excel');
    console.log('   2. Trier par âge pour identifier les plus seniors');
    console.log('   3. Enrichir avec CA/résultat si nécessaire (autre script)');
    console.log('');
    console.log('💰 Économies réalisées :');
    const economie = processed - credits;
    console.log(`   • ${economie.toFixed(0)} crédits économisés vs approche classique`);
    console.log(`   • ~${(economie * 0.02).toFixed(2)}€ économisés`);
  } else {
    console.log('⚠️ Aucun dirigeant senior trouvé.');
    console.log('   Vérifiez que les entreprises ont des dirigeants personnes physiques.');
  }
})();