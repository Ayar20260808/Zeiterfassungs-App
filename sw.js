/* Service Worker - macht die App auf dem Handy installierbar und
 * sorgt dafuer, dass sie ohne Netz wenigstens startet.
 *
 * Wichtig: nur die eigenen Dateien werden zwischengespeichert.
 * Anfragen an Supabase laufen IMMER direkt ins Netz - sonst wuerde
 * die App veraltete Zeiten anzeigen oder Aenderungen verschlucken.
 */

var SPEICHER = "zeiterfassung-v1";

var DATEIEN = [
  "./",
  "index.html",
  "stil.css",
  "js/daten.js",
  "js/hilfen.js",
  "js/app.js",
  "manifest.webmanifest",
  "symbole/symbol-192.png",
  "symbole/symbol-512.png",
  "symbole/symbol-512-maskierbar.png",
];

self.addEventListener("install", function (ereignis) {
  ereignis.waitUntil(
    caches.open(SPEICHER).then(function (speicher) {
      // addAll bricht ab, wenn eine Datei fehlt - deshalb einzeln,
      // damit ein fehlendes Symbol nicht die Installation verhindert.
      return Promise.all(
        DATEIEN.map(function (pfad) {
          return speicher.add(pfad).catch(function () {});
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (ereignis) {
  ereignis.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(
        namen.map(function (name) {
          if (name !== SPEICHER) return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (ereignis) {
  var anfrage = ereignis.request;

  // Nur einfache Abrufe eigener Dateien behandeln.
  if (anfrage.method !== "GET") return;
  var adresse = new URL(anfrage.url);
  if (adresse.origin !== self.location.origin) return;

  // konfig.js nie zwischenspeichern - sonst haengt eine alte
  // Projektadresse fest, wenn sie sich einmal aendert.
  if (adresse.pathname.endsWith("/konfig.js")) return;

  ereignis.respondWith(
    // Erst das Netz, damit Aenderungen sofort ankommen.
    // Ohne Netz das, was gespeichert ist.
    fetch(anfrage)
      .then(function (antwort) {
        var kopie = antwort.clone();
        caches.open(SPEICHER).then(function (speicher) {
          speicher.put(anfrage, kopie).catch(function () {});
        });
        return antwort;
      })
      .catch(function () {
        return caches.match(anfrage).then(function (treffer) {
          return treffer || caches.match("index.html");
        });
      })
  );
});
