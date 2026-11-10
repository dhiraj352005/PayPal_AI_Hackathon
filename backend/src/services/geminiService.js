import { GoogleGenAI } from '@google/genai';

/**
 * Checks if Gemini API key is configured
 */
export function isGeminiConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 0 && !key.includes('your_gemini_key'));
}

/**
 * Returns Gemini model name from env
 */
export function getGeminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-3.8-flash';
}

/**
 * Execute Gemini prompt with structured JSON expectation, timeout, and retries
 */
export async function generateGeminiContent({ prompt, systemInstruction, responseSchema }) {
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const apiKey = process.env.GEMINI_API_KEY.trim();
  const model = getGeminiModel();
  const ai = new GoogleGenAI({ apiKey });

  const timeoutMs = 6000;
  const maxRetries = 1;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const config = {
        model,
        contents: prompt
      };

      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      if (responseSchema) {
        config.generationConfig = {
          responseMimeType: 'application/json',
          responseSchema
        };
      }

      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API call timed out after 15 seconds')), timeoutMs)
      );

      const requestPromise = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json'
        }
      });

      const response = await Promise.race([requestPromise, timeoutPromise]);
      const text = response.text ? response.text.trim() : '';

      if (!text) {
        throw new Error('Gemini returned an empty response');
      }

      // Parse JSON safely
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Strip markdown code block if present
        const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        parsed = JSON.parse(cleaned);
      }

      return {
        data: parsed,
        mode: 'live',
        model
      };
    } catch (err) {
      lastError = err;
      console.warn(`[GeminiService] Attempt ${attempt + 1} failed:`, err.message);
      // Wait before retry
      if (attempt < maxRetries) {
        await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to generate content with Gemini');
}
