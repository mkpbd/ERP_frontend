import { Component, computed, effect, forwardRef, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export interface PickerOption {
  readonly id: string;
  readonly label: string;
  /** A second line under the label, e.g. a code or a ward. */
  readonly hint?: string | null;
}

const MAX_SHOWN = 50;

/**
 * A searchable select for long lists (doctors, services, patients): type to narrow, pick one; the form value
 * is the option's id. With `(lookup)` bound the caller loads options for the typed text (server-side search);
 * otherwise the given options are filtered here.
 */
@Component({
  selector: 'app-option-picker',
  imports: [MatAutocompleteModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OptionPicker), multi: true }],
  template: `
    <mat-form-field class="w-full">
      <mat-label>{{ label() }}</mat-label>
      <input
        matInput
        [matAutocomplete]="auto"
        [value]="text()"
        (input)="type($any($event.target).value)"
        (blur)="restore()"
        [disabled]="disabled()"
        [required]="required()"
        [placeholder]="placeholder()"
        [attr.data-testid]="testId()"
      />
      @if (selected() && !disabled() && !required()) {
        <button
          matIconSuffix
          matIconButton
          type="button"
          [attr.aria-label]="'Clear ' + label()"
          (click)="clear()"
        >
          <mat-icon>close</mat-icon>
        </button>
      }
      @if (hint()) {
        <mat-hint>{{ hint() }}</mat-hint>
      }
      <mat-autocomplete #auto="matAutocomplete" (optionSelected)="pick($event)" [displayWith]="display">
        @for (option of shown(); track option.id) {
          <mat-option [value]="option">
            <span>{{ option.label }}</span>
            @if (option.hint) {
              <span class="block text-xs text-on-surface-variant">{{ option.hint }}</span>
            }
          </mat-option>
        } @empty {
          <mat-option disabled>{{ text() ? 'No match' : 'Type to search' }}</mat-option>
        }
      </mat-autocomplete>
    </mat-form-field>
  `,
})
export class OptionPicker implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly options = input<readonly PickerOption[]>([]);
  readonly required = input(false);
  readonly placeholder = input('');
  readonly hint = input<string>();
  readonly testId = input<string>();
  /** Server-side search: emitted with the typed text; the caller then updates `options`. */
  readonly lookup = output<string>();

  protected readonly text = signal('');
  protected readonly disabled = signal(false);
  private readonly value = signal<string | null>(null);
  /** The picked option, kept so its label shows even when a later search no longer lists it. */
  private readonly picked = signal<PickerOption | null>(null);

  protected readonly selected = computed(
    () => this.options().find((option) => option.id === this.value()) ?? this.picked(),
  );
  protected readonly shown = computed(() => {
    const term = this.text().trim().toLowerCase();
    const options = this.options();
    if (!term || this.selected()?.label === this.text()) return options.slice(0, MAX_SHOWN);
    return options
      .filter((option) => `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(term))
      .slice(0, MAX_SHOWN);
  });

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // A value written before its options arrived shows its label once they do.
    effect(() => {
      const option = this.options().find((candidate) => candidate.id === this.value());
      if (option && !this.picked()) {
        this.picked.set(option);
        this.text.set(option.label);
      }
    });
  }

  protected readonly display = (option: PickerOption | string | null): string =>
    typeof option === 'string' ? option : (option?.label ?? '');

  protected type(text: string): void {
    this.text.set(text);
    this.lookup.emit(text.trim());
    if (this.value() !== null) {
      this.value.set(null);
      this.picked.set(null);
      this.onChange(null);
    }
  }

  protected pick(event: MatAutocompleteSelectedEvent): void {
    const option = event.option.value as PickerOption;
    this.picked.set(option);
    this.value.set(option.id);
    this.text.set(option.label);
    this.onChange(option.id);
    this.onTouched();
  }

  protected clear(): void {
    this.picked.set(null);
    this.value.set(null);
    this.text.set('');
    this.onChange(null);
  }

  /** Leaving the field without picking puts back the picked option's label (or nothing). */
  protected restore(): void {
    this.onTouched();
    if (!this.value()) this.text.set('');
    else this.text.set(this.selected()?.label ?? '');
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? null);
    const option = this.options().find((candidate) => candidate.id === value) ?? null;
    this.picked.set(option);
    this.text.set(option?.label ?? '');
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
