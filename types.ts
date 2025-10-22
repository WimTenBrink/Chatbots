
// types.ts

export interface FacialDetails {
  faceShape: string;
  skinColor: string;
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  nose: string;
  mouth: string;
  ears: string;
  jawline: string;
}

export interface BodyMarks {
  scars: string[];
  tattoos: string[];
  piercings: string[];
}

export interface ChestDetails {
  bustSize: string;
  cupSize: string;
  description: string;
}

export interface PrivateDetails {
  armpitHair: string;
  pubicHairStyle: string;
  pubicHairColor: string;
}

export interface BodyDetails {
  chest: ChestDetails;
  abdomen: string;
  hips: string;
  arms: string;
  legs: string;
  hands: string;
  feet: string;
  private: PrivateDetails;
}


export interface AppSettings {
  geminiModel: 'gemini-flash-latest' | 'gemini-2.5-pro';
  imagenModel: 'imagen-4.0-generate-001';
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

export interface GURPSAttributes {
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
}

export interface PhysicalDetails {
  age: number;
  height: string;
  weight: string;
  bmi: number;
  gender: 'female';
  clothingSize: string;
  shoeSizeEU: number;
  facial: FacialDetails;
  bodyMarks: BodyMarks;
  bodyDetails: BodyDetails;
}

export interface Language {
  language: string;
  proficiency: 'Native' | 'Fluent' | 'Conversational' | 'Basic';
}

export interface BotProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  birthDate: string;
  nationality: string;
  biography: string;
  speciality: string;
  imageUrl: string;
  physical: PhysicalDetails;
  attributes: GURPSAttributes;
  advantages: string[];
  disadvantages: string[];
  quirks: string[];
  skills: string[];
  languages: Language[];
  favoriteFoods: string[];
  relationships: { [botId: string]: string };
}

export interface Team {
    id: string;
    name: string;
    speciality: string;
    description: string;
    leaderId: string;
    memberIds: string[];
}


export enum MessageAuthor {
  USER = 'user',
  BOT = 'bot',
  SYSTEM = 'system',
}

export interface ChatMessage {
  id: string;
  author: MessageAuthor;
  text: string;
  imageUrl?: string;
  botProfile?: BotProfile;
}
