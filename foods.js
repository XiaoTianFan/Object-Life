let foodIcon = ['\u{1F35E}', '\u{1F950}', '\u{1F956}', '\u{1FAD3}', '\u{1F968}', '\u{1F96F}', '\u{1F95E}', '\u{1F9C7}', '\u{1F9C0}', '\u{1F356}', '\u{1F357}', '\u{1F969}', '\u{1F953}', '\u{1F354}', '\u{1F35F}', '\u{1F355}', '\u{1F32D}', '\u{1F96A}', '\u{1F32E}', '\u{1F32F}']

class Foods {
  constructor(tempX, tempY, maxUtility, 
               tempSize = 10) {
    this.x = tempX;
    this.y = tempY;
    this.size = tempSize; // Set the initial size
    this.type = 'food';
    this.utility = random(0.5, maxUtility)
    this.status = null;
    this.icon = random(foodIcon)
  }
  
  // Display the object on canvas
  display() {
    // Soft halo via cached sprite
    let haloR = this.size * this.utility + 28;
    const haloSprite = getFoodHaloSprite(haloR);
    image(haloSprite, this.x - haloSprite.width / 2, this.y - haloSprite.height / 2);

    // Base chip
    fill('#ffd7a0');
    noStroke();
    circle(this.x, this.y, this.size * this.utility + 10);

    // Emoji/icon
    textSize(this.size * this.utility);
    textAlign(CENTER, CENTER);
    // Drop shadow for legibility
    push();
    drawingContext.shadowBlur = 8;
    drawingContext.shadowColor = 'rgba(0,0,0,0.35)';
    text(this.icon, this.x, this.y);
    pop();
  }
  
}