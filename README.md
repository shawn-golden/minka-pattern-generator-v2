# SVG Pattern Generator

A tiny web app that takes a set of seed SVGs and randomly tiles them into a grid to produce a single exportable SVG pattern.

## Features

- **Seed SVG Management**: Upload multiple SVG files or use built-in fallback shapes (rectangle, circle, triangle)
- **Grid Configuration**: Customize columns, rows, tile size, and gutter spacing
- **Randomization**: Deterministic random placement with seed-based generation
- **Transformations**: Random rotation (0/90/180/270), scaling, and flips
- **Colorization**: Apply random colors from a palette to each tile
- **Live Preview**: Real-time preview of the generated pattern
- **Export**: Download the pattern as a standalone SVG file
- **State Persistence**: Settings are saved to localStorage

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. **Upload SVGs**: Click "Upload SVGs" or drag and drop SVG files onto the page
2. **Configure Grid**: Adjust columns, rows, tile size, and gutter
3. **Customize Pattern**: 
   - Enable random rotation, scaling, or flips
   - Set a color palette for per-tile colorization
   - Adjust the random seed for different patterns
4. **Generate**: Click "Randomize" to generate a new pattern with a new seed, or change any setting to regenerate
5. **Export**: Click "Download SVG" to save the pattern as an SVG file

## Technical Details

- Built with Vite + TypeScript
- Uses vanilla DOM (no React)
- SVG-based rendering (not canvas) for clean exports
- Deterministic RNG using mulberry32 algorithm
- All state persisted in localStorage

