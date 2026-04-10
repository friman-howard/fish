/**
 * Quiz engine for the Maldives Marine Life Quiz.
 * Handles question generation, distractor selection, and answer validation
 * for all 9 round types.
 *
 * Rounds 1-2: Group identification (common names)
 * Rounds 3-4: Family identification (Latin family names)
 * Rounds 5-9: Species identification (progressively harder)
 */

/**
 * Generate a quiz question for the current species and round.
 */
function generateQuestion(state, speciesMap, allSpecies) {
    const round = state.currentRound;
    const targetId = getNextSpecies(state);

    if (!targetId) return null;

    const target = speciesMap[targetId];
    if (!target || !target.images || target.images.length === 0) {
        // Skip species with no images
        recordAnswer(state, targetId, true);
        return generateQuestion(state, speciesMap, allSpecies);
    }

    switch (round) {
        case 1: return generateGroupRound1(target, speciesMap, allSpecies);
        case 2: return generateGroupRound2(target, speciesMap, allSpecies);
        case 3: return generateFamilyRound1(target, speciesMap, allSpecies);
        case 4: return generateFamilyRound2(target, speciesMap, allSpecies);
        case 5: return generateRound5(target, speciesMap, allSpecies);
        case 6: return generateRound6(target, speciesMap, allSpecies);
        case 7: return generateRound7(target, speciesMap, allSpecies);
        case 8: return generateRound8(target, speciesMap, allSpecies);
        case 9: return generateRound9(target);
        default: return null;
    }
}

/**
 * Round 1 (Group): Show 4 images from different groups + 1 group name.
 * User picks which image belongs to that group.
 */
function generateGroupRound1(target, speciesMap, allSpecies) {
    const distractors = pickGroupDistractors(target, allSpecies, 3);
    const options = [target, ...distractors].map(sp => ({
        speciesId: sp.id,
        image: randomImage(sp)
    }));

    const shuffled = shuffle(options);
    const correctIndex = shuffled.findIndex(o => o.speciesId === target.id);

    return {
        type: 1,
        targetSpecies: target,
        prompt: {
            groupName: target.group
        },
        options: shuffled,
        correctIndex,
        correctId: target.id
    };
}

/**
 * Round 2 (Group): Show 1 image + 4 group names.
 * User picks which group the fish belongs to.
 */
function generateGroupRound2(target, speciesMap, allSpecies) {
    // Get unique groups excluding the target's group
    const allGroups = [...new Set(allSpecies.map(sp => sp.group))];
    const otherGroups = allGroups.filter(g => g !== target.group);
    const distractorGroups = shuffle(otherGroups).slice(0, 3);

    const options = [target.group, ...distractorGroups].map(group => ({
        groupName: group
    }));

    const shuffled = shuffle(options);
    const correctIndex = shuffled.findIndex(o => o.groupName === target.group);

    return {
        type: 2,
        targetSpecies: target,
        prompt: {
            image: randomImage(target)
        },
        options: shuffled,
        correctIndex,
        correctId: target.id
    };
}

/**
 * Round 3 (Family): Show 4 images from different families + 1 Latin family name.
 * User picks which image belongs to that family.
 */
function generateFamilyRound1(target, speciesMap, allSpecies) {
    const distractors = pickFamilyDistractors(target, allSpecies, 3);
    const options = [target, ...distractors].map(sp => ({
        speciesId: sp.id,
        image: randomImage(sp)
    }));

    const shuffled = shuffle(options);
    const correctIndex = shuffled.findIndex(o => o.speciesId === target.id);

    return {
        type: 3,
        targetSpecies: target,
        prompt: {
            familyName: target.family
        },
        options: shuffled,
        correctIndex,
        correctId: target.id
    };
}

/**
 * Round 4 (Family): Show 1 image + 4 Latin family names.
 * User picks which family the fish belongs to.
 */
function generateFamilyRound2(target, speciesMap, allSpecies) {
    // Get unique families excluding the target's family
    const allFamilies = [...new Set(allSpecies.map(sp => sp.family))];
    const otherFamilies = allFamilies.filter(f => f !== target.family);
    const distractorFamilies = shuffle(otherFamilies).slice(0, 3);

    const options = [target.family, ...distractorFamilies].map(family => ({
        familyName: family
    }));

    const shuffled = shuffle(options);
    const correctIndex = shuffled.findIndex(o => o.familyName === target.family);

    return {
        type: 4,
        targetSpecies: target,
        prompt: {
            image: randomImage(target)
        },
        options: shuffled,
        correctIndex,
        correctId: target.id
    };
}

/**
 * Round 5: Show 4 images + 1 name (English + Latin).
 * User picks which image matches the name.
 */
function generateRound5(target, speciesMap, allSpecies) {
    const distractors = pickDistractors(target, speciesMap, allSpecies, 3);
    const options = [target, ...distractors].map(sp => ({
        speciesId: sp.id,
        image: randomImage(sp)
    }));

    const shuffled = shuffle(options);
    const correctIndex = shuffled.findIndex(o => o.speciesId === target.id);

    return {
        type: 5,
        targetSpecies: target,
        prompt: {
            latinName: target.latinName,
            englishName: target.englishName
        },
        options: shuffled,
        correctIndex,
        correctId: target.id
    };
}

/**
 * Round 6: Show 1 image + 4 names (English + Latin).
 * User picks which name matches the image.
 */
function generateRound6(target, speciesMap, allSpecies) {
    const distractors = pickDistractors(target, speciesMap, allSpecies, 3);
    const options = [target, ...distractors].map(sp => ({
        speciesId: sp.id,
        latinName: sp.latinName,
        englishName: sp.englishName
    }));

    const shuffled = shuffle(options);
    const correctIndex = shuffled.findIndex(o => o.speciesId === target.id);

    return {
        type: 6,
        targetSpecies: target,
        prompt: {
            image: randomImage(target)
        },
        options: shuffled,
        correctIndex,
        correctId: target.id
    };
}

/**
 * Round 7: Show 4 images + 1 Latin-only name.
 * User picks which image matches the Latin name.
 */
function generateRound7(target, speciesMap, allSpecies) {
    const distractors = pickDistractors(target, speciesMap, allSpecies, 3);
    const options = [target, ...distractors].map(sp => ({
        speciesId: sp.id,
        image: randomImage(sp)
    }));

    const shuffled = shuffle(options);
    const correctIndex = shuffled.findIndex(o => o.speciesId === target.id);

    return {
        type: 7,
        targetSpecies: target,
        prompt: {
            latinName: target.latinName
        },
        options: shuffled,
        correctIndex,
        correctId: target.id
    };
}

/**
 * Round 8: Show 1 image + 4 Latin-only names.
 * User picks which Latin name matches the image.
 */
function generateRound8(target, speciesMap, allSpecies) {
    const distractors = pickDistractors(target, speciesMap, allSpecies, 3);
    const options = [target, ...distractors].map(sp => ({
        speciesId: sp.id,
        latinName: sp.latinName
    }));

    const shuffled = shuffle(options);
    const correctIndex = shuffled.findIndex(o => o.speciesId === target.id);

    return {
        type: 8,
        targetSpecies: target,
        prompt: {
            image: randomImage(target)
        },
        options: shuffled,
        correctIndex,
        correctId: target.id
    };
}

/**
 * Round 9: Show 1 image. User types the Latin name.
 */
function generateRound9(target) {
    return {
        type: 9,
        targetSpecies: target,
        prompt: {
            image: randomImage(target)
        },
        correctAnswer: target.latinName,
        correctId: target.id
    };
}

/**
 * Pick N distractor species from DIFFERENT families (for family rounds).
 */
function pickFamilyDistractors(target, allSpecies, count) {
    const usedFamilies = new Set([target.family]);
    const distractors = [];

    const candidates = shuffle(
        allSpecies.filter(sp => sp.id !== target.id && sp.images && sp.images.length > 0)
    );

    for (const sp of candidates) {
        if (distractors.length >= count) break;
        if (!usedFamilies.has(sp.family)) {
            distractors.push(sp);
            usedFamilies.add(sp.family);
        }
    }

    // If not enough unique families, fill with any other species
    if (distractors.length < count) {
        for (const sp of candidates) {
            if (distractors.length >= count) break;
            if (sp.id !== target.id && !distractors.some(d => d.id === sp.id)) {
                distractors.push(sp);
            }
        }
    }

    return distractors;
}

/**
 * Pick N distractor species from DIFFERENT groups (for group rounds).
 * Ensures each distractor is from a unique group.
 */
function pickGroupDistractors(target, allSpecies, count) {
    const usedGroups = new Set([target.group]);
    const distractors = [];

    const candidates = shuffle(
        allSpecies.filter(sp => sp.id !== target.id && sp.images && sp.images.length > 0)
    );

    for (const sp of candidates) {
        if (distractors.length >= count) break;
        if (!usedGroups.has(sp.group)) {
            distractors.push(sp);
            usedGroups.add(sp.group);
        }
    }

    // If not enough unique groups, fill with any other species
    if (distractors.length < count) {
        for (const sp of candidates) {
            if (distractors.length >= count) break;
            if (sp.id !== target.id && !distractors.some(d => d.id === sp.id)) {
                distractors.push(sp);
            }
        }
    }

    return distractors;
}

/**
 * Pick N distractor species that are different from the target.
 * Prefers species from the same family for harder questions.
 */
function pickDistractors(target, speciesMap, allSpecies, count) {
    // Get species from the same family first
    const sameFamily = allSpecies.filter(sp =>
        sp.id !== target.id &&
        sp.family === target.family &&
        sp.images && sp.images.length > 0
    );

    // Get other species
    const otherSpecies = allSpecies.filter(sp =>
        sp.id !== target.id &&
        sp.family !== target.family &&
        sp.images && sp.images.length > 0
    );

    const distractors = [];
    const used = new Set([target.id]);

    // Take from same family first (up to half the distractors)
    const sameFamilyShuffled = shuffle(sameFamily);
    const maxSameFamily = Math.min(Math.ceil(count / 2), sameFamilyShuffled.length);
    for (let i = 0; i < maxSameFamily && distractors.length < count; i++) {
        if (!used.has(sameFamilyShuffled[i].id)) {
            distractors.push(sameFamilyShuffled[i]);
            used.add(sameFamilyShuffled[i].id);
        }
    }

    // Fill the rest from other species
    const otherShuffled = shuffle(otherSpecies);
    for (let i = 0; i < otherShuffled.length && distractors.length < count; i++) {
        if (!used.has(otherShuffled[i].id)) {
            distractors.push(otherShuffled[i]);
            used.add(otherShuffled[i].id);
        }
    }

    // If still not enough, add from same family
    if (distractors.length < count) {
        for (const sp of sameFamilyShuffled) {
            if (!used.has(sp.id) && distractors.length < count) {
                distractors.push(sp);
                used.add(sp.id);
            }
        }
    }

    return distractors;
}

/**
 * Get a random image URL for a species.
 */
function randomImage(species) {
    if (!species.images || species.images.length === 0) return "";
    const idx = Math.floor(Math.random() * species.images.length);
    return species.images[idx];
}
