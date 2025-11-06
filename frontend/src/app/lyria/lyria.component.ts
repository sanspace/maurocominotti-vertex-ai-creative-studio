import { Component } from '@angular/core';
import { LyriaService, LyriaRequest } from '../services/lyria/lyria.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { WorkspaceStateService } from '../services/workspace/workspace-state.service';
import { MediaItem } from '../common/models/media-item.model';

@Component({
  selector: 'app-lyria',
  templateUrl: './lyria.component.html',
  styleUrls: ['./lyria.component.scss']
})
export class LyriaComponent {
  prompt = '';
  negativePrompt = '';
  seed: number | undefined;
  sampleCount = 1;
  isLoading = false;
  audioUrl: SafeResourceUrl | null = null;

  constructor(
    private lyriaService: LyriaService,
    private snackBar: MatSnackBar,
    private sanitizer: DomSanitizer,
    private workspaceStateService: WorkspaceStateService,
  ) { }

  generateAudio() {
    this.isLoading = true;
    this.audioUrl = null;
    const activeWorkspaceId = this.workspaceStateService.getActiveWorkspaceId();
    if (!activeWorkspaceId) {
      this.snackBar.open('Please select a workspace first.', 'Close', { duration: 3000 });
      this.isLoading = false;
      return;
    }

    const request: LyriaRequest = {
      prompt: this.prompt,
      negative_prompt: this.negativePrompt,
      seed: this.seed,
      sample_count: this.sampleCount,
      workspace_id: activeWorkspaceId,
    };

    this.lyriaService.generateAudio(request).pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (response: MediaItem) => {
        if (response.presignedUrls && response.presignedUrls.length > 0) {
          this.audioUrl = this.sanitizer.bypassSecurityTrustResourceUrl(response.presignedUrls[0]);
        }
      },
      error: (error: any) => {
        this.snackBar.open('Error generating audio. Please try again.', 'Close', { duration: 3000 });
        console.error(error);
      }
    });
  }
}
