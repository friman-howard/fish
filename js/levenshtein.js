/**
 * Levenshtein distance calculation for Round 5 answer validation.
 * Returns the minimum number of single-character edits needed to
 * change one string into the other.
 */

function levenshteinDistance(a, b) {
    const m = a.length;
    const n = b.length;

    // Create a matrix of distances
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,       // deletion
                dp[i][j - 1] + 1,       // insertion
                dp[i - 1][j - 1] + cost  // substitution
            );
        }
    }

    return dp[m][n];
}

/**
 * Check if the user's answer is close enough to the correct answer.
 * Normalizes both strings (lowercase, trimmed) before comparing.
 * Returns true if Levenshtein distance <= maxDistance.
 */
function isAnswerClose(userAnswer, correctAnswer, maxDistance = 1) {
    const a = userAnswer.trim().toLowerCase();
    const b = correctAnswer.trim().toLowerCase();

    if (a === b) return true;
    return levenshteinDistance(a, b) <= maxDistance;
}
