# FM — Football Manager

Een eenvoudige online voetbalmanager in vanilla HTML, CSS en JavaScript met Firebase Authentication, Cloud Firestore en Cloud Functions.

## Competitie
- 3 reeksen met elk 10 clubs: Eerste Klasse, Tweede Klasse A en Tweede Klasse B.
- Vrije plaatsen worden door fictieve computerclubs bezet.
- Nieuwe managers maken een account aan, kiezen een clubnaam en embleem en starten in Tweede Klasse.
- 18 speeldagen per seizoen. Alle 15 wedstrijden van een speeldag starten samen en lopen vijf minuten.
- De server werkt wedstrijden elke minuut bij. Scores en standen worden gedeeld via Firestore.
- De laatste drie van Eerste Klasse degraderen. De kampioenen van A en B promoveren; de nummers twee spelen een beslissende promotiewedstrijd.

## Firebase instellen
1. Maak in Firebase Authentication de provider **E-mail/wachtwoord** actief.
2. Maak een Cloud Firestore-database aan.
3. Installeer Firebase CLI: `npm install -g firebase-tools` en meld aan met `firebase login`.
4. Koppel dit project: `firebase use --add` en selecteer project `football-manager-fm`.
5. Installeer backend dependencies: `cd functions && npm install && cd ..`.
6. Deploy regels, functies en hosting: `firebase deploy`.
7. Open de Hosting-URL en registreer een account.

Cloud Functions en geplande functies vereisen doorgaans het Blaze-abonnement (facturatie ingeschakeld). De Firebase webconfiguratie in firebase-config.js is bedoeld voor de browser; beveiliging gebeurt met Authentication, Firestore Rules en serverfuncties.

## Let op
Dit is de eerste online speelbare basisversie. Wedstrijden lopen vijf servergestuurde minuten; de app toont live updates. De promotie/degradatie is server-side verwerkt. De volgende uitbreidingen kunnen spelersmarkt, trainingsschema, opstelling/tactiek en een echte clublogo-editor zijn.
