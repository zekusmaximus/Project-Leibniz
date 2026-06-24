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

// Terminal nodes. Reaching one ends the run; NarrativePage hides further
// choices and offers a restart. Kept here so both the graph data and the UI
// agree on what counts as an ending.
const ENDING_NODE_IDS = new Set<string>(['convergence', 'singularity']);

/** Did `a` first appear before `b` in the visit history (visit ORDER)? */
function seenBefore(history: string[], a: string, b: string): boolean {
  const ai = history.indexOf(a);
  const bi = history.indexOf(b);
  return ai !== -1 && bi !== -1 && ai < bi;
}

class StoryLogicService {
  private rules: StoryRule[] = [];

  constructor() {
    this.initializeRules();
  }

  private initializeRules() {
    // Rule: visiting the anomaly for the first time opens the two paths.
    this.addRule({
      id: 'reveal_initial_paths',
      trigger: (state) => state.visitCounts['start'] === 1,
      effect: () => ({
        // The actual revealing of nodes/links is driven by NarrativePage; the
        // flag just records that the story has properly begun.
        flags: { initialPathsRevealed: true },
      }),
      priority: 100,
      once: true,
      executed: false,
    });

    // Rule: When path A is visited, reveal the whisper source.
    this.addRule({
      id: 'reveal_whisper_source',
      trigger: (state) => state.visitCounts['pathA'] === 1,
      effect: () => ({
        flags: { whisperSourceRevealed: true },
      }),
      priority: 90,
      once: true,
      executed: false,
    });

    // Rule: When path B is visited, reveal the echo chamber.
    this.addRule({
      id: 'reveal_echo_chamber',
      trigger: (state) => state.visitCounts['pathB'] === 1,
      effect: () => ({
        flags: { echoChamberRevealed: true },
      }),
      priority: 90,
      once: true,
      executed: false,
    });

    // Rule: When both branches have been entered, the anomaly is marked.
    this.addRule({
      id: 'paths_converge',
      trigger: (state) => state.visitCounts['pathA'] > 0 && state.visitCounts['pathB'] > 0,
      effect: () => ({
        flags: { bothPathsVisited: true },
      }),
      priority: 80,
      once: true,
      executed: false,
    });

    // Rule: Seeing BOTH sources (whisper crystal + echo chamber) crystallizes a
    // way through the anomaly — this unlocks the standard ending choice.
    this.addRule({
      id: 'both_sources_seen',
      trigger: (state) =>
        state.visitCounts['whisperSource'] > 0 && state.visitCounts['echoChamber'] > 0,
      effect: () => ({
        flags: { convergenceUnlocked: true },
      }),
      priority: 75,
      once: true,
      executed: false,
    });

    // Advanced rule: the SECRET ending. It depends on visit ORDER, not just
    // which nodes were seen: the player must cross directly from the echo
    // chamber to the whisper source (the echoChamber -> whisperSource resonance
    // shortcut, itself only available once both have been visited). That exact
    // adjacency at the end of history reveals the singularity.
    this.addRule({
      id: 'secret_path_discovery',
      trigger: (state) => {
        const recent = state.history.slice(-2);
        return recent.length === 2 && recent[0] === 'echoChamber' && recent[1] === 'whisperSource';
      },
      effect: () => ({
        flags: { secretPathDiscovered: true },
      }),
      priority: 70,
      once: true,
      executed: false,
    });
  }

  addRule(rule: StoryRule) {
    this.rules.push(rule);
  }

  /**
   * Re-arm every `once` rule. The rule engine is a module singleton with
   * MUTABLE `executed` state, which `RESET_STORY` (a pure reducer action)
   * cannot clear. Call this whenever play restarts (on reset, and when a fresh
   * graph is loaded) or a replay would silently skip already-fired once-rules.
   */
  reset() {
    this.rules.forEach((rule) => {
      rule.executed = false;
    });
  }

  evaluateState(state: StoryState): Partial<StoryState> {
    // Merge flag effects PER KEY. Effects return `{ flags: {...} }`; spreading
    // them directly would clobber the rest of state.flags, so we accumulate
    // into a single flags object instead.
    const mergedFlags: Record<string, boolean | number | string> = {};
    let touched = false;

    // Higher priority first.
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (rule.once && rule.executed) continue;

      if (rule.trigger(state)) {
        const changes = rule.effect(state);
        if (changes.flags) {
          Object.assign(mergedFlags, changes.flags);
          touched = true;
        }
        if (rule.once) {
          rule.executed = true;
        }
      }
    }

    return touched ? { flags: mergedFlags } : {};
  }

  /** True when the node is a terminal ending node. */
  isEnding(nodeId: string): boolean {
    return ENDING_NODE_IDS.has(nodeId);
  }

  getNodeText(nodeId: string, state: StoryState): string {
    const node = state.nodes[nodeId];
    if (!node) return '';

    const visited = (id: string) => (state.visitCounts[id] ?? 0) > 0;
    let text = node.text;

    switch (nodeId) {
      case 'start': {
        if ((state.visitCounts['start'] ?? 0) > 1) {
          text =
            'You re-examine the anomaly. The paths remain, but the anomaly itself feels... different now.';
        }
        if (state.flags['bothPathsVisited']) {
          text +=
            "\n\nSomething has changed. The paths you've traveled have left their mark on this place.";
        }
        if (state.flags['convergenceUnlocked']) {
          text +=
            '\n\nAt the anomaly’s core, the whispers and the echoes have braided into a single shimmering thread — a way through.';
        }
        if (state.flags['secretPathDiscovered']) {
          text +=
            '\n\nAnd behind that thread, where echo collapsed straight into whisper, a hairline tear has opened onto something that has no color at all.';
        }
        break;
      }

      case 'pathA': {
        // Reads differently if you already heard the echoes first.
        if (visited('echoChamber')) {
          text +=
            '\n\nBeneath the whispers you can hear them now: the echoes from the other path, bleeding through the walls.';
        }
        break;
      }

      case 'pathB': {
        if (visited('whisperSource')) {
          text +=
            '\n\nThe echoes have started to whisper — repeating, almost faithfully, the words the crystal spoke to you.';
        }
        break;
      }

      case 'whisperSource': {
        if ((state.visitCounts['whisperSource'] ?? 0) > 1) {
          text =
            'You return to the crystal. It already knows you — it finishes the thoughts you came here to think.';
        }
        if (visited('echoChamber')) {
          text +=
            '\n\nIts song now carries the echoes you heard in the other chamber, as though the two places were always the same place.';
        }
        break;
      }

      case 'echoChamber': {
        // Visit ORDER matters here: whether you met the whispers first changes
        // what the shadows look like.
        if (seenBefore(state.history, 'whisperSource', 'echoChamber')) {
          text +=
            '\n\nThe shadows at the edge of your vision wear the shape of the whispers you already met. They were waiting for you to arrive in this order.';
        } else if (visited('whisperSource')) {
          text +=
            '\n\nYou have heard the crystal since you first stood here; the shadows seem disappointed you came to them so late.';
        }
        if (state.flags['convergenceUnlocked']) {
          text +=
            '\n\nWhere the echoes are loudest, a thread of light leads back toward the whispers — a shortcut that did not exist before.';
        }
        break;
      }

      case 'convergence': {
        text =
          'The braided thread accepts you. Whisper and echo fold over each other until you cannot tell which voice is yours. You understand, finally, that you have always been here, and will arrive here again. This is the eternal return of the digital self.';
        if (state.flags['secretPathDiscovered']) {
          text +=
            '\n\n(But you suspect this loop is not the only way out. Somewhere, a tear is still open.)';
        }
        break;
      }

      case 'singularity': {
        text =
          'You step into the tear where echo became whisper with nothing in between. Order collapses. Every node you visited, in every sequence you could have chosen, happens at once and forever. There is no map here, no return — only the single point that was always underneath the story. You let go.';
        break;
      }

      default:
        break;
    }

    return text;
  }
}

export const storyLogicService = new StoryLogicService();
export default storyLogicService;
