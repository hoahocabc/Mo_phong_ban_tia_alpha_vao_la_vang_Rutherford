// Các biến toàn cục
let isPlaying = true;
let isPowerOn = false; 
let isMouseOverSidebar = false; 
let particles = [];
let flashes = []; 
let screenRadius = 150; 
let sourceZ = 220; 

let particleAccumulator = 0;

// Biến lưu tọa độ và trạng thái chạm
let globalMouseX = 0;
let globalMouseY = 0;
let isTouchMode = false;

// DOM Elements
let sliderRate, btnToggle, btnPower, tooltipEl;
let sidebarEl, mobileMenuBtn, overlay, closeSidebarBtn;

function setup() {
    let container = document.getElementById('canvas-container');
    let canvas = createCanvas(container.clientWidth, container.clientHeight, WEBGL);
    canvas.parent('canvas-container');

    sliderRate = select('#slider-rate');
    btnToggle = select('#btn-toggle');
    btnPower = select('#btn-power');
    tooltipEl = document.getElementById('tooltip');

    tooltipEl.style.textAlign = "center";
    tooltipEl.style.lineHeight = "1.5";

    btnToggle.mousePressed(toggleSimulation);
    btnPower.mousePressed(togglePower);
    
    // Quản lý Mobile Menu
    sidebarEl = document.getElementById('sidebar');
    mobileMenuBtn = document.getElementById('mobile-menu-btn');
    overlay = document.getElementById('overlay');
    closeSidebarBtn = document.getElementById('close-sidebar-btn');

    mobileMenuBtn.addEventListener('click', openMenu);
    closeSidebarBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);

    sidebarEl.addEventListener('pointerenter', () => { isMouseOverSidebar = true; });
    sidebarEl.addEventListener('pointerleave', () => { isMouseOverSidebar = false; });

    window.addEventListener('mousemove', updateInputPos);
    window.addEventListener('touchmove', updateInputPos, {passive: true});
    window.addEventListener('touchstart', updateInputPos, {passive: true});

    camera(450, -300, 500, 0, 0, 0, 0, 1, 0); 
}

function updateInputPos(e) {
    if (e.touches && e.touches.length > 0) {
        globalMouseX = e.touches[0].clientX;
        globalMouseY = e.touches[0].clientY;
        isTouchMode = true; 
    } else {
        globalMouseX = e.clientX;
        globalMouseY = e.clientY;
        isTouchMode = false;
    }
}

function openMenu() {
    sidebarEl.classList.add('open');
    overlay.classList.add('active');
}
function closeMenu() {
    sidebarEl.classList.remove('open');
    overlay.classList.remove('active');
}

// Hàm chặn trình duyệt cuộn trang để ưu tiên Zoom 3D
function mouseWheel(event) {
    if (!isMouseOverSidebar && !sidebarEl.classList.contains('open')) {
        return false; // Chặn mặc định trình duyệt
    }
}

function draw() {
    if (!isMouseOverSidebar && !sidebarEl.classList.contains('open')) {
        // Tăng thông số thứ 3 (zoom sensitivity) lên 1 để zoom mượt và dễ dàng hơn
        orbitControl(2, 2, 1); 
    }

    // ==========================================
    // BƯỚC 1: QUÉT CHUỘT / CHẠM BẰNG GPU
    // ==========================================
    let targetName = "";
    
    if ((mouseIsPressed || touches.length > 0) && !isMouseOverSidebar && !sidebarEl.classList.contains('open')) {
        background(0); 
        noLights(); 
        
        drawFoil(true);   
        drawSource(true); 
        drawScreen(true); 
        
        let col = get(mouseX, mouseY);
        
        if (col[0] > 200) {
            targetName = "Lá Vàng<br><span style='font-size:12px; font-weight:normal; color:#94a3b8;'>(Gold Foil)</span>";
        } else if (col[1] > 200) {
            targetName = "Nguồn Alpha<br><span style='font-size:12px; font-weight:normal; color:#94a3b8;'>(Alpha Source)</span>";
        } else if (col[2] > 200) {
            targetName = "Màn Huỳnh Quang<br><span style='font-size:12px; font-weight:normal; color:#94a3b8;'>(ZnS Screen)</span>";
        }
    }

    if (targetName !== "") {
        tooltipEl.innerHTML = targetName;
        tooltipEl.style.display = 'block';
        tooltipEl.style.opacity = '1';
        
        if (isTouchMode) {
            tooltipEl.style.left = (globalMouseX - tooltipEl.offsetWidth / 2) + 'px'; 
            tooltipEl.style.top = (globalMouseY - 90) + 'px'; 
        } else {
            tooltipEl.style.left = (globalMouseX + 15) + 'px';
            tooltipEl.style.top = (globalMouseY + 15) + 'px';
        }
    } else {
        tooltipEl.style.opacity = '0';
        setTimeout(() => { if(tooltipEl.style.opacity === '0') tooltipEl.style.display = 'none'; }, 200);
    }

    // ==========================================
    // BƯỚC 2: VẼ HIỂN THỊ THỰC TẾ
    // ==========================================
    background(0); 

    ambientLight(150, 150, 150); 
    directionalLight(255, 255, 255, 1, 1, -1); 
    directionalLight(200, 200, 200, -1, -1, 1); 
    directionalLight(120, 120, 120, 0, 1, 1); 

    drawScreen(false);
    drawFoil(false);
    drawSource(false);

    if (isPlaying && isPowerOn) {
        let val = parseInt(sliderRate.value());
        if (val > 0) {
            let step = val / 30; 
            particleAccumulator += step;
            
            let emitCount = Math.floor(particleAccumulator);
            particleAccumulator -= emitCount;
            
            for (let j = 0; j < emitCount; j++) {
                let zOffset = sourceZ - 30 - (j * (8 / emitCount));
                particles.push(new AlphaParticle(0, 0, zOffset));
            }
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        if (isPlaying) p.update();
        p.checkScattering();

        if (p.checkScreenCollision()) {
            flashes.push({ pos: createVector(p.pos.x, p.pos.y, p.pos.z), life: 255 });
            particles.splice(i, 1); 
        } else if (p.isOutOfBounds()) {
            particles.splice(i, 1); 
        } else {
            p.show(); 
        }
    }

    for (let i = flashes.length - 1; i >= 0; i--) {
        let f = flashes[i];
        push();
        translate(f.pos.x, f.pos.y, f.pos.z);
        noStroke();
        
        specularMaterial(0); 
        shininess(0);
        
        let ratio = f.life / 255; 
        
        let haloSize = 2.0 + ratio * 3.0; 
        fill(20, 255, 80, f.life * 0.4); 
        emissiveMaterial(20, 255, 80, f.life * 0.4); 
        sphere(haloSize); 

        let coreSize = 1.0 + ratio * 1.5; 
        fill(200, 255, 200, f.life); 
        emissiveMaterial(150, 255, 150, f.life); 
        sphere(coreSize); 
        
        pop();

        if (isPlaying) {
            f.life -= 30; 
            if (f.life <= 0) flashes.splice(i, 1); 
        }
    }
}

// --- CÁC HÀM VẼ KHỐI ---

function drawFoil(isPicking) {
    push();
    noStroke();
    if (isPicking) {
        fill(255, 0, 0); 
    } else {
        fill(255, 215, 0); 
        specularMaterial(255); 
        shininess(100); 
    }
    box(45, 45, 0.2); 
    pop();
}

function drawSource(isPicking) {
    push();
    translate(0, 0, sourceZ);
    noStroke();
    if (isPicking) {
        fill(0, 255, 0); 
        box(40, 40, 60);
        translate(0, 0, -31);
        cylinder(5, 2);
    } else {
        fill(120, 120, 130); 
        specularMaterial(50); 
        shininess(20); 
        box(40, 40, 60);
        
        translate(0, 0, -31);
        fill(10); 
        specularMaterial(0);
        cylinder(5, 2);
    }
    pop();
}

function drawScreen(isPicking) {
    push();
    noStroke();
    if (isPicking) {
        fill(0, 0, 255); 
    } else {
        fill(40, 160, 100, 100); 
        specularMaterial(255);  
        shininess(100);         
    }

    beginShape(TRIANGLE_STRIP);
    for (let theta = 0.3; theta <= TWO_PI - 0.3; theta += 0.1) {
        let x = sin(theta) * screenRadius;
        let z = cos(theta) * screenRadius;
        
        let nx = sin(theta);
        let nz = cos(theta);
        
        if (!isPicking) normal(nx, 0, nz);
        vertex(x, -55, z); 
        
        if (!isPicking) normal(nx, 0, nz);
        vertex(x, 55, z);  
    }
    endShape();
    pop();
}

// --- CÁC HÀM ĐIỀU KHIỂN ---

function togglePower() {
    isPowerOn = !isPowerOn;
    if (isPowerOn) {
        btnPower.html('Tắt nguồn phát');
        btnPower.removeClass('btn-power-off').addClass('btn-power-on');
    } else {
        btnPower.html('Bật nguồn phát');
        btnPower.removeClass('btn-power-on').addClass('btn-power-off');
    }
}

function toggleSimulation() {
    isPlaying = !isPlaying;
    if (isPlaying) {
        btnToggle.html('Tạm dừng');
        btnToggle.removeClass('btn-play').addClass('btn-pause');
    } else {
        btnToggle.html('Phát tiếp');
        btnToggle.removeClass('btn-pause').addClass('btn-play');
    }
}

function windowResized() {
    let container = document.getElementById('canvas-container');
    resizeCanvas(container.clientWidth, container.clientHeight);
}

class AlphaParticle {
    constructor(x, y, z) {
        this.pos = createVector(x, y, z);
        this.vel = createVector(0, 0, -9); 
        this.hasScattered = false;
    }

    update() {
        this.pos.add(this.vel);
    }

    show() {
        push();
        translate(this.pos.x, this.pos.y, this.pos.z);
        noStroke();
        
        specularMaterial(0); 
        shininess(0);        
        fill(255, 0, 0); 
        emissiveMaterial(255, 0, 0); 
        
        sphere(2.5);
        pop();
    }

    checkScattering() {
        if (this.pos.z <= 4 && this.pos.z >= -4 && !this.hasScattered) {
            this.hasScattered = true;
            let r = random(1);
            if (r < 0.02) {
                this.vel.z *= -random(0.3, 0.8);
                this.vel.x = random(-6, 6);
                this.vel.y = random(-6, 6);
            } else if (r < 0.12) {
                this.vel.x = random(-3, 3);
                this.vel.y = random(-3, 3);
            }
        }
    }

    checkScreenCollision() {
        if (this.pos.y < -55 || this.pos.y > 55) return false;

        let r_xz = sqrt(this.pos.x * this.pos.x + this.pos.z * this.pos.z);
        if (r_xz >= screenRadius) {
            let theta = atan2(this.pos.x, this.pos.z);
            if (theta < 0) theta += TWO_PI; 
            
            if (theta > 0.3 && theta < TWO_PI - 0.3) {
                let exactSurface = screenRadius - 1; 
                this.pos.x = (this.pos.x / r_xz) * exactSurface;
                this.pos.z = (this.pos.z / r_xz) * exactSurface;
                return true; 
            }
        }
        return false;
    }

    isOutOfBounds() {
        return (this.pos.mag() > 400);
    }
}