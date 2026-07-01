import React from 'react';
import './index.css';
import { EditorProvider } from './store/editorStore';
import { SODProvider } from './store/sodStore';
import EditorPage from './components/EditorPage';

function App() {
  return (
    <EditorProvider>
      <SODProvider>
        <EditorPage />
      </SODProvider>
    </EditorProvider>
  );
}

export default App;
