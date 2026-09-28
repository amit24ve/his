import { useState } from 'react';

const Pagination = ({ totalItems = 28, itemsPerPage = 6 }) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  // Calculate total number of pages
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Calculate range of items being displayed
  const firstItem = (currentPage - 1) * itemsPerPage + 1;
  const lastItem = Math.min(currentPage * itemsPerPage, totalItems);
  
  // Generate array of page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      // If we have fewer pages than maxPagesToShow, display all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always include first page
      pages.push(1);
      
      // Calculate middle pages
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if at start or end
      if (currentPage <= 2) {
        endPage = 4;
      } else if (currentPage >= totalPages - 1) {
        startPage = totalPages - 3;
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Always include last page
      if (endPage < totalPages - 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };
  
  // Handle page change
  const changePage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };
  
  const pageNumbers = getPageNumbers();
  
  return (
    <div className="flex justify-between items-center p-md bg-bg-card rounded-md mt-md">
      <div className="pagination-info text-sm text-text-secondary">
        Showing <strong>{firstItem}-{lastItem}</strong> of <strong>{totalItems}</strong> leads
      </div>
      <div className="pagination-controls flex gap-sm">
        <button 
          onClick={() => changePage(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-8 h-8 bg-light border-none rounded-sm flex items-center justify-center
                     hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        
        {pageNumbers.map(pageNum => (
          <button
            key={pageNum}
            onClick={() => changePage(pageNum)}
            className={`w-8 h-8 border-none rounded-sm flex items-center justify-center transition-colors
                       ${currentPage === pageNum ? 'bg-secondary text-white' : 'bg-light hover:bg-gray-300'}`}
          >
            {pageNum}
          </button>
        ))}
        
        <button 
          onClick={() => changePage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-8 h-8 bg-light border-none rounded-sm flex items-center justify-center
                     hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

export default Pagination;