import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppSettings, LogEntry, LogLevel, BotProfile, ChatMessage as ChatMessageType, MessageAuthor, Team } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { SettingsDialog } from './components/SettingsDialog';
import { ConsoleDialog } from './components/ConsoleDialog';
import { CharactersDialog } from './components/CharactersDialog';
import { TeamsDialog } from './components/TeamsDialog';
import { ChatMessage } from './components/ChatMessage';
import { orchestrateGroupChat } from './services/geminiService';
import { SettingsIcon, TerminalIcon, UsersIcon, SendIcon, TeamIcon } from './components/icons';

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [bots, setBots] = useState<BotProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isCharactersOpen, setIsCharactersOpen] = useState(false);
  const [isTeamsOpen, setIsTeamsOpen] = useState(false);

  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((log: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs(prev => [...prev, { 
      ...log, 
      id: crypto.randomUUID(), 
      timestamp: new Date().toISOString() 
    }]);
  }, []);

  // --- API KEY HANDLING ---
  const checkApiKey = useCallback(async () => {
      setIsCheckingApiKey(true);
      if (window.aistudio) {
          try {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(hasKey);
          } catch (e: any) {
            console.error("Error checking for API key:", e);
            setHasApiKey(false);
          }
      } else {
          // Fallback for local development if needed, though it's not the primary use case
          console.warn("window.aistudio not found. API key check is not possible in this environment.");
          setHasApiKey(false); // Assume no key in non-aistudio environments
      }
      setIsCheckingApiKey(false);
  }, []);

  const handleSelectKey = useCallback(async () => {
      if (window.aistudio) {
          try {
              await window.aistudio.openSelectKey();
              // Assume success and update UI immediately
              setHasApiKey(true); 
              addLog({level: LogLevel.INFO, title: "API Key selected by user", details: {}});
              // Add a system message to inform the user
              setMessages(prev => [...prev, {
                  id: crypto.randomUUID(),
                  author: MessageAuthor.SYSTEM,
                  text: 'API Key selected. You can now chat with the Katje AI team.',
              }]);
          } catch (e: any) {
              addLog({level: LogLevel.ERROR, title: "Error during API key selection", details: { error: e.message }});
          }
      }
  }, [addLog]);

  useEffect(() => {
      checkApiKey();
  }, [checkApiKey]);

  // --- DATA LOADING ---
  useEffect(() => {
    const fetchBots = async () => {
      try {
        addLog({ level: LogLevel.INFO, title: 'Fetching bot list...', details: { path: '/bots/bot-list.json' } });
        const listResponse = await fetch('/bots/bot-list.json');
        if (!listResponse.ok) throw new Error('Failed to fetch bot list');
        const botFiles: string[] = await listResponse.json();

        addLog({ level: LogLevel.INFO, title: 'Loading bot profiles...', details: { count: botFiles.length } });
        const botProfiles = await Promise.all(
          botFiles.map(async (file) => {
            const profileResponse = await fetch(`/bots/${file}`);
            if (!profileResponse.ok) throw new Error(`Failed to load bot profile: ${file}`);
            return await profileResponse.json();
          })
        );
        setBots(botProfiles);
        addLog({ level: LogLevel.INFO, title: 'All bot profiles loaded successfully', details: { bots: botProfiles.map(b => b.id) } });
      } catch (e: any) {
        setError(`Failed to load bot profiles: ${e.message}`);
        addLog({ level: LogLevel.ERROR, title: 'Failed to load bot profiles', details: { error: e.message, stack: e.stack } });
      }
    };
    const fetchTeams = async () => {
        try {
            addLog({ level: LogLevel.INFO, title: 'Fetching team list...', details: { path: '/teams/team-list.json' } });
            const listResponse = await fetch('/teams/team-list.json');
            if (!listResponse.ok) throw new Error('Failed to fetch team list');
            const teamFiles: string[] = await listResponse.json();

            addLog({ level: LogLevel.INFO, title: 'Loading team profiles...', details: { count: teamFiles.length } });
            const teamProfiles = await Promise.all(
              teamFiles.map(async (file) => {
                const profileResponse = await fetch(`/teams/${file}`);
                if (!profileResponse.ok) throw new Error(`Failed to load team profile: ${file}`);
                return await profileResponse.json();
              })
            );
            setTeams(teamProfiles);
            addLog({ level: LogLevel.INFO, title: 'All team profiles loaded successfully', details: { teams: teamProfiles.map(t => t.id) } });
        } catch (e: any) {
            setError(prev => `${prev ? prev + '; ' : ''}Failed to load team profiles: ${e.message}`);
            addLog({ level: LogLevel.ERROR, title: 'Failed to load team profiles', details: { error: e.message, stack: e.stack } });
        }
    };
    fetchBots();
    fetchTeams();
  }, [addLog]);


  // --- CHAT LOGIC ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMessages([{
        id: crypto.randomUUID(),
        author: MessageAuthor.SYSTEM,
        text: 'Welcome to Katje AI Chat. Ask a question to the team to begin.',
    }])
  }, [])

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading || !hasApiKey) return;

    const userMessageContent = userInput.trim();
    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      author: MessageAuthor.USER,
      text: userMessageContent,
    };
    
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
        const messageHistoryForApi = messages
            .filter(m => m.author === MessageAuthor.USER || m.author === MessageAuthor.BOT)
            .map((m): { role: 'user' | 'model'; parts: { text: string }[] } => ({
                role: m.author === MessageAuthor.USER ? 'user' : 'model',
                parts: [{ text: m.text }]
            }));
            
      const responses = await orchestrateGroupChat(settings, bots, userMessageContent, messageHistoryForApi, addLog);

      const botMessages: ChatMessageType[] = responses.map(res => ({
        id: crypto.randomUUID(),
        author: MessageAuthor.BOT,
        text: res.response,
        botProfile: res.bot,
        imageUrl: res.imageUrl,
      }));
      
      setMessages(prev => [...prev, ...botMessages]);

    } catch (error: any) {
        let errorMessage = `An unexpected error occurred: ${error.message}`;
        if (error.message.includes('API_KEY_HTTP_REFERRER_BLOCKED')) {
            errorMessage = "API Key Error: The current website is not authorized to use this key. Please check your API key's website restrictions in the Google Cloud Console."
        } else if (error.message.includes('API key not valid')) {
            errorMessage = "API Key Error: The provided API key is not valid. Please select a valid key.";
        } else if (error.message.includes('Quota exceeded')) {
             errorMessage = "API Quota Exceeded: You have exceeded your request limit for the API. Please check your plan and billing details.";
        }
        
        addLog({ level: LogLevel.ERROR, title: "Error during conversation orchestration", details: { error: error.message, stack: error.stack } });
        setMessages(prev => [...prev, { 
            id: crypto.randomUUID(), 
            author: MessageAuthor.SYSTEM, 
            text: errorMessage
        }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingApiKey) {
      return <div className="flex items-center justify-center h-screen w-screen"><p>Checking API Key...</p></div>
  }

  if (!hasApiKey) {
      return (
          <div className="flex items-center justify-center h-screen w-screen bg-slate-900 text-white">
              <div className="text-center p-8 bg-slate-800 rounded-lg shadow-xl max-w-md">
                  <h1 className="text-2xl font-bold text-sky-400 mb-4">Welcome to Katje AI Chat</h1>
                  <p className="text-slate-300 mb-6">To use this application, you must select your own Google AI API key. Your key is handled securely by AI Studio and is never shared. All API usage will be billed to your account.</p>
                  <button onClick={handleSelectKey} className="w-full px-4 py-3 font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors">
                      Select Your API Key to Begin
                  </button>
                  <p className="text-xs text-slate-500 mt-4">
                    For more information on billing, see the{' '}
                    <a
                      href="https://ai.google.dev/gemini-api/docs/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline"
                    >
                      Google AI billing documentation
                    </a>.
                  </p>
              </div>
          </div>
      );
  }

  return (
    <div className="bg-slate-900 text-white h-screen w-screen flex flex-col font-sans">
      <header className="flex-shrink-0 flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-3">
            <img src="/katje-logo.svg" alt="Katje AI Logo" className="h-10 w-auto" />
            <h1 className="font-bold text-slate-200 text-lg">Katje AI Team Chat</h1>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setIsCharactersOpen(true)} className="p-2 rounded-full hover:bg-slate-700 transition-colors" aria-label="View Characters">
                <UsersIcon className="w-6 h-6 text-slate-400" />
            </button>
            <button onClick={() => setIsTeamsOpen(true)} className="p-2 rounded-full hover:bg-slate-700 transition-colors" aria-label="View Teams">
                <TeamIcon className="w-6 h-6 text-slate-400" />
            </button>
            <button onClick={() => setIsConsoleOpen(true)} className="p-2 rounded-full hover:bg-slate-700 transition-colors" aria-label="Open Console">
                <TerminalIcon className="w-6 h-6 text-slate-400" />
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-slate-700 transition-colors" aria-label="Open Settings">
                <SettingsIcon className="w-6 h-6 text-slate-400" />
            </button>
        </div>
      </header>

      <main className="flex-grow p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
            {error && <div className="text-center p-4 bg-red-900/50 text-red-300 rounded-lg">{error}</div>}
            {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
            {isLoading && <div className="text-center text-slate-400 text-sm">The Katje AI team is thinking...</div>}
            <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="flex-shrink-0 p-4 border-t border-slate-700">
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-2">
                <textarea
                    value={userInput}
                    onChange={e => setUserInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder={isLoading ? "Please wait..." : "Ask the AI team anything..."}
                    className="w-full bg-transparent resize-none focus:outline-none p-2"
                    rows={1}
                    disabled={isLoading}
                />
                <button 
                    onClick={handleSendMessage} 
                    disabled={isLoading || !userInput.trim()}
                    className="bg-sky-600 p-2 rounded-full text-white disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-sky-500 transition-colors"
                    aria-label="Send Message"
                >
                    <SendIcon className="w-5 h-5" />
                </button>
            </div>
             <p className="text-xs text-slate-500 text-center mt-2">
                © {new Date().getFullYear()} Katje B.V. - Knowledge And Technology Joyfully Engaged.
            </p>
        </div>
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
      {bots.length > 0 && <CharactersDialog
        isOpen={isCharactersOpen}
        onClose={() => setIsCharactersOpen(false)}
        bots={bots}
        settings={settings}
        addLog={addLog}
      />}
      {bots.length > 0 && teams.length > 0 && <TeamsDialog
        isOpen={isTeamsOpen}
        onClose={() => setIsTeamsOpen(false)}
        bots={bots}
        teams={teams}
      />}
    </div>
  );
};

export default App;