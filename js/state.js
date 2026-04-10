/**
 * State management for the Maldives Marine Life Quiz.
 * Handles quiz progress, localStorage persistence, and state transitions.
 */

const STORAGE_KEY = "maldives-fish-quiz-state";
const TOTAL_ROUNDS = 9;

const ROUND_NAMES = [
    "Pick the Image (by Group)",
    "Pick the Group (from Image)",
    "Pick the Image (by Family)",
    "Pick the Family (from Image)",
    "Pick the Image (with English name)",
    "Pick the Name (with English name)",
    "Pick the Image (Latin only)",
    "Pick the Name (Latin only)",
    "Type the Latin Name"
];

const ROUND_DESCRIPTIONS = [
    "4 images, 1 group name - pick a fish from that group",
    "1 image, 4 group names - pick the correct group",
    "4 images, 1 Latin family name - pick a fish from that family",
    "1 image, 4 Latin family names - pick the correct family",
    "4 images, 1 name (English + Latin) - pick the matching image",
    "1 image, 4 names (English + Latin) - pick the matching name",
    "4 images, 1 Latin name - pick the matching image",
    "1 image, 4 Latin names - pick the matching Latin name",
    "1 image - type the Latin name from memory"
];

/**
 * Initialize fresh state for a given species list.
 */
function createInitialState(speciesIds) {
    const roundProgress = {};
    for (let r = 1; r <= TOTAL_ROUNDS; r++) {
        roundProgress[r] = {
            remaining: r === 1 ? shuffle([...speciesIds]) : [...speciesIds],
            completed: [],
            retryQueue: [],
            isRetrying: false
        };
    }

    return {
        currentRound: 1,
        roundProgress,
        stats: {
            totalCorrect: 0,
            totalAttempts: 0,
            perSpecies: {}
        },
        version: 4
    };
}

/**
 * Load state from localStorage, or create fresh state.
 */
function loadState(speciesIds) {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const state = JSON.parse(saved);

            // Migrate from version 2 (5 rounds) to version 3 (7 rounds)
            if (state.version === 2 && state.roundProgress) {
                const newProgress = {};
                // New group rounds 1 & 2 get fresh species lists
                newProgress[1] = {
                    remaining: shuffle([...speciesIds]),
                    completed: [],
                    retryQueue: [],
                    isRetrying: false
                };
                newProgress[2] = {
                    remaining: [...speciesIds],
                    completed: [],
                    retryQueue: [],
                    isRetrying: false
                };
                // Old rounds 1-5 shift to 3-7
                for (let oldR = 1; oldR <= 5; oldR++) {
                    if (state.roundProgress[oldR]) {
                        newProgress[oldR + 2] = state.roundProgress[oldR];
                    } else {
                        newProgress[oldR + 2] = {
                            remaining: [...speciesIds],
                            completed: [],
                            retryQueue: [],
                            isRetrying: false
                        };
                    }
                }
                state.roundProgress = newProgress;
                state.currentRound = Math.min(state.currentRound + 2, 7);
                state.version = 3;
                // Fall through to v3→v4 migration below
            }

            // Migrate from version 3 (7 rounds) to version 4 (9 rounds)
            if (state.version === 3 && state.roundProgress) {
                const newProgress = {};
                // Group rounds 1 & 2 unchanged
                newProgress[1] = state.roundProgress[1] || {
                    remaining: shuffle([...speciesIds]),
                    completed: [],
                    retryQueue: [],
                    isRetrying: false
                };
                newProgress[2] = state.roundProgress[2] || {
                    remaining: [...speciesIds],
                    completed: [],
                    retryQueue: [],
                    isRetrying: false
                };
                // New family rounds 3 & 4 get fresh species lists
                newProgress[3] = {
                    remaining: shuffle([...speciesIds]),
                    completed: [],
                    retryQueue: [],
                    isRetrying: false
                };
                newProgress[4] = {
                    remaining: [...speciesIds],
                    completed: [],
                    retryQueue: [],
                    isRetrying: false
                };
                // Old rounds 3-7 shift to 5-9
                for (let oldR = 3; oldR <= 7; oldR++) {
                    if (state.roundProgress[oldR]) {
                        newProgress[oldR + 2] = state.roundProgress[oldR];
                    } else {
                        newProgress[oldR + 2] = {
                            remaining: [...speciesIds],
                            completed: [],
                            retryQueue: [],
                            isRetrying: false
                        };
                    }
                }
                state.roundProgress = newProgress;
                // Shift current round: rounds 1-2 stay, rounds 3-7 become 5-9
                if (state.currentRound >= 3) {
                    state.currentRound = Math.min(state.currentRound + 2, TOTAL_ROUNDS);
                }
                state.version = 4;
                saveState(state);
                return state;
            }

            if (state.version === 4 && state.roundProgress) {
                // Validate that species IDs match
                const firstRoundWithData = state.roundProgress[1] || state.roundProgress[3];
                const savedIds = new Set([
                    ...firstRoundWithData.remaining,
                    ...firstRoundWithData.completed
                ]);

                // If species list changed, add new species to remaining
                for (const id of speciesIds) {
                    if (!savedIds.has(id)) {
                        for (let r = 1; r <= TOTAL_ROUNDS; r++) {
                            state.roundProgress[r].remaining.push(id);
                        }
                    }
                }

                return state;
            }
        }
    } catch (e) {
        console.warn("Failed to load saved state:", e);
    }

    return createInitialState(speciesIds);
}

/**
 * Save state to localStorage.
 */
function saveState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn("Failed to save state:", e);
    }
}

/**
 * Clear saved state.
 */
function resetState() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get the next species to quiz in the current round.
 * Returns null if the round is complete.
 */
function getNextSpecies(state) {
    const round = state.currentRound;
    const progress = state.roundProgress[round];

    if (progress.remaining.length > 0) {
        return progress.remaining[0];
    }

    // Recycle retry queue whenever remaining is empty —
    // incorrect species keep appearing until answered correctly
    if (progress.retryQueue.length > 0) {
        progress.remaining = shuffle([...progress.retryQueue]);
        progress.retryQueue = [];
        progress.isRetrying = true;
        saveState(state);
        return progress.remaining[0];
    }

    return null; // Round complete
}

/**
 * Record an answer and update state.
 */
function recordAnswer(state, speciesId, correct) {
    const round = state.currentRound;
    const progress = state.roundProgress[round];

    // Update stats
    state.stats.totalAttempts++;
    if (correct) state.stats.totalCorrect++;

    if (!state.stats.perSpecies[speciesId]) {
        state.stats.perSpecies[speciesId] = { correct: 0, attempts: 0 };
    }
    state.stats.perSpecies[speciesId].attempts++;
    if (correct) state.stats.perSpecies[speciesId].correct++;

    // Remove from remaining
    const idx = progress.remaining.indexOf(speciesId);
    if (idx !== -1) {
        progress.remaining.splice(idx, 1);
    }

    if (correct) {
        // Add to completed
        if (!progress.completed.includes(speciesId)) {
            progress.completed.push(speciesId);
        }
    } else {
        // Add to retry queue
        if (!progress.retryQueue.includes(speciesId)) {
            progress.retryQueue.push(speciesId);
        }
    }

    saveState(state);
}

/**
 * Check if the current round is complete.
 */
function isRoundComplete(state) {
    const round = state.currentRound;
    const progress = state.roundProgress[round];
    return progress.remaining.length === 0 && progress.retryQueue.length === 0;
}

/**
 * Advance to the next round. Returns false if already at the last round.
 */
function advanceRound(state) {
    if (state.currentRound >= TOTAL_ROUNDS) {
        return false;
    }

    state.currentRound++;

    // Shuffle the remaining list for the new round
    const progress = state.roundProgress[state.currentRound];
    progress.remaining = shuffle([...progress.remaining, ...progress.completed.filter(
        id => !progress.completed.includes(id) && !progress.remaining.includes(id)
    )]);

    // If this round hasn't been started, populate from round 1's list
    if (progress.remaining.length === 0 && progress.completed.length === 0) {
        const allSpecies = [
            ...state.roundProgress[1].completed,
            ...state.roundProgress[1].remaining,
            ...state.roundProgress[1].retryQueue
        ];
        progress.remaining = shuffle([...new Set(allSpecies)]);
    }

    progress.isRetrying = false;
    saveState(state);
    return true;
}

/**
 * Switch to a specific round (allows skipping ahead or going back).
 */
function switchToRound(state, round) {
    state.currentRound = round;

    // If this round has never been started, populate it with all species
    const progress = state.roundProgress[round];
    if (progress.remaining.length === 0 && progress.completed.length === 0 && progress.retryQueue.length === 0) {
        const allSpecies = [
            ...state.roundProgress[1].completed,
            ...state.roundProgress[1].remaining,
            ...state.roundProgress[1].retryQueue
        ];
        progress.remaining = shuffle([...new Set(allSpecies)]);
    }

    saveState(state);
}

/**
 * Get completion percentage for a round.
 */
function getRoundCompletion(state, round) {
    const progress = state.roundProgress[round];
    const total = progress.completed.length + progress.remaining.length + progress.retryQueue.length;
    if (total === 0) return 0;
    return Math.round((progress.completed.length / total) * 100);
}

/**
 * Get total species count.
 */
function getTotalSpecies(state, round) {
    const progress = state.roundProgress[round];
    return progress.completed.length + progress.remaining.length + progress.retryQueue.length;
}

/**
 * Fisher-Yates shuffle.
 */
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
