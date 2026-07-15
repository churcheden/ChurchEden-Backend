export const getFirstName = (fullName?: string | null): string => {
  if (!fullName?.trim()) return 'there';
  return fullName.trim().split(/\s+/)[0] ?? 'there';
};

export const formatEmailDate = (date: Date): string =>
  date.toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' });

export const paymentEmailLayout = (
  badge: string,
  preheader: string,
  bodyHtml: string,
  signOff: string,
  ctaLabel: string,
  ctaUrl: string,
) => `
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
  a { text-decoration: none; }
</style>
</head>
<body style="min-width:100%;margin:0;padding:0;background-color:#EEEAF8;font-family:'DM Sans',Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="background-color:#EEEAF8;" align="center" valign="top">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="line-height:48px;font-size:1px;display:block;">&nbsp;</td></tr>
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;width:100%;max-width:480px;">
          <tr><td style="padding:0 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(135deg,#7C3AED 0%,#6D28D9 100%);padding:32px 36px 30px;border-radius:16px 16px 0 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <span style="font-family:'Sora',Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Remedy</span>
                      </td>
                      <td align="right">
                        <span style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:500;color:rgba(255,255,255,0.55);letter-spacing:0.8px;text-transform:uppercase;">${badge}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#ffffff;padding:44px 36px 36px;border-radius:0 0 16px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    ${bodyHtml}
                    <tr><td style="padding-bottom:32px;text-align:center;">
                      <a href="${ctaUrl}"
                        style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#ffffff;font-family:'DM Sans',Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 6px 20px rgba(124,58,237,0.35);">
                        ${ctaLabel}
                      </a>
                    </td></tr>
                    <tr><td style="border-top:1px solid #F3F4F6;padding-top:24px;">
                      <p style="margin:0 0 8px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#9CA3AF;text-align:center;">
                        Questions? <a href="mailto:support@remedy.codes" style="color:#7C3AED;">support@remedy.codes</a>
                      </p>
                      <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#9CA3AF;text-align:center;">${signOff}</p>
                    </td></tr>
                    <tr><td style="padding-top:16px;">
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

export const detailRow = (label: string, value: string, highlight = false) => `
<tr>
  <td style="padding:6px 0;font-size:14px;color:#6B7280;font-family:'DM Sans',Arial,sans-serif;">${label}</td>
  <td style="padding:6px 0;font-size:14px;font-weight:600;color:${highlight ? '#7C3AED' : '#1a1a2e'};text-align:right;font-family:'DM Sans',Arial,sans-serif;">${value}</td>
</tr>
`;

export const detailBox = (rows: string) => `
<tr><td style="padding-bottom:24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3FF;border-radius:8px;">
    <tr><td style="padding:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${rows}
      </table>
    </td></tr>
  </table>
</td></tr>
`;
