import { hexagramFromLines, mbtiReading, mbtiTypes, transformedLines } from './data.js';

const $ = (id) => document.getElementById(id);
const elements = {
  setup: $('setup'), casting: $('casting'), result: $('result'), mbti: $('mbti'),
  begin: $('begin'), setupError: $('setup-error'), castCount: $('cast-count'),
  castInstruction: $('cast-instruction'), hexLines: $('hex-lines'),
  stage: $('casting-stage'), stageCenter: $('stage-center'), motionStatus: $('motion-status'),
  tapCast: $('tap-cast'), cancel: $('cancel'), again: $('again'),
};

const state = { type: '', lines: [], lastShake: 0, lastGravity: null, motionListener: null, motionTimer: null, hasMotion: false, finishing: false };

for (const type of mbtiTypes) {
  const option = document.createElement('option');
  option.value = type;
  option.textContent = type;
  elements.mbti.append(option);
}

function showScreen(screen) {
  elements.setup.hidden = screen !== 'setup';
  elements.casting.hidden = screen !== 'casting';
  elements.result.hidden = screen !== 'result';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function lineElement(value) {
  const line = document.createElement('div');
  line.className = `yao ${value % 2 ? 'yang' : 'yin'}${value === 6 || value === 9 ? ' moving' : ''}`;
  line.setAttribute('aria-label', `${value % 2 ? '阳爻' : '阴爻'}${value === 6 || value === 9 ? '，动爻' : ''}`);
  const count = value % 2 ? 1 : 2;
  for (let index = 0; index < count; index += 1) {
    const segment = document.createElement('span');
    segment.className = 'segment';
    line.append(segment);
  }
  return line;
}

function paintLines(container, lines) {
  container.replaceChildren(...[...lines].reverse().map(lineElement));
}

function coinCast() {
  const coins = new Uint8Array(3);
  crypto.getRandomValues(coins);
  return 6 + (coins[0] & 1) + (coins[1] & 1) + (coins[2] & 1);
}

function stopMotion() {
  if (state.motionListener) window.removeEventListener('devicemotion', state.motionListener);
  if (state.motionTimer) window.clearTimeout(state.motionTimer);
  state.motionListener = null;
  state.motionTimer = null;
}

function castOne() {
  if (state.finishing || state.lines.length >= 6 || elements.casting.hidden) return;
  state.lines.push(coinCast());
  paintLines(elements.hexLines, state.lines);
  elements.stageCenter.hidden = true;
  elements.castCount.textContent = `${state.lines.length} / 6`;
  elements.castInstruction.textContent = state.lines.length < 6
    ? `第 ${state.lines.length} 爻已成。继续轻摇，或点按投下一爻。`
    : '六爻已成，正在为你展开卦象…';
  elements.motionStatus.textContent = state.lines.length < 6
    ? `已投出第 ${state.lines.length} 爻，继续晃动或点按。`
    : '起卦完成';
  elements.stage.classList.remove('stage-shake');
  void elements.stage.offsetWidth;
  elements.stage.classList.add('stage-shake');
  if (navigator.vibrate) navigator.vibrate(25);
  if (state.lines.length === 6) {
    state.finishing = true;
    elements.tapCast.disabled = true;
    stopMotion();
    window.setTimeout(showResult, 650);
  }
}

function onMotion(event) {
  state.hasMotion = true;
  let intensity = 0;
  const acceleration = event.acceleration;
  if (acceleration && [acceleration.x, acceleration.y, acceleration.z].every(Number.isFinite)) {
    intensity = Math.hypot(acceleration.x, acceleration.y, acceleration.z);
  } else {
    const gravity = event.accelerationIncludingGravity;
    if (!gravity || ![gravity.x, gravity.y, gravity.z].every(Number.isFinite)) return;
    const current = [gravity.x, gravity.y, gravity.z];
    if (state.lastGravity) intensity = Math.hypot(...current.map((value, index) => value - state.lastGravity[index]));
    state.lastGravity = current;
  }
  if (intensity < 10.5 || performance.now() - state.lastShake < 1100) return;
  state.lastShake = performance.now();
  elements.motionStatus.textContent = '已感应到晃动';
  castOne();
}

async function startMotion() {
  stopMotion();
  state.hasMotion = false;
  state.lastGravity = null;
  state.lastShake = performance.now();
  if (!window.isSecureContext || typeof DeviceMotionEvent === 'undefined') {
    elements.motionStatus.textContent = '当前设备无法使用晃动感应，请点按投爻。';
    return;
  }
  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') {
        elements.motionStatus.textContent = '未开启晃动权限，可以点按投爻。';
        return;
      }
    }
    state.motionListener = onMotion;
    window.addEventListener('devicemotion', state.motionListener);
    elements.motionStatus.textContent = '轻摇手机，投出第一爻';
    state.motionTimer = window.setTimeout(() => {
      if (!state.hasMotion && !elements.casting.hidden) {
        elements.motionStatus.textContent = '暂未收到晃动信号，可点按投爻。';
      }
    }, 2400);
  } catch {
    elements.motionStatus.textContent = '无法开启晃动感应，可以点按投爻。';
  }
}

function beginCasting() {
  state.lines = [];
  state.finishing = false;
  elements.tapCast.disabled = false;
  elements.castCount.textContent = '0 / 6';
  elements.castInstruction.textContent = '每晃动一次，生成一爻。爻位从下往上排列。';
  elements.hexLines.replaceChildren();
  elements.stageCenter.hidden = false;
  showScreen('casting');
  startMotion();
}

function showResult() {
  const hex = hexagramFromLines(state.lines);
  const movingCount = state.lines.filter((line) => line === 6 || line === 9).length;
  const mbti = mbtiReading(state.type, hex);
  $('result-number').textContent = `第 ${String(hex.number).padStart(2, '0')} 卦`;
  $('result-trigrams').textContent = `${hex.upper.image}上${hex.lower.image}下 · ${hex.upper.name}${hex.lower.name}`;
  $('result-title').textContent = hex.name;
  $('result-theme').textContent = hex.theme;
  $('result-symbol').textContent = hex.symbol;
  $('result-reading').textContent = hex.reading;
  $('result-action').textContent = hex.action;
  $('result-mbti').textContent = state.type;
  $('mbti-opening').textContent = `从 ${state.type} 的行动习惯看，这一卦可以这样读：`;
  const points = $('mbti-points');
  points.replaceChildren(...[mbti.energy, mbti.information, mbti.decision, mbti.pace].map((copy) => {
    const item = document.createElement('li');
    item.textContent = copy;
    return item;
  }));
  $('mbti-close').textContent = mbti.close;
  paintLines($('result-lines'), state.lines);
  const change = $('change-card');
  change.hidden = movingCount === 0;
  if (movingCount) {
    const future = hexagramFromLines(transformedLines(state.lines));
    $('change-title').textContent = `第 ${future.number} 卦 · ${future.name}`;
    $('change-symbol').textContent = future.symbol;
    $('change-reading').textContent = `${movingCount} 个动爻变化后，卦象转向「${future.theme}」。${future.reading} ${future.action}`;
  }
  showScreen('result');
}

elements.begin.addEventListener('click', () => {
  const type = elements.mbti.value;
  if (!mbtiTypes.includes(type)) {
    elements.setupError.hidden = false;
    elements.mbti.focus();
    return;
  }
  elements.setupError.hidden = true;
  state.type = type;
  beginCasting();
});
elements.mbti.addEventListener('change', () => { elements.setupError.hidden = true; });
elements.tapCast.addEventListener('click', castOne);
elements.cancel.addEventListener('click', () => { stopMotion(); showScreen('setup'); });
elements.again.addEventListener('click', beginCasting);
