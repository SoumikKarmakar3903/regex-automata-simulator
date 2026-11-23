(() => {
	'use strict';

	function traceDFA(dfa, input) {
		if (typeof input !== 'string') throw new TypeError('The input string must be text.');
		const alphabet = new Set(dfa.alphabet);
		let currentState = dfa.startState;
		const startState = currentState;
		const steps = [];

		for (const symbol of input) {
			if (!alphabet.has(symbol)) {
				return { valid: false, accepted: false, invalidSymbol: symbol, startState, finalState: currentState, steps };
			}
			const nextState = dfa.transitionTable[currentState]?.[symbol];
			if (nextState === undefined) {
				return { valid: false, accepted: false, invalidSymbol: symbol, startState, finalState: currentState, steps };
			}
			steps.push({ from: currentState, symbol, to: nextState });
			currentState = nextState;
		}

		return {
			valid: true,
			accepted: dfa.acceptingStates.includes(currentState),
			startState,
			finalState: currentState,
			steps,
		};
	}

	function traceNFA(nfa, input) {
		if (typeof input !== 'string') throw new TypeError('The input string must be text.');
		const alphabet = new Set(nfa.alphabet);
		let currentStates = window.SubsetConstruction.epsilonClosure(nfa, [nfa.startState]);
		const initialStates = currentStates;
		const steps = [];

		for (const symbol of input) {
			if (!alphabet.has(symbol)) {
				return { valid: false, accepted: false, invalidSymbol: symbol, initialStates, finalStates: currentStates, steps };
			}
			const movedStates = window.SubsetConstruction.move(nfa, currentStates, symbol);
			const nextStates = window.SubsetConstruction.epsilonClosure(nfa, movedStates);
			steps.push({ from: currentStates, symbol, moved: movedStates, to: nextStates });
			currentStates = nextStates;
		}

		return {
			valid: true,
			accepted: currentStates.some((state) => nfa.acceptingStates.includes(state)),
			initialStates,
			finalStates: currentStates,
			steps,
		};
	}

	function acceptsNFA(nfa, input) {
		return traceNFA(nfa, input).accepted;
	}

	function acceptsDFA(dfa, input) {
		return traceDFA(dfa, input).accepted;
	}

	function verifyEquivalent(nfa, dfa) {
		const symbols = Array.from(new Set([...nfa.alphabet, ...dfa.alphabet]));
		if (nfa.alphabet.length !== dfa.alphabet.length || symbols.length !== dfa.alphabet.length) return false;

		const initialNfaStates = window.SubsetConstruction.epsilonClosure(nfa, [nfa.startState]);
		const pending = [{ nfaStates: initialNfaStates, dfaState: dfa.startState }];
		const visited = new Set();

		// Reachable NFA/DFA state pairs expose any acceptance mismatch.
		for (let index = 0; index < pending.length; index += 1) {
			const pair = pending[index];
			const key = JSON.stringify([pair.dfaState, pair.nfaStates]);
			if (visited.has(key)) continue;
			visited.add(key);

			const nfaAccepts = pair.nfaStates.some((state) => nfa.acceptingStates.includes(state));
			const dfaAccepts = dfa.acceptingStates.includes(pair.dfaState);
			if (nfaAccepts !== dfaAccepts) return false;

			for (const symbol of symbols) {
				const row = dfa.transitionTable[pair.dfaState];
				if (!Object.hasOwn(row, symbol)) return false;
				const nextNfaStates = window.SubsetConstruction.epsilonClosure(
					nfa,
					window.SubsetConstruction.move(nfa, pair.nfaStates, symbol),
				);
				pending.push({ nfaStates: nextNfaStates, dfaState: row[symbol] });
			}
		}

		return true;
	}

	function verifyDFAEquivalent(left, right) {
		const symbols = Array.from(new Set([...left.alphabet, ...right.alphabet]));
		if (symbols.length !== left.alphabet.length || symbols.length !== right.alphabet.length) return false;

		const pending = [[left.startState, right.startState]];
		const visited = new Set();
		for (let index = 0; index < pending.length; index += 1) {
			const [leftState, rightState] = pending[index];
			const key = JSON.stringify([leftState, rightState]);
			if (visited.has(key)) continue;
			visited.add(key);

			if (left.acceptingStates.includes(leftState) !== right.acceptingStates.includes(rightState)) return false;
			for (const symbol of symbols) {
				const leftTarget = left.transitionTable[leftState]?.[symbol];
				const rightTarget = right.transitionTable[rightState]?.[symbol];
				if (leftTarget === undefined || rightTarget === undefined) return false;
				pending.push([leftTarget, rightTarget]);
			}
		}

		return true;
	}

	window.AutomataSimulator = Object.freeze({
		acceptsNFA,
		acceptsDFA,
		traceNFA,
		traceDFA,
		verifyEquivalent,
		verifyDFAEquivalent,
	});
})();
