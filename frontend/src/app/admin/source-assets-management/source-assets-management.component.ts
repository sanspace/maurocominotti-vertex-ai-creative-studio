import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import {MatTableDataSource} from '@angular/material/table';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {SourceAssetsService} from './source-assets.service';
import {
  AssetScopeEnum,
  AssetTypeEnum,
  SourceAsset,
} from './source-asset.model';
import {SourceAssetFormComponent} from './source-asset-form/source-asset-form.component';
import {ToastMessageComponent} from '../../common/components/toast-message/toast-message.component';
import {SourceAssetResponseDto} from '../../common/services/source-asset.service';
import {SourceAssetUploadFormComponent} from './source-asset-upload-form/source-asset-upload-form.component';

@Component({
  selector: 'app-source-assets-management',
  templateUrl: './source-assets-management.component.html',
  styleUrls: ['./source-assets-management.component.scss'],
})
export class SourceAssetsManagementComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
    'thumbnail',
    'originalFilename',
    'assetType',
    'createdAt',
    'actions',
  ];
  dataSource: MatTableDataSource<SourceAssetResponseDto>;
  isLoading = true;
  errorLoading: string | null = null;

  // Filter properties
  filterName = '';
  filterScope: AssetScopeEnum | null = null;
  filterAssetType: AssetTypeEnum | null = null;
  assetScopes = Object.values(AssetScopeEnum);
  assetTypes = Object.values(AssetTypeEnum);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private sourceAssetsService: SourceAssetsService,
    public dialog: MatDialog,
    private _snackBar: MatSnackBar,
  ) {
    this.dataSource = new MatTableDataSource<SourceAssetResponseDto>([]);
  }

  ngOnInit(): void {
    this.fetchAssets();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  fetchAssets(): void {
    this.isLoading = true;
    this.errorLoading = null;
    const filters = {
      originalFilename: this.filterName.trim() || undefined,
      scope: this.filterScope || undefined,
      assetType: this.filterAssetType || undefined,
    };
    this.sourceAssetsService.searchSourceAssets(filters).subscribe({
      next: assets => {
        this.dataSource.data = assets.data;
        this.isLoading = false;
      },
      error: err => {
        console.error('Error fetching source assets', err);
        this.errorLoading =
          'Could not load source assets. Please try again later.';
        this.isLoading = false;
      },
    });
  }

  applyFilter(event: Event) {
    this.filterName = (event.target as HTMLInputElement).value.trim();
    this.fetchAssets();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  createAsset(): void {
    const dialogRef = this.dialog.open(SourceAssetUploadFormComponent, {
      width: '500px',
      disableClose: true,
    });

    dialogRef
      .afterClosed()
      .subscribe((result: SourceAssetResponseDto | null) => {
        if (result) {
          this.fetchAssets();
          this._snackBar.openFromComponent(ToastMessageComponent, {
            panelClass: ['green-toast'],
            duration: 3000,
            data: {
              text: `Asset "${result.originalFilename}" uploaded successfully`,
              matIcon: 'check_circle',
            },
          });
        }
      });
  }

  editAsset(asset: SourceAsset): void {
    const dialogRef = this.dialog.open(SourceAssetFormComponent, {
      width: '800px',
      data: {asset: {...asset}},
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.sourceAssetsService.updateSourceAsset(result).subscribe({
          next: () => {
            this.fetchAssets();
            this._snackBar.openFromComponent(ToastMessageComponent, {
              panelClass: ['green-toast'],
              duration: 3000,
              data: {text: 'Asset updated successfully', matIcon: 'check_circle'},
            });
          },
          error: (err: Error) => {
            this._snackBar.openFromComponent(ToastMessageComponent, {
              panelClass: ['red-toast'],
              duration: 5000,
              data: {text: 'Error updating asset', matIcon: 'error'},
            });
          },
        });
      }
    });
  }

  deleteAsset(asset: SourceAsset): void {
    if (
      asset.id &&
      confirm(`Are you sure you want to delete asset "${asset.originalFilename}"?`)
    ) {
      this.sourceAssetsService.deleteSourceAsset(asset.id).subscribe({
        next: () => {
          this.fetchAssets();
          this._snackBar.openFromComponent(ToastMessageComponent, {
            panelClass: ['green-toast'],
            duration: 3000,
            data: {text: 'Asset deleted successfully', matIcon: 'check_circle'},
          });
        },
        error: (err: Error) => {
          this._snackBar.openFromComponent(ToastMessageComponent, {
            panelClass: ['red-toast'],
            duration: 5000,
            data: {text: 'Error deleting asset', matIcon: 'error'},
          });
        },
      });
    }
  }
}
