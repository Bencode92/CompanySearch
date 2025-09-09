// npm i axios dotenv
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// --- Clé API Pappers ---
const TOKEN = process.env.PAPPERS_API_KEY;
if (!TOKEN) { console.error('❌ Manque PAPPERS_API_KEY dans .env'); process.exit(1); }

// --- CLI args ---
// --date=1962-12-31 (ou 31-12-1962 / 31/12/1962 / 1962)
// --in=output/sirens_interim_75_92.csv (par défaut)
// --out=output/dirigeants_avant_<date>.csv (optionnel)
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

if (!args.date) {
  console.error('❌ Paramètre requis: --date=YYYY-MM-DD (ou DD-MM-YYYY / DD/MM/YYYY / YYYY)');
  process.exit(1);
}

const IN  = args.in  ? path.resolve(args.in) : path.resolve('output/sirens_interim_75_92.csv');
const CUT = args.date.trim();
const OUT = args.out
  ? path.resolve(args.out)
  : path.resolve('output', `dirigeants_avant_${CUT.replace(/[^\d]/g,'')}.csv`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });

// --- Helpers ---
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function csvEscape(v){ if(v==null) return ''; const s=String(v); return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
function toCsvRow(a){ return a.map(csvEscape).join(';'); }

// parse "YYYY-MM-DD" / "DD-MM-YYYY" / "DD/MM/YYYY" / "MM/YYYY" / "YYYY" / ou juste une année trouvée
function parseFlexibleDate(str){
  if (!str) return null;
  const s = String(str).trim();

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);            // YYYY-MM-DD
  if (m) return { y:+m[1], m:+m[2], d:+m[3], full:true };

  m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);                // DD-MM-YYYY
  if (m) return { y:+m[3], m:+m[2], d:+m[1], full:true };

  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);              // DD/MM/YYYY
  if (m) return { y:+m[3], m:+m[2], d:+m[1], full:true };

  m = s.match(/^(\d{2})[\/-](\d{4})$/);                    // MM/YYYY
  if (m) return { y:+m[2], m:+m[1], d:1, full:false };

  m = s.match(/^(\d{4})$/);                                // YYYY
  if (m) return { y:+m[1], m:1, d:1, full:false };

  m = s.match(/\b(19\d{2}|20\d{2})\b/);                    // fallback: une année dedans
  if (m) return { y:+m[1], m:1, d:1, full:false };

  return null;
}
function cmpDates(a,b){
  const av = a.y*10000 + (a.m||1)*100 + (a.d||1);
  const bv = b.y*10000 + (b.m||1)*100 + (b.d||1);
  return av - bv;
}
function calcAgeAt(dob, at){ // dob et at = {y,m,d}
  const y = at.y - dob.y - ( (at.m<dob.m) || (at.m===dob.m && at.d<dob.d) ? 1 : 0 );
  return y;
}

const cutoff = parseFlexibleDate(CUT);
if (!cutoff) { console.error('❌ Date invalide pour --date'); process.exit(1); }

// --- HTTP client Pappers ---
const http = axios.create({
  baseURL: 'https://api.pappers.fr/v2',
  timeout: 25000,
  headers: { 'api-key': TOKEN }
});

// --- Lecture SIREN depuis CSV (délimiteur ; ou , ou tab) ---
function loadSirens(csvPath){
  const raw = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  // détecte le séparateur sur l'en-tête
  const sep = lines[0].includes(';') ? ';' : lines[0].includes(',') ? ',' : /\s+/.test(lines[0]) ? /\s+/ : ';';
  const idxSiren = lines[0].toLowerCase().split(sep)[0].includes('siren') ? 0 : 0; // assume 1ère col
  const out = [];

  for (let i=1;i<lines.length;i++){
    const cols = typeof sep === 'string' ? lines[i].split(sep) : lines[i].trim().split(sep);
    const s = (cols[idxSiren]||'').replace(/\D/g,'');
    if (/^\d{9}$/.test(s)) out.push(s);
  }
  return Array.from(new Set(out));
}

// --- Main ---
(async () => {
  const sirens = loadSirens(IN);
  console.log(`🧾 ${sirens.length} SIREN à enrichir (cutoff: ${CUT})`);

  const rows = [toCsvRow([
    'siren','denomination','code_naf','libelle_code_naf','ville_siege','entreprise_cessee',
    'dir_nom','dir_prenom','dir_qualite','dir_date_naissance','dir_age_estime_au_cutoff'
  ])];

  let i=0;
  for (const siren of sirens) {
    i++; if (i%50===0) console.log(`… ${i}/${sirens.length}`);

    try {
      const { data: ent } = await http.get('/entreprise', {
        params: { siren, integrer_diffusions_partielles: true }
      });

      const denom   = ent.denomination || ent.nom_entreprise || '';
      const naf     = ent.code_naf || '';
      const libNaf  = ent.libelle_code_naf || '';
      const ville   = ent?.siege?.ville || '';
      const cessee  = !!ent.entreprise_cessee;

      for (const r of (ent.representants || [])) {
        // garder personnes physiques (présence de date naissance ou prénom)
        const raw = r.date_de_naissance || r.date_naissance || r.informations_naissance || '';
        const dob = parseFlexibleDate(raw);

        if (dob && cmpDates(dob, cutoff) < 0) {
          // calcule un âge estimé à la date cutoff si possible
          let age = '';
          if (dob.y) {
            age = calcAgeAt(dob, cutoff);
            if (isNaN(age)) age = '';
          }
          rows.push(toCsvRow([
            siren, denom, naf, libNaf, ville, cessee?'oui':'non',
            r.nom||'', r.prenom||'', r.qualite||r.fonction||'',
            raw, age
          ]));
        }
      }

      await sleep(120); // throttle léger
    } catch (e) {
      console.error(`⚠️ ${siren}:`, e?.response?.status, e?.response?.data || e.message);
    }
  }

  fs.writeFileSync(OUT, rows.join('\n'), 'utf8');
  console.log(`✅ Fichier final: ${OUT}`);
})();