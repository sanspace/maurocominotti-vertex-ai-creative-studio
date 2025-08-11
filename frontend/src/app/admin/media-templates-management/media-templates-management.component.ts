import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Template } from '../../fun-templates/template.model';
import { TEMPLATES } from '../../fun-templates/templates.data';
@Component({
  selector: 'app-media-templates-management',
  templateUrl: './media-templates-management.component.html',
  styleUrls: ['./media-templates-management.component.scss'],
})
export class MediaTemplatesManagementComponent implements AfterViewInit {
  displayedColumns: string[] = ['name', 'description', 'mimeType', 'industry', 'brand', 'actions'];
  dataSource: MatTableDataSource<Template>;
  isLoading = false;
  errorLoading = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor() {
    // In a real app, you would fetch this data from a service.
    // For now, we use the hardcoded templates.
    this.dataSource = new MatTableDataSource(TEMPLATES);
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  editTemplate(template: Template): void {
    // TODO: Implement edit functionality, e.g., open a dialog
    console.log('Editing template:', template);
  }

  deleteTemplate(template: Template): void {
    // TODO: Implement delete functionality, e.g., show a confirmation dialog
    console.log('Deleting template:', template);
  }
}
