
# CampusTrace Backend - Setup Guide

## Prerequisites
- Node.js (v16+)
- MongoDB (Running locally or on Atlas)

## Installation
1. Save `server.ts` into your backend folder.
2. Initialize and install dependencies:
```bash
npm init -y
npm install express mongoose cors dotenv
npm install --save-dev typescript ts-node @types/express @types/mongoose @types/cors @types/node
```

## Running the Server
```bash
# Development mode
npx ts-node server.ts

# Production mode
tsc server.ts
node server.js
```

## API Testing with Curl
**Login (Simulated):**
The API identifies you via the `X-User-Email` header.

**Post a Found Item:**
```bash
curl -X POST http://localhost:5000/items/found \
  -H "Content-Type: application/json" \
  -H "X-User-Email: user@uni.edu" \
  -d '{
    "title": "AirPods Pro",
    "category": "Electronics",
    "description": "Found near the library",
    "location": "Main Library",
    "date": "2024-05-20"
  }'
```

**Get Items (Filtered):**
`GET /items?category=Electronics&type=found`

## Environment Variables
Create a `.env` file:
```env
PORT=5000
MONGO_URI=mongodb://your_mongo_url
```
