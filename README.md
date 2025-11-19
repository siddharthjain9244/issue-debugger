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
npm install
```

3. Copy the environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration

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
- [ ] LangGraph workflow implementation
- [ ] Individual node implementations
- [ ] AWS Bedrock integration

## License

MIT

