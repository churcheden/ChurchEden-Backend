/**
 * Email template for OTP-based email verification
 * @param otp - 6-digit one-time password
 * @param name - User's name
 * @returns HTML email template
 */
export const verifyEmailOTPTemplate = (otp: string, name: string) => `
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
                      <td>
                        <span style="font-family:'Sora',Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Remedy</span>
                      </td>
                      <td align="right">
                        <span style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:500;color:rgba(255,255,255,0.55);letter-spacing:0.8px;text-transform:uppercase;">Email Verification</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Card body -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#ffffff;padding:44px 36px 36px;border-radius:0 0 16px 16px;">

                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                    <tr><td style="padding-bottom:12px;">
                      <h1 style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:28px;font-weight:800;color:#0D0618;line-height:1.2;letter-spacing:-0.5px;">
                        Verify your email,<br/>
                        <span style="color:#7C3AED;">${name}</span> 👋
                      </h1>
                    </td></tr>

                    <tr><td style="padding-bottom:32px;">
                      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.75;color:#4B5563;">
                        Thanks for signing up to Remedy! Use the verification code below to confirm your email address. This code will expire in 15 minutes.
                      </p>
                    </td></tr>

                    <tr><td style="padding-bottom:32px;text-align:center;">
                      <div style="background:#F5F3FF;border:2px dashed #7C3AED;border-radius:12px;padding:28px 20px;">
                        <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#6B7280;letter-spacing:2px;margin-bottom:12px;text-transform:uppercase;">Your Verification Code</p>
                        <p style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:48px;font-weight:800;color:#7C3AED;letter-spacing:8px;word-spacing:16px;">${otp}</p>
                      </div>
                    </td></tr>

                    <tr><td style="padding-bottom:32px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background:#F5F3FF;border-left:3px solid #7C3AED;border-radius:0 8px 8px 0;padding:14px 16px;">
                            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;line-height:1.6;color:#5B21B6;">
                              ⏱ &nbsp;This code expires in <strong>15 minutes</strong>. If you didn't create a Remedy account, please ignore this email.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td></tr>

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
</body>
</html>
`;
