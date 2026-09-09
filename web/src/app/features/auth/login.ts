import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError } from '../../core/interceptors/error.interceptor';
import { AuthService } from '../../core/services/auth.service';
import { ThemeToggle } from '../../shared/components/theme/theme-toggle';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styles: `
    /* The wordmark and the bloom are the only two gradients in the app. They
       live here rather than in a utility because nothing else should use
       them — a gradient that appears twice stops being an identity. */
    .mark {
      background-image: linear-gradient(
        140deg,
        color-mix(in oklab, var(--color-accent) 82%, white),
        var(--color-accent)
      );
      box-shadow: 0 10px 30px -8px color-mix(in oklab, var(--color-accent) 65%, transparent);
    }

    .glow {
      background: radial-gradient(
        circle,
        color-mix(in oklab, var(--color-accent) 22%, transparent),
        transparent 68%
      );
      filter: blur(24px);
    }
  `,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Sign-in and sign-up share one screen; a separate route for each is a
      pointless extra tap when the fields are almost identical. */
  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly isRegister = computed(() => this.mode() === 'register');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control(''),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    password: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(8)]),
  });

  protected toggleMode(): void {
    this.mode.update((m) => (m === 'login' ? 'register' : 'login'));
    this.errorMessage.set(null);

    // Name is only required when creating an account, so the validator is
    // attached and removed with the mode rather than always present.
    const name = this.form.controls.name;
    if (this.isRegister()) {
      name.setValidators([Validators.required, Validators.maxLength(120)]);
    } else {
      name.clearValidators();
    }
    name.updateValueAndValidity();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.errorMessage.set(null);

    const request$ = this.isRegister()
      ? this.auth.register(name.trim(), email.trim(), password)
      : this.auth.login(email.trim(), password);

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
        void this.router.navigateByUrl(returnUrl && returnUrl.startsWith('/') ? returnUrl : '/');
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        // Rendered inline against the form rather than as a toast: a wrong
        // password is an answer to what the user just did, not a system event.
        this.errorMessage.set(error?.message ?? 'Something went wrong. Please try again.');
      },
    });
  }

  protected showError(field: 'name' | 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }
}
