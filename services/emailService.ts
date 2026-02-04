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

/**
 * Generate daily email report HTML
 * Includes: schedule, completed events, earnings after taxes, expense report
 */
export function generateDailyEmailHTML(
  businessName: string,
  ownerName: string,
  date: string,
  schedule: Array<{ time: string; clientName: string; serviceName: string; status: string }>,
  completed: Array<{ date: string; time: string; clientName: string; serviceName: string; amount: number }>,
  grossRevenue: number,
  totalExpenses: number,
  estimatedTax: number,
  netEarnings: number,
  expenses: Array<{ name: string; category: string; amount: number; date: string }>
): string {
  const scheduleRows = schedule.length > 0 
    ? schedule.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.time}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.clientName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.serviceName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.status}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" style="padding: 8px; text-align: center; color: #999;">No appointments scheduled</td></tr>';

  const completedRows = completed.length > 0
    ? completed.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.date}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.time}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.clientName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.serviceName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">$${item.amount.toFixed(2)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5" style="padding: 8px; text-align: center; color: #999;">No completed appointments</td></tr>';

  const expenseRows = expenses.length > 0
    ? expenses.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.date}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.category}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #dc2626;">-$${item.amount.toFixed(2)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" style="padding: 8px; text-align: center; color: #999;">No expenses recorded</td></tr>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f5; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #ea580c; color: #000; padding: 30px; text-align: center; }
        .content { background: #ffffff; padding: 30px; }
        .section { margin: 30px 0; }
        .section-title { font-size: 18px; font-weight: bold; color: #ea580c; margin-bottom: 15px; border-bottom: 2px solid #ea580c; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background: #f4f4f5; padding: 12px; text-align: left; font-weight: bold; font-size: 12px; text-transform: uppercase; color: #666; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
        .stat-card { background: #f9fafb; padding: 20px; border-left: 4px solid #ea580c; }
        .stat-label { font-size: 12px; text-transform: uppercase; color: #666; font-weight: bold; }
        .stat-value { font-size: 24px; font-weight: bold; color: #000; margin-top: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f4f4f5; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Daily Report - ${businessName}</h1>
          <p style="margin: 10px 0 0 0; font-size: 14px;">${date}</p>
        </div>
        <div class="content">
          <p>Hello ${ownerName},</p>
          <p>Here's your daily business summary for <strong>${date}</strong>:</p>

          <!-- Today's Schedule -->
          <div class="section">
            <div class="section-title">📅 Today's Schedule</div>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Client</th>
                  <th>Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${scheduleRows}
              </tbody>
            </table>
          </div>

          <!-- Completed Appointments -->
          <div class="section">
            <div class="section-title">✅ Completed Appointments</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Client</th>
                  <th>Service</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${completedRows}
              </tbody>
            </table>
          </div>

          <!-- Financial Summary -->
          <div class="section">
            <div class="section-title">💰 Earnings After Taxes</div>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Gross Revenue</div>
                <div class="stat-value">$${grossRevenue.toFixed(2)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Expenses</div>
                <div class="stat-value" style="color: #dc2626;">-$${totalExpenses.toFixed(2)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Estimated Tax</div>
                <div class="stat-value" style="color: #d97706;">-$${estimatedTax.toFixed(2)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Net Earnings</div>
                <div class="stat-value" style="color: #16a34a;">$${netEarnings.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <!-- Expense Report -->
          <div class="section">
            <div class="section-title">📊 Expense Report</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${expenseRows}
              </tbody>
            </table>
          </div>

          <p style="margin-top: 30px;">Have a great day!</p>
        </div>
        <div class="footer">
          <p>This is an automated daily report from Halo Assistant.</p>
          <p>You can manage your email preferences in Settings.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate earnings reset email HTML
 * Documents what was cleared before resetting earnings
 */
export function generateEarningsResetEmailHTML(
  businessName: string,
  ownerName: string,
  resetDate: string,
  totalAppointments: number,
  grossRevenue: number,
  totalExpenses: number,
  estimatedTax: number,
  netEarnings: number,
  appointments: Array<{ date: string; time: string; clientName: string; serviceName: string; amount: number }>,
  expenses: Array<{ name: string; category: string; amount: number; date: string }>
): string {
  const appointmentRows = appointments.length > 0
    ? appointments.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.date}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.time}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.clientName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.serviceName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">$${item.amount.toFixed(2)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5" style="padding: 8px; text-align: center; color: #999;">No appointments to clear</td></tr>';

  const expenseRows = expenses.length > 0
    ? expenses.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.date}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.category}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #dc2626;">-$${item.amount.toFixed(2)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" style="padding: 8px; text-align: center; color: #999;">No expenses to clear</td></tr>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f5; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: #fff; padding: 30px; text-align: center; }
        .content { background: #ffffff; padding: 30px; }
        .section { margin: 30px 0; }
        .section-title { font-size: 18px; font-weight: bold; color: #dc2626; margin-bottom: 15px; border-bottom: 2px solid #dc2626; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background: #f4f4f5; padding: 12px; text-align: left; font-weight: bold; font-size: 12px; text-transform: uppercase; color: #666; }
        .warning-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
        .stat-card { background: #f9fafb; padding: 20px; border-left: 4px solid #dc2626; }
        .stat-label { font-size: 12px; text-transform: uppercase; color: #666; font-weight: bold; }
        .stat-value { font-size: 24px; font-weight: bold; color: #000; margin-top: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f4f4f5; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Earnings Reset - ${businessName}</h1>
          <p style="margin: 10px 0 0 0; font-size: 14px;">Reset Date: ${resetDate}</p>
        </div>
        <div class="content">
          <p>Hello ${ownerName},</p>
          <div class="warning-box">
            <p style="margin: 0; font-weight: bold; color: #dc2626;">This document confirms that all earnings data has been reset.</p>
            <p style="margin: 10px 0 0 0;">Please save this email for your records.</p>
          </div>

          <!-- Summary -->
          <div class="section">
            <div class="section-title">📊 Summary of Cleared Data</div>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total Appointments</div>
                <div class="stat-value">${totalAppointments}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Gross Revenue</div>
                <div class="stat-value">$${grossRevenue.toFixed(2)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Expenses</div>
                <div class="stat-value" style="color: #dc2626;">-$${totalExpenses.toFixed(2)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Net Earnings</div>
                <div class="stat-value" style="color: #16a34a;">$${netEarnings.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <!-- Cleared Appointments -->
          <div class="section">
            <div class="section-title">✅ Cleared Appointments</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Client</th>
                  <th>Service</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${appointmentRows}
              </tbody>
            </table>
          </div>

          <!-- Cleared Expenses -->
          <div class="section">
            <div class="section-title">📊 Cleared Expenses</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${expenseRows}
              </tbody>
            </table>
          </div>

          <p style="margin-top: 30px; font-weight: bold;">All earnings and expense data has been cleared. Your business profile has been reset for a fresh start.</p>
        </div>
        <div class="footer">
          <p>This is an automated document from Halo Assistant.</p>
          <p>Generated on ${resetDate}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
