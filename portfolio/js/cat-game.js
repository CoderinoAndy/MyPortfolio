(() => {
    const canvas = document.querySelector("#cat-game");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const $ = id => document.getElementById(id);
    const load = src => { const image = new Image(); image.src = src; return image; };
    const GAME_HEIGHT = 320;
    const GROUND_TILE_WIDTH = 2400;
    const GROUND_Y = 278;
    const PLAYER_SIZE = 88;
    // Sink the transparent 48px frame two pixels into the horizon so the
    // cat's opaque paws visibly meet the ground instead of hovering above it.
    const PLAYER_GROUND_Y = GROUND_Y - PLAYER_SIZE + 2;

    const frameCounts = { idle: 4, walk: 6, death: 4, crouch: 2 };
    const cat = Object.fromEntries(Object.keys(frameCounts).map(name => [name, load(`game-assets/cats/cat-2/${name}.png`)]));
    const art = {
        ground: load("game-assets/dino/ground.png"),
        pterodactyl: load("game-assets/dino/pterodactyl.png"),
        cacti: [1, 2, 3].map(number => load(`game-assets/dino/cactus_${number}.png`))
    };
    const cactusTypes = [
        { image: 0, sourceW: 48, sourceH: 94, w: 32, h: 63 },
        { image: 1, sourceW: 98, sourceH: 94, w: 65, h: 63 },
        { image: 2, sourceW: 68, sourceH: 68, w: 45, h: 45 }
    ];

    let state = "ready";
    let previousTime = 0;
    let worldTime = 0;
    let score = 0;
    let speed = 330;
    let spawnIn = 1.2;
    let groundX = 0;
    let obstacles = [];
    let crouchHeld = false;
    let crouchUntil = 0;
    let gameOverMessageTimer = null;
    let best = Number(localStorage.getItem("catRunnerBest") || 0);
    const player = { x: 105, y: PLAYER_GROUND_Y, vy: 0, grounded: true, crouching: false, action: "idle", actionTimer: 0 };
    const gameOverlay = $("game-message");
    const panelLabel = $("game-panel-label");
    const actionButton = $("game-action-button");
    const actionIcon = $("game-action-icon");

    function syncCanvasSize() {
        const bounds = canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;

        const nextWidth = Math.max(1, Math.round(GAME_HEIGHT * bounds.width / bounds.height));
        if (canvas.width === nextWidth && canvas.height === GAME_HEIGHT) return;

        canvas.width = nextWidth;
        canvas.height = GAME_HEIGHT;
        ctx.imageSmoothingEnabled = false;
    }

    const pad = value => Math.floor(value).toString().padStart(5, "0");
    $("game-best").textContent = pad(best);

    function setAction(name, duration = 0) {
        player.action = name;
        player.actionTimer = duration;
    }

    function updateHud() {
        $("game-score").textContent = pad(score);
    }

    function showGameOverlay(mode) {
        const restarting = mode === "restart";
        panelLabel.src = "game-assets/dino/game-over.png";
        panelLabel.alt = restarting ? "Game over" : "";
        panelLabel.classList.toggle("hidden", !restarting);
        actionIcon.src = restarting ? "game-assets/dino/restart.png" : "game-assets/dino/play.png";
        actionButton.setAttribute("aria-label", restarting ? "Restart game" : "Play game");
        gameOverlay.classList.remove("hidden");
    }

    function reset() {
        if (gameOverMessageTimer !== null) clearTimeout(gameOverMessageTimer);
        gameOverMessageTimer = null;
        score = 0;
        speed = 330;
        spawnIn = 1.2;
        groundX = 0;
        worldTime = 0;
        obstacles = [];
        crouchHeld = false;
        crouchUntil = 0;
        Object.assign(player, { y: PLAYER_GROUND_Y, vy: 0, grounded: true, crouching: false });
        gameOverlay.classList.add("hidden");
        updateHud();
    }

    function start() {
        if (state === "running") return;
        if (state === "over") reset();
        state = "running";
        setAction("walk");
        gameOverlay.classList.add("hidden");
    }

    function jump() {
        start();
        if (!player.grounded || player.crouching) return;
        player.vy = -720;
        player.grounded = false;
        setAction("walk");
    }

    function setCrouch(value, preserveTapDuration = false) {
        crouchHeld = value;
        if (value && preserveTapDuration) crouchUntil = performance.now() + 220;
        if (!preserveTapDuration) crouchUntil = 0;
        player.crouching = state === "running" && player.grounded && (value || performance.now() < crouchUntil);
    }

    function gameOver() {
        if (state !== "running") return;
        state = "over";
        player.crouching = false;
        crouchHeld = false;
        setAction("death", 0.8);
        best = Math.max(best, Math.floor(score));
        localStorage.setItem("catRunnerBest", best);
        $("game-best").textContent = pad(best);
        gameOverMessageTimer = setTimeout(() => {
            if (state !== "over") return;
            showGameOverlay("restart");
            gameOverMessageTimer = null;
        }, 650);
    }

    // These boxes match the opaque 24–31 x 19–20 px cat inside each 48 px source frame.
    function playerCollisionBox() {
        if (player.crouching) {
            return { x: player.x + 4, y: player.y + 57, w: 53, h: 29 };
        }
        return { x: player.x + 8, y: player.y + 52, w: 49, h: 34 };
    }

    function obstacleCollisionBox(obstacle) {
        if (obstacle.kind === "bird") {
            return { x: obstacle.x + 7, y: obstacle.y + 9, w: obstacle.w - 14, h: obstacle.h - 17 };
        }
        return { x: obstacle.x + 5, y: obstacle.y + 3, w: Math.max(12, obstacle.w - 10), h: obstacle.h - 5 };
    }

    function overlaps(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function spawnObstacle() {
        if (score >= 45 && Math.random() < 0.25) {
            const flightHeights = [177, 197, 217];
            obstacles.push({ kind: "bird", x: canvas.width + 40, y: flightHeights[Math.floor(Math.random() * flightHeights.length)], w: 46, h: 40 });
            return;
        }
        const type = cactusTypes[Math.floor(Math.random() * cactusTypes.length)];
        obstacles.push({
            kind: "cactus",
            image: type.image,
            sourceW: type.sourceW,
            sourceH: type.sourceH,
            x: canvas.width + 40,
            y: GROUND_Y - type.h,
            w: type.w,
            h: type.h
        });
    }

    function update(delta) {
        if (state === "over" && player.actionTimer > 0) player.actionTimer = Math.max(0, player.actionTimer - delta);
        if (state !== "running") return;

        worldTime += delta;
        score += delta * 10;
        speed = Math.min(610, 330 + score * 1.25);
        groundX = (groundX + speed * delta) % GROUND_TILE_WIDTH;
        spawnIn -= delta;
        if (spawnIn <= 0) {
            spawnObstacle();
            spawnIn = Math.max(0.9, 1.5 - score / 520) + Math.random() * 0.65;
        }

        player.vy += 1900 * delta;
        player.y += player.vy * delta;
        if (player.y >= PLAYER_GROUND_Y) {
            player.y = PLAYER_GROUND_Y;
            player.vy = 0;
            player.grounded = true;
        }
        player.crouching = player.grounded && (crouchHeld || performance.now() < crouchUntil);

        const catBox = playerCollisionBox();
        for (const obstacle of obstacles) {
            obstacle.x -= speed * delta;
            if (overlaps(catBox, obstacleCollisionBox(obstacle))) {
                gameOver();
                break;
            }
        }
        obstacles = obstacles.filter(obstacle => obstacle.x > -100);
        updateHud();
    }

    function drawWorld() {
        ctx.fillStyle = "#f7f7f7";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (art.ground.complete && art.ground.naturalWidth) {
            // The solid horizon is eight pixels down in the source image.
            // Offset it so the horizon lands exactly under every sprite's feet.
            for (let x = -groundX; x < canvas.width; x += GROUND_TILE_WIDTH) {
                ctx.drawImage(art.ground, x, GROUND_Y - 8, GROUND_TILE_WIDTH, 24);
            }
        }
    }

    function drawObstacle(obstacle) {
        if (obstacle.kind === "bird") {
            const frame = Math.floor(worldTime * 8) % 2;
            if (art.pterodactyl.complete) {
                ctx.drawImage(art.pterodactyl, frame * 46, 0, 46, 40, obstacle.x, obstacle.y, obstacle.w, obstacle.h);
            }
            return;
        }
        const image = art.cacti[obstacle.image];
        if (image.complete) {
            ctx.drawImage(
                image,
                0,
                0,
                obstacle.sourceW,
                obstacle.sourceH,
                obstacle.x,
                obstacle.y,
                obstacle.w,
                obstacle.h
            );
        }
    }

    function drawPlayer(time) {
        let action = player.action;
        let frame;
        if (player.crouching) {
            action = "crouch";
            frame = Math.floor(worldTime * 5) % frameCounts.crouch;
        } else if (action === "death") {
            frame = Math.min(frameCounts.death - 1, Math.floor((0.8 - Math.max(0, player.actionTimer)) * 7));
        } else {
            frame = Math.floor(time * (action === "walk" ? 10 : 8)) % frameCounts[action];
        }
        const image = cat[action];
        if (image.complete && image.naturalWidth) {
            ctx.drawImage(image, frame * 48, 0, 48, 48, player.x, player.y, PLAYER_SIZE, PLAYER_SIZE);
        }
    }

    function loop(milliseconds) {
        const time = milliseconds / 1000;
        const delta = Math.min(0.034, time - previousTime || 0);
        previousTime = time;
        update(delta);
        drawWorld();
        obstacles.forEach(drawObstacle);
        drawPlayer(time);
        requestAnimationFrame(loop);
    }

    document.addEventListener("keydown", event => {
        if (["Space", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "Enter"].includes(event.code)) event.preventDefault();
        if (!event.repeat && ["Space", "ArrowUp", "KeyW"].includes(event.code)) jump();
        if (["ArrowDown", "KeyA", "KeyS"].includes(event.code)) setCrouch(true, false);
        if (event.code === "Enter" && state === "over") start();
    });
    document.addEventListener("keyup", event => {
        if (["ArrowDown", "KeyA", "KeyS"].includes(event.code)) setCrouch(false, false);
    });
    $("jump-button").addEventListener("pointerdown", jump);
    actionButton.addEventListener("click", start);
    const crouchButton = $("duck-button");
    crouchButton.addEventListener("pointerdown", event => { event.preventDefault(); setCrouch(true, true); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(name => crouchButton.addEventListener(name, () => setCrouch(false, true)));
    canvas.addEventListener("pointerdown", jump);

    if ("ResizeObserver" in window) {
        new ResizeObserver(syncCanvasSize).observe(canvas);
    } else {
        window.addEventListener("resize", syncCanvasSize);
    }

    syncCanvasSize();
    updateHud();
    requestAnimationFrame(loop);
})();
