import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {ImageCroppedEvent, ImageTransform, CropperOptions} from 'ngx-image-cropper';
import {HttpClient} from '@angular/common/http';
import {Observable, finalize} from 'rxjs';
import {
  SourceAssetResponseDto,
  SourceAssetService,
} from '../../services/source-asset.service';
import {AssetTypeEnum} from '../../../admin/source-assets-management/source-asset.model';
import {WorkspaceStateService} from '../../../services/workspace/workspace-state.service';
import {environment} from '../../../../environments/environment';

interface AspectRatio {
  label: string;
  value: number;
}

@Component({
  selector: 'app-image-cropper-dialog',
  templateUrl: './image-cropper-dialog.component.html',
  styleUrls: ['./image-cropper-dialog.component.scss'],
})
export class ImageCropperDialogComponent {
  isUploading = false;
  imageFile: File;
  croppedImageBlob: Blob | null = null;
  aspectRatios: AspectRatio[] = [];
  currentAspectRatio: number;
  containWithinAspectRatio = false;
  backgroundColor = 'white';

  transform: ImageTransform = {
    translateUnit: 'px',
    scale: 1,
    rotate: 0,
    flipH: false,
    flipV: false,
  };
  canvasRotation = 0;
  options: Partial<CropperOptions>;

  constructor(
    public dialogRef: MatDialogRef<ImageCropperDialogComponent>,
    private http: HttpClient,
    private sourceAssetService: SourceAssetService,
    private workspaceStateService: WorkspaceStateService,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      imageFile: File;
      assetType: AssetTypeEnum;
      aspectRatios?: AspectRatio[];
    },
  ) {
    this.imageFile = data.imageFile;
    this.aspectRatios = data.aspectRatios || [
      {label: '1:1 Square', value: 1 / 1},
      {label: '16:9 Horizontal', value: 16 / 9},
      {label: '9:16 Vertical', value: 9 / 16},
      {label: '3:4 Portrait', value: 3 / 4},
      {label: '4:3 Pin', value: 4 / 3},
    ];
    this.currentAspectRatio = this.aspectRatios[0].value;

    // Initialize the options object
    this.options = {
      aspectRatio: this.currentAspectRatio,
      maintainAspectRatio: true,
      containWithinAspectRatio: this.containWithinAspectRatio,
      backgroundColor: this.backgroundColor,
      autoCrop: true,
    };
  }

  // --- Start: Add Event Handlers ---
  onAspectRatioChange(newRatio: number): void {
    this.currentAspectRatio = newRatio;
    this.options = {...this.options, aspectRatio: newRatio};
  }

  onBackgroundColorChange(newColor: string): void {
    this.backgroundColor = newColor;
    this.options = {...this.options, backgroundColor: newColor};
  }

  // --- Start: Add New Control Methods ---
  rotateLeft() {
    this.canvasRotation--;
  }

  rotateRight() {
    this.canvasRotation++;
  }

  moveLeft() {
    this.transform = {
      ...this.transform,
      translateH: (this.transform.translateH || 0) - 5,
    };
  }

  moveRight() {
    this.transform = {
      ...this.transform,
      translateH: (this.transform.translateH || 0) + 5,
    };
  }

  moveDown() {
    this.transform = {
      ...this.transform,
      translateV: (this.transform.translateV || 0) + 5,
    };
  }

  moveUp() {
    this.transform = {
      ...this.transform,
      translateV: (this.transform.translateV || 0) - 5,
    };
  }

  flipHorizontal() {
    this.transform = {...this.transform, flipH: !this.transform.flipH};
  }

  flipVertical() {
    this.transform = {...this.transform, flipV: !this.transform.flipV};
  }

  zoomOut() {
    this.transform = {
      ...this.transform,
      scale: (this.transform.scale || 1) - 0.1,
    };
  }

  zoomIn() {
    this.transform = {
      ...this.transform,
      scale: (this.transform.scale || 1) + 0.1,
    };
  }
  // --- End: Add New Control Methods ---

  imageCropped(event: ImageCroppedEvent) {
    if (event.blob) {
      this.croppedImageBlob = event.blob;
    }
  }

  uploadCroppedImage() {
    if (this.croppedImageBlob) {
      const croppedFile = new File(
        [this.croppedImageBlob],
        this.imageFile.name,
        {
          type: 'image/png',
        },
      );

      this.isUploading = true;
      this.uploadAsset(croppedFile)
        .pipe(finalize(() => (this.isUploading = false)))
        .subscribe(asset => {
          this.sourceAssetService.addAsset(asset);
          this.dialogRef.close(asset); // Close and return the final asset
        });
    }
  }

  private uploadAsset(file: File): Observable<SourceAssetResponseDto> {
    const formData = new FormData();
    const activeWorkspaceId = this.workspaceStateService.getActiveWorkspaceId();

    formData.append('file', file);
    formData.append('scope', 'private');
    formData.append(
      'assetType',
      this.data.assetType || AssetTypeEnum.GENERIC_IMAGE,
    );
    if (activeWorkspaceId) {
      formData.append('workspaceId', activeWorkspaceId);
    }

    return this.http.post<SourceAssetResponseDto>(
      // `${environment.backendURL}/source_assets/upload`,
      `${environment.backendURL}/`,
      formData,
    );
  }
}
