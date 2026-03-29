# Load Balancing Configuration for Youngie Backend

## Overview
This configuration enables horizontal scaling and load balancing for the Express.js backend server using Node.js clustering.

## Configuration

### Environment Variables (`.env`)

```env
# Load Balancing Settings
CLUSTER_MODE=true          # Enable cluster mode (true/false)
NUM_WORKERS=4             # Number of worker processes (default: CPU cores)
PORT=5001                 # Server port
HOST=0.0.0.0              # Bind address
NODE_ENV=development       # Environment (development/production)
```

### MongoDB Connection Pool Settings
The server now uses connection pooling for better load distribution:
- `maxPoolSize: 10` - Maximum connections in pool
- `minPoolSize: 2` - Minimum connections to maintain

## Health Check Endpoints

### Basic Health Check
```
GET /health
```
Returns server status and worker information.

### Load Balancer Health Check
```
GET /health/loadbalancer
```
Returns detailed metrics including:
- Memory usage (heap, RSS)
- CPU usage
- Uptime
- Active connections
- Load balancing mode

## Running the Server

### Development Mode (Single Process)
```bash
CLUSTER_MODE=false npm start
```

### Production Mode (Cluster with Load Balancing)
```bash
CLUSTER_MODE=true npm start
```

### Using PM2 for Production Load Balancing
```bash
# Install PM2
npm install -g pm2

# Start with cluster mode
pm2 start server.js -i 4 --env production

# Or use ecosystem config
pm2 start ecosystem.config.js
```

## Nginx Configuration for Load Balancing

```nginx
upstream youngie_backend {
    least_conn;  # Least connections strategy
    server localhost:5001;
    server localhost:5002;
    server localhost:5003;
    server localhost:5004;
}

server {
    listen 80;
    server_name api.youngie.com;

    location / {
        proxy_pass http://youngie_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        
        # Sticky sessions for WebSocket
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO WebSocket support
    location /socket.io/ {
        proxy_pass http://youngie_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

## Socket.IO Sticky Sessions

For WebSocket connections in a clustered environment, use Redis adapter:

```bash
npm install @socket.io/redis-adapter redis
```

Then configure in server.js:
```javascript
const { createAdapter } = require("@socket.io/redis-adapter");
const redis = require("redis");

const pubClient = redis.createClient({ host: 'localhost', port: 6379 });
const subClient = redis.createClient({ host: 'localhost', port: 6379 });

io.adapter(createAdapter(pubClient, subClient));
```

## WebRTC / Video Chat Load Balancing

### TURN Server Configuration (Metered.ca)
The server fetches TURN credentials from Metered.ca API:

```env
METERED_API_KEY=your_metered_api_key
```

Fallback static TURN servers:
```env
TURN_SERVER_URL=turn:global.metered.ca:443
TURN_USERNAME=your_username
TURN_CREDENTIAL=your_credential
```

### Socket.IO Clustering with Redis
For multi-server WebSocket support:

1. Install Redis adapter:
```bash
cd backend && npm install @socket.io/redis-adapter redis
```

2. Set REDIS_URL in .env:
```env
REDIS_URL=redis://username:password@host:port
```

3. The server automatically uses Redis adapter when REDIS_URL is set

### Video Chat Features
- **User Matching**: Automatic pairing of random users
- **WebRTC Signaling**: Offer/Answer/ICE candidate exchange
- **Connection Management**: Handles disconnects and reconnection

## Load Balancing Strategies

### Round Robin (Default)
Requests distributed evenly across workers.

### Least Connections
Route to worker with fewest active connections.

### IP Hash
Same client always routed to same worker (for session persistence).

## Monitoring

Monitor worker health:
```bash
# Check worker status
curl http://localhost:5001/health/loadbalancer

# Check all workers (if using nginx)
curl http://localhost:5001/health
curl http://localhost:5002/health
```

## Scaling Recommendations

1. **CPU-bound operations**: Scale to number of CPU cores
2. **I/O-bound operations**: Can use more workers than cores
3. **Memory-intensive**: Monitor memory per worker
4. **WebSocket-heavy**: Use Redis adapter for cross-worker messaging

## MongoDB Connection Load Balancing

### Configuration
The server now uses MongoDB Atlas with built-in load balancing and the following optimizations:

```javascript
const mongoOptions = {
  // Connection Pooling
  maxPoolSize: 10,        // Maximum connections
  minPoolSize: 2,         // Minimum connections
  maxIdleTimeMS: 30000,   // Idle timeout

  // Retry Configuration (High Availability)
  retryWrites: true,      // Retry failed writes
  retryReads: true,       // Retry failed reads

  // Read Load Distribution
  readPreference: 'secondaryPreferred', // Distribute reads across secondaries

  // Timeouts
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,

  // Write Concern
  w: 'majority',
};
```

### Features
- **Connection Pooling**: Reuses connections for better performance
- **Automatic Retries**: Handles transient failures automatically
- **Read Distribution**: Balances read queries across replica set members
- **Auto Reconnect**: Automatic reconnection on disconnection

### MongoDB Atlas Features Being Used
- **Built-in Load Balancing**: Atlas handles traffic distribution
- **Replica Set**: Automatic failover
- **Storage**: Auto-scaling storage

> Note: For multi-region deployment, configure readPreference based on your deployment.