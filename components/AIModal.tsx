import React, { useState } from 'react';
import { generateBreathingPattern } from '../services/geminiService';
import { BreathingPattern } from '../types';

interface AIModalProps {
  onApplyPattern: (pattern: BreathingPattern) => void;
  onClose: () => void;
}

const AIModal: React.FC<AIModalProps> = ({ onApplyPattern, onClose }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await generateBreathingPattern(input);
      if (response) {
        onApplyPattern(response); // Service now returns full BreathingPattern
        onClose();
      } else {
        setError("Не удалось сгенерировать паттерн. Попробуйте еще раз.");
      }
    } catch (e) {
      setError("Ошибка соединения с AI.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-calm-surface w-full max-w-md rounded-2xl border border-indigo-500/50 shadow-2xl shadow-indigo-500/20 overflow-hidden">
        
        <div className="p-4 bg-gradient-to-r from-violet-900 to-indigo-900 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="text-white" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <h3 className="text-lg font-bold text-white">AI Ассистент</h3>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="p-6">
          <p className="text-slate-300 mb-4 text-sm">
            Опишите ваше самочувствие (например: "Я волнуюсь перед экзаменом", "Не могу уснуть", "Чувствую панику"). AI подберет идеальный ритм.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Как вы себя чувствуете?"
              className="w-full h-32 bg-slate-900 text-white p-3 rounded-xl border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
              disabled={isLoading}
            />
            
            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                isLoading 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Думаю...
                </>
              ) : (
                'Получить рекомендацию'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIModal;