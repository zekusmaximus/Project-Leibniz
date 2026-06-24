// client/src/services/ApiService.ts
import axios from 'axios';
import type { ServerNode, ServerLink, ProgressState } from './storyMapper';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const USER_ID_KEY = 'project-leibniz-user-id';

/** Read the anonymous user id assigned by the backend, if we have one. */
export function getStoredUserId(): string | null {
  try {
    return localStorage.getItem(USER_ID_KEY);
  } catch {
    return null;
  }
}

/** Persist the anonymous user id returned by the backend. */
export function setStoredUserId(userId: string): void {
  try {
    localStorage.setItem(USER_ID_KEY, userId);
  } catch {
    /* localStorage unavailable (private mode, etc.) — progress just won't persist across reloads. */
  }
}

export class ApiService {
  async fetchAllNodes(): Promise<ServerNode[]> {
    const response = await axios.get<ServerNode[]>(`${API_URL}/nodes`);
    return response.data;
  }

  async fetchAllLinks(): Promise<ServerLink[]> {
    const response = await axios.get<ServerLink[]>(`${API_URL}/links`);
    return response.data;
  }

  async fetchNode(nodeId: string): Promise<ServerNode> {
    const response = await axios.get<ServerNode>(`${API_URL}/nodes/${nodeId}`);
    return response.data;
  }

  async fetchLinksFromSource(sourceId: string): Promise<ServerLink[]> {
    const response = await axios.get<ServerLink[]>(`${API_URL}/links/source/${sourceId}`);
    return response.data;
  }

  /**
   * Upsert the player's progress. Pass the existing user id to update, or `null`
   * to have the backend mint a fresh anonymous id (returned in the response).
   */
  async saveUserProgress(
    userId: string | null,
    storyState: ProgressState
  ): Promise<{ userId: string }> {
    const response = await axios.post<{ userId: string }>(`${API_URL}/progress`, {
      userId,
      storyState,
    });
    return response.data;
  }

  /** Load saved progress for a user. Throws (404) if none exists yet. */
  async loadUserProgress(userId: string): Promise<ProgressState> {
    const response = await axios.get<{ storyState: ProgressState }>(
      `${API_URL}/progress/${userId}`
    );
    return response.data.storyState;
  }
}

export const apiService = new ApiService();
export default apiService;
