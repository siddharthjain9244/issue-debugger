# Knowledge Base RAG System

## 🎯 Overview

The Knowledge Base RAG (Retrieval-Augmented Generation) system provides **context-aware analysis** by retrieving relevant business flow documentation during issue diagnosis.

---

## 🏗️ Architecture

```
User Issue
    ↓
Classify Issue
    ↓
┌─────────────────────────────────────┐
│  KNOWLEDGE RETRIEVAL NODE (NEW!)    │
│                                     │
│  1. Build search query              │
│  2. Search vector store             │
│  3. Retrieve top 3 relevant docs    │
│  4. Add to state as context         │
└──────────────┬──────────────────────┘
               ↓
        SQL Query (with KB context)
               ↓
        SQL Executor
               ↓
        ES Query (with KB context)
               ↓
        ES Executor
               ↓
┌─────────────────────────────────────┐
│  ANALYSIS NODE (Enhanced!)          │
│                                     │
│  Uses KB context in all 3 stages:   │
│  - Stage 1: SQL Analysis            │
│  - Stage 2: ES Analysis             │
│  - Stage 3: Final Analysis          │
└─────────────────────────────────────┘
```

---

## 📚 Knowledge Base Documents

Located in: `/src/data/knowledge-base/`

| Document | Flow Type | Purpose |
|----------|-----------|---------|
| `01_BUY_FLOW.md` | buy_flow | Gold purchase process |
| `02_SELL_FLOW.md` | sell_flow | Gold selling process |
| `03_SIP_CREATE_FLOW.md` | sip_create_flow | SIP subscription creation |
| `04_SIP_DEBIT_FLOW.md` | sip_debit_flow | SIP recurring debit |
| `05_MERCHANT_PRODUCT_MAINTENANCE.md` | merchant_product_maintenance | Merchant configuration |
| `06_CUSTOMER_PORTFOLIO.md` | customer_portfolio | Portfolio management |
| `07_KYC_FLOWS.md` | kyc_flows | KYC verification |

---

## 🔧 How It Works

### **1. Server Startup**

```javascript
// Initialize knowledge base vector store
await initializeKnowledgeBaseVectorStore();
```

**Process:**
1. Load all `.md` files from knowledge base directory
2. Split documents into chunks (1000 chars, 200 overlap)
3. Create embeddings using `text-embedding-3-large`
4. Store in memory vector store

**Output:**
```
📚 Loading knowledge base documents...
   - Loaded: 01_BUY_FLOW.md (buy_flow)
   - Loaded: 02_SELL_FLOW.md (sell_flow)
   ...
✅ Loaded 7 knowledge base documents
✂️  Splitting documents into chunks...
✅ Created 89 chunks from 7 documents
🔢 Creating embeddings with OpenAI...
💾 Creating vector store from chunks...
✅ Knowledge base vector store initialized
```

---

### **2. Knowledge Retrieval Node**

**Triggered after:** Issue classification  
**Before:** SQL query generation

```javascript
export async function knowledgeRetrievalNode(state) {
  // Build search query from issue
  const searchQuery = `${state.subject}\n${state.body}`;
  
  // Search knowledge base (top 3 results)
  const relevantDocs = await searchKnowledgeBase(
    searchQuery, 
    state.flowType,  // Optional filter
    3                // Number of results
  );
  
  // Format context for AI
  const context = formatDocsAsContext(relevantDocs);
  
  return {
    ...state,
    knowledgeBaseContext: context,
    knowledgeBaseSources: sources
  };
}
```

**Output:**
```
📚 Retrieving relevant knowledge base context...
   - Issue Category: database
   - Issue Priority: high
   - Flow Type: buy_flow
🔍 Searching knowledge base for: "Customer gold balance wrong..."
✅ Retrieved 3 relevant knowledge base chunks
   1. 01_BUY_FLOW.md (buy_flow)
   2. 06_CUSTOMER_PORTFOLIO.md (customer_portfolio)
   3. 02_SELL_FLOW.md (sell_flow)
```

---

### **3. Enhanced Analysis with KB Context**

All 3 analysis stages now include knowledge base context:

#### **Stage 1: SQL Analysis**
```
### KNOWLEDGE BASE CONTEXT (Business Flow Documentation):
### Knowledge Base 1 (01_BUY_FLOW.md):
## Buy Flow Process
1. Customer places buy order
2. Payment processing
3. Gold allocated to portfolio
4. Balance updated in customer_portfolio.quantity

...

### SQL DATA:
- Total rows: 15
- Order IDs: 123, 456, 789
...
```

The AI can now **compare actual data** with **expected flow** from documentation!

---

## 📊 Benefits

### **Before (Without KB)**
```
AI: "I see 3 buy orders in the database..."
❓ No context about expected behavior
❓ No flow understanding
❓ Generic analysis
```

### **After (With KB)**
```
AI: "According to buy flow documentation, after successful 
     buy orders (status=7), gold should be added to 
     customer_portfolio.quantity. I see 3 completed buy 
     orders but portfolio quantity doesn't match..."
✅ Context-aware analysis
✅ Compares with expected flow
✅ Identifies specific deviations
```

---

## 🎯 Use Cases

### **Use Case 1: Balance Discrepancy**

**Issue:** "Customer balance is wrong"

**Knowledge Retrieved:**
- Buy Flow: How gold is added to balance
- Sell Flow: How gold is deducted  
- Customer Portfolio: How balance is calculated

**Analysis:**
```json
{
  "rootCause": "According to buy flow documentation, 
                completed orders (status=7) should update 
                customer_portfolio.quantity. Found 1 buy 
                order with status=13 (pending) - not yet 
                added to balance. This matches expected behavior.",
  "evidence": [
    "Buy flow doc: Only status=7 orders update balance",
    "Found order #456 with status=13 (pending)",
    "Portfolio balance correctly excludes pending order"
  ],
  "confidence": "high"
}
```

---

### **Use Case 2: SIP Failure**

**Issue:** "SIP debit failed"

**Knowledge Retrieved:**
- SIP Debit Flow: Debit process steps
- Buy Flow: Order creation after debit

**Analysis:**
```json
{
  "rootCause": "According to SIP debit flow, payment 
                gateway must return success before order 
                creation. Payment failed at step 3 (gateway 
                timeout), preventing order creation. This is 
                expected behavior for failed payments.",
  "confidence": "high"
}
```

---

## 📤 API Response

```json
{
  "status": "success",
  "data": {
    "classification": {
      "priority": "high",
      "category": "database"
    },
    "knowledgeBase": {
      "retrieved": true,
      "sources": [
        {
          "source": "01_BUY_FLOW.md",
          "flowType": "buy_flow",
          "snippet": "## Buy Flow Process..."
        },
        {
          "source": "06_CUSTOMER_PORTFOLIO.md",
          "flowType": "customer_portfolio",
          "snippet": "## Portfolio Balance Calculation..."
        }
      ],
      "contextAvailable": true
    },
    "sqlAnalysis": {...},
    "esAnalysis": {...},
    "analysis": {
      "rootCause": "...",
      "evidence": [...],
      "confidence": "high"
    }
  }
}
```

---

## 🔍 Vector Search

### **Similarity Search Algorithm:**

1. **Query Embedding:** User issue → vector embedding
2. **Similarity Calculation:** Compare with all document chunks
3. **Ranking:** Return top K most similar chunks
4. **Filtering:** Optional filter by flow type

### **Example:**

**Query:** "customer bought gold but balance not updated"

**Top Results:**
1. Buy Flow - Balance Update Section (similarity: 0.92)
2. Customer Portfolio - Balance Calculation (similarity: 0.88)
3. Database Schema - customer_portfolio table (similarity: 0.85)

---

## ⚙️ Configuration

### **Chunk Size:**
```javascript
chunkSize: 1000,      // Characters per chunk
chunkOverlap: 200     // Overlap for context
```

### **Number of Results:**
```javascript
searchKnowledgeBase(query, flowType, 3);  // Top 3 chunks
```

### **Embeddings Model:**
```javascript
modelName: 'text-embedding-3-large'  // OpenAI's best model
```

---

## 🚀 Performance

### **Initialization:**
- Load 7 documents: ~500ms
- Create 89 chunks: ~100ms
- Generate embeddings: ~2-3s
- **Total Startup Time: ~3-4s**

### **Query Time:**
- Similarity search: ~10-50ms
- Format context: ~5ms
- **Total Retrieval Time: ~15-55ms**

---

## 📈 Token Impact

### **Without KB:**
- SQL Analysis: ~1,200 tokens
- ES Analysis: ~900 tokens
- Final Analysis: ~1,400 tokens
- **Total: ~3,500 tokens**

### **With KB (3 chunks, 1000 chars each):**
- SQL Analysis: ~2,700 tokens (+1,500)
- ES Analysis: ~2,400 tokens (+1,500)
- Final Analysis: ~2,900 tokens (+1,500)
- **Total: ~8,000 tokens (+4,500 tokens)**

**Cost Impact:** ~$0.002 per request (at $0.50/1M tokens)

---

## 🎓 Key Features

✅ **Automatic Initialization** on server startup  
✅ **Semantic Search** finds relevant docs by meaning  
✅ **Flow-Type Filtering** (optional)  
✅ **Context Injection** into all analysis stages  
✅ **Source Transparency** - shows which docs were used  
✅ **Memory Efficient** - in-memory vector store  
✅ **Fast Retrieval** - sub-100ms queries  

---

## 🔄 Workflow Update

### **Old Workflow:**
```
mandatory_details → classify_issue → sql_query → ...
```

### **New Workflow:**
```
mandatory_details → classify_issue → knowledge_retrieval → sql_query → ...
                                            ↓
                                    (Provides context to analysis)
```

---

## 🎯 Summary

The Knowledge Base RAG system:
1. **Embeds** business flow documentation on startup
2. **Retrieves** relevant docs based on user issue
3. **Injects** context into AI analysis
4. **Improves** diagnosis accuracy with domain knowledge
5. **Explains** issues in context of expected behavior

**Result:** More accurate, context-aware, and actionable root cause analysis! 🎉

