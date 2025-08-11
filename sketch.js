let siteInfinite = false; // Determine if the site can infinitely produce food
let drawObjectPath = true;
let pathHistoryLimit = 50; // Limit for how many path points to keep

// Visual layers and theme
let bgLayer = null; // Cached background (gradient + grain + vignette)
let trailsLayer = null; // Persistent layer for motion trails
// Sprite caches
let iconSpriteCache = new Map(); // key: `${status}_${sizeBucket}` => p5.Graphics
let haloSpriteCache = new Map(); // key: `${status}_${sizeBucket}` => p5.Graphics
let foodHaloCache = new Map();   // key: `${sizeBucket}` => p5.Graphics
let siteHaloCache = new Map();   // key: `${sizeBucket}` => p5.Graphics
// HUD cache
let hudLayer = null;
let hudLastUpdateFrame = -1;
const HUD_UPDATE_INTERVAL = 6; // redraw HUD every N frames

// Spatial grid
let gridCellSize = 96;
let spatialGrid = null; // Map key:"cx,cy" -> {objects:[], foods:[], sites:[]}
// Status color palette
const statusColors = {
  doodle: [147, 197, 253], // soft blue
  mate: [244, 114, 182],   // pink
  eat: [134, 239, 172],    // green
  work: [251, 191, 36]     // amber
};

// Effects containers
const MAX_PARTICLES = 200;
let particleActive = [];
let particlePool = [];
let ringPulses = [];

// Start panel controls (DOM)
let siteSlider = null;
let objectSlider = null;
let foodSlider = null;
let startControlsContainer = null;
let startButton = null; // deprecated HTML button, kept for safety (not used)
let startBtnRect = null; // p5-drawn button rect on canvas

// Array to hold all instances in the simulation
let objectArray = [];
let foodArray = [];
let siteArray = [];

// Initial parameters for the simulation
let initialObjectNum = 20;
let initialFoodNum = 20;
let initialSiteNum = 2;
let initialSpeed = 5;
let initialAge = 10;
let initialSize = 30;
let initialHunger = 0.5;
let initialStatus = 'doodle';

let setAgingFactor = 2;
let setSizingFactor = 2;
let setHungerFactor = 1;
let setEntropyFactor = 1; // The randomness in many process
let setMaxAge = 100;
let setMaxUtility = 3; // An integer, the number of foods a site could generate, and the maximum hunger level a food could recover
let setMaxBirth = 3; // An integer, the number of birth an object could give
let setWorkThreshold = 2; // The ratio below which objects start to work
let workNeeded = 5; // The amount of work needed for a new food to be generated

let simStart = false; // Flag indicating whether the simulation has started
let startFrame = null; // Frame count at which the simulation starts


function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noSmooth();
  frameRate(30);
  // Build static background layer once
  buildBackgroundLayer();
  buildTrailsLayer();
  buildHudLayer();
  
  // Delay instance initialization until start to honor slider values
}

function draw() {
  // Draw cached background with vignette/texture
  if (!bgLayer || bgLayer.width !== windowWidth || bgLayer.height !== windowHeight) {
    buildBackgroundLayer();
  }
  image(bgLayer, 0, 0, width, height);

  // Slightly fade previous trails then draw new ones
  if (!trailsLayer || trailsLayer.width !== windowWidth || trailsLayer.height !== windowHeight) {
    buildTrailsLayer();
  }
  if (drawObjectPath) {
    fadeTrailsLayer(8); // slightly slower fade for visibility
  }
  // Rebuild spatial grid for this frame
  rebuildSpatialGrid();
  
  // Call behavior function for each object
  for (j = 0; j < objectArray.length; j ++) {
    objectsBehave(objectArray[j]);
  }
  
  // Call behavior function for each food item
  for (i = 0; i < foodArray.length; i ++) {
    foodsBehave(foodArray[i]);
  }
  
  // Call behavior function for each site
  for (i = 0; i < siteArray.length; i ++) {
    siteBehave(siteArray[i]);
  }

  // Draw transient effects on top
  updateAndDrawEffects();

  // Composite trails layer on top
  if (drawObjectPath) {
    image(trailsLayer, 0, 0, width, height);
  }
  // Draw HUD from cached layer
  drawHUDCached();
  
  // Display the start panel if the simulation hasn't started
  if (simStart === false) {
    startPanel();
    startFrame = frameCount;
  } else if (simStart === true) {
    drawMouseTooltip();
  }
  
}

// Effect systems
function spawnSparkles(x, y, count, col, direction) {
  for (let i = 0; i < count; i++) {
    if (particleActive.length >= MAX_PARTICLES) break;
    const ang = random(TWO_PI);
    const spd = random(0.5, 2.0) * (direction < 0 ? -1 : 1);
    const p = particlePool.pop() || {};
    p.x = x; p.y = y;
    p.vx = Math.cos(ang) * spd;
    p.vy = Math.sin(ang) * spd;
    p.life = 20; p.maxLife = 20;
    p.col = col; p.size = random(2, 4);
    p.type = 'spark';
    p.gravity = 0;
    particleActive.push(p);
  }
}

function spawnConfetti(x, y, count, col) {
  for (let i = 0; i < count; i++) {
    if (particleActive.length >= MAX_PARTICLES) break;
    const ang = random(TWO_PI);
    const spd = random(1.5, 3.5);
    const p = particlePool.pop() || {};
    p.x = x; p.y = y;
    p.vx = Math.cos(ang) * spd;
    p.vy = Math.sin(ang) * spd - random(0.5, 1.2);
    p.gravity = 0.05;
    p.life = 28; p.maxLife = 28;
    p.col = col; p.size = random(2, 5);
    p.type = 'confetti';
    particleActive.push(p);
  }
}

function spawnRingPulse(x, y, startR, col, life = 30) {
  ringPulses.push({ x, y, r: startR, life, maxLife: life, col });
}

function updateAndDrawEffects() {
  // Particles
  for (let i = particleActive.length - 1; i >= 0; i--) {
    const p = particleActive[i];
    p.life--;
    if (p.type === 'confetti') {
      p.vy += p.gravity || 0;
      p.vx *= 0.99;
    }
    p.x += p.vx;
    p.y += p.vy;
    if (p.life <= 0) {
      particleActive.splice(i, 1);
      particlePool.push(p);
      continue;
    }
    const a = map(p.life, 0, p.maxLife, 0, 180);
    noStroke();
    fill(red(p.col), green(p.col), blue(p.col), a);
    circle(p.x, p.y, p.size);
  }

  // Ring pulses
  for (let i = ringPulses.length - 1; i >= 0; i--) {
    const r = ringPulses[i];
    r.life--;
    const t = 1 - r.life / r.maxLife;
    const alpha = map(r.life, 0, r.maxLife, 0, 150);
    noFill();
    stroke(red(r.col), green(r.col), blue(r.col), alpha);
    strokeWeight(2);
    circle(r.x, r.y, r.r + t * 80);
    if (r.life <= 0) ringPulses.splice(i, 1);
  }
}

function mouseClicked() {
  // Spawn new instances at the mouse location when clicked with different keys pressed
  if (keyCode === 79) { // If the last pressed button is 'O'
    initiateObject(mouseX, mouseY); 
  } else if (keyCode === 70) { // If the last pressed button is 'F'
    foodArray.push(new Foods(mouseX, mouseY, setMaxUtility)); 
  } else if (keyCode === 83) { // If the last pressed button is 'S'
    siteArray.push(new Sites(mouseX, mouseY, setMaxUtility));
  }
  // Handle p5-drawn start button click before sim starts
  if (!simStart && startBtnRect) {
    if (mouseX >= startBtnRect.x && mouseX <= startBtnRect.x + startBtnRect.w && mouseY >= startBtnRect.y && mouseY <= startBtnRect.y + startBtnRect.h) {
      startSimulationFromControls();
    } 
  }
}


function initiateObject(x = random(windowWidth), y = random(windowHeight)) {
  // Create and add a new object to the objectArray with parameters set initially
  objectArray.push(new Objects(x , y, 
                               tempAge = initialAge,
                               tempSize = initialSize,
                               tempSpeed = initialSpeed, 
                               tempHunger = initialHunger,
                               tempStatus = initialStatus,
                               tempMaxAge = setMaxAge,
                               agingFactor = setAgingFactor, 
                               sizingFactor = setSizingFactor, 
                               hungerFactor = setHungerFactor, 
                               entropyFactor = setEntropyFactor, 
                               maxBirth = setMaxBirth, 
                               workThreshold = setWorkThreshold));
}

function foodsBehave(food) {
  // Manage behaviors for food items
  if (food.status === 'reached') {
    foodArray.splice(i, 1); // Remove the food if it has been reached
  } else {
    food.display();
  }
}

function siteBehave(site) {
  // Manage behaviors for sites
  if ((site.workDone != 0) && (site.workDone % workNeeded === 0)) {
    // Generate new food based on work done
    for (i = 0; i < workNeeded; i ++) {
       foodArray.push(new Foods(random(windowWidth), random(windowHeight), setMaxUtility));
    }
    site.workDone = 0; // Reset work done after generating food
    if (siteInfinite === false) {
      site.utility -= 1; // Decrease site utility if not infinite
    }
    // Pulse ring effect at site on production
    spawnRingPulse(site.x, site.y, site.size * setMaxUtility + 20, color(164,159,213), 35);
  }
  
  // Remove the site if its utility is zero
  if (site.utility === 0) {
    siteArray.splice(i, 1); 
  } else {
    site.display();
  }
}

function objectsBehave(object) {
  // Manage behaviors for objects
  object.statusUpdate(); // Update the object's status
    
  // Handle object behavior based on its current status
  if (object.status === 'doodle') {
    object.doodle();
  } else if (object.status === 'mate') {
    object.move(objectArray); // Move towards other objects
  } else if (object.status === 'work') {
    if (siteArray[0]) {
      object.move(siteArray); // Move towards sites
    } else {
      object.status = 'doodle'; // Change status if no sites are available
    } 
  } else if (object.status === 'eat') {
    if (foodArray[0]) {
      object.move(foodArray);
    } else {
      object.status = 'work';
    }
  } else if (object.status === 'dead') {
    objectArray.splice(j, 1); // Remove the object if it has reached max age
  }

  // Periodically update aging, hunger, and direction every 60 frames
  if (frameCount % 60 === 0) {
    object.aging();
    object.hungering();
    object.directing();
  }

  // Display the object regardless of its status
  object.display();
}

// Build spatial grid each frame before behaviors
function rebuildSpatialGrid() {
  spatialGrid = new Map();
  const put = (x, y, entry, type) => {
    const cx = Math.floor(x / gridCellSize);
    const cy = Math.floor(y / gridCellSize);
    const key = `${cx},${cy}`;
    let bucket = spatialGrid.get(key);
    if (!bucket) { bucket = { objects: [], foods: [], sites: [] }; spatialGrid.set(key, bucket); }
    bucket[type].push(entry);
  };
  for (const o of objectArray) put(o.x, o.y, o, 'objects');
  for (const f of foodArray) put(f.x, f.y, f, 'foods');
  for (const s of siteArray) put(s.x, s.y, s, 'sites');
}

function startPanel() {
  const panelWFactor = 0.75;
  const panelHFactor = 0.65; // increased height
  // Create and display the start panel for the simulation
  // Cache the panel graphics so we don't recreate every frame
  if (!window.__cachedStartPanel || window.__cachedStartPanel.width !== Math.floor(windowWidth * panelWFactor) || window.__cachedStartPanel.height !== Math.floor(windowHeight * panelHFactor)) {
    window.__cachedStartPanel = createGraphics(Math.floor(windowWidth * panelWFactor), Math.floor(windowHeight * panelHFactor));
    const sp = window.__cachedStartPanel;
    sp.clear();
    sp.noStroke();
    // Panel background
    sp.fill(164, 159, 213, 230);
    sp.rect(0, 0, sp.width, sp.height, 24);

    // Title
    sp.fill(255);
    sp.textAlign(CENTER, CENTER);
    sp.textFont('Courier New');
    sp.textSize(56);
    sp.text('Object Life Sim', sp.width / 2, Math.floor(sp.height * 0.28));
    // Subtitle / instructions
    sp.textSize(18);
    sp.fill(255, 255, 255, 220);
    sp.text('Keys: O/F/S + click to spawn • Hover an object for info', sp.width / 2, Math.floor(sp.height * 0.42));
    sp.text('Adjust counts below and press Start', sp.width / 2, Math.floor(sp.height * 0.50));
  }

  // Fade and soft shadow on entrance
  const panelX = (windowWidth - windowWidth * panelWFactor) / 2;
  const panelY = (windowHeight - windowHeight * panelHFactor) / 2;
  const appearT = constrain(frameCount / 30, 0, 1);
  push();
  drawingContext.shadowBlur = 30;
  drawingContext.shadowColor = 'rgba(0,0,0,0.35)';
  tint(255, 255 * appearT);
  image(window.__cachedStartPanel, panelX, panelY);
  pop();
  
  // Draw p5-styled Start button inside the panel
  if (!simStart && startBtnRect) {
    const mx = mouseX, my = mouseY;
    const hover = mx >= startBtnRect.x && mx <= startBtnRect.x + startBtnRect.w && my >= startBtnRect.y && my <= startBtnRect.y + startBtnRect.h;
    const base = color(164, 159, 213, 240);
    const lighter = color(184, 179, 233, 255);
    const fillCol = hover ? lighter : base;
    push();
    noStroke();
    fill(fillCol);
    rect(startBtnRect.x, startBtnRect.y, startBtnRect.w, startBtnRect.h, 12);
    fill(255);
    textAlign(CENTER, CENTER);
    textFont('Courier New');
    textSize(20);
    text('Start', startBtnRect.x + startBtnRect.w / 2, startBtnRect.y + startBtnRect.h / 2 + 1);
    pop();
  }

  // Create DOM controls positioned within the panel if not present
  if (!startControlsContainer) {
    startControlsContainer = createDiv('');
    startControlsContainer.style('position', 'absolute');
    // inset padding within the panel
    const insetX = panelX + Math.floor(window.__cachedStartPanel.width * 0.12);
    const controlsWidth = Math.floor(window.__cachedStartPanel.width * 0.76);
    const insetY = panelY + Math.floor(window.__cachedStartPanel.height * 0.58);
    startControlsContainer.style('left', insetX + 'px');
    startControlsContainer.style('top', insetY + 'px');
    startControlsContainer.style('width', controlsWidth + 'px');
    startControlsContainer.style('color', '#fff');
    startControlsContainer.style('font-family', 'Courier New, monospace');
    startControlsContainer.style('text-align', 'center');

    const makeRow = (label, min, max, val) => {
      const row = createDiv('');
      row.parent(startControlsContainer);
      row.style('margin', '10px 0');
      const lab = createSpan(label + ': ');
      lab.parent(row);
      const slider = createSlider(min, max, val, 1);
      slider.size(Math.floor(controlsWidth * 0.8));
      slider.parent(row);
      // Slider color to match panel (thumb and track)
      slider.style('accent-color', '#6f66b5');
      const valueSpan = createSpan(' ' + val);
      valueSpan.parent(row);
      slider.input(() => valueSpan.html(' ' + slider.value()));
      return slider;
    };

    objectSlider = makeRow('Objects', 1, 100, initialObjectNum);
    foodSlider = makeRow('Foods', 0, 200, initialFoodNum);
    siteSlider = makeRow('Sites', 0, 20, initialSiteNum);

    // Toggle for path drawing
    const pathRow = createDiv('');
    pathRow.parent(startControlsContainer);
    pathRow.style('margin', '12px 0');
    const cbLabel = createSpan('Draw paths: ');
    cbLabel.parent(pathRow);
    const pathToggle = createCheckbox('', drawObjectPath);
    pathToggle.parent(pathRow);
    pathToggle.changed(() => { drawObjectPath = pathToggle.checked(); });
    // style checkbox
    pathToggle.style('accent-color', '#6f66b5');

    // Drawn start button bounds for hit detection
    const btnW = Math.floor(controlsWidth * 0.5);
    const btnH = 44;
    startBtnRect = {
      x: panelX + Math.floor((window.__cachedStartPanel.width - btnW) / 2),
      y: insetY + 160,
      w: btnW,
      h: btnH
    };
  } else {
    // Keep container aligned to panel on resize
    const insetX = panelX + Math.floor(window.__cachedStartPanel.width * 0.12);
    const controlsWidth = Math.floor(window.__cachedStartPanel.width * 0.76);
    const insetY = panelY + Math.floor(window.__cachedStartPanel.height * 0.58);
    startControlsContainer.style('left', insetX + 'px');
    startControlsContainer.style('top', insetY + 'px');
    startControlsContainer.style('width', controlsWidth + 'px');
    // Update button rect
    const btnW = Math.floor(controlsWidth * 0.5);
    const btnH = 44;
    startBtnRect = {
      x: panelX + Math.floor((window.__cachedStartPanel.width - btnW) / 2),
      y: insetY + 160,
      w: btnW,
      h: btnH
    };
  }
}

// Adjust canvas size when the window is resized
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildBackgroundLayer();
  buildTrailsLayer();
  buildHudLayer();
  // Rebuild start panel to fit new size
  window.__cachedStartPanel = null;
  // Reposition sliders if visible
  if (startControlsContainer) {
    // Force recreation next frame to update sizes
    startControlsContainer.remove();
    if (startButton) startButton.remove();
    startControlsContainer = null;
    siteSlider = null;
    objectSlider = null;
    foodSlider = null;
    startButton = null;
  }
}

// Removed fullscreen toggle per request

// Build cached background with gradient, subtle grain, and vignette
function buildBackgroundLayer() {
  bgLayer = createGraphics(windowWidth, windowHeight);
  const g = bgLayer;
  const ctx = g.drawingContext;

  // Linear gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, g.height);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#1f2937');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, g.width, g.height);

  // Subtle grain
  g.noStroke();
  for (let i = 0, n = Math.floor(g.width * g.height * 0.0003); i < n; i++) {
    const x = Math.random() * g.width;
    const y = Math.random() * g.height;
    const a = Math.floor(10 + Math.random() * 15); // 10–25 alpha
    g.fill(255, 255, 255, a);
    g.rect(x, y, 1, 1);
  }

  // Vignette
  const cx = g.width / 2;
  const cy = g.height / 2;
  const r = Math.max(g.width, g.height) * 0.75;
  const vgrad = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r);
  vgrad.addColorStop(0, 'rgba(0,0,0,0)');
  vgrad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vgrad;
  ctx.fillRect(0, 0, g.width, g.height);
}

// Trails layer: initialize and clear
function buildTrailsLayer() {
  trailsLayer = createGraphics(windowWidth, windowHeight);
  trailsLayer.clear();
}

function fadeTrailsLayer(alpha = 12) {
  if (!trailsLayer) return;
  const ctx = trailsLayer.drawingContext;
  trailsLayer.push();
  // Erase a translucent rectangle to fade old trails without darkening the scene
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  trailsLayer.noStroke();
  trailsLayer.fill(0, 0, 0, alpha); // alpha controls fade speed
  trailsLayer.rect(0, 0, trailsLayer.width, trailsLayer.height);
  ctx.restore();
  trailsLayer.pop();
}

// ---- Sprite cache helpers ----
function getSizeBucket(px) {
  // Bucket sizes to every 4px to limit cache entries
  return Math.max(8, Math.round(px / 4) * 4);
}

function getIconSprite(status, sizePx) {
  const bucket = getSizeBucket(sizePx);
  const key = `${status}_${bucket}`;
  if (iconSpriteCache.has(key)) return iconSpriteCache.get(key);
  const g = createGraphics(bucket, bucket);
  g.clear();
  g.push();
  g.textAlign(CENTER, CENTER);
  g.textFont('Courier New');
  g.textSize(bucket - 5);
  const codePoints = { doodle: 0x1F4A4, mate: 0x1F498, eat: 0x1F445, work: 0x1F4AA };
  const icon = String.fromCodePoint(codePoints[status] || 0x1F4A4);
  g.drawingContext.shadowBlur = 6;
  g.drawingContext.shadowColor = 'rgba(0,0,0,0.35)';
  g.fill(255);
  g.text(icon, bucket / 2, bucket / 2 + 1);
  g.pop();
  iconSpriteCache.set(key, g);
  return g;
}

function getHaloSprite(status, radiusPx) {
  const bucket = getSizeBucket(radiusPx);
  const key = `${status}_${bucket}`;
  if (haloSpriteCache.has(key)) return haloSpriteCache.get(key);
  const g = createGraphics(bucket, bucket);
  g.clear();
  const col = statusColors[status] || [200, 200, 200];
  g.push();
  g.noFill();
  g.stroke(col[0], col[1], col[2], 120);
  g.strokeWeight(3);
  g.circle(bucket / 2, bucket / 2, bucket - 2);
  g.pop();
  haloSpriteCache.set(key, g);
  return g;
}

function getFoodHaloSprite(radiusPx) {
  const bucket = getSizeBucket(radiusPx);
  const key = `${bucket}`;
  if (foodHaloCache.has(key)) return foodHaloCache.get(key);
  const g = createGraphics(bucket, bucket);
  g.clear();
  g.push();
  g.noStroke();
  // One-time pre-rendered soft halo
  for (let r = bucket; r > 0; r -= 2) {
    const a = map(r, 0, bucket, 0, 40);
    g.fill(255, 215, 160, a);
    g.circle(bucket / 2, bucket / 2, r);
  }
  g.pop();
  foodHaloCache.set(key, g);
  return g;
}

function getSiteHaloSprite(radiusPx) {
  const bucket = getSizeBucket(radiusPx);
  const key = `${bucket}`;
  if (siteHaloCache.has(key)) return siteHaloCache.get(key);
  const g = createGraphics(bucket, bucket);
  g.clear();
  g.push();
  g.noStroke();
  for (let r = bucket; r > 0; r -= 3) {
    const a = map(r, 0, bucket, 0, 55);
    g.fill(164, 159, 213, a);
    g.circle(bucket / 2, bucket / 2, r);
  }
  g.pop();
  siteHaloCache.set(key, g);
  return g;
}

// Heads-up display: compact chips
function drawHUD() {
  const padX = 12;
  const padY = 8;
  const gap = 10;
  const rightX = windowWidth - 10;
  const topY = 14;
  const simText = 'Sim Point: ' + (frameCount - startFrame);
  const objText = 'Object Alive: ' + objectArray.length;

  push();
  textFont('Courier New');
  textSize(16);
  // Right-aligned chips with status color accent bars
  drawHUDChip(simText, rightX, topY, 'RIGHT');
  drawHUDChip(objText, rightX, topY + 28, 'RIGHT');
  // Left instruction chip
  drawHUDChip('O/F/S + click to spawn', 10, topY, 'LEFT');
  pop();
}

function drawHUDChip(label, x, y, align) {
  push();
  textFont('Courier New');
  textSize(16);
  const tW = textWidth(label);
  const paddingX = 10;
  const paddingY = 6;
  const rectW = tW + paddingX * 2;
  const rectH = 24;
  let rx = x;
  if (align === 'RIGHT') {
    rx = x - rectW;
    textAlign(RIGHT, CENTER);
  } else {
    textAlign(LEFT, CENTER);
  }

  // Background pill
  noStroke();
  fill(255, 255, 255, 28);
  rect(rx, y - rectH / 2, rectW, rectH, 12);
  // Left accent bar (status palette overview)
  if (align !== 'RIGHT') {
    fill(statusColors.work[0], statusColors.work[1], statusColors.work[2], 160);
    rect(rx, y - rectH / 2, 3, rectH, 12, 0, 0, 12);
  }
  // Text
  fill(255);
  text(label, align === 'RIGHT' ? x - paddingX : rx + paddingX, y);
  pop();
}

// Cached HUD drawing: redraw every HUD_UPDATE_INTERVAL frames
function buildHudLayer() {
  hudLayer = createGraphics(windowWidth, windowHeight);
  hudLayer.clear();
  hudLastUpdateFrame = -1;
}

function drawHUDCached() {
  if (!hudLayer) buildHudLayer();
  const needsUpdate = frameCount - hudLastUpdateFrame >= HUD_UPDATE_INTERVAL;
  if (needsUpdate) {
    hudLayer.clear();
    hudLayer.push();
    hudLayer.textFont('Courier New');
    hudLayer.textSize(16);
    // Right-aligned chips
    const rightX = windowWidth - 10;
    const topY = 14;
    drawHUDChipToLayer(hudLayer, 'Sim Point: ' + (simStart ? (frameCount - startFrame) : 0), rightX, topY, 'RIGHT');
    drawHUDChipToLayer(hudLayer, 'Object Alive: ' + objectArray.length, rightX, topY + 28, 'RIGHT');
    // Left instruction chip (always shown)
    drawHUDChipToLayer(hudLayer, 'O/F/S + click to spawn', 10, topY, 'LEFT');
    hudLayer.pop();
    hudLastUpdateFrame = frameCount;
  }
  image(hudLayer, 0, 0);
}

function drawHUDChipToLayer(layer, label, x, y, align) {
  layer.push();
  layer.textFont('Courier New');
  layer.textSize(16);
  const tW = layer.textWidth(label);
  const paddingX = 10;
  const rectW = tW + paddingX * 2;
  const rectH = 24;
  let rx = x;
  if (align === 'RIGHT') {
    rx = x - rectW;
    layer.textAlign(RIGHT, CENTER);
  } else {
    layer.textAlign(LEFT, CENTER);
  }
  layer.noStroke();
  layer.fill(255, 255, 255, 28);
  layer.rect(rx, y - rectH / 2, rectW, rectH, 12);
  if (align !== 'RIGHT') {
    layer.fill(statusColors.work[0], statusColors.work[1], statusColors.work[2], 160);
    layer.rect(rx, y - rectH / 2, 3, rectH, 12, 0, 0, 12);
  }
  layer.fill(255);
  layer.text(label, align === 'RIGHT' ? x - paddingX : rx + paddingX, y);
  layer.pop();
}

// Mouse focus and tooltip for nearest object
function drawMouseTooltip() {
  if (objectArray.length === 0) return;
  let nearest = null;
  let bestD2 = Infinity;
  for (const o of objectArray) {
    const dx = o.x - mouseX;
    const dy = o.y - mouseY;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; nearest = o; }
  }
  if (!nearest) return;
  const d = Math.sqrt(bestD2);
  if (d > 100) return; // show only when close

  // Highlight ring using status color
  const sCol = (nearest.status && statusColors[nearest.status]) || [255,255,255];
  noFill();
  stroke(sCol[0], sCol[1], sCol[2], 200);
  strokeWeight(2);
  circle(nearest.x, nearest.y, (nearest.size + 16));

  // Tooltip chip
  const label = `age ${nearest.age.toFixed(1)}  •  hunger ${nearest.hunger.toFixed(2)}`;
  push();
  textFont('Courier New');
  textSize(14);
  const tW = textWidth(label);
  const paddingX = 8;
  const rectW = tW + paddingX * 2;
  const rectH = 22;
  const tx = nearest.x + 14;
  const ty = nearest.y - (nearest.size + 18);
  noStroke();
  fill(0, 0, 0, 120);
  rect(tx, ty - rectH / 2, rectW, rectH, 8);
  fill(255);
  textAlign(LEFT, CENTER);
  text(label, tx + paddingX, ty);
  pop();
}

// Start button handler
function startSimulationFromControls() {
  if (simStart) return;
  simStart = true;
  const objN = objectSlider ? objectSlider.value() : initialObjectNum;
  const foodN = foodSlider ? foodSlider.value() : initialFoodNum;
  const siteN = siteSlider ? siteSlider.value() : initialSiteNum;

  // Seed foods/sites
  for (i = 0; i < foodN; i ++) {
    foodArray.push(new Foods(random(windowWidth), random(windowHeight), setMaxUtility));
  }
  for (i = 0; i < siteN; i ++) {
    siteArray.push(new Sites(random(windowWidth), random(windowHeight), setMaxUtility));
  }

  // Seed objects from edges
  objectArray = [];
  for (i = 0; i < Math.ceil(objN / 2); i ++) {
    initiateObject(random([0 - initialSize / 2, windowWidth + initialSize / 2]), random(windowHeight));
    initiateObject(random(windowWidth), random([0 - initialSize / 2, windowHeight + initialSize / 2]));
  }

  hideStartControls();
}

function hideStartControls() {
  if (startControlsContainer) { startControlsContainer.remove(); startControlsContainer = null; }
  if (startButton) { startButton.remove(); startButton = null; }
  if (siteSlider) siteSlider.remove();
  if (objectSlider) objectSlider.remove();
  if (foodSlider) foodSlider.remove();
  siteSlider = objectSlider = foodSlider = null;
}