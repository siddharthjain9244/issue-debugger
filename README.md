# LangChain Issue Debugger

An AI-powered issue debugging system built with Node.js, LangChain, and LangGraph.

## Architecture

This system uses a LangGraph orchestration engine to analyze and debug issues through multiple specialized nodes:

1. **mandatory_details_node** - Validates required information
2. **classify_issue_node** - Determines issue priority
3. **query_planner_node** - Decides which data sources to query
4. **sql_query_node** - Extracts data from SQL databases
5. **loki_query_node** - Extracts logs from Loki
6. **correlation_synthesizer_node** - Combines all data
7. **action_executer_node** - Generates AI analysis using AWS Bedrock

## Getting Started

### Prerequisites

- Node.js 18+ (with ES modules support)
- npm or yarn

### Installation

1. Clone the repository

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

**Note**: We use `elasticsearch` v13 (not `@elastic/elasticsearch` v8) because it works better with port forwarding and SSH tunnels.

3. Copy the environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
   - `OPENAI_API_KEY` - Required for AI classification and query generation
   - `NODE_ENV` - `local`, `staging`, or `production`
   - MySQL credentials (see `.env.example`)
   - Elasticsearch will auto-configure based on `NODE_ENV`

### Running the Application

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:3000`

### Testing Service Connectivity

**Test Elasticsearch connection:**
```bash
# Quick test
curl http://127.0.0.1:9200

# Or use the provided script
node test-es.js

# Bash script (if you have jq installed)
chmod +x test-es-connection.sh
./test-es-connection.sh
```

**For port forwarding from remote ES:**
```bash
# Forward remote ES to local port 9200
ssh -L 9200:10.123.4.242:9200 user@staging-server

# Keep this running, then start the app in another terminal
npm start
```

See [ES_PORT_FORWARDING.md](./ES_PORT_FORWARDING.md) for detailed guide.

## API Endpoints

### Health Check
```bash
GET /health
```

### Debug Issue
```bash
POST /api/v1/issues/debug
Content-Type: application/json

{
  "subject": "Application crashing on startup",
  "body": "The application fails to start with error code 500. This started happening after the latest deployment.",
  "metadata": {
    "source": "slack",
    "priority": "high"
  }
}
```

## Project Structure

```
langchain-node/
├── src/
│   ├── index.js                 # Application entry point
│   ├── controllers/             # Request handlers
│   │   └── issue.controller.js
│   ├── routes/                  # API routes
│   │   └── issue.routes.js
│   ├── services/                # Business logic (to be added)
│   ├── nodes/                   # LangGraph nodes (to be added)
│   └── utils/                   # Utility functions
│       └── logger.js
├── .env                         # Environment variables
├── .env.example                 # Environment template
├── package.json                 # Dependencies
└── README.md                    # Documentation
```

## Development Status

- [x] Basic project setup
- [x] Express API with issue endpoint
- [x] LangGraph workflow orchestration
- [x] Mandatory details validation node
- [x] AI-powered issue classification node
- [x] SQL query generation with RAG (vector embeddings)
- [x] SQL query execution with MySQL
- [x] Elasticsearch query generation
- [x] Elasticsearch query execution
- [ ] Query planner node (commented out for now)
- [ ] Loki query node (logs)
- [ ] Correlation synthesizer node
- [ ] Action executor node with AWS Bedrock

## License

MIT

