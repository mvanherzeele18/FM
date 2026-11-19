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
- Speeldagen starten automatisch om 18:00 uur Belgische tijd (Europe/Brussels), zodra minstens één manager de site open heeft.
- Elke wedstrijd duurt 90 wedstrijdminuten, versneld tot ongeveer 5 echte minuten.
- De browser werkt de wedstrijdsimulatie bij; zonder geopende site kan de aftrap niet exact op de klok automatisch plaatsvinden.

## Belangrijke beperking
De Firestore-regels laten ingelogde spelers gedeelde competitiegegevens schrijven zodat de client-only versie kan functioneren. Dit is niet fraudebestendig. Voor automatische, betrouwbare simulatie op de server is een serverfunctie of andere vertrouwde backend onvermijdelijk.

## Extra clubbeheer
- Clubemblemen zijn vectorvormen (SVG) met zeven vormen en zes kleurkeuzes; er worden geen emoji-emblemen gebruikt voor nieuwe clubs.
- De live wedstrijdpagina toont alleen de wedstrijd van de ingelogde manager. Afgewerkte andere uitslagen zijn zichtbaar bij Competities.
- Tactieken: formatie, mentaliteit, pressing en passing; de basissterkteberekening houdt rekening met een deel van de gekozen instellingen.
- Training: focus per linie en drie intensiteiten; spelersratings kunnen stijgen en training kost geld.
- Financiën: beginsaldo, sponsor- en stadioninkomsten, lonen en trainingskosten worden bijgehouden.

Dit blijft een prototype. Spelerskern en ratings zijn voorlopig vereenvoudigd: er zijn nog geen transfers, contracten, jeugdopleiding, stadionuitbreiding of betrouwbare server-side competitieverwerking. Omdat de game client-only is, zijn tactiek, training en geld niet beschermd tegen manipulatie door ingelogde gebruikers.

## Uitgebreide managementmodules
- Spelerskern met rating, leeftijd, positie, waarde en contractduur.
- Basiself: spelers kunnen geselecteerd of op de bank gezet worden; maximaal 11 starters.
- Transfermarkt: reserves aanbieden, een speler van een andere club kopen en bedragen verrekenen.
- Jeugdopleiding: één jeugdspeler per seizoen rekruteren met hoger groeipotentieel.
- Stadion: uitbreiden tot niveau 10, met stijgende inkomsten en capaciteit.
- De wedstrijdsterkte gebruikt de geselecteerde basiself wanneer exact 11 starters geselecteerd zijn.

Let op: deze modules zijn prototype-logica die door de browser wordt uitgevoerd. Transacties zijn niet veilig voor een openbare competitie omdat Firestore-regels alle ingelogde gebruikers schrijfrechten op de gedeelde wereld geven. Er is nog geen contractonderhandeling, spelervermoeidheid/herstelcyclus, volledige positiegebonden match engine of veilige servercontrole.
