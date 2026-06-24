// client/src/services/SaveLoadControls.tsx
import React, { useState } from 'react';
import { useStory } from '../context/context';
import saveLoadService from './SaveLoadService';

interface SaveLoadControlsProps {
  className?: string;
}

const SaveLoadControls: React.FC<SaveLoadControlsProps> = ({ className = '' }) => {
  const { state, loadStory, resetStory, saveProgress } = useStory();
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const flashMessage = (message: string) => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Always keep a local snapshot so the game survives offline, then try to
    // sync the progress to the backend.
    const localOk = saveLoadService.saveStory(state);
    const remoteOk = await saveProgress();
    setIsSaving(false);

    if (remoteOk) {
      flashMessage('Game saved to your account!');
    } else if (localOk) {
      flashMessage('Saved locally (offline).');
    } else {
      flashMessage('Failed to save game.');
    }
  };

  const handleLoad = () => {
    const savedState = saveLoadService.loadStory();
    if (savedState) {
      loadStory(savedState);
      flashMessage('Game loaded!');
    } else {
      flashMessage('No saved game found.');
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset the story? All progress will be lost.')) {
      resetStory();
      flashMessage('Story reset!');
    }
  };

  return (
    <div className={`save-load-controls ${className}`}>
      <button onClick={handleSave} className="save-button" disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save Story'}
      </button>
      <button onClick={handleLoad} className="load-button" disabled={!saveLoadService.hasSavedStory()}>
        Load Story
      </button>
      <button onClick={handleReset} className="reset-button">Reset Story</button>

      {saveMessage && (
        <div className="save-message">
          {saveMessage}
        </div>
      )}
    </div>
  );
};

export default SaveLoadControls;
