import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import * as admin from 'firebase-admin';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(private firebaseService: FirebaseService) {}

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Persist OTP codes for a user to the database.
   * Stores both email and phone codes as "emailCode|phoneCode" in otpCode,
   * and the expiry + type in dedicated fields.
   */
  private async storeOtp(
    email: string,
    emailCode: string,
    phoneCode: string,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    const userSnap = await this.firebaseService.db
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (userSnap.empty) {
      throw new Error(`User with email ${email} not found`);
    }

    const userDocRef = userSnap.docs[0].ref;
    await userDocRef.update({
      otpCode: `${emailCode}|${phoneCode}`,
      otpExpiresAt: expiresAt,
      otpType: 'email|phone',
      otpAttempts: 0,
    });
  }

  /**
   * Send OTP via email (SES) and phone (SNS).
   * Gracefully falls back to logging when AWS is not configured.
   */
  async sendOtp(
    email: string,
    phone?: string,
  ): Promise<{
    emailSent: boolean;
    phoneSent: boolean;
    devEmailOtp?: string;
    devPhoneOtp?: string;
  }> {
    if (!email || !email.includes('@')) {
      this.logger.error(`sendOtp called with invalid email: "${email}"`);
      return { emailSent: false, phoneSent: false };
    }

    const emailCode = this.generateCode();
    const phoneCode = this.generateCode();

    // Persist to DB so it survives restarts/hot-reloads
    try {
      await this.storeOtp(email, emailCode, phoneCode);
    } catch (err) {
      this.logger.error(`Failed to store OTP in DB for ${email}`, err);
    }

    let emailSent = false;
    let phoneSent = false;

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'ap-south-1';
    const fromEmail = process.env.AWS_SES_FROM_EMAIL;

    // Send email OTP via SES
    if (accessKeyId && accessKeyId !== 'your_aws_access_key' && fromEmail) {
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
            Destination: { ToAddresses: [email] },
            Message: {
              Subject: { Data: 'Your WeConnect Verification Code' },
              Body: {
                Html: {
                  Data: `
                    <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
                      <h2 style="color: #1a1a1a;">WeConnect Verification</h2>
                      <p style="color: #666;">Your email verification code is:</p>
                      <div style="background: #f0f7ff; border-radius: 12px; padding: 20px; text-align: center; margin: 16px 0;">
                        <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #0066cc;">${emailCode}</span>
                      </div>
                      <p style="color: #999; font-size: 12px;">This code expires in 10 minutes. Do not share it with anyone.</p>
                    </div>
                  `,
                },
              },
            },
          }),
        );
        emailSent = true;
        this.logger.log(`✉️ Email OTP sent to ${email}`);
      } catch (error) {
        this.logger.error(
          `Failed to send email OTP to ${email}. Check AWS Sandbox limits.`,
          error,
        );
        this.logger.warn(`[DEV FALLBACK] Email OTP for ${email}: ${emailCode}`);
      }
    } else {
      this.logger.warn(
        `[SES NOT CONFIGURED] Email OTP for ${email}: ${emailCode}`,
      );
    }

    // Send phone OTP via SNS
    if (phone) {
      if (accessKeyId && accessKeyId !== 'your_aws_access_key') {
        try {
          const { SNSClient, PublishCommand } =
            await import('@aws-sdk/client-sns');
          const sns = new SNSClient({
            region,
            credentials: { accessKeyId, secretAccessKey: secretAccessKey! },
          });

          // Normalize phone number (Default to India +91 if 10 digits)
          let normalizedPhone = phone.replace(/\s+/g, '');
          if (normalizedPhone.length === 10 && /^\d+$/.test(normalizedPhone)) {
            normalizedPhone = '+91' + normalizedPhone;
          } else if (!normalizedPhone.startsWith('+')) {
            normalizedPhone = '+' + normalizedPhone;
          }

          await sns.send(
            new PublishCommand({
              PhoneNumber: normalizedPhone,
              Message: `Your WeConnect verification code is: ${phoneCode}. Valid for 10 minutes.`,
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
          phoneSent = true;
          this.logger.log(`📱 Phone OTP sent to ${phone}`);
        } catch (error) {
          this.logger.error(
            `Failed to send phone OTP to ${phone}. Check AWS Sandbox limits.`,
            error,
          );
          this.logger.warn(
            `[DEV FALLBACK] Phone OTP for ${phone}: ${phoneCode}`,
          );
        }
      } else {
        this.logger.warn(
          `[SNS NOT CONFIGURED] Phone OTP for ${phone}: ${phoneCode}`,
        );
      }
    }

    const isDev = process.env.NODE_ENV !== 'production';
    return {
      emailSent,
      phoneSent,
      ...(isDev && { devEmailOtp: emailCode }),
      ...(isDev && phone && { devPhoneOtp: phoneCode }),
    };
  }

  /**
   * Verify an OTP code against the DB-stored value and persist the result.
   */
  async verifyOtp(
    email: string,
    code: string,
    type: 'email' | 'phone',
  ): Promise<{ verified: boolean; message: string }> {
    const userSnap = await this.firebaseService.db
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (userSnap.empty) {
      return {
        verified: false,
        message: 'No OTP found. Please request a new code.',
      };
    }

    const userDocRef = userSnap.docs[0].ref;
    const user = userSnap.docs[0].data();

    const otpExpiresAt = user.otpExpiresAt
      ? typeof user.otpExpiresAt.toDate === 'function'
        ? user.otpExpiresAt.toDate()
        : new Date(user.otpExpiresAt)
      : null;

    if (!user || !user.otpCode || !otpExpiresAt) {
      return {
        verified: false,
        message: 'No OTP found. Please request a new code.',
      };
    }

    if (new Date() > otpExpiresAt) {
      return {
        verified: false,
        message: 'OTP has expired. Please request a new code.',
      };
    }

    // otpCode stored as "emailCode|phoneCode"
    const [emailCode, phoneCode] = user.otpCode.split('|');
    const expectedCode = type === 'email' ? emailCode : phoneCode;

    if (!expectedCode) {
      return {
        verified: false,
        message: `No ${type} OTP found. Please request a new code.`,
      };
    }

    if (expectedCode !== code) {
      // Increment attempt counter
      await userDocRef.update({
        otpAttempts: admin.firestore.FieldValue.increment(1),
      });
      return { verified: false, message: 'Incorrect OTP. Please try again.' };
    }

    // Clear the specific OTP slot after successful verification
    const [eCode, pCode] = user.otpCode.split('|');
    const newEmailCode = type === 'email' ? '' : eCode;
    const newPhoneCode = type === 'phone' ? '' : pCode;
    const newOtpCode = `${newEmailCode}|${newPhoneCode}`;
    const bothConsumed = newEmailCode === '' && newPhoneCode === '';

    await userDocRef.update({
      otpCode: bothConsumed ? null : newOtpCode,
      otpExpiresAt: bothConsumed ? null : user.otpExpiresAt,
      otpAttempts: 0,
    });

    // Persist verification status to DB
    try {
      const updateData: Record<string, any> = {};
      if (type === 'email') {
        updateData.emailVerified = true;
        updateData.isActive = true;
      } else {
        updateData.phoneVerified = true;
      }
      await userDocRef.update(updateData);
      this.logger.log(`✅ ${type} verified and saved to DB for ${email}`);
    } catch (err) {
      this.logger.error(
        `Failed to persist ${type} verification for ${email}`,
        err,
      );
    }

    return {
      verified: true,
      message: `${type === 'email' ? 'Email' : 'Phone'} verified successfully.`,
    };
  }
}
