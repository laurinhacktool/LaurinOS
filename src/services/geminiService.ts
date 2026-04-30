import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { ApiError, ApiErrorType } from "../types";

function getApiKey() {
  // Priority: 1. User provided specifically named key, 2. Standard environment key, 3. Vite prefixed key
  // @ts-ignore
  const key = process.env.MY_GEMINI_API_KEY || process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
  return key && key !== 'MY_GEMINI_API_KEY' ? key : '';
}

export async function generateContentWithRetry(
  params: GenerateContentParameters,
  maxRetries = 3,
  initialDelay = 1000
): Promise<GenerateContentResponse> {
  let lastError: any;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const apiKey = getApiKey();
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        console.warn("GEMINI_API_KEY chýba alebo je neplatný. Používam offline režim.");
        return {
          text: () => "Lili (Offline Režim): Gemini API kľúč nie je nastavený. Bežím v obmedzenom lokálnom režime. Pre plnú funkčnosť nastavte GEMINI_API_KEY v nastaveniach AI Studia."
        } as any;
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent(params);
      return response;
    } catch (error: any) {
      lastError = error;
      
      const errorStr = JSON.stringify(error).toLowerCase();
      const status = error?.status || error?.error?.status || "";
      const message = (error?.message || error?.error?.message || "").toLowerCase();
      
      const isRateLimit = status === 'RESOURCE_EXHAUSTED' || 
                          message.includes('429') || 
                          message.includes('quota exceeded') ||
                          errorStr.includes('429') || 
                          errorStr.includes('resource_exhausted');
      
      const isSafety = status === 'SAFETY' || 
                       message.includes('safety') || 
                       message.includes('blocked');

      const isAuth = status === 'UNAUTHENTICATED' || 
                     message.includes('401') || 
                     message.includes('unauthorized') || 
                     message.includes('key');

      if (isRateLimit) {
        window.dispatchEvent(new CustomEvent('gemini_rate_limit_hit', { detail: { attempt: i + 1, maxRetries } }));
        if (i < maxRetries) {
          const delay = initialDelay * Math.pow(2, i);
          console.warn(`Gemini API rate limit hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      // If we reach here, it's either a non-retriable error or we exhausted retries
      let type: ApiErrorType = 'UNKNOWN';
      let userMessage = "Vyskytla sa neočakávaná chyba pri komunikácii s Lili.";

      if (isRateLimit) {
        type = 'RATE_LIMIT';
        userMessage = "Sémantická diaľnica je preťažená (429). Prekročili ste limit dopytov. Skúste to prosím o minútu alebo skontrolujte svoju kvótu v Google AI Studio.";
      } else if (isAuth) {
        type = 'AUTH_ERROR';
        userMessage = "Chyba autentifikácie (401). Skontrolujte, či je váš GEMINI_API_KEY v nastaveniach správny.";
      } else if (isSafety) {
        type = 'SAFETY_BLOCK';
        userMessage = "Odpoveď bola zablokovaná bezpečnostnými filtrami Google AI. Skúste preformulovať svoju požiadavku.";
      } else if (message.includes('fetch') || message.includes('network')) {
        type = 'NETWORK_ERROR';
        userMessage = "Chyba pripojenia. Skontrolujte svoje internetové pripojenie.";
      }

      const apiError: ApiError = {
        type,
        message: userMessage,
        originalError: error
      };

      throw apiError;
    }
  }
  
  throw lastError;
}
