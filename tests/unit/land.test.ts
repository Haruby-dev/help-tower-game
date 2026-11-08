import { describe, expect, it } from 'vitest';
import type { World } from '../../src/core/state';
import balance from '../../src/data/balance.json';
import { applyTransaction } from '../../src/systems/economy';
import { newWorld } from '../../src/systems/gauges';
import { giveTreat } from '../../src/systems/gio';
import { basePlotCount, buyLand, landAt, nextLand, plotCell, plotCountFor } from '../../src/systems/land';
import { parseSaveFile, SAVE_VERSION } from '../../src/systems/save';

const rich = (world: World, coins: number): World => applyTransaction(world, 'coins', coins, 'wallet.test_income', 'wallet.category_test');

describe('land plots', () => {
  it('sells the 3 plots in order for 5,000 · 15,000 · 40,000, logged in the wallet', () => {
    expect(balance.land.prices).toEqual([5000, 15000, 40000]);
    let world = rich(newWorld(), 60000);
    expect(buyLand(world, 1)).toEqual({ world: null, reason: 'order' });
    const first = buyLand(world, 0);
    if (!first.world) throw new Error('could not buy');
    world = first.world;
    expect(world.land.owned).toBe(1);
    expect(world.wallet.coins).toBe(55000);
    expect(world.wallet.log[0]).toMatchObject({ amount: -5000, label: 'wallet.land', category: 'wallet.category_land' });
    expect(nextLand(world)).toBe(1);
    world = (buyLand(world, 1) as { world: World }).world;
    world = (buyLand(world, 2) as { world: World }).world;
    expect(world.wallet.coins).toBe(0);
    expect(nextLand(world)).toBeNull();
  });

  it('refuses when there are not enough coins', () => {
    expect(buyLand(rich(newWorld(), 4999), 0)).toEqual({ world: null, reason: 'money' });
  });

  it('turns all of each land inside the fence into empty farm plots: 9, then 12, then 9', () => {
    let world = rich(newWorld(), 60000);
    expect(world.farm.plots).toHaveLength(basePlotCount);
    const sizes: number[] = [];
    for (let land = 0; land < 3; land += 1) {
      const before = world.farm.plots.length;
      world = (buyLand(world, land) as { world: World }).world;
      sizes.push(world.farm.plots.length - before);
      expect(world.farm.plots.length).toBe(plotCountFor(land + 1));
    }
    expect(sizes).toEqual([9, 12, 9]);
    expect(world.farm.plots.slice(basePlotCount).every((plot) => !plot.tilled && !plot.crop)).toBe(true);
  });

  it('puts each new plot on a map cell inside its own fenced land', () => {
    for (let index = basePlotCount; index < plotCountFor(3); index += 1) {
      const cell = plotCell(index)!;
      expect(landAt(cell.col + 0.5, cell.row + 0.5)).not.toBeNull();
    }
    expect(plotCell(0)).toEqual({ col: balance.farm.plotOrigin.col, row: balance.farm.plotOrigin.row });
    expect(plotCell(plotCountFor(3))).toBeNull();
  });
});

describe('Gio album', () => {
  it('remembers each treat flavour Gio has eaten, once', () => {
    let world: World = { ...newWorld(), bag: [{ item: 'treat_tuna', count: 2 }, { item: 'treat_salmon', count: 1 }] };
    world = giveTreat(world, 'treat_tuna').world!;
    world = { ...world, day: 2 };
    world = giveTreat(world, 'treat_tuna').world!;
    world = giveTreat(world, 'treat_salmon').world!;
    expect(world.gio.album).toEqual(['treat_tuna', 'treat_salmon']);
  });
});

describe('save version 11', () => {
  it('adds land, moved objects and the album to an old save', () => {
    const world = newWorld() as unknown as Record<string, unknown>;
    const { land: _land, placed: _placed, ...old } = world;
    const gio = { ...(old.gio as Record<string, unknown>) };
    delete gio.album;
    const parsed = parseSaveFile({ version: 10, savedAt: '2026-11-05T00:00:00.000Z', world: { ...old, gio } });
    expect(SAVE_VERSION).toBe(19);
    expect(parsed?.version).toBe(19);
    expect(parsed?.world.land).toEqual({ owned: 0 });
    expect(parsed?.world.placed).toEqual({});
    expect(parsed?.world.gio.album).toEqual([]);
  });
});
