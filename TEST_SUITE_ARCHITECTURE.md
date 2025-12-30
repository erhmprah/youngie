# Test Suite Architecture & Flow Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUNGIE APP                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Main App Flow                          │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                          │   │
│  │  Login/Signup  → Feed → Profile → Settings             │   │
│  │                 Posts                                    │   │
│  │                 Chat                                     │   │
│  │                 Explore                                  │   │
│  │                 Swipe                                    │   │
│  │                 Stories                                  │   │
│  │                 Notifications                            │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ↓                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Profile Screen                              │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  • User Info                                            │   │
│  │  • Posts                                                │   │
│  │  • Friends                                              │   │
│  │  • Account Settings                                     │   │
│  │    └─ Run Tests (NEW) ─────────┐                       │   │
│  └──────────────────────────────────┼──────────────────────┘   │
│                                     ↓                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         🧪 TEST SUITE SCREEN (NEW)                       │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                          │   │
│  │  • Test Runner                                          │   │
│  │  • Real-time Results                                    │   │
│  │  • Statistics Display                                   │   │
│  │  • Error Details                                        │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ↓                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          API Calls to Backend                           │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  /posts           /users        /chats                  │   │
│  │  /stories         /notifications                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ↓                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Database (MongoDB)                              │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  Collections: Posts, Users, Chats, Stories, etc.       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Test Execution Flow

```
START
  ↓
┌─────────────────────────────┐
│ User: Profile → Run Tests   │
└─────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Test Screen Opens                       │
│ • No tests run yet                      │
│ • Empty state displayed                 │
│ • "Run All Tests" button ready          │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ User taps "Run All Tests"               │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ setIsRunning(true)                      │
│ Button disabled during execution        │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────┐
│ FOR EACH TEST SUITE (6 suites)                     │
│ ├─ Authentication (3 tests)                        │
│ ├─ Posts (5 tests)                                 │
│ ├─ Users (4 tests)                                 │
│ ├─ Chat (3 tests)                                  │
│ ├─ Stories (2 tests)                               │
│ └─ Notifications (2 tests)                         │
└─────────────────────────────────────────────────────┘
  ↓
[FIRST TEST - Authentication: User logged in]
  ↓
┌─────────────────────────────┐
│ Test Status: RUNNING        │
│ Icon: ⏳                     │
│ Test card shown             │
│ Statistics updating         │
└─────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Execute: testUserLoggedIn()             │
│   if (!user?._id) throw Error           │
│   return success message                │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────┐
│ Test Complete: PASSED ✅    │
│ Status: ✅                  │
│ Message: User logged in     │
│ Statistics: Passed: 1       │
└─────────────────────────────┘
  ↓
[NEXT TEST - Authentication: Valid token]
  ↓
  ... (repeat for all 26 tests) ...
  ↓
[LAST TEST - Notifications: Mark as read]
  ↓
┌─────────────────────────────────────────┐
│ All 26 Tests Complete                   │
│ setIsRunning(false)                     │
│ Button re-enabled                       │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Alert Shows:                            │
│ "Test Results"                          │
│ Passed: 24                              │
│ Failed: 2                               │
│ Total: 26                               │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ User Reviews Results                    │
│ • Tap tests to expand details           │
│ • See error messages if failed          │
│ • Check statistics                      │
│ • See API response data                 │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ User can:                               │
│ • Tap back to return to Profile         │
│ • Run tests again                       │
│ • Review individual test details        │
└─────────────────────────────────────────┘
  ↓
END
```

## Test Individual Execution

```
Test Input
   ↓
┌──────────────────────────────┐
│ Create TestResult object     │
│ {                            │
│   name: "Test Name"         │
│   status: "running"         │
│   message: ""               │
│ }                            │
└──────────────────────────────┘
   ↓
┌──────────────────────────────┐
│ Update UI with RUNNING       │
│ Show ⏳ icon                 │
│ Display test card            │
└──────────────────────────────┘
   ↓
┌──────────────────────────────┐
│ TRY:                         │
│   Execute Test Function      │
└──────────────────────────────┘
   ↓
   ├──── SUCCESS ────┐
   │                 │
   ↓                 ↓
┌──────────┐   ┌──────────────┐
│ CATCH    │   │ Capture:     │
│ ERROR    │   │ • Result msg │
└──────────┘   │ • Response   │
   ↓           └──────────────┘
   │                 ↓
   └─────────────────┤
                     ↓
          ┌──────────────────────┐
          │ Set Test Result:     │
          │ status: "passed"     │
          │ message: "Success"   │
          └──────────────────────┘
                     ↓
          ┌──────────────────────┐
          │ ON ERROR:            │
          │ status: "failed"     │
          │ message: "Error msg" │
          │ details: "Full err"  │
          └──────────────────────┘
                     ↓
          ┌──────────────────────┐
          │ Update UI:           │
          │ Show ✅ or ❌       │
          │ Update stats         │
          │ Render card          │
          └──────────────────────┘
                     ↓
                Test Output
```

## Component Hierarchy

```
TestingScreen
├── SafeAreaView
│   └── ThemedView (dark bg)
│       ├── Header
│       │   ├── Back Button
│       │   ├── Title
│       │   └── Placeholder
│       │
│       ├── Stats Bar
│       │   ├── Passed Count
│       │   ├── Failed Count
│       │   └── Total Count
│       │
│       ├── Run All Tests Button
│       │   ├── Loading Indicator (if running)
│       │   └── Button Text
│       │
│       └── ScrollView (Tests List)
│           ├── Empty State (if no tests)
│           │   ├── Flask Icon
│           │   ├── "No tests run yet"
│           │   └── "Tap Run All Tests"
│           │
│           └── FlatList (Test Cards)
│               └── TestCard (repeating)
│                   ├── TestHeader
│                   │   ├── Status Icon
│                   │   ├── Test Name
│                   │   └── Expand Arrow
│                   │
│                   └── TestDetails (if expanded)
│                       ├── Status Badge
│                       ├── Message Box
│                       └── Details Box
```

## Data Flow Diagram

```
                     ┌──────────────────┐
                     │  Test Suite Page │
                     └────────┬─────────┘
                              │
                              ↓
                     ┌──────────────────┐
                     │  Test Execution  │
                     │   1. Setup       │
                     │   2. API Call    │
                     │   3. Validate    │
                     │   4. Return      │
                     └────────┬─────────┘
                              │
                  ┌───────────┴───────────┐
                  ↓                       ↓
            ┌──────────┐          ┌──────────────┐
            │ SUCCESS  │          │ ERROR        │
            │ Message  │          │ Error Msg    │
            │ Data     │          │ Details      │
            └────┬─────┘          └──────┬───────┘
                 │                      │
                 │  ┌──────────────────┐│
                 │  │ Capture Result   ││
                 │  │ {                ││
                 │  │   status: "..."  ││
                 │  │   message: "..." ││
                 │  │   details: "..." ││
                 │  │ }                ││
                 │  └────────┬─────────┘│
                 └─────────────┼────────┘
                              │
                              ↓
                     ┌──────────────────┐
                     │ Update State     │
                     │ tests: [...]     │
                     └────────┬─────────┘
                              │
                              ↓
                     ┌──────────────────┐
                     │ Render UI        │
                     │ • Show status    │
                     │ • Display msg    │
                     │ • Update stats   │
                     └──────────────────┘
```

## Test Categories Hierarchy

```
Test Suite (26 Tests)
│
├── Authentication (3)
│   ├── testUserLoggedIn()
│   ├── testValidToken()
│   └── testUserProfile()
│
├── Posts API (5)
│   ├── testFetchPosts()
│   ├── testCreatePost()
│   ├── testLikePost()
│   ├── testAddComment()
│   └── testDeletePost()
│
├── Users API (4)
│   ├── testGetUserProfile()
│   ├── testUpdateProfile()
│   ├── testSearchUsers()
│   └── testFriendRequest()
│
├── Chat API (3)
│   ├── testGetChats()
│   ├── testGetChatMessages()
│   └── testSendMessage()
│
├── Story API (2)
│   ├── testGetStories()
│   └── testCreateStory()
│
└── Notifications API (2)
    ├── testGetNotifications()
    └── testMarkAsRead()
```

## API Endpoint Coverage

```
Test Coverage by API Route:

┌─────────────────────────────────────────────────┐
│                  POSTS API                      │
├─────────────────────────────────────────────────┤
│ GET    /posts                 ✅ testFetchPosts │
│ POST   /posts/create          ✅ testCreatePost │
│ POST   /posts/:id/like        ✅ testLikePost   │
│ POST   /posts/:id/comment     ✅ testAddComment │
│ DELETE /posts/:id             ✅ testDeletePost │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                  USERS API                      │
├─────────────────────────────────────────────────┤
│ GET    /users/:id             ✅ testGetProfile │
│ PUT    /users/:id/update      ✅ testUpdateProf │
│ GET    /users/search          ✅ testSearchUsers│
│ POST   /users/:id/friend-req  ✅ testFriendReq │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                  CHAT API                       │
├─────────────────────────────────────────────────┤
│ GET    /chats/user/:userId    ✅ testGetChats  │
│ GET    /chats/:id             ✅ testGetChatMsg │
│ POST   /chats/:id/message     ✅ testSendMsg   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                  STORY API                      │
├─────────────────────────────────────────────────┤
│ GET    /stories               ✅ testGetStories │
│ POST   /stories/create        ✅ testCreateStry │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│               NOTIFICATION API                  │
├─────────────────────────────────────────────────┤
│ GET    /notifications         ✅ testGetNotifs  │
│ PUT    /notifications/:id/read✅ testMarkAsRead│
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              AUTHENTICATION                     │
├─────────────────────────────────────────────────┤
│ Check User ID                 ✅ testUserLoggedIn
│ Check JWT Token               ✅ testValidToken  │
│ Check Profile Access          ✅ testUserProfile │
└─────────────────────────────────────────────────┘
```

## State Management During Test

```
Initial State
  tests: []
  isRunning: false
  expandedTest: null

         ↓

User taps "Run All Tests"
  tests: [] (building array)
  isRunning: true
  expandedTest: null

         ↓

First test starts
  tests: [
    { name: "Test 1", status: "running" }
  ]
  isRunning: true

         ↓

First test completes
  tests: [
    { name: "Test 1", status: "passed", message: "..." }
  ]
  isRunning: true

         ↓

Second test completes
  tests: [
    { name: "Test 1", status: "passed", message: "..." },
    { name: "Test 2", status: "failed", message: "..." }
  ]
  isRunning: true

         ↓

All tests complete
  tests: [
    ... (26 items)
  ]
  isRunning: false
  expandedTest: null

         ↓

User taps a test
  tests: [...] (unchanged)
  isRunning: false
  expandedTest: "Test name" (expanded)

         ↓

User taps test again
  tests: [...] (unchanged)
  isRunning: false
  expandedTest: null (collapsed)
```

## Error Handling Flow

```
Test Execution
  │
  ├─ TRY
  │  └─ Execute test function
  │     └─ Call API endpoint
  │        └─ Get response
  │
  ├─ CATCH Error
  │  │
  │  ├─ Network Error
  │  │  └─ ECONNREFUSED
  │  │  └─ No backend running
  │  │
  │  ├─ Auth Error
  │  │  └─ 401 Unauthorized
  │  │  └─ Token expired
  │  │
  │  ├─ Data Error
  │  │  └─ No data found
  │  │  └─ Invalid format
  │  │
  │  ├─ API Error
  │  │  └─ 5xx Server error
  │  │  └─ Invalid endpoint
  │  │
  │  └─ Capture
  │     ├─ error.message
  │     ├─ error.response.data
  │     └─ error.toString()
  │
  └─ FINALLY
     └─ Update UI with result
        ├─ Set status: "passed" or "failed"
        ├─ Set message: error description
        ├─ Set details: full error data
        └─ Render result card
```

## Performance Timeline

```
Test Execution Time Breakdown:

[Run All Tests Button] → Start
       ↓
   [0.0s] TestingScreen initializes
   [0.1s] First test starts (Auth - User logged in)
   [0.5s] First test completes → Display result ✅
   [0.6s] Second test starts (Auth - Valid token)
   [1.1s] Second test completes → Display result ✅
   [1.2s] Third test starts (Auth - Profile)
   [2.0s] Third test completes → Display result ✅
   [2.1s] Fourth test starts (Posts - Fetch)
   [2.8s] Fourth test completes → Display result ✅
   ...
   [10-30s] All 26 tests complete
   [30.1s] Alert displays: "Passed: 24, Failed: 2, Total: 26"
       ↓
   END

Network latency heavily impacts execution time.
Local network: Faster
Emulator: May be slower
Physical device: Depends on WiFi
```

## Success vs Failure Scenarios

```
SUCCESS PATH
─────────────
Test starts ⏳
   │
   ├─ API call succeeds
   │
   ├─ Response validated
   │
   └─ Result: PASSED ✅
      ├─ Status: "passed"
      ├─ Message: Success text
      ├─ Details: Response data
      └─ UI: Green card with ✅


FAILURE PATH
─────────────
Test starts ⏳
   │
   ├─ API call fails OR
   │
   ├─ Validation fails
   │
   └─ Result: FAILED ❌
      ├─ Status: "failed"
      ├─ Message: Error message
      ├─ Details: Error response
      └─ UI: Red card with ❌
```

