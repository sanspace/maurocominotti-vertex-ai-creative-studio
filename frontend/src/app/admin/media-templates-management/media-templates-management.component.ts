import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import {MatTableDataSource} from '@angular/material/table';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {MediaTemplate} from './media-template.model';
import {MediaTemplatesService} from './media-templates.service';

@Component({
  selector: 'app-media-templates-management',
  templateUrl: './media-templates-management.component.html',
  styleUrls: ['./media-templates-management.component.scss'],
})
export class MediaTemplatesManagementComponent
  implements OnInit, AfterViewInit
{
  displayedColumns: string[] = [
    // 'thumbnail',
    'name',
    'description',
    'mimeType',
    'industry',
    'brand',
    'actions',
  ];
  dataSource: MatTableDataSource<MediaTemplate>;
  isLoading = true;
  errorLoading: string | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(private mediaTemplatesService: MediaTemplatesService) {
    this.dataSource = new MatTableDataSource<MediaTemplate>([]);
  }

  ngOnInit(): void {
    this.fetchTemplates();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  fetchTemplates(): void {
    this.isLoading = true;
    this.errorLoading = null;
    this.mediaTemplatesService.getMediaTemplates().subscribe({
      next: templates => {
        this.dataSource.data = templates;
        this.isLoading = false;
      },
      error: err => {
        console.error('Error fetching media templates', err);
        this.errorLoading =
          'Could not load media templates. Please try again later.';
        this.isLoading = false;
      },
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  editTemplate(template: MediaTemplate): void {
    // TODO: Implement edit functionality, e.g., open a dialog
    console.log('Editing template:', template);
  }

  deleteTemplate(template: MediaTemplate): void {
    // TODO: Implement delete functionality, e.g., show a confirmation dialog
    console.log('Deleting template:', template);
  }
}
