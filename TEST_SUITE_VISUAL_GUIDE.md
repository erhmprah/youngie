# Test Suite Visual Guide

## Accessing the Test Suite

```
Profile Tab
    ↓
Scroll Down to "Account Settings"
    ↓
Tap "Run Tests" Button (with flask icon)
    ↓
Test Suite Screen Opens
```

## Test Suite Screen Layout

```
┌─────────────────────────────────────┐
│  ← Run Tests               Running   │  Header
├─────────────────────────────────────┤
│  📊 Stats Bar                       │
│  ✅ Passed: 8  ❌ Failed: 2  Total: 10 │
├─────────────────────────────────────┤
│                                     │
│  🎯 [▶️ Run All Tests]             │  Action Button
│                                     │
├─────────────────────────────────────┤
│                                     │
│  ✅ Authentication - User logged in │  Test Card
│  ✅ Posts API - Fetch all posts    │  (Expandable)
│  ❌ Chat API - Send message        │
│                                     │
├─────────────────────────────────────┤
│  Scroll for more tests ↓           │
│                                     │
└─────────────────────────────────────┘
```

## Expanded Test Card

```
┌─────────────────────────────────────┐
│  ✅ Authentication - User logged in │  Collapsed View
└─────────────────────────────────────┘
         (Tap to expand)
                ↓
┌─────────────────────────────────────┐
│  ✅ Authentication - User logged in │
├─────────────────────────────────────┤
│  [✅ PASSED]                         │  Status Badge
│                                     │
│  Message:                           │
│  User logged in: jane_doe           │  Result Message
│  (507f1f77bcf86cd799439011)        │
│                                     │
│  Details:                           │  Additional Info
│  {                                  │
│    "_id": "507f1f77...",           │
│    "username": "jane_doe",         │
│    ...                              │
│  }                                  │
└─────────────────────────────────────┘
```

## Test Status Indicators

```
Status      Icon    Color    Meaning
────────────────────────────────────────
PASSED      ✅      🟢       Test succeeded
FAILED      ❌      🔴       Test failed
RUNNING     ⏳      🟠       Currently executing
PENDING     ⚪      🔵       Not yet run
```

## Running All Tests - Step by Step

### Step 1: Tap "Run All Tests"
```
Profile → Account Settings → Run Tests Button
```

### Step 2: Tests Execute
```
Running...  [∙∙∙ Running Test 1/26]

[⏳ Running] Authentication - User logged in
[⏳ Running] Authentication - User has valid token
[✅ PASSED] Authentication - User profile accessible
...
```

### Step 3: View Results
```
All 26 tests complete

Stats Summary:
✅ Passed: 24
❌ Failed: 2
📊 Total: 26

Tap each test to see details
```

## Common Test Results

### ✅ All Tests Pass
```
┌─────────────────────────────────────┐
│  Test Results                       │
│  Passed: 26  |  Failed: 0  |  26    │
│                                     │
│  All systems operational! 🎉        │
└─────────────────────────────────────┘
```

### ⚠️ Some Tests Fail
```
┌─────────────────────────────────────┐
│  Test Results                       │
│  Passed: 24  |  Failed: 2  |  26    │
│                                     │
│  ❌ Posts API - Create new post    │
│     Error: Network timeout         │
│                                     │
│  ❌ Chat API - Send message        │
│     Error: User not authenticated  │
└─────────────────────────────────────┘
```

## Feature Test Coverage Map

```
App Features                    Tests
──────────────────────────────────────

🔐 Authentication           [✅✅✅] 3 tests
   • User login
   • JWT token validation
   • Profile access

📱 Posts                    [✅✅✅✅✅] 5 tests
   • Create posts
   • View feed
   • Like posts
   • Add comments
   • Delete posts

👥 Users                    [✅✅✅✅] 4 tests
   • Get profile
   • Update profile
   • Search users
   • Friend requests

💬 Chat                     [✅✅✅] 3 tests
   • View conversations
   • Fetch messages
   • Send messages

📖 Stories                  [✅✅] 2 tests
   • View stories
   • Create stories

🔔 Notifications            [✅✅] 2 tests
   • Get notifications
   • Mark as read
```

## Test Execution Timeline

```
Start Run All Tests
        |
        ↓
    [1/26] Authentication - User logged in           ⏳
        |
        ↓
    [1/26] PASSED                                    ✅
    [2/26] Authentication - Valid token              ⏳
        |
        ↓
    [2/26] PASSED                                    ✅
    [3/26] Authentication - Profile accessible      ⏳
        |
        ↓
    [3/26] PASSED                                    ✅
    [4/26] Posts API - Fetch all posts              ⏳
        ...
        (Tests continue sequentially)
        ...
    [26/26] Notifications - Mark as read             ⏳
        |
        ↓
    ✅ Complete - All 26 tests finished
    
    Alert: Passed: 24, Failed: 2, Total: 26
```

## Error Message Interpretation

### Network Error
```
Status: FAILED
Message: Error: connect ECONNREFUSED 127.0.0.1:5001

Meaning: Backend server is not running
Fix: Start backend with 'npm run dev'
```

### Authentication Error
```
Status: FAILED
Message: Error: 401 Unauthorized

Meaning: User token expired or invalid
Fix: Log out and log back in
```

### Data Not Found
```
Status: FAILED
Message: No posts to like

Meaning: Test requires existing data
Fix: Create content through app first
```

## Quick Start for Testing

```
1. Open app → Profile tab
2. Scroll down → "Run Tests"
3. Tap "Run All Tests"
4. Wait for completion (10-30 seconds)
5. Check results:
   - ✅ All green? Perfect!
   - ❌ Any red? Tap to see error details
6. Check backend console if errors occur
```

## Test Data Created

During testing, the app creates:
- ✍️ 2 test posts (with timestamp)
- 💬 1 test comment (with timestamp)
- 📖 1 test story (with timestamp)
- 🤝 1 test friend request (with timestamp)

All test data uses ISO timestamps for identification:
```
Example: "Test post at 2025-12-27T14:30:45.123Z"
```

This allows you to identify which records were created by tests.

## Tips for Using Tests

### ✅ Best Practices
- Run tests with backend server running
- Ensure you're logged in before running
- Use tests to verify features after making changes
- Check detailed output for debugging

### ⚠️ Common Issues
- **Tests won't run?** - Check backend is running
- **Always fail?** - Verify network connection
- **Some fail?** - Check individual test details
- **Slow execution?** - Network delay, retry after

### 🔧 Troubleshooting
If tests fail:
1. Note which test failed
2. Check detailed error message
3. Review backend console
4. Verify network connection
5. Retry with fresh login

## Next Steps

After running tests:
- ✅ **All Pass** → App is working correctly
- ❌ **Some Fail** → Check backend error logs
- 🔧 **Network Issues** → Verify backend URL in `utils/api.ts`
- 🐛 **Debug Mode** → Check browser console (web version)

