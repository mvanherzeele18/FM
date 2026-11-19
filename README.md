# FM — Football Manager (Firebase-only prototype)

Deze versie gebruikt uitsluitend Firebase-diensten aan de applicatiekant:
- Firebase Authentication: accounts met e-mail en wachtwoord.
- Cloud Firestore: profielen, clubs, competities, uitslagen en wedstrijden.
- Firebase Hosting: publicatie van de statische website vanuit GitHub.

Er is geen Cloud Functions-backend en geen Node.js-runtime nodig voor de gamecode. De browser van een ingelogde speler voert de wedstrijdsimulatie uit zolang de website open staat. Daardoor is dit een prototype: een speler kan gedeelde gegevens manipuleren via de browser en wedstrijden pauzeren als niemand online is. Gebruik dit niet als veilige publieke competitie met prijzen of waardevolle accounts.

## Firebase Console instellen
1. Open project `football-manager-fm`.
2. Authentication → Sign-in method → activeer Email/Password.
3. Firestore Database → maak een database aan.
4. Firestore Rules → publiceer de inhoud van `firestore.rules`.
5. Hosting → Get started / Set up Firebase Hosting.
6. Koppel de GitHub-repository `mvanherzeele18/FM` aan de standaardbranch en publiceer de mapinhoud als statische site. Er is geen buildstap nodig; de publicatiemap is de repository-root.

De configuratie staat in `firebase-config.js`. De competitie wordt bij het eerste gebruik aangemaakt in `world/main`.

## Gameplay
- 3 reeksen van 10 clubs, met fictieve computerclubs.
- 18 speeldagen; 5 wedstrijden per reeks op elke speeldag.
- Clubs starten in Tweede Klasse A/B.
- De laatste drie van Eerste Klasse degraderen.
- De kampioenen van Tweede Klasse A/B promoveren; de nummers twee spelen een promotie-play-off.
- Wedstrijden worden ongeveer elke 15 seconden bijgewerkt zolang minstens één manager de site open heeft.

## Belangrijke beperking
De Firestore-regels laten ingelogde spelers gedeelde competitiegegevens schrijven zodat de client-only versie kan functioneren. Dit is niet fraudebestendig. Voor automatische, betrouwbare simulatie op de server is een serverfunctie of andere vertrouwde backend onvermijdelijk.
