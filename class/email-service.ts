import { supabase } from '@/class/supabase-client';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  async sendEmail(input: SendEmailInput): Promise<void> {
    // Using Supabase's edge function to send emails
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      },
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendVoterCredentials(email: string, fullName: string, password: string): Promise<void> {
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5aa0;">VoteKro - Voter Account Created</h2>
            <p>Dear ${fullName},</p>
            <p>Your voter account has been successfully created. Here are your login credentials:</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password:</strong> ${password}</p>
            </div>

            <p><strong>Important:</strong> If you haven't already verified your email, please check your inbox for a verification link and click it before logging in.</p>
            
            <p>You can now log in at: <a href="https://votekro.app/voter-login">VoteKro Voter Login</a></p>
            
            <p>If you did not request this account or have any questions, please contact support.</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
VoteKro - Voter Account Created

Dear ${fullName},

Your voter account has been successfully created. Here are your login credentials:

Email: ${email}
Password: ${password}

Important: If you haven't already verified your email, please check your inbox for a verification link and click it before logging in.

You can now log in at: https://votekro.app/voter-login

If you did not request this account or have any questions, please contact support.
    `;

    await this.sendEmail({
      to: email,
      subject: 'VoteKro - Your Voter Account Credentials',
      html,
      text,
    });
  }

  async sendAuditorCredentials(email: string, fullName: string, password: string): Promise<void> {
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5aa0;">VoteKro - Auditor Account Created</h2>
            <p>Dear ${fullName},</p>
            <p>Your auditor account has been successfully created. Here are your login credentials:</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password:</strong> ${password}</p>
            </div>

            <p><strong>Important:</strong> If you haven't already verified your email, please check your inbox for a verification link and click it before logging in.</p>
            
            <p>You can now log in at: <a href="https://votekro.app/auditor-login">VoteKro Auditor Login</a></p>
            
            <p>If you did not request this account or have any questions, please contact support.</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
VoteKro - Auditor Account Created

Dear ${fullName},

Your auditor account has been successfully created. Here are your login credentials:

Email: ${email}
Password: ${password}

Important: If you haven't already verified your email, please check your inbox for a verification link and click it before logging in.

You can now log in at: https://votekro.app/auditor-login

If you did not request this account or have any questions, please contact support.
    `;

    await this.sendEmail({
      to: email,
      subject: 'VoteKro - Your Auditor Account Credentials',
      html,
      text,
    });
  }
}
