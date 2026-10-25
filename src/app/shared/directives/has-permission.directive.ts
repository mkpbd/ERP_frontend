import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { Authorization } from '../../core/authorization/authorization.service';
import type { Permission } from '../../core/authorization/permissions';

/**
 * Renders its content only when the user holds the permission(s):
 * `<button *appHasPermission="'users:create'">` or `*appHasPermission="['roles:update', 'permissions:assign']"`
 * (all required). Hiding a control is a UX nicety; the backend still authorizes the action.
 */
@Directive({ selector: '[appHasPermission]' })
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authorization = inject(Authorization);

  readonly appHasPermission = input.required<Permission | readonly Permission[]>();

  constructor() {
    effect(() => {
      const required = this.appHasPermission();
      const allowed = this.authorization.canAll(typeof required === 'string' ? [required] : required);
      if (allowed && this.viewContainer.length === 0) this.viewContainer.createEmbeddedView(this.templateRef);
      else if (!allowed && this.viewContainer.length > 0) this.viewContainer.clear();
    });
  }
}
