/**
 * Email "views" – the V of MVC on the API side. Plain HTML strings with inline styles
 * so they render consistently in Gmail/Outlook.
 */
import { env } from "../../config/env.js";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function layout(title: string, body: string) {
  return `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td style="background:#0d9488;padding:20px 28px;color:#fff;font-size:22px;font-weight:700">💊 SmartMed</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 16px;font-size:20px">${escape(title)}</h1>
        ${body}
      </td></tr>
      <tr><td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px">
        You received this email because you have a SmartMed account. Never share your codes with anyone.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${escape(label)}</a>`;

export const emailTemplates = {
  otp(name: string, code: string, purpose: "EMAIL_VERIFY" | "PASSWORD_RESET") {
    const title = purpose === "EMAIL_VERIFY" ? "Verify your email" : "Reset your password";
    const intro =
      purpose === "EMAIL_VERIFY"
        ? "Use the code below to verify your email address."
        : "Use the code below to reset your password. If you did not request this, you can ignore this email.";
    return {
      subject: `${code} is your SmartMed ${purpose === "EMAIL_VERIFY" ? "verification" : "password reset"} code`,
      html: layout(
        title,
        `<p>Hi ${escape(name)},</p><p>${intro}</p>
         <p style="font-size:34px;letter-spacing:8px;font-weight:700;background:#f0fdfa;border-radius:12px;padding:16px;text-align:center">${code}</p>
         <p style="color:#64748b">This code expires in 10 minutes.</p>`,
      ),
    };
  },

  careInvite(patientName: string, relation: string | null | undefined, hasAccount: boolean) {
    const href = `${env.CLIENT_URL}/${hasAccount ? "dashboard/care" : "register?role=CAREGIVER"}`;
    return {
      subject: `${patientName} invited you to be their caregiver on SmartMed`,
      html: layout(
        "You have a caregiver invitation",
        `<p><strong>${escape(patientName)}</strong> has invited you${relation ? ` (as their ${escape(relation)})` : ""} to monitor their medicine schedule on SmartMed.</p>
         <p>As a caregiver you will see whether doses were taken and receive an alert when a dose is missed.</p>
         <p>${button(href, hasAccount ? "Review invitation" : "Create caregiver account")}</p>`,
      ),
    };
  },

  missedDoses(caregiverName: string, patientName: string, doses: { medicine: string; time: string }[]) {
    const rows = doses
      .map((d) => `<li style="margin-bottom:6px"><strong>${escape(d.medicine)}</strong> — scheduled at ${escape(d.time)}</li>`)
      .join("");
    return {
      subject: `⚠️ ${patientName} missed ${doses.length} medicine dose${doses.length > 1 ? "s" : ""}`,
      html: layout(
        "Action alert: missed dose",
        `<p>Hi ${escape(caregiverName)},</p>
         <p><strong>${escape(patientName)}</strong> has not confirmed the following dose(s):</p>
         <ul>${rows}</ul>
         <p>You may want to give them a call.</p>
         <p>${button(`${env.CLIENT_URL}/dashboard/care`, "Open caregiver dashboard")}</p>`,
      ),
    };
  },

  expiryAlert(name: string, items: { name: string; expiry: string; expired: boolean }[]) {
    const rows = items
      .map(
        (i) =>
          `<li style="margin-bottom:6px"><strong>${escape(i.name)}</strong> — ${i.expired ? "<span style='color:#dc2626'>expired</span>" : "expires"} on ${escape(i.expiry)}</li>`,
      )
      .join("");
    return {
      subject: "⏳ Medicines in your cabinet are expiring",
      html: layout(
        "Expiry alert",
        `<p>Hi ${escape(name)},</p><p>The following medicines should be disposed of safely:</p><ul>${rows}</ul>
         <p>${button(`${env.CLIENT_URL}/dashboard/cabinet`, "Open medicine cabinet")}</p>`,
      ),
    };
  },

  issuedPrescription(patientName: string, issuerName: string, link: string) {
    return {
      subject: `${issuerName} sent you a prescription on SmartMed`,
      html: layout(
        "Your prescription is ready",
        `<p>Hi ${escape(patientName)},</p>
         <p><strong>${escape(issuerName)}</strong> sent you a digital prescription. Add it to SmartMed to get medicine reminders in Bangla.</p>
         <p>${button(link, "Add to my SmartMed")}</p>
         <p style="color:#64748b">You will be asked to log in or create a free account first.</p>`,
      ),
    };
  },

  paymentSuccess(name: string, amount: string, until: string) {
    return {
      subject: "🎉 SmartMed Premium activated",
      html: layout(
        "Thank you for upgrading!",
        `<p>Hi ${escape(name)},</p><p>We received your payment of <strong>${escape(amount)}</strong>. Premium is active until <strong>${escape(until)}</strong>.</p>
         <p>${button(`${env.CLIENT_URL}/dashboard/billing`, "View billing")}</p>`,
      ),
    };
  },
};
