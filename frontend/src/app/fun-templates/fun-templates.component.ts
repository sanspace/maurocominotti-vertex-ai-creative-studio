/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Component, inject, OnDestroy, OnInit, PLATFORM_ID} from '@angular/core';
import {MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {MimeType, Template, TemplateFilter} from './template.model';
import {Router} from '@angular/router';
import {INDUSTRIES, TEMPLATES} from './templates.data';
import {isPlatformBrowser} from '@angular/common';

@Component({
  selector: 'app-fun-templates',
  templateUrl: './fun-templates.component.html',
  styleUrl: './fun-templates.component.scss',
})
export class FunTemplatesComponent implements OnInit, OnDestroy {
  private isBrowser: boolean;
  public isLoading = true;
  public allTemplates: Template[] = [];
  public filteredTemplates: Template[] = [];
  public templateFilter: TemplateFilter = {
    industry: null,
    mediaType: null,
    tags: null,
    model: null,
    name: null,
  };
  public readonly industries: string[] = INDUSTRIES;
  public readonly mediaTypes = Object.values(MimeType);
  private autoSlideIntervals: {[id: string]: any} = {};
  public currentImageIndices: {[id: string]: number} = {};
  public hoveredVideoId: string | null = null;

  // Services using inject() for modern Angular
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  public matIconRegistry = inject(MatIconRegistry);

  constructor() {
    this.isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    const iconPath = '../../assets/images';
    this.matIconRegistry
      .addSvgIcon(
        'gemini-spark-icon',
        this.setPath(`${iconPath}/gemini-spark-icon.svg`),
      )
      .addSvgIcon(
        'mobile-white-gemini-spark-icon',
        this.setPath(`${iconPath}/mobile-white-gemini-spark-icon.svg`),
      );
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      // Simulate fetching data only on the browser to avoid SSR timeouts
      this.isLoading = true;
      setTimeout(() => {
        this.allTemplates = TEMPLATES;
        this.allTemplates.forEach(t => {
          this.currentImageIndices[t.id] = 0;
        });
        this.applyFilters(); // This will also start the intervals
        this.isLoading = false;
      }, 500); // Simulate 0.5 second network delay
    } else {
      // For SSR, load the data synchronously
      this.allTemplates = TEMPLATES;
      this.filteredTemplates = [...this.allTemplates];
      this.allTemplates.forEach(t => {
        this.currentImageIndices[t.id] = 0;
      });
      this.isLoading = false;
    }
  }

  /**
   * Optimizes *ngFor performance by providing a unique identifier for each template.
   * This prevents Angular from re-rendering the entire list when data changes.
   * @param index The index of the item in the array.
   * @param template The template object itself.
   * @returns The unique ID of the template.
   */
  public trackById(index: number, template: Template): string {
    return template.id;
  }

  /**
   * Filters the templates based on the current `templateFilter` values.
   */
  applyFilters(): void {
    let templates = [...this.allTemplates];
    const filter = this.templateFilter;

    // Filter by Industry
    if (filter.industry) {
      templates = templates.filter(t => t.industry === filter.industry);
    }

    // Filter by Media Type
    if (filter.mediaType) {
      templates = templates.filter(t => t.mime_type === filter.mediaType);
    }

    // Filter by Name (case-insensitive)
    if (filter.name) {
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(filter.name!.toLowerCase()),
      );
    }

    // Filter by Model (case-insensitive)
    if (filter.model) {
      templates = templates.filter(t =>
        t.generation_parameters.model
          ?.toLowerCase()
          .includes(filter.model!.toLowerCase()),
      );
    }

    // Filter by Tags (case-insensitive search within the tags array)
    if (filter.tags) {
      templates = templates.filter(t =>
        t.tags.some(tag =>
          tag.toLowerCase().includes(filter.tags!.toLowerCase()),
        ),
      );
    }

    this.filteredTemplates = templates;

    // Clear all intervals
    Object.values(this.autoSlideIntervals).forEach(clearInterval);
    this.autoSlideIntervals = {};

    // Start intervals for filtered templates
    this.filteredTemplates.forEach(t => {
      if (this.currentImageIndices[t.id] === undefined) {
        this.currentImageIndices[t.id] = 0;
      }
      this.startAutoSlide(t);
    });
  }

  /**
   * Navigates to the main generator page, passing the selected template's
   * generation parameters in the router state.
   * @param template The template object that was clicked.
   */
  useTemplate(template: Template): void {
    console.log('Using template:', template);
    // Navigate to the homepage (or your generator page) and pass the parameters
    this.router.navigate(['/home'], {
      state: {
        templateParams: template.generation_parameters,
      },
    });
  }

  /**
   * Clears all active filters and re-applies to show all templates.
   */
  clearFilters(): void {
    this.templateFilter = {
      industry: null,
      mediaType: null,
      tags: null,
      model: null,
      name: null,
    };
    this.applyFilters();
  }

  private setPath(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  public nextImage(
    imageId: string,
    urlsLength: number,
    event?: MouseEvent,
  ): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
      this.stopAutoSlide(imageId);
    }
    const currentIndex = this.currentImageIndices[imageId] || 0;
    this.currentImageIndices[imageId] = (currentIndex + 1) % urlsLength;
  }

  public prevImage(
    imageId: string,
    urlsLength: number,
    event?: MouseEvent,
  ): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
      this.stopAutoSlide(imageId);
    }
    const currentIndex = this.currentImageIndices[imageId] || 0;
    this.currentImageIndices[imageId] =
      (currentIndex - 1 + urlsLength) % urlsLength;
  }

  public playVideo(mediaId: string): void {
    this.hoveredVideoId = mediaId;
  }

  public stopVideo(): void {
    this.hoveredVideoId = null;
  }

  public startAutoSlide(template: Template): void {
    const urls =
      template.mime_type === MimeType.VIDEO
        ? template.thumbnail_uris
        : template.presigned_urls;
    if (urls && urls.length > 1) {
      if (this.autoSlideIntervals[template.id]) {
        return;
      }
      this.autoSlideIntervals[template.id] = setInterval(() => {
        this.nextImage(template.id, urls.length);
      }, 3000);
    }
  }

  public stopAutoSlide(imageId: string): void {
    if (this.autoSlideIntervals[imageId]) {
      clearInterval(this.autoSlideIntervals[imageId]);
      delete this.autoSlideIntervals[imageId];
    }
  }

  public onMouseEnter(media: Template): void {
    if (media.mime_type === 'video/mp4') this.playVideo(media.id);

    this.stopAutoSlide(media.id);
  }

  public onMouseLeave(media: Template): void {
    if (media.mime_type === 'video/mp4') this.stopVideo();

    this.startAutoSlide(media);
  }

  ngOnDestroy(): void {
    Object.values(this.autoSlideIntervals).forEach(clearInterval);
  }
}
