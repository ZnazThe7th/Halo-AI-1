import OpenAI from 'openai';
import { Client, AISummaryResponse } from "../types";

// OpenAI model to use across all AI features
const AI_MODEL = 'gpt-4o';

// Helper to safely get the OpenAI client.
const getAiClient = () => {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
    console.error("OPENAI_API_KEY is missing from environment variables.");
    throw new Error("AI functionality is disabled — set OPENAI_API_KEY in Vercel Environment Variables and redeploy.");
  }
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
};

/**
 * Generates a concise summary of client notes and suggests talking points.
 */
export const generateClientSummary = async (client: Client): Promise<AISummaryResponse> => {
  try {
    const openai = getAiClient();

    const prompt = `
      You are an assistant for a busy service professional.
      Here is the historical data for client: ${client.name}.
      
      Preferences: ${client.preferences}
      
      Past Notes:
      ${client.notes.join('\n')}
      
      Please provide a JSON object with:
      1. "summary": A very short summary of their history (max 2 sentences).
      2. "keyTopics": An array of 3 key topics or facts derived from the notes.
      3. "suggestedTalkingPoints": An array of 2 suggested professional talking points for today's visit.
    `;

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AISummaryResponse;

  } catch (error) {
    console.error("Error generating client summary:", error);
    return {
      summary: "Could not generate AI summary at this time.",
      keyTopics: [],
      suggestedTalkingPoints: ["Ask about their day", "Confirm service details"]
    };
  }
};

/**
 * Drafts a follow-up message after an appointment.
 */
export const generateFollowUpMessage = async (clientName: string, serviceName: string, notes: string): Promise<string> => {
  try {
    const openai = getAiClient();

    const prompt = `
      Draft a friendly, short SMS text message (max 160 chars) to ${clientName} who just had a ${serviceName}.
      The service professional added these notes after the visit: "${notes}".
      Include a request for feedback or a review link placeholder if appropriate based on the tone.
      Do not include hashtags. Keep it personal and warm.
      Return ONLY the message text, no quotes or explanation.
    `;

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0]?.message?.content || "Thank you for visiting! How was your appointment today?";

  } catch (error) {
    console.error("Error generating follow-up:", error);
    return `Hi ${clientName}, thanks for coming in for your ${serviceName}! We hope you love it.`;
  }
};

/**
 * Smart Scheduling: Analyzes time slots to find best fit.
 */
export const suggestReschedulingOptions = async (date: string, conflicts: string[]): Promise<string[]> => {
    try {
        const openai = getAiClient();

        const prompt = `
            I have a scheduling conflict on ${date}. The busy slots are: ${conflicts.join(', ')}.
            Suggest 3 alternative generic time slots for that same day that would typically work for a salon (Open 9-6).
            Return only the time strings in HH:mm format, comma separated. No explanation.
        `;
        
        const response = await openai.chat.completions.create({
          model: AI_MODEL,
          messages: [{ role: 'user', content: prompt }],
        });
        
        const text = response.choices[0]?.message?.content || "10:00, 13:00, 16:00";
        return text.split(',').map(s => s.trim());
    } catch (e) {
        return ["09:00", "13:00", "15:30"];
    }
}

/**
 * Generates a welcome email content.
 */
export const generateWelcomeEmailContent = async (ownerName: string, businessName: string): Promise<string> => {
  try {
      const openai = getAiClient();

      const prompt = `
        Write a short, professional, and inspiring welcome email (subject and body) for a new user named ${ownerName} who just signed up for "Halo Assistant" for their business "${businessName}". 
        Halo is an AI-powered operating system for solo service businesses.
        Keep it under 100 words. Return just the email text.
      `;

      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.choices[0]?.message?.content || `Welcome to Halo, ${ownerName}! We're excited to help ${businessName} grow.`;
  } catch (e) {
      return `Welcome to Halo, ${ownerName}! Your business ${businessName} is all set up.`;
  }
}

/**
 * Generates a password reset email content with the code.
 */
export const generateResetCodeEmail = async (email: string, code: string): Promise<string> => {
    try {
        const openai = getAiClient();

        const prompt = `
          Write the body of a security email for "Halo Assistant" to the user ${email}. 
          The email contains their password reset code: ${code}.
          Keep it security-focused, urgent but professional. Max 30 words.
          Return only the email body text, no subject line.
        `;
  
        const response = await openai.chat.completions.create({
          model: AI_MODEL,
          messages: [{ role: 'user', content: prompt }],
        });
  
        return response.choices[0]?.message?.content || `Your Halo verification code is ${code}. Do not share this with anyone.`;
    } catch (e) {
        return `Your security verification code is: ${code}`;
    }
}
