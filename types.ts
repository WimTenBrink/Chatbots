// Fix: Added definitions for MessageAuthor, LogLevel, LogEntry, AppSettings, BotProfile, and Team.
export enum MessageAuthor {
  USER = 'user',
  BOT = 'bot',
  SYSTEM = 'system',
}

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  GEMINI_REQUEST = 'GEMINI_REQUEST',
  GEMINI_RESPONSE = 'GEMINI_RESPONSE',
  IMAGEN_REQUEST = 'IMAGEN_REQUEST',
  IMAGEN_RESPONSE = 'IMAGEN_RESPONSE',
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  title: string;
  details: any;
}

export interface AppSettings {
  geminiModel: 'gemini-flash-latest' | 'gemini-2.5-pro';
  imagenModel: 'imagen-4.0-generate-001';
}

export interface BotProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  speciality: string;
  nationality: string;
  birthDate: string;
  biography: string;
  avatar: string;
  bikini: string;
  prompt: string;
  physical: {
    age: number;
    height: string;
    weight: string;
    bmi: number;
    clothingSize: string;
    shoeSizeEU: number;
    facial: {
      faceShape: string;
      skinColor: string;
      hairColor: string;
      hairStyle: string;
      eyeColor: string;
      nose: string;
      mouth: string;
      ears: string;
      jawline: string;
    };
    bodyDetails: {
      chest: { description: string; };
      abdomen: string;
      hips: string;
      arms: string;
      legs: string;
      hands: string;
      feet: string;
      private: {
        armpitHair: string;
        pubicHairStyle: string;
        pubicHairColor: string;
      };
    };
    bodyMarks: {
      scars: string[];
      tattoos: string[];
      piercings: string[];
    };
  };
  attributes: {
    ST: number;
    DX: number;
    IQ: number;
    HT: number;
    will: number;
    perception: number;
    hitPoints: number;
    fatiguePoints: number;
    basicSpeed: number;
    basicMove: number;
  };
  advantages: string[];
  disadvantages: string[];
  quirks: string[];
  skills: string[];
  languages: { language: string; proficiency: string }[];
  favoriteFoods: string[];
  relationships?: Record<string, string>;
}

export interface Team {
    id: string;
    name: string;
    speciality: string;
    description: string;
    leaderId: string;
    memberIds: string[];
}

export interface ChatMessage {
  id: string;
  author: MessageAuthor;
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  botProfile?: BotProfile;
  groundingChunks?: any[];
}
// FIX: Moved AIStudio interface definition inside `declare global` to resolve type conflicts.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }

    interface Window {
        // FIX: Made aistudio optional to resolve modifier conflict and accurately reflect
        // that it may not be present in all environments.
        aistudio?: AIStudio;
    }
}