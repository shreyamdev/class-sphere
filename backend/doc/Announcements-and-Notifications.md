# Announcements & In-App Notifications APIs

Base URL: `http://localhost:5000`. Protected endpoints use the HttpOnly access cookie set at login. Configure Axios with `withCredentials: true`; do not send Bearer tokens.

## 1. Create announcement

**POST** `/api/classrooms/CLASSROOM_ID/announcements` — owning teacher only.

Request:
```json
{
  "title": "Tomorrow's Assignment",
  "content": "Please submit your assignment by 5 PM tomorrow."
}
```
Title and content are required non-empty strings. The model limits title to 150 characters and content to 5000 characters.

Success `201`:
```json
{
  "success": true,
  "message": "Announcement created successfully",
  "data": {
    "_id": "671234567890abcdef123456",
    "title": "Tomorrow's Assignment",
    "content": "Please submit your assignment by 5 PM tomorrow.",
    "classroom": "671234567890abcdef123457",
    "teacher": "671234567890abcdef123458",
    "createdAt": "2026-10-22T10:00:00.000Z",
    "updatedAt": "2026-10-22T10:00:00.000Z"
  }
}
```
The backend creates an in-app notification for each currently enrolled student.

## 2. List classroom announcements

**GET** `/api/classrooms/CLASSROOM_ID/announcements` — classroom owner or enrolled student.

Response `200`:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "671234567890abcdef123456",
      "title": "Tomorrow's Assignment",
      "content": "Please submit your assignment by 5 PM tomorrow.",
      "classroom": "671234567890abcdef123457",
      "teacher": { "_id": "671234567890abcdef123458", "name": "Teacher Name" },
      "createdAt": "2026-10-22T10:00:00.000Z"
    }
  ]
}
```

## 3. Update announcement

**PATCH** `/api/announcements/ANNOUNCEMENT_ID` — teacher who created it.

Request (one or both fields):
```json
{
  "title": "Updated Assignment Notice",
  "content": "Submit your assignment by 6 PM tomorrow."
}
```
Success `200`:
```json
{
  "success": true,
  "message": "Announcement updated successfully",
  "data": {
    "_id": "671234567890abcdef123456",
    "title": "Updated Assignment Notice",
    "content": "Submit your assignment by 6 PM tomorrow.",
    "classroom": "671234567890abcdef123457",
    "teacher": "671234567890abcdef123458"
  }
}
```

## 4. Delete announcement

**DELETE** `/api/announcements/ANNOUNCEMENT_ID` — teacher who created it. No body.

Success `200`:
```json
{
  "success": true,
  "message": "Announcement and related notifications deleted successfully"
}
```

## 5. Get my notifications

**GET** `/api/notifications` — current authenticated user's notifications only.

The route mount in `src/app.js` must be:
```js
app.use("/api/notifications", notificationRoutes);
```
The notification router itself defines `GET /` and `PATCH /:id/read`; mounting it at `/api` would incorrectly make the GET path `/api` rather than `/api/notifications`.

Response `200`:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "671234567890abcdef123459",
      "recipient": "671234567890abcdef123460",
      "classroom": { "_id": "671234567890abcdef123457", "name": "Data Structures", "classCode": "A7C91F" },
      "announcement": "671234567890abcdef123456",
      "title": "New classroom announcement",
      "message": "Tomorrow's Assignment",
      "isRead": false,
      "createdAt": "2026-10-22T10:00:00.000Z"
    }
  ]
}
```

## 6. Mark notification as read

**PATCH** `/api/notifications/NOTIFICATION_ID/read` — recipient only. No body.

Success `200`:
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "_id": "671234567890abcdef123459",
    "recipient": "671234567890abcdef123460",
    "isRead": true
  }
}
```
A notification belonging to another user is not returned; endpoint responds `404`.

## Notification schema

`recipient` (User ObjectId), `classroom` (Classroom ObjectId), `announcement` (Announcement ObjectId), `title` (max 150), `message` (max 300), `isRead` (boolean default false), timestamps.
