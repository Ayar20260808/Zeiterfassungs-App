/* Zeiterfassung Paulus - Standort beim Stempeln.
 *
 * Holt die Koordinate vom Geraet. Bewusst klein gehalten: die App soll
 * nur beim Ein- und Ausstempeln messen, nie laufend im Hintergrund.
 *
 * Wenn etwas schiefgeht, kommt ein Grund in Klartext zurueck. Der wird
 * mitgespeichert, damit im Cockpit steht, WARUM ein Ort fehlt - eine
 * leere Spalte allein sagt das nicht.
 */
var ZEStandort = (function () {
  "use strict";

  var GRUND = {
    1: "Erlaubnis verweigert",
    2: "Kein Empfang",
    3: "Zeitüberschreitung",
  };

  /* Liefert { lat, lng, genauigkeit } oder wirft { grund, code }. */
  function holen(sekunden) {
    return new Promise(function (fertig, misslungen) {
      if (!navigator.geolocation) {
        misslungen({ grund: "Gerät kann keinen Standort bestimmen", code: 0 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (ort) {
          fertig({
            lat: ort.coords.latitude,
            lng: ort.coords.longitude,
            genauigkeit: Math.round(ort.coords.accuracy),
          });
        },
        function (fehler) {
          misslungen({ grund: GRUND[fehler.code] || "Unbekannter Fehler", code: fehler.code });
        },
        { enableHighAccuracy: true, timeout: (sekunden || 20) * 1000, maximumAge: 0 }
      );
    });
  }

  /* "granted", "prompt", "denied" oder null, wenn der Browser das nicht verraet.
     Nur zur Anzeige - die Entscheidung faellt beim echten Messen. */
  function erlaubnis() {
    if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve(null);
    return navigator.permissions.query({ name: "geolocation" })
      .then(function (s) { return s.state; })
      .catch(function () { return null; });
  }

  /* Meter zwischen zwei Punkten - fuer die Anzeige "120 m vom Betrieb". */
  function entfernung(lat1, lng1, lat2, lng2) {
    var dx = (lng2 - lng1) * 111320 * Math.cos(lat1 * Math.PI / 180);
    var dy = (lat2 - lat1) * 110540;
    return Math.round(Math.sqrt(dx * dx + dy * dy));
  }

  return { holen: holen, erlaubnis: erlaubnis, entfernung: entfernung };
})();
