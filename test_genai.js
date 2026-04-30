import { GoogleGenAI } from '@google/genai';

async function test() {
  try {
    const ai = new GoogleGenAI({}); // Let it pick up from env if it exists
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Say hello'
    });
    console.log("Response:", response.text);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
