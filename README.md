# KayJuuBee Quiz

## Start auf Windows (Laptop)

1. [Node.js LTS](https://nodejs.org/) installieren (nur beim ersten Mal).
2. Auf GitHub **Code → Download ZIP** anklicken und ZIP entpacken.
3. Im entpackten Ordner **START-QUIZ.bat** doppelklicken. Beim ersten Start werden die benötigten Pakete über das Internet installiert.
4. **Spielleitung:** http://localhost:3000/host
5. **Beamer:** http://localhost:3000/screen (im zweiten Browserfenster auf den Projektor ziehen und F11 drücken).
6. **Spieler:** Handy und Laptop ins gleiche WLAN; QR-Code auf dem Beamer scannen. Der Server zeigt die lokale WLAN-Adresse im Terminal.

**Wichtig:** Das schwarze Konsolenfenster muss während der Veranstaltung geöffnet bleiben. Windows-Firewall muss Node.js im privaten Netzwerk zulassen. Gäste-WLAN mit Geräte-Isolation funktioniert nicht. Wenn der QR-Code die falsche Adresse zeigt, verwende am Handy `http://LAPTOP-IP:3000/play`.

### Quiz-Auswahl
In der Spielleitung unter „Quiz wählen“ auswählen, dann „Nächste Frage / Start“. Kinderquiz über den Modus-Schalter aktivieren.

Vorhanden: Saalfeld-Quiz, Kinderquiz, Denkspiele mit Mini-Sudoku, Zahlenfolgen und Mustern, Fahrschulquiz (30 Fragen) und Bildrätsel-Vorlagen. **Die Promi- und Auto-Bildfragen sind noch Vorlagen ohne eingebundene Fotos und nicht für einen öffentlichen Spielabend fertig.** Die Antworten zu Beziehungsfragen vor dem Einsatz überprüfen.

### Spielercode & Auswertung
Gäste können ohne Code teilnehmen. Wer möchte, erstellt im Spielerbereich einen dauerhaften Code. Daten werden lokal in `player-history.json` gespeichert. Diese Datei bei Updates sichern! Die private Statistik benötigt `HOST_KEY` (siehe unten).

### Spielleitung absichern (empfohlen)
In einer Eingabeaufforderung im Quizordner:
```bat
set HOST_KEY=MEIN-GEHEIMER-SCHLUESSEL
npm start
```
Den gleichen Schlüssel im Feld „HOST_KEY“ der Spielleitung speichern. Diesen Schlüssel nicht an Teilnehmer weitergeben. Für einen Start mit Schlüssel nicht START-QUIZ.bat verwenden, sondern die Befehle oben im selben Konsolenfenster.

### Aktualisieren
Neue GitHub-ZIP entpacken und `player-history.json` sowie gegebenenfalls `quizzes.json` aus dem bisherigen Ordner übernehmen. Niemals die Daten-Dateien versehentlich überschreiben. Beim Betrieb auf einem Hostingdienst einen persistenten Datenträger und Backups einrichten.

### Hinweis
Das Fahrschulquiz ist ein unterhaltsames Eventquiz und ersetzt keinen amtlichen Prüfungsfragenkatalog. Bildrechte für alle externen Fotos beachten.
