<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1edTVUWWYQ1MW0vu5QQnnrkn0Lty_YTxA

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env.local` file in the root directory and add your API keys (for local development):
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
   VITE_EMAIL_API_URL=your_backend_email_api_url_here (optional - for production)
   ```
3. **Google OAuth Setup:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create a new OAuth 2.0 Client ID
   - Set Application type to "Web application"
   - Add authorized JavaScript origins:
     - `http://localhost:3000` (for local development)
     - Your production domain (when deploying, e.g., `https://your-app.vercel.app`)
   - **For Local Development:** Copy the Client ID and add it to `.env.local` as `VITE_GOOGLE_CLIENT_ID`
   - **For Vercel/Production:** 
     - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
     - Add `VITE_GOOGLE_CLIENT_ID` with your Client ID value
     - Select **Production** (and Preview if needed)
     - **Important:** Redeploy after adding environment variables (they are injected at build time)
4. **Backend Setup (Required for Data Persistence):**
   - The app now uses a backend API with Supabase (PostgreSQL) for data persistence
   - See `backend/README.md` for detailed setup instructions
   - Quick setup:
     1. Create a free account at [Supabase](https://supabase.com)
     2. Create a new project
     3. Run the SQL from `backend/schema.sql` in Supabase SQL Editor
     4. Copy your Supabase URL and Anon Key
     5. In the `backend` folder, create `.env` file:
        ```
        SUPABASE_URL=your_supabase_project_url
        SUPABASE_ANON_KEY=your_supabase_anon_key
        FRONTEND_URL=http://localhost:3000
        PORT=3001
        ```
     6. Install backend dependencies: `cd backend && npm install`
     7. Run backend server: `npm run dev`
   - Add to frontend `.env.local`:
     ```
     VITE_API_URL=http://localhost:3001
     ```
5. **Email Service Setup (Optional):**
   - The app automatically sends rating emails when appointments are completed
   - In development, emails are simulated (logged to console)
   - For production, set up a backend API endpoint that accepts POST requests:
     - Endpoint: `POST /api/send-email`
     - Body: `{ to, subject, html, from }`
     - Set `VITE_EMAIL_API_URL` in `.env.local` to your backend URL
   - Recommended services: Resend, SendGrid, or AWS SES
6. Run the app:
   `npm run dev`
