# Guide Rapide - Enrichissement Dirigeants Seniors

## ✅ Ce que fait le script

Le script `enrich_seniors_simple.js` :
1. Lit le fichier `output/sirens_interim_75_92.csv`
2. Pour chaque SIREN, récupère via l'API Pappers :
   - Les informations de l'entreprise (nom, CA, résultat)
   - Les informations des dirigeants
3. **FILTRE AUTOMATIQUE** : Garde UNIQUEMENT les dirigeants nés avant 1962
4. Exporte tout dans `output/dirigeants_seniors_enrichis.csv`

## 🚀 Lancement

### Option 1 : En local
```bash
# S'assurer d'avoir le fichier SIREN
npm run fetch  # Si pas déjà fait

# Lancer l'enrichissement
npm run enrich:seniors:simple
```

### Option 2 : Via GitHub Actions
1. Aller dans l'onglet **Actions**
2. Cliquer sur **"Enrich Senior Directors Simple"**
3. Cliquer sur **"Run workflow"**
4. Télécharger le CSV dans les artifacts

## 📊 Résultat

Le fichier `dirigeants_seniors_enrichis.csv` contient :

| Colonne | Description | Exemple |
|---------|-------------|---------|
| Société | Nom de l'entreprise | INTERIM PLUS |
| SIREN | Numéro SIREN | 123456789 |
| Chiffre d'affaires | CA en euros | 5 234 000 |
| Résultat | Bénéfice/Perte | 234 000 |
| Nom dirigeant | Nom de famille | DUPONT |
| Prénom dirigeant | Prénom | Jean |
| Fonction | Rôle dans l'entreprise | Président |
| Année naissance | Année de naissance | 1960 |
| Âge actuel | Âge calculé | 64 |
| Ville siège | Localisation | PARIS |
| Code NAF | Secteur d'activité | 78.20Z |
| Effectif | Nombre d'employés | 10 à 19 |

## 🎯 Exploitation des données

1. **Ouvrir dans Excel**
2. **Trier par** :
   - Chiffre d'affaires (décroissant) → Les plus grosses entreprises
   - Âge (décroissant) → Les dirigeants les plus âgés
   - Résultat → Les entreprises rentables
3. **Filtrer par** :
   - Ville → Cibler une zone géographique
   - Effectif → Taille d'entreprise souhaitée

## ⚠️ Important

- **Filtre d'âge** : Le script garde UNIQUEMENT les dirigeants nés AVANT 1962 (62 ans et plus)
- **Coût** : ~0.02€ par entreprise via l'API Pappers
- **Durée** : ~120ms par entreprise (environ 8 entreprises/seconde)
- **RGPD** : Respecter la réglementation sur l'utilisation des données personnelles

## 💡 Astuces

### Pour tester sur un échantillon
Créez un fichier test avec seulement 10 SIREN :
```bash
head -n 11 output/sirens_interim_75_92.csv > output/test_10.csv
```

### Pour suivre la progression
Le script affiche la progression toutes les 10 entreprises :
```
→ 50/500 (10%) - 12 dirigeants seniors trouvés
```

### En cas d'erreur API
- Vérifier la clé API dans `.env`
- Vérifier le crédit restant sur Pappers
- Le script continue même si une entreprise n'est pas trouvée

## 📞 Contact

Problème ? Question ? → [Ouvrir une issue](https://github.com/Bencode92/CompanySearch/issues)