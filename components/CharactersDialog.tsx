

import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { BotProfile, AppSettings, LogEntry } from '../types';
import { 
    SunIcon, 
    FilmIcon, 
    ArchiveBoxArrowDownIcon, 
    SpinnerIcon,
    UserCircleIcon,
    DocumentDownloadIcon
} from './icons';
import { generateCharacterImage } from '../services/imagenService';
import { generateCharacterVideo } from '../services/videoService';

interface CharactersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bots: BotProfile[];
  settings: AppSettings;
  // FIX: Replaced Omit with the equivalent Pick to resolve a generic type error.
  addLog: (log: Pick<LogEntry, 'level' | 'title' | 'details'>) => void;
  onSelectKey: () => Promise<void>;
}

const botToMarkdown = (bot: BotProfile): string => {
    let content = `# ${bot.firstName} ${bot.lastName} - ${bot.speciality}\n\n`;
    content += `**ID:** ${bot.id}\n`;
    content += `**Nationality:** ${bot.nationality}\n`;
    content += `**Birth Date:** ${bot.birthDate}\n\n`;
    content += `## Biography\n${bot.biography}\n\n`;

    content += `## Key Vitals\n`;
    content += `- **Age:** ${bot.physical.age}\n`;
    content += `- **Height:** ${bot.physical.height}\n`;
    content += `- **Weight:** ${bot.physical.weight}\n\n`;

    content += `## Facial Details\n`;
    content += Object.entries(bot.physical.facial).map(([key, value]) => `- **${key.charAt(0).toUpperCase() + key.slice(1)}:** ${value}`).join('\n') + '\n\n';
    
    content += `## Body Details\n`;
    content += `- **Chest:** ${bot.physical.bodyDetails.chest.description}\n`;
    content += `- **Abdomen:** ${bot.physical.bodyDetails.abdomen}\n`;
    content += `- **Hips:** ${bot.physical.bodyDetails.hips}\n`;
    content += `- **Private:** Armpit hair: ${bot.physical.bodyDetails.private.armpitHair}, Pubic hair: ${bot.physical.bodyDetails.private.pubicHairStyle} (${bot.physical.bodyDetails.private.pubicHairColor})\n\n`;

    content += `## GURPS Attributes\n`;
    content += Object.entries(bot.attributes).map(([key, value]) => `- **${key}:** ${value}`).join('\n') + '\n\n';

    content += `### Advantages\n- ${bot.advantages.join('\n- ')}\n\n`;
    content += `### Disadvantages\n- ${bot.disadvantages.join('\n- ')}\n\n`;
    content += `### Skills\n- ${bot.skills.join('\n- ')}\n\n`;

    return content;
};

const RedCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 10 10" {...props}>
    <circle cx="5" cy="5" r="5" fill="#ef4444" />
  </svg>
);

const GreenSquareIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 10 10" {...props}>
    <rect width="10" height="10" fill="#22c55e" />
  </svg>
);

const BluePyramidIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 10 10" {...props}>
    <polygon points="5,0 10,10 0,10" fill="#3b82f6" />
  </svg>
);

const AgeIcon: React.FC<{ age: number }> = ({ age }) => {
    const iconProps = { className: "w-3 h-3 mr-2 flex-shrink-0", "aria-hidden": true };
    if (age >= 18 && age <= 19) {
        return <RedCircleIcon {...iconProps} />;
    }
    if (age >= 20 && age <= 21) {
        return <BluePyramidIcon {...iconProps} />;
    }
    return <GreenSquareIcon {...iconProps} />; // age > 21
};


export const CharactersDialog: React.FC<CharactersDialogProps> = ({ isOpen, onClose, bots, settings, addLog, onSelectKey }) => {
    const [selectedBot, setSelectedBot] = useState<BotProfile>(bots[0]);
    const [activeTab, setActiveTab] = useState<'profile' | 'physical' | 'gurps' | 'avatar' | 'bikini' | 'general'>('profile');
    const [generationStatus, setGenerationStatus] = useState<Record<string, { inProgress: boolean; message: string }>>({});
    const [bulkProgress, setBulkProgress] = useState<{ type: string; current: number; total: number } | null>(null);

    const handleDownloadMarkdown = (bot: BotProfile) => {
        const markdownContent = botToMarkdown(bot);
        const a = document.createElement("a");
        const file = new Blob([markdownContent], { type: 'text/markdown' });
        a.href = URL.createObjectURL(file);
        a.download = `${bot.id}.md`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const handleDownloadAllMarkdown = () => {
        bots.forEach((bot, i) => {
            setTimeout(() => { // Stagger downloads slightly
                handleDownloadMarkdown(bot);
            }, i * 100);
        });
    };
    
    const handleGeneration = async (bot: BotProfile, type: 'avatar' | 'bikini' | 'video') => {
        const key = `${bot.id}-${type}`;
        setGenerationStatus(prev => ({ ...prev, [key]: { inProgress: true, message: 'Starting...' } }));
        try {
            if (type === 'video') {
                if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
                    setGenerationStatus(prev => ({ ...prev, [key]: { inProgress: true, message: 'Opening API Key selection...' } }));
                    await onSelectKey();
                }
                const setStatus = (message: string) => setGenerationStatus(prev => ({ ...prev, [key]: { ...prev[key], message } }));
                await generateCharacterVideo(settings, bot, addLog, setStatus);
                 setGenerationStatus(prev => ({ ...prev, [key]: { inProgress: false, message: 'Completed!' } }));
            } else {
                setGenerationStatus(prev => ({ ...prev, [key]: { inProgress: true, message: `Generating ${type}...` } }));
                await generateCharacterImage(settings, bot, type, addLog);
                setGenerationStatus(prev => ({ ...prev, [key]: { inProgress: false, message: 'Completed!' } }));
            }
        } catch (error) {
            console.error(`Failed to generate ${type} for ${bot.firstName}`, error);
            setGenerationStatus(prev => ({ ...prev, [key]: { inProgress: false, message: `Error: ${(error as Error).message}` } }));
        }
        setTimeout(() => setGenerationStatus(prev => ({ ...prev, [key]: { inProgress: false, message: '' } })), 5000);
    };

    const handleBulkGenerate = async (type: 'avatar' | 'bikini') => {
        setBulkProgress({ type, current: 0, total: bots.length });
        for (const [index, bot] of bots.entries()) {
             setBulkProgress({ type, current: index + 1, total: bots.length });
             await handleGeneration(bot, type);
        }
        setBulkProgress(null);
    };


    const botDetailsMemo = useMemo(() => {
        if (!selectedBot) return null;
        const effectiveAge = Math.max(18, selectedBot.physical.age);
        
        return (
            <div>
                 <div className="flex flex-col sm:flex-row items-start gap-4 mb-4 pb-4 border-b border-slate-700">
                    <div>
                        <h2 className="text-2xl font-bold text-sky-300">{selectedBot.id.split('-')[1]}. {selectedBot.firstName} {selectedBot.lastName}</h2>
                        <p className="text-slate-400">{selectedBot.speciality}</p>
                        <p className="text-sm text-slate-500">{selectedBot.nationality} | Born {selectedBot.birthDate}</p>
                    </div>
                </div>

                <div className="border-b border-slate-700 mb-4">
                    <nav className="-mb-px flex space-x-4 overflow-x-auto">
                        <button onClick={() => setActiveTab('profile')} className={`px-1 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'profile' ? 'border-sky-400 text-sky-400' : 'border-transparent text-slate-400 hover:text-white'}`}>Profile</button>
                        <button onClick={() => setActiveTab('physical')} className={`px-1 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'physical' ? 'border-sky-400 text-sky-400' : 'border-transparent text-slate-400 hover:text-white'}`}>Physical</button>
                        <button onClick={() => setActiveTab('gurps')} className={`px-1 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'gurps' ? 'border-sky-400 text-sky-400' : 'border-transparent text-slate-400 hover:text-white'}`}>GURPS</button>
                        <button onClick={() => setActiveTab('avatar')} className={`px-1 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'avatar' ? 'border-sky-400 text-sky-400' : 'border-transparent text-slate-400 hover:text-white'}`}>Avatar Prompt</button>
                        <button onClick={() => setActiveTab('bikini')} className={`px-1 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'bikini' ? 'border-sky-400 text-sky-400' : 'border-transparent text-slate-400 hover:text-white'}`}>Bikini Prompt</button>
                        <button onClick={() => setActiveTab('general')} className={`px-1 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'general' ? 'border-sky-400 text-sky-400' : 'border-transparent text-slate-400 hover:text-white'}`}>General Prompt</button>
                    </nav>
                </div>
                
                {activeTab === 'profile' && (
                     <div>
                        <h4 className="font-bold text-slate-300 mb-2">Biography</h4>
                        <p className="text-sm text-slate-400 whitespace-pre-wrap">{selectedBot.biography}</p>
                         <h4 className="font-bold text-slate-300 mt-4 mb-2">Languages</h4>
                        <ul className='list-disc list-inside text-sm text-slate-400'>
                           {selectedBot.languages.map(l => <li key={l.language}>{l.language} ({l.proficiency})</li>)}
                        </ul>
                     </div>
                )}
                 {activeTab === 'physical' && (
                     <div className='grid grid-cols-1 md:grid-cols-2 gap-6 text-sm'>
                        <div>
                             <h4 className="font-bold text-slate-300 mb-2">Key Vitals</h4>
                             <p><b>Age:</b> {effectiveAge}</p>
                             <p><b>Height:</b> {selectedBot.physical.height}</p>
                             <p><b>Weight:</b> {selectedBot.physical.weight}</p>
                        </div>
                        <div>
                             <h4 className="font-bold text-slate-300 mb-2">Facial Details</h4>
                             {Object.entries(selectedBot.physical.facial).map(([k,v]) => <p key={k}><b>{k.replace(/([A-Z])/g, ' $1')}:</b> {v}</p>)}
                        </div>
                         <div>
                             <h4 className="font-bold text-slate-300 mb-2">Body Marks</h4>
                             <p><b>Scars:</b> {selectedBot.physical.bodyMarks.scars.join(', ') || 'None'}</p>
                             <p><b>Tattoos:</b> {selectedBot.physical.bodyMarks.tattoos.join(', ') || 'None'}</p>
                             <p><b>Piercings:</b> {selectedBot.physical.bodyMarks.piercings.join(', ') || 'None'}</p>
                        </div>
                        <div>
                             <h4 className="font-bold text-slate-300 mb-2">Body Details</h4>
                              <p><b>Chest:</b> {selectedBot.physical.bodyDetails.chest.description}</p>
                              <p><b>Private:</b> Armpit: {selectedBot.physical.bodyDetails.private.armpitHair}, Pubic: {selectedBot.physical.bodyDetails.private.pubicHairStyle} ({selectedBot.physical.bodyDetails.private.pubicHairColor})</p>
                        </div>
                     </div>
                )}
                {activeTab === 'gurps' && (
                     <div className='grid grid-cols-1 md:grid-cols-2 gap-6 text-sm'>
                         <div>
                             <h4 className="font-bold text-slate-300 mb-2">Attributes</h4>
                             {Object.entries(selectedBot.attributes).map(([k,v]) => <p key={k}><b>{k.replace(/([A-Z])/g, ' $1')}:</b> {v}</p>)}
                         </div>
                          <div>
                             <h4 className="font-bold text-slate-300 mb-2">Traits</h4>
                             <p><b>Advantages:</b> {selectedBot.advantages.join(', ')}</p>
                             <p><b>Disadvantages:</b> {selectedBot.disadvantages.join(', ')}</p>
                         </div>
                         <div className='md:col-span-2'>
                              <h4 className="font-bold text-slate-300 mb-2">Skills</h4>
                             <p>{selectedBot.skills.join(', ')}</p>
                         </div>
                     </div>
                )}
                {activeTab === 'avatar' && (
                    <div>
                        <h4 className="font-bold text-slate-300 mb-2">Avatar Generation Prompt</h4>
                        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono bg-slate-900 p-3 rounded-md">{selectedBot.avatar}</pre>
                    </div>
                )}
                {activeTab === 'bikini' && (
                    <div>
                        <h4 className="font-bold text-slate-300 mb-2">Bikini Image Generation Prompt</h4>
                        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono bg-slate-900 p-3 rounded-md">{selectedBot.bikini}</pre>
                    </div>
                )}
                {activeTab === 'general' && (
                    <div>
                        <h4 className="font-bold text-slate-300 mb-2">General Character Prompt</h4>
                        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono bg-slate-900 p-3 rounded-md">{selectedBot.prompt}</pre>
                    </div>
                )}
            </div>
        )
    }, [selectedBot, activeTab]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Katje B.V. Team Profiles">
            <div className="flex flex-col md:flex-row h-full gap-4">
                <div className="w-full md:w-1/2 lg:w-1/3 flex-shrink-0 bg-slate-800/50 rounded-lg p-2 flex flex-col">
                    <div className="p-2 mb-2 border-b border-slate-700 flex justify-between items-center">
                         <h3 className="font-bold text-slate-200">Characters</h3>
                         <div className='flex items-center gap-1'>
                             <button onClick={() => handleBulkGenerate('avatar')} disabled={!!bulkProgress} title="Generate All Avatars" className="p-1.5 text-slate-400 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed"><UserCircleIcon className='w-5 h-5'/></button>
                             <button onClick={() => handleBulkGenerate('bikini')} disabled={!!bulkProgress} title="Generate All Bikini Images" className="p-1.5 text-slate-400 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed"><SunIcon className='w-5 h-5'/></button>
                             <button onClick={handleDownloadAllMarkdown} disabled={!!bulkProgress} title="Download All Profiles" className="p-1.5 text-slate-400 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed"><ArchiveBoxArrowDownIcon className='w-5 h-5'/></button>
                         </div>
                    </div>
                    <ul className="overflow-y-auto flex-grow pr-2">
                        {bots.map(bot => {
                            const statusKey = `${bot.id}-`;
                            const currentStatus = Object.keys(generationStatus).find(k => k.startsWith(statusKey) && generationStatus[k].inProgress);
                            const statusMessage = currentStatus ? generationStatus[currentStatus].message : '';
                            const effectiveAge = Math.max(18, bot.physical.age);
                            
                            return (
                                <li key={bot.id} className='mb-1'>
                                    <div className={`p-2 rounded-md transition-colors ${selectedBot.id === bot.id ? 'bg-sky-800/70' : 'bg-slate-700/30'}`}>
                                        <div className='flex items-center justify-between'>
                                            <button 
                                                onClick={() => { setSelectedBot(bot); setActiveTab('profile'); }} 
                                                className='flex items-center gap-3 text-left flex-grow min-w-0'
                                            >
                                                <div className='flex-grow min-w-0'>
                                                    <div className='flex justify-between items-center'>
                                                        <div className='flex items-center min-w-0'>
                                                            <AgeIcon age={effectiveAge} />
                                                            <p className='text-sm font-medium text-slate-200 truncate'>{bot.id.split('-')[1]}. {bot.firstName} {bot.lastName}</p>
                                                        </div>
                                                        <span className='text-xs text-slate-500 ml-2 flex-shrink-0'>{effectiveAge}</span>
                                                    </div>
                                                    <p className='text-xs text-slate-400 truncate'>{bot.speciality}</p>
                                                </div>
                                            </button>
                                            <div className='flex items-center flex-shrink-0 ml-2'>
                                                 <button onClick={() => handleGeneration(bot, 'avatar')} disabled={!!generationStatus[`${bot.id}-avatar`]?.inProgress || !!bulkProgress} title="Generate Avatar" className='p-1.5 text-slate-400 hover:text-white disabled:text-slate-600'><UserCircleIcon className='w-5 h-5'/></button>
                                                 <button onClick={() => handleGeneration(bot, 'bikini')} disabled={!!generationStatus[`${bot.id}-bikini`]?.inProgress || !!bulkProgress} title="Generate Bikini Image" className='p-1.5 text-slate-400 hover:text-white disabled:text-slate-600'><SunIcon className='w-5 h-5'/></button>
                                                 <button onClick={() => handleGeneration(bot, 'video')} disabled={!!generationStatus[`${bot.id}-video`]?.inProgress || !!bulkProgress} title="Generate Video" className='p-1.5 text-slate-400 hover:text-white disabled:text-slate-600'><FilmIcon className='w-5 h-5'/></button>
                                                 <button onClick={() => handleDownloadMarkdown(bot)} title="Download Profile" className='p-1.5 text-slate-400 hover:text-white'><DocumentDownloadIcon className='w-5 h-5'/></button>
                                            </div>
                                        </div>
                                         {currentStatus && (
                                            <div className='flex items-center gap-2 mt-1.5 pl-11 text-xs'>
                                                <SpinnerIcon className='w-3 h-3 animate-spin text-sky-400'/>
                                                <p className='text-slate-400 italic truncate'>{statusMessage}</p>
                                            </div>
                                         )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    {bulkProgress && (
                        <div className='flex-shrink-0 p-2 text-center'>
                            <p className='text-sm text-slate-300 mb-1'>Generating all {bulkProgress.type}s... ({bulkProgress.current}/{bulkProgress.total})</p>
                            <div className='w-full bg-slate-700 rounded-full h-1.5'>
                                <div className='bg-sky-500 h-1.5 rounded-full' style={{width: `${(bulkProgress.current / bulkProgress.total) * 100}%`}}></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-full md:w-1/2 lg:w-2/3 bg-slate-800/50 rounded-lg p-4 md:p-6 overflow-y-auto">
                    {botDetailsMemo}
                </div>
            </div>
        </Modal>
    );
};