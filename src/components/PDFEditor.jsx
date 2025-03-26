import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Container, Paper, Typography, IconButton, Slider, Dialog, DialogContent, TextField } from '@mui/material';
import { useDropzone } from 'react-dropzone';
import SignaturePad from 'react-signature-canvas';
import { PDFDocument } from 'pdf-lib';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CreateIcon from '@mui/icons-material/Create';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import BrushIcon from '@mui/icons-material/Brush';
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
  const [drawingMode, setDrawingMode] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [rotation, setRotation] = useState(0);
  const [signatureSize] = useState({ width: 150, height: 50 });
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [tempTextPosition, setTempTextPosition] = useState(null);
  const [isDraggingSignature, setIsDraggingSignature] = useState(false);
  const [activeSignature, setActiveSignature] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [pdfError, setPdfError] = useState(null);
  const [useEmbedFallback, setUseEmbedFallback] = useState(false);
  const [signatureColor, setSignatureColor] = useState('#000000');

  // Refs for signature pad, PDF container, drawing canvas and its context
  const signatureRef = useRef(null);
  const pdfContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingContextRef = useRef(null);
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

  // Setup canvas for drawing mode
  useEffect(() => {
    if (drawingMode && canvasRef.current && pdfContainerRef.current) {
      const pdfPage = pdfContainerRef.current.querySelector('.react-pdf__Page');
      if (!pdfPage) return;
      
      const pdfRect = pdfPage.getBoundingClientRect();
      const canvas = canvasRef.current;
      
      // Set canvas size to match the PDF page
      canvas.width = pdfRect.width;
      canvas.height = pdfRect.height;
      
      // Set canvas style position to match PDF
      canvas.style.top = `${pdfRect.top - pdfContainerRef.current.getBoundingClientRect().top}px`;
      canvas.style.left = `${pdfRect.left - pdfContainerRef.current.getBoundingClientRect().left}px`;
      canvas.style.width = `${pdfRect.width}px`;
      canvas.style.height = `${pdfRect.height}px`;
      
      const context = canvas.getContext('2d');
      context.strokeStyle = '#000';
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      drawingContextRef.current = context;
    }
  }, [drawingMode, scale, currentPage]);

  // Handle PDF container click for signatures or text
  const handlePdfClick = (event) => {
    if (!pdfContainerRef.current || !pdfUrl) return;

    // Get the position of the PDF page
    const pdfPage = pdfContainerRef.current.querySelector('.react-pdf__Page');
    if (!pdfPage) return;

    const pdfRect = pdfPage.getBoundingClientRect();
    
    // Check if click is within PDF page
    if (
      event.clientX < pdfRect.left || 
      event.clientX > pdfRect.right || 
      event.clientY < pdfRect.top || 
      event.clientY > pdfRect.bottom
    ) {
      return; // Click outside the PDF page
    }

    // Calculate position relative to the PDF page
    const x = (event.clientX - pdfRect.left) / scale;
    const y = (event.clientY - pdfRect.top) / scale;

    if (textMode) {
      setTempTextPosition({ x, y });
      setIsTextModalOpen(true);
    } else if (!drawingMode) {
      setTempSignaturePosition({ x, y });
      setIsSignatureModalOpen(true);
    }
  };

  // Drawing handler for canvas
  const handleDrawing = (event) => {
    if (!drawingMode || !drawingContextRef.current || !canvasRef.current) return;
    
    const context = drawingContextRef.current;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get coordinates (handling both mouse and touch events)
    let clientX, clientY;
    if (event.type.startsWith('touch')) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
      event.preventDefault(); // Prevent scrolling on touch
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    // Check if pointer is within canvas bounds
    if (
      clientX < rect.left || 
      clientX > rect.right || 
      clientY < rect.top || 
      clientY > rect.bottom
    ) {
      return;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    if (event.type === 'mousedown' || event.type === 'touchstart') {
      context.beginPath();
      context.moveTo(x, y);
    } else if (event.type === 'mousemove' || event.type === 'touchmove') {
      context.lineTo(x, y);
      context.stroke();
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
        rotation
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

  const confirmTextPlacement = () => {
    if (tempTextPosition && textInput) {
      const newAnnotation = {
        id: Date.now(),
        type: 'text',
        content: textInput,
        position: tempTextPosition,
        page: currentPage,
        fontSize: 16,
        color: { r: 0, g: 0, b: 0 },
        fontFamily: 'Helvetica'
      };
      setAnnotations(prev => {
        const newAnnotations = [...prev, newAnnotation];
        // Add to history after state update
        setTimeout(() => addToHistory(), 0);
        return newAnnotations;
      });
      setIsTextModalOpen(false);
      setTempTextPosition(null);
      setTextInput('');
      setTextMode(false);
    }
  };

  // Rotate signature
  const rotateSignature = () => {
    setRotation(prev => (prev + 90) % 360);
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

      // Add signatures to the PDF - process all signatures for all pages
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
          const sigWidth = (signatureSize.width / displayRect.width) * pageWidth;
          const sigHeight = (signatureSize.height / displayRect.height) * pageHeight;
          
          // Draw the signature with proper positioning and rotation
          page.drawImage(sigImg, {
            x: pdfX,
            y: pdfY,
            width: sigWidth,
            height: sigHeight,
            rotate: { type: 'degrees', angle: sig.rotation || 0 }
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

      // Add drawings from canvas if in drawing mode
      if (canvasRef.current && drawingMode) {
        try {
          const page = pages[currentPage - 1];
          if (page) {
            const { width: pageWidth, height: pageHeight } = page.getSize();
            
            // Get drawing as PNG
            const drawingDataUrl = canvasRef.current.toDataURL('image/png');
            const base64Data = drawingDataUrl.split(',')[1];
            const drawingBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            // Embed the drawing
            const drawingImg = await pdfDoc.embedPng(drawingBytes);
            
            // Draw the image on the whole page
            page.drawImage(drawingImg, {
              x: 0,
              y: 0,
              width: pageWidth,
              height: pageHeight
            });
          }
        } catch (error) {
          console.error('Error adding drawing to PDF:', error);
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
      
      // Create a new signature in the center of the visible PDF area
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
          rotation: 0,
          color: signatureColor
        };
        
        setSignatures(prev => {
          const newSignatures = [...prev, newSignature];
          setTimeout(() => addToHistory(), 0);
          return newSignatures;
        });
        setActiveSignature(newSignature);
        setIsDraggingSignature(true);
      }
    }
  };

  const openDrawSignatureModal = () => {
    setIsDrawSignatureModalOpen(true);
  };

  // Mode toggles
  const toggleDrawingMode = () => {
    setDrawingMode(!drawingMode);
    if (textMode) setTextMode(false);
  };

  const toggleTextMode = () => {
    setTextMode(!textMode);
    if (drawingMode) setDrawingMode(false);
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
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="h4" component="h1" sx={{ textAlign: 'center', color: '#6366f1', fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Digital Signature Tool
          {pdfUrl && (
            <IconButton onClick={handleRemovePdf} sx={{ ml: 2, color: '#ef4444' }}>
              <DeleteIcon />
            </IconButton>
          )}
          <IconButton onClick={toggleFullScreen} sx={{ ml: 2, color: '#6366f1' }}>
            {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
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
            onClick={handlePdfClick}
            onMouseMove={handleMouseMove} 
            onMouseUp={handleMouseUp}
            onTouchMove={handleTouchMove} 
            onTouchEnd={handleTouchEnd}
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
                <IconButton onClick={toggleDrawingMode} sx={{ color: drawingMode ? 'primary.main' : 'action.active' }}>
                  <BrushIcon />
                </IconButton>
                <IconButton onClick={toggleTextMode} sx={{ color: textMode ? 'primary.main' : 'action.active' }}>
                  <TextFieldsIcon />
                </IconButton>
                <IconButton onClick={openDrawSignatureModal} sx={{ color: 'action.active' }}>
                  <CreateIcon />
                </IconButton>
                <IconButton onClick={rotateSignature} sx={{ color: 'action.active' }}>
                  <RotateRightIcon />
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
                    
                    {signatures.filter(sig => sig.page === currentPage).map((sig, index) => (
                      <div 
                        key={sig.id} 
                        className={`signature-overlay ${activeSignature === sig ? 'active' : ''}`}
                        style={{ 
                          position: 'absolute', 
                          left: `${sig.position.x}px`, 
                          top: `${sig.position.y}px`, 
                          transform: `rotate(${sig.rotation}deg)`, 
                          cursor: isDraggingSignature ? 'grabbing' : 'grab',
                          zIndex: activeSignature === sig ? 1001 : 1000,
                          userSelect: 'none',
                          touchAction: 'none',
                          '--signature-color-filter': sig.color ? `drop-shadow(0 0 0 ${sig.color})` : 'none'
                        }}
                        ref={el => { if (el) signatureRefs.current[sig.id] = el; }}
                        onMouseDown={(e) => handleMouseDown(e, sig)} 
                        onTouchStart={(e) => handleTouchStart(e, sig)}
                        onDoubleClick={(e) => handleSignatureDoubleClick(e, sig)}
                      >
                        <img 
                          src={sig.url} 
                          alt="Signature" 
                          style={{ 
                            width: signatureSize.width, 
                            height: signatureSize.height, 
                            pointerEvents: 'none', 
                            userSelect: 'none',
                            display: 'block'
                          }} 
                        />
                        <IconButton
                          size="small"
                          onClick={(e) => handleSignatureDelete(e, sig.id)}
                          sx={{
                            position: 'absolute',
                            top: -20,
                            right: -20,
                            backgroundColor: 'white',
                            '&:hover': {
                              backgroundColor: '#f5f5f5'
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </div>
                    ))}
                    
                    {drawingMode && (
                      <canvas ref={canvasRef} className="drawing-canvas"
                        style={{ 
                          position: 'absolute',
                          pointerEvents: 'all',
                          zIndex: 999,
                          touchAction: 'none'
                        }}
                        onMouseDown={handleDrawing} 
                        onMouseMove={handleDrawing} 
                        onMouseUp={() => drawingContextRef.current?.closePath()}
                        onTouchStart={handleDrawing} 
                        onTouchMove={handleDrawing} 
                        onTouchEnd={() => drawingContextRef.current?.closePath()} 
                      />
                    )}
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
      <Dialog open={isDrawSignatureModalOpen} onClose={() => setIsDrawSignatureModalOpen(false)}>
        <DialogContent sx={{ textAlign: 'center', p: 3, width: { xs: '300px', sm: '400px' }, position: 'relative' }}>
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
          <Typography variant="h6" gutterBottom>Draw Your Signature</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            After saving, your signature will appear on the PDF and you can drag it to position it.
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Signature Color</Typography>
            <input
              type="color"
              value={signatureColor}
              onChange={(e) => updateSignaturePadColor(e.target.value)}
              style={{ 
                width: '50px', 
                height: '50px', 
                padding: '0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '16px'
              }}
            />
          </Box>
          <Box sx={{ height: '200px', mb: 2 }}>
            <SignaturePad 
              ref={signatureRef} 
              canvasProps={{ className: 'signature-canvas' }}
              penColor={signatureColor}
            />
          </Box>
          <Button variant="outlined" onClick={clearSignature} sx={{ mr: 1 }}>
            Clear
          </Button>
          <Button variant="contained" onClick={saveSignature}>
            Save & Place Signature
          </Button>
        </DialogContent>
      </Dialog>

      {/* Text input modal */}
      <Dialog open={isTextModalOpen} onClose={() => setIsTextModalOpen(false)}>
        <DialogContent sx={{ textAlign: 'center', p: 3 }}>
          <Typography variant="h6" gutterBottom>Add Text</Typography>
          <TextField 
            fullWidth
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            margin="normal"
            placeholder="Enter text..."
          />
          <Button variant="contained" onClick={confirmTextPlacement} disabled={!textInput}>
            Add Text
          </Button>
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default PDFEditor; 