import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  NgZone,
  OnInit,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import {Subscription} from 'rxjs';
import {
  UserAssetService,
  UserAssetResponseDto,
} from '../../services/user-asset.service';
import {UserService} from '../../services/user.service';

@Component({
  selector: 'app-user-asset-gallery',
  templateUrl: './user-asset-gallery.component.html',
  styleUrls: ['./user-asset-gallery.component.scss'],
})
export class UserAssetGalleryComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  @Output() assetSelected = new EventEmitter<UserAssetResponseDto>();
  @ViewChild('sentinel') private sentinel!: ElementRef<HTMLElement>;

  public assets: UserAssetResponseDto[] = [];
  public isLoading = true;
  public allAssetsLoaded = false;
  private assetsSubscription: Subscription | undefined;
  private loadingSubscription: Subscription | undefined;
  private allAssetsLoadedSubscription: Subscription | undefined;
  private scrollObserver!: IntersectionObserver;

  constructor(
    private userAssetService: UserAssetService,
    private userService: UserService,
    private elementRef: ElementRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.loadingSubscription = this.userAssetService.isLoading$.subscribe(
      loading => {
        this.isLoading = loading;
      },
    );

    this.allAssetsLoadedSubscription =
      this.userAssetService.allAssetsLoaded.subscribe(loaded => {
        this.allAssetsLoaded = loaded;
      });

    this.assetsSubscription = this.userAssetService.assets.subscribe(assets => {
      this.assets = assets;
    });

    // Load assets for the current user
    const userDetails = this.userService.getUserDetails();
    if (userDetails?.email) {
      this.userAssetService.setFilters({
        userEmail: userDetails.email,
        mimeType: 'image/png',
      });
    }
  }

  ngAfterViewInit(): void {
    this.setupInfiniteScrollObserver();
  }

  ngOnDestroy(): void {
    this.assetsSubscription?.unsubscribe();
    this.loadingSubscription?.unsubscribe();
    this.allAssetsLoadedSubscription?.unsubscribe();
    this.scrollObserver?.disconnect();
  }

  private getScrollableContainer(): HTMLElement | null {
    const element = this.elementRef.nativeElement as HTMLElement;
    const overlayPane = element.closest('.cdk-overlay-pane');
    return (
      overlayPane?.querySelector<HTMLElement>('.mat-mdc-dialog-content') || null
    );
  }

  private setupInfiniteScrollObserver(): void {
    if (!this.sentinel) {
      return;
    }

    const scrollRoot = this.getScrollableContainer();

    this.scrollObserver = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          !this.isLoading &&
          !this.allAssetsLoaded
        ) {
          this.ngZone.run(() => {
            this.userAssetService.loadAssets();
          });
        }
      },
      {
        root: scrollRoot,
      },
    );

    this.scrollObserver.observe(this.sentinel.nativeElement);
  }

  selectAsset(asset: UserAssetResponseDto): void {
    this.assetSelected.emit(asset);
  }

  trackByAsset(index: number, asset: UserAssetResponseDto): string {
    return asset.id;
  }
}
