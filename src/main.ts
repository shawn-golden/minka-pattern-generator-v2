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
  blackClustering: boolean;
}

const defaultState: AppState = {
  cols: 8,
  rows: 5,
  tileSize: 200, // Doubled from 100 to make output 1600px × 1000px
  seed: 'pattern-2024',
  randomRotation: true,
  allowFlips: false,
  blackClustering: true
};

let state: AppState = { ...defaultState };
let seedCount = 0;
// Track SVG sizes: 1 = 1x1 (200x200), 2 = 2x2 (400x400)
const seedSizes = new Map<string, number>(); // seedId -> size
const seedMetadata = new Map<string, { filename: string; size: number }>(); // seedId -> metadata
const smallSeeds: string[] = [];
const largeSeeds: string[] = [];

// DOM elements
const preview = document.getElementById('preview') as unknown as SVGElement;
const seedDefs = document.getElementById('seed-defs') as unknown as SVGDefsElement;
const seedInput = document.getElementById('seed') as HTMLInputElement;
const randomRotationCheck = document.getElementById('randomRotation') as HTMLInputElement;
const allowFlipsCheck = document.getElementById('allowFlips') as HTMLInputElement;
const blackClusteringCheck = document.getElementById('blackClustering') as HTMLInputElement;
const randomizeBtn = document.getElementById('randomizeBtn') as HTMLButtonElement;
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement;
const uploadInput = document.getElementById('uploadInput') as HTMLInputElement;
const clearSeedsBtn = document.getElementById('clearSeedsBtn') as HTMLButtonElement;
const seedList = document.getElementById('seedList') as HTMLElement;
const previewOverlay = document.getElementById('previewOverlay') as HTMLElement;

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
  blackClusteringCheck.checked = state.blackClustering;
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
  seedMetadata.set(seedId1, { filename: 'Fallback: Solid Black', size: 1 });
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
  seedMetadata.set(seedId2, { filename: 'Fallback: Solid Gray', size: 1 });
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
  seedMetadata.set(seedId3, { filename: 'Fallback: Solid White', size: 1 });
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
  seedMetadata.set(seedId4, { filename: 'Fallback: Thin Stripes', size: 1 });
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
  seedMetadata.set(seedId5, { filename: 'Fallback: Medium Stripes', size: 1 });
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
  seedMetadata.set(seedId6, { filename: 'Fallback: Thick Stripes', size: 1 });
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
  seedMetadata.set(seedId7, { filename: 'Fallback: Variable Stripes', size: 1 });
  smallSeeds.push(seedId7);
  
  updateSeedListUI();
}

// Detect SVG size from dimensions
function detectSVGSize(svgRoot: SVGElement): number | null {
  let width: number, height: number;
  
  // Check viewBox first: "0 0 width height"
  const viewBox = svgRoot.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/\s+/);
    if (parts.length >= 4) {
      width = parseFloat(parts[2]);
      height = parseFloat(parts[3]);
    } else {
      return null;
    }
  } else {
    // Fall back to width/height attributes
    const widthAttr = svgRoot.getAttribute('width') || '0';
    const heightAttr = svgRoot.getAttribute('height') || '0';
    width = parseFloat(widthAttr.replace('px', ''));
    height = parseFloat(heightAttr.replace('px', ''));
  }
  
  // Validate exact dimensions
  if (width === 200 && height === 200) return 1;
  if (width === 400 && height === 400) return 2;
  return null; // Invalid size
}

// Helper function to add SVG symbol and track its size
function addSVGSymbol(svgRoot: SVGElement, size: number, filename: string = ''): void {
  // Extract filename from path if not provided
  if (!filename && svgRoot.getAttribute('data-filename')) {
    filename = svgRoot.getAttribute('data-filename') || '';
  }
  
  // Normalize viewBox to exact dimensions: 200x200 for size 1, 400x400 for size 2
  const expectedSize = size === 1 ? 200 : 400;
  const viewBox = `0 0 ${expectedSize} ${expectedSize}`;
  
  // Get the original viewBox or dimensions to calculate scale
  let originalViewBox = svgRoot.getAttribute('viewBox');
  let originalWidth = 0;
  let originalHeight = 0;
  
  if (originalViewBox) {
    const parts = originalViewBox.split(/\s+/);
    if (parts.length >= 4) {
      originalWidth = parseFloat(parts[2]);
      originalHeight = parseFloat(parts[3]);
    }
  } else {
    const widthAttr = svgRoot.getAttribute('width') || '0';
    const heightAttr = svgRoot.getAttribute('height') || '0';
    originalWidth = parseFloat(widthAttr.replace('px', ''));
    originalHeight = parseFloat(heightAttr.replace('px', ''));
  }
  
  // If we have original dimensions, calculate scale to fit expected size
  const scaleX = originalWidth > 0 ? expectedSize / originalWidth : 1;
  const scaleY = originalHeight > 0 ? expectedSize / originalHeight : 1;
  
  const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  const seedId = `seed-${seedCount++}`;
  symbol.id = seedId;
  symbol.setAttribute('viewBox', viewBox);
  
  // Wrap content in a group and scale if needed
  const contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  if (scaleX !== 1 || scaleY !== 1) {
    contentGroup.setAttribute('transform', `scale(${scaleX}, ${scaleY})`);
  }
  
  Array.from(svgRoot.childNodes).forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      contentGroup.appendChild(child.cloneNode(true));
    }
  });
  
  symbol.appendChild(contentGroup);
  
  seedDefs.appendChild(symbol);
  seedSizes.set(seedId, size);
  seedMetadata.set(seedId, { filename, size });
  
  if (size === 1) {
    smallSeeds.push(seedId);
  } else if (size === 2) {
    largeSeeds.push(seedId);
  }
  
  updateSeedListUI();
}

// Update seed list UI
function updateSeedListUI(): void {
  if (!seedList) return;
  
  seedList.innerHTML = '';
  
  if (seedCount === 0) {
    seedList.innerHTML = '<p style="color: #999; font-size: 12px;">No seeds loaded. Upload SVGs to get started.</p>';
    return;
  }
  
  // Show count
  const countText = document.createElement('p');
  countText.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 8px;';
  countText.textContent = `${smallSeeds.length} small (200×200), ${largeSeeds.length} large (400×400)`;
  seedList.appendChild(countText);
  
  // List all seeds
  seedMetadata.forEach((metadata, seedId) => {
    const seedItem = document.createElement('div');
    seedItem.className = 'seed-item';
    
    const seedName = document.createElement('span');
    seedName.className = 'seed-name';
    seedName.textContent = metadata.filename || seedId;
    
    const seedSize = document.createElement('span');
    seedSize.className = 'seed-size';
    seedSize.textContent = metadata.size === 1 ? '200×200' : '400×400';
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'seed-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeSeed(seedId));
    
    seedItem.appendChild(seedName);
    seedItem.appendChild(seedSize);
    seedItem.appendChild(removeBtn);
    seedList.appendChild(seedItem);
  });
}

// Remove a single seed
function removeSeed(seedId: string): void {
  // Remove from DOM
  const symbol = seedDefs.querySelector(`#${seedId}`);
  if (symbol) {
    symbol.remove();
  }
  
  // Remove from tracking
  seedSizes.delete(seedId);
  seedMetadata.delete(seedId);
  
  // Remove from arrays
  const smallIndex = smallSeeds.indexOf(seedId);
  if (smallIndex > -1) {
    smallSeeds.splice(smallIndex, 1);
  }
  const largeIndex = largeSeeds.indexOf(seedId);
  if (largeIndex > -1) {
    largeSeeds.splice(largeIndex, 1);
  }
  
  seedCount--;
  
  updateSeedListUI();
  generatePattern();
}

// Clear all seeds
function clearSeeds(): void {
  seedDefs.innerHTML = '';
  seedCount = 0;
  seedSizes.clear();
  seedMetadata.clear();
  smallSeeds.length = 0;
  largeSeeds.length = 0;
  
  updateSeedListUI();
  generatePattern();
}

// Handle file upload
async function handleFileUpload(files: FileList | null): Promise<void> {
  if (!files || files.length === 0) return;
  
  const errors: string[] = [];
  let successCount = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Check file type
    if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
      errors.push(`${file.name}: Not an SVG file`);
      continue;
    }
    
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const svgRoot = doc.documentElement as unknown as SVGElement;
      
      if (svgRoot.tagName !== 'svg') {
        errors.push(`${file.name}: Invalid SVG format`);
        continue;
      }
      
      // Detect size
      const size = detectSVGSize(svgRoot);
      if (size === null) {
        errors.push(`${file.name}: Must be exactly 200×200 or 400×400 pixels`);
        continue;
      }
      
      // Add the SVG
      addSVGSymbol(svgRoot, size, file.name);
      successCount++;
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Show results
  if (errors.length > 0) {
    alert(`Uploaded ${successCount} file(s) successfully.\n\nErrors:\n${errors.join('\n')}`);
  } else if (successCount > 0) {
    // Silent success if all files uploaded
  }
  
  // Regenerate pattern if any files were added
  if (successCount > 0) {
    generatePattern();
  }
}

// Load SVGs from both svg-v2 (200x200, 1x1) and svg-large (400x400, 2x2) directories
// (Kept for reference, but not called automatically)
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
            // Extract filename from path
            const filename = svgPath.split('/').pop() || svgPath;
            addSVGSymbol(svgRoot, 1, filename); // 1x1 grid space
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
            // Extract filename from path
            const filename = svgPath.split('/').pop() || svgPath;
            addSVGSymbol(svgRoot, 2, filename); // 2x2 grid spaces
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
  
  // Clear any existing empty state message
  const existingMessage = preview.querySelector('#empty-state-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // Show empty state if no seeds
  if (seedCount === 0) {
    const totalWidth = state.cols * state.tileSize;
    const totalHeight = state.rows * state.tileSize;
    
    // Set SVG attributes
    preview.setAttribute('width', totalWidth.toString());
    preview.setAttribute('height', totalHeight.toString());
    preview.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
    
    // Add background rectangle
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
    
    // Add border rectangle
    const existingBorder = preview.querySelector('#border-rect');
    if (existingBorder) {
      existingBorder.remove();
    }
    const borderRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    borderRect.setAttribute('x', '0');
    borderRect.setAttribute('y', '0');
    borderRect.setAttribute('width', totalWidth.toString());
    borderRect.setAttribute('height', totalHeight.toString());
    borderRect.setAttribute('fill', 'none');
    borderRect.setAttribute('stroke', '#D3D3D3');
    borderRect.setAttribute('stroke-width', '2');
    borderRect.setAttribute('id', 'border-rect');
    preview.insertBefore(borderRect, preview.firstChild);
    
    // Add empty state message
    const messageGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    messageGroup.setAttribute('id', 'empty-state-message');
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', (totalWidth / 2).toString());
    text.setAttribute('y', (totalHeight / 2).toString());
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#999');
    text.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
    text.setAttribute('font-size', '32');
    text.textContent = 'Upload seeds to generate a pattern';
    
    messageGroup.appendChild(text);
    preview.appendChild(messageGroup);
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
    
    // Add border rectangle
    const existingBorder2 = preview.querySelector('#border-rect');
    if (existingBorder2) {
      existingBorder2.remove();
    }
    const borderRect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    borderRect2.setAttribute('x', '0');
    borderRect2.setAttribute('y', '0');
    borderRect2.setAttribute('width', totalWidth.toString());
    borderRect2.setAttribute('height', totalHeight.toString());
    borderRect2.setAttribute('fill', 'none');
    borderRect2.setAttribute('stroke', '#D3D3D3');
    borderRect2.setAttribute('stroke-width', '2');
    borderRect2.setAttribute('id', 'border-rect');
    preview.insertBefore(borderRect2, preview.firstChild);
    
    // Initialize RNG
  const seedHash = hashSeed(state.seed);
  const rng = mulberry32(seedHash);
  
  // Generate clustered empty cells (black will show through) if enabled
  const emptyCells = state.blackClustering 
    ? generateEmptyClusters(state.rows, state.cols, rng)
    : new Set<string>();
  
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
  state.blackClustering = blackClusteringCheck.checked;
  
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
blackClusteringCheck.addEventListener('change', updateState);
randomizeBtn.addEventListener('click', randomize);
downloadBtn.addEventListener('click', downloadSVG);
previewOverlay.addEventListener('click', downloadSVG);
uploadInput.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement;
  handleFileUpload(target.files);
});
clearSeedsBtn.addEventListener('click', clearSeeds);

// Drag and drop
const dropzone = document.body;
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});
dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const files = e.dataTransfer?.files;
  if (files) {
    const svgFiles = Array.from(files).filter(f => f.type === 'image/svg+xml' || f.name.endsWith('.svg'));
    if (svgFiles.length > 0) {
      const fileList = new DataTransfer();
      svgFiles.forEach(f => fileList.items.add(f));
      await handleFileUpload(fileList.files);
    }
  }
});

// Initialize
async function initialize(): Promise<void> {
  loadState();
  // Load default SVGs if no seeds are present (first time load)
  if (seedCount === 0) {
    await loadDefaultSVGs();
  }
  generatePattern();
  updateSeedListUI();
}

initialize();

