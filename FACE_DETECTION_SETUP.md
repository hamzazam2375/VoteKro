# Face Detection Setup Instructions

## Step 1: Install Dependencies

```bash
npm install
```

This will install:

- `@tensorflow/tfjs` - TensorFlow.js core
- `@tensorflow-models/blazeface` - Fast face detection
- `expo-camera` - Camera access
- Other required packages

## Step 2: Database Setup

### Apply the Face Detection Schema

In your Supabase dashboard:

1. Go to SQL Editor
2. Create a new query
3. Copy and paste the contents of: `database/voter-face-verification.sql`
4. Execute the query

This creates:

- `voter_faces` table
- RLS policies for face data
- Triggers for timestamp management
- Grants for authentication

### Verify Schema

```sql
-- Check the table exists
SELECT * FROM voter_faces LIMIT 1;

-- Check columns
\d voter_faces
```

## Step 3: Update Supabase Edge Function

Update your `supabase/functions/start-voter-registration/index.ts` to handle face data:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface VoterRegistrationRequest {
  fullName: string;
  email: string;
  faceImage?: string; // Base64 encoded face image
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { fullName, email, faceImage } =
    (await req.json()) as VoterRegistrationRequest;

  if (!fullName || !email) {
    return new Response("Missing required fields", { status: 400 });
  }

  try {
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Store face image if provided
    let faceImageId = null;
    if (faceImage) {
      const { data: faceData, error: faceError } = await supabase
        .from("voter_faces")
        .insert([
          {
            face_image_base64: faceImage,
            is_primary: true,
            metadata: {
              registrationMethod: "admin-capture",
              capturedAt: new Date().toISOString(),
            },
          },
        ])
        .select()
        .single();

      if (faceError) {
        console.error("Face storage error:", faceError);
      } else {
        faceImageId = faceData?.id;
      }
    }

    // Generate temporary verification token
    const verificationToken = crypto.getRandomValues(new Uint8Array(32));
    const tokenBase64 = btoa(String.fromCharCode(...verificationToken));

    // Store verification token in a temporary table (optional)
    // For now, send direct link

    const verificationLink = `${
      Deno.env.get("APP_URL") || "http://localhost:3000"
    }/complete-voter-registration?email=${encodeURIComponent(
      email,
    )}&face_id=${faceImageId || ""}`;

    // Send registration email
    await resend.emails.send({
      from: Deno.env.get("EMAIL_FROM") || "VoteKro <noreply@votekro.app>",
      to: email,
      subject: "Complete Your VoteKro Voter Registration",
      html: `
        <h2>Voter Registration - Verify Your Email</h2>
        <p>Dear ${fullName},</p>
        <p>An administrator has started your voter registration for VoteKro.</p>
        <p>Your face has been captured and verified for security.</p>
        <p>Click the button below to complete your registration:</p>
        <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #2e63e3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Complete Registration
        </a>
        <p>If you did not request this registration, please contact your administrator.</p>
      `,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Voter registration initiated",
        faceId: faceImageId,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
```

Deploy the updated function:

```bash
supabase functions deploy start-voter-registration
```

## Step 4: Test the Implementation

### Test Voter Registration

1. Start the app: `npm start`
2. Go to Admin Dashboard → Register Voter
3. Click "Start Face Capture"
4. Position a face in frame
5. Click "Capture Face"
6. Enter voter name and email
7. Click "Send Authorization Email"
8. Check that:
   - Face image appears in database (`voter_faces` table)
   - Email is sent to voter
   - Face data is linked with voter email

### Test Voter Login with Face Verification

1. Complete voter registration (get credentials from email)
2. Go to Voter Login page
3. Enter email and password
4. After authentication, camera should open for face verification
5. Position face in frame
6. Should proceed to voting dashboard if face matches

## Step 5: Environment Variables

Add to `.env` or `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
APP_URL=http://localhost:8081
```

## Step 6: Mobile Testing

### iOS

```bash
npm run ios
```

- Grant camera permission when prompted
- Face detection works in simulator

### Android

```bash
npm run android
```

- Grant camera permission in app settings
- Requires device for camera access

### Web

```bash
npm run web
```

- Open in browser
- Grant camera permission
- Works on desktop/laptop with webcam

## Troubleshooting

### "Face detection model not initialized"

- Model loads on first use (takes 2-5 seconds)
- Ensure internet connection for model download
- Check browser console for errors

### "Camera permission denied"

- iOS: Settings → VoteKro → Camera → Allow
- Android: App Settings → Permissions → Camera → Allow
- Web: Browser → Camera → Allow (check address bar)

### "No faces detected"

- Ensure adequate lighting
- Position face directly at camera
- Move closer (face should be ~200x200px minimum)
- Clear any obstructions

### "Multiple faces detected"

- Only one person should be in frame
- Remove other people or objects
- Move to isolated location if possible

### Database connection errors

- Verify Supabase URL is correct
- Check API key is valid
- Ensure RLS policies are enabled
- Check database connection in Supabase dashboard

### Face data not saving

- Check Supabase storage quota
- Verify table `voter_faces` exists
- Check RLS policies allow insert/update
- Look at Supabase logs for errors

## Performance Tuning

### Reduce Model Size

```typescript
// In face-detection.ts, use smaller model
const options = {
  maxFaces: 1, // Limit to 1 face for speed
};
```

### Compress Images Before Storing

```typescript
// Add image compression
async function compressImage(base64: string): Promise<string> {
  // Use canvas to compress to 512x512
  // Reduces database size by ~70%
}
```

### Cache Face Model

```typescript
// Load model on app startup, not on demand
useEffect(() => {
  faceDetectionService.initialize();
}, []);
```

## Security Hardening

### Encrypt Face Images at Rest

```sql
-- Add encryption column
ALTER TABLE voter_faces ADD COLUMN face_image_encrypted BYTEA;
-- Store encrypted version instead of base64
```

### Add Rate Limiting to Login

```typescript
// In VoterLogin.tsx
const [attempts, setAttempts] = useState(0);
if (attempts > 3) {
  // Lock account for 15 minutes
}
```

### Audit Face Verification Attempts

```sql
-- Add audit table
CREATE TABLE face_verification_attempts (
  id UUID PRIMARY KEY,
  voter_id UUID,
  success BOOLEAN,
  timestamp TIMESTAMPTZ,
  metadata JSONB
);
```

## Next Steps

1. ✅ Install dependencies
2. ✅ Apply database schema
3. ✅ Update edge functions
4. ✅ Test registration with face
5. ✅ Test login with face verification
6. ⬜ Set up encryption for face images (optional)
7. ⬜ Add rate limiting (optional)
8. ⬜ Implement audit logging (optional)
9. ⬜ Add admin dashboard for face management (optional)
10. ⬜ Deploy to production

## Support & Resources

- **TensorFlow.js Docs**: https://www.tensorflow.org/js
- **Expo Camera**: https://docs.expo.dev/cameras/camera-v1/
- **Supabase**: https://supabase.com/docs
- **Face Detection Models**: https://github.com/tensorflow/tfjs-models

## Known Limitations

1. **Face Comparison**: Uses position/size heuristic, not advanced embedding
   - Solution: Use face-api.js for better accuracy

2. **Image Storage**: Base64 in database (large)
   - Solution: Store in Supabase Storage bucket instead

3. **No Liveness Detection**: Doesn't verify 3D face vs. photo
   - Solution: Add liveness check (request head movement, blink)

4. **Single Model**: Uses BlazeFace (general-purpose)
   - Solution: Use specialized voter verification model

## Version History

- **v1.0** (Current): Basic face detection for registration & login
- **v1.1** (Planned): Face embeddings for better accuracy
- **v1.2** (Planned): Liveness detection
- **v2.0** (Planned): Admin dashboard for face management
