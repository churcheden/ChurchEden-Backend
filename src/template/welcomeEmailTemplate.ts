// ChurchEden brand logo asset.
//
// IMPORTANT — LOGO HOSTING FLAG:
// The existing LOGO_URL below is a Figma/AIDA-generated Google-hosted link that
// may expire and is NOT a permanent production asset. Per the brand-consistency
// task, this MUST be replaced with a real, non-expiring ChurchEden-hosted asset
// (Cloudflare R2 public URL — same place church logos and media are stored,
// i.e. `${CLOUDFLARE_R2_PUBLIC_URL}/...`) before this email ships.
// Until that asset is uploaded, this template intentionally reuses the current
// LOGO_URL so the layout renders, but the trailing throwaway token must be
// swapped for a stable R2 object key (e.g. brand/logo-ring.png). Do NOT ship
// with a placeholder or a third-party logo in its place.
const LOGO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCWT_ZTEySeWNVA1KX7lZkdYIw1uvtRMUWAz49R9zMxZAgL3qFr7JHc31pE_LSAVObnrjAY4Ez2GL6JQZ3CIvkXfakRc-cjacO-WEiPmXSHtb_TYFQVOKJWy9l6ffaxNN8_ySOtiLsqrS1Z4eNyh3ZPScC2WypcIK3Wm3W32HSVCz4_E-ygnwFydzLB6Ok4fu4nG6Q8XDsrn9MHFX_GoMrJVQrGOW5nigrfJcVb7FGEnYNnCFGrX3Y4f5d0GCX7LEB7KCDMWdtsVzV3';

export interface WelcomeEmailData {
  firstName: string;
  fullName?: string;
  email: string;
  role?: string;
  church?: string;
  signInUrl: string;
}

// Gold gradient + solid accent tokens (do not introduce new brand colors).
const GOLD_GRADIENT = 'linear-gradient(135deg, #C9A24A 0%, #B3862E 100%)';
const GOLD = '#C29A3B';
const NAVY_DARK = '#242019';
const NAVY_DEEPER = '#1D1813';
const CREAM = '#F5F4F0';
const CARD_BG = '#FBF8F1';
const CARD_BORDER = '#F0EBDD';
const BODY_GRAY = '#5A564E';
const MUTED_GRAY = '#9A948A';

// Inline SVG icons (as data-URIs so they render reliably in Gmail/Outlook,
// which don't support inline <svg> elements or emoji-driven styling).
const svgDataUri = (body: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">${body}</svg>`,
  )}`;

const ICON_PEOPLE = svgDataUri(
  `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
);
const ICON_HEART = svgDataUri(
  `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
);
const ICON_CALENDAR = svgDataUri(
  `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
);
const ICON_CHART = svgDataUri(
  `<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>`,
);
const ICON_BOOK = svgDataUri(
  `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
);
const ICON_MAIL = svgDataUri(
  `<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
);

export const welcomeEmailTemplate = ({
  firstName,
  fullName,
  email,
  role = 'Member',
  church = '—',
  signInUrl,
}: WelcomeEmailData) => {
  const displayName = fullName ?? firstName;
  const year = new Date().getFullYear();

  const features = [
    { label: 'Manage Members', icon: ICON_PEOPLE },
    { label: 'Track Giving', icon: ICON_HEART },
    { label: 'Plan Events', icon: ICON_CALENDAR },
    { label: 'View Reports', icon: ICON_CHART },
  ];

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
      .feat { display: block !important; width: 100% !important; padding: 8px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${CREAM};font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};">
    <tr>
      <td align="center" class="pad" style="padding:28px 16px 0;">

        <!-- 1. Top wordmark bar -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;padding-bottom:24px;">
          <tr>
            <td align="left" valign="middle">
              <img src="${LOGO_URL}" alt="ChurchEden Logo" width="26" height="26" style="display:inline-block;vertical-align:middle;border-radius:50%;margin-right:8px;" />
              <span style="font-family:'Fraunces',Georgia,serif;font-size:20px;font-weight:700;color:${NAVY_DARK};letter-spacing:-0.4px;vertical-align:middle;">Church<span style="color:${GOLD};">Eden</span></span>
            </td>
            <td align="right" valign="middle">
              <span style="font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;color:${MUTED_GRAY};letter-spacing:0.12em;text-transform:uppercase;">Welcome to ChurchEden</span>
            </td>
          </tr>
        </table>

        <!-- Main card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;background-color:#ffffff;border:1px solid #ECE9E2;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px -18px rgba(36,32,25,0.28);">

          <!-- 2. Hero header block (dark gradient) -->
          <tr>
            <td style="background:linear-gradient(135deg,#2A241D 0%,#1D1813 100%);padding:44px 32px 40px;text-align:center;border-bottom:1px solid #F0EDE6;">
              <img src="${LOGO_URL}" alt="ChurchEden" width="72" height="72" style="display:block;margin:0 auto 22px;height:auto;border-radius:50%;" />
              <h1 style="margin:0 0 12px;font-family:'Fraunces',Georgia,serif;font-size:30px;font-weight:700;color:#F4EFE3;line-height:1.2;letter-spacing:-0.5px;">
                Welcome to ChurchEden
              </h1>
              <p style="margin:0 0 22px;font-family:'Inter',Arial,sans-serif;font-size:14px;color:#C9BFAC;line-height:1.5;">
                We're so glad to have you with us!
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr><td align="center" style="width:64px;height:4px;background:${GOLD_GRADIENT};border-radius:999px;"></td></tr>
              </table>
            </td>
          </tr>

          <!-- 3. Greeting + intro body -->
          <tr>
            <td class="inner" style="padding:44px 32px 0;text-align:left;">
              <h2 style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:700;color:${NAVY_DARK};line-height:1.2;letter-spacing:-0.4px;">
                Hi <span style="color:${GOLD};">${firstName}</span>,
              </h2>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.75;color:${BODY_GRAY};">
                Welcome to ChurchEden! Your account is ready, and we're thrilled to walk alongside your church.
              </p>
              <p style="margin:0;font-size:15px;line-height:1.75;color:${BODY_GRAY};">
                From member management and giving to attendance tracking and ministry teams, ChurchEden brings everything your church needs into one simple, secure place.
              </p>
            </td>
          </tr>

          <!-- 4. Scripture quote block -->
          <tr>
            <td style="padding:32px 32px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CARD_BG};border:1px solid ${CARD_BORDER};border-radius:14px;">
                <tr>
                  <td style="padding:22px 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="1" valign="top" style="padding-right:16px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                            <tr>
                              <td style="width:44px;height:44px;background:#FBF2E2;border:1px solid #F0EBDD;border-radius:50%;text-align:center;vertical-align:middle;">
                                <img src="${ICON_BOOK}" alt="Scripture" width="20" height="20" style="display:inline-block;vertical-align:middle;" />
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td valign="top">
                          <p style="margin:0 0 8px;font-family:'Fraunces',Georgia,serif;font-size:16px;font-style:italic;line-height:1.65;color:${NAVY_DARK};">
                            &ldquo;Whoever can be trusted with very little can also be trusted with much.&rdquo;
                          </p>
                          <p style="margin:0;font-size:12px;color:${MUTED_GRAY};">— Luke 16:10 (NIV)</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 5. Four-icon feature grid -->
          <tr>
            <td style="padding:36px 32px 8px;">
              <p style="margin:0 0 22px;text-align:center;font-family:'Fraunces',Georgia,serif;font-size:19px;font-weight:600;color:${NAVY_DARK};">Here's what you can do with ChurchEden</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${features.map((f) => `
                  <td class="feat" width="25%" align="center" valign="top" style="padding:8px 4px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td style="width:56px;height:56px;background:${CARD_BG};border:1px solid ${CARD_BORDER};border-radius:16px;text-align:center;vertical-align:middle;">
                          <img src="${f.icon}" alt="${f.label}" width="24" height="24" style="display:inline-block;vertical-align:middle;" />
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top:12px;font-size:11px;font-weight:600;color:${BODY_GRAY};line-height:1.4;text-align:center;">${f.label}</td>
                      </tr>
                    </table>
                  </td>`).join('')}
                </tr>
              </table>
            </td>
          </tr>

          <!-- 6. CTA button -->
          <tr>
            <td style="padding:28px 32px 8px;text-align:center;">
              <a href="${signInUrl}" style="display:inline-block;background:${GOLD_GRADIENT};color:#241D12;font-family:'Inter',Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:17px 48px;border-radius:14px;box-shadow:0 10px 24px -10px rgba(179,134,46,0.55);">
                Get Started
              </a>
            </td>
          </tr>

          <!-- Closing -->
          <tr>
            <td class="inner" style="padding:24px 32px 40px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#8A8478;max-width:380px;display:inline-block;line-height:1.7;">
                Thank you for being part of ChurchEden — where church management meets simplicity. May God bless your ministry.
              </p>
            </td>
          </tr>

        </table>

        <!-- 7. Dark footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;margin-top:24px;background:linear-gradient(135deg,#2A241D 0%,#1D1813 100%);border-radius:18px;">
          <tr>
            <td style="padding:32px 28px 26px;text-align:center;">
              <img src="${LOGO_URL}" alt="ChurchEden" width="34" height="34" style="display:block;margin:0 auto 14px;border-radius:50%;" />
              <p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#C9BFAC;max-width:400px;display:inline-block;">
                Thank you for being part of ChurchEden. We're here to support your church's growth and impact.
              </p>

              <!-- Social icons -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 20px;">
                <tr>
                  <td style="padding:0 5px;">
                    <a href="#" style="display:inline-block;width:34px;height:34px;background:rgba(245,244,240,0.12);border:1px solid rgba(245,244,240,0.2);border-radius:50%;text-align:center;line-height:34px;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:700;color:#F4EFE3;text-decoration:none;">f</a>
                  </td>
                  <td style="padding:0 5px;">
                    <a href="#" style="display:inline-block;width:34px;height:34px;background:rgba(245,244,240,0.12);border:1px solid rgba(245,244,240,0.2);border-radius:50%;text-align:center;line-height:34px;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:700;color:#F4EFE3;text-decoration:none;">IG</a>
                  </td>
                  <td style="padding:0 5px;">
                    <a href="mailto:support@churcheden.app" style="display:inline-block;width:34px;height:34px;background:rgba(245,244,240,0.12);border:1px solid rgba(245,244,240,0.2);border-radius:50%;text-align:center;line-height:34px;text-decoration:none;">
                      <img src="${ICON_MAIL}" alt="Email" width="15" height="15" style="display:inline-block;vertical-align:middle;" />
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;font-family:'Fraunces',Georgia,serif;font-size:13px;font-style:italic;color:#E4DCCB;">Grace &amp; Peace,</p>
              <p style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-size:13px;font-weight:600;color:#F4EFE3;">The ChurchEden Team</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td align="center" style="border-top:1px solid rgba(245,244,240,0.14);padding-top:16px;">
                  <p style="margin:0 0 6px;font-size:12px;color:#A7A199;line-height:1.6;">
                    Need help? Reply to this email or contact us at <a href="mailto:support@churcheden.app" style="color:#C29A3B;text-decoration:none;">support@churcheden.app</a>
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

Here's what you can do with ChurchEden:
- Manage Members
- Track Giving
- Plan Events
- View Reports

"Whoever can be trusted with very little can also be trusted with much." — Luke 16:10 (NIV)

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
