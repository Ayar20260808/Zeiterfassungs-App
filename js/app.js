/* Zeiterfassung Paulus - Ablauf der App.
 *
 * Aufbau:
 *   1. Zustand      - was die App gerade weiss
 *   2. Bausteine    - kleine Helfer fuer HTML-Elemente
 *   3. Anmeldung
 *   4. Zeitachse    - Tage durchsehen und Eintraege ergaenzen
 *   5. Stempeln     - Schicht starten und beenden
 *   6. Woche        - Summen aus der Tabelle "Stunden"
 *   7. Mehr         - gelernte Orte, Abmelden
 *   8. Navigation und Start
 */
(function () {
  "use strict";

  var VERSION = "0.1.0";

  /* ---------- 1. Zustand ---------- */

  var zustand = {
    benutzer: null,        // { id, email, name }
    eintraege: [],         // Zeilen aus "zeitachse"
    tage: [],              // ["2026-09-24", ...] neueste zuerst
    tag: null,
    kategorien: [],        // aus "zeitkategorien"
    arten: [],             // Auswahl fuer das Feld "Art"
    schicht: null,         // laufende Schicht oder null
    pause: null,           // laufende Pause oder null
    wochenStart: null,
    personen: [],          // Namen aus der Spalte "mitarbeiter"
    person: "",            // ausgewaehlte Person, "" = alle
    standortOk: false,     // Hinweis zum Standort bestaetigt?
    tagSchichten: [],      // Schichten von heute, fuer den Tagesabschluss
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 2. Bausteine ---------- */

  /* Baut ein Element. Texte kommen ueber textContent hinein -
     so kann ein Kundenname mit spitzen Klammern nichts kaputtmachen. */
  function el(name, eigenschaften, kinder) {
    var e = document.createElement(name);
    eigenschaften = eigenschaften || {};
    Object.keys(eigenschaften).forEach(function (schluessel) {
      var wert = eigenschaften[schluessel];
      if (wert === null || wert === undefined || wert === false) return;
      if (schluessel === "klasse") e.className = wert;
      else if (schluessel === "text") e.textContent = wert;
      else if (schluessel === "wert") e.value = wert;
      else if (schluessel.indexOf("bei") === 0)
        e.addEventListener(schluessel.slice(3).toLowerCase(), wert);
      else e.setAttribute(schluessel, wert);
    });
    (kinder || []).forEach(function (kind) {
      if (kind) e.appendChild(kind);
    });
    return e;
  }

  var melderZeit = null;
  function melden(text, istFehler) {
    var m = $("melder");
    m.textContent = text;
    m.className = "melder" + (istFehler ? " melder--fehler" : "");
    m.hidden = false;
    clearTimeout(melderZeit);
    melderZeit = setTimeout(function () { m.hidden = true; }, istFehler ? 6000 : 2500);
  }

  /* Faengt alles ab, was in einer Anfrage schiefgehen kann. */
  function fehlerBehandeln(fehler) {
    if (fehler instanceof ZE.NichtAngemeldet) {
      zeigeAnmeldung();
      return;
    }
    console.error(fehler);
    melden(fehler.message || "Es ist ein Fehler aufgetreten.", true);
  }

  /* ---------- 3. Anmeldung ---------- */

  function zeigeAnmeldung() {
    $("app").hidden = true;
    $("seite-anmeldung").hidden = false;
  }

  function zeigeApp() {
    $("seite-anmeldung").hidden = true;
    $("app").hidden = false;
  }

  $("formular-anmeldung").addEventListener("submit", async function (ereignis) {
    ereignis.preventDefault();
    var knopf = $("knopf-anmelden");
    var fehlerfeld = $("anmeldung-fehler");
    fehlerfeld.hidden = true;
    knopf.disabled = true;
    knopf.textContent = "Anmelden …";
    try {
      await ZE.anmelden($("feld-email").value.trim(), $("feld-passwort").value);
      $("feld-passwort").value = "";
      await appStarten();
    } catch (fehler) {
      fehlerfeld.textContent = fehler.message;
      fehlerfeld.hidden = false;
    } finally {
      knopf.disabled = false;
      knopf.textContent = "Anmelden";
    }
  });

  $("knopf-abmelden").addEventListener("click", function () {
    ZE.abmelden();
    zustand.benutzer = null;
    zeigeAnmeldung();
  });

  /* ---------- 4. Zeitachse ---------- */

  async function stammdatenLaden() {
    zustand.kategorien = (await ZE.anfrage("zeitkategorien?select=id,name&order=name.asc")) || [];

    // Auswahl fuer "Art": erst die Werte, die in der Zeitachse schon
    // vorkommen, dann die Kategorien aus dem Cockpit - ohne Dopplungen.
    var vorhanden = (await ZE.anfrage("zeitachse?select=art&art=not.is.null")) || [];
    var menge = [];
    vorhanden.forEach(function (z) {
      if (z.art && menge.indexOf(z.art) === -1) menge.push(z.art);
    });
    zustand.kategorien.forEach(function (k) {
      if (menge.indexOf(k.name) === -1) menge.push(k.name);
    });
    zustand.arten = menge.sort(function (a, b) { return a.localeCompare(b, "de"); });
  }

  async function zeitachseLaden() {
    var zeilen = (await ZE.anfrage(
      "zeitachse?select=*&order=start.desc&limit=300"
    )) || [];
    zustand.eintraege = zeilen;

    var tage = [];
    zeilen.forEach(function (z) {
      var t = ZE.datumSchluessel(z.start);
      if (tage.indexOf(t) === -1) tage.push(t);
    });
    zustand.tage = tage;
    if (!zustand.tag || tage.indexOf(zustand.tag) === -1) zustand.tag = tage[0] || null;
    zeitachseZeichnen();
  }

  function eintraegeDesTages() {
    return zustand.eintraege
      .filter(function (z) { return ZE.datumSchluessel(z.start) === zustand.tag; })
      .sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
  }

  /* "Aufenthalt", "Fahrt", "zu Fuß" oder "Fahrrad" - was war das fuer eine
     Bewegung? Bei Fahrten steht das Verkehrsmittel in einer eigenen Spalte. */
  function bewegung(z) {
    if (z.typ !== "Fahrt") return "Aufenthalt";
    var v = (z.verkehr || "").trim();
    return v === "zu Fuß" || v === "Fahrrad" ? v : "Fahrt";
  }

  function dauerStunden(z) {
    if (!z.ende) return 0;
    return ZE.viertelStunden(ZE.minutenZwischen(z.start, z.ende));
  }

  function tagesleisteZeichnen() {
    var leiste = $("tagesleiste");
    leiste.textContent = "";
    zustand.tage.slice(0, 21).forEach(function (t) {
      var offen = zustand.eintraege.filter(function (z) {
        return ZE.datumSchluessel(z.start) === t && !z.art;
      }).length;
      var chip = el("button", {
        klasse: "tageschip" + (t === zustand.tag ? " ist-aktiv" : ""),
        type: "button",
        beiClick: function () { zustand.tag = t; zeitachseZeichnen(); },
      });
      var d = new Date(t + "T12:00:00");
      chip.appendChild(el("span", {
        text: d.toLocaleDateString("de-DE", { weekday: "short" }).toUpperCase(),
      }));
      chip.appendChild(el("br"));
      chip.appendChild(el("span", {
        text: d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
      }));
      if (offen > 0) chip.appendChild(el("span", { klasse: "tageschip__punkt", text: " ●" }));
      leiste.appendChild(chip);
    });
  }

  function zeitachseZeichnen() {
    tagesleisteZeichnen();

    var zeilen = eintraegeDesTages();
    var arbeit = 0, fahrt = 0, offen = 0;

    zeilen.forEach(function (z) {
      var stunden = dauerStunden(z);
      // Erst je Eintrag runden, dann addieren - so passt die Summe
      // genau zu dem, was in der Liste steht.
      if (z.typ === "Fahrt") fahrt += stunden;
      else arbeit += stunden;
      if (!z.art) offen += 1;
    });

    $("summe-arbeit").textContent = ZE.stundenText(arbeit);
    $("summe-fahrt").textContent = ZE.stundenText(fahrt);
    $("summe-offen").textContent = String(offen);

    var liste = $("liste-zeitachse");
    liste.textContent = "";

    if (zeilen.length === 0) {
      liste.appendChild(el("p", { klasse: "leise", text: "Für diesen Tag gibt es noch keine Einträge." }));
      return;
    }
    zeilen.forEach(function (z) { liste.appendChild(eintragZeichnen(z)); });
  }

  function eintragZeichnen(z) {
    var art = z.typ === "Fahrt" ? "fahrt" : !z.art ? "offen" : "arbeit";

    var kopf = el("div", { klasse: "eintrag__kopf" }, [
      el("span", {
        klasse: "eintrag__zeit",
        text: ZE.uhrzeit(z.start) + (z.ende ? "–" + ZE.uhrzeit(z.ende) : "–…"),
      }),
      el("span", { klasse: "eintrag__marke", text: bewegung(z) }),
      el("span", { klasse: "eintrag__dauer", text: ZE.stundenText(dauerStunden(z)) }),
    ]);

    var ortFeld = el("input", {
      type: "text",
      wert: z.ort || "",
      placeholder: "Ort oder Adresse",
      beiChange: function (e) { eintragSpeichern(z, { ort: e.target.value.trim() || null }); },
    });

    var artFeld = el("select", {
      beiChange: function (e) { eintragSpeichern(z, { art: e.target.value || null }); },
    });
    artFeld.appendChild(el("option", { value: "", text: "– offen –" }));
    zustand.arten.forEach(function (a) {
      artFeld.appendChild(el("option", { value: a, text: a, selected: z.art === a ? "selected" : null }));
    });

    var projektFeld = el("input", {
      type: "text",
      wert: z.kunde || "",
      placeholder: "freiwillig",
      beiChange: function (e) { eintragSpeichern(z, { kunde: e.target.value.trim() || null }); },
    });

    var karte = null;
    if (z.lat && z.lng) {
      karte = el("a", {
        klasse: "eintrag__fuss",
        href: "https://www.google.com/maps/search/?api=1&query=" + z.lat + "," + z.lng,
        target: "_blank",
        rel: "noopener",
        text: (z.km ? Number(z.km).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " km · " : "") + "Karte ↗",
      });
    }

    return el("div", { klasse: "eintrag eintrag--" + art, "data-id": z.id }, [
      kopf,
      el("label", { text: "Ort / Adresse", for: "ort-" + z.id }),
      ortFeld,
      el("div", { klasse: "eintrag__reihe" }, [
        el("div", {}, [el("label", { text: "Art" }), artFeld]),
        el("div", {}, [el("label", { text: "Projekt" }), projektFeld]),
      ]),
      karte,
    ]);
  }

  async function eintragSpeichern(z, aenderung) {
    try {
      await ZE.anfrage("zeitachse?id=eq." + z.id, {
        methode: "PATCH",
        koerper: aenderung,
        rueckgabe: "minimal",
      });
      Object.keys(aenderung).forEach(function (s) { z[s] = aenderung[s]; });
      melden("Gespeichert.");
      zeitachseZeichnen();
    } catch (fehler) {
      fehlerBehandeln(fehler);
    }
  }

  /* ---------- 5. Stempeln ---------- */

  function kategorienFuellen() {
    var feld = $("feld-kategorie");
    feld.textContent = "";
    feld.appendChild(el("option", { value: "", text: "– keine –" }));
    zustand.kategorien.forEach(function (k) {
      feld.appendChild(el("option", { value: String(k.id), text: k.name }));
    });
  }

  async function stempelLaden() {
    var offene = (await ZE.anfrage(
      "stempel_schicht?select=*&ende_zeit=is.null&order=start_zeit.desc&limit=1"
    )) || [];
    zustand.schicht = offene[0] || null;

    zustand.pause = null;
    if (zustand.schicht) {
      var pausen = (await ZE.anfrage(
        "stempel_pause?select=*&schicht_id=eq." + zustand.schicht.id +
        "&ende_zeit=is.null&order=start_zeit.desc&limit=1"
      )) || [];
      zustand.pause = pausen[0] || null;
    }

    // Alles von heute, fuer den Tagesabschluss weiter unten.
    var vonHeute = ZE.datumSchluessel(new Date());
    zustand.tagSchichten = (await ZE.anfrage(
      "stempel_schicht?select=*&start_zeit=gte." + vonHeute + "T00:00:00" +
      "&order=start_zeit.asc"
    )) || [];

    hinweisPruefen();
    stempelZeichnen();
    tagZeichnen();
  }

  /* ----- Tagesabschluss: ansehen, berichtigen, bestaetigen ----- */

  function ortZeile(beschriftung, adresse, lat, lng, genauigkeit, fehler) {
    if (fehler) {
      return el("p", { klasse: "tagzeile__ort" }, [
        el("span", { text: beschriftung + ": " }),
        el("em", { text: "kein Standort (" + fehler + ")" }),
      ]);
    }
    if (lat === null || lat === undefined) {
      return el("p", { klasse: "tagzeile__ort" }, [
        el("span", { text: beschriftung + ": " }),
        el("em", { text: "kein Standort" }),
      ]);
    }
    var text = adresse || (Number(lat).toFixed(5) + ", " + Number(lng).toFixed(5));
    return el("p", { klasse: "tagzeile__ort" }, [
      el("span", { text: beschriftung + ": " }),
      el("strong", { text: text }),
      el("span", {
        klasse: "tagzeile__mess",
        text: genauigkeit ? "  \u00b7 auf " + genauigkeit + " m genau" : "",
      }),
    ]);
  }

  function tagZeichnen() {
    var liste = $("tag-liste");
    var schichten = zustand.tagSchichten;
    $("tag-ueberschrift").hidden = schichten.length === 0;
    $("tag-text").hidden = schichten.length === 0;
    liste.textContent = "";

    schichten.forEach(function (s) {
      var zeile = el("div", { klasse: "tagzeile" });

      var dauer = s.ende_zeit
        ? ZE.stundenText(ZE.minutenZwischen(s.start_zeit, s.ende_zeit) / 60)
        : "l\u00e4uft";
      zeile.appendChild(el("div", { klasse: "tagzeile__kopf" }, [
        el("span", { text: ZE.uhrzeit(s.start_zeit) + (s.ende_zeit ? "\u2013" + ZE.uhrzeit(s.ende_zeit) : "") }),
        el("span", { text: dauer }),
      ]));
      if (s.projekt || s.kunde) {
        zeile.appendChild(el("p", { klasse: "leise", text: [s.projekt, s.kunde].filter(Boolean).join(" \u00b7 ") }));
      }

      zeile.appendChild(ortZeile("Eingestempelt", s.start_adresse, s.start_lat, s.start_lng,
                                 s.start_genauigkeit, s.start_fehler));
      if (s.ende_zeit) {
        zeile.appendChild(ortZeile("Ausgestempelt", s.ende_adresse, s.ende_lat, s.ende_lng,
                                   s.ende_genauigkeit, s.ende_fehler));
      }

      var feld = el("input", {
        type: "text",
        wert: s.start_adresse_korrigiert || "",
        placeholder: "Eigene Angabe, falls der Ort nicht stimmt",
      });
      feld.setAttribute("aria-label", "Eigene Angabe zum Ort");
      zeile.appendChild(feld);

      var knopf = el("button", {
        klasse: "knopf knopf--rand",
        text: s.bestaetigt_am ? "Best\u00e4tigt" : "Best\u00e4tigen",
      });
      knopf.disabled = !!s.bestaetigt_am && !feld.value;
      knopf.style.marginTop = "8px";
      knopf.addEventListener("click", async function () {
        knopf.disabled = true;
        try {
          await ZE.anfrage("stempel_schicht?id=eq." + s.id, {
            methode: "PATCH",
            rueckgabe: "minimal",
            koerper: {
              start_adresse_korrigiert: feld.value.trim() || null,
              bestaetigt_am: new Date().toISOString(),
            },
          });
          melden("Gespeichert.");
          await stempelLaden();
        } catch (fehler) {
          fehlerBehandeln(fehler);
          knopf.disabled = false;
        }
      });
      zeile.appendChild(knopf);

      if (s.bestaetigt_am) {
        zeile.appendChild(el("p", {
          klasse: "tagzeile__bestaetigt",
          text: "Von dir best\u00e4tigt um " + ZE.uhrzeit(s.bestaetigt_am),
        }));
      }
      liste.appendChild(zeile);
    });
  }

  /* ----- Standort ----- */

  function ortAnzeigen(text, art) {
    var feld = $("stempel-ort");
    feld.textContent = text || "";
    feld.className = "stempel__ort" + (art ? " " + art : "");
  }

  function hinweisPruefen() {
    $("standort-hinweis").hidden = zustand.standortOk;
    $("knopf-stempeln").disabled = !zustand.standortOk;
  }

  $("knopf-standort-ok").addEventListener("click", async function () {
    var knopf = this;
    knopf.disabled = true;
    try {
      await ZE.anfrage("profiles?id=eq." + zustand.benutzer.id, {
        methode: "PATCH",
        rueckgabe: "minimal",
        koerper: { standort_hinweis_am: new Date().toISOString() },
      });
      zustand.standortOk = true;
      hinweisPruefen();
      melden("Danke. Der Standort wird ab jetzt beim Stempeln gespeichert.");
    } catch (fehler) {
      fehlerBehandeln(fehler);
      knopf.disabled = false;
    }
  });

  /* Holt den Standort und zeigt den Fortschritt an. Der Standort ist
     Pflicht: ohne Erlaubnis wird nicht gestempelt. Findet das Geraet
     keinen Empfang, wird der Grund mitgeschrieben und die Zeit trotzdem
     erfasst - eine fehlende Stempelung waere schlimmer als ein fehlender Ort. */
  async function ortHolen() {
    ortAnzeigen("Standort wird gesucht \u2026", "sucht");
    try {
      var ort = await ZEStandort.holen(20);
      ortAnzeigen("Standort auf " + ort.genauigkeit + " m genau.");
      return { lat: ort.lat, lng: ort.lng, genauigkeit: ort.genauigkeit, fehler: null };
    } catch (f) {
      if (f.code === 1) {
        // Erlaubnis verweigert: das ist eine Entscheidung, kein Empfangsproblem.
        ortAnzeigen("Ohne Standort-Erlaubnis kann nicht gestempelt werden.", "fehlt");
        throw new Error("Bitte den Standort erlauben. Die App misst nur beim Stempeln.");
      }
      ortAnzeigen("Kein Standort: " + f.grund + ". Zeit wird trotzdem erfasst.", "fehlt");
      return { lat: null, lng: null, genauigkeit: null, fehler: f.grund };
    }
  }

  var stempelUhrZeit = null;

  function stempelZeichnen() {
    clearInterval(stempelUhrZeit);

    var zustandsfeld = $("stempel-zustand");
    var uhr = $("stempel-uhr");
    var seit = $("stempel-seit");
    var knopf = $("knopf-stempeln");
    var pausenknopf = $("knopf-pause");

    if (!zustand.schicht) {
      zustandsfeld.textContent = "Nicht eingestempelt";
      uhr.textContent = "--:--";
      seit.textContent = "";
      knopf.textContent = "Einstempeln";
      knopf.className = "knopf knopf--gelb knopf--gross";
      pausenknopf.hidden = true;
      return;
    }

    zustandsfeld.textContent = zustand.pause ? "Pause läuft" : "Eingestempelt";
    seit.textContent = "seit " + ZE.uhrzeit(zustand.schicht.start_zeit);
    knopf.textContent = "Ausstempeln";
    knopf.className = "knopf knopf--rand knopf--gross";
    pausenknopf.hidden = false;
    pausenknopf.textContent = zustand.pause ? "Pause beenden" : "Pause beginnen";

    function tick() {
      var minuten = ZE.minutenZwischen(zustand.schicht.start_zeit, new Date());
      var std = Math.floor(minuten / 60);
      var min = Math.floor(minuten % 60);
      uhr.textContent = std + ":" + String(min).padStart(2, "0");
    }
    tick();
    stempelUhrZeit = setInterval(tick, 20000);
  }

  $("knopf-stempeln").addEventListener("click", async function () {
    var knopf = this;
    knopf.disabled = true;
    try {
      if (!zustand.schicht) {
        var ort = await ortHolen();
        var kategorie = $("feld-kategorie").value;
        await ZE.anfrage("stempel_schicht", {
          methode: "POST",
          rueckgabe: "minimal",
          koerper: {
            // benutzer_id und start_zeit setzt die Datenbank selbst.
            kunde: $("feld-kunde").value.trim() || null,
            projekt: $("feld-projekt").value.trim() || null,
            kategorie_id: kategorie ? Number(kategorie) : null,
            start_lat: ort.lat,
            start_lng: ort.lng,
            start_genauigkeit: ort.genauigkeit,
            start_fehler: ort.fehler,
          },
        });
        melden("Eingestempelt.");
      } else {
        // Erst den Ort auf die laufende Zeile schreiben, dann abschliessen.
        // Die Datenbank-Funktion rechnet Pausen ab und schreibt die fertige
        // Zeile in die Tabelle "Stunden".
        var ortEnde = await ortHolen();
        await ZE.anfrage("stempel_schicht?id=eq." + zustand.schicht.id, {
          methode: "PATCH",
          rueckgabe: "minimal",
          koerper: {
            ende_lat: ortEnde.lat,
            ende_lng: ortEnde.lng,
            ende_genauigkeit: ortEnde.genauigkeit,
            ende_fehler: ortEnde.fehler,
          },
        });
        await ZE.funktion("stempel_ausstempeln");
        melden("Ausgestempelt und in Stunden eingetragen.");
      }
      await stempelLaden();
    } catch (fehler) {
      fehlerBehandeln(fehler);
    } finally {
      knopf.disabled = false;
    }
  });

  $("knopf-pause").addEventListener("click", async function () {
    var knopf = this;
    knopf.disabled = true;
    try {
      if (zustand.pause) {
        await ZE.anfrage("stempel_pause?id=eq." + zustand.pause.id, {
          methode: "PATCH",
          rueckgabe: "minimal",
          koerper: { ende_zeit: new Date().toISOString() },
        });
        melden("Pause beendet.");
      } else {
        await ZE.anfrage("stempel_pause", {
          methode: "POST",
          rueckgabe: "minimal",
          koerper: { schicht_id: zustand.schicht.id },
        });
        melden("Pause begonnen.");
      }
      await stempelLaden();
    } catch (fehler) {
      fehlerBehandeln(fehler);
    } finally {
      knopf.disabled = false;
    }
  });

  /* ---------- 6. Woche ---------- */

  /* Die Namen fuer die Auswahl kommen aus der Tabelle selbst - nichts
   * fest verdrahtet. Wer welche Namen sieht, entscheiden die
   * Rechteregeln der Datenbank: eigene Zeilen immer, alle nur mit der
   * Rolle "inhaber" oder "buero". */
  async function personenLaden() {
    if (zustand.personen.length) return;

    var zeilen = (await ZE.anfrage("Stunden?select=mitarbeiter&mitarbeiter=not.is.null")) || [];
    var namen = [];
    zeilen.forEach(function (z) {
      if (z.mitarbeiter && namen.indexOf(z.mitarbeiter) === -1) namen.push(z.mitarbeiter);
    });
    zustand.personen = namen.sort(function (a, b) { return a.localeCompare(b, "de"); });

    var feld = $("feld-person");
    feld.textContent = "";
    feld.appendChild(el("option", { value: "", text: "Alle Personen" }));
    zustand.personen.forEach(function (n) {
      feld.appendChild(el("option", { value: n, text: n }));
    });

    // Steht der eigene Name genau so in der Tabelle, ist er vorausgewaehlt.
    // Sonst bleibt es bei "Alle Personen" - besser als ein leerer Bildschirm.
    if (zustand.benutzer.name && zustand.personen.indexOf(zustand.benutzer.name) > -1) {
      zustand.person = zustand.benutzer.name;
    }
    feld.value = zustand.person;
  }

  async function wocheLaden() {
    if (!zustand.wochenStart) zustand.wochenStart = ZE.wochenStart(new Date());
    await personenLaden();

    var von = zustand.wochenStart;
    var bis = new Date(von);
    bis.setDate(bis.getDate() + 6);

    var pfad =
      "Stunden?select=*&datum=gte." + ZE.datumSchluessel(von) +
      "&datum=lte." + ZE.datumSchluessel(bis) +
      "&order=datum.asc";
    if (zustand.person) {
      pfad += "&mitarbeiter=eq." + encodeURIComponent(zustand.person);
    }

    var zeilen = (await ZE.anfrage(pfad)) || [];

    $("woche-titel").textContent =
      von.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + " – " +
      bis.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

    var gesamt = 0, fahrt = 0, tage = {};
    zeilen.forEach(function (z) {
      gesamt += Number(z.stunden || 0);
      fahrt += Number(z.fahrzeit || 0);
      tage[z.datum] = true;
    });

    $("woche-gesamt").textContent = ZE.stundenText(gesamt);
    $("woche-fahrt").textContent = ZE.stundenText(fahrt);
    $("woche-tage").textContent = String(Object.keys(tage).length);

    var liste = $("liste-woche");
    liste.textContent = "";
    if (zeilen.length === 0) {
      liste.appendChild(el("p", {
        klasse: "leise",
        text: zustand.person
          ? "Für diese Woche sind unter „" + zustand.person + "“ keine Stunden erfasst."
          : "Für diese Woche sind keine Stunden erfasst.",
      }));
      return;
    }
    zeilen.forEach(function (z) {
      // Bei "Alle Personen" gehoert der Name in die Zeile, sonst steht
      // er schon oben in der Auswahl.
      var fuss = [z.kunde, z.projekt].filter(Boolean).join(" · ") || "ohne Zuordnung";
      if (!zustand.person && z.mitarbeiter) fuss = z.mitarbeiter + " — " + fuss;

      liste.appendChild(el("div", { klasse: "eintrag eintrag--arbeit" }, [
        el("div", { klasse: "eintrag__kopf" }, [
          el("span", { klasse: "eintrag__zeit", text: ZE.datumKurz(z.datum + "T12:00:00") }),
          el("span", { klasse: "eintrag__marke", text: z.quelle || "—" }),
          el("span", { klasse: "eintrag__dauer", text: ZE.stundenText(z.stunden || 0) }),
        ]),
        el("p", { klasse: "eintrag__fuss", text: fuss }),
      ]));
    });
  }

  $("feld-person").addEventListener("change", function (ereignis) {
    zustand.person = ereignis.target.value;
    wocheLaden().catch(fehlerBehandeln);
  });

  $("woche-zurueck").addEventListener("click", function () {
    zustand.wochenStart.setDate(zustand.wochenStart.getDate() - 7);
    wocheLaden().catch(fehlerBehandeln);
  });
  $("woche-vor").addEventListener("click", function () {
    zustand.wochenStart.setDate(zustand.wochenStart.getDate() + 7);
    wocheLaden().catch(fehlerBehandeln);
  });

  /* ---------- 7. Mehr ---------- */

  async function orteLaden() {
    var orte = (await ZE.anfrage("zeitachse_ort?select=*&order=adresse.asc")) || [];
    var liste = $("liste-orte");
    liste.textContent = "";
    if (orte.length === 0) {
      liste.appendChild(el("p", { klasse: "leise", text: "Noch kein Ort gelernt." }));
      return;
    }
    orte.forEach(function (o) {
      liste.appendChild(el("div", { klasse: "eintrag eintrag--arbeit" }, [
        el("div", { klasse: "eintrag__kopf" }, [
          el("span", { klasse: "eintrag__zeit", text: o.adresse }),
        ]),
        el("p", {
          klasse: "eintrag__fuss",
          text: Number(o.lat).toFixed(5) + ", " + Number(o.lng).toFixed(5),
        }),
      ]));
    });
  }

  /* ---------- 8. Navigation und Start ---------- */

  var titel = {
    zeitachse: "Zeitachse",
    stempeln: "Stempeln",
    woche: "Woche",
    mehr: "Mehr",
  };

  Array.prototype.forEach.call(
    document.querySelectorAll(".navigation__knopf"),
    function (knopf) {
      knopf.addEventListener("click", function () { seiteZeigen(knopf.dataset.seite); });
    }
  );

  function seiteZeigen(name) {
    ["zeitachse", "stempeln", "woche", "mehr"].forEach(function (s) {
      $("seite-" + s).hidden = s !== name;
    });
    Array.prototype.forEach.call(
      document.querySelectorAll(".navigation__knopf"),
      function (k) { k.classList.toggle("ist-aktiv", k.dataset.seite === name); }
    );
    $("kopf-titel").textContent = titel[name];

    if (name === "stempeln") stempelLaden().catch(fehlerBehandeln);
    if (name === "woche") wocheLaden().catch(fehlerBehandeln);
    if (name === "mehr") orteLaden().catch(fehlerBehandeln);
  }

  async function appStarten() {
    var s = await ZE.gueltigeSitzung();
    if (!s) { zeigeAnmeldung(); return; }

    zustand.benutzer = { id: s.user.id, email: s.user.email, name: null };

    try {
      var profile = await ZE.anfrage(
        "profiles?select=full_name,zeiterfassung_name,standort_hinweis_am&id=eq." + s.user.id
      );
      if (profile && profile[0]) {
        zustand.benutzer.name = profile[0].zeiterfassung_name || profile[0].full_name || null;
        zustand.standortOk = !!profile[0].standort_hinweis_am;
      }
    } catch (fehler) {
      // Ohne Profil laeuft die App weiter, dann eben ohne Namensfilter.
      console.warn("Profil konnte nicht geladen werden:", fehler);
    }

    $("mehr-benutzer").textContent =
      (zustand.benutzer.name ? zustand.benutzer.name + " · " : "") + zustand.benutzer.email;
    $("mehr-version").textContent = "Version " + VERSION;

    zeigeApp();

    try {
      await stammdatenLaden();
      kategorienFuellen();
      await zeitachseLaden();
    } catch (fehler) {
      fehlerBehandeln(fehler);
    }
  }

  window.addEventListener("load", function () {
    appStarten().catch(fehlerBehandeln);
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("sw.js").catch(function () {
        /* Offline-Betrieb ist dann nicht verfuegbar - die App laeuft trotzdem. */
      });
    }
  });
})();
