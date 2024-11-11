// game states
// main menu state
function menu() {
    
    //show the menu screen
    mainMenuScene.visible = true;
    gameScene.visible = false;
    gameOverScene.visible = false;
    restartButtonContainer.visible = false;

}

// play state
function play(delta) {

    let rotationValue = 0.2;
    let enemyVY = enemy.vy + enemyMoveSpeed;
    let enemyY = enemy.y;
    let despawnPoint = h;

    //use the player's velocity to make it move
    player.x += player.vx;
    player.y += player.vy;

    // min x = 70px | max x = 430px
    // min y = 100px | max y = 400px
    minBoundX = Math.round(app.renderer.width / 7.14);
    maxBoundX = Math.round(app.renderer.width / 1.162);
    minBoundY = Math.round(app.renderer.height / 5);
    maxBoundY = Math.round(app.renderer.height / 1.25);

    // stop player from going out of bounds
    // horizontal axis
    if (player.x <= minBoundX) {
        player.vx = 0;
        player.x = minBoundX;
    } else if (player.x >= maxBoundX) {
        player.vx = 0;
        player.x = maxBoundX;
    }
    
    // stop player from going out of bounds
    // vertical axis
    if (player.y <= minBoundY) {
        player.vy = 0;
        player.y = minBoundY;
    } else if (player.y >= maxBoundY) {
        player.vy = 0;
        player.y = maxBoundY;
    }

    enemy.rotation += 0.1;

    //move the enemy along the y axis and increase its size
    //to create the 3d effect of a object getting closer
    //despawn when enemy is too close
    if (enemyY >= despawnPoint && enemyIsAlive === true) {

        earnPointSfx.play();
        scoreMultiplier += 0.5;
        score += 100 * scoreMultiplier;
        enemyIsAlive = false;
        enemySize = 0.3;
        enemy.scale.set(enemySize, enemySize);
        enemy.x = spawnX(minSpawnX, maxSpawnX);
        enemy.y = spawnY;
        enemy.anchor.set(0.5, 0.4);
        gameScene.removeChild(enemy);

    } else if (enemyY < despawnPoint && enemyIsAlive === true) {
        
        enemy.y += enemyVY;
        enemy.scale.set(enemySize += 0.003, enemySize += 0.003);

    } else {

        enemyIsAlive = true;
        gameScene.addChildAt(enemy, 2);

    }

    scoreMultiplierLabel.text = "x" + scoreMultiplier;
    scoreLabel.text = score;
    endScoreMultiplierLabel.text = "x" + scoreMultiplier;
    endScoreLabel.text = score;
    
    //check for collision between player and enemy
    if (hitTestRectangle(player, enemy)) {

        bgm.pause();
        // planeSfx.pause();
        crashSfx.play();

        //if there's collision do these
        player.rotation += rotationValue;
        state = end;

    }

}

// game paused state
function pause() {

    app.stop();

}

// game over state
function end() {

    //launch the gameover scene
    score = -100;
    endScore = -100;
    scoreMultiplier = 0.5;
    endScoreMultiplier = 0.5;
    player.x = halfOfRendererWidth;
    player.y = halfOfRendererWidth;
    enemy.y = 500;
    enemyIsAlive = true;
    gameScene.visible = false;
    gameOverScene.visible = true;
    restartButtonContainer.visible = true;

}