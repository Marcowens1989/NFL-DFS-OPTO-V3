import { GoogleGenAI } from '@google/genai';

// Cache the client instance.
let geminiClient: GoogleGenAI | null = null;

/**
 * Generates content using the Gemini API, with robust error handling and timeout.
 * This function will use a cached client to avoid re-initialization on every call.
 * @param prompt The prompt to send to the AI.
 * @param configOverride Optional configuration for the AI call, e.g., for JSON mode.
 * @param timeout The timeout in milliseconds for the AI call.
 * @param retries The number of times to retry on a timeout error.
 * @returns The generated text content as a string.
 */
export async function generateContent(
    prompt: string, 
    configOverride?: object, 
    timeout: number = 30000,
    retries: number = 1
): Promise<string> {
    if (!geminiClient) {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            // This is a critical configuration error.
            throw new Error("Your API Key is not configured. Please ensure the API_KEY is set correctly.");
        }
        geminiClient = new GoogleGenAI({ apiKey });
    }

    const enhancedPrompt = `${prompt}\n\nFor any real-time information like injuries or news, prioritize searching official sources and the X/Twitter accounts of verified NFL insiders like Adam Schefter and Ian Rapoport.`;

    // Base config. Use googleSearch by default for general queries.
    let finalConfig: any = { tools: [{ googleSearch: {} }] };

    if (configOverride) {
        // If a response schema is provided, we MUST use JSON mode and CANNOT use googleSearch.
        if ('responseSchema' in configOverride) {
            finalConfig = {
                responseMimeType: "application/json",
                ...configOverride
            };
        } else {
            finalConfig = { ...finalConfig, ...configOverride };
        }
    }
    
    let lastError: Error | null = null;
    for (let i = 0; i <= retries; i++) {
        try {
            if (i > 0) {
                console.log(`Retrying Gemini call (${i}/${retries}) after timeout...`);
                await new Promise(res => setTimeout(res, 2000 * i)); // Simple exponential backoff
            }
            
            console.log(`Attempting to generate content with Gemini (Attempt ${i+1}/${retries+1})...`);

            const apiCall = geminiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: enhancedPrompt,
                config: finalConfig
            });

            // Create a timeout promise that rejects if the API call takes too long.
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`The request to the AI service timed out after ${timeout/1000} seconds`)), timeout)
            );

            // Race the API call against the timeout.
            const response = await Promise.race([apiCall, timeoutPromise]);

            console.log("Gemini call successful.");
            
            // According to guidelines, response.text is the correct way to get the text.
            const text = response.text;
            if (text == null || text.trim() === '') {
                // Handle cases where the model returns an empty response, which can happen if the prompt is blocked.
                throw new Error("The AI returned an empty response. This may be due to the prompt being blocked by safety filters.");
            }

            return text;

        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Only retry on timeout errors
            if (!lastError.message.toLowerCase().includes("timed out")) {
                break;
            }
        }
    }

    // If all retries failed, throw a formatted error.
    console.error("Gemini API call failed after all retries.", lastError);

    const errorMessage = lastError?.message || "An unknown error occurred.";
    let displayError = `AI Generation Failed: ${errorMessage}`;

    // Create more user-friendly error messages for common issues.
    if (errorMessage.includes("API key not valid") || errorMessage.includes("API Key is not configured")) {
        displayError = "AI Generation Failed: Your API Key is either missing or invalid. Please ensure the API_KEY is configured correctly.";
    } else if (errorMessage.includes("timed out")) {
        // Preserve the specific timeout duration from the error message
        displayError = `AI Generation Failed: ${errorMessage}. The service might be busy. Please try again later.`;
    } else if (errorMessage.toLowerCase().includes('safety') || errorMessage.toLowerCase().includes('blocked')) {
        displayError = "AI Generation Failed: The response was blocked due to safety settings. Please try a different prompt.";
    }

    // Re-throw the user-friendly error to be caught by the UI.
    throw new Error(displayError);
}