const tg = window.Telegram.WebApp;
tg.expand();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

const uiLayer = document.getElementById('ui-layer');
const mainMenu = document.getElementById('main-menu');
const gameOverScreen = document.getElementById('game-over-screen');
const endTitle = document.getElementById('end-title');
const endDesc = document.getElementById('end-desc');

const uiTimingContainer = document.getElementById('timing-container');
const uiCursor = document.getElementById('timing-cursor');
const uiTargetGreen = document.getElementById('timing-target-green');
const uiTargetYellowLeft = document.getElementById('timing-target-yellow-left');
const uiTargetYellowRight = document.getElementById('timing-target-yellow-right');
const uiTimer = document.getElementById('timer');
const uiMessage = document.getElementById('message');
const uiLivesCount = document.getElementById('lives-count');
const uiRespectScore = document.getElementById('respect-score');
const uiJuggling = document.getElementById('juggling-ui');
const btnShoot = document.getElementById('btn-shoot');
const shotMenu = document.getElementById('shot-menu');
const powerContainer = document.getElementById('power-container');
const powerCursor = document.getElementById('power-cursor');

const modalRules = document.getElementById('modal-rules');
const modalRecords = document.getElementById('modal-records');
const recRespect = document.getElementById('rec-respect');
const recTime = document.getElementById('rec-time');
const kozelSpans = [
    document.getElementById('k-0'),
    document.getElementById('k-1'),
    document.getElementById('k-2'),
    document.getElementById('k-3'),
    document.getElementById('k-4')
];

const assets = {
    bg: { img: new Image(), ready: false },
    goals: { img: new Image(), ready: false },
    gk: { img: new Image(), ready: false },
    ball: { img: new Image(), ready: false },
    feet: { img: new Image(), ready: false }
};

Object.keys(assets).forEach(key => {
    assets[key].img.onload = () => { assets[key].ready = true; };
    assets[key].img.src = 'assets/' + key + '.png';
});

// Пропорции вратаря
const gkWidth = 70;
const gkHeight = 82;
let gkX = 0;
let gkAnimStartX = 0;
let gkAnimEndX = 0;
let gkVelocityX = 0;

let groundLevel = 0;
const ceilingLevel = 90;
let goalBounds = { x: 0, y: 0, width: 0, height: 0, bottomY: 0 };

// ПЕРЕМЕННЫЕ ПРОЦЕДУРНОЙ АНИМАЦИИ
let screenShake = 0;
let particles = [];
let footKickLeft = 0;
let footKickRight = 0;

function addScreenShake(amount) {
    screenShake = Math.max(screenShake, amount);
}

function spawnDust(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 16,
            y: y + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 2.5 - 0.5,
            size: Math.random() > 0.5 ? 3 : 2,
            alpha: 1.0,
            life: 0.35 + Math.random() * 0.25
        });
    }
}

function updateScreenMetrics() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false;

    groundLevel = canvas.height - 220;

    const goalWidth = Math.max(200, Math.min(canvas.width * 0.55, 280));
    const goalHeight = 105;
    const goalBottomY = canvas.height * 0.48;
    goalBounds = {
        x: (canvas.width - goalWidth) / 2,
        y: goalBottomY - goalHeight,
        width: goalWidth,
        height: goalHeight,
        bottomY: goalBottomY
    };

    gkX = goalBounds.x + (goalBounds.width - gkWidth) * 0.5;
}

function getGoalInnerBounds() {
    const insetX = 16;
    const insetTop = 14;
    const insetBottom = 10;
    return {
        minX: goalBounds.x + insetX,
        maxX: goalBounds.x + goalBounds.width - insetX,
        minY: goalBounds.y + insetTop,
        maxY: goalBounds.bottomY - insetBottom
    };
}

window.addEventListener('resize', updateScreenMetrics);
updateScreenMetrics();

let lives = 3;
let respect = 0;
let jugglingCount = 0; 
let kozelLetters = 0; 
let gameStartTime = 0;
let gameState = 'MENU'; 
let roundTimerId = null;

// Мяч с поддержкой вращения и squash & stretch
let ball = { 
    x: 0, 
    y: 0, 
    size: 20, 
    vx: 0, 
    vy: 0, 
    sizeSpeed: 0, 
    ay: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1
};

let targetGoalX = 0, targetGoalY = 0;
let selectedShotCost = 1;
let powerCursorPos = 0, powerDirection = 1, selectedPower = 50; 
let animStartX = 0, animStartY = 0, animEndX = 0, animEndY = 0, animProgress = 0;
let shotOutcome = 'GOAL'; 

let cursor = { pos: 0, speed: 1.2, direction: 1 };
const targetZone = { pos: 50, greenWidth: 8, yellowWidth: 16 };
let timeLeft = 10.0;
let lastFrameTime = performance.now();

uiTargetGreen.style.left = targetZone.pos + "%";
uiTargetGreen.style.width = targetZone.greenWidth + "%";
uiTargetGreen.style.transform = "translateX(-50%)";
uiTargetYellowLeft.style.left = (targetZone.pos - (targetZone.greenWidth / 2) - targetZone.yellowWidth) + "%";
uiTargetYellowLeft.style.width = targetZone.yellowWidth + "%";
uiTargetYellowRight.style.left = (targetZone.pos + (targetZone.greenWidth / 2)) + "%";
uiTargetYellowRight.style.width = targetZone.yellowWidth + "%";

function clearRoundTimer() {
    if (roundTimerId !== null) {
        clearTimeout(roundTimerId);
        roundTimerId = null;
    }
}

function initMenu() {
    clearRoundTimer();
    gameState = 'MENU';
    uiLayer.style.display = 'none';
    gameOverScreen.style.display = 'none';
    mainMenu.style.display = 'flex';
}

function startNewGame() {
    clearRoundTimer();
    mainMenu.style.display = 'none';
    gameOverScreen.style.display = 'none';
    uiLayer.style.display = 'flex';
    lives = 3;
    respect = 0;
    kozelLetters = 0;
    gameStartTime = performance.now();
    updateUI();
    startReception();
}

function updateUI() {
    uiRespectScore.innerText = respect;
    uiLivesCount.innerText = "❤️".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 3 - lives));
    for (let i = 0; i < 5; i++) {
        if (i < kozelLetters) kozelSpans[i].classList.add('active');
        else kozelSpans[i].classList.remove('active');
    }
}

function saveRecord(newRespect, timeTaken) {
    let bestRespect = Number(localStorage.getItem('kozel_respect')) || 0;
    let bestTime = Number(localStorage.getItem('kozel_time')) || 9999;
    if (newRespect > bestRespect) localStorage.setItem('kozel_respect', newRespect);
    if (timeTaken < bestTime) localStorage.setItem('kozel_time', timeTaken);
}

document.getElementById('btn-menu-start').addEventListener('click', startNewGame);
document.getElementById('btn-menu-exit').addEventListener('click', () => tg.close());
document.getElementById('btn-menu-rules').addEventListener('click', () => {
    modalRecords.style.display = 'none';
    modalRules.style.display = 'block';
});
document.getElementById('btn-menu-records').addEventListener('click', () => {
    modalRules.style.display = 'none';
    recRespect.innerText = localStorage.getItem('kozel_respect') || 0;
    let bTime = localStorage.getItem('kozel_time');
    recTime.innerText = bTime ? bTime : "--";
    modalRecords.style.display = 'block';
});
document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => e.target.parentElement.style.display = 'none');
});
document.getElementById('btn-end-retry').addEventListener('click', startNewGame);
document.getElementById('btn-end-home').addEventListener('click', initMenu);

function startReception() {
    clearRoundTimer();
    if (lives <= 0) return processGameOver(false);
    if (kozelLetters >= 5) return processGameOver(true);
    
    gameState = 'RECEPTION';
    timeLeft = 10.0;
    
    ball.x = canvas.width * 0.5;
    ball.y = goalBounds.bottomY - 20;
    ball.size = 10;
    ball.rotation = 0;
    ball.scaleX = 1;
    ball.scaleY = 1;
    
    const targetY = canvas.height * 0.72;
    ball.vy = (targetY - ball.y) / 600;
    ball.vx = 0;
    ball.sizeSpeed = (35 - 10) / 600; 
    ball.ay = 0; 
    
    cursor.pos = Math.random() * 100;
    cursor.speed = 1.2 + (3 - lives) * 0.3; 
    
    uiTimingContainer.style.display = 'block';
    uiJuggling.style.display = 'none';
    shotMenu.style.display = 'none';
    powerContainer.style.display = 'none';

    uiMessage.innerText = "ПРИЕМ!";
    uiMessage.style.color = "#fff";
}

function startJuggling(isPerfect) {
    gameState = 'JUGGLING';
    jugglingCount = 0;
    btnShoot.style.display = 'none';
    uiTimingContainer.style.display = 'none';
    uiJuggling.style.display = 'flex';
    if (isPerfect) { 
        respect += 50; 
        updateUI(); 
        addScreenShake(4);
    }
    uiMessage.innerText = isPerfect ? "ИДЕАЛЬНЫЙ ПРИЕМ! +50\nНАЧЕКАНЬ МИНИМУМ 3 РАЗА!" : "НАЧЕКАНЬ МИНИМУМ 3 РАЗА!";
    uiMessage.style.color = isPerfect ? "#00ff00" : "#FFC107";

    ball.size = 35;
    ball.y = canvas.height * 0.52;
    ball.x = canvas.width * 0.5;
    ball.vy = -7;
    ball.vx = (Math.random() - 0.5) * 4;
    ball.ay = 0.35; 
    ball.scaleX = 0.85;
    ball.scaleY = 1.2;
}

function hitBall(foot) {
    if (gameState !== 'JUGGLING' || ball.y >= groundLevel) return; 
    if (ball.y < canvas.height * 0.3) return;

    const centerX = canvas.width * 0.5;
    const diffX = ball.x - centerX;
    const isCenter = Math.abs(diffX) <= 30;

    if (isCenter || (foot === 'left' && diffX < -30) || (foot === 'right' && diffX > 30)) {
        respect += 10;
        jugglingCount++;
        updateUI();
        
        let xPush = 4 + Math.random() * 4; 
        ball.vx = (foot === 'left') ? xPush : -xPush; 
        ball.ay += 0.015; 
        ball.vy = -9 - Math.random() * 2; 

        // Squash & stretch мяча при ударе
        ball.scaleX = 1.3;
        ball.scaleY = 0.7;

        // Отдача ноги и пыль из-под кеда
        if (foot === 'left') {
            footKickLeft = 24;
            spawnDust(canvas.width * 0.5 - 60, canvas.height - 40, 5);
        } else {
            footKickRight = 24;
            spawnDust(canvas.width * 0.5 + 60, canvas.height - 40, 5);
        }
        
        if (jugglingCount >= 3) {
            btnShoot.style.display = 'flex';
            uiMessage.innerText = "МОЖНО БИТЬ ИЛИ НАБИВАТЬ!";
        } else {
            uiMessage.innerText = "НАБИТО: " + jugglingCount + "/3";
        }
        uiMessage.style.color = "#00ff00";
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    } else {
        loseLife("НЕ ТУ НОГУ НАЖАЛ!");
    }
}

document.getElementById('btn-left').addEventListener('pointerdown', () => hitBall('left'));
document.getElementById('btn-right').addEventListener('pointerdown', () => hitBall('right'));
btnShoot.addEventListener('pointerdown', () => { if (gameState === 'JUGGLING') startAimingPhase(); });

function startAimingPhase() {
    gameState = 'AIMING';
    targetGoalX = 0;
    targetGoalY = 0;
    uiJuggling.style.display = 'none';
    ball.vy = 0; ball.ay = 0; ball.vx = 0;
    uiMessage.innerText = "ТАПНИ В СТВОР ВОРОТ ДЛЯ УДАРА!";
    uiMessage.style.color = "#ffcc00";
}

document.querySelectorAll('.shot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedShotCost = parseInt(btn.getAttribute('data-cost'), 10);
        shotMenu.style.display = 'none';
        startPowerPhase();
    });
});

function startPowerPhase() {
    gameState = 'POWER';
    powerContainer.style.display = 'flex';
    powerCursorPos = 0;
    powerDirection = 1;
    uiMessage.innerText = "ЖМИ ЭКРАН, ЧТОБЫ ОСТАНОВИТЬ СИЛУ!";
    uiMessage.style.color = "#fff";
}

function confirmPower() {
    if (gameState !== 'POWER') return;
    selectedPower = powerCursorPos; 
    powerContainer.style.display = 'none';
    startShotAnimation();
}

function startShotAnimation() {
    gameState = 'SHOT_ANIMATION';
    uiMessage.innerText = "УДАР!";
    uiMessage.style.color = "#ffff00";
    animStartX = ball.x;
    animStartY = ball.y;
    animProgress = 0;
    
    addScreenShake(6); // Сочный толчок экрана при ударе
    ball.scaleX = 0.7;
    ball.scaleY = 1.35;
    
    gkAnimStartX = gkX; 
    let gkCenter = gkX + gkWidth * 0.5;

    let missChance = 3 + (selectedPower * 0.15); 
    let roll = Math.random() * 100;

    if (roll < missChance) {
        if (roll < missChance * 0.2) {
            shotOutcome = 'MISS_BALL';
            ball.vy = 0;
            ball.ay = 0.5;
        } else {
            shotOutcome = 'OFF_TARGET';
            animEndX = targetGoalX + (targetGoalX > goalBounds.x + goalBounds.width * 0.5 ? 80 : -80); 
            animEndY = goalBounds.y - 40;
        }
        gkAnimEndX = Math.max(goalBounds.x, Math.min(goalBounds.x + goalBounds.width - gkWidth, targetGoalX - gkWidth * 0.5));
    } else {
        let dist = Math.abs(targetGoalX - gkCenter);
        let saveChance = 88 - (dist * 0.55) - (selectedPower * 0.2);
        saveChance = Math.max(30, Math.min(95, saveChance));
        
        animEndX = targetGoalX;
        animEndY = targetGoalY;

        if (Math.random() * 100 < saveChance) {
            shotOutcome = 'SAVE'; 
            gkAnimEndX = Math.max(goalBounds.x, Math.min(goalBounds.x + goalBounds.width - gkWidth, targetGoalX - gkWidth * 0.5));
        } else {
            shotOutcome = 'GOAL'; 
            let offset = (dist < 50) ? (targetGoalX > gkCenter ? 25 : -25) : (Math.random() > 0.5 ? 35 : -35);
            gkAnimEndX = Math.max(goalBounds.x, Math.min(goalBounds.x + goalBounds.width - gkWidth, gkX + offset));
        }
    }
}

function finishShot() {
    if (shotOutcome === 'GOAL') {
        uiMessage.innerText = "ГОЛ!";
        uiMessage.style.color = "#00ff00";
        kozelLetters = Math.min(5, kozelLetters + selectedShotCost); 
        updateUI();
        addScreenShake(10); // Взрывная тряска при голе
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        gameState = 'RESULT';
        roundTimerId = setTimeout(startReception, 2000);
    } else if (shotOutcome === 'SAVE') {
        addScreenShake(5);
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
        loseLife("ВРАТАРЬ ПОТАЩИЛ МЯЧ!");
    } else if (shotOutcome === 'OFF_TARGET') {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        loseLife("НЕ ПОПАЛ В СТВОР!");
    } else if (shotOutcome === 'MISS_BALL') {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        loseLife("НЕ ПОПАЛ ПО МЯЧУ!");
    }
}

function loseLife(msg) {
    lives--;
    updateUI();
    gameState = 'RESULT';
    uiTimingContainer.style.display = 'none';
    uiJuggling.style.display = 'none';
    shotMenu.style.display = 'none';
    powerContainer.style.display = 'none';
    uiMessage.innerText = msg + "\nМИНУС ЖИЗНЬ!";
    uiMessage.style.color = "#ff3333";
    addScreenShake(8);
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    clearRoundTimer();
    roundTimerId = setTimeout(startReception, 2000);
}

function processGameOver(isWin) {
    clearRoundTimer();
    gameState = 'GAMEOVER';
    uiLayer.style.display = 'none';
    gameOverScreen.style.display = 'flex'; 
    if (isWin) {
        let timeTaken = Math.floor((performance.now() - gameStartTime) / 1000);
        endTitle.innerText = "ПОБЕДА!";
        endTitle.style.color = "#00ff00";
        endDesc.innerHTML = "Ты наказал вратаря!<br>Он стал КОЗЛОМ за " + timeTaken + " сек.<br>Твой респект: " + respect;
        saveRecord(respect, timeTaken);
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } else {
        endTitle.innerText = "ПОРАЖЕНИЕ";
        endTitle.style.color = "#ff3333";
        endDesc.innerHTML = "У тебя кончились попытки.<br>Твой респект: " + respect;
        saveRecord(respect, 9999);
    }
}

function gameLoop(currentTime) {
    const dt = Math.min((currentTime - lastFrameTime) / 1000, 0.1);
    const frameScale = dt * 60;
    lastFrameTime = currentTime;

    // Затухание Screen Shake
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    if (screenShake > 0) {
        shakeOffsetX = (Math.random() - 0.5) * screenShake * 2;
        shakeOffsetY = (Math.random() - 0.5) * screenShake * 2;
        screenShake = Math.max(0, screenShake - dt * 25);
    }

    // Затухание толчков ног
    footKickLeft = Math.max(0, footKickLeft - dt * 100);
    footKickRight = Math.max(0, footKickRight - dt * 100);

    // Плавный возврат масштаба мяча (squash & stretch recovery)
    ball.scaleX += (1 - ball.scaleX) * 0.15 * frameScale;
    ball.scaleY += (1 - ball.scaleY) * 0.15 * frameScale;

    ctx.save();
    if (shakeOffsetX !== 0 || shakeOffsetY !== 0) {
        ctx.translate(shakeOffsetX, shakeOffsetY);
    }

    // 1. Фон двора
    if (assets.bg.ready) {
        ctx.drawImage(assets.bg.img, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. ВОРОТА
    if (assets.goals.ready) {
        ctx.drawImage(assets.goals.img, goalBounds.x, goalBounds.y, goalBounds.width, goalBounds.height);
    } else {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.strokeRect(goalBounds.x, goalBounds.y, goalBounds.width, goalBounds.height);
    }

    // 3. ВРАТАРЬ С ПРОЦЕДУРНОЙ ПОХОДКОЙ И НАКЛОНОМ
    let prevGkX = gkX;
    if (gameState !== 'SHOT_ANIMATION' && gameState !== 'RESULT' && gameState !== 'GAMEOVER') {
        let center = goalBounds.x + (goalBounds.width - gkWidth) * 0.5; 
        let range = Math.max(10, (goalBounds.width - gkWidth) * 0.5 - 6);
        gkX = center + Math.sin(currentTime * 0.0025) * range; 
    } else if (gameState === 'SHOT_ANIMATION') {
        gkX = gkAnimStartX + (gkAnimEndX - gkAnimStartX) * Math.min(animProgress * 1.5, 1);
    }
    gkVelocityX = gkX - prevGkX;

    // Пружинящее покачивание шага (bobbing) и наклон корпуса (tilt)
    let gkBob = Math.abs(Math.sin(currentTime * 0.012)) * 4;
    let gkTilt = Math.max(-0.12, Math.min(0.12, gkVelocityX * 0.05));
    let gkBaseY = goalBounds.bottomY - gkHeight + gkBob;

    ctx.save();
    ctx.translate(gkX + gkWidth * 0.5, gkBaseY + gkHeight);
    ctx.rotate(gkTilt);
    if (gameState === 'SHOT_ANIMATION') {
        // Вытягивание в прыжке за мячом
        ctx.scale(0.9, 1.15);
    }
    if (assets.gk.ready) {
        ctx.drawImage(assets.gk.img, -gkWidth * 0.5, -gkHeight, gkWidth, gkHeight);
    } else {
        ctx.fillStyle = '#ff5722';
        ctx.fillRect(-gkWidth * 0.5, -gkHeight, gkWidth, gkHeight);
    }
    ctx.restore();

    // Индикатор зоны в фазе прицеливания
    if (gameState === 'AIMING') {
        const inner = getGoalInnerBounds();
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 204, 0, 0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(inner.minX, inner.minY, inner.maxX - inner.minX, inner.maxY - inner.minY);
        ctx.restore();
    }

    // 4. ДИНАМИЧЕСКАЯ ТЕНЬ МЯЧА НА АСФАЛЬТЕ
    let shadowY = groundLevel;
    let shadowX = ball.x;
    let shadowScale = 1.0;
    let shadowAlpha = 0.4;

    if (gameState === 'JUGGLING') {
        let distToGround = Math.max(0, groundLevel - ball.y);
        shadowScale = Math.max(0.3, 1 - distToGround / 350);
        shadowAlpha = Math.max(0.1, 0.45 * shadowScale);
    } else if (gameState === 'RECEPTION') {
        shadowY = ball.y + ball.size * 1.2;
        shadowScale = ball.size / 35;
        shadowAlpha = 0.35;
    } else if (gameState === 'SHOT_ANIMATION') {
        shadowY = goalBounds.bottomY;
        shadowX = ball.x;
        shadowScale = ball.size / 35;
        shadowAlpha = 0.25;
    }

    if (gameState !== 'MENU' && gameState !== 'GAMEOVER') {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, ' + shadowAlpha + ')';
        ctx.beginPath();
        ctx.ellipse(shadowX, shadowY, ball.size * shadowScale * 1.1, ball.size * shadowScale * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // 5. ЧАСТИЦЫ ПЫЛИ
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * frameScale;
        p.y += p.vy * frameScale;
        p.vy += 0.08 * frameScale; // легкая гравитация
        p.alpha -= (1 / p.life) * dt;

        if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.fillStyle = 'rgba(180, 175, 160, ' + p.alpha + ')';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }

    if (gameState === 'MENU' || gameState === 'GAMEOVER') {
        ctx.restore();
        requestAnimationFrame(gameLoop);
        return;
    }

    if (gameState === 'RECEPTION') {
        ball.y += ball.vy * frameScale;
        ball.x = (canvas.width * 0.5) + Math.sin(ball.y * 0.05) * 15;
        ball.size += ball.sizeSpeed * frameScale;
        ball.rotation += 0.02 * frameScale;
        
        cursor.pos += cursor.speed * cursor.direction * frameScale;
        if (cursor.pos >= 100) { cursor.pos = 100; cursor.direction = -1; } 
        else if (cursor.pos <= 0) { cursor.pos = 0; cursor.direction = 1; }
        uiCursor.style.left = cursor.pos + "%";

        timeLeft -= dt;
        uiTimer.innerText = Math.max(0, timeLeft).toFixed(1) + "s";
        uiTimer.style.color = timeLeft <= 3 ? "#ff3333" : "#ffcc00";
        if (timeLeft <= 0) loseLife("ВРЕМЯ ВЫШЛО!");
    }

    if (gameState === 'JUGGLING') {
        ball.vy += ball.ay * frameScale;
        ball.x += ball.vx * frameScale;
        ball.y += ball.vy * frameScale;
        ball.rotation += ball.vx * 0.04 * frameScale;

        if (ball.x < ball.size) { 
            ball.x = ball.size; 
            ball.vx *= -0.8; 
            ball.scaleX = 0.8; ball.scaleY = 1.25;
        }
        if (ball.x > canvas.width - ball.size) { 
            ball.x = canvas.width - ball.size; 
            ball.vx *= -0.8; 
            ball.scaleX = 0.8; ball.scaleY = 1.25;
        }

        if (ball.y - ball.size < ceilingLevel) {
            ball.y = ceilingLevel + ball.size;
            if (ball.vy < 0) ball.vy *= -0.4; 
        }

        // 6. НОГИ С ПРОЦЕДУРНЫМ ТОЛЧКОМ
        if (assets.feet.ready) {
            let feetBaseY = canvas.height - 240;
            let leftY = feetBaseY - footKickLeft;
            let rightY = feetBaseY - footKickRight;
            let avgFeetY = (leftY + rightY) * 0.5;
            let feetTilt = (footKickLeft - footKickRight) * 0.005;

            ctx.save();
            ctx.translate(canvas.width * 0.5, avgFeetY + 110);
            ctx.rotate(feetTilt);
            ctx.drawImage(assets.feet.img, -100, -110, 200, 220);
            ctx.restore();
        }

        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(0, groundLevel, canvas.width, 4);
        if (ball.y + (ball.size * 0.5) > groundLevel) loseLife("МЯЧ УПАЛ НА ЗЕМЛЮ!");
    }

    if (gameState === 'SELECT_SHOT' || gameState === 'POWER') {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(targetGoalX, targetGoalY, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(targetGoalX - 6, targetGoalY);
        ctx.lineTo(targetGoalX + 6, targetGoalY);
        ctx.moveTo(targetGoalX, targetGoalY - 6);
        ctx.lineTo(targetGoalX, targetGoalY + 6);
        ctx.stroke();
    }

    if (gameState === 'POWER') {
        powerCursorPos += 2.5 * powerDirection * frameScale;
        if (powerCursorPos >= 100) { powerCursorPos = 100; powerDirection = -1; }
        else if (powerCursorPos <= 0) { powerCursorPos = 0; powerDirection = 1; }
        powerCursor.style.top = (100 - powerCursorPos) + "%";
    }

    if (gameState === 'SHOT_ANIMATION') {
        let speedMultiplier = (0.015 + (selectedPower / 100) * 0.065) * frameScale;
        ball.rotation += 0.25 * frameScale;

        if (shotOutcome === 'MISS_BALL') {
            ball.vy += ball.ay * frameScale;
            ball.y += ball.vy * frameScale;
            if (ball.y >= groundLevel) finishShot();
        } else {
            animProgress += speedMultiplier;
            if (animProgress >= 1) {
                animProgress = 1;
                finishShot();
            }
            ball.x = animStartX + (animEndX - animStartX) * animProgress;
            ball.y = animStartY + (animEndY - animStartY) * animProgress;
            ball.size = 35 - 25 * animProgress;
        }
    }

    // 7. ОТРИСОВКА МЯЧА С ВРАЩЕНИЕМ И SQUASH & STRETCH
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);
    ctx.scale(ball.scaleX, ball.scaleY);

    if (assets.ball.ready) {
        const d = ball.size * 2;
        ctx.drawImage(assets.ball.img, -ball.size, -ball.size, d, d);
    } else {
        ctx.beginPath();
        ctx.arc(0, 0, ball.size, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    ctx.restore();

    ctx.restore(); // Сброс смещения screen shake
    requestAnimationFrame(gameLoop);
}

window.addEventListener('pointerdown', (e) => {
    if (gameState === 'MENU' || gameState === 'GAMEOVER') return;
    if (e.target.tagName === 'BUTTON' || e.target.closest('#shot-menu') || e.target.closest('#power-container')) return; 

    if (gameState === 'RECEPTION') {
        const gL = targetZone.pos - (targetZone.greenWidth * 0.5);
        const gR = targetZone.pos + (targetZone.greenWidth * 0.5);
        const yL = gL - targetZone.yellowWidth;
        const yR = gR + targetZone.yellowWidth;
        if (cursor.pos >= gL && cursor.pos <= gR) {
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
            startJuggling(true); 
        } else if (cursor.pos >= yL && cursor.pos <= yR) {
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            startJuggling(false);
        } else {
            loseLife("СОРВАЛ ТАЙМИНГ!");
        }
        return;
    }

    if (gameState === 'AIMING') {
        const rect = canvas.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
        const inner = getGoalInnerBounds();

        if (clickX >= inner.minX && clickX <= inner.maxX &&
            clickY >= inner.minY && clickY <= inner.maxY) {
            targetGoalX = Math.round(clickX);
            targetGoalY = Math.round(clickY);
            gameState = 'SELECT_SHOT';
            shotMenu.style.display = 'block';
            uiMessage.innerText = "ВЫБЕРИ ТИП УДАРА";
            uiMessage.style.color = "#ffcc00";
            if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
        } else {
            uiMessage.innerText = "ТАПАЙ ТОЧНО В СТВОР ВОРОТ!";
            uiMessage.style.color = "#ff3333";
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
        }
        return;
    }

    if (gameState === 'POWER') {
        confirmPower();
        return;
    }
});

initMenu();
requestAnimationFrame(gameLoop);