import { Component, ElementRef, ViewChild } from '@angular/core';
import { AudioService, CreateAudioDto, GenerationModelEnum } from '../services/audio/audio.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { WorkspaceStateService } from '../services/workspace/workspace-state.service';
import { MediaItem } from '../common/models/media-item.model';
import { AddVoiceDialogComponent } from '../components/add-voice-dialog/add-voice-dialog.component';
import { MatIconRegistry } from '@angular/material/icon';

// UI Helper type
type UiModelType = 'lyria' | 'chirp' | 'gemini-tts';

interface VoiceOption {
  id: string;
  name: string;
  type: 'preset' | 'custom';
}

@Component({
  selector: 'app-lyria',
  templateUrl: './audio.component.html',
  styleUrls: ['./audio.component.scss'],
})
export class AudioComponent {
  // UI State
  selectedModel: UiModelType = 'lyria';
  isLoading = false;
  audioUrl: SafeResourceUrl | null = null;

  // Lyria Specific Inputs
  prompt = '';
  negativePrompt = '';
  seed: number | undefined;
  sampleCount = 4;

  // TTS & Chirp Specific Inputs
  selectedLanguage = 'en-US';
  selectedVoice = 'Puck'; // Default valid voice

  // --- Audio Player State ---
  @ViewChild('audioPlayer') audioPlayerRef!: ElementRef<HTMLAudioElement>;
  isPlaying = false;
  currentTime = '0:00';
  duration = '0:00';
  progressValue = 0;

  mediaItem: MediaItem | null = null;

  languages = [
    {code: 'ar-XA', name: 'Arabic'},
    {code: 'bg-BG', name: 'Bulgarian (Bulgaria)'},
    {code: 'bn-IN', name: 'Bengali (India)'},
    {code: 'cmn-CN', name: 'Mandarin Chinese'},
    {code: 'cs-CZ', name: 'Czech (Czech Republic)'},
    {code: 'da-DK', name: 'Danish (Denmark)'},
    {code: 'de-DE', name: 'German (Germany)'},
    {code: 'el-GR', name: 'Greek (Greece)'},
    {code: 'en-AU', name: 'English (Australia)'},
    {code: 'en-GB', name: 'English (UK)'},
    {code: 'en-IN', name: 'English (India)'},
    {code: 'en-US', name: 'English (United States)'},
    {code: 'es-ES', name: 'Spanish (Spain)'},
    {code: 'es-US', name: 'Spanish (US)'},
    {code: 'fi-FI', name: 'Finnish (Finland)'},
    {code: 'fr-CA', name: 'French (Canada)'},
    {code: 'fr-FR', name: 'French (France)'},
    {code: 'gu-IN', name: 'Gujarati (India)'},
    {code: 'he-IL', name: 'Hebrew (Israel)'},
    {code: 'hi-IN', name: 'Hindi (India)'},
    {code: 'hu-HU', name: 'Hungarian (Hungary)'},
    {code: 'id-ID', name: 'Indonesian (Indonesia)'},
    {code: 'it-IT', name: 'Italian (Italy)'},
    {code: 'ja-JP', name: 'Japanese (Japan)'},
    {code: 'kn-IN', name: 'Kannada (India)'},
    {code: 'ko-KR', name: 'Korean (South Korea)'},
    {code: 'lt-LT', name: 'Lithuanian (Lithuania)'},
    {code: 'lv-LV', name: 'Latvian (Latvia)'},
    {code: 'ml-IN', name: 'Malayalam (India)'},
    {code: 'mr-IN', name: 'Marathi (India)'},
    {code: 'nb-NO', name: 'Norwegian (Norway)'},
    {code: 'nl-BE', name: 'Dutch (Belgium)'},
    {code: 'nl-NL', name: 'Dutch (Netherlands)'},
    {code: 'pl-PL', name: 'Polish (Poland)'},
    {code: 'pt-BR', name: 'Portuguese (Brazil)'},
    {code: 'ro-RO', name: 'Romanian (Romania)'},
    {code: 'ru-RU', name: 'Russian (Russia)'},
    {code: 'sk-SK', name: 'Slovak (Slovakia)'},
    {code: 'sr-RS', name: 'Serbian (Serbia)'},
    {code: 'sv-SE', name: 'Swedish (Sweden)'},
    {code: 'ta-IN', name: 'Tamil (India)'},
    {code: 'te-IN', name: 'Telugu (India)'},
    {code: 'th-TH', name: 'Thai (Thailand)'},
    {code: 'tr-TR', name: 'Turkish (Turkey)'},
    {code: 'uk-UA', name: 'Ukrainian (Ukraine)'},
    {code: 'vi-VN', name: 'Vietnamese (Vietnam)'},
  ];

  // FULL GEMINI VOICE LIST
  // Note: These names match the "voice_name" parameter in Gemini API
  voices: VoiceOption[] = [
    {id: 'Achernar', name: 'Achernar (Female)', type: 'preset'},
    {id: 'Achird', name: 'Achird (Male)', type: 'preset'},
    {id: 'Algenib', name: 'Algenib (Male)', type: 'preset'},
    {id: 'Algieba', name: 'Algieba (Male)', type: 'preset'},
    {id: 'Alnilam', name: 'Alnilam (Male)', type: 'preset'},
    {id: 'Aoede', name: 'Aoede (Female)', type: 'preset'},
    {id: 'Autonoe', name: 'Autonoe (Female)', type: 'preset'},
    {id: 'Callirrhoe', name: 'Callirrhoe (Female)', type: 'preset'},
    {id: 'Charon', name: 'Charon (Male)', type: 'preset'},
    {id: 'Despina', name: 'Despina (Female)', type: 'preset'},
    {id: 'Enceladus', name: 'Enceladus (Male)', type: 'preset'},
    {id: 'Erinome', name: 'Erinome (Female)', type: 'preset'},
    {id: 'Fenrir', name: 'Fenrir (Male)', type: 'preset'},
    {id: 'Gacrux', name: 'Gacrux (Female)', type: 'preset'},
    {id: 'Iapetus', name: 'Iapetus (Male)', type: 'preset'},
    {id: 'Kore', name: 'Kore (Female)', type: 'preset'},
    {id: 'Laomedeia', name: 'Laomedeia (Female)', type: 'preset'},
    {id: 'Leda', name: 'Leda (Female)', type: 'preset'},
    {id: 'Orus', name: 'Orus (Male)', type: 'preset'},
    {id: 'Puck', name: 'Puck (Male)', type: 'preset'},
    {id: 'Pulcherrima', name: 'Pulcherrima (Female)', type: 'preset'},
    {id: 'Rasalgethi', name: 'Rasalgethi (Male)', type: 'preset'},
    {id: 'Sadachbia', name: 'Sadachbia (Male)', type: 'preset'},
    {id: 'Sadaltager', name: 'Sadaltager (Male)', type: 'preset'},
    {id: 'Schedar', name: 'Schedar (Male)', type: 'preset'},
    {id: 'Sulafat', name: 'Sulafat (Female)', type: 'preset'},
    {id: 'Umbriel', name: 'Umbriel (Male)', type: 'preset'},
    {id: 'Vindemiatrix', name: 'Vindemiatrix (Female)', type: 'preset'},
    {id: 'Zephyr', name: 'Zephyr (Female)', type: 'preset'},
    {id: 'Zubenelgenubi', name: 'Zubenelgenubi (Male)', type: 'preset'},
  ];

  constructor(
    private audioService: AudioService, // Renamed for clarity
    private snackBar: MatSnackBar,
    private workspaceStateService: WorkspaceStateService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer,
    public matIconRegistry: MatIconRegistry,
  ) {
    this.matIconRegistry.addSvgIcon(
      'white-gemini-spark-icon',
      this.setPath(`${this.path}/white-gemini-spark-icon.svg`),
    );
  }

  private path = '../../assets/images';

  private setPath(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  onVoiceSelectionChange(value: string) {
    if (value === 'add-new-voice') {
      this.openAddVoiceDialog();
      this.selectedVoice = '';
    } else {
      this.selectedVoice = value;
    }
  }

  openAddVoiceDialog() {
    const dialogRef = this.dialog.open(AddVoiceDialogComponent, {
      width: '500px',
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const newVoice: VoiceOption = {
          id: `custom-${Date.now()}`, // In real app, this ID comes from backend
          name: result.name,
          type: 'custom',
        };
        this.voices = [newVoice, ...this.voices];
        this.selectedVoice = newVoice.id;
        this.snackBar.open('Voice cloned successfully!', 'Close', {
          duration: 3000,
        });
      }
    });
  }

  generate() {
    this.isLoading = true;
    this.mediaItem = null; // Clear previous result

    const activeWorkspaceId = this.workspaceStateService.getActiveWorkspaceId();
    if (!activeWorkspaceId) {
      this.snackBar.open('Please select a workspace first.', 'Close', {
        duration: 3000,
      });
      return;
    }

    // 1. Determine specific backend model based on UI selection
    let backendModel: GenerationModelEnum;

    if (this.selectedModel === 'lyria') {
      backendModel = GenerationModelEnum.LYRIA_002;
    } else if (this.selectedModel === 'chirp') {
      backendModel = GenerationModelEnum.CHIRP_3;
    } else {
      // Default to Flash TTS for Gemini selection
      backendModel = GenerationModelEnum.GEMINI_2_5_FLASH_TTS;
    }

    // 2. Construct the generic DTO
    const request: CreateAudioDto = {
      model: backendModel,
      prompt: this.prompt,
      workspaceId: activeWorkspaceId,
      // Optional fields (backend ignores them if not relevant to the specific model)
      negativePrompt:
        this.selectedModel === 'lyria' ? this.negativePrompt : undefined,
      seed: this.selectedModel === 'lyria' ? this.seed : undefined,
      sampleCount: this.sampleCount,
      languageCode:
        this.selectedModel !== 'lyria' ? this.selectedLanguage : undefined,
      voiceName:
        this.selectedModel !== 'lyria' ? this.selectedVoice : undefined,
    };

    this.isLoading = true;
    this.audioUrl = null;

    this.audioService
      .generateAudio(request)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response: MediaItem) => {
          this.mediaItem = response;
          // The Lightbox will handle displaying the first item automatically via inputs
        },
        error: (error: any) => {
          this.snackBar.open(
            'Error generating audio. Please try again.',
            'Close',
            {duration: 3000},
          );
          console.error('Generation failed:', error);
        },
      });
  }

  // --- Player Logic ---
  togglePlay() {
    const audio = this.audioPlayerRef.nativeElement;
    if (audio.paused) {
      audio.play();
      this.isPlaying = true;
    } else {
      audio.pause();
      this.isPlaying = false;
    }
  }

  onTimeUpdate() {
    const audio = this.audioPlayerRef.nativeElement;
    if (audio.duration) {
      this.progressValue = (audio.currentTime / audio.duration) * 100;
      this.currentTime = this.formatTime(audio.currentTime);
    }
  }

  seek(value: number) {
    const audio = this.audioPlayerRef.nativeElement;
    if (audio.duration) {
      audio.currentTime = (value / 100) * audio.duration;
    }
  }

  onAudioLoaded() {
    const audio = this.audioPlayerRef.nativeElement;
    this.isPlaying = false;
    this.duration = this.formatTime(audio.duration);
  }

  onAudioEnded() {
    this.isPlaying = false;
    this.progressValue = 0;
    this.currentTime = '0:00';
  }

  private formatTime(seconds: number): string {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}
