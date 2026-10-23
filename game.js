const tg = window.Telegram.WebApp;
tg.expand();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const groundLevel = canvas.height - 140; 

// UI Элементы
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
let jugglingCount = 0; // Считаем набивки для появления кнопки удара
let gameState = 'RECEPTION'; 

let ball = { x: 0, y: 0, size: 10, vx: 0, vy: 0, sizeSpeed: 0, ax: 0, ay: 0 };
let targetGoalX = canvas.width / 2; // Куда целит игрок при ударе
let targetGoalY = canvas.height * 0.25;
let selectedShotType = null;
let powerCursorPos = 0; // 0 до 100 для вертикальной шкалы
let powerDirection = 1;

const trajectories = [
    { name: "Прямой навес", startX: 0.5 },
    { name: "Крученый левый", startX: 0.7 },
    { name: "Крученый правый", startX: 0.3 },
    { name: "Парашют", startX: 0.5 },
    { name: "Пушка низом", startX: 0.5 }
];

let cursor = { pos: 0, speed: 1.5, direction: 1 }; // Сделали ползунок медленнее для точности
const targetZone = { pos: 50, greenWidth: 8, yellowWidth: 16 };

let timeLeft = 10.0;
let lastFrameTime = performance.now();

// --- ФАЗА 1: ПРИЕМ ---
function startReception() {
    if (lives <= 0) return gameOver();
    
    gameState = 'RECEPTION';
    timeLeft = 10.0;
    
    const t = trajectories[Math.floor(Math.random() * trajectories.length)];
    ball.x = canvas.width * t.startX; 
    ball.y = canvas.height * 0.15; // Стартует сверху под воротами
    ball.size = 10;
    
    // Синхронизируем скорость падения так, чтобы мяч долетал ровно за 10 секунд до зоны приема
    const targetY = canvas.height * 0.7;
    const distanceY = targetY - ball.y;
    ball.vy = distanceY / (10 * 60); // 60 кадров в секунду * 10 секунд
    ball.vx = 0;
    ball.sizeSpeed = (40 - 10) / (10 * 60); // Плавное увеличение спрайта мяча

    cursor.pos = Math.random() * 100;
    cursor.speed = 1.2 + (3 - lives) * 0.3; // Медленный, комфортный для попадания ползунок
    
    uiTimingContainer.style.display = 'block';
    uiJuggling.style.display = 'none';
    shotMenu.style.display = 'none';
    powerContainer.style.display = 'none';
    
    uiTargetGreen.style.left = `${targetZone.pos}%`;
    uiTargetGreen.style.width = `${targetZone.greenWidth}%`;
    uiTargetGreen.style.transform = 'translateX(-50%)';
    uiTargetYellowLeft.style.left = `${targetZone.pos - (targetZone.greenWidth/2) - targetZone.yellowWidth}%`;
    uiTargetYellowLeft.style.width = `${targetZone.yellowWidth}%`;
    uiTargetYellowRight.style.left = `${targetZone.pos + (targetZone.greenWidth/2)}%`;
    uiTargetYellowRight.style.width = `${targetZone.yellowWidth}%`;

    uiMessage.innerText = `ПРИЕМ! (${t.name})`;
    uiMessage.style.color = "#fff";
}

// --- ФАЗА 2: ЧЕКАНКА ---
function startJuggling(isPerfect) {
    gameState = 'JUGGLING';
    jugglingCount = 0;
    btnShoot.style.display = 'none'; // Появится после 3 ударов
    uiTimingContainer.style.display = 'none';
    uiJuggling.style.display = 'flex';
    
    if (isPerfect) {
        respect += 50;
        uiRespectScore.innerText = respect;
        uiMessage.innerText = "ИДЕАЛЬНЫЙ ПРИЕМ! +50\nНАЧЕКАНЬ МИНИМУМ 3 РАЗА!";
        uiMessage.style.color = "#00ff00";
    } else {
        uiMessage.innerText = "ПРИНЯЛ. НАЧЕКАНЬ МИНИМУМ 3 РАЗА!";
        uiMessage.style.color = "#FFC107";
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
    if (ball.y < groundLevel - 180) return; 

    const isLeft = ball.x <= canvas.width / 2;
    const isRight = ball.x > canvas.width / 2;

    if ((foot === 'left' && isLeft) || (foot === 'right' && isRight)) {
        respect += 10;
        jugglingCount++;
        uiRespectScore.innerText = respect;
        
        ball.vy = -11 - Math.random() * 3; 
        ball.vx = (Math.random() - 0.5) * 10; 
        
        if (jugglingCount >= 3) {
            btnShoot.style.display = 'flex'; // Активируем кнопку удара!
            uiMessage.innerText = "МОЖНО БИТЬ ПО ВОРОТАМ ИЛИ НАБИВАТЬ ДАЛЬШЕ!";
        } else {
            uiMessage.innerText = `НАБИТО: ${jugglingCount}/3`;
        }
        uiMessage.style.color = "#00ff00";
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    } else {
        loseLife("ПО НОГАМ СЕБЕ УДАРИЛ!");
    }
}

document.getElementById('btn-left').addEventListener('pointerdown', () => hitBall('left'));
document.getElementById('btn-right').addEventListener('pointerdown', () => hitBall('right'));

// Кнопка перехода к Фазе 3 (Удар)
btnShoot.addEventListener('pointerdown', () => {
    if (gameState !== 'JUGGLING') return;
    startAimingPhase();
});

// --- ФАЗА 3: ПРИЦЕЛИВАНИЕ И УДАР ---
function startAimingPhase() {
    gameState = 'AIMING';
    uiJuggling.style.display = 'none';
    shotMenu.style.display = 'block';
    uiMessage.innerText = "ВЫБЕРИ ТИП УДАРА";
    uiMessage.style.color = "#ffcc00";

    // Замедляем время (bullet-time)
    ball.vy = 0; ball.ay = 0; ball.vx = 0;
    targetGoalX = canvas.width / 2;
    targetGoalY = canvas.height * 0.25;
}

// Выбор типа удара
document.querySelectorAll('.shot-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        selectedShotType = e.target.getAttribute('data-type');
        shotMenu.style.display = 'none';
        startPowerPhase();
    });
});

// Шкала силы
function startPowerPhase() {
    gameState = 'POWER';
    powerContainer.style.display = 'flex';
    powerCursorPos = 0;
    powerDirection = 1;
    uiMessage.innerText = "ЖМИ ЭКРАН ДЛЯ ФИКСАЦИИ СИЛЫ!";
}

function confirmPower() {
    if (gameState !== 'POWER') return;
    powerContainer.style.display = 'none';
    executeShot(powerCursorPos);
}

// Расчет результата удара
function executeShot(powerValue) {
    gameState = 'SHOT_RESULT';
    
    // Рендом точности от 1 до 100
    // Сила влияет на риск: чем выше сила (ближе к 100), тем выше шанс отклонения точности
    let accuracyRoll = Math.floor(Math.random() * 100) + 1;
    
    let resultMsg = "";
    if (accuracyRoll === 100) {
        resultMsg = "ГОЛ В ДЕВЯТКУ! ВРАТАРЬ БЕЗУСПЕШЕН!";
        uiMessage.style.color = "#00ff00";
    } else if (accuracyRoll >= 70) {
        resultMsg = `ТОЧНЫЙ УДАР! (Точность: ${accuracyRoll}/100) - ГОЛ!`;
        uiMessage.style.color = "#00ff00";
    } else if (accuracyRoll > 20) {
        resultMsg = `ВРАТАРЬ ПОТАЩИЛ! (Точность: ${accuracyRoll}/100)`;
        uiMessage.style.color = "#FFC107";
    } else {
        resultMsg = `АБСОЛЮТНЫЙ ПРОМАХ! МЯЧ В МОЛОКО! (Точность: ${accuracyRoll}/100)`;
        uiMessage.style.color = "#ff3333";
        loseLife("НЕ ПОПАЛ ПО ВОРОТАМ!");
        return;
    }

    uiMessage.innerText = resultMsg;
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

    setTimeout(startReception, 3000);
}

function loseLife(msg) {
    lives--;
    let hearts = '';
    for(let i=0; i<lives; i++) hearts += '❤️';
    for(let i=0; i<(3-lives); i++) hearts += '🖤';
    uiLivesCount.innerText = hearts;
    
    gameState = 'RESULT';
    uiTimingContainer.style.display = 'none';
    uiJuggling.style.display = 'none';
    shotMenu.style.display = 'none';
    powerContainer.style.display = 'none';
    uiMessage.innerText = `${msg}\nМИНУС ЖИЗНЬ!`;
    uiMessage.style.color = "#ff3333";
    
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    setTimeout(startReception, 2000);
}

function gameOver() {
    gameState = 'GAMEOVER';
    uiJuggling.style.display = 'none';
    shotMenu.style.display = 'none';
    powerContainer.style.display = 'none';
    uiMessage.innerText = `ИГРА ОКОНЧЕНА!\nТвой респект: ${respect}\nКликни для рестарта.`;
    uiMessage.style.color = "#ff3333";
}

// --- ИГРОВОЙ ЦИКЛ ---
function gameLoop(currentTime) {
    const dt = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    // Отрисовка двора (ФИКС ПРОПОРЦИЙ ВОРОТ НА МОБИЛКАХ)
    ctx.fillStyle = '#4CAF50'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#607D8B'; ctx.fillRect(0, 0, canvas.width, canvas.height * 0.35);
    
    // Рендерим правильные горизонтальные пропорции ворот
    const goalWidth = Math.min(canvas.width * 0.7, 450);
    const goalHeight = 120;
    const goalX = (canvas.width - goalWidth) / 2;
    const goalY = canvas.height * 0.1;
    
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
    ctx.strokeRect(goalX, goalY, goalWidth, goalHeight);

    if (gameState === 'RECEPTION') {
        ball.y += ball.vy; 
        ball.size += ball.sizeSpeed;

        cursor.pos += cursor.speed * cursor.direction;
        if (cursor.pos >= 100) { cursor.pos = 100; cursor.direction = -1; } 
        else if (cursor.pos <= 0) { cursor.pos = 0; cursor.direction = 1; }
        uiCursor.style.left = `${cursor.pos}%`;

        timeLeft -= dt;
        uiTimer.innerText = Math.max(0, timeLeft).toFixed(1) + "s";
        uiTimer.style.color = timeLeft <= 3 ? "#ff3333" : "#ffcc00";

        if (timeLeft <= 0) loseLife("ВРЕМЯ ВЫШЛО!");
    }

    if (gameState === 'JUGGLING') {
        ball.vy += ball.ay; 
        ball.x += ball.vx; ball.y += ball.vy;

        if (ball.x < ball.size) { ball.x = ball.size; ball.vx *= -0.8; }
        if (ball.x > canvas.width - ball.size) { ball.x = canvas.width - ball.size; ball.vx *= -0.8; }

        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.fillRect(0, groundLevel, canvas.width, 4);

        if (ball.y + (ball.size/2) > groundLevel) {
            loseLife("МЯЧ УПАЛ НА ЗЕМЛЮ!");
        }
    }

    // Фаза прицеливания (перетаскивание мяча по воротам)
    if (gameState === 'AIMING') {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5);';
        ctx.beginPath();
        ctx.arc(targetGoalX, targetGoalY, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.stroke();
    }

    // Фаза шкалы силы
    if (gameState === 'POWER') {
        powerCursorPos += 2.5 * powerDirection;
        if (powerCursorPos >= 100) { powerCursorPos = 100; powerDirection = -1; }
        else if (powerCursorPos <= 0) { powerCursorPos = 0; powerDirection = 1; }
        powerCursor.style.top = `${powerCursorPos}%`;
    }

    // Рендер мяча
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();

    requestAnimationFrame(gameLoop);
}

// Обработка тапов и перетаскивания
window.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('#shot-menu')) return; 

    if (gameState === 'GAMEOVER') {
        lives = 3; respect = 0; uiRespectScore.innerText = respect;
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

    // В фазе прицеливания двигаем точку удара пальцем
    if (gameState === 'AIMING') {
        targetGoalX = e.clientX;
        targetGoalY = e.clientY;
        return;
    }

    // В фазе силы тапом фиксируем значение силы
    if (gameState === 'POWER') {
        confirmPower();
        return;
    }
});

window.addEventListener('pointermove', (e) => {
    if (gameState === 'AIMING') {
        targetGoalX = e.clientX;
        targetGoalY = e.clientY;
    }
});

startReception();
requestAnimationFrame(gameLoop);