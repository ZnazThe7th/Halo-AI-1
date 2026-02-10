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
// AI platform endpoints (/api/ai/*) allow any origin (CORS open)
// All other routes use same-origin with credentials
app.use((req, res, next) => {
  if (req.path.startsWith('/api/ai/') && !req.path.includes('/keys')) {
    // Open CORS for AI platform endpoints (not key management)
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});
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

// ================================================================
// AI PLATFORM INTEGRATION — API Key Auth + endpoints for
// ChatGPT Actions, Gemini Extensions, Claude MCP, etc.
// ================================================================

// Verify API key from Authorization: Bearer <key> header
const verifyApiKey = async (req: express.Request, res: express.Response): Promise<string | null> => {
  if (!supabase) { res.status(503).json({ error: 'Database not configured' }); return null; }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header. Use: Bearer <your_api_key>' });
    return null;
  }

  const apiKey = authHeader.slice(7).trim();
  if (!apiKey.startsWith('halo_')) {
    res.status(401).json({ error: 'Invalid API key format' });
    return null;
  }

  const { data, error } = await supabase
    .from('user_data')
    .select('email')
    .eq('api_key', apiKey)
    .single();

  if (error || !data) {
    res.status(401).json({ error: 'Invalid API key' });
    return null;
  }

  return data.email;
};

// --- API Key Management (session-auth, used from Settings UI) ---

app.post('/api/ai/keys/generate', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const email = verifySession(req);
    if (!email) return res.status(401).json({ error: 'Not authenticated' });

    // Generate a random API key
    const randomPart = Array.from({ length: 32 }, () =>
      'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36))
    ).join('');
    const apiKey = `halo_${randomPart}`;

    // Store in user_data
    const { error } = await supabase!
      .from('user_data')
      .update({ api_key: apiKey })
      .eq('email', email);

    if (error) {
      console.error('Generate API key error:', error);
      return res.status(500).json({ error: 'Failed to generate API key' });
    }

    res.json({ apiKey });
  } catch (error) {
    console.error('Generate API key error:', error);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

app.delete('/api/ai/keys', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const email = verifySession(req);
    if (!email) return res.status(401).json({ error: 'Not authenticated' });

    const { error } = await supabase!
      .from('user_data')
      .update({ api_key: null })
      .eq('email', email);

    if (error) return res.status(500).json({ error: 'Failed to revoke API key' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

app.get('/api/ai/keys', async (req, res) => {
  try {
    if (!requireDB(res)) return;
    const email = verifySession(req);
    if (!email) return res.status(401).json({ error: 'Not authenticated' });

    const { data } = await supabase!
      .from('user_data')
      .select('api_key')
      .eq('email', email)
      .single();

    res.json({ hasKey: !!(data?.api_key), keyPreview: data?.api_key ? `${data.api_key.slice(0, 10)}...${data.api_key.slice(-4)}` : null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check API key' });
  }
});

// --- AI Platform Endpoints (API key auth) ---

// GET /api/ai/schedule — Today's or a specific date's appointments
app.get('/api/ai/schedule', async (req, res) => {
  try {
    const email = await verifyApiKey(req, res);
    if (!email) return;

    const { data } = await supabase!
      .from('user_data')
      .select('appointments, business_profile')
      .eq('email', email)
      .single();

    if (!data) return res.json({ appointments: [] });

    const appointments: any[] = data.appointments || [];
    const dateParam = req.query.date as string; // YYYY-MM-DD
    const now = new Date();
    const todayStr = dateParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const filtered = appointments.filter((a: any) => a.date === todayStr);
    const services: any[] = data.business_profile?.services || [];

    const result = filtered.map((a: any) => {
      const service = services.find((s: any) => s.id === a.serviceId);
      return {
        id: a.id,
        date: a.date,
        time: a.time,
        clientName: a.clientName,
        service: service?.name || 'Unknown',
        duration: service?.durationMin || 60,
        status: a.status,
        notes: a.notes || ''
      };
    }).sort((a: any, b: any) => a.time.localeCompare(b.time));

    res.json({ date: todayStr, appointments: result, total: result.length });
  } catch (error) {
    console.error('AI schedule error:', error);
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

// GET /api/ai/clients — List all clients
app.get('/api/ai/clients', async (req, res) => {
  try {
    const email = await verifyApiKey(req, res);
    if (!email) return;

    const { data } = await supabase!
      .from('user_data')
      .select('clients')
      .eq('email', email)
      .single();

    const clients: any[] = (data?.clients || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      preferences: c.preferences,
      lastVisit: c.lastVisit
    }));

    const search = (req.query.search as string || '').toLowerCase();
    const filtered = search
      ? clients.filter((c: any) => c.name.toLowerCase().includes(search) || c.email.toLowerCase().includes(search))
      : clients;

    res.json({ clients: filtered, total: filtered.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get clients' });
  }
});

// POST /api/ai/clients — Add a new client
app.post('/api/ai/clients', async (req, res) => {
  try {
    const email = await verifyApiKey(req, res);
    if (!email) return;

    const { name, clientEmail, phone, preferences } = req.body;
    if (!name) return res.status(400).json({ error: 'Client name is required' });

    const { data } = await supabase!
      .from('user_data')
      .select('clients')
      .eq('email', email)
      .single();

    const clients: any[] = data?.clients || [];
    const newClient = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      email: clientEmail || '',
      phone: phone || '',
      notes: [],
      preferences: preferences || '',
      lastVisit: null
    };

    clients.push(newClient);
    const { error } = await supabase!
      .from('user_data')
      .update({ clients })
      .eq('email', email);

    if (error) return res.status(500).json({ error: 'Failed to add client' });
    res.status(201).json({ client: newClient, message: `Client "${name}" added successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add client' });
  }
});

// POST /api/ai/appointments — Book an appointment
app.post('/api/ai/appointments', async (req, res) => {
  try {
    const email = await verifyApiKey(req, res);
    if (!email) return;

    const { clientName, serviceName, date, time, notes } = req.body;
    if (!clientName || !date || !time) return res.status(400).json({ error: 'clientName, date (YYYY-MM-DD), and time (HH:MM) are required' });

    const { data } = await supabase!
      .from('user_data')
      .select('appointments, clients, business_profile')
      .eq('email', email)
      .single();

    if (!data) return res.status(500).json({ error: 'User data not found' });

    const services: any[] = data.business_profile?.services || [];
    const service = serviceName
      ? services.find((s: any) => s.name.toLowerCase().includes(serviceName.toLowerCase()))
      : services[0];
    if (!service) return res.status(400).json({ error: `Service "${serviceName || 'default'}" not found. Available: ${services.map((s: any) => s.name).join(', ')}` });

    const clients: any[] = data.clients || [];
    const client = clients.find((c: any) => c.name.toLowerCase().includes(clientName.toLowerCase()));

    const appointments: any[] = data.appointments || [];
    const newAppt = {
      id: Math.random().toString(36).substr(2, 9),
      clientId: client?.id || '',
      clientName: client?.name || clientName,
      serviceId: service.id,
      date,
      time,
      status: 'CONFIRMED',
      notes: notes || ''
    };

    appointments.push(newAppt);
    const { error } = await supabase!
      .from('user_data')
      .update({ appointments })
      .eq('email', email);

    if (error) return res.status(500).json({ error: 'Failed to book appointment' });
    res.status(201).json({
      appointment: { ...newAppt, service: service.name, duration: service.durationMin },
      message: `Appointment booked: ${client?.name || clientName} for ${service.name} on ${date} at ${time}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// PATCH /api/ai/appointments/:id — Update appointment status
app.patch('/api/ai/appointments/:id', async (req, res) => {
  try {
    const email = await verifyApiKey(req, res);
    if (!email) return;

    const { status } = req.body;
    const validStatuses = ['CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED', 'BLOCKED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `status is required. Valid values: ${validStatuses.join(', ')}` });
    }

    const { data } = await supabase!
      .from('user_data')
      .select('appointments')
      .eq('email', email)
      .single();

    const appointments: any[] = data?.appointments || [];
    const idx = appointments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Appointment not found' });

    appointments[idx].status = status;
    const { error } = await supabase!
      .from('user_data')
      .update({ appointments })
      .eq('email', email);

    if (error) return res.status(500).json({ error: 'Failed to update appointment' });
    res.json({ appointment: appointments[idx], message: `Appointment ${req.params.id} marked as ${status}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// GET /api/ai/business — Business profile and stats
app.get('/api/ai/business', async (req, res) => {
  try {
    const email = await verifyApiKey(req, res);
    if (!email) return;

    const { data } = await supabase!
      .from('user_data')
      .select('business_profile, appointments, expenses, clients, bonus_entries')
      .eq('email', email)
      .single();

    if (!data || !data.business_profile) return res.json({ error: 'Business not set up yet' });

    const bp = data.business_profile;
    const appointments: any[] = data.appointments || [];
    const expenses: any[] = data.expenses || [];
    const clients: any[] = data.clients || [];
    const bonusEntries: any[] = data.bonus_entries || [];

    const completed = appointments.filter((a: any) => a.status === 'COMPLETED');
    const services: any[] = bp.services || [];

    let grossRevenue = 0;
    completed.forEach((a: any) => {
      if (a.overridePrice !== undefined) { grossRevenue += a.overridePrice; return; }
      const svc = services.find((s: any) => s.id === a.serviceId);
      if (svc) {
        let price = svc.price;
        if (svc.pricePerPerson && a.numberOfPeople) price *= a.numberOfPeople;
        grossRevenue += price;
      }
    });

    const bonusTotal = bonusEntries.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const taxRate = bp.taxRate || 0;
    const estimatedTax = grossRevenue * (taxRate / 100);
    const netEarnings = grossRevenue + bonusTotal - totalExpenses - estimatedTax;

    res.json({
      business: {
        name: bp.name,
        owner: bp.ownerName,
        category: bp.category,
        workingHours: bp.workingHours,
        services: services.map((s: any) => ({ name: s.name, price: s.price, duration: s.durationMin }))
      },
      stats: {
        totalClients: clients.length,
        totalAppointments: appointments.length,
        completedAppointments: completed.length,
        grossRevenue,
        bonusIncome: bonusTotal,
        totalExpenses,
        taxRate,
        estimatedTax,
        netEarnings,
        monthlyGoal: bp.monthlyRevenueGoal || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get business stats' });
  }
});

// GET /api/ai/earnings — Detailed financial breakdown
app.get('/api/ai/earnings', async (req, res) => {
  try {
    const email = await verifyApiKey(req, res);
    if (!email) return;

    const { data } = await supabase!
      .from('user_data')
      .select('business_profile, appointments, expenses, bonus_entries')
      .eq('email', email)
      .single();

    if (!data) return res.json({ error: 'No data found' });

    const services: any[] = data.business_profile?.services || [];
    const appointments: any[] = data.appointments || [];
    const expenses: any[] = data.expenses || [];
    const bonusEntries: any[] = data.bonus_entries || [];

    const completed = appointments.filter((a: any) => a.status === 'COMPLETED');

    const revenueByService: Record<string, { name: string; total: number; count: number }> = {};
    completed.forEach((a: any) => {
      const svc = services.find((s: any) => s.id === a.serviceId);
      const svcName = svc?.name || 'Unknown';
      let price = a.overridePrice ?? (svc?.price || 0);
      if (svc?.pricePerPerson && a.numberOfPeople) price = svc.price * a.numberOfPeople;
      if (!revenueByService[svcName]) revenueByService[svcName] = { name: svcName, total: 0, count: 0 };
      revenueByService[svcName].total += price;
      revenueByService[svcName].count += 1;
    });

    const expensesByCategory: Record<string, number> = {};
    expenses.forEach((e: any) => {
      expensesByCategory[e.category || 'Other'] = (expensesByCategory[e.category || 'Other'] || 0) + e.amount;
    });

    res.json({
      revenueByService: Object.values(revenueByService),
      expensesByCategory,
      bonusEntries: bonusEntries.map((b: any) => ({ description: b.description, amount: b.amount, date: b.date })),
      totalExpenses: expenses.reduce((s: number, e: any) => s + e.amount, 0),
      totalBonus: bonusEntries.reduce((s: number, b: any) => s + (b.amount || 0), 0)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get earnings' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', supabase: !!supabase, aiIntegration: true, timestamp: new Date().toISOString() });
});

// Export for Vercel
export default app;
