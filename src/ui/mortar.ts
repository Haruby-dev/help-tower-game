import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState } from '../core/state';
import { haveFor, recipes } from '../systems/cooking';
import {
  finishPounding,
  jobGives,
  jobIngredients,
  jobMinutes,
  jobOutput,
  judgePound,
  maxPounds,
  mortarJobs,
  poundPoints,
  poundStars,
  ringMs,
  stationTable,
  type MortarJob,
  type PoundJudge,
} from '../systems/stations';
import { bagArtId, itemName } from './inventory';
import { artUrl, sizedArt } from './pixelArt';
import { revealWhenReady } from './preload';

/**
 * ครกหินเก่า (งานอาหารโซน 1 ขั้นที่ 5 · สเปกข้อ 5.3) เลือกของที่จะตำ แล้วเล่นมินิเกมตำเป็นจังหวะ
 * มินิเกมตามภาพตัวอย่าง art-src/mortar_1108/mortar_1108b/pound_minigame.gif: ครกใหญ่กลางจอ (ไม่มีตัวเอก) วงหดเข้าหาปากครก
 * แตะตอนวงแตะขอบ สากตำ "ตุ๊บ" 6 ครั้ง · ฉากวาดบนแคนวาส 128×100 พิกเซล ขยายจำนวนเต็ม ครกขยาย 2 เท่า (ไม่ย่อภาพ)
 */
const WINDOW = 'mortar';
const rules = stationTable.mortar;
/** พิกัดในฉากมินิเกม (พิกเซลแคนวาส ตามภาพตัวอย่าง) */
const STAGE = { width: 128, height: 100 };
const MORTAR = { x: 36, y: 38, scale: 2 };
const MOUTH = { x: MORTAR.x + 28, y: MORTAR.y + 16, rx: 21, ry: 7 };
const RING_GROW = { x: 36, y: 13 };
const PESTLE = { rest: MOUTH.y - 30, slam: MOUTH.y - 12, height: 18 };
const COLORS = {
  stage: '#fff4e2',
  rim: '#f0d6aa',
  ring: '#d68a44',
  ringMiss: '#beb4aa',
  outline: '#3a133d',
  pestleLight: '#fcfaeb',
  pestleMid: '#ddddd1',
  pestleDark: '#a8a8a3',
};
const BITS = ['#f0e2d2', '#d6c4b4', '#beaaa0'];
const RESULT_PAUSE_MS = 400;
const PLAN_SEED = 4;

/** ปุ่มทดสอบ: ตัดสินทุกครั้งตามค่านี้ตอนวงแตะขอบ (เทสต์ใน ?test ตั้งผ่าน window.__mortarAuto) */
export const mortarTestHooks: { auto: PoundJudge | null } = { auto: null };

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const jobName = (job: MortarJob): string => (job.kind === 'dish' ? t(`dish.${job.id}.name` as TextKey) : itemName(rules.items[job.id]!.out));

function jobIcon(job: MortarJob, className: string, unit = '--px2'): HTMLElement {
  const art = job.kind === 'dish' ? recipes[job.id]?.icon : bagArtId(rules.items[job.id]!.out);
  if (art && registry[art]?.type === 'local') return sizedArt(art, className, job.kind === 'dish' ? '--px2' : unit);
  return element('i', `${className} wb-row__art--none`);
}

/** วงรีพิกเซล 1 จุดต่อองศา 2 องศา หนา th พิกเซล (ตามภาพตัวอย่าง) */
function ellipse(context: CanvasRenderingContext2D, rx: number, ry: number, color: string, thickness: number): void {
  context.fillStyle = color;
  for (let angle = 0; angle < 360; angle += 2) {
    const radians = (angle * Math.PI) / 180;
    for (let k = 0; k < thickness; k += 1) {
      const x = Math.round(MOUTH.x + (rx + k) * Math.cos(radians));
      const y = Math.round(MOUTH.y + (ry + k * 0.4) * Math.sin(radians));
      context.fillRect(x, y, 1, 1);
    }
  }
}

/** สากหินกว้าง 6–8 พิกเซล ปลายล่างใหญ่กว่า (ตามภาพตัวอย่าง) */
function pestle(context: CanvasRenderingContext2D, top: number): void {
  const left = MOUTH.x - 5;
  for (let y = 0; y < PESTLE.height; y += 1) {
    const half = y < PESTLE.height - 6 ? 3 : 4;
    for (let x = 5 - half; x < 5 + half; x += 1) {
      const edge = x === 5 - half || x === 5 + half - 1 || y === 0 || y === PESTLE.height - 1;
      context.fillStyle = edge ? COLORS.outline : x === 5 - half + 1 ? COLORS.pestleLight : x < 5 ? COLORS.pestleMid : COLORS.pestleDark;
      context.fillRect(left + x, top + y, 1, 1);
    }
  }
}

export function createMortarWindow(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'mortar-window';
  backdrop.hidden = true;
  const panel = element('div', 'ck mt');
  const head = registry.mortar_stone?.type === 'local' ? sizedArt('mortar_stone', 'mt-head') : element('i', 'mt-head');
  const title = element('h2', 'wb-title mt-title', t('mortar.title'));
  const sub = element('span', 'wb-hint mt-sub', t('mortar.sub'));
  const close = element('button', 'ck-button ck-close wb-close', '×');
  close.id = 'mortar-close';
  close.type = 'button';
  close.setAttribute('aria-label', t('ui.close'));
  const list = element('div', 'wb-list mt-list');
  const game = element('div', 'mt-game');
  game.hidden = true;
  panel.append(head, title, sub, close, list, game);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  const counts = new Map<string, number>();
  const keyOf = (job: MortarJob): string => `${job.kind}:${job.id}`;
  let playing = false;

  const hide = (): void => {
    if (playing) return;
    backdrop.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };

  const row = (job: MortarJob): HTMLElement => {
    const world = gameState.world;
    const most = maxPounds(world, job);
    const count = Math.min(Math.max(1, counts.get(keyOf(job)) ?? 1), Math.max(1, most));
    counts.set(keyOf(job), count);
    const box = element('div', `wb-row mt-row${most > 0 ? '' : ' is-missing'}`);
    box.dataset.pound = job.id;
    const name = element('div', 'wb-row__name');
    name.append(element('b', '', `${jobName(job)} ×${jobGives(job) * count}`), element('small', 'wb-row__have', `${jobMinutes(job)} ${t('mortar.minutes')}`));
    const materials = element('div', 'wb-row__materials');
    for (const [item, need] of Object.entries(jobIngredients(job))) {
      const have = haveFor(world.bag, item, {}, need);
      const chip = element('span', `wb-chip${have < need * count ? ' is-short' : ''}`);
      const mini = `ing_mini_${item.toLowerCase()}`;
      if (registry[mini]?.type === 'local') chip.append(sizedArt(mini, 'wb-chip__art'));
      else chip.append(element('small', 'wb-chip__name', itemName(item)));
      chip.append(element('b', 'wb-chip__count', `${have}/${need * count}`));
      materials.append(chip);
    }
    const stepper = element('div', 'mt-stepper');
    const step = (text: string, delta: number, disabled: boolean): HTMLButtonElement => {
      const button = element('button', 'ck-button mt-step', text);
      button.type = 'button';
      button.disabled = disabled;
      button.addEventListener('click', () => {
        counts.set(keyOf(job), Math.min(Math.max(1, count + delta), most));
        render();
      });
      return button;
    };
    stepper.append(step('−', -1, most < 1 || count <= 1), element('b', 'mt-count', String(count)), step('+', 1, most < 1 || count >= most));
    const go = element('button', 'ck-go wb-make', t('mortar.go'));
    go.type = 'button';
    go.disabled = most < 1;
    go.dataset.pound = job.id;
    go.addEventListener('click', () => play(job, count));
    box.append(jobIcon(job, 'wb-row__art'), name, materials, stepper, go);
    return box;
  };

  function render(): void {
    list.replaceChildren(...mortarJobs(gameState.world).map(row));
  }

  /** มินิเกมตำ 6 ครั้ง วงหดเข้าหาปากครก แตะตอนแตะขอบ ช้าไปเร็ว */
  function play(job: MortarJob, count: number): void {
    playing = true;
    panel.classList.add('is-playing');
    list.hidden = true;
    game.hidden = false;
    const canvas = document.createElement('canvas');
    canvas.className = 'mt-canvas';
    canvas.width = STAGE.width;
    canvas.height = STAGE.height;
    const context = canvas.getContext('2d')!;
    context.imageSmoothingEnabled = false;
    const mortarArt = new Image();
    mortarArt.src = artUrl('mortar_empty');
    const titleText = element('b', 'mt-game__title', `${t('mortar.pound')}${jobName(job)} ×${jobGives(job) * count}`);
    const beatsRow = element('div', 'mt-beats');
    const beats = Array.from({ length: rules.pounds }, () => element('i', 'mt-beat'));
    beatsRow.append(...beats);
    const judgeText = element('b', 'mt-judge');
    const thud = element('b', 'mt-thud', t('mortar.thud'));
    thud.hidden = true;
    const hint = element('small', 'mt-hint', t('mortar.hint'));
    game.replaceChildren(canvas, titleText, beatsRow, judgeText, thud, hint);

    let seed = PLAN_SEED;
    const random = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    let bits = Array.from({ length: 18 }, () => ({ x: MOUTH.x + Math.round(random() * 24 - 12), y: MOUTH.y + Math.round(random() * 6 - 2), color: BITS[Math.floor(random() * BITS.length)]! }));
    const judged: PoundJudge[] = [];
    let beat = 0;
    let beatStart = performance.now();
    let pause: { until: number; judge: PoundJudge } | null = null;
    let frame = 0;

    const draw = (now: number): void => {
      context.fillStyle = COLORS.stage;
      context.fillRect(0, 0, STAGE.width, STAGE.height);
      ellipse(context, MOUTH.rx + 2, MOUTH.ry + 1, COLORS.rim, 1);
      const shake = pause && pause.judge !== 'miss' && now - (pause.until - rules.judgeMs) < 110 ? 1 : 0;
      if (mortarArt.complete && mortarArt.naturalWidth > 0) {
        context.drawImage(mortarArt, MORTAR.x + shake, MORTAR.y, mortarArt.naturalWidth * MORTAR.scale, mortarArt.naturalHeight * MORTAR.scale);
      }
      for (const bit of bits) {
        context.fillStyle = bit.color;
        context.fillRect(bit.x, bit.y, 1, 1);
      }
      if (pause) {
        if (pause.judge === 'miss') ellipse(context, MOUTH.rx - 2, MOUTH.ry - 1, COLORS.ringMiss, 2);
        pestle(context, pause.judge === 'miss' ? PESTLE.rest : PESTLE.slam - (now - (pause.until - rules.judgeMs) < 110 ? 0 : 2));
        return;
      }
      if (beat >= rules.pounds) {
        pestle(context, PESTLE.rest);
        return;
      }
      const progress = Math.min(1, (now - beatStart) / ringMs(beat));
      ellipse(context, MOUTH.rx + 2 + Math.round((1 - progress) * RING_GROW.x), MOUTH.ry + 1 + Math.round((1 - progress) * RING_GROW.y), COLORS.ring, 2);
      pestle(context, PESTLE.rest - Math.round(4 * progress));
    };

    const showJudge = (judge: PoundJudge, now: number): void => {
      judged.push(judge);
      beats[judged.length - 1]!.dataset.judge = judge;
      judgeText.textContent = t(`mortar.${judge}` as TextKey);
      judgeText.dataset.judge = judge;
      thud.hidden = judge === 'miss';
      if (judge !== 'miss') {
        bits = bits.map((bit) => ({ ...bit, x: bit.x + Math.round(random() * 2 - 1), y: bit.y + (random() < 0.3 ? 1 : 0) }));
      }
      pause = { until: now + rules.judgeMs, judge };
      beat += 1;
    };

    const tap = (): void => {
      if (pause || beat >= rules.pounds) return;
      const now = performance.now();
      showJudge(judgePound(now - (beatStart + ringMs(beat))), now);
    };

    const finish = (): void => {
      const total = judged.reduce((sum, judge) => sum + poundPoints(judge), 0);
      const stars = poundStars(total);
      const card = element('div', 'mt-result');
      card.dataset.stars = String(stars);
      card.dataset.points = String(total);
      const starRow = element('div', 'mt-result__stars');
      for (let index = 0; index < 3; index += 1) starRow.append(sizedArt(job.kind === 'dish' && index >= stars ? 'ui_book_book_star_off' : 'ui_book_book_star_on', 'mt-result__star', '--dpx'));
      const item = jobOutput(job, stars);
      const art = job.kind === 'dish' ? recipes[job.id]?.icon : bagArtId(item);
      const line = element('div', 'mt-result__line');
      if (art && registry[art]?.type === 'local') line.append(sizedArt(art, 'mt-result__art', job.kind === 'dish' ? '--px2' : '--px'));
      line.append(element('b', '', `${jobName(job)} ×${jobGives(job) * count}`));
      const collect = element('button', 'ck-go mt-collect', t('mortar.collect'));
      collect.id = 'mortar-collect';
      collect.type = 'button';
      collect.addEventListener('click', () => {
        const done = finishPounding(gameState.world, job, count, stars);
        playing = false;
        panel.classList.remove('is-playing');
        if (!done) {
          eventBus.emit('player-says', 'bagFull');
          game.hidden = true;
          list.hidden = false;
          render();
          return;
        }
        gameState.setWorld(done.world);
        game.hidden = true;
        list.hidden = false;
        hide();
        if (job.kind === 'dish') eventBus.emit('decorate-open', { item: done.item, count: done.count });
      });
      // อาหารได้ดาวจากมินิเกม ของ (ลูกชิ้น ผง) ไม่มีดาว ได้จำนวนเท่าเดิม
      if (job.kind === 'item') starRow.classList.add('is-item');
      card.append(starRow, line);
      hint.hidden = true;
      game.append(card, collect);
    };

    const loop = (now: number): void => {
      if (!playing) return;
      if (pause && now >= pause.until) {
        pause = null;
        judgeText.textContent = '';
        thud.hidden = true;
        beatStart = now;
        if (beat >= rules.pounds) {
          draw(now);
          window.setTimeout(finish, RESULT_PAUSE_MS);
          return;
        }
      }
      if (!pause && beat < rules.pounds) {
        const due = beatStart + ringMs(beat);
        if (mortarTestHooks.auto && now >= due) showJudge(mortarTestHooks.auto, now);
        else if (now > due + rules.goodMs) showJudge('miss', now);
      }
      draw(now);
      frame = requestAnimationFrame(loop);
    };

    game.onpointerdown = (event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      tap();
    };
    keyTap = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter' || event.key.toLowerCase() === 'e') {
        event.preventDefault();
        tap();
      }
    };
    cancelFrame = () => cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
  }

  let keyTap: ((event: KeyboardEvent) => void) | null = null;
  let cancelFrame: (() => void) | null = null;

  close.addEventListener('click', hide);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (backdrop.hidden) return;
    if (playing) {
      keyTap?.(event);
      return;
    }
    if (event.key === 'Escape') hide();
  });
  eventBus.on('mortar-open', () => {
    cancelFrame?.();
    playing = false;
    panel.classList.remove('is-playing');
    game.hidden = true;
    list.hidden = false;
    render();
    backdrop.hidden = false;
    revealWhenReady(backdrop);
    gameState.setWindowOpen(WINDOW, true);
  });
}
