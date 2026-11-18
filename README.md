# Football Manager (FM)

Een Nederlandstalige voetbalmanager-prototype met React, TypeScript en Vite. De app bevat een democompetitie met 30 clubs, drie reeksen, clubbeheer en een korte wedstrijdsimulator.

## Starten op je computer

1. Installeer Node.js (LTS): https://nodejs.org/
2. Download/clone deze repository.
3. Open een terminal in de map en voer uit:

```bash
npm install
npm run dev
```

4. Open de lokale URL die Vite in de terminal toont.

Zonder Firebase-instellingen werkt de app in demomodus en wordt je save lokaal in de browser bewaard.

## Firebase instellen (optioneel voor deze prototypeversie)

1. Maak een project aan via https://console.firebase.google.com/
2. Activeer Authentication → Sign-in method → Email/Password.
3. Maak een Cloud Firestore-database aan.
4. Kopieer de web-app configuratie naar een nieuw bestand `.env` op basis van `.env.example`.
5. Publiceer de inhoud van `firestore.rules` bij Firestore → Rules.
6. Herstart `npm run dev`.

Wanneer Firebase is geconfigureerd, kun je registreren/inloggen en wordt je persoonlijke save bewaard in `users/{uid}/saves/main`.

## Inbegrepen in versie 0.1

- Dashboard met clubkas, clubrating en volgende wedstrijd.
- Eerste Klasse, Tweede Klasse A en Tweede Klasse B, elk met tien clubs.
- Klassementen met punten, gespeelde wedstrijden en doelsaldo.
- Spelerskern met basis/reserve-selectie en spelersdetails.
- Tactiekkeuze en formaties.
- Training met fitheid, moraal en rating.
- Transfermarkt met fictieve spelers en aankopen/verkopen.
- Clubfinanciën en stadionuitbreiding.
- Wedstrijdsimulator: 90 wedstrijdminuten in vijf echte minuten zolang de pagina open blijft.
- Seizoensafsluiting: kampioenen van Tweede Klasse A en B promoveren; de nummers twee spelen een willekeurige prototype-play-off.
- Botregel: bij minder dan vier bots in Eerste Klasse degraderen alle bots en vullen de zwakst geklasseerde mensen de drie plaatsen aan; bij vier of meer bots degraderen de drie laagst geklasseerde bots. Bots kunnen ook promoveren.

## Wat nog niet af is

Dit is een speelbare **single-manager prototype**, geen afgewerkte online multiplayergame. Elke manager heeft momenteel een eigen save; verschillende accounts delen nog niet dezelfde competitie. Wedstrijden tussen andere clubs, een volledig speelschema, servergestuurde simulatie, dagelijkse automatische speeldagen, veilige server-side transfers en een echte multiplayerpromotie/degradatie moeten nog worden gebouwd. De huidige wedstrijdsimulator draait in de browser en stopt wanneer je de pagina sluit.

Voor een publieke multiplayergame moeten belangrijke spelregels server-side worden afgedwongen met bijvoorbeeld Firebase Cloud Functions en geplande taken. Deel nooit Firebase-beheerderssleutels of wachtwoorden in de repository.
