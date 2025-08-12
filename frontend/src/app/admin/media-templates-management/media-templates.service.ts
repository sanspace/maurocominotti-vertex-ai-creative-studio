import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MediaTemplate } from './media-template.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MediaTemplatesService {
  private apiUrl = `${environment.backendURL}/media-templates`;

  constructor(private http: HttpClient) { }

  getMediaTemplates(): Observable<MediaTemplate[]> {
    return this.http.get<MediaTemplate[]>(this.apiUrl);
  }
}
