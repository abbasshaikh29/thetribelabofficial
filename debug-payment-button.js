#!/usr/bin/env node

/**
 * Debug script to test payment button functionality
 */

require('dotenv').config({ path: '.env.development' });

async function debugPaymentButton() {
  console.log('🔍 Debugging Payment Button Issue\n');
  
  const baseUrl = 'http://localhost:3000';
  const communitySlug = 'iran-won';
  
  try {
    // Test 1: Check if the subscription creation endpoint works
    console.log('1. Testing subscription creation endpoint...');
    
    const subscriptionResponse = await fetch(`${baseUrl}/api/community-subscriptions/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        communityId: '684ef467a521f59e292a5006', // From your logs
        adminId: '684d126cf7655f637f15c53b', // From your logs
        customerNotify: true,
        notes: {
          planName: 'Community Management Plan',
          adminEmail: 'test@example.com',
          communityId: '684ef467a521f59e292a5006'
        }
      }),
    });
    
    console.log('Subscription creation status:', subscriptionResponse.status);
    
    if (subscriptionResponse.ok) {
      const subscriptionData = await subscriptionResponse.json();
      console.log('✅ Subscription creation successful');
      console.log('Response keys:', Object.keys(subscriptionData));
      
      if (subscriptionData.razorpaySubscription) {
        console.log('Razorpay subscription status:', subscriptionData.razorpaySubscription.status);
        console.log('Razorpay subscription ID:', subscriptionData.razorpaySubscription.id);
      }
      
      if (subscriptionData.shortUrl) {
        console.log('Short URL provided:', subscriptionData.shortUrl);
      }
    } else {
      const errorData = await subscriptionResponse.text();
      console.log('❌ Subscription creation failed:', errorData);
    }
    
    // Test 2: Check Razorpay script loading
    console.log('\n2. Testing Razorpay script availability...');
    console.log('Razorpay script URL: https://checkout.razorpay.com/v1/checkout.js');
    
    const scriptResponse = await fetch('https://checkout.razorpay.com/v1/checkout.js');
    console.log('Razorpay script status:', scriptResponse.status);
    
    if (scriptResponse.ok) {
      console.log('✅ Razorpay script is accessible');
    } else {
      console.log('❌ Razorpay script is not accessible');
    }
    
    // Test 3: Check environment variables
    console.log('\n3. Checking environment variables...');
    console.log('NEXT_PUBLIC_RAZORPAY_KEY_ID:', process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ? 'Set' : 'Not set');
    console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID ? 'Set' : 'Not set');
    console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? 'Set' : 'Not set');
    
    // Test 4: Check verification endpoint
    console.log('\n4. Testing verification endpoint...');
    const verifyResponse = await fetch(`${baseUrl}/api/community-subscriptions/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId: 'test_sub_id',
        paymentId: 'test_payment_id',
        signature: 'test_signature',
        communityId: '684ef467a521f59e292a5006'
      }),
    });
    
    console.log('Verification endpoint status:', verifyResponse.status);
    
    if (verifyResponse.status === 401) {
      console.log('⚠️  Verification endpoint requires authentication');
    } else if (verifyResponse.status === 400) {
      console.log('⚠️  Verification endpoint expects valid data (expected for test)');
    }
    
    // Test 5: Common issues checklist
    console.log('\n5. Common Payment Button Issues Checklist:');
    console.log('✓ Check if user is logged in');
    console.log('✓ Check if Razorpay script loads');
    console.log('✓ Check if environment variables are set');
    console.log('✓ Check if subscription creation API works');
    console.log('✓ Check browser console for JavaScript errors');
    console.log('✓ Check network tab for failed requests');
    
    console.log('\n6. Debugging Steps:');
    console.log('1. Open browser developer tools');
    console.log('2. Go to Console tab');
    console.log('3. Click the payment button');
    console.log('4. Look for error messages');
    console.log('5. Check Network tab for failed API calls');
    
    console.log('\n7. Expected Flow:');
    console.log('1. User clicks payment button');
    console.log('2. handlePayment function is called');
    console.log('3. API call to /api/community-subscriptions/create');
    console.log('4. Razorpay checkout modal opens');
    console.log('5. User completes payment');
    console.log('6. Payment verification happens');
    console.log('7. User is redirected to community page');
    
  } catch (error) {
    console.error('❌ Error during debug:', error.message);
  }
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

debugPaymentButton().catch(console.error);
