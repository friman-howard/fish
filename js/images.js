/**
 * Dynamic image loader for the Maldives Marine Life Quiz.
 * Fetches species images from Wikipedia and Wikimedia Commons APIs
 * at runtime, then caches the URLs in localStorage.
 *
 * This approach avoids storing hundreds of images in the repository
 * while still providing a fast experience after first load.
 */

const IMAGE_CACHE_KEY = "maldives-fish-quiz-images";
const IMAGE_CACHE_VERSION = 1;
const WIKI_API_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const COMMONS_API_BASE = "https://commons.wikimedia.org/w/api.php";
const BATCH_SIZE = 50;
const REQUEST_DELAY = 200; // ms between API calls

/**
 * Load or fetch all species images.
 * Returns a map of { speciesId: [url1, url2, ...] }
 */
async function loadSpeciesImages(speciesList, progressCallback) {
    // Check cache first
    const cached = loadImageCache();
    if (cached && Object.keys(cached).length > 0) {
        // Verify cache has enough species
        const cachedCount = Object.keys(cached).length;
        const neededCount = speciesList.length;
        if (cachedCount >= neededCount * 0.8) {
            return cached;
        }
    }

    // Fetch images from Wikipedia
    const imageMap = cached || {};
    const uncached = speciesList.filter(sp => !imageMap[sp.id] || imageMap[sp.id].length === 0);

    if (uncached.length === 0) return imageMap;

    const total = uncached.length;
    let completed = 0;

    // Batch fetch from Wikipedia REST API (summary endpoint)
    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
        const batch = uncached.slice(i, i + BATCH_SIZE);

        // Fetch each species in the batch concurrently
        const promises = batch.map(async (species) => {
            try {
                const title = species.latinName.replace(/ /g, "_");
                const url = WIKI_API_BASE + encodeURIComponent(title);
                const response = await fetch(url);

                if (!response.ok) return null;
                const data = await response.json();

                const images = [];

                // Get the main thumbnail
                if (data.originalimage && data.originalimage.source) {
                    images.push(resizeWikiUrl(data.originalimage.source, 800));
                } else if (data.thumbnail && data.thumbnail.source) {
                    images.push(resizeWikiUrl(data.thumbnail.source, 800));
                }

                return { id: species.id, images };
            } catch (e) {
                return null;
            }
        });

        const results = await Promise.all(promises);

        for (const result of results) {
            if (result && result.images.length > 0) {
                imageMap[result.id] = result.images;
            }
            completed++;
        }

        if (progressCallback) {
            progressCallback(completed, total);
        }

        // Save progress
        saveImageCache(imageMap);

        // Small delay between batches
        if (i + BATCH_SIZE < uncached.length) {
            await sleep(REQUEST_DELAY);
        }
    }

    // For species still missing images, try Wikimedia Commons search
    const stillMissing = speciesList.filter(sp => !imageMap[sp.id] || imageMap[sp.id].length === 0);

    if (stillMissing.length > 0) {
        for (let i = 0; i < stillMissing.length; i += 10) {
            const batch = stillMissing.slice(i, i + 10);

            for (const species of batch) {
                try {
                    const images = await searchCommonsImages(species.latinName);
                    if (images.length > 0) {
                        imageMap[species.id] = images;
                    }
                } catch (e) {
                    // Skip on error
                }
                await sleep(100);
            }

            saveImageCache(imageMap);

            if (progressCallback) {
                progressCallback(Math.min(total, completed + i + batch.length), total);
            }
        }
    }

    saveImageCache(imageMap);
    return imageMap;
}

/**
 * Search Wikimedia Commons for species images.
 */
async function searchCommonsImages(latinName, limit = 2) {
    const params = new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        generator: "search",
        gsrnamespace: "6",
        gsrsearch: `"${latinName}"`,
        gsrlimit: String(limit),
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "800"
    });

    const response = await fetch(`${COMMONS_API_BASE}?${params}`);
    if (!response.ok) return [];

    const data = await response.json();
    const pages = data.query?.pages || {};
    const images = [];

    for (const pageId in pages) {
        if (parseInt(pageId) < 0) continue;
        const page = pages[pageId];
        for (const info of (page.imageinfo || [])) {
            const url = info.thumburl || info.url;
            if (url) images.push(url);
        }
    }

    return images;
}

/**
 * Resize a Wikimedia image URL to a specific width.
 * Wikimedia thumb URLs follow the pattern: .../thumb/hash/Filename/WIDTHpx-Filename
 */
function resizeWikiUrl(url, width) {
    // If it's already a thumb URL, replace the width
    const thumbMatch = url.match(/\/(\d+)px-[^/]+$/);
    if (thumbMatch) {
        return url.replace(/\/\d+px-/, `/${width}px-`);
    }

    // If it's an original URL, convert to thumb URL
    // Pattern: upload.wikimedia.org/wikipedia/commons/a/ab/File.jpg
    // Becomes: upload.wikimedia.org/wikipedia/commons/thumb/a/ab/File.jpg/800px-File.jpg
    const commonsMatch = url.match(/\/wikipedia\/commons\/([0-9a-f]\/[0-9a-f]{2}\/([^/]+))$/);
    if (commonsMatch) {
        const path = commonsMatch[1];
        const filename = commonsMatch[2];
        return url.replace(
            `/wikipedia/commons/${path}`,
            `/wikipedia/commons/thumb/${path}/${width}px-${filename}`
        );
    }

    return url;
}

/**
 * Apply loaded images to the species list.
 */
function applyImagesToSpecies(speciesList, imageMap) {
    for (const species of speciesList) {
        if (imageMap[species.id] && imageMap[species.id].length > 0) {
            species.images = imageMap[species.id];
        }
    }
    return speciesList;
}

/**
 * Load image cache from localStorage.
 */
function loadImageCache() {
    try {
        const data = localStorage.getItem(IMAGE_CACHE_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            if (parsed.version === IMAGE_CACHE_VERSION) {
                return parsed.images;
            }
        }
    } catch (e) {
        // Ignore
    }
    return null;
}

/**
 * Save image cache to localStorage.
 */
function saveImageCache(imageMap) {
    try {
        localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify({
            version: IMAGE_CACHE_VERSION,
            images: imageMap,
            timestamp: Date.now()
        }));
    } catch (e) {
        // localStorage might be full - try to continue anyway
        console.warn("Failed to save image cache:", e);
    }
}

/**
 * Clear the image cache.
 */
function clearImageCache() {
    localStorage.removeItem(IMAGE_CACHE_KEY);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
