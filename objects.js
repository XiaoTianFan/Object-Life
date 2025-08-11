class Objects {
    constructor(tempX, tempY, 
                 tempAge, 
                 tempSize, 
                 tempSpeed, 
                 tempHunger,
                 tempStatus,
                 tempMaxAge,
                 agingFactor, 
                 sizingFactor,
                 hungerFactor, 
                 entropyFactor, 
                 tempMaxBirth, 
                 tempWorkThreshold) {
      // Set the initial parameters
      this.x = tempX;
      this.y = tempY;
      this.age = tempAge; 
      this.size = tempSize; 
      this.speed = tempSpeed; 
      this.hunger = tempHunger; // 0 eaquals starving
      this.status = tempStatus; 
      
      // Set the factors for actions
      this.agingFactor = agingFactor;
      this.sizingFactor = sizingFactor;
      this.hungerFactor = hungerFactor;
      this.entropyFactor = entropyFactor;
      
      this.type = 'object'; // Type of instance
      this.destObject = null; // Target object to move towards
      this.destX = null; // X coordinate of the destination
      this.destY = null; // Y coordinate of the destination
      this.directionX = null; // X component of movement direction
      this.directionY = null; // Y component of movement direction
      this.maxAge = tempMaxAge; // Maximum age an object can reach
      this.maxBirth = tempMaxBirth; // Maximum number of births an object can have
      this.birthTime = 0; // Counter for births
      this.workThreshold = tempWorkThreshold; // Threshold to start working
      this.readyToWork = true; // Flag indicating if the object is ready to work
  
      this.positionHistory = []; // Array to store position history for path drawing

      // Visual motion state
      this.visualAngle = 0; // rotation aligned to velocity
      this.targetDirX = null; // eased direction targets
      this.targetDirY = null;
      this.breathPhase = random(TWO_PI); // per-object breathing offset
      this.scaleBreath = 1;
      this.prevX = this.x;
      this.prevY = this.y;
      
      // this.report(); // Output the initial state of the object
    }
    
    report() {
      // Log the current state of the object to the console
      console.log(
        'x:', this.x,
        'y:', this.y,
        'age:', this.age,
        'size:', this.size,
        'speed:', this.speed,
        'hunger:', this.hunger,
        'status:', this.status, 
        'destObject:', this.destObject,
      );
    }
    
    // Display the object on the canvas
    display() {
      // Draw the object's path if enabled and enough frames have passed
      if ((frameCount > 60) && (drawObjectPath === true)) {
        this.drawPath();
      }
      
      // Breathing scale (gentle)
      const lifeScale = 1 + 0.05 * sin(this.breathPhase + frameCount * 0.05);
      const baseSize = this.size + (this.age / 10) * this.hunger * this.sizingFactor;
      const renderSize = baseSize * lifeScale;

      // Status color and icon
      let col = [220, 220, 220];
      let iconCode = 0x1F4A4; // sleeping
      if (this.status === 'doodle') { col = statusColors.doodle; iconCode = 0x1F4A4; }
      else if (this.status === 'mate') { col = statusColors.mate; iconCode = 0x1F498; }
      else if (this.status === 'eat') { col = statusColors.eat; iconCode = 0x1F445; }
      else if (this.status === 'work') { col = statusColors.work; iconCode = 0x1F4AA; }
      const icon = String.fromCodePoint(iconCode);

      // Halo ring via cached sprite
      const haloSprite = getHaloSprite(this.status, renderSize + 6);
      image(haloSprite, this.x - haloSprite.width / 2, this.y - haloSprite.height / 2);

      // Core body with slight rotation aligned to velocity
      push();
      translate(this.x, this.y);
      rotate(this.visualAngle);
      noStroke();
      fill(255 - (this.age / this.maxAge) * 255);
      circle(0, 0, renderSize);
      // Icon via cached sprite
      const iconSprite = getIconSprite(this.status, renderSize);
      image(iconSprite, -iconSprite.width / 2, -iconSprite.height / 2);
      pop();
      
    }
    
    drawPath() {
      if (!drawObjectPath) return;
      // Draw on trailsLayer for persistence and performance
      const g = trailsLayer;
      const statusCol = (this.status && statusColors[this.status]) || [180, 200, 200];
      g.push();
      g.stroke(statusCol[0], statusCol[1], statusCol[2], 140);
      // width by speed
      const speedMag = Math.hypot(this.x - this.prevX, this.y - this.prevY);
      g.strokeWeight(1.8 + Math.min(3.5, speedMag * 0.25));
      g.noFill();
      // Draw simple segment from previous to current position
      g.line(this.prevX, this.prevY, this.x, this.y);
      // Soft overdraw for subtle glow
      g.stroke(statusCol[0], statusCol[1], statusCol[2], 60);
      g.strokeWeight( (1.2 + Math.min(2.5, speedMag * 0.15)) );
      g.line(this.prevX, this.prevY, this.x, this.y);
      g.pop();
    }
    
    doodle() {
      // Handle boucing for movement
      // Store previous position for trails
      this.prevX = this.x;
      this.prevY = this.y;
      if (this.directionX) {
        // Reverse direction if hitting canvas boundaries
        if (this.x > windowWidth - this.size / 2) {
          this.directionX = -this.directionX;
        } else if (this.x < 0 + this.size / 2) {
          this.directionX = -this.directionX;
        } else if (this.y > windowHeight - this.size / 2) {
          this.directionY = -this.directionY;
        } else if (this.y < 0 + this.size / 2) {
          this.directionY = -this.directionY;
        }
  
        // Maintain separation distance from other objects
        let separationDistance = this.size * 1.5; // Desired separation distance
        let separationDistanceSq = separationDistance * separationDistance;
        let separationForceX = 0; // Initialize separation force in X direction
        let separationForceY = 0; // Initialize separation force in Y direction

        // Check for collisions with other objects only (avoid scanning foods/sites here)
        for (let other of objectArray) {
          // Skip if it's the same object or the target object or the object is mating
          if (other === this || other === this.destObject || other.status === 'mate') continue;

          // Calculate squared distance to the other object
          let diffX = this.x - other.x; // X difference
          let diffY = this.y - other.y; // Y difference
          let distToOtherSq = diffX * diffX + diffY * diffY;

          // If the distance is less than the desired separation distance, calculate a separation force
          if (distToOtherSq < separationDistanceSq) {
            let distToOther = Math.sqrt(distToOtherSq);
            if (distToOther > 0) {
              separationForceX += (diffX / distToOther) * (separationDistance - distToOther);
              separationForceY += (diffY / distToOther) * (separationDistance - distToOther);
            }

            // Sliding behavior
            let slideX = -diffY; // Perpendicular to the normal
            let slideY = diffX;

            // Normalize sliding direction
            let slideDistance = Math.sqrt(slideX * slideX + slideY * slideY);
            if (slideDistance > 0) {
              slideX /= slideDistance; // Normalize X
              slideY /= slideDistance; // Normalize Y
            }

            // Apply sliding movement
            this.x += slideX * this.speed * 0.2; // Adjust slide factor as needed
            this.y += slideY * this.speed * 0.2; // Adjust slide factor as needed
          }
        }
  
        // Apply the separation force to the position
        this.x += separationForceX;
        this.y += separationForceY;
  
        // Update position based on direction and speed
        this.x += this.directionX * this.speed;
        this.y += this.directionY * this.speed;
          
      } else {
        // Random movement if no direction is set
        this.x += random(-this.entropyFactor, this.entropyFactor);
        this.y += random(-this.entropyFactor, this.entropyFactor);
      }
      
      if (frameCount % 5 === 0) {
        // After updating the position
        this.positionHistory.push({ x: this.x, y: this.y });
  
        // Maintain the history size
        if (this.positionHistory.length > pathHistoryLimit) {
          this.positionHistory.shift(); // Remove the oldest position
        }
      }
    }
    
    find(arrayToFind) {
      // Spatial grid accelerated nearest search
      if (!spatialGrid) {
        this.findLinear(arrayToFind);
        return;
      }
      const cx = Math.floor(this.x / gridCellSize);
      const cy = Math.floor(this.y / gridCellSize);
      let minDistanceSq = Infinity;
      let nearest = null;
      // search in 3x3 neighborhood
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = spatialGrid.get(`${gx},${gy}`);
          if (!bucket) continue;
          const list = arrayToFind === objectArray ? bucket.objects : (arrayToFind === foodArray ? bucket.foods : bucket.sites);
          if (!list) continue;
          for (let item of list) {
            if (item === this) continue;
            const dx = item.x - this.x;
            const dy = item.y - this.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < minDistanceSq) { minDistanceSq = d2; nearest = item; }
          }
        }
      }
      if (!nearest) {
        // fallback to linear if grid is sparse
        this.findLinear(arrayToFind);
      } else {
        this.destObject = nearest;
      }
    }

    findLinear(arrayToFind) {
      let minDistanceSq = Infinity;
      for (let item of arrayToFind) {
        if (item === this) continue;
        const dx = item.x - this.x;
        const dy = item.y - this.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minDistanceSq) { minDistanceSq = d2; this.destObject = item; }
      }
    }
    
    move(arrayToFind) {
      this.find(arrayToFind); // Find the target object
      
      // Setup destination coordinates from the target object
      this.destX = this.destObject.x;
      this.destY = this.destObject.y;
  
      // Calculate the distance to the destination
      let dx = this.destX - this.x;
      let dy = this.destY - this.y;
      let distanceSq = dx * dx + dy * dy;
      let distance = Math.sqrt(distanceSq);
      
      // Normalize and ease direction vector toward target direction
      if (distance > 0) {
          this.targetDirX = dx / distance;
          this.targetDirY = dy / distance;
      } else {
          this.targetDirX = 0;
          this.targetDirY = 0;
      }
      if (this.directionX === null || this.directionY === null) {
        this.directionX = this.targetDirX;
        this.directionY = this.targetDirY;
      } else {
        const ease = 0.15; // easing factor
        this.directionX = lerp(this.directionX, this.targetDirX, ease);
        this.directionY = lerp(this.directionY, this.targetDirY, ease);
        // Normalize after easing to keep unit vector
        const mag = Math.hypot(this.directionX, this.directionY);
        if (mag > 0) {
          this.directionX /= mag;
          this.directionY /= mag;
        }
      }
  
      // Calculate the next position
      let nextX = this.x + this.directionX * this.speed;
      let nextY = this.y + this.directionY * this.speed;
      
      // Check for collision with the destination object
      if (this.destObject) {
        let targetCombinedRadius = (this.size + this.destObject.size) / 2; // Adjust based on size
        let dxT = nextX - this.destObject.x;
        let dyT = nextY - this.destObject.y;
        let distToTargetSq = dxT * dxT + dyT * dyT;

        // If colliding with the target object, invoke reach
        if (distToTargetSq < targetCombinedRadius * targetCombinedRadius) {
          let distToTarget = Math.sqrt(distToTargetSq);
          this.reach(); // Call reach() if colliding with the target
              
          // Slide away from the target
          let targetNormalX = (this.x - this.destObject.x) / distToTarget; // Normal vector
          let targetNormalY = (this.y - this.destObject.y) / distToTarget;
  
          // Calculate the sliding direction (perpendicular to the normal)
          let targetSlideX = -targetNormalY; // Rotate normal to find tangential direction
          let targetSlideY = targetNormalX;
  
          // Introduce a small random adjustment to sliding direction
          let targetRandomAdjustment = random(-0.1, 0.1); // Adjust as needed
          targetSlideX += targetRandomAdjustment;
          targetSlideY += targetRandomAdjustment;
  
          // Normalize the sliding direction
          let targetSlideDistance = Math.sqrt(targetSlideX * targetSlideX + targetSlideY * targetSlideY);
          if (targetSlideDistance > 0) {
              targetSlideX /= targetSlideDistance;
              targetSlideY /= targetSlideDistance;
          }
  
          // Move along the sliding direction away from the target
          this.x += targetSlideX * this.speed * 0.3; // Slide from the target
          this.y += targetSlideY * this.speed * 0.3;
  
          return; // Stop further movement after reaching
        }
      }
      
      // Maintain separation distance from other objects
      let separationDistance = this.size * 1.25; // Desired separation distance
      let separationDistanceSq = separationDistance * separationDistance;
      let separationForceX = 0;
      let separationForceY = 0;
  
      for (let other of objectArray) {
        // Skip if it's the same object or the target object
        if (other === this || other === this.destObject || other.status === 'mate') continue;
  
        // Calculate distance to the other object
        let diffX = nextX - other.x;
        let diffY = nextY - other.y;
        let distToOtherSq = diffX * diffX + diffY * diffY;
  
        // If the distance is less than the desired separation distance, calculate a separation force
        if (distToOtherSq < separationDistanceSq) {
          let distToOther = Math.sqrt(distToOtherSq);
          
          // Normalize the difference vector
          if (distToOther > 0) {
              separationForceX += (diffX / distToOther) * (separationDistance - distToOther);
              separationForceY += (diffY / distToOther) * (separationDistance - distToOther);
          }
  
          // Sliding behavior
          let slideFactor = 0.3; // Adjust as needed for sliding strength
          let slideX = -diffY; // Perpendicular to the normal
          let slideY = diffX;
  
          // Normalize sliding direction
          let slideDistance = Math.sqrt(slideX * slideX + slideY * slideY);
          if (slideDistance > 0) {
              slideX /= slideDistance;
              slideY /= slideDistance;
          }
  
          // Apply sliding movement
          nextX += slideX * this.speed * slideFactor;
          nextY += slideY * this.speed * slideFactor;
        }
      }
  
      // Apply the separation force to the next position
      nextX += separationForceX;
      nextY += separationForceY;
  
      // Store previous position for trails
      this.prevX = this.x;
      this.prevY = this.y;
      this.x = nextX;
      this.y = nextY;
      // Update render angle to align with velocity
      this.visualAngle = Math.atan2(this.directionY, this.directionX);
      
      if (frameCount % 10 === 0) {
        // After updating the position
        this.positionHistory.push({ x: this.x, y: this.y });
  
        // Maintain the history size
        if (this.positionHistory.length > pathHistoryLimit) {
          this.positionHistory.shift(); // Remove the oldest position
        }
      }
      
    }
    
    
    statusUpdate() {
      // Update the object's status based on hunger and age
      if ((this.hunger >= 1.2) && (this.birthTime < this.maxBirth)) {
        this.status = 'mate';
      } else if ((this.hunger > 0.5) && (this.hunger <= 1.2)) {
        let foodObjectRatio = foodArray.length / objectArray.length;
        if ((foodObjectRatio <= this.workThreshold) && (this.readyToWork === true)) {
          this.status = 'work'; 
        } else { 
          this.status = 'doodle'; 
        }
      } else if ((this.hunger > 0) && (this.hunger <= 0.5)) {
        if (foodArray[0]) {
          this.status = 'eat'; 
        } else {
          this.readyToWork = true;
          this.status = 'work'; 
        }
      } else if (this.hunger <= 0) {
        this.status = 'dead';
      } else if (this.age >= this.maxAge) {
        this.status = 'dead';
      }
    }
    
    reach() {
      // Handle reaching a target object
      let reachedType = this.destObject.type; // Type of the object reached
      let reachedUtility = this.destObject.utility; // Utility value of the object reached
      
      if (reachedType === 'food') {
        this.destObject.status = 'reached';
        this.hunger += reachedUtility; // Increase hunger based on food utility
        this.readyToWork = true; // Set ready to work after eating
        // Inward sparkles at current position
        spawnSparkles(this.x, this.y, 10, color(134,239,172), -1);
      } else if (reachedType === 'object') {
        // Confetti burst before birthing
        spawnConfetti(this.x, this.y, 16, color(244,114,182));
        this.birthing(); 
        this.readyToWork = true; 
      } else if (reachedType === 'site') {
        this.destObject.siteReached();
        // Small pulse when reaching site
        spawnRingPulse(this.x, this.y, this.size * 2 + 20, color(251,191,36), 20);
        this.readyToWork = false;
      }
      
      this.status = 'doodle'; // Reset status to doodle after reaching
      
    }
    
    aging() {
      // Update the object's age based on current status
      if (this.status === 'mate') { // Too full results in over-aging
        this.age += 1.2 * this.agingFactor;
      } else if (this.status === 'doodle') { 
        this.age += 1 * this.agingFactor;
      } else if (this.status === 'eat') { // Hunger results in slow aging
        this.age += 0.7 * this.agingFactor;
      } else if (this.status === 'work') { 
        this.age += 1.5 * this.agingFactor;
      }
    }
    
    hungering() {
      this.hunger -= 0.1 * this.hungerFactor; // Gradually decrease the hunger level
    }
    
    birthing() {
      if (this.birthTime < this.maxBirth) {
        // Calculate child size
        let birthSize = this.size + this.age / 10 * this.hunger * this.sizingFactor / 3;
        this.birthTime += 1; 
        // Spawn new object instance
        objectArray.push(new Objects(this.x + random(-this.entropyFactor, this.entropyFactor), 
                                     this.y + random(-this.entropyFactor, this.entropyFactor), 
                                     tempAge = initialAge,
                                     tempSize = birthSize,
                                     tempSpeed = initialSpeed, 
                                     tempHunger = this.hunger,
                                     tempStatus = initialStatus,
                                     tempMaxAge = setMaxAge,
                                     agingFactor = setAgingFactor, 
                                     sizingFactor = setSizingFactor, 
                                     hungerFactor = setHungerFactor, 
                                     entropyFactor = setEntropyFactor));
        this.hunger = this.hunger / 3; // Cost of giving birth
      } else {
        this.status = 'doodle';
      }
    }
    
    directing() {
      if (this.directionX === null) {
        // Randomize direction vector if has no target
        this.directionX = random(-this.entropyFactor, this.entropyFactor);
        this.directionY = random(-this.entropyFactor, this.entropyFactor);
      }
    }
  
  }