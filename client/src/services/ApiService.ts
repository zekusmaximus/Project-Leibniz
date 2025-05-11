// client/src/services/ApiService.ts
import axios from 'axios';
import { StoryState, StoryNode, StoryLink } from '../context/StoryContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export class ApiService {
  async fetchAllNodes(): Promise<StoryNode[]> {
    try {
      const response = await axios.get<StoryNode[]>(`${API_URL}/nodes`);
      return response.data;
    } catch (error) {
      console.error('Error fetching nodes:', error);
      throw error;
    }
  }
  
  async fetchAllLinks(): Promise<StoryLink[]> {
    try {
      const response = await axios.get<StoryLink[]>(`${API_URL}/links`);
      return response.data
    } catch (error) {
      console.error('Error fetching links:', error);
      throw error;
    }
  }
  
  async fetchNode(nodeId: string): Promise<StoryNode> {
    try {
      const response = await axios.get<StoryNode>(`${API_URL}/nodes/${nodeId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching node ${nodeId}:`, error);
      throw error;
    }
  }
  
  async fetchLinksFromSource(sourceId: string): Promise<StoryLink[]> {
    try {
      const response = await axios.get<StoryLink[]>(`${API_URL}/links/source/${sourceId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching links from source ${sourceId}:`, error);
      throw error;
    }
  }
  
  async saveUserProgress(userId: string | null, storyState: StoryState): Promise<{ userId: string }> {
    try {
      const response = await axios.post<{ userId: string }>(`${API_URL}/progress`, {
        userId,
        storyState
      });
      return response.data;
    } catch (error) {
      console.error('Error saving user progress:', error);
      throw error;
    }
  }
  
  async loadUserProgress(userId: string): Promise<StoryState> {
    try {
      const response = await axios.get<{ storyState: StoryState }>(`${API_URL}/progress/${userId}`);
      return response.data.storyState;
    } catch (error) {
      console.error(`Error loading user progress for ${userId}:`, error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
export default apiService;