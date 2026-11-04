import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type BagStack } from '../core/state';
import balance from '../data/balance.json';
import linesJson from '../data/lines.json';
import { isDish, isRawProduce } from '../systems/cooking';
import { formatMoney } from '../systems/economy';
import { countOf } from '../systems/farm';
import {
  addToGioBag,
  canConsign,
  collectReport,
  consign,
  estimate,
  giveTreat,
  isTreat,
  petGio,
  removeFromGioBag,
  returnsToday,
  tierFor,
  treatsLeftToday,
} from '../systems/gio';
import { itemImage, itemName } from './inventory';
import { artUrl } from './pixelArt';
import { revealWhenReady } from './preload';

const lines = linesJson.gio;
const TALK_WINDOW = 'gio';
const CONSIGN_WINDOW = 'consign';
/** กดค้างนานเท่านี้ใส่ทั้งกอง */
const HOLD_MS = 450;
type ConsignTab = 'all' | 'produce' | 'food';
const CONSIGN_TABS: { id: ConsignTab; label: TextKey }[] = [
  { id: 'all', label: 'consign.tab_all' },
  { id: 'produce', label: 'consign.tab_produce' },
  { id: 'food', label: 'consign.tab_food' },
];

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const button = (className: string, text: string, onClick: () => void): HTMLButtonElement => {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
};

/** แถบหัวใจความสุขจีโอ ความกว้างเป็นจำนวนเต็มพิกเซลเกม */
function heartBar(happiness: number): HTMLElement {
  const bar = element('div', 'gio-heart');
  const fill = element('i', 'gio-heart__fill');
  fill.style.width = `calc(var(--px) * ${Math.round((Math.max(0, Math.min(100, happiness)) / 100) * 60)})`;
  const track = element('span', 'gio-heart__track');
  track.append(fill);
  bar.append(element('b', 'gio-heart__icon', '♥'), track, element('small', 'gio-heart__value', String(Math.round(happiness))));
  return bar;
}

function stackSlot(stack: BagStack | undefined, className: string): HTMLButtonElement {
  const slot = element('button', className);
  slot.type = 'button';
  if (!stack) {
    slot.disabled = true;
    return slot;
  }
  slot.dataset.item = stack.item;
  slot.setAttribute('aria-label', itemName(stack.item));
  slot.append(itemImage(stack.item, false), element('b', '', String(stack.count)));
  return slot;
}

const inConsignTab = (item: string, tab: ConsignTab): boolean => {
  if (tab === 'produce') return isRawProduce(item);
  if (tab === 'food') return isDish(item);
  return true;
};

/** หน้าต่างคุยกับจีโอ (ฝากขาย ให้แมวเลีย ลูบหัว ข่าว) หน้าฝากขายแบบเป้จีโอ และสรุปยอดตอนจีโอกลับ นาฬิกาหยุดระหว่างเปิด */
export function createGioWindows(uiRoot: HTMLElement): void {
  const talk = element('div', 'gio-backdrop');
  talk.id = 'gio-window';
  talk.hidden = true;
  const talkPanel = element('div', 'gio-panel');
  talk.append(talkPanel);

  const consignRoot = element('div', 'gio-backdrop');
  consignRoot.id = 'consign-window';
  consignRoot.hidden = true;
  const consignPanel = element('div', 'consign-panel');
  consignRoot.append(consignPanel);
  uiRoot.append(talk, consignRoot);

  let line = lines.greet;
  let treatPicker = false;
  let picked: BagStack[] = [];
  let tab: ConsignTab = 'all';

  const closeTalk = (): void => {
    talk.hidden = true;
    gameState.setWindowOpen(TALK_WINDOW, false);
  };
  const closeConsign = (): void => {
    consignRoot.hidden = true;
    gameState.setWindowOpen(CONSIGN_WINDOW, false);
  };

  const portrait = (): HTMLElement => {
    const gio = element('img', 'pixel-img gio-panel__face');
    gio.src = artUrl('ui_shop_gio');
    gio.alt = '';
    return gio;
  };

  const renderReport = (): void => {
    const { report } = gameState.world.gio;
    if (!report) return;
    const list = (stacks: BagStack[]): HTMLElement => {
      const row = element('div', 'gio-report__items');
      row.append(...stacks.map((stack) => stackSlot(stack, 'bag-slot gio-report__slot')));
      return row;
    };
    const money = (label: TextKey, amount: number, id: string): HTMLElement => {
      const row = element('p', 'gio-report__row');
      row.id = id;
      row.append(element('span', '', t(label)), element('b', '', formatMoney(amount)));
      return row;
    };
    const body = element('div', 'gio-report');
    body.id = 'gio-report';
    body.append(element('h2', 'gio-panel__title', t('report.title')), element('p', 'gio-panel__line', lines.back), element('b', 'gio-report__label', t('report.sold')), list(report.sold));
    if (report.returned.length > 0) body.append(element('b', 'gio-report__label', t('report.returned')), list(report.returned));
    body.append(
      money('report.gross', report.gross, 'report-gross'),
      money('report.commission', -report.commission, 'report-commission'),
      money('report.coins', report.coins, 'report-coins'),
      button('phone-tool gio-report__ok', t('report.ok'), () => {
        const next = collectReport(gameState.world);
        if (!next) {
          eventBus.emit('player-says', 'bagFull');
          return;
        }
        gameState.setWorld(next);
        line = lines.greet;
        renderTalk();
      }),
    );
    const face = portrait();
    talkPanel.replaceChildren(face, body);
  };

  const renderTreats = (): HTMLElement => {
    const row = element('div', 'gio-treats');
    const stacks = gameState.world.bag.filter((stack) => isTreat(stack.item));
    if (stacks.length === 0) {
      row.append(element('small', 'gio-treats__empty', lines.noTreat));
      return row;
    }
    for (const stack of stacks) {
      const slot = stackSlot(stack, 'bag-slot gio-treat');
      slot.addEventListener('click', () => {
        const result = giveTreat(gameState.world, stack.item);
        if (!result.world) {
          line = result.reason === 'full' ? lines.treatFull : lines.noTreat;
        } else {
          gameState.setWorld(result.world);
          line = lines.treat[result.taste];
        }
        treatPicker = false;
        renderTalk();
      });
      row.append(slot);
    }
    return row;
  };

  function renderTalk(): void {
    if (gameState.world.gio.report) {
      renderReport();
      return;
    }
    const world = gameState.world;
    const info = element('div', 'gio-panel__info');
    info.append(element('h2', 'gio-panel__title', t('gio.name')), heartBar(world.gio.happiness));
    const say = element('p', 'gio-panel__line', line);
    say.id = 'gio-line';
    const menu = element('div', 'gio-menu');
    menu.append(
      button('phone-tool gio-menu__button', t('gio.consign'), () => {
        if (gameState.world.gio.consignment) {
          line = lines.busy;
          renderTalk();
          return;
        }
        closeTalk();
        openConsign();
      }),
      button('phone-tool gio-menu__button', `${t('gio.treat')} (${treatsLeftToday(world)})`, () => {
        treatPicker = !treatPicker;
        renderTalk();
      }),
      button('phone-tool gio-menu__button', t('gio.pet'), () => {
        const next = petGio(gameState.world);
        if (next) gameState.setWorld(next);
        line = next ? lines.pet : lines.petDone;
        renderTalk();
      }),
      button('phone-tool gio-menu__button', t('gio.news'), () => {
        line = lines.news;
        renderTalk();
      }),
      button('phone-tool gio-menu__button gio-menu__close', t('gio.close'), closeTalk),
    );
    menu.querySelectorAll('button').forEach((node, index) => {
      node.dataset.gioAction = ['consign', 'treat', 'pet', 'news', 'close'][index]!;
    });
    info.append(say);
    if (treatPicker) info.append(renderTreats());
    info.append(menu);
    talkPanel.replaceChildren(portrait(), info);
  }

  function renderConsign(): void {
    const world = gameState.world;
    const tier = tierFor(world.gio.happiness);
    const head = element('div', 'consign-head');
    const back = button('phone-tool consign-back', '×', closeConsign);
    back.id = 'consign-close';
    back.setAttribute('aria-label', t('ui.close'));
    const commission = element('b', 'consign-commission', `${t('consign.commission')} ${Math.round(tier.commission * 100)}%`);
    commission.id = 'consign-commission';
    head.append(
      back,
      element('h2', 'consign-title', t('consign.title')),
      element('small', 'consign-return', t(returnsToday(world) ? 'consign.return_today' : 'consign.return')),
      heartBar(world.gio.happiness),
      commission,
    );

    const left = element('div', 'consign-left');
    const tabs = element('div', 'bag-tabs consign-tabs');
    tabs.append(
      ...CONSIGN_TABS.map(({ id, label }) => {
        const node = button(`bag-tab${id === tab ? ' is-active' : ''}`, t(label), () => {
          tab = id;
          renderConsign();
        });
        node.dataset.consignTab = id;
        return node;
      }),
    );
    const grid = element('div', 'consign-grid');
    const sellable = world.bag.filter((stack) => canConsign(stack.item) && inConsignTab(stack.item, tab));
    for (const stack of sellable) {
      const shown = { ...stack, count: stack.count - (picked.find((entry) => entry.item === stack.item)?.count ?? 0) };
      const slot = stackSlot(shown, 'bag-slot consign-slot');
      slot.disabled = shown.count <= 0;
      let held = false;
      let timer = 0;
      slot.addEventListener('pointerdown', () => {
        held = false;
        timer = window.setTimeout(() => {
          held = true;
          picked = addToGioBag(picked, gameState.world.bag, stack.item, countOf(gameState.world.bag, stack.item));
          renderConsign();
        }, HOLD_MS);
      });
      const cancel = (): void => window.clearTimeout(timer);
      slot.addEventListener('pointerup', cancel);
      slot.addEventListener('pointerleave', cancel);
      slot.addEventListener('click', () => {
        if (held) return;
        picked = addToGioBag(picked, gameState.world.bag, stack.item, 1);
        renderConsign();
      });
      grid.append(slot);
    }
    left.append(element('b', 'consign-label', t('consign.our_bag')), tabs, grid, element('small', 'consign-hint', t('consign.hint')));

    const right = element('div', 'consign-right');
    const peek = element('img', 'pixel-img consign-gio');
    peek.src = artUrl('ui_shop_gio');
    peek.alt = '';
    const pack = element('div', 'consign-pack');
    pack.id = 'consign-pack';
    for (let index = 0; index < balance.gioCare.bagSlots; index += 1) {
      const stack = picked[index];
      const slot = stackSlot(stack, 'consign-pack__slot');
      if (stack) {
        slot.addEventListener('click', () => {
          picked = removeFromGioBag(picked, stack.item, 1);
          renderConsign();
        });
      }
      pack.append(slot);
    }
    const used = element('small', 'consign-pack__used', `${picked.length}/${balance.gioCare.bagSlots}`);
    const guess = estimate(picked, world.gio.happiness);
    const total = element('b', 'consign-estimate', `${t('consign.estimate')} ${formatMoney(guess.coins)}`);
    total.id = 'consign-estimate';
    const go = button('phone-tool consign-go', t('consign.go'), () => {
      const next = consign(gameState.world, picked);
      if (!next) return;
      gameState.setWorld(next);
      picked = [];
      closeConsign();
      line = lines.consigned;
      openTalk();
    });
    go.id = 'consign-go';
    go.disabled = picked.length === 0;
    const foot = element('div', 'consign-foot');
    foot.append(total, go);
    right.append(peek, pack, used);
    if (tier.sellShare < 1) right.append(element('small', 'consign-warn', t('consign.half')));
    right.append(foot);

    const body = element('div', 'consign-body');
    body.append(left, right);
    consignPanel.replaceChildren(head, body);
  }

  function openConsign(): void {
    picked = [];
    tab = 'all';
    renderConsign();
    consignRoot.hidden = false;
    revealWhenReady(consignRoot);
    gameState.setWindowOpen(CONSIGN_WINDOW, true);
  }

  function openTalk(): void {
    treatPicker = false;
    renderTalk();
    talk.hidden = false;
    revealWhenReady(talk);
    gameState.setWindowOpen(TALK_WINDOW, true);
  }

  eventBus.on('gio-talk', () => {
    line = lines.greet;
    openTalk();
  });
  talk.addEventListener('click', (event) => {
    if (event.target === talk) closeTalk();
  });
  consignRoot.addEventListener('click', (event) => {
    if (event.target === consignRoot) closeConsign();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!consignRoot.hidden) closeConsign();
    else if (!talk.hidden) closeTalk();
  });
}
