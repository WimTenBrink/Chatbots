import { GoogleGenAI, GenerateContentParameters, Content, Type } from "@google/genai";
import { AppSettings, BotProfile, LogEntry, LogLevel } from "../types";
import { generateImageForChat } from "./imagenService";

interface OrchestrationResult {
    participant: {
        id: string;
        reasoning: string;
    };
    image_request: {
        should_generate: boolean;
        prompt: string;
        reasoning: string;
    }
}

// Result from a single bot's response generation
export interface BotResponse {
    bot: BotProfile;
    response: string;
    imageUrl?: string;
    groundingChunks?: any[];
}

// The main orchestration function
export async function orchestrateGroupChat(
    settings: AppSettings,
    bots: BotProfile[],
    userInput: string,
    history: Content[],
    addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void
): Promise<BotResponse[]> {

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

    // Step 1: Orchestrator call to decide who speaks
    const botSummaries = bots.map(b => `ID: "${b.id}", Name: ${b.firstName} ${b.lastName}, Speciality: ${b.speciality}`).join('\n');
    const orchestratorSystemInstruction = `You are the orchestrator of a group chat with AI assistants. Your role is to decide which assistant is best suited to respond to the user's query.
You must also decide if an image should be generated based on the user's prompt.
Respond in JSON format according to the provided schema. Only select one participant.

Available assistants:
${botSummaries}`;

    const orchestratorPrompt = `
Conversation History:
${history.map(h => `${h.role}: ${h.parts.map(p => p.text).join(' ')}`).join('\n')}

User's latest message: "${userInput}"

Based on the user's message, the history, and the assistants' specialities, who should respond next? And should an image be generated?`;

    const orchestratorRequest: GenerateContentParameters = {
        model: settings.geminiModel,
        contents: [{ role: 'user', parts: [{ text: orchestratorPrompt }] }],
        config: {
            systemInstruction: orchestratorSystemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    participant: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: 'The ID of the bot that should respond.' },
                            reasoning: { type: Type.STRING, description: 'Brief reasoning for selecting this bot.' }
                        },
                        required: ['id', 'reasoning']
                    },
                    image_request: {
                        type: Type.OBJECT,
                        properties: {
                            should_generate: { type: Type.BOOLEAN, description: 'Whether an image should be generated.' },
                            prompt: { type: Type.STRING, description: 'A detailed prompt for the image generation model if an image is needed. Empty string otherwise.' },
                            reasoning: { type: Type.STRING, description: 'Brief reasoning for generating (or not generating) an image.' }
                        },
                        required: ['should_generate', 'prompt', 'reasoning']
                    }
                }
            }
        },
    };

    addLog({ level: LogLevel.GEMINI_REQUEST, title: "Orchestrator Request", details: orchestratorRequest });
    
    let orchestratorResult: OrchestrationResult;
    try {
        const response = await ai.models.generateContent(orchestratorRequest);
        addLog({ level: LogLevel.GEMINI_RESPONSE, title: "Orchestrator Response", details: response });
        orchestratorResult = JSON.parse(response.text);
    } catch (error: any) {
        addLog({ level: LogLevel.ERROR, title: "Orchestrator Failed", details: { error: error.message } });
        // Fallback: pick the first bot
        const fallbackBot = bots[0];
        orchestratorResult = {
            participant: { id: fallbackBot.id, reasoning: 'Fallback due to orchestrator error.' },
            image_request: { should_generate: false, prompt: '', reasoning: 'Fallback due to orchestrator error.' }
        };
    }

    const selectedBot = bots.find(b => b.id === orchestratorResult.participant.id);
    if (!selectedBot) {
        throw new Error(`Orchestrator selected an invalid bot ID: ${orchestratorResult.participant.id}`);
    }

    // Step 2: Generate response from the selected bot
    const botSystemInstruction = `You are a helpful AI assistant.
Your persona:
${selectedBot.biography}
---
Engage in the conversation naturally. Adhere to your persona. Do not refer to game mechanics or GURPS.
Your response should be in Markdown format.`;

    const botRequest: GenerateContentParameters = {
        model: settings.geminiModel,
        contents: [...history, { role: 'user', parts: [{ text: userInput }] }],
        config: {
            systemInstruction: botSystemInstruction,
            tools: [{ googleSearch: {} }] // Enable Google Search grounding
        },
    };

    addLog({ level: LogLevel.GEMINI_REQUEST, title: `Bot Request: ${selectedBot.firstName}`, details: botRequest });
    const botGenResponse = await ai.models.generateContent(botRequest);
    addLog({ level: LogLevel.GEMINI_RESPONSE, title: `Bot Response: ${selectedBot.firstName}`, details: botGenResponse });

    const botTextResponse = botGenResponse.text;
    const groundingChunks = botGenResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    // Step 3: Generate image if requested
    let imageUrl: string | undefined = undefined;
    if (orchestratorResult.image_request.should_generate && orchestratorResult.image_request.prompt) {
       imageUrl = await generateImageForChat(settings, orchestratorResult.image_request.prompt, addLog);
    }

    const finalResponse: BotResponse = {
        bot: selectedBot,
        response: botTextResponse,
        imageUrl: imageUrl,
        groundingChunks: groundingChunks,
    };
    
    return [finalResponse];
}
