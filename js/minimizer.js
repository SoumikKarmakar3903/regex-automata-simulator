(() => {
	'use strict';

	function minimize(dfa) {
		if (!dfa || !Array.isArray(dfa.states) || dfa.states.length === 0) {
			throw new TypeError('Minimization requires a generated DFA.');
		}

		const alphabet = Array.from(new Set(dfa.alphabet ?? []));
		const originalIds = dfa.states.map((state) => state.id);
		const idSet = new Set(originalIds);
		if (!idSet.has(dfa.startState)) throw new TypeError('The DFA start state is missing.');

		const table = Object.fromEntries(originalIds.map((id) => {
			const state = dfa.states.find((candidate) => candidate.id === id);
			return [id, { ...(dfa.transitionTable?.[id] ?? state.transitions ?? {}) }];
		}));
		const needsDeadState = originalIds.some((id) => alphabet.some((symbol) => table[id][symbol] === undefined));
		let deadStateId = null;

		if (needsDeadState) {
			deadStateId = '__DEAD__';
			while (idSet.has(deadStateId)) deadStateId += '_';
			for (const id of originalIds) {
				for (const symbol of alphabet) {
					if (table[id][symbol] === undefined) table[id][symbol] = deadStateId;
				}
			}
			table[deadStateId] = Object.fromEntries(alphabet.map((symbol) => [symbol, deadStateId]));
			idSet.add(deadStateId);
		}

		for (const id of idSet) {
			for (const symbol of alphabet) {
				const target = table[id]?.[symbol];
				if (target === undefined || !idSet.has(target)) {
					throw new TypeError(`Invalid transition from ${id} on "${symbol}".`);
				}
			}
		}

		const reachable = new Set([dfa.startState]);
		const pending = [dfa.startState];
		for (let index = 0; index < pending.length; index += 1) {
			const stateId = pending[index];
			for (const symbol of alphabet) {
				const target = table[stateId][symbol];
				if (reachable.has(target)) continue;
				reachable.add(target);
				pending.push(target);
			}
		}

		const accepting = new Set(dfa.acceptingStates ?? []);
		let partitions = [
			Array.from(reachable).filter((id) => !accepting.has(id)),
			Array.from(reachable).filter((id) => accepting.has(id)),
		].filter((partition) => partition.length > 0);

		// Split blocks by the partition reached for each alphabet symbol.
		while (true) {
			const partitionByState = new Map();
			partitions.forEach((partition, partitionIndex) => {
				partition.forEach((stateId) => partitionByState.set(stateId, partitionIndex));
			});

			const refined = [];
			for (const partition of partitions) {
				const groups = new Map();
				for (const stateId of partition) {
					const signature = JSON.stringify(alphabet.map((symbol) => partitionByState.get(table[stateId][symbol])));
					if (!groups.has(signature)) groups.set(signature, []);
					groups.get(signature).push(stateId);
				}
				refined.push(...groups.values());
			}

			if (refined.length === partitions.length) break;
			partitions = refined;
		}

		const minimizedStates = partitions.map((members, index) => ({
			id: `M${index}`,
			members,
			isAccepting: members.some((id) => accepting.has(id)),
			transitions: Object.create(null),
		}));
		const minimizedIdByOriginal = new Map();
		minimizedStates.forEach((state) => {
			state.members.forEach((id) => minimizedIdByOriginal.set(id, state.id));
		});

		for (const state of minimizedStates) {
			const representative = state.members[0];
			for (const symbol of alphabet) {
				state.transitions[symbol] = minimizedIdByOriginal.get(table[representative][symbol]);
			}
		}

		const transitionTable = Object.fromEntries(
			minimizedStates.map((state) => [state.id, { ...state.transitions }]),
		);
		return {
			states: minimizedStates,
			startState: minimizedIdByOriginal.get(dfa.startState),
			acceptingStates: minimizedStates.filter((state) => state.isAccepting).map((state) => state.id),
			alphabet,
			transitionTable,
			originalStateCount: dfa.states.length,
			reachableStateCount: reachable.size,
		};
	}

	window.DFAMinimizer = Object.freeze({ minimize });
})();
