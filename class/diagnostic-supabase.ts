// Supabase Configuration Diagnostic Script
// 
// USAGE:
// 1. Add this to your app temporarily
// 2. Call diagnostic() from browser console or app startup
// 3. Check console output for 🔍, ✓, ❌ symbols
// 4. Share output if issues persist
//
// Example: 
// import { runSupabaseDiagnostics } from '@/diagnostic-supabase'
// runSupabaseDiagnostics()

import { supabase } from '@/class/supabase-client';
import { env } from '@/class/env';

interface DiagnosticResult {
  step: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
  error?: string;
}

const results: DiagnosticResult[] = [];

const log = (status: 'pass' | 'fail' | 'warning', step: string, details: string, error?: string) => {
  const symbol = status === 'pass' ? '✓' : status === 'fail' ? '❌' : '⚠️';
  console.log(`${symbol} ${step}: ${details}`);
  if (error) console.error(`  Error: ${error}`);
  
  results.push({ step, status, details, error });
};

export const runSupabaseDiagnostics = async () => {
  console.log('\n🔍 SUPABASE DIAGNOSTIC REPORT\n' + '='.repeat(50));

  // 1. Check Environment Variables
  console.log('\n📋 Environment Configuration:');
  try {
    const urlExists = !!env.supabaseUrl && env.supabaseUrl.length > 0;
    const keyExists = !!env.supabaseAnonKey && env.supabaseAnonKey.length > 0;
    
    log(
      urlExists ? 'pass' : 'fail',
      'SUPABASE_URL',
      urlExists ? '✓ Set' : '✗ Missing',
    );

    if (urlExists) {
      console.log(`  URL: ${env.supabaseUrl.substring(0, 50)}...`);
    }

    log(
      keyExists ? 'pass' : 'fail',
      'SUPABASE_ANON_KEY',
      keyExists ? '✓ Set' : '✗ Missing',
    );

    if (keyExists) {
      console.log(`  Key: ${env.supabaseAnonKey.substring(0, 50)}...`);
    }
  } catch (error) {
    log('fail', 'Environment Check', 'Failed to read env', String(error));
  }

  // 2. Check Supabase Connection
  console.log('\n🔗 Connection Tests:');
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      log('warning', 'Current Session', 'No active session (expected if not logged in)', error.message);
    } else if (data?.session) {
      log('pass', 'Current Session', `✓ Active session for: ${data.session.user.email}`);
    } else {
      log('warning', 'Current Session', 'No session active (expected on first visit)');
    }
  } catch (error) {
    log('fail', 'Session Check', 'Failed to connect to Supabase', String(error));
  }

  // 3. Test Authentication Flow (with test credentials)
  console.log('\n🔐 Authentication Tests:');
  try {
    // Only run if safe test credentials exist
    const testEmail = 'diagnostic@votekro.test';
    const testPassword = 'Diagnostic@123';

    console.log(`  Attempting test login with: ${testEmail}`);
    
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError?.message.includes('Invalid login credentials')) {
      log(
        'warning',
        'Test Account',
        'Test user not found (run: database/create-test-users.sql)',
        signInError.message,
      );
    } else if (signInError) {
      log(
        'fail',
        'Authentication',
        'Auth service error',
        signInError.message,
      );
    } else {
      log('pass', 'Authentication', '✓ Test login successful');
      
      // Clean up: sign out
      await supabase.auth.signOut();
    }
  } catch (error) {
    log('fail', 'Auth Flow', 'Unexpected error during auth test', String(error));
  }

  // 4. Check Database Accessibility
  console.log('\n📊 Database Tests:');
  try {
    // This requires being authenticated, so we'll just check RLS status
    const { data, error } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });

    if (error?.message.includes('row level security')) {
      log('warning', 'RLS Policies', 'RLS enabled (expected - requires authentication)');
    } else if (error) {
      log('fail', 'Database Access', 'Cannot access profiles table', error.message);
    } else {
      log('pass', 'Database Access', '✓ Can query profiles table');
    }
  } catch (error) {
    log('fail', 'Database Check', 'Unexpected database error', String(error));
  }

  // 5. Check Supabase Project Details
  console.log('\n🏗️ Project Details:');
  try {
    const urlParts = env.supabaseUrl.split('https://')[1].split('.supabase.co')[0];
    const projectRef = urlParts;
    
    console.log(`  Project Reference: ${projectRef}`);
    console.log(`  Region: Auto-detected from URL`);
    log('pass', 'Project Reference', `✓ ${projectRef}`);
  } catch (error) {
    log('fail', 'Project Details', 'Could not parse project info', String(error));
  }

  // 6. Summary Report
  console.log('\n' + '='.repeat(50));
  console.log('📈 SUMMARY:');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;

  console.log(`✓ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);

  if (failed === 0 && warnings === 0) {
    console.log('\n✨ All checks passed! Auth should work.\n');
  } else if (failed === 0) {
    console.log('\n⚠️ Some warnings detected. See above for details.\n');
  } else {
    console.log('\n❌ Some checks failed. Fix issues above and rerun.\n');
  }

  // 7. Next Steps
  console.log('📝 NEXT STEPS:');
  
  if (failed > 0) {
    console.log('1. Fix failed items above');
    console.log('2. Check .env file is correct');
    console.log('3. Verify Supabase project is active');
  }
  
  if (warnings.some(r => r.step === 'Test Account')) {
    console.log('1. Run: database/create-test-users.sql in Supabase');
    console.log('2. Then rerun this diagnostic');
  }
  
  console.log('4. See SUPABASE_AUTH_TROUBLESHOOTING.md for help\n');

  return results;
};

// Export for use in error handlers
export const getDiagnosticSummary = () => {
  return results;
};
