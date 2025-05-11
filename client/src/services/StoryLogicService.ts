// client/src/services/StoryLogicService.ts
import { StoryState } from '../context/StoryTypes';

type StoryTrigger = (state: StoryState) => boolean;
type StoryEffect = (state: StoryState) => Partial<StoryState>;

interface StoryRule {
  id: string;
  trigger: StoryTrigger;
  effect: StoryEffect;
  priority: number;
  once: boolean;
  executed: boolean;
}

class StoryLogicService {
  private rules: StoryRule[] = [];

  constructor() {
    this.initializeRules();
  }

  private initializeRules() {
    // Rule: When starting node is visited, reveal paths A and B
    this.addRule({ ...{
      id: 'reveal_initial_paths',
      trigger: (state) => state.visitCounts['start'] === 1,
      effect: () => ({
        // The actual revealing of nodes and links will be handled by the component
        flags: { initialPathsRevealed: true }
      }),
      priority: 100,
      once: true,
      executed: false }
    });

    // Rule: When path A is visited, reveal the whisper source
    this.addRule({
      id: 'reveal_whisper_source',
      trigger: (state) => state.visitCounts['pathA'] === 1,
      effect: () => ({
        flags: { whisperSourceRevealed: true }
      }),
      priority: 90,
      once: true,
      executed: false
    });

    // Rule: When path B is visited, reveal the echo chamber
    this.addRule({
      id: 'reveal_echo_chamber',
      trigger: (state) => state.visitCounts['pathB'] === 1,
      effect: () => ({
        flags: { echoChamberRevealed: true }
      }),
      priority: 90,
      once: true,
      executed: false
    });

    // Rule: When both path A and B are visited, change the start node
    this.addRule({
      id: 'paths_converge',
      trigger: (state) => 
        state.visitCounts['pathA'] > 0 && 
        state.visitCounts['pathB'] > 0,
      effect: () => ({
        flags: { bothPathsVisited: true }
      }),
      priority: 80,
      once: true,
      executed: false
    });

    // Advanced rule: When player visits nodes in a specific order
    this.addRule({
      id: 'secret_path_discovery',
      trigger: (state) => {
        // Check if the last 3 nodes in history match a pattern
        const recentPath = state.history.slice(-3);
        return (
          recentPath.length === 3 &&
          recentPath[0] === 'whisperSource' &&
          recentPath[1] === 'pathA' &&
          recentPath[2] === 'echoChamber'
        );
      },
      effect: () => ({
        flags: { secretPathDiscovered: true }
      }),
      priority: 70,
      once: true,
      executed: false
    });
  }

  addRule(rule: StoryRule) {
    this.rules.push(rule);
  }

  evaluateState(state: StoryState): Partial<StoryState> {
    let stateChanges: Partial<StoryState> = {};
    
    // Sort rules by priority (higher first)
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      if (rule.once && rule.executed) continue;
      
      if (rule.trigger(state)) {
        const changes = rule.effect(state);
        stateChanges = { ...stateChanges, ...changes };
        
        // Mark rule as executed
        if (rule.once) {
          rule.executed = true;
        }
      }
    }
    
    return stateChanges;
  }

  getNodeText(nodeId: string, state: StoryState): string {
    const node = state.nodes[nodeId];
    if (!node) return '';

    // Basic text from the node
    let text = node.text;

    // Customize text based on visit count or flags
    if (nodeId === 'start') {
      if (state.visitCounts['start'] > 1) {
        text = `You re-examine the anomaly. The paths remain, but the anomaly itself feels... different now.`;
      }
      
      if (state.flags['bothPathsVisited']) {
        text += `\n\nSomething has changed. The paths you've traveled have left their mark on this place.`;
      }
    }
    
    // More custom text logic based on game state...
    
    return text;
  }

  // Additional methods for complex story logic...
}

export const storyLogicService = new StoryLogicService();
export default storyLogicService;