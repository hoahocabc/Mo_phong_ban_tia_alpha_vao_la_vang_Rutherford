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
let isTouchMode = false; // Phân biệt chuột và ngón tay

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
    tooltipEl.style.lineHeight = "1.4";

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

    // Khóa tương tác 3D khi chạm vào Sidebar (Sử dụng pointer cho cả chuột và cảm ứng)
    sidebarEl.addEventListener('pointerenter', () => { isMouseOverSidebar = true; });
    sidebarEl.addEventListener('pointerleave', () => { isMouseOverSidebar = false; });

    // Quét tọa độ chuột / ngón tay liên tục
    window.addEventListener('mousemove', updateInputPos);
    window.addEventListener('touchmove', updateInputPos, {passive: true});
    window.addEventListener('touchstart', updateInputPos, {passive: true});

    camera(450, -300, 500, 0, 0, 0, 0, 1, 0); 
}

// Cập nhật tọa độ từ thiết bị tương tác
function updateInputPos(e) {
    if (e.touches && e.touches.length > 0) {
        globalMouseX = e.touches[0].clientX;
        globalMouseY = e.touches[0].clientY;
        isTouchMode = true; // Kích hoạt chế độ chạm
    } else {
        globalMouseX = e.clientX;
        globalMouseY = e.clientY;
        isTouchMode = false;
    }
}

// Mở / Đóng Menu trên Mobile
function openMenu() {
    sidebarEl.classList.add('open');
    overlay.classList.add('active');
}
function closeMenu() {
    sidebarEl.classList.remove('open');
    overlay.classList.remove('active');
}

function draw() {
    // Chỉ cho phép tương tác 3D khi Menu Mobile đang đóng và không trỏ vào Sidebar
    if (!isMouseOverSidebar && !sidebarEl.classList.contains('open')) {
        orbitControl(2, 2, 0.5); 
    }

    // ==========================================
    // BƯỚC 1: QUÉT CHUỘT / CHẠM BẰNG GPU
    // ==========================================
    let targetName = "";
    
    // Quét điểm khi nhấn chuột hoặc chạm tay
    if ((mouseIsPressed || touches.length > 0) && !isMouseOverSidebar && !sidebarEl.classList.contains('open')) {
        background(0); 
        noLights(); 
        
        drawFoil(true);   
        drawSource(true); 
        drawScreen(true); 
        
        let col = get(mouseX, mouseY);
        
        if (col[0] > 200) {
            targetName = "Lá vàng mỏng<br><span style='font-size:12px; font-weight:normal; color:#ccc;'>(Gold Foil)</span>";
        } else if (col[1] > 200) {
            targetName = "Nguồn phát tia Alpha<br><span style='font-size:12px; font-weight:normal; color:#ccc;'>(Alpha Particle Source)</span>";
        } else if (col[2] > 200) {
            targetName = "Màn huỳnh quang ZnS<br><span style='font-size:12px; font-weight:normal; color:#ccc;'>(Fluorescent Screen)</span>";
        }
    }

    if (targetName !== "") {
        tooltipEl.innerHTML = targetName;
        tooltipEl.style.display = 'block';
        
        // Tối ưu UX trên điện thoại: Đẩy Tooltip lên cao để không bị ngón tay che
        if (isTouchMode) {
            tooltipEl.style.left = (globalMouseX - tooltipEl.offsetWidth / 2) + 'px'; // Căn giữa ngón tay
            tooltipEl.style.top = (globalMouseY - 80) + 'px'; // Đẩy lên 80px so với điểm chạm
        } else {
            tooltipEl.style.left = (globalMouseX + 15) + 'px';
            tooltipEl.style.top = (globalMouseY + 15) + 'px';
        }
    } else {
        tooltipEl.style.display = 'none';
    }

    // ==========================================
    // BƯỚC 2: VẼ HIỂN THỊ THỰC TẾ
    // ==========================================
    background(0); 

    ambientLight(130, 130, 130); 
    directionalLight(190, 190, 190, 1, 1, -1); 
    directionalLight(110, 110, 120, -1, -0.5, 1); 
    directionalLight(90, 90, 90, 0, -1, 1); 

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
        let haloSize = 1.5 + ratio * 2.0; 
        fill(50, 200, 255, f.life * 0.5); 
        emissiveMaterial(0, 150, 255, f.life * 0.5); 
        sphere(haloSize); 

        let coreSize = 1 + ratio * 1.5; 
        fill(200, 240, 255, f.life); 
        emissiveMaterial(150, 220, 255, f.life); 
        sphere(coreSize); 
        
        pop();

        if (isPlaying) {
            f.life -= 35; 
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
        fill(255, 220, 0); 
        specularMaterial(140); 
        shininess(50); 
    }
    box(40, 40, 0.5); 
    pop();
}

function drawSource(isPicking) {
    push();
    translate(0, 0, sourceZ);
    noStroke();
    if (isPicking) {
        fill(0, 255, 0); 
        box(30, 30, 60);
        translate(0, 0, -31);
        cylinder(4, 2);
    } else {
        fill(130); 
        specularMaterial(70); 
        shininess(20); 
        box(30, 30, 60);
        
        translate(0, 0, -31);
        fill(0); 
        specularMaterial(0);
        cylinder(4, 2);
    }
    pop();
}

function drawFluorescentScreen() {
    drawScreen(false);
}

function drawScreen(isPicking) {
    push();
    noStroke();
    if (isPicking) {
        fill(0, 0, 255); 
    } else {
        fill(50, 180, 50, 100); 
        specularMaterial(100);  
        shininess(30);         
    }

    beginShape(TRIANGLE_STRIP);
    for (let theta = 0.3; theta <= TWO_PI - 0.3; theta += 0.1) {
        let x = sin(theta) * screenRadius;
        let z = cos(theta) * screenRadius;
        
        let nx = sin(theta);
        let nz = cos(theta);
        
        if (!isPicking) normal(nx, 0, nz);
        vertex(x, -50, z); 
        
        if (!isPicking) normal(nx, 0, nz);
        vertex(x, 50, z);  
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
        this.vel = createVector(0, 0, -8); 
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
        fill(255, 50, 50); 
        emissiveMaterial(255, 50, 50); 
        
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
        if (this.pos.y < -50 || this.pos.y > 50) return false;

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