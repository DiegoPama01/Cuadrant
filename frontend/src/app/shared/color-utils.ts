const FORM_COLOR_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#db2777',
  '#7c3aed',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
  '#65a30d',
  '#dc2626',
];

export function randomFormColor(): string {
  const index = Math.floor(Math.random() * FORM_COLOR_PALETTE.length);
  return FORM_COLOR_PALETTE[index] ?? FORM_COLOR_PALETTE[0];
}
