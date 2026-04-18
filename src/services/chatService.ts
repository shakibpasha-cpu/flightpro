import { getAI, handleAiError } from "./aiService";

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const sendMessage = async (message: string, history: ChatMessage[] = [], context: any = {}) => {
  try {
    const ai = getAI();
    const systemInstruction = `You are an expert Aviation Assistant for the "SkyLink ACMI & Charter" platform. 
Your goal is to help users plan private jet charters, ACMI (Aircraft, Crew, Maintenance, and Insurance) leases, and complex flight routes.

Current Application Context:
${JSON.stringify(context, null, 2)}

Capabilities:
1. Explain flight costs (landing fees, handling, fuel, overflight).
2. Suggest optimal aircraft for specific passenger counts or ranges.
3. Help with route planning and stopover suggestions.
4. Explain aviation terms (ACMI, FIR, ICAO, IATA, etc.).

Guidelines:
- Be professional, concise, and helpful.
- Use the provided context to give specific advice about the user's current flight plan.
- If the user asks to "optimize" or "change" something, explain how they can do it using the map or form.
- Do not make up data if it's not in the context; instead, offer to help them find it.`;

    const contents = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text;
  } catch (error) {
    handleAiError(error, 'sendMessage');
    return "I'm sorry, I'm having trouble connecting to my aviation intelligence engine right now. Please try again in a moment.";
  }
};
