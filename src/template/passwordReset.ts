export const resetPasswordTemplate = (resetUrl: string, token: string) => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<title></title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" content="" />
<meta content="width=device-width" name="viewport" />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@700;800&display=swap" rel="stylesheet">
<style type="text/css">
  table { border-collapse: separate; table-layout: fixed; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  table td { border-collapse: collapse; }
  body { min-width: 100%; margin: 0; padding: 0; background-color: #EEEAF8; }
  img { margin: 0; padding: 0; }
  a { text-decoration: none; }
</style>
</head>
<body style="min-width:100%;margin:0;padding:0;background-color:#EEEAF8;font-family:'DM Sans',Arial,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="background-color:#EEEAF8;" align="center" valign="top">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="line-height:48px;font-size:1px;display:block;">&nbsp;</td></tr>
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;width:100%;max-width:480px;">
          <tr><td style="padding:0 20px;">

            <!-- Header -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(135deg,#7C3AED 0%,#6D28D9 100%);padding:32px 36px 30px;border-radius:16px 16px 0 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td><span style="font-family:'Sora',Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Remedy</span></td>
                      <td align="right"><span style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:500;color:rgba(255,255,255,0.55);letter-spacing:0.8px;text-transform:uppercase;">Password Reset</span></td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Card -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#ffffff;padding:44px 36px 36px;border-radius:0 0 16px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                    <tr><td style="padding-bottom:12px;">
                      <h1 style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:28px;font-weight:800;color:#0D0618;line-height:1.2;letter-spacing:-0.5px;">
                        Forgot your<br/><span style="color:#7C3AED;">password?</span> 🔐
                      </h1>
                    </td></tr>

                    <tr><td style="padding-bottom:28px;">
                      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
                        No worries — it happens. Click the button below to set a new password for your Remedy account.
                      </p>
                    </td></tr>

                    <!-- CTA -->
                    <tr><td style="padding-bottom:28px;text-align:center;">
                      <a href="${resetUrl}"
                        style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#ffffff;font-family:'DM Sans',Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 6px 20px rgba(124,58,237,0.35);">
                        Reset My Password →
                      </a>
                    </td></tr>

                    <!-- Warning -->
                    <tr><td style="padding-bottom:28px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background:#FFF7F7;border-left:3px solid #EF4444;border-radius:0 8px 8px 0;padding:14px 16px;">
                            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;line-height:1.6;color:#B91C1C;">
                              ⚠️ &nbsp;This code and link expire in <strong>15 minutes</strong>. If you didn't request this, ignore this email — your account is safe.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td></tr>

                    <!-- Fallback URL -->
                    <tr><td style="padding-bottom:28px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background:#FAFAFA;border-radius:8px;padding:14px 16px;">
                            <p style="margin:0 0 4px 0;font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:600;color:#9CA3AF;letter-spacing:0.8px;text-transform:uppercase;">Button not working?</p>
                            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#7C3AED;word-break:break-all;line-height:1.6;">${resetUrl}</p>
                          </td>
                        </tr>
                      </table>
                    </td></tr>

                    <!-- Footer -->
                    <tr><td style="border-top:1px solid #F3F4F6;padding-top:24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#9CA3AF;">© 2026 Remedy</td>
                          <td align="right" style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#9CA3AF;">Made for KNUST &nbsp;🇬🇭</td>
                        </tr>
                      </table>
                    </td></tr>

                  </table>
                </td>
              </tr>
            </table>

          </td></tr>
        </table>
      </td></tr>
      <tr><td style="line-height:48px;font-size:1px;display:block;">&nbsp;</td></tr>
    </table>
  </td></tr>
</table>

</body>
</html>
`;