import { Injectable, Logger, Optional } from '@nestjs/common';
import type { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { FirebaseService } from '../firebase/firebase.service';

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

// ─── Shared Email Layout Builder ──────────────────────────────────────────────

/**
 * Wraps email content in a consistent, professional branded layout.
 * @param content    Inner HTML content (headlines, paragraphs, CTAs, tables)
 * @param accentColor  Hex color for the top accent bar (default: green #166534)
 */
function emailLayout(content: string, accentColor = '#166534'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>WeConnect</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Top accent bar -->
        <tr><td style="height:4px;background:${accentColor};"></td></tr>

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">WeConnect</span>
                  <span style="color:#64748b;font-size:13px;margin-left:8px;">E-Waste Aggregator Platform</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
                    This is an automated message from <strong>WeConnect</strong> — India's E-Waste Aggregation Platform.<br/>
                    If you did not expect this email, you can safely ignore it.
                  </p>
                </td>
                <td align="right" style="white-space:nowrap;">
                  <p style="margin:0;font-size:11px;color:#cbd5e1;">© ${new Date().getFullYear()} WeConnect</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Renders a coloured alert banner at the top of the email body */
function alertBanner(
  icon: string,
  message: string,
  bg: string,
  border: string,
  color: string,
): string {
  return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:16px 20px;margin-bottom:24px;">
    <h2 style="margin:0;color:${color};font-size:17px;font-weight:800;">${icon}&nbsp;${message}</h2>
  </div>`;
}

/** Renders a highlighted info box with a coloured left border */
function infoBox(
  content: string,
  borderColor = '#3b82f6',
  bg = '#f1f5f9',
): string {
  return `<div style="background:${bg};border-left:4px solid ${borderColor};border-radius:4px;padding:14px 18px;margin:16px 0;">
    ${content}
  </div>`;
}

/** Primary CTA button */
function ctaButton(label: string, url: string, bg = '#166534'): string {
  return `<a href="${url}" style="display:inline-block;background:${bg};color:#ffffff;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin:20px 0;letter-spacing:0.2px;">${label} &rarr;</a>`;
}

/** Divider line */
const divider = `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>`;

/** Greeting paragraph */
function greeting(name: string): string {
  return `<p style="font-size:15px;color:#1e293b;margin:0 0 16px;">Dear <strong>${name}</strong>,</p>`;
}

/** Renders a two-column key-value data table */
function dataTable(rows: [string, string][]): string {
  const rowsHtml = rows
    .map(
      ([label, value], i) =>
        `<tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'};">
          <td style="padding:10px 16px;color:#64748b;font-weight:600;font-size:13px;width:40%;border-bottom:1px solid #e2e8f0;">${label}</td>
          <td style="padding:10px 16px;font-weight:700;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0;">${value}</td>
        </tr>`,
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin:16px 0;">
    ${rowsHtml}
  </table>`;
}

/** Standard closing sign-off */
const signOff = `${divider}<p style="font-size:13px;color:#64748b;margin:0;">Warm regards,<br/><strong style="color:#0f172a;">The WeConnect Team</strong></p>`;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private firebaseService: FirebaseService,
    @Optional() @InjectQueue('email') private emailQueue?: Queue,
  ) {}

  /**
   * Send email notification by pushing to background queue.
   */
  async sendEmail(payload: EmailPayload): Promise<void> {
    if (this.emailQueue) {
      await this.emailQueue.add('send', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });
      this.logger.log(`Queued email to ${payload.to}`);
    } else {
      this.logger.warn(
        `Queue not available, sending email synchronously to ${payload.to}`,
      );
      await this.executeSendEmail(payload);
    }
  }

  /**
   * Actual execution logic (called by EmailProcessor)
   */
  async executeSendEmail(payload: EmailPayload): Promise<void> {
    const fromEmail = process.env.AWS_SES_FROM_EMAIL;
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!fromEmail || !accessKeyId || accessKeyId === 'your_aws_access_key') {
      this.logger.warn(
        `[EMAIL SKIPPED — SES NOT CONFIGURED] To: ${payload.to} | Subject: ${payload.subject}`,
      );
      this.logger.debug(`Body: ${payload.body}`);
      return;
    }

    try {
      const { SESClient, SendEmailCommand } =
        await import('@aws-sdk/client-ses');
      const ses = new SESClient({
        region,
        credentials: { accessKeyId, secretAccessKey: secretAccessKey! },
      });

      await ses.send(
        new SendEmailCommand({
          Source: fromEmail,
          Destination: { ToAddresses: [payload.to] },
          Message: {
            Subject: { Data: payload.subject },
            Body: { Html: { Data: payload.body } },
          },
        }),
      );

      this.logger.log(`✉️ Email sent to ${payload.to}: ${payload.subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${payload.to}`, error);
    }
  }

  // ─── SMS via AWS SNS ─────────────────────────────────────

  async sendSms(phone: string, message: string): Promise<void> {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'ap-southeast-2';

    if (!accessKeyId || accessKeyId === 'your_aws_access_key') {
      this.logger.warn(
        `[SMS SKIPPED — SNS NOT CONFIGURED] To: ${phone} | ${message}`,
      );
      return;
    }

    try {
      // @ts-ignore
      const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');
      const sns = new SNSClient({
        region,
        credentials: { accessKeyId, secretAccessKey: secretAccessKey! },
      });

      let normalized = phone.replace(/\s+/g, '');
      if (normalized.length === 10 && /^\d+$/.test(normalized))
        normalized = '+91' + normalized;
      else if (!normalized.startsWith('+')) normalized = '+' + normalized;

      await sns.send(
        new PublishCommand({
          PhoneNumber: normalized,
          Message: message,
          MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: 'WeConnect',
            },
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
          },
        }),
      );
      this.logger.log(`📱 SMS sent to ${phone}`);
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${phone}`, error);
    }
  }

  // ─── Pre-built notification templates ────────────────────

  async notifyAuditInvitation(
    vendorEmail: string,
    vendorName: string,
    requirementTitle: string,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] Audit Invitation — ${requirementTitle}`,
      body: emailLayout(
        `
        ${alertBanner('🔍', 'You Have Been Invited to Conduct a Site Audit', '#eff6ff', '#93c5fd', '#1e40af')}
        ${greeting(vendorName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">You have been selected by our admin team to conduct an on-site audit for the following listing:</p>
        ${infoBox(`<p style="margin:0;font-weight:700;font-size:15px;color:#1e293b;">${requirementTitle}</p>`, '#3b82f6', '#eff6ff')}
        <p style="color:#475569;font-size:14px;margin:16px 0;">Please log in to the WeConnect portal to review the details, download the material list, and respond to the invitation.</p>
        ${ctaButton('View Audit Details', `${webUrl}/vendor/audits`, '#1e40af')}
        ${signOff}
      `,
        '#1e40af',
      ),
    });
  }

  async notifyLiveAuctionApproved(
    vendorEmail: string,
    vendorName: string,
    auctionTitle: string,
    auctionDetailsUrl: string,
    openPhaseStart?: string | null,
    openPhaseEnd?: string | null,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const timingBlock =
      openPhaseStart || openPhaseEnd
        ? `
      <div style="background:#f0fdf4;border:1px solid #86efac;padding:14px 18px;border-radius:8px;margin:16px 0;">
        ${openPhaseStart ? `<p style="margin:0 0 6px;font-size:13px;color:#166534;"><strong>🟢 Open Bidding Starts:</strong> ${openPhaseStart}</p>` : ''}
        ${openPhaseEnd ? `<p style="margin:0;font-size:13px;color:#166534;"><strong>🔴 Open Bidding Ends:</strong> ${openPhaseEnd}</p>` : ''}
      </div>`
        : '';

    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] You're Approved for Live Auction — ${auctionTitle}`,
      body: emailLayout(`
        ${alertBanner('🎉', "You're Approved for the Live Open Auction!", '#f0fdf4', '#86efac', '#166534')}
        ${greeting(vendorName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">Congratulations! You have been approved to participate in the live open auction for:</p>
        ${infoBox(`<p style="margin:0;font-weight:700;font-size:15px;color:#1e293b;">${auctionTitle}</p>`, '#22c55e', '#f0fdf4')}
        ${timingBlock}
        <p style="color:#475569;font-size:14px;margin:16px 0;">Join the live auction floor to place your open bids in real time. Make sure you are ready before bidding opens.</p>
        ${ctaButton('Join Live Auction', `${webUrl}/vendor/live-auction`, '#166534')}
        <p style="color:#64748b;font-size:12px;margin-top:8px;">Full auction details: <a href="${auctionDetailsUrl}" style="color:#3b82f6;">${auctionDetailsUrl}</a></p>
        ${signOff}
      `),
    });
  }

  async notifyClientLiveAuctionApproval(
    clientEmail: string,
    clientName: string,
    auctionTitle: string,
    configureUrl: string,
  ) {
    return this.sendEmail({
      to: clientEmail,
      subject: `[WeConnect] Action Required: Approve Live Auction Parameters — ${auctionTitle}`,
      body: emailLayout(
        `
        ${alertBanner('⚙️', 'Live Auction Parameters Awaiting Your Approval', '#fffbeb', '#fcd34d', '#92400e')}
        ${greeting(clientName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">Our admin team has configured the live auction parameters for the following listing:</p>
        ${infoBox(`<p style="margin:0;font-weight:700;font-size:15px;color:#1e293b;">${auctionTitle}</p>`, '#f59e0b', '#fffbeb')}
        <p style="color:#475569;font-size:14px;margin:16px 0;">Please review the configuration and approve it so that participating vendors can be notified and the live auction can begin.</p>
        ${ctaButton('Review & Approve Parameters', configureUrl, '#d97706')}
        ${signOff}
      `,
        '#f59e0b',
      ),
    });
  }

  async notifyBidClosingSoon(
    vendorEmail: string,
    vendorName: string,
    auctionTitle: string,
    minutesLeft: number,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] ⏰ Auction Closing in ${minutesLeft} Minutes — ${auctionTitle}`,
      body: emailLayout(
        `
        ${alertBanner('⏰', `Auction Closes in ${minutesLeft} Minutes — Act Now!`, '#fff7ed', '#fdba74', '#9a3412')}
        ${greeting(vendorName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">This is a reminder that the following auction is closing very soon:</p>
        ${infoBox(
          `
          <p style="margin:0;font-weight:700;font-size:15px;color:#1e293b;">${auctionTitle}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#9a3412;font-weight:600;">⏰ Closes in <strong>${minutesLeft} minutes</strong></p>
        `,
          '#f97316',
          '#fff7ed',
        )}
        <p style="color:#475569;font-size:14px;margin:16px 0;">If you haven't placed your final bid yet, log in now before the auction closes.</p>
        ${ctaButton('Place My Final Bid', `${webUrl}/vendor/live-auction`, '#ea580c')}
        ${signOff}
      `,
        '#f97316',
      ),
    });
  }

  async notifyPaymentPending(
    vendorEmail: string,
    vendorName: string,
    auctionTitle: string,
    amount: number,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] Payment Required — ${auctionTitle}`,
      body: emailLayout(
        `
        ${alertBanner('💳', 'Payment Required to Complete Your Auction Win', '#eff6ff', '#93c5fd', '#1e40af')}
        ${greeting(vendorName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">Congratulations on winning the auction! Your bid has been accepted. Please complete the payment to proceed with the pickup.</p>
        ${dataTable([
          ['Auction', auctionTitle],
          ['Amount Due', `₹${amount.toLocaleString('en-IN')}`],
          ['Payment Deadline', '5 business days from this notice'],
        ])}
        <p style="color:#475569;font-size:14px;margin:16px 0;">Please log in to the WeConnect portal to view the payment instructions and submit your payment proof.</p>
        ${ctaButton('Submit Payment', `${webUrl}/vendor/payments`, '#1e40af')}
        ${infoBox(`<p style="margin:0;font-size:13px;color:#92400e;">⚠️ Failure to submit payment within 5 business days may result in disqualification from this and future auctions.</p>`, '#f59e0b', '#fffbeb')}
        ${signOff}
      `,
        '#1e40af',
      ),
    });
  }

  async notifyPaymentVerified(
    email: string,
    name: string,
    auctionTitle: string,
    role: 'CLIENT' | 'VENDOR',
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const isVendor = role === 'VENDOR';
    const nextSteps = isVendor
      ? 'You may now proceed to schedule the pickup and upload the required compliance documents.'
      : 'The vendor will now schedule the pickup and provide all compliance documentation. You will be notified at each step.';
    const ctaUrl = isVendor
      ? `${webUrl}/vendor/handover`
      : `${webUrl}/client/handover`;
    const ctaLabel = isVendor ? 'Schedule Pickup' : 'View Handover Status';

    return this.sendEmail({
      to: email,
      subject: `[WeConnect] Payment Confirmed — ${auctionTitle}`,
      body: emailLayout(`
        ${alertBanner('✅', 'Payment Successfully Verified', '#f0fdf4', '#86efac', '#166534')}
        ${greeting(name)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">We are pleased to confirm that the payment for the following auction has been successfully verified by our team:</p>
        ${infoBox(`<p style="margin:0;font-weight:700;font-size:15px;color:#1e293b;">${auctionTitle}</p>`, '#22c55e', '#f0fdf4')}
        <p style="color:#475569;font-size:14px;margin:16px 0;">${nextSteps}</p>
        ${ctaButton(ctaLabel, ctaUrl)}
        ${signOff}
      `),
    });
  }

  async notifyComplianceVerified(
    clientEmail: string,
    clientName: string,
    auctionTitle: string,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return this.sendEmail({
      to: clientEmail,
      subject: `[WeConnect] Compliance Documents Verified — ${auctionTitle}`,
      body: emailLayout(`
        ${alertBanner('✅', 'All Compliance Documents Have Been Verified', '#f0fdf4', '#86efac', '#166534')}
        ${greeting(clientName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">All compliance documents submitted by the vendor for the following project have been successfully verified by the WeConnect admin team:</p>
        ${infoBox(`<p style="margin:0;font-weight:700;font-size:15px;color:#1e293b;">${auctionTitle}</p>`, '#22c55e', '#f0fdf4')}
        <p style="color:#475569;font-size:14px;margin:16px 0;">You can now download the final compliance document bundle from your dashboard for your records.</p>
        ${ctaButton('Download Documents', `${webUrl}/client/dashboard`)}
        ${signOff}
      `),
    });
  }

  async notifyCompliancePending(
    vendorEmail: string,
    vendorName: string,
    auctionTitle: string,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] Action Required: Upload Compliance Documents — ${auctionTitle}`,
      body: emailLayout(
        `
        ${alertBanner('📋', 'Compliance Documents Required', '#eff6ff', '#93c5fd', '#1e40af')}
        ${greeting(vendorName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">Payment has been confirmed for the following auction. Please upload the required compliance documents to proceed with handover.</p>
        ${infoBox(`<p style="margin:0;font-weight:700;font-size:15px;color:#1e293b;">${auctionTitle}</p>`, '#3b82f6', '#eff6ff')}
        <p style="font-weight:700;font-size:13px;color:#1e293b;margin:20px 0 8px;">Required Documents:</p>
        <ul style="color:#475569;font-size:13px;line-height:2;margin:0 0 16px;padding-left:20px;">
          <li>Form 6 / Manifest</li>
          <li>Weight Slip (Empty Vehicle)</li>
          <li>Weight Slip (Loaded Vehicle)</li>
          <li>Recycling Certificate</li>
          <li>Disposal Certificate</li>
          <li>E-Way Bill (if applicable)</li>
        </ul>
        ${ctaButton('Upload Compliance Documents', `${webUrl}/vendor/handover`, '#1e40af')}
        ${signOff}
      `,
        '#1e40af',
      ),
    });
  }

  async notifyAccountApproved(
    userEmail: string,
    userName: string,
    userPhone?: string,
  ) {
    const portalUrl = process.env.WEB_URL || 'http://localhost:3000';
    await this.sendEmail({
      to: userEmail,
      subject: '[WeConnect] Account Approved — Welcome Aboard!',
      body: emailLayout(`
        ${alertBanner('🎉', 'Your Account Has Been Approved!', '#f0fdf4', '#86efac', '#166534')}
        ${greeting(userName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">We're delighted to inform you that your WeConnect account has been <strong>approved</strong> by our admin team. You now have full access to the platform.</p>
        <p style="font-weight:700;font-size:13px;color:#1e293b;margin:20px 0 8px;">You can now:</p>
        <ul style="color:#475569;font-size:13px;line-height:2;margin:0 0 20px;padding-left:20px;">
          <li>Access your complete dashboard</li>
          <li>Browse and participate in auctions</li>
          <li>Manage your listings and compliance documents</li>
        </ul>
        ${ctaButton('Login to WeConnect', portalUrl)}
        <p style="color:#64748b;font-size:13px;margin-top:16px;">If you have any questions, please don't hesitate to contact our support team.</p>
        ${signOff}
      `),
    });
    if (userPhone) {
      await this.sendSms(
        userPhone,
        `WeConnect: Hi ${userName}, your account has been APPROVED! Login at ${portalUrl} to access your dashboard.`,
      );
    }
  }

  async notifyAccountRejected(
    userEmail: string,
    userName: string,
    userPhone?: string,
    reason?: string,
  ) {
    await this.sendEmail({
      to: userEmail,
      subject: '[WeConnect] Account Application Update',
      body: emailLayout(
        `
        ${alertBanner('❌', 'Account Application Not Approved', '#fef2f2', '#fca5a5', '#991b1b')}
        ${greeting(userName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">We regret to inform you that your WeConnect account application has <strong>not been approved</strong> at this time after review by our admin team.</p>
        ${
          reason
            ? infoBox(
                `
          <p style="margin:0 0 6px;font-weight:700;font-size:13px;color:#64748b;">Reason provided by admin:</p>
          <p style="margin:0;color:#1e293b;font-size:14px;">${reason}</p>
        `,
                '#ef4444',
                '#fef2f2',
              )
            : ''
        }
        <p style="color:#475569;font-size:14px;margin:16px 0;">If you believe this decision was made in error, or if you would like to reapply with the correct documentation, please contact our support team and we will be happy to assist you.</p>
        ${signOff}
      `,
        '#ef4444',
      ),
    });
    if (userPhone) {
      await this.sendSms(
        userPhone,
        `WeConnect: Hi ${userName}, your account application has not been approved at this time.${reason ? ` Reason: ${reason}` : ''} Contact support for assistance.`,
      );
    }
  }

  async notifyAccountOnHold(
    userEmail: string,
    userName: string,
    userPhone?: string,
    reason?: string,
  ) {
    await this.sendEmail({
      to: userEmail,
      subject: '[WeConnect] Your Account is Under Additional Review',
      body: emailLayout(
        `
        ${alertBanner('⏸️', 'Account Under Additional Review', '#fffbeb', '#fcd34d', '#92400e')}
        ${greeting(userName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">Your WeConnect account is currently <strong>on hold</strong> pending additional verification by our admin team. No action is required from you at this time.</p>
        ${
          reason
            ? infoBox(
                `
          <p style="margin:0 0 6px;font-weight:700;font-size:13px;color:#64748b;">Reason provided by admin:</p>
          <p style="margin:0;color:#1e293b;font-size:14px;">${reason}</p>
        `,
                '#f59e0b',
                '#fffbeb',
              )
            : ''
        }
        <p style="color:#475569;font-size:14px;margin:16px 0;">Our team will review your account and reach out to you within <strong>24–72 hours</strong>. Please ensure all required documents have been uploaded correctly to your profile.</p>
        ${signOff}
      `,
        '#f59e0b',
      ),
    });
    if (userPhone) {
      await this.sendSms(
        userPhone,
        `WeConnect: Hi ${userName}, your account is currently on hold pending additional review.${reason ? ` Reason: ${reason}` : ''} Our team will contact you within 24-72 hours.`,
      );
    }
  }

  async notifyPendingApproval(userEmail: string, userName: string) {
    return this.sendEmail({
      to: userEmail,
      subject: '[WeConnect] Registration Received — Account Under Review',
      body: emailLayout(
        `
        ${alertBanner('🔍', 'Your Registration is Under Review', '#eff6ff', '#93c5fd', '#1e40af')}
        ${greeting(userName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">Thank you for registering on the WeConnect E-Waste Aggregator Platform. We have received your application and it is currently being reviewed by our admin team.</p>
        ${infoBox(
          `
          <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600;">⏱️ Expected Review Time: 24–72 business hours</p>
          <p style="margin:6px 0 0;font-size:13px;color:#475569;">You will receive an email notification as soon as a decision has been made on your account.</p>
        `,
          '#3b82f6',
          '#eff6ff',
        )}
        <p style="color:#475569;font-size:14px;margin:16px 0;">In the meantime, please ensure all required company documents and details have been submitted through your profile. Incomplete applications may delay the review process.</p>
        ${signOff}
      `,
        '#1e40af',
      ),
    });
  }

  async notifyVendorPickupRequested(
    vendorEmail: string,
    vendorName: string,
    productName: string,
    offeredPrice: number,
    userName: string,
    userEmail: string,
    userPhone: string | null,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] Pickup Requested — ${productName}`,
      body: emailLayout(`
        ${alertBanner('🎉', 'Your Quote Was Accepted — Pickup Requested!', '#f0fdf4', '#86efac', '#166534')}
        ${greeting(vendorName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">A user has accepted your quote and requested a pickup for the following product:</p>
        ${infoBox(
          `
          <p style="margin:0;font-weight:700;font-size:15px;color:#1e293b;">${productName}</p>
          <p style="margin:6px 0 0;color:#64748b;font-size:13px;">Accepted Quote: <strong style="color:#166534;">₹${offeredPrice.toLocaleString('en-IN')}</strong></p>
        `,
          '#22c55e',
          '#f0fdf4',
        )}
        <p style="font-weight:700;font-size:13px;color:#1e293b;margin:20px 0 8px;">📋 User Contact Details</p>
        ${dataTable([
          ['Name', userName],
          [
            'Email',
            `<a href="mailto:${userEmail}" style="color:#3b82f6;font-weight:700;">${userEmail}</a>`,
          ],
          [
            'Phone',
            userPhone
              ? `<a href="tel:${userPhone}" style="color:#3b82f6;">${userPhone}</a>`
              : 'Not provided',
          ],
        ])}
        <p style="color:#475569;font-size:14px;margin:16px 0;">Please reach out to the user directly via email or phone to arrange a convenient pickup date and time.</p>
        ${ctaButton('View in Dashboard', `${webUrl}/vendor/individual-products`)}
        ${signOff}
      `),
    });
  }

  async notifyClientUploadGatePass(
    clientEmail: string,
    clientName: string,
    auctionTitle: string,
    vendorName: string,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return this.sendEmail({
      to: clientEmail,
      subject: `[WeConnect] Action Required: Issue Gate Pass — ${auctionTitle}`,
      body: emailLayout(
        `
        ${alertBanner('📋', 'Please Issue the Gate Pass for Vendor Pickup', '#eff6ff', '#93c5fd', '#1e40af')}
        ${greeting(clientName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">The vendor payment for the following auction has been verified. The vendor is now ready to arrange material pickup.</p>
        ${dataTable([
          ['Auction', auctionTitle],
          ['Vendor', vendorName],
          ['Next Action', 'Issue Gate Pass & Upload Document'],
        ])}
        <p style="color:#475569;font-size:14px;margin:16px 0;">Please log in to the <strong>Handover & Gate Pass</strong> section of your dashboard to fill in the gate pass details and upload the gate pass document so the vendor can proceed.</p>
        ${ctaButton('Issue Gate Pass Now', `${webUrl}/client/handover`, '#1e40af')}
        ${signOff}
      `,
        '#1e40af',
      ),
    });
  }

  async notifyVendorGatePassUploaded(
    vendorEmail: string,
    vendorName: string,
    auctionTitle: string,
    clientName: string,
    gatePassNumber: string,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] Gate Pass Ready — Proceed with Logistics — ${auctionTitle}`,
      body: emailLayout(`
        ${alertBanner('✅', 'Gate Pass Uploaded — Proceed with Pickup', '#f0fdf4', '#86efac', '#166534')}
        ${greeting(vendorName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">The client has issued and uploaded the gate pass for your pickup. You may now proceed with the logistics.</p>
        ${dataTable([
          ['Auction', auctionTitle],
          ['Client', clientName],
          [
            'Gate Pass No.',
            `<strong style="color:#166534;font-size:15px;">${gatePassNumber}</strong>`,
          ],
        ])}
        <p style="color:#475569;font-size:14px;margin:16px 0;">Please download the gate pass document, arrange your vehicle and driver, and proceed to the client site on the scheduled date for material pickup.</p>
        <p style="font-weight:700;font-size:13px;color:#1e293b;margin:20px 0 8px;">After Pickup — Upload Compliance Documents:</p>
        <ul style="color:#475569;font-size:13px;line-height:2;margin:0 0 16px;padding-left:20px;">
          <li>Form 6 / Manifest</li>
          <li>Weight Slip (Empty & Loaded)</li>
          <li>Recycling / Disposal Certificate</li>
          <li>E-Way Bill and Delivery Challan</li>
        </ul>
        ${ctaButton('View Gate Pass & Acknowledge', `${webUrl}/vendor/handover`)}
        ${signOff}
      `),
    });
  }

  async notifyAdminNewRegistration(
    adminEmail: string,
    userName: string,
    userEmail: string,
    role: string,
    companyName: string,
    registrationDate: Date,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return this.sendEmail({
      to: adminEmail,
      subject: `[WeConnect Admin] New Registration Pending — ${companyName}`,
      body: emailLayout(
        `
        ${alertBanner('🔔', 'New User Registration Requires Your Approval', '#fffbeb', '#fcd34d', '#92400e')}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">A new company has registered on the platform and is awaiting admin review and approval.</p>
        ${dataTable([
          ['Name', userName],
          [
            'Email',
            `<a href="mailto:${userEmail}" style="color:#3b82f6;">${userEmail}</a>`,
          ],
          ['Role', role],
          ['Company', companyName],
          [
            'Registered On',
            registrationDate.toLocaleString('en-IN', {
              dateStyle: 'long',
              timeStyle: 'short',
            }),
          ],
        ])}
        <p style="color:#475569;font-size:14px;margin:16px 0;">Please log in to the admin dashboard to review the applicant's documents and approve or reject this registration.</p>
        ${ctaButton('Review Registration', `${webUrl}/admin/users`, '#d97706')}
        ${signOff}
      `,
        '#f59e0b',
      ),
    });
  }

  async notifyAuditSpocDetails(
    vendorEmail: string,
    vendorName: string,
    clientName: string,
    spocName: string,
    spocPhone: string,
    siteAddress: string,
  ) {
    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] Audit Accepted — SPOC & Site Details for ${clientName}`,
      body: emailLayout(`
        ${alertBanner('📍', 'Audit Accepted — Site & Contact Details Enclosed', '#f0fdf4', '#86efac', '#166534')}
        ${greeting(vendorName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">You have successfully accepted the site audit for <strong>${clientName}</strong>. Below are the site address and SPOC contact details for coordinating your visit.</p>
        <p style="font-weight:700;font-size:13px;color:#1e293b;margin:20px 0 8px;">Site & SPOC Details</p>
        ${dataTable([
          ['Client', clientName],
          ['Site Address', siteAddress],
          ['SPOC Name', spocName],
          [
            'SPOC Phone',
            `<a href="tel:${spocPhone}" style="color:#3b82f6;font-weight:700;">${spocPhone}</a>`,
          ],
        ])}
        ${infoBox(`<p style="margin:0;font-size:13px;color:#166534;">📞 Please contact the SPOC directly to schedule a suitable date and time for the on-site audit visit.</p>`, '#22c55e', '#f0fdf4')}
        <p style="color:#475569;font-size:14px;margin:16px 0;">After completing the audit, remember to upload your audit report and filled price sheet before the sealed bid deadline.</p>
        ${signOff}
      `),
    });
  }

  async notifyClientSheetReady(
    clientEmail: string,
    clientName: string,
    requirementTitle: string,
    requirementId: string,
  ) {
    const portalUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/client/listings`;
    return this.sendEmail({
      to: clientEmail,
      subject: `[WeConnect] Your Processed Material Sheet is Ready — ${requirementTitle}`,
      body: emailLayout(
        `
        ${alertBanner('📄', 'Processed Material Sheet Ready for Your Approval', '#eff6ff', '#93c5fd', '#1e40af')}
        ${greeting(clientName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">Our admin team has reviewed, cleaned, and processed the material list for your listing. It is now ready for your review.</p>
        ${infoBox(`<p style="margin:0;font-weight:700;font-size:15px;color:#1e293b;">${requirementTitle}</p>`, '#3b82f6', '#eff6ff')}
        <p style="font-weight:700;font-size:13px;color:#1e293b;margin:20px 0 8px;">What you need to do:</p>
        <ol style="color:#475569;font-size:13px;line-height:2;margin:0 0 16px;padding-left:20px;">
          <li>Log in and review the processed material sheet</li>
          <li>Set your <strong>target / reserve price</strong></li>
          <li>Approve the sheet to trigger vendor invitations</li>
        </ol>
        ${ctaButton('Review & Approve Sheet', portalUrl, '#1e40af')}
        <p style="color:#64748b;font-size:13px;margin-top:8px;">Once you approve, invitation emails will be sent automatically to the selected vendors and the sealed bidding process will begin.</p>
        ${signOff}
      `,
        '#1e40af',
      ),
    });
  }

  /**
   * Sent to every vendor selected by the admin once the client approves the processed sheet.
   */
  async notifySealedBidInvitation(
    vendorEmail: string,
    vendorName: string,
    requirementTitle: string,
    requirementId: string,
    sealedBidDeadline: string,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const acceptUrl = `${webUrl}/vendor/invitations/${requirementId}?action=accept`;
    const declineUrl = `${webUrl}/vendor/invitations/${requirementId}?action=decline`;

    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] 🔒 Sealed Bid Invitation — ${requirementTitle}`,
      body: emailLayout(
        `
        ${alertBanner('🔒', 'You Have Been Invited to Submit a Sealed Bid', '#eff6ff', '#93c5fd', '#1e40af')}
        ${greeting(vendorName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">You have been selected to participate in a sealed bid auction. Please review the details below and respond to this invitation.</p>
        ${dataTable([
          ['Auction / Listing', requirementTitle],
          ['Sealed Bid Deadline', sealedBidDeadline],
          ['Process', 'Sealed Bid → Site Audit → Live Open Auction'],
        ])}
        <p style="font-weight:700;font-size:13px;color:#1e293b;margin:20px 0 8px;">Please respond to this invitation:</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr>
            <td style="padding-right:12px;">
              <a href="${acceptUrl}" style="display:inline-block;background:#166534;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">✅ Accept Invitation</a>
            </td>
            <td>
              <a href="${declineUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">❌ Decline Invitation</a>
            </td>
          </tr>
        </table>
        ${infoBox(`<p style="margin:0;font-size:13px;color:#92400e;">⚠️ <strong>If you accept:</strong> You will be directed to download the material list, conduct a site audit, and submit your filled price sheet before the sealed bid deadline.</p>`, '#f59e0b', '#fffbeb')}
        <p style="font-weight:700;font-size:13px;color:#1e293b;margin:20px 0 8px;">Process Overview:</p>
        <ol style="color:#475569;font-size:13px;line-height:2;margin:0 0 16px;padding-left:20px;">
          <li>Accept invitation &amp; download the cleaned material list</li>
          <li>Conduct site audit and upload your audit report</li>
          <li>Submit your filled price sheet with your sealed bid</li>
          <li>Shortlisted vendors join the <strong>Live Open Auction</strong></li>
        </ol>
        ${signOff}
      `,
        '#1e40af',
      ),
    });
  }

  async notifyVendorDisqualified(
    vendorEmail: string,
    vendorName: string,
    auctionTitle: string,
    reason: string,
    fineAmount: number,
  ) {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] Auction Disqualification Notice — ${auctionTitle}`,
      body: emailLayout(
        `
        ${alertBanner('⚠️', 'Auction Winner Disqualification Notice', '#fef2f2', '#fca5a5', '#991b1b')}
        ${greeting(vendorName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">We regret to inform you that your selection as the winner for the following auction has been <strong>revoked</strong> by the WeConnect admin team:</p>
        ${infoBox(`<p style="margin:0;font-weight:700;font-size:15px;color:#1e293b;">${auctionTitle}</p>`, '#ef4444', '#fef2f2')}
        <p style="font-weight:700;font-size:13px;color:#1e293b;margin:20px 0 8px;">Reason for Disqualification:</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px 18px;border-radius:6px;margin-bottom:20px;">
          <p style="margin:0;color:#334155;font-size:14px;">${reason}</p>
        </div>
        ${
          fineAmount > 0
            ? `
        <div style="background:#fff7ed;border:1px solid #fdba74;padding:16px 20px;border-radius:8px;margin:20px 0;">
          <p style="margin:0 0 6px;font-weight:700;color:#9a3412;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">⚠️ Penalty / Fine Levied</p>
          <p style="margin:0;font-size:28px;font-weight:900;color:#c2410c;">₹${fineAmount.toLocaleString('en-IN')}</p>
          <p style="margin:8px 0 0;font-size:12px;color:#9a3412;">This fine must be paid within 5 business days. Contact our support team for payment instructions.</p>
        </div>`
            : ''
        }
        <p style="color:#475569;font-size:14px;margin:16px 0;">If you believe this decision was made in error, please contact our support team with relevant documentation and we will review your case.</p>
        ${ctaButton('Go to Dashboard', `${webUrl}/vendor/auctions`, '#1e293b')}
        ${signOff}
      `,
        '#ef4444',
      ),
    });
  }

  /**
   * Sent to the winning vendor after the admin selects them as auction winner.
   */
  async notifyAuctionWinner(
    vendorEmail: string,
    vendorName: string,
    requirementTitle: string,
    winningAmount: number,
    clientName: string,
    auctionId: string,
  ) {
    const commissionAmount = Math.round(winningAmount * 0.05);
    const clientAmount = winningAmount - commissionAmount;
    const portalUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/vendor/final-quote`;
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';

    const steps: [string, string, string | null][] = [
      [
        'Upload Final Quote',
        `Log in and upload your <strong>product-wise quotation</strong> (PDF) and <strong>company letterhead quotation</strong>.`,
        '/vendor/final-quote',
      ],
      [
        'Await Client Approval',
        'The client will review your quote. You will be notified by email once they respond.',
        null,
      ],
      [
        'Make Payment',
        `Pay <strong>₹${clientAmount.toLocaleString('en-IN')}</strong> to client (${clientName}) + <strong>₹${commissionAmount.toLocaleString('en-IN')}</strong> (5% commission) to WeConnect. Bank details available on the Payments page.`,
        '/vendor/payments',
      ],
      [
        'Upload Payment Proof',
        'Upload your payment screenshot and UTR number for both transfers to confirm.',
        '/vendor/payments',
      ],
      [
        'Receive Gate Pass & Schedule Pickup',
        'Once payment is verified, the client will issue a gate pass. Acknowledge it and proceed to the site.',
        '/vendor/handover',
      ],
      [
        'Upload Compliance Documents',
        'On pickup day: Form 6, Weight Slips (Empty & Loaded), Recycling Certificate, Disposal Certificate, E-Way Bill.',
        '/vendor/handover',
      ],
    ];

    const stepsHtml = steps
      .map(
        ([title, desc, url], i) => `
        <div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start;">
          <div style="min-width:28px;height:28px;background:#1e40af;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;text-align:center;line-height:28px;">${i + 1}</div>
          <div style="flex:1;">
            <p style="margin:0;font-weight:700;color:#1e293b;font-size:14px;">${title}</p>
            <p style="margin:4px 0 0;color:#475569;font-size:13px;">${desc}</p>
            ${url ? `<a href="${webUrl}${url}" style="font-size:12px;color:#3b82f6;text-decoration:none;">Open in portal &rarr;</a>` : ''}
          </div>
        </div>`,
      )
      .join('');

    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] 🏆 Congratulations — You Won the Auction for ${requirementTitle}`,
      body: emailLayout(`
        ${alertBanner('🏆', 'Congratulations! You Have Won the Auction!', '#f0fdf4', '#86efac', '#166534')}
        ${greeting(vendorName)}
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">We are delighted to inform you that you have won the auction for the following listing:</p>
        ${infoBox(`<p style="margin:0;font-weight:700;font-size:16px;color:#1e293b;">${requirementTitle}</p>`, '#22c55e', '#f0fdf4')}
        <p style="font-weight:700;font-size:13px;color:#1e293b;margin:20px 0 8px;">Payment Breakdown</p>
        ${dataTable([
          ['Winning Bid Amount', `₹${winningAmount.toLocaleString('en-IN')}`],
          [
            `Pay to Client (${clientName})`,
            `<strong style="color:#166534;">₹${clientAmount.toLocaleString('en-IN')}</strong>`,
          ],
          [
            'WeConnect Commission (5%)',
            `<strong style="color:#1e40af;">₹${commissionAmount.toLocaleString('en-IN')}</strong>`,
          ],
        ])}
        ${divider}
        <p style="font-weight:700;font-size:14px;color:#1e293b;margin:0 0 16px;">📋 Your Next Steps</p>
        ${stepsHtml}
        ${infoBox(`<p style="margin:0;font-size:13px;color:#9a3412;">⚠️ <strong>Important:</strong> Failure to upload the final quote within 48 hours or make payment within 5 business days may result in disqualification from this and future auctions.</p>`, '#f59e0b', '#fffbeb')}
        ${ctaButton('Upload Final Quote Now', portalUrl)}
        ${signOff}
      `),
    });
  }

  // ─── In-App Notifications ────────────────────────────────────────────────
  async createInAppNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
  }) {
    try {
      const db = this.firebaseService.db;
      const notifRef = db
        .collection('users')
        .doc(data.userId)
        .collection('notifications')
        .doc();
      const notif = {
        id: notifRef.id,
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link || null,
        read: false,
        createdAt: new Date(),
      };
      await notifRef.set(notif);
      return notif;
    } catch (error) {
      this.logger.error(
        `Failed to create in-app notification for user ${data.userId}`,
        error,
      );
    }
  }

  async notifyCompanyUsers(
    companyId: string,
    data: { type: string; title: string; message: string; link?: string },
  ) {
    try {
      const db = this.firebaseService.db;
      const usersSnap = await db
        .collection('users')
        .where('companyId', '==', companyId)
        .get();
      await Promise.all(
        usersSnap.docs.map((u: any) =>
          this.createInAppNotification({
            userId: u.id,
            type: data.type,
            title: data.title,
            message: data.message,
            link: data.link,
          }),
        ),
      );
    } catch (error) {
      this.logger.error(`Failed to notify company ${companyId} users`, error);
    }
  }

  async notifyAdmins(data: {
    type: string;
    title: string;
    message: string;
    link?: string;
  }) {
    try {
      const db = this.firebaseService.db;
      const adminsSnap = await db
        .collection('users')
        .where('role', '==', 'ADMIN')
        .where('isActive', '==', true)
        .get();
      await Promise.all(
        adminsSnap.docs.map((admin: any) =>
          this.createInAppNotification({
            userId: admin.id,
            type: data.type,
            title: data.title,
            message: data.message,
            link: data.link,
          }),
        ),
      );
    } catch (error) {
      this.logger.error(`Failed to notify admins`, error);
    }
  }
}
