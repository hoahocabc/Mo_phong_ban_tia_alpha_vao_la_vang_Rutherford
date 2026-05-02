const SCREEN_RADIUS = 180;
const SOURCE_Z = 250;
const FOIL_Z = 0;

let isPowerOn = false;
let isPaused = false; 
let particles = [];
let flashes = [];

let stats = { total: 0, straight: 0, scattered: 0 };
let uiPanel, btnPower, btnPause, btnReset, rateSlider, thicknessSlider;
let statTotal, statStraight, statScattered, rateVal, thicknessVal;
let percentStraight, percentScattered;
let mobileToggle, tooltipEl, closeSidebarBtn;
let canvasContainer;

// --- WEB AUDIO API ---
let audioCtx;
let lastShootTime = 0;
let lastHitTime = 0;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playShootSound() {
    if (!audioCtx) return;
    let osc = audioCtx.createOscillator();
    let gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.015, audioCtx.currentTime); 
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playHitSound() {
    if (!audioCtx) return;
    let osc = audioCtx.createOscillator();
    let gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

function setup() {
    canvasContainer = document.getElementById('canvas-container');
    let canvas = createCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight, WEBGL);
    canvas.parent('canvas-container');

    uiPanel = document.getElementById('sidebar');
    btnPower = document.getElementById('btn-power');
    btnPause = document.getElementById('btn-pause');
    btnReset = document.getElementById('btn-reset');
    rateSlider = document.getElementById('slider-rate');
    thicknessSlider = document.getElementById('slider-thickness');
    
    statTotal = document.getElementById('stat-total');
    statStraight = document.getElementById('stat-straight');
    statScattered = document.getElementById('stat-scattered');
    
    percentStraight = document.getElementById('percent-straight');
    percentScattered = document.getElementById('percent-scattered');

    rateVal = document.getElementById('rate-val');
    thicknessVal = document.getElementById('thickness-val');
    mobileToggle = document.getElementById('mobile-toggle');
    closeSidebarBtn = document.getElementById('close-sidebar');
    tooltipEl = document.getElementById('tooltip');

    btnPower.addEventListener('click', togglePower);
    btnPause.addEventListener('click', togglePause);
    btnReset.addEventListener('click', resetSimulation);
    
    rateSlider.addEventListener('input', () => rateVal.innerText = rateSlider.value);
    thicknessSlider.addEventListener('input', () => thicknessVal.innerText = thicknessSlider.value);

    mobileToggle.addEventListener('click', () => uiPanel.classList.add('open'));
    closeSidebarBtn.addEventListener('click', () => uiPanel.classList.remove('open'));

    camera(550, -350, 600, 0, 0, 0, 0, 1, 0);
}

function draw() {
    let isMouseInCanvas = mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
    
    if (isMouseInCanvas) {
        orbitControl(2, 2, 0.5);
    }

    let targetName = "";
    if (mouseIsPressed && isMouseInCanvas) {
        background(0);
        noLights(); 
        
        drawFoil(true);   
        drawSource(true); 
        drawScreen(true); 

        let col = get(mouseX, mouseY);
        
        if (col[0] > 200 && col[1] < 50 && col[2] < 50) {
            targetName = "Lá Vàng (Gold Foil)";
        } else if (col[1] > 200 && col[0] < 50 && col[2] < 50) {
            targetName = "Hộp Nguồn Phát Alpha";
        } else if (col[2] > 200 && col[0] < 50 && col[1] < 50) {
            targetName = "Màn Huỳnh Quang (ZnS)";
        }
    }

    if (targetName !== "") {
        tooltipEl.innerText = targetName;
        tooltipEl.style.display = 'block';
        
        let canvasRect = canvasContainer.getBoundingClientRect();
        tooltipEl.style.left = (mouseX + canvasRect.left) + 'px';
        tooltipEl.style.top = (mouseY + canvasRect.top) + 'px';
    } else if (!mouseIsPressed) {
        tooltipEl.style.display = 'none';
    }

    background(10, 12, 16);

    ambientLight(60);
    directionalLight(255, 255, 255, 1, 1, -1);
    directionalLight(150, 200, 255, -1, -1, 1);
    pointLight(255, 200, 100, 0, 0, 50);

    drawScreen(false);
    drawFoil(false);
    drawSource(false);

    if (isPowerOn && !isPaused) {
        let delayFrames = floor(map(rateSlider.value, 1, 10, 60, 5));
        
        if (frameCount % delayFrames === 0) {
            particles.push(new AlphaParticle(0, 0, SOURCE_Z - 35));
            stats.total++;
            updateStatsUI();
            
            if (millis() - lastShootTime > 80) {
                playShootSound();
                lastShootTime = millis();
            }
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        
        if (!isPaused) {
            p.update();
        }
        p.show();

        if (!isPaused) {
            if (p.checkScreenCollision()) {
                flashes.push({ pos: p.pos.copy(), life: 255 });
                if (p.hasScattered) stats.scattered++;
                else stats.straight++;
                updateStatsUI();
                
                if (millis() - lastHitTime > 50) {
                    playHitSound();
                    lastHitTime = millis();
                }
                
                particles.splice(i, 1);
            } else if (p.isOutOfBounds()) {
                particles.splice(i, 1);
            }
        }
    }

    drawFlashes();
}

function drawFoil(isPicking) {
    push();
    translate(0, 0, FOIL_Z);
    noStroke();
    
    let visualThickness = parseInt(thicknessSlider.value) * 0.6; 

    if (isPicking) {
        fill(255, 0, 0); 
    } else {
        fill(255, 215, 0);
        specularMaterial(255, 215, 0);
        shininess(100);
    }
    box(60, 60, visualThickness);
    pop();
}

function drawSource(isPicking) {
    push();
    translate(0, 0, SOURCE_Z);
    noStroke();
    if (isPicking) {
        fill(0, 255, 0); 
        box(50, 50, 70);
        translate(0, 0, -35);
        cylinder(8, 10);
    } else {
        fill(80, 85, 90);
        specularMaterial(50);
        shininess(20);
        box(50, 50, 70);
        
        translate(0, 0, -35);
        fill(20);
        cylinder(8, 10);
    }
    pop();
}

function drawScreen(isPicking) {
    push();
    noStroke();
    if (isPicking) {
        fill(0, 0, 255); 
    } else {
        fill(40, 200, 150, 60); 
        specularMaterial(255);  
        shininess(50);         
    }

    beginShape(TRIANGLE_STRIP);
    let startAngle = 0.15;
    let endAngle = TWO_PI - 0.15;
    
    for (let theta = startAngle; theta <= endAngle; theta += 0.05) {
        let x = sin(theta) * SCREEN_RADIUS;
        let z = cos(theta) * SCREEN_RADIUS;
        let nx = sin(theta);
        let nz = cos(theta);
        
        if (!isPicking) normal(-nx, 0, -nz);
        vertex(x, -70, z); 
        if (!isPicking) normal(-nx, 0, -nz);
        vertex(x, 70, z);  
    }
    endShape();
    pop();
}

function drawFlashes() {
    for (let i = flashes.length - 1; i >= 0; i--) {
        let f = flashes[i];
        push();
        translate(f.pos.x, f.pos.y, f.pos.z);
        noStroke();
        let alpha = f.life;
        fill(50, 255, 100, alpha * 0.3);
        emissiveMaterial(50, 255, 100);
        sphere(3.5);
        fill(200, 255, 200, alpha);
        sphere(1.5);
        pop();
        
        if (!isPaused) {
            f.life -= 40; 
            if (f.life <= 0) flashes.splice(i, 1);
        }
    }
}

class AlphaParticle {
    constructor(x, y, z) {
        this.pos = createVector(x, y, z);
        this.vel = createVector(0, 0, -8); 
        this.hasScattered = false;
    }

    update() {
        this.pos.add(this.vel);

        if (this.pos.z < 5 && this.pos.z > -5 && !this.hasScattered) {
            this.calculateScattering();
        }
    }

    calculateScattering() {
        this.hasScattered = true;
        let thickness = parseInt(thicknessSlider.value);
        let rand = random(100);
        
        if (rand < thickness * 1.2) {
            this.vel.z *= -random(0.2, 1.0); 
            this.vel.x = random(-6, 6);
            this.vel.y = random(-6, 6);
        } 
        else if (rand < thickness * 4) {
            this.vel.x = random(-4, 4);
            this.vel.y = random(-4, 4);
            this.vel.z = -sqrt(Math.abs(64 - this.vel.x**2 - this.vel.y**2));
        }
        else if (rand < thickness * 8) {
            this.vel.x = random(-1.5, 1.5);
            this.vel.y = random(-1.5, 1.5);
            this.vel.z = -sqrt(Math.abs(64 - this.vel.x**2 - this.vel.y**2));
        }

        this.vel.setMag(8);

        if (abs(this.vel.x) > 0.5 || abs(this.vel.y) > 0.5 || this.vel.z > 0) {
            this.isDeflected = true;
        } else {
            this.isDeflected = false;
            this.hasScattered = false; 
        }
    }

    show() {
        push();
        translate(this.pos.x, this.pos.y, this.pos.z);
        noStroke();
        fill(255, 100, 100);
        emissiveMaterial(255, 50, 50);
        sphere(2.5);
        pop();
    }

    checkScreenCollision() {
        if (this.pos.y < -70 || this.pos.y > 70) return false;
        let r_xz = sqrt(this.pos.x * this.pos.x + this.pos.z * this.pos.z);
        
        if (r_xz >= SCREEN_RADIUS) {
            let theta = atan2(this.pos.x, this.pos.z);
            if (theta < 0) theta += TWO_PI; 
            
            if (theta > 0.15 && theta < TWO_PI - 0.15) {
                this.pos.x = (this.pos.x / r_xz) * SCREEN_RADIUS;
                this.pos.z = (this.pos.z / r_xz) * SCREEN_RADIUS;
                return true; 
            }
        }
        return false;
    }

    isOutOfBounds() { return (this.pos.mag() > 500); }
}

function togglePower() {
    initAudio(); 
    
    isPowerOn = !isPowerOn;
    if (isPowerOn) {
        btnPower.innerText = 'Tắt Nguồn';
        btnPower.classList.add('active');
    } else {
        btnPower.innerText = 'Bật Nguồn';
        btnPower.classList.remove('active');
    }
}

function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        btnPause.innerText = 'Tiếp tục';
        btnPause.style.background = 'rgba(239, 68, 68, 0.2)'; 
        btnPause.style.border = '1px solid rgba(239, 68, 68, 0.5)';
    } else {
        btnPause.innerText = 'Tạm dừng';
        btnPause.style.background = 'rgba(255, 255, 255, 0.05)';
        btnPause.style.border = '1px solid rgba(255,255,255,0.1)';
    }
}

function resetSimulation() {
    stats = { total: 0, straight: 0, scattered: 0 };
    particles = [];
    flashes = [];
    updateStatsUI();
}

function updateStatsUI() {
    statTotal.innerText = stats.total;
    statStraight.innerText = stats.straight;
    statScattered.innerText = stats.scattered;

    if (stats.total > 0) {
        percentStraight.innerText = ((stats.straight / stats.total) * 100).toFixed(1) + '%';
        percentScattered.innerText = ((stats.scattered / stats.total) * 100).toFixed(1) + '%';
    } else {
        percentStraight.innerText = '0.0%';
        percentScattered.innerText = '0.0%';
    }
}

function windowResized() {
    resizeCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight);
}