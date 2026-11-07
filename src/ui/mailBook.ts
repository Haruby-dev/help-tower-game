import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState } from '../core/state';
import mailJson from '../data/mail.json';
import type { MailData } from '../data/schema';
import { at, createBook, pageArt } from './book';

const data = mailJson as MailData;
const WINDOW = 'mail-book';
const PIECES = { cloth: 'book_mail_cloth', frame: 'book_mail_frame_9slice', ribbon: 'book_mail_ribbon' };
const OPEN_ZONES = 1;
const CARD_X = 24;
const CARD_STEP = 50;
const CARD_Y = 58;
const PER_ROW = 5;

type LetterState = 'caught' | 'waiting' | 'locked';

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** ระบบตกขวดจดหมายยังไม่มา ยังไม่มีฉบับไหนเก็บได้: โซนที่เปิดแล้วเป็นเงาขวด โซนหลังจากนั้นล็อก */
const stateOf = (letter: MailData['letters'][number]): LetterState => (letter.zone > OPEN_ZONES ? 'locked' : 'waiting');

/** กระดาษตามคนเขียน ฟอนต์ Mali เหมือนกัน เปลี่ยนแค่กระดาษกับหมึก (mail_papers) · ข้อความจดหมายอยู่ใน th.json แก้ได้ */
export function letterPaper(number: number): HTMLElement {
  const letter = data.letters.find((entry) => entry.number === number)!;
  const paper = element('div', `ml-paper ml-paper--${letter.paper}`);
  const text = t(`mail.${number}.text` as TextKey);
  for (const [index, line] of text.split('\n').entries()) {
    const row = element('p', '', line);
    // จดหมายของหอคอยลายมือโย้เย้ บรรทัดขึ้นลงไม่เท่ากัน
    if (letter.paper === 'tower') row.style.transform = `translateY(${(index % 3) - 1}px)`;
    paper.append(row);
  }
  paper.append(element('p', 'ml-sig', t(`mail.${number}.sign` as TextKey)));
  return paper;
}

/** สมุดจดหมาย (สมุดฟ้าทะเลสองหน้า) หน้าซ้ายขวด 20 ใบ หน้าขวาจดหมายที่เปิดอ่าน */
export function createMailBook(uiRoot: HTMLElement): void {
  const shell = createBook(uiRoot, 'mail-book', 'mail', WINDOW, PIECES);
  let picked = 1;

  function render(): void {
    if (!gameState.started) return;
    const caught = 0;
    const cards = data.letters.map((letter, index) => {
      const state = stateOf(letter);
      const card = at(element('button', `ml-cd is-${state}${letter.number === picked ? ' is-on' : ''}`), CARD_X + (index % PER_ROW) * CARD_STEP, CARD_Y + Math.floor(index / PER_ROW) * CARD_STEP);
      card.type = 'button';
      card.dataset.letter = String(letter.number);
      card.dataset.state = state;
      if (state === 'locked') card.append(pageArt('book_mail_padlock', 17, 9));
      else card.append(pageArt(state === 'caught' ? 'mail_bottle' : 'mail_bottle_sil', 14, 4));
      card.append(element('span', `ml-no ${state === 'caught' ? '' : state === 'waiting' ? 'soft' : 'lock'}`, state === 'caught' ? `#${letter.number}` : `${t('album.zone')} ${letter.zone}`));
      card.addEventListener('click', () => {
        picked = letter.number;
        render();
      });
      return card;
    });
    shell.left.replaceChildren(
      element('div', 'ml-tt', t('mail.title')),
      element('div', 'ml-tc', `${t('mail.bottles')} · ${t('mail.caught')} ${caught}/${data.letters.length} ${t('mail.unit')}`),
      ...cards,
    );

    const letter = data.letters.find((entry) => entry.number === picked)!;
    const state = stateOf(letter);
    if (state === 'locked') {
      shell.right.replaceChildren(
        pageArt('book_mail_padlock', 126, 62, 'bk-lockbig', '', 4),
        element('div', 'bk-lockmsg', t('album.zone_locked')),
        element('div', 'bk-locksub', `${t('mail.from_zone')} ${letter.zone}`),
      );
      return;
    }
    // ยังไม่ได้เก็บ: กระดาษว่างกับขวดเงา บอกว่าตกได้จากบ่อในโซนไหน
    const head = at(element('div', 'ml-hd', `${t('mail.letter')} ${letter.number} · ${t('mail.from')} `), 24, 16);
    head.append(element('b', '', '???'));
    const paper = at(element('div', `ml-paper ml-paper--${letter.paper} is-empty`), 24, 38);
    paper.append(pageArt('book_mail_tape', 90, -4, 'ml-tape'), element('p', 'ml-wait', t('mail.not_caught')));
    const footer = at(element('div', 'ml-ft'), 24, 226);
    footer.append(element('span', 'ml-pill', `${t('mail.homesick')} −${data.homesick}`), element('span', '', `${t('mail.from_pond')} · ${t('album.zone')} ${letter.zone}`));
    shell.right.replaceChildren(head, paper, pageArt('mail_bottle_sil', 238, 120, 'ml-bigbt', '', 2), footer);
  }

  eventBus.on('app-open', (app) => {
    if (app !== 'mail') return;
    render();
    shell.show();
  });
}
