import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import type { Point } from '../core/state';
import balance from '../data/balance.json';
import { artUrl, bubbleImage, drawSpeechBubble, type NineSlice } from './pixelArt';

/** ตัวหนังสือกว้างเท่านี้บวกขอบ และสูงเท่าฟองคำพูดของตัวเอก */
const BUBBLE_PADDING = 10;
const BUBBLE_BODY_HEIGHT = 13;
const FALLBACK_SLICE: NineSlice = { left: 5, right: 5, top: 5, bottom: 5 };

interface Speech {
  speaker: string;
  text: string;
  anchor: () => Point | null;
  /** ค้างฟองไว้จนกว่าจะตอบ false (ทายแฝด: ฟองสองตัวค้างจนผู้เล่นแตะ) ไม่ใส่ก็หายตามเวลาปกติ */
  hold?: () => boolean;
}

interface Shown {
  speech: Speech;
  element: HTMLElement;
  hideAt: number;
}

/** ฟองคำพูดในฉาก (มอนสเตอร์ สัตว์เลี้ยง จีโอ) ตามหัวคนพูด พร้อมกันไม่เกิน 3 ฟอง ที่เหลือผลัดกันขึ้น · คนเดิมพูดใหม่แทนฟองเดิม */
function createSpeechBubbles(uiRoot: HTMLElement): void {
  const layer = document.createElement('div');
  layer.id = 'world-bubbles';
  uiRoot.append(layer);
  const entry = registry.ui_speech_bubble;
  const slice = entry?.type === 'local' && entry.nine_slice ? entry.nine_slice : FALLBACK_SLICE;
  const image = bubbleImage('ui_speech_bubble');
  const shown: Shown[] = [];
  const waiting: Speech[] = [];
  let running = false;

  const render = (item: Shown): void => {
    const canvas = item.element.querySelector('canvas')!;
    const text = item.element.querySelector('p')!;
    text.textContent = item.speech.text;
    void image.then((loaded) => {
      const pixel = Number.parseFloat(getComputedStyle(item.element).getPropertyValue('--px')) || 1;
      drawSpeechBubble(canvas, loaded, slice, Math.ceil(text.offsetWidth / pixel) + BUBBLE_PADDING, BUBBLE_BODY_HEIGHT);
    });
  };

  const open = (speech: Speech): void => {
    const element = document.createElement('div');
    element.className = 'world-bubble';
    element.dataset.speaker = speech.speaker;
    element.append(document.createElement('canvas'), document.createElement('p'));
    layer.append(element);
    const item = { speech, element, hideAt: performance.now() + balance.monsters.bubbleMs };
    shown.push(item);
    render(item);
  };

  const follow = (): void => {
    const now = performance.now();
    for (const item of [...shown]) {
      const at = item.speech.anchor();
      const expired = item.speech.hold ? !item.speech.hold() : now > item.hideAt;
      if (!at || expired) {
        item.element.remove();
        shown.splice(shown.indexOf(item), 1);
        continue;
      }
      item.element.style.left = `${at.x}px`;
      item.element.style.top = `${at.y}px`;
    }
    while (waiting.length > 0 && shown.length < balance.monsters.maxBubbles) open(waiting.shift()!);
    running = shown.length > 0 || waiting.length > 0;
    if (running) requestAnimationFrame(follow);
  };

  eventBus.on('speech', (speech) => {
    const same = shown.find((item) => item.speech.speaker === speech.speaker);
    if (same) {
      same.speech = speech;
      same.hideAt = performance.now() + balance.monsters.bubbleMs;
      render(same);
    } else {
      const queued = waiting.findIndex((item) => item.speaker === speech.speaker);
      if (queued >= 0) waiting.splice(queued, 1);
      waiting.push(speech);
    }
    if (!running) {
      running = true;
      requestAnimationFrame(follow);
    }
  });
}

/** ป้ายชื่อมอนสเตอร์กับหัวใจความชอบ เหนือหัว ตอนตัวเอกยืนใกล้ */
function createMonsterTags(uiRoot: HTMLElement): void {
  const layer = document.createElement('div');
  layer.id = 'monster-tags';
  uiRoot.append(layer);
  const tags = new Map<string, { element: HTMLElement; anchor: () => Point | null }>();
  let running = false;

  const follow = (): void => {
    for (const [id, tag] of tags) {
      const at = tag.anchor();
      if (!at) {
        tag.element.remove();
        tags.delete(id);
        continue;
      }
      tag.element.style.left = `${at.x}px`;
      tag.element.style.top = `${at.y}px`;
    }
    running = tags.size > 0;
    if (running) requestAnimationFrame(follow);
  };

  eventBus.on('monster-tag', (event) => {
    const current = tags.get(event.id);
    if (event.hidden) {
      current?.element.remove();
      tags.delete(event.id);
      return;
    }
    const element = current?.element ?? document.createElement('div');
    if (!current) {
      element.className = 'monster-tag';
      element.dataset.monster = event.id;
      const heart = document.createElement('img');
      heart.className = 'pixel-img monster-tag__heart';
      heart.alt = '';
      heart.src = artUrl('fx_heart_5');
      element.append(document.createElement('span'), heart, document.createElement('b'));
      layer.append(element);
    }
    element.querySelector('span')!.textContent = event.name;
    element.querySelector('b')!.textContent = `${event.percent}%`;
    element.dataset.percent = String(event.percent);
    element.setAttribute('aria-label', `${event.name} ${t('monster.affection')} ${event.percent}%`);
    tags.set(event.id, { element, anchor: event.anchor });
    if (!running) {
      running = true;
      requestAnimationFrame(follow);
    }
  });
}

export function createWorldBubbles(uiRoot: HTMLElement): void {
  createSpeechBubbles(uiRoot);
  createMonsterTags(uiRoot);
}
