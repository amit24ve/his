import { Link, useLocation } from 'react-router-dom';

const Breadcrumb = () => {
  const location = useLocation();
  
  // Get the current page name from the pathname
  const getPageName = (path) => {
    switch(path) {
      case '/':
        return 'Dashboard';
      case '/leads':
        return 'Lead Management';
      case '/quotations':
        return 'Quotations';
      case '/payments':
        return 'Payment Tracking';
      default:
        return path.split('/').pop().charAt(0).toUpperCase() + path.split('/').pop().slice(1);
    }
  };
  
  // Current path
  const currentPage = getPageName(location.pathname);
  
  return (
    <div className="flex items-center text-sm mb-md">
      <Link to="/" className="text-primary hover:underline">Home</Link>
      <i className="fas fa-chevron-right text-text-secondary mx-xs text-xs"></i>
      <span className="text-text-secondary">{currentPage}</span>
    </div>
  );
};

export default Breadcrumb;