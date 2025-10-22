
import React, { useState, useCallback } from 'react';
import { Modal } from './Modal';
import { BotProfile, AppSettings, LogEntry, LogLevel } from '../types';
import { generateProfileImageBase64, generateBikiniImageBase64 } from '../services/geminiService';
import { ImageIcon, SpinnerIcon, DocumentDownloadIcon, SunIcon, ErrorIcon, CloseIcon } from './icons';

interface CharactersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bots: BotProfile[];
  settings: AppSettings;
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
}

const botToMarkdown = (bot: BotProfile): string => {
    const p = bot.physical;
    const f = p.facial;
    const bd = p.bodyDetails;
    const bm = p.bodyMarks;
    const attr = bot.attributes;

    return `
# ${bot.firstName} ${bot.lastName}

**ID:** ${bot.id}
**Email:** ${bot.email}
**Nationality:** ${bot.nationality}
**Speciality:** ${bot.speciality}
**Birth Date:** ${bot.birthDate}

## Biography
${bot.biography}

## Physical Profile

### Key Vitals
- **Age:** ${p.age}
- **Build:** ${p.height} / ${p.weight} (BMI: ${p.bmi})
- **Clothing Size:** ${p.clothingSize}
- **Shoe Size (EU):** ${p.shoeSizeEU}

### Facial Details
- **Face Shape:** ${f.faceShape}
- **Skin:** ${f.skinColor}
- **Hair:** ${f.hairStyle} (${f.hairColor})
- **Eyes:** ${f.eyeColor}
- **Nose:** ${f.nose}
- **Mouth:** ${f.mouth}
- **Ears:** ${f.ears}
- **Jawline:** ${f.jawline}

### Body Details
- **Chest:** ${bd.chest.description}
- **Abdomen:** ${bd.abdomen}
- **Hips:** ${bd.hips}
- **Arms:** ${bd.arms}
- **Legs:** ${bd.legs}
- **Hands:** ${bd.hands}
- **Feet:** ${bd.feet}
- **Private Areas:** Armpits are ${bd.private.armpitHair}. Pubic hair is styled as a ${bd.private.pubicHairStyle} with a natural ${bd.private.pubicHairColor} color.

### Body Marks
- **Scars:** ${bm.scars.length > 0 ? bm.scars.join(', ') : 'None'}
- **Tattoos:** ${bm.tattoos.length > 0 ? bm.tattoos.join(', ') : 'None'}
- **Piercings:** ${bm.piercings.length > 0 ? bm.piercings.join(', ') : 'None'}

## GURPS Profile

### Primary Attributes
- **ST:** ${attr.ST}, **DX:** ${attr.DX}, **IQ:** ${attr.IQ}, **HT:** ${attr.HT}

### Secondary Characteristics
- **Will:** ${attr.will}, **Perception:** ${attr.perception}
- **Hit Points:** ${attr.hitPoints}, **Fatigue Points:** ${attr.fatiguePoints}
- **Basic Speed:** ${attr.basicSpeed}, **Basic Move:** ${attr.basicMove}

## Traits
- **Advantages:** ${bot.advantages.join(', ')}
- **Disadvantages:** ${bot.disadvantages.join(', ')}
- **Quirks:** ${bot.quirks.join(', ')}

## Skills & Languages

### Professional Skills
${bot.skills.map(s => `- ${s}`).join('\n')}

### Languages
${bot.languages.map(l => `- ${l.language} (${l.proficiency})`).join('\n')}

## Favorite Foods
${bot.favoriteFoods.map(f => `- ${f}`).join('\n')}
    `;
};


const downloadFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
};

const downloadBase64Image = (base64: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${base64}`;
    a.download = `${fileName}.png`;
    a.click();
};

export const CharactersDialog: React.FC<CharactersDialogProps> = ({ isOpen, onClose, bots, settings, addLog }) => {
    const [selectedBot, setSelectedBot] = useState<BotProfile>(bots[0]);
    const [generatingIds, setGeneratingIds] = useState<Record<string, boolean>>({});
    const [bulkGenerationProgress, setBulkGenerationProgress] = useState<{ active: boolean, type: 'Avatar' | 'Bikini', current: number, total: number }>({ active: false, type: 'Avatar', current: 0, total: 0 });
    const [apiError, setApiError] = useState<string | null>(null);

    const handleGenerateImage = useCallback(async (bot: BotProfile, type: 'Avatar' | 'Bikini') => {
        setApiError(null);
        const uniqueId = `${bot.id}-${type}`;
        setGeneratingIds(prev => ({ ...prev, [uniqueId]: true }));
        try {
            const promptType = type.toLowerCase();
            const promptResponse = await fetch(`/${promptType}/${bot.id}.json`);
            if (!promptResponse.ok) {
                throw new Error(`Failed to load prompt file for ${bot.id} at /${promptType}/${bot.id}.json`);
            }
            const { prompt } = await promptResponse.json();
            addLog({ level: LogLevel.INFO, title: `Fetched ${type} prompt for ${bot.firstName}`, details: { prompt } });

            const imageGenerator = type === 'Avatar' ? generateProfileImageBase64 : generateBikiniImageBase64;
            const base64 = await imageGenerator(settings, prompt, addLog);
            
            const fileName = type === 'Avatar' ? bot.id : `${bot.id}-Bikini`;
            downloadBase64Image(base64, fileName);
        } catch (error: any) {
            let errorMessage = "An unknown error occurred while generating the image.";
            if (error.message && (error.message.includes('API_KEY_HTTP_REFERRER_BLOCKED') || error.message.includes('PERMISSION_DENIED'))) {
                errorMessage = "API Key Error: This website (aistudio.google.com) is not authorized to use this key. Please check your API key's 'Website restrictions' in the Google Cloud Console and add the URL.";
            } else if (error.message && error.message.includes('Quota exceeded')) {
                errorMessage = "API Quota Exceeded: You have hit the request limit. Please check your plan and billing details or wait a moment before trying again.";
            } else {
                errorMessage = `Failed to generate image: ${error.message}`;
            }
            setApiError(errorMessage);
            addLog({ level: LogLevel.ERROR, title: `Failed to generate ${type} image for ${bot.firstName}`, details: { error: error.message, stack: error.stack } });
        } finally {
            setGeneratingIds(prev => ({ ...prev, [uniqueId]: false }));
        }
    }, [settings, addLog]);

    const handleBulkGenerate = async (type: 'Avatar' | 'Bikini') => {
        setApiError(null);
        setBulkGenerationProgress({ active: true, type, current: 0, total: bots.length });
        for (let i = 0; i < bots.length; i++) {
            setBulkGenerationProgress(prev => ({ ...prev, current: i + 1 }));
            try {
                await handleGenerateImage(bots[i], type);
            } catch (e) {
                // The error is already handled and displayed by handleGenerateImage, so we can stop the bulk process.
                break; 
            }
        }
        setBulkGenerationProgress({ active: false, type, current: 0, total: 0 });
    };

    const handleDownloadAllMarkdown = () => {
        const allMarkdown = bots.map(bot => botToMarkdown(bot)).join('\n\n---\n\n');
        downloadFile(allMarkdown, 'characters.md', 'text/markdown');
    };
    
    const handleDownloadMarkdown = (bot: BotProfile) => {
        const markdown = botToMarkdown(bot);
        downloadFile(markdown, `${bot.firstName} ${bot.lastName}.md`, 'text/markdown');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Character Profiles">
             {apiError && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 w-11/12 max-w-3xl bg-red-900/90 border border-red-500 text-red-200 p-4 rounded-lg shadow-lg z-20">
                    <div className="flex">
                        <div className="flex-shrink-0">
                           <ErrorIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-300">Image Generation Failed</h3>
                            <div className="mt-2 text-sm text-red-200">
                                <p>{apiError}</p>
                            </div>
                        </div>
                        <div className="ml-auto pl-3">
                            <div className="-mx-1.5 -my-1.5">
                                <button
                                    type="button"
                                    onClick={() => setApiError(null)}
                                    className="inline-flex bg-red-900/50 rounded-md p-1.5 text-red-300 hover:bg-red-800/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-900 focus:ring-red-600"
                                >
                                <span className="sr-only">Dismiss</span>
                                <CloseIcon className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex flex-col md:flex-row h-full gap-4">
                {/* Left Pane: Character List */}
                <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 bg-slate-800/50 rounded-lg p-2">
                    <div className="flex justify-between items-center p-2 mb-2 border-b border-slate-700">
                         <h3 className="font-bold text-slate-200">Characters</h3>
                         <div className="flex gap-2">
                            <button onClick={() => handleBulkGenerate('Avatar')} title="Generate All Avatars" className="p-1 text-slate-400 hover:text-white"><ImageIcon className="w-5 h-5"/></button>
                            <button onClick={() => handleBulkGenerate('Bikini')} title="Generate All Bikini Images" className="p-1 text-slate-400 hover:text-white"><SunIcon className="w-5 h-5"/></button>
                            <button onClick={handleDownloadAllMarkdown} title="Download All as Markdown" className="p-1 text-slate-400 hover:text-white"><DocumentDownloadIcon className="w-5 h-5"/></button>
                         </div>
                    </div>
                    <ul className="overflow-y-auto h-[calc(100%-4rem)] pr-2">
                        {bots.map(bot => (
                            <li key={bot.id}>
                                <button 
                                    onClick={() => setSelectedBot(bot)} 
                                    className={`w-full text-left p-2 rounded-md flex justify-between items-center text-sm ${selectedBot.id === bot.id ? 'bg-sky-800/70 text-white' : 'hover:bg-slate-700/50 text-slate-300'}`}
                                >
                                    <span className="truncate">{bot.id.split('-')[1]}. {bot.firstName} {bot.lastName}</span>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {generatingIds[`${bot.id}-Avatar`] ? <SpinnerIcon className="w-4 h-4"/> : <button onClick={(e) => {e.stopPropagation(); handleGenerateImage(bot, 'Avatar')}} title="Generate Avatar" className="p-1 hover:text-white"><ImageIcon className="w-4 h-4"/></button>}
                                        {generatingIds[`${bot.id}-Bikini`] ? <SpinnerIcon className="w-4 h-4"/> : <button onClick={(e) => {e.stopPropagation(); handleGenerateImage(bot, 'Bikini')}} title="Generate Bikini Image" className="p-1 hover:text-white"><SunIcon className="w-4 h-4"/></button>}
                                        <button onClick={(e) => {e.stopPropagation(); handleDownloadMarkdown(bot)}} title="Download Markdown" className="p-1 hover:text-white"><DocumentDownloadIcon className="w-4 h-4"/></button>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Right Pane: Character Details */}
                <div className="w-full md:w-2/3 lg:w-3/4 bg-slate-800/50 rounded-lg p-4 md:p-6 overflow-y-auto">
                    {selectedBot && (
                        <div>
                            <div className="flex items-start gap-4 mb-4 pb-4 border-b border-slate-700">
                                <img src={selectedBot.imageUrl} alt={`${selectedBot.firstName} ${selectedBot.lastName}`} className="w-24 h-24 rounded-full object-cover border-4 border-slate-700" />
                                <div>
                                    <h2 className="text-2xl font-bold text-sky-300">{selectedBot.firstName} {selectedBot.lastName}</h2>
                                    <p className="text-slate-400">{selectedBot.speciality}</p>
                                    <p className="text-sm text-slate-300">{selectedBot.nationality}</p>
                                    <p className="text-xs font-mono text-slate-500 mt-1">{selectedBot.id}</p>
                                </div>
                            </div>
                             <div className="mb-4">
                                <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-2">Biography</h4>
                                <p className="text-sm text-slate-400 italic">{selectedBot.biography}</p>
                            </div>
                            
                            <h3 className="text-lg font-bold text-sky-400 mb-2">Physical Profile</h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 mb-4">
                                <div>
                                    <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-2">Key Vitals</h4>
                                    <ul className="text-sm text-slate-400 space-y-1">
                                        <li><strong>Age/Born:</strong> {selectedBot.physical.age} ({selectedBot.birthDate})</li>
                                        <li><strong>Build:</strong> {selectedBot.physical.height} / {selectedBot.physical.weight} (BMI: {selectedBot.physical.bmi})</li>
                                        <li><strong>Sizes:</strong> {selectedBot.physical.clothingSize} clothes, EU {selectedBot.physical.shoeSizeEU} shoes</li>
                                    </ul>
                                </div>
                                 <div className="lg:col-span-2">
                                    <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-2">Facial Details</h4>
                                    <ul className="text-sm text-slate-400 space-y-1">
                                        <li><strong>Face:</strong> {selectedBot.physical.facial.faceShape} with a {selectedBot.physical.facial.jawline} jawline.</li>
                                        <li><strong>Skin & Hair:</strong> {selectedBot.physical.facial.skinColor} skin; {selectedBot.physical.facial.hairStyle} ({selectedBot.physical.facial.hairColor}).</li>
                                        <li><strong>Features:</strong> {selectedBot.physical.facial.eyeColor} eyes, a {selectedBot.physical.facial.nose} nose, and {selectedBot.physical.facial.mouth}.</li>
                                    </ul>
                                </div>
                                
                                <div className="lg:col-span-2">
                                    <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-2">Body Details</h4>
                                    <ul className="text-sm text-slate-400 space-y-1">
                                        <li><strong>Chest:</strong> {selectedBot.physical.bodyDetails.chest.description}</li>
                                        <li><strong>Torso:</strong> {selectedBot.physical.bodyDetails.abdomen} with {selectedBot.physical.bodyDetails.hips}.</li>
                                        <li><strong>Limbs:</strong> {selectedBot.physical.bodyDetails.arms} and {selectedBot.physical.bodyDetails.legs}.</li>
                                        <li><strong>Extremities:</strong> {selectedBot.physical.bodyDetails.hands} and {selectedBot.physical.bodyDetails.feet}.</li>
                                        <li><strong>Private:</strong> Armpits are {selectedBot.physical.bodyDetails.private.armpitHair}. Pubic hair is a {selectedBot.physical.bodyDetails.private.pubicHairStyle} of a natural {selectedBot.physical.bodyDetails.private.pubicHairColor} color.</li>
                                    </ul>
                                </div>

                                <div className="lg:col-span-2">
                                    <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-2">Body Marks</h4>
                                    <ul className="text-sm text-slate-400 space-y-1 list-disc pl-5">
                                        {selectedBot.physical.bodyMarks.piercings.length > 0 ? selectedBot.physical.bodyMarks.piercings.map(p => <li key={p}>{p}</li>) : <li>No piercings.</li>}
                                        {selectedBot.physical.bodyMarks.tattoos.length > 0 ? selectedBot.physical.bodyMarks.tattoos.map(t => <li key={t}>{t}</li>) : <li>No tattoos.</li>}
                                        {selectedBot.physical.bodyMarks.scars.length > 0 ? selectedBot.physical.bodyMarks.scars.map(s => <li key={s}>{s}</li>) : <li>No scars.</li>}
                                    </ul>
                                </div>
                            </div>
                            
                            <h3 className="text-lg font-bold text-sky-400 mb-2">GURPS Profile</h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
                               <div>
                                    <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-2">Primary Attributes</h4>
                                     <ul className="text-sm text-slate-400 space-y-1 font-mono">
                                        <li>ST: {selectedBot.attributes.ST} | DX: {selectedBot.attributes.DX} | IQ: {selectedBot.attributes.IQ} | HT: {selectedBot.attributes.HT}</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-2">Secondary Characteristics</h4>
                                    <ul className="text-sm text-slate-400 space-y-1 font-mono">
                                        <li>Will: {selectedBot.attributes.will} | Per: {selectedBot.attributes.perception} | HP: {selectedBot.attributes.hitPoints} | FP: {selectedBot.attributes.fatiguePoints}</li>
                                        <li>Speed: {selectedBot.attributes.basicSpeed.toFixed(2)} | Move: {selectedBot.attributes.basicMove}</li>
                                    </ul>
                                </div>

                                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><h4 className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-2">Advantages</h4><ul className="text-sm text-slate-400 space-y-1 list-disc pl-5"> {selectedBot.advantages.map(a => <li key={a}>{a}</li>)}</ul></div>
                                    <div><h4 className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-2">Disadvantages</h4><ul className="text-sm text-slate-400 space-y-1 list-disc pl-5"> {selectedBot.disadvantages.map(d => <li key={d}>{d}</li>)}</ul></div>
                                    <div><h4 className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-2">Quirks</h4><ul className="text-sm text-slate-400 space-y-1 list-disc pl-5"> {selectedBot.quirks.map(q => <li key={q}>{q}</li>)}</ul></div>
                                    <div>
                                        <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-2">Skills & Languages</h4>
                                        <ul className="text-sm text-slate-400 space-y-1 list-disc pl-5">
                                            {selectedBot.skills.map(s => <li key={s}>{s}</li>)}
                                            {selectedBot.languages.map(l => <li key={l.language}><strong>{l.language} ({l.proficiency})</strong></li>)}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {bulkGenerationProgress.active && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-30">
                    <div className="bg-slate-800 p-6 rounded-lg text-center">
                        <SpinnerIcon className="w-12 h-12 text-sky-400 mx-auto mb-4" />
                        <p className="text-white">Generating {bulkGenerationProgress.type} Images...</p>
                        <p className="text-slate-400">{bulkGenerationProgress.current} of {bulkGenerationProgress.total}</p>
                    </div>
                </div>
            )}
        </Modal>
    );
};
