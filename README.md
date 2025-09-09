# CompanySearch - Extraction données entreprises intérim

## Description

Ce projet Node.js extrait les entreprises d'intérim (NAF 78.20Z) ayant au moins un dirigeant né avant 1963, et génère un fichier CSV avec les informations détaillées.

**Deux méthodes disponibles :**
- **Standard** : Utilise uniquement l'API Pappers (plus simple, mais consomme plus de crédits)
- **Optimisée** : Utilise l'API gouvernementale gratuite pour la recherche, puis Pappers uniquement pour l'enrichissement (économise des crédits)

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

### Utilisation

#### Méthode Standard (Pappers uniquement)
```bash
npm run build
# Génère : output/interim_dirigeants_<=1961.csv
# Coût : ~0.1 crédit par résultat de recherche + 1 crédit par fiche
```

#### Méthode Optimisée (API gouv + Pappers)
```bash
npm run build:cheap
# Ou séparément :
npm run fetch:free  # Récupère les SIREN via l'API gouvernementale (gratuit)
npm run enrich      # Enrichit via Pappers
# Génère : input/sirens.csv puis output/interim_dirigeants_<=1962.csv  
# Coût : 1 crédit Pappers par fiche uniquement
```

## Automatisation avec GitHub Actions

### Configuration

1. Dans votre repo GitHub, aller dans **Settings → Secrets and variables → Actions**
2. Cliquer sur **New repository secret**
3. Créer un secret nommé `PAPPERS_API_KEY` avec votre clé API comme valeur

### Workflows disponibles

#### 1. Build CSV intérim <=1961 (Standard)
- **Automatique** : tous les lundis à 5h00 UTC
- **Manuel** : Actions → Build CSV intérim <=1961 → Run workflow
- Utilise la méthode standard (Pappers uniquement)

#### 2. Build CSV optimized (Économique)
- **Automatique** : tous les mercredis à 5h00 UTC
- **Manuel** : Actions → Build CSV optimized (free search) → Run workflow
- Utilise la méthode optimisée (API gouv + Pappers)

Les CSV sont automatiquement commités dans le dossier `output/`.

## Structure du CSV

Le fichier CSV généré contient les colonnes suivantes :
- `siren` : Numéro SIREN de l'entreprise
- `denomination` : Nom de l'entreprise
- `code_naf` : Code NAF (78.20Z pour l'intérim)
- `libelle_code_naf` : Libellé du code NAF
- `entreprise_cessee` : Statut de l'entreprise (oui/non)
- `dir_nom` : Nom du dirigeant
- `dir_prenom` : Prénom du dirigeant
- `dir_qualite` : Fonction du dirigeant
- `dir_date_naissance` : Date de naissance
- `dir_age_estime` : Âge estimé

Le fichier utilise le séparateur `;` pour une meilleure compatibilité avec Excel en français.

## Structure des fichiers

```
CompanySearch/
├── scripts/
│   ├── build_pappers.js       # Script standard (Pappers uniquement)
│   ├── fetch_sirens_gouv.js   # Récupération gratuite des SIREN
│   └── enrich_from_list.js    # Enrichissement via Pappers
├── input/                      # Liste des SIREN (méthode optimisée)
├── output/                     # CSV générés
├── .github/workflows/
│   ├── run.yml                 # Workflow standard
│   └── run-optimized.yml       # Workflow optimisé
└── package.json               # Scripts npm et dépendances
```

## Comparaison des méthodes

| Méthode | Avantages | Inconvénients | Coût estimé |
|---------|-----------|---------------|-------------|
| **Standard** | • Simple<br>• Un seul script<br>• Filtrage précis Pappers | • Plus coûteux en crédits | ~0.1 crédit/résultat + 1 crédit/fiche |
| **Optimisée** | • Économique<br>• Recherche gratuite | • 2 étapes<br>• Peut inclure des faux positifs | 1 crédit/fiche uniquement |

## Notes techniques

- **API gouvernementale** : Limite de 7 requêtes/seconde, pagination à 25 résultats
- **API Pappers** : Throttling intégré pour respecter les limites
- **Gestion d'erreurs** : Le script continue même si certaines fiches sont inaccessibles
- **Filtrage** : Dirigeants nés avant 1963 (≤ 1962)

## Personnalisation

### Script standard (`build_pappers.js`)
- `NAF` : Code NAF (défaut: 78.20Z)
- `DATE_MAX_DIR` : Date de naissance max (défaut: 31-12-1961)
- `PAR_CURSEUR` : Taille de page (défaut: 500)

### Scripts optimisés
- `fetch_sirens_gouv.js` :
  - `NAF` : Code NAF (défaut: 78.20Z)
  - `DATE_MAX` : Date max (défaut: 1962-12-31)
- `enrich_from_list.js` :
  - `YEAR_MAX` : Année max (défaut: 1962)

## Support

- API Pappers : https://www.pappers.fr/api/documentation
- API Recherche d'entreprises : https://api.gouv.fr/les-api/api-recherche-entreprises