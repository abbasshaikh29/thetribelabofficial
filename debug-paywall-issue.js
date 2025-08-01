#!/usr/bin/env node

/**
 * Debug script to test paywall functionality when trial expires
 * This script simulates the middleware logic and checks why the paywall isn't showing
 */

require('dotenv').config({ path: '.env.development' });

async function debugPaywallIssue() {
  console.log('🔍 Debugging Paywall Issue\n');
  
  const communitySlug = 'iran-won'; // From your logs
  const baseUrl = 'http://localhost:3000';
  
  try {
    // Test the community status endpoint
    console.log('1. Testing community status endpoint...');
    const statusResponse = await fetch(`${baseUrl}/api/community/${communitySlug}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!statusResponse.ok) {
      console.error('❌ Status endpoint failed:', statusResponse.status);
      return;
    }
    
    const statusData = await statusResponse.json();
    console.log('✅ Status endpoint response:');
    console.log(JSON.stringify(statusData, null, 2));
    
    // Check the key fields that middleware uses
    console.log('\n2. Analyzing middleware decision factors:');
    console.log('hasActiveSubscription:', statusData.hasActiveSubscription);
    console.log('hasActiveTrial:', statusData.hasActiveTrial);
    console.log('hasActiveTrialOrPayment:', statusData.hasActiveTrialOrPayment);
    console.log('suspended:', statusData.community?.suspended);
    console.log('daysRemaining:', statusData.daysRemaining);
    
    // Simulate middleware logic
    console.log('\n3. Simulating middleware logic:');
    
    if (statusData.community?.suspended) {
      console.log('🚫 Community is suspended - should show suspended page');
      console.log('Expected redirect: suspended community page');
    } else if (!statusData.hasActiveTrialOrPayment) {
      console.log('💳 No active trial or payment - should redirect to billing');
      console.log('Expected redirect: /billing/' + communitySlug);
    } else {
      console.log('✅ Access should be allowed');
    }
    
    // Test the billing page
    console.log('\n4. Testing billing page access...');
    const billingResponse = await fetch(`${baseUrl}/billing/${communitySlug}`, {
      method: 'GET',
    });
    
    console.log('Billing page status:', billingResponse.status);
    
    // Check if middleware is configured correctly
    console.log('\n5. Middleware configuration check:');
    console.log('- Middleware should be in src/middleware.ts');
    console.log('- Should check paths matching /Newcompage/[slug]');
    console.log('- Should call checkCommunityAccess function');
    console.log('- Should redirect to billing page if no active trial/payment');
    
    // Recommendations
    console.log('\n6. Recommendations:');
    
    if (statusData.hasActiveTrialOrPayment === false) {
      console.log('✅ Status correctly shows no active trial/payment');
      console.log('🔧 Issue likely in middleware:');
      console.log('   - Check if middleware.ts is properly configured');
      console.log('   - Verify middleware is running (check server logs)');
      console.log('   - Test middleware path matching');
    } else if (statusData.hasActiveTrialOrPayment === true) {
      console.log('❌ Status incorrectly shows active trial/payment');
      console.log('🔧 Issue in status calculation:');
      console.log('   - Check getCommunityStatus function');
      console.log('   - Verify trial expiration logic');
    } else {
      console.log('❓ hasActiveTrialOrPayment is undefined');
      console.log('🔧 Issue in status endpoint:');
      console.log('   - Check status endpoint implementation');
      console.log('   - Verify all required fields are calculated');
    }
    
  } catch (error) {
    console.error('❌ Error during debug:', error.message);
  }
}

// Test specific middleware functions
async function testMiddlewareComponents() {
  console.log('\n🧪 Testing Middleware Components\n');
  
  const communitySlug = 'iran-won';
  const baseUrl = 'http://localhost:3000';
  
  try {
    // Test the trial status check endpoint
    console.log('Testing trial status check...');
    const trialCheckResponse = await fetch(
      `${baseUrl}/api/community/${communitySlug}/check-trial-status?userId=test-user-id`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (trialCheckResponse.ok) {
      const trialData = await trialCheckResponse.json();
      console.log('Trial check response:', trialData);
    } else {
      console.log('Trial check endpoint failed:', trialCheckResponse.status);
    }
    
  } catch (error) {
    console.error('Error testing middleware components:', error.message);
  }
}

// Test the actual community page access
async function testCommunityPageAccess() {
  console.log('\n🌐 Testing Community Page Access\n');
  
  const communitySlug = 'iran-won';
  const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('Attempting to access community page...');
    const pageResponse = await fetch(`${baseUrl}/Newcompage/${communitySlug}`, {
      method: 'GET',
      redirect: 'manual', // Don't follow redirects automatically
    });
    
    console.log('Response status:', pageResponse.status);
    console.log('Response headers:');
    for (const [key, value] of pageResponse.headers.entries()) {
      if (key.toLowerCase().includes('location') || key.toLowerCase().includes('redirect')) {
        console.log(`  ${key}: ${value}`);
      }
    }
    
    if (pageResponse.status >= 300 && pageResponse.status < 400) {
      const location = pageResponse.headers.get('location');
      console.log('🔄 Redirect detected to:', location);
      
      if (location && location.includes('/billing/')) {
        console.log('✅ Correctly redirecting to billing page');
      } else {
        console.log('❌ Redirecting to unexpected location');
      }
    } else if (pageResponse.status === 200) {
      console.log('⚠️  Page loaded without redirect - middleware may not be working');
    } else {
      console.log('❌ Unexpected response status');
    }
    
  } catch (error) {
    console.error('Error testing community page access:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Paywall Debug Session\n');
  
  await debugPaywallIssue();
  await testMiddlewareComponents();
  await testCommunityPageAccess();
  
  console.log('\n📋 Summary:');
  console.log('1. Check the status endpoint response');
  console.log('2. Verify middleware is running and configured correctly');
  console.log('3. Test the billing page shows payment options');
  console.log('4. Ensure trial expiration logic is working');
  
  console.log('\n🔧 Next Steps:');
  console.log('1. If middleware is not redirecting, check middleware.ts configuration');
  console.log('2. If status is incorrect, check getCommunityStatus function');
  console.log('3. If billing page is not showing paywall, check billing page logic');
  console.log('4. Restart development server to ensure middleware changes are applied');
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

main().catch(console.error);
