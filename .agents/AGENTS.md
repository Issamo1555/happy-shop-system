# Règles de développement pour POSetRDV

## 🚨 Règle d'or : Test Local Obligatoire
Avant de pousser du code sur Git (`git push`) ou d'effectuer un déploiement sur le serveur de production, vous devez impérativement :
1. Lancer le serveur local de développement (`npm run dev`).
2. Ouvrir le navigateur et tester manuellement toutes les fonctionnalités créées ou modifiées.
3. Vérifier les erreurs de console (F12) pour s'assurer qu'aucun crash SSR ou React ne se produit.
4. Effectuer un build de test en local (`npm run build`) pour valider la compilation.
