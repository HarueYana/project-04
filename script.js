let engine;
let world;
let boxes = [];
let ground;
let mConstraint;
let currentFilter = 'all';
let scrollOffset = 0;
let dragStartX = 0;
let dragStartY = 0;
let dragDirection = null; // 'horizontal' | 'vertical' | null
let isScrolling = false;

function setup() {
  // card-frameのサイズに合わせてキャンバスを作成（390-24px両側, 844-148-12px）
  let canvas = createCanvas(366, 684);
  canvas.parent('card-frame');
  
  engine = Matter.Engine.create();
  world = engine.world;
  
  ground = Matter.Bodies.rectangle(width/2, height + 10, width, 40, { isStatic: true });
  Matter.World.add(world, ground);
  
  let canvasMouse = Matter.Mouse.create(canvas.elt);
  canvasMouse.pixelRatio = pixelDensity();
  mConstraint = Matter.MouseConstraint.create(engine, {
    mouse: canvasMouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
  });
  Matter.World.add(world, mConstraint);

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
  const scrollToBottomBtn = document.getElementById('scrollToBottomBtn'); // 新規追加

  openModalBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    taskInput.value = '';
  });

  addBtn.addEventListener('click', addNewTask);

  // ↓ボタンを押したらスクロール量を0（一番下）に戻す
  scrollToBottomBtn.addEventListener('click', () => {
    scrollOffset = 0;
  });

  setupSelectionLogic('weightGroup');
  setupSelectionLogic('originGroup');
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
          // 現在のカメラ位置を加味した上空から落とす
          Matter.Body.setPosition(b, { x: width / 2, y: -100 - scrollOffset - (respawnCount * 90) });
          Matter.Body.setVelocity(b, { x: 0, y: 0 });
          Matter.Body.setAngularVelocity(b, 0);
          Matter.Body.setStatic(b, false);
          respawnCount++;
        }
      }
    } else {
      if (!b.isHidden) {
        if (currentFilter !== 'all') {
          b.savedY = b.position.y;
        }
        b.isHidden = true;
        Matter.Body.setStatic(b, true);
        Matter.Body.setPosition(b, { x: width / 2, y: -10000 }); // スクロールで見えないよう深くする
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

  // 画面の上端（スクロール量に合わせて変化）からタスクを降らせる
  let spawnY = -50 - scrollOffset;

  let b = Matter.Bodies.rectangle(width/2, spawnY, 340, boxHeight, {
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

  // --- 1. スクロールの限界値を計算（一番高いタスクを探す） ---
  let highestY = height;
  boxes.forEach(b => {
    // 待機部屋（-5000より上）のタスクは除外し、一番高い位置を更新
    if (!b.isHidden && b.position.y > -5000 && b.position.y < highestY) {
      highestY = b.position.y;
    }
  });
  
  // 画面中央（height/2）までスクロールできるように制限をかける
  let maxScroll = Math.max(0, (height / 2) - highestY);
  scrollOffset = constrain(scrollOffset, 0, maxScroll);

  // --- 2. ↓ボタンの表示切り替え ---
  const scrollBtn = document.getElementById('scrollToBottomBtn');
  if (scrollOffset > 50) {
    scrollBtn.classList.remove('hidden');
  } else {
    scrollBtn.classList.add('hidden');
  }

  // --- 3. マウスの物理判定座標をカメラのズレに合わせて補正 ---
  Matter.Mouse.setOffset(mConstraint.mouse, { x: 0, y: -scrollOffset });

  // --- 4. 描画用のカメラ設定（ここから下の要素が動く） ---
  push();
  translate(0, scrollOffset);

  // 地面を描画（底面が落ちていくのが視覚的にわかるように）
  fill(50);
  noStroke();
  rectMode(CENTER);
  rect(ground.position.x, ground.position.y, width, 40);

  for (let i = boxes.length - 1; i >= 0; i--) {
    let b = boxes[i];

    if (b.position.x < -200 || b.position.x > width + 200) {
      Matter.World.remove(world, b);
      boxes.splice(i, 1);
      continue;
    }

    if (b.isHidden) continue; 

    let isGrabbed = (mConstraint.body === b);
    let isFlying = abs(b.velocity.x) > 2;
    let isPulledOut = abs(b.position.x - width/2) > 120;

    if (!isGrabbed && !isFlying && !isPulledOut) {
      let newX = lerp(b.position.x, width/2, 0.2);
      Matter.Body.setPosition(b, { x: newX, y: b.position.y });
      Matter.Body.setVelocity(b, { x: 0, y: b.velocity.y });
    }

    fill(b.boxColor[0], b.boxColor[1], b.boxColor[2], b.boxColor[3]);
    noStroke();
    rectMode(CENTER);
    
    push();
    translate(b.position.x, b.position.y);
    rect(0, 0, 340, b.boxHeight, 10); 

    fill(255, 255, 255, b.boxColor[3]); 
    textAlign(CENTER, CENTER);
    textSize(16);
    text(b.taskLabel, 0, 0); 
    pop();
  }
  
  pop(); // カメラ設定終了
}

// --- 5. 新規追加：スクロールの操作処理 ---
function mouseWheel(event) {
  // トラックパッドやマウスホイールでのスクロール
  scrollOffset += event.delta;
  return false; // ブラウザ自体のスクロールを防ぐ
}

function mousePressed() {
  dragStartX = mouseX;
  dragStartY = mouseY;
  dragDirection = null;
  isScrolling = false;
}

function mouseDragged() {
  let dx = mouseX - dragStartX;
  let dy = mouseY - dragStartY;

  // ドラッグ方向をまだ決めていない場合、一定距離動いたら確定する
  if (dragDirection === null && (abs(dx) > 8 || abs(dy) > 8)) {
    if (abs(dy) > abs(dx)) {
      dragDirection = 'vertical';
      isScrolling = true;
      // 縦スクロールと判定したらMatter.jsの掴みを解除
      Matter.MouseConstraint.clearBodyAtPoint(mConstraint, { x: mouseX, y: mouseY - scrollOffset });
      mConstraint.body = null;
    } else {
      dragDirection = 'horizontal';
      isScrolling = false;
    }
  }

  // 縦方向と確定済みの場合のみスクロール
  if (isScrolling) {
    scrollOffset += (pmouseY - mouseY);
  }
}

function mouseReleased() {
  dragDirection = null;
  isScrolling = false;
}
