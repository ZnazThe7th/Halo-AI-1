# Halo Assistant Backend

Backend API server for Halo Assistant application.

## Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up Supabase:**
   - Go to [Supabase](https://supabase.com) and create a free account
   - Create a new project
   - Go to SQL Editor and run the SQL from `schema.sql`
   - Go to Settings > API and copy your:
     - Project URL
     - Anon (public) key

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   FRONTEND_URL=http://localhost:3000
   PORT=3001
   ```

4. **Run the server:**
   ```bash
   npm run dev
   ```

## API Endpoints

### POST /auth/google
Authenticate with Google OAuth token.

**Request:**
```json
{
  "accessToken": "google_access_token_here"
}
```

**Response:**
```json
{
  "email": "user@example.com",
  "sessionId": "session_..."
}
```

### POST /auth/signup
Create a new account with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "email": "user@example.com",
  "sessionId": "session_..."
}
```

**Errors:**
- `400`: Invalid email or password (password must be at least 6 characters)
- `400`: Email already registered
- `500`: Failed to create account

### POST /auth/email
Authenticate with email and password (for email/password sign-in).

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "email": "user@example.com",
  "sessionId": "session_..."
}
```

**Errors:**
- `400`: Valid email and password required
- `401`: Invalid email or password
- `500`: Authentication failed

### GET /me
Get current authenticated user.

**Response:**
```json
{
  "email": "user@example.com"
}
```

### POST /save
Save user data to database.

**Request:**
```json
{
  "businessProfile": {...},
  "clients": [...],
  "appointments": [...],
  "expenses": [...],
  "ratings": [...]
}
```

**Response:**
```json
{
  "success": true
}
```

### GET /load
Load user data from database.

**Response:**
```json
{
  "businessProfile": {...},
  "clients": [...],
  "appointments": [...],
  "expenses": [...],
  "ratings": [...]
}
```

### POST /logout
Logout and clear session.

**Response:**
```json
{
  "success": true
}
```

### POST /send-daily-emails
Send daily email reports to all users with `dailyEmailEnabled: true`. This endpoint is designed to be called by a cron job at 5am CST.

**Headers:**
```
x-cron-secret: your-cron-secret-key
```

**Request Body (alternative to header):**
```json
{
  "secret": "your-cron-secret-key"
}
```

**Response:**
```json
{
  "message": "Processed 5 users",
  "sent": 3,
  "errors": ["Failed to send email to user@example.com"]
}
```

**Note:** Set `CRON_SECRET` in your `.env` file and `EMAIL_API_URL` for email sending.

## Daily Email Cron Job Setup

To send daily emails at 5am CST, set up a cron job to call the `/send-daily-emails` endpoint.

### Option 1: Using a Cron Service (Recommended)

1. **Use a service like EasyCron, Cron-Job.org, or GitHub Actions:**
   - Set up a scheduled task to run daily at 5:00 AM CST (11:00 AM UTC)
   - Make a POST request to: `https://your-backend-url.com/send-daily-emails`
   - Include header: `x-cron-secret: your-cron-secret-key`

2. **Example cron expression (5am CST = 11am UTC):**
   ```
   0 11 * * *
   ```

### Option 2: Using Node-Cron (Local Development)

Add to your `server.ts`:
```typescript
import cron from 'node-cron';

// Run daily at 5am CST (11am UTC)
cron.schedule('0 11 * * *', async () => {
  // Call the endpoint internally
  const response = await fetch('http://localhost:3001/send-daily-emails', {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET || 'your-secret-key'
    }
  });
  console.log('Daily emails sent:', await response.json());
});
```

### Environment Variables

Add to your `.env`:
```
CRON_SECRET=your-secure-random-secret-key-here
EMAIL_API_URL=https://your-email-service-api.com/send-email
```

## Deployment

### Option 1: Deploy to Railway/Render/Fly.io

1. Push backend folder to a separate repo or monorepo
2. Connect to Railway/Render/Fly.io
3. Set environment variables (including `CRON_SECRET` and `EMAIL_API_URL`)
4. Set up cron job using the platform's scheduler or external service
5. Deploy

### Option 2: Deploy to Vercel (Serverless Functions)

See `vercel.json` for configuration. Note: Vercel doesn't support long-running cron jobs natively. Use an external cron service to trigger the endpoint.

## Database Schema

The `user_data` table stores all user data:
- `email` (PRIMARY KEY): User's email address
- `business_profile` (JSONB): Business profile data
- `clients` (JSONB): Array of clients
- `appointments` (JSONB): Array of appointments
- `expenses` (JSONB): Array of expenses
- `ratings` (JSONB): Array of ratings
- `created_at`: Timestamp
- `updated_at`: Timestamp
