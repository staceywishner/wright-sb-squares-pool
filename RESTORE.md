# Wright SB Squares Pool: how to restore

## Where everything lives
- Code: GitHub, staceywishner/wright-sb-squares-pool (this folder is a copy of it)
- Live site + database: Firebase project `wright-sb-squares-pool`
  (console.firebase.google.com, Google account stacey.wishner@gmail.com)
- Guest link: https://wright-sb-squares-pool.web.app
- Organizer link: https://wright-sb-squares-pool.web.app/organizer
  (organizers: david.wright333@gmail.com, stacey.wishner@gmail.com)

## If GitHub was lost
1. Create a new GitHub repository and upload everything in this folder.
2. In the new repository: Settings > Secrets and variables > Actions >
   New repository secret named FIREBASE_SERVICE_ACCOUNT. Paste in a new key from
   Firebase > Project settings > Service accounts > Generate new private key.
3. Any change saved to the main branch publishes the site automatically.

## If the Firebase project was lost
1. Create a new Firebase project; turn on Firestore, Hosting, and sign-in
   (Anonymous + Google).
2. Register a web app and put its settings in public/firebase-config.js.
3. Paste firestore.rules into Firestore > Rules and click Publish.
4. Update the project ID in .firebaserc and .github/workflows/deploy.yml.
5. Give the deploy key's service account these roles in Google Cloud IAM:
   Firebase Admin and Service Usage Consumer.

## To have Claude rebuild or change things
Upload this ZIP to a new Claude conversation and say:
"This is my Super Bowl squares pool app. Read PLAN.md and RESTORE.md, then help me ___."
