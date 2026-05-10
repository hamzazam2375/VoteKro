# Face Detection-Based Voter Registration & Login Implementation Guide

## Overview

This implementation adds biometric face detection capabilities to the VoteKro voting system:

- **Voter Registration**: Admin captures voter's face before requesting email authorization
- **Voter Login**: Face verification required after email/password authentication
- **Security**: Face images stored securely with hashing and one-to-one verification

## Architecture

### New Files Created

1. **`class/face-detection.ts`**
   - Main face detection service using TensorFlow.js & BlazeFace model
   - Face validation (one face, good quality)
   - Face comparison for login verification
   - Canvas/image processing utilities

2. **`class/face-repository.ts`**
   - Supabase database operations for face images
   - Store, retrieve, and verify voter face data
   - Primary face management (one face per voter)

3. **`components/face-capture.tsx`**
   - Real-time camera component using expo-camera
   - Live face detection visualization
   - Bounding box drawing around detected faces
   - Capture button (only enabled when single face detected)

4. **`components/face-verification.tsx`**
   - Face verification UI for login flow
   - Displays instructions and status messages
   - Attempt counter (max 3 attempts)
   - Success/failure handling

5. **`database/voter-face-verification.sql`**
   - New `voter_faces` table for storing face images
   - Columns: voter_id, face_image_base64, is_primary, metadata
   - Row-Level Security (RLS) policies
   - Trigger for updated_at timestamp management

### Modified Files

1. **`app/VoterSignup.tsx`** (Admin Voter Registration Panel)
   - Added face capture step before name/email input
   - Shows captured face preview
   - Allows retaking photo
   - Form inputs enabled only after face capture
   - Sends face data along with registration email

2. **`app/VoterLogin.tsx`** (Voter Login)
   - Added state for login step tracking ('login' vs 'face-verification')
   - After password authentication, checks if face is registered
   - If yes, shows face capture for verification
   - Proceeds to dashboard only after successful face verification

3. **`class/admin-class.ts`**
   - New method: `initiateVoterRegistrationWithFace()`
   - Handles voter registration with face data

4. **`class/email-service.ts`**
   - New method: `initiateVoterRegistrationWithFace()`
   - Passes face data to Supabase edge function

5. **`package.json`**
   - Added dependencies:
     - `@tensorflow/tfjs` - Neural network framework
     - `@tensorflow-models/coco-ssd` - Object detection
     - `@tensorflow-models/face-detection` - Face detection model
     - `@tensorflow-models/blazeface` - Fast face detection
     - `expo-camera` - Camera access on mobile/web
     - `@react-native-camera-roll/camera-roll` - Save photos

## Registration Flow

```
1. Admin opens Register Voter panel
   ↓
2. Admin clicks "Start Face Capture"
   ↓
3. Camera opens → Admin positions voter's face in frame
   ↓
4. Face detection validates:
   - Exactly one face detected ✓
   - Face is not too small ✓
   - Face has good visibility ✓
   ↓
5. Admin clicks "Capture Face"
   ↓
6. Face image captured and displayed
   ↓
7. Admin can "Retake Photo" or proceed
   ↓
8. Admin enters Voter Full Name
   ↓
9. Admin enters Voter Gmail
   ↓
10. Admin clicks "Send Authorization Email"
    ↓
11. Face image + Name + Email stored in database
    ↓
12. Authorization email sent to voter
    ↓
13. Voter clicks email link to complete registration
    ↓
14. Account created with face data linked
```

## Login Flow

```
1. Voter enters Email and Password on login screen
   ↓
2. Admin authenticates credentials
   ↓
3. System checks if voter has registered face
   ↓
4A. If NO face registered:
    - Skip to voter dashboard
   ↓
4B. If YES face registered:
    - Load stored face image
    - Switch to face verification screen
    ↓
5. Face verification screen opens camera
   ↓
6. Voter positions face in frame
   ↓
7. Face detection validates:
   - Exactly one face detected ✓
   - Same person as registered ✓ (based on position/size)
   ↓
8A. Face matches (similarity > 0.75):
    - Show success message
    - Proceed to voter dashboard
   ↓
8B. Face doesn't match:
    - Show mismatch message
    - Allow retry (max 3 attempts)
    - If max attempts exceeded, return to login
```

## Face Validation Rules

### Registration Face Capture

- **Exactly 1 face detected** - Multiple or zero faces rejected
- **Minimum face size** - 50x50 pixels minimum
- **Good visibility** - Face must be clearly visible in frame
- **Bounding box** - Shows frame to guide positioning

### Login Face Verification

- **Single face detection** - Must detect exactly 1 face
- **Similarity threshold** - 0.75 (75% match)
- **Comparison metrics**:
  - Position difference (X, Y coordinates)
  - Size difference (width, height)
  - Keypoint matching
- **Attempt limit** - 3 attempts before lockout

## Error Handling

### Capture Phase

- ❌ "No face detected" - Ask voter to move closer
- ❌ "Multiple faces detected" - Only one person allowed
- ❌ "Face is too small" - Move closer to camera
- ❌ "Camera permission denied" - Grant permission in settings

### Verification Phase

- ❌ "Face does not match" - Different person detected
- ❌ "Verification error" - Technical issue, retry
- ❌ "Maximum attempts exceeded" - Return to email/password login

## Security Considerations

1. **Face Images Storage**
   - Base64 encoded in database
   - Could be encrypted at rest (consider adding field-level encryption)
   - RLS policies prevent unauthorized access

2. **Biometric Privacy**
   - One-to-one verification (no third-party services)
   - Images stored locally in Supabase
   - GDPR compliant (user can delete face data)

3. **Fallback Authentication**
   - If face verification fails repeatedly, user can retry email/password
   - No permanent lockout

4. **Comparison Algorithm**
   - Current: Position & size-based (simple)
   - Recommendation: Upgrade to face embedding comparison (face-api.js)
   - Consider: Cloud-based face recognition (AWS Rekognition, etc.)

## Database Schema

### voter_faces Table

```sql
CREATE TABLE voter_faces (
  id UUID PRIMARY KEY,
  voter_id UUID REFERENCES profiles(user_id),
  face_image_base64 TEXT,           -- Base64 encoded JPEG
  captured_at TIMESTAMPTZ,
  is_primary BOOLEAN DEFAULT true,  -- Only one primary per voter
  metadata JSONB,                   -- { numFaces, confidence, etc }
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Modified profiles Table

```sql
ALTER TABLE profiles ADD COLUMN face_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN face_capture_attempted BOOLEAN DEFAULT false;
```

## API Endpoints (if using external service)

Optional: Integrate with:

- **AWS Rekognition** - `compare_faces()` API
- **Google Cloud Vision** - Face detection API
- **Azure Face API** - Face comparison

## Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Database Migrations

```bash
# In Supabase SQL Editor, run:
-- database/voter-face-verification.sql
```

### 3. Update Supabase Edge Functions

If storing face data on cloud storage:

```bash
supabase functions deploy store-voter-face
```

### 4. Update Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=your_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
```

### 5. Start Application

```bash
npm start
```

## Testing Checklist

- [ ] Admin can capture voter face in registration
- [ ] Face with multiple people is rejected
- [ ] Face that's too small is rejected
- [ ] Captured face is stored in database
- [ ] Face appears in preview after capture
- [ ] Admin can retake face photo
- [ ] Email sent after registration
- [ ] Voter can login with email/password
- [ ] Voter must capture face after password auth
- [ ] Matching face allows dashboard access
- [ ] Non-matching face shows error
- [ ] Max 3 attempts before lockout
- [ ] Can retry from email/password login

## Performance Optimization

1. **Model Loading**
   - BlazeFace loads on first use (~2-5MB)
   - Consider pre-loading on app startup

2. **Image Size**
   - Compress to 512x512 before storing
   - Reduces database size

3. **Face Detection**
   - Real-time: ~500ms on mobile
   - Optimized: Use GPU acceleration if available

## Future Enhancements

1. **Face Embeddings**
   - Replace position-based matching with face descriptors
   - Use `face-api.js` for better accuracy

2. **Liveness Detection**
   - Detect 3D face vs. photo
   - Request head movements (nod, blink)

3. **Multi-Device Sync**
   - Allow multiple registered faces
   - Support different angles/lighting

4. **Admin Dashboard**
   - View registered voters' faces
   - Manage/revoke face registrations

5. **Audit Trail**
   - Log face verification attempts
   - Track failed login attempts

## Troubleshooting

### Face not detected

- Ensure adequate lighting
- Move closer to camera
- Clear any obstructions

### Permission denied

- Grant camera permissions in app settings
- Restart application

### Slow performance

- Close other apps
- Clear browser cache
- Check internet connection

### Face data not saving

- Check Supabase connection
- Verify RLS policies
- Check database storage quota

## Support

For issues or questions, refer to:

- TensorFlow.js docs: https://www.tensorflow.org/js
- Expo Camera: https://docs.expo.dev/cameras/camera/
- Supabase: https://supabase.com/docs
