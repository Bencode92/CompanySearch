// npm i axios
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OUT = path.join('input', 'sirens.csv');
fs.mkdirSync('input', { recursive: true });

const BASE = 'https://recherche-entreprises.api.gouv.fr';
const NAF = '78.20Z';                 // intérim
const DATE_MAX = '1962-12-31';        // "nés avant 1963"
const PER_PAGE = 25;                  // limite doc : 25
const SLEEP_MS = 200;                 // 7 req/s max -> on reste soft

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const sirens = new Set();
  let page = 1, totalPages = 1;

  do {
    const params = {
      activite_principale: NAF,
      type_personne: 'dirigeant',
      date_naissance_personne_max: DATE_MAX,
      etat_administratif: 'A',
      page,
      per_page: PER_PAGE
    };

    const { data } = await axios.get(`${BASE}/search`, { params, timeout: 20000 });
    const results = data?.results || data?.resultats || [];
    totalPages = data?.total_pages || data?.totalPages || page;

    for (const it of results) {
      const siren = it?.siren || it?.siren_formate?.replace(/\D/g,'') || it?.unite_legale?.siren;
      if (siren && /^\d{9}$/.test(String(siren))) sirens.add(String(siren));
    }

    console.log(`page ${page}/${totalPages} — cumul ${sirens.size} SIREN`);
    page++;
    await sleep(SLEEP_MS);
  } while (page <= totalPages);

  const rows = ['siren', ...Array.from(sirens)].join('\n');
  fs.writeFileSync(OUT, rows, 'utf8');
  console.log(`✅ écrit ${sirens.size} SIREN dans ${OUT}`);
})();