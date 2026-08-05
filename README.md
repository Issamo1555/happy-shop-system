# POS & RDV System (Mums'Home / Super-Admin)

Ce dépôt contient le code source de la plateforme de gestion de points de vente (POS) et de prise de rendez-vous (RDV), conçue pour gérer plusieurs centres (Tenants).

## 🚀 Méthode de Travail et Déploiement (GitFlow)

Pour garantir la sécurité et la stabilité de l'application en production, nous utilisons le flux de travail suivant :

### 1. Développement Local (Localhost)
Toutes les modifications de code, l'ajout de nouvelles fonctionnalités, et les corrections de bugs doivent être développées et testées en **local** d'abord.
- La base de données locale (`pos.db` - SQLite) est utilisée pour les tests.
- **Les données (comptes, prospects, etc.) ne sont JAMAIS versionnées sur Git.** Le fichier `.gitignore` s'assure que la base de données reste confidentielle et locale.

### 2. Versioning via Git (GitHub)
Une fois qu'une fonctionnalité est validée en local :
- On ajoute les fichiers modifiés (`git add .`)
- On valide les changements (`git commit -m "feat: description de l'ajout"`)
- On envoie le code sur GitHub (`git push origin <nom-de-la-branche>`)

GitHub sert uniquement d'historique et de coffre-fort pour le **Code Source**.

### 3. Mise en Production (Cloud)
Une fois le code validé et présent sur GitHub, on se connecte au serveur Cloud de production (ex: `62.72.19.56`).
- On exécute le script de déploiement (ex: `deploy-superadmin.sh`).
- Le serveur télécharge la dernière version du code depuis GitHub.
- Il recompile l'application et redémarre les conteneurs Docker (base de données `posrdv-db-superadmin` et app `posrdv-superadmin`).

### 💡 Pourquoi cette méthode ?
- **Cohérence** : Le code qui tourne en production est exactement celui stocké sur GitHub.
- **Sécurité** : Si une modification casse l'application, il est très facile de revenir à la version précédente (rollback) via Git.
- **Séparation des données** : Les données clients (Cloud) et de tests (Local) restent isolées du code.
