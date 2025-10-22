import React from 'react';
import { marked } from 'marked';
import { ChatMessage as ChatMessageType, MessageAuthor, BotProfile } from '../types';
import { DocumentDownloadIcon } from './icons';

interface ChatMessageProps {
  message: ChatMessageType;
}

const Avatar: React.FC<{ author: MessageAuthor; botProfile?: BotProfile }> = ({ author, botProfile }) => {
  const baseClasses = "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold";
  
  if (author === MessageAuthor.USER) {
    return <div className={`${baseClasses} bg-slate-600`}>You</div>;
  }

  if (botProfile) {
    return (
      <img
        src={botProfile.imageUrl}
        alt={botProfile.firstName}
        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-sky-400"
      />
    );
  }

  return <div className={`${baseClasses} bg-sky-600`}>AI</div>;
};

const ChatMessageContent: React.FC<{ message: ChatMessageType }> = ({ message }) => {
    const isUser = message.author === MessageAuthor.USER;
    const botName = message.botProfile ? `${message.botProfile.firstName} ${message.botProfile.lastName}` : 'Katje AI';

    // Sanitize and render markdown content
    const renderedHtml = { __html: marked.parse(message.text, { gfm: true, breaks: true }) };

    return (
        <div className={`p-4 rounded-lg max-w-[85%] md:max-w-[75%] ${isUser ? 'bg-sky-800' : 'bg-slate-700'}`}>
            {!isUser && <p className="font-bold text-sky-300 text-sm mb-1">{botName}</p>}
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
        </div>
    );
};


export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.author === MessageAuthor.USER;
  const isSystem = message.author === MessageAuthor.SYSTEM;

  if (isSystem) {
    return (
      <div className="text-center my-4">
        <p className="text-xs text-slate-500 italic px-4 py-1 bg-slate-800 rounded-full inline-block">{message.text}</p>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 my-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <Avatar author={message.author} botProfile={message.botProfile} />
      <ChatMessageContent message={message} />
    </div>
  );
};