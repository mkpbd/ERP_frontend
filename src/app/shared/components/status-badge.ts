import { Component, computed, input } from '@angular/core';

export type BadgeTone = 'success' | 'neutral' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, string> = {
  success: 'bg-[light-dark(#d7f5dd,#0f3d1a)] text-[light-dark(#0b5a1d,#a7e8b4)]',
  neutral: 'bg-surface-container-high text-on-surface-variant',
  warning: 'bg-[light-dark(#fff0c2,#3d2f00)] text-[light-dark(#5c4300,#ffe08a)]',
  danger: 'bg-error-container text-on-error-container',
  info: 'bg-primary-container text-on-primary-container',
};

/** Small status pill. The colour is decorative; the text always carries the meaning. */
@Component({
  selector: 'app-status-badge',
  template: `<span
    class="inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium"
    [class]="toneClass()"
    >{{ label() }}</span
  >`,
})
export class StatusBadge {
  readonly label = input.required<string>();
  readonly tone = input<BadgeTone>('neutral');
  protected readonly toneClass = computed(() => TONES[this.tone()]);
}
