import { getAI, handleAiError } from "./aiService";
import { safeStringify } from "../utils/safeJson";

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const sendMessage = async (message: string, history: ChatMessage[] = [], context: any = {}) => {
  try {
    const ai = getAI();
    const systemInstruction = `You are the primary Aviation Intelligence Assistant for the "SkyLink" platform. 
Your goal is to help users with flight planning, aircraft selection, ACMI leasing, and technical operational queries.

Current Application State (Context):
${safeStringify(context)}

Capabilities:
1. Route Optimization: Suggest better routes, stopovers, or alternatives based on the context.
2. Aircraft Matching: Analyze passengers/cargo in the form and suggest suitable aircraft from the fleet.
3. Cost Analysis: Explain costs (fees, fuel, handling) provided in the context.
4. ACMI Expertise: Explain lease terms, MGH, and operator details.
5. Technical Specs: Speak confidently about aircraft specs (range, MTOW, runway req).

Personalization Guidelines:
- If context contains "formData", "aiPlan", or "acmiQuote", refer to those specific details (e.g., "I see you're planning a trip from ${context.formData?.departure || 'somewhere'}...").
- Use the user's specific aircraft choice or suggested aircraft to answer technical questions.
- If the user asks about "my flight", look into the "aiPlan" or "formData" in the context.
- Be professional, technical (using aviation terms where appropriate), yet helpful to non-experts.
- If you notice a risk in the current plan (e.g., distance > aircraft range), proactively mention it politely.`;

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
