import { createRng } from '../core/rng';
import { defaultCosmetics, emptyPlot, emptyWallet, type BagStack, type Farm, type Fishing, type GaugeValues, type RecipeBook, type Weather, type World } from '../core/state';
import balance from '../data/balance.json';
import recipesJson from '../data/recipes.json';
import setsJson from '../data/sets.json';
import { newGioCare } from './gio';
import { newMonsters } from './monsters';
import { newTray } from './tray';
import { newCrafting } from './crafting';

const { gauges, time, farm, cooking, fishing, weather } = balance;
const SEED_RANGE = 2 ** 31;

const MINUTES_PER_HOUR = 60;

const clamp = (value: number): number => Math.min(gauges.max, Math.max(gauges.min, value));

export function clampGauges(values: GaugeValues): GaugeValues {
  return {
    fullness: clamp(values.fullness),
    happiness: clamp(values.happiness),
    cleanliness: clamp(values.cleanliness),
    homesickness: clamp(values.homesickness),
  };
}

export const newFarm = (): Farm => ({
  plots: Array.from({ length: farm.cols * farm.rows }, emptyPlot),
});

export const starterBag = (): BagStack[] => Object.entries(farm.starterBag).map(([item, count]) => ({ item, count }));

export const cookingStarterBag = (): BagStack[] => Object.entries(cooking.starterBag).map(([item, count]) => ({ item, count }));

export const fishingStarterBag = (): BagStack[] => Object.entries(fishing.starterBag).map(([item, count]) => ({ item, count }));

export const newFishing = (): Fishing => ({ rods: [fishing.startRod], caught: {} });

export const newSeed = (): number => Math.floor(createRng(Date.now()).next() * SEED_RANGE);

export const firstWeather = weather.firstDay as Weather;

export const newRecipeBook = (): RecipeBook => ({
  known: Object.entries(recipesJson)
    .filter(([, recipe]) => recipe.source === 'start')
    .map(([id]) => id),
  bestStars: {},
});

export function newWorld(): World {
  return {
    day: 1,
    hour: time.dayStartHour,
    gauges: { ...gauges.start },
    player: null,
    wallet: emptyWallet(),
    farm: newFarm(),
    bag: [...starterBag(), ...cookingStarterBag(), ...fishingStarterBag()],
    cooking: { slot: null },
    recipes: newRecipeBook(),
    cosmetics: defaultCosmetics(),
    seed: newSeed(),
    weather: firstWeather,
    fishing: newFishing(),
    chests: { sinceCosmetic: 0 },
    toys: [],
    stash: {},
    gio: newGioCare(),
    land: { owned: 0 },
    crafting: newCrafting(),
    sets: { reputation: 0, combos: [], bigTable: { owned: false, sets: setsJson.bigTable.slots.map(() => null) } },
    placed: {},
    tray: newTray(),
    monsters: newMonsters(),
  };
}

/** งานสวน 1 ช่องกินเวลาตาม GDD สุขลดตอนทำงาน และเลอะกว่าเวลาปกติ */
export const spendGardenTime = (world: World): World => spendMinutes(world, farm.actionMinutes);

/** งานที่ใช้เวลาในเกม (ทำสวน ตำครก) เวลาเดินไปตามนาที เกจลดตามอัตราตอนทำงาน */
export function spendMinutes(world: World, minutes: number): World {
  const hours = minutes / MINUTES_PER_HOUR;
  const { gauges: values } = world;
  return {
    ...world,
    hour: world.hour + hours,
    gauges: clampGauges({
      ...values,
      fullness: values.fullness - gauges.fullness.awakePerHour * hours,
      happiness: values.happiness - farm.gauges.happinessPerHour * hours,
      cleanliness: values.cleanliness - farm.gauges.cleanlinessPerHour * hours,
    }),
  };
}

/** เกจลดตามเวลาตอนตื่น สุขลดเฉพาะตอนทำงาน */
export function decayAwake(values: GaugeValues, hours: number): GaugeValues {
  return clampGauges({
    ...values,
    fullness: values.fullness - gauges.fullness.awakePerHour * hours,
    cleanliness: values.cleanliness - gauges.cleanliness.idlePerHour * hours,
  });
}

/** นอนจนถึงเช้า หลับคาที่ไม่ได้โบนัสสุขจากการนอน แล้วตื่นมาเสียสุขตามความคิดถึงบ้าน */
export function sleepUntilMorning(values: GaugeValues, hoursAsleep: number, restful: boolean): GaugeValues {
  const homesickness = clamp(values.homesickness + gauges.homesickness.perDay);
  return clampGauges({
    fullness: values.fullness - gauges.fullness.asleepPerHour * hoursAsleep,
    cleanliness: values.cleanliness - gauges.cleanliness.idlePerHour * hoursAsleep,
    happiness:
      values.happiness + (restful ? gauges.happiness.sleepGain : 0) - homesickness / gauges.happiness.homesickDivisor,
    homesickness,
  });
}

export function shouldFaint(values: GaugeValues): boolean {
  return values.fullness <= gauges.min || values.happiness <= gauges.min;
}

/** เกจที่ถึงศูนย์ฟื้นกลับมาเป็นค่าที่ตกลงไว้ ส่วนเกจอื่นคงเดิม */
export function recoverFromFaint(values: GaugeValues): GaugeValues {
  return {
    ...values,
    fullness: values.fullness <= gauges.min ? gauges.faint.recoverTo : values.fullness,
    happiness: values.happiness <= gauges.min ? gauges.faint.recoverTo : values.happiness,
  };
}
