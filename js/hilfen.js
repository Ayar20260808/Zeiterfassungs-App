/* Kleine Helfer: Zeiten rechnen und anzeigen.
 * Bewusst eine eigene Datei, damit man sie einzeln nachlesen kann. */
window.ZE = window.ZE || {};

(function () {
  "use strict";

  /* Minuten -> Dezimalstunden, auf die Viertelstunde gerundet.
   * Beispiel: 52 Minuten -> 0,75.  Genauso rechnet die Tabelle "Stunden". */
  function viertelStunden(minuten) {
    return (Math.round(minuten / 15) * 15) / 60;
  }

  /* 1.5 -> "1,50" (deutsche Schreibweise, immer zwei Nachkommastellen) */
  function stundenText(stunden) {
    return Number(stunden).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function uhrzeit(wert) {
    return new Date(wert).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function datumKurz(wert) {
    return new Date(wert).toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
  }

  /* "2026-09-24" - das Format, das die Datenbank fuer Datumsspalten will.
   * Achtung: nicht toISOString() nehmen, das rechnet in UTC um und
   * verschiebt spaete Abende auf den naechsten Tag. */
  function datumSchluessel(wert) {
    var d = new Date(wert);
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var t = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + t;
  }

  /* Montag der Woche, in der das Datum liegt (0 Uhr). */
  function wochenStart(wert) {
    var d = new Date(wert);
    d.setHours(0, 0, 0, 0);
    var tag = d.getDay(); // 0 = Sonntag
    d.setDate(d.getDate() - (tag === 0 ? 6 : tag - 1));
    return d;
  }

  function minutenZwischen(von, bis) {
    return (new Date(bis) - new Date(von)) / 60000;
  }

  /* Luftlinie in Metern. Fuer wenige hundert Meter reicht diese
   * einfache Rechnung; sie braucht keine Zusatzbibliothek. */
  function entfernungMeter(lat1, lng1, lat2, lng2) {
    var x = (lng2 - lng1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
    var y = (lat2 - lat1) * 110540;
    return Math.sqrt(x * x + y * y);
  }

  ZE.viertelStunden = viertelStunden;
  ZE.stundenText = stundenText;
  ZE.uhrzeit = uhrzeit;
  ZE.datumKurz = datumKurz;
  ZE.datumSchluessel = datumSchluessel;
  ZE.wochenStart = wochenStart;
  ZE.minutenZwischen = minutenZwischen;
  ZE.entfernungMeter = entfernungMeter;
})();
