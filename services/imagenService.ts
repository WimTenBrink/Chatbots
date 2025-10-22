import { GoogleGenAI } from "@google/genai";
import { AppSettings, BotProfile, LogEntry, LogLevel } from "../types";

export async function generateImageForChat(
    settings: AppSettings,
    prompt: string,
    addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void
): Promise<string | undefined> {
    if (!prompt) return undefined;
    
    // This function is for orchestration, which is a 'chat' context.
    return generateImageFromPrompt(settings, prompt, '1:1', addLog);
}

export async function generateImageFromPrompt(
    settings: AppSettings,
    prompt: string,
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9',
    addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void
): Promise<string | undefined> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const enhancedPrompt = prompt.toLowerCase().includes('dark') 
        ? prompt 
        : `${prompt}, professional lighting, cinematic quality`;

    const imageRequest = {
        model: settings.imagenModel,
        prompt: enhancedPrompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: aspectRatio,
        },
    };

    addLog({ level: LogLevel.IMAGEN_REQUEST, title: `Imagen Request (Chat)`, details: imageRequest });
    try {
        const imageResponse = await ai.models.generateImages(imageRequest);
        addLog({ level: LogLevel.IMAGEN_RESPONSE, title: `Imagen Response (Chat)`, details: imageResponse });

        if (imageResponse.generatedImages && imageResponse.generatedImages.length > 0) {
            const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/png;base64,${base64ImageBytes}`;

            const a = document.createElement("a");
            a.href = imageUrl;
            a.download = `${crypto.randomUUID()}-chat.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            return imageUrl;
        }
    } catch (error: any) {
        addLog({ level: LogLevel.ERROR, title: "Imagen Failed (Chat)", details: { error: error.message } });
        throw error;
    }
    return undefined;
}


export async function generateCharacterImage(
    settings: AppSettings,
    bot: BotProfile,
    imageType: 'avatar' | 'bikini',
    addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void
): Promise<void> {
    const prompt = bot[imageType];
    if (!prompt) {
        const error = new Error(`Prompt for type '${imageType}' not found on bot profile.`);
        addLog({ level: LogLevel.ERROR, title: `Image Gen Failed: ${bot.firstName}`, details: { step: 'Get Prompt', error: error.message } });
        throw error;
    }

    const aspectRatio = imageType === 'avatar' ? '1:1' : '9:16';
    const fileName = `${bot.id}-${imageType}.png`;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const enhancedPrompt = prompt.toLowerCase().includes('dark') 
        ? prompt 
        : `${prompt}, professional lighting, cinematic quality`;

    const imageRequest = {
        model: settings.imagenModel,
        prompt: enhancedPrompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: aspectRatio as any,
        },
    };

    addLog({ level: LogLevel.IMAGEN_REQUEST, title: `Imagen Request: ${bot.firstName} ${imageType}`, details: imageRequest });
    try {
        const imageResponse = await ai.models.generateImages(imageRequest);
        addLog({ level: LogLevel.IMAGEN_RESPONSE, title: `Imagen Response: ${bot.firstName} ${imageType}`, details: imageResponse });

        if (imageResponse.generatedImages && imageResponse.generatedImages.length > 0) {
            const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/png;base64,${base64ImageBytes}`;

            const a = document.createElement("a");
            a.href = imageUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            throw new Error("API returned no images.");
        }
    } catch (error: any) {
        addLog({ level: LogLevel.ERROR, title: `Imagen Gen Failed: ${bot.firstName}`, details: { step: 'API Call', error: error.message } });
        throw error;
    }
}
