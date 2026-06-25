// client/src/services/narrativeExport.ts
//
// Turns a playthrough into the reader's personal NOVEL: the exact, ordered prose
// they lived through, one section per visit (repeats kept), each rendered as it
// read AT THAT STEP — because the morphing prose depends on what had been seen
// and how recently, the text a node showed on your third pass differs from your
// first. We reconstruct that faithfully by REPLAYING `state.history` from a
// cleared graph through the real reducer + rule engine, snapshotting the woven
// prose after each visit. Deterministic: the same path always yields the same
// novel, which is what makes the download stable and reproducible.
//
// The section model carries a reserved `chapter` slot so later structural work
// (chapter grouping, connective edge-prose interleaved between sections) can
// populate it without changing this contract or the Markdown serializer.
import type { StoryState } from '../context/StoryTypes';
import { storyReducer } from '../context/StoryReducer';
import { StoryLogicService } from './StoryLogicService';

/** One node-visit as it was experienced, in order. */
export interface NovelSection {
  nodeId: string;
  label: string;
  /** 1-based: which visit to THIS node this section is (a revisit reads differently). */
  visitNumber: number;
  /** The woven prose exactly as it read at this step. */
  text: string;
  /** Connective edge-prose that bridges from the previous section into this one. */
  transition?: string;
  isEnding: boolean;
  /** Reserved for future structure (chapter grouping). */
  chapter?: string;
}

export interface NovelTranscript {
  sections: NovelSection[];
  openingNodeId?: string;
  /** The terminal node reached, if the run ended on one. */
  endingId?: string;
  /** Number of sections (= total visits, repeats included). */
  stepCount: number;
}

export interface NovelMeta {
  title?: string;
  /** Pass an ISO timestamp explicitly so the serializer stays pure/testable. */
  generatedAt?: string;
}

/**
 * Replay a run's history and capture the prose experienced at every step. Uses a
 * PRIVATE StoryLogicService instance so the replay never disturbs the live app's
 * singleton rule-engine state.
 */
export function buildTranscript(state: StoryState): NovelTranscript {
  const logic = new StoryLogicService();

  // Start from the same graph but with progress cleared, then walk the recorded
  // history forward. visitCounts/flags/history are rebuilt step by step, which is
  // all the morphing conditions read — so each snapshot is faithful to that step.
  let s: StoryState = { ...state, visitCounts: {}, flags: {}, history: [] };

  const visitNo: Record<string, number> = {};
  const sections: NovelSection[] = [];

  state.history.forEach((nodeId, i) => {
    const prevId = i > 0 ? state.history[i - 1] : undefined;
    s = storyReducer(s, { type: 'VISIT_NODE', nodeId });

    // Mirror the live provider: run the rule engine and apply any flag changes
    // before rendering, so flag-gated prose reads as it did during play.
    const changes = logic.evaluateState(s);
    if (changes.flags) {
      for (const [key, value] of Object.entries(changes.flags)) {
        s = storyReducer(s, { type: 'SET_FLAG', key, value });
      }
    }

    // The connective prose for crossing the edge that led here (if any), woven
    // against the state at this step so a crossing can morph by what came before.
    const transition = prevId ? logic.renderTransition(prevId, nodeId, s).text : '';

    visitNo[nodeId] = (visitNo[nodeId] ?? 0) + 1;
    sections.push({
      nodeId,
      label: s.nodes[nodeId]?.label ?? nodeId,
      visitNumber: visitNo[nodeId],
      text: logic.getNodeText(nodeId, s),
      transition: transition || undefined,
      isEnding: logic.isEnding(nodeId),
    });
  });

  const last = sections[sections.length - 1];
  return {
    sections,
    openingNodeId: sections[0]?.nodeId,
    endingId: last?.isEnding ? last.nodeId : undefined,
    stepCount: sections.length,
  };
}

/** Slugify a label for a filename. */
export function novelFilename(transcript: NovelTranscript): string {
  const tail = transcript.endingId ?? transcript.openingNodeId ?? 'unwritten';
  return `eternal-return-${tail}.md`;
}

/**
 * Serialize a transcript to a self-contained Markdown novel: a title page, a
 * colophon describing THIS permutation (how it opened, where it ended, how many
 * passages), then one `##` chapter per visited section, in order, repeats kept.
 */
export function toMarkdown(transcript: NovelTranscript, meta: NovelMeta = {}): string {
  const title = meta.title ?? 'Eternal Return of the Digital Self';
  const out: string[] = [];

  out.push(`# ${title}`);
  out.push('');
  out.push('*A novel assembled by your passage — the unique permutation you read.*');
  out.push('');

  // Colophon / permutation fingerprint.
  const opening = transcript.sections[0]?.label;
  const ending = transcript.endingId
    ? transcript.sections[transcript.sections.length - 1]?.label
    : undefined;
  out.push('> ' + [
    opening ? `**Opened with:** ${opening}` : null,
    ending ? `**Ended at:** ${ending}` : '**Ending:** not yet reached',
    `**Passages:** ${transcript.stepCount}`,
    meta.generatedAt ? `**Assembled:** ${meta.generatedAt}` : null,
  ].filter(Boolean).join('  \n> '));
  out.push('');
  out.push('---');
  out.push('');

  transcript.sections.forEach((section, i) => {
    const ret = section.visitNumber > 1 ? ` *(return ${section.visitNumber})*` : '';
    out.push(`## ${i + 1}. ${section.label}${ret}`);
    out.push('');
    if (section.transition) {
      // A short connective bridge into this chapter, set in italics.
      out.push(`*${section.transition}*`);
      out.push('');
    }
    out.push(section.text);
    out.push('');
  });

  if (transcript.endingId) {
    out.push('---');
    out.push('');
    out.push('*— An Ending —*');
    out.push('');
  }

  return out.join('\n');
}

/** Convenience: build the transcript and render it straight to Markdown. */
export function buildNovelMarkdown(state: StoryState, meta: NovelMeta = {}): string {
  return toMarkdown(buildTranscript(state), meta);
}
