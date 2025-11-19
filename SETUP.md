# Setup Guide - First Two Nodes Implementation

## 🎯 What We've Built

We've implemented the first two nodes of the issue debugging system:

1. **Mandatory Details Node** - Validates required fields
2. **Classify Issue Node** - Uses AI to classify priority and category

## 📋 Installation Steps

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables

Copy the example env file and add your OpenAI API key:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

## 🧪 Testing

### Manual Testing with curl

**Test 1: Missing fields (should fail validation)**
```bash
curl -X POST http://localhost:3000/api/v1/issues/debug \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Bug",
    "body": "Short"
  }'
```

**Test 2: Valid critical issue**
```bash
curl -X POST http://localhost:3000/api/v1/issues/debug \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Database Connection Failed - Production Down",
    "body": "Our production database is completely down. All SQL queries are failing with connection timeout errors. This started 10 minutes ago and is affecting all users.",
    "metadata": {
      "source": "slack"
    }
  }'
```

### Automated Testing

Make the test script executable and run it:

```bash
chmod +x test-api.sh
./test-api.sh
```

## 🔄 How It Works

### Flow Diagram

```
API Request
    ↓
mandatory_details_node
    ↓
[Check fields]
    ↓
    ├─→ Missing fields? → Return 400 Error
    ↓
    └─→ All fields present
         ↓
    classify_issue_node
         ↓
    [AI Classification]
         ↓
    Return Result with:
    - Priority (critical/high/medium/low)
    - Category (database/api/frontend/backend/network/infrastructure/other)
```

### Node Details

#### 1. Mandatory Details Node (`src/nodes/mandatory_details_node.js`)

**Purpose:** Validates that all required information is present

**Checks:**
- Subject: minimum 5 characters
- Body: minimum 20 characters
- Metadata: must have source field

**Output:**
- `hasRequiredFields`: boolean
- `missingFields`: array of missing field names

#### 2. Classify Issue Node (`src/nodes/classify_issue_node.js`)

**Purpose:** Uses AI to classify the issue

**Classification:**
- **Priority:** critical | high | medium | low
- **Category:** database | api | frontend | backend | network | infrastructure | other

**Features:**
- Uses OpenAI GPT-3.5-turbo for classification
- Has fallback rule-based classification if AI fails
- Returns reasoning for the classification

## 📁 Project Structure

```
src/
├── controllers/
│   └── issue.controller.js      # API request handler
├── nodes/
│   ├── mandatory_details_node.js # Field validation
│   └── classify_issue_node.js    # AI classification
├── services/
│   └── workflow.service.js       # LangGraph orchestration
├── types/
│   └── state.js                  # State interface
├── routes/
│   └── issue.routes.js           # API routes
├── utils/
│   └── logger.js                 # Winston logger
└── index.js                      # Server entry point
```

## 📊 API Response Examples

### Success Response

```json
{
  "status": "success",
  "message": "Issue analyzed successfully",
  "data": {
    "subject": "Database Connection Failed",
    "body": "Production database is down...",
    "metadata": {
      "source": "slack"
    },
    "classification": {
      "priority": "critical",
      "category": "database",
      "reasoning": "System down affecting all users, database issue"
    },
    "processedAt": "2025-11-19T10:30:00.000Z"
  }
}
```

### Validation Error Response

```json
{
  "status": "error",
  "message": "Missing required fields",
  "missingFields": [
    "body (minimum 20 characters required for proper analysis)",
    "metadata.source (e.g., email, slack, chatbot, etc.)"
  ]
}
```

## 🔑 Key Features

✅ **Field Validation** - Ensures quality input
✅ **AI Classification** - Intelligent priority and category detection
✅ **Fallback System** - Rule-based classification if AI fails
✅ **Structured Logging** - Winston logger with emoji indicators
✅ **Error Handling** - Comprehensive error responses
✅ **LangGraph** - Proper state management and workflow orchestration

## 🚀 Next Steps

After testing these two nodes, we'll implement:

3. **Query Planner Node** - Decides which data sources to query
4. **SQL Query Node** - Extracts data from databases
5. **Loki Query Node** - Extracts logs from Loki
6. **Correlation Synthesizer Node** - Combines all data
7. **Action Executor Node** - Generates final analysis with AWS Bedrock

## 💡 Tips

- The AI classification requires an OpenAI API key
- If AI classification fails, the system automatically falls back to rule-based classification
- Check the console logs for detailed emoji-based status indicators
- All responses follow a consistent JSON structure

## 🐛 Troubleshooting

**Issue:** "Cannot find module '@langchain/langgraph'"
**Solution:** Run `npm install --legacy-peer-deps`

**Issue:** "OpenAI API key not found"
**Solution:** Add `OPENAI_API_KEY` to your `.env` file

**Issue:** "Port 3000 already in use"
**Solution:** Change `PORT` in `.env` file or stop the other service

---

Ready to move to the next node? Let me know! 🎉

