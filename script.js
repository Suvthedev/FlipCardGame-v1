(function () {
  // Constants
  const PAIRS_MIN = 6; 
  const FLIP_DELAY = 750; 
  const DEFAULT_TILE_CHARS = ['🍎','🍊','🍇','🍋','🍉','🍓','🍍','🥝','🥑','🍒'];
  const MAX_VISIBLE_TILES = 12; // divide by 2 and you get 6 pairs

  // Elements
  const preloader = document.getElementById('preloader');
  const gameArea = document.getElementById('game-area');
  const attemptsEl = document.getElementById('attempts');
  const timerEl = document.getElementById('timer');
  const replayBtn = document.getElementById('replayBtn');
  const ctaBtn = document.getElementById('ctaBtn');
  const overlay = document.getElementById('complete');
  const overlayReplay = document.getElementById('overlayReplay');
  const overlayCta = document.getElementById('overlayCta');
  const summaryText = document.getElementById('summaryText');
  const resetBtn = document.getElementById('resetBtn');

  // state
  let gridSize = PAIRS_MIN * 2;
  let tiles = [];
  let firstFlip = null;
  let secondFlip = null;
  let lock = false;
  let attempts = 0;
  let pairsFound = 0;
  let startTime = null;
  let timerInterval = null;

  // Determine sizing based on container attributes (entry point pages set data-width/data-height)
  const frame = document.body;
  const width = parseInt(frame.getAttribute('data-width') || 300, 10);
  const height = parseInt(frame.getAttribute('data-height') || 250, 10);

  // Adjust grid based on size
  function computeGrid() {

    if (height >= 600) {

      return { cols: 4, rows: 6, pairs: 12 }; 
    } else if (height >= 480) {
      return { cols: 4, rows: 5, pairs: 10 };
    } else {
      return { cols: 4, rows: 3, pairs: PAIRS_MIN };
    }
  }

  // Preloader 
  function showPreloader() {
    preloader.style.display = 'flex';
    preloader.setAttribute('aria-hidden','false');
  }
  function hidePreloader() {
    preloader.style.display = 'none';
    preloader.setAttribute('aria-hidden','true');
  }

  // Create shuffled deck of tile values
  function makeDeck(pairs) {
    // choose icons from DEFAULT_TILE_CHARS
    const source = DEFAULT_TILE_CHARS.slice(0);
    // if insufficient icons, generate numbers
    while (source.length < pairs) {
      source.push((source.length + 1).toString());
    }
    const selected = source.slice(0, pairs);
    const deck = [];
    selected.forEach((s) => {
      deck.push({ val: s });
      deck.push({ val: s });
    });

    // shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  // Build DOM grid
  function renderGrid(deck, cols) {
    gameArea.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    gameArea.appendChild(grid);

    deck.forEach((card, i) => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.tabIndex = -1;
      tile.dataset.index = i;

      // Create button for keyboard accessibility
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-pressed','false');
      btn.setAttribute('aria-label','Face down tile. Press Enter to flip.');
      btn.className = 'scene';
      btn.innerHTML = `
        <div class="face back">${'?'}</div>
        <div class="face front">${card.val}</div>
      `;
      tile.appendChild(btn);

      // click event handler
      btn.addEventListener('click', () => tileClick(tile));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tileClick(tile);
        }
      });

      grid.appendChild(tile);
    });

    // style tile to fit container
    adjustTileSize(grid, cols);
    return grid;
  }

 // This should adjust Tile Size
  function adjustTileSize(grid, cols) {
   
    const areaRect = gameArea.getBoundingClientRect();
    const gap = 8;
    const colsNum = cols || 4;
    const availableWidth = Math.max(1, areaRect.width - (colsNum - 1) * gap - 12);
    const tileSize = Math.floor(availableWidth / colsNum);
    document.documentElement.style.setProperty('--tile-size', tileSize + 'px');
    document.documentElement.style.setProperty('--gap', gap + 'px');
  }

  // flip logic
  function tileClick(tileEl) {
    if (lock) return;
    if (tileEl.classList.contains('flipped') || tileEl.classList.contains('matched')) return;

    // start timer on first interaction
    if (!startTime) {
      startTime = Date.now();
      startTimer();
      window.dispatchEvent(new CustomEvent('bm_game_start', { detail: { ts: startTime } }));
    }

    // flip
    tileEl.classList.add('flipped');
    const btn = tileEl.querySelector('button');
    btn.setAttribute('aria-pressed','true');

    if (!firstFlip) {
      firstFlip = tileEl;
    } else if (!secondFlip && tileEl !== firstFlip) {
      secondFlip = tileEl;
      attempts++;
      updateAttempts();
      // check match
      const a = firstFlip.querySelector('.face.front').textContent;
      const b = secondFlip.querySelector('.face.front').textContent;

      if (a === b) {
        // matched
        firstFlip.classList.add('matched');
        secondFlip.classList.add('matched');
        pairsFound++;
        // reset selection
        firstFlip = null;
        secondFlip = null;
        // analytics
        window.dispatchEvent(new CustomEvent('bm_pair_match', { detail: { pairsFound, attempts } }));
        if (pairsFound === gridSize / 2) {
          endGame();
        }
      } else {
        lock = true;
        // show incorrect state briefly then flip back
        setTimeout(() => {
          if (firstFlip) {
            firstFlip.classList.remove('flipped');
            firstFlip.querySelector('button').setAttribute('aria-pressed','false');
          }
          if (secondFlip) {
            secondFlip.classList.remove('flipped');
            secondFlip.querySelector('button').setAttribute('aria-pressed','false');
          }
          firstFlip = null;
          secondFlip = null;
          lock = false;
        }, FLIP_DELAY);
      }
    }
  }

  // attempts & timer
  function updateAttempts() {
    attemptsEl.textContent = `Attempts: ${attempts}`;
  }
  function startTimer() {
    timerEl.textContent = `Time: 0s`;
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      timerEl.textContent = `Time: ${elapsed}s`;
    }, 500);
  }
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // end game
  function endGame() {
    stopTimer();
    const timeMs = Date.now() - startTime;
    // show overlay summary
    summaryText.textContent = `You matched ${pairsFound} pairs in ${attempts} attempts and ${Math.round(timeMs/1000)}s.`;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden','false');

    // update replay visible
    replayBtn.setAttribute('aria-hidden','false');
    replayBtn.style.display = 'inline-block';

    window.dispatchEvent(new CustomEvent('bm_game_complete', { detail: { attempts, timeMs } }));
  }

  // Reset button handler
    resetBtn.addEventListener('click', resetGame);

  // replay
  function resetGame() {
    stopTimer();
    startTime = null;
    attempts = 0;
    pairsFound = 0;
    firstFlip = null;
    secondFlip = null;
    lock = false;
    attemptsEl.textContent = `Attempts: 0`;
    timerEl.textContent = `Time: 0s`;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden','true');
    replayBtn.style.display = 'none';
    init(); // rebuild
  }

  // CTA / exit handling
  function onExitClick(e) {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('bm_exit_click', { detail: { attempts, pairsFound, ts: Date.now() } }));
    // Use clickTag or clickTAG or default to '#'
    const url = window.clickTag || window.clickTAG || window.clicktag || '#';
    try {
      if (url && url !== '#') window.open(url, '_blank');
    } catch (err) {
      // fallback no-op
    }
  }

  // Build / init
  function init() {
    showPreloader();

    // compute grid layout
    const cfg = computeGrid();
    const pairs = Math.min(cfg.pairs || PAIRS_MIN, MAX_VISIBLE_TILES / 2);
    gridSize = pairs * 2;
    const cols = Math.min(cfg.cols || 4, 6);

    tiles = makeDeck(pairs);
    renderGrid(tiles, cols);

    // ensure focusable tiles for keyboard flow
    const tileEls = document.querySelectorAll('.tile');
    tileEls.forEach((t, idx) => {
      const btn = t.querySelector('button');
      btn.tabIndex = 0;
      // manage focus visible for keyboard users
      btn.addEventListener('focus', () => t.classList.add('focus'));
      btn.addEventListener('blur', () => t.classList.remove('focus'));
    });

    setTimeout(() => {
      hidePreloader();
    }, 250);

    // Button handlers
    replayBtn.onclick = resetGame;
    overlayReplay.onclick = resetGame;
    ctaBtn.onclick = onExitClick;
    overlayCta.onclick = onExitClick;
    

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'r' || e.key === 'R') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        resetGame();
      }
      if (e.key === 'Escape') {

        if (!overlay.classList.contains('hidden')) {
          overlay.classList.add('hidden');
          overlay.setAttribute('aria-hidden','true');
        }
      }
    });
  }

  // init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging and GWD wiring (I had to generate the GWD parts as I have no experience with it)
  window.BM = {
    reset: resetGame,
    getState: () => ({ attempts, pairsFound, started: !!startTime })
  };

})();
