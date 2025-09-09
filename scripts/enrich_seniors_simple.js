// Script simple d'enrichissement Pappers - Dirigeants seniors uniquement (nés avant 1962)
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// ====== CONFIGURATION ======
const TOKEN = process.env.PAPPERS_API_KEY;
if (!TOKEN) {
  console.error('❌ ERREUR : Clé API Pappers manquante !');
  console.error('👉 Ajouter PAPPERS_API_KEY dans .env ou dans les secrets GitHub');
  process.exit(1);
}

// Fichier d'entrée et de sortie
const INPUT_FILE = 'output/sirens_interim_75_92.csv';
const OUTPUT_FILE = 'output/dirigeants_seniors_enrichis.csv';

// Date cutoff : 1962 (garder uniquement ceux nés AVANT 1962)
const CUTOFF_YEAR = 1962;

// ====== API PAPPERS ======
const http = axios.create({
  baseURL: 'https://api.pappers.fr/v2',
  timeout: 25000,
  headers: { 'api-key': TOKEN }
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

// Charger les SIREN depuis le CSV
function loadSirens(filepath) {
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Fichier introuvable : ${filepath}`);
    console.error('👉 Lancez d\'abord : npm run fetch');
    process.exit(1);
  }
  
  const content = fs.readFileSync(filepath, 'utf8').trim();
  const lines = content.split(/\r?\n/);
  
  // Ignorer l'en-tête et récupérer les SIREN
  const sirens = [];
  for (let i = 1; i < lines.length; i++) {
    const siren = lines[i].trim().replace(/\D/g, '');
    if (/^\d{9}$/.test(siren)) {
      sirens.push(siren);
    }
  }
  
  return [...new Set(sirens)]; // Supprimer les doublons
}

// Parser une date flexible
function parseYear(dateStr) {
  if (!dateStr) return null;
  
  // Essayer différents formats
  const patterns = [
    /(\d{4})-\d{2}-\d{2}/,  // YYYY-MM-DD
    /\d{2}[-\/]\d{2}[-\/](\d{4})/,  // DD/MM/YYYY ou DD-MM-YYYY
    /\b(19\d{2}|20\d{2})\b/  // Année seule
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      const year = parseInt(match[1] || match[0]);
      if (year >= 1900 && year <= 2010) return year;
    }
  }
  
  return null;
}

// Calculer l'âge actuel
function calculateAge(birthYear) {
  const currentYear = new Date().getFullYear();
  return currentYear - birthYear;
}

// Formater un montant en euros
function formatMontant(value) {
  if (!value || value === 0) return '';
  return Math.round(value).toLocaleString('fr-FR');
}

// ====== MAIN ======
(async () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   💼 ENRICHISSEMENT PAPPERS - DIRIGEANTS SENIORS');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // Charger les SIREN
  const sirens = loadSirens(INPUT_FILE);
  console.log(`📂 Fichier source : ${INPUT_FILE}`);
  console.log(`📊 ${sirens.length} SIREN à traiter`);
  console.log(`🎯 Filtre : Dirigeants nés avant ${CUTOFF_YEAR} uniquement`);
  console.log('');
  
  // Préparer le fichier de sortie
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  const ws = fs.createWriteStream(OUTPUT_FILE, { encoding: 'utf8' });
  
  // En-tête du CSV
  ws.write(toCsvRow([
    'Société',
    'SIREN',
    'Chiffre d\'affaires',
    'Résultat',
    'Nom dirigeant',
    'Prénom dirigeant',
    'Fonction',
    'Année naissance',
    'Âge actuel',
    'Ville siège',
    'Code NAF',
    'Effectif'
  ]));
  
  let processed = 0;
  let found = 0;
  
  console.log('⏳ Traitement en cours...');
  console.log('');
  
  // Traiter chaque SIREN
  for (const siren of sirens) {
    processed++;
    
    // Affichage progression
    if (processed % 10 === 0) {
      const pct = Math.round(processed * 100 / sirens.length);
      console.log(`   → ${processed}/${sirens.length} (${pct}%) - ${found} dirigeants seniors trouvés`);
    }
    
    try {
      // Appel API Pappers
      const { data: entreprise } = await http.get('/entreprise', {
        params: { 
          siren,
          integrer_dirigeants: true,
          integrer_finances: true
        }
      });
      
      // Récupérer les infos de l'entreprise
      const societe = entreprise.denomination || entreprise.nom_entreprise || '';
      const ca = entreprise.chiffre_affaires || entreprise.finances?.[0]?.chiffre_affaires || 0;
      const resultat = entreprise.resultat || entreprise.finances?.[0]?.resultat || 0;
      const ville = entreprise.siege?.ville || '';
      const codeNaf = entreprise.code_naf || '';
      const effectif = entreprise.effectif || entreprise.tranche_effectif || '';
      
      // Parcourir les dirigeants
      const dirigeants = entreprise.representants || [];
      
      for (const dirigeant of dirigeants) {
        // Ignorer les personnes morales
        if (dirigeant.siren || dirigeant.denomination) continue;
        
        // Parser la date de naissance
        const dateNaissance = dirigeant.date_de_naissance || 
                              dirigeant.date_naissance || 
                              dirigeant.informations_naissance || '';
        
        const anneeNaissance = parseYear(dateNaissance);
        
        // Filtrer : garder uniquement ceux nés AVANT 1962
        if (anneeNaissance && anneeNaissance < CUTOFF_YEAR) {
          const age = calculateAge(anneeNaissance);
          
          // Écrire la ligne dans le CSV
          ws.write(toCsvRow([
            societe,
            siren,
            formatMontant(ca),
            formatMontant(resultat),
            dirigeant.nom || '',
            dirigeant.prenom || '',
            dirigeant.qualite || dirigeant.fonction || '',
            anneeNaissance,
            age,
            ville,
            codeNaf,
            effectif
          ]));
          
          found++;
        }
      }
      
      // Pause pour respecter les limites API
      await sleep(120);
      
    } catch (error) {
      // En cas d'erreur, continuer avec le suivant
      if (error.response?.status === 404) {
        // Entreprise non trouvée, c'est normal
      } else if (error.response?.status === 429) {
        // Rate limit atteint, attendre plus longtemps
        console.log('   ⚠️ Limite API atteinte, pause de 5 secondes...');
        await sleep(5000);
      } else {
        console.error(`   ⚠️ Erreur SIREN ${siren}: ${error.message}`);
      }
      
      await sleep(300);
    }
  }
  
  // Fermer le fichier
  ws.end();
  
  // Attendre que le fichier soit écrit
  await new Promise(resolve => ws.on('finish', resolve));
  
  // Résumé final
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   ✅ ENRICHISSEMENT TERMINÉ');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`📊 Résultats :`);
  console.log(`   • ${processed} entreprises traitées`);
  console.log(`   • ${found} dirigeants seniors trouvés (nés avant ${CUTOFF_YEAR})`);
  console.log('');
  console.log(`📄 Fichier de sortie : ${OUTPUT_FILE}`);
  console.log('');
  
  // Statistiques si des résultats trouvés
  if (found > 0) {
    console.log('💡 Prochaines étapes :');
    console.log('   1. Ouvrir le fichier CSV dans Excel');
    console.log('   2. Trier par chiffre d\'affaires ou résultat');
    console.log('   3. Identifier les meilleures opportunités');
    console.log('');
  } else {
    console.log('⚠️ Aucun dirigeant senior trouvé.');
    console.log('   Vérifiez que les entreprises ont des dirigeants personnes physiques.');
  }
})();