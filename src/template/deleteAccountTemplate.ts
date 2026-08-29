export const deleteAccountTemplate = (name: string, deletionDate: Date) => `
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
                              <span style="font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;color:#C8A95C;letter-spacing:0.12em;text-transform:uppercase;">Account Deleted</span>
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
                            <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:16px;font-weight:600;color:#2A241D;">Hi ${name},</p>
                          </td></tr>

                          <tr><td style="padding-bottom:18px;">
                            <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
                              We're writing to confirm that <strong>your ChurchEden account has been successfully deleted</strong>.
                            </p>
                          </td></tr>

                          <tr><td style="padding-bottom:18px;">
                            <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
                              All your data, ministry records, and account information have been permanently removed from our servers in accordance with our Privacy Policy. This action cannot be undone.
                            </p>
                          </td></tr>

                          <!-- Deletion details -->
                          <tr><td style="padding-bottom:24px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="background:#FDF3F3;border:1px solid #F3D8D8;border-left-width:4px;border-left-color:#B5382A;border-radius:10px;padding:16px 18px;">
                                  <p style="margin:0 0 4px;font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;color:#9A554A;letter-spacing:0.12em;text-transform:uppercase;">Deletion Date</p>
                                  <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;font-weight:700;color:#7C1F16;">${deletionDate}</p>
                                </td>
                              </tr>
                            </table>
                          </td></tr>

                          <tr><td style="padding-bottom:10px;">
                            <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;color:#2A241D;">What happens next</p>
                          </td></tr>

                          <tr><td style="padding-bottom:18px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="background:#FBF8F1;border:1px solid #F0EBDD;border-radius:10px;padding:14px 18px;">
                                  <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:14px;line-height:1.9;color:#5A564E;">
                                    • Your login credentials will no longer work<br/>
                                    • All members, giving, and ministry records will be permanently erased<br/>
                                    • You will no longer receive communications from ChurchEden
                                  </p>
                                </td>
                              </tr>
                            </table>
                          </td></tr>

                          <tr><td style="padding-bottom:24px;">
                            <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;line-height:1.75;color:#5A564E;">
                              If you didn't request this action or have any questions, please contact our support team immediately.
                            </p>
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
