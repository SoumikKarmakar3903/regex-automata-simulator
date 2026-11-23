(() => {
	'use strict';

	function sortedStates(states) {
		return Array.from(states).sort((left, right) => left - right);
	}

	function epsilonClosure(nfa, stateSet) {
		const closure = new Set(stateSet);
		const pending = Array.from(closure);

		// Follow epsilon edges until no new NFA states are reachable.
		while (pending.length > 0) {
			const state = pending.pop();
			for (const transition of nfa.transitions) {
				if (transition.from !== state || transition.symbol !== window.AutomataNFA.EPSILON) continue;
				if (!closure.has(transition.to)) {
					closure.add(transition.to);
					pending.push(transition.to);
				}
			}
		}

		return sortedStates(closure);
	}

	function move(nfa, stateSet, symbol) {
		const states = new Set(stateSet);
		const targets = new Set();
		for (const transition of nfa.transitions) {
			if (states.has(transition.from) && transition.symbol === symbol) targets.add(transition.to);
		}
		return sortedStates(targets);
	}

	function subsetConstruction(nfa) {
		if (!nfa || !Array.isArray(nfa.states) || !Array.isArray(nfa.transitions)) {
			throw new TypeError('Subset construction requires an NFA from AutomataNFA.');
		}

		const alphabet = Array.from(new Set(nfa.alphabet));
		const nfaAcceptingStates = new Set(nfa.acceptingStates);
		const states = [];
		const subsetsByKey = new Map();
		const queue = [];

		function getOrCreateState(nfaStates) {
			const normalizedStates = sortedStates(nfaStates);
			const key = normalizedStates.join(',');
			if (subsetsByKey.has(key)) return subsetsByKey.get(key);

			const state = {
				id: `D${states.length}`,
				nfaStates: normalizedStates,
				isAccepting: normalizedStates.some((stateId) => nfaAcceptingStates.has(stateId)),
				transitions: Object.create(null),
			};
			states.push(state);
			subsetsByKey.set(key, state);
			queue.push(state);
			return state;
		}

		const startStates = epsilonClosure(nfa, [nfa.startState]);
		const startState = getOrCreateState(startStates);

		// New subsets extend the queue; the empty subset is processed as the dead state.
		for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
			const current = queue[queueIndex];
			for (const symbol of alphabet) {
				const nextStates = epsilonClosure(nfa, move(nfa, current.nfaStates, symbol));
				const nextState = getOrCreateState(nextStates);
				current.transitions[symbol] = nextState.id;
			}
		}

		const transitionTable = Object.fromEntries(
			states.map((state) => [state.id, { ...state.transitions }]),
		);

		return {
			states,
			startState: startState.id,
			acceptingStates: states.filter((state) => state.isAccepting).map((state) => state.id),
			alphabet,
			transitionTable,
		};
	}

	window.SubsetConstruction = Object.freeze({ epsilonClosure, move, convert: subsetConstruction });
})();
