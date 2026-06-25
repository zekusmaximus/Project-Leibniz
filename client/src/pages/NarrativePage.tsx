// src/pages/NarrativePage.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStory } from '../context/context';
import MiniMap from '../components/MiniMap';
import storyLogicService from '../services/StoryLogicService';
import { describeCondition } from '../services/conditionDSL';
import { getVisitOrder, getTrailLinkKeys, getVisitRecency } from '../services/mapVisuals';
import { buildTranscript, toMarkdown, novelFilename } from '../services/narrativeExport';
import { useRef, useState, useEffect, useCallback } from 'react';

const NarrativePage = () => {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();
  const { state, visitNode, revealNode, revealLink, getVisibleNodes, getVisibleLinks, getCurrentNode, resetStory } = useStory();
  const [backgroundColor, setBackgroundColor] = useState('#1e232d');
  const [showAdaptations, setShowAdaptations] = useState(false);
  const [showLedger, setShowLedger] = useState(false);

  // Add this ref for the mini map zoom function
  const miniMapZoomToFitRef = useRef<(() => void) | null>(null);
  
  // Add the handler
  const handleMiniMapZoomToFit = useCallback(() => {
    if (miniMapZoomToFitRef.current) {
      miniMapZoomToFitRef.current();
    }
  }, []);

  // Effect to handle node visiting and revealing connected paths
  useEffect(() => {
    if (!nodeId) return;
    
    const currentNode = state.nodes[nodeId];
    if (currentNode) {
      // First, make sure current node is revealed
      if (!currentNode.isRevealed) {
        revealNode(nodeId, { ...currentNode, isRevealed: true });
      }
      
      // Then visit it to update count if not already visited
      if (!state.visitCounts[nodeId] || state.visitCounts[nodeId] === 0) {
        visitNode(nodeId);
      }
      
      // Next, make sure any choices are revealed as nodes
      if (currentNode.choices) {
        currentNode.choices.forEach(choice => {
          const targetNode = state.nodes[choice.targetId];
          if (targetNode) {
            // Reveal the target node
            if (!targetNode.isRevealed) {
              revealNode(choice.targetId, { ...targetNode, isRevealed: true });
            }
            
            // Find and reveal the link between current node and target
            const linkToReveal = state.links.find(link => 
              link.source === nodeId && 
              link.target === choice.targetId
            );
            
            if (linkToReveal && !linkToReveal.isRevealed) {
              revealLink({
                ...linkToReveal,
                isRevealed: true
              });
            }
          }
        });
      }
      
      // Also reveal any links coming into this node
      state.links.forEach(link => {
        if (link.target === nodeId && !link.isRevealed) {
          const sourceNode = state.nodes[link.source];
          if (sourceNode && sourceNode.isRevealed) {
            revealLink({ ...link, isRevealed: true });
          }
        }
      });
      
      // Set background color based on node
      setBackgroundColor(currentNode.color || '#1e232d');
    }
    // Reveal logic should run on node/graph changes only; re-running on every
    // visitCounts change would re-trigger reveals on each visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, state.nodes, state.links, visitNode, revealNode, revealLink]);
  
  // Get current node text. getNodeText joins the base text and each adaptive
  // text variant with blank lines, so split on those to render real paragraphs
  // (a single <p> would collapse the newlines into one run-on block).
  const currentNodeText = nodeId
    ? storyLogicService.getNodeText(nodeId, state)
    : "";
  const paragraphs = currentNodeText.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  // Connective prose for the edge that led here (if the previous step has one) —
  // a short bridge so the reading flows rather than jumping between blocks.
  const prevNodeId =
    state.history.length >= 2 ? state.history[state.history.length - 2] : undefined;
  const transition =
    nodeId && prevNodeId ? storyLogicService.renderTransition(prevNodeId, nodeId, state).text : '';

  // "Why this text?" — the adaptive fragments currently appended to the base
  // text, plus a plain-language reason each one fired. This surfaces that the
  // story is reacting to which nodes were visited and in what order.
  const activeVariants = nodeId ? storyLogicService.getActiveAdaptations(nodeId, state) : [];
  const resolveLabel = (id: string) => state.nodes[id]?.label ?? id;
  const snippet = (t: string) => (t.length > 70 ? t.slice(0, 67).trimEnd() + '…' : t);

  // Run-wide adaptation ledger: every adaptive fragment currently active across
  // ALL the places the reader has been, in the order they first saw them. This
  // makes the breadth of the story's order-dependence legible — not just how the
  // current node reads, but how the whole journey has adapted.
  const ledger = storyLogicService.getAdaptationLedger(state);
  const ledgerTotal = ledger.reduce((sum, entry) => sum + entry.variants.length, 0);

  // Order-legibility annotations (pure, from mapVisuals) — same as the main map,
  // so the minimap shows the sequence walked and the trail too.
  const visitOrder = getVisitOrder(state.history);
  const recency = getVisitRecency(state.history);
  const trailKeys = getTrailLinkKeys(state.history, state.links);

  // Convert story nodes to D3 node format for MiniMap
  const d3Nodes = getVisibleNodes().map(node => ({
    id: node.id,
    label: node.label,
    x: node.x,
    y: node.y,
    color: node.color,
    size: node.size,
    visitedCount: node.visitedCount,
    visitOrder: visitOrder[node.id],
    recency: recency[node.id]
  }));

  const d3Links = getVisibleLinks().map(link => ({
    source: link.source,
    target: link.target,
    color: link.color,
    width: link.width,
    onTrail: trailKeys.has(`${link.source}->${link.target}`)
  }));


  const handleMiniMapClick = (x: number, y: number) => {
    // Find the closest node to the clicked coordinates
    let closestNode = d3Nodes[0];
    let minDistance = Infinity;
    
    d3Nodes.forEach(node => {
      const dx = (node.x || 0) - x;
      const dy = (node.y || 0) - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    });
    
    // Navigate to the selected node
    if (closestNode && closestNode.id) {
      navigate(`/narrative/${closestNode.id}`);
      visitNode(closestNode.id);
    }
  };

  const handleBackToMap = () => {
    navigate('/');
  };

  // Whether this node is a terminal ending. Endings hide all further choices
  // and offer a restart instead.
  const isEnding = nodeId ? storyLogicService.isEnding(nodeId) : false;

  // Filter choices based on conditions if present (suppressed entirely at endings).
  const nodeChoices = isEnding
    ? []
    : getCurrentNode()?.choices?.filter(
        choice => !choice.condition || choice.condition(state)
      );

  const handleRestart = () => {
    resetStory();
    navigate('/');
  };

  // Download the reader's personal novel: the exact prose they've experienced so
  // far, in visit order (repeats kept), as a Markdown file. Builds the transcript
  // once and reuses it for both the content and the filename.
  const handleDownloadNovel = () => {
    const transcript = buildTranscript(state);
    if (transcript.stepCount === 0) return;
    const markdown = toMarkdown(transcript, { generatedAt: new Date().toISOString() });
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = novelFilename(transcript);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      className="narrative-page"
      style={{ backgroundColor }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="narrative-content">
        <button className="back-button" onClick={handleBackToMap}>
          Back to Map
        </button>
        
        <h2>{getCurrentNode()?.label || ''}</h2>
        
        <div className="story-text-container">
          {transition && <p className="story-transition"><em>{transition}</em></p>}

          {paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}

          {activeVariants.length > 0 && (
            <div className="adaptations">
              <button
                type="button"
                className="adaptations-toggle"
                aria-expanded={showAdaptations}
                onClick={() => setShowAdaptations((v) => !v)}
              >
                {showAdaptations ? 'Hide adaptations' : 'Why this text?'} ({activeVariants.length})
              </button>

              {showAdaptations && (
                <ul className="adaptations-list">
                  {activeVariants.map((variant) => (
                    <li key={variant.id} className="adaptation-item">
                      <span className="adaptation-snippet">“{snippet(variant.text)}”</span>
                      <span className="adaptation-reason">
                        — because {describeCondition(variant.condition, resolveLabel)}.
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {ledgerTotal > 0 && (
            <div className="adaptations ledger">
              <button
                type="button"
                className="adaptations-toggle"
                aria-expanded={showLedger}
                onClick={() => setShowLedger((v) => !v)}
              >
                {showLedger ? 'Hide journey' : 'How your journey has adapted'} ({ledgerTotal})
              </button>

              {showLedger && (
                <div className="ledger-list">
                  {ledger.map((entry) => (
                    <div key={entry.nodeId} className="ledger-entry">
                      <p className="ledger-node">
                        <span className="ledger-order">{entry.visitOrder}</span>
                        {entry.label}
                      </p>
                      <ul className="adaptations-list">
                        {entry.variants.map((variant) => (
                          <li key={variant.id} className="adaptation-item">
                            <span className="adaptation-snippet">“{snippet(variant.text)}”</span>
                            <span className="adaptation-reason">
                              — because {describeCondition(variant.condition, resolveLabel)}.
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isEnding && (
            <div className="story-ending">
              <p className="ending-label">— An Ending —</p>
              <button className="choice-button" onClick={handleDownloadNovel}>
                Download your novel
              </button>
              <button className="choice-button" onClick={handleRestart}>
                Begin again
              </button>
            </div>
          )}

          {!isEnding && state.history.length > 0 && (
            <div className="novel-download">
              <button
                type="button"
                className="adaptations-toggle"
                onClick={handleDownloadNovel}
                title="Download the prose you've read so far, in order, as Markdown"
              >
                Download your novel so far ({state.history.length})
              </button>
            </div>
          )}

          {nodeChoices && nodeChoices.length > 0 && (
            <div className="story-choices">
              <p>What would you like to do?</p>
              <div className="choice-buttons">
                {nodeChoices.map(choice => (
                  <button 
                    key={choice.targetId} 
                    onClick={() => {
                      // First, make sure the target node is revealed
                      const targetNode = state.nodes[choice.targetId];
                      if (targetNode && !targetNode.isRevealed) {
                        revealNode(choice.targetId, {
                          ...targetNode,
                          isRevealed: true
                        });
                      }
                      
                      // Next, reveal the link between current node and target
                      const link = state.links.find(l => 
                        l.source === nodeId && 
                        l.target === choice.targetId
                      );
                      if (link && !link.isRevealed) {
                        revealLink({
                          ...link,
                          isRevealed: true
                        });
                      }
                      
                      // Then visit the node (this will increment visit count)
                      visitNode(choice.targetId);
                      
                      // Finally navigate to the target node
                      navigate(`/narrative/${choice.targetId}`);
                    }}
                    className="choice-button"
                  >
                    {choice.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="mini-map-container">
        {/* Add zoom control to mini map */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          marginBottom: '5px' 
        }}>
          <button
            onClick={handleMiniMapZoomToFit}
            title="Fit all nodes in view"
            className="mini-map-zoom-button"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6"></path>
              <path d="M9 21H3v-6"></path>
              <path d="M21 3l-7 7"></path>
              <path d="M3 21l7-7"></path>
            </svg>
          </button>
        </div>
        
        <MiniMap
          nodesData={d3Nodes}
          linksData={d3Links}
          width={180}
          height={180}
          currentNodeId={nodeId}
          onMiniMapClick={handleMiniMapClick}
          onZoomToFitRef={miniMapZoomToFitRef}
        />
      </div>
    </motion.div>
  );
};

export default NarrativePage;