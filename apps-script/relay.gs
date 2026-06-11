/**
 * Mundial '26 — Gmail relay (triggerless Web App).
 *
 * This script has ONE job: receive emails over HTTPS and send them via your
 * Gmail. No logic, no schedule, no triggers. The app's Coolify cron does all
 * the thinking and POSTs ready-to-send emails here.
 *
 * Setup (once, ~2 min):
 *   1. https://script.google.com → New project → paste this file.
 *   2. Set CRON_SECRET below to the same value as the app's CRON_SECRET env.
 *   3. Deploy → New deployment → type "Web app".
 *        Execute as: Me · Who has access: Anyone
 *      Click Deploy, click "Authorize access", allow Gmail.
 *   4. Copy the Web app URL (…/exec) and send it to me — it becomes the app's
 *      APPSCRIPT_WEBAPP_URL env var. Done. Never touch this again.
 *
 * Payload (POST JSON):
 *   { secret, emails: [ { id, to:[...], subject, html } ] }
 * Response:
 *   { sent: [id, ...] }   // ids that were actually delivered
 */
const CRON_SECRET = 'PASTE_YOUR_CRON_SECRET';

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ error: 'bad json' });
  }
  if (body.secret !== CRON_SECRET) {
    return json({ error: 'unauthorized' });
  }

  var emails = body.emails || [];
  var sent = [];
  for (var i = 0; i < emails.length; i++) {
    var m = emails[i];
    var to = (m.to || []).join(',');
    if (!to) continue;
    /* never blow up the daily Gmail quota mid-send */
    if (MailApp.getRemainingDailyQuota() < (m.to || []).length) break;
    try {
      GmailApp.sendEmail(to, m.subject, 'Open the app to see this email.', {
        htmlBody: m.html,
        name: "Mundial '26",
      });
      sent.push(m.id);
    } catch (err) {
      /* skip this one, leave it unsent so the app retries next tick */
    }
  }
  return json({ sent: sent });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
