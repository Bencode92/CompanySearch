# 💰 Comparaison : Version ÉCONOMIQUE vs Classique

## 📊 Tableau comparatif

| Critère | Version ÉCONOMIQUE ✨ | Version Classique |
|---------|----------------------|-------------------|
| **Endpoint API** | `/recherche-dirigeants` | `/entreprise` |
| **Coût par appel** | 0,1 crédit/dirigeant trouvé | 1-2 crédits/entreprise |
| **Coût pour 1300 SIREN** | ~13-26 crédits* | ~1300-2600 crédits |
| **Économie réalisée** | **90-95%** 🎉 | 0% |
| **Nom société** | ✅ Gratuit (API gouv) | ✅ Inclus |
| **SIRET siège** | ✅ Gratuit (API gouv) | ✅ Inclus |
| **CA/Résultat** | ❌ Non inclus | ✅ Inclus |
| **Dirigeants** | ✅ Filtré par âge | ✅ Tous |
| **Vitesse** | ⚡ Rapide | 🐌 Plus lent |

*Estimation : ~10-20% des entreprises ont un dirigeant senior

## 🚀 Utilisation

### Version ÉCONOMIQUE (Recommandée)

```bash
# Méthode la plus économique - 0,1 crédit par résultat
npm run enrich:seniors:eco

# Ou avec paramètres personnalisés
node scripts/enrich_seniors_eco.js \
  --cutoff-year=1960 \
  --in=output/sirens_interim_75_92.csv \
  --out=output/dirigeants_60ans_plus.csv
```

### Version Classique (Si CA/Résultat nécessaires)

```bash
# Plus cher mais inclut CA et résultat
npm run enrich:seniors:simple

# Filtrage par CA en plus
node scripts/enrich_pappers_advanced.js \
  --date=1962-12-31 \
  --ca_min=1000000
```

## 💡 Cas d'usage

### Utilisez la version ÉCONOMIQUE si :
- ✅ Vous voulez identifier les dirigeants seniors
- ✅ Le nom de la société suffit (pas besoin du CA)
- ✅ Vous voulez minimiser les coûts
- ✅ Vous avez beaucoup d'entreprises à traiter

### Utilisez la version Classique si :
- ⚠️ Vous avez besoin du CA et du résultat
- ⚠️ Vous voulez filtrer par performance financière
- ⚠️ Vous avez peu d'entreprises (<100)
- ⚠️ Le budget n'est pas une contrainte

## 📈 Exemple concret

Pour **1300 entreprises d'intérim** (Paris + 92) :

### Version ÉCONOMIQUE
- Entreprises avec dirigeants seniors : ~200 (estimation)
- Crédits consommés : 200 × 0,1 = **20 crédits**
- Coût : ~0,40€
- Données : Nom société, SIREN, SIRET, dirigeants, âge, ville

### Version Classique
- Crédits consommés : 1300 × 1 = **1300 crédits**
- Coût : ~26€
- Données : Tout + CA + Résultat

**Économie : 1280 crédits (~25,60€) soit 98% moins cher !**

## 🎯 Workflow recommandé

1. **Étape 1** : Identifier les dirigeants seniors (ECO)
   ```bash
   npm run enrich:seniors:eco
   ```
   → Obtenir la liste des entreprises avec dirigeants seniors

2. **Étape 2** : Enrichir UNIQUEMENT ces entreprises (si nécessaire)
   ```bash
   # Créer un CSV avec seulement les SIREN pertinents
   # Puis enrichir avec CA/Résultat sur ce sous-ensemble
   ```

## 🔄 GitHub Actions

### Workflow ÉCONOMIQUE
- **Nom** : "Enrich Senior Directors ECO"
- **Déclenchement** : Manuel ou lundi 6h
- **Durée** : ~5-10 minutes pour 1300 SIREN
- **Coût** : ~0,40€

### Workflow Classique
- **Nom** : "Enrich Senior Directors Simple"
- **Déclenchement** : Manuel ou lundi 6h
- **Durée** : ~30-45 minutes pour 1300 SIREN
- **Coût** : ~26€

## 📝 Format de sortie

### Version ÉCONOMIQUE
```csv
Société;SIREN;SIRET_siège;Nom;Prénom;Fonction;Date_naissance;Année;Âge;Ville_siège
INTERIM PLUS;123456789;12345678900014;DUPONT;Jean;Président;15/03/1960;1960;64;PARIS
```

### Version Classique
```csv
Société;SIREN;Chiffre d'affaires;Résultat;Nom dirigeant;Prénom dirigeant;Fonction;Année naissance;Âge actuel;Ville siège;Code NAF;Effectif
INTERIM PLUS;123456789;5 234 000;234 000;DUPONT;Jean;Président;1960;64;PARIS;78.20Z;10 à 19
```

## ⚡ Conseils d'optimisation

1. **Toujours commencer par la version ECO** pour identifier les cibles
2. **Enrichir avec CA/Résultat** uniquement sur les entreprises pertinentes
3. **Utiliser le filtre par année** pour ajuster l'âge cible
4. **Tester sur 100 SIREN** avant de lancer sur tout le fichier

## 🆘 Résolution de problèmes

### "Rate limit atteint"
- La version ECO gère automatiquement les pauses
- Attendez 5 secondes et relancez

### "Aucun dirigeant trouvé"
- Vérifiez que les entreprises ont des dirigeants personnes physiques
- Essayez avec une année cutoff plus récente (ex: 1965)

### "Clé API invalide"
- Vérifiez votre crédit Pappers
- Vérifiez la clé dans `.env` ou les secrets GitHub

---

**💡 Recommandation finale** : Utilisez TOUJOURS la version ÉCONOMIQUE en premier pour identifier vos cibles, puis enrichissez avec les données financières uniquement si nécessaire sur ce sous-ensemble. Économie garantie de 90%+ ! 🎉