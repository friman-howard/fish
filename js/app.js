/**
 * Main application entry point for the Maldives Marine Life Quiz.
 * Initializes the app, loads species data, fetches images, and wires up events.
 */

// Global state
window.appState = null;
let speciesMap = {};
let allSpecies = [];

/**
 * Initialize the application.
 */
async function initApp() {
    try {
        const loadingText = document.querySelector(".loading-content p");

        // Load species data
        loadingText.textContent = "Loading species data...";
        const response = await fetch("data/species.json");
        if (!response.ok) throw new Error("Failed to load species data");
        const rawSpecies = await response.json();

        // Fetch images from Wikipedia (with progress updates)
        loadingText.textContent = "Fetching species images...";
        const imageMap = await loadSpeciesImages(rawSpecies, (done, total) => {
            const pct = Math.round((done / total) * 100);
            loadingText.textContent = `Fetching species images... ${pct}% (${done}/${total})`;
        });

        // Apply images to species
        allSpecies = applyImagesToSpecies(rawSpecies, imageMap);

        // Filter to species that have images
        allSpecies = allSpecies.filter(sp => sp.images && sp.images.length > 0);

        if (allSpecies.length === 0) {
            loadingText.textContent = navigator.onLine
                ? "Could not load species images. Please refresh the page."
                : "No cached images available. Please connect to the internet and reload to download images.";
            return;
        }

        loadingText.textContent = `Loaded ${allSpecies.length} species.`;

        // Pre-cache all images for offline use (runs in background after first fetch)
        if (navigator.onLine) {
            loadingText.textContent = `Caching images for offline use...`;
            await precacheAllImages(imageMap, (done, total) => {
                const pct = Math.round((done / total) * 100);
                loadingText.textContent = `Caching images for offline use... ${pct}%`;
            });
        }

        // Build species map for quick lookup
        speciesMap = {};
        allSpecies.forEach(sp => { speciesMap[sp.id] = sp; });

        // Load or create state
        const speciesIds = allSpecies.map(sp => sp.id);
        window.appState = loadState(speciesIds);

        // Wire up event handlers
        setupEventHandlers();

        // Register service worker
        registerServiceWorker();

        // Show home screen
        renderHome(window.appState, allSpecies.length);

    } catch (error) {
        console.error("Failed to initialize app:", error);
        document.querySelector(".loading-content p").textContent =
            "Error loading app. Please refresh the page.";
    }
}

/**
 * Set up all event handlers.
 */
function setupEventHandlers() {
    // Home screen buttons
    document.getElementById("btn-continue").addEventListener("click", startQuiz);
    document.getElementById("btn-restart-round").addEventListener("click", restartCurrentRound);
    document.getElementById("btn-browse").addEventListener("click", () => renderBrowser(allSpecies));
    document.getElementById("btn-settings").addEventListener("click", () => showScreen("settings-screen"));

    // Quiz screen buttons
    document.getElementById("btn-home").addEventListener("click", () => {
        renderHome(window.appState, allSpecies.length);
    });
    document.getElementById("btn-next").addEventListener("click", nextQuestion);

    // Round complete screen buttons
    document.getElementById("btn-next-round").addEventListener("click", () => {
        advanceRound(window.appState);
        startQuiz();
    });
    document.getElementById("btn-round-home").addEventListener("click", () => {
        renderHome(window.appState, allSpecies.length);
    });

    // All complete screen
    document.getElementById("btn-all-home").addEventListener("click", () => {
        renderHome(window.appState, allSpecies.length);
    });

    // Browse screen
    document.getElementById("btn-browse-back").addEventListener("click", () => {
        renderHome(window.appState, allSpecies.length);
    });

    // Settings screen
    document.getElementById("btn-settings-back").addEventListener("click", () => {
        renderHome(window.appState, allSpecies.length);
    });
    document.getElementById("btn-reset").addEventListener("click", handleReset);
    document.getElementById("btn-refresh-images").addEventListener("click", handleRefreshImages);
}

/**
 * Start or continue the quiz from the current round.
 */
function startQuiz() {
    const question = generateQuestion(window.appState, speciesMap, allSpecies);

    if (!question) {
        // Current round is complete
        if (isRoundComplete(window.appState)) {
            renderRoundComplete(window.appState, window.appState.currentRound);
        }
        return;
    }

    renderQuestion(question, window.appState);
}

/**
 * Advance to the next question after answering.
 */
function nextQuestion() {
    // Check if round is complete
    if (isRoundComplete(window.appState)) {
        renderRoundComplete(window.appState, window.appState.currentRound);
        return;
    }

    // Generate next question
    const question = generateQuestion(window.appState, speciesMap, allSpecies);
    if (!question) {
        renderRoundComplete(window.appState, window.appState.currentRound);
        return;
    }

    renderQuestion(question, window.appState);
}

/**
 * Restart the current round.
 */
function restartCurrentRound() {
    if (!confirm("Restart the current round? Your progress in this round will be reset.")) {
        return;
    }

    const round = window.appState.currentRound;
    const allIds = allSpecies.map(sp => sp.id);

    window.appState.roundProgress[round] = {
        remaining: shuffle(allIds),
        completed: [],
        retryQueue: [],
        isRetrying: false
    };

    saveState(window.appState);
    renderHome(window.appState, allSpecies.length);
}

/**
 * Handle full progress reset.
 */
function handleReset() {
    if (!confirm("Reset ALL progress? This will start you over from Round 1. This cannot be undone.")) {
        return;
    }

    resetState();
    clearImageCache();
    const speciesIds = allSpecies.map(sp => sp.id);
    window.appState = createInitialState(speciesIds);
    saveState(window.appState);

    renderHome(window.appState, allSpecies.length);
}

/**
 * Handle image refresh request.
 */
async function handleRefreshImages() {
    if (!confirm("Re-download all species images? This may take a minute.")) return;

    clearImageCache();
    const btn = document.getElementById("btn-refresh-images");
    btn.disabled = true;
    btn.textContent = "Refreshing...";

    const rawSpecies = await (await fetch("data/species.json")).json();
    const imageMap = await loadSpeciesImages(rawSpecies, (done, total) => {
        btn.textContent = `Refreshing... ${Math.round((done/total)*100)}%`;
    });

    allSpecies = applyImagesToSpecies(rawSpecies, imageMap);
    allSpecies = allSpecies.filter(sp => sp.images && sp.images.length > 0);
    speciesMap = {};
    allSpecies.forEach(sp => { speciesMap[sp.id] = sp; });

    btn.textContent = "Caching for offline...";
    await precacheAllImages(imageMap, (done, total) => {
        btn.textContent = `Caching... ${Math.round((done/total)*100)}%`;
    });

    btn.disabled = false;
    btn.textContent = "Refresh Images";
    alert(`Loaded and cached images for ${allSpecies.length} species.`);
}

/**
 * Register service worker for offline support.
 */
function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").catch(err => {
            console.log("Service worker registration failed:", err);
        });
    }
}

// Start the app when DOM is ready
document.addEventListener("DOMContentLoaded", initApp);
