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

### POST /auth/email
Authenticate with email (for email/password sign-in).

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "email": "user@example.com",
  "sessionId": "session_..."
}
```

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

## Deployment

### Option 1: Deploy to Railway/Render/Fly.io

1. Push backend folder to a separate repo or monorepo
2. Connect to Railway/Render/Fly.io
3. Set environment variables
4. Deploy

### Option 2: Deploy to Vercel (Serverless Functions)

See `vercel.json` for configuration.

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
