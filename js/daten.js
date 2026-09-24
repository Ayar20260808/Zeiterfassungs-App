/* Zugriff auf Supabase - ohne Zusatzbibliothek, nur mit fetch().
 *
 * Alles haengt an einem einzigen Objekt: window.ZE
 * So braucht die App keinen Baukasten (kein npm, kein Bundler).
 */
window.ZE = window.ZE || {};

(function () {
  "use strict";

  var SCHLUESSEL_SITZUNG = "zeiterfassung.sitzung";

  function konfig() {
    if (!window.KONFIG || !window.KONFIG.supabaseUrl) {
      throw new Error(
        "konfig.js fehlt. Auf Netlify erzeugt sie der Build, lokal von Hand anlegen."
      );
    }
    return window.KONFIG;
  }

  /* ---------- Sitzung (Anmeldung merken) ---------- */

  var sitzung = {
    lesen: function () {
      try {
        return JSON.parse(localStorage.getItem(SCHLUESSEL_SITZUNG));
      } catch (e) {
        return null;
      }
    },
    schreiben: function (s) {
      try {
        localStorage.setItem(SCHLUESSEL_SITZUNG, JSON.stringify(s));
      } catch (e) {
        /* Privater Modus: dann gilt die Anmeldung nur fuer diesen Besuch. */
      }
    },
    loeschen: function () {
      try {
        localStorage.removeItem(SCHLUESSEL_SITZUNG);
      } catch (e) {}
    },
  };

  /* ---------- Anmeldung ---------- */

  async function anmelden(email, passwort) {
    var k = konfig();
    var antwort = await fetch(k.supabaseUrl + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: k.supabaseSchluessel, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: passwort }),
    });
    var daten = await antwort.json();
    if (!antwort.ok) {
      throw new Error(
        daten.error_description || daten.msg || "Anmeldung fehlgeschlagen."
      );
    }
    daten.laeuft_ab = Date.now() + (daten.expires_in || 3600) * 1000;
    sitzung.schreiben(daten);
    return daten;
  }

  /* Holt bei Bedarf einen frischen Zugangsschluessel.
   * Supabase-Schluessel laufen nach einer Stunde ab; mit dem
   * refresh_token bekommt man ohne erneute Passworteingabe einen neuen. */
  async function erneuern() {
    var alt = sitzung.lesen();
    if (!alt || !alt.refresh_token) return null;
    var k = konfig();
    var antwort = await fetch(k.supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: k.supabaseSchluessel, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: alt.refresh_token }),
    });
    if (!antwort.ok) {
      sitzung.loeschen();
      return null;
    }
    var neu = await antwort.json();
    neu.laeuft_ab = Date.now() + (neu.expires_in || 3600) * 1000;
    sitzung.schreiben(neu);
    return neu;
  }

  async function gueltigeSitzung() {
    var s = sitzung.lesen();
    if (!s) return null;
    // Eine Minute Sicherheitsabstand, damit der Schluessel nicht
    // mitten in einer Anfrage ablaeuft.
    if (!s.laeuft_ab || s.laeuft_ab - 60000 < Date.now()) return await erneuern();
    return s;
  }

  function abmelden() {
    sitzung.loeschen();
  }

  /* ---------- Anfragen an die Datenbank ---------- */

  /* pfad z. B. "zeitachse?select=*&order=start.asc" */
  async function anfrage(pfad, optionen) {
    optionen = optionen || {};
    var s = await gueltigeSitzung();
    if (!s) throw new ZE.NichtAngemeldet();

    var k = konfig();
    var kopf = {
      apikey: k.supabaseSchluessel,
      Authorization: "Bearer " + s.access_token,
    };
    if (optionen.koerper !== undefined) kopf["Content-Type"] = "application/json";
    if (optionen.rueckgabe) kopf.Prefer = "return=" + optionen.rueckgabe;

    var antwort = await fetch(k.supabaseUrl + "/rest/v1/" + pfad, {
      method: optionen.methode || "GET",
      headers: kopf,
      body: optionen.koerper !== undefined ? JSON.stringify(optionen.koerper) : undefined,
    });

    if (antwort.status === 401) {
      sitzung.loeschen();
      throw new ZE.NichtAngemeldet();
    }
    if (!antwort.ok) {
      var text = await antwort.text();
      throw new Error("Datenbank: " + antwort.status + " " + text);
    }
    // 204 = erfolgreich, aber ohne Inhalt. .json() wuerde daran scheitern.
    if (antwort.status === 204 || antwort.status === 205) return null;
    var roh = await antwort.text();
    return roh ? JSON.parse(roh) : null;
  }

  /* Ruft eine Datenbank-Funktion auf (z. B. stempel_ausstempeln). */
  function funktion(name, argumente) {
    return anfrage("rpc/" + name, {
      methode: "POST",
      koerper: argumente || {},
    });
  }

  function NichtAngemeldet() {
    this.name = "NichtAngemeldet";
    this.message = "Bitte neu anmelden.";
  }
  NichtAngemeldet.prototype = Object.create(Error.prototype);

  ZE.NichtAngemeldet = NichtAngemeldet;
  ZE.sitzung = sitzung;
  ZE.anmelden = anmelden;
  ZE.abmelden = abmelden;
  ZE.gueltigeSitzung = gueltigeSitzung;
  ZE.anfrage = anfrage;
  ZE.funktion = funktion;
})();
