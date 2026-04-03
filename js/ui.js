/**
 * UI rendering for the Maldives Marine Life Quiz.
 * Handles all screen transitions, DOM updates, and user interactions.
 */

let currentQuestion = null;
let answerLocked = false;

/**
 * Show a specific screen, hiding all others.
 */
function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add("active");
        // Scroll to top
        screen.scrollTop = 0;
    }
}

/**
 * Render the home/dashboard screen with progress overview.
 */
function renderHome(state, totalSpecies) {
    const overview = document.getElementById("progress-overview");
    overview.innerHTML = "";

    for (let r = 1; r <= TOTAL_ROUNDS; r++) {
        const completion = getRoundCompletion(state, r);
        const total = getTotalSpecies(state, r);
        const completed = state.roundProgress[r].completed.length;
        const isCurrent = r === state.currentRound;
        const isCompleted = completion === 100 && r < state.currentRound;

        const card = document.createElement("div");
        card.className = `round-progress-card${isCurrent ? " current" : ""}${isCompleted ? " completed" : ""}`;

        card.innerHTML = `
            <div class="round-number">${isCompleted ? "✓" : r}</div>
            <div class="round-info">
                <div class="round-name">${ROUND_NAMES[r - 1]}</div>
                <div class="round-description">${ROUND_DESCRIPTIONS[r - 1]}</div>
                <div class="round-bar">
                    <div class="round-bar-fill" style="width: ${completion}%"></div>
                </div>
                <div class="round-progress-text">${completed}/${total} species mastered</div>
            </div>
        `;

        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
            switchToRound(state, r);
            startQuiz();
        });

        overview.appendChild(card);
    }

    // Update continue button text
    const btnContinue = document.getElementById("btn-continue");
    btnContinue.textContent = `Continue Round ${state.currentRound}`;

    showScreen("home-screen");
}

/**
 * Render a quiz question on screen.
 */
function renderQuestion(question, state) {
    currentQuestion = question;
    answerLocked = false;

    // Update header
    const roundLabel = document.getElementById("quiz-round-label");
    roundLabel.textContent = `Round ${question.type}`;

    const progress = state.roundProgress[state.currentRound];
    const total = progress.completed.length + progress.remaining.length + progress.retryQueue.length;
    const done = progress.completed.length;
    document.getElementById("quiz-progress-text").textContent = `${done}/${total}`;
    document.getElementById("quiz-progress-fill").style.width = `${(done / total) * 100}%`;

    // Hide feedback
    document.getElementById("quiz-feedback").classList.add("hidden");

    const content = document.getElementById("quiz-content");
    content.innerHTML = "";

    switch (question.type) {
        case 1: renderGroupImageRound(content, question); break;
        case 2: renderGroupNameRound(content, question); break;
        case 3: renderSpeciesImageRound(content, question, true); break;
        case 4: renderSpeciesNameRound(content, question, true); break;
        case 5: renderSpeciesImageRound(content, question, false); break;
        case 6: renderSpeciesNameRound(content, question, false); break;
        case 7: renderTypeRound(content, question); break;
    }

    showScreen("quiz-screen");
}

/**
 * Round 1: 4 images + 1 group name — pick a fish from that group.
 */
function renderGroupImageRound(container, question) {
    const prompt = document.createElement("div");
    prompt.className = "quiz-prompt";
    prompt.innerHTML = `
        <div class="label">Which image is a:</div>
        <div class="group-name">${question.prompt.groupName}</div>
    `;
    container.appendChild(prompt);

    const grid = document.createElement("div");
    grid.className = "image-grid";

    question.options.forEach((option, idx) => {
        const div = document.createElement("div");
        div.className = "image-option";
        div.innerHTML = `<img src="${option.image}" alt="Fish option" loading="lazy">`;
        div.addEventListener("click", () => handleImageAnswer(idx, question));
        grid.appendChild(div);
    });

    container.appendChild(grid);
}

/**
 * Round 2: 1 image + 4 group names — pick the correct group.
 */
function renderGroupNameRound(container, question) {
    const imgDiv = document.createElement("div");
    imgDiv.className = "quiz-image-single";
    imgDiv.innerHTML = `<img src="${question.prompt.image}" alt="Fish to identify" loading="lazy">`;
    container.appendChild(imgDiv);

    const options = document.createElement("div");
    options.className = "name-options";

    question.options.forEach((option, idx) => {
        const btn = document.createElement("div");
        btn.className = "name-option";
        btn.innerHTML = `<div class="option-group">${option.groupName}</div>`;
        btn.addEventListener("click", () => handleNameAnswer(idx, question));
        options.appendChild(btn);
    });

    container.appendChild(options);
}

/**
 * Rounds 3 & 5: 4 images + 1 name — pick the matching image.
 * showEnglish controls whether English name is displayed.
 */
function renderSpeciesImageRound(container, question, showEnglish) {
    const prompt = document.createElement("div");
    prompt.className = "quiz-prompt";
    prompt.innerHTML = `
        <div class="label">Which image is this species?</div>
        <div class="latin-name">${question.prompt.latinName}</div>
        ${showEnglish && question.prompt.englishName ? `<div class="english-name">${question.prompt.englishName}</div>` : ""}
    `;
    container.appendChild(prompt);

    const grid = document.createElement("div");
    grid.className = "image-grid";

    question.options.forEach((option, idx) => {
        const div = document.createElement("div");
        div.className = "image-option";
        div.innerHTML = `<img src="${option.image}" alt="Fish option" loading="lazy">`;
        div.addEventListener("click", () => handleImageAnswer(idx, question));
        grid.appendChild(div);
    });

    container.appendChild(grid);
}

/**
 * Rounds 4 & 6: 1 image + 4 names — pick the matching name.
 * showEnglish controls whether English name is displayed.
 */
function renderSpeciesNameRound(container, question, showEnglish) {
    const imgDiv = document.createElement("div");
    imgDiv.className = "quiz-image-single";
    imgDiv.innerHTML = `<img src="${question.prompt.image}" alt="Fish to identify" loading="lazy">`;
    container.appendChild(imgDiv);

    const options = document.createElement("div");
    options.className = "name-options";

    question.options.forEach((option, idx) => {
        const btn = document.createElement("div");
        btn.className = "name-option";
        btn.innerHTML = `
            <div class="option-latin">${option.latinName}</div>
            ${showEnglish && option.englishName ? `<div class="option-english">${option.englishName}</div>` : ""}
        `;
        btn.addEventListener("click", () => handleNameAnswer(idx, question));
        options.appendChild(btn);
    });

    container.appendChild(options);
}

/**
 * Round 7: 1 image + text input for Latin name.
 */
function renderTypeRound(container, question) {
    const imgDiv = document.createElement("div");
    imgDiv.className = "quiz-image-single";
    imgDiv.innerHTML = `<img src="${question.prompt.image}" alt="Fish to identify" loading="lazy">`;
    container.appendChild(imgDiv);

    const inputContainer = document.createElement("div");
    inputContainer.className = "text-input-container";
    inputContainer.innerHTML = `
        <input type="text" id="latin-input" placeholder="Type the Latin name..."
               autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="text-input-hint">Spelling must be within 1 character of the correct answer</div>
        <button class="btn btn-primary btn-submit-answer" id="btn-submit-latin">Check Answer</button>
    `;
    container.appendChild(inputContainer);

    // Focus input after render
    setTimeout(() => {
        const input = document.getElementById("latin-input");
        if (input) input.focus();
    }, 100);

    // Handle submit
    document.getElementById("btn-submit-latin").addEventListener("click", () => {
        handleTextAnswer(question);
    });

    // Also submit on Enter
    document.getElementById("latin-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            handleTextAnswer(question);
        }
    });
}

/**
 * Handle clicking an image option (Rounds 1, 3, 5).
 */
function handleImageAnswer(selectedIndex, question) {
    if (answerLocked) return;
    answerLocked = true;

    const correct = selectedIndex === question.correctIndex;
    const imageOptions = document.querySelectorAll(".image-option");

    // Highlight correct and selected
    imageOptions.forEach((opt, idx) => {
        if (idx === question.correctIndex) {
            opt.classList.add("correct");
        } else if (idx === selectedIndex && !correct) {
            opt.classList.add("incorrect");
        } else {
            opt.classList.add("dimmed");
        }
        opt.style.pointerEvents = "none";
    });

    showFeedback(correct, question.targetSpecies);
    recordAnswer(window.appState, question.correctId, correct);
}

/**
 * Handle clicking a name option (Rounds 2, 4, 6).
 */
function handleNameAnswer(selectedIndex, question) {
    if (answerLocked) return;
    answerLocked = true;

    const correct = selectedIndex === question.correctIndex;
    const nameOptions = document.querySelectorAll(".name-option");

    nameOptions.forEach((opt, idx) => {
        if (idx === question.correctIndex) {
            opt.classList.add("correct");
        } else if (idx === selectedIndex && !correct) {
            opt.classList.add("incorrect");
        } else {
            opt.classList.add("dimmed");
        }
        opt.style.pointerEvents = "none";
    });

    showFeedback(correct, question.targetSpecies);
    recordAnswer(window.appState, question.correctId, correct);
}

/**
 * Handle text input answer (Round 7).
 */
function handleTextAnswer(question) {
    if (answerLocked) return;
    answerLocked = true;

    const input = document.getElementById("latin-input");
    const userAnswer = input.value.trim();

    if (!userAnswer) {
        answerLocked = false;
        return;
    }

    const correct = isAnswerClose(userAnswer, question.correctAnswer, 1);

    input.classList.add(correct ? "correct" : "incorrect");
    input.disabled = true;
    document.getElementById("btn-submit-latin").disabled = true;

    showFeedback(correct, question.targetSpecies, correct ? null : question.correctAnswer);
    recordAnswer(window.appState, question.correctId, correct);
}

/**
 * Show feedback after an answer.
 */
function showFeedback(correct, species, correctAnswer) {
    const feedback = document.getElementById("quiz-feedback");
    const content = document.getElementById("feedback-content");

    let html = "";
    if (correct) {
        html = `<div class="feedback-correct">Correct!</div>`;
    } else {
        html = `<div class="feedback-incorrect">Not quite!</div>`;
    }

    html += `<div class="feedback-species-info">
        <span class="latin">${species.latinName}</span>
        &mdash; ${species.englishName}
        <br><small>${species.group}</small>
    </div>`;

    if (correctAnswer && !correct) {
        html += `<div style="font-size: 0.85rem; color: #666; margin-bottom: 8px;">
            Correct answer: <em>${correctAnswer}</em>
        </div>`;
    }

    content.innerHTML = html;
    feedback.classList.remove("hidden");
}

/**
 * Render the round complete screen.
 */
function renderRoundComplete(state, round) {
    document.getElementById("round-complete-title").textContent = `Round ${round} Complete!`;

    const progress = state.roundProgress[round];
    const total = progress.completed.length;

    document.getElementById("round-complete-message").textContent =
        `You've identified all ${total} species in this round!`;

    const statsGrid = document.getElementById("round-complete-stats");
    const accuracy = state.stats.totalAttempts > 0
        ? Math.round((state.stats.totalCorrect / state.stats.totalAttempts) * 100)
        : 0;

    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${total}</div>
            <div class="stat-label">Species Mastered</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${accuracy}%</div>
            <div class="stat-label">Overall Accuracy</div>
        </div>
    `;

    const btnNextRound = document.getElementById("btn-next-round");
    if (round >= TOTAL_ROUNDS) {
        showScreen("all-complete-screen");
        return;
    }

    btnNextRound.textContent = `Start Round ${round + 1}`;
    showScreen("round-complete-screen");
}

/**
 * Render the species browser.
 */
function renderBrowser(allSpecies) {
    // Get unique groups
    const groups = [...new Set(allSpecies.map(sp => sp.group))].sort();

    // Render filter buttons
    const filters = document.getElementById("browse-filters");
    filters.innerHTML = `<button class="filter-btn active" data-group="all">All</button>`;
    groups.forEach(group => {
        filters.innerHTML += `<button class="filter-btn" data-group="${group}">${group}</button>`;
    });

    // Filter click handler
    let activeGroup = "all";
    filters.addEventListener("click", (e) => {
        if (e.target.classList.contains("filter-btn")) {
            filters.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            activeGroup = e.target.dataset.group;
            renderSpeciesList(allSpecies, activeGroup, document.getElementById("browse-search-input").value);
        }
    });

    // Search handler
    document.getElementById("browse-search-input").addEventListener("input", (e) => {
        renderSpeciesList(allSpecies, activeGroup, e.target.value);
    });

    renderSpeciesList(allSpecies, "all", "");
    showScreen("browse-screen");
}

/**
 * Render filtered species list in browser.
 */
function renderSpeciesList(allSpecies, group, searchQuery) {
    const list = document.getElementById("browse-list");
    const query = searchQuery.toLowerCase().trim();

    let filtered = allSpecies.filter(sp => {
        if (group !== "all" && sp.group !== group) return false;
        if (query) {
            return sp.latinName.toLowerCase().includes(query) ||
                   sp.englishName.toLowerCase().includes(query) ||
                   sp.family.toLowerCase().includes(query);
        }
        return true;
    });

    list.innerHTML = filtered.map(sp => `
        <div class="species-card">
            <div class="species-card-image">
                ${sp.images.length > 0
                    ? `<img src="${sp.images[0]}" alt="${sp.englishName}" loading="lazy">`
                    : ""}
            </div>
            <div class="species-card-info">
                <div class="species-card-group">${sp.group}</div>
                <div class="species-card-latin">${sp.latinName}</div>
                <div class="species-card-english">${sp.englishName}</div>
            </div>
        </div>
    `).join("");

    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">
            No species found matching your search.
        </div>`;
    }
}
