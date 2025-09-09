# CompanySearch - Extraction données entreprises intérim Paris & Hauts-de-Seine

## Description

Ce projet Node.js extrait les entreprises d'intérim (NAF 78.20Z) des départements **75 (Paris)** et **92 (Hauts-de-Seine)** avec toutes leurs informations d'entreprise (sans les dirigeants).

## Installation locale

### Prérequis
- Node.js 18+
- Une clé API Pappers (obtenir sur https://www.pappers.fr/api)

### Configuration

1. Cloner le repo :
```bash
git clone https://github.com/Bencode92/CompanySearch.git
cd CompanySearch
```

2. Installer les dépendances :
```bash
npm install
```

3. Configurer votre clé API :
```bash
cp .env.example .env
# Éditer .env et remplacer votre_cle_api_pappers_ici par votre vraie clé
```

## Utilisation Principale

### 🎯 Extraction Entreprises Paris (75) & Hauts-de-Seine (92)

```bash
# Extraction complète en 2 étapes :
npm run fetch:75-92      # 1) Récupère les SIREN (gratuit via API gouv)
npm run enrich:companies # 2) Enrichit avec toutes les infos entreprises (1 crédit/entreprise)

# Ou tout-en-un :
npm run build
# -> output/entreprises_interim_75_92.csv
```

### 📊 Estimation préalable (RECOMMANDÉ)

```bash
# Estimer le volume et le coût avant extraction
npm run estimate
# -> Affiche le nombre d'entreprises et le coût estimé
```

## GitHub Actions

### Workflow Principal : **Build CSV Paris-92 Companies**

- **Automatique** : tous les vendredis à 5h00 UTC
- **Manuel** : Actions → "Build CSV Paris-92 Companies" → Run workflow
- **Résultat** : Entreprises d'intérim des départements 75 et 92
- **Fichier généré** : `output/entreprises_interim_75_92.csv`

### Configuration

1. Dans votre repo GitHub : **Settings → Secrets and variables → Actions**
2. Créer un secret `PAPPERS_API_KEY` avec votre clé API

## Structure du CSV

Le fichier CSV généré contient toutes les informations de l'entreprise :

### Informations générales
- `siren` : Numéro SIREN
- `denomination` : Nom de l'entreprise
- `sigle` : Sigle
- `forme_juridique` : Forme juridique (SAS, SARL, etc.)
- `code_naf` : Code NAF (78.20Z)
- `libelle_code_naf` : Libellé du code NAF

### Effectifs et dates
- `effectif` : Nombre d'employés
- `tranche_effectif` : Tranche d'effectif
- `date_creation` : Date de création
- `date_cessation` : Date de cessation (si applicable)
- `entreprise_cessee` : Statut (oui/non)
- `categorie_entreprise` : PME, ETI, etc.

### Localisation siège
- `adresse_siege` : Adresse du siège
- `code_postal_siege` : Code postal
- `ville_siege` : Ville
- `departement_siege` : Département

### Données financières
- `chiffre_affaires` : Chiffre d'affaires
- `resultat` : Résultat net

### Autres informations
- `nb_etablissements` : Nombre total d'établissements
- `nb_etablissements_actifs` : Nombre d'établissements actifs
- `convention_collective` : Convention collective appliquée
- `site_web` : Site web
- `telephone` : Téléphone
- `email` : Email

Séparateur : `;` (compatible Excel français)

## Scripts Disponibles

| Script | Description | Coût |
|--------|-------------|------|
| `npm run fetch:75-92` | Récupère SIREN Paris & 92 | Gratuit |
| `npm run enrich:companies` | Enrichit avec infos entreprises | 1 crédit/entreprise |
| `npm run build` | Processus complet (fetch + enrich) | 1 crédit/entreprise |
| `npm run estimate` | Estime le volume | Gratuit |

### Scripts optionnels (avec dirigeants)

Si vous avez besoin des informations sur les dirigeants :

| Script | Description |
|--------|-------------|
| `npm run enrich:with-directors` | Enrichit AVEC les dirigeants |
| `npm run build:with-directors` | Complet avec dirigeants |
| `npm run filter` | Filtre dirigeants par date de naissance |

## Structure des Fichiers

```
CompanySearch/
├── scripts/
│   ├── fetch_idf_interim.js         # Récupération SIREN 75 & 92 (gratuit)
│   ├── enrich_companies_only.js     # Enrichissement entreprises SANS dirigeants
│   ├── enrich_idf_all.js            # (Optionnel) Avec dirigeants
│   ├── filter_dirigeants_by_dob.js  # (Optionnel) Filtrage par date
│   └── estimate_idf.js              # Estimation volume et coûts
├── input/                            # SIREN récupérés (étape 1)
├── output/                           # CSV finaux
├── .github/workflows/
│   ├── run-idf.yml                  # Workflow principal Paris-92
│   └── run-idf-filtered.yml         # (Optionnel) Avec filtre date
└── package.json                     # Scripts npm et dépendances
```

## Exemples d'Usage

### Cas 1 : Export standard entreprises
```bash
# Estimation préalable
npm run estimate

# Si OK, lancer l'extraction
npm run build
# -> output/entreprises_interim_75_92.csv
```

### Cas 2 : Export avec dirigeants (optionnel)
```bash
npm run fetch:75-92
npm run enrich:with-directors
# -> output/idf_interim_all_dirigeants.csv
```

### Cas 3 : Filtrage par date de naissance (optionnel)
```bash
npm run fetch:75-92
npm run filter -- --date=1962-12-31
# -> output/dirigeants_avant_19621231.csv
```

## Notes Techniques

### Limites API
- **API gouvernementale** : 7 requêtes/seconde, pagination à 25 résultats
- **API Pappers** : Throttling intégré (120ms entre requêtes)

### Zone géographique
- **Département 75** : Paris
- **Département 92** : Hauts-de-Seine

### Volume estimé
Les départements 75 et 92 concentrent une part importante des entreprises d'intérim en France. Utilisez `npm run estimate` pour connaître le nombre exact et le coût avant de lancer l'extraction.

## Support

- API Pappers : https://www.pappers.fr/api/documentation
- API Recherche d'entreprises : https://api.gouv.fr/les-api/api-recherche-entreprises
- Issues : https://github.com/Bencode92/CompanySearch/issues