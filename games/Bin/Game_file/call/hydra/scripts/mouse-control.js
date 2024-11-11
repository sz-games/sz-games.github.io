// android control support
// works with mouse too
// drag to move player
function onDragStart(event) {

    // store a reference to the data
    // the reason for this is because of multitouch
    // we want to track the movement of this particular touch
    this.data = event.data;
    // this.alpha = 0.5;
    this.dragging = true;

}

function onDragEnd() {

    // set player rotation to none
    player.rotation = 0;
    // this.alpha = 1;
    this.dragging = false;
    // set the interaction data to null
    this.data = null;

}

function onDragMove() {

    if (this.dragging) {

        var newPosition = this.data.getLocalPosition(this.parent);
        var delta = 1;
        var dt = playerMoveSpeed;
        var dt = 1.0 - Math.exp(1.0 - dt, delta);
        var objectPosition = this.data.getLocalPosition(this);

        // use lerp to create distance between the pointer and the sprite
        if (Math.abs(this.x - newPosition.x) + Math.abs(this.y - newPosition.y) < 1) {
            this.x = newPosition.x;
            this.y = newPosition.y;
        } else {
            this.x = this.x + (newPosition.x - this.x) * dt;
            this.y = this.y + (newPosition.y - this.y) * dt;
        }

        // checks if the pointer is going left or right then
        // animate the player sprite going left or right
        if (objectPosition.x < 0) player.rotation += -0.1;
        else if (objectPosition.x > 0) player.rotation += 0.1;

    }

}