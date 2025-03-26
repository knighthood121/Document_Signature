import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PDFEditor from './components/PDFEditor';

const theme = createTheme({
  palette: {
    primary: {
      main: '#6366f1',
    },
    secondary: {
      main: '#4f46e5',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <PDFEditor />
    </ThemeProvider>
  );
}

export default App;
