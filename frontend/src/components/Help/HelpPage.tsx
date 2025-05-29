import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { ChevronRight, Home, Search, FileText, Folder, Menu, X } from 'lucide-react';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    
    // Close sidebar on mobile when content changes
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [pathParam]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('docs-sidebar');
      const menuButton = document.getElementById('mobile-menu-button');
      
      if (
        isSidebarOpen &&
        sidebar &&
        !sidebar.contains(event.target as Node) &&
        menuButton &&
        !menuButton.contains(event.target as Node)
      ) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSidebarOpen]);

  // Render document tree
  const renderDocTree = (items: DocStructure[], level = 0) => {
    return items.map((item) => (
      <div key={item.path} className={`ml-${level * 3}`}>
        <Link
          to={`/help/${item.path}`}
          className={`flex items-center px-3 py-2 rounded-md text-sm hover:${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'} transition-colors ${
            (pathParam === item.path || (pathParam === '' && item.path === 'getting-started')) ? (theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200') : ''
          }`}
          onClick={() => {
            // Close sidebar on mobile when link is clicked
            if (window.innerWidth < 1024) {
              setIsSidebarOpen(false);
            }
          }}
        >
          {item.type === 'folder' ? (
            <Folder className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />
          ) : (
            <FileText className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
          )}
          <span className="truncate">{item.name}</span>
        </Link>
        {item.children && (
          <div className="ml-3">
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
          if (!filtered.find(f => f.path === item.path)) {
            filtered.push({
              ...item,
              children: filteredChildren
            });
          } else {
             const existingItem = filtered.find(f => f.path === item.path);
             if(existingItem && existingItem.children) {
                existingItem.children = [...existingItem.children, ...filteredChildren].filter((v,i,a)=>a.findIndex(t=>(t.path === v.path))===i);
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
        <div
          id="docs-sidebar"
          className={`
            ${sidebarBg} ${borderColor} border-r flex flex-col flex-shrink-0
            lg:w-80 lg:relative lg:translate-x-0
            fixed inset-y-0 left-0 z-40 w-80 transform transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b ${borderColor}">
            <div className="flex items-center justify-between lg:justify-center">
              <h2 className="text-lg font-semibold">Documentation</h2>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-4 flex flex-col flex-grow overflow-hidden">
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documentation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border ${searchBorder} ${searchBg} focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
                />
              </div>
            </div>

            {/* Navigation Tree */}
            <div className="space-y-1 overflow-y-auto flex-grow">
              {renderDocTree(filteredDocs)}
            </div>
          </div>
        </div>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-8 max-w-4xl mx-auto">
              {/* Mobile Docs Menu Button - positioned in content area */}
              <div className="lg:hidden mb-4">
                <button
                  id="mobile-menu-button"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`flex items-center px-3 py-2 rounded-md ${theme === 'dark' ? 'bg-gray-800 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'} border shadow-sm hover:shadow-md transition-shadow`}
                >
                  <Menu className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">Documentation Menu</span>
                </button>
              </div>
              
              {/* Breadcrumbs */}
              <nav className="flex mb-6 lg:mb-8" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-2 flex-wrap">
                  {breadcrumbs.map((crumb, index) => (
                    <li key={crumb.path} className="flex items-center">
                      {index === 0 && breadcrumbs.length > 1 && pathParam !== '' ? (
                         <Link
                          to={crumb.path}
                          className="text-blue-600 hover:text-blue-800 transition-colors flex items-center text-sm lg:text-base"
                        >
                           <Home className="h-4 w-4 mr-1" /> 
                           <span className="hidden sm:inline">{crumb.name}</span>
                           <span className="sm:hidden">Help</span>
                         </Link>
                      ) : index === 0 && (pathParam === '' || breadcrumbs.length === 1) ? (
                        <span className="text-gray-500 flex items-center text-sm lg:text-base">
                          <Home className="h-4 w-4 mr-1" /> 
                          <span className="hidden sm:inline">{crumb.name}</span>
                          <span className="sm:hidden">Help</span>
                        </span>
                      ) : (
                        <ChevronRight className="h-4 w-4 mx-1 lg:mx-2 text-gray-400 flex-shrink-0" />
                      )}
                      {index > 0 && (
                        index === breadcrumbs.length - 1 ? (
                          <span className="text-gray-500 text-sm lg:text-base truncate max-w-xs lg:max-w-none">{crumb.name}</span>
                        ) : (
                          <Link
                            to={crumb.path}
                            className="text-blue-600 hover:text-blue-800 transition-colors text-sm lg:text-base truncate max-w-xs lg:max-w-none"
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
                <div className={`
                  prose prose-sm sm:prose lg:prose-lg max-w-none 
                  ${theme === 'dark' ? 'prose-invert' : ''}
                  prose-headings:font-semibold
                  prose-a:text-blue-600 hover:prose-a:text-blue-800
                  prose-code:text-sm prose-code:bg-gray-100 dark:prose-code:bg-gray-800
                  prose-pre:text-sm prose-pre:overflow-x-auto
                  prose-img:rounded-lg prose-img:shadow-md
                `}>
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
    </div>
  );
};

export default HelpPage; 