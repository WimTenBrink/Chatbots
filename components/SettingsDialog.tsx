import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { AppSettings } from '../types';
import { GEMINI_MODELS, IMAGEN_MODELS } from '../constants';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  onSelectKey: () => void;
}

type SettingsPage = 'API Key' | 'Gemini' | 'Imagen';

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, settings, onSettingsChange, onSelectKey }) => {
  const [activePage, setActivePage] = useState<SettingsPage>('API Key');
  const [currentSettings, setCurrentSettings] = useState<AppSettings>(settings);

  useEffect(() => {
    if (isOpen) {
        setCurrentSettings(settings);
        setActivePage('API Key'); // Default to API key page on open
    }
  }, [settings, isOpen]);

  const handleSave = () => {
    onSettingsChange(currentSettings);
    onClose();
  };
  
  const handleCancel = () => {
    onClose();
  };

  const handleChangeKey = () => {
    onSelectKey();
    onClose();
  }

  const pages: SettingsPage[] = ['API Key', 'Gemini', 'Imagen'];

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Settings">
      <div className="flex flex-col h-full">
        <nav className="flex-shrink-0 border-b border-slate-700 mb-4">
          <div className="flex space-x-2">
            {pages.map(page => (
              <button
                key={page}
                onClick={() => setActivePage(page)}
                className={`px-3 py-2 text-sm font-medium rounded-t-md whitespace-nowrap ${
                  activePage === page 
                    ? 'border-b-2 border-sky-400 text-sky-400' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-grow overflow-y-auto pr-2">
          {activePage === 'API Key' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-200 mb-3">API Key</h3>
              <p className="text-sm text-slate-400 mb-4">
                The application uses the API key you select via the secure AI Studio dialog. 
                Your key is never stored in the application or seen by the developer. 
                All API calls are billed to your account.
              </p>
              <button 
                onClick={handleChangeKey} 
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors"
              >
                Change Selected API Key
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
          )}

          {activePage === 'Gemini' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-200 mb-3">Gemini Model</h3>
              <p className="text-sm text-slate-400 mb-4">Select the Gemini model to use for text generation and chat.</p>
              <div className="space-y-2">
                {GEMINI_MODELS.map(model => (
                  <label key={model} className="flex items-center p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                    <input
                      type="radio"
                      name="geminiModel"
                      value={model}
                      checked={currentSettings.geminiModel === model}
                      onChange={() => setCurrentSettings(s => ({ ...s, geminiModel: model }))}
                      className="h-4 w-4 text-sky-500 bg-slate-800 border-slate-600 focus:ring-sky-500 focus:ring-offset-slate-800"
                    />
                    <span className="ml-3 text-slate-200 font-mono">{model}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activePage === 'Imagen' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-200 mb-3">Imagen Model</h3>
              <p className="text-sm text-slate-400 mb-4">Select the Imagen model to use for image generation.</p>
              <div className="space-y-2">
                {IMAGEN_MODELS.map(model => (
                  <label key={model} className="flex items-center p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                    <input
                      type="radio"
                      name="imagenModel"
                      value={model}
                      checked={currentSettings.imagenModel === model}
                      onChange={() => setCurrentSettings(s => ({ ...s, imagenModel: model }))}
                      className="h-4 w-4 text-sky-500 bg-slate-800 border-slate-600 focus:ring-sky-500 focus:ring-offset-slate-800"
                    />
                    <span className="ml-3 text-slate-200 font-mono">{model}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="flex-shrink-0 flex justify-end items-center pt-4 border-t border-slate-700 mt-4 space-x-3">
            <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-600 hover:bg-slate-500 rounded-md transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors">
              Save Settings
            </button>
        </footer>
      </div>
    </Modal>
  );
};
