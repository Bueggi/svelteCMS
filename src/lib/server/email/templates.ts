import { env } from '$env/dynamic/private';

const BASE_URL = env.BETTER_AUTH_URL || 'http://localhost:5173';
const APP_NAME = env.APP_NAME || 'Course Platform';
const PRIMARY = '#c07a5a'; // warm gold-brown

function layout(content: string) {
    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f9f6f2;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f2;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#1a1410;padding:28px 40px;border-radius:12px 12px 0 0;">
          <p style="margin:0;color:#e8d5c4;font-size:20px;font-weight:bold;letter-spacing:1px;">${APP_NAME}</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px;border-left:1px solid #ede8e2;border-right:1px solid #ede8e2;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f2ece5;padding:24px 40px;border-radius:0 0 12px 12px;border:1px solid #ede8e2;border-top:none;">
          <p style="margin:0;color:#9c8878;font-size:12px;text-align:center;">
            © ${new Date().getFullYear()} ${APP_NAME} · <a href="${BASE_URL}" style="color:${PRIMARY};text-decoration:none;">Website besuchen</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, url: string) {
    return `<a href="${url}" style="display:inline-block;background:${PRIMARY};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:bold;letter-spacing:0.5px;margin:8px 0;">${text}</a>`;
}

function h1(text: string) {
    return `<h1 style="margin:0 0 16px;color:#1a1410;font-size:26px;font-weight:bold;line-height:1.3;">${text}</h1>`;
}

function p(text: string) {
    return `<p style="margin:0 0 16px;color:#4a3728;font-size:15px;line-height:1.7;">${text}</p>`;
}

function divider() {
    return `<hr style="border:none;border-top:1px solid #ede8e2;margin:24px 0;" />`;
}

// ─── Account ──────────────────────────────────────────────────────────────────

export function welcomeEmail({ name, loginUrl }: { name: string; loginUrl: string }) {
    return layout(`
        ${h1(`Willkommen, ${name}! 🎉`)}
        ${p(`Schön, dass du dabei bist. Dein Account bei <strong>${APP_NAME}</strong> ist jetzt aktiv.`)}
        ${p('Melde dich an und starte mit deinen Kursen:')}
        ${btn('Jetzt einloggen', loginUrl)}
        ${divider()}
        ${p(`Falls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.`)}
    `);
}

export function emailVerificationEmail({ name, verifyUrl }: { name: string; verifyUrl: string }) {
    return layout(`
        ${h1('E-Mail-Adresse bestätigen')}
        ${p(`Hallo ${name},`)}
        ${p('Bitte bestätige deine E-Mail-Adresse, um deinen Account vollständig zu aktivieren. Der Link ist 24 Stunden gültig.')}
        ${btn('E-Mail bestätigen', verifyUrl)}
        ${divider()}
        ${p('Falls du dich nicht registriert hast, ignoriere bitte diese E-Mail.')}
    `);
}

export function passwordResetEmail({ name, resetUrl }: { name: string; resetUrl: string }) {
    return layout(`
        ${h1('Passwort zurücksetzen')}
        ${p(`Hallo ${name},`)}
        ${p('Wir haben eine Anfrage erhalten, dein Passwort zurückzusetzen. Klicke auf den Button — der Link ist <strong>1 Stunde</strong> gültig.')}
        ${btn('Passwort zurücksetzen', resetUrl)}
        ${divider()}
        ${p('Falls du kein neues Passwort angefordert hast, kannst du diese E-Mail ignorieren. Dein aktuelles Passwort bleibt unverändert.')}
    `);
}

// ─── Commerce ─────────────────────────────────────────────────────────────────

export function enrollmentConfirmEmail({
    name,
    courseTitle,
    courseSlug,
    amount,
}: {
    name: string;
    courseTitle: string;
    courseSlug: string;
    amount: number;
}) {
    const learnUrl = `${BASE_URL}/courses/${courseSlug}/learn`;
    const amountStr = amount > 0 ? `€${(amount / 100).toFixed(2).replace('.', ',')}` : 'Kostenlos';

    return layout(`
        ${h1(`Kauf bestätigt! ✅`)}
        ${p(`Hallo ${name},`)}
        ${p(`Vielen Dank für deinen Kauf. Du hast jetzt Zugang zu:`)}
        <div style="background:#f9f6f2;border-left:4px solid ${PRIMARY};padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
          <p style="margin:0;font-size:17px;font-weight:bold;color:#1a1410;">${courseTitle}</p>
          <p style="margin:4px 0 0;color:#9c8878;font-size:13px;">Bezahlt: ${amountStr} · Lebenslanger Zugang</p>
        </div>
        ${btn('Jetzt lernen →', learnUrl)}
        ${divider()}
        ${p('Falls du Fragen hast, antworte einfach auf diese E-Mail.')}
    `);
}

export function enrollmentRevokedEmail({
    name,
    courseTitle,
    reason,
}: {
    name: string;
    courseTitle: string;
    reason: 'refund' | 'manual' | 'expired';
}) {
    const reasonText = {
        refund: 'Dein Kauf wurde erstattet.',
        manual: 'Dein Zugang wurde vom Administrator entfernt.',
        expired: 'Dein Zugang ist abgelaufen.',
    }[reason];

    return layout(`
        ${h1('Kurszugang wurde beendet')}
        ${p(`Hallo ${name},`)}
        ${p(`Dein Zugang zum Kurs <strong>${courseTitle}</strong> wurde beendet.`)}
        ${p(reasonText)}
        ${divider()}
        ${p(`Falls du glaubst, dass dies ein Fehler ist, antworte bitte auf diese E-Mail.`)}
        ${btn('Kurs erneut kaufen', `${BASE_URL}/courses`)}
    `);
}

export function refundConfirmEmail({
    name,
    courseTitle,
    amount,
}: {
    name: string;
    courseTitle: string;
    amount: number;
}) {
    const amountStr = `€${(amount / 100).toFixed(2).replace('.', ',')}`;
    return layout(`
        ${h1('Rückerstattung bestätigt')}
        ${p(`Hallo ${name},`)}
        ${p(`Deine Rückerstattung für <strong>${courseTitle}</strong> wurde verarbeitet.`)}
        <div style="background:#f9f6f2;border-left:4px solid #22c55e;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
          <p style="margin:0;font-size:17px;font-weight:bold;color:#1a1410;">Erstattet: ${amountStr}</p>
          <p style="margin:4px 0 0;color:#9c8878;font-size:13px;">Es kann 5–10 Werktage dauern, bis der Betrag auf deinem Konto erscheint.</p>
        </div>
        ${divider()}
        ${p('Falls du Fragen hast, antworte einfach auf diese E-Mail.')}
    `);
}

// ─── Drip ─────────────────────────────────────────────────────────────────────

export function lessonUnlockedEmail({
    name,
    lessonTitle,
    courseTitle,
    courseSlug,
    lessonId,
}: {
    name: string;
    lessonTitle: string;
    courseTitle: string;
    courseSlug: string;
    lessonId: string;
}) {
    const url = `${BASE_URL}/courses/${courseSlug}/learn/${lessonId}`;
    return layout(`
        ${h1(`Neue Lektion freigeschaltet! 🔓`)}
        ${p(`Hallo ${name},`)}
        ${p(`Eine neue Lektion in <strong>${courseTitle}</strong> wartet auf dich:`)}
        <div style="background:#f9f6f2;border-left:4px solid ${PRIMARY};padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
          <p style="margin:0;font-size:17px;font-weight:bold;color:#1a1410;">${lessonTitle}</p>
        </div>
        ${btn('Lektion starten →', url)}
    `);
}
