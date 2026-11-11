# ClassSphere — Doubt Discussion API

## Base URL
`http://localhost:5000/api/discussions`

All endpoints require authentication. The browser sends the HttpOnly access cookie automatically; configure Axios with `withCredentials: true`. Do not send a Bearer token header.

## 1. Create Doubt

**POST** `/classrooms/:classroomId/doubts`

Request body:
```json
{
  "title": "Confusion in AVL tree rotations",
  "description": "Can someone explain LL and LR rotations?"
}
```

Response fields:
- `success`
- `data._id`
- `data.classroom`
- `data.student`
- `data.title`
- `data.description`
- `data.status` — `open` or `resolved`
- `data.replies`
- `data.createdAt`
- `data.updatedAt`

## 2. Get Classroom Doubts

**GET** `/classrooms/:classroomId/doubts`

Optional query parameters:
- `status=open` or `status=resolved`
- `page=1`
- `limit=20`

Example:
`/classrooms/CLASSROOM_ID/doubts?status=open&page=1&limit=20`

Response schema:
```json
{
  "success": true,
  "data": [
    {
      "_id": "DOUBT_ID",
      "classroom": "CLASSROOM_ID",
      "student": {
        "_id": "STUDENT_ID",
        "name": "Student Name",
        "email": "student@example.com"
      },
      "title": "Confusion in AVL tree rotations",
      "description": "Can someone explain LL and LR rotations?",
      "status": "open",
      "replies": [
        {
          "_id": "REPLY_ID",
          "author": {
            "_id": "USER_ID",
            "name": "User Name",
            "role": "student"
          },
          "message": "Explanation goes here",
          "createdAt": "DATE",
          "updatedAt": "DATE"
        }
      ],
      "createdAt": "DATE",
      "updatedAt": "DATE"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

## 3. Reply to Doubt

**POST** `/doubts/:doubtId/replies`

Request body:
```json
{
  "message": "LL rotation is used when the imbalance is in the left subtree of the left child."
}
```

Response: `{ "success": true, "data": { ...doubt } }`

Replies cannot be added to resolved doubts.

## 4. Update Doubt Status

**PATCH** `/doubts/:doubtId/status`

Request body to resolve:
```json
{
  "status": "resolved"
}
```

Request body to reopen:
```json
{
  "status": "open"
}
```

Response: `{ "success": true, "data": { ...doubt } }`

## Doubt Schema

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Doubt ID |
| `classroom` | ObjectId | Classroom ID |
| `student` | ObjectId | Author/student ID |
| `title` | String | Doubt title, max 150 characters |
| `description` | String | Doubt details, max 5000 characters |
| `status` | String | `open` or `resolved` |
| `replies` | Array | Replies to the doubt |
| `replies[].author` | ObjectId | Reply author's user ID |
| `replies[].message` | String | Reply text, max 3000 characters |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

## Notes
- Use the classroom ID from the existing classroom data.
- Use the returned doubt `_id` for replies and status updates.
- Display `status` as an Open/Resolved badge.
- Handle loading, empty states, and API errors.
- Only classroom members can access classroom doubts.
- Students can create doubts. Teachers and classroom members can reply while a doubt is open.
- Teachers can resolve/reopen classroom doubts; students can update their own doubts.
