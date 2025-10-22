import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { BotProfile, Team } from '../types';
import { TeamIcon, UserCircleIcon } from './icons';

interface TeamsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bots: BotProfile[];
  teams: Team[];
}

export const TeamsDialog: React.FC<TeamsDialogProps> = ({ isOpen, onClose, bots, teams }) => {
    const [selectedTeam, setSelectedTeam] = useState<Team>(teams[0]);

    const botsById = useMemo(() => {
        return bots.reduce((acc, bot) => {
            acc[bot.id] = bot;
            return acc;
        }, {} as Record<string, BotProfile>);
    }, [bots]);

    const getBot = (botId: string) => botsById[botId];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Katje B.V. Teams">
            <div className="flex flex-col md:flex-row h-full gap-4">
                {/* Left Pane: Team List */}
                <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 bg-slate-800/50 rounded-lg p-2">
                    <div className="p-2 mb-2 border-b border-slate-700">
                         <h3 className="font-bold text-slate-200">Teams</h3>
                    </div>
                    <ul className="overflow-y-auto h-[calc(100%-4rem)] pr-2">
                        {teams.map(team => (
                            <li key={team.id}>
                                <button 
                                    onClick={() => setSelectedTeam(team)} 
                                    className={`w-full text-left p-2 rounded-md flex items-center gap-3 text-sm ${selectedTeam.id === team.id ? 'bg-sky-800/70 text-white' : 'hover:bg-slate-700/50 text-slate-300'}`}
                                >
                                    <TeamIcon className="w-5 h-5 flex-shrink-0" />
                                    <span>{team.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Right Pane: Team Details */}
                <div className="w-full md:w-2/3 lg:w-3/4 bg-slate-800/50 rounded-lg p-4 md:p-6 overflow-y-auto">
                    {selectedTeam && (
                        <div>
                            <div className="mb-4 pb-4 border-b border-slate-700">
                                <h2 className="text-2xl font-bold text-sky-300">{selectedTeam.name}</h2>
                                <p className="text-slate-400">{selectedTeam.speciality}</p>
                            </div>

                            <div className="mb-6">
                                <h4 className="font-bold text-slate-300 mb-2">Team Mission</h4>
                                <p className="text-sm text-slate-400 italic">{selectedTeam.description}</p>
                            </div>
                            
                            <div>
                                <h4 className="font-bold text-slate-300 mb-3">Members ({selectedTeam.memberIds.length})</h4>
                                <div className="space-y-3">
                                    {selectedTeam.memberIds.map(memberId => {
                                        const member = getBot(memberId);
                                        const isLeader = memberId === selectedTeam.leaderId;
                                        if (!member) return null;

                                        return (
                                            <div key={memberId} className={`flex items-center gap-3 p-2 rounded-lg ${isLeader ? 'bg-sky-900/50 border-l-4 border-sky-400' : 'bg-slate-700/30'}`}>
                                                <UserCircleIcon className="w-12 h-12 text-slate-500 flex-shrink-0" />
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex justify-between items-baseline">
                                                        <p className="font-bold text-slate-100 truncate">
                                                            {member.firstName} {member.lastName}
                                                            {isLeader && <span className="ml-2 text-xs font-medium bg-sky-400/20 text-sky-300 px-2 py-0.5 rounded-full">Leader</span>}
                                                        </p>
                                                        <span className="text-sm text-slate-500 ml-2 flex-shrink-0">{member.physical.age}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-400 truncate">{member.speciality}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
