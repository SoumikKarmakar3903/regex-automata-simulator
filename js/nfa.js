(() => {
	'use strict';

	const EPSILON = null;

	function isBasicSymbol(token) {
		return /^[a-zA-Z0-9]$/.test(token);
	}

	function validateExpression(expression) {
		if (typeof expression !== 'string') {
			throw new TypeError('The regular expression must be a string.');
		}
		if (expression.length === 0) {
			throw new SyntaxError('Enter a regular expression.');
		}

		const parentheses = [];
		let expectsOperand = true;

		for (let index = 0; index < expression.length; index += 1) {
			const token = expression[index];
			const position = index + 1;

			if (isBasicSymbol(token)) {
				expectsOperand = false;
				continue;
			}

			switch (token) {
				case '(':
					parentheses.push(position);
					expectsOperand = true;
					break;
				case ')':
					if (parentheses.length === 0) {
						throw new SyntaxError(`Unmatched closing parenthesis at position ${position}.`);
					}
					if (expectsOperand) {
						throw new SyntaxError(`Expected an expression before position ${position}.`);
					}
					parentheses.pop();
					expectsOperand = false;
					break;
				case '*':
					if (expectsOperand) {
						throw new SyntaxError(`Kleene star needs an expression before position ${position}.`);
					}
					if (expression[index - 1] === '*') {
						throw new SyntaxError(`Repeated Kleene star at position ${position}.`);
					}
					expectsOperand = false;
					break;
				case '|':
					if (expectsOperand) {
						throw new SyntaxError(`Union needs a left operand at position ${position}.`);
					}
					expectsOperand = true;
					break;
				default:
					throw new SyntaxError(`Unsupported symbol "${token}" at position ${position}. Use letters, digits, |, *, and parentheses.`);
			}
		}

		if (parentheses.length > 0) {
			throw new SyntaxError(`Missing closing parenthesis for position ${parentheses[parentheses.length - 1]}.`);
		}
		if (expectsOperand) {
			throw new SyntaxError('The regular expression cannot end with a union operator.');
		}

		return Array.from(expression);
	}

	function insertConcatenation(tokens) {
		const explicitTokens = [];

		for (let index = 0; index < tokens.length; index += 1) {
			const token = tokens[index];
			const previous = tokens[index - 1];
			const endsExpression = previous && (isBasicSymbol(previous) || previous === ')' || previous === '*');
			const beginsExpression = isBasicSymbol(token) || token === '(';

			if (endsExpression && beginsExpression) explicitTokens.push('.');
			explicitTokens.push(token);
		}

		return explicitTokens;
	}

	function toPostfix(tokens) {
		const precedence = { '|': 1, '.': 2 };
		const output = [];
		const operators = [];

		for (const token of tokens) {
			if (isBasicSymbol(token)) {
				output.push(token);
			} else if (token === '(') {
				operators.push(token);
			} else if (token === ')') {
				while (operators.at(-1) !== '(') output.push(operators.pop());
				operators.pop();
			} else if (token === '*') {
				output.push(token);
			} else {
				while (operators.length > 0
					&& operators.at(-1) !== '('
					&& precedence[operators.at(-1)] >= precedence[token]) {
					output.push(operators.pop());
				}
				operators.push(token);
			}
		}

		while (operators.length > 0) output.push(operators.pop());
		return output;
	}

	function buildFromPostfix(postfix) {
		const states = [];
		const transitions = [];
		const alphabet = new Set();
		let nextStateId = 0;

		function createState() {
			const stateId = nextStateId;
			nextStateId += 1;
			states.push(stateId);
			return stateId;
		}

		function addTransition(from, to, symbol) {
			transitions.push({ from, to, symbol });
			if (symbol !== EPSILON) alphabet.add(symbol);
		}

		// Each Thompson fragment has one entry and one accepting state.
		const fragments = [];
		for (const token of postfix) {
			if (isBasicSymbol(token)) {
				const startState = createState();
				const acceptState = createState();
				addTransition(startState, acceptState, token);
				fragments.push({ startState, acceptState });
				continue;
			}

			if (token === '.') {
				const right = fragments.pop();
				const left = fragments.pop();
				if (!left || !right) throw new SyntaxError('Invalid concatenation in postfix expression.');
				addTransition(left.acceptState, right.startState, EPSILON);
				fragments.push({ startState: left.startState, acceptState: right.acceptState });
				continue;
			}

			if (token === '|') {
				const right = fragments.pop();
				const left = fragments.pop();
				if (!left || !right) throw new SyntaxError('Invalid union in postfix expression.');
				const startState = createState();
				const acceptState = createState();
				addTransition(startState, left.startState, EPSILON);
				addTransition(startState, right.startState, EPSILON);
				addTransition(left.acceptState, acceptState, EPSILON);
				addTransition(right.acceptState, acceptState, EPSILON);
				fragments.push({ startState, acceptState });
				continue;
			}

			if (token === '*') {
				const repeated = fragments.pop();
				if (!repeated) throw new SyntaxError('Invalid Kleene star in postfix expression.');
				const startState = createState();
				const acceptState = createState();
				addTransition(startState, repeated.startState, EPSILON);
				addTransition(startState, acceptState, EPSILON);
				addTransition(repeated.acceptState, repeated.startState, EPSILON);
				addTransition(repeated.acceptState, acceptState, EPSILON);
				fragments.push({ startState, acceptState });
			}
		}

		if (fragments.length !== 1) throw new SyntaxError('Invalid regular expression.');
		const fragment = fragments[0];
		return {
			states,
			startState: fragment.startState,
			acceptingStates: [fragment.acceptState],
			alphabet: Array.from(alphabet),
			transitions,
		};
	}

	function createFromRegex(expression) {
		const tokens = validateExpression(expression);
		const explicitTokens = insertConcatenation(tokens);
		const postfix = toPostfix(explicitTokens);
		return buildFromPostfix(postfix);
	}

	window.AutomataNFA = Object.freeze({
		EPSILON,
		createFromRegex,
		insertConcatenation,
		toPostfix,
	});
})();
