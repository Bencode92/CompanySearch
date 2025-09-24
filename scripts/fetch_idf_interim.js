// npm i axios
// scripts/fetch-hcr-precise.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OUT = path.join('input', 'sirens.csv');
fs.mkdirSync('input', { recursive: true });

const PAPPERS_KEY = process.env.PAPPERS_API_KEY; // <-- secrets
if (!PAPPERS_KEY) { console.error('❌ PAPPERS_API_KEY manquant'); process.exit(1); }

const PAPPERS = axios.create({
  baseURL: 'https://api.pappers.fr/v2',
  timeout: 25000,
  headers: { 'api-key': PAPPERS_KEY }
});

// --- Paramètres ---
const DEPTS = '75,92';
const NAF = '78.20Z'; // agences d'intérim
const PAR_CURSEUR = 500; // jusqu'à 1000
const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));

// Mots-clés HCR (recherche + validation)
const KW = [
  'hôtellerie','hotellerie','hôtel','hotel',
  'restauration','restaurant','traiteur',
  'housekeeping','room service',
  'réception','reception','conciergerie',
  'banquet','événementiel','evenementiel',
  'bar','barman','barmaid','serveur','serveuse',
  'cuisine','commis','chef de partie',
  'femme de chambre','valet de chambre','gouvernante',
  'hospitality','CHR','HCR'
];

// Anti-bruit (exclusions explicites)
const KW_EXCLUDE = [
  'btp','bâtiment','batiment','industrie','logistique','transport',
  'sécurité','securite','nettoyage industriel','santé','medical'
];

// Normalisation simple
const norm = s => (s||'').toLowerCase()
  .normalize('NFD').replace(/\p{Diacritic}/gu,'')
  .replace(/\s+/g,' ').trim();

function hasAny(text, list){ 
  const t = norm(text);
  return list.some(k => t.includes(norm(k)));
}
function hasNone(text, list){
  const t = norm(text);
  return !list.some(k => t.includes(norm(k)));
}

// --- Recherche Pappers avec curseur ---
async function searchOnce(params){
  const out = new Set();
  let curseur = '*';
  do{
    const { data } = await PAPPERS.get('/recherche', {
      params: { ...params, curseur, par_curseur: PAR_CURSEUR, bases: 'entreprises' }
    });
    const arr = data?.resultats || [];
    for (const it of arr){
      const siren = it?.siren || it?.siren_formate?.replace(/\D/g,'');
      if (siren && /^\d{9}$/.test(siren)) out.add(siren);
    }
    curseur = data?.curseurSuivant || null;
    await SLEEP(150);
  } while (curseur);
  return out;
}

async function getEntreprise(siren){
  const params = {
    siren,
    integrer_diffusions_partielles: true,
    champs_supplementaires: 'enseigne_1,enseigne_2,enseigne_3,sites_internet'
  };
  const { data } = await PAPPERS.get('/entreprise', { params });
  return data || {};
}

// --- Main ---
(async () => {
  console.log('🔎 Pappers: moisson ciblée intérim 78.20Z Paris/92 + HCR…');

  const sirens = new Set();

  // A1) Objet social ciblé (plus précis)
  for (const kw of KW){
    const s1 = await searchOnce({
      code_naf: NAF,
      departement: DEPTS,
      entreprise_cessee: false,
      objet_social: kw
    });
    s1.forEach(s => sirens.add(s));
    process.stdout.write(`  [+] objet_social="${kw}"  cumul=${sirens.size}\r`);
  }

  // A2) Recherche texte (peut ratisser des enseignes HCR)
  for (const kw of KW){
    const s2 = await searchOnce({
      code_naf: NAF,
      departement: DEPTS,
      entreprise_cessee: false,
      q: kw,
      precision: 'standard'
    });
    s2.forEach(s => sirens.add(s));
    process.stdout.write(`  [+] q="${kw}"            cumul=${sirens.size}\r`);
  }

  console.log(`\n🧪 Validation HCR par fiche /entreprise (enseigne + site + objet social)…`);

  const kept = new Set();
  let i = 0;
  for (const siren of sirens){
    i++;
    if (i % 25 === 0) process.stdout.write(`  …validés=${kept.size}/${sirens.size}\r`);
    try{
      const ent = await getEntreprise(siren);
      const obj = `${ent?.objet_social || ''}`;
      const ens = [ent?.enseigne_1, ent?.enseigne_2, ent?.enseigne_3].filter(Boolean).join(' | ');
      const sites = Array.isArray(ent?.sites_internet) ? ent.sites_internet.join(' ') : '';

      // Score HCR
      let score = 0;
      if (hasAny(obj, KW)) score += 2;               // objet social fort
      if (hasAny(ens, KW)) score += 2;               // enseigne évoque HCR
      if (hasAny(ent?.denomination || ent?.nom_entreprise, KW)) score += 1;
      if (hasAny(sites, ['hotel','hospitality','restau','traiteur'])) score += 1;

      const noBadSignals = [obj, ens].every(txt => hasNone(txt, KW_EXCLUDE));

      if (score >= 2 && noBadSignals) kept.add(siren);
      await SLEEP(120);
    } catch(e){
      // si erreur (diffusion partielle etc.), on écarte prudemment
    }
  }

  // 🔚 Ecrit uniquement les SIREN retenus (HCR probables)
  const rows = ['siren', ...Array.from(kept)].join('\n');
  fs.writeFileSync(OUT, rows, 'utf8');

  console.log(`\n✅ Écrit ${kept.size} SIREN HCR probables dans ${OUT}`);
})();

