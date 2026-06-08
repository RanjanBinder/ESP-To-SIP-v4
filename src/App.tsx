import React from 'react';
import './index.css';
import { EditorProvider } from './store/editorStore';
import EditorPage from './components/EditorPage';

function App() {
  return (
    <EditorProvider>
      <EditorPage />
    </EditorProvider>
  );
}

export default App;
