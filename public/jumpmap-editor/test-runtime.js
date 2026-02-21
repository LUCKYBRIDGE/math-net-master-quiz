(function initJumpmapTestRuntime() {
  const create = (deps) => {
    const {
      state,
      els,
      assets,
      hooks,
      geometry,
      integration: integrationBridge = null
    } = deps;
    const integration = integrationBridge && typeof integrationBridge.emit === 'function'
      ? integrationBridge
      : { emit: () => {} };
    const { plateBase, sejongBase, SPRITES } = assets;
    const TEXTURE_OBJECT_PREFIX = '__texture__:';
    const textureBase = './textures/';
    const DEFAULT_SOLID_TEXTURE_COLOR = '#c3b18b';
    const TEXTURE_OBJECT_TYPES = ['hanji', 'stone', 'ice', 'solid'];
    const LEGACY_TEXTURE_TYPE_ALIAS = {
      'paper-fiber': 'hanji',
      'paper-speckle': 'hanji',
      parchment: 'hanji',
      'hanji-warm': 'hanji',
      'hanji-cool': 'hanji',
      'linen-weave': 'hanji',
      'ink-wash': 'hanji',
      'stone-grain': 'stone',
      'stone-block': 'stone',
      'plate-stone2': 'stone',
      'ice-frost': 'ice',
      'ice-crack': 'ice',
      'plate-ice': 'ice'
    };
    const textureSourceMap = {
      hanji: `${textureBase}hanji.svg`,
      stone: `${plateBase}plate_stone2.png`,
      ice: `${plateBase}plate_ice.png`
    };
    const normalizeTextureType = (name) => {
      if (!name || typeof name !== 'string') return 'hanji';
      if (TEXTURE_OBJECT_TYPES.includes(name)) return name;
      return LEGACY_TEXTURE_TYPE_ALIAS[name] || 'hanji';
    };
    const normalizeHexColor = (value, fallback = DEFAULT_SOLID_TEXTURE_COLOR) => {
      if (typeof value !== 'string') return fallback;
      const trimmed = value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
      if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
        const r = trimmed[1];
        const g = trimmed[2];
        const b = trimmed[3];
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
      }
      return fallback;
    };
    const isTextureSprite = (sprite) =>
      typeof sprite === 'string' && sprite.startsWith(TEXTURE_OBJECT_PREFIX);
    const getTextureTypeFromSprite = (sprite) => {
      if (!isTextureSprite(sprite)) return null;
      const raw = sprite.slice(TEXTURE_OBJECT_PREFIX.length);
      return normalizeTextureType(raw || 'hanji');
    };
    const getTextureFillStyle = (type, textureColor = DEFAULT_SOLID_TEXTURE_COLOR) => {
      const normalizedType = normalizeTextureType(type);
      if (normalizedType === 'solid') {
        return {
          image: 'none',
          color: normalizeHexColor(textureColor),
          size: 'auto',
          repeat: 'no-repeat'
        };
      }
      return {
        image: `url(${textureSourceMap[normalizedType] || textureSourceMap.hanji})`,
        color: 'transparent',
        size: '128px 128px',
        repeat: 'repeat'
      };
    };
    const {
      getBackgroundLayers,
      applyPlayerSpriteToElement,
      getPlayerSpriteRender,
      getPlayerMetrics,
      getPlayerHitboxOffset,
      getPlayerHitboxPolygon,
      ensureStartPoint
    } = hooks;
    const { worldPointToLocal, localPointToWorld } = geometry;
    const {
      createPlayerState,
      getSpawnPosition: computeSpawnPosition,
      collectObstacleBounds,
      stepPlayerState,
      computeCameraPosition
    } = window.JumpmapTestPhysicsUtils;

    let rafId = null;
    let obstacleCache = null;
    const keyboardState = { left: false, right: false };
    const PLAYER_NAME_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4'];
    const BACKGROUND_PARALLAX_X = 0.03;
    const BACKGROUND_PARALLAX_Y = 0.08;

    const getPlayerDisplayName = (index) => {
      const names = Array.isArray(state?.test?.playerNames) ? state.test.playerNames : [];
      const raw = names[index];
      if (typeof raw === 'string' && raw.trim()) return raw.trim();
      return `사용자${index + 1}`;
    };

    const getPlayerNameColor = (index) =>
      PLAYER_NAME_COLORS[Math.max(0, index) % PLAYER_NAME_COLORS.length];

    const getBackgroundImageOpacity = () => {
      const raw = Number(state?.background?.imageOpacity);
      if (!Number.isFinite(raw)) return 1;
      return Math.max(0, Math.min(1, raw));
    };

    const applyTestBackgroundLayer = (bgLayer, cam, viewRect) => {
      if (!bgLayer) return;
      const layers = getBackgroundLayers({ applyOpacityOverlay: false });
      bgLayer.style.backgroundColor = state.background.color || '#ffffff';
      bgLayer.style.backgroundImage = layers.image;
      bgLayer.style.backgroundSize = layers.size;
      bgLayer.style.backgroundRepeat = layers.repeat;
      bgLayer.style.opacity = String(getBackgroundImageOpacity());
      bgLayer.style.transform = 'none';

      const basePositions = String(layers.position || 'center')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

      if ((state.background.image || '').trim() && basePositions.length && cam && viewRect) {
        const maxCamX = Math.max(1, state.map.width - viewRect.width);
        const maxCamY = Math.max(1, state.map.height - viewRect.height);
        const progressX = Math.max(0, Math.min(1, cam.x / maxCamX));
        const progressY = Math.max(0, Math.min(1, cam.y / maxCamY));
        // Keep far-background feel horizontally, and reveal image bottom
        // only near map bottom so lower white area does not appear too early.
        const xPct = 50 + (progressX - 0.5) * 6;
        const yPct = Math.pow(progressY, 2.4) * 100;
        basePositions[basePositions.length - 1] = `${xPct.toFixed(2)}% ${yPct.toFixed(2)}%`;
      } else if (basePositions.length) {
        basePositions[basePositions.length - 1] = '50% 100%';
      }

      bgLayer.style.backgroundPosition = basePositions.join(', ') || 'center';
    };

    const stopTestLoop = () => {
      if (rafId == null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    };

    const getSavePoints = () => (
      Array.isArray(state.savePoints)
        ? state.savePoints.filter((point) => point && typeof point === 'object')
        : []
    );

    const getSavePointById = (id) => {
      if (!id) return null;
      return getSavePoints().find((point) => point.id === id) || null;
    };

    const getSpawnPosition = (basePoint = null) => {
      ensureStartPoint();
      const metrics = getPlayerMetrics();
      const offset = getPlayerHitboxOffset();
      const point = (basePoint && Number.isFinite(basePoint.x) && Number.isFinite(basePoint.y))
        ? basePoint
        : state.startPoint;
      return computeSpawnPosition(state.map, point, metrics, offset);
    };

    const getPlayerHeightValue = (playerState, metrics) => {
      const footY = (Number(playerState?.y) || 0) + (Number(metrics?.height) || 0);
      const mapH = Math.max(0, Number(state?.map?.height) || 0);
      return Math.max(0, Math.round(mapH - footY));
    };

    const resetPlayerStateAt = (playerState, basePoint = null) => {
      const spawn = getSpawnPosition(basePoint);
      const metrics = getPlayerMetrics();
      playerState.x = spawn.x;
      playerState.y = spawn.y;
      playerState.vx = 0;
      playerState.vy = 0;
      playerState.facing = 1;
      playerState.onGround = false;
      playerState.jumpsUsed = 0;
      playerState.jumpedFromGround = false;
      playerState.jumping = false;
      playerState.jumpTargetY = 0;
      playerState.coyoteTimer = 0;
      playerState.walkTimer = 0;
      playerState.input.left = false;
      playerState.input.right = false;
      playerState.input.jumpQueued = false;
      playerState.input.jumpHeld = false;
      playerState.input.jumpLock = false;
      playerState.maxHeight = getPlayerHeightValue(playerState, metrics);
    };

    const getViews = () => els.testViews._views || [];
    const clearAllInputs = () => {
      keyboardState.left = false;
      keyboardState.right = false;
      const views = getViews();
      views.forEach((view) => {
        if (view?.virtualInput) {
          view.virtualInput.left = false;
          view.virtualInput.right = false;
        }
        const input = view?.state?.input;
        if (!input) return;
        input.left = false;
        input.right = false;
        input.jumpQueued = false;
        input.jumpHeld = false;
        input.jumpLock = false;
      });
    };
    const getViewScale = (viewRect) => {
      const width = Math.max(1, Number(viewRect?.width) || 0);
      const raw = width / 900;
      return Math.max(0.28, Math.min(1, raw));
    };

    const buildWorldClone = () => {
      const world = document.createElement('div');
      world.className = 'test-world';
      world.style.width = `${state.map.width}px`;
      world.style.height = `${state.map.height}px`;
      // Test mode uses only the view background layers; editor grid/background must not bleed in.
      world.style.backgroundImage = 'none';
      state.objects.forEach((obj) => {
        const el = document.createElement('div');
        el.className = 'map-object';
        el.style.left = `${obj.x}px`;
        el.style.top = `${obj.y}px`;
        const scaleX = obj.flipH ? -obj.scale : obj.scale;
        const scaleY = obj.flipV ? -obj.scale : obj.scale;
        // Match editor geometry order so visual sprite and collision/hitbox coordinates stay consistent.
        el.style.transform = `rotate(${obj.rotation}deg) scale(${scaleX}, ${scaleY})`;
        const source = isTextureSprite(obj.sprite) ? document.createElement('div') : document.createElement('img');
        const hitboxW = Array.isArray(obj.hitboxes) && obj.hitboxes.length
          ? Math.max(...obj.hitboxes.map((hb) => (Number(hb.x) || 0) + (Number(hb.w) || 0)))
          : 320;
        const hitboxH = Array.isArray(obj.hitboxes) && obj.hitboxes.length
          ? Math.max(...obj.hitboxes.map((hb) => (Number(hb.y) || 0) + (Number(hb.h) || 0)))
          : 120;
        const baseW = Math.max(1, hitboxW || 320);
        const baseH = Math.max(1, hitboxH || 120);
        if (isTextureSprite(obj.sprite)) {
          source.className = 'texture-object-fill';
          const fillStyle = getTextureFillStyle(getTextureTypeFromSprite(obj.sprite), obj.textureColor);
          source.style.backgroundImage = fillStyle.image;
          source.style.backgroundColor = fillStyle.color;
          source.style.backgroundSize = fillStyle.size;
          source.style.backgroundRepeat = fillStyle.repeat;
          source.style.width = `${baseW}px`;
          source.style.height = `${baseH}px`;
        } else {
          source.src = `${plateBase}${obj.sprite}`;
          source.draggable = false;
        }
        const crop = obj?.crop && typeof obj.crop === 'object' ? obj.crop : null;
        if (crop) {
          el.style.width = `${crop.w}px`;
          el.style.height = `${crop.h}px`;
          el.style.overflow = 'hidden';
          source.style.position = 'absolute';
          source.style.left = `-${crop.x}px`;
          source.style.top = `-${crop.y}px`;
        } else {
          el.style.overflow = 'visible';
          source.style.position = 'absolute';
          source.style.left = '0px';
          source.style.top = '0px';
        }
        el.appendChild(source);
        world.appendChild(el);
      });
      return world;
    };

    const createControls = (index) => {
      const wrap = document.createElement('div');
      wrap.className = 'virtual-controls';
      const dpad = document.createElement('div');
      dpad.className = 'dpad';
      const left = document.createElement('button');
      left.textContent = '◀';
      const right = document.createElement('button');
      right.textContent = '▶';
      dpad.appendChild(left);
      dpad.appendChild(right);

      const jumpWrap = document.createElement('div');
      jumpWrap.className = 'jump-btn';
      const jump = document.createElement('button');
      jump.textContent = '점프';
      jumpWrap.appendChild(jump);

      const bind = (btn, key) => {
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (e.pointerId != null && typeof btn.setPointerCapture === 'function') {
            try {
              btn.setPointerCapture(e.pointerId);
            } catch (_err) {
              // best effort only
            }
          }
          const player = getViews()[index];
          if (!player) return;
          if (key === 'jump') {
            if (player.state.input.jumpHeld || player.state.input.jumpLock) return;
            player.state.input.jumpQueued = true;
            player.state.input.jumpHeld = true;
            player.state.input.jumpLock = true;
            return;
          }
          if (!player.virtualInput) player.virtualInput = { left: false, right: false };
          player.virtualInput[key] = true;
        });
        btn.addEventListener('pointerup', () => {
          const player = getViews()[index];
          if (!player) return;
          if (key === 'jump') {
            player.state.input.jumpHeld = false;
            player.state.input.jumpLock = false;
            return;
          }
          if (!player.virtualInput) player.virtualInput = { left: false, right: false };
          player.virtualInput[key] = false;
        });
        btn.addEventListener('pointerleave', () => {
          const player = getViews()[index];
          if (!player) return;
          if (key === 'jump') {
            player.state.input.jumpHeld = false;
            player.state.input.jumpLock = false;
            return;
          }
          if (!player.virtualInput) player.virtualInput = { left: false, right: false };
          player.virtualInput[key] = false;
        });
        btn.addEventListener('pointercancel', () => {
          const player = getViews()[index];
          if (!player) return;
          if (key === 'jump') {
            player.state.input.jumpHeld = false;
            player.state.input.jumpLock = false;
            return;
          }
          if (!player.virtualInput) player.virtualInput = { left: false, right: false };
          player.virtualInput[key] = false;
        });
      };

      bind(left, 'left');
      bind(right, 'right');
      bind(jump, 'jump');

      wrap.appendChild(dpad);
      wrap.appendChild(jumpWrap);
      return wrap;
    };

    const getSpriteKeyForState = (playerState, dt) => {
      if (!playerState.onGround && playerState.vy < 0) return SPRITES.jump;
      if (!playerState.onGround && playerState.vy > 0) return SPRITES.fall;
      if (Math.abs(playerState.vx) > 0) {
        playerState.walkTimer += dt;
        const idx = Math.floor(playerState.walkTimer * 10) % SPRITES.walk.length;
        return SPRITES.walk[idx];
      }
      return SPRITES.idle;
    };

    const buildTestViews = (count) => {
      els.testViews.innerHTML = '';
      els.testViews.style.gridTemplateColumns = `repeat(${count}, 1fr)`;
      const views = [];
      for (let i = 0; i < count; i += 1) {
        const view = document.createElement('div');
        view.className = 'test-view';
        view.style.backgroundColor = state.background.color || '#ffffff';
        const bgLayer = document.createElement('div');
        bgLayer.className = 'test-background-layer';
        applyTestBackgroundLayer(bgLayer);
        view.appendChild(bgLayer);

        const camera = document.createElement('div');
        camera.className = 'test-camera';
        const world = buildWorldClone();
        camera.appendChild(world);
        view.appendChild(camera);

        const players = [];
        for (let j = 0; j < count; j += 1) {
          const player = document.createElement('div');
          player.className = `player ${j === i ? 'player-self' : 'player-peer'}`;
          const nameTag = document.createElement('div');
          nameTag.className = 'test-player-name';
          nameTag.textContent = getPlayerDisplayName(j);
          nameTag.style.setProperty('--player-name-color', getPlayerNameColor(j));
          player.appendChild(nameTag);
          const img = document.createElement('img');
          img.src = `${sejongBase}${SPRITES.idle}`;
          img.dataset.spriteKey = SPRITES.idle;
          player.appendChild(img);
          applyPlayerSpriteToElement(player, img);
          world.appendChild(player);
          const debugHitbox = document.createElement('div');
          debugHitbox.className = `test-player-hitbox-debug${j === i ? '' : ' peer'}`;
          debugHitbox.style.display = 'none';
          world.appendChild(debugHitbox);
          players.push({ player, img, nameTag, debugHitbox, index: j });
        }

        const controls = createControls(i);
        view.appendChild(controls);
        const heightInfo = document.createElement('div');
        heightInfo.className = 'test-height-info';
        heightInfo.textContent = '높이 0px · 최고 0px';
        view.appendChild(heightInfo);
        const debugInfo = document.createElement('div');
        debugInfo.className = 'test-view-debug-info';
        debugInfo.style.display = 'none';
        view.appendChild(debugInfo);

        els.testViews.appendChild(view);
        const playerState = createPlayerState();
        resetPlayerStateAt(playerState);
        views.push({
          view,
          camera,
          world,
          players,
          controls,
          heightInfo,
          debugInfo,
          bgLayer,
          state: playerState,
          virtualInput: { left: false, right: false },
          camX: 0,
          camY: 0,
          viewScale: 1
        });
      }
      obstacleCache = collectObstacleBounds({ objects: state.objects, localPointToWorld });
      els.testViews._views = views;
    };

    const startTestLoop = () => {
      const LOOP_FPS = 60;
      const dt = 1 / LOOP_FPS;

      const loop = () => {
        const views = getViews();
        const metrics = getPlayerMetrics();
        const playerHitboxPolygon = getPlayerHitboxPolygon ? getPlayerHitboxPolygon() : null;
        const moveSpeed = Math.max(0, Number(state.physics?.moveSpeed) || 220);
        const sprite = getPlayerSpriteRender();
        const offset = getPlayerHitboxOffset();
        if (!obstacleCache) {
          obstacleCache = collectObstacleBounds({ objects: state.objects, localPointToWorld });
        }
        views.forEach((playerView) => {
          const ps = playerView.state;
          const vi = playerView.virtualInput || { left: false, right: false };
          const useKeyboard = playerView === views[0];
          ps.input.left = !!vi.left || (useKeyboard && keyboardState.left);
          ps.input.right = !!vi.right || (useKeyboard && keyboardState.right);
          stepPlayerState({
            playerState: ps,
            dt,
            moveSpeed,
            physics: state.physics,
            metrics,
            playerHitboxPolygon,
            map: state.map,
            objects: state.objects,
            obstacles: obstacleCache,
            worldPointToLocal,
            localPointToWorld
          });
          const currentHeight = getPlayerHeightValue(ps, metrics);
          const best = Math.max(Number(ps.maxHeight) || 0, currentHeight);
          ps.maxHeight = best;
          ps._spriteKey = getSpriteKeyForState(ps, dt);
        });

        views.forEach((playerView, viewIndex) => {
          const view = playerView.view;
          const camera = playerView.camera;
          const world = playerView.world;
          const heightInfo = playerView.heightInfo;
          const showDebug = !!state.test?.showDebugHitbox;
          const bgLayer = playerView.bgLayer;

          playerView.players.forEach(({ player, img, nameTag, debugHitbox, index }) => {
            const ps = views[index]?.state;
            if (!ps) return;
            player.style.left = `${ps.x + sprite.offsetX - offset.x}px`;
            player.style.top = `${ps.y + sprite.offsetY - offset.y}px`;
            if (nameTag) {
              nameTag.textContent = getPlayerDisplayName(index);
              nameTag.style.setProperty('--player-name-color', getPlayerNameColor(index));
            }
            const facing = ps.facing === -1 ? -1 : 1;
            img.style.transformOrigin = '50% 50%';
            img.style.transform = `scaleX(${facing})`;
            const spriteKey = ps._spriteKey || SPRITES.idle;
            if (img.dataset.spriteKey !== spriteKey) {
              img.src = `${sejongBase}${spriteKey}`;
              img.dataset.spriteKey = spriteKey;
            }
            player.classList.toggle('player-self', index === viewIndex);
            player.classList.toggle('player-peer', index !== viewIndex);
            if (showDebug && debugHitbox) {
              debugHitbox.style.display = 'block';
              debugHitbox.style.left = `${ps.x}px`;
              debugHitbox.style.top = `${ps.y}px`;
              debugHitbox.style.width = `${metrics.width}px`;
              debugHitbox.style.height = `${metrics.height}px`;
              debugHitbox.classList.toggle('peer', index !== viewIndex);
            } else if (debugHitbox) {
              debugHitbox.style.display = 'none';
            }
          });

          const current = views[viewIndex]?.state;
          if (!current) return;
          if (heightInfo) {
            const currentHeight = getPlayerHeightValue(current, metrics);
            const bestHeight = Math.max(Number(current.maxHeight) || 0, currentHeight);
            heightInfo.textContent = `높이 ${currentHeight}px · 최고 ${bestHeight}px`;
          }
          const viewRect = view.getBoundingClientRect();
          const viewScale = getViewScale(viewRect);
          playerView.viewScale = viewScale;
          const scaledViewRect = {
            ...viewRect,
            width: viewRect.width / viewScale,
            height: viewRect.height / viewScale
          };
          const cam = computeCameraPosition({
            playerState: current,
            viewRect: scaledViewRect,
            map: state.map,
            yBias: state.camera.yBias
          });
          if (bgLayer) {
            applyTestBackgroundLayer(bgLayer, cam, scaledViewRect);
          }
          camera.style.transform = `scale(${viewScale})`;
          world.style.transform = `translate(${-cam.x}px, ${-cam.y}px)`;
          playerView.camX = cam.x;
          playerView.camY = cam.y;
          if (playerView.debugInfo) {
            if (showDebug) {
              playerView.debugInfo.style.display = 'block';
              playerView.debugInfo.textContent = `x:${Math.round(current.x)} y:${Math.round(current.y)} vy:${Math.round(current.vy)} ground:${current.onGround ? 'Y' : 'N'} jumps:${current.jumpsUsed}`;
            } else {
              playerView.debugInfo.style.display = 'none';
            }
          }
        });

        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    };

    const enterTestMode = () => {
      state.test.active = true;
      els.testOverlay.classList.remove('hidden');
      buildTestViews(state.test.players);
      startTestLoop();
      integration.emit('test:enter', {
        players: state.test.players
      });
    };

    const restartTestMode = () => {
      if (!state.test.active) return;
      stopTestLoop();
      buildTestViews(state.test.players);
      startTestLoop();
      integration.emit('test:restart', {
        players: state.test.players
      });
    };

    const exitTestMode = () => {
      state.test.active = false;
      els.testOverlay.classList.add('hidden');
      stopTestLoop();
      els.testViews.innerHTML = '';
      integration.emit('test:exit', {});
    };

    const warpToSavePoint = (savePointId) => {
      if (!state.test.active) return false;
      const point = getSavePointById(savePointId);
      if (!point) return false;
      getViews().forEach((view) => resetPlayerStateAt(view.state, point));
      integration.emit('test:warp_to_savepoint', {
        savePointId,
        x: point.x,
        y: point.y
      });
      return true;
    };

    const onPlayerCountClick = (e) => {
      if (!e.target.dataset.count) return;
      const count = Number(e.target.dataset.count);
      state.test.players = count;
      Array.from(els.playerCount.querySelectorAll('button')).forEach((btn) => {
        btn.classList.toggle('is-active', Number(btn.dataset.count) === count);
      });
      if (state.test.active) buildTestViews(count);
      integration.emit('test:player_count_changed', {
        players: count,
        active: !!state.test.active
      });
    };

    const onKeyDown = (e) => {
      if (!state.test.active) return;
      const first = getViews()[0];
      if (!first) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        keyboardState.left = true;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        keyboardState.right = true;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (e.repeat) return;
        if (first.state.input.jumpHeld || first.state.input.jumpLock) return;
        first.state.input.jumpQueued = true;
        first.state.input.jumpHeld = true;
        first.state.input.jumpLock = true;
      }
    };

    const onKeyUp = (e) => {
      if (!state.test.active) return;
      const first = getViews()[0];
      if (!first) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        keyboardState.left = false;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        keyboardState.right = false;
      }
      if (e.key === ' ') {
        e.preventDefault();
        first.state.input.jumpHeld = false;
        first.state.input.jumpLock = false;
      }
    };

    const onWindowBlur = () => {
      clearAllInputs();
    };

    const onVisibilityChange = () => {
      if (document.hidden) clearAllInputs();
    };

    return {
      enterTestMode,
      restartTestMode,
      exitTestMode,
      warpToSavePoint,
      onPlayerCountClick,
      onKeyDown,
      onKeyUp,
      onWindowBlur,
      onVisibilityChange
    };
  };

  window.JumpmapTestRuntime = { create };
})();
