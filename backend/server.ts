import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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

// POST /auth/email - Create session for email/password auth
app.post('/auth/email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
