// npm i axios
// scripts/fetch-hcr-precise.js
// Objectif : récupérer UNIQUEMENT des agences d’intérim (NAF 78.20Z) 75/92
// ayant une spécialisation HCR (Hôtellerie-Restauration) — et capter les marques
// connues comme ADAPTEL même si l’objet social n’est pas explicite.

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OUT = path.join('input', 'sirens.csv');
fs.mkdirSync('input', { recursive: true });

const PAPPERS_KEY = process.env.PAPPERS_API_KEY; // <-- secrets
if (!PAPPERS_KEY) {
  console.error('❌ PAPPERS_API_KEY manquant');
  process.exit(1);
}

const PAPPERS = axios.create({
  baseURL: 'https://api.pappers.fr/v2',
  timeout: 25000,
  headers: { 'api-key': PAPPERS_KEY }
});

// --- Paramètres (customisables par ENV) ---
const DEPTS = process.env.DEPARTEMENTS || '75,92';
const NAF = '78.20Z'; // agences de travail temporaire
const PAR_CURSEUR = Math.min(Math.max(parseInt(process.env.PAR_CURSEUR || '500', 10), 1), 1000); // 1..1000
const THRESHOLD = parseInt(process.env.HCR_THRESHOLD || '2', 10); // score minimal pour garder
const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));

// Marques HCR connues (whitelist) — capte ADAPTEL même si objet social générique
const HCR_BRANDS = (process.env.HCR_BRANDS || 'adaptel')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

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

// Rôles métiers HCR (signal fort dans dénomination/enseigne)
const HCR_ROLES = (process.env.HCR_EXTRA_ROLES || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .concat([
    'réception','reception','réceptionniste','receptionniste',
    'housekeeping','gouvernante','femme de chambre','valet de chambre',
    'serveur','serveuse','chef de rang','chef de partie','commis',
    'barman','barmaid','banquet','conciergerie'
  ]);

// Anti-bruit (exclusions explicites)
const KW_EXCLUDE = [
  'btp','bâtiment','batiment','industrie','industriel',
  'logistique','transport','sécurité','securite',
  'nettoyage industriel','santé','medical','médical'
];

// Option de coût : faut-il récupérer les sites (1 crédit si dispo) ?
const FETCH_SITES = String(process.env.FETCH_SITES || '0') === '1';

// Option de coût : faut-il interroger /recherche-documents pour renforcer le score ?
const USE_DOCS = String(process.env.USE_DOCS || '0') === '1';

// Normalisation simple
const norm = s => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .replace(/\s+/g, ' ')
  .trim();

function hasAny(text, list) {
  const t = norm(text);
  return list.some(k => t.includes(norm(k)));
}

function hasNone(text, list) {
  const t = norm(text);
  return !list.some(k => t.includes(norm(k)));
}

// --- Recherche Pappers avec curseur ---
async function searchOnce(params) {
  const out = new Set();
  let curseur = '*';
  do {
    const { data } = await PAPPERS.get('/recherche', {
      params: { ...params, curseur, par_curseur: PAR_CURSEUR, bases: 'entreprises' }
    });
    const arr = data?.resultats || [];
    for (const it of arr) {
      const siren = it?.siren || it?.siren_formate?.replace(/\D/g, '');
      if (siren && /^\d{9}$/.test(siren)) out.add(siren);
    }
    curseur = data?.curseurSuivant || null;
    await SLEEP(150);
  } while (curseur);
  return out;
}

async function getEntreprise(siren) {
  const baseFields = ['enseigne_1','enseigne_2','enseigne_3'];
  const extra = FETCH_SITES ? ',sites_internet' : '';
  const params = {
    siren,
    integrer_diffusions_partielles: true,
    champs_supplementaires: baseFields.join(',') + extra
  };
  const { data } = await PAPPERS.get('/entreprise', { params });
  return data || {};
}

async function hasHcrDocs(siren) {
  if (!USE_DOCS) return false;
  try {
    const { data } = await PAPPERS.get('/recherche-documents', {
      params: {
        siren,
        q: 'hôtellerie OR restauration OR housekeeping OR réception OR CHR OR HCR',
        par_page: 1
      }
    });
    return (data?.total || 0) > 0;
  } catch {
    return false;
  }
}

// --- Main ---
(async () => {
  console.log('🔎 Pappers : moisson intérim 78.20Z Paris/92 + ciblage HCR…');

  const candidates = new Set();

  // A0) Boost marques (ADAPTEL & co) — capte les spécialistes même sans objet social HCR
  for (const brand of HCR_BRANDS) {
    const brandSet = await searchOnce({
      code_naf: NAF,
      departement: DEPTS,
      entreprise_cessee: false,
      q: brand,
      precision: 'standard'
    });
    brandSet.forEach(s => candidates.add(s));
    process.stdout.write(`  [+] brand q="${brand}"        cumul=${candidates.size}\r`);
  }

  // A1) Objet social ciblé (précis quand explicite)
  for (const kw of KW) {
    const s1 = await searchOnce({
      code_naf: NAF,
      departement: DEPTS,
      entreprise_cessee: false,
      objet_social: kw
    });
    s1.forEach(s => candidates.add(s));
    process.stdout.write(`  [+] objet_social="${kw}"      cumul=${candidates.size}\r`);
  }

  // A2) Recherche texte (ratisse les enseignes et dénominations)
  for (const kw of KW) {
    const s2 = await searchOnce({
      code_naf: NAF,
      departement: DEPTS,
      entreprise_cessee: false,
      q: kw,
      precision: 'standard'
    });
    s2.forEach(s => candidates.add(s));
    process.stdout.write(`  [+] q="${kw}"                  cumul=${candidates.size}\r`);
  }

  console.log(`\n🧪 Validation HCR via /entreprise (enseigne + dénomination + objet social${FETCH_SITES ? ' + sites' : ''}${USE_DOCS ? ' + docs' : ''})…`);

  const kept = new Set();
  let i = 0;

  for (const siren of candidates) {
    i++;
    if (i % 25 === 0) process.stdout.write(`  …validés=${kept.size}/${candidates.size}\r`);
    try {
      const ent = await getEntreprise(siren);

      const deno = (ent?.denomination || ent?.nom_entreprise || '');
      const ens  = [ent?.enseigne_1, ent?.enseigne_2, ent?.enseigne_3].filter(Boolean).join(' | ');
      const obj  = (ent?.objet_social || '');
      const sites = Array.isArray(ent?.sites_internet) ? ent.sites_internet.join(' ') : '';

      // calcul score
      let score = 0;

      const hitBrand = hasAny(deno, HCR_BRANDS) || hasAny(ens, HCR_BRANDS) || hasAny(sites, HCR_BRANDS);
      const hitRoles = hasAny(deno, HCR_ROLES) || hasAny(ens, HCR_ROLES);
      const hitKWObj = hasAny(obj, KW);

      if (hitKWObj) score += 2;         // objet social mentionne HCR
      if (hitRoles) score += 2;         // rôles HCR dans denom/enseigne
      if (hasAny(deno, KW) || hasAny(ens, KW)) score += 1; // mots-clés HCR génériques
      if (FETCH_SITES && (hasAny(sites, ['hotel','hospitality','restau','traiteur']))) score += 1;

      // renfort par docs si rien n’a matché
      if (!hitBrand && !hitRoles && !hitKWObj) {
        if (await hasHcrDocs(siren)) score += 2;
      }

      // marque whitelist = spécialiste connu → score minimal garanti
      if (hitBrand) score = Math.max(score, THRESHOLD);

      // exclusions secteur pour réduire le bruit
      const noBadSignals = [deno, ens, obj].every(txt => hasNone(txt, KW_EXCLUDE));
      if (score >= THRESHOLD && noBadSignals) kept.add(siren);

      await SLEEP(120);
    } catch (e) {
      // En cas d’erreur (diffusion partielle, 404…), on écarte prudemment
    }
  }

  // 🔚 Écriture CSV final : uniquement les SIREN retenus (HCR probables)
  const rows = ['siren', ...Array.from(kept)].join('\n');
  fs.writeFileSync(OUT, rows, 'utf8');

  console.log(`\n✅ Écrit ${kept.size} SIREN HCR probables dans ${OUT}`);
  if (HCR_BRANDS.length) {
    console.log(`ℹ️ Marques whitelist utilisées: ${HCR_BRANDS.join(', ')}`);
  }
  console.log(`ℹ️ Seuil (THRESHOLD) = ${THRESHOLD} | FETCH_SITES=${FETCH_SITES ? 'ON' : 'OFF'} | USE_DOCS=${USE_DOCS ? 'ON' : 'OFF'}`);
})().catch(err => {
  console.error('❌ Script failed:', err?.message || err);
  process.exit(1);
});

