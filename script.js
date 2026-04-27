let engine;
let world;
let boxes = [];
let ground;
let currentFilter = 'all';
let scrollOffset = 0;

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let touchedBox = null;
let dragDirection = null;

const CARD_GAP = 8;

let particles = [];
let shakeAmount = 0;
let shakeDecay = 0.85;

// localStorage保存
function saveTasks() {
  const data = boxes.map(b => ({
    taskLabel: b.taskLabel,
    boxHeight: b.boxHeight,
    boxColor: b.boxColor,
    originVal: b.originVal,
    marked: b.marked,
    weightVal: b.weightVal,
  }));
  localStorage.setItem('daruma_tasks', JSON.stringify(data));
}

// localStorage読み込み
function loadTasks() {
  const raw = localStorage.getItem('daruma_tasks');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    data.forEach((d, i) => {
      let spawnY = -80 - (i * 130);
      let body = Matter.Bodies.rectangle(width / 2, spawnY, width - 26, d.boxHeight, {
        restitution: 0.05, friction: 0, frictionStatic: 0, frictionAir: 0.02, inertia: Infinity
      });
      Matter.World.add(world, body);
      boxes.push({
        body,
        taskLabel: d.taskLabel,
        boxHeight: d.boxHeight,
        boxColor: d.boxColor,
        originVal: d.originVal,
        marked: d.marked || false,
        weightVal: d.weightVal || 'medium',
        landed: false,
        removing: false,
        removeDir: 0, removeX: 0, removeY: 0, removeOpacity: 255,
      });
    });
  } catch(e) {
    console.warn('loadTasks failed:', e);
  }
}

function setup() {
  const cardFrame = document.getElementById('card-frame');
  const cw = cardFrame.clientWidth;
  const ch = cardFrame.clientHeight;
  let canvas = createCanvas(cw, ch);
  canvas.parent('card-frame');

  engine = Matter.Engine.create();
  engine.gravity.y = 4;
  world = engine.world;

  ground = Matter.Bodies.rectangle(width / 2, height + 10, width, 40, { isStatic: true });
  Matter.World.add(world, ground);

  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      updateFilter();
    });
  });

  document.getElementById('openModalBtn').addEventListener('click', () =>
    document.getElementById('taskModal').classList.remove('hidden'));
  document.getElementById('cancelBtn').addEventListener('click', () => {
    document.getElementById('taskModal').classList.add('hidden');
    document.getElementById('taskInput').value = '';
  });
  document.getElementById('addBtn').addEventListener('click', addNewTask);
  document.getElementById('scrollToBottomBtn').addEventListener('click', () => { scrollOffset = 0; });

  setupSelectionLogic('weightGroup');
  setupSelectionLogic('originGroup');

  loadTasks();
}

function getVisibleBoxes() {
  return boxes.filter(b => currentFilter === 'all' || b.originVal === currentFilter);
}

function getTargetY(index, visibleBoxes) {
  let y = height - 10;
  for (let i = 0; i < index; i++) {
    y -= visibleBoxes[i].boxHeight + CARD_GAP;
  }
  y -= visibleBoxes[index].boxHeight / 2;
  return y;
}

function updateFilter() {
  // 全タスクをいったん物理世界から削除
  boxes.forEach(b => {
    if (!b.removing) {
      try { Matter.World.remove(world, b.body); } catch(e) {}
    }
  });

  // 表示対象のタスクだけ物理世界に追加して落とす
  let visible = getVisibleBoxes().filter(b => !b.removing);
  visible.forEach((b, i) => {
    b.landed = false;
    Matter.Body.setPosition(b.body, { x: width / 2, y: -80 - (i * 130) });
    Matter.Body.setVelocity(b.body, { x: 0, y: 0 });
    Matter.Body.setStatic(b.body, false);
    Matter.World.add(world, b.body);
  });

  scrollOffset = 0;
}

function setupSelectionLogic(groupId) {
  const group = document.getElementById(groupId);
  const buttons = group.querySelectorAll('.select-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function addNewTask() {
  const taskInput = document.getElementById('taskInput');
  let label = taskInput.value.trim();
  if (label === "") label = "無題";

  let weightBtn = document.querySelector('#weightGroup .active');
  let weightVal = weightBtn ? weightBtn.dataset.value : 'medium';
  let boxHeight = weightVal === 'small' ? 50 : (weightVal === 'large' ? 160 : 90);

  let originBtn = document.querySelector('#originGroup .active');
  let originVal = originBtn ? originBtn.dataset.value : 'today';

  const palette = [[57, 133, 247], [60, 160, 60], [137, 106, 230], [222, 27, 90]];
  let baseColor = random(palette);

  let spawnY = -80 - (boxes.length * 30);

  let body = Matter.Bodies.rectangle(width / 2, spawnY, width - 26, boxHeight, {
    restitution: 0.05, friction: 0, frictionStatic: 0, frictionAir: 0.02, inertia: Infinity
  });

  let box = {
    body,
    taskLabel: label,
    boxHeight,
    boxColor: baseColor,
    originVal,
    weightVal,
    marked: false,
    landed: false,
    removing: false,
    removeDir: 0, removeX: 0, removeY: 0, removeOpacity: 255,
  };

  boxes.push(box);

  // 現在のフィルターに表示されるタスクのみ物理世界に追加
  if (currentFilter === 'all' || originVal === currentFilter) {
    Matter.World.add(world, body);
  }

  saveTasks();
  taskInput.value = '';
  document.getElementById('taskModal').classList.add('hidden');
}

function reshuffleVisible() {
  // 全タスクを物理世界から削除してから再配置
  boxes.forEach(b => {
    if (!b.removing) {
      try { Matter.World.remove(world, b.body); } catch(e) {}
    }
  });

  let visible = getVisibleBoxes().filter(b => !b.removing);
  visible.forEach((b, i) => {
    b.landed = false;
    Matter.Body.setPosition(b.body, { x: width / 2, y: -80 - (i * 60) });
    Matter.Body.setVelocity(b.body, { x: 0, y: 0 });
    Matter.Body.setStatic(b.body, false);
    Matter.World.add(world, b.body);
  });
}

function mousePressed() {
  touchStartX = mouseX;
  touchStartY = mouseY;
  touchStartTime = millis();
  dragDirection = null;

  let physY = mouseY - scrollOffset;
  touchedBox = null;

  let visible = getVisibleBoxes();
  for (let box of visible) {
    if (box.removing) continue;
    let hw = (width - 26) / 2;
    let hh = box.boxHeight / 2;
    let bx = box.landed ? box.fixedX : box.body.position.x;
    let by = box.landed ? box.fixedY : box.body.position.y;
    if (mouseX > bx - hw && mouseX < bx + hw &&
        physY > by - hh && physY < by + hh) {
      touchedBox = box;
      break;
    }
  }
}

function mouseDragged() {
  let dx = mouseX - touchStartX;
  let dy = mouseY - touchStartY;

  if (dragDirection === null && (abs(dx) > 8 || abs(dy) > 8)) {
    dragDirection = abs(dy) > abs(dx) ? 'vertical' : 'horizontal';
    if (dragDirection === 'vertical') touchedBox = null;
  }

  if (dragDirection === 'vertical') {
    scrollOffset -= (pmouseY - mouseY);
  }
}

function mouseReleased() {
  if (dragDirection === 'vertical' || touchedBox === null) {
    dragDirection = null;
    touchedBox = null;
    return;
  }

  let dx = mouseX - touchStartX;
  let dy = mouseY - touchStartY;
  let totalDist = sqrt(dx * dx + dy * dy);

  if (totalDist < 8) {
    let physY = touchStartY - scrollOffset;
    let b = touchedBox;
    let bx = b.landed ? b.fixedX : b.body.position.x;
    let by = b.landed ? b.fixedY : b.body.position.y;
    let iconX = bx - (width / 2 - 13) + 20;
    let iconY = by;
    if (dist(touchStartX, physY, iconX, iconY) < 18) {
      b.marked = !b.marked;
      saveTasks();
      dragDirection = null;
      touchedBox = null;
      return;
    }
  }

  let dt = millis() - touchStartTime;
  let vx = dx / dt;
  const FLICK_THRESHOLD = 0.45;
  if (abs(vx) > FLICK_THRESHOLD && abs(dx) > abs(dy) * 1.5) {
    let dir = vx > 0 ? 1 : -1;
    let b = touchedBox;
    b.removing = true;
    b.removeDir = dir;
    b.removeX = b.landed ? b.fixedX : b.body.position.x;
    b.removeY = b.landed ? b.fixedY : b.body.position.y;
    b.removeOpacity = 255;

    let intensity = b.boxHeight <= 50 ? 1 : (b.boxHeight >= 160 ? 3 : 2);
    triggerEffect(b.removeX, b.removeY, intensity, b.boxColor);

    try { Matter.World.remove(world, b.body); } catch(e) {}

    setTimeout(() => {
      boxes = boxes.filter(box => box !== b);
      reshuffleVisible();
      saveTasks();
    }, 300);
  }

  dragDirection = null;
  touchedBox = null;
}

function triggerEffect(x, y, intensity, col) {
  shakeAmount = intensity * 4;

  if ('vibrate' in navigator) {
    if (intensity === 1) navigator.vibrate(20);
    else if (intensity === 2) navigator.vibrate(50);
    else navigator.vibrate([80, 30, 80]);
  }

  let count = intensity * 8;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + random(-20, 20),
      y: y + random(-10, 10),
      vx: random(-2, 2) * intensity,
      vy: random(-3, -1) * intensity,
      size: random(6, 14) * intensity,
      opacity: 180,
      col: col,
    });
  }
}

function draw() {
  background(240, 240, 240);
  Matter.Engine.update(engine);

  let visible = getVisibleBoxes();

  visible.forEach((b, i) => {
    if (b.removing || b.landed) return;
    let targetY = getTargetY(i, visible);
    if (b.body.position.y >= targetY - 5) {
      b.landed = true;
      b.fixedX = width / 2;
      b.fixedY = targetY;
      Matter.Body.setStatic(b.body, true);
      Matter.Body.setPosition(b.body, { x: b.fixedX, y: b.fixedY });
    }
  });

  let topY = height;
  visible.forEach(b => {
    let by = b.landed ? b.fixedY : b.body.position.y;
    if (by - b.boxHeight / 2 < topY) topY = by - b.boxHeight / 2;
  });
  let maxScroll = Math.max(0, -topY + 40);
  scrollOffset = constrain(scrollOffset, 0, maxScroll);

  document.getElementById('scrollToBottomBtn').classList.toggle('hidden', scrollOffset <= 50);

  shakeAmount *= shakeDecay;
  let sx = shakeAmount > 0.5 ? random(-shakeAmount, shakeAmount) : 0;
  let sy = shakeAmount > 0.5 ? random(-shakeAmount, shakeAmount) : 0;

  push();
  translate(sx, scrollOffset + sy);

  boxes.filter(b => b.removing).forEach(b => {
    b.removeX += b.removeDir * 30;
    b.removeOpacity -= 25;
    if (b.removeOpacity > 0) drawCard(b, b.removeX, b.removeY, b.removeOpacity);
  });

  visible.forEach(b => {
    if (b.removing) return;
    let bx = b.landed ? b.fixedX : b.body.position.x;
    let by = b.landed ? b.fixedY : b.body.position.y;
    drawCard(b, bx, by, 255);
  });

  noStroke();
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15;
    p.opacity -= 8; p.size *= 0.95;
    if (p.opacity <= 0) { particles.splice(i, 1); continue; }
    fill(p.col[0], p.col[1], p.col[2], p.opacity * 0.5);
    ellipse(p.x, p.y, p.size);
  }

  pop();
}

function drawCard(b, bx, by, opacity) {
  let col = b.boxColor;
  fill(col[0], col[1], col[2], opacity);
  noStroke();
  rectMode(CENTER);

  push();
  translate(bx, by);
  rect(0, 0, width - 26, b.boxHeight, 12);

  let compR = 255 - col[0];
  let compG = 255 - col[1];
  let compB = 255 - col[2];

  if (b.marked) {
    let lineX = -(width - 26) / 2;
    fill(compR, compG, compB, opacity);
    noStroke();
    rectMode(CORNER);
    rect(lineX, -b.boxHeight / 2, 6, b.boxHeight, 12, 0, 0, 12);
    rectMode(CENTER);
  }

  let iconX = -(width / 2 - 13) + 20;
  let iconY = 0;
  let iconR = 11;
  if (b.marked) {
    fill(255, 255, 255, opacity); noStroke();
    ellipse(iconX, iconY, iconR * 2);
    fill(col[0], col[1], col[2], opacity);
    textAlign(CENTER, CENTER); textSize(12); textStyle(BOLD);
    text('!', iconX, iconY - 1); textStyle(NORMAL);
  } else {
    noFill(); stroke(255, 255, 255, opacity); strokeWeight(1.5);
    ellipse(iconX, iconY, iconR * 2);
    fill(255, 255, 255, opacity); noStroke();
    textAlign(CENTER, CENTER); textSize(12); textStyle(BOLD);
    text('!', iconX, iconY - 1); textStyle(NORMAL);
  }

  fill(255, 255, 255, opacity); noStroke();
  textAlign(LEFT, CENTER); textSize(15);
  text(b.taskLabel, -(width / 2 - 26) + 44, 0);
  pop();
}

function mouseWheel(event) {
  scrollOffset -= event.delta;
  return false;
}
