import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrash2 } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmComboboxImports } from '@spartan-ng/helm/combobox';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { SelectionTableItem } from './selection-table.model';

@Component({
  selector: 'app-selection-table',
  imports: [HlmButtonImports, HlmComboboxImports, HlmInputImports, HlmTableImports, NgIcon],
  providers: [provideIcons({ lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './selection-table.component.html',
})
export class SelectionTableComponent {
  readonly items = input<SelectionTableItem[]>([]);
  readonly selectedIds = input<string[]>([]);
  readonly title = input('Selected items');
  readonly placeholder = input('Search items...');
  readonly removeLabel = input('Remove');
  readonly showQuantity = input(false);
  readonly quantities = input<Record<string, number>>({});
  readonly quantityLabel = input('Required');
  readonly selected = output<SelectionTableItem>();
  readonly activated = output<SelectionTableItem>();
  readonly removed = output<SelectionTableItem>();
  readonly quantityChanged = output<{ item: SelectionTableItem; quantity: number }>();

  protected readonly availableItems = computed(() => this.items());
  protected readonly selectedItems = computed(() =>
    this.selectedIds()
      .map((id) => this.items().find((item) => item.id === id))
      .filter((item): item is SelectionTableItem => item !== undefined),
  );

  protected itemToString(item: SelectionTableItem): string {
    return item.label;
  }

  protected selectItems(items: SelectionTableItem[] | null | undefined): void {
    const nextItems = items ?? [];
    const currentItems = this.selectedItems();

    for (const item of nextItems) {
      if (!currentItems.some((currentItem) => currentItem.id === item.id)) {
        this.selected.emit(item);
      }
    }

    for (const item of currentItems) {
      if (!nextItems.some((nextItem) => nextItem.id === item.id)) {
        this.removed.emit(item);
      }
    }
  }

  protected activateItem(item: SelectionTableItem): void {
    this.activated.emit(item);
  }

  protected removeItem(event: Event, item: SelectionTableItem): void {
    event.stopPropagation();
    this.removed.emit(item);
  }

  protected updateQuantity(event: Event, item: SelectionTableItem): void {
    const quantity = Number((event.target as HTMLInputElement).value);
    this.quantityChanged.emit({ item, quantity: Math.max(1, quantity || 1) });
  }

  protected quantityFor(item: SelectionTableItem): number {
    return this.quantities()[item.id] ?? 1;
  }
}
