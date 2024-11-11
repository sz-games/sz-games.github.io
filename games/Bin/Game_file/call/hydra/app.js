//Aliases
const Application = PIXI.Application,
      Container = PIXI.Container,
      Text = PIXI.Text,
      TextStyle = PIXI.TextStyle,
      loader = PIXI.loader,
      resources = PIXI.loader.resources,
      Texture = PIXI.Texture;
      TextureCache = PIXI.utils.TextureCache,
      Sprite = PIXI.Sprite,
      Rectangle = PIXI.Rectangle;

//variable declaration
// misc.
var maxWidth, maxHeight, loadingContainer, loadingLabel, textStyle;
let state, halfOfRendererWidth, menuTitleY, menuFirstBtnY, menuSecondBtnY,
    ingameTitleX, scoreMultiplierX, scoreX, topLabelY, pauseBtnLabelX, pauseBtnLabelY, pauseBtnX, pauseBtnY,
    mmBtnY, minBoundX, maxBoundX, minBoundY, maxBoundY, cloudPosY;
// sound
var bgm, crashSfx, buttonPressSfx, earnPointSfx, planeSfx;
// in-game screen
var gameScene, pauseMenu, score, scoreMultiplier, enemy, enemyIsAlive, enemySize, minSpawnX, maxSpawnX, spawnY;
let title, scoreLabel, scoreMultiplierLabel, player, playerMoveSpeed, pauseButtonContainer, pauseButton,
    pauseButtonLabel, pauseMenuBtnContainer, pauseMenuLabel, continueBtn, continueBtnLabel, mmBtn_2, mmLabel_2;
// game over screen
let gameOverScene, gameOverLabel, endTitle, endScoreLabel, endScoreMultiplierLabel, restartButtonContainerrestartButton, restartLabel;
// main menu screen
var mainMenuScene, aboutScene;
let mmTitle, mmBtnContainer, mmBtnPlay, mmPlayLabel, mmBtnAbout, mmAboutLabel, mmBtn, mmLabel,
    aboutParagraph, aboutBtnContainer, btnBack, btnBackLabel;

// get browser's width and height
let w = window.innerWidth;
let h = window.innerHeight;

//create a Pixi Application
const app = new Application({
    width: w, 
    height: h,
    autoResize: true,
    resolution: 1
    }
);

//add the canvas that Pixi automatically created for you to the HTML document
// center app by making its parent the div container
let container = document.getElementById("container");
container.appendChild(app.view);

// load texture and sound
loadStuff();

//this function sets the appropriate textures, sprites, sound, position, button events, etc.
function setup() {

    // assign appropriate sound
    bgm = sounds["sounds/music.wav"];
    crashSfx = sounds["sounds/explosion.wav"];
    buttonPressSfx = sounds["sounds/bounce.mp3"];
    earnPointSfx = sounds['sounds/shoot.wav'];
    planeSfx = sounds["sounds/plane.wav"];

    // loop background music and plane engine sound (currently disabled)
    bgm.loop = true;
    planeSfx.loop = true;

    // set the volume
    buttonPressSfx.volume = 0.6;
    planeSfx.volume = 0.2;

    //my attempt at making this responsive by converting to their % values
    //center value
    halfOfRendererWidth = app.renderer.width / 2;
    //position value of Y for label on menus
    menuTitleY = Math.round(app.renderer.height / 3.33);
    //position value of Y for the 1st button in a list of buttons on menus
    menuFirstBtnY = app.renderer.height / 2.5;
    //position value of Y for the 2nd button in a list of buttons on menus
    menuSecondBtnY = (app.renderer.height / 2) - 5;
    //position value of X for score multipliers
    scoreMultiplierX = app.renderer.width / 2.127659574468085;
    //position value of X for title ingame screen
    ingameTitleX = app.renderer.width / 25;
    //position value of Y for labels close to the top of screen
    topLabelY = app.renderer.height / 50;
    //position value of X for score
    scoreX = app.renderer.width / 1.25;
    //position value of X for pause button label
    pauseBtnLabelX = app.renderer.width / 7.142857142857143;
    //position value of Y for pause button label
    pauseBtnLabelY = app.renderer.height / 1.162790697674419;
    //position value of Y for main menu button
    mmBtnY = app.renderer.height / 1.666666666666667;
    //position value of X for pause button
    pauseBtnX = app.renderer.width / 8.333333333333333;
    //position value of Y for pause button
    pauseBtnY = app.renderer.height / 1.162790697674419;
    //position value of Y for cloud
    cloudPosY = Math.round(app.renderer.height / 9);

    // create scene
    mainMenuScene = new Container();
    mmBtnContainer = new Container();
    aboutScene = new Container();
    aboutBtnContainer = new Container();
    gameScene = new Container();
    pauseMenu = new Container();
    pauseButtonContainer = new Container();
    pauseMenuBtnContainer = new Container();
    gameOverScene = new Container();
    restartButtonContainer = new Container();

    // hide unnecessary scene
    aboutScene.visible = false;
    pauseMenu.visible = false;
    gameScene.visible = false;
    gameOverScene.visible = false;
    restartButtonContainer.visible = false;
    
    score = 0;
    scoreMultiplier = 1;

    // setup for main menu
    mmTitle = new Text("Flydra", textStyle);
    mmTitle.position.set(halfOfRendererWidth, menuTitleY);
    mmTitle.anchor.set(0.5, 0.5);
    mmPlayLabel = new Text("Play", textStyle);
    mmPlayLabel.position.set(halfOfRendererWidth, menuFirstBtnY);
    mmPlayLabel.anchor.set(0.5, 0.5);
    mmAboutLabel = new Text("About", textStyle);
    mmAboutLabel.position.set(halfOfRendererWidth, menuSecondBtnY);
    mmAboutLabel.anchor.set(0.5, 0.5);
    aboutParagraph = new Text("Red planes are out of control!\nDrag the blue plane to avoid crashing.\n\nFly Hydra/Flydra is a game\nmade by Z04P intended\nto develop his skills in Pixi JS.", textStyle);
    aboutParagraph.position.set(halfOfRendererWidth, menuTitleY);
    aboutParagraph.anchor.set(0.5, 0.5);
    btnBackLabel = new Text("Back", textStyle);
    btnBackLabel.position.set(halfOfRendererWidth, menuSecondBtnY);
    btnBackLabel.anchor.set(0.5, 0.5);

    // setup for in-game scene
    title = new Text("Flydra", textStyle);
    title.position.set(ingameTitleX, topLabelY);
    scoreMultiplierLabel = new Text("x" + scoreMultiplier, textStyle);
    scoreMultiplierLabel.position.set(scoreMultiplierX, topLabelY);
    scoreLabel = new Text(score, textStyle);
    scoreLabel.position.set(scoreX ,topLabelY);
    pauseButtonLabel = new Text("Pause", textStyle);
    pauseButtonLabel.position.set(pauseBtnLabelX, pauseBtnLabelY);
    pauseButtonLabel.anchor.set(0.5, 0.5);
    pauseMenuLabel = new Text("Game Paused", textStyle);
    pauseMenuLabel.position.set(halfOfRendererWidth, menuTitleY);
    pauseMenuLabel.anchor.set(0.5, 0.5);
    continueBtnLabel = new Text("Continue", textStyle);
    continueBtnLabel.position.set(halfOfRendererWidth, menuFirstBtnY);
    continueBtnLabel.anchor.set(0.5, 0.5);
    mmLabel_2 = new Text("Menu", textStyle);
    mmLabel_2.position.set(halfOfRendererWidth, menuSecondBtnY);
    mmLabel_2.anchor.set(0.5, 0.5);

    // setup for game over scene
    endTitle = new Text("Flydra", textStyle);
    endTitle.position.set(ingameTitleX, topLabelY);
    endScoreMultiplierLabel = new Text("x" + scoreMultiplier, textStyle);
    endScoreMultiplierLabel.position.set(scoreMultiplierX, topLabelY);
    endScoreLabel = new Text(score, textStyle);
    endScoreLabel.position.set(scoreX ,topLabelY);
    gameOverLabel = new Text("You crashed your hydra!", textStyle);
    gameOverLabel.position.set(halfOfRendererWidth, menuFirstBtnY);
    gameOverLabel.anchor.set(0.5, 0.5);
    restartLabel = new Text("Try Again", textStyle);
    restartLabel.position.set(halfOfRendererWidth, menuSecondBtnY);
    restartLabel.anchor.set(0.5, 0.5);
    mmLabel = new Text("Menu", textStyle);
    mmLabel.position.set(halfOfRendererWidth, mmBtnY);
    mmLabel.anchor.set(0.5, 0.5);

    // assign appropriate texture
    mmBtnPlay = new Sprite(resources.buttonPlay.texture);
    mmBtnAbout = new Sprite(resources.buttonAbout.texture);
    btnBack = new Sprite(resources.buttonMenu.texture);
    pauseButton = new Sprite(resources.buttonPause.texture);
    continueBtn = new Sprite(resources.buttonPlay.texture);
    mmBtn_2 = new Sprite(resources.buttonMenu.texture);
    player = new Sprite(resources.player.texture);
    enemy = new Sprite(resources.enemy.texture);
    restartButton = new Sprite(resources.buttonRestart.texture);
    mmBtn = new Sprite(resources.buttonMenu.texture);

    // setup for buttons in main menu
    mmBtnPlay.scale.set(0.8, 0.8);
    mmBtnPlay.position.set(halfOfRendererWidth, menuFirstBtnY);
    mmBtnPlay.anchor.set(0.5, 0.5);
    mmBtnPlay.interactive = true;
    mmBtnPlay.buttonMode = true;
    mmBtnAbout.scale.set(0.8, 0.8);
    mmBtnAbout.position.set(halfOfRendererWidth, menuSecondBtnY);
    mmBtnAbout.anchor.set(0.5, 0.5);
    mmBtnAbout.interactive = true;
    mmBtnAbout.buttonMode = true;
    btnBack.scale.set(0.8, 0.8);
    btnBack.position.set(halfOfRendererWidth, menuSecondBtnY);
    btnBack.anchor.set(0.5, 0.5);
    btnBack.interactive = true;
    btnBack.buttonMode = true;

    // setup for buttons in pause menu
    pauseButton.scale.set(0.8, 0.8);
    pauseButton.position.set(pauseBtnX, pauseBtnY);
    pauseButton.anchor.set(0.5, 0.5);
    pauseButton.interactive = true;
    pauseButton.buttonMode = true;
    continueBtn.scale.set(0.8, 0.8);
    continueBtn.position.set(halfOfRendererWidth, menuFirstBtnY);
    continueBtn.anchor.set(0.5, 0.5);
    continueBtn.interactive = true;
    continueBtn.buttonMode = true;
    mmBtn_2.scale.set(0.8, 0.8);
    mmBtn_2.position.set(halfOfRendererWidth, menuSecondBtnY);
    mmBtn_2.anchor.set(0.5, 0.5);
    mmBtn_2.interactive = true;
    mmBtn_2.buttonMode = true;

    // setup for the player
    player.scale.set(0.8, 0.8);
    player.x = halfOfRendererWidth;
    player.y = halfOfRendererWidth;
    player.vx = 0;
    player.vy = 0;
    playerMoveSpeed = 1.053;
    player.anchor.set(0.5, 0.5);
    player.interactive = true;
    player.buttonMode = true;

    // android control support
    // works with mouse too
    // drag the player to move
    player.on('pointerdown', onDragStart)
          .on('pointerup', onDragEnd)
          .on('pointerupoutside', onDragEnd)
          .on('pointermove', onDragMove);

    // setup for enemy
    // i set a minSpawnX and maxSpawnX since the enemy needs to despawn and respawn
    minSpawnX = Math.round(w / 7.14);
    maxSpawnX = Math.round(w / 1.163);
    spawnY = 0;
    enemySize = 0.3;
    enemy.scale.set(enemySize, enemySize);
    enemy.x = spawnX(minSpawnX, maxSpawnX);
    enemy.y = spawnY;
    enemy.vx = 0;
    enemy.vy = 0;
    enemyMoveSpeed = 3;
    enemy.anchor.set(0.5, 0.5);

    // animating the background
    // create an array of textures from an image path
    var framesRoad = [];
    var framesCloud = [];

    // get frame from the spritesheet then push into the array
    for (var i = 0; i < 8; i++) {
        var val = i < 10 ? '0' + i : i;

        framesCloud.push(PIXI.Texture.fromFrame('cloud0' + val + '.png'));
    }

    // get frame from the spritesheet then push into the array
    for (var i = 0; i < 3; i++) {
        var val = i < 10 ? '0' + i : i;

        framesRoad.push(PIXI.Texture.fromFrame('road0' + val + '.png'));
    }

    // create the animation for background
    var animRoad = new PIXI.extras.AnimatedSprite(framesRoad);
    var animCloud = new PIXI.extras.AnimatedSprite(framesCloud);
    animRoad.scale.set(1, 1);
    animRoad.x = halfOfRendererWidth;
    animRoad.y = maxHeight;
    animRoad.anchor.set(0.5, 1);
    animRoad.animationSpeed = 0.05;
    animRoad.play();
    animCloud.scale.set(1, 1);
    animCloud.x = halfOfRendererWidth;
    animCloud.y = 0;
    animCloud.anchor.set(0.5, 0);
    animCloud.animationSpeed = 0.02;
    animCloud.play();

    // setup for buttons in game over screen
    restartButton.scale.set(0.8, 0.8);
    restartButton.position.set(halfOfRendererWidth, menuSecondBtnY);
    restartButton.anchor.set(0.5, 0.5);
    restartButton.interactive = true;
    restartButton.buttonMode = true;
    mmBtn.scale.set(0.8, 0.8);
    mmBtn.position.set(halfOfRendererWidth, mmBtnY);
    mmBtn.anchor.set(0.5, 0.5);
    mmBtn.interactive = true;
    mmBtn.buttonMode = true;

    // i decided to create a container for buttons since it's easier to hide/show a container 
    // instead of having to hide/show each button
    // i then add them to their respective scene
    mmBtnContainer.addChild(mmBtnPlay, mmPlayLabel, mmBtnAbout, mmAboutLabel);
    mainMenuScene.addChild(mmBtnContainer, mmTitle);
    aboutBtnContainer.addChild(btnBack, btnBackLabel);
    aboutScene.addChild(aboutBtnContainer, aboutParagraph);
    pauseMenuBtnContainer.addChild(continueBtn, continueBtnLabel, mmBtn_2, mmLabel_2);
    pauseMenu.addChild(pauseMenuBtnContainer, pauseMenuLabel);
    gameScene.addChildAt(animCloud, 0);
    gameScene.addChildAt(animRoad, 0);
    gameScene.addChild(title, scoreMultiplierLabel, scoreLabel, pauseButtonContainer, player);
    pauseButtonContainer.addChild(pauseButton, pauseButtonLabel);
    restartButtonContainer.addChild(restartButton, restartLabel, mmBtn, mmLabel);
    gameOverScene.addChild(endTitle, endScoreMultiplierLabel, endScoreLabel, gameOverLabel, restartButtonContainer);

    // this loads all scene into the stage of our app
    // removing this makes the stage empty which will result an empty screen
    app.stage.addChild(gameOverScene, gameScene, pauseMenu, mainMenuScene, aboutScene);

    //start the game upon pressing the play button
    mmBtnPlay.on('pointerdown', function(e) {

        bgm.playFrom(0);
        // planeSfx.playFrom(0);
        buttonPressSfx.play();

        mainMenuScene.visible = false;
        gameScene.visible = true;

        state = play;
        
    });
    
    //switch to about screen upon pressing the about button
    mmBtnAbout.on('pointerdown', function(e) {

        buttonPressSfx.play();

        mainMenuScene.visible = false;
        mmTitle.visible = false;
        mmBtnContainer.visible = false;
        aboutScene.visible = true;
        aboutBtnContainer.visible = true;

    });

    //switch to menu screen upon pressing the back button
    btnBack.on('pointerdown', function(e) {

        buttonPressSfx.play();

        aboutScene.visible = false;
        aboutBtnContainer.visible = false;
        mainMenuScene.visible = true;
        mmTitle.visible = true;
        mmBtnContainer.visible = true;

    });

    //pause the game upon pressing the pause button
    pauseButton.on('pointerdown', function(e) {

        bgm.fadeOut(1);
        // planeSfx.pause();
        buttonPressSfx.play();

        state = pause;
        gameScene.visible = false;
        pauseMenu.visible = true;
        pauseMenuBtnContainer.visible = true;

    });

    //continue the game upon pressing the continue button
    continueBtn.on('pointerdown', function(e) {

        bgm.fadeIn(1);
        // planeSfx.play();
        buttonPressSfx.play();

        state = play;
        pauseMenu.visible = false;
        pauseMenuBtnContainer.visible = false;
        gameScene.visible = true;
        app.start();

    });

    //return to the main menu upon pressing the menu button
    mmBtn_2.on('pointerdown', function(e) {

        bgm.pause();
        buttonPressSfx.play();

        score = -100;
        endScore = -100;
        scoreMultiplier = 0.5;
        endScoreMultiplier = 0.5;
        player.x = halfOfRendererWidth;
        player.y = halfOfRendererWidth;
        enemy.y = 500;
        enemyIsAlive = true;
        
        state = menu;
        gameScene.visible = false;
        pauseMenu.visible = false;
        gameOverScene.visible = false;
        restartButtonContainer.visible = false;
        gameScene.visible = false;
        mainMenuScene.visible = true;
        app.start();

    });

    //restart the game upon pressing the restart button
    restartButton.on('pointerdown', function(e) {

        bgm.playFrom(0);
        // planeSfx.playFrom(0);
        buttonPressSfx.play();

        gameOverScene.visible = false;
        restartButtonContainer.visible = false;
        gameScene.visible = true;

        state = play;

    });

    //return to the main menu upon pressing the menu button
    mmBtn.on('pointerdown', function(e) {
        
        bgm.pause();
        buttonPressSfx.play();

        gameOverScene.visible = false;
        restartButtonContainer.visible = false;
        gameScene.visible = false;
        mainMenuScene.visible = true;

        state = menu;

    });

    //set the game state
    state = menu;

    //start the game loop
    app.ticker.add(delta => gameLoop(delta));

}

function gameLoop(delta) {

    //update the current game state
    state(delta);

}