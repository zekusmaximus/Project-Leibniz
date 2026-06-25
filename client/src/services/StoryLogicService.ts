// client/src/services/StoryLogicService.ts
import { StoryState, TextVariant, ProseBeat } from '../context/StoryTypes';
import { compileCondition, ConditionSpec } from './conditionDSL';
import { getVisitOrder } from './mapVisuals';

/**
 * One node's worth of the run-wide adaptation ledger: the visited node, its
 * first-visit order number, and the adaptive variants currently active there.
 */
export interface AdaptationLedgerEntry {
  nodeId: string;
  label: string;
  visitOrder: number;
  variants: TextVariant[];
}

/** One beat's resolution when rendering compositional prose. */
export interface ChosenPhrasing {
  beatId: string;
  phrasingId?: string;
  text: string;
  priority: number;
  // The `when` of the chosen phrasing, or undefined when the default fired.
  condition?: ConditionSpec;
}

/** The result of rendering a node's `prose` beats for the current state. */
export interface RenderedProse {
  text: string;
  chosen: ChosenPhrasing[];
}

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

export class StoryLogicService {
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
    this.proseCache.clear();
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

  // Compiled-predicate cache for prose beats, keyed by a stable string so the
  // condition is compiled once per (node, beat, slot). Cleared in reset().
  private proseCache = new Map<string, (state: StoryState) => boolean>();

  private getProsePredicate(cacheKey: string, spec: ConditionSpec): (state: StoryState) => boolean {
    let predicate = this.proseCache.get(cacheKey);
    if (!predicate) {
      predicate = compileCondition(spec);
      this.proseCache.set(cacheKey, predicate);
    }
    return predicate;
  }

  /**
   * Render a node's compositional `prose` for the current state. Each beat
   * resolves to AT MOST ONE phrasing — the highest-priority phrasing whose
   * `when` matches, falling back to the conditionless default; ties break on
   * author order. A beat whose `includeWhen` fails is omitted entirely, as is a
   * beat where nothing is eligible. The chosen phrasings are woven into one
   * continuous paragraph. Returns the woven text plus, per beat, which phrasing
   * fired (so the UI can explain the morph). Nodes with no `prose` return empty.
   */
  renderProse(nodeId: string, state: StoryState): RenderedProse {
    const node = state.nodes[nodeId];
    if (!node?.prose?.length) return { text: '', chosen: [] };
    return this.weaveBeats(node.prose, state, nodeId);
  }

  /**
   * Render the connective prose for TRAVERSING the edge `sourceId`→`targetId` — a
   * short bridge between two sections, woven by the same beats model. Returns
   * empty when the link has no prose. Lets the novel export (and the narrative
   * page) interleave transitions so the run reads as continuous prose.
   */
  renderTransition(sourceId: string, targetId: string, state: StoryState): RenderedProse {
    const link = state.links.find((l) => l.source === sourceId && l.target === targetId);
    if (!link?.prose?.length) return { text: '', chosen: [] };
    return this.weaveBeats(link.prose, state, `${sourceId}->${targetId}`);
  }

  /**
   * Core beat-weaving shared by node prose and edge (transition) prose. For each
   * beat: skip it if `includeWhen` fails; otherwise pick the highest-priority
   * phrasing whose `when` matches (ties → author order), falling back to the
   * conditionless default. Chosen phrasings are woven into one paragraph.
   * `keyPrefix` namespaces the compiled-predicate cache (node id, or edge key).
   */
  private weaveBeats(beats: ProseBeat[], state: StoryState, keyPrefix: string): RenderedProse {
    const chosen: ChosenPhrasing[] = [];
    for (const beat of beats) {
      if (beat.includeWhen) {
        const include = this.getProsePredicate(`${keyPrefix}::${beat.id}::inc`, beat.includeWhen);
        if (!include(state)) continue;
      }

      let best: ChosenPhrasing | undefined;
      beat.phrasings.forEach((phrasing, i) => {
        const eligible =
          phrasing.when === undefined ||
          this.getProsePredicate(`${keyPrefix}::${beat.id}::p${i}`, phrasing.when)(state);
        if (!eligible) return;
        const priority = phrasing.priority ?? 0;
        // Strictly higher priority wins; ties keep the earlier (author-order) one.
        if (!best || priority > best.priority) {
          best = {
            beatId: beat.id,
            phrasingId: phrasing.id,
            text: phrasing.text,
            priority,
            condition: phrasing.when,
          };
        }
      });

      if (best) chosen.push(best);
    }

    const text = chosen
      .map((c) => c.text.trim())
      .filter((t) => t.length > 0)
      .join(' ');
    return { text, chosen };
  }

  /**
   * The adaptive fragments currently active at a node, in a single shape the UI
   * can explain via `describeCondition`. For a legacy node this is its matching
   * `textVariants`; for a prose node it is the conditionally-chosen phrasings
   * (the morphs) — beats that fell back to their default are omitted, since a
   * default has no path-specific reason to surface. Used by the "Why this text?"
   * panel and the run-wide adaptation ledger so BOTH prose models are legible.
   */
  getActiveAdaptations(nodeId: string, state: StoryState): TextVariant[] {
    const node = state.nodes[nodeId];
    if (node?.prose?.length) {
      return this.renderProse(nodeId, state)
        .chosen.filter((c): c is ChosenPhrasing & { condition: ConditionSpec } => c.condition !== undefined)
        .map((c) => ({ id: c.phrasingId ?? c.beatId, text: c.text, priority: c.priority, condition: c.condition }));
    }
    return this.getMatchingVariants(nodeId, state);
  }

  /**
   * A run-wide view of every adaptive fragment currently active across the
   * nodes the reader has visited — node by node, in first-visit order, each
   * with its matching variants (highest priority first). This powers the
   * NarrativePage adaptation ledger: it makes the BREADTH of the story's
   * reaction (to which nodes were visited and in what order) legible beyond the
   * current node alone. Nodes with no currently-matching variant are omitted, so
   * an empty ledger means nothing has adapted yet.
   */
  getAdaptationLedger(state: StoryState): AdaptationLedgerEntry[] {
    const order = getVisitOrder(state.history);
    return Object.keys(order)
      .map((nodeId) => ({
        nodeId,
        label: state.nodes[nodeId]?.label ?? nodeId,
        visitOrder: order[nodeId],
        variants: this.getActiveAdaptations(nodeId, state),
      }))
      .filter((entry) => entry.variants.length > 0)
      .sort((a, b) => a.visitOrder - b.visitOrder);
  }

  getNodeText(nodeId: string, state: StoryState): string {
    const node = state.nodes[nodeId];
    if (!node) return '';

    // Compositional prose (the beats model) takes precedence: the SENTENCE
    // morphs by path rather than the base text getting a fragment appended. A
    // node without `prose` falls back to the legacy text + appended variants
    // path below, so migration to beats is incremental and per-node.
    if (node.prose?.length) {
      return this.renderProse(nodeId, state).text;
    }

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
