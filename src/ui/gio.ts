import { registry } from '../core/assets';
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
  hasUnreadNews,
  isTreat,
  petGio,
  pettedToday,
  readNews,
  soldTotal,
  treatsInBag,
  removeFromGioBag,
  returnsToday,
  tierFor,
} from '../systems/gio';
import { cornerBadge, itemImage, itemName } from './inventory';
import { artUrl } from './pixelArt';
import { revealWhenReady } from './preload';
import { tipText, unreadTips } from '../systems/news';
import { monsterTable } from '../systems/monsters';
import { coinIcon, setMoney } from './money';

const lines = linesJson.gio;
const TALK_WINDOW = 'gio';
const CONSIGN_WINDOW = 'consign';
const RECEIPT_WINDOW = 'receipt';
/** ใบสรุปยอดแสดงได้ราว 3 แถว เกินนี้เลื่อนดูในใบ */
const RECEIPT_ROWS = 3;
/** ขอบล่างใบเสร็จฉีกเป็นฟันเลื่อย ทุกช่วง 8 ลึก 4 พิกเซลเกม */
const TEAR_PERIOD = 8;
const TEAR_DEPTH = 4;
const RECEIPT_WIDTH = 204;
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

const unit = (value: number): string => `calc(var(--px) * ${value})`;

/** ขอบล่างฟันเลื่อยวาดด้วย clip-path จุดทุกจุดเป็นจำนวนเต็มพิกเซลเกม */
function tearBottom(...nodes: HTMLElement[]): void {
  const points = ['0 0', '100% 0'];
  for (let x = RECEIPT_WIDTH; x >= 0; x -= TEAR_PERIOD / 2) {
    const tip = (x / (TEAR_PERIOD / 2)) % 2 === 0;
    points.push(`${unit(x)} ${tip ? '100%' : `calc(100% - ${unit(TEAR_DEPTH)})`}`);
  }
  for (const node of nodes) node.style.clipPath = `polygon(${points.join(', ')})`;
}

/** ไอคอนเล็ก 16 พิกเซลของวัตถุดิบ ถ้ายังไม่มีภาพใช้กล่องสีขนาดเดียวกัน */
function miniIcon(item: string): HTMLElement {
  const id = `ing_mini_${item.toLowerCase()}`;
  const entry = registry[id];
  if (entry?.type !== 'local') {
    const box = element('i', 'receipt__icon receipt__icon--missing');
    box.title = itemName(item);
    return box;
  }
  const image = element('img', 'pixel-img receipt__icon');
  image.src = artUrl(id);
  image.alt = '';
  image.style.width = unit(entry.width);
  image.style.height = unit(entry.height);
  return image;
}

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
  cornerBadge(slot, stack.item);
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
  const talkPanel = element('div', 'gio-talk');
  talk.append(talkPanel);

  const consignRoot = element('div', 'gio-backdrop');
  consignRoot.id = 'consign-window';
  consignRoot.hidden = true;
  const consignPanel = element('div', 'consign-panel');
  consignRoot.append(consignPanel);
  const receiptRoot = element('div', 'receipt-backdrop');
  receiptRoot.id = 'receipt-window';
  receiptRoot.hidden = true;
  const receiptPanel = element('div', 'receipt-scene');
  receiptRoot.append(receiptPanel);
  uiRoot.append(talk, consignRoot, receiptRoot);

  let line = lines.greet;
  let treatPicker = false;
  /** หน้าข่าว: รายการข่าวที่รู้แล้วแทนปุ่ม 4 ปุ่ม */
  let newsView = false;
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

  const art = (id: string, className: string): HTMLImageElement => {
    const image = element('img', `pixel-img ${className}`);
    image.src = artUrl(id);
    image.alt = '';
    return image;
  };

  /** กรอบรูปหน้าเหรียญของ HUD กับหน้าจีโอยิ้ม ตัดด้วยหน้ากากวงใน */
  const talkPortrait = (): HTMLElement => {
    const holder = element('div', 'gio-talk__portrait');
    const bust = element('div', 'gio-talk__bust');
    const mask = `url("${artUrl('ui_portrait_mask')}")`;
    bust.style.setProperty('mask-image', mask);
    bust.style.setProperty('-webkit-mask-image', mask);
    const face = element('i', 'gio-talk__face');
    face.style.backgroundImage = `url("${artUrl('ui_gio_gio_face_happy')}")`;
    bust.append(face);
    holder.append(art('ui_portrait_frame', 'gio-talk__frame'), bust);
    return holder;
  };

  const choice = (action: string, icon: string, label: string, onClick: () => void): HTMLButtonElement => {
    const node = element('button', 'gio-talk__choice');
    node.type = 'button';
    node.dataset.gioAction = action;
    node.append(art(icon, 'gio-talk__icon'), element('span', 'gio-talk__label', label));
    node.addEventListener('click', onClick);
    return node;
  };

  const giveTreatItem = (item: string): void => {
    const result = giveTreat(gameState.world, item);
    if (!result.world) {
      line = result.reason === 'full' ? lines.treatFull : lines.noTreat;
    } else {
      gameState.setWorld(result.world);
      line = lines.treat[result.taste];
      eventBus.emit('gio-treat', result.taste);
    }
    treatPicker = false;
    renderTalk();
  };

  /** มีแมวเลียหลายรสให้เลือกรสก่อน ช่องเครื่องมือขนาดจริงพร้อมจำนวน */
  const treatChoices = (): HTMLElement[] => {
    const stacks = gameState.world.bag.filter((stack) => isTreat(stack.item));
    const slots = stacks.map((stack) => {
      const slot = element('button', 'gio-talk__treat gio-treat');
      slot.type = 'button';
      slot.dataset.item = stack.item;
      slot.setAttribute('aria-label', itemName(stack.item));
      slot.append(itemImage(stack.item, false), element('b', 'gio-talk__treat-count', `×${stack.count}`));
      slot.addEventListener('click', () => giveTreatItem(stack.item));
      return slot;
    });
    const back = element('button', 'gio-talk__treat gio-talk__treat--back', '←');
    back.type = 'button';
    back.setAttribute('aria-label', t('ui.back'));
    back.addEventListener('click', () => {
      treatPicker = false;
      renderTalk();
    });
    return [...slots, back];
  };

  /** ข่าวที่รู้แล้วทั้งหมด ใหม่สุดอยู่บน ข่าวที่เพิ่งได้มีป้าย "ใหม่" (จำไว้ตอนเปิดหน้าข่าว เพราะเปิดแล้วนับว่าอ่าน) */
  let freshTips = new Set<number>();
  const newsList = (): HTMLElement[] => {
    const tips = gameState.world.gio.tips.map((tip, index) => ({ tip, index })).reverse();
    const list = element('div', 'gio-talk__news');
    list.id = 'gio-news';
    if (tips.length === 0) list.append(element('p', 'gio-talk__tip', t('news.empty')));
    for (const { tip, index } of tips) {
      const row = element('p', 'gio-talk__tip');
      row.dataset.tipMonster = tip.monster;
      row.dataset.tipKind = tip.kind;
      if (freshTips.has(index)) row.append(element('b', 'gio-talk__new', t('news.new')));
      row.append(element('span', '', tipText(tip)));
      list.append(row);
    }
    const back = element('button', 'gio-talk__treat gio-talk__treat--back gio-talk__news-back', '←');
    back.type = 'button';
    back.setAttribute('aria-label', t('ui.back'));
    back.addEventListener('click', () => {
      newsView = false;
      line = lines.greet;
      renderTalk();
    });
    return [list, back];
  };

  const openNews = (): void => {
    const world = gameState.world;
    freshTips = new Set(world.gio.tips.flatMap((tip, index) => (tip.read ? [] : [index])));
    const first = world.gio.tips.find((tip) => !tip.read);
    line = first ? tipText(first) : world.gio.tips.length > 0 ? t('news.title') : lines.news;
    gameState.setWorld(readNews(world));
    newsView = true;
    renderTalk();
  };

  function renderTalk(): void {
    if (gameState.world.gio.report) {
      closeTalk();
      openReceipt();
      return;
    }
    const world = gameState.world;
    const say = element('p', 'gio-talk__say');
    const spoken = element('span', 'gio-talk__line', line);
    spoken.id = 'gio-line';
    say.append(element('b', 'gio-talk__name', t('gio.name')), spoken);
    const close = element('button', 'gio-talk__close');
    close.type = 'button';
    close.dataset.gioAction = 'close';
    close.setAttribute('aria-label', t('ui.close'));
    close.append(art('ui_gio_talk_close_btn', 'gio-talk__close-art'));
    close.addEventListener('click', closeTalk);

    const menu = element('div', `gio-talk__menu${treatPicker ? ' gio-talk__menu--treats' : ''}${newsView ? ' gio-talk__menu--news' : ''}`);
    if (treatPicker) {
      menu.append(...treatChoices());
    } else if (newsView) {
      menu.append(...newsList());
    } else {
      const treats = treatsInBag(world);
      const treat = choice('treat', 'ui_gio_talk_icon_treat_12', t('gio.treat'), () => {
        const kinds = gameState.world.bag.filter((stack) => isTreat(stack.item));
        if (kinds.length === 1) giveTreatItem(kinds[0]!.item);
        else {
          treatPicker = true;
          renderTalk();
        }
      });
      treat.append(element('small', 'gio-talk__count', `×${treats}`));
      treat.disabled = treats === 0;
      treat.classList.toggle('is-empty', treats === 0);
      const pet = choice('pet', 'ui_gio_talk_icon_pat_12', t('gio.pet'), () => {
        const next = petGio(gameState.world);
        if (next) gameState.setWorld(next);
        line = next ? lines.pet : lines.petDone;
        renderTalk();
      });
      if (pettedToday(world)) pet.append(art('ui_gio_talk_check_done', 'gio-talk__check'));
      const news = choice('news', 'ui_gio_talk_icon_news_12', t('gio.news'), openNews);
      if (hasUnreadNews(world)) news.append(element('i', 'gio-talk__dot'));
      menu.append(
        choice('consign', 'ui_gio_talk_icon_sell_12', t('gio.consign'), () => {
          if (gameState.world.gio.consignment) {
            line = lines.busy;
            renderTalk();
            return;
          }
          closeTalk();
          openConsign();
        }),
        treat,
        pet,
        news,
      );
    }
    const box = element('div', 'gio-talk__box');
    talkPanel.replaceChildren(
      art('ui_gio_talk_ear_left', 'gio-talk__ear'),
      art('ui_gio_talk_ear_left', 'gio-talk__ear gio-talk__ear--right'),
      box,
      talkPortrait(),
      say,
      menu,
      close,
    );
  }

  /** ใบสรุปยอดของจีโอ รายการเกิน 3 ชนิดเลื่อนดูในใบ ความสูงใบเท่าเดิมเสมอ */
  function renderReceipt(): void {
    const report = gameState.world.gio.report;
    if (!report) return;
    const paper = element('div', 'receipt');
    paper.id = 'gio-report';
    const sub = element('small', 'receipt__sub', `${t('report.back')} · ${t('hud.day')} ${report.day}`);
    const list = element('div', 'receipt__list');
    const rows = report.sold.map((stack) => {
      const row = element('div', 'receipt__row');
      const price = element('b', 'receipt__price');
      setMoney(price, soldTotal(report, stack));
      row.append(miniIcon(stack.item), element('span', 'receipt__name', itemName(stack.item)), element('small', 'receipt__count', `×${stack.count}`), price);
      return row;
    });
    list.append(...rows);
    const windowBox = element('div', 'receipt__window');
    windowBox.append(list);
    const scrolls = rows.length > RECEIPT_ROWS;
    windowBox.classList.toggle('is-scrolling', scrolls);
    if (scrolls) {
      const hint = element('small', 'receipt__more');
      const bar = element('i', 'receipt__bar');
      const thumb = element('b', 'receipt__thumb');
      bar.append(thumb);
      const update = (): void => {
        const rowHeight = list.scrollHeight / rows.length || 1;
        const seen = Math.min(rows.length, Math.floor((list.scrollTop + list.clientHeight) / rowHeight + 0.4));
        const left = rows.length - seen;
        hint.textContent = t('report.more').replace('{n}', String(left));
        hint.hidden = left <= 0;
        windowBox.classList.toggle('is-end', left <= 0);
        const share = list.clientHeight / list.scrollHeight;
        thumb.style.height = `${share * 100}%`;
        thumb.style.top = `${(list.scrollTop / list.scrollHeight) * 100}%`;
      };
      list.addEventListener('scroll', update);
      requestAnimationFrame(update);
      windowBox.append(hint, bar);
      hint.textContent = t('report.more').replace('{n}', String(rows.length - RECEIPT_ROWS));
    }

    const sum = (label: string, amount: number, className: string, id: string, sign = ''): HTMLElement => {
      const row = element('p', `receipt__sum ${className}`);
      row.id = id;
      const value = element('b', '');
      setMoney(value, amount, sign);
      row.append(element('span', '', label), value);
      return row;
    };
    const tier = Math.round((report.gross > 0 ? report.commission / report.gross : 0) * 100);
    const net = element('div', 'receipt__net');
    net.id = 'report-coins';
    const netValue = element('b', 'receipt__net-value', formatMoney(report.coins));
    const coins = element('span', 'receipt__coins');
    coins.append(coinIcon('receipt__coin-back'), coinIcon('receipt__coin-front'));
    net.append(element('span', 'receipt__net-label', t('report.coins')), art('ui_gio_receipt_paw_stamp', 'receipt__stamp'), netValue, coins);

    const extras: HTMLElement[] = [];
    if (report.gift) {
      const gift = element('div', 'receipt__gift');
      gift.append(miniIcon(report.gift.item), element('span', '', `${t('report.gift')} ${itemName(report.gift.item)} ×${report.gift.count}`), element('i', 'receipt__spark'), element('i', 'receipt__spark receipt__spark--low'));
      extras.push(gift);
    }
    for (const stack of report.returned) {
      const note = element('p', 'receipt__note');
      note.append(miniIcon(stack.item), element('span', '', `${t('report.returned')} ${itemName(stack.item)} ×${stack.count}`));
      extras.push(note);
    }
    // แขกพรุ่งนี้ (ตามที่วางแผนไว้จริง ตัวที่ยังไม่มีภาพไม่นับ) และข่าวใหม่พร้อมจุดชมพูแบบปุ่มข่าว
    const world = gameState.world;
    const visitors = world.monsters.arrivals.filter((arrival) => arrival.day === report.day + 1 && monsterTable[arrival.monster]).length;
    if (visitors > 0) {
      const note = element('p', 'receipt__note');
      note.id = 'report-visitors';
      note.append(element('span', '', `${t('report.visitors_a')}${visitors}${t('report.visitors_b')}`));
      extras.push(note);
    }
    const fresh = unreadTips(world);
    if (fresh > 0) {
      const note = element('p', 'receipt__note');
      note.id = 'report-news';
      note.append(element('span', '', `${t('report.news_a')}${fresh}${t('report.news_b')}`), element('i', 'gio-talk__dot receipt__dot'));
      extras.push(note);
    }

    const take = element('button', 'receipt__take gio-report__ok', t('report.ok'));
    take.type = 'button';
    take.addEventListener('click', () => {
      const next = collectReport(gameState.world);
      if (!next) {
        eventBus.emit('player-says', 'bagFull');
        closeReceipt();
        return;
      }
      gameState.setWorld(next);
      closeReceipt();
    });

    paper.append(
      element('h2', 'receipt__title', t('report.title')),
      sub,
      element('hr', 'receipt__dash'),
      windowBox,
      element('hr', 'receipt__dash'),
      sum(t('report.gross'), report.gross, '', 'report-gross'),
      sum(`${t('report.commission')} ${tier}%`, report.commission, 'receipt__sum--pink', 'report-commission', '−'),
      element('hr', 'receipt__double'),
      net,
      element('hr', 'receipt__dash'),
      ...extras,
      take,
    );
    const shadow = element('i', 'receipt__shadow');
    const edge = element('i', 'receipt__edge');
    const sheet = element('div', 'receipt__sheet');
    sheet.append(shadow, edge, paper, art('ui_gio_receipt_washi_tape', 'receipt__tape'));
    const gio = element('div', 'receipt-gio');
    const bigDay = report.coins >= balance.gioCare.bigDayCoins;
    gio.append(element('p', 'receipt-gio__bubble', bigDay ? lines.backBig : lines.back), art('ui_shop_gio', 'receipt-gio__art'));
    receiptPanel.replaceChildren(gio, sheet);
    tearBottom(paper, shadow, edge);
  }

  function openReceipt(): void {
    renderReceipt();
    receiptRoot.hidden = false;
    uiRoot.dataset.receipt = 'open';
    revealWhenReady(receiptRoot);
    gameState.setWindowOpen(RECEIPT_WINDOW, true);
  }

  function closeReceipt(): void {
    receiptRoot.hidden = true;
    delete uiRoot.dataset.receipt;
    gameState.setWindowOpen(RECEIPT_WINDOW, false);
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
    const total = element('b', 'consign-estimate');
    setMoney(total, guess.coins, `${t('consign.estimate')} `);
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
    newsView = false;
    if (gameState.world.gio.report) {
      openReceipt();
      return;
    }
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
  receiptRoot.addEventListener('click', (event) => {
    if (event.target === receiptRoot) closeReceipt();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!receiptRoot.hidden) closeReceipt();
    else if (!consignRoot.hidden) closeConsign();
    else if (!talk.hidden) closeTalk();
  });
}
