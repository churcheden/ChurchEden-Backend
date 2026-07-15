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

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" content="" />
  <title>Welcome to ChurchEden</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style type="text/css">
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; text-decoration: none; }
    a { text-decoration: none; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a1a;padding:32px;text-align:center;">
              <img src="${LOGO_URL}" alt="ChurchEden Logo" width="160" style="display:block;margin:0 auto 8px;height:auto;max-height:64px;" />
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,#d4af37 0%,#f1c40f 50%,#d4af37 100%);border-radius:999px;margin-top:24px;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Welcome -->
          <tr>
            <td style="padding:48px 32px;text-align:center;">
              <h1 style="margin:0 0 16px;font-size:32px;font-weight:700;color:#1f2937;line-height:1.2;">
                Welcome to ChurchEden, <span style="color:#d4af37;">${firstName}!</span>
              </h1>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 32px;">
                <tr><td style="width:64px;height:4px;background-color:#d4af37;border-radius:999px;"></td></tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 32px;">
                <tr>
                  <td style="background-color:#fffbeb;border-radius:999px;padding:24px;">
                    <span style="font-size:48px;line-height:1;">✉️</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:18px;line-height:1.6;color:#4b5563;max-width:420px;display:inline-block;">
                We're excited to have you on board. Your account has been successfully created, and you can now access ChurchEden to manage your church's operations with ease.
              </p>
            </td>
          </tr>

          <!-- Account details -->
          <tr>
            <td style="padding:0 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;border:1px solid #f3f4f6;border-radius:16px;padding:32px;">
                <tr>
                  <td style="padding-bottom:24px;">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#9ca3af;">Your Account Details</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" valign="top" style="padding:0 8px 20px 0;">
                          <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Name</p>
                          <p style="margin:0;font-size:15px;font-weight:600;color:#1f2937;">${displayName}</p>
                        </td>
                        <td width="50%" valign="top" style="padding:0 0 20px 8px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Role</p>
                          <p style="margin:0;font-size:15px;font-weight:600;color:#1f2937;">${role}</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" valign="top" style="padding:0 8px 0 0;">
                          <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Email</p>
                          <p style="margin:0;font-size:15px;font-weight:600;color:#1f2937;word-break:break-all;">${email}</p>
                        </td>
                        <td width="50%" valign="top" style="padding:0 0 0 8px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Church</p>
                          <p style="margin:0;font-size:15px;font-weight:600;color:#1f2937;">${church}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 48px;text-align:center;">
              <p style="margin:0 0 24px;font-size:14px;font-style:italic;color:#6b7280;">
                To get started, simply sign in using your registered email and password.
              </p>
              <a href="${signInUrl}" style="display:inline-block;background-color:#d4af37;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:12px;box-shadow:0 8px 20px rgba(212,175,55,0.35);">
                Sign In to ChurchEden →
              </a>
            </td>
          </tr>

          <!-- Features -->
          <tr>
            <td style="padding:0 32px 48px;">
              <h3 style="margin:0 0 32px;text-align:center;font-size:20px;font-weight:700;color:#1f2937;">With ChurchEden, you can easily manage:</h3>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${[
                    'Members &amp; Departments',
                    'Tithes &amp; Financials',
                    'Events &amp; Services',
                    'Communication',
                    'Reports &amp; Analytics',
                  ].map((label) => `
                  <td width="20%" align="center" valign="top" style="padding:8px 4px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td style="width:56px;height:56px;background-color:#fffbeb;border-radius:16px;text-align:center;vertical-align:middle;font-size:24px;">⛪</td>
                      </tr>
                      <tr>
                        <td style="padding-top:12px;font-size:11px;font-weight:600;color:#4b5563;line-height:1.4;text-align:center;">${label}</td>
                      </tr>
                    </table>
                  </td>`).join('')}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security notice -->
          <tr>
            <td style="padding:0 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef2f2;border:1px solid #fee2e2;border-radius:12px;padding:24px;">
                <tr>
                  <td style="font-size:14px;line-height:1.5;color:#991b1b;padding-right:16px;">
                    If you did not create this account, please contact your church administrator immediately.
                  </td>
                  <td align="right" style="white-space:nowrap;">
                    <a href="mailto:support@churcheden.com" style="display:inline-block;background-color:#ffffff;border:1px solid #fecaca;color:#dc2626;font-size:13px;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:8px;">Contact Support</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Closing -->
          <tr>
            <td style="padding:0 32px 40px;text-align:center;">
              <p style="margin:0;font-size:14px;font-style:italic;color:#6b7280;max-width:360px;display:inline-block;line-height:1.6;">
                Thank you for choosing ChurchEden—where church management meets simplicity. May God bless your ministry.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;border-top:1px solid #f3f4f6;padding:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="33%" valign="top" align="left" style="padding-bottom:16px;">
                    <img src="${LOGO_URL}" alt="ChurchEden" width="100" style="display:block;margin-bottom:16px;opacity:0.8;" />
                    <p style="margin:0;font-size:12px;color:#9ca3af;">© ${year} ChurchEden. All rights reserved.</p>
                  </td>
                  <td width="34%" valign="top" align="center" style="padding-bottom:16px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#9ca3af;">Warm regards,</p>
                    <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#1f2937;">The ChurchEden Team</p>
                  </td>
                  <td width="33%" valign="top" align="right" style="padding-bottom:16px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#9ca3af;">Need help?</p>
                    <p style="margin:0;font-size:14px;font-weight:600;color:#d4af37;">support@churcheden.com</p>
                    <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">0531758854<br/>0544053099</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

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

  return `Welcome to ChurchEden, ${firstName}!

Your account has been successfully created.

Account Details:
- Name: ${displayName}
- Role: ${role}
- Email: ${email}
- Church: ${church}

Sign in here: ${signInUrl}

If you did not create this account, contact support@churcheden.com immediately.

Thank you for choosing ChurchEden.
The ChurchEden Team`;
};
