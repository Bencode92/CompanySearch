// npm i axios dotenv
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const TOKEN = process.env.PAPPERS_API_KEY;
if (!TOKEN) { console.error('❌ Manque PAPPERS_API_KEY dans .env'); process.exit(1); }

const IN_DEFAULT  = path.join('input', 'sirens.csv');

// --- CLI args ---
// --date=1962-12-31 (ou 31-12-1962) obligatoire
// --in=...  (optionnel)  --out=... (optionnel)
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

if (!args.date) {
  console.error('❌ Paramètre requis: --date=YYYY-MM-DD ou DD-MM-YYYY (ex: --date=1962-12-31)');
  process.exit(1);
}

const IN  = args.in  ? path.resolve(args.in) : IN_DEFAULT;
const OUT = args.out
  ? path.resolve(args.out)
  : path.join('output', `dirigeants_avant_${args.date.replace(/[^\d]/g,'')}.csv`);

fs.mkdirSync('output', { recursive: true });

// --- helpers ---
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function csvEscape(v){ if(v==null) return ''; const s=String(v); return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
function toCsvRow(a){ return a.map(csvEscape).join(';'); }

// parse "YYYY-MM-DD" ou "DD-MM-YYYY" ou "YYYY" ou "MM/YYYY"
function parseFlexibleDate(str){
  if (!str) return null;
  const s = String(str).trim();

  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { y:+m[1], m:+m[2], d:+m[3], full:true };

  // DD-MM-YYYY
  m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return { y:+m[3], m:+m[2], d:+m[1], full:true };

  // DD/MM/YYYY
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return { y:+m[3], m:+m[2], d:+m[1], full:true };

  // MM/YYYY
  m = s.match(/^(\d{2})[\/-](\d{4})$/);
  if (m) return { y:+m[2], m:+m[1], d:1, full:false };

  // YYYY
  m = s.match(/^(\d{4})$/);
  if (m) return { y:+m[1], m:1, d:1, full:false };

  // tente d'extraire une année au moins
  m = s.match(/\b(19\d{2}|20\d{2})\b/);
  if (m) return { y:+m[1], m:1, d:1, full:false };

  return null;
}

function cmpDates(a,b){
  // compare {y,m,d}; suppose m/d par défaut à 1 si manquants
  const av = a.y*10000 + (a.m||1)*100 + (a.d||1);
  const bv = b.y*10000 + (b.m||1)*100 + (b.d||1);
  return av - bv;
}

const cutoff = parseFlexibleDate(args.date);
if (!cutoff) { console.error('❌ Date invalide pour --date'); process.exit(1); }

const http = axios.create({
  baseURL: 'https://api.pappers.fr/v2',
  timeout: 25000,
  headers: { 'api-key': TOKEN }
});

(async () => {
  const txt = fs.readFileSync(IN, 'utf8').trim().split(/\r?\n/);
  const header = txt.shift(); // "siren"
  const sirens = txt.map(s=>s.trim()).filter(s=>/^\d{9}$/.test(s));
  console.log(`🧾 ${sirens.length} SIREN à traiter (cutoff: ${args.date})`);

  const rows = [toCsvRow([
    'siren','denomination','code_naf','libelle_code_naf','entreprise_cessee',
    'dir_nom','dir_prenom','dir_qualite','dir_date_naissance','comparaison'
  ])];

  let i=0;
  for (const siren of sirens) {
    i++; if (i%50===0) console.log(`… ${i}/${sirens.length}`);

    try {
      const { data: ent } = await http.get('/entreprise', {
        params: { siren, integrer_diffusions_partielles: true }
      });

      const denom  = ent.denomination || ent.nom_entreprise || '';
      const naf    = ent.code_naf || '';
      const libNaf = ent.libelle_code_naf || '';
      const cessee = !!ent.entreprise_cessee;

      for (const r of (ent.representants || [])) {
        const raw = r.date_de_naissance || r.date_naissance || r.informations_naissance || r.age || '';
        const pd  = parseFlexibleDate(raw);

        // stratégie:
        // - si on a une date partielle (juste année ou année+mois), on compare à l'année/mois du cutoff.
        // - on retient si pd existe ET pd < cutoff.
        if (pd && cmpDates(pd, cutoff) < 0) {
          rows.push(toCsvRow([
            siren, denom, naf, libNaf, cessee?'oui':'non',
            r.nom||'', r.prenom||'', r.qualite||r.fonction||'',
            raw, pd.full ? 'avant (date complète)' : 'avant (année/mois estimé)'
          ]));
        }
      }

      await sleep(120); // throttle léger
    } catch (e) {
      console.error(`⚠️ ${siren}:`, e?.response?.status, e?.response?.data || e.message);
    }
  }

  fs.mkdirSync('output', { recursive: true });
  fs.writeFileSync(OUT, rows.join('\n'), 'utf8');
  console.log(`✅ Fichier final: ${OUT}`);
})();