import React, { useMemo } from 'react';
import { marked } from 'marked';
import { ChatMessage as ChatMessageType, MessageAuthor, BotProfile } from '../types';
import { DocumentDownloadIcon } from './icons';

interface ChatMessageProps {
  message: ChatMessageType;
}

const Avatar: React.FC<{ author: MessageAuthor; botProfile?: BotProfile }> = ({ author, botProfile }) => {
  const baseClasses = "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm";
  
  if (author === MessageAuthor.USER) {
    return <div className={`${baseClasses} bg-slate-600`}>You</div>;
  }
  
  if (author === MessageAuthor.SYSTEM) {
    return <div className={`${baseClasses} bg-slate-500`}>Sys</div>;
  }

  if (botProfile) {
    const initials = (botProfile.firstName[0] || '') + (botProfile.lastName[0] || '');
    return (
      <div
        className={`${baseClasses} bg-sky-600 border-2 border-sky-400`}
        title={`${botProfile.firstName} ${botProfile.lastName}`}
      >
        {initials}
      </div>
    );
  }

  return <div className={`${baseClasses} bg-sky-600`}>AI</div>;
};

const ChatMessageContent: React.FC<{ message: ChatMessageType }> = ({ message }) => {
    const isUser = message.author === MessageAuthor.USER;
    
    const authorName = useMemo(() => {
        if (message.author === MessageAuthor.BOT) {
            return message.botProfile ? `${message.botProfile.firstName} ${message.botProfile.lastName}` : 'Katje AI';
        }
        if (message.author === MessageAuthor.SYSTEM) {
            return 'System';
        }
        return null; // No name for user messages
    }, [message.author, message.botProfile]);


    // Sanitize and render markdown content
    const renderedHtml = { __html: marked.parse(message.text, { gfm: true, breaks: true }) };

    return (
        <div className={`p-4 rounded-lg max-w-[85%] md:max-w-[75%] ${isUser ? 'bg-sky-800' : 'bg-slate-700'}`}>
            {authorName && <p className="font-bold text-sky-300 text-sm mb-1">{authorName}</p>}
            <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={renderedHtml} />
            {message.imageUrl && (
                <div className="mt-3 relative group">
                    <img src={message.imageUrl} alt="Generated content" className="rounded-lg max-w-full h-auto" />
                    <a
                        href={message.imageUrl}
                        download={`katje-ai-image-${message.id}.png`}
                        aria-label="Download image"
                        title="Download image"
                        className="absolute top-2 right-2 p-2 bg-slate-900/60 hover:bg-slate-900/80 backdrop-blur-sm rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <DocumentDownloadIcon className="w-5 h-5" />
                    </a>
                </div>
            )}
             {message.videoUrl && (
                <div className="mt-3 relative group">
                    <video src={message.videoUrl} controls className="rounded-lg max-w-full h-auto" />
                    <a
                        href={message.videoUrl}
                        download={`katje-ai-video-${message.id}.mp4`}
                        aria-label="Download video"
                        title="Download video"
                        className="absolute top-2 right-2 p-2 bg-slate-900/60 hover:bg-slate-900/80 backdrop-blur-sm rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <DocumentDownloadIcon className="w-5 h-5" />
                    </a>
                </div>
            )}
            {message.groundingChunks && message.groundingChunks.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-600">
                    <h4 className="text-xs font-semibold text-slate-400 mb-2">Sources</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                        {message.groundingChunks.map((chunk, index) => (
                            chunk.web && (
                                <li key={index}>
                                    <a 
                                        href={chunk.web.uri} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-sky-400 hover:text-sky-300 hover:underline break-all"
                                        title={chunk.web.title}
                                    >
                                        {chunk.web.title || chunk.web.uri}
                                    </a>
                                </li>
                            )
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};


export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.author === MessageAuthor.USER;
  
  return (
    <div className={`flex items-start gap-3 my-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <Avatar author={message.author} botProfile={message.botProfile} />
      <ChatMessageContent message={message} />
    </div>
  );
};
