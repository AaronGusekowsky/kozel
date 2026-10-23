const tg = window.Telegram.WebApp;
tg.expand();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const groundLevel = canvas.height - 220; 

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

let lives = 3;
let respect = 0;
let jugglingCount = 0; 
let gameState = 'RECEPTION'; 

let ball = { x: 0, y: 0, size: 10, vx: 0, vy: 0, sizeSpeed: 0, ax: 0, ay: 0 };
let targetGoalX = 0; 
let targetGoalY = 0;
let selectedShotType = null;
let powerCursorPos = 0; 
let powerDirection = 1;
let selectedPower = 50; 

let animStartX = 0, animStartY = 0, animEndX = 0, animEndY = 0;
let animProgress = 0;
let shotOutcome = 'GOAL'; 

const trajectories = [
    { name: "Прямой навес", startX: 0.5 },
    { name: "Крученый левый", startX: 0.7 },
    { name: "Крученый правый", startX: 0.3 },
    { name: "Парашют", startX: 0.5 },
    { name: "Пушка низом", startX: 0.5 }
];

let cursor = { pos: 0, speed: 1.2, direction: 1 };
const targetZone = { pos: 50, greenWidth: 8, yellowWidth: 16 };

let timeLeft = 10.0;
let lastFrameTime = performance.now();

// Функция отрисовки ворот (чтобы координаты везде совпадали)
function getGoalBounds() {
    const goalWidth = Math.min(canvas.width * 0.7, 450);
    const goalHeight = 120;
    const goalX = (canvas.width - goalWidth) / 2;
    const goalY = canvas.height * 0.1;
    return { x: goalX, y: goalY, width: goalWidth, height: goalHeight };
}

// --- ФАЗА 1: ПРИЕМ ---
function startReception() {
    if (lives <= 0) return gameOver();
    
    gameState = 'RECEPTION';
    timeLeft = 10.0;
    
    const t = trajectories[Math.floor(Math.random() * trajectories.length)];
    ball.x = canvas.width * t.startX; 
    ball.y = canvas.height * 0.15; 
    ball.size = 10;
    
    const targetY = canvas.height * 0.7;
    ball.vy = (targetY - ball.y) / (10 * 60); 
    ball.vx = 0;
    ball.sizeSpeed = (35 - 10) / (10 * 60); 
    ball.ay = 0; // Отключаем гравитацию для первой фазы

    cursor.pos = Math.random() * 100;
    cursor.speed = 1.2 + (3 - lives) * 0.3; 
    
    if (uiTimingContainer) uiTimingContainer.style.display = 'block';
    if (uiJuggling) uiJuggling.style.display = 'none';
    if (shotMenu) shotMenu.style.display = 'none';
    if (powerContainer) powerContainer.style.display = 'none';
    
    if (uiTargetGreen) {
        uiTargetGreen.style.left = `${targetZone.pos}%`;
        uiTargetGreen.style.width = `${targetZone.greenWidth}%`;
        uiTargetGreen.style.transform = 'translateX(-50%)';
    }
    if (uiTargetYellowLeft) {
        uiTargetYellowLeft.style.left = `${targetZone.pos - (targetZone.greenWidth/2) - targetZone.yellowWidth}%`;
        uiTargetYellowLeft.style.width = `${targetZone.yellowWidth}%`;
    }
    if (uiTargetYellowRight) {
        uiTargetYellowRight.style.left = `${targetZone.pos + (targetZone.greenWidth/2)}%`;
        uiTargetYellowRight.style.width = `${targetZone.yellowWidth}%`;
    }

    if (uiMessage) {
        uiMessage.innerText = `ПРИЕМ! (${t.name})`;
        uiMessage.style.color = "#fff";
    }
}

// --- ФАЗА 2: ЧЕКАНКА ---
function startJuggling(isPerfect) {
    gameState = 'JUGGLING';
    jugglingCount = 0;
    if (btnShoot) btnShoot.style.display = 'none'; 
    if (uiTimingContainer) uiTimingContainer.style.display = 'none';
    if (uiJuggling) uiJuggling.style.display = 'flex';
    
    if (isPerfect) {
        respect += 50;
        if (uiRespectScore) uiRespectScore.innerText = respect;
        if (uiMessage) {
            uiMessage.innerText = "ИДЕАЛЬНЫЙ ПРИЕМ! +50\nНАЧЕКАНЬ МИНИМУМ 3 РАЗА!";
            uiMessage.style.color = "#00ff00";
        }
    } else {
        if (uiMessage) {
            uiMessage.innerText = "ПРИНЯЛ. НАЧЕКАНЬ МИНИМУМ 3 РАЗА!";
            uiMessage.style.color = "#FFC107";
        }
    }

    ball.size = 35; 
    ball.y = canvas.height * 0.5; 
    ball.x = canvas.width / 2;
    ball.vy = -7; 
    ball.vx = (Math.random() - 0.5) * 6; 
    ball.ay = 0.35; 
}

function hitBall(foot) {
    if (gameState !== 'JUGGLING') return;
    if (ball.y >= groundLevel) return; 

    const centerX = canvas.width / 2;
    const centerTolerance = 30;
    const isCenter = Math.abs(ball.x - centerX) <= centerTolerance;
    const isLeft = ball.x < centerX - centerTolerance;
    const isRight = ball.x > centerX + centerTolerance;

    let success = false;
    if (isCenter || (foot === 'left' && isLeft) || (foot === 'right' && isRight)) {
        success = true;
    }

    if (success) {
        respect += 10;
        jugglingCount++;
        if (uiRespectScore) uiRespectScore.innerText = respect;
        
        ball.vy = -11 - Math.random() * 3; 
        ball.vx = (Math.random() - 0.5) * 10; 
        
        if (jugglingCount >= 3) {
            if (btnShoot) btnShoot.style.display = 'flex'; 
            if (uiMessage) uiMessage.innerText = "МОЖНО БИТЬ ПО ВОРОТАМ ИЛИ НАБИВАТЬ ДАЛЬШЕ!";
        } else {
            if (uiMessage) uiMessage.innerText = `НАБИТО: ${jugglingCount}/3`;
        }
        if (uiMessage) uiMessage.style.color = "#00ff00";
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    } else {
        loseLife("НЕ ТУ НОГУ НАЖАЛ!");
    }
}

if (document.getElementById('btn-left')) document.getElementById('btn-left').addEventListener('pointerdown', () => hitBall('left'));
if (document.getElementById('btn-right')) document.getElementById('btn-right').addEventListener('pointerdown', () => hitBall('right'));

if (btnShoot) {
    btnShoot.addEventListener('pointerdown', () => {
        if (gameState !== 'JUGGLING') return;
        startAimingPhase();
    });
}

// --- ФАЗА 3.1: ПРИЦЕЛИВАНИЕ ---
function startAimingPhase() {
    gameState = 'AIMING';
    if (uiJuggling) uiJuggling.style.display = 'none';
    ball.vy = 0; ball.ay = 0; ball.vx = 0;

    if (uiMessage) {
        uiMessage.innerText = "ТАПНИ ПО ВОРОТАМ, ЧТОБЫ ВЫБРАТЬ ТОЧКУ УДАРА!";
        uiMessage.style.color = "#ffcc00";
    }
}

// Обработка тапа по воротам находится в общем EventListener ниже

document.querySelectorAll('.shot-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        selectedShotType = e.target.getAttribute('data-type');
        if (shotMenu) shotMenu.style.display = 'none';
        startPowerPhase();
    });
});

// --- ФАЗА 3.2: ШКАЛА СИЛЫ ---
function startPowerPhase() {
    gameState = 'POWER';
    if (powerContainer) powerContainer.style.display = 'flex';
    powerCursorPos = 0;
    powerDirection = 1;
    if (uiMessage) {
        uiMessage.innerText = "ЖМИ ЭКРАН, ЧТОБЫ ОСТАНОВИТЬ СИЛУ!";
        uiMessage.style.color = "#fff";
    }
}

function confirmPower() {
    if (gameState !== 'POWER') return;
    selectedPower = powerCursorPos; 
    if (powerContainer) powerContainer.style.display = 'none';
    startShotAnimation();
}

// --- ФАЗА 3.3: АНИМАЦИЯ УДАРА ---
function startShotAnimation() {
    gameState = 'SHOT_ANIMATION';
    if (uiMessage) {
        uiMessage.innerText = "УДАР!";
        uiMessage.style.color = "#ffff00";
    }

    animStartX = ball.x;
    animStartY = ball.y;
    animProgress = 0;

    let accuracyRoll = Math.floor(Math.random() * 100) + 1;
    const gb = getGoalBounds();

    if (accuracyRoll <= 10) {
        // Промах по мячу
        shotOutcome = 'MISS_BALL';
        ball.vy = 0;
        ball.ay = 0.5; // Включаем гравитацию для падения
    } else if (accuracyRoll <= 30) {
        // Мимо ворот (мяч летит мимо цели)
        shotOutcome = 'OFF_TARGET';
        // Если целились правее центра, мажем вправо. Иначе влево. И летит выше.
        let missXOffset = (targetGoalX > gb.x + gb.width / 2) ? 150 : -150;
        animEndX = targetGoalX + missXOffset; 
        animEndY = gb.y - 100; // Выше перекладины
    } else if (accuracyRoll <= 70) {
        // Сейв (Летит в цель, но пишет, что вратарь отбил)
        shotOutcome = 'SAVE';
        animEndX = targetGoalX;
        animEndY = targetGoalY;
    } else {
        // Гол! Летит ровно туда, куда тапнули
        shotOutcome = 'GOAL';
        animEndX = targetGoalX;
        animEndY = targetGoalY;
    }
}

function finishShot() {
    gameState = 'SHOT_RESULT';
    
    let resultMsg = "";
    if (shotOutcome === 'GOAL') {
        resultMsg = "ИДЕАЛЬНЫЙ УДАР! ГОЛ!"; // Убрал слово "девятка"
        if (uiMessage) uiMessage.style.color = "#00ff00";
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } else if (shotOutcome === 'SAVE') {
        resultMsg = "ВРАТАРЬ ПОТАЩИЛ МЯЧ!";
        if (uiMessage) uiMessage.style.color = "#FFC107";
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
        loseLife("ВРАТАРЬ ВЗЯЛ УДАР!");
        return;
    } else if (shotOutcome === 'OFF_TARGET') {
        resultMsg = "МИМО ВОРОТ! МЯЧ В МОЛОКО!";
        if (uiMessage) uiMessage.style.color = "#ff3333";
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        loseLife("НЕ ПОПАЛ В СТВОР ВОРОТ!");
        return;
    } else if (shotOutcome === 'MISS_BALL') {
        resultMsg = "ПРОМАХ ПО МЯЧУ! КОСЫЙ УДАР!";
        if (uiMessage) uiMessage.style.color = "#ff3333";
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        loseLife("МАЗИЛА, НЕ ПОПАЛ ПО МЯЧУ!");
        return;
    }

    if (uiMessage) uiMessage.innerText = resultMsg;
    setTimeout(startReception, 3000);
}

function loseLife(msg) {
    lives--;
    let hearts = '';
    for(let i=0; i<lives; i++) hearts += '❤️';
    for(let i=0; i<(3-lives); i++) hearts += '🖤';
    if (uiLivesCount) uiLivesCount.innerText = hearts;
    
    gameState = 'RESULT';
    if (uiTimingContainer) uiTimingContainer.style.display = 'none';
    if (uiJuggling) uiJuggling.style.display = 'none';
    if (shotMenu) shotMenu.style.display = 'none';
    if (powerContainer) powerContainer.style.display = 'none';
    if (uiMessage) {
        uiMessage.innerText = `${msg}\nМИНУС ЖИЗНЬ!`;
        uiMessage.style.color = "#ff3333";
    }
    
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    setTimeout(startReception, 2000);
}

function gameOver() {
    gameState = 'GAMEOVER';
    if (uiJuggling) uiJuggling.style.display = 'none';
    if (shotMenu) shotMenu.style.display = 'none';
    if (powerContainer) powerContainer.style.display = 'none';
    if (uiMessage) {
        uiMessage.innerText = `ИГРА ОКОНЧЕНА!\nТвой респект: ${respect}\nКликни для рестарта.`;
        uiMessage.style.color = "#ff3333";
    }
}

// Отрисовка прицела
function drawTargetCrosshair() {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(targetGoalX, targetGoalY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(targetGoalX - 8, targetGoalY); ctx.lineTo(targetGoalX + 8, targetGoalY);
    ctx.moveTo(targetGoalX, targetGoalY - 8); ctx.lineTo(targetGoalX, targetGoalY + 8);
    ctx.stroke();
}

// --- ИГРОВОЙ ЦИКЛ ---
function gameLoop(currentTime) {
    const dt = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    ctx.fillStyle = '#4CAF50'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#607D8B'; ctx.fillRect(0, 0, canvas.width, canvas.height * 0.35);
    
    const gb = getGoalBounds();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
    ctx.strokeRect(gb.x, gb.y, gb.width, gb.height);

    if (gameState === 'RECEPTION') {
        ball.y += ball.vy; 
        ball.size += ball.sizeSpeed;

        cursor.pos += cursor.speed * cursor.direction;
        if (cursor.pos >= 100) { cursor.pos = 100; cursor.direction = -1; } 
        else if (cursor.pos <= 0) { cursor.pos = 0; cursor.direction = 1; }
        if (uiCursor) uiCursor.style.left = `${cursor.pos}%`;

        timeLeft -= dt;
        if (uiTimer) {
            uiTimer.innerText = Math.max(0, timeLeft).toFixed(1) + "s";
            uiTimer.style.color = timeLeft <= 3 ? "#ff3333" : "#ffcc00";
        }
        if (timeLeft <= 0) loseLife("ВРЕМЯ ВЫШЛО!");
    }

    if (gameState === 'JUGGLING') {
        ball.vy += ball.ay; 
        ball.x += ball.vx; ball.y += ball.vy;

        if (ball.x < ball.size) { ball.x = ball.size; ball.vx *= -0.8; }
        if (ball.x > canvas.width - ball.size) { ball.x = canvas.width - ball.size; ball.vx *= -0.8; }

        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(0, groundLevel, canvas.width, 4);

        if (ball.y + (ball.size/2) > groundLevel) {
            loseLife("МЯЧ УПАЛ НА ЗЕМЛЮ!");
        }
    }

    // Рисуем прицел в нужных фазах
    if (gameState === 'SELECT_SHOT' || gameState === 'POWER') {
        drawTargetCrosshair();
    }

    if (gameState === 'POWER') {
        powerCursorPos += 2.5 * powerDirection;
        if (powerCursorPos >= 100) { powerCursorPos = 100; powerDirection = -1; }
        else if (powerCursorPos <= 0) { powerCursorPos = 0; powerDirection = 1; }
        if (powerCursor) powerCursor.style.top = `${powerCursorPos}%`;
    }

    if (gameState === 'SHOT_ANIMATION') {
        let speedMultiplier = 0.01 + (selectedPower / 100) * 0.07;
        
        if (shotOutcome === 'MISS_BALL') {
            ball.vy += ball.ay; // Гравитация для промаха
            ball.y += ball.vy;
            if (ball.y >= groundLevel) finishShot();
        } else {
            animProgress += speedMultiplier;
            if (animProgress >= 1) {
                animProgress = 1;
                finishShot();
            }
            ball.x = animStartX + (animEndX - animStartX) * animProgress;
            ball.y = animStartY + (animEndY - animStartY) * animProgress;
            ball.size = 35 - (35 - 10) * animProgress;
        }
    }

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();

    requestAnimationFrame(gameLoop);
}

// Глобальный перехват тапов
window.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('#shot-menu') || e.target.closest('#power-container')) return; 

    if (gameState === 'GAMEOVER') {
        lives = 3; respect = 0; if (uiRespectScore) uiRespectScore.innerText = respect;
        startReception();
        return;
    }

    if (gameState === 'RECEPTION') {
        const greenLeft = targetZone.pos - (targetZone.greenWidth / 2);
        const greenRight = targetZone.pos + (targetZone.greenWidth / 2);
        const yellowLeft = greenLeft - targetZone.yellowWidth;
        const yellowRight = greenRight + targetZone.yellowWidth;

        if (cursor.pos >= greenLeft && cursor.pos <= greenRight) {
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
            startJuggling(true); 
        } else if (cursor.pos >= yellowLeft && cursor.pos <= yellowRight) {
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            startJuggling(false);
        } else {
            loseLife("СОРВАЛ ТАЙМИНГ ПРИЕМА!");
        }
        return;
    }

    if (gameState === 'AIMING') {
        const gb = getGoalBounds();
        // Проверяем, что тап был внутри квадрата ворот
        if (e.clientX >= gb.x && e.clientX <= gb.x + gb.width &&
            e.clientY >= gb.y && e.clientY <= gb.y + gb.height) {
            
            targetGoalX = e.clientX;
            targetGoalY = e.clientY;
            
            // Точка выбрана, переходим к меню удара
            gameState = 'SELECT_SHOT';
            if (shotMenu) shotMenu.style.display = 'block';
            if (uiMessage) {
                uiMessage.innerText = "ВЫБЕРИ ТИП УДАРА";
                uiMessage.style.color = "#ffcc00";
            }
            if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
        }
        // Если тап мимо ворот — ничего не происходит (игнорируем)
        return;
    }

    if (gameState === 'POWER') {
        confirmPower();
        return;
    }
});

startReception();
requestAnimationFrame(gameLoop);