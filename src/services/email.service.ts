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
    this.fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev';
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${env.FRONTEND_URL}/reset-password/?token=${token}`;

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Password Reset For ChurchEden Account',
        html: resetPasswordTemplate(resetUrl, token),
        text: `Reset your password by visiting: ${resetUrl}\n\nToken: ${token}`
      });

      if (error) {
        wideLogger.add('err', { msg: 'Failed to send password reset email', error });
        return false;
      }

      wideLogger.addCtx('email_sent', 'password_reset');
      wideLogger.addCtx('email_msg_id', data?.id);
      return true;
    } catch (error) {
      wideLogger.add('err', { msg: 'Reset password email exception', exception: (error as Error).message });
      return false;
    }
  }

  async sendWelcomeEmail(data: WelcomeEmailData) {
    try {
      const { data: result, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: data.email,
        subject: 'Welcome to ChurchEden!',
        html: welcomeEmailTemplate(data),
        text: welcomeEmailText(data),
      });

      if (error) {
        wideLogger.add('err', { msg: 'Failed to send welcome email', error });
        return false;
      }

      wideLogger.addCtx('email_sent', 'welcome');
      wideLogger.addCtx('email_msg_id', result?.id);
      return true;
    } catch (error) {
      wideLogger.add('err', { msg: 'Welcome email exception', exception: (error as Error).message });
      return false;
    }
  }

  async sendVerificationOTPEmail(email: string, otp: string, name?: string) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'ChurchEden Email Verification - Your OTP Code',
        html: verifyEmailOTPTemplate(otp, name || 'there'),
        text: `Welcome to ChurchEden!\n\nYour email verification code is: ${otp}\n\nThis code expires in 15 minutes.`
      });

      if (error) {
        wideLogger.add('err', { msg: 'Failed to send OTP email', error });
        return false;
      }

      wideLogger.addCtx('email_sent', 'otp_verification');
      wideLogger.addCtx('email_msg_id', data?.id);
      return true;
    } catch (error) {
      wideLogger.add('err', { msg: 'OTP email exception', exception: (error as Error).message });
      return false;
    }
  }

  async sendDeletionEmail(email: string, name: string, deletionDate: Date) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'ChurchEden Account Deletion',
        html: deleteAccountTemplate(name || 'there', deletionDate),
        text: `Hi ${name},\n\nYour ChurchEden account has been scheduled for deletion.`
      });

      if (error) {
        wideLogger.add('err', { msg: 'Failed to send account deletion email', error });
        return false;
      }

      wideLogger.addCtx('email_sent', 'account_deletion');
      wideLogger.addCtx('email_msg_id', data?.id);
      return true;
    } catch (error) {
      wideLogger.add('err', { msg: 'Account deletion email exception', exception: (error as Error).message });
      return false;
    }
  }

  async sendPaymentEmail(email: string, content: PaymentEmailContent) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });

      if (error) {
        wideLogger.add('err', { msg: 'Failed to send payment email', error });
        return false;
      }

      wideLogger.addCtx('email_sent', 'payment');
      wideLogger.addCtx('email_msg_id', data?.id);
      return true;
    } catch (error) {
      wideLogger.add('err', { msg: 'Payment email exception', exception: (error as Error).message });
      return false;
    }
  }

  async sendPasswordChangeEmail(email: string, name: string) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Password Changed - ChurchEden Account',
        html: passwordChangeTemplate(name || 'there'),
        text: `Hi ${name},\n\nYour ChurchEden account password was successfully changed.`
      });

      if (error) {
        wideLogger.add('err', { msg: 'Failed to send password change email', error });
        return false;
      }

      wideLogger.addCtx('email_sent', 'password_change');
      wideLogger.addCtx('email_msg_id', data?.id);
      return true;
    } catch (error) {
      wideLogger.add('err', { msg: 'Password change email exception', exception: (error as Error).message });
      return false;
    }
  }
}

export const emailService = new EmailService();
