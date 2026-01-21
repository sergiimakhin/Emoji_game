
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface LevelHint {
  strategy: string;
  motivationalMessage: string;
}

export const getLevelHint = async (level: number, objective: string): Promise<LevelHint | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The player is on Level ${level} of an Emoji Bubble Shooter. The goal is: ${objective}. Provide a short strategic tip and a supportive message.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            strategy: { type: Type.STRING },
            motivationalMessage: { type: Type.STRING }
          },
          required: ["strategy", "motivationalMessage"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    return null;
  } catch (error) {
    console.error("Gemini hint generation failed", error);
    return null;
  }
};
