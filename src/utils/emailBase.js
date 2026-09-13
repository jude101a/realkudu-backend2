export const renderBaseTemplate = ({ preheader = "", bodyHtml, footerNote = "" }) => `
<div style="background:#f4f4f4;padding:32px 0;font-family:Arial, Helvetica, sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
    <tr>
      <td style="background:#1a1a1a;padding:20px 24px;text-align:center;">
        <img src="https://static.vecteezy.com/system/resources/previews/071/693/766/non_2x/majestic-kudu-logo-vector.jpg" alt="Real Kudu" width="130" style="display:block;margin:0 auto;" />
      </td>
    </tr>
    <tr>
      <td style="padding:32px 24px;">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px;background:#fafafa;text-align:center;">
        ${footerNote ? `<p style="margin:0 0 8px;font-size:12px;color:#999;">${footerNote}</p>` : ""}
        <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Real Kudu. All rights reserved.</p>
      </td>
    </tr>
  </table>
</div>`;

export const button = (url, label, color = "#e67e22") => `
  <div style="text-align:center;margin:24px 0;">
    <a href="${url}" style="display:inline-block;padding:14px 32px;background:${color};color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:bold;">${label}</a>
  </div>`;

export const propertyCard = (p) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;background:#ffffff;border:1px solid #eee;border-radius:8px;overflow:hidden;">
    <tr><td><img src="${p.imageUrl}" alt="${p.title}" width="600" style="width:100%;max-width:600px;height:160px;object-fit:cover;display:block;" /></td></tr>
    <tr>
      <td style="padding:14px;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:bold;color:#1a1a1a;">${p.title}</p>
        <p style="margin:0 0 6px;font-size:13px;color:#666;">${p.location}</p>
        <p style="margin:0 0 10px;font-size:14px;font-weight:bold;color:#e67e22;">${p.price}</p>
        <a href="${p.url}" style="display:inline-block;padding:8px 16px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:4px;font-size:12px;">View Property</a>
      </td>
    </tr>
  </table>`;