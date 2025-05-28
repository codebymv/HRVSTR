import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { ChevronRight, Home, Search, FileText, Folder } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { docsService, DocStructure } from '../../services/docsService';

interface Breadcrumb {
  name: string;
  path: string;
}

const HelpPage: React.FC = () => {
  const { '*': pathParam } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [docStructure, setDocStructure] = useState<DocStructure[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);

  // Theme classes
  const bgColor = theme === 'dark' ? 'bg-gray-900' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-gray-100' : 'text-gray-900';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
  const sidebarBg = theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50';
  const searchBg = theme === 'dark' ? 'bg-gray-700' : 'bg-white';
  const searchBorder = theme === 'dark' ? 'border-gray-600' : 'border-gray-300';

  // Load document structure on component mount
  useEffect(() => {
    const loadDocStructure = async () => {
      try {
        const structure = await docsService.getDocStructure();
        setDocStructure(structure);
      } catch (error) {
        console.error('Failed to load doc structure:', error);
      }
    };

    loadDocStructure();
  }, []);

  // Load markdown content
  const loadMarkdownContent = async (path: string) => {
    try {
      setLoading(true);
      // If path is empty (root /help) or 'getting-started', fetch 'getting-started.md'
      const effectivePath = (!path || path === '/') ? 'getting-started' : path;
      const markdownContent = await docsService.getDocContent(effectivePath);
      setContent(markdownContent);
    } catch (error) {
      setContent('## Error\n\nUnable to load documentation content.');
    } finally {
      setLoading(false);
    }
  };

  // Update path and breadcrumbs
  useEffect(() => {
    const path = pathParam || ''; // Default to empty string if undefined, which means /help
    const pathSegments = path.split('/').filter(Boolean);
    setCurrentPath(pathSegments);

    // Generate breadcrumbs
    const crumbs: Breadcrumb[] = [{ name: 'Help', path: '/help' }];
    let currentCrumbPath = '/help';

    pathSegments.forEach((segment) => {
      currentCrumbPath += `/${segment}`;
      crumbs.push({
        name: segment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        path: currentCrumbPath
      });
    });

    setBreadcrumbs(crumbs);
    loadMarkdownContent(path);
  }, [pathParam]);

  // Render document tree
  const renderDocTree = (items: DocStructure[], level = 0) => {
    return items.map((item) => (
      <div key={item.path} className={`ml-${level * 4}`}>
        <Link
          to={`/help/${item.path}`}
          className={`flex items-center px-3 py-2 rounded-md text-sm hover:${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'} transition-colors ${
            (pathParam === item.path || (pathParam === '' && item.path === 'getting-started')) ? (theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200') : ''
          }`}
        >
          {item.type === 'folder' ? (
            <Folder className="h-4 w-4 mr-2 text-blue-500" />
          ) : (
            <FileText className="h-4 w-4 mr-2 text-green-500" />
          )}
          {item.name}
        </Link>
        {item.children && (
          <div className="ml-4">
            {renderDocTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  // Filter docs for search
  const getFilteredDocs = (items: DocStructure[], searchTerm: string): DocStructure[] => {
    if (!searchTerm) return items;

    const filtered: DocStructure[] = [];
    
    items.forEach(item => {
      if (item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        filtered.push(item);
      }
      if (item.children) {
        const filteredChildren = getFilteredDocs(item.children, searchTerm);
        if (filteredChildren.length > 0) {
          if (!filtered.find(f => f.path === item.path)) { // Avoid duplicating parent if child matches
            filtered.push({
              ...item,
              children: filteredChildren
            });
          } else {
             const existingItem = filtered.find(f => f.path === item.path);
             if(existingItem && existingItem.children) {
                existingItem.children = [...existingItem.children, ...filteredChildren].filter((v,i,a)=>a.findIndex(t=>(t.path === v.path))===i); // merge and deduplicate children
             } else if (existingItem) {
                existingItem.children = filteredChildren;
             }
          }
        }
      }
    });

    return filtered;
  };

  const filteredDocs = getFilteredDocs(docStructure, searchTerm);

  return (
    <div className={`min-h-screen ${bgColor} ${textColor}`}>
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className={`w-80 ${sidebarBg} ${borderColor} border-r p-4 flex flex-col flex-shrink-0`}>
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search documentation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${searchBorder} ${searchBg} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
          </div>

          {/* Navigation Tree */}
          <div className="space-y-1 overflow-y-auto flex-grow">
            {renderDocTree(filteredDocs)}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          {/* Breadcrumbs */}
          <nav className="flex mb-8" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              {breadcrumbs.map((crumb, index) => (
                <li key={crumb.path} className="flex items-center">
                  {index === 0 && breadcrumbs.length > 1 && pathParam !== '' ? (
                     <Link
                      to={crumb.path}
                      className="text-blue-600 hover:text-blue-800 transition-colors flex items-center"
                    >
                       <Home className="h-4 w-4 mr-1" /> {crumb.name}
                     </Link>
                  ) : index === 0 && (pathParam === '' || breadcrumbs.length === 1) ? (
                    <span className="text-gray-500 flex items-center"><Home className="h-4 w-4 mr-1" /> {crumb.name}</span>
                  ) : (
                    <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />
                  )}
                  {index > 0 && (
                    index === breadcrumbs.length - 1 ? (
                      <span className="text-gray-500">{crumb.name}</span>
                    ) : (
                      <Link
                        to={crumb.path}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {crumb.name}
                      </Link>
                    )
                  )}
                </li>
              ))}
            </ol>
          </nav>

          {/* Content */}
          <div className="max-w-4xl">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-4/6"></div>
                </div>
              </div>
            ) : (
              <div className={`prose prose-lg max-w-none ${theme === 'dark' ? 'prose-invert' : ''}`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage; 