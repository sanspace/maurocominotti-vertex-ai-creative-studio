import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Subscription } from 'rxjs';
import { UserWhitelist as User } from './user-whitelist.model';
import { UserService } from './user.service';
import { MatDialog } from '@angular/material/dialog'; // Import MatDialog
import { UserFormComponent } from './user-form.component'; // Import UserFormComponent
import { MatSnackBar } from '@angular/material/snack-bar'; // For notifications

@Component({
  selector: 'app-users-management',
  templateUrl: './users-management.component.html',
  styleUrls: ['./users-management.component.scss']
})
export class UsersManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  // displayedColumns: string[] = ['id', 'username', 'email', 'full_name', 'actions'];
  // Adjust displayedColumns based on your UserWhitelist model.
  // If UserWhitelist only has 'email' and 'id', then:
  displayedColumns: string[] = ['id', 'email', 'name', 'roles', 'actions'];
  dataSource: MatTableDataSource<User> = new MatTableDataSource<User>();
  private usersSubscription: Subscription | undefined;
  private dialogSubscription: Subscription | undefined;

  isLoading = true;
  errorLoadingUsers: string | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private userService: UserService,
    public dialog: MatDialog, // Inject MatDialog
    private _snackBar: MatSnackBar // Inject MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  ngAfterViewInit(): void {
    if (this.dataSource) {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }
  }

  loadUsers(): void {
    this.isLoading = true;
    this.errorLoadingUsers = null;
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }
    this.usersSubscription = this.userService.getUsers().subscribe({
      next: (users) => {
        this.dataSource.data = users;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching users:', err);
        this.errorLoadingUsers = 'Failed to load users. Please try again later.';
        this.isLoading = false;
        this._snackBar.open(this.errorLoadingUsers, 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
      }
    });
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  openUserForm(user?: User): void {
    const dialogRef = this.dialog.open(UserFormComponent, {
      width: '450px',
      data: user ? { ...user } : {} // Pass a copy for editing, or empty for new
    });

    if (this.dialogSubscription) {
        this.dialogSubscription.unsubscribe();
    }

    this.dialogSubscription = dialogRef.afterClosed().subscribe(result => {
      if (result) { // If the form was submitted (not cancelled)
        if (user && user.id) { // Edit mode
          this.userService.updateUser({ ...user, ...result }).subscribe({ // Merge original user data with form result
            next: () => {
              this.loadUsers();
              this._snackBar.open('User updated successfully!', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
            },
            error: (err) => {
              console.error('Error updating user:', err);
              this._snackBar.open('Failed to update user.', 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
            }
          });
        } else { // Add mode
          this.userService.addUser(result).subscribe({
            next: () => {
              this.loadUsers();
              this._snackBar.open('User added successfully!', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
            },
            error: (err) => {
              console.error('Error adding user:', err);
              this._snackBar.open('Failed to add user.', 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
            }
          });
        }
      }
    });
  }

  deleteUser(userId: number | string): void {
    // Simple confirmation, consider using a MatDialog for a better UX
    if (confirm(`Are you sure you want to delete user with ID: ${userId}?`)) {
      this.userService.deleteUser(userId).subscribe({
        next: () => {
          this.loadUsers(); // Refresh the table
          this._snackBar.open('User deleted successfully!', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
        },
        error: (err) => {
          console.error(`Error deleting user ${userId}:`, err);
          this._snackBar.open('Failed to delete user.', 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
        }
      });
    }
  }

  ngOnDestroy(): void {
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }
    if (this.dialogSubscription) {
        this.dialogSubscription.unsubscribe();
    }
  }
}
