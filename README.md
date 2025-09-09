# CompanySearch - Liste SIREN entreprises intérim Paris & Hauts-de-Seine

## Description

Ce projet récupère la liste des numéros SIREN de **TOUTES les entreprises d'intérim** (NAF 78.20Z) des départements :
- **75** : Paris
- **92** : Hauts-de-Seine

Avec possibilité d'**enrichissement des données** via l'API Pappers (dirigeants, informations entreprise).

## Installation

```bash
git clone https://github.com/Bencode92/CompanySearch.git
cd CompanySearch
npm install
```

## Configuration (optionnelle)

Pour l'enrichissement des données avec Pappers :
```bash
cp .env.example .env
# Éditer .env et ajouter votre clé API Pappers
```

## Utilisation

### 🎯 Récupérer la liste des SIREN (GRATUIT)

```bash
# Simple et direct
npm run build

# Ou
npm run fetch

# Résultat : input/sirens.csv
```

### 📊 Estimer le volume avant extraction

```bash
# Voir combien d'entreprises seront récupérées
npm run estimate
```

### 🔍 Enrichir avec les données Pappers (PAYANT)

```bash
# Enrichir et filtrer les dirigeants nés avant une date
npm run enrich -- --date=1964-12-31

# Cibler les dirigeants seniors (par défaut: nés avant 1965)
npm run enrich:seniors

# Exemples de ciblage par âge :
node scripts/enrich_pappers_from_csv.js --date=1960-12-31  # 64+ ans
node scripts/enrich_pappers_from_csv.js --date=1965-12-31  # 59+ ans
node scripts/enrich_pappers_from_csv.js --date=1970-12-31  # 54+ ans

# Résultat : output/dirigeants_avant_[DATE].csv
```

#### Format de date acceptés
- `YYYY-MM-DD` : 1964-12-31
- `DD-MM-YYYY` : 31-12-1964
- `DD/MM/YYYY` : 31/12/1964
- `YYYY` : 1964 (= 01/01/1964)

## GitHub Actions

### Workflow : **Get SIREN List Paris-92**

- **Automatique** : tous les vendredis à 5h00 UTC
- **Manuel** : Actions → "Get SIREN List Paris-92" → Run workflow
- **Fichiers générés** :
  - `input/sirens.csv` : Liste brute
  - `output/sirens_interim_75_92.csv` : Copie dans output

### Enrichissement automatique (optionnel)

Si vous avez configuré `PAPPERS_API_KEY` dans les secrets GitHub, le workflow peut enrichir automatiquement les données.

## Format des fichiers

### CSV des SIREN (gratuit)
```csv
siren
123456789
987654321
...
```

### CSV enrichi Pappers (payant)
```csv
siren;denomination;code_naf;libelle_code_naf;ville_siege;entreprise_cessee;dir_nom;dir_prenom;dir_qualite;dir_date_naissance;dir_age_estime_au_cutoff
123456789;INTERIM PLUS;78.20Z;Activités des agences de travail temporaire;PARIS;non;DUPONT;Jean;Président;15/03/1960;64
...
```

## Scripts disponibles

| Script | Description | Coût |
|--------|-------------|------|
| `npm run fetch` | Récupère les SIREN | **GRATUIT** |
| `npm run build` | Alias de fetch | **GRATUIT** |
| `npm run estimate` | Estime le volume | **GRATUIT** |
| `npm run enrich` | Enrichit avec Pappers + filtre par âge | **PAYANT** |
| `npm run enrich:seniors` | Enrichit (dirigeants nés avant 1965) | **PAYANT** |

## Cas d'usage business

### 🎯 Prospection commerciale ciblée
- **Succession d'entreprise** : Identifier les dirigeants proches de la retraite
- **Services seniors** : Proposer des solutions adaptées aux dirigeants âgés
- **Transmission/Reprise** : Cibler les entreprises en phase de transition

### 📊 Segmentation par âge des dirigeants
```bash
# Baby-boomers (nés avant 1965)
--date=1964-12-31

# Proche retraite (60+ ans)
--date=1965-12-31  

# Seniors (55+ ans)
--date=1970-12-31
```

## Structure des fichiers

```
CompanySearch/
├── scripts/
│   ├── fetch_idf_interim.js        # Script principal (GRATUIT)
│   ├── estimate_idf.js             # Estimation du volume
│   ├── enrich_pappers_from_csv.js  # Enrichissement Pappers
│   └── filter_dirigeants_by_dob.js # Filtrage par date de naissance
├── input/
│   └── sirens.csv                  # Liste des SIREN
├── output/
│   ├── sirens_interim_75_92.csv    # Copie pour export
│   └── dirigeants_avant_*.csv      # Données enrichies
└── .github/workflows/
    └── run-idf.yml                 # Workflow GitHub Actions
```

## Notes techniques

### API Gouvernementale (GRATUITE)
- **API utilisée** : API Recherche d'entreprises
- **Limite** : 7 requêtes/seconde
- **Pagination** : 25 résultats par page
- **Filtre NAF** : 78.20Z (Activités des agences de travail temporaire)
- **Zone** : Départements 75 et 92 uniquement
- **Statut** : Entreprises actives uniquement

### API Pappers (PAYANTE)
- **Tarification** : Voir https://www.pappers.fr/api
- **Limite** : Selon votre plan
- **Données** : Dirigeants, informations entreprise, dates de naissance
- **Throttling** : 120ms entre chaque requête

## Support

- API Recherche d'entreprises : https://api.gouv.fr/les-api/api-recherche-entreprises
- API Pappers : https://www.pappers.fr/api
- Issues : https://github.com/Bencode92/CompanySearch/issues