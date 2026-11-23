# Regular Expression to NFA & DFA Simulator

An educational, browser-based Compiler Design project that converts regular expressions into Thompson NFAs, determinizes them with subset construction, minimizes the resulting DFA, and simulates input strings with a visible execution trace.

## Objectives

- Visualize the stages from regular expression to finite automata.
- Explore epsilon transitions, deterministic state subsets, and DFA state equivalence.
- Test accepted and rejected strings against generated machines.
- Provide a compact, dependency-free tool for Compiler Design practice.

## Concepts Covered

- Regular expressions and operator precedence
- Thompson's Construction
- Nondeterministic Finite Automata (NFA) and epsilon closure
- Deterministic Finite Automata (DFA) and Subset Construction
- Reachability and DFA Minimization by partition refinement
- Automata execution traces and language equivalence

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript (ES2022)
- SVG for state diagrams

No backend, database, build tool, or third-party JavaScript dependency is required. The stylesheet imports Manrope and DM Mono from Google Fonts; system fallbacks are provided when those fonts are unavailable.

## Project Structure

```text
regex-automata-simulator/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── nfa.js
│   ├── dfa.js
│   ├── minimizer.js
│   └── simulator.js
└── README.md
```

## Features

- Validates regular expressions over `a-z`, `A-Z`, and `0-9`, with union (`|`), implicit concatenation, Kleene star (`*`), and parentheses.
- Inserts explicit concatenation, converts infix expressions to postfix, and builds an NFA using Thompson's Construction.
- Converts that NFA to a complete DFA using epsilon closure and subset construction; displays the represented NFA-state set for every DFA state.
- Removes unreachable DFA states and minimizes reachable states by partition refinement.
- Displays generated NFA, DFA, and minimized DFA diagrams and transition tables.
- Simulates strings against the generated DFA or NFA, shows each transition and current state, highlights the resulting state, and reports invalid symbols.
- Supports reset, keyboard-operable view tabs, and responsive, horizontally scrollable diagrams.

## Run Locally

1. Open the `regex-automata-simulator` folder in VS Code.
2. Install the **Live Server** extension by Ritwick Dey if needed.
3. Right-click `index.html` in the Explorer and select **Open with Live Server**.
4. The app opens in your browser. Save file changes to refresh the page.

The project can also be opened directly in a modern browser. Live Server is recommended for the development workflow.

## Example Expressions

| Expression | Expected behavior | Examples accepted | Examples rejected |
| --- | --- | --- | --- |
| `a` | Exactly one `a` | `a` | empty string, `b`, `aa` |
| `a|b` | Either one `a` or one `b` | `a`, `b` | empty string, `ab` |
| `ab` | `a` followed by `b` | `ab` | `a`, `b`, `ba` |
| `a*` | Zero or more `a` characters | empty string, `a`, `aa` | `b`, `ab` |
| `(a|b)*` | Any string over `{a,b}` | empty string, `abba`, `baab` | strings containing other symbols |
| `(a|b)*abb` | Strings over `{a,b}` ending in `abb` | `abb`, `aabb`, `babb` | `ab`, `ba`, `aab` |
| `(a|b)(a|b)` | Exactly two symbols, each `a` or `b` | `aa`, `ab`, `ba`, `bb` | empty string, `a`, `aba` |

Empty regular expressions and malformed operator/parenthesis sequences are rejected with an on-screen error.

