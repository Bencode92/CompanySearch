# CompanySearch 2.0 - Extraction B2B Île-de-France

## 🚀 Nouveautés v2.0

- ✅ **Toute l'Île-de-France** : 8 départements (75, 77, 78, 91, 92, 93, 94, 95)
- ✅ **Multi-NAF** : Ciblez plusieurs codes NAF simultanément
- ✅ **Filtres avancés** : CA, effectifs, villes, âge des dirigeants
- ✅ **Traitement par batch** : Optimisé pour gros volumes
- ✅ **Multi-formats** : Export CSV, JSON, Excel
- ✅ **Requêtes parallèles** : Enrichissement jusqu'à 5x plus rapide

## Description

Outil professionnel de prospection B2B pour extraire et enrichir les données d'entreprises en Île-de-France. Combine l'API gouvernementale gratuite avec l'enrichissement Pappers pour un ciblage précis des dirigeants.

## Installation

```bash
git clone https://github.com/Bencode92/CompanySearch.git
cd CompanySearch
npm install

# Optionnel : support Excel
npm install xlsx
```

## Configuration

```bash
cp .env.example .env
# Éditer .env et ajouter votre clé API Pappers
```

## Utilisation rapide

### 🎯 Cas d'usage classiques

```bash
# 1. Intérim sur toute l'IDF (défaut)
npm run fetch:idf

# 2. Conseil (70.22Z) sur Paris uniquement
node scripts/fetch_idf_advanced.js --deps=75 --naf=70.22Z

# 3. Multi-secteurs sur Hauts-de-Seine
node scripts/fetch_idf_advanced.js --deps=92 --naf=78.20Z,78.30Z,70.22Z

# 4. Enrichissement dirigeants seniors (60+ ans)
npm run enrich:seniors

# 5. Filtrage par CA (entreprises > 1M€)
node scripts/enrich_pappers_advanced.js --ca_min=1000000

# 6. Export Excel avec tous les filtres
node scripts/fetch_idf_advanced.js --format=xlsx --deps=75,92
node scripts/enrich_pappers_advanced.js --format=xlsx --date=1965-12-31
```

## Scripts avancés

### 📊 Script de collecte avancé

```bash
node scripts/fetch_idf_advanced.js [options]

OPTIONS :
  --deps=75,92,93        Départements (défaut: tous IDF)
  --naf=78.20Z,78.30Z    Codes NAF séparés par virgules
  --format=csv|json|xlsx Format de sortie
  --batch=1000           Limite de résultats
  --timestamp            Ajoute la date au nom du fichier
  --help                 Affiche l'aide
```

### 💎 Script d'enrichissement avancé

```bash
node scripts/enrich_pappers_advanced.js [options]

OPTIONS :
  --in=fichier.csv       Fichier d'entrée
  --date=1965-12-31      Date cutoff dirigeants
  --format=csv|json|xlsx Format de sortie
  --batch=100            Taille des batchs
  --concurrent=3         Requêtes parallèles
  
FILTRES :
  --ca_min=1000000       CA minimum
  --ca_max=10000000      CA maximum
  --effectif_min=10      Effectif minimum
  --effectif_max=500     Effectif maximum
  --ville=paris,lyon     Villes du siège
  --inactive=true        Inclure cessées
```

## GitHub Actions Workflow

### 🤖 Workflow unifié "Advanced Company Search IDF"

**Déclenchement** :
- Manuel avec paramètres personnalisables
- Automatique tous les vendredis à 5h UTC

**Paramètres disponibles** :
- `departments` : Départements ou "all" pour toute l'IDF
- `naf_codes` : Codes NAF (virgules)
- `enrich` : Activer l'enrichissement Pappers
- `cutoff_date` : Date limite pour l'âge
- `ca_min/max` : Filtres CA
- `effectif_min/max` : Filtres effectifs
- `format` : csv, json ou xlsx
- `batch_size` : Limite de résultats

## Codes NAF courants

| Code | Secteur |
|------|---------|
| **78.20Z** | Agences d'intérim |
| **78.30Z** | Autres RH |
| **70.22Z** | Conseil entreprise |
| **62.01Z** | Programmation informatique |
| **62.02A** | Conseil informatique |
| **73.11Z** | Agences publicité |
| **69.20Z** | Expertise comptable |
| **46.** | Commerce de gros |
| **47.** | Commerce de détail |

## Format des exports

### CSV enrichi
```csv
siren;denomination;code_naf;libelle_code_naf;ville_siege;code_postal;
entreprise_cessee;date_creation;forme_juridique;tranche_ca;tranche_effectif;
chiffre_affaires;effectif;dir_nom;dir_prenom;dir_qualite;dir_date_naissance;dir_age_actuel
```

### JSON structuré
```json
{
  "metadata": {
    "date_export": "2025-09-09T16:00:00Z",
    "total_dirigeants": 450,
    "filtres": { ... }
  },
  "dirigeants": [ ... ]
}
```

## Cas d'usage business

### 🎯 Ciblage par secteur
```bash
# Toutes les ESN d'IDF
node scripts/fetch_idf_advanced.js --naf=62.01Z,62.02A

# Agences de pub parisiennes
node scripts/fetch_idf_advanced.js --deps=75 --naf=73.11Z
```

### 👴 Succession d'entreprise
```bash
# Dirigeants 60+ ans, entreprises > 2M€ CA
node scripts/enrich_pappers_advanced.js \
  --date=1965-12-31 \
  --ca_min=2000000
```

### 🏢 Grandes entreprises uniquement
```bash
# Effectif > 50, CA > 5M€
node scripts/enrich_pappers_advanced.js \
  --effectif_min=50 \
  --ca_min=5000000
```

### 📍 Ciblage géographique
```bash
# La Défense et environs
node scripts/fetch_idf_advanced.js --deps=92
node scripts/enrich_pappers_advanced.js \
  --ville=puteaux,courbevoie,nanterre,"la defense"
```

## Performance et optimisation

### ⚡ Traitement rapide
```bash
# Batch important + parallélisation
node scripts/enrich_pappers_advanced.js \
  --batch=200 \
  --concurrent=5
```

### 📦 Échantillonnage
```bash
# Limiter à 1000 entreprises pour test
node scripts/fetch_idf_advanced.js --batch=1000
```

## Structure des fichiers

```
CompanySearch/
├── scripts/
│   ├── fetch_idf_advanced.js       # Collecte multi-départements/NAF
│   ├── enrich_pappers_advanced.js  # Enrichissement avec filtres
│   ├── fetch_idf_interim.js        # Script original (Paris + 92)
│   └── enrich_pappers_from_csv.js  # Enrichissement basique
├── output/
│   ├── sirens_*.csv                # SIREN collectés
│   ├── dirigeants_*.csv            # Données enrichies
│   └── *.json / *.xlsx             # Autres formats
└── .github/workflows/
    ├── advanced-search-idf.yml      # Workflow principal v2
    └── [anciens workflows]          # Compatibilité
```

## Tarification API

### API Gouvernementale (GRATUIT)
- Limite : 7 requêtes/seconde
- Aucun coût

### API Pappers (PAYANT)
- Voir [pappers.fr/api](https://www.pappers.fr/api)
- ~0.01€ à 0.05€ par entreprise selon le plan

## Conformité légale

⚠️ **RGPD** : Le traitement de données personnelles (dates de naissance) nécessite :
- Base légale (intérêt légitime pour prospection B2B)
- Information des personnes concernées si contact
- Registre des traitements
- Sécurisation des données

## Support

- Issues : [GitHub Issues](https://github.com/Bencode92/CompanySearch/issues)
- API Gouv : [api.gouv.fr](https://api.gouv.fr/les-api/api-recherche-entreprises)
- API Pappers : [pappers.fr/api](https://www.pappers.fr/api)

## Changelog

### v2.0.0 (09/09/2025)
- ✨ Support complet Île-de-France (8 départements)
- ✨ Codes NAF multiples et paramétrables
- ✨ Filtres avancés (CA, effectifs, villes)
- ✨ Traitement par batch optimisé
- ✨ Export multi-formats (CSV, JSON, Excel)
- ✨ Requêtes parallèles pour performance
- ✨ Workflow GitHub Actions unifié

### v1.0.0
- Version initiale (Paris + Hauts-de-Seine)
- Code NAF 78.20Z uniquement
- Export CSV simple