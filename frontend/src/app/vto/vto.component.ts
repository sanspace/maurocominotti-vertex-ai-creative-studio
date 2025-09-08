import {Component, OnInit} from '@angular/core';
import {FormBuilder, Validators, FormGroup} from '@angular/forms';
import {MediaItem} from '../common/models/media-item.model';
import {HttpClient} from '@angular/common/http';
import {VtoRequest} from './vto.model';
import {environment} from '../../environments/environment';
import {MatDialog} from '@angular/material/dialog';
import {ImageSelectorComponent} from '../common/components/image-selector/image-selector.component';
import {SourceAssetResponseDto} from '../common/services/source-asset.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {finalize, Observable} from 'rxjs';
import {handleErrorSnackbar} from '../utils/handleErrorSnackbar';

interface Garment {
  id: string;
  name: string;
  imageUrl: string;
  gcsUri: string;
  type: 'top' | 'bottom' | 'dress' | 'shoes';
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
  gcsUri?: string;
  size: string;
}

@Component({
  selector: 'app-vto',
  templateUrl: './vto.component.html',
  styleUrls: ['./vto.component.scss'],
})
export class VtoComponent implements OnInit {
  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;

  isLoading = false;
  imagenDocuments: MediaItem | null = null;

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
      this.firstFormGroup.get('model')?.reset(); // Also clear uploaded model
      this.imagenDocuments = null;
    });

    this.firstFormGroup.get('model')?.valueChanges.subscribe(() => {
      this.imagenDocuments = null;
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
  }

  private loadVtoAssets(): void {
    this.isLoading = true;
    this.http
      .get<VtoAssetsResponseDto>(`${environment.backendURL}/source_assets/vto-assets`)
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
      gcsUri: asset.gcsUri,
      size: 'M', // Default size or handle differently
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
      gcsUri: asset.gcsUri,
      type: type,
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
      .subscribe((result: MediaItem | SourceAssetResponseDto) => {
        if (result) {
          const uploadedModel: Model = {
            id: 'uploaded',
            name: 'Uploaded Model',
            imageUrl:
              'presignedUrl' in result
                ? result.presignedUrl
                : result.presignedUrls![0],
            gcsUri: 'gcsUri' in result ? result.gcsUri : result.gcsUris[0],
            size: 'custom',
          };

          this.firstFormGroup.get('model')?.setValue(uploadedModel);
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
              gcsUri: asset.gcsUri,
              size: 'custom',
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

    this.isLoading = true;

    let personGcsUri: string;

    if (
      this.imagenDocuments &&
      this.imagenDocuments.gcsUris &&
      this.imagenDocuments.gcsUris.length > 0
    ) {
      personGcsUri = this.imagenDocuments.gcsUris[0];
    } else if (selectedModel.gcsUri) {
      personGcsUri = selectedModel.gcsUri;
    } else {
      // This case is for pre-loaded models that don't have a GCS URI yet.
      // The backend will need to handle resolving the asset path.
      // For this to work, the backend needs to know how to map this path to a GCS URI.
      // A better long-term solution would be to ensure all models have a GCS URI.
      personGcsUri = selectedModel.imageUrl;
    }

    const payload: VtoRequest = {
      number_of_media: 1, // Defaulting to 1 as per DTO
      person_image: {gcs_uri: personGcsUri},
    };

    // For garments, we assume the imageUrl is a GCS URI or a path the backend can resolve.
    if (this.selectedTop)
      payload.top_image = {gcs_uri: this.selectedTop.gcsUri};
    if (this.selectedBottom)
      payload.bottom_image = {gcs_uri: this.selectedBottom.gcsUri};
    if (this.selectedDress)
      payload.dress_image = {gcs_uri: this.selectedDress.gcsUri};
    if (this.selectedShoes)
      payload.shoe_image = {gcs_uri: this.selectedShoes.gcsUri};

    console.log('Triggering VTO request with:', payload);

    this.http
      .post<MediaItem>(
        `${environment.backendURL}/images/generate-images-for-vto`,
        payload,
      )
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: response => {
          this.imagenDocuments = response;
          // Also update the preview model to reflect the latest generation
          // for the next iterative step.
          if (
            selectedModel &&
            response.presignedUrls &&
            response.presignedUrls.length > 0
          ) {
            selectedModel.imageUrl = response.presignedUrls[0];
            if (response.gcsUris && response.gcsUris.length > 0) {
              selectedModel.gcsUri = response.gcsUris[0];
            }
          }
        },
        error: err => {
          handleErrorSnackbar(this._snackBar, err, 'Virtual Try-On');
        },
      });
  }
}
