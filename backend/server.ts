import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Session storage (in production, use Redis or database)
const sessions = new Map<string, { email: string; expires: number }>();

// Helper to verify session
const verifySession = (req: express.Request): string | null => {
  const sessionId = req.cookies.sessionId;
  if (!sessionId) return null;
  
  const session = sessions.get(sessionId);
  if (!session || session.expires < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session.email;
};

// POST /auth/google - Verify Google token and create session
app.post('/auth/google', async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token required' });
    }

    // Verify token with Google
    const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
    
    if (!response.ok) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const userInfo = await response.json();
    const email = userInfo.email;

    if (!email) {
      return res.status(400).json({ error: 'Email not found in Google account' });
    }

    // Create session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(sessionId, {
      email,
      expires: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // Set session cookie
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({ email, sessionId });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /auth/signup - Create new account with email and password
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('user_data')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user record (without business profile yet - will be set by frontend)
    const { error: insertError } = await supabase
      .from('user_data')
      .insert({
        email,
        password_hash: passwordHash,
        business_profile: null,
        clients: [],
        appointments: [],
        expenses: [],
        ratings: []
      });

    if (insertError) {
      console.error('Signup error:', insertError);
      return res.status(500).json({ error: 'Failed to create account' });
    }

    // Create session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(sessionId, {
      email,
      expires: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // Set session cookie
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({ email, sessionId });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /auth/email - Authenticate with email and password
app.post('/auth/email', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    // Get user from database
    const { data: user, error: fetchError } = await supabase
      .from('user_data')
      .select('email, password_hash')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    if (!user.password_hash) {
      // User exists but no password set (legacy account or Google-only)
      // For now, allow login without password for backward compatibility
      // In production, you might want to require password reset
      console.warn(`User ${email} has no password set`);
    } else {
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    }

    // Create session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(sessionId, {
      email,
      expires: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // Set session cookie
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({ email, sessionId });
  } catch (error) {
    console.error('Email auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// GET /me - Get current user based on session
app.get('/me', async (req, res) => {
  try {
    const email = verifySession(req);
    
    if (!email) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({ email });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /save - Save user data to database
app.post('/save', async (req, res) => {
  try {
    const email = verifySession(req);
    
    if (!email) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { businessProfile, clients, appointments, expenses, ratings } = req.body;

    // Save to Supabase
    const { error } = await supabase
      .from('user_data')
      .upsert({
        email,
        business_profile: businessProfile,
        clients: clients || [],
        appointments: appointments || [],
        expenses: expenses || [],
        ratings: ratings || [],
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'email'
      });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to save data' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// GET /load - Load user data from database
app.get('/load', async (req, res) => {
  try {
    const email = verifySession(req);
    
    if (!email) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Load from Supabase
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to load data' });
    }

    if (!data) {
      return res.json({
        businessProfile: null,
        clients: [],
        appointments: [],
        expenses: [],
        ratings: []
      });
    }

    res.json({
      businessProfile: data.business_profile,
      clients: data.clients || [],
      appointments: data.appointments || [],
      expenses: data.expenses || [],
      ratings: data.ratings || []
    });
  } catch (error) {
    console.error('Load error:', error);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

// POST /logout - Clear session
app.post('/logout', (req, res) => {
  const sessionId = req.cookies.sessionId;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.clearCookie('sessionId');
  res.json({ success: true });
});

// POST /send-daily-emails - Send daily emails to users with dailyEmailEnabled (called by cron job)
// This endpoint can be called by authenticated users for testing, or by cron job with secret
app.post('/send-daily-emails', async (req, res) => {
  try {
    const cronSecret = req.headers['x-cron-secret'] || req.body.secret;
    const isTest = req.body.test === true;
    const expectedSecret = process.env.CRON_SECRET || 'your-secret-key-change-in-production';
    
    // If it's a test request from authenticated user, verify session instead of secret
    if (isTest) {
      const email = verifySession(req);
      if (!email) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      // For test, only send to the authenticated user
      console.log(`Test daily email requested by: ${email}`);
    } else {
      // For cron job, require secret
      if (cronSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // Get current date in CST (Central Standard Time)
    const now = new Date();
    const cstDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const today = cstDate.toISOString().split('T')[0];
    const dateString = cstDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Get users - if test, only get the authenticated user
    let allUsers: any[] = [];
    if (isTest) {
      const email = verifySession(req);
      if (!email) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const { data: userData, error: fetchError } = await supabase
        .from('user_data')
        .select('email, business_profile, appointments, expenses')
        .eq('email', email)
        .single();
      
      if (fetchError) {
        console.error('Error fetching user:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch user data' });
      }
      
      if (userData) {
        allUsers = [userData];
      }
    } else {
      // Get all users with dailyEmailEnabled = true
      const { data: users, error: fetchError } = await supabase
        .from('user_data')
        .select('email, business_profile, appointments, expenses')
        .not('business_profile', 'is', null);

      if (fetchError) {
        console.error('Error fetching users:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch users' });
      }

      if (users) {
        allUsers = users;
      }
    }

    if (!allUsers || allUsers.length === 0) {
      return res.json({ message: isTest ? 'No user data found' : 'No users found', sent: 0 });
    }

    let sentCount = 0;
    const errors: string[] = [];

    // Process each user
    for (const user of allUsers) {
      try {
        const businessProfile = user.business_profile;
        
        // For test mode, skip the dailyEmailEnabled check (send anyway)
        // For cron mode, check if daily emails are enabled
        if (!isTest && (!businessProfile || !businessProfile.dailyEmailEnabled)) {
          continue;
        }

        const appointments = user.appointments || [];
        const expenses = user.expenses || [];
        const services = businessProfile.services || [];

        // Filter today's schedule
        const todaySchedule = appointments
          .filter((a: any) => a.date === today && a.status !== 'CANCELLED' && a.status !== 'BLOCKED')
          .map((a: any) => {
            const service = services.find((s: any) => s.id === a.serviceId);
            return {
              time: a.time, // Keep original for sorting
              formattedTime: formatTime(a.time), // Formatted for display
              clientName: a.clientName || 'No client name',
              serviceName: service?.name || 'Unknown Service',
              status: a.status
            };
          })
          .sort((a: any, b: any) => a.time.localeCompare(b.time))
          .map((item: any) => ({
            time: item.formattedTime, // Use formatted time for display
            clientName: item.clientName,
            serviceName: item.serviceName,
            status: item.status
          }));

        // Filter completed appointments (all time, for summary)
        const completedAppointments = appointments
          .filter((a: any) => a.status === 'COMPLETED')
          .map((a: any) => {
            const service = services.find((s: any) => s.id === a.serviceId);
            let price = service?.price || 0;
            if (service?.pricePerPerson) {
              const numPeople = a.numberOfPeople || (a.clientIds?.length || a.clientNames?.length || 1);
              price = service.price * numPeople;
            }
            return {
              date: a.date,
              time: formatTime(a.time),
              clientName: a.clientName || 'No client name',
              serviceName: service?.name || 'Unknown Service',
              amount: price
            };
          });

        // Calculate financial metrics
        const getAppointmentPrice = (appt: any): number => {
          const service = services.find((s: any) => s.id === appt.serviceId);
          if (!service) return 0;
          if (service.pricePerPerson) {
            const numPeople = appt.numberOfPeople || (appt.clientIds?.length || appt.clientNames?.length || 1);
            return service.price * numPeople;
          }
          return service.price;
        };

        const grossRevenue = completedAppointments.reduce((sum: number, appt: any) => sum + appt.amount, 0);
        const totalExpenses = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
        const writeOffs = expenses
          .filter((exp: any) => ['Supplies', 'Rent', 'Marketing'].includes(exp.category))
          .reduce((sum: number, exp: any) => sum + exp.amount, 0);
        const taxableIncome = Math.max(0, grossRevenue - writeOffs);
        const estimatedTax = taxableIncome * ((businessProfile.taxRate || 0) / 100);
        const netEarnings = grossRevenue - totalExpenses - estimatedTax;

        // Prepare expense data
        const expenseData = expenses.map((exp: any) => ({
          name: exp.name,
          category: exp.category,
          amount: exp.amount,
          date: exp.date
        }));

        // Generate email HTML (import the function from frontend or duplicate logic)
        // For now, we'll use a simple approach - in production, you'd want to use a proper email service
        const emailHtml = generateDailyEmailHTML(
          businessProfile.name || 'Your Business',
          businessProfile.ownerName || 'Business Owner',
          dateString,
          todaySchedule,
          completedAppointments,
          grossRevenue,
          totalExpenses,
          estimatedTax,
          netEarnings,
          expenseData
        );

        // Send email (you'll need to implement this with your email service)
        // For now, we'll just log it - you should integrate with Resend, SendGrid, etc.
        const emailSent = await sendDailyEmail({
          to: businessProfile.email || user.email,
          subject: `Daily Report - ${businessProfile.name || 'Your Business'} - ${dateString}`,
          html: emailHtml
        });

        if (emailSent) {
          sentCount++;
          console.log(`Daily email sent to ${businessProfile.email || user.email}`);
        } else {
          errors.push(`Failed to send email to ${businessProfile.email || user.email}`);
        }
      } catch (userError) {
        console.error(`Error processing user ${user.email}:`, userError);
        errors.push(`Error processing ${user.email}: ${userError instanceof Error ? userError.message : 'Unknown error'}`);
      }
    }

    res.json({ 
      message: `Processed ${allUsers.length} users`,
      sent: sentCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Daily email cron error:', error);
    res.status(500).json({ error: 'Failed to send daily emails' });
  }
});

// Helper function to format time from 24h to 12h format
function formatTime(time24: string): string {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// Helper function to generate daily email HTML (full template matching frontend)
function generateDailyEmailHTML(
  businessName: string,
  ownerName: string,
  date: string,
  schedule: any[],
  completed: any[],
  grossRevenue: number,
  totalExpenses: number,
  estimatedTax: number,
  netEarnings: number,
  expenses: any[]
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

// Helper function to send email (implement with your email service)
async function sendDailyEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  try {
    // Use your email service here (Resend, SendGrid, etc.)
    // Example with a generic API endpoint:
    const emailApiUrl = process.env.EMAIL_API_URL;
    
    if (!emailApiUrl) {
      console.warn('EMAIL_API_URL not configured, skipping email send');
      return false;
    }

    const response = await fetch(emailApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html, from: 'Halo Assistant <noreply@halo.app>' })
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending daily email:', error);
    return false;
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
