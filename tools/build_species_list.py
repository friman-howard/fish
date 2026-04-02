#!/usr/bin/env python3
"""
Build the Maldives marine species list for the fish quiz app.
Fetches data from FishBase's Maldives country checklist and compiles
it into a structured JSON file.
"""

import json
import re
import time
import requests
from urllib.parse import urlencode

# FishBase API endpoint for species data
# We'll use the web scraping approach on the country checklist page
FISHBASE_CHECKLIST_URL = "https://fishbase.mnhn.fr/Country/CountryChecklist.php"
FISHBASE_API_URL = "https://fishbase.ropensci.org/fishbase"

# Common Maldivian reef fish families that divers/snorkelers encounter
# These are the families most likely to appear in a marine biology course
PRIORITY_FAMILIES = {
    # Butterflyfish
    "Chaetodontidae": "Butterflyfish",
    # Angelfish
    "Pomacanthidae": "Angelfish",
    # Wrasses
    "Labridae": "Wrasse",
    # Groupers & Anthias
    "Serranidae": "Grouper",
    # Damselfish & Clownfish
    "Pomacentridae": "Damselfish",
    # Surgeonfish & Unicornfish
    "Acanthuridae": "Surgeonfish",
    # Triggerfish
    "Balistidae": "Triggerfish",
    # Parrotfish
    "Scaridae": "Parrotfish",
    # Moray Eels
    "Muraenidae": "Moray Eel",
    # Pufferfish
    "Tetraodontidae": "Pufferfish",
    # Boxfish
    "Ostraciidae": "Boxfish",
    # Filefish
    "Monacanthidae": "Filefish",
    # Trumpetfish & Cornetfish
    "Aulostomidae": "Trumpetfish",
    "Fistulariidae": "Cornetfish",
    # Goatfish
    "Mullidae": "Goatfish",
    # Hawkfish
    "Cirrhitidae": "Hawkfish",
    # Lionfish & Scorpionfish
    "Scorpaenidae": "Scorpionfish",
    # Porcupinefish
    "Diodontidae": "Porcupinefish",
    # Soldierfish & Squirrelfish
    "Holocentridae": "Squirrelfish",
    # Snapper
    "Lutjanidae": "Snapper",
    # Sweetlips & Grunts
    "Haemulidae": "Sweetlips",
    # Emperor fish
    "Lethrinidae": "Emperor",
    # Fusiliers
    "Caesionidae": "Fusilier",
    # Rabbitfish
    "Siganidae": "Rabbitfish",
    # Moorish Idol
    "Zanclidae": "Moorish Idol",
    # Jacks & Trevally
    "Carangidae": "Jack",
    # Barracuda
    "Sphyraenidae": "Barracuda",
    # Sharks
    "Carcharhinidae": "Shark",
    "Ginglymostomatidae": "Shark",
    "Stegostomatidae": "Shark",
    "Alopiidae": "Shark",
    "Rhincodontidae": "Shark",
    "Sphyrnidae": "Shark",
    # Rays
    "Mobulidae": "Ray",
    "Dasyatidae": "Ray",
    "Myliobatidae": "Ray",
    "Aetobatidae": "Ray",
    "Rhinopteridae": "Ray",
    # Turtles (bonus)
    # Needlefish
    "Belonidae": "Needlefish",
    # Pipefsh & Seahorse
    "Syngnathidae": "Pipefish",
    # Blennies
    "Blenniidae": "Blenny",
    # Gobies
    "Gobiidae": "Goby",
    # Garden Eels
    "Congridae": "Garden Eel",
    # Flatfish
    "Bothidae": "Flatfish",
    # Remoras
    "Echeneidae": "Remora",
    # Tilefish
    "Malacanthidae": "Tilefish",
    # Dottybacks
    "Pseudochromidae": "Dottyback",
}

# Curated list of ~300 common Maldivian marine species
# This is compiled from FishBase Maldives checklist, Kuiter & Godfrey,
# and common dive guide species lists
SPECIES_LIST = [
    # BUTTERFLYFISH (Chaetodontidae) - ~25 species
    ("Chaetodon trifascialis", "Chevron Butterflyfish", "Chaetodontidae"),
    ("Chaetodon lunula", "Raccoon Butterflyfish", "Chaetodontidae"),
    ("Chaetodon auriga", "Threadfin Butterflyfish", "Chaetodontidae"),
    ("Chaetodon falcula", "Blackwedged Butterflyfish", "Chaetodontidae"),
    ("Chaetodon vagabundus", "Vagabond Butterflyfish", "Chaetodontidae"),
    ("Chaetodon collare", "Redtail Butterflyfish", "Chaetodontidae"),
    ("Chaetodon kleinii", "Sunburst Butterflyfish", "Chaetodontidae"),
    ("Chaetodon lineolatus", "Lined Butterflyfish", "Chaetodontidae"),
    ("Chaetodon trifasciatus", "Melon Butterflyfish", "Chaetodontidae"),
    ("Chaetodon melannotus", "Blackback Butterflyfish", "Chaetodontidae"),
    ("Chaetodon meyeri", "Scrawled Butterflyfish", "Chaetodontidae"),
    ("Chaetodon oxycephalus", "Spot-nape Butterflyfish", "Chaetodontidae"),
    ("Chaetodon guttatissimus", "Peppered Butterflyfish", "Chaetodontidae"),
    ("Chaetodon xanthocephalus", "Yellowhead Butterflyfish", "Chaetodontidae"),
    ("Chaetodon decussatus", "Indian Vagabond Butterflyfish", "Chaetodontidae"),
    ("Heniochus diphreutes", "False Moorish Idol", "Chaetodontidae"),
    ("Heniochus acuminatus", "Pennant Coralfish", "Chaetodontidae"),
    ("Heniochus monoceros", "Masked Bannerfish", "Chaetodontidae"),
    ("Heniochus pleurotaenia", "Phantom Bannerfish", "Chaetodontidae"),
    ("Forcipiger flavissimus", "Longnose Butterflyfish", "Chaetodontidae"),
    ("Forcipiger longirostris", "Big Longnose Butterflyfish", "Chaetodontidae"),
    ("Hemitaurichthys zoster", "Brown-and-white Butterflyfish", "Chaetodontidae"),

    # ANGELFISH (Pomacanthidae) - ~12 species
    ("Pomacanthus imperator", "Emperor Angelfish", "Pomacanthidae"),
    ("Pomacanthus semicirculatus", "Semicircle Angelfish", "Pomacanthidae"),
    ("Pomacanthus xanthometopon", "Yellowface Angelfish", "Pomacanthidae"),
    ("Pygoplites diacanthus", "Regal Angelfish", "Pomacanthidae"),
    ("Centropyge multispinis", "Dusky Angelfish", "Pomacanthidae"),
    ("Centropyge flavissima", "Lemonpeel Angelfish", "Pomacanthidae"),
    ("Centropyge multifasciata", "Barred Angelfish", "Pomacanthidae"),
    ("Apolemichthys trimaculatus", "Three-spot Angelfish", "Pomacanthidae"),
    ("Apolemichthys xanthurus", "Indian Yellowtail Angelfish", "Pomacanthidae"),

    # WRASSES (Labridae) - ~25 species
    ("Cheilinus undulatus", "Napoleon Wrasse", "Labridae"),
    ("Cheilinus trilobatus", "Tripletail Wrasse", "Labridae"),
    ("Thalassoma lunare", "Moon Wrasse", "Labridae"),
    ("Thalassoma hardwicke", "Sixbar Wrasse", "Labridae"),
    ("Thalassoma amblycephalum", "Bluntheaded Wrasse", "Labridae"),
    ("Labroides dimidiatus", "Bluestreak Cleaner Wrasse", "Labridae"),
    ("Coris aygula", "Clown Coris", "Labridae"),
    ("Coris formosa", "Queen Coris", "Labridae"),
    ("Halichoeres hortulanus", "Checkerboard Wrasse", "Labridae"),
    ("Halichoeres scapularis", "Zigzag Wrasse", "Labridae"),
    ("Gomphosus caeruleus", "Indian Ocean Bird Wrasse", "Labridae"),
    ("Novaculichthys taeniourus", "Rockmover Wrasse", "Labridae"),
    ("Anampses meleagrides", "Spotted Wrasse", "Labridae"),
    ("Anampses twistii", "Yellowbreasted Wrasse", "Labridae"),
    ("Oxycheilinus digramma", "Cheeklined Wrasse", "Labridae"),
    ("Bodianus axillaris", "Axilspot Hogfish", "Labridae"),
    ("Bodianus diana", "Diana's Hogfish", "Labridae"),
    ("Hemigymnus melapterus", "Blackeye Thicklip", "Labridae"),
    ("Hemigymnus fasciatus", "Barred Thicklip", "Labridae"),
    ("Epibulus insidiator", "Sling-jaw Wrasse", "Labridae"),
    ("Stethojulis albovittata", "Bluelined Wrasse", "Labridae"),

    # GROUPERS & ANTHIAS (Serranidae) - ~20 species
    ("Epinephelus merra", "Honeycomb Grouper", "Serranidae"),
    ("Epinephelus fuscoguttatus", "Brown-marbled Grouper", "Serranidae"),
    ("Epinephelus polyphekadion", "Camouflage Grouper", "Serranidae"),
    ("Epinephelus tauvina", "Greasy Grouper", "Serranidae"),
    ("Epinephelus lanceolatus", "Giant Grouper", "Serranidae"),
    ("Cephalopholis argus", "Peacock Grouper", "Serranidae"),
    ("Cephalopholis miniata", "Coral Hind", "Serranidae"),
    ("Cephalopholis sexmaculata", "Sixblotch Hind", "Serranidae"),
    ("Variola louti", "Yellow-edged Lyretail", "Serranidae"),
    ("Plectropomus pessuliferus", "Roving Coral Grouper", "Serranidae"),
    ("Aethaloperca rogaa", "Redmouth Grouper", "Serranidae"),
    ("Pseudanthias squamipinnis", "Sea Goldie", "Serranidae"),
    ("Pseudanthias dispar", "Peach Anthias", "Serranidae"),
    ("Pseudanthias evansi", "Yellowback Anthias", "Serranidae"),
    ("Grammistes sexlineatus", "Sixline Soapfish", "Serranidae"),

    # DAMSELFISH & CLOWNFISH (Pomacentridae) - ~20 species
    ("Amphiprion clarkii", "Clark's Anemonefish", "Pomacentridae"),
    ("Amphiprion nigripes", "Maldives Anemonefish", "Pomacentridae"),
    ("Amphiprion ocellaris", "Clown Anemonefish", "Pomacentridae"),
    ("Dascyllus trimaculatus", "Three-spot Dascyllus", "Pomacentridae"),
    ("Dascyllus aruanus", "Whitetail Dascyllus", "Pomacentridae"),
    ("Chromis viridis", "Blue-green Chromis", "Pomacentridae"),
    ("Chromis ternatensis", "Ternate Chromis", "Pomacentridae"),
    ("Chromis atripectoralis", "Black-axil Chromis", "Pomacentridae"),
    ("Abudefduf vaigiensis", "Indo-Pacific Sergeant", "Pomacentridae"),
    ("Abudefduf sexfasciatus", "Scissortail Sergeant", "Pomacentridae"),
    ("Pomacentrus caeruleus", "Caerulean Damsel", "Pomacentridae"),
    ("Pomacentrus indicus", "Indian Damsel", "Pomacentridae"),
    ("Pomacentrus pavo", "Sapphire Damsel", "Pomacentridae"),
    ("Stegastes fasciolatus", "Pacific Gregory", "Pomacentridae"),
    ("Plectroglyphidodon dickii", "Blackbar Devil", "Pomacentridae"),
    ("Neopomacentrus cyanomos", "Regal Demoiselle", "Pomacentridae"),

    # SURGEONFISH & UNICORNFISH (Acanthuridae) - ~20 species
    ("Acanthurus leucosternon", "Powder Blue Surgeonfish", "Acanthuridae"),
    ("Acanthurus nigrofuscus", "Brown Surgeonfish", "Acanthuridae"),
    ("Acanthurus triostegus", "Convict Surgeonfish", "Acanthuridae"),
    ("Acanthurus thompsoni", "Thompson's Surgeonfish", "Acanthuridae"),
    ("Acanthurus lineatus", "Striped Surgeonfish", "Acanthuridae"),
    ("Acanthurus mata", "Elongate Surgeonfish", "Acanthuridae"),
    ("Acanthurus xanthopterus", "Yellowfin Surgeonfish", "Acanthuridae"),
    ("Ctenochaetus striatus", "Striated Surgeonfish", "Acanthuridae"),
    ("Ctenochaetus truncatus", "Indian Gold-ring Bristletooth", "Acanthuridae"),
    ("Zebrasoma scopas", "Twotone Tang", "Acanthuridae"),
    ("Zebrasoma desjardinii", "Indian Sailfin Tang", "Acanthuridae"),
    ("Naso lituratus", "Orangespine Unicornfish", "Acanthuridae"),
    ("Naso brevirostris", "Spotted Unicornfish", "Acanthuridae"),
    ("Naso elegans", "Elegant Unicornfish", "Acanthuridae"),
    ("Naso hexacanthus", "Sleek Unicornfish", "Acanthuridae"),
    ("Naso unicornis", "Bluespine Unicornfish", "Acanthuridae"),
    ("Paracanthurus hepatus", "Palette Surgeonfish", "Acanthuridae"),

    # TRIGGERFISH (Balistidae) - ~10 species
    ("Rhinecanthus aculeatus", "Picasso Triggerfish", "Balistidae"),
    ("Rhinecanthus rectangulus", "Wedge-tail Triggerfish", "Balistidae"),
    ("Balistapus undulatus", "Orange-striped Triggerfish", "Balistidae"),
    ("Balistoides conspicillum", "Clown Triggerfish", "Balistidae"),
    ("Balistoides viridescens", "Titan Triggerfish", "Balistidae"),
    ("Melichthys indicus", "Indian Triggerfish", "Balistidae"),
    ("Melichthys niger", "Black Triggerfish", "Balistidae"),
    ("Odonus niger", "Red-toothed Triggerfish", "Balistidae"),
    ("Sufflamen bursa", "Boomerang Triggerfish", "Balistidae"),
    ("Sufflamen chrysopterum", "Halfmoon Triggerfish", "Balistidae"),

    # PARROTFISH (Scaridae) - ~12 species
    ("Chlorurus sordidus", "Daisy Parrotfish", "Scaridae"),
    ("Chlorurus strongylocephalus", "Steephead Parrotfish", "Scaridae"),
    ("Scarus ghobban", "Blue-barred Parrotfish", "Scaridae"),
    ("Scarus rubroviolaceus", "Ember Parrotfish", "Scaridae"),
    ("Scarus niger", "Dusky Parrotfish", "Scaridae"),
    ("Scarus frenatus", "Bridled Parrotfish", "Scaridae"),
    ("Scarus prasiognathos", "Singapore Parrotfish", "Scaridae"),
    ("Scarus psittacus", "Common Parrotfish", "Scaridae"),
    ("Cetoscarus bicolor", "Bicolour Parrotfish", "Scaridae"),
    ("Hipposcarus harid", "Candelamoa Parrotfish", "Scaridae"),
    ("Bolbometopon muricatum", "Bumphead Parrotfish", "Scaridae"),

    # MORAY EELS (Muraenidae) - ~10 species
    ("Gymnothorax favagineus", "Honeycomb Moray", "Muraenidae"),
    ("Gymnothorax javanicus", "Giant Moray", "Muraenidae"),
    ("Gymnothorax undulatus", "Undulated Moray", "Muraenidae"),
    ("Gymnothorax flavimarginatus", "Yellow-edged Moray", "Muraenidae"),
    ("Gymnothorax meleagris", "Whitemouth Moray", "Muraenidae"),
    ("Echidna nebulosa", "Snowflake Moray", "Muraenidae"),
    ("Rhinomuraena quaesita", "Ribbon Moray", "Muraenidae"),
    ("Gymnothorax nudivomer", "Yellowmouth Moray", "Muraenidae"),

    # PUFFERFISH & BOXFISH (Tetraodontidae/Ostraciidae) - ~10 species
    ("Arothron hispidus", "White-spotted Pufferfish", "Tetraodontidae"),
    ("Arothron meleagris", "Guineafowl Pufferfish", "Tetraodontidae"),
    ("Arothron nigropunctatus", "Blackspotted Pufferfish", "Tetraodontidae"),
    ("Arothron stellatus", "Stellate Pufferfish", "Tetraodontidae"),
    ("Canthigaster valentini", "Valentini's Sharpnose Puffer", "Tetraodontidae"),
    ("Canthigaster bennetti", "Bennett's Sharpnose Puffer", "Tetraodontidae"),
    ("Ostracion cubicus", "Yellow Boxfish", "Ostraciidae"),
    ("Ostracion meleagris", "Whitespotted Boxfish", "Ostraciidae"),

    # PORCUPINEFISH (Diodontidae) - 3 species
    ("Diodon hystrix", "Spot-fin Porcupinefish", "Diodontidae"),
    ("Diodon liturosus", "Black-blotched Porcupinefish", "Diodontidae"),

    # SCORPIONFISH & LIONFISH (Scorpaenidae) - ~6 species
    ("Pterois volitans", "Red Lionfish", "Scorpaenidae"),
    ("Pterois miles", "Devil Firefish", "Scorpaenidae"),
    ("Pterois antennata", "Broadbarred Firefish", "Scorpaenidae"),
    ("Scorpaenopsis diabolus", "False Stonefish", "Scorpaenidae"),
    ("Taenianotus triacanthus", "Leaf Scorpionfish", "Scorpaenidae"),
    ("Synanceia verrucosa", "Stonefish", "Scorpaenidae"),

    # SQUIRRELFISH & SOLDIERFISH (Holocentridae) - ~8 species
    ("Sargocentron diadema", "Crown Squirrelfish", "Holocentridae"),
    ("Sargocentron spiniferum", "Sabre Squirrelfish", "Holocentridae"),
    ("Sargocentron caudimaculatum", "Silverspot Squirrelfish", "Holocentridae"),
    ("Myripristis murdjan", "Pinecone Soldierfish", "Holocentridae"),
    ("Myripristis berndti", "Blotcheye Soldierfish", "Holocentridae"),
    ("Myripristis vittata", "Whitetip Soldierfish", "Holocentridae"),
    ("Neoniphon sammara", "Sammara Squirrelfish", "Holocentridae"),

    # SNAPPERS (Lutjanidae) - ~8 species
    ("Lutjanus bohar", "Two-spot Red Snapper", "Lutjanidae"),
    ("Lutjanus kasmira", "Bluestripe Snapper", "Lutjanidae"),
    ("Lutjanus gibbus", "Humpback Snapper", "Lutjanidae"),
    ("Lutjanus monostigma", "One-spot Snapper", "Lutjanidae"),
    ("Lutjanus decussatus", "Checkered Snapper", "Lutjanidae"),
    ("Macolor niger", "Black Snapper", "Lutjanidae"),
    ("Aprion virescens", "Green Jobfish", "Lutjanidae"),
    ("Lutjanus lutjanus", "Bigeye Snapper", "Lutjanidae"),

    # SWEETLIPS (Haemulidae) - ~5 species
    ("Plectorhinchus vittatus", "Indian Ocean Oriental Sweetlips", "Haemulidae"),
    ("Plectorhinchus chaetodonoides", "Harlequin Sweetlips", "Haemulidae"),
    ("Plectorhinchus gibbosus", "Harry Hotlips", "Haemulidae"),

    # EMPERORS (Lethrinidae) - ~5 species
    ("Monotaxis grandoculis", "Humpnose Big-eye Bream", "Lethrinidae"),
    ("Lethrinus harak", "Thumbprint Emperor", "Lethrinidae"),
    ("Lethrinus xanthochilus", "Yellowlip Emperor", "Lethrinidae"),
    ("Lethrinus nebulosus", "Spangled Emperor", "Lethrinidae"),

    # FUSILIERS (Caesionidae) - ~5 species
    ("Caesio xanthonota", "Yellowback Fusilier", "Caesionidae"),
    ("Caesio teres", "Yellow and Blueback Fusilier", "Caesionidae"),
    ("Pterocaesio tile", "Dark-banded Fusilier", "Caesionidae"),
    ("Pterocaesio chrysozona", "Goldband Fusilier", "Caesionidae"),

    # GOATFISH (Mullidae) - ~6 species
    ("Parupeneus macronemus", "Long-barbel Goatfish", "Mullidae"),
    ("Parupeneus cyclostomus", "Gold-saddle Goatfish", "Mullidae"),
    ("Parupeneus barberinus", "Dash-and-dot Goatfish", "Mullidae"),
    ("Parupeneus indicus", "Indian Goatfish", "Mullidae"),
    ("Mulloidichthys flavolineatus", "Yellowstripe Goatfish", "Mullidae"),
    ("Mulloidichthys vanicolensis", "Yellowfin Goatfish", "Mullidae"),

    # HAWKFISH (Cirrhitidae) - ~4 species
    ("Paracirrhites arcatus", "Arc-eye Hawkfish", "Cirrhitidae"),
    ("Paracirrhites forsteri", "Blackside Hawkfish", "Cirrhitidae"),
    ("Cirrhitichthys oxycephalus", "Coral Hawkfish", "Cirrhitidae"),
    ("Oxycirrhites typus", "Longnose Hawkfish", "Cirrhitidae"),

    # JACKS & TREVALLY (Carangidae) - ~8 species
    ("Caranx melampygus", "Bluefin Trevally", "Carangidae"),
    ("Caranx ignobilis", "Giant Trevally", "Carangidae"),
    ("Caranx sexfasciatus", "Bigeye Trevally", "Carangidae"),
    ("Elagatis bipinnulata", "Rainbow Runner", "Carangidae"),
    ("Naucrates ductor", "Pilotfish", "Carangidae"),
    ("Trachinotus blochii", "Snubnose Pompano", "Carangidae"),
    ("Gnathanodon speciosus", "Golden Trevally", "Carangidae"),

    # BARRACUDA (Sphyraenidae) - 3 species
    ("Sphyraena barracuda", "Great Barracuda", "Sphyraenidae"),
    ("Sphyraena qenie", "Blackfin Barracuda", "Sphyraenidae"),

    # MOORISH IDOL (Zanclidae) - 1 species
    ("Zanclus cornutus", "Moorish Idol", "Zanclidae"),

    # TRUMPETFISH (Aulostomidae) - 1 species
    ("Aulostomus chinensis", "Chinese Trumpetfish", "Aulostomidae"),

    # CORNETFISH (Fistulariidae) - 1 species
    ("Fistularia commersonii", "Bluespotted Cornetfish", "Fistulariidae"),

    # RABBITFISH (Siganidae) - 3 species
    ("Siganus stellatus", "Brown-spotted Rabbitfish", "Siganidae"),
    ("Siganus argenteus", "Streamlined Spinefoot", "Siganidae"),

    # BLENNIES (Blenniidae) - 4 species
    ("Ecsenius midas", "Midas Blenny", "Blenniidae"),
    ("Plagiotremus rhinorhynchos", "Bluestriped Fangblenny", "Blenniidae"),
    ("Aspidontus taeniatus", "False Cleanerfish", "Blenniidae"),
    ("Meiacanthus smithii", "Disco Blenny", "Blenniidae"),

    # GOBIES (Gobiidae) - 4 species
    ("Nemateleotris magnifica", "Fire Dartfish", "Gobiidae"),
    ("Nemateleotris decora", "Elegant Firefish", "Gobiidae"),
    ("Ptereleotris evides", "Blackfin Dartfish", "Gobiidae"),
    ("Valenciennea strigata", "Blueband Goby", "Gobiidae"),

    # GARDEN EELS (Congridae) - 2 species
    ("Heteroconger hassi", "Spotted Garden Eel", "Congridae"),
    ("Gorgasia maculata", "Whitespotted Garden Eel", "Congridae"),

    # DOTTYBACKS (Pseudochromidae) - 2 species
    ("Pseudochromis fridmani", "Orchid Dottyback", "Pseudochromidae"),

    # REMORAS (Echeneidae) - 1 species
    ("Echeneis naucrates", "Live Sharksucker", "Echeneidae"),

    # TILEFISH (Malacanthidae) - 1 species
    ("Hoplolatilus starcki", "Bluehead Tilefish", "Malacanthidae"),

    # PIPEFISH & SEAHORSES (Syngnathidae) - 2 species
    ("Corythoichthys schultzi", "Schultz's Pipefish", "Syngnathidae"),

    # FLATFISH (Bothidae) - 1 species
    ("Bothus mancus", "Flowery Flounder", "Bothidae"),

    # FILEFISH (Monacanthidae) - 3 species
    ("Aluterus scriptus", "Scrawled Filefish", "Monacanthidae"),
    ("Cantherhines pardalis", "Honeycomb Filefish", "Monacanthidae"),
    ("Paraluteres prionurus", "Blacksaddle Filefish", "Monacanthidae"),

    # SHARKS - ~12 species
    ("Carcharhinus melanopterus", "Blacktip Reef Shark", "Carcharhinidae"),
    ("Carcharhinus amblyrhynchos", "Grey Reef Shark", "Carcharhinidae"),
    ("Carcharhinus albimarginatus", "Silvertip Shark", "Carcharhinidae"),
    ("Triaenodon obesus", "Whitetip Reef Shark", "Carcharhinidae"),
    ("Galeocerdo cuvier", "Tiger Shark", "Carcharhinidae"),
    ("Nebrius ferrugineus", "Tawny Nurse Shark", "Ginglymostomatidae"),
    ("Stegostoma tigrinum", "Zebra Shark", "Stegostomatidae"),
    ("Rhincodon typus", "Whale Shark", "Rhincodontidae"),
    ("Alopias pelagicus", "Pelagic Thresher Shark", "Alopiidae"),
    ("Sphyrna lewini", "Scalloped Hammerhead", "Sphyrnidae"),

    # RAYS - ~10 species
    ("Mobula alfredi", "Reef Manta Ray", "Mobulidae"),
    ("Mobula birostris", "Giant Oceanic Manta Ray", "Mobulidae"),
    ("Mobula mobular", "Giant Devil Ray", "Mobulidae"),
    ("Taeniura lymma", "Bluespotted Ribbontail Ray", "Dasyatidae"),
    ("Himantura uarnak", "Honeycomb Stingray", "Dasyatidae"),
    ("Pastinachus sephen", "Cowtail Stingray", "Dasyatidae"),
    ("Aetobatus narinari", "Spotted Eagle Ray", "Aetobatidae"),
    ("Aetomylaeus vespertilio", "Ornate Eagle Ray", "Myliobatidae"),

    # NEEDLEFISH (Belonidae) - 1 species
    ("Tylosurus crocodilus", "Hound Needlefish", "Belonidae"),

    # MISCELLANEOUS important species
    ("Platax teira", "Longfin Batfish", "Ephippidae"),
    ("Platax orbicularis", "Orbicular Batfish", "Ephippidae"),
    ("Heniochus diphreutes", "Schooling Bannerfish", "Chaetodontidae"),
    ("Chelmon rostratus", "Copperband Butterflyfish", "Chaetodontidae"),
]


def deduplicate_species(species_list):
    """Remove duplicate species based on Latin name."""
    seen = set()
    unique = []
    for latin, english, family in species_list:
        if latin not in seen:
            seen.add(latin)
            unique.append((latin, english, family))
    return unique


def latin_to_id(latin_name):
    """Convert a Latin name to a URL-friendly ID."""
    return latin_name.lower().replace(" ", "-").replace("'", "")


def get_group_name(family):
    """Get the common group name for a family."""
    return PRIORITY_FAMILIES.get(family, family)


def build_species_json(species_list):
    """Build the species JSON structure."""
    species_list = deduplicate_species(species_list)
    result = []
    for latin, english, family in sorted(species_list, key=lambda x: (x[2], x[0])):
        species_id = latin_to_id(latin)
        result.append({
            "id": species_id,
            "latinName": latin,
            "englishName": english,
            "family": family,
            "group": get_group_name(family),
            "images": []  # Will be populated by image download script
        })
    return result


def main():
    species_data = build_species_json(SPECIES_LIST)

    # Write species.json
    output_path = "/home/user/Fleming/data/species.json"
    with open(output_path, "w") as f:
        json.dump(species_data, f, indent=2)

    print(f"Generated {len(species_data)} species entries")

    # Print summary by family
    families = {}
    for sp in species_data:
        group = sp["group"]
        families[group] = families.get(group, 0) + 1

    print("\nSpecies by group:")
    for group, count in sorted(families.items(), key=lambda x: -x[1]):
        print(f"  {group}: {count}")

    print(f"\nTotal unique species: {len(species_data)}")
    print(f"Output written to: {output_path}")


if __name__ == "__main__":
    main()
