import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {tap, catchError, shareReplay} from 'rxjs/operators';
import {
  MediaItem,
  PaginatedGalleryResponse,
  JobStatus,
} from '../common/models/media-item.model';
import {environment} from '../../environments/environment';
import {GallerySearchDto} from '../common/models/search.model';

export interface GalleryFilters {
  userEmail?: string;
  mimeType?: string;
  model?: string;
  status?: JobStatus;
}

@Injectable({
  providedIn: 'root',
})
export class GalleryService {
  private imagesCache$ = new BehaviorSubject<MediaItem[]>([]);
  public isLoading$ = new BehaviorSubject<boolean>(false);
  private allImagesLoaded$ = new BehaviorSubject<boolean>(false);
  private nextPageCursor: string | null = null;
  private allFetchedImages: MediaItem[] = [];
  private filters$ = new BehaviorSubject<GalleryFilters>({});

  constructor(private http: HttpClient) {}

  get images$(): Observable<MediaItem[]> {
    return this.imagesCache$.asObservable();
  }

  get allImagesLoaded(): Observable<boolean> {
    return this.allImagesLoaded$.asObservable();
  }

  setFilters(filters: GalleryFilters) {
    this.filters$.next(filters);
    this.loadGallery(true);
  }

  loadGallery(reset = false): void {
    // Do not load more if we are already loading or if all images have been loaded.
    if (this.isLoading$.value) {
      return;
    }

    if (reset) {
      this.allFetchedImages = [];
      this.nextPageCursor = null;
      this.allImagesLoaded$.next(false);
    }

    // Do not try to load more if all items have already been loaded
    if (this.allImagesLoaded$.value) {
      return;
    }

    this.fetchImages()
      .pipe(
        tap(response => {
          this.nextPageCursor = response.nextPageCursor ?? null;
          // Accumulate images in our central cache and push the new list to subscribers
          this.allFetchedImages = [...this.allFetchedImages, ...response.data];
          this.imagesCache$.next(this.allFetchedImages);

          if (!this.nextPageCursor) {
            this.allImagesLoaded$.next(true);
          }
          this.isLoading$.next(false);
        }),
          catchError(err => {
            console.error('Failed to fetch gallery images', err);
            this.isLoading$.next(false);
            this.allImagesLoaded$.next(true); // prevent loading more
            return of([]); // Return an empty array observable to prevent breaking the stream
          })
      )
      .subscribe();
  }

  private fetchImages(): Observable<PaginatedGalleryResponse> {
    this.isLoading$.next(true);
    const galleryUrl = `${environment.backendURL}/gallery`;
    const currentFilters = this.filters$.value;

    const body: GallerySearchDto = {
      limit: 20,
      ...currentFilters,
    };

    if (this.nextPageCursor) {
      body.startAfter = this.nextPageCursor;
    }
    return this.http.post<PaginatedGalleryResponse>(galleryUrl, body).pipe(
      shareReplay(1), // important to cache the http get response
    );
  }

  getMedia(id: string): Observable<MediaItem> {
    const detailUrl = `${environment.backendURL}/gallery/item/${id}`;
    return this.http.get<MediaItem>(detailUrl);
  }

  /**
   * Creates a new template based on a media item.
   * @param mediaItemId The ID of the media item to base the template on.
   */
  createTemplateFromMediaItem(mediaItemId: string): Observable<{id: string}> {
    return this.http.post<{id: string}>(
      `${environment.backendURL}/media-templates/from-media-item/${mediaItemId}`,
      {},
    );
  }
}
