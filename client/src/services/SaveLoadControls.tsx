// client/src/components/SaveLoadControls.tsx
import { useState } from 'react';
import { useStory } from '../context/StoryContext';
import saveLoadService from '../services/SaveLoadService';

interface SaveLoadControlsProps {
  className?: string;
}

const SaveLoadControls: React.FC<SaveLoadControlsProps> = ({ className = '' }) => {
  const { state, loadStory, resetStory } = useStory();
  const [saveMessage, setSaveMessage] = useState<string>('');
  
  const handleSave = () => {
    const success = saveLoadService.saveStory(state);
    setSaveMessage(success ? 'Game saved!' : 'Failed to save game.');
    
    // Clear the message after 3 seconds
    setTimeout(() => setSaveMessage(''), 3000);
  };
  
  const handleLoad = () => {
    const savedState = saveLoadService.loadStory();
    if (savedState) {
      loadStory(savedState);
      setSaveMessage('Game loaded!');
    } else {
      setSaveMessage('No saved game found.');
    }
    
    // Clear the message after 3 seconds
    setTimeout(() => setSaveMessage(''), 3000);
  };
  
  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset the story? All progress will be lost.')) {
      resetStory();
      setSaveMessage('Story reset!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };
  
  return (
    <div className={`save-load-controls ${className}`}>
      <button onClick={handleSave} className="save-button">Save Story</button>
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