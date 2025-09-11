import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewChild,
} from '@angular/core';
import {FormBuilder, Validators, FormGroup} from '@angular/forms';
import {MediaItem} from '../common/models/media-item.model';
import {HttpClient} from '@angular/common/http';
import {VtoInputLink, VtoRequest, VtoSourceMediaItemLink} from './vto.model';
import {environment} from '../../environments/environment';
import {MatDialog} from '@angular/material/dialog';
import {
  ImageSelectorComponent,
  MediaItemSelection,
} from '../common/components/image-selector/image-selector.component';
import {SourceAssetResponseDto} from '../common/services/source-asset.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {finalize, Observable} from 'rxjs';
import {handleErrorSnackbar} from '../utils/handleErrorSnackbar';
import {NavigationExtras, Router} from '@angular/router';
import {MatStepper} from '@angular/material/stepper';
import {ToastMessageComponent} from '../common/components/toast-message/toast-message.component';

interface Garment {
  id: string;
  name: string;
  imageUrl: string;
  type: 'top' | 'bottom' | 'dress' | 'shoes';
  inputLink: VtoInputLink;
}

interface VtoAssetsResponseDto {
  male_models: SourceAssetResponseDto[];
  female_models: SourceAssetResponseDto[];
  tops: SourceAssetResponseDto[];
  bottoms: SourceAssetResponseDto[];
  dresses: SourceAssetResponseDto[];
  shoes: SourceAssetResponseDto[];
}

interface Model {
  id: string;
  name: string;
  imageUrl: string;
  size: string;
  inputLink: VtoInputLink;
}

@Component({
  selector: 'app-vto',
  templateUrl: './vto.component.html',
  styleUrls: ['./vto.component.scss'],
})
export class VtoComponent implements OnInit, AfterViewInit {
  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;

  @ViewChild('stepper') stepper!: MatStepper;

  isLoading = false;
  imagenDocuments: MediaItem | null = null;
  previousResult: MediaItem | null = null;

  selectedTop: Garment | null = null;
  selectedBottom: Garment | null = null;
  selectedDress: Garment | null = null;
  selectedShoes: Garment | null = null;

  uploadExamples: {imageUrl: string; alt: string}[] = [
    {
      imageUrl: 'assets/images/vto/upload-photo-1.png',
      alt: 'Well-lit, full body example 1',
    },
    {
      imageUrl: 'assets/images/vto/upload-photo-2.png',
      alt: 'Well-lit, full body example 2',
    },
    {
      imageUrl: 'assets/images/vto/upload-photo-3.png',
      alt: 'Well-lit, full body example 3',
    },
    {
      imageUrl: 'assets/images/vto/upload-photo-4.png',
      alt: 'Well-lit, full body example 4',
    },
  ];

  // Mock data
  femaleModels: Model[] = [];
  maleModels: Model[] = [];
  tops: Garment[] = [];
  bottoms: Garment[] = [];
  dresses: Garment[] = [];
  shoes: Garment[] = [];

  modelsToShow: Model[] = this.femaleModels;

  constructor(
    private readonly _formBuilder: FormBuilder,
    private readonly http: HttpClient,
    public dialog: MatDialog,
    private _snackBar: MatSnackBar,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    this.firstFormGroup = this._formBuilder.group({
      modelType: ['female', Validators.required],
      model: [null, Validators.required],
    });

    this.secondFormGroup = this._formBuilder.group({
      top: [null],
      bottom: [null],
      dress: [null],
      shoes: [null],
    });

    this.firstFormGroup.get('modelType')?.valueChanges.subscribe(val => {
      this.modelsToShow =
        val === 'female' ? this.femaleModels : this.maleModels;
      if (this.firstFormGroup.get('model')?.value?.id !== 'uploaded') {
        this.firstFormGroup.get('model')?.reset();
      }
      this.imagenDocuments = null;
    });

    this.firstFormGroup.get('model')?.valueChanges.subscribe(() => {
      this.imagenDocuments = null;
      this.previousResult = null;
    });

    this.secondFormGroup.get('top')?.valueChanges.subscribe(top => {
      this.selectedTop = top;
      if (top) {
        this.selectedDress = null;
        this.secondFormGroup.get('dress')?.reset(null, {emitEvent: false});
      }
    });
    this.secondFormGroup.get('bottom')?.valueChanges.subscribe(bottom => {
      this.selectedBottom = bottom;
      if (bottom) {
        this.selectedDress = null;
        this.secondFormGroup.get('dress')?.reset(null, {emitEvent: false});
      }
    });
    this.secondFormGroup.get('dress')?.valueChanges.subscribe(dress => {
      this.selectedDress = dress;
      if (dress) {
        this.selectedTop = null;
        this.selectedBottom = null;
        this.secondFormGroup.get('top')?.reset(null, {emitEvent: false});
        this.secondFormGroup.get('bottom')?.reset(null, {emitEvent: false});
      }
    });
    this.secondFormGroup.get('shoes')?.valueChanges.subscribe(shoes => {
      this.selectedShoes = shoes;
    });
  }

  ngOnInit(): void {
    this.loadVtoAssets();
    const remixState =
      this.router.getCurrentNavigation()?.extras.state?.['remixState'];
    if (remixState) {
      this.applyRemixState(remixState);
    }
  }

  ngAfterViewInit(): void {
    const remixState =
      this.router.getCurrentNavigation()?.extras.state?.['remixState'];
    if (remixState && this.firstFormGroup.valid) {
      this.stepper.next();
      this.cdr.detectChanges();
    }
  }

  private loadVtoAssets(): void {
    this.isLoading = true;
    this.http
      .get<VtoAssetsResponseDto>(
        `${environment.backendURL}/source_assets/vto-assets`,
      )
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: response => {
          this.femaleModels = response.female_models.map(asset =>
            this.mapAssetToModel(asset),
          );
          this.maleModels = response.male_models.map(asset =>
            this.mapAssetToModel(asset),
          );
          this.tops = response.tops.map(asset =>
            this.mapAssetToGarment(asset, 'top'),
          );
          this.bottoms = response.bottoms.map(asset =>
            this.mapAssetToGarment(asset, 'bottom'),
          );
          this.dresses = response.dresses.map(asset =>
            this.mapAssetToGarment(asset, 'dress'),
          );
          this.shoes = response.shoes.map(asset =>
            this.mapAssetToGarment(asset, 'shoes'),
          );

          // Set default models to show
          this.modelsToShow =
            this.firstFormGroup.get('modelType')?.value === 'female'
              ? this.femaleModels
              : this.maleModels;
        },
        error: err => {
          handleErrorSnackbar(this._snackBar, err, 'Load VTO assets');
        },
      });
  }

  private mapAssetToModel(asset: SourceAssetResponseDto): Model {
    return {
      id: asset.id,
      name: asset.originalFilename,
      imageUrl: asset.presignedUrl,
      size: 'M', // Default size or handle differently
      inputLink: {sourceAssetId: asset.id},
    };
  }

  private mapAssetToGarment(
    asset: SourceAssetResponseDto,
    type: 'top' | 'bottom' | 'dress' | 'shoes',
  ): Garment {
    return {
      id: asset.id,
      name: asset.originalFilename,
      imageUrl: asset.presignedUrl,
      type: type,
      inputLink: {sourceAssetId: asset.id},
    };
  }

  openImageSelector() {
    const dialogRef = this.dialog.open(ImageSelectorComponent, {
      width: '90vw',
      height: '80vh',
      maxWidth: '90vw',
      panelClass: 'image-selector-dialog',
    });

    dialogRef
      .afterClosed()
      .subscribe((result: MediaItemSelection | SourceAssetResponseDto) => {
        if (result) {
          if ('gcsUri' in result) {
            // SourceAssetResponseDto
            const uploadedModel: Model = {
              id: 'uploaded',
              name: result.originalFilename,
              imageUrl: result.presignedUrl,
              size: 'custom',
              inputLink: {sourceAssetId: result.id},
            };
            this.firstFormGroup.get('model')?.setValue(uploadedModel);
          } else {
            // MediaItemSelection
            if (result.mediaItem) {
              this.applyRemixState({
                modelImageAssetId: result.mediaItem.id,
                modelImagePreviewUrl:
                  result.mediaItem.presignedUrls![result.selectedIndex],
                modelImageMediaIndex: result.selectedIndex, // This is correct as it's internal to the component
              });
            }
          }
        }
      });
  }

  private uploadAsset(file: File): Observable<SourceAssetResponseDto> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<SourceAssetResponseDto>(
      `${environment.backendURL}/source_assets/upload`,
      formData,
    );
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.isLoading = true;
      this.uploadAsset(file)
        .pipe(finalize(() => (this.isLoading = false)))
        .subscribe({
          next: asset => {
            const uploadedModel: Model = {
              id: 'uploaded',
              name: asset.originalFilename,
              imageUrl: asset.presignedUrl,
              size: 'custom',
              inputLink: {sourceAssetId: asset.id},
            };
            this.firstFormGroup.get('model')?.setValue(uploadedModel);
          },
          error: error => {
            handleErrorSnackbar(this._snackBar, error, 'Image upload');
          },
        });
    }
  }

  clearImage(event: MouseEvent) {
    event.stopPropagation();
    this.firstFormGroup.get('model')?.reset();
  }

  selectGarment(garment: Garment, type: 'top' | 'bottom' | 'dress' | 'shoes') {
    const control = this.secondFormGroup.get(type);
    if (control?.value?.id === garment.id) {
      control?.setValue(null);
    } else {
      control?.setValue(garment);
    }
  }

  tryOn() {
    const selectedModel = this.firstFormGroup.get('model')?.value;
    if (!selectedModel) {
      console.error('No model selected.');
      return;
    }

    if (
      !this.selectedTop &&
      !this.selectedBottom &&
      !this.selectedDress &&
      !this.selectedShoes
    ) {
      this._snackBar.openFromComponent(ToastMessageComponent, {
        panelClass: ['red-toast'],
        verticalPosition: 'top',
        horizontalPosition: 'right',
        duration: 6000,
        data: {
          text: 'You need to select at least 1 garment!',
          matIcon: 'error',
        },
      });
      return;
    }

    this.isLoading = true;

    const payload: VtoRequest = {
      numberOfMedia: 4, // Defaulting to 4 as per DTO
      personImage: selectedModel.inputLink,
    };

    if (this.selectedTop) payload.topImage = this.selectedTop.inputLink;
    if (this.selectedBottom)
      payload.bottomImage = this.selectedBottom.inputLink;
    if (this.selectedDress) payload.dressImage = this.selectedDress.inputLink;
    if (this.selectedShoes) payload.shoeImage = this.selectedShoes.inputLink;

    console.log('Triggering VTO request with:', payload);

    // const mockResponse: MediaItem = {
    //   id: 'c417fb42-ce89-4fbd-899d-a2e8ea37aab8',
    //   createdAt: '2025-09-10T23:56:43.263123Z',
    //   updatedAt: '2025-09-10T23:56:43.263160Z',
    //   userEmail: 'maurocominotti@google.com',
    //   mimeType: 'image/png',
    //   model: 'virtual-try-on-preview-08-04',
    //   prompt: '',
    //   originalPrompt: '',
    //   numMedia: 1,
    //   generationTime: 17.17271100101061,
    //   aspectRatio: '9:16',
    //   gcsUris: [
    //     'gs://creative-studio-dev-cs-be-development-bucket/images/recontext_images/1757548601455/sample_0.png',
    //   ],
    //   rawData: {},
    //   presignedUrls: [
    //     'https://storage.googleapis.com/creative-studio-dev-cs-be-development-bucket/images/recontext_images/1757548601455/sample_0.png?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=cs-be-development-read%40creative-studio-dev.iam.gserviceaccount.com%2F20250910%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20250910T235643Z&X-Goog-Expires=3600&X-Goog-SignedHeaders=host&X-Goog-Signature=65271a339cb9989a3c4ae4c898a1777d1280555bd264054abbe141c2a49ebbafdf82786799749da4f55a6b45ccc14e427886dbc125104f22640a7272b916e5b30407dc2c42f99bcab363a02a0e77fb4a45b24d71bbd281864ab530bf58a12b903baa4ea7735c605e92abcb4807402b0de8f6ea7905f29392027960d79a3c786876dce249470a306038831bf98407be241624b83ba6bf975dd3b58a580c6ec9a52405bc1070b269656371c63abe48d8d66b0add4f8526aae9cc112fe35060c7a21f1f294dcd3175c87b8460b8ae91e3baa65ed9d585cabc0e8245d29c4531aa99bc2002e588094b82b754e522e99798bbe87f9a2adaadcf0294d1413ed62cc043',
    //   ],
    //   presignedThumbnailUrls: [],
    // };

    // new Observable<MediaItem>(subscriber => {
    //   setTimeout(() => {
    //     subscriber.next(mockResponse);
    //     subscriber.complete();
    //   }, 1000); // Simulate network delay
    // })

    this.http
      .post<MediaItem>(
        `${environment.backendURL}/images/generate-images-for-vto`,
        payload,
      )
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: response => {
          this.previousResult = this.imagenDocuments;
          this.imagenDocuments = response;
        },
        error: err => {
          handleErrorSnackbar(this._snackBar, err, 'Virtual Try-On');
        },
      });
  }

  private applyRemixState(remixState: {
    modelImageAssetId: string;
    modelImagePreviewUrl: string;
    modelImageMediaIndex: number;
  }): void {
    const remixedModel: Model = {
      id: 'uploaded', // To match the logic for showing the preview
      name: 'Imported Model',
      imageUrl: remixState.modelImagePreviewUrl,
      size: 'custom',
      inputLink: {
        sourceMediaItem: {
          mediaItemId: remixState.modelImageAssetId,
          mediaIndex: remixState.modelImageMediaIndex,
        },
      },
    };
    this.firstFormGroup.get('model')?.setValue(remixedModel);
  }

  setModelFromImage(index: number): void {
    if (!this.imagenDocuments) {
      return;
    }

    const newModel: Model = {
      id: 'uploaded', // Treat it as a custom uploaded model
      name: 'Generated Model',
      imageUrl: this.imagenDocuments.presignedUrls![index],
      size: 'custom',
      inputLink: {
        sourceMediaItem: {
          mediaItemId: this.imagenDocuments.id,
          mediaIndex: index,
        },
      },
    };

    this.firstFormGroup.get('model')?.setValue(newModel);
  }

  remixWithThisImage(index: number): void {
    if (!this.imagenDocuments) {
      return;
    }

    const sourceMediaItem: VtoSourceMediaItemLink = {
      mediaItemId: this.imagenDocuments.id,
      mediaIndex: index,
    };

    const navigationExtras: NavigationExtras = {
      state: {
        remixState: {
          sourceMediaItems: [sourceMediaItem],
          prompt: this.imagenDocuments.originalPrompt,
          previewUrl: this.imagenDocuments.presignedUrls?.[index],
        },
      },
    };
    this.router.navigate(['/'], navigationExtras);
  }

  generateVideoWithResult(event: {role: 'start' | 'end'; index: number}): void {
    if (!this.imagenDocuments) {
      return;
    }

    const sourceMediaItem: VtoSourceMediaItemLink = {
      mediaItemId: this.imagenDocuments.id,
      mediaIndex: event.index,
      role: event.role === 'start' ? 'start_frame' : 'end_frame',
    };

    const remixState = {
      prompt: this.imagenDocuments.originalPrompt,
      sourceMediaItems: [sourceMediaItem],
      aspectRatio: '9:16',
      startImagePreviewUrl:
        event.role === 'start'
          ? this.imagenDocuments.presignedUrls?.[event.index]
          : undefined,
      endImagePreviewUrl:
        event.role === 'end'
          ? this.imagenDocuments.presignedUrls?.[event.index]
          : undefined,
    };

    const navigationExtras: NavigationExtras = {
      state: {remixState},
    };
    this.router.navigate(['/video'], navigationExtras);
  }
}
