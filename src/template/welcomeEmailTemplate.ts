import { WELCOME_LOGO_DATA_URI } from './welcomeEmailLogo.js';

// Official ChurchEden transparent logo, embedded as a base64 data URI so it
// renders reliably in every email client without depending on external hosting.

export interface WelcomeEmailData {
  firstName: string;
  fullName?: string;
  email: string;
  role?: string;
  church?: string;
  signInUrl: string;
}

// Brand tokens (do not introduce new brand colors).
const GOLD_GRADIENT = 'linear-gradient(135deg, #C9A24A 0%, #B3862E 100%)';
const GOLD = '#C29A3B';
const NAVY_DARK = '#242019';
const CREAM = '#F5F4F0';
const BODY_GRAY = '#5A564E';
const MUTED_GRAY = '#9A948A';

export const welcomeEmailTemplate = ({
  firstName,
  signInUrl,
}: WelcomeEmailData) => {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" content="" />
  <title>Welcome to ChurchEden</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet" />
  <style type="text/css">
    table { border-collapse: separate; table-layout: fixed; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    table td { border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; }
    a { text-decoration: none; }
    body { min-width: 100%; margin: 0; padding: 0; background-color: ${CREAM}; }
    @media only screen and (max-width: 520px) {
      .pad { padding: 0 20px !important; }
      .inner { padding: 32px 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${CREAM};font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};">
    <tr>
      <td align="center" class="pad" style="padding:28px 16px 0;">

        <!-- Wordmark bar -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;padding-bottom:24px;">
          <tr>
            <td align="center" valign="middle">
              <img src="${WELCOME_LOGO_DATA_URI}" alt="ChurchEden" width="40" height="40" style="display:inline-block;vertical-align:middle;margin-right:10px;" />
              <span style="font-family:'Fraunces',Georgia,serif;font-size:22px;font-weight:700;color:${NAVY_DARK};letter-spacing:-0.4px;vertical-align:middle;">Church<span style="color:${GOLD};">Eden</span></span>
            </td>
          </tr>
        </table>

        <!-- Main card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #ECE9E2;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px -18px rgba(36,32,25,0.28);">

          <!-- Hero -->
          <tr>
            <td style="background:linear-gradient(135deg,#2A241D 0%,#1D1813 100%);padding:48px 32px;text-align:center;border-bottom:1px solid #F0EDE6;">
              <img src="${WELCOME_LOGO_DATA_URI}" alt="ChurchEden" width="88" height="88" style="display:block;margin:0 auto 20px;" />
              <h1 style="margin:0 0 10px;font-family:'Fraunces',Georgia,serif;font-size:30px;font-weight:700;color:#F4EFE3;line-height:1.2;letter-spacing:-0.5px;">
                Welcome to ChurchEden
              </h1>
              <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:14px;color:#C9BFAC;line-height:1.5;">
                We're so glad to have you with us!
              </p>
            </td>
          </tr>

          <!-- Greeting + intro -->
          <tr>
            <td class="inner" style="padding:40px 32px 0;text-align:left;">
              <h2 style="margin:0 0 14px;font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:700;color:${NAVY_DARK};line-height:1.2;letter-spacing:-0.4px;">
                Hi <span style="color:${GOLD};">${firstName}</span>,
              </h2>
              <p style="margin:0 0 10px;font-size:15px;line-height:1.75;color:${BODY_GRAY};">
                Your ChurchEden account is ready. We're thrilled to walk alongside your church.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.75;color:${BODY_GRAY};">
                From member management and giving to attendance tracking and ministry teams, ChurchEden brings everything your church needs into one simple, secure place.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 32px 8px;text-align:center;">
              <a href="${signInUrl}" style="display:inline-block;background:${GOLD_GRADIENT};color:#241D12;font-family:'Inter',Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:17px 48px;border-radius:14px;box-shadow:0 10px 24px -10px rgba(179,134,46,0.55);">
                Get Started
              </a>
            </td>
          </tr>

          <!-- Closing -->
          <tr>
            <td class="inner" style="padding:28px 32px 44px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#8A8478;max-width:380px;display:inline-block;line-height:1.7;">
                Thank you for being part of ChurchEden. May God bless your ministry.
              </p>
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin-top:24px;background:linear-gradient(135deg,#2A241D 0%,#1D1813 100%);border-radius:18px;">
          <tr>
            <td style="padding:32px 28px 28px;text-align:center;">
              <img src="${WELCOME_LOGO_DATA_URI}" alt="ChurchEden" width="40" height="40" style="display:block;margin:0 auto 14px;" />
              <p style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-size:13px;font-weight:600;color:#F4EFE3;">The ChurchEden Team</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td align="center" style="border-top:1px solid rgba(245,244,240,0.14);padding-top:16px;">
                  <p style="margin:0 0 6px;font-size:12px;color:#A7A199;line-height:1.6;">
                    Need help? Contact us at <a href="mailto:support@churcheden.app" style="color:#C29A3B;text-decoration:none;">support@churcheden.app</a>
                  </p>
                  <p style="margin:0;font-size:11px;color:#B4AEA4;">© ${year} ChurchEden. All rights reserved.</p>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr><td style="line-height:32px;font-size:1px;display:block;">&nbsp;</td></tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const welcomeEmailText = ({
  firstName,
  fullName,
  email,
  role = 'Member',
  church = '—',
  signInUrl,
}: WelcomeEmailData) => {
  const displayName = fullName ?? firstName;
  const year = new Date().getFullYear();

  return `Welcome to ChurchEden, ${firstName}!

We're so glad to have you with us. Your account has been successfully created.

ChurchEden brings everything your church needs into one place — member management, giving and tithes, attendance tracking, events, and ministry teams — so you can focus on what matters most.

Get started by signing in here: ${signInUrl}

Account Details:
- Name: ${displayName}
- Role: ${role}
- Email: ${email}
- Church: ${church}

Grace & Peace,
The ChurchEden Team

Need help? Reply to this email or contact us at support@churcheden.app

© ${year} ChurchEden. All rights reserved.`;
};
