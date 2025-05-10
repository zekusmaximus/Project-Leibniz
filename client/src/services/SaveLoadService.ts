// client/src/services/SaveLoadService.ts
import { StoryState } from '../context/StoryContext';

export class SaveLoadService {
  private readonly STORAGE_KEY = 'project-leibniz-save';
  
  saveStory(state: StoryState): boolean {
    try {
      const serializedState = JSON.stringify(state);
      localStorage.setItem(this.STORAGE_KEY, serializedState);
      return true;
    } catch (error) {
      console.error('Failed to save story state:', error);
      return false;
    }
  }
  
  loadStory(): StoryState | null {
    try {
      const serializedState = localStorage.getItem(this.STORAGE_KEY);
      if (!serializedState) return null;
      
      return JSON.parse(serializedState) as StoryState;
    } catch (error) {
      console.error('Failed to load story state:', error);
      return null;
    }
  }
  
  hasSavedStory(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }
  
  deleteSavedStory(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const saveLoadService = new SaveLoadService();
export default saveLoadService;