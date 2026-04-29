---
description: This document defines the mandatory system rules for authentication, credits, and purchase flow within the project.   All implementations (backend, frontend, and prompt logic) must strictly follow these rules.
---

👤 Guest Sign-In
Always show Guest Sign-In button
Do NOT hide Guest Sign-In button
Do NOT ask guest user for name
Auto-generate guest identity as guest_(device_id)@user
Check if guest user already exists
Do NOT create new account if guest already exists
🎁 Guest Credits
Add 3 credits for new guest user
Do NOT add credits again for existing guest
Store credits in guest account
Persist credits across sessions
Do NOT reset credits on re-login
Do NOT show popup for existing guest
Show popup only for new guest
💳 Guest → Get Credit
Show "Get Credit" button on dashboard
Allow guest to click "Get Credit"
Redirect guest to Sign-In page
Do NOT give extra credits without signup
📧 Signup
Require email input
Send OTP to registered email
Verify OTP before login
Do NOT allow access without OTP verification
Add 5 credits after successful signup
Show signup bonus popup
Do NOT add signup credits more than once
🔐 Login
Redirect user to dashboard after login
Do NOT show any popup on login
Preserve existing credits
Do NOT modify credit balance on login
💰 Purchase
Start 5-minute timer on purchase initiation
Show processing state
Wait for App Store / Play Store response
Do NOT assume purchase success
Do NOT fail purchase before response
📡 Purchase Success
Add purchased credits
Send notification only to current user session
Update UI instantly
❌ Purchase Failed
Show "Your purchase has failed" message
Do NOT add credits
⏳ Purchase Pending
Show ongoing transaction message
Do NOT add credits
Wait for final confirmation
🔒 Global Rules
Do NOT hide Guest Sign-In button
Do NOT reset guest credits
Do NOT show popup on login
Do NOT send notifications to other users
Do NOT auto-confirm purchase without store response
Do NOT create duplicate guest accounts
✅ Must Follow
Persist credits per user
Maintain session-based notifications
Follow exact flow sequence
Keep behavior consistent across sessions
