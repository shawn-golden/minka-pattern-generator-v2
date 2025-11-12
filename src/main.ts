// Deterministic RNG functions
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashSeed(str: string): number {
  let h = 1779033703;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return h >>> 0;
}

// Application state
interface AppState {
  cols: number;
  rows: number;
  tileSize: number;
  seed: string;
  randomRotation: boolean;
  allowFlips: boolean;
}

const defaultState: AppState = {
  cols: 8,
  rows: 5,
  tileSize: 200, // Doubled from 100 to make output 1600px × 1000px
  seed: 'pattern-2024',
  randomRotation: true,
  allowFlips: false
};

let state: AppState = { ...defaultState };
let seedCount = 0;
// Track SVG sizes: 1 = 1x1 (200x200), 2 = 2x2 (400x400)
const seedSizes = new Map<string, number>(); // seedId -> size
const smallSeeds: string[] = [];
const largeSeeds: string[] = [];

// DOM elements
const preview = document.getElementById('preview') as unknown as SVGElement;
const seedDefs = document.getElementById('seed-defs') as unknown as SVGDefsElement;
const seedInput = document.getElementById('seed') as HTMLInputElement;
const randomRotationCheck = document.getElementById('randomRotation') as HTMLInputElement;
const allowFlipsCheck = document.getElementById('allowFlips') as HTMLInputElement;
const randomizeBtn = document.getElementById('randomizeBtn') as HTMLButtonElement;
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement;

// Load state from localStorage
function loadState(): void {
  const saved = localStorage.getItem('svgPatternState');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Restore state but always use fixed grid dimensions
      state = { ...defaultState, ...parsed };
      state.cols = 8;
      state.rows = 5;
      state.tileSize = 200;
    } catch (e) {
      console.warn('Failed to load saved state', e);
    }
  }
  
  // Update UI from state (cols, rows, tileSize are fixed, not from UI)
  seedInput.value = state.seed;
  randomRotationCheck.checked = state.randomRotation;
  allowFlipsCheck.checked = state.allowFlips;
}

// Save state to localStorage
function saveState(): void {
  localStorage.setItem('svgPatternState', JSON.stringify(state));
}

// Create fallback shapes
function createFallbackShapes(): void {
  // Solid black rectangle
  const solidBlack = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  const seedId1 = `seed-${seedCount++}`;
  solidBlack.id = seedId1;
  solidBlack.setAttribute('viewBox', '0 0 100 100');
  const blackRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  blackRect.setAttribute('x', '0');
  blackRect.setAttribute('y', '0');
  blackRect.setAttribute('width', '100');
  blackRect.setAttribute('height', '100');
  blackRect.setAttribute('fill', '#000');
  solidBlack.appendChild(blackRect);
  seedDefs.appendChild(solidBlack);
  seedSizes.set(seedId1, 1);
  smallSeeds.push(seedId1);
  
  // Solid gray rectangle
  const solidGray = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  const seedId2 = `seed-${seedCount++}`;
  solidGray.id = seedId2;
  solidGray.setAttribute('viewBox', '0 0 100 100');
  const grayRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  grayRect.setAttribute('x', '0');
  grayRect.setAttribute('y', '0');
  grayRect.setAttribute('width', '100');
  grayRect.setAttribute('height', '100');
  grayRect.setAttribute('fill', '#666');
  solidGray.appendChild(grayRect);
  seedDefs.appendChild(solidGray);
  seedSizes.set(seedId2, 1);
  smallSeeds.push(seedId2);
  
  // Solid white rectangle
  const solidWhite = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  const seedId3 = `seed-${seedCount++}`;
  solidWhite.id = seedId3;
  solidWhite.setAttribute('viewBox', '0 0 100 100');
  const whiteRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  whiteRect.setAttribute('x', '0');
  whiteRect.setAttribute('y', '0');
  whiteRect.setAttribute('width', '100');
  whiteRect.setAttribute('height', '100');
  whiteRect.setAttribute('fill', '#fff');
  solidWhite.appendChild(whiteRect);
  seedDefs.appendChild(solidWhite);
  seedSizes.set(seedId3, 1);
  smallSeeds.push(seedId3);
  
  // Thin vertical stripes (2px wide)
  const thinStripes = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  const seedId4 = `seed-${seedCount++}`;
  thinStripes.id = seedId4;
  thinStripes.setAttribute('viewBox', '0 0 100 100');
  let thinIsBlack = true;
  for (let x = 0; x < 100; x += 2) {
    const stripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    stripe.setAttribute('x', x.toString());
    stripe.setAttribute('y', '0');
    stripe.setAttribute('width', '2');
    stripe.setAttribute('height', '100');
    stripe.setAttribute('fill', thinIsBlack ? '#000' : '#fff');
    thinStripes.appendChild(stripe);
    thinIsBlack = !thinIsBlack;
  }
  seedDefs.appendChild(thinStripes);
  seedSizes.set(seedId4, 1);
  smallSeeds.push(seedId4);
  
  // Medium vertical stripes (5px wide)
  const mediumStripes = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  const seedId5 = `seed-${seedCount++}`;
  mediumStripes.id = seedId5;
  mediumStripes.setAttribute('viewBox', '0 0 100 100');
  for (let x = 0; x < 100; x += 10) {
    const stripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    stripe.setAttribute('x', x.toString());
    stripe.setAttribute('y', '0');
    stripe.setAttribute('width', '5');
    stripe.setAttribute('height', '100');
    stripe.setAttribute('fill', '#000');
    mediumStripes.appendChild(stripe);
    const whiteStripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    whiteStripe.setAttribute('x', (x + 5).toString());
    whiteStripe.setAttribute('y', '0');
    whiteStripe.setAttribute('width', '5');
    whiteStripe.setAttribute('height', '100');
    whiteStripe.setAttribute('fill', '#fff');
    mediumStripes.appendChild(whiteStripe);
  }
  seedDefs.appendChild(mediumStripes);
  seedSizes.set(seedId5, 1);
  smallSeeds.push(seedId5);
  
  // Thick vertical stripes (10px wide)
  const thickStripes = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  const seedId6 = `seed-${seedCount++}`;
  thickStripes.id = seedId6;
  thickStripes.setAttribute('viewBox', '0 0 100 100');
  for (let x = 0; x < 100; x += 20) {
    const stripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    stripe.setAttribute('x', x.toString());
    stripe.setAttribute('y', '0');
    stripe.setAttribute('width', '10');
    stripe.setAttribute('height', '100');
    stripe.setAttribute('fill', '#000');
    thickStripes.appendChild(stripe);
    const whiteStripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    whiteStripe.setAttribute('x', (x + 10).toString());
    whiteStripe.setAttribute('y', '0');
    whiteStripe.setAttribute('width', '10');
    whiteStripe.setAttribute('height', '100');
    whiteStripe.setAttribute('fill', '#fff');
    thickStripes.appendChild(whiteStripe);
  }
  seedDefs.appendChild(thickStripes);
  seedSizes.set(seedId6, 1);
  smallSeeds.push(seedId6);
  
  // Variable width stripes (mixed sizes)
  const variableStripes = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  const seedId7 = `seed-${seedCount++}`;
  variableStripes.id = seedId7;
  variableStripes.setAttribute('viewBox', '0 0 100 100');
  let xPos = 0;
  const widths = [3, 7, 2, 12, 4, 8, 5, 6];
  let isBlack = true;
  for (const width of widths) {
    if (xPos >= 100) break;
    const stripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    stripe.setAttribute('x', xPos.toString());
    stripe.setAttribute('y', '0');
    stripe.setAttribute('width', Math.min(width, 100 - xPos).toString());
    stripe.setAttribute('height', '100');
    stripe.setAttribute('fill', isBlack ? '#000' : '#fff');
    variableStripes.appendChild(stripe);
    xPos += width;
    isBlack = !isBlack;
  }
  // Fill remaining space
  if (xPos < 100) {
    const remaining = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    remaining.setAttribute('x', xPos.toString());
    remaining.setAttribute('y', '0');
    remaining.setAttribute('width', (100 - xPos).toString());
    remaining.setAttribute('height', '100');
    remaining.setAttribute('fill', isBlack ? '#000' : '#fff');
    variableStripes.appendChild(remaining);
  }
  seedDefs.appendChild(variableStripes);
  seedSizes.set(seedId7, 1);
  smallSeeds.push(seedId7);
}

// Helper function to add SVG symbol and track its size
function addSVGSymbol(svgRoot: SVGElement, size: number): void {
  let viewBox = svgRoot.getAttribute('viewBox');
  if (!viewBox) {
    const width = svgRoot.getAttribute('width') || '100';
    const height = svgRoot.getAttribute('height') || '100';
    viewBox = `0 0 ${width} ${height}`;
  }
  
  const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  const seedId = `seed-${seedCount++}`;
  symbol.id = seedId;
  symbol.setAttribute('viewBox', viewBox);
  
  Array.from(svgRoot.childNodes).forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      symbol.appendChild(child.cloneNode(true));
    }
  });
  
  seedDefs.appendChild(symbol);
  seedSizes.set(seedId, size);
  
  if (size === 1) {
    smallSeeds.push(seedId);
  } else if (size === 2) {
    largeSeeds.push(seedId);
  }
}

// Load SVGs from both svg-v2 (200x200, 1x1) and svg-large (400x400, 2x2) directories
async function loadDefaultSVGs(): Promise<void> {
  // Clear existing seeds
  seedDefs.innerHTML = '';
  seedCount = 0;
  seedSizes.clear();
  smallSeeds.length = 0;
  largeSeeds.length = 0;
  // Small SVGs (200x200, 1x1 grid space)
  const smallSvgFiles = [
    '/svg-v2/Group-1.svg',
    '/svg-v2/Group-2.svg',
    '/svg-v2/Group-3.svg',
    '/svg-v2/Group-4.svg',
    '/svg-v2/Group-5.svg',
    '/svg-v2/Group-6.svg',
    '/svg-v2/Group-7.svg',
    '/svg-v2/Group-8.svg',
    '/svg-v2/Group.svg'
  ];
  
  // Large SVGs (400x400, 2x2 grid spaces)
  const largeSvgFiles = [
    '/svg-large/pattern-1.svg',
    '/svg-large/pattern-2.svg',
    '/svg-large/pattern-3.svg'
  ];
  
  try {
    // Load small SVGs
    for (const svgPath of smallSvgFiles) {
      try {
        const response = await fetch(svgPath);
        if (response.ok) {
          const text = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'image/svg+xml');
          const svgRoot = doc.documentElement as unknown as SVGElement;
          
          if (svgRoot.tagName === 'svg') {
            addSVGSymbol(svgRoot, 1); // 1x1 grid space
          }
        }
      } catch (e) {
        console.warn(`Failed to load ${svgPath}:`, e);
      }
    }
    
    // Load large SVGs
    for (const svgPath of largeSvgFiles) {
      try {
        const response = await fetch(svgPath);
        if (response.ok) {
          const text = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'image/svg+xml');
          const svgRoot = doc.documentElement as unknown as SVGElement;
          
          if (svgRoot.tagName === 'svg') {
            addSVGSymbol(svgRoot, 2); // 2x2 grid spaces
          }
        }
      } catch (e) {
        console.warn(`Failed to load ${svgPath}:`, e);
      }
    }
  } catch (e) {
    console.warn('Failed to load default SVGs, using fallback shapes:', e);
  }
}

// Helper functions for grid occupancy tracking
function getCellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function isOccupied(occupied: Set<string>, row: number, col: number): boolean {
  return occupied.has(getCellKey(row, col));
}

function markOccupied(occupied: Set<string>, row: number, col: number, size: number): void {
  for (let r = row; r < row + size; r++) {
    for (let c = col; c < col + size; c++) {
      occupied.add(getCellKey(r, c));
    }
  }
}

function canPlaceLarge(occupied: Set<string>, row: number, col: number, rows: number, cols: number): boolean {
  // Check if we can place a 2x2 starting at (row, col)
  if (row + 1 >= rows || col + 1 >= cols) return false;
  return !isOccupied(occupied, row, col) &&
         !isOccupied(occupied, row, col + 1) &&
         !isOccupied(occupied, row + 1, col) &&
         !isOccupied(occupied, row + 1, col + 1);
}

// Generate clustered empty cells for dark background to show through
function generateEmptyClusters(rows: number, cols: number, rng: () => number): Set<string> {
  const emptyCells = new Set<string>();
  
  // Number of cluster seeds (adjust for desired density)
  const numClusters = Math.floor(rows * cols * 0.12); // ~12% of cells will be cluster seeds
  const clusterSeeds: Array<[number, number]> = [];
  
  // Generate random cluster seed positions (avoid top and bottom rows)
  for (let i = 0; i < numClusters; i++) {
    // Avoid first row (0) and last row (rows-1) to prevent black strips at top/bottom
    const row = Math.floor(rng() * (rows - 2)) + 1; // Range: 1 to rows-2
    const col = Math.floor(rng() * cols);
    clusterSeeds.push([row, col]);
  }
  
  // For each seed, create a cluster using distance-based probability
  for (const [seedRow, seedCol] of clusterSeeds) {
    // Mark the seed as empty
    emptyCells.add(getCellKey(seedRow, seedCol));
    
    // Expand cluster to nearby cells (smaller radius for tighter clusters)
    const clusterRadius = 1; // Maximum distance from seed (reduced from 2)
    for (let r = Math.max(1, seedRow - clusterRadius); r <= Math.min(rows - 2, seedRow + clusterRadius); r++) {
      for (let c = Math.max(0, seedCol - clusterRadius); c <= Math.min(cols - 1, seedCol + clusterRadius); c++) {
        // Skip if already marked as empty
        if (emptyCells.has(getCellKey(r, c))) continue;
        
        // Calculate distance from seed
        const distance = Math.sqrt((r - seedRow) ** 2 + (c - seedCol) ** 2);
        
        // Probability decreases with distance (closer = more likely to be empty)
        const maxDistance = clusterRadius * 1.5;
        const probability = Math.max(0, 1 - (distance / maxDistance));
        
        // Add some randomness but favor closer cells (reduced probability for smaller clusters)
        if (rng() < probability * 0.35) {
          emptyCells.add(getCellKey(r, c));
        }
      }
    }
  }
  
  return emptyCells;
}

// Generate the pattern with multi-size support
function generatePattern(): void {
  // Clear previous pattern
  const existing = preview.querySelectorAll('g[data-cell]');
  existing.forEach(el => el.remove());
  
  // Ensure we have seeds
  if (seedCount === 0) {
    createFallbackShapes();
  }
  
  if (seedCount === 0) {
    return;
  }
  
  // Calculate dimensions (seamless grid, no gutter)
  const totalWidth = state.cols * state.tileSize;
  const totalHeight = state.rows * state.tileSize;
  
  // Set SVG attributes
  preview.setAttribute('width', totalWidth.toString());
  preview.setAttribute('height', totalHeight.toString());
  preview.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
  
  // Add background rectangle that matches the exact pattern dimensions
  // Remove existing background if present
  const existingBg = preview.querySelector('#background-rect');
  if (existingBg) {
    existingBg.remove();
  }
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('x', '0');
  bgRect.setAttribute('y', '0');
  bgRect.setAttribute('width', totalWidth.toString());
  bgRect.setAttribute('height', totalHeight.toString());
  bgRect.setAttribute('fill', '#1E1E1E');
  bgRect.setAttribute('id', 'background-rect');
  preview.insertBefore(bgRect, preview.firstChild);
  
  // Initialize RNG
  const seedHash = hashSeed(state.seed);
  const rng = mulberry32(seedHash);
  
  // Generate clustered empty cells (black will show through)
  const emptyCells = generateEmptyClusters(state.rows, state.cols, rng);
  
  // Track occupied cells
  const occupied = new Set<string>();
  
  // Generate grid with multi-size placement
  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      // Skip if cell is already occupied
      if (isOccupied(occupied, row, col)) {
        continue;
      }
      
      // Skip if this cell is marked as empty (black background shows through)
      if (emptyCells.has(getCellKey(row, col))) {
        continue;
      }
      
      // Decide whether to place large or small SVG
      // 30% chance to try large if available and space allows
      let size = 1;
      let seedId: string;
      
      // Check if large SVG can be placed (not occupied and not in empty cluster)
      const canPlaceLargeHere = largeSeeds.length > 0 && 
        canPlaceLarge(occupied, row, col, state.rows, state.cols) &&
        !emptyCells.has(getCellKey(row, col)) &&
        !emptyCells.has(getCellKey(row, col + 1)) &&
        !emptyCells.has(getCellKey(row + 1, col)) &&
        !emptyCells.has(getCellKey(row + 1, col + 1));
      
      if (canPlaceLargeHere && rng() < 0.3) {
        // Place large SVG (2x2)
        size = 2;
        const largeIndex = Math.floor(rng() * largeSeeds.length);
        seedId = largeSeeds[largeIndex];
        markOccupied(occupied, row, col, 2);
      } else if (smallSeeds.length > 0) {
        // Place small SVG (1x1)
        size = 1;
        const smallIndex = Math.floor(rng() * smallSeeds.length);
        seedId = smallSeeds[smallIndex];
        markOccupied(occupied, row, col, 1);
      } else {
        // Fallback: use any available seed
        const seedIndex = Math.floor(rng() * seedCount);
        seedId = `seed-${seedIndex}`;
        size = seedSizes.get(seedId) || 1;
        markOccupied(occupied, row, col, size);
      }
      
      const x = col * state.tileSize;
      const y = row * state.tileSize;
      const svgSize = size * state.tileSize;
      
      // Random rotation
      let rotation = 0;
      if (state.randomRotation) {
        const rotations = [0, 90, 180, 270];
        rotation = rotations[Math.floor(rng() * rotations.length)];
      }
      
      // Random flip
      let scaleX = 1;
      let scaleY = 1;
      if (state.allowFlips && rng() > 0.5) {
        scaleX *= -1;
      }
      
      // Create cell group
      const cellGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      cellGroup.setAttribute('data-cell', `${row}-${col}`);
      
      // Build transform string - translate to cell position, then apply rotation/flip
      // For rotation/flip, we translate to center, transform, then translate back
      const transforms: string[] = [];
      transforms.push(`translate(${x + svgSize / 2}, ${y + svgSize / 2})`);
      if (rotation !== 0) {
        transforms.push(`rotate(${rotation})`);
      }
      if (scaleX !== 1 || scaleY !== 1) {
        transforms.push(`scale(${scaleX}, ${scaleY})`);
      }
      transforms.push(`translate(${-svgSize / 2}, ${-svgSize / 2})`);
      cellGroup.setAttribute('transform', transforms.join(' '));
      
      // Create use element - fill the entire cell(s)
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', `#${seedId}`);
      use.setAttribute('x', '0');
      use.setAttribute('y', '0');
      use.setAttribute('width', svgSize.toString());
      use.setAttribute('height', svgSize.toString());
      cellGroup.appendChild(use);
      
      preview.appendChild(cellGroup);
    }
  }
}

// Export SVG
function downloadSVG(): void {
  // Clone the SVG to avoid modifying the original
  const clone = preview.cloneNode(true) as SVGElement;
  
  // Ensure all attributes are set
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  
  // Serialize
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  
  // Create blob and download
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pattern-${state.seed || 'export'}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Update state from UI
function updateState(): void {
  // Grid dimensions are fixed: 8 cols × 5 rows, tileSize 200
  state.cols = 8;
  state.rows = 5;
  state.tileSize = 200;
  state.seed = seedInput.value || 'pattern-2024';
  state.randomRotation = randomRotationCheck.checked;
  state.allowFlips = allowFlipsCheck.checked;
  
  saveState();
  generatePattern();
}

// Randomize seed
function randomize(): void {
  const newSeed = `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  seedInput.value = newSeed;
  updateState();
}

// Event listeners
seedInput.addEventListener('input', updateState);
randomRotationCheck.addEventListener('change', updateState);
allowFlipsCheck.addEventListener('change', updateState);
randomizeBtn.addEventListener('click', randomize);
downloadBtn.addEventListener('click', downloadSVG);

// Initialize
(async () => {
  loadState();
  await loadDefaultSVGs();
  // Only use fallback if no SVGs were loaded
  if (seedCount === 0) {
    createFallbackShapes();
  }
  generatePattern();
})();

