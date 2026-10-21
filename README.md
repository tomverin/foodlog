# Foodlog & Nutrition — Tom

Dashboard nutritionnel quotidien mobile-first et passerelle d'enregistrement direct via Firebase Realtime Database.

## Fonctionnalités

- **Dashboard du Jour** : Jauge de calories restantes, répartition des macros (Protéines, Glucides, Lipides), ratio en g/kg de poids de corps.
- **Timeline des repas** : Liste chronologique (Petit-déjeuner, Déjeuner, Collation, Dîner) avec détails, badges et bouton suppression.
- **Suppression dans les navigateurs intégrés** : La poubelle affiche « Annuler » et « Supprimer » dans la carte, sans boîte native `confirm()` ou `alert()`. L'entrée reste présente tant que Firebase n'a pas confirmé la suppression ; en cas d'échec, un message visible permet de réessayer. La date de l'entrée est conservée même si l'on change de jour pendant la requête.
- **Passerelle de publication 1-clic** : Toute URL contenant des paramètres de repas enregistre automatiquement l'entrée dans Firebase :
  ```
  https://tomverin.github.io/foodlog/?meal=lunch&cal=875&p=80&c=105&f=14&text=Poulet%20Riz%20Brocolis
  ```
- **Export Markdown** : Copie en 1 clic au format exact de `foodlog.md` pour synchronisation locale.
- **Configuration** : Bouton ⚙️ pour personnaliser l'URL Firebase RTDB et la clé de salle secrète.
- **Résilience iOS / Safari** : Sauvegarde automatique du payload dans `localStorage` (`tom_foodlog_pending_payload`) et conservation de l'URL query string en cas d'ouverture dans une WebView intégrée pour permettre le transfert propre vers Safari via `[↗]`.

## Vérification de la suppression

Avec Playwright disponible dans l'environnement Node, lancer `node --test tests/delete-entry.cjs`.
Le test utilise Chromium ; `PLAYWRIGHT_CHANNEL=chrome` permet d'utiliser Chrome installé.
Toutes les requêtes sont interceptées et les données sont fictives : aucune connexion à Firebase réel.
Les scénarios couvrent l'annulation, la confirmation, le double appui, les erreurs réseau/HTTP,
la reprise après erreur et le changement de jour pendant une requête.
