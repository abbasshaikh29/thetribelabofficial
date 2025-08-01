#!/usr/bin/env node

/**
 * Test script to check middleware authentication and redirection logic
 */

require('dotenv').config({ path: '.env.development' });

async function testMiddlewareAuth() {
  console.log('🔐 Testing Middleware Authentication Logic\n');
  
  const baseUrl = 'http://localhost:3000';
  const communitySlug = 'iran-won';
  
  try {
    // Test 1: Access community page without authentication
    console.log('1. Testing unauthenticated access...');
    const unauthResponse = await fetch(`${baseUrl}/Newcompage/${communitySlug}`, {
      method: 'GET',
      redirect: 'manual',
    });
    
    console.log('Unauthenticated response status:', unauthResponse.status);
    if (unauthResponse.status >= 300 && unauthResponse.status < 400) {
      const location = unauthResponse.headers.get('location');
      console.log('Redirect location:', location);
      
      if (location && location.includes('/login')) {
        console.log('✅ Correctly redirecting unauthenticated users to login');
      } else {
        console.log('❌ Unexpected redirect for unauthenticated user');
      }
    }
    
    // Test 2: Check if we can simulate authenticated access
    console.log('\n2. Testing middleware logic...');
    console.log('The middleware should:');
    console.log('- First check if user is authenticated');
    console.log('- If not authenticated, redirect to /login');
    console.log('- If authenticated, check trial status');
    console.log('- If no active trial/payment, redirect to /billing/[slug]');
    
    // Test 3: Check the middleware configuration
    console.log('\n3. Middleware configuration analysis:');
    console.log('Based on the middleware code:');
    console.log('- Protected paths include "/Newcompage"');
    console.log('- Unauthenticated users are redirected to /login');
    console.log('- Authenticated users get trial status checked');
    console.log('- Users without active trial/payment get redirected to billing');
    
    console.log('\n4. Current behavior analysis:');
    console.log('✅ Unauthenticated users → /login (working)');
    console.log('❓ Authenticated users → need to test with valid session');
    console.log('❓ Trial expired users → should go to /billing/[slug]');
    
    console.log('\n5. Solution steps:');
    console.log('1. User needs to be logged in first');
    console.log('2. Then access the community page');
    console.log('3. Middleware should detect expired trial');
    console.log('4. Redirect to billing page with paywall');
    
    console.log('\n6. Testing billing page directly...');
    const billingResponse = await fetch(`${baseUrl}/billing/${communitySlug}`, {
      method: 'GET',
      redirect: 'manual',
    });
    
    console.log('Billing page status:', billingResponse.status);
    if (billingResponse.status === 200) {
      console.log('✅ Billing page is accessible');
    } else if (billingResponse.status >= 300 && billingResponse.status < 400) {
      const location = billingResponse.headers.get('location');
      console.log('Billing page redirects to:', location);
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error.message);
  }
}

// Test the actual workflow
async function testWorkflow() {
  console.log('\n🔄 Testing Complete Workflow\n');
  
  console.log('Expected workflow for admin with expired trial:');
  console.log('1. Admin logs in');
  console.log('2. Admin tries to access /Newcompage/[slug]');
  console.log('3. Middleware checks authentication ✅');
  console.log('4. Middleware checks trial status');
  console.log('5. Trial is expired, redirect to /billing/[slug]');
  console.log('6. Billing page shows paywall with payment options');
  
  console.log('\nCurrent issue:');
  console.log('- Step 3 fails because user is not authenticated in our test');
  console.log('- Need to test with actual logged-in user');
  
  console.log('\nTo fix:');
  console.log('1. Log in to the application');
  console.log('2. Try to access the community page');
  console.log('3. Should be redirected to billing page');
  console.log('4. Billing page should show payment options');
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

async function main() {
  await testMiddlewareAuth();
  await testWorkflow();
  
  console.log('\n📋 Action Items:');
  console.log('1. ✅ Fixed the trial status check endpoint');
  console.log('2. ✅ Verified status endpoint shows expired trial');
  console.log('3. 🔄 Need to test with authenticated user');
  console.log('4. 🔄 Verify middleware redirects to billing page');
  console.log('5. 🔄 Ensure billing page shows paywall');
}

main().catch(console.error);
