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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet">
<style type="text/css">
  table { border-collapse: separate; table-layout: fixed; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  table td { border-collapse: collapse; }
  body { min-width: 100%; margin: 0; padding: 0; background-color: #F5F4F0; }
  img { margin: 0; padding: 0; }
  a { text-decoration: none; }
  @media only screen and (max-width: 520px) {
    .pad { padding: 0 20px !important; }
    .inner { padding: 32px 24px !important; }
  }
</style>
</head>
<body style="min-width:100%;margin:0;padding:0;background-color:#F5F4F0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="background-color:#F5F4F0;" align="center" valign="top">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="line-height:40px;font-size:1px;display:block;">&nbsp;</td></tr>
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;width:100%;max-width:520px;">
          <tr><td class="pad" style="padding:0 20px;">

            <!-- Wordmark -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding-bottom:24px;">
              <tr>
                <td align="center">
                  <span style="font-family:'Fraunces',Georgia,serif;font-size:22px;font-weight:700;color:#242019;letter-spacing:-0.4px;">Church<span style="color:#C29A3B;">Eden</span></span>
                </td>
              </tr>
            </table>

            <!-- Card -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
              <tr>
                <td style="background:#ffffff;border:1px solid #ECE9E2;border-radius:18px;box-shadow:0 12px 34px -18px rgba(36,32,25,0.28);overflow:hidden;">

                  <!-- Header band -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:linear-gradient(135deg,#2A241D 0%,#1D1813 100%);padding:26px 28px;border-bottom:1px solid #F0EDE6;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td>
                              <span style="display:inline-block;vertical-align:middle;width:9px;height:9px;border-radius:2px;background:#C29A3B;margin-right:10px;"></span>
                              <span style="font-family:'Fraunces',Georgia,serif;font-size:17px;font-weight:600;color:#F4EFE3;letter-spacing:-0.2px;">ChurchEden</span>
                            </td>
                            <td align="right">
                              <span style="font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;color:#C8A95C;letter-spacing:0.12em;text-transform:uppercase;">Security</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Body -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td class="inner" style="padding:36px 32px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                          <tr><td style="padding-bottom:12px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td align="center" style="padding-bottom:18px;">
                                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#F5F8EF;border:1px solid #DCE7CC;border-radius:999px;">
                                    <tr><td style="padding:12px 16px;font-size:18px;line-height:1;">🔒</td></tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:700;color:#242019;line-height:1.2;letter-spacing:-0.5px;text-align:center;">
                              Password changed
                            </h1>
                          </td></tr>

                          <tr><td style="padding-bottom:18px;">
                            <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;text-align:center;">
                              Hi ${name},
                            </p>
                          </td></tr>

                          <tr><td style="padding-bottom:18px;">
                            <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
                              This is a confirmation that your ChurchEden account password was changed on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
                            </p>
                          </td></tr>

                          <tr><td style="padding-bottom:18px;">
                            <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
                              If you didn't make this change, or you believe your account has been compromised, please contact our support team immediately.
                            </p>
                          </td></tr>

                          <!-- Security note -->
                          <tr><td style="padding-bottom:24px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="background:#FBF8F1;border:1px solid #F0EBDD;border-radius:10px;padding:13px 16px;">
                                  <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:13px;line-height:1.6;color:#5A564E;">
                                    Your security is our priority. Keep your password safe and never share it with anyone.
                                  </p>
                                </td>
                              </tr>
                            </table>
                          </td></tr>

                          <tr><td style="border-top:1px solid #F0EDE6;padding-top:20px;">
                            <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:11px;color:#B4AEA4;text-align:center;">© 2026 ChurchEden · Stewarding your church, beautifully.</p>
                          </td></tr>

                        </table>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>
            <tr><td style="line-height:32px;font-size:1px;display:block;">&nbsp;</td></tr>

          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;
