/**
 * Mundial '26 — free email reminders via Gmail + Apps Script.
 * No OAuth client, no SMTP creds, no Telegram needed.
 *
 * Setup (2 min):
 *   1. https://script.google.com → New project → paste this file.
 *   2. Fill APP_URL + CRON_SECRET below (CRON_SECRET is in your .env / Coolify env).
 *   3. Run `sendReminders` once → click "Authorize" (lets it send mail as you).
 *   4. Left sidebar → Triggers (alarm clock) → Add trigger →
 *        function: sendReminders · event source: Time-driven · Hour timer · Every hour.
 *   Done. Every hour it emails whoever still owes picks on matches within 6h.
 */

const APP_URL = 'https://YOUR_DOMAIN';      // e.g. https://mundial.example.com
const CRON_SECRET = 'PASTE_YOUR_CRON_SECRET';

function sendReminders() {
  const url = APP_URL + '/api/cron/reminders?secret=' + encodeURIComponent(CRON_SECRET);
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    Logger.log('reminders endpoint returned ' + res.getResponseCode());
    return;
  }

  const data = JSON.parse(res.getContentText());
  const recipients = data.recipients || [];
  const betUrl = data.betUrl || (APP_URL + '/bet');

  recipients.forEach(function (r) {
    const items = r.lines.map(function (l) { return '<li>' + l + '</li>'; }).join('');
    const html =
      '<div style="font-family:system-ui,Arial;max-width:480px">' +
      '<h2>⚽ Bets closing soon!</h2>' +
      '<p>Hi ' + r.name + ', you still owe picks on:</p>' +
      '<ul>' + items + '</ul>' +
      '<p><a href="' + betUrl + '" style="background:#16a34a;color:#fff;padding:10px 16px;' +
      'border-radius:8px;text-decoration:none;display:inline-block">Place your picks →</a></p>' +
      '</div>';

    GmailApp.sendEmail(
      r.email,
      "⚽ Mundial '26 — " + r.count + ' bet' + (r.count === 1 ? '' : 's') + ' closing soon',
      'You still owe picks. Open ' + betUrl,
      { htmlBody: html, name: "Mundial '26" }
    );
  });

  Logger.log('emailed ' + recipients.length + ' player(s)');
}
