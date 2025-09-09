# CompanySearch - Extraction données entreprises intérim

## Description

Ce projet Node.js extrait les entreprises d'intérim (NAF 78.20Z) et leurs dirigeants selon différents critères géographiques et temporels.

**Trois approches disponibles :**
1. **IDF Flexible** : Focus Île-de-France avec filtrage par date paramétrable
2. **National Optimisé** : France entière avec recherche gratuite puis enrichissement
3. **Pappers Direct** : Utilise uniquement l'API Pappers (plus simple mais plus coûteux)

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

### 🎯 Méthode IDF avec Date Flexible (NOUVEAU)

#### Estimation préalable (RECOMMANDÉ)
```bash
# Estimer le volume et le coût avant extraction
npm run estimate
# -> Affiche le nombre d'entreprises et le coût estimé

# Récupérer et compter tous les SIREN
npm run estimate:full
# -> Affiche le compte exact et peut sauvegarder avec --save
```

#### Extraction complète
```bash
# 1) Récupérer tous les SIREN d'intérim en IDF (gratuit)
npm run fetch:idf
# -> input/sirens.csv

# 2) Filtrer par date de naissance (consomme 1 crédit/entreprise)
npm run filter -- --date=1962-12-31

# Formats de date acceptés :
# --date=1962-12-31    (ISO)
# --date=31-12-1962    (FR)
# --date=31/12/1962    (FR avec /)
# --date=1962          (année seule)
# --date=12/1962       (mois/année)

# Ou tout-en-un avec date par défaut (1962-12-31) :
npm run build
```

**Options avancées :**
```bash
# Spécifier les fichiers d'entrée/sortie
npm run filter -- --date=1965-06-30 --in=custom/list.csv --out=results/seniors.csv
```

### 📍 Méthode National France Entière

```bash
# Approche optimisée (recherche gratuite + enrichissement)
npm run build:cheap
# -> input/sirens.csv puis output/interim_dirigeants_<=1962.csv

# Ou en deux étapes :
npm run fetch:free  # API gouvernementale (gratuit)
npm run enrich      # Enrichissement Pappers
```

### 💰 Méthode Pappers Direct

```bash
# Tout via Pappers (plus coûteux mais plus précis)
npm run build:pappers
# -> output/interim_dirigeants_<=1961.csv
```

## Automatisation avec GitHub Actions

### Configuration des Secrets

1. Dans votre repo GitHub : **Settings → Secrets and variables → Actions**
2. Créer un secret `PAPPERS_API_KEY` avec votre clé API

### Workflows Disponibles

#### 1. **IDF avec Date Flexible** (`run-idf.yml`)
- **Automatique** : tous les vendredis à 5h00 UTC (date par défaut : 1962-12-31)
- **Manuel** : Actions → "Build CSV IDF flexible date" → Run workflow
  - Paramètre `date` : permet de spécifier une date personnalisée
- **Exemple** : Lancer avec date=1965-12-31 pour avoir les dirigeants nés avant 1966

#### 2. **National Optimisé** (`run-optimized.yml`)
- **Automatique** : tous les mercredis à 5h00 UTC
- **Manuel** : Actions → "Build CSV optimized (free search)" → Run workflow
- Utilise l'API gouvernementale gratuite puis Pappers

#### 3. **Pappers Direct** (`run.yml`)
- **Automatique** : tous les lundis à 5h00 UTC
- **Manuel** : Actions → "Build CSV intérim <=1961" → Run workflow
- Utilise uniquement l'API Pappers

## Structure du CSV

Les fichiers CSV générés contiennent :
- `siren` : Numéro SIREN de l'entreprise
- `denomination` : Nom de l'entreprise
- `code_naf` : Code NAF (78.20Z pour l'intérim)
- `libelle_code_naf` : Libellé du code NAF
- `entreprise_cessee` : Statut de l'entreprise (oui/non)
- `dir_nom` : Nom du dirigeant
- `dir_prenom` : Prénom du dirigeant
- `dir_qualite` : Fonction du dirigeant
- `dir_date_naissance` : Date de naissance
- `comparaison` : (IDF uniquement) Précision sur la comparaison de date

Séparateur : `;` (compatible Excel français)

## Structure des Fichiers

```
CompanySearch/
├── scripts/
│   ├── fetch_idf_interim.js         # Récupération IDF (gratuit)
│   ├── filter_dirigeants_by_dob.js  # Filtrage flexible par date
│   ├── estimate_idf.js              # Estimation volume et coûts IDF
│   ├── fetch_sirens_gouv.js         # Récupération nationale (gratuit)
│   ├── enrich_from_list.js          # Enrichissement Pappers
│   └── build_pappers.js             # Script Pappers direct
├── input/                            # SIREN récupérés (étape 1)
├── output/                           # CSV finaux
├── .github/workflows/
│   ├── run-idf.yml                  # Workflow IDF flexible
│   ├── run-optimized.yml            # Workflow national optimisé
│   └── run.yml                      # Workflow Pappers direct
└── package.json                     # Scripts npm et dépendances
```

## Comparaison des Méthodes

| Méthode | Zone | Filtrage Date | Coût | Avantages |
|---------|------|---------------|------|-----------|
| **IDF Flexible** | Île-de-France | ✅ Paramétrable | 1 crédit/fiche | • Focus régional<br>• Date flexible<br>• Économique |
| **National Optimisé** | France entière | Fixe (1962) | 1 crédit/fiche | • Couverture nationale<br>• Économique |
| **Pappers Direct** | France entière | Fixe (1961) | ~0.1 crédit/résultat + 1 crédit/fiche | • Plus précis<br>• Un seul appel API |

## Exemples d'Usage

### Cas 1 : Dirigeants seniors en IDF avec estimation préalable
```bash
# Estimer d'abord le coût
npm run estimate

# Si acceptable, lancer l'extraction
npm run fetch:idf
npm run filter -- --date=1959-12-31
```

### Cas 2 : Analyse par décennie
```bash
# Années 50
npm run filter -- --date=1959-12-31 --out=output/annees_50.csv

# Années 60
npm run filter -- --date=1969-12-31 --out=output/annees_60.csv
```

### Cas 3 : Export mensuel automatisé
Utiliser le workflow GitHub Actions avec une date personnalisée chaque mois.

## Scripts Disponibles

| Script | Description | Coût |
|--------|-------------|------|
| `npm run estimate` | Estime le volume IDF | Gratuit |
| `npm run estimate:full` | Compte exact + option sauvegarde | Gratuit |
| `npm run fetch:idf` | Récupère SIREN IDF | Gratuit |
| `npm run filter` | Filtre par date de naissance | 1 crédit/entreprise |
| `npm run build` | IDF complet (date par défaut) | 1 crédit/entreprise |
| `npm run build:1961` | IDF dirigeants ≤1961 | 1 crédit/entreprise |
| `npm run build:custom` | IDF avec date manuelle | 1 crédit/entreprise |
| `npm run build:cheap` | National optimisé | 1 crédit/entreprise |
| `npm run build:pappers` | Pappers direct | Variable |

## Notes Techniques

### Limites API
- **API gouvernementale** : 7 requêtes/seconde, pagination à 25 résultats
- **API Pappers** : Throttling intégré (120ms entre requêtes)

### Gestion des Dates
- Comparaison flexible : dates complètes, partielles (année/mois) ou année seule
- Format français et ISO acceptés
- Gestion prudente des dates partielles (assume 1er janvier/mois)

### Région Île-de-France
Code région `11` couvre les départements : 75, 77, 78, 91, 92, 93, 94, 95

## Support

- API Pappers : https://www.pappers.fr/api/documentation
- API Recherche d'entreprises : https://api.gouv.fr/les-api/api-recherche-entreprises
- Issues : https://github.com/Bencode92/CompanySearch/issues