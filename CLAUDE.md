# Maldives Marine Life Quiz App

## Project Overview

A progressive quiz web app to help study for a marine biology exam on Maldivian marine species identification. The user must learn to identify ~235 photographed species by their Latin names.

**End user**: Non-technical person studying for a marine biology course. The app must be simple, mobile-friendly, and resilient (never lose progress).

**Hosting**: GitHub Pages from `friman-howard/fish` repo (main branch). Also exists on `friman-howard/Fleming` repo's `fish` branch.

**Live URL**: `https://friman-howard.github.io/fish/`

## Architecture

**Vanilla HTML/CSS/JS** - no build step, no framework, no dependencies. Works directly on GitHub Pages.

### File Structure

```
index.html              # Main app entry point, all screen containers
css/style.css           # Mobile-first responsive styles, ocean theme
js/
  app.js                # App init, event wiring, service worker registration
  images.js             # Dynamic image loader (Wikipedia/Wikimedia APIs)
  levenshtein.js        # Levenshtein distance for Round 5 answer validation
  quiz.js               # Quiz engine: question generation, distractors, all 5 round types
  state.js              # State management, localStorage persistence, progression logic
  ui.js                 # DOM rendering for all screens (home, quiz, browser, settings)
data/
  species.json          # Master species list (235 species, sorted by family)
sw.js                   # Service worker for offline support (caches app shell + images)
manifest.json           # PWA manifest
tools/
  build_species_list.py # Python script that generates species.json from curated list
  download_images.py    # Python script to download/resize images from Wikimedia/iNaturalist
```

### How Images Work

Images are **NOT stored in the repo**. Instead, `js/images.js` fetches them dynamically at runtime:

1. On first load, it queries the Wikipedia REST API (`/api/rest_v1/page/summary/{LatinName}`) for each species to get thumbnail URLs
2. For species not found on Wikipedia, it falls back to Wikimedia Commons search API
3. Image URLs are cached in `localStorage` (key: `maldives-fish-quiz-images`) so subsequent loads are instant
4. The service worker (`sw.js`) caches the actual image files after first view for offline use

### Quiz Structure - 5 Progressive Rounds

| Round | Format | Difficulty |
|-------|--------|-----------|
| 1 | 4 images + 1 name (English + Latin) → pick matching image | Easiest |
| 2 | 1 image + 4 names (English + Latin) → pick matching name | Easy |
| 3 | 4 images + 1 Latin-only name → pick matching image | Medium |
| 4 | 1 image + 4 Latin-only names → pick matching name | Hard |
| 5 | 1 image → type the Latin name (Levenshtein distance ≤ 1) | Hardest |

### Progression Logic

- Within each round, ALL species are presented once
- Incorrect answers go to a retry queue
- After all species attempted, retry queue is shuffled and re-presented
- Round completes only when ALL species answered correctly
- Progress saved to `localStorage` (key: `maldives-fish-quiz-state`) after every answer
- Distractor selection prefers same-family species for harder questions

### State Shape (localStorage)

```json
{
  "currentRound": 1,
  "roundProgress": {
    "1": { "remaining": ["species-id", ...], "completed": [...], "retryQueue": [...], "isRetrying": false },
    "2": { ... }, "3": { ... }, "4": { ... }, "5": { ... }
  },
  "stats": {
    "totalCorrect": 0,
    "totalAttempts": 0,
    "perSpecies": { "species-id": { "correct": 0, "attempts": 0 } }
  },
  "version": 2
}
```

## Species Data

235 species across 39 families, curated from the FishBase Maldives checklist and the reference book "Fishes of the Maldives" by Kuiter & Godfrey. Major groups include:

- Butterflyfish (22), Wrasse (21), Surgeonfish (17), Damselfish (16)
- Grouper (15), Triggerfish (10), Parrotfish (11), Shark (10)
- Angelfish (9), Ray (8), Moray Eel (8), Snapper (8)
- Plus: Squirrelfish, Goatfish, Hawkfish, Jacks, Pufferfish, Boxfish, Scorpionfish, Blenny, Goby, Sweetlips, Emperor, Fusilier, Filefish, Porcupinefish, Barracuda, and more

### Modifying the Species List

Edit `tools/build_species_list.py` → `SPECIES_LIST` tuple array, then run:
```bash
python3 tools/build_species_list.py
```
This regenerates `data/species.json`. Each entry is `(latinName, englishName, familyName)`.

## Development

### Local Testing
```bash
cd /path/to/repo
npx http-server -p 8080
# Open http://localhost:8080
```

The service worker requires HTTPS or localhost to function. Image loading requires internet access (fetches from Wikipedia).

### Key Design Decisions

1. **No build step** - vanilla JS means anyone can edit and deploy without tooling
2. **Dynamic images** - avoids storing 500+ images in git; Wikipedia/Wikimedia provides free, high-quality species photos
3. **localStorage for everything** - simple, no server needed, works offline
4. **Service worker** - caches app shell immediately, caches images as they're viewed (cache-first strategy for images, network-first for app files)
5. **Mobile-first CSS** - primary use case is studying on a phone

### CSS Theme

Ocean-themed palette defined in CSS variables:
- `--color-ocean-dark: #0a2942` (header backgrounds)
- `--color-teal: #16a085` (primary actions, progress bars)
- `--color-coral: #e74c3c` (errors, incorrect answers)
- `--color-success: #27ae60` (correct answers)

### Known Limitations

- Image loading depends on Wikipedia API availability
- Some species may not have Wikipedia articles (falls back to Wikimedia Commons search)
- localStorage has ~5-10MB limit; image URL cache is small but quiz state grows with per-species stats
- Service worker offline mode only works for previously-viewed images

## Possible Future Improvements

- Add more species (the reference book has ~700+)
- Add a "focus mode" to practice only species from specific families
- Add spaced repetition (prioritize species that were recently incorrect)
- Add statistics/analytics screen showing weakest species
- Support multiple image sources per species for variety
- Add audio pronunciation of Latin names
- Allow user to upload custom species photos
