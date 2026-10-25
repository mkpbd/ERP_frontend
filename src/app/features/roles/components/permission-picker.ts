import { Component, computed, input, model } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import type { PermissionDefinition } from '../../../core/authorization/permission-catalog.api';
import { permissionResource } from '../../../core/authorization/permissions';

interface PermissionGroup {
  readonly resource: string;
  readonly permissions: readonly PermissionDefinition[];
}

/**
 * Checkbox list of the permission catalog, grouped by resource (`users`, `roles`, …), with a tri-state
 * "select all" per group. Two-way bound: `[(selected)]="keys"`.
 */
@Component({
  selector: 'app-permission-picker',
  imports: [MatCheckboxModule],
  template: `
    <div class="grid gap-4 sm:grid-cols-2">
      @for (group of groups(); track group.resource) {
        <fieldset class="rounded-card border border-outline-variant p-3" [disabled]="disabled()">
          <legend class="px-1">
            <mat-checkbox
              [checked]="groupState(group) === 'all'"
              [indeterminate]="groupState(group) === 'some'"
              [disabled]="disabled()"
              (change)="toggleGroup(group, $event.checked)"
            >
              <span class="font-medium capitalize">{{ group.resource }}</span>
            </mat-checkbox>
          </legend>
          <div class="flex flex-col">
            @for (permission of group.permissions; track permission.key) {
              <mat-checkbox
                [checked]="selectedSet().has(permission.key)"
                [disabled]="disabled()"
                (change)="toggle(permission.key, $event.checked)"
              >
                <span class="font-mono text-xs">{{ permission.key }}</span>
                <span class="block text-xs text-on-surface-variant">{{ permission.description }}</span>
              </mat-checkbox>
            }
          </div>
        </fieldset>
      }
    </div>
  `,
})
export class PermissionPicker {
  readonly catalog = input.required<readonly PermissionDefinition[]>();
  readonly selected = model<readonly string[]>([]);
  readonly disabled = input(false);

  protected readonly selectedSet = computed(() => new Set(this.selected()));
  protected readonly groups = computed<PermissionGroup[]>(() => {
    const byResource = new Map<string, PermissionDefinition[]>();
    for (const permission of this.catalog()) {
      const resource = permissionResource(permission.key);
      byResource.set(resource, [...(byResource.get(resource) ?? []), permission]);
    }
    return [...byResource].map(([resource, permissions]) => ({ resource, permissions }));
  });

  protected groupState(group: PermissionGroup): 'all' | 'some' | 'none' {
    const count = group.permissions.filter((permission) => this.selectedSet().has(permission.key)).length;
    return count === 0 ? 'none' : count === group.permissions.length ? 'all' : 'some';
  }

  protected toggle(key: string, checked: boolean): void {
    this.selected.update((keys) => (checked ? [...keys, key] : keys.filter((existing) => existing !== key)));
  }

  protected toggleGroup(group: PermissionGroup, checked: boolean): void {
    const groupKeys = new Set(group.permissions.map((permission) => permission.key));
    this.selected.update((keys) => {
      const others = keys.filter((key) => !groupKeys.has(key));
      return checked ? [...others, ...groupKeys] : others;
    });
  }
}
