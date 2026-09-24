import type { Booking } from './journal';

/**
 * DATEV-Format "Buchungsstapel" (EXTF, Formatversion 13 / Header-Version 700).
 * Semicolon separated, Windows-1252 encoded, decimal comma, Belegdatum as DDMM.
 */

export interface DatevHeaderConfig {
	consultantNumber: string;   // Beraternummer
	clientNumber: string;       // Mandantennummer
	fiscalYearStart: Date;      // Wirtschaftsjahresbeginn
	accountLength: number;      // Sachkontenlänge
	chart: 'SKR03' | 'SKR04';
	from: Date;
	to: Date;                   // inclusive last day
	label: string;
}

// Column names of the Buchungsstapel, in order (Formatversion 13)
const COLUMNS = [
	'Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'WKZ Umsatz', 'Kurs', 'Basis-Umsatz', 'WKZ Basis-Umsatz',
	'Konto', 'Gegenkonto (ohne BU-Schlüssel)', 'BU-Schlüssel', 'Belegdatum', 'Belegfeld 1', 'Belegfeld 2', 'Skonto',
	'Buchungstext', 'Postensperre', 'Diverse Adressnummer', 'Geschäftspartnerbank', 'Sachverhalt', 'Zinssperre', 'Beleglink',
	...Array.from({ length: 8 }, (_, i) => [`Beleginfo - Art ${i + 1}`, `Beleginfo - Inhalt ${i + 1}`]).flat(),
	'KOST1 - Kostenstelle', 'KOST2 - Kostenstelle', 'Kost-Menge', 'EU-Land u. UStID (Bestimmung)', 'EU-Steuersatz (Bestimmung)',
	'Abw. Versteuerungsart', 'Sachverhalt L+L', 'Funktionsergänzung L+L', 'BU 49 Hauptfunktionstyp', 'BU 49 Hauptfunktionsnummer',
	'BU 49 Funktionsergänzung',
	...Array.from({ length: 20 }, (_, i) => [`Zusatzinformation - Art ${i + 1}`, `Zusatzinformation- Inhalt ${i + 1}`]).flat(),
	'Stück', 'Gewicht', 'Zahlweise', 'Forderungsart', 'Veranlagungsjahr', 'Zugeordnete Fälligkeit', 'Skontotyp', 'Auftragsnummer',
	'Buchungstyp', 'USt-Schlüssel (Anzahlungen)', 'EU-Mitgliedstaat (Anzahlungen)', 'Sachverhalt L+L (Anzahlungen)',
	'EU-Steuersatz (Anzahlungen)', 'Erlöskonto (Anzahlungen)', 'Herkunft-Kz', 'Buchungs GUID', 'KOST-Datum', 'SEPA-Mandatsreferenz',
	'Skontosperre', 'Gesellschaftername', 'Beteiligtennummer', 'Identifikationsnummer', 'Zeichnernummer', 'Postensperre bis',
	'Bezeichnung SoBil-Sachverhalt', 'Kennzeichen SoBil-Buchung', 'Festschreibung', 'Leistungsdatum', 'Datum Zuord. Steuerperiode',
	'Fälligkeit', 'Generalumkehr (GU)', 'Steuersatz', 'Land', 'Abrechnungsreferenz', 'BVV-Position',
	'EU-Mitgliedstaat u. UStID (Ursprung)', 'EU-Steuersatz (Ursprung)', 'Abw. Skontokonto',
];
const col = (name: string) => COLUMNS.indexOf(name);

// ── Formatting ─────────────────────────────────────────────────────────────────

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/** Date parts in Europe/Berlin (DATEV dates are local dates). */
function berlinParts(d: Date) {
	const parts = new Intl.DateTimeFormat('de-DE', {
		timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
	}).formatToParts(d);
	const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
	return { y: get('year'), m: get('month'), d: get('day') };
}
const yyyymmdd = (d: Date) => { const p = berlinParts(d); return `${p.y}${p.m}${p.d}`; };
const ddmm = (d: Date) => { const p = berlinParts(d); return `${p.d}${p.m}`; };
const ddmmyyyy = (d: Date) => { const p = berlinParts(d); return `${p.d}${p.m}${p.y}`; };

const amount = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** Quoted text field; DATEV doesn't allow line breaks, quotes are doubled. */
const text = (s: string | undefined, max: number) =>
	`"${(s ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""').slice(0, max)}"`;

/** Belegfeld 1 only allows letters, digits and $ & % * + - / (max. 36). */
const belegfeld = (s: string | undefined) => text((s ?? '').replace(/[^A-Za-z0-9$&%*+\-/]/g, ''), 36);

function header(cfg: DatevHeaderConfig): string {
	const now = new Date();
	const created = `${yyyymmdd(now)}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
	return [
		'"EXTF"', 700, 21, '"Buchungsstapel"', 13, created, '', '"RE"', '""', '""',
		cfg.consultantNumber, cfg.clientNumber, yyyymmdd(cfg.fiscalYearStart), cfg.accountLength,
		yyyymmdd(cfg.from), yyyymmdd(cfg.to), text(cfg.label, 30), '""', 1, 0, 0, '"EUR"', '', '""', '', '',
		`"${cfg.chart === 'SKR04' ? '04' : '03'}"`, '', '', '""', '""',
	].join(';');
}

function row(b: Booking): string {
	const cells: string[] = new Array(COLUMNS.length).fill('');
	cells[col('Umsatz (ohne Soll/Haben-Kz)')] = amount(b.amountCents);
	cells[col('Soll/Haben-Kennzeichen')] = '"S"';
	cells[col('WKZ Umsatz')] = '"EUR"';
	cells[col('Konto')] = b.debit;
	cells[col('Gegenkonto (ohne BU-Schlüssel)')] = b.credit;
	cells[col('BU-Schlüssel')] = b.taxKey ? `"${b.taxKey}"` : '';
	cells[col('Belegdatum')] = ddmm(b.date);
	cells[col('Belegfeld 1')] = belegfeld(b.documentNumber);
	cells[col('Buchungstext')] = text(b.text, 60);
	cells[col('Beleginfo - Art 1')] = text('Zahlungsreferenz', 20);
	cells[col('Beleginfo - Inhalt 1')] = text(b.reference, 210);
	if (b.euVatIdOrCountry) cells[col('EU-Land u. UStID (Bestimmung)')] = text(b.euVatIdOrCountry, 15);
	if (b.euTaxRate !== undefined) cells[col('EU-Steuersatz (Bestimmung)')] = amount(b.euTaxRate * 100);
	if (b.serviceDate) cells[col('Leistungsdatum')] = ddmmyyyy(b.serviceDate);
	return cells.join(';');
}

/** Encodes to Windows-1252 as DATEV expects; unsupported characters become "?". */
function toWindows1252(s: string): Uint8Array {
	const special: Record<string, number> = {
		'€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a,
		'‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
		'˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
	};
	const out = new Uint8Array(s.length);
	let i = 0;
	for (const ch of s) {
		const code = ch.codePointAt(0)!;
		out[i++] = special[ch] ?? (code < 0x80 || (code >= 0xa0 && code <= 0xff) ? code : 0x3f);
	}
	return out.slice(0, i);
}

export function buildDatevBuchungsstapel(cfg: DatevHeaderConfig, bookings: Booking[]): Uint8Array {
	const lines = [header(cfg), COLUMNS.join(';'), ...bookings.map(row)];
	return toWindows1252(lines.join('\r\n') + '\r\n');
}
