import { Component } from '@angular/core';
import { APP_NAME } from '../../core/services/app-title.strategy';

@Component({
  selector: 'app-footer',
  template: `
    <footer
      class="border-t border-outline-variant px-4 py-3 text-center text-xs text-on-surface-variant md:px-6"
    >
      © {{ year }} {{ appName }}
    </footer>
  `,
})
export class Footer {
  protected readonly appName = APP_NAME;
  protected readonly year = new Date().getFullYear();
}
