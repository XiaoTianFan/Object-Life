class Sites {
    constructor(tempX, tempY, maxUtility, 
                 tempSize = 10) {
      this.x = tempX;
      this.y = tempY;
      this.size = tempSize; // Set the initial size
      this.type = 'site';
      this.utility = maxUtility * 2;
      this.status = null;
      this.workDone = 0;
      this.icon = '\u{1F3ED}';
    }
    
    // Display the object on canvas
    display() {
      // Halo via cached sprite
      let haloR = this.size * this.utility + 36;
      const haloSprite = getSiteHaloSprite(haloR);
      image(haloSprite, this.x - haloSprite.width / 2, this.y - haloSprite.height / 2);

      fill('#a49fd5');
      noStroke();
      circle(this.x, this.y, this.size * this.utility);
      
      textSize(this.size * this.utility);
      textAlign(CENTER, CENTER);
      push();
      drawingContext.shadowBlur = 10;
      drawingContext.shadowColor = 'rgba(0,0,0,0.35)';
      text(this.icon, this.x, this.y);
      pop();
    }
    
    siteReached() {
      this.workDone += 1;
    }
    
  }