// npm i axios dotenv
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const TOKEN = process.env.PAPPERS_API_KEY;
if (!TOKEN) { console.error('❌ Manque PAPPERS_API_KEY dans .env'); process.exit(1); }

const IN = path.join('input', 'sirens.csv');
const OUT = path.join('output', 'idf_interim_all_dirigeants.csv');
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
  console.log(`🧾 ${sirens.length} SIREN IDF à enrichir`);

  const rows = [toCsvRow([
    'siren','denomination','code_naf','libelle_code_naf','entreprise_cessee',
    'dir_nom','dir_prenom','dir_qualite','dir_date_naissance','dir_nationalite','dir_ville_naissance'
  ])];

  let i=0;
  for (const siren of sirens) {
    i++; 
    if (i%50===0) console.log(`… ${i}/${sirens.length}`);

    try {
      const { data: ent } = await http.get('/entreprise', {
        params: { siren, integrer_diffusions_partielles: true }
      });

      const denom  = ent.denomination || ent.nom_entreprise || '';
      const naf    = ent.code_naf || '';
      const libNaf = ent.libelle_code_naf || '';
      const cessee = !!ent.entreprise_cessee;

      // Récupérer TOUS les dirigeants sans filtrage
      for (const r of (ent.representants || [])) {
        rows.push(toCsvRow([
          siren, 
          denom, 
          naf, 
          libNaf, 
          cessee?'oui':'non',
          r.nom||'', 
          r.prenom||'', 
          r.qualite||r.fonction||'',
          r.date_de_naissance || r.date_naissance || '',
          r.nationalite || '',
          r.ville_naissance || ''
        ]));
      }

      await sleep(120); // throttle léger
    } catch (e) {
      console.error(`⚠️ ${siren}:`, e?.response?.status, e?.response?.data || e.message);
    }
  }

  fs.writeFileSync(OUT, rows.join('\n'), 'utf8');
  console.log(`✅ Fichier final: ${OUT}`);
  console.log(`📊 Total: ${rows.length - 1} dirigeants trouvés`);
})();