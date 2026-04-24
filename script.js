let engine;
let world;
let boxes = [];
let ground;
let currentFilter = 'all';
let scrollOffset = 0;

// タッチ・フリック管理
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let touchedBox = null;
let dragDirection = null; // 'horizontal' | 'vertical' | null

function setup() {
  let canvas = createCanvas(366, 684);
  canvas.parent('card-frame');

  engine = Matter.Engine.create();
  world = engine.world;

  ground = Matter.Bodies.rectangle(width / 2, height + 10, width, 40, { isStatic: true });
  Matter.World.add(world, ground);

  // マウスコンストレイントは使わない

  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      updatePhysicsFilter();
    });
  });

  const openModalBtn = document.getElementById('openModalBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const addBtn = document.getElementById('addBtn');
  const modal = document.getElementById('taskModal');
  const taskInput = document.getElementById('taskInput');
  const scrollToBottomBtn = document.getElementById('scrollToBottomBtn');

  openModalBtn.addEventListener('click', () => modal.classList.remove('hidden'));
  cancelBtn.addEventListener('click', () => { modal.classList.add('hidden'); taskInput.value = ''; });
  addBtn.addEventListener('click', addNewTask);
  scrollToBottomBtn.addEventListener('click', () => { scrollOffset = 0; });

  setupSelectionLogic('weightGroup');
  setupSelectionLogic('originGroup');
}

// タッチ開始：どのタスクに触れたか記録
function mousePressed() {
  touchStartX = mouseX;
  touchStartY = mouseY;
  touchStartTime = millis();
  dragDirection = null;

  // スクロールを考慮した物理座標
  let physY = mouseY - scrollOffset;

  touchedBox = null;
  for (let b of boxes) {
    if (b.isHidden) continue;
    let hw = 170; // 340/2
    let hh = b.boxHeight / 2;
    if (
      mouseX > b.position.x - hw && mouseX < b.position.x + hw &&
      physY > b.position.y - hh && physY < b.position.y + hh
    ) {
      touchedBox = b;
      break;
    }
  }
}

// ドラッグ中：方向を確定してスクロールまたはタスク予備動作
function mouseDragged() {
  let dx = mouseX - touchStartX;
  let dy = mouseY - touchStartY;

  if (dragDirection === null && (abs(dx) > 8 || abs(dy) > 8)) {
    dragDirection = abs(dy) > abs(dx) ? 'vertical' : 'horizontal';
    if (dragDirection === 'vertical') touchedBox = null; // 縦ならタスク操作キャンセル
  }

  if (dragDirection === 'vertical') {
    scrollOffset += (pmouseY - mouseY);
  }
}

// タッチ終了：フリック判定
function mouseReleased() {
  if (dragDirection === 'vertical' || touchedBox === null) {
    dragDirection = null;
    touchedBox = null;
    return;
  }

  let dx = mouseX - touchStartX;
  let dy = mouseY - touchStartY;
  let dt = millis() - touchStartTime;
  let vx = dx / dt; // px/ms

  // 横方向に十分速く動いていたらフリック判定
  const FLICK_THRESHOLD = 0.5; // px/ms
  if (abs(vx) > FLICK_THRESHOLD && abs(dx) > abs(dy) * 1.5) {
    let dir = vx > 0 ? 1 : -1;
    // 勢いに応じた速度を付与してタスクを飛ばす
    let speed = constrain(abs(vx) * 25, 15, 40);
    Matter.Body.setVelocity(touchedBox, { x: dir * speed, y: -2 });
  }

  dragDirection = null;
  touchedBox = null;
}

function updatePhysicsFilter() {
  let respawnCount = 0;
  boxes.forEach(b => {
    const shouldShow = (currentFilter === 'all' || b.originVal === currentFilter);
    if (shouldShow) {
      if (b.isHidden) {
        b.isHidden = false;
        if (currentFilter === 'all' && b.savedY !== undefined) {
          Matter.Body.setPosition(b, { x: width / 2, y: b.savedY });
          Matter.Body.setVelocity(b, { x: 0, y: 0 });
          Matter.Body.setAngularVelocity(b, 0);
          Matter.Body.setStatic(b, false);
        } else {
          Matter.Body.setPosition(b, { x: width / 2, y: -100 - scrollOffset - (respawnCount * 90) });
          Matter.Body.setVelocity(b, { x: 0, y: 0 });
          Matter.Body.setAngularVelocity(b, 0);
          Matter.Body.setStatic(b, false);
          respawnCount++;
        }
      }
    } else {
      if (!b.isHidden) {
        if (currentFilter !== 'all') b.savedY = b.position.y;
        b.isHidden = true;
        Matter.Body.setStatic(b, true);
        Matter.Body.setPosition(b, { x: width / 2, y: -10000 });
      }
    }
  });
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
  let label = taskInput.value;
  if (label === "") label = "無題";

  let weightBtn = document.querySelector('#weightGroup .active');
  let weightVal = weightBtn ? weightBtn.dataset.value : 'medium';
  let boxHeight = weightVal === 'small' ? 50 : (weightVal === 'large' ? 200 : 100);

  let originBtn = document.querySelector('#originGroup .active');
  let originVal = originBtn ? originBtn.dataset.value : 'today';

  const palette = [[57, 133, 247], [140, 230, 80], [137, 106, 230], [227, 213, 50]];
  let baseColor = random(palette);
  let alpha = originVal === 'week' ? 200 : (originVal === 'someday' ? 130 : 255);

  let spawnY = -50 - scrollOffset;

  let b = Matter.Bodies.rectangle(width / 2, spawnY, 340, boxHeight, {
    restitution: 0.1,
    friction: 0.5,
    inertia: Infinity
  });

  b.taskLabel = label;
  b.boxHeight = boxHeight;
  b.boxColor = [baseColor[0], baseColor[1], baseColor[2], alpha];
  b.originVal = originVal;
  b.isHidden = false;

  if (currentFilter !== 'all' && originVal !== currentFilter) {
    b.isHidden = true;
    Matter.Body.setStatic(b, true);
    Matter.Body.setPosition(b, { x: width / 2, y: -10000 });
  }

  boxes.push(b);
  Matter.World.add(world, b);

  taskInput.value = '';
  document.getElementById('taskModal').classList.add('hidden');
}

function draw() {
  background(240, 240, 240);
  Matter.Engine.update(engine);

  // スクロール上限計算
  let highestY = height;
  boxes.forEach(b => {
    if (!b.isHidden && b.position.y > -5000 && b.position.y < highestY) {
      highestY = b.position.y;
    }
  });
  let maxScroll = Math.max(0, (height / 2) - highestY);
  scrollOffset = constrain(scrollOffset, 0, maxScroll);

  // ↓ボタン表示切り替え
  const scrollBtn = document.getElementById('scrollToBottomBtn');
  if (scrollOffset > 50) {
    scrollBtn.classList.remove('hidden');
  } else {
    scrollBtn.classList.add('hidden');
  }

  push();
  translate(0, scrollOffset);

  // 地面
  fill(200);
  noStroke();
  rectMode(CENTER);
  rect(ground.position.x, ground.position.y, width, 40);

  for (let i = boxes.length - 1; i >= 0; i--) {
    let b = boxes[i];

    // 画面外に飛んだら削除
    if (b.position.x < -300 || b.position.x > width + 300) {
      Matter.World.remove(world, b);
      boxes.splice(i, 1);
      continue;
    }

    if (b.isHidden) continue;

    // 中央復帰（飛んでいないときだけ）
    let isFlying = abs(b.velocity.x) > 3;
    if (!isFlying) {
      let newX = lerp(b.position.x, width / 2, 0.2);
      Matter.Body.setPosition(b, { x: newX, y: b.position.y });
      Matter.Body.setVelocity(b, { x: b.velocity.x * 0.8, y: b.velocity.y });
    }

    // フリック中のタスクをハイライト
    let isTarget = (touchedBox === b && dragDirection === 'horizontal');

    fill(b.boxColor[0], b.boxColor[1], b.boxColor[2], b.boxColor[3]);
    noStroke();
    rectMode(CENTER);

    push();
    translate(b.position.x, b.position.y);

    // フリック対象は少し傾ける
    if (isTarget) {
      let tilt = map(mouseX - touchStartX, -100, 100, -0.05, 0.05);
      rotate(tilt);
    }

    rect(0, 0, 340, b.boxHeight, 12);

    fill(255, 255, 255, b.boxColor[3]);
    textAlign(LEFT, CENTER);
    textSize(15);
    text(b.taskLabel, -155, 0);
    pop();
  }

  pop();
}

function mouseWheel(event) {
  scrollOffset += event.delta;
  return false;
}
