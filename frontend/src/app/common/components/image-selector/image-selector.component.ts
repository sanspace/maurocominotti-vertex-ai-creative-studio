import {Component} from '@angular/core';
import {MatDialogRef} from '@angular/material/dialog';
import {MediaItem} from '../../models/media-item.model';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../../environments/environment';
import {Observable, finalize} from 'rxjs';
import {
  SourceAssetResponseDto,
  SourceAssetService,
} from '../../services/source-asset.service';

export interface MediaItemSelection {
  mediaItem: MediaItem;
  selectedIndex: number;
}

@Component({
  selector: 'app-image-selector',
  templateUrl: './image-selector.component.html',
  styleUrls: ['./image-selector.component.scss'],
})
export class ImageSelectorComponent {
  isUploading = false;

  constructor(
    public dialogRef: MatDialogRef<ImageSelectorComponent>,
    private http: HttpClient,
    private sourceAssetService: SourceAssetService,
  ) {}

  private uploadAsset(file: File): Observable<SourceAssetResponseDto> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<SourceAssetResponseDto>(
      `${environment.backendURL}/source_assets/upload`,
      formData,
    );
  }

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;

    if (fileList && fileList[0]) {
      const file = fileList[0];
      this.isUploading = true;
      this.uploadAsset(file)
        .pipe(finalize(() => (this.isUploading = false)))
        .subscribe(asset => {
          this.sourceAssetService.addAsset(asset);
          this.dialogRef.close(asset);
        });
    }
  }

  onMediaItemSelected(selection: MediaItemSelection): void {
    this.dialogRef.close(selection);
  }

  onAssetSelected(asset: SourceAssetResponseDto): void {
    this.dialogRef.close(asset);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files[0]) {
      const file = event.dataTransfer.files[0];
      this.isUploading = true;
      this.uploadAsset(file)
        .pipe(finalize(() => (this.isUploading = false)))
        .subscribe(asset => {
          this.sourceAssetService.addAsset(asset);
          this.dialogRef.close(asset);
        });
    }
  }
}
