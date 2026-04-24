let engine;
let world;
let boxes = [];   // { body, label, priority, removing, removeDir, opacity }
let ground;
let mConstraint;

// ===== スワイプモード切替 =====
// 'tinder'  : 勢いよく投げると飛んで消える
// 'ios'     : ゆっくり引っ張って離したら消える
let SWIPE_MODE = 'tinder';

// 削除判定のしきい値
const DISMISS_VELOCITY  = 8;   // Tinderモード: この速度以上で投げると削除
const DISMISS_DISTANCE  = 160; // iOSモード  : この距離以上離したら削除

// 優先度カラー
const PRIORITY_COLORS = {
  high:   [220, 80,  70],
  medium: [240, 160, 50],
  low:    [80,  160, 120]
};

function setup() {
  let canvas = createCanvas(390, 844);
  canvas.parent('app-frame');

  engine = Matter.Engine.create();
  world  = engine.world;

  ground = Matter.Bodies.rectangle(width / 2, height + 10, width, 40, { isStatic: true });
  Matter.World.add(world, ground);

  let canvasMouse = Matter.Mouse.create(canvas.elt);
  canvasMouse.pixelRatio = pixelDensity();
  mConstraint = Matter.MouseConstraint.create(engine, {
    mouse: canvasMouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
  });
  Matter.World.add(world, mConstraint);

  select('#addBtn').mousePressed(addNewTask);
  select('#modeBtn').mousePressed(toggleMode);
  updateModeBtn();
}

function toggleMode() {
  SWIPE_MODE = (SWIPE_MODE === 'tinder') ? 'ios' : 'tinder';
  updateModeBtn();
}

function updateModeBtn() {
  let btn = select('#modeBtn');
  if (SWIPE_MODE === 'tinder') {
    btn.html('🃏 Tinder式');
  } else {
    btn.html('📱 iOS式');
  }
}

function addNewTask() {
  let input = select('#taskInput');
  let label = input.value().trim();
  if (!label) label = 'タスク ' + (boxes.length + 1);

  let priorities = ['high', 'medium', 'low'];
  let priority = priorities[floor(random(3))];

  let b = Matter.Bodies.rectangle(width / 2, -80, 310, 64, {
    restitution: 0.15,
    friction: 0.6,
    frictionAir: 0.02,
    inertia: Infinity
  });

  boxes.push({ body: b, label, priority, removing: false, removeDir: 0, opacity: 255 });
  Matter.World.add(world, b);
  input.value('');
}

function draw() {
  background(240);
  Matter.Engine.update(engine);

  for (let i = boxes.length - 1; i >= 0; i--) {
    let item = boxes[i];
    let b    = item.body;
    let pos  = b.position;
    let vel  = b.velocity;

    // 削除フェードアウト中
    if (item.removing) {
      item.opacity -= 18;
      // 物理エンジンから切り離して水平に移動
      Matter.Body.setPosition(b, { x: pos.x + item.removeDir * 28, y: item.removeStartY });
      Matter.Body.setVelocity(b, { x: 0, y: 0 });
      Matter.Body.setAngle(b, 0); // 傾きをゼロに固定
      if (item.opacity <= 0) {
        Matter.World.remove(world, b);
        boxes.splice(i, 1);
        continue;
      }
      drawBlock(item);
      continue;
    }

    let isGrabbed = (mConstraint.body === b);
    let offsetX   = pos.x - width / 2;

    // 削除トリガー判定
    if (!isGrabbed) {
      if (SWIPE_MODE === 'tinder') {
        if (abs(vel.x) > DISMISS_VELOCITY) {
          item.removing     = true;
          item.removeDir    = vel.x > 0 ? 1 : -1;
          item.removeStartY = pos.y;
          Matter.Body.setAngle(b, 0);
          continue;
        }
      } else {
        if (abs(offsetX) > DISMISS_DISTANCE) {
          item.removing     = true;
          item.removeDir    = offsetX > 0 ? 1 : -1;
          item.removeStartY = pos.y;
          Matter.Body.setAngle(b, 0);
          continue;
        }
      }
    }

    // 中央復帰: バネ力でX方向のみ引き寄せ、X速度に減衰
    if (!isGrabbed) {
      let pullForce = (width / 2 - pos.x) * 0.003;
      Matter.Body.applyForce(b, pos, { x: pullForce, y: 0 });
      Matter.Body.setVelocity(b, { x: vel.x * 0.75, y: vel.y });
    }

    drawBlock(item);
  }
}

function drawBlock(item) {
  let b    = item.body;
  let pos  = b.position;
  let alpha = item.opacity;
  let offsetX = pos.x - width / 2;
  let [r, g, bv] = PRIORITY_COLORS[item.priority];

  // 傾き（削除中は水平を保つ）
  let tilt = item.removing ? 0 : map(offsetX, -200, 200, -0.15, 0.15);

  // iOSモード削除ヒント
  let dismissProgress = 0;
  if (SWIPE_MODE === 'ios') {
    dismissProgress = constrain(abs(offsetX) / DISMISS_DISTANCE, 0, 1);
  }

  push();
  translate(pos.x, pos.y);
  rotate(tilt);

  // 影
  noStroke();
  fill(0, 0, 0, map(alpha, 0, 255, 0, 40));
  rect(-152, 6, 310, 64, 14);

  // 本体
  fill(30, 30, 36, alpha);
  rect(-155, -32, 310, 64, 12);

  // 優先度バー（左端）
  fill(r, g, bv, alpha);
  rect(-155, -32, 6, 64, 12, 0, 0, 12);

  // タスクテキスト
  fill(255, 255, 255, alpha);
  noStroke();
  textSize(15);
  textAlign(LEFT, CENTER);
  let label = item.label.length > 18 ? item.label.substring(0, 17) + '…' : item.label;
  text(label, -136, 0);

  // 優先度バッジ
  fill(r, g, bv, alpha * 0.25);
  rect(104, -14, 42, 28, 8);
  fill(r, g, bv, alpha);
  textSize(11);
  textAlign(CENTER, CENTER);
  let pLabel = item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低';
  text(pLabel, 125, 0);

  // iOSモード: 削除ヒント矢印
  if (SWIPE_MODE === 'ios' && dismissProgress > 0.4) {
    let arrowAlpha = map(dismissProgress, 0.4, 1.0, 0, 200) * (alpha / 255);
    fill(255, 100, 100, arrowAlpha);
    textSize(20);
    textAlign(CENTER, CENTER);
    let arrowDir = offsetX > 0 ? '→' : '←';
    text(arrowDir, offsetX > 0 ? 145 : -145, 0);
  }

  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  Matter.Body.setPosition(ground, { x: width / 2, y: height + 10 });
}
