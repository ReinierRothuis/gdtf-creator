# GDTF Creator

A web application that generates GDTF (General Device Type Format) files from PDF manuals using AI. Upload a lighting fixture's manual and get a complete GDTF file — no manual data entry required.

## What it does

GDTF Creator uses an LLM to read and interpret lighting fixture PDF manuals, extracting the information needed to build a full GDTF file. This includes:

- **DMX modes and channels** — channel layouts, functions, and value ranges
- **Physical descriptions** — dimensions, weight, power consumption, and lens properties
- **Geometry** — fixture body, yoke, head, and beam geometry
- **Wheels** — color wheels, gobo wheels, and their slots
- **Emitters and filters** — light source specifications

## How it works

1. Upload a PDF manual for a lighting fixture
2. The app sends the document to an LLM for interpretation
3. Extracted data is presented for review and correction
4. Export a valid `.gdtf` file ready for use in lighting consoles and visualizers
