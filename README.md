# CompanySearch - Extraction données entreprises intérim

## Description

Ce projet Node.js interroge l'API Pappers pour extraire les entreprises d'intérim (NAF 78.20Z) ayant au moins un dirigeant né avant 1962, et génère un fichier CSV avec les informations détaillées.

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

4. Lancer l'extraction :
```bash
npm run build
```

Le fichier CSV sera généré dans `output/interim_dirigeants_<=1961.csv`

## Automatisation avec GitHub Actions

### Configuration

1. Dans votre repo GitHub, aller dans **Settings → Secrets and variables → Actions**
2. Cliquer sur **New repository secret**
3. Créer un secret nommé `PAPPERS_API_KEY` avec votre clé API comme valeur

### Utilisation

Le workflow s'exécute :
- **Automatiquement** : tous les lundis à 5h00 UTC
- **Manuellement** : via l'onglet Actions → Build CSV intérim <=1961 → Run workflow

Le CSV mis à jour est automatiquement commité dans le dossier `output/`.

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

## Notes techniques

- **Filtrage optimisé** : Le script utilise les filtres natifs de l'API Pappers pour limiter le volume de données
- **Throttling** : Des pauses sont intégrées pour respecter les limites de l'API
- **Gestion d'erreurs** : Le script continue même si certaines fiches entreprises sont inaccessibles
- **Pagination par curseur** : Permet de récupérer l'ensemble des résultats sans limite

## Personnalisation

Vous pouvez modifier les paramètres dans `scripts/build_pappers.js` :
- `NAF` : Code NAF à rechercher (défaut: 78.20Z)
- `DATE_MAX_DIR` : Date de naissance maximale (défaut: 31-12-1961)
- `PAR_CURSEUR` : Nombre de résultats par page (défaut: 500, max: 1000)

## Support

Pour toute question sur l'API Pappers, consulter la documentation : https://www.pappers.fr/api/documentation