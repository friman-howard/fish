#!/usr/bin/env python3
"""
Download species images from Wikimedia Commons and iNaturalist.
Uses the MediaWiki API to search for species photos by Latin name,
then downloads and resizes them.
"""

import json
import os
import sys
import time
import hashlib
import requests
from io import BytesIO
from PIL import Image

# Configuration
SPECIES_JSON = "/home/user/Fleming/data/species.json"
IMAGES_DIR = "/home/user/Fleming/images"
TARGET_IMAGES_PER_SPECIES = 3
MAX_IMAGE_DIMENSION = 800  # Max pixels on longest side
JPEG_QUALITY = 80

# API endpoints
WIKI_API = "https://commons.wikimedia.org/w/api.php"
WIKI_REST_API = "https://en.wikipedia.org/w/api.php"
INAT_API = "https://api.inaturalist.org/v1"

# Request headers
HEADERS = {
    "User-Agent": "MaldivesFishQuiz/1.0 (Educational marine biology quiz app; contact: quiz@example.com)"
}

# Rate limiting
WIKI_DELAY = 1.0  # seconds between wiki requests
INAT_DELAY = 1.0  # seconds between iNaturalist requests


def load_species():
    """Load species list from JSON."""
    with open(SPECIES_JSON) as f:
        return json.load(f)


def save_species(species_list):
    """Save updated species list to JSON."""
    with open(SPECIES_JSON, "w") as f:
        json.dump(species_list, f, indent=2)


def ensure_dir(path):
    """Create directory if it doesn't exist."""
    os.makedirs(path, exist_ok=True)


def resize_and_save(image_data, output_path):
    """Resize image and save as JPEG."""
    try:
        img = Image.open(BytesIO(image_data))

        # Convert to RGB if necessary (e.g., PNG with alpha)
        if img.mode in ("RGBA", "P", "LA"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize if needed
        w, h = img.size
        if max(w, h) > MAX_IMAGE_DIMENSION:
            if w > h:
                new_w = MAX_IMAGE_DIMENSION
                new_h = int(h * MAX_IMAGE_DIMENSION / w)
            else:
                new_h = MAX_IMAGE_DIMENSION
                new_w = int(w * MAX_IMAGE_DIMENSION / h)
            img = img.resize((new_w, new_h), Image.LANCZOS)

        # Don't save tiny images (likely icons/thumbnails)
        w, h = img.size
        if w < 200 or h < 150:
            return False

        img.save(output_path, "JPEG", quality=JPEG_QUALITY, optimize=True)
        return True
    except Exception as e:
        print(f"    Error processing image: {e}")
        return False


def search_wikimedia_commons(latin_name, limit=6):
    """Search Wikimedia Commons for images of a species."""
    images = []

    # Strategy 1: Search by Latin name in file descriptions
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrnamespace": "6",  # File namespace
        "gsrsearch": f'"{latin_name}"',
        "gsrlimit": str(limit),
        "prop": "imageinfo",
        "iiprop": "url|size|mime",
        "iiurlwidth": "800",
    }

    try:
        resp = requests.get(WIKI_API, params=params, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        pages = data.get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            if int(page_id) < 0:
                continue
            for info in page.get("imageinfo", []):
                mime = info.get("mime", "")
                if mime.startswith("image/") and mime != "image/svg+xml":
                    url = info.get("thumburl") or info.get("url")
                    if url:
                        images.append(url)
    except Exception as e:
        print(f"    Wikimedia search error: {e}")

    time.sleep(WIKI_DELAY)

    # Strategy 2: Check if Wikipedia article exists with images
    if len(images) < TARGET_IMAGES_PER_SPECIES:
        try:
            params2 = {
                "action": "query",
                "format": "json",
                "titles": latin_name.replace(" ", "_"),
                "prop": "images",
                "imlimit": "10",
            }
            resp = requests.get(WIKI_REST_API, params=params2, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            data = resp.json()

            pages = data.get("query", {}).get("pages", {})
            for page_id, page in pages.items():
                if int(page_id) < 0:
                    continue
                for img in page.get("images", []):
                    title = img.get("title", "")
                    if any(title.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png"]):
                        # Get the actual image URL
                        img_params = {
                            "action": "query",
                            "format": "json",
                            "titles": title,
                            "prop": "imageinfo",
                            "iiprop": "url",
                            "iiurlwidth": "800",
                        }
                        img_resp = requests.get(WIKI_API, params=img_params, headers=HEADERS, timeout=15)
                        img_resp.raise_for_status()
                        img_data = img_resp.json()
                        for pid, pg in img_data.get("query", {}).get("pages", {}).items():
                            for ii in pg.get("imageinfo", []):
                                url = ii.get("thumburl") or ii.get("url")
                                if url and url not in images:
                                    images.append(url)
                        time.sleep(0.5)
        except Exception as e:
            print(f"    Wikipedia image lookup error: {e}")

    time.sleep(WIKI_DELAY)
    return images


def search_inaturalist(latin_name, limit=5):
    """Search iNaturalist for research-grade observation photos."""
    images = []
    try:
        # First, find the taxon ID
        resp = requests.get(
            f"{INAT_API}/taxa",
            params={"q": latin_name, "rank": "species", "per_page": 1},
            headers=HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])

        if not results:
            return images

        taxon_id = results[0]["id"]
        taxon_photos = results[0].get("taxon_photos", [])

        # Get photos from taxon record itself (often the best quality)
        for tp in taxon_photos[:limit]:
            photo = tp.get("photo", {})
            url = photo.get("medium_url") or photo.get("url", "")
            if url:
                # Upgrade to larger size
                url = url.replace("/square.", "/medium.").replace("/small.", "/medium.")
                if url not in images:
                    images.append(url)

        time.sleep(INAT_DELAY)

        # If still need more, get from observations
        if len(images) < TARGET_IMAGES_PER_SPECIES:
            resp2 = requests.get(
                f"{INAT_API}/observations",
                params={
                    "taxon_id": taxon_id,
                    "quality_grade": "research",
                    "photos": "true",
                    "per_page": limit,
                    "order_by": "votes",
                },
                headers=HEADERS,
                timeout=15,
            )
            resp2.raise_for_status()
            obs_results = resp2.json().get("results", [])

            for obs in obs_results:
                for photo in obs.get("photos", []):
                    url = photo.get("url", "")
                    if url:
                        url = url.replace("/square.", "/medium.").replace("/small.", "/medium.")
                        if url not in images:
                            images.append(url)

    except Exception as e:
        print(f"    iNaturalist search error: {e}")

    time.sleep(INAT_DELAY)
    return images


def download_image(url, output_path):
    """Download an image from URL and save it resized."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()

        content_type = resp.headers.get("content-type", "")
        if "image" not in content_type and not url.lower().endswith((".jpg", ".jpeg", ".png")):
            return False

        return resize_and_save(resp.content, output_path)
    except Exception as e:
        print(f"    Download error for {url}: {e}")
        return False


def download_species_images(species, existing_count=0):
    """Download images for a single species."""
    species_id = species["id"]
    latin_name = species["latinName"]
    species_dir = os.path.join(IMAGES_DIR, species_id)
    ensure_dir(species_dir)

    # Check what we already have
    existing = [f for f in os.listdir(species_dir) if f.endswith(".jpg")]
    if len(existing) >= TARGET_IMAGES_PER_SPECIES:
        return len(existing)

    needed = TARGET_IMAGES_PER_SPECIES - len(existing)
    next_num = len(existing) + 1

    print(f"  Searching Wikimedia Commons...")
    wiki_urls = search_wikimedia_commons(latin_name)
    print(f"    Found {len(wiki_urls)} Wikimedia images")

    downloaded = 0
    for url in wiki_urls:
        if downloaded >= needed:
            break
        output_path = os.path.join(species_dir, f"{next_num}.jpg")
        if download_image(url, output_path):
            downloaded += 1
            next_num += 1
            print(f"    Downloaded image {next_num - 1}")

    # Fall back to iNaturalist if needed
    if downloaded < needed:
        print(f"  Searching iNaturalist (need {needed - downloaded} more)...")
        inat_urls = search_inaturalist(latin_name)
        print(f"    Found {len(inat_urls)} iNaturalist images")

        for url in inat_urls:
            if downloaded >= needed:
                break
            output_path = os.path.join(species_dir, f"{next_num}.jpg")
            if download_image(url, output_path):
                downloaded += 1
                next_num += 1
                print(f"    Downloaded image {next_num - 1}")

    total = len(existing) + downloaded
    return total


def update_species_images(species_list):
    """Update image paths in species data based on what's been downloaded."""
    for species in species_list:
        species_dir = os.path.join(IMAGES_DIR, species["id"])
        if os.path.exists(species_dir):
            images = sorted([f for f in os.listdir(species_dir) if f.endswith(".jpg")])
            species["images"] = [f"images/{species['id']}/{img}" for img in images]
        else:
            species["images"] = []
    return species_list


def main():
    species_list = load_species()
    total = len(species_list)

    # Check for resume point
    start_from = 0
    if len(sys.argv) > 1:
        start_from = int(sys.argv[1])
        print(f"Resuming from species #{start_from}")

    print(f"Downloading images for {total} species...")
    print(f"Target: {TARGET_IMAGES_PER_SPECIES} images per species")
    print()

    stats = {"success": 0, "partial": 0, "failed": 0}

    for i, species in enumerate(species_list):
        if i < start_from:
            continue

        print(f"[{i+1}/{total}] {species['latinName']} ({species['englishName']})")

        count = download_species_images(species, i)

        if count >= TARGET_IMAGES_PER_SPECIES:
            stats["success"] += 1
            print(f"  OK: {count} images")
        elif count > 0:
            stats["partial"] += 1
            print(f"  PARTIAL: {count}/{TARGET_IMAGES_PER_SPECIES} images")
        else:
            stats["failed"] += 1
            print(f"  FAILED: no images found")

        # Save progress every 10 species
        if (i + 1) % 10 == 0:
            species_list = update_species_images(species_list)
            save_species(species_list)
            print(f"\n  Progress saved. ({stats['success']} full, {stats['partial']} partial, {stats['failed']} failed)\n")

    # Final update
    species_list = update_species_images(species_list)
    save_species(species_list)

    print("\n" + "=" * 60)
    print(f"Download complete!")
    print(f"  Full coverage ({TARGET_IMAGES_PER_SPECIES}+ images): {stats['success']}")
    print(f"  Partial coverage: {stats['partial']}")
    print(f"  No images: {stats['failed']}")

    # Report species with no images
    missing = [s for s in species_list if not s["images"]]
    if missing:
        print(f"\nSpecies with no images ({len(missing)}):")
        for s in missing:
            print(f"  - {s['latinName']} ({s['englishName']})")


if __name__ == "__main__":
    main()
