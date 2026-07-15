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

const EINSTEIN_AMOUNT = 'GH¢20';

export const chargeSuccessEmail = (
  fullName: string | null | undefined,
  appUrl: string,
): PaymentEmailContent => {
  const firstName = getFirstName(fullName);
  const subject = "You're in. Einstein unlocked 🦝";
  const preheader = 'Remi is ready. Let\'s get you exam-ready.';

  const bodyHtml = `
    <tr><td style="padding-bottom:12px;">
      <h1 style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:26px;font-weight:800;color:#0D0618;line-height:1.2;letter-spacing:-0.5px;">
        Welcome to Einstein,<br/><span style="color:#7C3AED;">${firstName}</span>! 🦝
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:20px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
        Payment confirmed — you're officially on Einstein tier. Remi has your back with AI-powered quizzes, past questions, and study plans built for KNUST exams.
      </p>
    </td></tr>
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
        No more cramming blind. Open the app and let Remi show you exactly what to focus on. Chale, your exam prep just leveled up.
      </p>
    </td></tr>
  `;

  const text = `Welcome to Einstein, ${firstName}!

Payment confirmed — you're officially on Einstein tier. Remi has your back with AI-powered quizzes, past questions, and study plans built for KNUST exams.

No more cramming blind. Open the app and let Remi show you exactly what to focus on.

Start Studying with Remi →
${appUrl}

— Remi 🦝`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Einstein', preheader, bodyHtml, '— Remi 🦝', 'Start Studying with Remi →', appUrl),
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
      <h1 style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:22px;font-weight:800;color:#0D0618;line-height:1.2;letter-spacing:-0.5px;">
        Hey ${firstName}, your payment didn't go through
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:20px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
        We tried to charge your card for Einstein (${EINSTEIN_AMOUNT}/month) but it was declined. Don't worry — your account wasn't charged.
      </p>
    </td></tr>
    <tr><td style="padding-bottom:12px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1a2e;">Common reasons:</p>
    </td></tr>
    <tr><td style="padding-bottom:24px;">
      <ul style="margin:0;padding-left:20px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;line-height:1.8;color:#4B5563;">
        <li>Insufficient funds on your card or mobile money</li>
        <li>Incorrect card number, expiry date, or CVV</li>
        <li>Bank security block — try again or use a different method</li>
      </ul>
    </td></tr>
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
        Einstein is one tap away. Give it another shot and Remi will be waiting.
      </p>
    </td></tr>
  `;

  const text = `Hey ${firstName}, your payment didn't go through

We tried to charge your card for Einstein (${EINSTEIN_AMOUNT}/month) but it was declined. Don't worry — your account wasn't charged.

Common reasons:
- Insufficient funds on your card or mobile money
- Incorrect card number, expiry date, or CVV
- Bank security block — try again or use a different method

Try Again →
${appUrl}

— The Remedy Team`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Payment', preheader, bodyHtml, '— The Remedy Team', 'Try Again →', appUrl),
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
  const subject = 'Einstein subscription is live ✓';
  const preheader = `${EINSTEIN_AMOUNT}/month — next bill on ${formattedDate}.`;

  const bodyHtml = `
    <tr><td style="padding-bottom:16px;">
      <h1 style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:22px;font-weight:800;color:#0D0618;line-height:1.2;letter-spacing:-0.5px;">
        You're subscribed, ${firstName}!
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
        Your Einstein subscription is set up and auto-renews monthly. Here's what's on your account:
      </p>
    </td></tr>
    ${detailBox(
      detailRow('Plan', 'Einstein') +
      detailRow('Amount', `${EINSTEIN_AMOUNT}/month`) +
      detailRow('Next billing date', formattedDate, true),
    )}
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
        You can manage your subscription anytime from your dashboard. Now go crush those exams.
      </p>
    </td></tr>
  `;

  const text = `You're subscribed, ${firstName}!

Plan: Einstein
Amount: ${EINSTEIN_AMOUNT}/month
Next billing: ${formattedDate}

Go to Dashboard →
${appUrl}

— The Remedy Team`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Subscription', preheader, bodyHtml, '— The Remedy Team', 'Go to Dashboard →', appUrl),
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
  const subject = "Einstein renewed — you're good to go";
  const preheader = `${EINSTEIN_AMOUNT} charged. Next renewal: ${formattedDate}.`;

  const bodyHtml = `
    <tr><td style="padding-bottom:16px;">
      <h1 style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:22px;font-weight:800;color:#0D0618;line-height:1.2;letter-spacing:-0.5px;">
        Renewed and ready, ${firstName} 💜
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:20px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
        Your Einstein subscription renewed successfully. ${EINSTEIN_AMOUNT} has been charged to your payment method.
      </p>
    </td></tr>
    ${detailBox(
      detailRow('Amount charged', EINSTEIN_AMOUNT) +
      detailRow('Next renewal', formattedDate, true),
    )}
    <tr><td style="padding-bottom:12px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1a2e;">You still have full access to:</p>
    </td></tr>
    <tr><td style="padding-bottom:24px;">
      <ul style="margin:0;padding-left:20px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;line-height:1.8;color:#4B5563;">
        <li>AI tutor sessions with Remi</li>
        <li>KNUST past questions &amp; practice quizzes</li>
        <li>Personalised study plans</li>
      </ul>
    </td></tr>
  `;

  const text = `Renewed and ready, ${firstName}!

Amount charged: ${EINSTEIN_AMOUNT}
Next renewal: ${formattedDate}

Keep Grinding →
${appUrl}

— Remi 🦝`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Renewal', preheader, bodyHtml, '— Remi 🦝', 'Keep Grinding →', appUrl),
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
  const subject = '⚠️ Renewal failed — act within 3 days';
  const preheader = `Update your payment by ${formattedGraceEnd} to keep Einstein.`;

  const bodyHtml = `
    <tr><td style="padding-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:4px;">
        <tr><td style="padding:14px 16px;">
          <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;font-weight:600;color:#DC2626;">Action required — your Einstein renewal failed</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding-bottom:16px;">
      <h1 style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:22px;font-weight:800;color:#0D0618;line-height:1.2;letter-spacing:-0.5px;">
        ${firstName}, we couldn't renew your subscription
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
        We tried to charge ${EINSTEIN_AMOUNT} for your monthly Einstein plan but the payment failed. Your access is still active — for now. You have a <strong style="color:#DC2626;">3-day grace period</strong> ending <strong>${formattedGraceEnd}</strong>. Update your payment details before then or you'll lose access to Remi, past questions, and all Einstein features.
      </p>
    </td></tr>
  `;

  const text = `ACTION REQUIRED — Your Einstein renewal failed

${firstName}, we couldn't renew your subscription.

We tried to charge ${EINSTEIN_AMOUNT} but the payment failed. Your access is still active — for now.

Grace period ends: ${formattedGraceEnd}

Update Payment Details →
${appUrl}

— The Remedy Team`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Urgent', preheader, bodyHtml, '— The Remedy Team', 'Update Payment Details →', appUrl),
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
  const subject = 'Your Einstein plan has ended';
  const preheader = `Access ends ${formattedExpiry}. Door's always open.`;

  const bodyHtml = `
    <tr><td style="padding-bottom:16px;">
      <h1 style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:22px;font-weight:800;color:#0D0618;line-height:1.2;letter-spacing:-0.5px;">
        Sorry to see you go, ${firstName}
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:20px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
        Your Einstein subscription has been cancelled. No further charges will be made to your account.
      </p>
    </td></tr>
    ${detailBox(detailRow('Access ends', formattedExpiry, true))}
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
        Exams don't wait, and neither does Remi. Whenever you're ready to come back, Einstein is ${EINSTEIN_AMOUNT}/month — same great features, zero hassle to resubscribe.
      </p>
    </td></tr>
  `;

  const text = `Sorry to see you go, ${firstName}

Your Einstein subscription has been cancelled. No further charges will be made.

Access ends: ${formattedExpiry}

Resubscribe Anytime →
${appUrl}

— Remi 🦝`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Cancelled', preheader, bodyHtml, '— Remi 🦝', 'Resubscribe Anytime →', appUrl),
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
      <h1 style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:22px;font-weight:800;color:#0D0618;line-height:1.2;letter-spacing:-0.5px;">
        Got it, ${firstName} — auto-renew is off
      </h1>
    </td></tr>
    <tr><td style="padding-bottom:20px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
        You've turned off auto-renewal for your Einstein plan. We respect the choice — no hard feelings.
      </p>
    </td></tr>
    ${detailBox(
      detailRow('Your access continues until', formattedExpiry, true) +
      detailRow('After that', 'Einstein features lock'),
    )}
    <tr><td style="padding-bottom:24px;">
      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
        Changed your mind? Flip auto-renew back on from your dashboard and you won't miss a beat. Remi will still be here when exams hit.
      </p>
    </td></tr>
  `;

  const text = `Got it, ${firstName} — auto-renew is off

Your access continues until: ${formattedExpiry}
After that: Einstein features lock

Turn Auto-Renew Back On →
${appUrl}

— The Remedy Team`;

  return {
    subject,
    preheader,
    html: paymentEmailLayout('Subscription', preheader, bodyHtml, '— The Remedy Team', 'Turn Auto-Renew Back On →', appUrl),
    text,
  };
};
