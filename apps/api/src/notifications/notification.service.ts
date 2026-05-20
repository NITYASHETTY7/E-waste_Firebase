import { Injectable, Logger, Optional } from '@nestjs/common';
import type { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Optional() @InjectQueue('email') private emailQueue?: Queue
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
      // Fallback if queue isn't injected
      this.logger.warn(`Queue not available, sending email synchronously to ${payload.to}`);
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

    // If AWS credentials are not configured, log instead of sending
    if (!fromEmail || !accessKeyId || accessKeyId === 'your_aws_access_key') {
      this.logger.warn(
        `[EMAIL SKIPPED — SES NOT CONFIGURED] To: ${payload.to} | Subject: ${payload.subject}`,
      );
      this.logger.debug(`Body: ${payload.body}`);
      return;
    }

    try {
      // Dynamic import to avoid breaking if @aws-sdk/client-ses is not installed
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
      this.logger.warn(`[SMS SKIPPED — SNS NOT CONFIGURED] To: ${phone} | ${message}`);
      return;
    }

    try {
      const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');
      const sns = new SNSClient({ region, credentials: { accessKeyId, secretAccessKey: secretAccessKey! } });

      let normalized = phone.replace(/\s+/g, '');
      if (normalized.length === 10 && /^\d+$/.test(normalized)) normalized = '+91' + normalized;
      else if (!normalized.startsWith('+')) normalized = '+' + normalized;

      await sns.send(new PublishCommand({
        PhoneNumber: normalized,
        Message: message,
        MessageAttributes: {
          'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: 'WeConnect' },
          'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
        },
      }));
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
    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] You've been invited to conduct a site audit`,
      body: `
        <h2>Audit Invitation</h2>
        <p>Hello ${vendorName},</p>
        <p>You have been invited to conduct a site audit for: <strong>${requirementTitle}</strong></p>
        <p>Please log in to the WeConnect portal to review details and respond.</p>
        <p><a href="${process.env.WEB_URL || 'http://localhost:3000'}/vendor/audits">View Audit Details →</a></p>
        <br/><p>— WeConnect Platform</p>
      `,
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
    const timingBlock = (openPhaseStart || openPhaseEnd) ? `
      <div style="background:#f0fdf4;border:1px solid #86efac;padding:14px 18px;border-radius:6px;margin:16px 0">
        ${openPhaseStart ? `<p style="margin:0 0 6px;font-size:13px;color:#166534"><strong>🟢 Open Bidding Starts:</strong> ${openPhaseStart}</p>` : ''}
        ${openPhaseEnd ? `<p style="margin:0;font-size:13px;color:#166534"><strong>🔴 Open Bidding Ends:</strong> ${openPhaseEnd}</p>` : ''}
      </div>` : '';

    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] You're Approved for Live Auction — ${auctionTitle}`,
      body: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
          <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">WeConnect Platform</h1>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <div style="background:#f0fdf4;border:1px solid #86efac;padding:16px 20px;border-radius:8px;margin-bottom:20px">
              <h2 style="color:#166534;margin:0">🎉 You're Approved for Live Open Auction!</h2>
            </div>
            <p>Dear <strong>${vendorName}</strong>,</p>
            <p>Congratulations! You have been approved to participate in the live open auction for:</p>
            <div style="background:#f1f5f9;border-left:4px solid #166534;padding:14px 18px;border-radius:4px;margin:16px 0">
              <p style="margin:0;font-weight:700;font-size:15px">${auctionTitle}</p>
            </div>
            ${timingBlock}
            <p>Join the live auction floor to place your open bids in real time.</p>
            <a href="${webUrl}/vendor/live-auction" style="display:inline-block;background:#166534;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;margin:16px 0">
              Join Live Auction →
            </a>
            <p style="color:#64748b;font-size:13px;margin-top:16px">You can also view full auction details at: <a href="${auctionDetailsUrl}" style="color:#3b82f6">${auctionDetailsUrl}</a></p>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">— WeConnect Platform</p>
          </div>
        </div>
      `,
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
      subject: `[WeConnect] Approval Required for Live Auction — ${auctionTitle}`,
      body: `
        <h2>Live Auction Parameters Review</h2>
        <p>Hello ${clientName},</p>
        <p>The admin has configured the live auction parameters for <strong>${auctionTitle}</strong>.</p>
        <p>Please review and approve them to notify the participating vendors.</p>
        <p><a href="${configureUrl}">Review and Approve →</a></p>
        <br/><p>— WeConnect Platform</p>
      `,
    });
  }

  async notifyBidClosingSoon(
    vendorEmail: string,
    vendorName: string,
    auctionTitle: string,
    minutesLeft: number,
  ) {
    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] Auction closing in ${minutesLeft} minutes — ${auctionTitle}`,
      body: `
        <h2>Auction Closing Soon</h2>
        <p>Hello ${vendorName},</p>
        <p>The auction for <strong>${auctionTitle}</strong> closes in <strong>${minutesLeft} minutes</strong>.</p>
        <p>Place your final bid now.</p>
        <p><a href="${process.env.WEB_URL || 'http://localhost:3000'}/vendor/live-auction">Go to Auction →</a></p>
        <br/><p>— WeConnect Platform</p>
      `,
    });
  }

  async notifyPaymentPending(
    vendorEmail: string,
    vendorName: string,
    auctionTitle: string,
    amount: number,
  ) {
    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] Payment required — ${auctionTitle}`,
      body: `
        <h2>Payment Required</h2>
        <p>Hello ${vendorName},</p>
        <p>Your bid for <strong>${auctionTitle}</strong> has been accepted. Please submit payment of <strong>₹${amount.toLocaleString()}</strong>.</p>
        <p><a href="${process.env.WEB_URL || 'http://localhost:3000'}/vendor/payments">Submit Payment →</a></p>
        <br/><p>— WeConnect Platform</p>
      `,
    });
  }

  async notifyPaymentVerified(
    email: string,
    name: string,
    auctionTitle: string,
    role: 'CLIENT' | 'VENDOR',
  ) {
    const nextSteps = role === 'VENDOR' 
      ? 'You may now proceed to schedule the pickup and upload compliance documents.' 
      : 'The vendor will now schedule the pickup and provide compliance documentation.';
      
    return this.sendEmail({
      to: email,
      subject: `Payment Confirmed - ${auctionTitle}`,
      body: `
        <h2>Payment Confirmed</h2>
        <p>Hello ${name},</p>
        <p>We are pleased to inform you that the payment for <strong>${auctionTitle}</strong> has been successfully verified.</p>
        <p>${nextSteps}</p>
        <br/><p>— WeConnect Platform</p>
      `,
    });
  }

  async notifyComplianceVerified(
    clientEmail: string,
    clientName: string,
    auctionTitle: string,
  ) {
    return this.sendEmail({
      to: clientEmail,
      subject: `Compliance Verified - ${auctionTitle}`,
      body: `
        <h2>Compliance Verified</h2>
        <p>Hello ${clientName},</p>
        <p>All compliance documents for the pickup related to <strong>${auctionTitle}</strong> have been uploaded by the vendor and successfully verified by our admins.</p>
        <p>You can now download the final document bundle from your dashboard.</p>
        <p><a href="${process.env.WEB_URL || 'http://localhost:3000'}/client/dashboard">Go to Dashboard →</a></p>
        <br/><p>— WeConnect Platform</p>
      `,
    });
  }

  async notifyCompliancePending(
    vendorEmail: string,
    vendorName: string,
    auctionTitle: string,
  ) {
    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] Compliance documents required — ${auctionTitle}`,
      body: `
        <h2>Upload Compliance Documents</h2>
        <p>Hello ${vendorName},</p>
        <p>Payment has been confirmed for <strong>${auctionTitle}</strong>. Please upload your compliance documents (Form 6, Weight Slips, Certificates).</p>
        <p><a href="${process.env.WEB_URL || 'http://localhost:3000'}/vendor/pickups">Upload Documents →</a></p>
        <br/><p>— WeConnect Platform</p>
      `,
    });
  }

  async notifyAccountApproved(userEmail: string, userName: string, userPhone?: string) {
    const portalUrl = process.env.WEB_URL || 'http://localhost:3000';
    await this.sendEmail({
      to: userEmail,
      subject: '✅ Account Approved — Welcome to WeConnect',
      body: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
          <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">WeConnect Platform</h1>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <div style="background:#f0fdf4;border:1px solid #86efac;padding:16px 20px;border-radius:8px;margin-bottom:20px">
              <h2 style="color:#166534;margin:0">✅ Your account has been approved!</h2>
            </div>
            <p>Dear <strong>${userName}</strong>,</p>
            <p>We're pleased to inform you that your WeConnect account has been <strong>approved</strong> by our admin team. You can now access your full dashboard.</p>
            <a href="${portalUrl}" style="display:inline-block;background:#166534;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;margin:16px 0">Login to WeConnect →</a>
            <p style="color:#64748b;font-size:13px;margin-top:20px">If you have any questions, please contact our support team.</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">— WeConnect Platform</p>
          </div>
        </div>
      `,
    });
    if (userPhone) {
      await this.sendSms(userPhone,
        `WeConnect: Hi ${userName}, your account has been APPROVED! Login at ${portalUrl} to access your dashboard.`
      );
    }
  }

  async notifyAccountRejected(userEmail: string, userName: string, userPhone?: string, reason?: string) {
    await this.sendEmail({
      to: userEmail,
      subject: '❌ Account Application Update — WeConnect',
      body: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
          <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">WeConnect Platform</h1>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <div style="background:#fef2f2;border:1px solid #fca5a5;padding:16px 20px;border-radius:8px;margin-bottom:20px">
              <h2 style="color:#991b1b;margin:0">Account Application Not Approved</h2>
            </div>
            <p>Dear <strong>${userName}</strong>,</p>
            <p>We regret to inform you that your WeConnect account application has <strong>not been approved</strong> at this time.</p>
            ${reason ? `
            <div style="background:#f8fafc;border-left:4px solid #ef4444;padding:14px 18px;border-radius:4px;margin:16px 0">
              <p style="margin:0;font-weight:700;font-size:13px;color:#64748b">Reason provided by admin:</p>
              <p style="margin:6px 0 0;color:#1e293b">${reason}</p>
            </div>` : ''}
            <p style="color:#64748b;font-size:13px">If you believe this is an error or would like to reapply, please contact our support team with the required documentation.</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">— WeConnect Platform</p>
          </div>
        </div>
      `,
    });
    if (userPhone) {
      await this.sendSms(userPhone,
        `WeConnect: Hi ${userName}, your account application has not been approved at this time.${reason ? ` Reason: ${reason}` : ''} Contact support for assistance.`
      );
    }
  }

  async notifyAccountOnHold(userEmail: string, userName: string, userPhone?: string, reason?: string) {
    await this.sendEmail({
      to: userEmail,
      subject: '⏸️ Account Under Additional Review — WeConnect',
      body: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
          <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">WeConnect Platform</h1>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <div style="background:#fffbeb;border:1px solid #fcd34d;padding:16px 20px;border-radius:8px;margin-bottom:20px">
              <h2 style="color:#92400e;margin:0">⏸️ Your Account is On Hold</h2>
            </div>
            <p>Dear <strong>${userName}</strong>,</p>
            <p>Your WeConnect account is currently <strong>on hold</strong> pending additional review by our admin team.</p>
            ${reason ? `
            <div style="background:#f8fafc;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:4px;margin:16px 0">
              <p style="margin:0;font-weight:700;font-size:13px;color:#64748b">Reason provided by admin:</p>
              <p style="margin:6px 0 0;color:#1e293b">${reason}</p>
            </div>` : ''}
            <p style="color:#64748b;font-size:13px">Our team will review your account and contact you within 24–72 hours. Please ensure all required documents have been uploaded correctly.</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">— WeConnect Platform</p>
          </div>
        </div>
      `,
    });
    if (userPhone) {
      await this.sendSms(userPhone,
        `WeConnect: Hi ${userName}, your account is currently on hold pending additional review.${reason ? ` Reason: ${reason}` : ''} Our team will contact you within 24-72 hours.`
      );
    }
  }

  async notifyPendingApproval(userEmail: string, userName: string) {
    return this.sendEmail({
      to: userEmail,
      subject: `Your account is under review`,
      body: `
        <p>Thank you for registering on EcoLoop. Your account is currently under review by our admin team. You will receive an email within 24-72 hours about the updates</p>
      `,
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
      body: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
          <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">WeConnect Platform</h1>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <div style="background:#f0fdf4;border:1px solid #86efac;padding:16px 20px;border-radius:8px;margin-bottom:20px">
              <h2 style="color:#166534;margin:0">🎉 Your Quote Was Accepted — Pickup Requested!</h2>
            </div>
            <p>Dear <strong>${vendorName}</strong>,</p>
            <p>A user has accepted your quote of <strong>₹${offeredPrice.toLocaleString('en-IN')}</strong> for the following product and has requested a pickup:</p>
            <div style="background:#f1f5f9;border-left:4px solid #166534;padding:14px 18px;border-radius:4px;margin:16px 0">
              <p style="margin:0;font-weight:700;font-size:15px">${productName}</p>
              <p style="margin:6px 0 0;color:#64748b;font-size:13px">Accepted Quote: <strong style="color:#166534">₹${offeredPrice.toLocaleString('en-IN')}</strong></p>
            </div>
            <h3 style="margin:24px 0 12px;color:#1e293b">📋 User Contact Details</h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;color:#64748b;font-weight:600;width:40%">Name</td>
                <td style="padding:10px 14px;font-weight:700">${userName}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#64748b;font-weight:600">Email</td>
                <td style="padding:10px 14px"><a href="mailto:${userEmail}" style="color:#3b82f6;font-weight:700">${userEmail}</a></td>
              </tr>
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;color:#64748b;font-weight:600">Phone</td>
                <td style="padding:10px 14px;font-weight:700">${userPhone ? `<a href="tel:${userPhone}" style="color:#3b82f6">${userPhone}</a>` : 'Not provided'}</td>
              </tr>
            </table>
            <p style="margin-top:20px;color:#475569;font-size:14px">Please reach out to the user directly via email or phone to arrange a convenient pickup date and time.</p>
            <a href="${webUrl}/vendor/individual-products" style="display:inline-block;background:#166534;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;margin:16px 0">
              View in Dashboard →
            </a>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">— WeConnect Platform</p>
          </div>
        </div>
      `,
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
      subject: `[WeConnect] Action Required: Upload Gate Pass — ${auctionTitle}`,
      body: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
          <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">WeConnect Platform</h1>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <div style="background:#eff6ff;border:1px solid #93c5fd;padding:16px 20px;border-radius:8px;margin-bottom:20px">
              <h2 style="color:#1e40af;margin:0">📋 Please Upload the Gate Pass / Handover Approval</h2>
            </div>
            <p>Dear <strong>${clientName}</strong>,</p>
            <p>The vendor payment for <strong>${auctionTitle}</strong> is currently being processed.</p>
            <p>The vendor <strong>${vendorName}</strong> is ready to arrange pickup. To proceed, please upload the <strong>Gate Pass / Handover Approval</strong> document for your site.</p>
            <a href="${webUrl}/client/handover" style="display:inline-block;background:#1e40af;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;margin:16px 0">
              Upload Gate Pass →
            </a>
            <p style="color:#64748b;font-size:13px">Go to <strong>Handover &amp; Gate Pass</strong> in your dashboard to fill in the gate pass details and upload the document.</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">— WeConnect Platform</p>
          </div>
        </div>
      `,
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
      body: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
          <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">WeConnect Platform</h1>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <div style="background:#f0fdf4;border:1px solid #86efac;padding:16px 20px;border-radius:8px;margin-bottom:20px">
              <h2 style="color:#166534;margin:0">✅ Gate Pass Uploaded — Proceed with Pickup</h2>
            </div>
            <p>Dear <strong>${vendorName}</strong>,</p>
            <p>The client <strong>${clientName}</strong> has uploaded the Gate Pass for your pickup of <strong>${auctionTitle}</strong>.</p>
            <div style="background:#f1f5f9;border-left:4px solid #22c55e;padding:14px 18px;border-radius:4px;margin:16px 0">
              <p style="margin:0;font-weight:700">Gate Pass No: ${gatePassNumber}</p>
            </div>
            <p>Please download the gate pass document, arrange your vehicle and driver, and proceed to the client site for material pickup.</p>
            <a href="${webUrl}/vendor/handover" style="display:inline-block;background:#166534;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;margin:16px 0">
              View Gate Pass &amp; Proceed →
            </a>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">— WeConnect Platform</p>
          </div>
        </div>
      `,
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
    return this.sendEmail({
      to: adminEmail,
      subject: `New user registration pending approval - ${companyName}`,
      body: `
        <h2>New Registration Pending Review</h2>
        <ul>
          <li><strong>Name:</strong> ${userName}</li>
          <li><strong>Email:</strong> ${userEmail}</li>
          <li><strong>Role:</strong> ${role}</li>
          <li><strong>Company:</strong> ${companyName}</li>
          <li><strong>Date:</strong> ${registrationDate.toLocaleString()}</li>
        </ul>
        <p>Please log in to the admin dashboard to review and approve this user.</p>
      `,
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
      subject: `Audit Scheduled - SPOC Details for ${clientName}`,
      body: `
        <h2>Audit Accepted</h2>
        <p>Hello ${vendorName},</p>
        <p>You have successfully accepted the audit for <strong>${clientName}</strong>.</p>
        <h3>Site & Contact Details:</h3>
        <ul>
          <li><strong>Site Address:</strong> ${siteAddress}</li>
          <li><strong>SPOC Name:</strong> ${spocName}</li>
          <li><strong>SPOC Phone:</strong> ${spocPhone}</li>
        </ul>
        <p>Please coordinate directly with the SPOC to complete your on-site audit.</p>
      `,
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
      subject: `[WeConnect] Your material sheet is ready for review — ${requirementTitle}`,
      body: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
          <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">WeConnect Platform</h1>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <div style="background:#eff6ff;border:1px solid #93c5fd;padding:16px 20px;border-radius:8px;margin-bottom:20px">
              <h2 style="color:#1e40af;margin:0">&#128196; Processed Sheet Ready for Your Approval</h2>
            </div>
            <p>Dear <strong>${clientName}</strong>,</p>
            <p>Our admin team has reviewed and cleaned the material list for your listing:</p>
            <div style="background:#f1f5f9;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:4px;margin:16px 0">
              <p style="margin:0;font-weight:700;font-size:15px">${requirementTitle}</p>
            </div>
            <p>Please log in, review the processed sheet, and set your <strong>target price</strong> to approve and trigger vendor invitations.</p>
            <a href="${portalUrl}" style="display:inline-block;background:#1e40af;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;margin:16px 0">Review &amp; Approve Sheet &rarr;</a>
            <p style="color:#64748b;font-size:13px;margin-top:20px">Once you approve, invitation emails will be sent automatically to the selected vendors.</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">— WeConnect Platform</p>
          </div>
        </div>
      `,
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
      subject: `[WeConnect] Sealed Bid Invitation — ${requirementTitle}`,
      body: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
          <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">WeConnect Platform</h1>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <h2 style="color:#1e40af;margin:0 0 16px">&#128737; Sealed Bid Invitation</h2>
            <p>Dear <strong>${vendorName}</strong>,</p>
            <p>You have been selected to participate in a sealed bid auction:</p>
            <div style="background:#f1f5f9;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:4px;margin:16px 0">
              <p style="margin:0;font-weight:700;font-size:15px">${requirementTitle}</p>
              <p style="margin:6px 0 0;color:#64748b;font-size:13px">Sealed Bid Deadline: ${sealedBidDeadline}</p>
            </div>
            <p>Please respond to this invitation by clicking one of the buttons below:</p>
            <div style="display:flex;gap:12px;margin:24px 0">
              <a href="${acceptUrl}" style="display:inline-block;background:#166534;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;margin-right:12px">
                ✅ Accept Invitation
              </a>
              <a href="${declineUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px">
                ❌ Decline Invitation
              </a>
            </div>
            <div style="background:#fef3c7;border:1px solid #f59e0b;padding:12px 16px;border-radius:6px;margin:20px 0">
              <p style="margin:0;font-size:13px;color:#92400e">&#9888; <strong>If you accept</strong>, you will be taken to a page where you can download the material list, upload your audit report, and submit your filled price sheet before the deadline.</p>
            </div>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
            <ol style="color:#475569;font-size:13px;padding-left:20px;line-height:2">
              <li>Accept invitation &amp; download the cleaned material list</li>
              <li>Conduct site audit and upload your report</li>
              <li>Submit your filled price sheet with your sealed bid</li>
              <li>Shortlisted vendors join the <strong>Live Open Auction</strong></li>
            </ol>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">— WeConnect Platform</p>
          </div>
        </div>
      `,
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

    const steps = [
      [
        'Upload Final Quote',
        `Log in and upload your <strong>product-wise quotation</strong> (PDF) and <strong>company letterhead quotation</strong>.`,
        '/vendor/final-quote',
      ],
      [
        'Await Client Approval',
        'Client reviews your quote. You will be notified by email.',
        null,
      ],
      [
        'Make Payment',
        `Pay <strong>&#8377;${clientAmount.toLocaleString('en-IN')}</strong> to client + <strong>&#8377;${commissionAmount.toLocaleString('en-IN')}</strong> (5%) to WeConnect. Bank details on payments page.`,
        '/vendor/payments',
      ],
      [
        'Upload Payment Proof',
        'Upload screenshot + UTR number for both transfers.',
        '/vendor/payments',
      ],
      [
        'Schedule Pickup',
        'Schedule pickup date. SPOC contact details provided on portal.',
        '/vendor/pickups',
      ],
      [
        'Upload Compliance Docs',
        'On pickup day: Form 6, Weight Slip (Empty), Weight Slip (Loaded), Recycling Certificate, Disposal Certificate.',
        '/vendor/pickups',
      ],
    ];

    return this.sendEmail({
      to: vendorEmail,
      subject: `[WeConnect] &#127942; You won the auction — ${requirementTitle}`,
      body: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
          <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">WeConnect Platform</h1>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <div style="background:#f0fdf4;border:1px solid #86efac;padding:16px 20px;border-radius:8px;margin-bottom:24px">
              <h2 style="color:#166534;margin:0 0 4px">&#127942; Congratulations! You Won!</h2>
            </div>
            <p>Dear <strong>${vendorName}</strong>,</p>
            <p>You have won the auction for <strong>${requirementTitle}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;color:#64748b;font-weight:600">Winning Bid</td>
                <td style="padding:10px 14px;font-weight:700">&#8377;${winningAmount.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#64748b;font-weight:600">Pay to Client (${clientName})</td>
                <td style="padding:10px 14px;font-weight:700;color:#166534">&#8377;${clientAmount.toLocaleString('en-IN')}</td>
              </tr>
              <tr style="background:#f8fafc">
                <td style="padding:10px 14px;color:#64748b;font-weight:600">WeConnect Commission (5%)</td>
                <td style="padding:10px 14px;font-weight:700;color:#1e40af">&#8377;${commissionAmount.toLocaleString('en-IN')}</td>
              </tr>
            </table>
            <h3 style="border-top:1px solid #e2e8f0;padding-top:20px;margin:0 0 16px">&#128203; Your Next Steps</h3>
            ${steps
              .map(
                ([title, desc, url], i) => `
              <div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start">
                <div style="min-width:28px;height:28px;background:#1e40af;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;text-align:center;line-height:28px">${i + 1}</div>
                <div>
                  <p style="margin:0;font-weight:700">${title}</p>
                  <p style="margin:4px 0 0;color:#475569;font-size:13px">${desc}</p>
                  ${url ? `<a href="${process.env.WEB_URL || 'http://localhost:3000'}${url}" style="font-size:12px;color:#3b82f6">Go to portal &rarr;</a>` : ''}
                </div>
              </div>
            `,
              )
              .join('')}
            <div style="background:#fff7ed;border:1px solid #fdba74;padding:14px 18px;border-radius:6px;margin:24px 0">
              <p style="margin:0;font-size:13px;color:#9a3412">&#9888;&#65039; Failure to upload the final quote within 48 hours or make payment within 5 business days may result in disqualification.</p>
            </div>
            <a href="${portalUrl}" style="display:inline-block;background:#166534;color:#fff;padding:13px 30px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px">Upload Final Quote Now &rarr;</a>
            <p style="color:#94a3b8;font-size:12px;margin-top:28px">— WeConnect Platform</p>
          </div>
        </div>
      `,
    });
  }
}
