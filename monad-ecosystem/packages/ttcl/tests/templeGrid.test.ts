/**
 * TempleGrid — Enheduanna Grid of the Universe integration tests.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  validateTempleGrid,
  resolveTemple,
  resolveTempleByHymnIndex,
  resolveTempleByWheelSlot,
  gridSign,
  wheelGridSign,
  nodeToEventPayload,
  activeNodes,
  nodeStatusHistogram,
  type TempleGrid,
} from '../src/runtime/index.js';

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../shared/fixtures/layer6/enheduanna-temple-grid.json',
);

function loadGrid(): TempleGrid {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as TempleGrid;
}

describe('TempleGrid (Enheduanna)', () => {
  it('loads 42-node fixture with TTC provenance', () => {
    const grid = loadGrid();
    expect(grid.grid_id).toBe('enheduanna-temple-grid');
    expect(grid.provenance.author).toBe('Enheduanna');
    expect(grid.provenance.ttc_domain).toBe('THEO_TECHNO_COSMO');
    expect(grid.nodes).toHaveLength(42);
    expect(grid.semantics.theology_mode).toBe('polytheism-networked-system');
    expect(grid.semantics.technology_mode).toBe('semantic-protocol');
    expect(grid.semantics.cosmology_mode).toBe('underlying-grid');
    expect(grid.semantics.wheel_binding.bound_wheels).toEqual([
      'Teologia',
      'Kosmologia',
      'Technologia',
    ]);
  });

  it('passes lightweight validation', () => {
    const grid = loadGrid();
    expect(validateTempleGrid(grid)).toEqual([]);
  });

  it('resolves known temples and hymn indices', () => {
    const grid = loadGrid();
    const eanna = resolveTempleByHymnIndex(grid, 16);
    expect(eanna.deity.name).toBe('Inanna');
    expect(eanna.city.name).toBe('Uruk');
    const same = resolveTemple(grid, eanna.temple_id);
    expect(same.hymn_index).toBe(16);
  });

  it('maps wheel slots to temples and builds signs', () => {
    const grid = loadGrid();
    const templeId = resolveTempleByWheelSlot(
      grid.semantics.wheel_binding,
      'Teologia',
      'B',
    );
    expect(templeId).toBeTruthy();
    const sign = wheelGridSign(grid, 'Teologia', 'B', {
      peirceClassId: 0,
      modality: 'SYMBOL',
      mode: 'SYMBOL',
    });
    expect(sign.domain).toBeTruthy();
    expect(sign.modality).toBe('SYMBOL');
    expect(sign.domains).toEqual(['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY']);
    expect(sign.peirce.sign_class_id).toBe(0);

    const direct = gridSign(grid, templeId);
    expect(direct.peirce).toBeTruthy();
  });

  it('emits event payload with grid/temple/deity ids', () => {
    const grid = loadGrid();
    const node = resolveTempleByHymnIndex(grid, 2);
    const payload = nodeToEventPayload(grid, node);
    expect(payload.grid_id).toBe('enheduanna-temple-grid');
    expect(payload.temple_id).toBe(node.temple_id);
    expect(payload.deity_name).toBe('Enlil');
    expect(payload.ttc_domain).toBe('THEO_TECHNO_COSMO');
    expect(payload.theo).toMatchObject({ rank: 'major' });
    expect(grid.schema_version).toBe('1.2.0');
    expect(resolveTempleByHymnIndex(grid, 2).logoc_fingerprint?.profile_id).toBe(
      'logoc.temple-grid.v1',
    );
  });

  it('reports active vs unknown histogram (ETCSL fill: ~40 active)', () => {
    const grid = loadGrid();
    const h = nodeStatusHistogram(grid);
    expect(h.active + h.unknown + h.deprecated).toBe(42);
    expect(h.active).toBeGreaterThanOrEqual(38);
    expect(activeNodes(grid).length).toBe(h.active);
    // Closing signature hymn
    const nisaba = resolveTempleByHymnIndex(grid, 42);
    expect(nisaba.deity.name).toBe('Nisaba');
    expect(nisaba.city.name).toBe('Eresh');
  });

  it('covers ETCSL colophon landmarks', () => {
    const grid = loadGrid();
    expect(resolveTempleByHymnIndex(grid, 1).deity.name).toBe('Enki');
    expect(resolveTempleByHymnIndex(grid, 2).city.name).toBe('Nippur');
    expect(resolveTempleByHymnIndex(grid, 16).name).toBe('E-ana');
    expect(resolveTempleByHymnIndex(grid, 20).deity.name).toBe('Ningirsu');
    expect(resolveTempleByHymnIndex(grid, 38).city.name).toBe('Sippar');
  });
});
