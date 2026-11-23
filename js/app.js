const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
const regexInput = document.querySelector('#regex-input');
const regexHint = document.querySelector('#regex-hint');
const simulationForm = document.querySelector('#simulator-form');
const testStringInput = document.querySelector('#test-string');
const simulationModeInput = document.querySelector('#simulation-mode');
const simulationResult = document.querySelector('#simulation-result');
const executionPath = document.querySelector('#execution-path');
const executionTrace = document.querySelector('#execution-trace');
const traceCurrent = document.querySelector('#trace-current');
const canvasStatus = document.querySelector('#canvas-status');
const automataCounts = document.querySelector('#automata-counts');
const tableHead = document.querySelector('#transition-table-head');
const tableBody = document.querySelector('#transition-table-body');
const tableKind = document.querySelector('#table-kind');
const tableCaption = document.querySelector('#table-caption');
const tableNote = document.querySelector('#table-note');
const generatorButtons = Array.from(document.querySelectorAll('[data-generator]'));
const svgNamespace = 'http://www.w3.org/2000/svg';

let currentExpression = null;
let currentNFA = null;
let currentDFA = null;
let currentMinimizedDFA = null;
let lastSimulationMode = null;

function generatorForTab(tab) {
  if (!tab || currentExpression !== regexInput.value) return null;

  if (tab.id === 'nfa-tab') return currentNFA ? 'nfa' : null;
  if (tab.id === 'dfa-tab') return currentDFA ? 'dfa' : null;
  if (tab.id === 'minimized-tab') return currentMinimizedDFA ? 'minimized' : null;
  if (tab.id === 'simulator-tab') {
    const mode = lastSimulationMode ?? simulationModeInput.value;
    if (mode === 'nfa' && currentNFA) return 'nfa';
    if (mode === 'dfa' && currentDFA) return 'dfa';
  }
  return null;
}

function syncGeneratorButtons(tab = tabs.find((candidate) => candidate.getAttribute('aria-selected') === 'true')) {
  const activeGenerator = generatorForTab(tab);
  generatorButtons.forEach((button) => {
    const isActive = button.dataset.generator === activeGenerator;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function activateTab(selectedTab, moveFocus = false) {
  tabs.forEach((tab) => {
    const isSelected = tab === selectedTab;
    tab.setAttribute('aria-selected', String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
  });

  panels.forEach((panel) => {
    panel.hidden = panel.id !== selectedTab.getAttribute('aria-controls');
  });

  syncGeneratorButtons(selectedTab);
  if (moveFocus) selectedTab.focus();
}

function setCanvasStatus(message, isReady = true) {
  canvasStatus.textContent = message;
  canvasStatus.closest('.canvas-state').classList.toggle('is-ready', isReady);
}

function updateCounts(nfa, dfa = null, minimizedDFA = null) {
  automataCounts.textContent = `NFA: ${nfa.states.length} / DFA: ${dfa ? dfa.states.length : '—'}${minimizedDFA ? ` / Min: ${minimizedDFA.states.length}` : ''}`;
}

function ensureCurrentNFA() {
  if (currentNFA && currentExpression === regexInput.value) return currentNFA;
  currentNFA = window.AutomataNFA.createFromRegex(regexInput.value);
  currentExpression = regexInput.value;
  currentDFA = null;
  currentMinimizedDFA = null;
  return currentNFA;
}

function ensureCurrentDFA() {
  const nfa = ensureCurrentNFA();
  if (currentDFA && currentExpression === regexInput.value) return currentDFA;
  currentDFA = window.SubsetConstruction.convert(nfa);
  if (!window.AutomataSimulator.verifyEquivalent(nfa, currentDFA)) {
    currentDFA = null;
    throw new Error('The generated DFA did not pass language-equivalence verification.');
  }
  currentMinimizedDFA = null;
  return currentDFA;
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(svgNamespace, name);
  Object.entries(attributes).forEach(([attribute, value]) => element.setAttribute(attribute, value));
  return element;
}

function getGraphData(automaton, kind) {
  if (kind === 'nfa') {
    return {
      states: automaton.states.map((id) => ({ id, nfaStates: null })),
      transitions: automaton.transitions,
      startState: automaton.startState,
      acceptingStates: new Set(automaton.acceptingStates),
    };
  }

  const transitions = automaton.states.flatMap((state) => automaton.alphabet.map((symbol) => ({
    from: state.id,
    to: state.transitions[symbol],
    symbol,
  })));
  return {
    states: automaton.states,
    transitions,
    startState: automaton.startState,
    acceptingStates: new Set(automaton.acceptingStates),
  };
}

function renderGraph(svg, automaton, kind) {
  const emptyState = svg.parentElement.querySelector('.graph-empty');
  if (emptyState) emptyState.hidden = true;
  svg.removeAttribute('hidden');
  const graph = getGraphData(automaton, kind);
  const stateIds = graph.states.map((state) => state.id);
  const outgoing = new Map(stateIds.map((id) => [id, []]));
  graph.transitions.forEach((transition) => outgoing.get(transition.from)?.push(transition.to));

  const ranks = new Map([[graph.startState, 0]]);
  const pending = [graph.startState];
  for (let index = 0; index < pending.length; index += 1) {
    const stateId = pending[index];
    for (const target of outgoing.get(stateId) ?? []) {
      if (ranks.has(target)) continue;
      ranks.set(target, ranks.get(stateId) + 1);
      pending.push(target);
    }
  }

  const statesByRank = new Map();
  graph.states.forEach((state) => {
    const rank = ranks.get(state.id) ?? 0;
    if (!statesByRank.has(rank)) statesByRank.set(rank, []);
    statesByRank.get(rank).push(state);
  });
  const maxRank = Math.max(...statesByRank.keys());
  const maxColumnCount = Math.max(...Array.from(statesByRank.values(), (states) => states.length));
  const selfLoopCounts = new Map();
  graph.transitions.forEach((transition) => {
    if (transition.from === transition.to) {
      selfLoopCounts.set(transition.from, (selfLoopCounts.get(transition.from) ?? 0) + 1);
    }
  });
  const maxSelfLoopCount = Math.max(0, ...selfLoopCounts.values());
  const longestSubset = kind === 'dfa'
    ? Math.max(...graph.states.map((state) => `{${state.nfaStates.join(',')}}`.length))
    : 0;
  const longestGroup = kind === 'minimized'
    ? Math.max(...graph.states.map((state) => `{${state.members.join(',')}}`.length))
    : 0;
  const columnGap = Math.max(250, 145 + Math.max(longestSubset, longestGroup) * 7);
  const width = Math.max(760, 170 + maxRank * columnGap + (longestSubset + longestGroup) * 2);
  const graphHeight = Math.max(300, (maxColumnCount + 1) * 140);
  const firstStateY = graphHeight / (maxColumnCount + 1);
  const loopTopPadding = maxSelfLoopCount > 0
    ? Math.max(0, 93 + (maxSelfLoopCount - 1) * 22 - firstStateY)
    : 0;
  const height = graphHeight + loopTopPadding;
  const positions = new Map();

  statesByRank.forEach((states, rank) => {
    states.forEach((state, index) => {
      positions.set(state.id, {
        x: 65 + rank * columnGap,
        y: loopTopPadding + (graphHeight * (index + 1)) / (states.length + 1),
      });
    });
  });

  const directedEdgeCounts = new Map();
  const edgeIndexes = new Map();
  graph.transitions.forEach((transition) => {
    const key = JSON.stringify([transition.from, transition.to]);
    directedEdgeCounts.set(key, (directedEdgeCounts.get(key) ?? 0) + 1);
  });

  const markerId = `${kind}-arrowhead`;
  const marker = svgElement('marker', {
    id: markerId,
    markerWidth: '8',
    markerHeight: '8',
    refX: '7',
    refY: '4',
    orient: 'auto',
    markerUnits: 'userSpaceOnUse',
  });
  marker.append(svgElement('path', {
    d: 'M0 0L8 4L0 8',
    fill: 'none',
    stroke: '#547C83',
    'stroke-width': '1.2',
  }));
  const defs = svgElement('defs');
  defs.append(marker);
  const edgeElements = [];

  for (const edge of graph.transitions) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    const edgeKey = JSON.stringify([edge.from, edge.to]);
    const reverseKey = JSON.stringify([edge.to, edge.from]);
    const edgeIndex = edgeIndexes.get(edgeKey) ?? 0;
    edgeIndexes.set(edgeKey, edgeIndex + 1);
    let pathData;
    let labelX;
    let labelY;

    if (edge.from === edge.to) {
      const loopOffset = edgeIndex * 22;
      pathData = `M ${from.x - 15} ${from.y - 22} C ${from.x - 48} ${from.y - 73 - loopOffset}, ${from.x + 48} ${from.y - 73 - loopOffset}, ${from.x + 15} ${from.y - 22}`;
      labelX = from.x;
      labelY = from.y - 66 - loopOffset;
    } else {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      const normalX = dy / distance;
      const normalY = -dx / distance;
      const startX = from.x + (dx / distance) * 27;
      const startY = from.y + (dy / distance) * 27;
      const endX = to.x - (dx / distance) * 29;
      const endY = to.y - (dy / distance) * 29;
      const hasReverseEdge = directedEdgeCounts.has(reverseKey);
      const parallelCount = directedEdgeCounts.get(edgeKey);
      const segmentDx = endX - startX;
      const segmentDy = endY - startY;
      const segmentLengthSquared = segmentDx * segmentDx + segmentDy * segmentDy;
      const clearance = kind === 'nfa' ? 39 : 49;
      const obstacles = graph.states
        .filter((state) => state.id !== edge.from && state.id !== edge.to)
        .map((state) => {
          const point = positions.get(state.id);
          const projection = ((point.x - startX) * segmentDx + (point.y - startY) * segmentDy) / segmentLengthSquared;
          const closestX = startX + projection * segmentDx;
          const closestY = startY + projection * segmentDy;
          const signedOffset = (point.x - closestX) * normalX + (point.y - closestY) * normalY;
          return { projection, signedOffset };
        })
        .filter((obstacle) => obstacle.projection > 0.08 && obstacle.projection < 0.92
          && Math.abs(obstacle.signedOffset) < clearance);
      const needsCurve = hasReverseEdge || parallelCount > 1 || obstacles.length > 0;

      if (needsCurve) {
        const bendDirection = hasReverseEdge || parallelCount > 1
          ? 1
          : obstacles[0].signedOffset >= 0 ? -1 : 1;
        let bend = 30 + edgeIndex * 24;
        for (const obstacle of obstacles) {
          const curveWeight = 2 * obstacle.projection * (1 - obstacle.projection);
          const clearanceBend = (clearance + bendDirection * obstacle.signedOffset) / curveWeight;
          bend = Math.max(bend, clearanceBend);
        }
        const signedBend = bend * bendDirection;
        const controlX = (startX + endX) / 2 + normalX * signedBend;
        const controlY = (startY + endY) / 2 + normalY * signedBend;
        pathData = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
        labelX = (startX + 2 * controlX + endX) / 4 + normalX * signedBend / Math.abs(signedBend) * 9;
        labelY = (startY + 2 * controlY + endY) / 4 + normalY * signedBend / Math.abs(signedBend) * 9;
      } else {
        pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
        labelX = (startX + endX) / 2 + normalX * 11;
        labelY = (startY + endY) / 2 + normalY * 11;
      }
    }

    const symbolLabel = edge.symbol === window.AutomataNFA.EPSILON ? 'ε' : edge.symbol;
    edgeElements.push(svgElement('path', {
      class: 'edge transition-edge',
      d: pathData,
      'marker-end': `url(#${markerId})`,
      'data-from': edge.from,
      'data-to': edge.to,
      'data-symbol': symbolLabel,
    }));
    const label = svgElement('text', {
      class: 'edge-label',
      x: labelX,
      y: labelY,
      'data-from': edge.from,
      'data-to': edge.to,
      'data-symbol': symbolLabel,
    });
    label.textContent = symbolLabel;
    edgeElements.push(label);
  }

  if (kind === 'nfa') {
    const start = positions.get(graph.startState);
    edgeElements.push(svgElement('path', {
      class: 'edge start-arrow',
      d: `M ${start.x - 52} ${start.y} L ${start.x - 29} ${start.y}`,
      'marker-end': `url(#${markerId})`,
    }));
  }

  const stateElements = [];
  for (const state of graph.states) {
    const position = positions.get(state.id);
    const isAccepting = graph.acceptingStates.has(state.id);
    const stateClass = ['state', isAccepting ? 'state-final' : '', state.id === graph.startState ? 'state-start' : '']
      .filter(Boolean)
      .join(' ');
    stateElements.push(svgElement('circle', {
      class: stateClass,
      cx: position.x,
      cy: position.y,
      r: '27',
      'data-state-id': state.id,
    }));
    if (isAccepting) {
      stateElements.push(svgElement('circle', {
        class: 'state-inner state-inner-accept',
        cx: position.x,
        cy: position.y,
        r: '21',
        'data-state-id': state.id,
      }));
    }

    const stateLabel = svgElement('text', {
      class: 'state-label',
      x: position.x,
      y: position.y,
      'dominant-baseline': 'middle',
      'data-state-id': state.id,
    });
    stateLabel.textContent = kind === 'nfa' ? `q${state.id}` : state.id;
    stateElements.push(stateLabel);

    if (kind === 'dfa' || kind === 'minimized') {
      const subsetLabel = svgElement('text', {
        class: 'subset-label',
        x: position.x,
        y: position.y + 43,
        'data-state-id': state.id,
      });
      const members = kind === 'dfa' ? state.nfaStates : state.members;
      subsetLabel.textContent = `{${members.join(',')}}`;
      stateElements.push(subsetLabel);
    }
  }

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  const graphDescription = kind === 'dfa'
    ? 'Generated DFA state diagram; each state is labeled with its NFA subset.'
    : kind === 'minimized'
      ? 'Generated minimized DFA state diagram; each state is labeled with its merged DFA states.'
      : 'Generated Thompson NFA state diagram.';
  svg.setAttribute('aria-label', graphDescription);
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;
  svg.classList.add('is-generated');
  svg.replaceChildren(defs, ...edgeElements, ...stateElements);
}

function createTableCell(tagName, text, className = '') {
  const cell = document.createElement(tagName);
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function renderTransitionTable(automaton, kind) {
  const symbols = kind === 'nfa'
    ? [...automaton.alphabet, window.AutomataNFA.EPSILON]
    : automaton.alphabet;
  const headerRow = document.createElement('tr');
  ['State', ...symbols.map((symbol) => symbol === null ? 'ε' : symbol), 'Type'].forEach((label) => {
    headerRow.append(createTableCell('th', label, ''));
    headerRow.lastElementChild.scope = 'col';
  });
  tableHead.replaceChildren(headerRow);
  tableBody.replaceChildren();

  const rows = kind === 'nfa'
    ? automaton.states.map((id) => ({ id, nfaStates: null, transitions: null }))
    : automaton.states;
  for (const state of rows) {
    const row = document.createElement('tr');
    const stateHeader = document.createElement('th');
    stateHeader.scope = 'row';
    const stateName = document.createElement('span');
    stateName.className = 'state-token';
    stateName.textContent = kind === 'nfa' ? `q${state.id}` : state.id;
    stateHeader.append(stateName);
    if (kind === 'dfa' || kind === 'minimized') {
      const subset = document.createElement('span');
      subset.className = 'subset-token';
      const members = kind === 'dfa' ? state.nfaStates : state.members;
      subset.textContent = `{${members.join(',')}}`;
      stateHeader.append(subset);
    }
    row.append(stateHeader);

    for (const symbol of symbols) {
      const cell = document.createElement('td');
      const targets = kind !== 'nfa'
        ? [state.transitions[symbol]].filter((target) => target !== undefined)
        : automaton.transitions
          .filter((transition) => transition.from === state.id && transition.symbol === symbol)
          .map((transition) => transition.to);
      if (targets.length === 0) {
        cell.className = 'empty-cell';
        cell.textContent = '—';
      } else {
        cell.className = 'transition-token';
        cell.textContent = targets.map((target) => kind === 'nfa' ? `q${target}` : target).join(', ');
      }
      row.append(cell);
    }

    const isStart = state.id === automaton.startState;
    const isAccepting = kind === 'nfa'
      ? automaton.acceptingStates.includes(state.id)
      : state.isAccepting;
    const typeLabel = isStart && isAccepting ? 'Start / accept' : isStart ? 'Start' : isAccepting ? 'Accept' : 'Normal';
    const typeClass = isAccepting ? 'type-label accept-type' : isStart ? 'type-label start-type' : 'type-label';
    row.append(createTableCell('td', typeLabel, typeClass));
    tableBody.append(row);
  }

  const machineName = kind === 'nfa' ? 'NFA' : kind === 'minimized' ? 'Minimized DFA' : 'DFA';
  tableKind.textContent = `Generated ${machineName}`;
  tableCaption.textContent = `Transition table for the generated ${machineName}`;
  tableNote.textContent = kind === 'nfa'
    ? 'Transitions shown are from the Thompson NFA generated from the current expression.'
    : kind === 'minimized'
      ? 'Transitions shown are from the minimized DFA; each state lists its merged DFA states.'
      : 'Every alphabet symbol maps to exactly one DFA state; subsets contain the source NFA states.';
}

function renderNFA(nfa) {
  renderGraph(document.querySelector('#nfa-graph'), nfa, 'nfa');
  document.querySelector('#nfa-panel .placeholder-tag').textContent = 'Generated';
  renderTransitionTable(nfa, 'nfa');
  updateCounts(nfa);
}

function renderDFA(nfa, dfa) {
  renderGraph(document.querySelector('#nfa-graph'), nfa, 'nfa');
  renderGraph(document.querySelector('#dfa-graph'), dfa, 'dfa');
  document.querySelector('#nfa-panel .placeholder-tag').textContent = 'Generated';
  document.querySelector('#dfa-panel .placeholder-tag').textContent = 'Generated';
  renderTransitionTable(dfa, 'dfa');
  updateCounts(nfa, dfa);
}

function renderMinimizedDFA(minimized, nfa, dfa) {
  renderGraph(document.querySelector('#minimized-graph'), minimized, 'minimized');
  document.querySelector('#minimized-panel .placeholder-tag').textContent = 'Generated';
  document.querySelector('#minimized-stats').textContent = `Original DFA: ${dfa.states.length} · Reachable: ${minimized.reachableStateCount} · Minimized: ${minimized.states.length}`;
  renderTransitionTable(minimized, 'minimized');
  updateCounts(nfa, dfa, minimized);
}

function highlightCurrentStates(svg, stateIds) {
  const selectedIds = new Set(stateIds.map(String));
  svg.querySelectorAll('[data-state-id]').forEach((element) => {
    element.classList.toggle('is-current', selectedIds.has(element.dataset.stateId));
  });
}

function clearSimulationOutput() {
  lastSimulationMode = null;
  executionTrace.replaceChildren();
  executionPath.textContent = 'Generate a machine and simulate a string to see its complete path.';
  traceCurrent.textContent = 'Current state: —';
  simulationResult.classList.remove('is-accepted', 'is-rejected', 'is-invalid');
  simulationResult.querySelector('p').textContent = 'Enter a string, choose a machine, and simulate.';
  simulationResult.querySelector('.result-state').textContent = 'IDLE';
  document.querySelectorAll('#nfa-graph, #dfa-graph, #minimized-graph').forEach((svg) => {
    svg.querySelectorAll('.is-current').forEach((element) => element.classList.remove('is-current'));
  });
  syncGeneratorButtons();
}

function clearGeneratedOutput() {
  currentExpression = null;
  currentNFA = null;
  currentDFA = null;
  currentMinimizedDFA = null;

  document.querySelectorAll('#nfa-graph, #dfa-graph, #minimized-graph').forEach((svg) => {
    svg.replaceChildren();
    svg.setAttribute('hidden', '');
    svg.classList.remove('is-generated');
    svg.style.removeProperty('width');
    svg.style.removeProperty('height');
    const emptyState = svg.parentElement.querySelector('.graph-empty');
    if (emptyState) emptyState.hidden = false;
  });

  document.querySelector('#nfa-panel .placeholder-tag').textContent = 'AWAITING GENERATION';
  document.querySelector('#dfa-panel .placeholder-tag').textContent = 'AWAITING GENERATION';
  document.querySelector('#minimized-panel .placeholder-tag').textContent = 'AWAITING GENERATION';
  document.querySelector('#minimized-stats').textContent = 'Generate a DFA to minimize it.';
  automataCounts.textContent = 'NFA: — / DFA: —';
  tableHead.replaceChildren();
  tableBody.replaceChildren();
  tableKind.textContent = 'AWAITING GENERATION';
  tableCaption.textContent = 'Generated automaton transition table';
  tableNote.textContent = 'Generate an automaton to view its computed transitions.';
  clearSimulationOutput();
}

function formatStateSet(states) {
  return `{${states.join(',')}}`;
}

function renderSimulationTrace(mode, result, automaton) {
  lastSimulationMode = mode;
  executionTrace.replaceChildren();
  const isNFA = mode === 'nfa';
  const stateName = (state) => isNFA ? formatStateSet(state) : state;
  const start = isNFA ? result.initialStates : result.startState;
  const end = isNFA ? result.finalStates : result.finalState;
  const pathParts = [stateName(start)];

  const startItem = document.createElement('li');
  startItem.textContent = isNFA
    ? `Start ε-closure: ${stateName(start)}`
    : `Start at ${start}`;
  executionTrace.append(startItem);

  result.steps.forEach((step, index) => {
    const item = document.createElement('li');
    if (isNFA) {
      const stepText = `${stateName(step.from)} --${step.symbol}--> move ${stateName(step.moved)} → ε-closure ${stateName(step.to)}`;
      item.textContent = `${index + 1}. ${stepText}`;
      pathParts.push(`--${step.symbol}--> move ${stateName(step.moved)} → ${stateName(step.to)}`);
    } else {
      item.textContent = `${index + 1}. ${step.from} --${step.symbol}--> ${step.to}`;
      pathParts.push(`--${step.symbol}--> ${step.to}`);
    }
    executionTrace.append(item);
  });

  if (!result.valid) {
    const invalidItem = document.createElement('li');
    invalidItem.className = 'trace-invalid';
    invalidItem.textContent = `Stopped: "${result.invalidSymbol}" is not a transition in this machine's alphabet.`;
    executionTrace.append(invalidItem);
    pathParts.push(`--${result.invalidSymbol}--> INVALID`);
  }

  const accepted = result.valid && result.accepted;
  const finalItem = document.createElement('li');
  finalItem.className = 'trace-current';
  finalItem.textContent = `Final ${isNFA ? 'state set' : 'state'}: ${stateName(end)} (${accepted ? 'accepting' : 'non-accepting'})`;
  executionTrace.append(finalItem);
  pathParts.push(`final ${stateName(end)}`);
  executionPath.textContent = pathParts.join(' ');
  traceCurrent.textContent = `Current state: ${stateName(end)}`;

  const resultClass = !result.valid ? 'is-invalid' : accepted ? 'is-accepted' : 'is-rejected';
  simulationResult.classList.remove('is-accepted', 'is-rejected', 'is-invalid');
  simulationResult.classList.add(resultClass);
  simulationResult.querySelector('.result-state').textContent = !result.valid
    ? 'Invalid symbol'
    : accepted ? 'Accepted' : 'Rejected';
  simulationResult.querySelector('p').textContent = !result.valid
    ? `Invalid input symbol "${result.invalidSymbol}"; simulation stopped.`
    : `${isNFA ? 'NFA' : 'DFA'} ${accepted ? 'accepts' : 'rejects'} this string.`;

  if (isNFA) {
    highlightCurrentStates(document.querySelector('#nfa-graph'), end);
  } else {
    highlightCurrentStates(document.querySelector('#dfa-graph'), [end]);
  }

  const alphabet = Array.from(automaton.alphabet).join(', ') || '(empty)';
  if (!result.valid) {
    simulationResult.querySelector('p').textContent += ` Alphabet: ${alphabet}.`;
  }
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', (event) => {
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    activateTab(tabs[nextIndex], true);
  });
});

simulationModeInput.addEventListener('change', () => {
  if (!lastSimulationMode) syncGeneratorButtons();
});

regexInput.addEventListener('input', () => {
  regexHint.textContent = 'Use a regular expression as your starting point.';
  regexHint.classList.remove('field-error');
  clearGeneratedOutput();
  setCanvasStatus('Input changed · regenerate', false);
});

document.querySelectorAll('[data-generate]').forEach((button) => {
  button.addEventListener('click', () => {
    try {
      const nfa = ensureCurrentNFA();
      regexHint.textContent = 'Use a regular expression as your starting point.';
      regexHint.classList.remove('field-error');

      if (button.dataset.generate === 'nfa') {
        renderNFA(nfa);
        activateTab(document.querySelector('#nfa-tab'));
        setCanvasStatus('Thompson NFA generated');
        return;
      }

      const dfa = ensureCurrentDFA();
      renderDFA(nfa, currentDFA);
      activateTab(document.querySelector('#dfa-tab'));
      setCanvasStatus('DFA generated · language verified');
    } catch (error) {
      regexHint.textContent = error.message;
      regexHint.classList.add('field-error');
      setCanvasStatus('Generation failed', false);
    }
  });
});

document.querySelector('[data-open-tab="minimized-tab"]').addEventListener('click', () => {
  try {
    const nfa = ensureCurrentNFA();
    const dfa = ensureCurrentDFA();
    currentMinimizedDFA = window.DFAMinimizer.minimize(dfa);
    if (!window.AutomataSimulator.verifyDFAEquivalent(dfa, currentMinimizedDFA)) {
      throw new Error('The minimized DFA did not pass language-equivalence verification.');
    }
    renderDFA(nfa, dfa);
    renderMinimizedDFA(currentMinimizedDFA, nfa, dfa);
    activateTab(document.querySelector('#minimized-tab'));
    setCanvasStatus('DFA minimized · language verified');
  } catch (error) {
    regexHint.textContent = error.message;
    regexHint.classList.add('field-error');
    setCanvasStatus('Minimization failed', false);
  }
});

simulationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const nfa = ensureCurrentNFA();
    const mode = simulationModeInput.value;
    let automaton;
    let result;

    if (mode === 'nfa') {
      automaton = nfa;
      renderNFA(nfa);
      result = window.AutomataSimulator.traceNFA(nfa, testStringInput.value);
    } else {
      automaton = ensureCurrentDFA();
      renderDFA(nfa, automaton);
      result = window.AutomataSimulator.traceDFA(automaton, testStringInput.value);
    }

    renderSimulationTrace(mode, result, automaton);
    activateTab(document.querySelector('#simulator-tab'));
  } catch (error) {
    clearSimulationOutput();
    simulationResult.querySelector('p').textContent = error.message;
    simulationResult.querySelector('.result-state').textContent = 'INVALID REGEX';
    simulationResult.classList.add('is-invalid');
    activateTab(document.querySelector('#simulator-tab'));
  }
});

document.querySelector('#reset-simulation').addEventListener('click', () => {
  simulationForm.reset();
  clearSimulationOutput();
});
