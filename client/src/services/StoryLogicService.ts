// client/src/services/StoryLogicService.ts
import { StoryState, TextVariant } from '../context/StoryTypes';
import { compileCondition } from './conditionDSL';

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
const ENDING_NODE_IDS = new Set<string>([
  'convergence',
  'singularity',
  'chorus',
  'descent',
  'emergence',
  'persistence',
]);

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

    // Rule: seeing ALL THREE sources (whisper crystal + echo chamber + the Null)
    // lets the three voices hold a chord — unlocks the Chorus ending. This one is
    // about WHICH nodes were seen, not order.
    this.addRule({
      id: 'all_sources_seen',
      trigger: (state) =>
        state.visitCounts['whisperSource'] > 0 &&
        state.visitCounts['echoChamber'] > 0 &&
        state.visitCounts['silenceSource'] > 0,
      effect: () => ({
        flags: { chorusUnlocked: true },
      }),
      priority: 65,
      once: true,
      executed: false,
    });

    // Order endings: the order-determined ways through the three sources. These
    // fire only when the LAST three visits are exactly the three sources in a
    // given order (reachable by chaining the source↔source resonance shortcuts),
    // so the literal order you walk them picks the ending.
    //   descent     = whisper → echo → silence (the voices fading out)
    //   emergence   = silence → echo → whisper (booting up out of the Null)
    //   persistence = whisper → silence → echo (the word erased, its echo kept)
    // Reuse the condition DSL rather than re-implementing the tail check.
    const descentOrder = compileCondition({
      kind: 'historyEndsWith',
      sequence: ['whisperSource', 'echoChamber', 'silenceSource'],
    });
    this.addRule({
      id: 'descent_order',
      trigger: (state) => descentOrder(state),
      effect: () => ({
        flags: { descentDiscovered: true },
      }),
      priority: 60,
      once: true,
      executed: false,
    });

    const emergenceOrder = compileCondition({
      kind: 'historyEndsWith',
      sequence: ['silenceSource', 'echoChamber', 'whisperSource'],
    });
    this.addRule({
      id: 'emergence_order',
      trigger: (state) => emergenceOrder(state),
      effect: () => ({
        flags: { emergenceDiscovered: true },
      }),
      priority: 60,
      once: true,
      executed: false,
    });

    const persistenceOrder = compileCondition({
      kind: 'historyEndsWith',
      sequence: ['whisperSource', 'silenceSource', 'echoChamber'],
    });
    this.addRule({
      id: 'persistence_order',
      trigger: (state) => persistenceOrder(state),
      effect: () => ({
        flags: { persistenceDiscovered: true },
      }),
      priority: 60,
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
    this.variantCache.clear();
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

  private variantCache = new Map<string, (state: StoryState) => boolean>();

  private getVariantPredicate(nodeId: string, variant: TextVariant): (state: StoryState) => boolean {
    const cacheKey = `${nodeId}::${variant.id}`;
    let predicate = this.variantCache.get(cacheKey);
    if (!predicate) {
      predicate = compileCondition(variant.condition);
      this.variantCache.set(cacheKey, predicate);
    }
    return predicate;
  }

  getMatchingVariants(nodeId: string, state: StoryState): TextVariant[] {
    const node = state.nodes[nodeId];
    if (!node?.textVariants?.length) return [];
    return node.textVariants
      .filter((v) => {
        const predicate = this.getVariantPredicate(nodeId, v);
        return predicate(state);
      })
      .sort((a, b) => b.priority - a.priority);
  }

  getNodeText(nodeId: string, state: StoryState): string {
    const node = state.nodes[nodeId];
    if (!node) return '';

    let text = node.text;

    // Append matching text variants. The base text always renders; each
    // matching variant (highest priority first) is appended on top. All of the
    // adaptive prose that used to live in a hardcoded per-node switch here is
    // now authored as `textVariants` on the nodes themselves (in the canonical
    // client/src/data/storyGraph.json), so it works identically whether the graph
    // is served from the backend or loaded from the offline fallback.
    const matchingVariants = this.getMatchingVariants(nodeId, state);
    for (const variant of matchingVariants) {
      if (variant.text) text += '\n\n' + variant.text;
    }

    return text;
  }
}

export const storyLogicService = new StoryLogicService();
export default storyLogicService;
