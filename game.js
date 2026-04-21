const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 500;

// ===== Состояние игры =====
let gameState = "playing"; // "playing" | "success" | "caught" | "accident"
let score = 0;
let level = 1;

// ===== Снаряды (какашки) =====
const poops = [];
let shootCooldown = 0;
// Направление последнего движения кота (для выстрела)
let lastDir = { x: 1, y: 0 };

// ===== Игрок (кот) =====
const player = {
  x: 100,
  y: 220,
  size: 44,
  speed: 3,
  urge: 0,       // шкала "хочется"
  maxUrge: 100,
  pooping: false,
  poopTimer: 0,

  draw() {
    const x = this.x;
    const y = this.y;
    const s = this.size;

    // Тело кота
    ctx.fillStyle = this.pooping ? "#cc6600" : "#ff9900";
    ctx.beginPath();
    ctx.ellipse(x + s / 2, y + s / 2 + 4, s / 2, s / 2 - 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Голова
    ctx.fillStyle = "#ff9900";
    ctx.beginPath();
    ctx.arc(x + s / 2, y + 10, 14, 0, Math.PI * 2);
    ctx.fill();

    // Уши
    ctx.fillStyle = "#ff9900";
    // Левое ухо
    ctx.beginPath();
    ctx.moveTo(x + s / 2 - 12, y + 4);
    ctx.lineTo(x + s / 2 - 18, y - 10);
    ctx.lineTo(x + s / 2 - 4, y + 0);
    ctx.fill();
    // Правое ухо
    ctx.beginPath();
    ctx.moveTo(x + s / 2 + 12, y + 4);
    ctx.lineTo(x + s / 2 + 18, y - 10);
    ctx.lineTo(x + s / 2 + 4, y + 0);
    ctx.fill();

    // Глаза
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(x + s / 2 - 5, y + 9, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + s / 2 + 5, y + 9, 3, 0, Math.PI * 2);
    ctx.fill();

    // Нос
    ctx.fillStyle = "#ff6699";
    ctx.beginPath();
    ctx.arc(x + s / 2, y + 13, 2, 0, Math.PI * 2);
    ctx.fill();

    // Усы
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + s / 2 - 2, y + 13);
    ctx.lineTo(x + s / 2 - 14, y + 11);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s / 2 + 2, y + 13);
    ctx.lineTo(x + s / 2 + 14, y + 11);
    ctx.stroke();

    // Хвост
    ctx.strokeStyle = "#ff9900";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + s, y + s - 10);
    ctx.quadraticCurveTo(x + s + 20, y + s - 30, x + s + 10, y + s - 50);
    ctx.stroke();

    // Анимация "тужится"
    if (this.pooping) {
      ctx.fillStyle = "rgba(139,69,19,0.7)";
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s + 4, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  update() {
    if (gameState !== "playing") return;

    let mx = 0, my = 0;
    if (keys["ArrowUp"]    || keys["w"] || keys["ц"]) my = -1;
    if (keys["ArrowDown"]  || keys["s"] || keys["ы"]) my =  1;
    if (keys["ArrowLeft"]  || keys["a"] || keys["ф"]) mx = -1;
    if (keys["ArrowRight"] || keys["d"] || keys["в"]) mx =  1;

    this.x += mx * this.speed;
    this.y += my * this.speed;

    // Запоминаем направление для выстрела
    if (mx !== 0 || my !== 0) {
      const len = Math.sqrt(mx * mx + my * my);
      lastDir = { x: mx / len, y: my / len };
    }

    // Границы
    this.x = Math.max(0, Math.min(canvas.width  - this.size, this.x));
    this.y = Math.max(0, Math.min(canvas.height - this.size, this.y));

    // Растёт позыв — с каждым уровнем заметно быстрее
    this.urge += 0.05 + level * 0.06;
    if (this.urge >= this.maxUrge) {
      gameState = "accident";
    }

    // Попадание в лоток
    if (checkCollision(this, litterBox) && !this.pooping) {
      this.pooping = true;
      this.poopTimer = 90; // ~1.5 сек при 60fps
    }

    if (this.pooping) {
      this.poopTimer--;
      if (this.poopTimer <= 0) {
        this.pooping = false;
        this.urge = 0;
        score += 10 * level;
        level++;
        owner.activate();
        gameState = "success";
      }
    }
  }
};

// ===== Лоток =====
const litterBox = {
  x: 620,
  y: 310,
  width: 70,
  height: 50,
  // скорость убегания растёт с уровнем
  escapeSpeed() { return Math.min(0.4 + level * 0.25, 3.5); },

  update() {
    if (gameState !== "playing") return;
    // убегает от кота
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd = this.escapeSpeed();
    if (dist < 300 && dist > 0) {
      this.x += (dx / dist) * spd;
      this.y += (dy / dist) * spd;
    }
    // держим лоток в пределах поля (с отступом от краёв)
    this.x = Math.max(10, Math.min(canvas.width  - this.width  - 10, this.x));
    this.y = Math.max(10, Math.min(canvas.height - this.height - 70, this.y));
  },

  draw() {
    // Корпус лотка
    ctx.fillStyle = "#8B6914";
    ctx.fillRect(this.x, this.y + 10, this.width, this.height - 10);

    // Бортик
    ctx.fillStyle = "#A0522D";
    ctx.fillRect(this.x - 4, this.y, this.width + 8, 14);

    // Наполнитель (песок)
    ctx.fillStyle = "#D2B48C";
    ctx.fillRect(this.x + 4, this.y + 14, this.width - 8, this.height - 20);

    // Надпись
    ctx.fillStyle = "#5a3a00";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("🐾 Лоток", this.x + this.width / 2, this.y + this.height + 18);
    ctx.textAlign = "left";
  }
};

// ===== Хозяин =====
const owner = {
  x: -60,
  y: 50,
  width: 36,
  height: 60,
  speed: 0,
  active: false,
  baseSpeed: 1.8,
  reappearTimer: 0,
  hits: 0,          // сколько раз попали какашкой
  maxHits: 3,       // после 3 попаданий убегает
  stunTimer: 0,     // оглушён (замедлен)
  dirtSpots: [],    // пятна грязи на хозяине [{ox, oy}]
  fleeing: false,   // убегает с экрана
  fleeDir: 1,       // направление побега: 1=вправо, -1=влево
  entryTimer: 0,    // задержка перед началом преследования

  activate() {
    // Всегда появляется справа (подальше от стартовой позиции кота слева)
    this.x = canvas.width + 10;
    this.y = Math.random() * (canvas.height - this.height - 80) + 40;
    this.fleeDir = 1; // убегает вправо
    this.speed = this.baseSpeed + level * 0.4;
    this.active = true;
    this.reappearTimer = 0;
    this.hits = 0;
    this.stunTimer = 0;
    this.dirtSpots = [];
    this.fleeing = false;
    this.entryTimer = 120; // ~2 сек задержки перед преследованием
  },

  draw() {
    if (!this.active) return;
    const x = this.x;
    const y = this.y;

    // Тело — синеет если оглушён
    ctx.fillStyle = this.stunTimer > 0 ? "#6a8fd8" : "#4169E1";
    ctx.fillRect(x + 6, y + 22, 24, 30);

    // Голова
    ctx.fillStyle = "#FFDAB9";
    ctx.beginPath();
    ctx.arc(x + 18, y + 14, 14, 0, Math.PI * 2);
    ctx.fill();

    // Волосы
    ctx.fillStyle = "#8B4513";
    ctx.beginPath();
    ctx.arc(x + 18, y + 4, 12, Math.PI, 0);
    ctx.fill();

    // Глаза
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(x + 13, y + 13, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 23, y + 13, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Рот — злой или ошарашенный
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (this.stunTimer > 0) {
      // открытый рот (удивлён)
      ctx.arc(x + 18, y + 22, 5, 0, Math.PI);
    } else {
      ctx.arc(x + 18, y + 20, 5, 0.2, Math.PI - 0.2);
    }
    ctx.stroke();

    // Ноги
    ctx.fillStyle = "#1a1a6e";
    ctx.fillRect(x + 6,  y + 50, 10, 16);
    ctx.fillRect(x + 20, y + 50, 10, 16);

    // Руки
    ctx.fillStyle = this.stunTimer > 0 ? "#6a8fd8" : "#4169E1";
    ctx.fillRect(x - 8, y + 24, 14, 8);
    ctx.fillRect(x + 30, y + 24, 14, 8);

    // Пятна грязи (какашки)
    ctx.fillStyle = "rgba(101,67,33,0.85)";
    for (const s of this.dirtSpots) {
      ctx.beginPath();
      ctx.ellipse(x + s.ox, y + s.oy, s.rx, s.ry, s.angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // Восклицательный знак / звёздочки при оглушении
    if (this.stunTimer > 0) {
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.fillText("★★★", x + 18, y - 4);
      ctx.textAlign = "left";
    } else if (!this.fleeing) {
      ctx.fillStyle = "red";
      ctx.font = "bold 20px Arial";
      ctx.fillText("!", x + 14, y - 4);
    }

    // Индикатор попаданий (💩 иконки)
    for (let i = 0; i < this.hits; i++) {
      ctx.font = "14px Arial";
      ctx.fillText("💩", x + i * 16, y - 18);
    }
  },

  update() {
    if (gameState !== "playing") return;

    // Таймер повторного появления
    if (!this.active) {
      const interval = Math.max(60, 240 - level * 20);
      this.reappearTimer++;
      if (this.reappearTimer >= interval) {
        this.activate();
      }
      return;
    }

    // Оглушение — замедляем
    if (this.stunTimer > 0) {
      this.stunTimer--;
    }

    const effectiveSpeed = this.stunTimer > 0 ? this.speed * 0.25 : this.speed;

    if (this.fleeing) {
      // Убегает в ту сторону откуда пришёл
      this.x += this.fleeDir * effectiveSpeed * 2.5;
      const offscreen = this.fleeDir > 0
        ? this.x > canvas.width + 80
        : this.x < -80;
      if (offscreen) {
        this.active = false;
        this.reappearTimer = 0;
      }
      return;
    }

    // Задержка перед началом преследования (хозяин "входит" на экран)
    if (this.entryTimer > 0) {
      this.entryTimer--;
      // Медленно движется вперёд пока входит
      this.x -= this.fleeDir * effectiveSpeed * 0.5;
      return;
    }

    // Движется к коту
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.x += (dx / dist) * effectiveSpeed;
      this.y += (dy / dist) * effectiveSpeed;
    }

    // Поймал кота
    if (checkCollisionRect(this, player)) {
      gameState = "caught";
    }
  }
};

// ===== Клавиши =====
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  // Рестарт по Enter
  if (e.key === "Enter" && gameState !== "playing") {
    resetGame();
  }
  // Выстрел по Пробелу
  if (e.key === " " && gameState === "playing") {
    e.preventDefault();
    shootPoop();
  }
});
window.addEventListener("keyup", (e) => { keys[e.key] = false; });

// ===== Стрельба какашками =====
function shootPoop() {
  if (shootCooldown > 0) return;
  // Нельзя стрелять если шкала совсем пустая (нечем стрелять)
  if (player.urge < 3) return;

  const speed = 9;

  // Направление: к хозяину если он активен, иначе — направление движения кота
  let dx = lastDir.x;
  let dy = lastDir.y;
  if (owner.active && !owner.fleeing) {
    const ox = (owner.x + owner.width / 2) - (player.x + player.size / 2);
    const oy = (owner.y + owner.height / 2) - (player.y + player.size / 2);
    const dist = Math.sqrt(ox * ox + oy * oy);
    if (dist > 0) { dx = ox / dist; dy = oy / dist; }
  }

  poops.push({
    x: player.x + player.size / 2,
    y: player.y + player.size / 2,
    vx: dx * speed,
    vy: dy * speed,
    r: 7,
    alive: true
  });
  // Выстрел немного снижает шкалу (потратил немного)
  player.urge = Math.max(0, player.urge - 8);
  shootCooldown = 20; // ~0.33 сек между выстрелами
}

function updatePoops() {
  if (shootCooldown > 0) shootCooldown--;

  for (const p of poops) {
    if (!p.alive) continue;
    p.x += p.vx;
    p.y += p.vy;

    // Вышел за экран
    if (p.x < -20 || p.x > canvas.width + 20 || p.y < -20 || p.y > canvas.height + 20) {
      p.alive = false;
      continue;
    }

    // Попал в хозяина
    if (owner.active && !owner.fleeing) {
      const cx = owner.x + owner.width / 2;
      const cy = owner.y + owner.height / 2;
      const dx = p.x - cx;
      const dy = p.y - cy;
      if (Math.sqrt(dx * dx + dy * dy) < owner.width / 2 + p.r) {
        p.alive = false;
        owner.hits++;
        owner.stunTimer = 80; // ~1.3 сек оглушения
        score += 5 * level;
        // Добавляем пятно грязи в случайном месте на теле
        owner.dirtSpots.push({
          ox: 6 + Math.random() * 24,
          oy: 10 + Math.random() * 50,
          rx: 5 + Math.random() * 5,
          ry: 3 + Math.random() * 4,
          angle: Math.random() * Math.PI
        });
        if (owner.hits >= owner.maxHits) {
          owner.fleeing = true;
          score += 20 * level; // бонус за полное попадание
        }
      }
    }
  }

  // Удаляем мёртвые снаряды
  for (let i = poops.length - 1; i >= 0; i--) {
    if (!poops[i].alive) poops.splice(i, 1);
  }
}

function drawPoops() {
  for (const p of poops) {
    if (!p.alive) continue;
    // Тело какашки
    ctx.fillStyle = "#6B3A2A";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    // Блик
    ctx.fillStyle = "rgba(255,200,100,0.35)";
    ctx.beginPath();
    ctx.arc(p.x - 2, p.y - 2, p.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Эмодзи-след
    ctx.font = `${p.r * 2}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("💩", p.x, p.y + p.r * 0.7);
    ctx.textAlign = "left";
  }
}

// ===== Коллизии =====
function checkCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.size > b.x &&
    a.y < b.y + b.height &&
    a.y + a.size > b.y
  );
}

function checkCollisionRect(a, b) {
  return (
    a.x < b.x + b.size &&
    a.x + a.width > b.x &&
    a.y < b.y + b.size &&
    a.y + a.height > b.y
  );
}

// ===== UI =====
function drawUI() {
  // Фон шкалы
  ctx.fillStyle = "#333";
  ctx.fillRect(18, 18, 204, 26);

  // Шкала позыва
  const urgeRatio = player.urge / player.maxUrge;
  const urgeColor = urgeRatio < 0.5 ? "#4caf50"
                  : urgeRatio < 0.75 ? "#ff9800"
                  : "#f44336";
  ctx.fillStyle = urgeColor;
  ctx.fillRect(20, 20, urgeRatio * 200, 22);

  // Рамка шкалы
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 200, 22);

  // Подпись шкалы
  ctx.fillStyle = "#fff";
  ctx.font = "bold 13px Arial";
  ctx.fillText("💩 Хочется", 230, 36);

  // Счёт
  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px Arial";
  ctx.fillText(`Счёт: ${score}`, 20, 68);

  // Уровень
  ctx.fillText(`Уровень: ${level}`, 20, 90);

  // Подсказка стрельбы
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "12px Arial";
  ctx.fillText("Пробел — стрелять 💩", 20, 112);

  // Кулдаун выстрела
  if (shootCooldown > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(20, 118, 100, 6);
    ctx.fillStyle = "#ff9800";
    ctx.fillRect(20, 118, (1 - shootCooldown / 25) * 100, 6);
  }
}

function drawOverlay(title, subtitle, emoji) {
  // Затемнение
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Карточка
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(canvas.width / 2 - 180, canvas.height / 2 - 100, 360, 200, 20);
  ctx.fill();

  ctx.fillStyle = "#222";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(emoji + " " + title, canvas.width / 2, canvas.height / 2 - 40);

  ctx.font = "18px Arial";
  ctx.fillStyle = "#555";
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 5);

  ctx.font = "bold 15px Arial";
  ctx.fillStyle = "#888";
  ctx.fillText("Нажми Enter для продолжения", canvas.width / 2, canvas.height / 2 + 50);

  ctx.textAlign = "left";
}

// ===== Сброс =====
function resetGame() {
  player.x = 100;
  player.y = 220;
  player.urge = 0;
  player.pooping = false;
  player.poopTimer = 0;
  owner.active = false;
  owner.x = -60;
  owner.reappearTimer = 0;
  owner.hits = 0;
  owner.stunTimer = 0;
  owner.dirtSpots = [];
  owner.fleeing = false;
  owner.entryTimer = 0;
  poops.length = 0;
  shootCooldown = 0;
  litterBox.x = 620;
  litterBox.y = 310;
  gameState = "playing";
  if (level > 1) {
    owner.reappearTimer = Math.max(60, 240 - level * 20) - 60;
  }
}

// ===== Игровой цикл =====
function update() {
  player.update();
  litterBox.update();
  owner.update();
  updatePoops();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Фон — комната
  ctx.fillStyle = "#e8d5b7";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Пол
  ctx.fillStyle = "#c8a87a";
  ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

  // Плинтус
  ctx.fillStyle = "#a07850";
  ctx.fillRect(0, canvas.height - 62, canvas.width, 4);

  // Декор: окно
  ctx.fillStyle = "#87CEEB";
  ctx.fillRect(60, 60, 120, 100);
  ctx.strokeStyle = "#8B6914";
  ctx.lineWidth = 4;
  ctx.strokeRect(56, 56, 128, 108);
  ctx.strokeStyle = "#8B6914";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 56); ctx.lineTo(120, 164);
  ctx.moveTo(56, 110); ctx.lineTo(184, 110);
  ctx.stroke();

  // Декор: диван
  ctx.fillStyle = "#9b59b6";
  ctx.fillRect(280, 340, 200, 80);
  ctx.fillStyle = "#8e44ad";
  ctx.fillRect(280, 320, 200, 28);
  ctx.fillRect(280, 340, 20, 80);
  ctx.fillRect(460, 340, 20, 80);

  litterBox.draw();
  drawPoops();
  player.draw();
  owner.draw();
  drawUI();

  // Оверлеи
  if (gameState === "success") {
    drawOverlay("Молодец!", `Кот сделал дела! +${10 * (level - 1)} очков 🐾`, "✅");
  } else if (gameState === "caught") {
    drawOverlay("Поймали!", "Хозяин поймал кота 😾", "😤");
  } else if (gameState === "accident") {
    drawOverlay("Авария!", "Кот не выдержал... 😿", "💩");
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
