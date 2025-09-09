// npm i axios dotenv
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const TOKEN = process.env.PAPPERS_API_KEY;
if (!TOKEN) { console.error('❌ Manque PAPPERS_API_KEY dans .env'); process.exit(1); }

const IN = path.join('input', 'sirens.csv');
const OUT = path.join('output', 'entreprises_interim_75_92.csv');
fs.mkdirSync('output', { recursive: true });

const http = axios.create({
  baseURL: 'https://api.pappers.fr/v2',
  timeout: 25000,
  headers: { 'api-key': TOKEN }
});

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function csvEscape(v){ if(v==null) return ''; const s=String(v); return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
function toCsvRow(a){ return a.map(csvEscape).join(';'); }

(async () => {
  // Lire la liste des SIREN
  const txt = fs.readFileSync(IN, 'utf8').trim().split(/\r?\n/);
  const header = txt.shift(); // "siren"
  const sirens = txt.map(s=>s.trim()).filter(s=>/^\d{9}$/.test(s));
  console.log(`🧾 ${sirens.length} entreprises (75/92) à enrichir`);

  const rows = [toCsvRow([
    'siren',
    'denomination',
    'sigle',
    'forme_juridique',
    'code_naf',
    'libelle_code_naf',
    'effectif',
    'tranche_effectif',
    'date_creation',
    'date_cessation',
    'entreprise_cessee',
    'categorie_entreprise',
    'adresse_siege',
    'code_postal_siege',
    'ville_siege',
    'departement_siege',
    'chiffre_affaires',
    'resultat',
    'nb_etablissements',
    'nb_etablissements_actifs',
    'convention_collective',
    'site_web',
    'telephone',
    'email'
  ])];

  let i=0;
  for (const siren of sirens) {
    i++; 
    if (i%20===0) console.log(`… ${i}/${sirens.length}`);

    try {
      const { data: ent } = await http.get('/entreprise', {
        params: { siren, integrer_diffusions_partielles: true }
      });

      // Extraire les infos de l'entreprise
      const siege = ent.siege || {};
      const finances = ent.finances || [];
      const dernierExercice = finances[0] || {};
      
      // Extraire convention collective
      const conventions = ent.conventions_collectives || [];
      const conventionPrincipale = conventions[0]?.nom || '';
      
      // Extraire site web et contact
      const publications = ent.publications_bodacc || [];
      const siteWeb = ent.site_web || '';
      const telephone = siege.telephone || '';
      const email = ent.email || '';

      rows.push(toCsvRow([
        siren,
        ent.denomination || ent.nom_entreprise || '',
        ent.sigle || '',
        ent.forme_juridique || '',
        ent.code_naf || '',
        ent.libelle_code_naf || '',
        ent.effectif || '',
        ent.tranche_effectif || '',
        ent.date_creation || ent.date_creation_entreprise || '',
        ent.date_cessation || '',
        ent.entreprise_cessee ? 'oui' : 'non',
        ent.categorie_entreprise || '',
        siege.adresse_ligne_1 || '',
        siege.code_postal || '',
        siege.ville || '',
        siege.departement || '',
        dernierExercice.chiffre_affaires || '',
        dernierExercice.resultat || '',
        ent.nombre_etablissements || '',
        ent.nombre_etablissements_ouverts || '',
        conventionPrincipale,
        siteWeb,
        telephone,
        email
      ]));

      await sleep(120); // throttle léger
    } catch (e) {
      console.error(`⚠️ ${siren}:`, e?.response?.status, e?.response?.data || e.message);
    }
  }

  fs.writeFileSync(OUT, rows.join('\n'), 'utf8');
  console.log(`✅ Fichier final: ${OUT}`);
  console.log(`📊 Total: ${rows.length - 1} entreprises enrichies`);
})();