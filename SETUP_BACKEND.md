# Backend Setup Guide

## Quick Start

### 1. Install Backend Dependencies (Already Done ✅)
```bash
cd backend
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the `backend` folder:

```bash
cd backend
# Create .env file
```

Add these variables to `backend/.env`:

```env
# Supabase Configuration (Required)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:3000

# Email Configuration (Required for daily emails)
EMAIL_API_URL=your_email_api_url
# For Resend API, use: https://api.resend.com/emails

# Cron Secret (Required for daily email cron job)
CRON_SECRET=your-secure-random-secret-key-here
```

### 3. Set Up Supabase

1. Go to [Supabase](https://supabase.com) and create a free account
2. Create a new project
3. Go to SQL Editor and run the SQL from `backend/schema.sql`
4. Go to Settings > API and copy:
   - Project URL → `SUPABASE_URL`
   - Anon (public) key → `SUPABASE_ANON_KEY`

### 4. Configure Frontend

Create or update `.env.local` in the **root** directory (not backend):

```env
# Backend API URL (Required for backend features)
VITE_API_URL=http://localhost:3001

# Other existing variables...
GEMINI_API_KEY=your_gemini_api_key
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### 5. Start the Backend Server

```bash
cd backend
npm run dev
```

The server will start on `http://localhost:3001`

### 6. Start the Frontend (in a separate terminal)

```bash
# In the root directory
npm run dev
```

The frontend will start on `http://localhost:3000`

## Troubleshooting

### "Backend API not available" Error

1. **Check if backend is running:**
   - Open `http://localhost:3001` in your browser
   - You should see an error (which is normal - means server is running)

2. **Check VITE_API_URL:**
   - Make sure `.env.local` in the root has `VITE_API_URL=http://localhost:3001`
   - Restart the frontend dev server after adding/changing `.env.local`

3. **Check backend logs:**
   - Look at the terminal where `npm run dev` is running in the backend folder
   - Check for any errors

4. **Check CORS:**
   - Make sure `FRONTEND_URL` in `backend/.env` matches your frontend URL
   - Default is `http://localhost:3000`

### Backend Won't Start

1. **Check dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Check environment variables:**
   - Make sure `backend/.env` exists and has all required variables
   - Especially `SUPABASE_URL` and `SUPABASE_ANON_KEY`

3. **Check port:**
   - Make sure port 3001 is not already in use
   - Change `PORT` in `backend/.env` if needed

## Production Deployment

For production, you'll need to:
1. Deploy the backend to a service like Railway, Render, or Fly.io
2. Set environment variables in your hosting platform
3. Update `VITE_API_URL` in Vercel (or your frontend hosting) to point to your deployed backend URL
4. Set up a cron job to call `/send-daily-emails` at 5am CST
