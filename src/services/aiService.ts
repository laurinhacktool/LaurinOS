import { GoogleGenAI } from "@google/genai";

export interface AIConfig {
  preferred_provider: 'gemini' | 'ollama' | 'custom';
  gemini_api_key?: string;
  custom_api_url?: string;
  custom_api_key?: string;
  custom_model?: string;
}

export class AIService {
  private static config: AIConfig | null = null;

  static async fetchConfig(): Promise<AIConfig> {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      this.config = data;
      return data;
    } catch (err) {
      console.error("Failed to load AI config:", err);
      return { preferred_provider: 'gemini' };
    }
  }

  static async generateResponse(prompt: string, systemInstruction?: string): Promise<string> {
    const config = this.config || await this.fetchConfig();

    if (config.preferred_provider === 'gemini') {
      return this.generateGemini(prompt, systemInstruction, config.gemini_api_key);
    } else if (config.preferred_provider === 'ollama') {
      return this.generateOllama(prompt, systemInstruction, config.custom_api_url, config.custom_model);
    } else {
      return this.generateCustom(prompt, systemInstruction, config.custom_api_url, config.custom_api_key, config.custom_model);
    }
  }

  private static async generateGemini(prompt: string, systemInstruction?: string, apiKey?: string): Promise<string> {
    // Note: In development, we use the server-side injected key if available
    const key = apiKey || ""; 
    if (!key) throw new Error("Gemini API kľúč nie je nastavený.");

    const ai = new GoogleGenAI({ apiKey: key });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction || undefined
      }
    });

    return response.text || "";
  }

  private static async generateOllama(prompt: string, systemInstruction?: string, url?: string, modelName?: string): Promise<string> {
    const ollamaUrl = url || "http://localhost:11434";
    const model = modelName || "llama3";
    
    // Formátovanie promptu pre Ollama (možno upraviť podľa modelu)
    const fullPrompt = systemInstruction ? `${systemInstruction}\n\nUser: ${prompt}` : prompt;

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: fullPrompt,
        stream: false
      })
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    const data = await response.json();
    return data.response;
  }

  private static async generateCustom(prompt: string, systemInstruction?: string, url?: string, apiKey?: string, modelName?: string): Promise<string> {
    if (!url) throw new Error("Custom API URL nie je nastavená.");
    
    // Predpokladáme OpenAI-kompatibilné API
    const response = await fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey || ""}`
      },
      body: JSON.stringify({
        model: modelName || "gpt-3.5-turbo",
        messages: [
          ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) throw new Error(`Custom API error: ${response.statusText}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
