/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { VeoRequest } from '../../models/search.model';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
// Note: Adjust imports based on your actual folder structure if needed

@Component({
    standalone: true,
  selector: 'app-prompt-box',
  templateUrl: './prompt-box.component.html',
  styleUrls: ['./prompt-box.component.scss'], // Assuming you might want styles here later
  imports:[CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule]
})
export class PromptBoxComponent {
  @Input() searchRequest!: VeoRequest; // Using any to match flexible context, or use VeoRequest
  @Input() generationModels: any[] = [];
  @Input() isLoading = false;
  @Input() selectedGenerationModel = '';

  @Output() generateClicked = new EventEmitter<void>();
  @Output() rewriteClicked = new EventEmitter<void>();
  @Output() modelSelected = new EventEmitter<any>();

  // --- Logic moved from VideoComponent ---

  promptText = signal<string>('');

  // Menu open/close states
  isModeMenuOpen = signal<boolean>(false);
  isSettingsMenuOpen = signal<boolean>(false);
  isExpandMenuOpen = signal<boolean>(false);
  isSettingsDropdownOpen = signal<'aspect' | 'outputs' | 'model' | null>(null);

  // Selected values
  selectedMode = signal<string>('Text to Video');
  selectedNewAspectRatio = signal<string>('Landscape (16:9)');
  selectedOutputs = signal<number>(2);
  // selectedModel = signal<string>('Veo 3.1 - Fast'); // Redundant, using input selectedGenerationModel
  selectedPreset = signal<string>('');

  // --- Event Handlers ---

  onPromptInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.promptText.set(target.value);
  }

  // --- Menu Toggles ---

  toggleModeMenu() {
    this.isModeMenuOpen.set(!this.isModeMenuOpen());
    this.isSettingsMenuOpen.set(false);
    this.isExpandMenuOpen.set(false);
  }

  toggleSettingsMenu() {
    this.isSettingsMenuOpen.set(!this.isSettingsMenuOpen());
    this.isModeMenuOpen.set(false);
    this.isExpandMenuOpen.set(false);
    this.isSettingsDropdownOpen.set(null); // Close inner dropdowns
  }

  toggleExpandMenu() {
    this.isExpandMenuOpen.set(!this.isExpandMenuOpen());
    this.isModeMenuOpen.set(false);
    this.isSettingsMenuOpen.set(false);
  }

  // --- Select Handlers ---

  selectMode(mode: string) {
    this.selectedMode.set(mode);
    this.isModeMenuOpen.set(false);
    console.log('Selected Mode:', mode);
  }

  selectNewAspectRatio(ratio: string) {
    this.selectedNewAspectRatio.set(ratio);
    this.isSettingsDropdownOpen.set(null);
    console.log('Selected Aspect Ratio:', ratio);
  }

  selectOutputs(count: number) {
    this.selectedOutputs.set(count);
    this.isSettingsDropdownOpen.set(null);
    console.log('Selected Outputs:', count);
  }

  // Triggered from internal dropdown
  selectInternalModel(model: any) {
    this.isSettingsDropdownOpen.set(null);
    this.modelSelected.emit(model);
  }

  selectPreset(preset: string) {
    this.selectedPreset.set(preset);
    this.isExpandMenuOpen.set(false);
    console.log('Selected Preset:', preset);
  }
}