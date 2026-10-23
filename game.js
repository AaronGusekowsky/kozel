const tg = window.Telegram.WebApp;
tg.expand();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const groundLevel = canvas.height - 220; 
const ceilingLevel = 90; 

// ЗАГРУЗКА АССЕТОВ ИЗ ПАПКИ ASSETS
const images = {
    bg: new Image(),
    goals: new Image(),
    gk: new Image(),
    ball: new Image(),
    feet: new Image()
};

images.bg.src = 'assets/bg.png';
images.goals.src = 'assets/goals.png';
images.gk.src = 'assets/gk.png';
images.ball.src = 'assets/ball.png';
images.feet.src = 'assets/feet.png';

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

let lives = 3;
let respect = 0;
let jugglingCount = 0; 
let kozelLetters = 0; 
let gameStartTime = 0;
let gameState = 'MENU'; 

let ball = { x: 0, y: 0, size: 20, vx: 0, vy: 0, sizeSpeed: 0, ax: 0, ay: 0 };
let targetGoalX = 0, targetGoalY = 0;
let selectedShotCost = 1;
let powerCursorPos = 0, powerDirection = 1, selectedPower = 50; 
let animStartX = 0, animStartY = 0, animEndX = 0, animEndY = 0, animProgress = 0;
let shotOutcome = 'GOAL'; 

// Переменные вратаря
let gkX = 0;
let gkWidth = 60;
let gkHeight = 70;
let gkAnimStartX = 0;
let gkAnimEndX = 0;

let cursor = { pos: 0, speed: 1.2, direction: 1 };
const targetZone = { pos: 50, greenWidth: 8, yellowWidth: 16 };
let timeLeft = 10.0;
let lastFrameTime = performance.now();

function getGoalBounds() {
    const goalWidth = Math.min(canvas.width * 0.75, 480);
    const goalHeight = 160;
    const goalX = (canvas.width - goalWidth) / 2;
    const goalY = canvas.height * 0.12;
    return { x: goalX, y: goalY, width: goalWidth, height: goalHeight };
}

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
    if (uiRespectScore) uiRespectScore.innerText = respect;
    let hearts = '';
    for (let i = 0; i < lives; i++) hearts += '❤️';
    for (let i = 0; i < (3 - lives); i++) hearts += '🖤';
    if (uiLivesCount) uiLivesCount.innerText = hearts;
    for (let i = 0; i < 5; i++) {
        let letterSpan = document.getElementById(`k-${i}`);
        if (letterSpan) {
            if (i < kozelLetters) letterSpan.classList.add('active');
            else letterSpan.classList.remove('active');
        }
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
    document.getElementById('modal-records').style.display = 'none';
    document.getElementById('modal-rules').style.display = 'block';
});
document.getElementById('btn-menu-records').addEventListener('click', () => {
    document.getElementById('modal-rules').style.display = 'none';
    document.getElementById('rec-respect').innerText = localStorage.getItem('kozel_respect') || 0;
    let bTime = localStorage.getItem('kozel_time');
    document.getElementById('rec-time').innerText = bTime ? bTime : "--";
    document.getElementById('modal-records').style.display = 'block';
});
document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => e.target.parentElement.style.display = 'none');
});
document.getElementById('btn-end-retry').addEventListener('click', startNewGame);
document.getElementById('btn-end-home').addEventListener('click', initMenu);

function startReception() {
    if (lives <= 0) return processGameOver(false);
    if (kozelLetters >= 5) return processGameOver(true);
    
    gameState = 'RECEPTION';
    timeLeft = 10.0;
    
    ball.x = canvas.width * 0.5;
    ball.y = canvas.height * 0.15;
    ball.size = 15;
    ball.vy = ((canvas.height * 0.7) - ball.y) / (10 * 60); 
    ball.vx = (Math.random() - 0.5) * 2;
    ball.sizeSpeed = (35 - 15) / (10 * 60); 
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
    document.getElementById('timing-target-yellow-left').style.left = `${targetZone.pos - (targetZone.greenWidth / 2) - targetZone.yellowWidth}%`;
    document.getElementById('timing-target-yellow-left').style.width = `${targetZone.yellowWidth}%`;
    document.getElementById('timing-target-yellow-right').style.left = `${targetZone.pos + (targetZone.greenWidth / 2)}%`;
    document.getElementById('timing-target-yellow-right').style.width = `${targetZone.yellowWidth}%`;

    uiMessage.innerText = "ПРИЕМ!";
    uiMessage.style.color = "#fff";
}

function startJuggling(isPerfect) {
    gameState = 'JUGGLING';
    jugglingCount = 0;
    btnShoot.style.display = 'none';
    uiTimingContainer.style.display = 'none';
    uiJuggling.style.display = 'flex';
    if (isPerfect) { respect += 50; updateUI(); }
    uiMessage.innerText = isPerfect ? "ИДЕАЛЬНЫЙ ПРИЕМ! +50\nНАЧЕКАНЬ МИНИМУМ 3 РАЗА!" : "НАЧЕКАНЬ МИНИМУМ 3 РАЗА!";
    uiMessage.style.color = isPerfect ? "#00ff00" : "#FFC107";

    ball.size = 35;
    ball.y = canvas.height * 0.5;
    ball.x = canvas.width / 2;
    ball.vy = -7;
    ball.vx = (Math.random() - 0.5) * 6;
    ball.ay = 0.35; 
}

function hitBall(foot) {
    if (gameState !== 'JUGGLING' || ball.y >= groundLevel) return; 
    if (ball.y < canvas.height * 0.3) return;

    const centerX = canvas.width / 2;
    const isCenter = Math.abs(ball.x - centerX) <= 30;
    const isLeft = ball.x < centerX - 30;
    const isRight = ball.x > centerX + 30;

    if (isCenter || (foot === 'left' && isLeft) || (foot === 'right' && isRight)) {
        respect += 10;
        jugglingCount++;
        updateUI();
        
        let xPush = 4 + Math.random() * 5; 
        ball.vx = (foot === 'left') ? xPush : -xPush; 
        ball.ay += 0.015; 
        ball.vy = -9 - Math.random() * 2; 
        
        if (jugglingCount >= 3) {
            btnShoot.style.display = 'flex';
            uiMessage.innerText = "МОЖНО БИТЬ ИЛИ НАБИВАТЬ!";
        } else {
            uiMessage.innerText = `НАБИТО: ${jugglingCount}/3`;
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
    uiJuggling.style.display = 'none';
    ball.vy = 0; ball.ay = 0; ball.vx = 0;
    uiMessage.innerText = "ТАПНИ ПО ВОРОТАМ, ЧТОБЫ ВЫБРАТЬ ТОЧКУ УДАРА!";
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
    powerContainer.style.display = 'none