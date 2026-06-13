import { GoogleGenAI, Type } from "@google/genai";
import { AIPatternResponse, BreathingPattern, BreathPhase } from "../types";

let aiInstance: GoogleGenAI | null = null;

const getAiInstance = (): GoogleGenAI => {
  if (!aiInstance) {
    const apiKey = process.env.API_KEY || '';
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const generateBreathingPattern = async (feeling: string): Promise<BreathingPattern | null> => {
  const apiKey = process.env.API_KEY || '';
  if (!apiKey) {
    console.error("API Key missing");
    return null;
  }

  try {
    const ai = getAiInstance();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `User is feeling: "${feeling}". Suggest a breathing pattern (inhale, hold, exhale, hold-out durations in seconds) to help them. Give it a creative name in Russian.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patternName: { type: Type.STRING, description: "Name of the pattern in Russian" },
            reasoning: { type: Type.STRING, description: "Short explanation why this helps in Russian" },
            inhaleSeconds: { type: Type.INTEGER, description: "Duration of inhale in seconds" },
            holdInSeconds: { type: Type.INTEGER, description: "Duration of holding breath after inhale" },
            exhaleSeconds: { type: Type.INTEGER, description: "Duration of exhale in seconds" },
            holdOutSeconds: { type: Type.INTEGER, description: "Duration of holding breath after exhale" },
          },
          required: ["patternName", "reasoning", "inhaleSeconds", "holdInSeconds", "exhaleSeconds", "holdOutSeconds"],
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as AIPatternResponse;
      
      // Map to new structure
      const steps = [];
      if (data.inhaleSeconds > 0) steps.push({ type: BreathPhase.INHALE, duration: data.inhaleSeconds });
      if (data.holdInSeconds > 0) steps.push({ type: BreathPhase.HOLD, duration: data.holdInSeconds });
      if (data.exhaleSeconds > 0) steps.push({ type: BreathPhase.EXHALE, duration: data.exhaleSeconds });
      if (data.holdOutSeconds > 0) steps.push({ type: BreathPhase.HOLD, duration: data.holdOutSeconds });

      return {
          id: crypto.randomUUID(),
          name: data.patternName,
          description: data.reasoning,
          steps: steps,
          adjustmentPerCycle: 0,
          minCycleDuration: 4,
          maxCycleDuration: 60
      };
    }
    return null;

  } catch (error) {
    console.error("Error generating pattern:", error);
    return null;
  }
};