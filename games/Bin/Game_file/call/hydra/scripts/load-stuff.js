// load everything
function loadStuff() {

    // set the max width/height of your app
    maxWidth = 500;
    maxHeight = 500;

    // limits the app's width/height according to maxWidth/maxHeight
    if (w <= maxWidth && h <= maxHeight) {
        //don't do anything;
    } else {

        // resize to maxWidth/maxHeight if the renderer is larger than the one has set
        app.renderer.resize(maxWidth, maxHeight);
        w = maxWidth;
        h = maxHeight;

    }

    // formats the text (currently all labels are set to this format
    //  so changing this will also change the format for text in main menu, game over, etc.)
    textStyle = new TextStyle({

        fontFamily: "Arial",
        fontSize: 18,
        fill: "white",
        fontWeight: "bold"

    });

    // create the loading screen
    loadingContainer = new Container();
    loadingLabel = new Text("Game is loading please wait..", textStyle);
    loadingLabel.anchor.set(0.5, 0.5);
    loadingLabel.position.set(w / 2, h / 2);
    loadingContainer.addChild(loadingLabel);

    // show the loading screen
    app.stage.addChild(loadingContainer);

    // preload the sounds
    sounds.load([
        "sounds/music.wav",
        "sounds/explosion.wav",
        "sounds/shoot.wav",
        "sounds/plane.wav",
        "sounds/bounce.mp3"
    ]);

    // call function loadSprite after sound has loaded
    sounds.whenLoaded = loadSprite;

}

// load textures
function loadSprite() {

    //preload sprite and assign them a name
    loader
        .add("buttonPlay", "sprite/play-button.png")
        .add("buttonAbout", "sprite/about-button.png")
        .add("buttonPause", "sprite/pause-button.png")
        .add("player", "sprite/player.png")
        .add("enemy", "sprite/enemy.png")
        .add("buttonRestart", "sprite/restart-button.png")
        .add("buttonMenu", "sprite/menu-button.png")
        .add("spritesheet/cloud.json")
        .add("spritesheet/road.json")
        .on("progress", loadProgressHandler)
        .once('complete', function() {
            console.log("All files finished loading");
            app.stage.removeChild(loadingContainer);
            setup();
        })
        .load();

}

// loading progress in console
function loadProgressHandler(loader) {

    // show loading progress in percentage
    console.log("Loading sprites.. " + Math.round(loader.progress) + "%");

}