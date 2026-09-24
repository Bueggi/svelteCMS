/**
 * Default HTML invoice template.
 * Variables use {{variable_name}} syntax and are replaced by renderInvoiceHtml().
 *
 * Available variables:
 *   {{document_title}}     — "Rechnung" or "Rechnungskorrektur"
 *   {{invoice_number}}     — e.g. INV-2026-0001
 *   {{invoice_date}}       — formatted date
 *   {{service_date}}       — Leistungsdatum
 *   {{reference_note}}     — for corrections: which invoice is corrected (empty otherwise)
 *   {{tax_note}}           — legal VAT note (reverse charge, § 19, third country, OSS)
 *   {{payment_note}}       — e.g. "Bezahlt am 01.02.2026 per Stripe"
 *   {{company_tax_number}} — Steuernummer line (empty if not set)
 *   {{company_legal}}      — managing director / commercial register line
 *   {{company_name}}       — seller company name
 *   {{company_address}}    — multi-line seller address (HTML with <br>)
 *   {{company_vat_id}}     — seller VAT ID
 *   {{company_email}}      — seller email
 *   {{company_phone}}      — seller phone
 *   {{customer_name}}      — buyer full name
 *   {{customer_email}}     — buyer email
 *   {{customer_address}}   — buyer address (HTML with <br>)
 *   {{customer_vat_id}}    — buyer VAT ID (empty if not set)
 *   {{items_rows}}         — HTML <tr> rows for each line item
 *   {{subtotal}}           — formatted subtotal
 *   {{vat_rate}}           — VAT percentage
 *   {{vat_amount}}         — formatted VAT amount
 *   {{total}}              — formatted grand total
 *   {{currency_symbol}}    — e.g. €
 *   {{reverse_charge_row}} — empty or a VAT-0 note row
 *   {{notes}}              — footer / legal text
 */
export const DEFAULT_INVOICE_TEMPLATE = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{document_title}} {{invoice_number}}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --gold:      #b8963e;
      --gold-lt:   #d4af6a;
      --ink:       #1a1410;
      --ink-soft:  #4a4035;
      --dust:      #7a7065;
      --rule:      #e8e0d4;
      --bg:        #fdfcfa;
      --bg-accent: #f7f3ee;
    }

    body {
      font-family: 'Inter', 'Helvetica Neue', sans-serif;
      font-size: 12.5px;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.6;
    }

    .page {
      max-width: 860px;
      margin: 0 auto;
      padding: 56px 60px 64px;
      background: #fff;
    }

    /* ── Decorative top bar ── */
    .top-bar {
      height: 4px;
      background: linear-gradient(90deg, var(--gold) 0%, var(--gold-lt) 60%, transparent 100%);
      margin-bottom: 44px;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 52px;
    }

    .brand {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .brand-name {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink);
      line-height: 1;
    }
    .brand-tagline {
      font-size: 9.5px;
      font-weight: 400;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--gold);
      margin-top: 3px;
    }
    .company-details {
      margin-top: 14px;
      color: var(--dust);
      line-height: 1.8;
      font-size: 11.5px;
    }

    .invoice-badge {
      text-align: right;
    }
    .invoice-word {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 36px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--ink);
      line-height: 1;
    }
    .invoice-meta-line {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 3px;
    }
    .invoice-number {
      font-size: 13px;
      font-weight: 600;
      color: var(--gold);
      letter-spacing: 0.05em;
    }
    .invoice-date {
      font-size: 11.5px;
      color: var(--dust);
    }

    /* ── Divider ── */
    .divider {
      height: 1px;
      background: linear-gradient(90deg, var(--gold) 0%, var(--rule) 40%, transparent 100%);
      margin-bottom: 36px;
    }

    /* ── Addresses ── */
    .addresses {
      display: flex;
      gap: 0;
      margin-bottom: 44px;
    }
    .address-block {
      flex: 1;
    }
    .address-block + .address-block {
      border-left: 1px solid var(--rule);
      padding-left: 32px;
      margin-left: 32px;
    }
    .address-label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--gold);
      margin-bottom: 10px;
    }
    .address-name {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 17px;
      font-weight: 600;
      color: var(--ink);
      margin-bottom: 4px;
      line-height: 1.2;
    }
    .address-details {
      color: var(--ink-soft);
      line-height: 1.8;
      font-size: 11.5px;
    }
    .vat-tag {
      display: inline-block;
      margin-top: 6px;
      font-size: 10px;
      color: var(--dust);
      border: 1px solid var(--rule);
      border-radius: 3px;
      padding: 1px 6px;
    }

    /* ── Line items table ── */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 36px;
    }
    .items-table thead tr {
      background: var(--bg-accent);
      border-top: 1px solid var(--rule);
      border-bottom: 1px solid var(--rule);
    }
    .items-table th {
      padding: 9px 14px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: var(--gold);
      text-align: left;
    }
    .items-table th:last-child { text-align: right; }
    .items-table th.center     { text-align: center; }

    .items-table td {
      padding: 14px 14px;
      border-bottom: 1px solid var(--rule);
      color: var(--ink-soft);
      font-size: 12.5px;
      vertical-align: top;
    }
    .items-table td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    .items-table td.center     { text-align: center; }

    .item-name {
      font-weight: 500;
      color: var(--ink);
      font-size: 13px;
    }
    .item-note {
      font-size: 11px;
      color: var(--dust);
      margin-top: 2px;
    }

    /* ── Totals ── */
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 48px;
    }
    .totals {
      width: 300px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 12.5px;
      color: var(--ink-soft);
    }
    .totals-row.sep {
      border-top: 1px solid var(--rule);
      margin-top: 8px;
      padding-top: 12px;
    }
    .totals-row.total {
      border-top: 2px solid var(--gold);
      margin-top: 8px;
      padding-top: 12px;
      font-weight: 600;
      font-size: 15px;
      color: var(--ink);
    }
    .totals-row.rc {
      font-size: 10.5px;
      color: var(--dust);
      font-style: italic;
      margin-top: 8px;
    }

    /* ── Footer ── */
    .footer {
      border-top: 1px solid var(--rule);
      padding-top: 24px;
      margin-top: 8px;
    }
    .footer-inner {
      display: flex;
      gap: 48px;
      font-size: 10.5px;
      color: var(--dust);
      line-height: 1.9;
    }
    .footer-col { flex: 1; }
    .footer-col-label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--gold);
      margin-bottom: 6px;
    }
    .legal-notes {
      margin-top: 18px;
      font-size: 11.5px;
      color: var(--ink-soft);
    }
    .legal-notes p { margin-bottom: 4px; }
    .footer-notes {
      margin-top: 20px;
      font-size: 10px;
      color: var(--dust);
      line-height: 1.8;
    }

    /* ── Bottom accent ── */
    .bottom-bar {
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, var(--gold-lt) 40%, var(--gold) 100%);
      margin-top: 40px;
    }

    /* ── Print ── */
    @media print {
      body  { background: #fff; }
      .page { padding: 0; box-shadow: none; }
      @page { margin: 16mm 18mm; size: A4; }
    }
  </style>
</head>
<body>
<div class="page">

  <div class="top-bar"></div>

  <!-- ── Header ─────────────────────────────────────────── -->
  <div class="header">
    <div class="brand">
      <div class="brand-name">{{company_name}}</div>
      <div class="brand-tagline">Premium Online Education</div>
      <div class="company-details">
        {{company_address}}<br>
        {{company_vat_id}}<br>
        {{company_email}}
      </div>
    </div>
    <div class="invoice-badge">
      <div class="invoice-word">{{document_title}}</div>
      <div class="invoice-meta-line">
        <span class="invoice-number">{{invoice_number}}</span>
        <span class="invoice-date">{{invoice_date}}</span>
      </div>
      <div class="invoice-meta-line">
        <span class="invoice-date">Leistungsdatum: {{service_date}}</span>
      </div>
    </div>
  </div>

  <div class="divider"></div>

  <!-- ── Addresses ──────────────────────────────────────── -->
  <div class="addresses">
    <div class="address-block">
      <div class="address-label">Rechnungssteller</div>
      <div class="address-name">{{company_name}}</div>
      <div class="address-details">{{company_address}}</div>
    </div>
    <div class="address-block">
      <div class="address-label">Rechnungsempfänger</div>
      <div class="address-name">{{customer_name}}</div>
      <div class="address-details">
        {{customer_address}}<br>
        {{customer_email}}
        {{customer_vat_id_row}}
      </div>
    </div>
  </div>

  <!-- ── Line items ─────────────────────────────────────── -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:52%">Leistung</th>
        <th class="center" style="width:13%">Menge</th>
        <th style="width:17%;text-align:right">Einzelpreis</th>
        <th style="width:18%">Betrag</th>
      </tr>
    </thead>
    <tbody>
      {{items_rows}}
    </tbody>
  </table>

  <!-- ── Totals ─────────────────────────────────────────── -->
  <div class="totals-wrap">
    <div class="totals">
      <div class="totals-row sep">
        <span>Nettobetrag</span>
        <span>{{subtotal}} {{currency_symbol}}</span>
      </div>
      {{vat_row}}
      <div class="totals-row total">
        <span>Gesamtbetrag</span>
        <span>{{total}} {{currency_symbol}}</span>
      </div>
      {{reverse_charge_row}}
    </div>
  </div>

  <div class="legal-notes">
    <p>{{reference_note}}</p>
    <p>{{tax_note}}</p>
    <p>{{payment_note}}</p>
  </div>

  <!-- ── Footer ─────────────────────────────────────────── -->
  <div class="footer">
    <div class="footer-inner">
      <div class="footer-col">
        <div class="footer-col-label">Zahlung</div>
        {{payment_note}}
      </div>
      <div class="footer-col">
        <div class="footer-col-label">Kontakt</div>
        {{company_email}}<br>
        {{company_phone}}
      </div>
      <div class="footer-col">
        <div class="footer-col-label">Steuer</div>
        {{company_vat_id}}<br>
        {{company_tax_number}}
      </div>
    </div>
    <div class="footer-notes">{{company_legal}}</div>
    <div class="footer-notes">{{notes}}</div>
  </div>

  <div class="bottom-bar"></div>

</div>
</body>
</html>`;

/** Template variables with their descriptions — used in the admin editor hint panel. */
export const TEMPLATE_VARIABLES = [
	{ name: '{{document_title}}',   desc: 'Rechnung / Rechnungskorrektur' },
	{ name: '{{invoice_number}}',   desc: 'Rechnungsnummer, z.B. INV-2026-0001' },
	{ name: '{{service_date}}',     desc: 'Leistungsdatum (Pflichtangabe)' },
	{ name: '{{reference_note}}',   desc: 'Bei Korrekturen: Bezug auf die Originalrechnung' },
	{ name: '{{tax_note}}',         desc: 'Steuerhinweis (Reverse Charge, § 19, Drittland, OSS)' },
	{ name: '{{payment_note}}',     desc: 'Zahlungsvermerk, z.B. „Bezahlt am … per Stripe“' },
	{ name: '{{company_tax_number}}', desc: 'Steuernummer der Firma' },
	{ name: '{{company_legal}}',    desc: 'Geschäftsführung / Handelsregister' },
	{ name: '{{invoice_date}}',     desc: 'Rechnungsdatum' },
	{ name: '{{company_name}}',     desc: 'Firmenname (aus Einstellungen)' },
	{ name: '{{company_address}}',  desc: 'Firmenadresse (mehrzeilig)' },
	{ name: '{{company_vat_id}}',   desc: 'USt-IdNr. der Firma' },
	{ name: '{{company_email}}',    desc: 'E-Mail der Firma' },
	{ name: '{{company_phone}}',    desc: 'Telefon der Firma' },
	{ name: '{{customer_name}}',    desc: 'Name des Kunden' },
	{ name: '{{customer_email}}',   desc: 'E-Mail des Kunden' },
	{ name: '{{customer_address}}', desc: 'Adresse des Kunden (mehrzeilig)' },
	{ name: '{{customer_vat_id_row}}', desc: 'USt-IdNr. Zeile (leer wenn nicht vorhanden)' },
	{ name: '{{items_rows}}',       desc: 'HTML-Tabellenzeilen der Positionen' },
	{ name: '{{subtotal}}',         desc: 'Nettobetrag' },
	{ name: '{{vat_rate}}',         desc: 'MwSt-Prozentsatz, z.B. 19' },
	{ name: '{{vat_amount}}',       desc: 'MwSt-Betrag' },
	{ name: '{{vat_row}}',          desc: 'MwSt-Zeile (leer bei Reverse Charge)' },
	{ name: '{{total}}',            desc: 'Gesamtbetrag (brutto)' },
	{ name: '{{currency_symbol}}',  desc: 'Währungssymbol, z.B. €' },
	{ name: '{{reverse_charge_row}}', desc: 'Hinweiszeile wenn Reverse Charge gilt' },
	{ name: '{{notes}}',            desc: 'Fußtext / Rechtliche Hinweise' },
];

/**
 * Placeholders a custom template must contain — without them the invoice would lack
 * mandatory information (§ 14 Abs. 4 UStG) or the tax note required for 0 % VAT.
 */
export const REQUIRED_TEMPLATE_VARIABLES = [
	'document_title', 'invoice_number', 'invoice_date', 'service_date',
	'company_name', 'company_address', 'company_vat_id', 'company_tax_number',
	'customer_name', 'customer_address', 'customer_vat_id_row',
	'items_rows', 'subtotal', 'vat_row', 'total', 'tax_note', 'reference_note',
];
