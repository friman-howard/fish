/**
 * Dynamic image loader for the Maldives Marine Life Quiz.
 * Fetches species images from iNaturalist (primary) and Wikimedia Commons
 * (fallback) APIs at runtime, then caches the URLs in localStorage.
 *
 * This approach avoids storing hundreds of images in the repository
 * while still providing a fast experience after first load.
 */

const IMAGE_CACHE_KEY = "maldives-fish-quiz-images";
const IMAGE_CACHE_VERSION = 3;
const INAT_API_BASE = "https://api.inaturalist.org/v1/taxa";
const COMMONS_API_BASE = "https://commons.wikimedia.org/w/api.php";
const BATCH_SIZE = 30;
const REQUEST_DELAY = 300; // ms between API calls

/**
 * Load or fetch all species images.
 * Returns a map of { speciesId: [url1, url2, ...] }
 */
async function loadSpeciesImages(speciesList, progressCallback) {
    // Check cache first
    const cached = loadImageCache();
    const isOffline = !navigator.onLine;

    if (cached && Object.keys(cached).length > 0) {
        const cachedCount = Object.keys(cached).length;
        const neededCount = speciesList.length;
        // If offline, use whatever we have cached
        if (isOffline || cachedCount >= neededCount * 0.8) {
            return cached;
        }
    }

    // If offline with no cache, return empty (app will show error)
    if (isOffline) return cached || {};

    const imageMap = cached || {};
    const uncached = speciesList.filter(sp => !imageMap[sp.id] || imageMap[sp.id].length === 0);

    if (uncached.length === 0) return imageMap;

    const total = uncached.length;
    let completed = 0;

    // Primary source: iNaturalist taxa API
    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
        const batch = uncached.slice(i, i + BATCH_SIZE);

        const promises = batch.map(async (species) => {
            try {
                const images = await fetchINatImages(species.latinName);
                return { id: species.id, images };
            } catch (e) {
                return { id: species.id, images: [] };
            }
        });

        const results = await Promise.all(promises);

        for (const result of results) {
            if (result.images.length > 0) {
                imageMap[result.id] = result.images;
            }
            completed++;
        }

        if (progressCallback) {
            progressCallback(completed, total);
        }

        saveImageCache(imageMap);

        if (i + BATCH_SIZE < uncached.length) {
            await sleep(REQUEST_DELAY);
        }
    }

    // Fallback: Wikimedia Commons for species still missing images
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
 * Fetch species images from the iNaturalist taxa API.
 * Returns an array of image URLs.
 */
async function fetchINatImages(latinName) {
    const params = new URLSearchParams({
        q: latinName,
        per_page: "1",
        is_active: "true"
    });

    const response = await fetch(`${INAT_API_BASE}?${params}`);
    if (!response.ok) return [];

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) return [];

    // Find the best matching taxon (exact species name match preferred)
    const taxon = results.find(t => t.name === latinName) || results[0];
    const images = [];

    // Get the default photo
    if (taxon.default_photo) {
        const photoUrl = getINatPhotoUrl(taxon.default_photo, "medium");
        if (photoUrl) images.push(photoUrl);
    }

    // Also grab taxon_photos for variety (up to 3 total)
    if (taxon.taxon_photos && taxon.taxon_photos.length > 0) {
        for (const tp of taxon.taxon_photos) {
            if (images.length >= 3) break;
            if (tp.photo) {
                const photoUrl = getINatPhotoUrl(tp.photo, "medium");
                if (photoUrl && !images.includes(photoUrl)) {
                    images.push(photoUrl);
                }
            }
        }
    }

    return images;
}

/**
 * Get a sized photo URL from an iNaturalist photo object.
 * iNaturalist photo URLs follow the pattern:
 *   https://inaturalist-open-data.s3.amazonaws.com/photos/{id}/{size}.{ext}
 *   or https://static.inaturalist.org/photos/{id}/{size}.{ext}
 * Sizes: square (75px), small (240px), medium (500px), large (1024px), original
 */
function getINatPhotoUrl(photo, size) {
    // Try medium_url directly
    if (photo.medium_url) return photo.medium_url;

    // Build from square_url or url by replacing the size segment
    const baseUrl = photo.square_url || photo.url || photo.small_url;
    if (!baseUrl) return null;

    // Replace size in URL path: /square. -> /medium. or /small. -> /medium.
    return baseUrl.replace(/\/(square|small|medium|large|original)\./, `/${size}.`);
}

/**
 * Search Wikimedia Commons for species images (fallback).
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
        iiurlwidth: "500"
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

/**
 * Pre-cache all image files into the service worker cache.
 * This fetches every image URL so the service worker intercepts and
 * stores the actual image data, making the app fully offline-capable.
 */
async function precacheAllImages(imageMap, progressCallback) {
    // Collect all unique image URLs
    const allUrls = [];
    for (const id in imageMap) {
        for (const url of imageMap[id]) {
            if (url && !allUrls.includes(url)) {
                allUrls.push(url);
            }
        }
    }

    if (allUrls.length === 0) return;

    const total = allUrls.length;
    let completed = 0;
    const PRECACHE_BATCH = 10;

    for (let i = 0; i < allUrls.length; i += PRECACHE_BATCH) {
        const batch = allUrls.slice(i, i + PRECACHE_BATCH);

        await Promise.all(batch.map(async (url) => {
            try {
                // The service worker will intercept this fetch and cache the response
                await fetch(url, { mode: "no-cors" });
            } catch (e) {
                // Ignore individual failures
            }
            completed++;
        }));

        if (progressCallback) {
            progressCallback(completed, total);
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
