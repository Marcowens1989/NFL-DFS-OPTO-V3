import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

let geminiClient: GoogleGenAI | null = null;
const OPENROUTER_API_KEY = "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";

function _getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY environment variable not set for Gemini.");
    }
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

async function _callGemini(prompt: string, timeout: number): Promise<string> {
  const client = _getGeminiClient();
  
  const apiCall = client.models.generateContent({ 
    model: 'gemini-2.5-flash', 
    contents: prompt, 
    config: { tools: [{ googleSearch: {} }] } 
  });
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("Gemini request timed out")), timeout);
    apiCall.then(
      (resp) => { clearTimeout(timeoutId); resolve(resp.text); },
      (err) => { clearTimeout(timeoutId); reject(err); }
    );
  });
}

async function _callOpenRouter(prompt: string, timeout: number): Promise<string> {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemma-7b-it:free", // A powerful, free model
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: timeout,
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    if (axios.isAxiosError(error)) {
        console.error("OpenRouter API Error:", error.response?.data || error.message);
        throw new Error(`OpenRouter API Error: ${error.response?.statusText || error.message}`);
    }
    throw error;
  }
}

/**
 * Generates content using a waterfall of AI models.
 * Tries Gemini first, then falls back to OpenRouter on any failure.
 * @param prompt The prompt to send to the AI.
 * @param timeout The timeout in milliseconds for each individual AI call.
 * @returns The generated text content as a string.
 */
export async function generateContent(prompt: string, timeout: number = 30000): Promise<string> {
    const enhancedPrompt = `${prompt}\n\nFor any real-time information like injuries or news, prioritize searching official sources and the X/Twitter accounts of verified NFL insiders like Adam Schefter and Ian Rapoport.`;
    
    try {
        console.log("Attempting to generate content with Gemini...");
        const result = await _callGemini(enhancedPrompt, timeout);
        console.log("Gemini call successful.");
        return result;
    } catch (geminiError) {
        console.warn("Gemini call failed. Falling back to OpenRouter.", geminiError);
        try {
            console.log("Attempting to generate content with OpenRouter...");
            const result = await _callOpenRouter(enhancedPrompt, timeout);
            console.log("OpenRouter call successful.");
            return result;
        } catch (openRouterError) {
            console.error("All AI providers failed.", openRouterError);
            throw new Error(`AI Generation Failed: All providers were unreachable. Last error: ${openRouterError.message}`);
        }
    }
}
