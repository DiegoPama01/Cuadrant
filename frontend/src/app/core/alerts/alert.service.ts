import { Injectable } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';

export interface AlertOptions {
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  success(message: string, options?: AlertOptions): void {
    toast.success(message, options);
  }

  error(message: string, options?: AlertOptions): void {
    toast.error(message, options);
  }

  warning(message: string, options?: AlertOptions): void {
    toast.warning(message, options);
  }

  info(message: string, options?: AlertOptions): void {
    toast.info(message, options);
  }
}
