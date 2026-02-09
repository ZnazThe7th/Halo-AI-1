/**
 * Vercel Serverless API — single Express app handling all /api/* routes.
 * Deployed alongside the Vite frontend as one Vercel project.
 */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || true, // Allow same-origin in production
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Snapshots can be large
app.use(cookieParser());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
let supabase: ReturnType<typeof createClient> | null = null;
try {
  if (supabaseUrl && supabaseUrl.startsWith('http')) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (err) {
  console.warn('Supabase init failed:', err);
}

function requireDB(res: express.Response): boolean {
  if (!supabase) {
    res.status(503).json({ error: 'Database not configured' });
    return false;
  }
  return true;
}

// Session storage (Vercel serverless = ephemeral, so sessions are per-invocation)
// For production persistence, we use a DB-backed session check
const sessions = new Map<string, { email: string; expires: number }>();

const verifySession = (req: express.Request): string | null => {
  const sessionId = req.cookies?.sessionId;
  if (!sessionId) return null;

  // Check in-memory first
  const session = sessions.get(sessionId);
  if (session && session.expires > Date.now()) {
    return session.email;
  }
  sessions.delete(sessionId);

  // For serverless: decode the session ID which embeds the email
  // Format: session_<timestamp>_<random>_<base64email>
  try {
    const parts = sessionId.split('_');
    if (parts.length >= 4) {
      const email = Buffer.from(parts[3], 'base64').toString('utf-8');
      if (email && email.includes('@')) return email;
    }
  } catch (_) {}

  return null;
};

function createSession(email: string, res: express.Response): string {
  const emailB64 = Buffer.from(email).toString('base64');
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${emailB64}`;
  sessions.set(sessionId, { email, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 });

  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/'
  });

  return sessionId;
}

// ================================================================
// AUTH ROUTES
// ================================================================

app.post('/api/auth/google', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Access token required' });

    const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
    if (!response.ok) return res.status(401).json({ error: 'Invalid Google token' });

    const userInfo: any = await response.json();
    const email = userInfo.email;
    if (!email) return res.status(400).json({ error: 'Email not found in Google account' });

    const sessionId = createSession(email, res);
    res.json({ email, sessionId });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const { email, password } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const { data: existingUser } = await supabase!
      .from('user_data').select('email').eq('email', email).single();
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const { error: insertError } = await supabase!
      .from('user_data')
      .insert({ email, password_hash: passwordHash, business_profile: null, clients: [], appointments: [], expenses: [], ratings: [], bonus_entries: [] });
    if (insertError) { console.error('Signup error:', insertError); return res.status(500).json({ error: 'Failed to create account' }); }

    const sessionId = createSession(email, res);
    res.json({ email, sessionId });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.post('/api/auth/email', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const { email, password } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    if (!password) return res.status(400).json({ error: 'Password required' });

    const { data: user, error: fetchError } = await supabase!
      .from('user_data').select('email, password_hash').eq('email', email).single();
    if (fetchError || !user) return res.status(401).json({ error: 'Invalid email or password' });

    if (user.password_hash) {
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) return res.status(401).json({ error: 'Invalid email or password' });
    }

    const sessionId = createSession(email, res);
    res.json({ email, sessionId });
  } catch (error) {
    console.error('Email auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.get('/api/me', async (req, res) => {
  const email = verifySession(req);
  if (!email) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ email });
});

app.post('/api/logout', (req, res) => {
  const sessionId = req.cookies?.sessionId;
  if (sessionId) sessions.delete(sessionId);
  res.clearCookie('sessionId', { path: '/' });
  res.json({ success: true });
});

// ================================================================
// DATA SAVE/LOAD
// ================================================================

app.post('/api/save', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const email = verifySession(req);
    if (!email) return res.status(401).json({ error: 'Not authenticated' });

    const { businessProfile, clients, appointments, expenses, ratings, bonusEntries } = req.body;
    const { error } = await supabase!
      .from('user_data')
      .upsert({
        email,
        business_profile: businessProfile,
        clients: clients || [],
        appointments: appointments || [],
        expenses: expenses || [],
        ratings: ratings || [],
        bonus_entries: bonusEntries || [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' });

    if (error) { console.error('Save error:', error); return res.status(500).json({ error: 'Failed to save data' }); }
    res.json({ success: true });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.get('/api/load', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const email = verifySession(req);
    if (!email) return res.status(401).json({ error: 'Not authenticated' });

    const { data, error } = await supabase!
      .from('user_data').select('*').eq('email', email).single();

    if (error && error.code !== 'PGRST116') { console.error('Load error:', error); return res.status(500).json({ error: 'Failed to load data' }); }

    if (!data) {
      return res.json({ businessProfile: null, clients: [], appointments: [], expenses: [], ratings: [], bonusEntries: [] });
    }

    res.json({
      businessProfile: data.business_profile,
      clients: data.clients || [],
      appointments: data.appointments || [],
      expenses: data.expenses || [],
      ratings: data.ratings || [],
      bonusEntries: data.bonus_entries || []
    });
  } catch (error) {
    console.error('Load error:', error);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

// ================================================================
// DEVICE FINGERPRINT HELPERS
// ================================================================

function parseDeviceFromUA(userAgent: string): { deviceType: string; deviceName: string } {
  const ua = userAgent.toLowerCase();
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = /ipad|tablet/i.test(ua) ? 'tablet' : 'mobile';
  }
  let browser = 'Browser';
  if (ua.includes('edg/') || ua.includes('edge/')) browser = 'Edge';
  else if (ua.includes('chrome') && !ua.includes('chromium')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('opera') || ua.includes('opr/')) browser = 'Opera';
  let os = '';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux') && !ua.includes('android')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone')) os = 'iPhone';
  else if (ua.includes('ipad')) os = 'iPad';
  const deviceName = os ? `${browser} ${os}` : browser;
  return { deviceType, deviceName };
}

async function upsertDevice(email: string, fingerprint: string, userAgent: string) {
  if (!supabase) return null;
  const { deviceType, deviceName } = parseDeviceFromUA(userAgent);

  const { data: existing } = await supabase
    .from('devices').select('id').eq('user_email', email).eq('device_fingerprint', fingerprint).single();

  if (existing) {
    await supabase.from('devices').update({ last_seen_at: new Date().toISOString(), device_type: deviceType, device_name: deviceName }).eq('id', existing.id);
    return { id: existing.id, deviceType, deviceName };
  }

  const { data: newDevice, error } = await supabase
    .from('devices').insert({ user_email: email, device_fingerprint: fingerprint, device_type: deviceType, device_name: deviceName }).select('id').single();
  if (error || !newDevice) return null;
  return { id: newDevice.id, deviceType, deviceName };
}

// ================================================================
// SAVEPOINTS
// ================================================================

app.post('/api/savepoints', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const email = verifySession(req);
    if (!email) return res.status(401).json({ error: 'Not authenticated' });

    const { label, snapshot, snapshotVersion } = req.body;
    if (!snapshot) return res.status(400).json({ error: 'Snapshot data required' });

    const fingerprint = req.headers['x-device-fingerprint'] as string || '';
    const userAgent = req.headers['user-agent'] || '';
    let deviceId: string | null = null;
    let deviceType = 'desktop';
    let deviceName = 'Unknown Device';

    if (fingerprint) {
      const device = await upsertDevice(email, fingerprint, userAgent);
      if (device) { deviceId = device.id; deviceType = device.deviceType; deviceName = device.deviceName; }
    } else {
      const parsed = parseDeviceFromUA(userAgent);
      deviceType = parsed.deviceType;
      deviceName = parsed.deviceName;
    }

    const { data, error } = await supabase!
      .from('savepoints')
      .insert({
        user_email: email,
        device_id: deviceId,
        label: label || `Save Point - ${new Date().toLocaleString()}`,
        snapshot_json: snapshot,
        snapshot_version: snapshotVersion || 1,
        device_type: deviceType,
        device_name: deviceName
      })
      .select('id, label, snapshot_version, device_type, device_name, created_at')
      .single();

    if (error) { console.error('Create savepoint error:', error); return res.status(500).json({ error: 'Failed to create save point' }); }
    res.status(201).json(data);
  } catch (error) {
    console.error('Create savepoint error:', error);
    res.status(500).json({ error: 'Failed to create save point' });
  }
});

app.get('/api/savepoints', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const email = verifySession(req);
    if (!email) return res.status(401).json({ error: 'Not authenticated' });

    const { data, error } = await supabase!
      .from('savepoints')
      .select('id, label, snapshot_version, device_type, device_name, created_at')
      .eq('user_email', email)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) { console.error('List savepoints error:', error); return res.status(500).json({ error: 'Failed to list save points' }); }
    res.json(data || []);
  } catch (error) {
    console.error('List savepoints error:', error);
    res.status(500).json({ error: 'Failed to list save points' });
  }
});

app.get('/api/savepoints/:id', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const email = verifySession(req);
    if (!email) return res.status(401).json({ error: 'Not authenticated' });

    const { data, error } = await supabase!
      .from('savepoints').select('*').eq('id', req.params.id).eq('user_email', email).single();
    if (error || !data) return res.status(404).json({ error: 'Save point not found' });
    res.json(data);
  } catch (error) {
    console.error('Get savepoint error:', error);
    res.status(500).json({ error: 'Failed to get save point' });
  }
});

app.delete('/api/savepoints/:id', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const email = verifySession(req);
    if (!email) return res.status(401).json({ error: 'Not authenticated' });

    const { error } = await supabase!
      .from('savepoints').delete().eq('id', req.params.id).eq('user_email', email);
    if (error) { console.error('Delete savepoint error:', error); return res.status(500).json({ error: 'Failed to delete save point' }); }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete savepoint error:', error);
    res.status(500).json({ error: 'Failed to delete save point' });
  }
});

// ================================================================
// DAILY EMAILS
// ================================================================

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

app.post('/api/send-daily-emails', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const cronSecret = req.headers['x-cron-secret'] || req.body.secret;
    const isTest = req.body.test === true;
    const expectedSecret = process.env.CRON_SECRET || 'your-secret-key';

    if (isTest) {
      const email = verifySession(req);
      if (!email) return res.status(401).json({ error: 'Not authenticated' });
      console.log(`Test daily email requested by: ${email}`);
    } else {
      if (cronSecret !== expectedSecret) return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current date in CST
    const now = new Date();
    const cstDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const today = cstDate.toISOString().split('T')[0];
    const dateString = cstDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Get users
    let allUsers: any[] = [];
    if (isTest) {
      const email = verifySession(req);
      if (!email) return res.status(401).json({ error: 'Not authenticated' });
      const { data: userData, error: fetchError } = await supabase!
        .from('user_data')
        .select('email, business_profile, appointments, expenses')
        .eq('email', email)
        .single();
      if (fetchError) {
        console.error('Error fetching user:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch user data' });
      }
      if (userData) allUsers = [userData];
    } else {
      const { data: users, error: fetchError } = await supabase!
        .from('user_data')
        .select('email, business_profile, appointments, expenses')
        .not('business_profile', 'is', null);
      if (fetchError) {
        console.error('Error fetching users:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch users' });
      }
      if (users) allUsers = users;
    }

    if (!allUsers || allUsers.length === 0) {
      return res.json({ message: isTest ? 'No user data found' : 'No users found', sent: 0 });
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const user of allUsers) {
      try {
        const businessProfile = user.business_profile;
        if (!isTest && (!businessProfile || !businessProfile.dailyEmailEnabled)) continue;

        const appointments = user.appointments || [];
        const expenses = user.expenses || [];
        const services = businessProfile?.services || [];

        // Today's schedule
        const todaySchedule = appointments
          .filter((a: any) => a.date === today && a.status !== 'CANCELLED' && a.status !== 'BLOCKED')
          .map((a: any) => {
            const service = services.find((s: any) => s.id === a.serviceId);
            return { time: a.time, formattedTime: formatTime(a.time), clientName: a.clientName || 'No client', serviceName: service?.name || 'Unknown', status: a.status };
          })
          .sort((a: any, b: any) => a.time.localeCompare(b.time))
          .map((item: any) => ({ time: item.formattedTime, clientName: item.clientName, serviceName: item.serviceName, status: item.status }));

        // Completed appointments
        const completedAppointments = appointments
          .filter((a: any) => a.status === 'COMPLETED')
          .map((a: any) => {
            const service = services.find((s: any) => s.id === a.serviceId);
            let price = service?.price || 0;
            if (service?.pricePerPerson) {
              const numPeople = a.numberOfPeople || (a.clientIds?.length || a.clientNames?.length || 1);
              price = service.price * numPeople;
            }
            return { date: a.date, time: formatTime(a.time), clientName: a.clientName || 'No client', serviceName: service?.name || 'Unknown', amount: price };
          });

        // Financials
        const grossRevenue = completedAppointments.reduce((sum: number, a: any) => sum + a.amount, 0);
        const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        const writeOffs = expenses
          .filter((e: any) => ['Supplies', 'Rent', 'Marketing'].includes(e.category))
          .reduce((sum: number, e: any) => sum + e.amount, 0);
        const taxableIncome = Math.max(0, grossRevenue - writeOffs);
        const estimatedTax = taxableIncome * ((businessProfile?.taxRate || 0) / 100);
        const netEarnings = grossRevenue - totalExpenses - estimatedTax;

        const expenseData = expenses.map((e: any) => ({ name: e.name, category: e.category, amount: e.amount, date: e.date }));

        const emailHtml = generateDailyEmailHTML(
          businessProfile?.name || 'Your Business',
          businessProfile?.ownerName || 'Business Owner',
          dateString, todaySchedule, completedAppointments,
          grossRevenue, totalExpenses, estimatedTax, netEarnings, expenseData
        );

        const emailSent = await sendDailyEmail({
          to: businessProfile?.email || user.email,
          subject: `Daily Report - ${businessProfile?.name || 'Your Business'} - ${dateString}`,
          html: emailHtml
        });

        if (emailSent) {
          sentCount++;
          console.log(`Daily email sent to ${businessProfile?.email || user.email}`);
        } else {
          errors.push(`Failed to send to ${businessProfile?.email || user.email}`);
        }
      } catch (userError) {
        console.error(`Error processing user ${user.email}:`, userError);
        errors.push(`Error: ${user.email}`);
      }
    }

    res.json({ message: `Processed ${allUsers.length} users`, sent: sentCount, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error('Daily email error:', error);
    res.status(500).json({ error: 'Failed to send daily emails' });
  }
});

// ================================================================
// EMAIL HELPERS
// ================================================================

async function sendDailyEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  try {
    // Priority 1: Use Resend API directly (recommended for Vercel)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Halo Assistant <onboarding@resend.dev>',
          to: [to],
          subject,
          html
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('Resend API error:', response.status, err);
        return false;
      }
      console.log(`✅ Email sent via Resend to ${to}`);
      return true;
    }

    // Priority 2: Use generic EMAIL_API_URL
    const emailApiUrl = process.env.EMAIL_API_URL;
    if (emailApiUrl) {
      const response = await fetch(emailApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html, from: 'Halo Assistant <noreply@halo.app>' })
      });
      return response.ok;
    }

    console.warn('No email service configured. Set RESEND_API_KEY or EMAIL_API_URL.');
    return false;
  } catch (error) {
    console.error('Error sending daily email:', error);
    return false;
  }
}

function generateDailyEmailHTML(
  businessName: string, ownerName: string, date: string,
  schedule: any[], completed: any[],
  grossRevenue: number, totalExpenses: number, estimatedTax: number, netEarnings: number,
  expenses: any[]
): string {
  const scheduleRows = schedule.length > 0
    ? schedule.map(item => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${item.time}</td><td style="padding:8px;border-bottom:1px solid #eee;">${item.clientName}</td><td style="padding:8px;border-bottom:1px solid #eee;">${item.serviceName}</td><td style="padding:8px;border-bottom:1px solid #eee;">${item.status}</td></tr>`).join('')
    : '<tr><td colspan="4" style="padding:8px;text-align:center;color:#999;">No appointments scheduled</td></tr>';

  const completedRows = completed.length > 0
    ? completed.map(item => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${item.date}</td><td style="padding:8px;border-bottom:1px solid #eee;">${item.time}</td><td style="padding:8px;border-bottom:1px solid #eee;">${item.clientName}</td><td style="padding:8px;border-bottom:1px solid #eee;">${item.serviceName}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">$${item.amount.toFixed(2)}</td></tr>`).join('')
    : '<tr><td colspan="5" style="padding:8px;text-align:center;color:#999;">No completed appointments</td></tr>';

  const expenseRows = expenses.length > 0
    ? expenses.map(item => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${item.date}</td><td style="padding:8px;border-bottom:1px solid #eee;">${item.name}</td><td style="padding:8px;border-bottom:1px solid #eee;">${item.category}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#dc2626;">-$${item.amount.toFixed(2)}</td></tr>`).join('')
    : '<tr><td colspan="4" style="padding:8px;text-align:center;color:#999;">No expenses recorded</td></tr>';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Daily Report - ${businessName}</title></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
  <tr><td style="background:#000;padding:30px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:24px;">HALO</h1><p style="color:#f97316;margin:5px 0 0;font-size:12px;text-transform:uppercase;letter-spacing:3px;">Daily Report</p></td></tr>
  <tr><td style="padding:30px;">
    <p style="color:#666;margin:0 0 5px;">Good morning, <strong>${ownerName}</strong></p>
    <p style="color:#999;margin:0 0 20px;font-size:14px;">${date}</p>
    <h2 style="color:#000;border-bottom:2px solid #f97316;padding-bottom:10px;">Today's Schedule</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;"><thead><tr style="background:#f5f5f5;"><th style="padding:8px;text-align:left;">Time</th><th style="padding:8px;text-align:left;">Client</th><th style="padding:8px;text-align:left;">Service</th><th style="padding:8px;text-align:left;">Status</th></tr></thead><tbody>${scheduleRows}</tbody></table>
    <h2 style="color:#000;border-bottom:2px solid #f97316;padding-bottom:10px;">Financial Summary</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td style="padding:12px;border-bottom:1px solid #eee;font-weight:bold;">Gross Revenue</td><td style="padding:12px;border-bottom:1px solid #eee;text-align:right;color:#16a34a;font-weight:bold;font-size:18px;">$${grossRevenue.toFixed(2)}</td></tr>
      <tr><td style="padding:12px;border-bottom:1px solid #eee;font-weight:bold;">Total Expenses</td><td style="padding:12px;border-bottom:1px solid #eee;text-align:right;color:#dc2626;font-weight:bold;">-$${totalExpenses.toFixed(2)}</td></tr>
      <tr><td style="padding:12px;border-bottom:1px solid #eee;font-weight:bold;">Estimated Tax</td><td style="padding:12px;border-bottom:1px solid #eee;text-align:right;color:#dc2626;font-weight:bold;">-$${estimatedTax.toFixed(2)}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:12px;font-weight:bold;font-size:16px;">Net Earnings</td><td style="padding:12px;text-align:right;font-weight:bold;font-size:18px;color:${netEarnings >= 0 ? '#16a34a' : '#dc2626'};">$${netEarnings.toFixed(2)}</td></tr>
    </table>
    <h2 style="color:#000;border-bottom:2px solid #f97316;padding-bottom:10px;">Completed Appointments</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;"><thead><tr style="background:#f5f5f5;"><th style="padding:8px;text-align:left;">Date</th><th style="padding:8px;text-align:left;">Time</th><th style="padding:8px;text-align:left;">Client</th><th style="padding:8px;text-align:left;">Service</th><th style="padding:8px;text-align:right;">Amount</th></tr></thead><tbody>${completedRows}</tbody></table>
    <h2 style="color:#000;border-bottom:2px solid #f97316;padding-bottom:10px;">Expenses</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;"><thead><tr style="background:#f5f5f5;"><th style="padding:8px;text-align:left;">Date</th><th style="padding:8px;text-align:left;">Name</th><th style="padding:8px;text-align:left;">Category</th><th style="padding:8px;text-align:right;">Amount</th></tr></thead><tbody>${expenseRows}</tbody></table>
  </td></tr>
  <tr><td style="background:#000;padding:20px;text-align:center;"><p style="color:#666;margin:0;font-size:12px;">Powered by Halo Assistant</p></td></tr>
</table></body></html>`;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', supabase: !!supabase, emailService: process.env.RESEND_API_KEY ? 'resend' : (process.env.EMAIL_API_URL ? 'custom' : 'none'), timestamp: new Date().toISOString() });
});

// Export for Vercel
export default app;
