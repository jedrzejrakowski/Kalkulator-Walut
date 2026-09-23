/**
 * Zestawienie jako arkusz Excela (.xlsx).
 *
 * Kwoty i kursy zapisujemy jako liczby, a daty jako daty — nie jako tekst —
 * żeby dało się je sortować, filtrować i przeliczać. Sumy są formułami
 * SUMA i SUMA.JEŻELI z zapisaną wartością: arkusz pokazuje wynik od razu,
 * a sprawdzający może kliknąć komórkę i zobaczyć, z czego się bierze.
 */
import { poPolsku, type DataIso } from './dates';
import { archiwum } from './zip';
import { METODA, PODSTAWA, type Zestawienie } from './zestawienie';

const KODOWANIE = new TextEncoder();

/** Style z `styles.xml` — numery odpowiadają kolejności w `cellXfs`. */
const S = {
  zwykly: 0,
  gruby: 1,
  data: 2,
  kwota: 3,
  kurs: 4,
  kwotaGruba: 5,
  tytul: 6,
  naglowek: 7,
  przypis: 8,
} as const;

/** Nagłówki kolumn tabeli głównej, A–H. */
const KOLUMNY = ['Lp.', 'Data zdarzenia', 'Kwota', 'Waluta', 'Kurs NBP (zł)', 'Tabela NBP', 'Data tabeli', 'Wartość (zł)'];
const SZEROKOSCI = [6, 14, 16, 9, 16, 17, 13, 16];

/** Wiersz tabeli głównej, w którym stoją nagłówki kolumn. */
const WIERSZ_NAGLOWKA = 6;

const xml = (tekst: string) =>
  tekst.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Data jako numer seryjny Excela — dni od 30 grudnia 1899.
 *
 * Tak Excel przechowuje daty; komórka z formatem daty pokazuje wtedy
 * 11.08.2026, a zarazem sortuje się i liczy jak data.
 */
export function numerDaty(data: DataIso): number {
  const [r, m, d] = data.split('-').map(Number);
  return Math.round((Date.UTC(r!, m! - 1, d!) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

type Komorka =
  | { tekst: string; styl?: number }
  | { liczba: number; styl?: number }
  | { formula: string; wartosc: number; styl?: number };

const kolumna = (i: number) => String.fromCharCode(65 + i); // A–H wystarczą

function komorka(adres: string, k: Komorka): string {
  const s = k.styl ? ` s="${k.styl}"` : '';
  if ('tekst' in k) {
    return `<c r="${adres}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(k.tekst)}</t></is></c>`;
  }
  if ('formula' in k) {
    return `<c r="${adres}"${s}><f>${xml(k.formula)}</f><v>${k.wartosc}</v></c>`;
  }
  return `<c r="${adres}"${s}><v>${k.liczba}</v></c>`;
}

/** Wiersz arkusza z komórkami w podanych kolumnach (0 = A). */
function wiersz(nr: number, komorki: [number, Komorka][]): string {
  return `<row r="${nr}">${komorki.map(([i, k]) => komorka(`${kolumna(i)}${nr}`, k)).join('')}</row>`;
}

function arkuszXml(z: Zestawienie): string {
  const n = z.wiersze.length;
  const pierwszy = WIERSZ_NAGLOWKA + 1;
  const ostatni = WIERSZ_NAGLOWKA + n;
  const wiersze: string[] = [];

  const zakres = z.od && z.doDnia ? `zdarzenia od ${poPolsku(z.od)} do ${poPolsku(z.doDnia)} · ` : '';
  wiersze.push(wiersz(1, [[0, { tekst: z.tytul, styl: S.tytul }]]));
  wiersze.push(wiersz(2, [[0, { tekst: `Sporządzono ${poPolsku(z.sporzadzono)} · ${zakres}pozycji: ${n}`, styl: S.przypis }]]));
  wiersze.push(wiersz(3, [[0, { tekst: PODSTAWA, styl: S.przypis }]]));
  wiersze.push(wiersz(4, [[0, { tekst: METODA, styl: S.przypis }]]));
  wiersze.push(wiersz(WIERSZ_NAGLOWKA, KOLUMNY.map((t, i) => [i, { tekst: t, styl: S.naglowek }])));

  z.wiersze.forEach((w, i) => {
    wiersze.push(
      wiersz(pierwszy + i, [
        [0, { liczba: w.lp }],
        [1, { liczba: numerDaty(w.data), styl: S.data }],
        [2, { liczba: w.kwota, styl: S.kwota }],
        [3, { tekst: w.waluta }],
        [4, { liczba: w.kurs, styl: S.kurs }],
        [5, { tekst: w.numerTabeli }],
        [6, { liczba: numerDaty(w.dataTabeli), styl: S.data }],
        [7, { liczba: w.wartoscPln, styl: S.kwota }],
      ]),
    );
  });

  if (n > 0) {
    // Podsumowanie pod tabelą, w tych samych kolumnach co kwota, waluta
    // i wartość — kwoty stoją pod kwotami, złote pod złotymi.
    const zakresKol = (k: string) => `${k}$${pierwszy}:${k}$${ostatni}`;
    let nr = ostatni + 2;
    wiersze.push(
      wiersz(nr, [
        [0, { tekst: 'Podsumowanie według walut', styl: S.gruby }],
        [2, { tekst: 'Kwota', styl: S.naglowek }],
        [3, { tekst: 'Waluta', styl: S.naglowek }],
        [4, { tekst: 'Pozycji', styl: S.naglowek }],
        [7, { tekst: 'Wartość (zł)', styl: S.naglowek }],
      ]),
    );
    for (const s of z.sumy) {
      nr += 1;
      wiersze.push(
        wiersz(nr, [
          [2, { formula: `SUMIF(${zakresKol('D')},D${nr},${zakresKol('C')})`, wartosc: s.kwota, styl: S.kwota }],
          [3, { tekst: s.waluta }],
          [4, { formula: `COUNTIF(${zakresKol('D')},D${nr})`, wartosc: s.liczba }],
          [7, { formula: `SUMIF(${zakresKol('D')},D${nr},${zakresKol('H')})`, wartosc: s.wartoscPln, styl: S.kwota }],
        ]),
      );
    }
    nr += 1;
    wiersze.push(
      wiersz(nr, [
        [0, { tekst: 'Razem', styl: S.gruby }],
        [7, { formula: `SUM(H${pierwszy}:H${ostatni})`, wartosc: z.razemPln, styl: S.kwotaGruba }],
      ]),
    );
  }

  const ostatniWiersz = n > 0 ? ostatni + 3 + z.sumy.length : WIERSZ_NAGLOWKA;
  const kolumny = SZEROKOSCI.map((s, i) => `<col min="${i + 1}" max="${i + 1}" width="${s}" customWidth="1"/>`).join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<dimension ref="A1:H${ostatniWiersz}"/>` +
    // Nagłówek tabeli zamrożony — przy kilkuset paragonach zostaje na ekranie.
    '<sheetViews><sheetView workbookViewId="0">' +
    `<pane ySplit="${WIERSZ_NAGLOWKA}" topLeftCell="A${pierwszy}" activePane="bottomLeft" state="frozen"/>` +
    '</sheetView></sheetViews>' +
    `<cols>${kolumny}</cols>` +
    `<sheetData>${wiersze.join('')}</sheetData>` +
    '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    '</worksheet>'
  );
}

const STYLE =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2">' +
  '<numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy"/>' +
  // Kurs z pełną dokładnością tabeli: co najmniej cztery miejsca, do dwunastu.
  '<numFmt numFmtId="165" formatCode="0.0000########"/>' +
  '</numFmts>' +
  '<fonts count="4">' +
  '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><sz val="9"/><color rgb="FF595959"/><name val="Calibri"/><family val="2"/></font>' +
  '</fonts>' +
  '<fills count="3">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="2">' +
  '<border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>' +
  '</borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="9">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +                              // zwykły
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                // gruby
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +      // data
  '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +        // kwota
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +      // kurs
  '<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' + // kwota gruba
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                // tytuł
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' + // nagłówek
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                // przypis
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

const TYPY =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '</Types>';

const RELACJE_GLOWNE =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const SKOROSZYT =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets><sheet name="Zestawienie" sheetId="1" r:id="rId1"/></sheets>' +
  // Przelicz formuły przy otwarciu, zamiast ufać zapisanym wartościom.
  '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
  '</workbook>';

const RELACJE_SKOROSZYTU =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

export const TYP_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function plikXlsx(z: Zestawienie, kiedy: Date = new Date()): Uint8Array {
  const plik = (nazwa: string, tresc: string) => ({ nazwa, dane: KODOWANIE.encode(tresc) });
  return archiwum(
    [
      plik('[Content_Types].xml', TYPY),
      plik('_rels/.rels', RELACJE_GLOWNE),
      plik('xl/workbook.xml', SKOROSZYT),
      plik('xl/_rels/workbook.xml.rels', RELACJE_SKOROSZYTU),
      plik('xl/styles.xml', STYLE),
      plik('xl/worksheets/sheet1.xml', arkuszXml(z)),
    ],
    kiedy,
  );
}
