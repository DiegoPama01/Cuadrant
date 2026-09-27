import { Position } from '../positions/positions.model';
import { Zone } from '../zones/zones.model';
import { PlanningZoneShift, StaffRequirement } from './planning.model';

export interface PlanningRow {
  id: string;
  preset: PlanningZoneShift;
  requirements: PlanningRowPositionRequirement[];
  minimum: number;
  maximum: number | null;
}

export interface PlanningRowPositionRequirement {
  id: string;
  position: Position;
  minimum: number;
  maximum: number | null;
  dayOfWeek?: number | null;
  date?: string | null;
}

export interface PlanningRowFilters {
  zone: string;
  shift: string;
  position: string;
}

export function buildPlanningRows(
  positions: Position[],
  _zones: Zone[],
  _presets: PlanningZoneShift[],
  requirements: StaffRequirement[],
  filters: PlanningRowFilters,
): PlanningRow[] {
  const positionsById = new Map(positions.map((position) => [position.id, position]));

  const rowsByPreset = new Map<string, PlanningRow>();

  for (const requirement of requirements) {
    if (requirement.active === false) continue;
    const position = positionsById.get(requirement.position);
    if (!position) continue;

    const rowId = `${requirement.zone}:${requirement.shift}`;
    const current = rowsByPreset.get(rowId) ?? {
      id: rowId,
      preset: { id: rowId, zone: requirement.zone, shift: requirement.shift, active: true, sort_order: 0 },
      requirements: [],
      minimum: 0,
      maximum: 0,
    };
    const existingRequirement = current.requirements.find((item) => item.position.id === position.id);
    if (existingRequirement) {
      existingRequirement.minimum = Math.max(existingRequirement.minimum, requirement.required_employees);
    } else {
      current.requirements.push({
        id: requirement.id,
        position,
        minimum: requirement.required_employees,
        maximum: null,
        dayOfWeek: requirement.day_of_week,
        date: requirement.date,
      });
    }
    current.maximum = null;
    rowsByPreset.set(rowId, current);
  }

  return [...rowsByPreset.values()].map((row) => ({
      ...row,
      requirements: row.requirements.sort((first, second) => first.position.name.localeCompare(second.position.name)),
      minimum: row.requirements.reduce((count, requirement) => count + requirement.minimum, 0),
    }))
    .filter(
      (row) =>
        (filters.zone === 'all' || row.preset.zone === filters.zone) &&
        (filters.shift === 'all' || row.preset.shift === filters.shift) &&
        (filters.position === 'all' || row.requirements.some((requirement) => requirement.position.id === filters.position)),
    );
}
