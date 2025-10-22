import { GoogleGenAI, GenerateContentResponse, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AppSettings, BotProfile, LogEntry, LogLevel } from "../types";

let ai: GoogleGenAI | null = null;

const getAi = () => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set. Please select a key.");
    }
    // Create a new instance every time to ensure the latest key is used.
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai;
};

type LogCallback = (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;

// Define safety settings to be disabled for all Gemini calls
const geminiSafetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];


const botSelectionSchema = {
    type: Type.OBJECT,
    properties: {
        bots: {
            type: Type.ARRAY,
            description: "Array of up to 5 bot IDs that are most suitable to answer the user's question.",
            items: { type: Type.STRING },
        },
    },
    required: ['bots'],
};

const imageGenerationDecisionSchema = {
    type: Type.OBJECT,
    properties: {
        generate: {
            type: Type.BOOLEAN,
            description: "True if an image would significantly enhance the conversation, false otherwise."
        },
        prompt: {
            type: Type.STRING,
            description: "A detailed, creative prompt for generating the image, based on the conversation."
        }
    },
    required: ['generate', 'prompt']
};

export const orchestrateGroupChat = async (
    settings: AppSettings,
    allBots: BotProfile[],
    userMessage: string,
    messageHistory: { role: 'user' | 'model', parts: { text: string }[] }[],
    log: LogCallback
): Promise<Array<{ bot: BotProfile, response: string, imageUrl?: string }>> => {
    const ai = getAi();
    log({ level: LogLevel.INFO, title: 'Starting group chat orchestration', details: { userMessage } });

    // Step 1: Select the most relevant bots
    const botProfilesForSelection = allBots.map(b => `ID: ${b.id}, Name: ${b.firstName} ${b.lastName}, Speciality: ${b.speciality}`).join('\n');
    const selectionPrompt = `
        Based on the following user query and the list of available bots, select up to 5 bots that are best suited to provide a comprehensive answer.
        Return only the JSON object with the array of bot IDs.

        USER QUERY: "${userMessage}"

        AVAILABLE BOTS:
        ${botProfilesForSelection}
    `;

    let selectedBotIds: string[] = [];
    try {
        const selectionRequest = {
            model: settings.geminiModel,
            contents: selectionPrompt,
            config: { responseMimeType: 'application/json', responseSchema: botSelectionSchema },
            safetySettings: geminiSafetySettings,
        };
        log({ level: LogLevel.GEMINI_REQUEST, title: 'Requesting bot selection', details: selectionRequest });
        const selectionResult = await ai.models.generateContent(selectionRequest);
        log({ level: LogLevel.GEMINI_RESPONSE, title: 'Received bot selection', details: selectionResult });
        
        const parsedSelection = JSON.parse(selectionResult.text);
        selectedBotIds = parsedSelection.bots;
    } catch (error: any) {
        log({ level: LogLevel.ERROR, title: 'Failed to select bots', details: { error: error.message, stack: error.stack } });
        // Fallback to a default bot if selection fails
        selectedBotIds = [allBots[0].id];
    }
    
    const selectedBots = allBots.filter(b => selectedBotIds.includes(b.id));
    if (selectedBots.length === 0) {
        selectedBots.push(allBots[0]); // Ensure at least one bot responds
    }
    log({ level: LogLevel.INFO, title: 'Selected bots for response', details: { botIds: selectedBots.map(b => b.id) } });

    // Step 2: Generate chained responses from each bot
    const conversationResponses: Array<{ bot: BotProfile, response: string }> = [];
    let currentConversationHistory = `The user asks: "${userMessage}"`;

    for (const bot of selectedBots) {
        const responsePrompt = `
            You are ${bot.firstName} ${bot.lastName}, a ${bot.speciality}.
            Your personality is defined by your GURPS profile: ${JSON.stringify(bot, null, 2)}
            
            Given the ongoing conversation, provide a concise and helpful response in character.
            Speak in Dutch or English, depending on the user's language.
            Your response should build upon the previous answers if any. Do not repeat what others have said.
            
            CONVERSATION SO FAR:
            ${currentConversationHistory}

            Your response:
        `;
        
        try {
            const responseRequest = { 
                model: settings.geminiModel, 
                contents: responsePrompt,
                safetySettings: geminiSafetySettings 
            };
            log({ level: LogLevel.GEMINI_REQUEST, title: `Requesting response from ${bot.firstName}`, details: responseRequest });
            const responseResult = await ai.models.generateContent(responseRequest);
            const botResponse = responseResult.text;
            log({ level: LogLevel.GEMINI_RESPONSE, title: `Received response from ${bot.firstName}`, details: { response: botResponse } });

            conversationResponses.push({ bot, response: botResponse });
            currentConversationHistory += `\n\n${bot.firstName} says: "${botResponse}"`;

        } catch (error: any) {
            log({ level: LogLevel.ERROR, title: `Failed to get response from ${bot.firstName}`, details: { error: error.message, stack: error.stack } });
            conversationResponses.push({ bot, response: "(An error occurred and I was unable to respond.)" });
        }
    }

    // Step 3: Decide if an image should be generated for the final response
    let finalImageUrl: string | undefined = undefined;
    const imageDecisionPrompt = `
        Based on the complete conversation, would an image significantly enhance the final answer?
        Consider if the topic is visual, complex, or could be better explained with a diagram, photo, or artistic representation.
        If yes, provide a detailed, creative prompt for generating the image.
        
        CONVERSATION:
        ${currentConversationHistory}
    `;

    try {
        const imageDecisionRequest = {
            model: settings.geminiModel,
            contents: imageDecisionPrompt,
            config: { responseMimeType: 'application/json', responseSchema: imageGenerationDecisionSchema },
            safetySettings: geminiSafetySettings,
        };
        log({ level: LogLevel.GEMINI_REQUEST, title: 'Requesting image generation decision', details: imageDecisionRequest });
        const imageDecisionResult = await ai.models.generateContent(imageDecisionRequest);
        log({ level: LogLevel.GEMINI_RESPONSE, title: 'Received image generation decision', details: imageDecisionResult });

        const parsedDecision = JSON.parse(imageDecisionResult.text);
        if (parsedDecision.generate && parsedDecision.prompt) {
            log({ level: LogLevel.INFO, title: 'Decision: Generate image', details: { prompt: parsedDecision.prompt } });
            finalImageUrl = await generateImage(settings, parsedDecision.prompt, log);
        } else {
             log({ level: LogLevel.INFO, title: 'Decision: Do not generate image', details: {} });
        }

    } catch (error: any) {
         log({ level: LogLevel.ERROR, title: 'Failed to make image generation decision', details: { error: error.message, stack: error.stack } });
    }

    // Attach image to the final response
    if (finalImageUrl && conversationResponses.length > 0) {
        const lastResponse = conversationResponses[conversationResponses.length - 1];
        (lastResponse as any).imageUrl = finalImageUrl;
    }

    return conversationResponses;
};


// Generic image generation function
const generateImage = async (settings: AppSettings, prompt: string, log: LogCallback): Promise<string> => {
    // FIX: Removed `safetySetting: 'BLOCK_NONE'` from this config object as it's not a valid parameter for `generateImages` according to the provided guidelines.
    const request = {
        model: settings.imagenModel,
        prompt: prompt,
        config: { 
            numberOfImages: 1, 
            outputMimeType: 'image/png' as const, 
            aspectRatio: '1:1' as const,
        },
    };
    log({ level: LogLevel.IMAGEN_REQUEST, title: `Generate Image`, details: request });
    
    try {
        const ai = getAi();
        const response = await ai.models.generateImages(request);
        log({ level: LogLevel.IMAGEN_RESPONSE, title: "Imagen Response", details: { success: true } });

        if (response.generatedImages && response.generatedImages.length > 0) {
            return `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
        } else {
            throw new Error("No image generated");
        }
    } catch (error: any) {
        log({ level: LogLevel.ERROR, title: "Imagen API Error", details: { error: error.message, stack: error.stack } });
        throw error;
    }
};

export const generateProfileImageBase64 = async (settings: AppSettings, prompt: string, log: LogCallback): Promise<string> => {
    // FIX: Removed `safetySetting: 'BLOCK_NONE'` from this config object as it's not a valid parameter for `generateImages` according to the provided guidelines.
    const request = {
        model: settings.imagenModel,
        prompt,
        config: { 
            numberOfImages: 1, 
            outputMimeType: 'image/png', 
            aspectRatio: '1:1' as const,
        },
    };
    log({ level: LogLevel.IMAGEN_REQUEST, title: `Generate Avatar`, details: request });
     try {
        const ai = getAi();
        const response = await ai.models.generateImages(request);
        log({ level: LogLevel.IMAGEN_RESPONSE, title: "Imagen Response", details: { success: true } });
        return response.generatedImages[0].image.imageBytes;
    } catch (error: any) {
        log({ level: LogLevel.ERROR, title: `Failed to generate avatar`, details: { error: error.message, stack: error.stack } });
        throw error;
    }
};

export const generateBikiniImageBase64 = async (settings: AppSettings, prompt: string, log: LogCallback): Promise<string> => {
    // FIX: Removed `safetySetting: 'BLOCK_NONE'` from this config object as it's not a valid parameter for `generateImages` according to the provided guidelines.
    const request = {
        model: settings.imagenModel,
        prompt,
        config: { 
            numberOfImages: 1, 
            outputMimeType: 'image/png', 
            aspectRatio: '9:16' as const,
        },
    };
     log({ level: LogLevel.IMAGEN_REQUEST, title: `Generate Bikini Image`, details: request });
     try {
        const ai = getAi();
        const response = await ai.models.generateImages(request);
        log({ level: LogLevel.IMAGEN_RESPONSE, title: "Imagen Response", details: { success: true } });
        return response.generatedImages[0].image.imageBytes;
    } catch (error: any) {
        log({ level: LogLevel.ERROR, title: `Failed to generate bikini image`, details: { error: error.message, stack: error.stack } });
        throw error;
    }
};