# CompanySearch - Extraction données entreprises intérim

## Description

Ce projet Node.js extrait les entreprises d'intérim (NAF 78.20Z) et leurs dirigeants selon différents critères géographiques.

**Principales fonctionnalités :**
1. **IDF Complet** : Toutes les entreprises d'intérim d'Île-de-France avec TOUS leurs dirigeants
2. **IDF Filtré** : Entreprises IDF avec filtrage par date de naissance des dirigeants
3. **National** : France entière avec différentes approches

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

## Utilisation

### 🎯 Méthode IDF - TOUS les dirigeants (PRINCIPAL)

Extraction complète de toutes les entreprises d'intérim en Île-de-France avec TOUS leurs dirigeants :

```bash
# Estimation préalable (RECOMMANDÉ)
npm run estimate
# -> Affiche le nombre d'entreprises et le coût estimé

# Extraction complète en 2 étapes :
npm run fetch:idf    # 1) Récupère les SIREN (gratuit)
npm run enrich:idf   # 2) Enrichit avec Pappers (1 crédit/entreprise)

# Ou tout-en-un :
npm run build:idf
# -> output/idf_interim_all_dirigeants.csv
```

### 📅 Méthode IDF avec Filtrage par Date

Pour filtrer les dirigeants par date de naissance :

```bash
# Récupérer les SIREN IDF
npm run fetch:idf

# Filtrer par date
npm run filter -- --date=1962-12-31

# Formats de date acceptés :
# --date=1962-12-31    (ISO)
# --date=31-12-1962    (FR)
# --date=31/12/1962    (FR avec /)
# --date=1962          (année seule)
# --date=12/1962       (mois/année)

# Ou avec options avancées :
npm run filter -- --date=1965-06-30 --in=custom/list.csv --out=results/seniors.csv
```

### 📍 Méthode National France Entière

```bash
# Approche optimisée (recherche gratuite + enrichissement)
npm run build:cheap
# -> input/sirens.csv puis output/interim_dirigeants_<=1962.csv

# Ou Pappers direct (plus coûteux)
npm run build:pappers
# -> output/interim_dirigeants_<=1961.csv
```

## Automatisation avec GitHub Actions

### Configuration des Secrets

1. Dans votre repo GitHub : **Settings → Secrets and variables → Actions**
2. Créer un secret `PAPPERS_API_KEY` avec votre clé API

### Workflows Disponibles

#### 1. **IDF All Directors** (`run-idf.yml`) - PRINCIPAL
- **Automatique** : tous les vendredis à 5h00 UTC
- **Manuel** : Actions → "Build CSV IDF All Directors" → Run workflow
- **Résultat** : TOUTES les entreprises d'intérim IDF avec TOUS leurs dirigeants
- **Fichier** : `output/idf_interim_all_dirigeants.csv`

#### 2. **IDF avec Filtrage Date** (`run-idf-filtered.yml`)
- **Manuel uniquement** : Actions → "Build CSV IDF with Date Filter" → Run workflow
- **Paramètre** : `date` - spécifier la date limite (ex: 1962-12-31)
- **Résultat** : Dirigeants nés avant la date spécifiée
- **Fichier** : `output/dirigeants_avant_[date].csv`

#### 3. **National Optimisé** (`run-optimized.yml`)
- **Automatique** : tous les mercredis à 5h00 UTC
- **Manuel** : Actions → "Build CSV optimized (free search)" → Run workflow
- Utilise l'API gouvernementale gratuite puis Pappers

#### 4. **Pappers Direct** (`run.yml`)
- **Automatique** : tous les lundis à 5h00 UTC
- **Manuel** : Actions → "Build CSV intérim <=1961" → Run workflow
- Utilise uniquement l'API Pappers

## Structure des CSV

### CSV IDF Complet (`idf_interim_all_dirigeants.csv`)
- `siren` : Numéro SIREN de l'entreprise
- `denomination` : Nom de l'entreprise
- `code_naf` : Code NAF (78.20Z pour l'intérim)
- `libelle_code_naf` : Libellé du code NAF
- `entreprise_cessee` : Statut de l'entreprise (oui/non)
- `dir_nom` : Nom du dirigeant
- `dir_prenom` : Prénom du dirigeant
- `dir_qualite` : Fonction du dirigeant
- `dir_date_naissance` : Date de naissance
- `dir_nationalite` : Nationalité
- `dir_ville_naissance` : Ville de naissance

### CSV Filtré par Date
Mêmes colonnes + `comparaison` : Précision sur la comparaison de date

Séparateur : `;` (compatible Excel français)

## Structure des Fichiers

```
CompanySearch/
├── scripts/
│   ├── fetch_idf_interim.js         # Récupération SIREN IDF (gratuit)
│   ├── enrich_idf_all.js            # Enrichissement IDF complet
│   ├── filter_dirigeants_by_dob.js  # Filtrage par date de naissance
│   ├── estimate_idf.js              # Estimation volume et coûts
│   ├── fetch_sirens_gouv.js         # Récupération nationale (gratuit)
│   ├── enrich_from_list.js          # Enrichissement national
│   └── build_pappers.js             # Script Pappers direct
├── input/                            # SIREN récupérés (étape 1)
├── output/                           # CSV finaux
├── .github/workflows/
│   ├── run-idf.yml                  # Workflow IDF complet
│   ├── run-idf-filtered.yml         # Workflow IDF avec filtre date
│   ├── run-optimized.yml            # Workflow national optimisé
│   └── run.yml                      # Workflow Pappers direct
└── package.json                     # Scripts npm et dépendances
```

## Scripts Disponibles

| Script | Description | Coût |
|--------|-------------|------|
| `npm run estimate` | Estime le volume IDF | Gratuit |
| `npm run estimate:full` | Compte exact + option sauvegarde | Gratuit |
| `npm run fetch:idf` | Récupère SIREN IDF | Gratuit |
| `npm run enrich:idf` | Enrichit TOUS les dirigeants IDF | 1 crédit/entreprise |
| `npm run build:idf` | IDF complet (fetch + enrich) | 1 crédit/entreprise |
| `npm run filter` | Filtre par date de naissance | 1 crédit/entreprise |
| `npm run build:filtered` | IDF avec filtre date (1962) | 1 crédit/entreprise |
| `npm run build:cheap` | National optimisé | 1 crédit/entreprise |
| `npm run build:pappers` | Pappers direct | Variable |

## Exemples d'Usage

### Cas 1 : Export complet IDF
```bash
# Estimer d'abord
npm run estimate

# Si OK, lancer l'extraction complète
npm run build:idf
```

### Cas 2 : Analyse par génération
```bash
# D'abord récupérer les SIREN
npm run fetch:idf

# Puis filtrer par décennie
npm run filter -- --date=1959-12-31 --out=output/annees_50.csv
npm run filter -- --date=1969-12-31 --out=output/annees_60.csv
npm run filter -- --date=1979-12-31 --out=output/annees_70.csv
```

### Cas 3 : Suivi mensuel automatisé
Utiliser le workflow GitHub Actions "Build CSV IDF All Directors" pour un export mensuel complet.

## Notes Techniques

### Limites API
- **API gouvernementale** : 7 requêtes/seconde, pagination à 25 résultats
- **API Pappers** : Throttling intégré (120ms entre requêtes)

### Région Île-de-France
Code région `11` couvre les départements : 75, 77, 78, 91, 92, 93, 94, 95

### Volume estimé
En Île-de-France, il y a environ plusieurs centaines d'entreprises d'intérim actives. Utilisez `npm run estimate` pour connaître le nombre exact et le coût avant de lancer l'extraction.

## Support

- API Pappers : https://www.pappers.fr/api/documentation
- API Recherche d'entreprises : https://api.gouv.fr/les-api/api-recherche-entreprises
- Issues : https://github.com/Bencode92/CompanySearch/issues