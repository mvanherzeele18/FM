# Football Manager (FM) — Volledige Versie 1.0

Een Nederlandstalige voetbalmanager-webapplicatie met React, TypeScript, Vite en Firebase Cloud Firestore (inclusief gedeelde online multiplayerwereld en lokale demomodus).

## Snel starten op je computer

1. Installeer Node.js (LTS): https://nodejs.org/
2. Pak de map uit en open een terminal in deze map:

```bash
npm install
npm run dev
```

3. Open de lokale URL die Vite toont. Zonder `.env` speel je direct in de volledige lokale carrièremodus.

## Firebase instellen voor Online Multiplayer

1. Maak een project aan via https://console.firebase.google.com/
2. Activeer **Authentication → Sign-in method → Email/Password**.
3. Maak een **Cloud Firestore-database** aan.
4. Kopieer `.env.example` naar `.env` en vul je 6 `VITE_FIREBASE_*` sleutels in.
5. Publiceer `firestore.rules` bij **Firestore → Rules** (of via `firebase deploy --only firestore:rules`).
6. Herstart `npm run dev` (of voeg de secrets toe in GitHub Actions voor GitHub Pages).

## Wat er in deze volledige versie is opgelost en gebouwd

- **Volledig speelschema (18 speeldagen per seizoen)**: Heen- en terugronde voor alle 30 clubs verdeeld over *Eerste Klasse*, *Tweede Klasse A* en *Tweede Klasse B*. Alle 15 wedstrijden per speeldag worden gesimuleerd en verwerkt in het klassement en topschuttersklassement.
- **Online Multiplayer via Firestore**: Accounts delen dezelfde competitiewereld (`worlds/belgium-pro-league-1`). Bij registratie kies je een beschikbare botclub en neem je die over. Alle acties en speeldagen verlopen via veilige Firestore-transacties (`firestore.rules` inbegrepen).
- **Realistische wedstrijdengine**: Houdt rekening met basiself, positie-overeenkomst met gekozen formatie (`4-3-3`, `4-4-2`, `3-5-2`, `5-3-2`), speelstijl, fitheid, moraal, doelpuntenmakers, assists, gele kaarten en live snelheidsregeling (`1x`, `5x`, `30x`).
- **Volledige economie, jeugd & seizoenscyclus**: Ticketinkomsten op basis van stadioncapaciteit en ticketprijs, sponsorinkomsten, spelerslonen, stadionuitbreidingen, jaarlijkse veroudering/groei van spelers, jeugddoorstroom en de exacte promotie/degradatie- en botregels.
