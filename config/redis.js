const redis = require('redis');

const REDIS_HOST = 'your-aws-redis-endpoint'; // Example: my-cluster.xxxxxx.use1.cache.amazonaws.com
const REDIS_PORT = 6379; // Default Redis port
const REDIS_PASSWORD = 'your-redis-password-if-enabled'; // Only if AUTH is enabled

const client = redis.createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT
  },
  password: REDIS_PASSWORD || undefined,
});

client.on('error', (err) => console.error('Redis Client Error', err));

async function connectRedis() {
  await client.connect();
  console.log('Connected to AWS ElastiCache Redis');
}

connectRedis();

module.exports = client;
