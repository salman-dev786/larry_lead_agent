# Larry the Lead Agent API

A Node.js API service that integrates with BatchData to fetch property leads.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your BatchData API token:
```
BATCHDATA_API_TOKEN=your_token_here
PORT=3000
```

3. Start the server:
```bash
node server.js
```

## API Endpoints

### GET /api/leads

Fetches property leads with optional filtering.

Query Parameters:
- `city`: Filter by city name
- `state`: Filter by state code (e.g., CA, NY)
- `quickList`: Filter by quick list type (inherited, vacant, cash_buyers)
- `limit`: Number of results per page (default: 10)
- `offset`: Pagination offset (default: 0)

Example Request:
```
GET http://localhost:3000/api/leads?city=Los Angeles&state=CA&quickList=vacant&limit=10
```

Example Response:
```json
{
    "leads": [
        {
            "street_address": "123 Main St",
            "city": "Los Angeles",
            "state": "CA",
            "zip": "90001",
            "owner_full_name": "John Doe",
            "owner_mailing_street": "456 Elm St",
            "owner_mailing_city": "San Diego",
            "owner_mailing_state": "CA",
            "owner_mailing_zip": "92101"
        }
    ]
}
```

### GET /health

Health check endpoint to verify the API is running.

Example Response:
```json
{
    "status": "ok"
}
``` 