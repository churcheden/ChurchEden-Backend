import { Resend } from 'resend';
import { env } from '../env.js';
import { resetPasswordTemplate } from '../template/passwordReset.js'
import { welcomeEmailTemplate, welcomeEmailText, type WelcomeEmailData } from '../template/welcomeEmailTemplate.js';
import { verifyEmailOTPTemplate } from '../template/verifyEmailOTPTemplate.js';
import { wideLogger } from '../utils/wideLogger.js';
import { deleteAccountTemplate } from '../template/deleteAccountTemplate.js';
import { passwordChangeTemplate } from '../template/passwordChangeTemplate.js';
import type { PaymentEmailContent } from '../template/paymentEmails.js';

class EmailService {
  private resend: Resend;
  private fromEmail: string;

  constructor() {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      wideLogger.add('err', { msg: 'RESEND_API_KEY not set — emails will fail' });
    }
    this.resend = new Resend(apiKey ?? '');
    this.fromEmail = this.formatSender(env.EMAIL_FROM);
  }

  private formatSender(address: string) {
    if (address.includes('<')) return address;
    return `ChurchEden <${address}>`;
  }

  private async deliver(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    emailType: string;
  }): Promise<boolean> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      if (error) {
        wideLogger.add('err', {
          msg: `Failed to send ${params.emailType} email`,
          to: params.to,
          error,
        });
        return false;
      }

      wideLogger.addCtx('email_sent', params.emailType);
      wideLogger.addCtx('email_to', params.to);
      wideLogger.addCtx('email_msg_id', data?.id);
      return true;
    } catch (error) {
      wideLogger.add('err', {
        msg: `${params.emailType} email exception`,
        to: params.to,
        exception: (error as Error).message,
      });
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${env.FRONTEND_URL}/reset-password/?token=${token}`;

    return this.deliver({
      to: email,
      subject: 'Password Reset For ChurchEden Account',
      html: resetPasswordTemplate(resetUrl, token),
      text: `Reset your password by visiting: ${resetUrl}\n\nToken: ${token}`,
      emailType: 'password_reset',
    });
  }

  async sendWelcomeEmail(data: WelcomeEmailData) {
    return this.deliver({
      to: data.email,
      subject: 'Welcome to ChurchEden!',
      html: welcomeEmailTemplate(data),
      text: welcomeEmailText(data),
      emailType: 'welcome',
    });
  }

  async sendVerificationOTPEmail(email: string, otp: string, name?: string) {
    return this.deliver({
      to: email,
      subject: 'ChurchEden Email Verification - Your OTP Code',
      html: verifyEmailOTPTemplate(otp, name || 'there'),
      text: `Welcome to ChurchEden!\n\nYour email verification code is: ${otp}\n\nThis code expires in 15 minutes.`,
      emailType: 'otp_verification',
    });
  }

  async sendRegistrationEmails({
    email,
    otp,
    firstName,
    signInUrl,
  }: {
    email: string;
    otp: string;
    firstName: string;
    signInUrl: string;
  }) {
    const otpSent = await this.sendVerificationOTPEmail(email, otp, firstName);
    if (!otpSent) {
      return { otpSent: false, welcomeSent: false };
    }

    const welcomeSent = await this.sendWelcomeEmail({
      firstName,
      email,
      signInUrl,
    });

    return { otpSent: true, welcomeSent };
  }

  async sendDeletionEmail(email: string, name: string, deletionDate: Date) {
    return this.deliver({
      to: email,
      subject: 'ChurchEden Account Deletion',
      html: deleteAccountTemplate(name || 'there', deletionDate),
      text: `Hi ${name},\n\nYour ChurchEden account has been scheduled for deletion.`,
      emailType: 'account_deletion',
    });
  }

  async sendPaymentEmail(email: string, content: PaymentEmailContent) {
    return this.deliver({
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      emailType: 'payment',
    });
  }

  async sendPasswordChangeEmail(email: string, name: string) {
    return this.deliver({
      to: email,
      subject: 'Password Changed - ChurchEden Account',
      html: passwordChangeTemplate(name || 'there'),
      text: `Hi ${name},\n\nYour ChurchEden account password was successfully changed.`,
      emailType: 'password_change',
    });
  }
}

export const emailService = new EmailService();
