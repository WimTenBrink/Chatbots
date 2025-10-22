
// Fix: Reconstructed App.tsx into a complete React component to resolve module errors and undefined variable issues.
import React, { useState, useEffect, useRef, useCallback } from 'react';
// FIX: Import AIStudio from types.ts to resolve declaration conflict.
// FIX: Removed direct import of AIStudio to resolve global declaration conflict.
import { AppSettings, BotProfile, ChatMessage as ChatMessageType, LogEntry, LogLevel, MessageAuthor, Team } from './types';
import { orchestrateGroupChat } from './services/geminiService';
import { generateImageFromPrompt } from './services/imagenService';
import { generateVideoFromPrompt } from './services/videoService';
import { DEFAULT_SETTINGS } from './constants';
import { SettingsIcon, TerminalIcon, UsersIcon, TeamIcon, SendIcon, SpinnerIcon, DocumentDownloadIcon, PhotoIcon, VideoCameraIcon } from './components/icons';
import { SettingsDialog } from './components/SettingsDialog';
import { ConsoleDialog } from './components/ConsoleDialog';
import { ChatMessage } from './components/ChatMessage';
import { CharactersDialog } from './components/CharactersDialog';
import { TeamsDialog } from './components/TeamsDialog';
import { GenerationDialog } from './components/GenerationDialog';

// Mock AI Studio API for key selection
// FIX: Using a named interface `AIStudio` to resolve type conflict errors for `window.aistudio`.
// The AIStudio interface has been moved to types.ts to avoid declaration conflicts.

// FIX: Removed global declaration for window.aistudio. This is now handled in types.ts
// to prevent type collision errors.

const App: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [messages, setMessages] = useState<ChatMessageType[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [bots, setBots] = useState<BotProfile[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    const [isCharactersOpen, setIsCharactersOpen] = useState(false);
    const [isTeamsOpen, setIsTeamsOpen] = useState(false);
    const [isGenerationOpen, setIsGenerationOpen] = useState(false);
    const [generationType, setGenerationType] = useState<'image' | 'video'>('image');

    const [isApiKeySelected, setIsApiKeySelected] = useState(false);
    const [thinkingTime, setThinkingTime] = useState(0);
    const [loadingError, setLoadingError] = useState<string | null>(null);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const lastImagePromptRef = useRef<string>('');
    const lastVideoPromptRef = useRef<string>('');

    const addLog = useCallback((log: Omit<LogEntry, 'id' | 'timestamp'>) => {
        const newLog: LogEntry = {
            ...log,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
        };
        setLogs(prev => [...prev, newLog]);
    }, []);

    const addSystemMessage = (text: string) => {
        setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            author: MessageAuthor.SYSTEM,
            text,
        }]);
    };
    
    const addSystemError = (errorMessage: string) => {
        addSystemMessage(`Error: ${errorMessage}`);
    };

    const checkApiKey = useCallback(async () => {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
            try {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setIsApiKeySelected(hasKey);
                if (!hasKey) {
                    addLog({level: LogLevel.WARN, title: "API Key not selected", details: "User needs to select an API key through AI Studio."});
                }
            } catch (e) {
                console.error("Error checking for API key:", e);
                setIsApiKeySelected(false);
                 addLog({level: LogLevel.ERROR, title: "AI Studio check failed", details: "Could not check for API key."});
            }
        } else {
             // Fallback for when not in AI Studio environment
            const hasKey = !!process.env.API_KEY;
            setIsApiKeySelected(hasKey);
            if (!hasKey) {
                addLog({level: LogLevel.WARN, title: "API Key not available", details: "process.env.API_KEY is not set."});
                console.warn("API key not found. Please set API_KEY environment variable or run in AI Studio.")
            }
        }
    }, [addLog]);


    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoadingError(null);
                // Load Bots
                const botListRes = await fetch('/bots/bot-list.json');
                if (!botListRes.ok) throw new Error(`Failed to fetch bot list: ${botListRes.statusText}`);
                const botFilenames = await botListRes.json();
                const botPromises = botFilenames.map((filename: string) => 
                    fetch(`/bots/${filename}`).then(res => {
                        if (!res.ok) throw new Error(`Failed to fetch bot: ${filename}`);
                        return res.json();
                    })
                );
                const botsData = await Promise.all(botPromises);
                setBots(botsData);
                addLog({level: LogLevel.INFO, title: "Loaded bot profiles", details: { count: botsData.length }});
    
                // Load Teams
                const teamListRes = await fetch('/teams/team-list.json');
                if (!teamListRes.ok) throw new Error(`Failed to fetch team list: ${teamListRes.statusText}`);
                const teamFilenames = await teamListRes.json();
                const teamPromises = teamFilenames.map((filename: string) =>
                    fetch(`/teams/${filename}`).then(res => {
                        if (!res.ok) throw new Error(`Failed to fetch team: ${filename}`);
                        return res.json();
                    })
                );
                const teamsData = await Promise.all(teamPromises);
                setTeams(teamsData);
                addLog({level: LogLevel.INFO, title: "Loaded team data", details: { count: teamsData.length }});
                
                addSystemMessage('Welcome to Katje B.V. AI Chat. Profiles and teams loaded.');
    
            } catch (error: any) {
                const errorMessage = `Could not load character and team data. Please check the console. Details: ${error.message}`;
                addLog({level: LogLevel.ERROR, title: "Failed to load initial data", details: { error: error.message, stack: error.stack }});
                addSystemError(errorMessage);
                setLoadingError(errorMessage);
            }
        };

        fetchData();
        checkApiKey();
    }, [addLog, checkApiKey]);

    useEffect(() => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        let timer: number | undefined;
        if (isLoading) {
            setThinkingTime(0);
            timer = window.setInterval(() => {
                setThinkingTime(prev => prev + 1);
            }, 1000);
        } else {
            setThinkingTime(0);
        }
        return () => {
            if (timer) {
                clearInterval(timer);
            }
        };
    }, [isLoading]);
    
    const handleSelectKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            try {
                await window.aistudio.openSelectKey();
                // Assume success and optimistically update UI
                setIsApiKeySelected(true);
                addLog({level: LogLevel.INFO, title: "User opened API key selection", details: "Assuming key selection will be successful."});
            } catch (e) {
                console.error("Error opening select key dialog:", e);
                addLog({level: LogLevel.ERROR, title: "Failed to open API key dialog", details: { error: (e as Error).message }});
            }
        } else {
            alert("API Key selection is only available in the AI Studio environment.");
        }
    };

    const handleSendMessage = async () => {
        const userMessageContent = input.trim();
        if (!userMessageContent || isLoading) return;

        await checkApiKey();
        if (!isApiKeySelected) {
             // Re-check after trying to send, in case user selected key but state hasn't updated
            const hasKey = window.aistudio ? await window.aistudio.hasSelectedApiKey() : !!process.env.API_KEY;
            if(!hasKey) {
                addSystemError("Please select an API key in the settings before sending a message.");
                setIsSettingsOpen(true);
                return;
            }
            setIsApiKeySelected(true);
        }

        const newUserMessage: ChatMessageType = {
            id: crypto.randomUUID(),
            author: MessageAuthor.USER,
            text: userMessageContent,
        };
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const messageHistoryForApi = messages
                .filter(m => m.author === MessageAuthor.USER || m.author === MessageAuthor.BOT)
                .map(m => ({
                    role: m.author === MessageAuthor.USER ? 'user' as const : 'model' as const,
                    parts: [{ text: m.text }],
                }));

            const responses = await orchestrateGroupChat(settings, bots, userMessageContent, messageHistoryForApi, addLog);

            const botMessages: ChatMessageType[] = responses.map(res => ({
                id: crypto.randomUUID(),
                author: MessageAuthor.BOT,
                text: res.response,
                botProfile: res.bot,
                imageUrl: res.imageUrl,
                groundingChunks: res.groundingChunks,
            }));
            
            setMessages(prev => [...prev, ...botMessages]);

        } catch (error: any) {
            let errorMessage = "An error occurred while getting a response.";
            if (error.message && error.message.includes('Requested entity was not found')) {
                errorMessage = "API Key Error: The selected key is invalid or not found. Please try selecting a different key in settings.";
                // Reset key selection state to re-trigger the prompt
                setIsApiKeySelected(false);
            }
             if (error.message && (error.message.includes('API_KEY_HTTP_REFERRER_BLOCKED') || error.message.includes('PERMISSION_DENIED'))) {
                errorMessage = "API Key Error: This website is not authorized to use this key. Please check your API key's 'Website restrictions' in the Google Cloud Console.";
                 setIsApiKeySelected(false);
            }
            addLog({ level: LogLevel.ERROR, title: "Orchestration Failed", details: { error: error.message, stack: error.stack } });
            addSystemError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownloadChat = () => {
        const markdownContent = messages.map(msg => {
            let authorName = 'System';
            if (msg.author === MessageAuthor.USER) {
                authorName = 'You';
            } else if (msg.author === MessageAuthor.BOT) {
                authorName = msg.botProfile ? `${msg.botProfile.firstName} ${msg.botProfile.lastName}` : 'Katje AI';
            }
                
            let content = `**${authorName}:**\n\n${msg.text}`;
            
            if (msg.imageUrl) {
                content += `\n\n![Generated Image](${msg.imageUrl})`;
            }
             if (msg.videoUrl) {
                content += `\n\n[Generated Video](${msg.videoUrl})`;
            }


            if (msg.groundingChunks && msg.groundingChunks.length > 0) {
                const sources = msg.groundingChunks
                    .filter(chunk => chunk.web && chunk.web.uri)
                    .map(chunk => `- [${chunk.web.title || chunk.web.uri}](${chunk.web.uri})`)
                    .join('\n');
                if (sources) {
                    content += `\n\n**Sources:**\n${sources}`;
                }
            }
            
            return content;
        }).join('\n\n---\n\n');
        
        const a = document.createElement("a");
        const file = new Blob([markdownContent], { type: 'text/markdown' });
        a.href = URL.createObjectURL(file);
        a.download = `katje-chat-history.md`;
        a.click();
        URL.revokeObjectURL(a.href);
        addLog({level: LogLevel.INFO, title: "Chat history downloaded", details: {}});
    };

    const handleOpenGenerationDialog = (type: 'image' | 'video') => {
        setGenerationType(type);
        setIsGenerationOpen(true);
    };

    const handleGenerateMedia = async (prompt: string, botIds: string[], teamId: string | null, resolution: string) => {
        setIsGenerationOpen(false);
        setIsLoading(true);

        if (generationType === 'image') {
            lastImagePromptRef.current = prompt;
        } else {
            lastVideoPromptRef.current = prompt;
        }
    
        const botsById = Object.fromEntries(bots.map(b => [b.id, b]));
        const teamsById = Object.fromEntries(teams.map(t => [t.id, t]));
    
        let selectedBots: BotProfile[] = [];
        if (teamId && teamsById[teamId]) {
            selectedBots = teamsById[teamId].memberIds.map(id => botsById[id]).filter(Boolean);
        } else {
            selectedBots = botIds.map(id => botsById[id]).filter(Boolean);
        }
    
        const botNames = selectedBots.map(b => b.firstName).join(', ');
        const teamName = teamId ? teams.find(t => t.id === teamId)?.name : null;
        
        const subject = teamName ? `the ${teamName} team` : (botNames || '');
        
        let userRequestText = `Generate a ${generationType}.`;
        if (subject) {
            userRequestText += `\nFeaturing: ${subject}`;
        }
        userRequestText += `\nPrompt: "${prompt}"`;
        
        const newUserMessage: ChatMessageType = {
            id: crypto.randomUUID(),
            author: MessageAuthor.USER,
            text: userRequestText
        };
        setMessages(prev => [...prev, newUserMessage]);
    
        let fetchedCharacterDescriptions = '';
        if (selectedBots.length > 0) {
            try {
                const descriptions = selectedBots.map(bot => bot.prompt);
                fetchedCharacterDescriptions = descriptions.join(' ');
            } catch (error: any) {
                addSystemError(`Could not load character descriptions: ${error.message}`);
                addLog({ level: LogLevel.ERROR, title: "Failed to load character descriptions", details: { error: error.message }});
                setIsLoading(false);
                return; 
            }
        }

        let finalCharacterPromptPart = '';
        if (fetchedCharacterDescriptions) {
            const characterNames = selectedBots.map(b => b.firstName);
            let nameList = '';
            if (characterNames.length > 2) {
                nameList = characterNames.slice(0, -1).join(', ') + ', and ' + characterNames.slice(-1);
            } else if (characterNames.length === 2) {
                nameList = characterNames.join(' and ');
            } else if (characterNames.length === 1) {
                nameList = characterNames[0];
            }
        
            const characterNouns = selectedBots.length > 1 ? "The characters are" : "The character is";
            const pronoun = selectedBots.length > 1 ? "They are" : "She is";
            const attire = selectedBots.length > 1 ? "white bikinis" : "a white bikini";
            
            finalCharacterPromptPart = `The scene features ${nameList}. ${fetchedCharacterDescriptions} ${characterNouns} shown full body, head to toe. ${pronoun} barefoot, wearing anklets on both legs, and dressed in ${attire}. `;
        }
    
        const locationDescription = 'The location is a beautiful beach at noon, with the sea in the background. ';
        const finalPrompt = `${finalCharacterPromptPart}${locationDescription}Scene: ${prompt}`;
    
        try {
            if (generationType === 'image') {
                const imageUrl = await generateImageFromPrompt(settings, finalPrompt, resolution as any, addLog);
                 if (imageUrl) {
                    const newImageMessage: ChatMessageType = {
                        id: crypto.randomUUID(),
                        author: MessageAuthor.BOT,
                        text: `Generated image for prompt: "${prompt}"`,
                        imageUrl: imageUrl,
                    };
                    setMessages(prev => [...prev, newImageMessage]);
                }
            } else { // generationType === 'video'
                const videoUrl = await generateVideoFromPrompt(settings, finalPrompt, resolution as '720p' | '1080p', addLog, (status) => addSystemMessage(status));
                if (videoUrl) {
                    const newVideoMessage: ChatMessageType = {
                        id: crypto.randomUUID(),
                        author: MessageAuthor.BOT,
                        text: `Generated video for prompt: "${prompt}"`,
                        videoUrl: videoUrl,
                    };
                    setMessages(prev => [...prev, newVideoMessage]);
                }
            }
        } catch (error: any) {
             let errorMessage = "An error occurred while generating media.";
            if (error.message && error.message.includes('Requested entity was not found')) {
                errorMessage = "API Key Error: The selected key is invalid or not found. Please try selecting a different key in settings.";
                setIsApiKeySelected(false);
            }
             if (error.message && (error.message.includes('API_KEY_HTTP_REFERRER_BLOCKED') || error.message.includes('PERMISSION_DENIED'))) {
                errorMessage = "API Key Error: This website is not authorized to use this key. Please check your API key's 'Website restrictions' in the Google Cloud Console.";
                 setIsApiKeySelected(false);
            }
            addLog({ level: LogLevel.ERROR, title: `Failed to generate ${generationType}`, details: { error: error.message, stack: error.stack } });
            addSystemError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="flex flex-col h-screen bg-slate-900 text-white font-sans">
            <header className="flex-shrink-0 flex items-center justify-between p-3 border-b border-slate-700 shadow-md">
                <div className="flex items-center gap-2">
                    <img src="/katje-logo.svg" alt="Katje B.V. Logo" className="h-8" />
                    <h1 className="text-xl font-bold text-sky-300">Katje AI Chat</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleDownloadChat} title="Download Chat History" className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700">
                        <DocumentDownloadIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsCharactersOpen(true)} title="View Characters" className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700">
                        <UsersIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsTeamsOpen(true)} title="View Teams" className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700">
                        <TeamIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsConsoleOpen(true)} title="Open Console" className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700">
                        <TerminalIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsSettingsOpen(true)} title="Settings" className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700">
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                </div>
            </header>
            
            <main ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto">
                {loadingError && (
                    <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative mb-4" role="alert">
                        <strong className="font-bold">Loading Failed: </strong>
                        <span className="block sm:inline">{loadingError}</span>
                    </div>
                )}
                {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
            </main>

            {isLoading && (
                <div className="flex-shrink-0 px-4 pb-2 flex items-center gap-2 text-sm text-sky-300">
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    <span>Katje is thinking... ({thinkingTime}s)</span>
                </div>
            )}

            <footer className="flex-shrink-0 p-4 border-t border-slate-700">
                <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg">
                    <button onClick={() => handleOpenGenerationDialog('image')} title="Generate Image" className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-700 transition-colors">
                        <PhotoIcon className="w-5 h-5" />
                    </button>
                     <button onClick={() => handleOpenGenerationDialog('video')} title="Generate Video" className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-700 transition-colors">
                        <VideoCameraIcon className="w-5 h-5" />
                    </button>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey ? (e.preventDefault(), handleSendMessage()) : null}
                        placeholder={isApiKeySelected ? "Ask a question..." : "Please select an API key in settings..."}
                        className="w-full bg-transparent p-2 focus:outline-none text-slate-200 placeholder-slate-500"
                        disabled={isLoading || !isApiKeySelected}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={isLoading || !input.trim() || !isApiKeySelected}
                        className="p-2 rounded-full bg-sky-600 text-white hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        <SendIcon className="w-5 h-5" />
                    </button>
                </div>
                 <p className="text-xs text-center text-slate-600 mt-2">
                    &copy; {new Date().getFullYear()} Katje B.V. - Knowledge And Technology Joyfully Engaged
                </p>
            </footer>

            <SettingsDialog 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                settings={settings} 
                onSettingsChange={setSettings} 
                onSelectKey={handleSelectKey}
            />
            <ConsoleDialog 
                isOpen={isConsoleOpen} 
                onClose={() => setIsConsoleOpen(false)} 
                logs={logs}
            />
            {bots.length > 0 && teams.length > 0 && (
              <>
                <CharactersDialog 
                    isOpen={isCharactersOpen} 
                    onClose={() => setIsCharactersOpen(false)} 
                    bots={bots} 
                    settings={settings}
                    addLog={addLog}
                    onSelectKey={handleSelectKey}
                />
                <TeamsDialog 
                    isOpen={isTeamsOpen} 
                    onClose={() => setIsTeamsOpen(false)} 
                    bots={bots}
                    teams={teams}
                />
                <GenerationDialog
                    isOpen={isGenerationOpen}
                    onClose={() => setIsGenerationOpen(false)}
                    generationType={generationType}
                    bots={bots}
                    teams={teams}
                    onSubmit={handleGenerateMedia}
                    lastImagePrompt={lastImagePromptRef.current}
                    lastVideoPrompt={lastVideoPromptRef.current}
                />
              </>
            )}
        </div>
    );
};

export default App;
