/**
 * Email Service
 * Handles sending emails for rating requests and follow-ups
 * 
 * NOTE: This requires a backend API endpoint to send emails securely.
 * Set VITE_EMAIL_API_URL in your .env.local file to your backend endpoint.
 * 
 * Example backend endpoint (Node.js/Express):
 * POST /api/send-email
 * Body: { to, subject, html, from }
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send an email via backend API endpoint
 */
export async function sendEmail({ to, subject, html, from }: SendEmailOptions): Promise<boolean> {
  try {
    const apiUrl = import.meta.env.VITE_EMAIL_API_URL || process.env.VITE_EMAIL_API_URL;
    
    if (!apiUrl) {
      console.warn('⚠️ Email API URL not configured. Set VITE_EMAIL_API_URL in .env.local');
      console.warn('Email would be sent to:', to);
      console.warn('Subject:', subject);
      // In development, we'll simulate success
      return true; // Return true for development/testing
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        html,
        from: from || 'Halo Assistant <noreply@halo.app>',
      }),
    });

    if (!response.ok) {
      console.error('Email API error:', response.status, response.statusText);
      return false;
    }

    const result = await response.json();
    return result.success !== false;
  } catch (error) {
    console.error('Error sending email:', error);
    // In development, return true to allow testing
    if (import.meta.env.DEV) {
      console.warn('Development mode: Simulating email send success');
      return true;
    }
    return false;
  }
}

/**
 * Generate rating request email HTML
 */
export function generateRatingEmailHTML(
  clientName: string,
  businessName: string,
  appointmentDate: string,
  appointmentTime: string,
  serviceName: string,
  ratingLink: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ea580c; color: #000; padding: 20px; text-align: center; }
        .content { background: #f9fafb; padding: 30px; }
        .button { display: inline-block; background: #ea580c; color: #000; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Thank You, ${clientName}!</h1>
        </div>
        <div class="content">
          <p>We hope you enjoyed your recent visit to <strong>${businessName}</strong>.</p>
          <p><strong>Appointment Details:</strong></p>
          <ul>
            <li>Date: ${appointmentDate}</li>
            <li>Time: ${appointmentTime}</li>
            <li>Service: ${serviceName}</li>
          </ul>
          <p>Your feedback helps us improve. Please take a moment to rate your experience:</p>
          <div style="text-align: center;">
            <a href="${ratingLink}" class="button">Rate Your Experience</a>
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${ratingLink}">${ratingLink}</a>
          </p>
        </div>
        <div class="footer">
          <p>Thank you for choosing ${businessName}!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate follow-up email HTML
 */
export function generateFollowUpEmailHTML(
  clientName: string,
  businessName: string,
  message: string,
  businessEmail?: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ea580c; color: #000; padding: 20px; text-align: center; }
        .content { background: #f9fafb; padding: 30px; }
        .message { background: white; padding: 20px; border-left: 4px solid #ea580c; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Hello ${clientName}!</h1>
        </div>
        <div class="content">
          <p>We wanted to follow up with you from <strong>${businessName}</strong>.</p>
          <div class="message">
            ${message.split('\n').map(line => `<p>${line}</p>`).join('')}
          </div>
          ${businessEmail ? `<p>If you have any questions, feel free to reply to this email or contact us at <a href="mailto:${businessEmail}">${businessEmail}</a>.</p>` : ''}
        </div>
        <div class="footer">
          <p>Thank you for choosing ${businessName}!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
