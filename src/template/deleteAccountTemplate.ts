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
                <td style="background:linear-gradient(135deg,#DC2626 0%,#991B1B 100%);padding:32px 36px 30px;border-radius:16px 16px 0 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <span style="font-family:'Sora',Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Remedy</span>
                      </td>
                      <td align="right">
                        <span style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:500;color:rgba(255,255,255,0.55);letter-spacing:0.8px;text-transform:uppercase;">Account Deleted</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Card body -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#ffffff;padding:40px 36px;border-radius:0 0 16px 16px;border-top:1px solid #f3e8ff;">

                  <!-- Greeting -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr><td style="line-height:24px;font-size:1px;display:block;">&nbsp;</td></tr>
                    <tr>
                      <td style="font-family:'DM Sans',Arial,sans-serif;font-size:16px;font-weight:600;line-height:24px;color:#1f2937;">
                        Hi ${name},
                      </td>
                    </tr>
                    <tr><td style="line-height:16px;font-size:1px;display:block;">&nbsp;</td></tr>
                  </table>

                  <!-- Main content -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;line-height:24px;color:#4b5563;">
                        We're writing to confirm that <strong>your Remedy account has been successfully deleted</strong>.
                      </td>
                    </tr>
                    <tr><td style="line-height:16px;font-size:1px;display:block;">&nbsp;</td></tr>
                    <tr>
                      <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;line-height:24px;color:#4b5563;">
                        All your personal data, progress, and account information have been permanently removed from our servers in accordance with our Privacy Policy. This action cannot be undone.
                      </td>
                    </tr>
                    <tr><td style="line-height:24px;font-size:1px;display:block;">&nbsp;</td></tr>
                  </table>

                  <!-- Deletion details -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#f9fafb;padding:20px;border-radius:8px;border-left:4px solid #DC2626;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
                              Deletion Date
                            </td>
                          </tr>
                          <tr><td style="line-height:8px;font-size:1px;display:block;">&nbsp;</td></tr>
                          <tr>
                            <td style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;font-weight:700;color:#1f2937;">
                              ${deletionDate}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr><td style="line-height:24px;font-size:1px;display:block;">&nbsp;</td></tr>
                  </table>

                  <!-- Additional info -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;line-height:24px;color:#4b5563;">
                        <strong>What happens next:</strong>
                      </td>
                    </tr>
                    <tr><td style="line-height:8px;font-size:1px;display:block;">&nbsp;</td></tr>
                    <tr>
                      <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;line-height:24px;color:#4b5563;">
                        • Your login credentials will no longer work<br/>
                        • All your quiz attempts and course progress will be permanently erased<br/>
                        • You will no longer receive communications from Remedy
                      </td>
                    </tr>
                    <tr><td style="line-height:24px;font-size:1px;display:block;">&nbsp;</td></tr>
                    <tr>
                      <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;line-height:24px;color:#4b5563;">
                        If you didn't request this action or have any questions, please contact our support team immediately.
                      </td>
                    </tr>
                    <tr><td style="line-height:24px;font-size:1px;display:block;">&nbsp;</td></tr>
                  </table>

                  <!-- Divider -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="border-top:1px solid #e5e7eb;">&nbsp;</td>
                    </tr>
                    <tr><td style="line-height:24px;font-size:1px;display:block;">&nbsp;</td></tr>
                  </table>

                  <!-- Footer -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <span style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;line-height:20px;color:#6b7280;">
                          © 2026 Remedy. All rights reserved.
                        </span>
                      </td>
                    </tr>
                    <tr><td style="line-height:4px;font-size:1px;display:block;">&nbsp;</td></tr>
                    <tr>
                      <td align="center">
                        <span style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;line-height:20px;color:#9ca3af;">
                          <a href="#" style="color:#7C3AED;text-decoration:none;">Privacy Policy</a> | <a href="#" style="color:#7C3AED;text-decoration:none;">Terms of Service</a>
                        </span>
                      </td>
                    </tr>
                    <tr><td style="line-height:48px;font-size:1px;display:block;">&nbsp;</td></tr>
                  </table>

                </td>
              </tr>
            </table>

          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>

</body>
</html>
`;
