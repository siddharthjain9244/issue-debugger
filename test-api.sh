#!/bin/bash

# Test script for the Issue Debugger API

echo "🧪 Testing Issue Debugger API"
echo "================================"
echo ""

BASE_URL="http://localhost:3000"

# Test 1: Health Check
echo "1️⃣ Testing Health Check..."
curl -s "${BASE_URL}/health" | jq '.'
echo ""
echo ""

# Test 2: Missing fields (should return 400)
echo "2️⃣ Testing validation - missing fields..."
curl -s -X POST "${BASE_URL}/api/v1/issues/debug" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Bug"
  }' | jq '.'
echo ""
echo ""

# Test 3: Valid database issue (critical priority)
echo "3️⃣ Testing classification - Database issue (should be critical)..."
curl -s -X POST "${BASE_URL}/api/v1/issues/debug" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Database Connection Failed - Production Down",
    "body": "Our production database is completely down. All SQL queries are failing with connection timeout errors. This started 10 minutes ago and is affecting all users. We are seeing error code 500 across all services that depend on the database.",
    "metadata": {
      "source": "slack"
    }
  }' | jq '.'
echo ""
echo ""

# Test 4: Frontend issue (medium priority)
echo "4️⃣ Testing classification - Frontend issue (should be medium)..."
curl -s -X POST "${BASE_URL}/api/v1/issues/debug" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Button not displaying correctly on mobile",
    "body": "The submit button on the contact form is not displaying correctly on mobile devices. It works fine on desktop. Users can still click it but it looks odd. This has been reported by a few users.",
    "metadata": {
      "source": "email"
    }
  }' | jq '.'
echo ""
echo ""

# Test 5: API issue (high priority)
echo "5️⃣ Testing classification - API issue (should be high)..."
curl -s -X POST "${BASE_URL}/api/v1/issues/debug" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Payment API returning 500 errors",
    "body": "The payment processing API endpoint /api/payments/process is returning 500 errors for about 30% of requests. This is causing failed transactions and customer complaints. Error logs show internal server error but no clear root cause yet.",
    "metadata": {
      "source": "chatbot"
    }
  }' | jq '.'
echo ""
echo ""

echo "✅ All tests completed!"

