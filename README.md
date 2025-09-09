# CompanySearch - Liste SIREN entreprises intérim Paris & Hauts-de-Seine

## Description

Ce projet récupère la liste des numéros SIREN de **TOUTES les entreprises d'intérim** (NAF 78.20Z) des départements :
- **75** : Paris
- **92** : Hauts-de-Seine

⚠️ **Aucune clé API requise** - Utilise uniquement l'API gouvernementale gratuite

## Installation

```bash
git clone https://github.com/Bencode92/CompanySearch.git
cd CompanySearch
npm install
```

## Utilisation

### 🎯 Récupérer la liste des SIREN

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

## GitHub Actions

### Workflow : **Get SIREN List Paris-92**

- **Automatique** : tous les vendredis à 5h00 UTC
- **Manuel** : Actions → "Get SIREN List Paris-92" → Run workflow
- **Fichiers générés** :
  - `input/sirens.csv` : Liste brute
  - `output/sirens_interim_75_92.csv` : Copie dans output

### ✅ Ce workflow fait :
1. Récupère TOUS les SIREN d'entreprises d'intérim
2. Départements 75 et 92 uniquement
3. Entreprises actives uniquement
4. Sauvegarde dans un fichier CSV

### ❌ Ce workflow NE fait PAS :
- Pas d'enrichissement des données
- Pas d'informations sur les dirigeants
- Pas besoin de clé API Pappers
- Pas de coût

## Format du fichier CSV

Le fichier contient une simple liste de numéros SIREN :
```csv
siren
123456789
987654321
...
```

## Scripts disponibles

| Script | Description | Coût |
|--------|-------------|------|
| `npm run fetch` | Récupère les SIREN | **GRATUIT** |
| `npm run build` | Alias de fetch | **GRATUIT** |
| `npm run estimate` | Estime le volume | **GRATUIT** |

## Structure des fichiers

```
CompanySearch/
├── scripts/
│   ├── fetch_idf_interim.js    # Script principal
│   └── estimate_idf.js         # Estimation du volume
├── input/
│   └── sirens.csv              # Liste des SIREN
├── output/
│   └── sirens_interim_75_92.csv # Copie pour export
└── .github/workflows/
    └── run-idf.yml             # Workflow GitHub Actions
```

## Exemple de sortie

Après exécution, vous obtenez un fichier CSV simple :
```
siren
850123456
751234567
920987654
...
```

## Notes techniques

- **API utilisée** : API Recherche d'entreprises (gouvernementale)
- **Limite** : 7 requêtes/seconde
- **Pagination** : 25 résultats par page
- **Filtre NAF** : 78.20Z (Activités des agences de travail temporaire)
- **Zone** : Départements 75 et 92 uniquement
- **Statut** : Entreprises actives uniquement

## Support

- API Recherche d'entreprises : https://api.gouv.fr/les-api/api-recherche-entreprises
- Issues : https://github.com/Bencode92/CompanySearch/issues