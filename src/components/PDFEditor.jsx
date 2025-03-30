import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Container, Paper, Typography, IconButton, Slider, Dialog, DialogContent, TextField } from '@mui/material';
import { useDropzone } from 'react-dropzone';
import SignaturePad from 'react-signature-canvas';
import { PDFDocument } from 'pdf-lib';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CreateIcon from '@mui/icons-material/Create';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Document, Page, pdfjs } from 'react-pdf';
import './PDFEditor.css';
import DeleteIcon from '@mui/icons-material/Delete';
import UndoIcon from '@mui/icons-material/Undo';
import CloseIcon from '@mui/icons-material/Close';

// Set up the worker for react-pdf with a CDN approach
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PDFEditor = () => {
  // State variables for PDF and signature management
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [signatureUrl, setSignatureUrl] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isDrawSignatureModalOpen, setIsDrawSignatureModalOpen] = useState(false);
  const [tempSignaturePosition, setTempSignaturePosition] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [signatureSize] = useState({ width: 150, height: 50 });
  const [isDraggingSignature, setIsDraggingSignature] = useState(false);
  const [activeSignature, setActiveSignature] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [pdfError, setPdfError] = useState(null);
  const [useEmbedFallback, setUseEmbedFallback] = useState(false);
  const [signatureColor, setSignatureColor] = useState('#000000');
  const [penSize, setPenSize] = useState(2);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [selectedSignature, setSelectedSignature] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartData, setResizeStartData] = useState(null);

  // Refs for signature pad, PDF container, drawing canvas and its context
  const signatureRef = useRef(null);
  const pdfContainerRef = useRef(null);
  const signatureRefs = useRef({});

  // Modify history state to store actual states
  const [history, setHistory] = useState({
    states: [{
      signatures: [],
      annotations: []
    }],
    currentIndex: 0
  });

  // Get total pages when PDF is loaded
  useEffect(() => {
    if (pdfFile) {
      (async () => {
        try {
          const arrayBuffer = await pdfFile.arrayBuffer();
          const pdf = await PDFDocument.load(arrayBuffer);
          setTotalPages(pdf.getPageCount());
        } catch (error) {
          console.error('Error loading PDF:', error);
        }
      })();
    }
  }, [pdfFile]);

  // Handle PDF container click for signatures or text
  const handlePdfClick = (event) => {
    if (!pdfContainerRef.current || !pdfUrl) return;

    const pdfPage = pdfContainerRef.current.querySelector('.react-pdf__Page');
    if (!pdfPage) return;

    const pdfRect = pdfPage.getBoundingClientRect();
    
    if (
      event.clientX < pdfRect.left || 
      event.clientX > pdfRect.right || 
      event.clientY < pdfRect.top || 
      event.clientY > pdfRect.bottom
    ) {
      return;
    }

    const x = (event.clientX - pdfRect.left) / scale;
    const y = (event.clientY - pdfRect.top) / scale;

    if (!drawingMode) {
      setTempSignaturePosition({ x, y });
      setIsSignatureModalOpen(true);
    }
  };

  // Toggle full screen mode
  const toggleFullScreen = () => {
    if (!isFullScreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if (document.documentElement.mozRequestFullScreen) {
        document.documentElement.mozRequestFullScreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
      } else if (document.documentElement.msRequestFullscreen) {
        document.documentElement.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
    setIsFullScreen(!isFullScreen);
  };

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(
        document.fullscreenElement || 
        document.mozFullScreenElement || 
        document.webkitFullscreenElement || 
        document.msFullscreenElement
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Function to add action to history
  const addToHistory = () => {
    const newState = {
      signatures: [...signatures],
      annotations: [...annotations]
    };
    
    setHistory(prev => {
      // Remove any future states if we're in the middle of the history
      const newStates = prev.states.slice(0, prev.currentIndex + 1);
      return {
        states: [...newStates, newState],
        currentIndex: prev.currentIndex + 1
      };
    });
  };

  // Undo function
  const handleUndo = () => {
    if (history.currentIndex > 0) {
      const previousState = history.states[history.currentIndex - 1];
      setSignatures(previousState.signatures);
      setAnnotations(previousState.annotations);
      setHistory(prev => ({
        ...prev,
        currentIndex: prev.currentIndex - 1
      }));
    }
  };

  // Modify signature and text placement functions to add to history
  const confirmSignaturePlacement = () => {
    if (tempSignaturePosition && signatureUrl) {
      const newSignature = {
        id: Date.now(),
        url: signatureUrl,
        position: tempSignaturePosition,
        page: currentPage,
      };
      setSignatures(prev => {
        const newSignatures = [...prev, newSignature];
        // Add to history after state update
        setTimeout(() => addToHistory(), 0);
        return newSignatures;
      });
      setIsSignatureModalOpen(false);
      setTempSignaturePosition(null);
    }
  };

  // Enhanced signature dragging handlers
  const handleMouseDown = (event, signature) => {
    event.preventDefault();
    setIsDraggingSignature(true);
    setActiveSignature(signature);
    
    // Store initial mouse position relative to signature
    const signatureElement = signatureRefs.current[signature.id];
    if (signatureElement) {
      const rect = signatureElement.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      signatureElement.dataset.offsetX = offsetX;
      signatureElement.dataset.offsetY = offsetY;
    }
    
    event.stopPropagation();
  };

  const handleMouseMove = (event) => {
    if (!isDraggingSignature || !activeSignature || !pdfContainerRef.current) return;
    event.preventDefault();
    
    // Get the position of the PDF page
    const pdfPage = pdfContainerRef.current.querySelector('.react-pdf__Page');
    if (!pdfPage) return;

    const pdfRect = pdfPage.getBoundingClientRect();
    const signatureElement = signatureRefs.current[activeSignature.id];
    
    if (signatureElement) {
      const offsetX = parseFloat(signatureElement.dataset.offsetX) || 0;
      const offsetY = parseFloat(signatureElement.dataset.offsetY) || 0;
      
      // Calculate position relative to the PDF page, accounting for offset
      const x = (event.clientX - pdfRect.left - offsetX) / scale;
      const y = (event.clientY - pdfRect.top - offsetY) / scale;
      
      // Keep signature within the bounds of the PDF page
      const boundedX = Math.max(0, Math.min(x, pdfRect.width / scale - signatureSize.width));
      const boundedY = Math.max(0, Math.min(y, pdfRect.height / scale - signatureSize.height));
      
      setSignatures(prev =>
        prev.map(sig => 
          sig.id === activeSignature.id 
            ? { ...sig, position: { x: boundedX, y: boundedY } }
            : sig
        )
      );
    }
  };

  const handleMouseUp = () => {
    if (isDraggingSignature && activeSignature) {
      // Add to history after drag
      addToHistory();
      setIsDraggingSignature(false);
      setActiveSignature(null);
    }
  };

  // Enhanced touch events for mobile
  const handleTouchStart = (event, signature) => {
    event.preventDefault();
    setIsDraggingSignature(true);
    setActiveSignature(signature);
    
    // Store initial touch position relative to signature
    const signatureElement = signatureRefs.current[signature.id];
    if (signatureElement) {
      const rect = signatureElement.getBoundingClientRect();
      const touch = event.touches[0];
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;
      signatureElement.dataset.offsetX = offsetX;
      signatureElement.dataset.offsetY = offsetY;
    }
    
    event.stopPropagation();
  };

  const handleTouchMove = (event) => {
    if (!isDraggingSignature || !activeSignature || !pdfContainerRef.current) return;
    event.preventDefault();
    
    // Get the position of the PDF page
    const pdfPage = pdfContainerRef.current.querySelector('.react-pdf__Page');
    if (!pdfPage) return;

    const pdfRect = pdfPage.getBoundingClientRect();
    const signatureElement = signatureRefs.current[activeSignature.id];
    const touch = event.touches[0];
    
    if (signatureElement) {
      const offsetX = parseFloat(signatureElement.dataset.offsetX) || 0;
      const offsetY = parseFloat(signatureElement.dataset.offsetY) || 0;
      
      // Calculate position relative to the PDF page, accounting for offset
      const x = (touch.clientX - pdfRect.left - offsetX) / scale;
      const y = (touch.clientY - pdfRect.top - offsetY) / scale;
      
      // Keep signature within the bounds of the PDF page
      const boundedX = Math.max(0, Math.min(x, pdfRect.width / scale - signatureSize.width));
      const boundedY = Math.max(0, Math.min(y, pdfRect.height / scale - signatureSize.height));
      
      setSignatures(prev =>
        prev.map(sig => 
          sig.id === activeSignature.id 
            ? { ...sig, position: { x: boundedX, y: boundedY } }
            : sig
        )
      );
    }
  };

  const handleTouchEnd = () => {
    setIsDraggingSignature(false);
    setActiveSignature(null);
  };

  // Add signature copy functionality
  const handleSignatureDoubleClick = (event, signature) => {
    event.preventDefault();
    event.stopPropagation();
    
    const newSignature = {
      ...signature,
      id: Date.now(),
      position: {
        x: signature.position.x + 20,
        y: signature.position.y + 20
      }
    };
    
    setSignatures(prev => {
      const newSignatures = [...prev, newSignature];
      // Add to history after state update
      setTimeout(() => addToHistory(), 0);
      return newSignatures;
    });
  };

  // Add signature delete functionality
  const handleSignatureDelete = (event, signatureId) => {
    event.preventDefault();
    event.stopPropagation();
    
    setSignatures(prev => {
      const newSignatures = prev.filter(sig => sig.id !== signatureId);
      // Add to history after state update
      setTimeout(() => addToHistory(), 0);
      return newSignatures;
    });
  };

  // Save the modified PDF
  const addSignatureToPdf = async () => {
    if (!pdfFile || signatures.length === 0) return;
    try {
      const existingPdfBytes = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      // Get the PDF page element for coordinate conversion
      const pdfPageElement = pdfContainerRef.current?.querySelector('.react-pdf__Page');
      if (!pdfPageElement) {
        throw new Error('Could not find PDF page element');
      }
      const displayRect = pdfPageElement.getBoundingClientRect();

      // Add signatures to the PDF
      for (const sig of signatures) {
        const page = pages[sig.page - 1];
        if (!page) continue;

        try {
          // Convert data URL to arraybuffer
          const base64Data = sig.url.split(',')[1];
          const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          // Embed the signature image
          const sigImg = await pdfDoc.embedPng(imageBytes);
          
          // Get page dimensions
          const { width: pageWidth, height: pageHeight } = page.getSize();
          
          // Convert screen coordinates to PDF coordinates
          const pdfX = (sig.position.x / displayRect.width) * pageWidth;
          const screenY = sig.position.y;
          const pdfY = pageHeight - ((screenY / displayRect.height) * pageHeight) - signatureSize.height;

          // Calculate signature dimensions in PDF units
          const sigWidth = (sig.size?.width || signatureSize.width) * (pageWidth / displayRect.width);
          const sigHeight = (sig.size?.height || signatureSize.height) * (pageHeight / displayRect.height);
          
          // Draw the signature with proper positioning and rotation
          page.drawImage(sigImg, {
            x: pdfX,
            y: pdfY,
            width: sigWidth,
            height: sigHeight
          });
          
          console.log(`Added signature to page ${sig.page} at position (${pdfX}, ${pdfY}) with dimensions ${sigWidth}x${sigHeight}`);
        } catch (error) {
          console.error(`Error embedding signature on page ${sig.page}:`, error);
        }
      }

      // Add text annotations if any
      for (const anno of annotations) {
        if (anno.type === 'text') {
          const page = pages[anno.page - 1];
          if (!page) continue;

          const { width: pageWidth, height: pageHeight } = page.getSize();
          
          // Convert screen coordinates to PDF coordinates
          const pdfX = (anno.position.x / displayRect.width) * pageWidth;
          const screenY = anno.position.y;
          const pdfY = pageHeight - ((screenY / displayRect.height) * pageHeight);
          
          page.drawText(anno.content, {
            x: pdfX,
            y: pdfY,
            size: (12 / displayRect.height) * pageHeight, // Scale font size
            color: { r: 0, g: 0, b: 0 }
          });
        }
      }

      // Save and download the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      const modifiedPdfBlob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const modifiedPdfUrl = URL.createObjectURL(modifiedPdfBlob);
      
      // Create a download link and trigger download
      const link = document.createElement('a');
      link.href = modifiedPdfUrl;
      link.download = 'signed_document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      URL.revokeObjectURL(modifiedPdfUrl);
      
      console.log('PDF saved successfully with signatures');
    } catch (error) {
      console.error('Error saving PDF with signatures:', error);
      alert('There was an error saving the PDF. Please try again.');
    }
  };

  // Signature pad handlers
  const clearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setSignatureUrl(null);
    }
  };

  const saveSignature = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      const dataUrl = signatureRef.current.toDataURL('image/png');
      setSignatureUrl(dataUrl);
      setIsDrawSignatureModalOpen(false);
      
      const pdfPage = pdfContainerRef.current?.querySelector('.react-pdf__Page');
      if (pdfPage) {
        const pdfRect = pdfPage.getBoundingClientRect();
        const centerX = (pdfRect.width / 2 - signatureSize.width / 2) / scale;
        const centerY = (pdfRect.height / 2 - signatureSize.height / 2) / scale;
        
        const newSignature = {
          id: Date.now(),
          url: dataUrl,
          position: { x: centerX, y: centerY },
          page: currentPage,
          color: signatureColor,
          size: { ...signatureSize }  // Include initial size
        };
        
        setSignatures(prev => {
          const newSignatures = [...prev, newSignature];
          setTimeout(() => addToHistory(), 0);
          return newSignatures;
        });
        setActiveSignature(newSignature);
        setSelectedSignature(newSignature);
      }
    }
  };

  const openDrawSignatureModal = () => {
    setIsDrawSignatureModalOpen(true);
  };

  // Page navigation
  const handlePageChange = (direction) => {
    if (direction === 'next' && currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    } else if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Create PDF preview URL
  const createPdfPreview = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error creating PDF preview:', error);
      return null;
    }
  };

  // Setup dropzone for PDF upload
  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file?.type === 'application/pdf') {
      try {
        // Store the file directly
        setPdfFile(file);
        // Create URL for the document
        const url = URL.createObjectURL(file);
        setPdfUrl(url);
        console.log('PDF file loaded:', file.name);
      } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Failed to load PDF file. Please try again.');
      }
    } else {
      console.error('Invalid file type:', file?.type);
      alert('Please upload a valid PDF file.');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  });

  // Update the onDocumentLoadSuccess function
  const onDocumentLoadSuccess = ({ numPages }) => {
    console.log('PDF loaded successfully with', numPages, 'pages');
    setNumPages(numPages);
    setTotalPages(numPages);
    setCurrentPage(1);
    setPdfError(null); // Clear any previous errors
  };

  // Update the onDocumentLoadError function
  const onDocumentLoadError = (error) => {
    console.error('Error loading PDF with react-pdf:', error);
    setPdfError('Using fallback PDF viewer.');
    // Switch to fallback approach
    setUseEmbedFallback(true);
  };

  // Add this effect to update page dimensions when the container size changes
  useEffect(() => {
    if (pdfUrl) {
      const updateDimensions = () => {
        if (pdfContainerRef.current) {
          const width = pdfContainerRef.current.offsetWidth;
          const height = pdfContainerRef.current.offsetHeight;
          
          // Use container dimensions or default to reasonable sizes
          setPageWidth(width ? width * 0.9 : 600);
          setPageHeight(height ? height * 0.9 : 800);
        } else {
          // Default sizes if container not available
          setPageWidth(600);
          setPageHeight(800);
        }
      };

      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [pdfUrl]);

  // Add a function to handle signature placement confirmation
  const handleSignaturePlacementConfirm = () => {
    // This will trigger the PDF save and download
    addSignatureToPdf();
  };

  // Add this new function before the return statement
  const handleRemovePdf = () => {
    // Reset all PDF-related states
    setPdfFile(null);
    setPdfUrl(null);
    setSignatures([]);
    setAnnotations([]);
    setCurrentPage(1);
    setTotalPages(1);
    setHistory({
      states: [{
        signatures: [],
        annotations: []
      }],
      currentIndex: 0
    });
    // Clean up URL object
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
  };

  // Add function to update signature pad color
  const updateSignaturePadColor = (color) => {
    setSignatureColor(color);
    if (signatureRef.current) {
      signatureRef.current.penColor = color;
    }
  };

  // Add function to update signature pad pen size
  const updateSignaturePadSize = (size) => {
    setPenSize(size);
    if (signatureRef.current) {
      signatureRef.current.dotSize = size;
      signatureRef.current.minWidth = size;
      signatureRef.current.maxWidth = size * 2;
    }
  };

  // Add useEffect to handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Add these new functions before the return statement
  const handleResizeStart = (e, signature) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = signatureRefs.current[signature.id].getBoundingClientRect();
    setIsResizing(true);
    setResizeStartData({
      startX: e.clientX,
      startY: e.clientY,
      startWidth: signature.size?.width || signatureSize.width,
      startHeight: signature.size?.height || signatureSize.height,
      ratio: (signature.size?.width || signatureSize.width) / (signature.size?.height || signatureSize.height)
    });
  };

  const handleResize = (e) => {
    if (!isResizing || !selectedSignature || !resizeStartData) return;
    e.preventDefault();

    const deltaX = e.clientX - resizeStartData.startX;
    const newWidth = Math.max(50, resizeStartData.startWidth + deltaX);
    const newHeight = newWidth / resizeStartData.ratio;

    setSignatures(prev =>
      prev.map(sig =>
        sig.id === selectedSignature.id
          ? {
              ...sig,
              size: {
                width: newWidth,
                height: newHeight
              }
            }
          : sig
      )
    );
  };

  const handleResizeEnd = () => {
    if (isResizing) {
      setIsResizing(false);
      setResizeStartData(null);
      addToHistory();
    }
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
      width: '100vw',
      margin: 0,
      padding: 0,
      maxWidth: 'none'
    }}>
      <Box sx={{ 
        p: { xs: 1, sm: 2 }, 
        borderBottom: 1, 
        borderColor: 'divider', 
        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        color: 'white',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
      }} className="app-header">
        <Typography variant="h4" component="h1" sx={{ 
          textAlign: 'center', 
          color: 'white', 
          fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2.5rem' }, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontWeight: 600,
          letterSpacing: '0.5px'
        }} className="app-title">
          <CreateIcon sx={{ mr: 1, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2.5rem' } }} />
          Digital Signature Tool
          {pdfUrl && (
            <IconButton onClick={handleRemovePdf} sx={{ 
              ml: 1, 
              color: 'rgba(255, 255, 255, 0.9)',
              '&:hover': {
                color: 'white',
                backgroundColor: 'rgba(255, 255, 255, 0.1)'
              }
            }}>
              <DeleteIcon fontSize={isMobile ? "small" : "medium"} />
            </IconButton>
          )}
          <IconButton onClick={toggleFullScreen} sx={{ 
            ml: 1, 
            color: 'rgba(255, 255, 255, 0.9)',
            '&:hover': {
              color: 'white',
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}>
            {isFullScreen ? <FullscreenExitIcon fontSize={isMobile ? "small" : "medium"} /> : <FullscreenIcon fontSize={isMobile ? "small" : "medium"} />}
          </IconButton>
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'hidden', width: '100%' }}>
        {!pdfUrl ? (
          <Paper {...getRootProps()} elevation={0} className="pdf-dropzone" sx={{ m: 2 }}>
            <input {...getInputProps()} />
            <CloudUploadIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: '#6366f1', mb: 2 }} />
            <Typography className="dropzone-text">
              {isDragActive ? "Drop your PDF file here" : "Drag and drop your PDF file here"}
            </Typography>
            <Typography className="dropzone-subtext">
              or click to browse files
            </Typography>
          </Paper>
        ) : (
          <Box 
            className={`pdf-container ${isFullScreen ? 'fullscreen' : ''}`}
            ref={pdfContainerRef} 
            onClick={() => setSelectedSignature(null)}
            onMouseMove={(e) => {
              handleMouseMove(e);
              if (isResizing) handleResize(e);
            }}
            onMouseUp={() => {
              handleMouseUp();
              handleResizeEnd();
            }}
            onMouseLeave={() => {
              handleMouseUp();
              handleResizeEnd();
            }}
            sx={{ 
              height: isFullScreen ? '100vh' : '100%', 
              width: isFullScreen ? '100vw' : '100%',
              display: 'flex', 
              flexDirection: 'column', 
              margin: 0,
              padding: 0,
              position: isFullScreen ? 'fixed' : 'relative',
              left: isFullScreen ? 0 : 'auto',
              top: isFullScreen ? 0 : 'auto',
              right: isFullScreen ? 0 : 'auto',
              bottom: isFullScreen ? 0 : 'auto'
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              p: 1, 
              borderBottom: 1, 
              borderColor: 'divider', 
              bgcolor: 'background.paper',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Box>
                <IconButton onClick={() => handlePageChange('prev')} disabled={currentPage <= 1} sx={{ color: '#6366f1' }}>
                  <NavigateBeforeIcon />
                </IconButton>
                <Typography variant="body1" component="span" sx={{ mx: 1 }}>
                  Page {currentPage} of {totalPages}
                </Typography>
                <IconButton onClick={() => handlePageChange('next')} disabled={currentPage >= totalPages} sx={{ color: '#6366f1' }}>
                  <NavigateNextIcon />
                </IconButton>
              </Box>
              <Box>
                <IconButton onClick={openDrawSignatureModal} sx={{ color: 'action.active' }}>
                  <CreateIcon />
                </IconButton>
                <IconButton 
                  onClick={handleUndo} 
                  disabled={history.currentIndex <= 0}
                  sx={{ 
                    color: history.currentIndex > 0 ? 'action.active' : 'action.disabled',
                    '&:hover': {
                      backgroundColor: history.currentIndex > 0 ? 'rgba(0, 0, 0, 0.04)' : 'transparent'
                    }
                  }}
                >
                  <UndoIcon />
                </IconButton>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={handleSignaturePlacementConfirm}
                  sx={{ ml: 1 }}
                >
                  Save and Download PDF
                </Button>
              </Box>
            </Box>
            
            <Box className="pdf-content" sx={{ 
              flex: 1, 
              position: 'relative', 
              overflow: 'auto', 
              bgcolor: '#f5f5f5',
              width: '100%',
              margin: 0,
              padding: 0
            }}>
              {/* Zoom container */}
              <div style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: 'top left', 
                position: 'relative', 
                width: isFullScreen ? '100vw' : '100%', 
                height: isFullScreen ? '100vh' : '100%',
                margin: 0,
                padding: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start'
              }}>
                {pdfUrl && !useEmbedFallback ? (
                  // React-PDF approach
                  <div className="pdf-document-container" style={{ 
                    position: 'relative',
                    width: '100%',
                    maxWidth: '800px',
                    margin: '0 auto',
                    background: 'white',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                  }}>
                    <Document
                      file={pdfUrl}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={onDocumentLoadError}
                      loading={
                        <div className="loading-indicator">
                          <div>Loading PDF...</div>
                        </div>
                      }
                      error={
                        <div className="error-message">
                          <div>{pdfError || 'Error loading PDF!'}</div>
                          <div>Please try again with a different file.</div>
                        </div>
                      }
                    >
                      <Page 
                        key={`page_${currentPage}`}
                        pageNumber={currentPage} 
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        width={Math.min(pageWidth, 800)}
                        scale={scale}
                      />
                    </Document>
                    
                    {signatures.filter(sig => sig.page === currentPage).map((sig) => (
                      <div 
                        key={sig.id} 
                        className={`signature-overlay ${selectedSignature?.id === sig.id ? 'active' : ''}`}
                        style={{ 
                          position: 'absolute', 
                          left: `${sig.position.x}px`, 
                          top: `${sig.position.y}px`, 
                          cursor: isDraggingSignature ? 'grabbing' : 'grab',
                          zIndex: selectedSignature?.id === sig.id ? 1001 : 1000,
                          width: `${sig.size?.width || signatureSize.width}px`,
                          height: `${sig.size?.height || signatureSize.height}px`,
                          userSelect: 'none',
                          touchAction: 'none',
                          border: selectedSignature?.id === sig.id ? '1px solid #6366f1' : 'none'
                        }}
                        ref={el => { if (el) signatureRefs.current[sig.id] = el; }}
                        onMouseDown={(e) => {
                          handleMouseDown(e, sig);
                          setSelectedSignature(sig);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSignature(sig);
                        }}
                      >
                        <img 
                          src={sig.url} 
                          alt="Signature" 
                          style={{ 
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none', 
                            userSelect: 'none',
                            display: 'block'
                          }} 
                        />

                        {/* Resize handle */}
                        {selectedSignature?.id === sig.id && (
                          <div
                            className="resize-handle"
                            style={{
                              position: 'absolute',
                              bottom: '-6px',
                              right: '-6px',
                              width: '12px',
                              height: '12px',
                              backgroundColor: '#6366f1',
                              borderRadius: '50%',
                              cursor: 'se-resize',
                              zIndex: 1002
                            }}
                            onMouseDown={(e) => handleResizeStart(e, sig)}
                          />
                        )}

                        {/* Delete button */}
                        <IconButton
                          size="small"
                          onClick={(e) => handleSignatureDelete(e, sig.id)}
                          sx={{
                            position: 'absolute',
                            top: '-20px',
                            right: '-20px',
                            backgroundColor: 'white',
                            '&:hover': { backgroundColor: '#f5f5f5' }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                ) : pdfUrl && useEmbedFallback ? (
                  // Fallback object/embed approach
                  <div className="pdf-document-container" style={{ 
                    position: 'relative',
                    width: '100%',
                    height: '80vh',
                    margin: '0 auto',
                    background: 'white',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                  }}>
                    <object
                      data={pdfUrl}
                      type="application/pdf"
                      width="100%"
                      height="100%"
                      style={{
                        border: 'none',
                        background: 'white',
                      }}
                    >
                      <embed
                        src={pdfUrl}
                        type="application/pdf"
                        width="100%"
                        height="100%"
                        style={{
                          border: 'none',
                          background: 'white',
                        }}
                      />
                    </object>
                    
                    {/* Signature overlays for fallback approach */}
                    <div className="signature-overlay-container" style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                      zIndex: 1000
                    }}>
                      <div style={{ padding: '20px', background: 'rgba(255,255,255,0.7)', borderRadius: '5px' }}>
                        <Typography variant="body1">
                          Using fallback PDF viewer. Signatures will be added when saving.
                        </Typography>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </Box>
          </Box>
        )}
      </Box>

      {/* Draw signature modal */}
      <Dialog open={isDrawSignatureModalOpen} onClose={() => setIsDrawSignatureModalOpen(false)} maxWidth="sm" fullWidth={isMobile}>
        <DialogContent sx={{ 
          textAlign: 'center', 
          p: { xs: 2, sm: 3 }, 
          width: { xs: '100%', sm: '400px' }, 
          maxWidth: '100%',
          position: 'relative' 
        }}>
          <IconButton
            onClick={() => setIsDrawSignatureModalOpen(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>Draw Your Signature</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
            After saving, your signature will appear on the PDF and you can drag it to position it.
          </Typography>
          
          {/* Color and Size Controls */}
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 2,
            gap: 2
          }}>
            {/* Color Picker */}
            <Box className="control-group">
              <Typography variant="body2" sx={{ mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Signature Color
              </Typography>
              <input
                type="color"
                value={signatureColor}
                onChange={(e) => updateSignaturePadColor(e.target.value)}
                className="color-picker-input"
                style={{ width: '50px', height: '40px' }}
              />
            </Box>
            
            {/* Pen Size Control */}
            <Box className="control-group" sx={{ flexGrow: 1, maxWidth: { xs: '100%', sm: '60%' } }}>
              <Typography variant="body2" sx={{ mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Pen Size: {penSize}px
              </Typography>
              <Slider
                value={penSize}
                min={1}
                max={10}
                step={1}
                onChange={(_, newValue) => updateSignaturePadSize(newValue)}
                sx={{ 
                  color: signatureColor,
                  '& .MuiSlider-thumb': {
                    height: 16,
                    width: 16,
                    backgroundColor: '#fff',
                    border: `2px solid ${signatureColor}`,
                  },
                  '& .MuiSlider-track': {
                    height: 4,
                  },
                  '& .MuiSlider-rail': {
                    height: 4,
                    opacity: 0.5,
                  },
                }}
              />
            </Box>
          </Box>
          
          <Box sx={{ 
            height: { xs: '150px', sm: '200px' }, 
            mb: 2,
            border: '1px solid #ddd',
            borderRadius: '4px',
            overflow: 'hidden',
            backgroundColor: '#fff'
          }} className="signature-pad-container">
            <SignaturePad 
              ref={signatureRef} 
              canvasProps={{ 
                className: 'signature-canvas',
                style: { width: '100%', height: '100%' } 
              }}
              penColor={signatureColor}
              dotSize={penSize}
              minWidth={penSize}
              maxWidth={penSize * 2}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button variant="outlined" onClick={clearSignature} size={isMobile ? "small" : "medium"}>
              Clear
            </Button>
            <Button variant="contained" onClick={saveSignature} size={isMobile ? "small" : "medium"} className="action-button">
              Save & Place
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default PDFEditor; 