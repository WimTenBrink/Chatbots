
import { AppSettings } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  // FIX: apiKey is removed as it must come from process.env.API_KEY
  geminiModel: "gemini-flash-latest",
  imagenModel: "imagen-4.0-generate-001",
};

export const GEMINI_MODELS: AppSettings['geminiModel'][] = ["gemini-flash-latest", "gemini-2.5-pro"];
// FIX: Restricting to the valid Imagen model as per guidelines.
export const IMAGEN_MODELS: AppSettings['imagenModel'][] = ["imagen-4.0-generate-001"];