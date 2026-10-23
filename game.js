const tg = window.Telegram.WebApp;
tg.expand();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const groundLevel = canvas.height - 220; 

// Элементы интерфейса
const uiLayer = document.getElementById('ui-layer');
const mainMenu = document.getElementById('main-menu');
const gameOverScreen = document.getElementById('game-over-screen');
const endTitle = document.getElementById('end-title');
const endDesc = document.getElementById('end-desc');

const uiTimingContainer = document.getElementById('timing-container');
const uiCursor = document.getElementById('timing-cursor');
const uiTimer = document.getElementById('timer');
const uiMessage = document.getElementById('message');
const uiLivesCount = document.getElementById('lives-count');
const uiRespectScore = document.getElementById('respect-score');
const uiJuggling = document.getElementById('juggling-ui');
const btnShoot = document.getElementById('btn-shoot');
const shotMenu = document.getElementById('shot-menu');
const powerContainer = document.getElementById('power-container');
const powerCursor = document.getElementById('power-cursor');

// Игровые переменные
let lives = 3;
let respect = 0;
let jugglingCount = 0; 
let kozelLetters = 0; // Штрафные буквы вратаря (макс 5)
let gameStartTime = 0;
let gameState = 'MENU'; // MENU, RECEPTION, JUGGLING, AIMING, POWER, SHOT_ANIMATION, GAMEOVER

let ball = { x: 0, y: 0, size: 10, vx: 0, vy: 0, sizeSpeed: 0, ax: 0, ay: 0 };
let targetGoalX = 0, targetGoalY = 0;
let selectedShotCost = 1;
let powerCursorPos = 0, powerDirection = 1, selectedPower = 50; 
let animStartX = 0, animStartY = 0, animEndX = 0, animEndY = 0, animProgress = 0;
let shotOutcome = 'GOAL'; 

let cursor = { pos: 0, speed: 1.2, direction: 1 };
const targetZone = { pos: 50, greenWidth: 8, yellowWidth: 16 };
let timeLeft = 10.0;
let lastFrameTime = performance.now();

// --- СТАРТ И МЕНЮ ---
function initMenu() {
    gameState = 'MENU';
    uiLayer.style.display = 'none';
    gameOverScreen.style.display = 'none';
    mainMenu.style.display = 'flex';
}

function startNewGame() {
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
    if(uiRespectScore) uiRespectScore.innerText = respect;
    
    let hearts = '';
    for(let i=0; i<lives; i++) hearts += '❤️';
    for(let i=0; i<(3-lives); i++) hearts += '🖤';
    if(uiLivesCount) uiLivesCount.innerText = hearts;

    // Обновляем буквы КОЗЁЛ
    for(let i=0; i<5; i++) {
        let letterSpan = document.getElementById(`k-${i}`);
        if(letterSpan) {
            if(i < kozelLetters) letterSpan.classList.add('active');
            else letterSpan.classList.remove('active');
        }
    }
}

// Управление рекордами
function saveRecord(newRespect, timeTaken) {
    let bestRespect = localStorage.getItem('kozel_respect') || 0;
    let bestTime = localStorage.getItem('kozel_time') || 9999;
    
    if(newRespect > bestRespect) localStorage.setItem('kozel_respect', newRespect);
    if(timeTaken < bestTime) localStorage.setItem('kozel_time', timeTaken);
}

// Кнопки Главного Меню
document.getElementById('btn-menu-start').addEventListener('click', startNewGame);
document.getElementById('btn-menu-exit').addEventListener('click', () => tg.close());

document.getElementById('btn-menu-rules').addEventListener('click', () => {
    document.getElementById('modal-rules').style.display = 'block';
});
document.getElementById('btn-menu-records').addEventListener('click', () => {
    document.getElementById('rec-respect').innerText = localStorage.getItem('kozel_respect') || 0;
    let bTime = localStorage.getItem('kozel_time');
    document.getElementById('rec-time').innerText = bTime ? bTime : "--";
    document.getElementById('modal-records').style.display = 'block';
});
document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => e.target.parentElement.style.display = 'none');
});

// Кнопки Экрана Конца Игры
document.getElementById('btn-end-retry').addEventListener('click', startNewGame);
document.getElementById('btn-end-home').addEventListener('click', initMenu);


function getGoalBounds() {
    const goalWidth = Math.min(canvas.width * 0.7, 450);
    const goalHeight = 120;
    const goalX = (canvas.width - goalWidth) / 2;
    const goalY = canvas.height * 0.1;
    return { x: goalX, y: goalY, width: goalWidth, height: goalHeight };
}

// --- ФАЗА 1: ПРИЕМ ---
function startReception() {
    if (lives <= 0) return processGameOver(false);
    if (kozelLetters >= 5) return processGameOver(true);
    
    gameState = 'RECEPTION';
    timeLeft = 10.0;
    
    ball.x = canvas.width * 0.5; ball.y = canvas.height * 0.15; ball.size = 10;
    ball.vy = ((canvas.height * 0.7) - ball.y) / (10 * 60); 
    ball.vx = (Math.random() - 0.5) * 2;
    ball.sizeSpeed = (35 - 10) / (10 * 60); 
    ball.ay = 0; 

    cursor.pos = Math.random() * 100;
    cursor.speed = 1.2 + (3 - lives) * 0.3; 
    
    uiTimingContainer.style.display = 'block';
    uiJuggling.style.display = 'none';
    shotMenu.style.display = 'none';
    powerContainer.style.display = 'none';
    
    document.getElementById('timing-target-green').style.left = `${targetZone.pos}%`;
    document.getElementById('timing-target-green').style.width = `${targetZone.greenWidth}%`;
    document.getElementById('timing-target-green').style.transform = 'translateX(-50%)';
    document.getElementById('timing-target-yellow-left').style.left = `${targetZone.pos - (targetZone.greenWidth/2) - targetZone.yellowWidth}%`;
    document.getElementById('timing-target-yellow-left').style.width = `${targetZone.yellowWidth}%`;
    document.getElementById('timing-target-yellow-right').style.left = `${targetZone.pos + (targetZone.greenWidth/2)}%`;
    document.getElementById('timing-target-yellow-right').style.width = `${targetZone.yellowWidth}%`;

    uiMessage.innerText = "ПРИЕМ!";
    uiMessage.style.color = "#fff";
}

// --- ФАЗА 2: ЧЕКАНКА ---
function startJuggling(isPerfect) {
    gameState = 'JUGGLING';
    jugglingCount = 0;
    btnShoot.style.display = 'none'; 
    uiTimingContainer.style.display = 'none';
    uiJuggling.style.display = 'flex';
    
    if (isPerfect) { respect += 50; updateUI(); }
    uiMessage.innerText = isPerfect ? "ИДЕАЛЬНЫЙ ПРИЕМ! +50\nНАЧЕКАНЬ МИНИМУМ 3 РАЗА!" : "НАЧЕКАНЬ МИНИМУМ 3 РАЗА!";
    uiMessage.style.color = isPerfect ? "#00ff00" : "#FFC107";

    ball.size = 35; ball.y = canvas.height * 0.5; ball.x = canvas.width / 2;
    ball.vy = -7; ball.vx = (Math.random() - 0.5) * 6; ball.ay = 0.35; 
}

function hitBall(foot) {
    if (gameState !== 'JUGGLING' || ball.y >= groundLevel) return; 

    const centerX = canvas.width / 2;
    const isCenter = Math.abs(ball.x - centerX) <= 30;
    const isLeft = ball.x < centerX - 30;
    const isRight = ball.x > centerX + 30;

    if (isCenter || (foot === 'left' && isLeft) || (foot === 'right' && isRight)) {
        respect += 10; jugglingCount++; updateUI();
        ball.vy = -11 - Math.random() * 3; ball.vx = (Math.random() - 0.5) * 10; 
        
        if (jugglingCount >= 3) {
            btnShoot.style.display = 'flex'; 
            uiMessage.innerText = "МОЖНО БИТЬ ИЛИ НАБИВАТЬ!";
        } else {
            uiMessage.innerText = `НАБИТО: ${jugglingCount}/3`;
        }
        uiMessage.style.color = "#00ff00";
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    } else { loseLife("НЕ ТУ НОГУ НАЖАЛ!"); }
}

document.getElementById('btn-left').addEventListener('pointerdown', () => hitBall('left'));
document.getElementById('btn-right').addEventListener('pointerdown', () => hitBall('right'));
btnShoot.addEventListener('pointerdown', () => { if (gameState === 'JUGGLING') startAimingPhase(); });

// --- ФАЗА 3.1: ПРИЦЕЛИВАНИЕ ---
function startAimingPhase() {
    gameState = 'AIMING';
    uiJuggling.style.display = 'none';
    ball.vy = 0; ball.ay = 0; ball.vx = 0;
    uiMessage.innerText = "ТАПНИ ПО ВОРОТАМ, ЧТОБЫ ВЫБРАТЬ ТОЧКУ УДАРА!";
    uiMessage.style.color = "#ffcc00";
}

document.querySelectorAll('.shot-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        selectedShotCost = parseInt(e.target.getAttribute('data-cost'));
        shotMenu.style.display = 'none';
        startPowerPhase();
    });
});

// --- ФАЗА 3.2: ШКАЛА СИЛЫ ---
function startPowerPhase() {
    gameState = 'POWER';
    powerContainer.style.display = 'flex';
    powerCursorPos = 0; powerDirection = 1;
    uiMessage.innerText = "ЖМИ ЭКРАН, ЧТОБЫ ОСТАНОВИТЬ СИЛУ!";
    uiMessage.style.color = "#fff";
}

function confirmPower() {
    if (gameState !== 'POWER') return;
    selectedPower = powerCursorPos; 
    powerContainer.style.display = 'none';
    startShotAnimation();
}

// --- ФАЗА 3.3: АНИМАЦИЯ ---
function startShotAnimation() {
    gameState = 'SHOT_ANIMATION';
    uiMessage.innerText = "УДАР!";
    uiMessage.style.color = "#ffff00";
    animStartX = ball.x; animStartY = ball.y; animProgress = 0;

    let accuracyRoll = Math.floor(Math.random() * 100) + 1;
    const gb = getGoalBounds();

    if (accuracyRoll <= 10) {
        shotOutcome = 'MISS_BALL'; ball.vy = 0; ball.ay = 0.5;
    } else if (accuracyRoll <= 30) {
        shotOutcome = 'OFF_TARGET';
        animEndX = targetGoalX + (targetGoalX > gb.x + gb.width / 2 ? 150 : -150); 
        animEndY = gb.y - 100;
    } else if (accuracyRoll <= 70) {
        shotOutcome = 'SAVE'; animEndX = targetGoalX; animEndY = targetGoalY;
    } else {
        shotOutcome = 'GOAL'; animEndX = targetGoalX; animEndY = targetGoalY;
    }
}

function finishShot() {
    let resultMsg = "";
    if (shotOutcome === 'GOAL') {
        resultMsg = "ГОЛ!";
        uiMessage.style.color = "#00ff00";
        kozelLetters += selectedShotCost; // Начисляем буквы!
        updateUI();
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } else if (shotOutcome === 'SAVE') {
        resultMsg = "ВРАТАРЬ ПОТАЩИЛ МЯЧ!";
        uiMessage.style.color = "#FFC107";
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
        return loseLife("ВРАТАРЬ ВЗЯЛ УДАР!");
    } else if (shotOutcome === 'OFF_TARGET') {
        resultMsg = "МИМО ВОРОТ!";
        uiMessage.style.color = "#ff3333";
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        return loseLife("НЕ ПОПАЛ В СТВОР!");
    } else if (shotOutcome === 'MISS_BALL') {
        resultMsg = "ПРОМАХ ПО МЯЧУ!";
        uiMessage.style.color = "#ff3333";
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        return loseLife("НЕ ПОПАЛ ПО МЯЧУ!");
    }
    
    gameState = 'RESULT';
    uiMessage.innerText = resultMsg;
    setTimeout(startReception, 2000);
}

// --- КОНЕЦ ИГРЫ ---
function loseLife(msg) {
    lives--; updateUI();
    gameState = 'RESULT';
    uiTimingContainer.style.display = 'none'; uiJuggling.style.display = 'none';
    shotMenu.style.display = 'none'; powerContainer.style.display = 'none';
    uiMessage.innerText = `${msg}\nМИНУС ЖИЗНЬ!`; uiMessage.style.color = "#ff3333";
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    setTimeout(startReception, 2000);
}

function processGameOver(isWin) {
    gameState = 'GAMEOVER';
    uiLayer.style.display = 'none'; // Прячем интерфейс
    gameOverScreen.style.display = 'flex'; // Показываем меню конца
    
    if (isWin) {
        let timeTaken = Math.floor((performance.now() - gameStartTime) / 1000);
        endTitle.innerText = "ПОБЕДА!";
        endTitle.style.color = "#00ff00";
        endDesc.innerHTML = `Ты наказал вратаря!<br>Он стал КОЗЛОМ за ${timeTaken} сек.<br>Твой респект: ${respect}`;
        saveRecord(respect, timeTaken);
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } else {
        endTitle.innerText = "ПОРАЖЕНИЕ";
        endTitle.style.color = "#ff3333";
        endDesc.innerHTML = `У тебя кончились попытки.<br>Твой респект: ${respect}`;
        saveRecord(respect, 9999);
    }
}

// --- ИГРОВОЙ ЦИКЛ ---
function gameLoop(currentTime) {
    const dt = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    // Рисуем фон (Двор и Ворота)
    ctx.fillStyle = '#4CAF50'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#607D8B'; ctx.fillRect(0, 0, canvas.width, canvas.height * 0.35);
    const gb = getGoalBounds();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(gb.x, gb.y, gb.width, gb.height);

    // Если мы в меню, дальше логику не крутим, просто рисуем фон двора
    if (gameState === 'MENU' || gameState === 'GAMEOVER') {
        requestAnimationFrame(gameLoop);
        return;
    }

    if (gameState === 'RECEPTION') {
        ball.y += ball.vy; ball.x += ball.vx; ball.size += ball.sizeSpeed;
        cursor.pos += cursor.speed * cursor.direction;
        if (cursor.pos >= 100) { cursor.pos = 100; cursor.direction = -1; } 
        else if (cursor.pos <= 0) { cursor.pos = 0; cursor.direction = 1; }
        if (uiCursor) uiCursor.style.left = `${cursor.pos}%`;

        timeLeft -= dt;
        if (uiTimer) { uiTimer.innerText = Math.max(0, timeLeft).toFixed(1) + "s"; uiTimer.style.color = timeLeft <= 3 ? "#ff3333" : "#ffcc00"; }
        if (timeLeft <= 0) loseLife("ВРЕМЯ ВЫШЛО!");
    }

    if (gameState === 'JUGGLING') {
        ball.vy += ball.ay; ball.x += ball.vx; ball.y += ball.vy;
        if (ball.x < ball.size) { ball.x = ball.size; ball.vx *= -0.8; }
        if (ball.x > canvas.width - ball.size) { ball.x = canvas.width - ball.size; ball.vx *= -0.8; }

        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; ctx.fillRect(0, groundLevel, canvas.width, 4);
        if (ball.y + (ball.size/2) > groundLevel) loseLife("МЯЧ УПАЛ НА ЗЕМЛЮ!");
    }

    if (gameState === 'SELECT_SHOT' || gameState === 'POWER') {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'; ctx.beginPath(); ctx.arc(targetGoalX, targetGoalY, 14, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(targetGoalX - 8, targetGoalY); ctx.lineTo(targetGoalX + 8, targetGoalY); ctx.moveTo(targetGoalX, targetGoalY - 8); ctx.lineTo(targetGoalX, targetGoalY + 8); ctx.stroke();
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
            ball.vy += ball.ay; ball.y += ball.vy;
            if (ball.y >= groundLevel) finishShot();
        } else {
            animProgress += speedMultiplier;
            if (animProgress >= 1) { animProgress = 1; finishShot(); }
            ball.x = animStartX + (animEndX - animStartX) * animProgress; ball.y = animStartY + (animEndY - animStartY) * animProgress;
            ball.size = 35 - (35 - 10) * animProgress;
        }
    }

    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();

    requestAnimationFrame(gameLoop);
}

// Тапы по экрану
window.addEventListener('pointerdown', (e) => {
    if (gameState === 'MENU' || gameState === 'GAMEOVER') return;
    if (e.target.tagName === 'BUTTON' || e.target.closest('#shot-menu') || e.target.closest('#power-container')) return; 

    if (gameState === 'RECEPTION') {
        const gL = targetZone.pos - (targetZone.greenWidth / 2);
        const gR = targetZone.pos + (targetZone.greenWidth / 2);
        const yL = gL - targetZone.yellowWidth;
        const yR = gR + targetZone.yellowWidth;
        if (cursor.pos >= gL && cursor.pos <= gR) {
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium'); startJuggling(true); 
        } else if (cursor.pos >= yL && cursor.pos <= yR) {
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); startJuggling(false);
        } else loseLife("СОРВАЛ ТАЙМИНГ!");
        return;
    }

    if (gameState === 'AIMING') {
        const gb = getGoalBounds();
        if (e.clientX >= gb.x && e.clientX <= gb.x + gb.width && e.clientY >= gb.y && e.clientY <= gb.y + gb.height) {
            targetGoalX = e.clientX; targetGoalY = e.clientY;
            gameState = 'SELECT_SHOT'; shotMenu.style.display = 'block';
            uiMessage.innerText = "ВЫБЕРИ ТИП УДАРА"; uiMessage.style.color = "#ffcc00";
            if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
        }
        return;
    }

    if (gameState === 'POWER') { confirmPower(); return; }
});

// Запуск (теперь игра стартует с меню)
initMenu();
requestAnimationFrame(gameLoop);