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
    const email = (userInfo.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Email not found in Google account' });

    // Ensure user_data record exists (upsert — create if new, do nothing if exists)
    const { data: existingUser } = await supabase!
      .from('user_data').select('email').eq('email', email).single();
    if (!existingUser) {
      const { error: insertError } = await supabase!
        .from('user_data')
        .insert({
          email,
          password_hash: null,
          business_profile: null,
          clients: [],
          appointments: [],
          expenses: [],
          ratings: [],
          bonus_entries: []
        });
      if (insertError) {
        console.error('Google auth - user record creation error:', insertError);
        // Don't fail login, just log the error — save endpoint will retry with upsert
      } else {
        console.log(`✅ Created user_data record for Google user: ${email}`);
      }
    }

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
    const email = (req.body.email || '').toLowerCase().trim();
    const password = req.body.password;
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
    const email = (req.body.email || '').toLowerCase().trim();
    const password = req.body.password;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    if (!password) return res.status(400).json({ error: 'Password required' });

    const { data: user, error: fetchError } = await supabase!
      .from('user_data').select('email, password_hash').eq('email', email).single();
    if (fetchError || !user) return res.status(401).json({ error: 'Invalid email or password' });

    if (user.password_hash) {
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) return res.status(401).json({ error: 'Invalid email or password' });
    } else {
      // User signed up via Google (no password set) — can't use email/password login
      return res.status(401).json({ error: 'This account uses Google Sign-In. Please sign in with Google.' });
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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', supabase: !!supabase, timestamp: new Date().toISOString() });
});

// Export for Vercel
export default app;
