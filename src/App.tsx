import React from 'react';
import './index.css';
import { EditorProvider } from './store/editorStore';
import { SODProvider } from './store/sodStore';
import { CompareProvider } from './store/compareStore';
import EditorPage from './components/EditorPage';

function App() {
  return (
    <EditorProvider>
      <SODProvider>
        <CompareProvider>
          <EditorPage />
        </CompareProvider>
      </SODProvider>
    </EditorProvider>
  );
}

export default App;
