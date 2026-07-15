export const passwordChangeTemplate = (name: string) => `
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
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="text-align:center;padding:40px 0 0;">
                <h1 style="font-family:'Sora',Arial,sans-serif;font-size:32px;font-weight:800;margin:0;color:#6366f1;">Remedy</h1>
              </td></tr>
            </table>

            <!-- Content -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:40px;">
              <tr><td style="background-color:#fff;border-radius:12px;padding:40px;text-align:center;">
                <h2 style="font-family:'Sora',Arial,sans-serif;font-size:24px;font-weight:800;margin:0 0 16px 0;color:#1f2937;">Password Changed Successfully</h2>
                <p style="font-size:16px;color:#6b7280;margin:0 0 24px 0;line-height:1.6;">
                  Hi ${name},
                </p>
                <p style="font-size:16px;color:#6b7280;margin:0 0 24px 0;line-height:1.6;">
                  This is a confirmation that your Remedy account password has been successfully changed on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
                </p>
                <p style="font-size:16px;color:#6b7280;margin:0 0 24px 0;line-height:1.6;">
                  If you didn't make this change or if you believe your account has been compromised, please contact our support team immediately.
                </p>
                <p style="font-size:14px;color:#9ca3af;margin:0;line-height:1.6;">
                  Your security is our priority. Keep your password safe and never share it with anyone.
                </p>
              </td></tr>
            </table>

            <!-- Footer -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:40px;">
              <tr><td style="text-align:center;padding:20px 0 40px;">
                <p style="font-size:12px;color:#9ca3af;margin:0;">
                  © 2026 Remedy. All rights reserved.
                </p>
              </td></tr>
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
