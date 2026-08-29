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
    body { min-width: 100%; margin: 0; padding: 0; background-color: #F5F4F0; }
    @media only screen and (max-width: 520px) {
      .pad { padding: 0 20px !important; }
      .inner { padding: 32px 24px !important; }
      .feat { display: block !important; width: 100% !important; padding: 6px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F5F4F0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F4F0;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Wordmark -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-bottom:24px;">
          <tr>
            <td align="center">
              <span style="font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:700;color:#242019;letter-spacing:-0.4px;">Church<span style="color:#C29A3B;">Eden</span></span>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;background-color:#ffffff;border:1px solid #ECE9E2;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px -18px rgba(36,32,25,0.28);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2A241D 0%,#1D1813 100%);padding:40px 32px;text-align:center;border-bottom:1px solid #F0EDE6;">
              <img src="${LOGO_URL}" alt="ChurchEden Logo" width="120" style="display:block;margin:0 auto 20px;height:auto;max-height:56px;" />
              <h1 style="margin:0 0 14px;font-family:'Fraunces',Georgia,serif;font-size:30px;font-weight:700;color:#F4EFE3;line-height:1.2;letter-spacing:-0.5px;">
                Welcome to ChurchEden
              </h1>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr><td align="center" style="width:64px;height:4px;background:linear-gradient(90deg,#C9A24A,#B3862E);border-radius:999px;"></td></tr>
              </table>
            </td>
          </tr>

          <!-- Welcome -->
          <tr>
            <td class="inner" style="padding:44px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
                <tr>
                  <td style="background:#FBF8F1;border:1px solid #F0EBDD;border-radius:999px;padding:22px;font-size:40px;line-height:1;">✉️</td>
                </tr>
              </table>
              <h2 style="margin:0 0 14px;font-family:'Fraunces',Georgia,serif;font-size:28px;font-weight:700;color:#242019;line-height:1.2;letter-spacing:-0.5px;">
                Hello, <span style="color:#C29A3B;">${firstName}</span>
              </h2>
              <p style="margin:0 auto;font-size:15px;line-height:1.75;color:#5A564E;max-width:440px;display:inline-block;">
                We're excited to have you on board. Your account has been successfully created, and you can now access ChurchEden to manage your church's operations with ease.
              </p>
            </td>
          </tr>

          <!-- Account details -->
          <tr>
            <td style="padding:32px 32px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF8F1;border:1px solid #F0EBDD;border-radius:14px;">
                <tr>
                  <td style="padding:22px 24px 6px;">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#9A948A;">Your account details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 24px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" valign="top" style="padding:0 8px 16px 0;">
                          <p style="margin:0 0 4px;font-size:12px;color:#9A948A;">Name</p>
                          <p style="margin:0;font-size:14px;font-weight:600;color:#2A241D;">${displayName}</p>
                        </td>
                        <td width="50%" valign="top" style="padding:0 0 16px 8px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#9A948A;">Role</p>
                          <p style="margin:0;font-size:14px;font-weight:600;color:#2A241D;">${role}</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" valign="top" style="padding:0 8px 0 0;">
                          <p style="margin:0 0 4px;font-size:12px;color:#9A948A;">Email</p>
                          <p style="margin:0;font-size:14px;font-weight:600;color:#2A241D;word-break:break-all;">${email}</p>
                        </td>
                        <td width="50%" valign="top" style="padding:0 0 0 8px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#9A948A;">Church</p>
                          <p style="margin:0;font-size:14px;font-weight:600;color:#2A241D;">${church}</p>
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
            <td style="padding:28px 32px 8px;text-align:center;">
              <p style="margin:0 0 22px;font-size:14px;color:#8A8478;line-height:1.6;">
                To get started, simply sign in using your registered email and password.
              </p>
              <a href="${signInUrl}" style="display:inline-block;background:linear-gradient(135deg,#C9A24A 0%,#B3862E 100%);color:#241D12;font-size:15px;font-weight:700;text-decoration:none;padding:16px 42px;border-radius:12px;box-shadow:0 10px 24px -10px rgba(179,134,46,0.55);">
                Sign In to ChurchEden →
              </a>
            </td>
          </tr>

          <!-- Features -->
          <tr>
            <td style="padding:36px 32px 8px;">
              <p style="margin:0 0 22px;text-align:center;font-family:'Fraunces',Georgia,serif;font-size:19px;font-weight:600;color:#242019;">With ChurchEden, you can easily manage</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${[
                    'Members &amp; Departments',
                    'Tithes &amp; Financials',
                    'Events &amp; Services',
                    'Communication',
                    'Reports &amp; Analytics',
                  ].map((label) => `
                  <td class="feat" width="20%" align="center" valign="top" style="padding:8px 4px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td style="width:56px;height:56px;background:#FBF8F1;border:1px solid #F0EBDD;border-radius:16px;text-align:center;vertical-align:middle;font-size:24px;">⛪</td>
                      </tr>
                      <tr>
                        <td style="padding-top:12px;font-size:11px;font-weight:600;color:#5A564E;line-height:1.4;text-align:center;">${label}</td>
                      </tr>
                    </table>
                  </td>`).join('')}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security notice -->
          <tr>
            <td style="padding:20px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FDF3F3;border:1px solid #F3D8D8;border-radius:12px;">
                <tr>
                  <td style="font-size:14px;line-height:1.5;color:#8A3B30;padding:18px 20px;">
                    If you did not create this account, please contact your church administrator immediately.
                  </td>
                  <td align="right" style="white-space:nowrap;padding-right:20px;">
                    <a href="mailto:support@churcheden.com" style="display:inline-block;background-color:#ffffff;border:1px solid #E7B9B4;color:#B5382A;font-size:13px;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:9px;">Contact Support</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Closing -->
          <tr>
            <td class="inner" style="padding:16px 32px 40px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#8A8478;max-width:380px;display:inline-block;line-height:1.7;">
                Thank you for choosing ChurchEden — where church management meets simplicity. May God bless your ministry.
              </p>
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;padding-top:24px;">
          <tr>
            <td align="center" style="padding-bottom:8px;">
              <p style="margin:0 0 6px;font-size:12px;color:#9A948A;line-height:1.6;">
                Need help? <a href="mailto:support@churcheden.com" style="color:#C29A3B;text-decoration:none;">support@churcheden.com</a>
              </p>
              <p style="margin:0;font-size:12px;color:#A7A199;line-height:1.6;">0531758854 &nbsp;·&nbsp; 0544053099</p>
            </td>
          </tr>
          <tr><td style="height:16px;font-size:1px;display:block;">&nbsp;</td></tr>
          <tr>
            <td align="center" style="border-top:1px solid #E7E3DB;padding-top:18px;">
              <p style="margin:0;font-size:11px;color:#B4AEA4;">© ${year} ChurchEden · Stewarding your church, beautifully.</p>
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
