// npm i axios
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OUT = path.join('input', 'sirens.csv');
fs.mkdirSync('input', { recursive: true });

const BASE = 'https://recherche-entreprises.api.gouv.fr';
const NAF = '78.20Z';                 // intérim
const DEPARTEMENTS = ['75', '92'];    // Paris et Hauts-de-Seine
const PER_PAGE = 25;                  // limite doc : 25
const SLEEP_MS = 220;                 // rester < ~7 req/s

// Mots-clés HCR (accents & variantes inclus)
const KEYWORDS = [
  'hôtellerie','hotellerie','hôtel','hotel',
  'restauration','restaurant','traiteur',
  'housekeeping','room service',
  'réception','reception',
  'bar','serveur','serveuse','barman','barmaid',
  'cuisine','commis','chef de partie',
  'femme de chambre','valet de chambre','gouvernante',
  'banquet','événementiel','evenementiel',
  'CHR','HCR'
];

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const sirens = new Set();

  console.log('🔎 Collecte SIREN HCR — NAF 78.20Z, départements 75 & 92, entreprises actives…');

  for (const dept of DEPARTEMENTS) {
    console.log(`\n📍 Département ${dept}…`);

    for (const kw of KEYWORDS) {
      let page = 1, totalPages = 1;
      console.log(`  🔤 Mot-clé "${kw}"`);

      do {
        const params = {
          activite_principale: NAF,   // filtre NAF entreprise
          departement: dept,          // filtre sur le département
          etat_administratif: 'A',    // entreprises actives
          q: kw,                      // recherche plein texte (nom/adresse/etc.)
          page,
          per_page: PER_PAGE
        };

        try {
          const { data } = await axios.get(`${BASE}/search`, { params, timeout: 20000 });
          const results = data?.results || [];
          totalPages = data?.total_pages || page;

          for (const it of results) {
            const siren =
              it?.siren ||
              it?.siren_formate?.replace(/\D/g,'') ||
              it?.unite_legale?.siren;
            if (siren && /^\d{9}$/.test(String(siren))) sirens.add(String(siren));
          }

          process.stdout.write(`    page ${page}/${totalPages} — cumul ${sirens.size} SIREN\r`);
          page++;
          await sleep(SLEEP_MS);
        } catch (e) {
          console.error(`    ⚠️ Erreur dept ${dept} kw "${kw}" page ${page}:`, e.message);
          break;
        }
      } while (page <= totalPages);
    }
  }

  // Écrire le CSV (colonne unique 'siren' — compatibilité avec ton workflow)
  const rows = ['siren', ...Array.from(sirens)].join('\n');
  fs.writeFileSync(OUT, rows, 'utf8');

  console.log(`\n✅ Écrit ${sirens.size} SIREN (intérim HCR) dans ${OUT}`);
})().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
