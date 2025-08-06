import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { UserWhitelist as User } from './user-whitelist.model'; // Adjust path if you placed it elsewhere
import { environment } from '../../../environments/environment'; // To get backendURL

@Injectable({
  providedIn: 'root' // Or provide it specifically in AdminModule if preferred
})
export class UserService {
  private usersApiUrl = `${environment.backendURL}/users`;

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
    })
  };

  constructor(private http: HttpClient) { }

  // GET: Fetch all users
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.usersApiUrl, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  // GET: Fetch a single user by ID
  getUser(id: number | string): Observable<User> {
    const url = `${this.usersApiUrl}/${id}`;
    return this.http.get<User>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  // POST: Add a new user
  addUser(user: User): Observable<User> {
    return this.http.post<User>(this.usersApiUrl, user, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  // PUT: Update an existing user
  updateUser(user: User): Observable<any> { // FastAPI might return the updated user or just a success status
    const url = `${this.usersApiUrl}/${user.id}`;
    return this.http.put(url, user, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  // DELETE: Delete a user
  deleteUser(id: number | string): Observable<User> { // Or Observable<{}> if backend returns empty on delete
    const url = `${this.usersApiUrl}/${id}`;
    return this.http.delete<User>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Basic error handling
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof HttpErrorResponse) {
      // A client-side or network error occurred. Handle it accordingly.
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error && typeof error.error === 'object' && error.error.detail) {
        errorMessage += `\nDetails: ${error.error.detail}`;
      } else if (error.error) {
         errorMessage += `\nBackend Error: ${JSON.stringify(error.error)}`;
      }
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
