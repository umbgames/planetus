import express from 'express';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Proxy for Twitter API to avoid CORS issues
  app.post('/api/twitter/search', async (req, res) => {
    const { token, query } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Bearer token is required' });
    }

    try {
      const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query || 'tech')}&tweet.fields=public_metrics,created_at,author_id,entities&expansions=author_id&user.fields=name,username,profile_image_url&max_results=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: `Twitter API error: ${response.statusText}`, details: errorText });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch from Twitter API', details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist', { index: false }));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) return res.status(404).end();
      res.sendFile(new URL('./dist/index.html', import.meta.url).pathname);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
