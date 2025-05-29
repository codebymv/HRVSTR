const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Function to find the docs folder in different deployment scenarios
const findDocsPath = () => {
  // Possible locations for the !docs folder
  const possiblePaths = [
    path.join(__dirname, '../../docs'),          // Copied docs folder in backend/docs
    path.join(__dirname, '../../../!docs'),      // Development: backend/src/routes -> project root
    path.join(__dirname, '../../!docs'),         // Production scenario 1: backend -> project root
    path.join(__dirname, '../!docs'),            // Production scenario 2: src -> project root
    path.join(__dirname, '../../../../!docs'),   // Production scenario 3: deeper nesting
    path.join(process.cwd(), '!docs'),          // Using process working directory
    path.join(process.cwd(), '../!docs'),       // One level up from working directory
    path.join(process.cwd(), 'docs'),           // Copied docs in working directory
  ];

  // Try each path and return the first one that exists
  for (const docsPath of possiblePaths) {
    try {
      // Check if the path exists and is a directory
      const stats = require('fs').statSync(docsPath);
      if (stats.isDirectory()) {
        console.log(`Found docs folder at: ${docsPath}`);
        return docsPath;
      }
    } catch (error) {
      // Path doesn't exist, try next one
      continue;
    }
  }

  // If no docs folder found, log error and use default
  console.error('!docs folder not found in any expected location. Tried:', possiblePaths);
  return path.join(__dirname, '../../../!docs'); // fallback to original path
};

// Base path to the docs folder
const DOCS_BASE_PATH = findDocsPath();

/**
 * Get markdown content for a specific document path
 * GET /api/docs/content?path=getting-started
 * GET /api/docs/content?path=API/api-overview
 */
router.get('/content', async (req, res) => {
  try {
    const { path: docPath } = req.query;
    
    if (!docPath) {
      return res.status(400).json({
        error: 'Path parameter is required'
      });
    }

    // Construct the full file path
    const fileName = docPath.endsWith('.md') ? docPath : `${docPath}.md`;
    const fullPath = path.join(DOCS_BASE_PATH, fileName);

    // Security check: ensure the path is within the docs directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedDocsPath = path.resolve(DOCS_BASE_PATH);
    
    if (!resolvedPath.startsWith(resolvedDocsPath)) {
      return res.status(403).json({
        error: 'Access denied: Path outside docs directory'
      });
    }

    try {
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const stats = await fs.stat(resolvedPath);
      
      res.json({
        content,
        path: docPath,
        lastModified: stats.mtime.toISOString(),
        size: stats.size
      });
    } catch (fileError) {
      if (fileError.code === 'ENOENT') {
        res.status(404).json({
          error: 'Document not found',
          path: docPath
        });
      } else {
        throw fileError;
      }
    }
  } catch (error) {
    console.error('Error reading document:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to read document'
    });
  }
});

/**
 * Get the structure of the documentation directory
 * GET /api/docs/structure
 */
router.get('/structure', async (req, res) => {
  try {
    const structure = await buildDocStructure(DOCS_BASE_PATH);
    res.json(structure);
  } catch (error) {
    console.error('Error building doc structure:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to build documentation structure'
    });
  }
});

/**
 * Search documentation files
 * GET /api/docs/search?q=API
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query parameter is required'
      });
    }

    const searchResults = await searchDocuments(DOCS_BASE_PATH, query.trim());
    res.json(searchResults);
  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to search documents'
    });
  }
});

/**
 * Recursively build the documentation directory structure
 */
async function buildDocStructure(dirPath, relativePath = '') {
  const items = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const relativeEntryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        const children = await buildDocStructure(entryPath, relativeEntryPath);
        items.push({
          name: formatName(entry.name),
          path: relativeEntryPath,
          type: 'folder',
          children
        });
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const nameWithoutExt = entry.name.replace('.md', '');
        const pathWithoutExt = relativeEntryPath.replace('.md', '');
        
        items.push({
          name: formatName(nameWithoutExt),
          path: pathWithoutExt,
          type: 'file'
        });
      }
    }
    
    // Sort items: folders first, then files, both alphabetically
    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
    return items;
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

/**
 * Search for documents containing the query text
 */
async function searchDocuments(dirPath, query, relativePath = '', results = []) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const relativeEntryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        await searchDocuments(entryPath, query, relativeEntryPath, results);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const content = await fs.readFile(entryPath, 'utf-8');
          const nameWithoutExt = entry.name.replace('.md', '');
          const pathWithoutExt = relativeEntryPath.replace('.md', '');
          
          // Search in filename and content
          const nameMatch = nameWithoutExt.toLowerCase().includes(query.toLowerCase());
          const contentMatch = content.toLowerCase().includes(query.toLowerCase());
          
          if (nameMatch || contentMatch) {
            results.push({
              name: formatName(nameWithoutExt),
              path: pathWithoutExt,
              type: 'file',
              excerpt: contentMatch ? extractExcerpt(content, query) : null
            });
          }
        } catch (readError) {
          console.error(`Error reading file ${entryPath}:`, readError);
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error searching directory ${dirPath}:`, error);
    return results;
  }
}

/**
 * Extract a text excerpt around the search query
 */
function extractExcerpt(content, query, contextLength = 100) {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);
  
  if (index === -1) return null;
  
  const start = Math.max(0, index - contextLength);
  const end = Math.min(content.length, index + query.length + contextLength);
  
  let excerpt = content.substring(start, end);
  
  // Add ellipsis if we truncated
  if (start > 0) excerpt = '...' + excerpt;
  if (end < content.length) excerpt = excerpt + '...';
  
  return excerpt;
}

/**
 * Format file/directory names for display
 */
function formatName(name) {
  return name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

module.exports = router; 