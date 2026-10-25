import { Component, inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  constructor() {
    // Icons come from the Material Symbols font loaded in index.html.
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    // Instantiated here so the stored theme applies before the first page renders.
    inject(ThemeService);
  }
}
