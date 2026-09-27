import { Position } from '../positions/positions.model';
import { Zone } from '../zones/zones.model';
import { PlanningZoneShift } from './planning.model';
import { buildPlanningRows } from './planning-rows';

describe('buildPlanningRows', () => {
  const position: Position = { id: 'position-1', name: 'Front desk', color: '#000000' };
  const waiter: Position = { id: 'position-2', name: 'Waiter', color: '#111111' };
  const zone: Zone = { id: 'zone-1', name: 'Lobby', color: '#000000' };
  const preset: PlanningZoneShift = { id: 'preset-1', zone: 'zone-1', shift: 'shift-1', active: true, sort_order: 0 };
  const requirement = (id: string, positionId: string, count: number) => ({
    id,
    installation: 'installation-1',
    day_of_week: 0,
    date: null,
    position: positionId,
    zone: 'zone-1',
    shift: 'shift-1',
    required_employees: count,
    minimum_employees: null,
    active: true,
  });

  it('maps StaffRequirement to the zone/shift row minimum', () => {
    const rows = buildPlanningRows([position], [zone], [preset], [requirement('requirement-1', 'position-1', 3)], { zone: 'all', shift: 'all', position: 'all' });

    expect(rows).toHaveLength(1);
    expect(rows[0].minimum).toBe(3);
    expect(rows[0].requirements).toHaveLength(1);
  });

  it('derives the droppable zone/shift destination from requirements without presets', () => {
    const rows = buildPlanningRows([position], [zone], [], [requirement('requirement-1', 'position-1', 3)], { zone: 'all', shift: 'all', position: 'all' });

    expect(rows).toHaveLength(1);
    expect(rows[0].preset.zone).toBe('zone-1');
    expect(rows[0].preset.shift).toBe('shift-1');
    expect(rows[0].requirements[0].date).toBeNull();
    expect(rows[0].requirements[0].dayOfWeek).toBe(0);
  });

  it('groups multiple required positions into a single zone and shift row', () => {
    const rows = buildPlanningRows(
      [position, waiter],
      [zone],
      [preset],
      [requirement('requirement-1', 'position-1', 1), requirement('requirement-2', 'position-2', 2)],
      { zone: 'all', shift: 'all', position: 'all' },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].minimum).toBe(3);
    expect(rows[0].requirements.map((requirement) => requirement.position.id)).toEqual(['position-1', 'position-2']);
  });

  it('keeps filters applied after mapping staff requirements', () => {
    const rows = buildPlanningRows([position], [zone], [preset], [requirement('requirement-1', 'position-1', 1)], { zone: 'other-zone', shift: 'all', position: 'all' });

    expect(rows).toEqual([]);
  });
});
