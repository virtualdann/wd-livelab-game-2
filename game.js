// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Load Audio
let isMute = false;
const jumpSound = new Audio('assets/jump.mp3');
jumpSound.volume = 0.3;
const collectSound = new Audio('assets/collect.mp3');
const gameOverSound = new Audio('assets/game-over.mp3');

// Load background mountains
const bgMountain = new Image();
bgMountain.src = 'assets/background/background.png';
const fgMountain = new Image();
fgMountain.src = 'assets/background/foreground.png';
const cloud = new Image();
cloud.src = 'assets/background/cloud.png';
let cloudLoaded = false;

cloud.onload = () => {
    cloudLoaded = true;
    drawBackground();
    drawCharacter();
};

cloud.onerror = () => {
    console.warn('Failed to load cloud image');
    cloudLoaded = false;
};

let bgMountainX = 0;
let fgMountainX = 0;
let cloudX = 0;
let clouds = [];

// Load Player Sprite
const playerSprite = new Image();
playerSprite.src = 'assets/player_sprite.png';
let playerSpriteLoaded = false;

playerSprite.onload = () => {
    playerSpriteLoaded = true;
    // Re-render initial screen with sprite
    drawBackground();
    drawCharacter();
};

playerSprite.onerror = () => {
    console.warn('Failed to load player sprite, using fallback rectangle');
    playerSpriteLoaded = false;
};

// Game State
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
let dropletsCollected = 0;
let highScore = localStorage.getItem('highScore') || 0;
let gameSpeed = 3;
let gameTime = 0;
let lastSpeedIncrease = 0;

// Character
const character = {
    x: 120, // 15% from left of 800px canvas
    y: 520, // Ground level
    width: 60,
    height: 60,
    velocityY: 0,
    isOnGround: true,
    isHovering: false,
    gravity: 0.2,
    jumpForce: -2,
    hoverForce: 0.3,
    groundY: 520
};

// Game Objects Arrays
let obstacles = [];
let droplets = [];

// Spawn Timers
let obstacleSpawnTimer = 0;
let dropletSpawnTimer = 0;
let cloudSpawnTimer = 0;
let obstacleSpawnInterval = 180;
let dropletSpawnInterval = 90;
let cloudSpawnInterval = 600;

// Input State
let isInputActive = false;

// charity: water Facts
const charityFacts = [
    "771 million people lack access to clean water",
    "Women spend 200 million hours every day collecting water",
    "charity: water has funded 100,000+ water projects worldwide",
    "1 in 10 people worldwide lack access to safe water",
    "Every $1 invested in water and sanitation brings $4 in economic returns",
    "Children miss school because of water-related illnesses",
    "charity: water funds projects in 29 countries around the world"
];

// charity: water Images
const charityImages = [
    'assets/charity_water_images/file1.jpg',
    'assets/charity_water_images/file2.jpeg',
    'assets/charity_water_images/file3.jpeg',
    'assets/charity_water_images/file4.jpeg'
];

// UI Elements
const startScreen = document.getElementById('startScreen');
const gameContainer = document.getElementById('gameContainer');
const gameOverScreen = document.getElementById('gameOverScreen');
const startButton = document.getElementById('startButton');
const playAgainButton = document.getElementById('playAgainButton');
const scoreDisplay = document.getElementById('scoreDisplay');
const dropletsDisplay = document.getElementById('dropletsDisplay');
const muteButton = document.getElementById('muteButton');

// Event Listeners
startButton.addEventListener('click', startGame);
playAgainButton.addEventListener('click', restartGame);
muteButton.addEventListener('click', () => {
    isMute = !isMute;
    muteButton.textContent = isMute ? '🔇' : '🔊';
});

// Input Event Listeners (Mouse and Touch)
canvas.addEventListener('mousedown', handleInputStart);
canvas.addEventListener('mouseup', handleInputEnd);
canvas.addEventListener('touchstart', handleInputStart);
canvas.addEventListener('touchend', handleInputEnd);

// Keyboard Input (Spacebar)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameState === 'playing') {
        e.preventDefault();
        handleInputStart();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && gameState === 'playing') {
        e.preventDefault();
        handleInputEnd();
    }
});

function handleInputStart(e) {
    if (e) e.preventDefault();
    if (gameState !== 'playing') return;

    isInputActive = true;

    // Jump if on ground
    if (character.isOnGround) {
        character.velocityY = character.jumpForce;
        character.isOnGround = false;

        if (!isMute) {
            jumpSound.currentTime = 0;
            jumpSound.play();
        }
    }
    // Start hovering if in air
    character.isHovering = true;
}

function handleInputEnd(e) {
    if (e) e.preventDefault();
    if (gameState !== 'playing') return;

    isInputActive = false;
    character.isHovering = false;
}

function startGame() {
    gameState = 'playing';
    startScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    resetGame();
    gameLoop();
}

function restartGame() {
    gameState = 'playing';
    gameOverScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    resetGame();
    gameLoop();
}

function resetGame() {
    // Reset character
    character.y = character.groundY;
    character.velocityY = 0;
    character.isOnGround = true;
    character.isHovering = false;

    // Reset game variables
    score = 0;
    dropletsCollected = 0;
    gameSpeed = 3;
    gameTime = 0;
    lastSpeedIncrease = 0;

    // Clear arrays
    obstacles = [];
    droplets = [];
    clouds = [];

    fgMountainX = 0;
    bgMountainX = 0;

    // Reset timers
    obstacleSpawnTimer = 0;
    dropletSpawnTimer = 0;
    cloudSpawnTimer = 0;
    obstacleSpawnInterval = 180;
    dropletSpawnInterval = 90;
    cloudSpawnInterval = 600;

    // Reset input
    isInputActive = false;

    updateHUD();
}

function updatePhysics() {
    // Apply gravity
    character.velocityY += character.gravity;

    // Apply hover force
    if (character.isHovering && !character.isOnGround) {
        character.velocityY -= character.hoverForce;
    }

    // Update position
    character.y += character.velocityY;

    // Ground collision
    if (character.y >= character.groundY) {
        character.y = character.groundY;
        character.velocityY = 0;
        character.isOnGround = true;
    } else {
        character.isOnGround = false;
    }

    // Ceiling collision
    if (character.y < 0) {
        character.y = 0;
        character.velocityY = 0;
    }
}

function spawnObstacle() {
    const obstacleType = Math.random() > 0.5 ? 'rock' : 'barrel';

    const obstacle = {
        type: obstacleType,
        x: 800,
        width: obstacleType === 'rock' ? 50 : 40,
        height: obstacleType === 'rock' ? 40 : 50
    };

    // Rocks are always on ground, barrels can be mid-air
    if (obstacleType === 'rock') {
        obstacle.y = 560 - obstacle.height; // Ground level
    } else {
        // Random height for barrels (200-500px)
        obstacle.y = Math.random() * 300 + 200;
    }

    obstacles.push(obstacle);
}

function spawnDroplet() {
    const droplet = {
        x: 800,
        y: Math.random() * 350 + 50, // 50px to 400px
        width: 20,
        height: 20
    };

    droplets.push(droplet);
}

function spawnCloud() {
    const cloud = {
        x: 800,
        y: Math.random() * 100 + 20,
        width: 300,
        height: 100
    };

    clouds.push(cloud);
}

function updateGameObjects() {
    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= gameSpeed;

        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
        }
    }

    // Update droplets
    for (let i = droplets.length - 1; i >= 0; i--) {
        droplets[i].x -= gameSpeed;

        if (droplets[i].x + droplets[i].width < 0) {
            droplets.splice(i, 1);
        }
    }

    // Update background 
    for (let i = clouds.length - 1; i >= 0; i--) {
        clouds[i].x -= gameSpeed * 0.2;

        if (clouds[i].x + clouds[i].width < 0) {
            clouds.splice(i, 1);
        }
    }
    fgMountainX -= gameSpeed * 0.7;
    bgMountainX -= gameSpeed * 0.4;

    if (cloudX <= -canvas.width) cloudX = 0;
    if (fgMountainX <= -canvas.width) fgMountainX = 0;
    if (bgMountainX <= -canvas.width) bgMountainX = 0;
}

function checkCollisions() {
    // Character hitbox (80% of sprite for forgiveness)
    const charHitbox = {
        x: character.x + character.width * 0.1,
        y: character.y + character.height * 0.1,
        width: character.width * 0.8,
        height: character.height * 0.8
    };

    // Check obstacle collisions
    for (let obstacle of obstacles) {
        if (checkBoxCollision(charHitbox, obstacle)) {
            endGame();
            return;
        }
    }

    // Check droplet collisions
    for (let i = droplets.length - 1; i >= 0; i--) {
        if (checkBoxCollision(charHitbox, droplets[i])) {
            score += 10;
            dropletsCollected++;
            droplets.splice(i, 1);
            
            if (!isMute) {
                collectSound.currentTime = 0;
                collectSound.play()
            }
            
            updateHUD();
        }
    }
}

function checkBoxCollision(box1, box2) {
    return box1.x < box2.x + box2.width &&
           box1.x + box1.width > box2.x &&
           box1.y < box2.y + box2.height &&
           box1.y + box1.height > box2.y;
}

function updateDifficulty() {
    gameTime++;

    // Increase score for time survived (1 point per second = 60 frames)
    if (gameTime % 60 === 0) {
        score++;
        updateHUD();
    }

    // Speed increase every 10 seconds (600 frames)
    if (gameTime - lastSpeedIncrease >= 600 && gameSpeed < 7) {
        gameSpeed += 0.5;
        lastSpeedIncrease = gameTime;
    }

    // Obstacle spawn rate increase
    if (gameTime > 1800 && gameTime <= 3600) { // 30-60 seconds
        obstacleSpawnInterval = 150; // 2.5 seconds
    } else if (gameTime > 3600) { // After 60 seconds
        obstacleSpawnInterval = 120; // 2 seconds
    }
}

function updateSpawning() {
    // Spawn obstacles
    obstacleSpawnTimer++;
    if (obstacleSpawnTimer >= obstacleSpawnInterval) {
        spawnObstacle();
        obstacleSpawnTimer = 0;
        // Add randomness to spawn interval
        obstacleSpawnInterval = Math.random() * 60 + (gameTime > 3600 ? 90 : 120);
    }

    // Spawn droplets
    dropletSpawnTimer++;
    if (dropletSpawnTimer >= dropletSpawnInterval) {
        spawnDroplet();
        dropletSpawnTimer = 0;
        // Add randomness
        dropletSpawnInterval = Math.random() * 30 + 60;
    }

    // Spawn clouds
    cloudSpawnTimer++;
    if (cloudSpawnTimer >= cloudSpawnInterval) {
        spawnCloud();
        cloudSpawnTimer = 0;
        // Randomize next cloud spawn
        cloudSpawnInterval = Math.random() * 400 + 200;
    }


}

function updateHUD() {
    scoreDisplay.textContent = `Score: ${score}`;
    dropletsDisplay.textContent = `💧 x ${dropletsCollected}`;
}

function drawBackground() {
    // Green background - charity: water Green
    ctx.fillStyle = '#FFC907';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(bgMountain, bgMountainX, 0, canvas.width, canvas.height);
    ctx.drawImage(bgMountain, bgMountainX + canvas.width, 0, canvas.width, canvas.height);
    
    
    ctx.drawImage(fgMountain, fgMountainX, 0, canvas.width, canvas.height);
    ctx.drawImage(fgMountain, fgMountainX + canvas.width, 0, canvas.width, canvas.height);
    
    if (cloudLoaded) {
        for (let c of clouds) {
            ctx.drawImage(cloud, c.x, c.y, 300, 100);
        }
    }
    
    // Ground line - charity: water Dark Green
    ctx.fillStyle = '#159A48';
    ctx.fillRect(0, 560, canvas.width, 40);
}

function drawCharacter() {
    if (playerSpriteLoaded) {
        // Draw player sprite
        ctx.drawImage(playerSprite, character.x, character.y, character.width, character.height);
    } else {
        // Fallback: charity: water Blue rectangle
        ctx.fillStyle = '#2E9DF7';
        ctx.fillRect(character.x, character.y, character.width, character.height);

        // Draw simple eyes
        ctx.fillStyle = 'white';
        ctx.fillRect(character.x + 8, character.y + 10, 8, 8);
        ctx.fillRect(character.x + 24, character.y + 10, 8, 8);
    }
}

function drawObstacles() {
    for (let obstacle of obstacles) {
        if (obstacle.type === 'rock') {
            ctx.fillStyle = '#757575';
        } else {
            ctx.fillStyle = '#212121';
        }
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

        // Add simple detail for barrels
        if (obstacle.type === 'barrel') {
            ctx.strokeStyle = '#424242';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(obstacle.x, obstacle.y + 15);
            ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + 15);
            ctx.moveTo(obstacle.x, obstacle.y + 35);
            ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + 35);
            ctx.stroke();
        }
    }
}

function drawDroplets() {
    for (let droplet of droplets) {
        // Draw water droplet emoji
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💧', droplet.x + droplet.width, droplet.y + droplet.height);
    }
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawDroplets();
    drawObstacles();
    drawCharacter();
}

function endGame() {
    if (gameState === 'gameOver') return;

    if (!isMute) {
        gameOverSound.currentTime = 0;
        gameOverSound.play();
    }

    gameState = 'gameOver';
    gameContainer.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');

    // Update high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
    }

    // Calculate impact: 1 droplet = 1 liter of water
    // A person needs ~6 liters (6 l) per day for drinking in water scarce areas
    // Calculate how many people can get water for one day
    const totalLiter = dropletsCollected;
    const literPerPersonPerDay = 6;
    const peopleForOneDay = Math.floor(totalLiter / literPerPersonPerDay);

    // If less than 3 kg, show hours instead
    let impactText;
    if (totalLiter < literPerPersonPerDay) {
        const hours = Math.floor((totalLiter / literPerPersonPerDay) * 24);
        impactText = `You collected ${totalLiter} liters of water! Enough supply for 1 person for ${hours} ${hours === 1 ? 'hour' : 'hours'}!`;
    } else if (peopleForOneDay === 1) {
        impactText = `You collected ${totalLiter} liters of water! Enough supply for 1 person for 1 day!`;
    } else {
        impactText = `You collected ${totalLiter} liters of water! Enough supply for ${peopleForOneDay} people for 1 day!`;
    }

    // Select random charity: water image
    const randomImage = charityImages[Math.floor(Math.random() * charityImages.length)];
    document.getElementById('charityImage').src = randomImage;

    // Update game over screen
    document.getElementById('impactMessage').textContent = impactText;

    // Random charity fact
    const randomFact = charityFacts[Math.floor(Math.random() * charityFacts.length)];
    document.getElementById('charityFact').textContent = randomFact;

    // High score display
    document.getElementById('highScoreDisplay').textContent = `High Score: ${highScore}`;
}

function gameLoop() {
    if (gameState !== 'playing') return;

    updatePhysics();
    updateGameObjects();
    updateSpawning();
    updateDifficulty();
    checkCollisions();
    render();

    requestAnimationFrame(gameLoop);
}

// Initial render on start screen
drawBackground();
drawCharacter();
