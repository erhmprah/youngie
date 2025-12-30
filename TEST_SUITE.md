# Test Suite Documentation

## Overview
The app includes a comprehensive test suite with 26 tests covering all API endpoints and functionality.

## Running Tests

### How to Access Tests
1. Open the app and navigate to **Profile** tab
2. Scroll down to **Account Settings** section
3. Tap **Run Tests**

### Running All Tests at Once
- Tap the **Run All Tests** button at the top
- The app will run through all 26 tests sequentially
- Results display with pass/fail status and execution details

## Test Categories

### 1. Authentication Tests (3 tests)
Tests verify user login and token validity

| Test | Purpose | Expected Result |
|------|---------|-----------------|
| User logged in | Verify user is authenticated | Shows user ID and username |
| User has valid token | Verify JWT token is valid | Token validates successfully |
| User profile accessible | Verify profile data loads | Profile data retrieved |

**Example Output:**
```
User logged in: jane_doe (507f1f77bcf86cd799439011)
Valid token for user: jane_doe
Profile fetched: jane_doe - Software engineer
```

---

### 2. Posts API Tests (5 tests)
Tests cover post CRUD operations and interactions

| Test | Purpose | Expected Result |
|------|---------|-----------------|
| Fetch all posts | Get all posts from database | Returns array of posts |
| Create new post | Create a test post | Post created with ID |
| Like post | Like a post | Post added to likes array |
| Add comment | Add comment to post | Comment created and indexed |
| Delete post | Create and delete test post | Post removed from database |

**Example Output:**
```
Fetched 15 posts
Created post: 607f2f77bcf86cd799439022
Liked post: 507f1f77bcf86cd799439011
Added comment to post: 507f1f77bcf86cd799439011
Created and deleted post: 607f3f77bcf86cd799439023
```

**API Endpoints Tested:**
- `GET /posts` - Fetch all posts
- `POST /posts/create` - Create post
- `POST /posts/:id/like` - Like post
- `POST /posts/:id/comment` - Add comment
- `DELETE /posts/:id` - Delete post

---

### 3. Users API Tests (4 tests)
Tests cover user profile operations and discovery

| Test | Purpose | Expected Result |
|------|---------|-----------------|
| Get user profile | Fetch user profile | Returns profile with all fields |
| Update user profile | Update bio | Profile updated successfully |
| Search users | Search for users matching query | Returns matching users |
| Send friend request | Send friend request | Request sent to recipient |

**Example Output:**
```
Profile: jane_doe - Age: 25
Updated profile bio
Found 12 users matching 'a'
Sent friend request to: john_smith
```

**API Endpoints Tested:**
- `GET /users/:id` - Get profile
- `PUT /users/:id/update` - Update profile
- `GET /users/search` - Search users
- `POST /users/:id/friend-request` - Send friend request

---

### 4. Chat API Tests (3 tests)
Tests cover messaging functionality

| Test | Purpose | Expected Result |
|------|---------|-----------------|
| Get user chats | Fetch all conversations | Returns chat list |
| Get chat messages | Fetch messages from chat | Returns message history |
| Send message | Send new message | Message added to chat |

**Example Output:**
```
Found 3 chats
Found 42 messages in chat
Sent message to chat: 507f1f77bcf86cd799439011
```

**API Endpoints Tested:**
- `GET /chats/user/:userId` - Get chats
- `GET /chats/:id` - Get messages
- `POST /chats/:id/message` - Send message

---

### 5. Story API Tests (2 tests)
Tests cover story creation and viewing

| Test | Purpose | Expected Result |
|------|---------|-----------------|
| Get stories | Fetch all stories | Returns story groups |
| Create story | Create new story | Story created with ID |

**Example Output:**
```
Found 8 story groups
Created story: 507f1f77bcf86cd799439011
```

**API Endpoints Tested:**
- `GET /stories` - Get stories
- `POST /stories/create` - Create story

---

### 6. Notifications API Tests (2 tests)
Tests cover notification management

| Test | Purpose | Expected Result |
|------|---------|-----------------|
| Get notifications | Fetch all notifications | Returns notification list |
| Mark as read | Mark notification as read | Notification updated |

**Example Output:**
```
Found 5 notifications
Marked notification as read: 507f1f77bcf86cd799439011
```

**API Endpoints Tested:**
- `GET /notifications` - Get notifications
- `PUT /notifications/:id/read` - Mark as read

---

## Test Results Display

### Status Indicators
- ✅ **Passed** (Green) - Test executed successfully
- ❌ **Failed** (Red) - Test encountered an error
- ⏳ **Running** (Orange) - Test is currently executing
- ⚪ **Pending** (Gray) - Test hasn't been run yet

### Test Card Details
Each test card shows:
1. **Status Icon** - Visual indicator of test state
2. **Test Name** - Category and specific test
3. **Expand Arrow** - Tap to see full results
4. **Status Badge** - PASSED/FAILED indicator
5. **Message** - Primary result/error message
6. **Details** - Additional error information if failed

### Statistics Bar
Shows real-time counts:
- **Passed** - Number of successful tests
- **Failed** - Number of failed tests
- **Total** - Total tests run in this session

---

## What Gets Tested

### Authentication Flow
- ✅ User is logged in
- ✅ JWT token is valid
- ✅ User profile is accessible

### Content Creation & Management
- ✅ Creating posts
- ✅ Creating stories
- ✅ Creating comments
- ✅ Deleting posts

### Interactions
- ✅ Liking posts
- ✅ Commenting on posts
- ✅ Sending messages
- ✅ Sending friend requests

### Data Retrieval
- ✅ Fetching posts feed
- ✅ Fetching user profile
- ✅ Searching users
- ✅ Fetching conversations
- ✅ Fetching messages
- ✅ Fetching stories
- ✅ Fetching notifications

### Profile Management
- ✅ Updating user bio
- ✅ Viewing friends list

---

## Understanding Test Results

### Successful Test
```
Status: PASSED
Message: Fetched 15 posts
Details: (shows response data)
```
The API endpoint responded successfully.

### Failed Test
```
Status: FAILED
Message: No posts to like
Details: (shows error response)
```
The test encountered an error. Check the message and details for the cause.

### Common Failure Reasons
1. **Network Error** - Backend is not running (ensure `npm run dev` in backend folder)
2. **Authentication Error** - Token has expired (log out and log back in)
3. **Data Missing** - Test data not available (create data through normal app flow first)
4. **API Error** - Endpoint returned an error (check backend server console)

---

## Debugging Failed Tests

### Step 1: Check Backend Status
```powershell
# Navigate to backend folder
cd backend

# Run the server
npm run dev
```
Expected output: `Server running on port 5001`

### Step 2: Check Network Connection
- Ensure device can reach backend server
- For emulator: Backend runs on `http://10.0.2.2:5001`
- For physical device: Backend runs on your computer's IP (e.g., `http://192.168.x.x:5001`)

### Step 3: Verify User Authentication
- Log out from the app
- Log back in with test credentials
- Re-run the tests

### Step 4: Check API Endpoints
Look at the test message and details section to identify which endpoint failed.

---

## Test Execution Order

Tests are organized by category and executed in this order:
1. Authentication (3 tests)
2. Posts (5 tests)
3. Users (4 tests)
4. Chats (3 tests)
5. Stories (2 tests)
6. Notifications (2 tests)

**Total: 26 Tests**

Each test waits for the previous one to complete before starting.

---

## Notes

- Tests modify real data in the database (creates posts, comments, etc.)
- All test data uses timestamps to identify generated content
- Failed tests don't affect subsequent tests
- Run tests in development environment only
- Always have the backend server running (`npm run dev`)

---

## Feature Coverage

| Feature | Test Coverage |
|---------|---|
| Posts | ✅ 5 tests |
| Messages | ✅ 3 tests |
| Friends | ✅ 2 tests |
| Stories | ✅ 2 tests |
| Notifications | ✅ 2 tests |
| Authentication | ✅ 3 tests |
| User Profiles | ✅ 4 tests |
| **Total** | ✅ **21 tests** |

---

## Performance Notes

- Full test suite takes approximately 10-30 seconds depending on network
- Each test creates/modifies data in database
- Tests are sequential (not parallel) for data consistency
- Failed tests show response details for debugging

---

## Support

For issues with tests:
1. Check that backend is running: `npm run dev`
2. Verify you're logged in as a valid user
3. Check network connectivity to backend
4. Review detailed error message in test results
5. Check backend console for server-side errors

