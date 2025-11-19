# Complete Issue Debugging Workflow

## 🎯 Full Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    API REQUEST                               │
│  POST /api/v1/issues/debug                                  │
│  { subject, body, metadata }                                │
└────────────────────┬────────────────────────────────────────┘
                     ↓
        ┌────────────────────────┐
        │  1. MANDATORY_DETAILS  │
        │  Validates fields      │
        └────────┬───────────────┘
                 ↓
           [Has required fields?]
                 │
        ┌────────┼────────┐
        │ NO     │ YES    │
        ↓        ↓        
       END   ┌────────────────────┐
             │  2. CLASSIFY_ISSUE │
             │  AI Priority &     │
             │  Category          │
             └─────────┬──────────┘
                       ↓
            ┌─────────────────────┐
            │  3. SQL_QUERY       │
            │  Generate SQL with  │
            │  RAG (Vector Store) │
            └──────────┬──────────┘
                       ↓
            ┌─────────────────────┐
            │  4. SQL_EXECUTOR    │
            │  Execute queries    │
            │  Extract order_ids  │
            │  Extract customer_ids│
            └──────────┬──────────┘
                       ↓
            ┌─────────────────────┐
            │  5. ES_QUERY        │
            │  Generate ES query  │
            │  (if order/customer │
            │   IDs available)    │
            └──────────┬──────────┘
                       ↓
              [ES query needed?]
                       │
          ┌────────────┼────────────┐
          │ NO         │ YES        │
          ↓            ↓            
    ┌─────────┐  ┌────────────────┐
    │  SKIP   │  │ 6. ES_EXECUTOR │
    │   ES    │  │ Execute ES     │
    └────┬────┘  │ query          │
         │       └────────┬───────┘
         │                │
         └────────┬───────┘
                  ↓
       ┌─────────────────────────┐
       │  7. ANALYSIS            │
       │  Final root cause       │
       │  analysis with all data │
       └──────────┬──────────────┘
                  ↓
              ┌───────┐
              │  END  │
              └───────┘
                  ↓
       ┌──────────────────────┐
       │  JSON RESPONSE       │
       │  with analysis       │
       └──────────────────────┘
```

---

## 📊 Node Details

### **1. Mandatory Details Node**
**Purpose**: Validate required fields  
**Checks**:
- ✅ `subject` is present
- ✅ `body` is present  
- ✅ `metadata.source` is present

**Output**:
```javascript
{
  hasRequiredFields: true,
  missingFields: []
}
```

**Flow**: If validation fails → END (400 error), else → classify_issue

---

### **2. Classify Issue Node**
**Purpose**: Determine priority and category using AI  
**AI Model**: GPT-4o-mini  
**Output**:
```javascript
{
  priority: "high|medium|low|critical",
  category: "database|api|frontend|backend|network|other",
  classificationReasoning: "..."
}
```

**Flow**: Always → sql_query

---

### **3. SQL Query Node (RAG)**
**Purpose**: Generate MySQL queries using semantic search  
**Method**: 
1. Embed user query
2. Search vector store for relevant tables
3. Generate SQL with LLM

**Output**:
```javascript
{
  sqlQuery: ["SELECT ...", "SELECT ..."],
  sqlExplanation: "...",
  sqlTablesUsed: ["table1", "table2"],
  relevantTablesFound: 5
}
```

**Flow**: Always → sql_executor

---

### **4. SQL Executor Node**
**Purpose**: Execute SQL queries and extract IDs  
**Database**: MySQL (SLAVE node for read operations)  
**Output**:
```javascript
{
  sqlData: {
    success: true,
    rows: [...],
    rowCount: 15,
    orderIds: [123, 456, 789],
    customerIds: [100, 200],
    executionTime: 45
  }
}
```

**Flow**: Always → es_query

---

### **5. ES Query Node**
**Purpose**: Decide if ES query is needed and generate it  
**Logic**:
- If `orderIds` found → Generate ES query for those orders
- If only `customerIds` found → Generate ES query for customer
- If neither → Skip ES

**Output**:
```javascript
{
  needsESQuery: true,
  esQuery: {
    index: "digital-gold-transactions-new",
    body: {
      query: { terms: { order_id: [123, 456, 789] } },
      size: 3
    }
  },
  esExplanation: "..."
}
```

**Flow**: If needsESQuery → es_executor, else → analysis

---

### **6. ES Executor Node**
**Purpose**: Execute Elasticsearch query  
**Client**: elasticsearch v13 (compatible with port forwarding)  
**Output**:
```javascript
{
  esData: {
    success: true,
    total: 3,
    documentsFound: 3,
    documents: [...],
    executedAt: "2024-01-16T10:30:00Z"
  }
}
```

**Flow**: Always → analysis

---

### **7. Analysis Node** ⭐ (FINAL)
**Purpose**: Correlate all data and provide root cause analysis  
**AI Model**: GPT-4o-mini (temperature: 0.3)  
**Inputs**:
- User issue
- Classification
- SQL results
- ES results

**Output**:
```javascript
{
  rootCause: "Clear explanation",
  evidence: ["Evidence 1", "Evidence 2"],
  explanation: "Detailed explanation",
  confidence: "high|medium|low",
  dataGaps: ["Missing data X"],
  nextSteps: ["Action 1", "Action 2"],
  affectedEntities: {
    customers: [...],
    orders: [...]
  },
  analysisCompletedAt: "..."
}
```

**Flow**: Always → END

---

## 📤 Final API Response

```json
{
  "status": "success",
  "message": "Issue analyzed successfully",
  "data": {
    "subject": "...",
    "body": "...",
    "classification": {
      "priority": "high",
      "category": "database",
      "reasoning": "..."
    },
    "sqlAnalysis": {
      "queries": ["SELECT ..."],
      "executed": true,
      "rowCount": 15,
      "dataPreview": [...]
    },
    "esAnalysis": {
      "queries": [{"query": {...}}],
      "executed": true,
      "total": 3,
      "documents": [...]
    },
    "analysis": {
      "rootCause": "...",
      "evidence": [...],
      "explanation": "...",
      "confidence": "high",
      "dataGaps": [],
      "nextSteps": [...],
      "affectedEntities": {...}
    },
    "processedAt": "2024-01-16T10:30:00Z"
  }
}
```

---

## ⚙️ Configuration

### **Environment Variables:**
```bash
# Required
OPENAI_API_KEY=sk-...
NODE_ENV=local|staging|production

# MySQL
MYSQL_CLUSTER_SLAVE_USER=root
MYSQL_CLUSTER_SLAVE_PASSWORD=
MYSQL_CLUSTER_SLAVE_DATABASE=wealthmgmt

# Optional (auto-configured)
OPENAI_MODEL=gpt-4o-mini
```

### **Services Initialized on Startup:**
1. ✅ Schema Vector Store (table embeddings)
2. ✅ MySQL Connection Pool
3. ✅ Elasticsearch Client (optional)

---

## 🧪 Testing

### **Complete Flow Test:**
```bash
curl -X POST http://localhost:3000/api/v1/issues/debug \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Customer 1001656012 gold balance issue",
    "body": "Customer reports their gold balance is showing 0.5g but they purchased 2g yesterday. Need to investigate urgently.",
    "metadata": {
      "source": "slack",
      "priority": "high"
    }
  }'
```

### **Expected Execution Time:**
- Mandatory Details: ~10ms
- Classify Issue: ~1-2s (AI)
- SQL Query: ~2-3s (RAG + AI)
- SQL Executor: ~50-200ms (MySQL)
- ES Query: ~1-2s (AI)
- ES Executor: ~100-300ms (ES)
- Analysis: ~2-4s (AI)

**Total: ~8-15 seconds**

---

## 🎯 Success Criteria

✅ All nodes execute successfully  
✅ SQL queries return relevant data  
✅ ES queries match orders/customers  
✅ Analysis provides clear root cause  
✅ Evidence is specific and data-backed  
✅ Next steps are actionable  
✅ Confidence level is appropriate  

---

## 🔜 Future Enhancements

### **Phase 2:**
- [ ] Add Loki query node (logs analysis)
- [ ] Add correlation synthesizer (cross-reference logs with DB)
- [ ] Add action executor (auto-remediation)

### **Phase 3:**
- [ ] Add query planner (smart data source selection)
- [ ] Add caching layer (Redis)
- [ ] Add similarity search (known issues)
- [ ] Add trend analysis (recurring issues)

---

## 🎉 Current Status

✅ **Phase 1 Complete!**

All core nodes implemented:
- ✅ Mandatory validation
- ✅ AI classification
- ✅ RAG-based SQL query generation
- ✅ SQL execution
- ✅ ES query generation
- ✅ ES execution
- ✅ Final analysis with root cause

**The system is now fully functional for database and transaction issue debugging!**

