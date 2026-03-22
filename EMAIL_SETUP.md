# VoteKro Email Service Setup Guide

## Overview
The VoteKro application now sends email credentials to voters and auditors after they are registered by an admin.

## What Changed?

1. **New Email Service** (`class/email-service.ts`)
   - Integrates with Supabase Edge Functions to send emails
   - Sends voter and auditor registration credentials via email
   - Professional HTML and plain text email templates

2. **Supabase Edge Function** (`supabase/functions/send-email/index.ts`)
   - Server-side function that handles email sending
   - Uses Resend API for reliable email delivery
   - Runs securely on Supabase infrastructure

3. **Updated Admin Service** (`class/admin-class.ts`)
   - Automatically sends credentials after voter/auditor registration
   - Gracefully handles email failures (registration succeeds even if email fails)

## Setup Instructions

### Step 1: Create a Resend Account
1. Go to https://resend.com
2. Sign up for a free account
3. Get your API key from the Resend dashboard

### Step 2: Configure Supabase Edge Function
1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** (under Functions in the left sidebar)
3. Create a new edge function or deploy using CLI:
   ```bash
   supabase functions deploy send-email
   ```
4. In the function settings, add the environment variable:
   - Name: `RESEND_API_KEY`
   - Value: Your Resend API key from Step 1

### Step 3: Enable Email from Verified Domain (Optional but Recommended)
For production:
1. Set up a custom domain at Resend
2. Add the verified domain in your edge function
3. Update the email sender in `email-service.ts` from `noreply@votekro.app` to your verified domain

### Step 4: Test the Email Feature

To test locally:
1. Register a voter from the Admin Dashboard
2. The system will display the credentials in a modal
3. The voter should receive an email shortly with their login credentials

## Email Flow

```
Admin registers voter
       ↓
Voter account created in Supabase Auth
       ↓
Voter profile stored in database
       ↓
Email service sends credentials via Supabase Edge Function
       ↓
Resend delivers email to voter's inbox
```

## Troubleshooting

### Emails not sending?

1. **Check function logs in Supabase Dashboard**
   - Go to Edge Functions → send-email → Logs
   - Look for error messages

2. **Verify API key**
   - Ensure `RESEND_API_KEY` is correctly set in Supabase
   - Test the key at https://resend.com/api-keys

3. **Check email domain**
   - Make sure your Resend account has a verified domain
   - Free tier uses `resend.dev` domain

4. **Common errors:**
   - "Email service not configured" → `RESEND_API_KEY` not set in Supabase
   - "Failed to send email" → Check API key validity or Resend account limits

## Email Templates

### Voter Registration Email
- Contains voter email and password
- Reminds them to verify email before logging in
- Professional branding with VoteKro logo

### Auditor Registration Email
- Similar to voter email but with auditor-specific messaging
- Sent to auditor's email address

## Security Notes

⚠️ **Important**: 
- Credentials are sent via email immediately after registration
- Emails are sent asynchronously (registration doesn't wait for email confirmation)
- If email sending fails, the registration succeeds anyway (email failure is non-critical)
- Make sure your Resend account is secure and API keys are protected

## Future Enhancements

- [ ] Email verification tokens
- [ ] Password reset via email
- [ ] Election notifications to voters
- [ ] Audit log delivery emails
