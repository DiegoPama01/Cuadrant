import { Component, signal } from '@angular/core';
import { HlmToasterImports } from '@spartan-ng/helm/sonner';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HlmToasterImports],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('CuadranT');
}
