const tg = window.Telegram.WebApp;
tg.expand();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Уровень "земли" (красная линия смерти), находится чуть выше кнопок
const groundLevel = canvas.height - 160; 

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

// Состояние
let lives = 3;
let respect = 0;
let gameState = 'RECEPTION'; 

let ball = { x: 0, y: 0, size: 10, vx: 0, vy: 0, sizeSpeed: 0, ax: 0, ay: 0 };

const trajectories = [
    { name: "Прямой навес", startX: 0.5, vx: 0, vy: 1.2, sizeSpeed: 0.08, ax: 0 },
    { name: "Крученый левый", startX: 0.8, vx: -2.5, vy: 1.0, sizeSpeed: 0.07, ax: 0.02 },
    { name: "Крученый правый", startX: 0.2, vx: 2.5, vy: 1.0, sizeSpeed: 0.07, ax: -0.02 },
    { name: "Парашют", startX: 0.5, vx: 0, vy: 0.5, sizeSpeed: 0.04, ax: 0, ay: 0.015 },
    { name: "Пушка низом", startX: 0.5, vx: 0, vy: 2.5, sizeSpeed: 0.15, ax: 0 }
];

// Зоны (в процентах от шкалы)
let cursor = { pos: 0, speed: 3.5, direction: 1 };
const targetZone = { pos: 50, greenWidth: 6, yellowWidth: 15 }; // Желтая - по 15% с каждой стороны от зеленой

let timeLeft = 10.0;
let lastFrameTime = performance.now();

function startReception() {
    if (lives <= 0) return gameOver();
    
    gameState = 'RECEPTION';
    timeLeft = 10.0;
    
    const t = trajectories[Math.floor(Math.random() * trajectories.length)];
    ball.x = canvas.width * t.startX; ball.y = canvas.height * 0.2; ball.size = 10;
    ball.vx = t.vx; ball.vy = t.vy; ball.sizeSpeed = t.sizeSpeed;
    ball.ax = t.ax || 0; ball.ay = t.ay || 0;

    cursor.pos = Math.random() * 100;
    cursor.speed = 3.5 + (3 - lives) * 0.8; 
    
    uiTimingContainer.style.display = 'block';
    uiJuggling.style.display = 'none';
    
    // Позиционируем зеленую зону
    uiTargetGreen.style.left = `${targetZone.pos}%`;
    uiTargetGreen.style.width = `${targetZone.greenWidth}%`;
    uiTargetGreen.style.transform = 'translateX(-50%)';
    
    // Позиционируем левую желтую зону
    uiTargetYellowLeft.style.left = `${targetZone.pos - (targetZone.greenWidth/2) - targetZone.yellowWidth}%`;
    uiTargetYellowLeft.style.width = `${targetZone.yellowWidth}%`;
    
    // Позиционируем правую желтую зону
    uiTargetYellowRight.style.left = `${targetZone.pos + (targetZone.greenWidth/2)}%`;
    uiTargetYellowRight.style.width = `${targetZone.yellowWidth}%`;

    uiMessage.innerText = `ПРИЕМ! (${t.name})`;
    uiMessage.style.color = "#fff";
}

function startJuggling(isPerfect) {
    gameState = 'JUGGLING';
    uiTimingContainer.style.display = 'none';
    uiJuggling.style.display = 'block';
    
    if (isPerfect) {
        respect += 50;
        uiRespectScore.innerText = respect;
        uiMessage.innerText = "ИДЕАЛЬНЫЙ ПРИЕМ! +50 РЕСПЕКТА\nНАЧЕКАНЬ!";
        uiMessage.style.color = "#00ff00";
    } else {
        uiMessage.innerText = "КОРЯВЫЙ ПРИЕМ, НО ПОЙДЕТ.\nНАЧЕКАНЬ!";
        uiMessage.style.color = "#FFC107";
    }

    ball.size = 30; 
    ball.y = canvas.height * 0.5; 
    ball.x = canvas.width / 2;
    ball.vy = -6; 
    ball.vx = (Math.random() - 0.5) * 8; 
    ball.ay = 0.35; 
    ball.ax = 0; 
}

function hitBall(foot) {
    if (gameState !== 'JUGGLING') return;

    // Зона удара: нельзя бить, пока мяч высоко
    if (ball.y < groundLevel - 200) return; 

    const isLeft = ball.x <= canvas.width / 2;
    const isRight = ball.x > canvas.width / 2;

    if ((foot === 'left' && isLeft) || (foot === 'right' && isRight)) {
        respect += 10;
        uiRespectScore.innerText = respect;
        
        // Подкидываем мяч вверх
        ball.vy = -10 - Math.random() * 4; 
        ball.vx = (Math.random() - 0.5) * 12; 
        
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        uiMessage.innerText = "ХОРОШ!";
        uiMessage.style.color = "#00ff00";
    } else {
        loseLife("ПО НОГАМ СЕБЕ УДАРИЛ!");
    }
}

document.getElementById('btn-left').addEventListener('pointerdown', () => hitBall('left'));
document.getElementById('btn-right').addEventListener('pointerdown', () => hitBall('right'));

function loseLife(msg) {
    lives--;
    let hearts = '';
    for(let i=0; i<lives; i++) hearts += '❤️';
    for(let i=0; i<(3-lives); i++) hearts += '🖤';
    uiLivesCount.innerText = hearts;
    
    gameState = 'RESULT';
    uiTimingContainer.style.display = 'none';
    uiJuggling.style.display = 'none';
    uiMessage.innerText = `${msg}\nМИНУС ЖИЗНЬ!`;
    uiMessage.style.color = "#ff3333";
    
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    setTimeout(startReception, 2000);
}

function gameOver() {
    gameState = 'GAMEOVER';
    uiJuggling.style.display = 'none';
    uiMessage.innerText = `ИГРА ОКОНЧЕНА!\nТвой респект: ${respect}\nКликни для рестарта.`;
    uiMessage.style.color = "#ff3333";
}

function gameLoop(currentTime) {
    const dt = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    ctx.fillStyle = '#4CAF50'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#607D8B'; ctx.fillRect(0, 0, canvas.width, canvas.height * 0.4);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
    ctx.strokeRect(canvas.width * 0.3, canvas.height * 0.1, canvas.width * 0.4, canvas.height * 0.3);

    if (gameState === 'RECEPTION') {
        ball.vx += ball.ax; ball.vy += ball.ay; 
        ball.x += ball.vx; ball.y += ball.vy;
        ball.size += ball.sizeSpeed;

        cursor.pos += cursor.speed * cursor.direction;
        if (cursor.pos >= 100) { cursor.pos = 100; cursor.direction = -1; } 
        else if (cursor.pos <= 0) { cursor.pos = 0; cursor.direction = 1; }
        uiCursor.style.left = `${cursor.pos}%`;

        timeLeft -= dt;
        uiTimer.innerText = timeLeft.toFixed(1) + "s";
        uiTimer.style.color = timeLeft <= 3 ? "#ff3333" : "#ffcc00";

        if (timeLeft <= 0) loseLife("ВРЕМЯ ВЫШЛО!");
    }

    if (gameState === 'JUGGLING') {
        ball.vy += ball.ay; 
        ball.x += ball.vx; ball.y += ball.vy;

        if (ball.x < ball.size) { ball.x = ball.size; ball.vx *= -0.8; }
        if (ball.x > canvas.width - ball.size) { ball.x = canvas.width - ball.size; ball.vx *= -0.8; }

        // Отрисовка КРАСНОЙ ЛИНИИ СМЕРТИ
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.fillRect(0, groundLevel, canvas.width, 4);
        ctx.shadowBlur = 10; ctx.shadowColor = 'red';
        ctx.fillRect(0, groundLevel, canvas.width, 4);
        ctx.shadowBlur = 0; // Сброс тени

        // Пересечение мячом линии смерти
        if (ball.y + (ball.size/2) > groundLevel) {
            loseLife("МЯЧ УПАЛ НА ЗЕМЛЮ!");
        }
    }

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();

    requestAnimationFrame(gameLoop);
}

window.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('foot-btn')) return; 

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
            // Зеленая зона - Идеально
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
            startJuggling(true); 
        } else if (cursor.pos >= yellowLeft && cursor.pos <= yellowRight) {
            // Желтая зона - Нормально (без бонусов)
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            startJuggling(false);
        } else {
            // Промах (Красная зона)
            loseLife("СОРВАЛ ТАЙМИНГ ПРИЕМА!");
        }
    }
});

startReception();
requestAnimationFrame(gameLoop);