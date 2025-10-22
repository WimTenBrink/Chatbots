import { GoogleGenAI } from "@google/genai";
import { AppSettings, BotProfile, LogEntry, LogLevel } from "../types";

async function pollAndDownloadVideo(
    operationInitial: any,
    fileName: string,
    addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void,
    setStatus: (status: string) => void
) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    let operation = operationInitial;

    addLog({ level: LogLevel.GEMINI_RESPONSE, title: `Video Gen Initial Response`, details: operation });
        
    setStatus("Video generation in progress... this may take several minutes.");
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
        operation = await ai.operations.getVideosOperation({ operation: operation });
        addLog({ level: LogLevel.INFO, title: `Polling video status`, details: operation });
    }

    if (operation.error) {
        // FIX: Cast operation.error.message to string to satisfy Error constructor.
        throw new Error(String(operation.error.message));
    }

    setStatus("Video generated! Downloading...");
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation succeeded but no download link was provided.");
    }

    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
    }
    
    const videoBlob = await response.blob();
    const url = window.URL.createObjectURL(videoBlob);
    
    // Auto-download file for all videos
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    return url;
}

export async function generateVideoFromPrompt(
    settings: AppSettings,
    prompt: string,
    resolution: '720p' | '1080p',
    addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void,
    setStatus: (status: string) => void
): Promise<string | undefined> {
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

    // Enhance prompt for better lighting
    const enhancedPrompt = prompt.toLowerCase().includes('dark')
        ? prompt
        : `${prompt}, cinematic lighting, professional quality`;

    const videoRequest = {
        model: 'veo-3.1-fast-generate-preview' as const,
        prompt: enhancedPrompt,
        config: {
            numberOfVideos: 1,
            resolution,
            aspectRatio: '16:9' as const,
        }
    };
    addLog({ level: LogLevel.GEMINI_REQUEST, title: `Video Gen Request`, details: videoRequest });
    
    try {
        setStatus("Sending request to generate video...");
        const operation = await ai.models.generateVideos(videoRequest);
        const videoUrl = await pollAndDownloadVideo(operation, `${crypto.randomUUID()}-chat.mp4`, addLog, setStatus);
        setStatus("Download complete!");
        return videoUrl;
    } catch (error: any) {
        setStatus(`Error: ${error.message}`);
        addLog({ level: LogLevel.ERROR, title: `Video Gen Failed`, details: { error: error.message, stack: error.stack } });
        throw error;
    }
}

export async function generateCharacterVideo(
    settings: AppSettings,
    bot: BotProfile,
    addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void,
    setStatus: (status: string) => void
): Promise<void> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

    const effectiveAge = Math.max(18, bot.physical.age);
    const prompt = `A photorealistic video of ${bot.firstName}, a ${effectiveAge}-year-old Dutch woman with ${bot.physical.facial.hairColor} hair and ${bot.physical.facial.eyeColor} eyes, dancing barefoot in a simple white bikini on a beautiful, serene beach at golden hour. Her physical build is defined by height ${bot.physical.height}, weight ${bot.physical.weight}. The video should be tasteful and artistic, with cinematic lighting.`;

    const videoRequest = {
        model: 'veo-3.1-fast-generate-preview' as const,
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p' as const,
            aspectRatio: '16:9' as const,
        }
    };

    addLog({ level: LogLevel.GEMINI_REQUEST, title: `Video Gen Request: ${bot.firstName}`, details: videoRequest });

    try {
        setStatus("Sending request to generate video...");
        const operation = await ai.models.generateVideos(videoRequest);
        await pollAndDownloadVideo(operation, `${bot.id}.mp4`, addLog, setStatus);
        setStatus("Download complete!");
    } catch (error: any) {
        setStatus(`Error: ${error.message}`);
        addLog({ level: LogLevel.ERROR, title: `Video Gen Failed: ${bot.firstName}`, details: { error: error.message, stack: error.stack } });
        throw error;
    }
}