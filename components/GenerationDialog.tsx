import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { BotProfile, Team } from '../types';

interface GenerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  generationType: 'image' | 'video';
  bots: BotProfile[];
  teams: Team[];
  onSubmit: (prompt: string, botIds: string[], teamId: string | null, resolution: string) => void;
  lastImagePrompt: string;
  lastVideoPrompt: string;
}

const IMAGE_ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const VIDEO_RESOLUTIONS = [
    { value: '1080p', label: '1920x1080 (1080p)' },
    { value: '720p', label: '1280x720 (720p)' },
];

export const GenerationDialog: React.FC<GenerationDialogProps> = ({ isOpen, onClose, generationType, bots, teams, onSubmit, lastImagePrompt, lastVideoPrompt }) => {
    const [prompt, setPrompt] = useState('');
    const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [resolution, setResolution] = useState('');

    const resolutions = useMemo(() => 
        generationType === 'image' 
        ? IMAGE_ASPECT_RATIOS 
        : VIDEO_RESOLUTIONS.map(r => r.label),
    [generationType]);
    
    const botsById = useMemo(() => Object.fromEntries(bots.map(b => [b.id, b])), [bots]);

    const relatedBotIds = useMemo(() => {
        const relatedIds = new Set<string>();
        if (selectedBotIds.length === 0) {
            return relatedIds;
        }

        selectedBotIds.forEach(selectedId => {
            const selectedBot = botsById[selectedId];
            if (selectedBot?.relationships) {
                Object.keys(selectedBot.relationships).forEach(relatedId => {
                    relatedIds.add(relatedId);
                });
            }
        });

        return relatedIds;
    }, [selectedBotIds, botsById]);

    useEffect(() => {
        if (isOpen) {
            const lastPrompt = generationType === 'image' ? lastImagePrompt : lastVideoPrompt;
            setPrompt(lastPrompt);
            setSelectedBotIds([]);
            setSelectedTeamId(null);
            setResolution(resolutions[generationType === 'image' ? 1 : 0]); // Default to 16:9 for image, 1080p for video
        }
    }, [isOpen, generationType, lastImagePrompt, lastVideoPrompt, resolutions]);

    const handleBotToggle = (botId: string) => {
        setSelectedTeamId(null); // Deselect team when a bot is toggled
        setSelectedBotIds(prev =>
            prev.includes(botId) ? prev.filter(id => id !== botId) : [...prev, botId]
        );
    };

    const handleTeamSelect = (teamId: string) => {
        setSelectedBotIds([]); // Deselect bots when a team is selected
        setSelectedTeamId(prev => (prev === teamId ? null : teamId));
    };

    const handleSubmit = () => {
        if (prompt.trim()) {
            let finalResolution = resolution;
            if (generationType === 'video') {
                const selectedResObj = VIDEO_RESOLUTIONS.find(r => r.label === resolution);
                finalResolution = selectedResObj ? selectedResObj.value : VIDEO_RESOLUTIONS[0].value;
            }
            onSubmit(prompt, selectedBotIds, selectedTeamId, finalResolution);
        }
    };
    
    const title = generationType === 'image' ? 'Generate Image' : 'Generate Video';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="flex flex-col h-full">
                <div className="flex-grow flex flex-col md:flex-row gap-4 min-h-0">
                    {/* Left Pane: Bot List */}
                    <div className="md:w-1/3 bg-slate-800/50 rounded-lg p-2 flex flex-col h-full min-h-[150px]">
                        <h3 className="font-bold text-slate-200 p-2 mb-2 border-b border-slate-700 flex-shrink-0">Select Characters</h3>
                        <ul className="overflow-y-auto flex-grow pr-1 space-y-1">
                            {bots.map(bot => {
                                const isSelected = selectedBotIds.includes(bot.id);
                                const isRelated = relatedBotIds.has(bot.id) && !isSelected;
                                
                                let bgClass = 'hover:bg-slate-700/50';
                                if (isSelected) {
                                    bgClass = 'bg-sky-700';
                                } else if (isRelated) {
                                    bgClass = 'bg-teal-800/80 ring-1 ring-teal-600';
                                }

                                return (
                                <li key={bot.id}>
                                    <label className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${bgClass}`}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleBotToggle(bot.id)}
                                            className="h-4 w-4 rounded bg-slate-600 border-slate-500 text-sky-500 focus:ring-sky-500"
                                        />
                                        <div className="w-8 h-8 rounded-full bg-sky-800 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" title={`${bot.firstName} ${bot.lastName}`}>
                                            {(bot.firstName[0] || '') + (bot.lastName[0] || '')}
                                        </div>
                                        <div className="flex-grow flex justify-between items-center min-w-0">
                                            <span className="text-sm text-slate-200 truncate">{bot.firstName} {bot.lastName}</span>
                                            <span className="text-xs text-slate-500 ml-2 flex-shrink-0">{bot.physical.age}</span>
                                        </div>
                                    </label>
                                </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* Right Pane: Prompt, Teams, Options */}
                    <div className="md:w-2/3 bg-slate-800/50 rounded-lg p-4 flex flex-col h-full gap-4">
                        <div className='flex flex-col md:flex-row gap-4 flex-grow min-h-0'>
                            <div className='flex-grow flex flex-col'>
                                <label htmlFor="prompt" className="text-lg font-semibold text-slate-200 mb-2 flex-shrink-0">Prompt</label>
                                <textarea
                                    id="prompt"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.ctrlKey) {
                                            e.preventDefault();
                                            handleSubmit();
                                        }
                                    }}
                                    placeholder={`Describe the ${generationType} you want to create...`}
                                    className="flex-grow bg-slate-700 text-slate-200 placeholder-slate-400 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none w-full"
                                />
                            </div>
                            <div className="md:w-1/3 flex flex-col min-h-[150px]">
                                <h3 className="font-bold text-slate-200 mb-2 flex-shrink-0">Or Select a Team</h3>
                                <ul className="overflow-y-auto flex-grow pr-1 space-y-1 bg-slate-900/50 rounded-md p-1">
                                    {teams.map(team => (
                                        <li key={team.id}>
                                            <label className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${selectedTeamId === team.id ? 'bg-sky-700' : 'hover:bg-slate-700/50'}`}>
                                                <input
                                                    type="radio"
                                                    name="team-selection"
                                                    checked={selectedTeamId === team.id}
                                                    onChange={() => handleTeamSelect(team.id)}
                                                    className="h-4 w-4 bg-slate-600 border-slate-500 text-sky-500 focus:ring-sky-500"
                                                />
                                                <span className="text-sm text-slate-200">{team.name}</span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                           <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
                                <div>
                                    <label htmlFor="resolution" className="text-sm font-medium text-slate-300 mr-2">
                                    {generationType === 'image' ? 'Aspect Ratio:' : 'Resolution:'}
                                    </label>
                                    <select
                                        id="resolution"
                                        value={resolution}
                                        onChange={(e) => setResolution(e.target.value)}
                                        className="bg-slate-700 text-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    >
                                        {resolutions.map(res => <option key={res} value={res}>{res}</option>)}
                                    </select>
                                </div>
                                {generationType === 'image' && (
                                    <p className="text-xs text-slate-500 self-end pb-1">
                                        Final output dimensions are determined by the model.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <footer className="flex-shrink-0 flex justify-end items-center pt-4 border-t border-slate-700 mt-4 space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-600 hover:bg-slate-500 rounded-md transition-colors">
                      Cancel
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={!prompt.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed">
                      Generate
                    </button>
                </footer>
            </div>
        </Modal>
    );
};