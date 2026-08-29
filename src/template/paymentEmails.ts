import {
  detailBox,
  detailRow,
  formatEmailDate,
  getFirstName,
  paymentEmailLayout,
} from './paymentEmailLayout.js';

export interface PaymentEmailContent {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

const PLAN_NAME = 'ChurchEden Plus';
const PLAN_AMOUNT = 'GH¢20';

export const chargeSuccessEmail = (
  fullName: string | null | undefined,
  appUrl: string,
): PaymentEmailContent => {
  const firstName = getFirstName(fullName);
  const subject = 'You\'re on ChurchEden Plus';
  const preheader = 'Your place is ready. Let\'s run your ministry together.';

  const bodyHtml = `
    <tr><td style="padding-bottom:16px;">
      <h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-size:28px;font-weight:700;color:#242019;line-height:1.15;letter-spacing:-0.5px;">
        Welcome to ChurchEden,<br/><span style="color:#C29A3B;">${firstName}</span>
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:20px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
        Payment confirmed — you're officially on ChurchEden Plus. Members, tithes, events, and giving, all in one calm, beautiful place made for your church.
      </p>
    </td></tr>
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
        No more scattered spreadsheets or missed records. Open the dashboard and let ChurchEden show you exactly what's happening across your church.
      </p>
    </td></tr>
  `;

  const text = `Welcome to ChurchEden Plus, ${firstName}!

Payment confirmed — you're officially on ChurchEden Plus. Members, tithes, events, and giving, all in one calm, beautiful place made for your church.

No more scattered spreadsheets or missed records. Open the dashboard and get started.

Get Started →
${appUrl}

— The ChurchEden Team`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Plus', preheader, bodyHtml, '— The ChurchEden Team', 'Get Started →', appUrl),
    text,
  };
};

export const chargeFailedEmail = (
  fullName: string | null | undefined,
  appUrl: string,
): PaymentEmailContent => {
  const firstName = getFirstName(fullName);
  const subject = "Payment didn't go through";
  const preheader = 'Quick fix — try again in under a minute.';

  const bodyHtml = `
    <tr><td style="padding-bottom:16px;">
      <h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:700;color:#242019;line-height:1.15;letter-spacing:-0.5px;">
        Hey ${firstName}, your payment didn't go through
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:20px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
        We tried to charge your card for ${PLAN_NAME} (${PLAN_AMOUNT}/month) but it was declined. Don't worry — your account wasn't charged.
      </p>
    </td></tr>
    <tr><td style="padding-bottom:12px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;color:#2A241D;">Common reasons</p>
    </td></tr>
    <tr><td style="padding-bottom:24px;">
      <ul style="margin:0;padding-left:20px;font-family:'Inter',Arial,sans-serif;font-size:14px;line-height:1.8;color:#5A564E;">
        <li>Insufficient funds on your card or mobile money</li>
        <li>Incorrect card number, expiry date, or CVV</li>
        <li>Bank security block — try again or use a different method</li>
      </ul>
    </td></tr>
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
        ChurchEden Plus is one tap away. Give it another shot and we'll take care of the rest.
      </p>
    </td></tr>
  `;

  const text = `Hey ${firstName}, your payment didn't go through

We tried to charge your card for ${PLAN_NAME} (${PLAN_AMOUNT}/month) but it was declined. Don't worry — your account wasn't charged.

Common reasons:
- Insufficient funds on your card or mobile money
- Incorrect card number, expiry date, or CVV
- Bank security block — try again or use a different method

Try Again →
${appUrl}

— The ChurchEden Team`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Payment', preheader, bodyHtml, '— The ChurchEden Team', 'Try Again →', appUrl),
    text,
  };
};

export const subscriptionCreateEmail = (
  fullName: string | null | undefined,
  nextBillingDate: Date,
  appUrl: string,
): PaymentEmailContent => {
  const firstName = getFirstName(fullName);
  const formattedDate = formatEmailDate(nextBillingDate);
  const subject = 'ChurchEden Plus subscription is live';
  const preheader = `${PLAN_AMOUNT}/month — next bill on ${formattedDate}.`;

  const bodyHtml = `
    <tr><td style="padding-bottom:16px;">
      <h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:700;color:#242019;line-height:1.15;letter-spacing:-0.5px;">
        You're subscribed, ${firstName}
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
        Your ChurchEden Plus subscription is set up and auto-renews monthly. Here's what's on your account:
      </p>
    </td></tr>
    ${detailBox(
      detailRow('Plan', PLAN_NAME) +
      detailRow('Amount', `${PLAN_AMOUNT}/month`) +
      detailRow('Next billing date', formattedDate, true),
    )}
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
        You can manage your subscription anytime from your dashboard. Your ministry is in good hands.
      </p>
    </td></tr>
  `;

  const text = `You're subscribed, ${firstName}!

Plan: ${PLAN_NAME}
Amount: ${PLAN_AMOUNT}/month
Next billing: ${formattedDate}

Go to Dashboard →
${appUrl}

— The ChurchEden Team`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Subscription', preheader, bodyHtml, '— The ChurchEden Team', 'Go to Dashboard →', appUrl),
    text,
  };
};

export const invoiceRenewalSuccessEmail = (
  fullName: string | null | undefined,
  nextBillingDate: Date,
  appUrl: string,
): PaymentEmailContent => {
  const firstName = getFirstName(fullName);
  const formattedDate = formatEmailDate(nextBillingDate);
  const subject = 'ChurchEden Plus renewed — you\'re good to go';
  const preheader = `${PLAN_AMOUNT} charged. Next renewal: ${formattedDate}.`;

  const bodyHtml = `
    <tr><td style="padding-bottom:16px;">
      <h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:700;color:#242019;line-height:1.15;letter-spacing:-0.5px;">
        Renewed and ready, ${firstName}
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:20px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
        Your ChurchEden Plus subscription renewed successfully. ${PLAN_AMOUNT} has been charged to your payment method.
      </p>
    </td></tr>
    ${detailBox(
      detailRow('Amount charged', PLAN_AMOUNT) +
      detailRow('Next renewal', formattedDate, true),
    )}
    <tr><td style="padding-bottom:12px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;color:#2A241D;">You still have full access to</p>
    </td></tr>
    <tr><td style="padding-bottom:24px;">
      <ul style="margin:0;padding-left:20px;font-family:'Inter',Arial,sans-serif;font-size:14px;line-height:1.8;color:#5A564E;">
        <li>Member, department &amp; group management</li>
        <li>Tithe &amp; offering records with reports</li>
        <li>Events, services &amp; communication tools</li>
      </ul>
    </td></tr>
  `;

  const text = `Renewed and ready, ${firstName}!

Amount charged: ${PLAN_AMOUNT}
Next renewal: ${formattedDate}

Keep Serving →
${appUrl}

— The ChurchEden Team`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Renewal', preheader, bodyHtml, '— The ChurchEden Team', 'Keep Serving →', appUrl),
    text,
  };
};

export const invoicePaymentFailedEmail = (
  fullName: string | null | undefined,
  graceEndDate: Date,
  appUrl: string,
): PaymentEmailContent => {
  const firstName = getFirstName(fullName);
  const formattedGraceEnd = formatEmailDate(graceEndDate);
  const subject = 'Renewal failed — act within 3 days';
  const preheader = `Update your payment by ${formattedGraceEnd} to keep ChurchEden Plus.`;

  const bodyHtml = `
    <tr><td style="padding-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDF3F3;border:1px solid #F3D8D8;border-radius:10px;">
        <tr><td style="padding:13px 16px;">
          <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:600;color:#B5382A;">Action required — your ${PLAN_NAME} renewal failed</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding-bottom:16px;">
      <h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:700;color:#242019;line-height:1.15;letter-spacing:-0.5px;">
        ${firstName}, we couldn't renew your subscription
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
        We tried to charge ${PLAN_AMOUNT} for your monthly plan but the payment failed. Your access is still active — for now. You have a <strong style="color:#B3862E;">3-day grace period</strong> ending <strong>${formattedGraceEnd}</strong>. Update your payment details before then or you'll lose access to ChurchEden Plus features.
      </p>
    </td></tr>
  `;

  const text = `ACTION REQUIRED — Your ${PLAN_NAME} renewal failed

${firstName}, we couldn't renew your subscription.

We tried to charge ${PLAN_AMOUNT} but the payment failed. Your access is still active — for now.

Grace period ends: ${formattedGraceEnd}

Update Payment Details →
${appUrl}

— The ChurchEden Team`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Urgent', preheader, bodyHtml, '— The ChurchEden Team', 'Update Payment Details →', appUrl),
    text,
  };
};

export const subscriptionDisableEmail = (
  fullName: string | null | undefined,
  expiryDate: Date,
  appUrl: string,
): PaymentEmailContent => {
  const firstName = getFirstName(fullName);
  const formattedExpiry = formatEmailDate(expiryDate);
  const subject = 'Your ChurchEden Plus plan has ended';
  const preheader = `Access ends ${formattedExpiry}. The door's always open.`;

  const bodyHtml = `
    <tr><td style="padding-bottom:16px;">
      <h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:700;color:#242019;line-height:1.15;letter-spacing:-0.5px;">
        Sorry to see you go, ${firstName}
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:20px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
        Your ChurchEden Plus subscription has been cancelled. No further charges will be made to your account.
      </p>
    </td></tr>
    ${detailBox(detailRow('Access ends', formattedExpiry, true))}
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
        Your ministry doesn't wait, and neither should your records. Whenever you're ready to come back, ChurchEden Plus is ${PLAN_AMOUNT}/month — same great features, zero hassle to resubscribe.
      </p>
    </td></tr>
  `;

  const text = `Sorry to see you go, ${firstName}

Your ChurchEden Plus subscription has been cancelled. No further charges will be made.

Access ends: ${formattedExpiry}

Resubscribe Anytime →
${appUrl}

— The ChurchEden Team`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Cancelled', preheader, bodyHtml, '— The ChurchEden Team', 'Resubscribe Anytime →', appUrl),
    text,
  };
};

export const subscriptionNotRenewEmail = (
  fullName: string | null | undefined,
  expiryDate: Date,
  appUrl: string,
): PaymentEmailContent => {
  const firstName = getFirstName(fullName);
  const formattedExpiry = formatEmailDate(expiryDate);
  const subject = `Auto-renew is off — access till ${formattedExpiry}`;
  const preheader = 'You can turn it back on anytime from your dashboard.';

  const bodyHtml = `
    <tr><td style="padding-bottom:16px;">
      <h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:700;color:#242019;line-height:1.15;letter-spacing:-0.5px;">
        Got it, ${firstName} — auto-renew is off
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:20px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
        You've turned off auto-renewal for your ChurchEden Plus plan. We respect the choice — no hard feelings.
      </p>
    </td></tr>
    ${detailBox(
      detailRow('Your access continues until', formattedExpiry, true) +
      detailRow('After that', 'ChurchEden Plus features lock'),
    )}
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
        Changed your mind? Flip auto-renew back on from your dashboard and you won't miss a beat. Your records will still be here when you're ready.
      </p>
    </td></tr>
  `;

  const text = `Got it, ${firstName} — auto-renew is off

Your access continues until: ${formattedExpiry}
After that: ChurchEden Plus features lock

Turn Auto-Renew Back On →
${appUrl}

— The ChurchEden Team`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Subscription', preheader, bodyHtml, '— The ChurchEden Team', 'Turn Auto-Renew Back On →', appUrl),
    text,
  };
};
