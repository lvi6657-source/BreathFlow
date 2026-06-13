import React, { useState } from 'react';
import { BreathingPattern, BreathPhase, BreathingStep } from '../types';
import { SliderComponent, StepControlPanel } from './Controls';

interface SettingsModalProps {
  patterns: BreathingPattern[];
  currentPatternId: string;
  onSelectPattern: (pattern: BreathingPattern) => void;
  onSavePattern: (pattern: BreathingPattern) => void;
  onSaveSessionAsNew: () => void;
  onDeletePattern: (id: string) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  patterns, 
  currentPatternId, 
  onSelectPattern, 
  onSavePattern, 
  onSaveSessionAsNew,
  onDeletePattern,
  onClose 
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<BreathingPattern | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);

  const handleEdit = (pattern: BreathingPattern, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(pattern.id);
    setEditForm(JSON.parse(JSON.stringify(pattern))); // Deep copy
    setSelectedStepIndex(0);
  };

  const handleCreate = () => {
    const newPattern: BreathingPattern = {
      id: crypto.randomUUID(),
      name: "Новый ритм",
      description: "Пользовательский",
      steps: [
        { type: BreathPhase.INHALE, duration: 4 },
        { type: BreathPhase.EXHALE, duration: 4 }
      ],
      adjustmentPerCycle: 0,
      minCycleDuration: 4,
      maxCycleDuration: 30
    };
    setEditingId(newPattern.id);
    setEditForm(newPattern);
    setSelectedStepIndex(0);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Вы уверены, что хотите удалить этот паттерн?")) {
      onDeletePattern(id);
    }
  };

  const saveForm = () => {
    if (editForm) {
      onSavePattern(editForm);
      setEditingId(null);
      setEditForm(null);
    }
  };

  const updateStep = (index: number, field: keyof BreathingStep, value: any) => {
    if (!editForm) return;
    const newSteps = [...editForm.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setEditForm({ ...editForm, steps: newSteps });
  };

  const togglePhaseType = (index: number) => {
      if (!editForm) return;
      const current = editForm.steps[index].type;
      let next = BreathPhase.INHALE;
      if (current === BreathPhase.INHALE) next = BreathPhase.HOLD;
      else if (current === BreathPhase.HOLD) next = BreathPhase.EXHALE;
      else if (current === BreathPhase.EXHALE) next = BreathPhase.INHALE;
      
      updateStep(index, 'type', next);
  };

  const removeStep = () => {
    if (!editForm || editForm.steps.length <= 1) return;
    const newSteps = editForm.steps.filter((_, i) => i !== selectedStepIndex);
    setEditForm({ ...editForm, steps: newSteps });
    setSelectedStepIndex(prev => Math.max(0, Math.min(prev, newSteps.length - 1)));
  };

  const addStep = () => {
    if (!editForm) return;
    const newSteps = [...editForm.steps];
    newSteps.splice(selectedStepIndex + 1, 0, { type: BreathPhase.HOLD, duration: 2 });
    setEditForm({ ...editForm, steps: newSteps });
    setSelectedStepIndex(selectedStepIndex + 1);
  };

  const getPhaseIcon = (phase: BreathPhase) => {
      switch(phase) {
          case BreathPhase.INHALE: 
            return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>;
          case BreathPhase.EXHALE:
            return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>;
          default:
            return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400"><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
      }
  };

  const renderEditForm = () => {
    if (!editForm) return null;
    const currentStep = editForm.steps[selectedStepIndex];

    return (
      <div className="flex flex-col h-full bg-calm-bg">
        {/* Name/Desc Inputs */}
        <div className="p-4 space-y-4">
            <input 
                type="text" 
                value={editForm.name} 
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                className="w-full bg-transparent border-b border-slate-700 py-2 text-xl font-bold text-white outline-none placeholder-slate-600 text-center"
                placeholder="Название"
            />
            <input 
                type="text" 
                value={editForm.description} 
                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                className="w-full bg-transparent border-b border-slate-700 py-1 text-sm text-slate-400 outline-none placeholder-slate-600 text-center"
                placeholder="Описание"
            />
        </div>

        <div className="flex-1 flex flex-col justify-end pb-24 relative">
             {/* Vertical Step Visualizer (Matching Main Screen) */}
             <div className="absolute left-4 top-0 bottom-4 overflow-y-auto flex flex-col gap-2 w-32 custom-scrollbar">
                 {editForm.steps.map((s, i) => (
                      <div 
                        key={i} 
                        onClick={() => setSelectedStepIndex(i)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${selectedStepIndex === i ? 'border-calm-accent bg-calm-accent/20' : 'border-white/5 bg-black/20 opacity-50'}`}
                      >
                          {getPhaseIcon(s.type)}
                          <span className="font-mono font-bold text-slate-300 text-xs">{s.duration}</span>
                      </div>
                 ))}
            </div>

            <div className="w-full border-t border-slate-800 flex flex-col z-10 bg-calm-bg">
                    {/* Row 1: Step Selector & Min Limit (Swapped) */}
                    <div className="w-full h-20 flex relative border-b border-slate-800">
                        <div className="w-1/2 h-full border-r border-slate-800">
                            <StepControlPanel 
                                stepIndex={selectedStepIndex}
                                totalSteps={editForm.steps.length}
                                stepType={currentStep.type}
                                onPrev={() => setSelectedStepIndex(prev => (prev - 1 + editForm.steps.length) % editForm.steps.length)}
                                onNext={() => setSelectedStepIndex(prev => (prev + 1) % editForm.steps.length)}
                                onToggleType={() => togglePhaseType(selectedStepIndex)}
                                onAdd={addStep}
                                onRemove={removeStep}
                            />
                        </div>
                        
                         <div className="w-1/2 h-full relative">
                            <SliderComponent 
                                value={editForm.minCycleDuration || 4}
                                onChange={(v) => setEditForm({...editForm, minCycleDuration: v})}
                                label="Мин. Цикл"
                                isCenterZero={false}
                                clampMin={2}
                                clampMax={(editForm.maxCycleDuration || 60) - 1}
                                min={2}
                                max={60}
                                unit="с"
                                step={1}
                            />
                        </div>
                    </div>

                    {/* Row 2: Duration & Max Limit */}
                    <div className="w-full h-20 flex relative">
                        <div className="w-1/2 h-full border-r border-slate-800">
                           <SliderComponent 
                                value={currentStep.duration}
                                onChange={(v) => updateStep(selectedStepIndex, 'duration', v)}
                                label="Длительность"
                                isCenterZero={false}
                                clampMin={0.5}
                                clampMax={30}
                                min={0}
                                max={30}
                                unit="с"
                                step={0.5}
                            />
                        </div>
                        <div className="w-1/2 h-full">
                             <SliderComponent 
                                value={editForm.maxCycleDuration || 60}
                                onChange={(v) => setEditForm({...editForm, maxCycleDuration: v})}
                                label="Макс. Цикл"
                                isCenterZero={false}
                                clampMin={(editForm.minCycleDuration || 4) + 1}
                                clampMax={60}
                                min={4}
                                max={60}
                                unit="с"
                                step={1}
                            />
                        </div>
                    </div>
            </div>
        </div>
        
        {/* Footer */}
        <div className="fixed bottom-0 left-0 right-0 grid grid-cols-2 gap-px bg-slate-800 border-t border-slate-800 z-50">
          <button 
            onClick={() => setEditingId(null)}
            className="h-20 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors font-bold uppercase tracking-widest text-sm"
          >
            Отмена
          </button>
          <button 
            onClick={saveForm}
            className="h-20 bg-slate-900 text-calm-accent hover:bg-calm-accent/10 transition-colors font-bold uppercase tracking-widest text-sm"
          >
            Сохранить
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md h-full sm:h-[90vh] bg-calm-bg sm:rounded-3xl sm:border sm:border-slate-700 shadow-2xl overflow-hidden flex flex-col relative">
        
        {/* Header */}
        {!editingId && (
            <div className="p-6 pb-2 bg-calm-bg z-10">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-white tracking-tight">Библиотека</h3>
                <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div className="h-px w-full bg-slate-800"></div>
            </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-calm-bg">
          {editingId ? (
            renderEditForm()
          ) : (
            <div className="pb-24">
                {/* Save Current Session Button */}
                <button 
                    onClick={onSaveSessionAsNew}
                    className="w-full p-6 text-calm-accent hover:bg-calm-accent/10 transition-all font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 border-b border-slate-800"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    Сохранить текущий сеанс как новый
                </button>

                {patterns.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => {
                      onSelectPattern(preset);
                      onClose();
                    }}
                    className={`group relative w-full p-6 border-b text-left transition-all cursor-pointer ${
                      currentPatternId === preset.id 
                      ? 'bg-calm-accent/5 border-calm-accent/50' 
                      : 'border-slate-800 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2 pr-12">
                      <div>
                        <span className={`text-lg font-bold block ${currentPatternId === preset.id ? 'text-calm-accent' : 'text-white'}`}>
                          {preset.name}
                        </span>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">{preset.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                       {preset.steps.map((s, i) => (
                           <div key={i} className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                               {getPhaseIcon(s.type)}
                               <span className="font-mono font-bold text-slate-300 text-sm">{s.duration}</span>
                           </div>
                       ))}
                    </div>

                    {/* Actions */}
                    <div className="absolute top-6 right-4 flex flex-col gap-2">
                      <button 
                        onClick={(e) => handleEdit(preset, e)}
                        className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-calm-accent bg-slate-800/50 rounded-full transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button 
                        onClick={(e) => handleDelete(preset.id, e)}
                        className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-red-400 bg-slate-800/50 rounded-full transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer (Create Button) - Only visible when NOT editing */}
        {!editingId && (
            <div className="fixed bottom-0 left-0 right-0 p-0 bg-calm-bg border-t border-slate-800 sm:absolute grid grid-cols-1">
                <button 
                    onClick={handleCreate}
                    className="w-full h-20 bg-slate-900 text-slate-400 hover:text-white transition-all font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Создать новый
                </button>
            </div>
        )}

      </div>
    </div>
  );
};

export default SettingsModal;