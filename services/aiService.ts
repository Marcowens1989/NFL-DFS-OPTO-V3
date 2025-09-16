import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

/**
 * Gets a singleton instance of the GoogleGenAI client.
 * Initializes the client on the first call.
 * This lazy initialization prevents the app from crashing on load if the API key isn't ready.
 * @returns The singleton GoogleGenAI client instance.
 */
export function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY environment variable not set.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}